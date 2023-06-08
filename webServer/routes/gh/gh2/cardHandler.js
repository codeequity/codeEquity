const rootLoc = "../../../";

const assert  = require( 'assert' );
const config  = require( rootLoc + 'config' );

const utils     = require( rootLoc + 'utils/ceUtils' );
const awsUtils  = require( rootLoc + 'utils/awsUtils' );

const ghUtils   = require( rootLoc + 'utils/gh/ghUtils' );
const gh2DUtils = require( rootLoc + 'utils/gh/gh2/gh2DataUtils' );

const ghV2     = require( rootLoc + 'utils/gh/gh2/ghV2Utils' );


/*
https://developer.github.com/webhooks/event-payloads/#issues
https://octokit.github.io/rest.js/v18#projects-delete-card
https://developer.github.com/v3/issues/#create-an-issue
*/

// Move WITHIN project
// The implied action of an underlying move out of a column depends on the originating PEQType.
// PeqType:GRANT  Illegal       There are no 'takebacks' when it comes to provisional equity grants
//                              This type only exists for cards/issues in the 'Accrued' column... can not move out 
// PeqType:ALLOC  Notice only.  Master proj is not consistent with config.PROJ_COLS.
//                              !Master projects do not recognize <allocation>
// PeqType:PLAN  most common
async function recordMove( authData, ghLinks, pd, oldCol, newCol, link, peq ) { 
    let reqBody  = pd.reqBody;
    let fullName = link.hostRepoName;
    
    assert( oldCol != config.PROJ_ACCR );  // no take-backs

    // I want peqId for notice PActions, with or without issueId
    if( typeof peq == 'undefined' ) {
	// Note.  Spin wait for peq to finish recording from sibling labelIssue notification
	peq = await utils.settleWithVal( "validatePeq", ghUtils.validatePEQ, authData, pd.ceProjectId, link.hostIssueId, link.hostIssueName, link.hostProjectId );
    }
    
    assert( peq['PeqType'] != config.PEQTYPE_GRANT );
    console.log( "Recording move for peq:", peq.PEQId );

    let verb   = "";
    let action = "";
    // Note, flat projects/cols like eggs and bacon fall into this group
    if( peq['PeqType'] == config.PEQTYPE_ALLOC ||
	( oldCol <= config.PROJ_PROG && newCol <= config.PROJ_PROG ) ) {
	// moving between plan, and in-progress has no impact on peq summary, but does impact summarization
	verb   = config.PACTVERB_CONF;
	action = config.PACTACT_RELO;
    }
    else if( oldCol <= config.PROJ_PROG && newCol == config.PROJ_PEND ) {
	// task complete, waiting for peq approval
	verb   = config.PACTVERB_PROP;
	action = config.PACTACT_ACCR;
    }
    else if( oldCol == config.PROJ_PEND && newCol <= config.PROJ_PROG) {
	// proposed peq has been rejected
	verb   = config.PACTVERB_REJ;
	action = config.PACTACT_ACCR;
    }
    else if( oldCol <= config.PROJ_PEND && newCol == config.PROJ_ACCR ) {
	// approved!   PEQ will be updated to "type:accrue" when processed in ceFlutter.
	verb   = config.PACTVERB_CONF;
	action = config.PACTACT_ACCR;
    }
    else {
	// XXX This can indicate a dropped notification.  Need to recover in some cases, this one is probably safe.
	console.log( authData.who, "Verb, action combo not understood", oldCol, newCol, peq.PeqType );
	console.log( reqBody );
	console.log( link );
	assert( false );
    }

    let subject = [peq.PEQId];
    if( verb == config.PACTVERB_REJ && newCol >= 0 ) {
	let locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "repo": fullName, "colName": config.PROJ_COLS[newCol] } );
	assert( locs !== -1 );
	subject = [ peq.PEQId, locs[0].hostColumnName ];
    }
    else if( action == config.PACTACT_RELO ) {
	// console.log( reqBody );
	let cardId = reqBody.projects_v2_item.node_id;

	let links  = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repo": fullName, "cardId": cardId } );  // linkage already updated
	assert( links  !== -1 && links[0].hostColumnId != config.EMPTY );

	subject = [ peq.PEQId, links[0].hostProjectId, links[0].hostColumnId ];
    }
    
    // Don't wait
    // Note.  Ingest manages peq.psub (i.e. move relo does not manage peq.psub), excluding this first move from unclaimed to initial residence.    
    awsUtils.recordPEQAction( authData, config.EMPTY, reqBody['sender']['login'], pd.ceProjectId,
			   verb, action, subject, "", 
			   utils.getToday(), reqBody );
}

// This is called from issue:delete, and triggered from card:delete (which may be triggered initially from issue:xfer since xfer leaves card in place)
// issue:delete - GH removes the card without notification.
// transfer issue leaves card in place in old repo, so issue:transfer will issue a GH:delete card, which will trigger here eventually.
// del project?  For now, not getting project notifications.
// del column triggers a move (to no status), not delete.
// No matter the source, delete card must manage linkage, peq, pact, etc.
// No matter the source, card will not exist in GH when this is called.
async function deleteCard( authData, ghLinks, pd, cardId, fromIssue ) {
    // issue:del calls here first, if still has linkage.
    let issueExists = typeof fromIssue === 'undefined' ? true : !fromIssue;  
    
    // Cards now only exist with an underlying issue or draftIssue.  If draft issue, no op.
    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "cardId": cardId });
    if( links === -1 ) { console.log( "No action taken for draft issues & their cards." ); return; }
    
    let link    = links[0];
    const accr  = link.hostColumnName == config.PROJ_COLS[config.PROJ_ACCR];
    let comment = "CodeEquity removed the PEQ label from this issue when the attached project_card was deleted.";
    comment    += " PEQ issues require a 1:1 mapping between issues and cards.";

    // Carded, untracked (i.e. not peq)?   Just remove linkage, since GH removed card.
    if( link.hostColumnId == config.EMPTY ) {
	ghLinks.removeLinkage({"authData": authData, "ceProjId": link.ceProjectId, "issueId": link.hostIssueId });
	return;
    }
    
    // PEQ.  Card is gone in GH, issue may be gone depending on source.  Need to manage linkage, location, peq label, peq/pact.
    // Wait later
    let peq = awsUtils.getPeq( authData, pd.ceProjectId, link.hostIssueId );
    
    // Regular peq?  or ACCR already in unclaimed?  remove it no matter what.
    if( !accr || link.hostProjectName == config.UNCLAIMED ) {
	console.log( authData.who, "Removing peq", accr, issueExists );
	if( issueExists ) {
	    let success = await ghV2.removePeqLabel( authData, link.hostIssueId );
	    // Don't wait
	    if( success ) { ghV2.addComment( authData, link.hostIssueId, comment ); }
	}
	ghLinks.removeLinkage({"authData": authData, "ceProjId": link.ceProjectId, "issueId": link.hostIssueId });
	
	// no need to wait.
	// Notice for accr since we are NOT deleting an accrued peq, just removing GH records.
	peq = await peq;
	if( peq === -1 ) { console.log( "WARNING.  Race condition detected when deleting peq. Error?", peq, link ); }
	else {             awsUtils.removePEQ( authData, peq.PEQId ); }
	let action = accr ? config.PACTACT_NOTE  : config.PACTACT_DEL;
	let note   = accr ? "Disconnected issue" : "";
	awsUtils.recordPEQAction( authData, config.EMPTY, pd.actor, pd.ceProjectId,
			       config.PACTVERB_CONF, action, [peq.PEQId], note,
			       utils.getToday(), pd.reqBody );
    }
    // ACCR, not in unclaimed.  
    else if( issueExists ) {
	console.log( authData.who, "Moving ACCR", accr, issueExists, link.hostIssueId );
	// XXX BUG.  When attempting to transfer an accrued issue, GH issue delete is slow, can be in process when get here.
	//           card creation can fail, and results can be uncertain at this point.  
	let card = await ghV2.createUnClaimedCard( authData, ghLinks, ceProjects, pd, link.hostIssueId, accr );  
	link.hostCardId      = card.cardId;
	link.hostProjectId   = card.projId;
	link.hostProjectName = config.UNCLAIMED;
	link.hostColumnId    = card.columnId;
	link.hostColumnName  = config.PROJ_COLS[config.PROJ_ACCR];
	
	const psub = [ link.hostProjectName, link.hostColumnName ];
	
	// No need to wait
	peq = await peq;
	awsUtils.updatePEQPSub( authData, peq.PEQId, psub );
	awsUtils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.ceProjectId,
			       config.PACTVERB_CONF, config.PACTACT_RELO, [peq.PEQId, link.hostProjectId, link.hostColumnId], "",
			       utils.getToday(), pd.reqBody );
	
    }
    // ACCR, not unclaimed, but issue deleted.  Delete issue must handle this since we don't have label, allocation.
    else {
	console.log( authData.who, "Issue handler will recreate ACCR in unclaimed", accr, issueExists );
    }
}


// Card operations: no PEQ label, not related to CodeEquity.  No action.
// Card operations: with PEQ label:  Record.  If relevant, create related issue and label. 
// Can generate several notifications in one operation - so if creator is <bot>, ignore as pending.

// NOTE this does not receive direct notifications, but is instead called from other handlers 
async function handler( authData, ceProjects, ghLinks, pd, action, tag ) {

    pd.actor = pd.reqBody.sender.login;
    let card = pd.reqBody.projects_v2_item;

    console.log( authData.who, "Card", action, "Actor:", pd.actor );
    // pd.show();
    
    switch( action ) {
    case 'created' :
	{
	    // May or may not be PEQ.
	    assert( card.content_type == "Issue" );
	    pd.issueId = card.content_node_id;

	    // Get from GH.. will not postpone if populate
	    // XXX after ceFlutter, move this below postpone, remove populate condition.  pop label not yet attached.  
	    let issue = await ghV2.getFullIssue( authData, pd.issueId);  

	    // item:create could arrive before issue:open/label.
	    // Can not create card without issue in pv2.   Can create issues without cards .. newborn issues will NOT create links without peq labels.
	    // postpone if have peq label in GH, but no link in CE
	    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "issueId": pd.issueId });
	    let labelDat = [];
	    if( issue.labels.length > 0 ) {
		for( label of issue.labels ) { labelDat.push( label.description ); }
	    }	    
	    let peqVal = ghUtils.parseLabelDescr( labelDat );
	    let postpone = ( links === -1 && peqVal > 0 );
	    if( postpone > 0 && !( issue.title == "A special populate issue" ) ) {
		console.log( authData.who, "issue:label has not yet arrived.  Postponing create card", pd.issueId, issue.title );
		return "postpone";
	    }
	    
	    // In issues dialog, if add to project, will automatically be placed in "No Status".
	    // Otherwise, unclaimed was generated, need to clean it.
	    let foundUnclaimed = await ghV2.cleanUnclaimed( authData, ghLinks, pd );
	    console.log( authData.who, "found unclaimed?", foundUnclaimed );

	    // PNP adds colId.
	    // Ingest manages peq.psub (i.e. move relo does not manage peq.psub), excluding this first move from unclaimed to initial residence.
	    // if remade card, then update peq too, just this once.  This is the only time cross-project moves are allowed.
	    let specials = foundUnclaimed ? {pact: "addRelo", fromCard: true} : {fromCard: true};
	    
	    // Wait.  Linkage should not be in progress when subsequent card:move is processed.
	    // Call PNP to add linkage, resolve, etc.  
	    // pact is ignore, since 'create' is always accompanied by 'move'.  'move' does relo.
	    await gh2DUtils.processNewPEQ( authData, ghLinks, pd, issue, -1, specials );
	}
	break;
    case 'converted' :
	{
	    // Get here with: Convert to issue' on a newborn card, which also notifies with project_card converted.  handle here.
	    // Can only be non-PEQ.  Otherwise, would see created/content_url
	    console.log( "Non-PEQ card converted to issue.  No action." );
	}
	break;
    case 'moved' :
	{
	    // within gh project, move card from 1 col to another.
	    // Note: significant overlap with issueHandler:open/close.  But more cases to handle here to preserve reserved cols
	    
	    let cardId = card.node_id;

	    if( pd.reqBody.changes == null ) {
		console.log( authData.who, "Move within columns are ignored.", cardId );
		// XXX ran into notification error, empty changes during cross-col xfer.  temporary?
		console.log( authData.who, "XXX", pd.reqBody );
		return;
	    }

	    let newCard      = await ghV2.getCard( authData, cardId );
	    if( newCard === -1 ) {
		console.log( authData.who, "No such card, ignoring move request." );
		return;
	    }
	    
	    let newColName   = newCard.columnName;
	    let newNameIndex = config.PROJ_COLS.indexOf( newColName );
	    // get no status col
	    const locs       = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "projId": pd.projectId, "colName": "No Status" } );  // XXX formalize
	    assert( locs !== -1 );

	    // Ignore newborn, untracked cards
	    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "cardId": cardId } );
	    
	    if( links === -1 || links[0].hostColumnId == config.EMPTY ) {
		if( newNameIndex > config.PROJ_PROG ) {
		    console.log( authData.who, "WARNING.  Can't move non-PEQ card into reserved column.  Move not processed.", cardId );
		    // No origination data.  use default
		    // Don't wait
		    ghV2.moveCard( authData, pd.projectId, cardId, locs[0].hostUtility, locs[0].hostColumnId );
		}
		else { console.log( authData.who, "Non-PEQ cards are not tracked.  Ignoring.", cardId ); }
		return;
	    }
	    let link = links[0]; // cards are 1:1 with issues
	    let oldColId  = link.hostColumnId;


	    if( newCard.columnId == oldColId ) {
		// console.log( authData.who, "Moves within columns are not tracked", link, newCard, pd.reqBody.changes );
		console.log( authData.who, "Moves within columns are not tracked" );
		return;
	    }
	    console.log( authData.who, "attempting to move card to", newColName, newCard.columnId, "from", oldColId );
	    
	    // Do not allow move out of ACCR
	    if( link.hostColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
		console.log( authData.who, "WARNING.  Can't move Accrued issue.  Move not processed.", cardId );
		ghV2.moveCard( authData, pd.projectId, cardId, locs[0].hostUtility, oldColId );
		return;
	    }

	    // allocations have issues
	    let issueId = link.hostIssueId;
	    assert( issueId != -1 );

	    const fullIssue = await ghV2.getFullIssue( authData, issueId );   
	    let [_, allocation] = ghUtils.theOnePEQ( fullIssue.labels );
	    if( allocation && config.PROJ_COLS.slice(config.PROJ_PROG).includes( newColName )) {
		console.log( authData.who, "WARNING.", "Allocations are only useful in config:PROJ_PLAN, or flat columns.  Moving card back." );
		ghV2.moveCard( authData, pd.projectId, cardId, locs[0].hostUtility, oldColId );
		return;
	    }
	    
	    let oldNameIndex = config.PROJ_COLS.indexOf( link.hostColumnName );
	    assert( cardId == link.hostCardId );
	    assert( newCard.projId == link.hostProjectId );               // not yet supporting moves between projects

	    let success = await ghV2.checkReserveSafe( authData, link.hostIssueId, newNameIndex );
	    if( !success ) {
		ghV2.moveCard( authData, pd.projectId, cardId, locs[0].hostUtility, oldColId );
		return;
	    }
	    ghLinks.updateLinkage( authData, pd.ceProjectId, issueId, cardId, newCard.columnId, newColName );
	    // ghLinks.show();
	    
	    // handle issue.  Don't update issue state if not clear reopen/closed
	    let newIssueState = "";
	    if(      oldNameIndex <= config.PROJ_PROG && newNameIndex >= config.PROJ_PEND ) {  newIssueState = "CLOSED"; }
	    else if( oldNameIndex >= config.PROJ_PEND && newNameIndex <= config.PROJ_PROG ) {  newIssueState = "OPEN";   }
	    
	    if( newIssueState != "" ) {
		// Don't wait 
		ghV2.updateIssue( authData, link.hostIssueId, "state", newIssueState );
	    }
	    // Don't wait
	    recordMove( authData, ghLinks, pd, oldNameIndex, newNameIndex, link );
	}
	break;
    case 'deleted' :
	// Source of notification: delete card (delete col, delete proj, xfer   ???)
	await deleteCard( authData, ghLinks, pd, pd.reqBody.project_card.id );
	break;
    case 'edited' :
	// Only newborn can be edited.   Track issue-free creation above.
	{
	    let cardContent = pd.reqBody['project_card']['note'].split('\n');  // XXXX
	    cardContent = cardContent.map( line => line.replace(/[\x00-\x1F\x7F-\x9F]/g, "") ); // XXXX

	    // Don't wait
	    // XXX XXX add pact: change?
	    ghcDUtils.processNewPEQ( authData, ghLinks, pd, cardContent, -1, {fromCard: true} );
	}
	break;
    default:
	console.log( "Unrecognized action (cards)" );
	break;
    }
    
    return;
}

exports.handler    = handler;
exports.recordMove = recordMove;
exports.deleteCard = deleteCard;
