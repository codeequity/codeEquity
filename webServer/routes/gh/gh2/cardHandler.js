const rootLoc = "../../../";

const assert  = require( 'assert' );
const config  = require( rootLoc + 'config' );

const utils     = require( rootLoc + 'utils/ceUtils' );
const awsUtils  = require( rootLoc + 'utils/awsUtils' );

const ghUtils     = require( rootLoc + 'utils/gh/ghUtils' );
const ingestUtils = require( rootLoc + 'utils/gh/gh2/ingestUtils' );

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
	peq = await utils.settleWithVal( "validatePeq", awsUtils.validatePEQ, authData, pd.ceProjectId, link.hostIssueId, link.hostIssueName, link.hostProjectId );
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
	let locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "repo": fullName, "pid": pd.projectId, "colName": config.PROJ_COLS[newCol] } );
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

// This is called from issue:delete, and triggered from card:delete (which may also be triggered initially from issue:xfer since xfer leaves card in place)
// This may also be triggered programmatically by calling delete (moving to No Status requires a card delete, followed by card create).  Both peq and non-peq.
// issue:delete - GH removes the card without notification.
// transfer issue leaves card in place in old repo, so issue:transfer will issue a GH:delete card, which will trigger here eventually.
// del project?  For now, not getting project notifications.
// del column triggers a move (to no status), not delete.
// No matter the source, delete card must manage linkage, peq, pact, etc.
// No matter the source, card will not exist in GH when this is called.
async function deleteCard( authData, ghLinks, ceProjects, pd, cardId, fromIssue ) {
    // issue:del calls here first, if still has linkage.
    let issueExists = typeof fromIssue === 'undefined' ? true : !fromIssue;  
    
    // Cards now only exist with an underlying issue or draftIssue.  If draft issue, no op.
    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "cardId": cardId });
    if( links === -1 ) { console.log( "No action taken for draft issues & their cards." ); return; }
    
    let link    = links[0];
    pd.repoId   = links[0].hostRepoId
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
    let peq = awsUtils.getPEQ( authData, pd.ceProjectId, link.hostIssueId );
    
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
	console.log( authData.who, "Moving ACCR", pd.repoId, accr, issueExists, link.hostIssueId );
	// XXX BUG.  When attempting to transfer an accrued issue, GH issue delete is slow, can be in process when get here.
	//           card creation can fail, and results can be uncertain at this point.  
	let card = await ghV2.createUnClaimedCard( authData, ghLinks, ceProjects, pd, link.hostIssueId, accr );  
	link.hostCardId      = card.cardId;
	link.hostProjectId   = card.pid;
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

// Consider creating rejectLoc if this is not MAIN_PROJ.  At least, once we can create cols again.
// Either move card back to rejectLoc, or if delete it.
async function rejectCard( authData, ghLinks, pd, card, rejectLoc, msg, track ) {
    let ceProjId = pd.ceProjectId;
    let pid      = pd.projectId;
    let issueId  = card.issueId;
    let cardId   = card.cardId;
    assert( typeof issueId !== 'undefined' && issueId != -1 );
    console.log( authData.who, msg );

    if( rejectLoc !== -1 ) {
	ghV2.moveCard( authData, pid, cardId, rejectLoc.hostUtility, rejectLoc.hostColumnId );
	if( track ) {
	    let link = ghLinks.updateLinkage( authData, ceProjId, issueId, cardId, rejectLoc.hostColumnId, rejectLoc.hostColumnName );
	    // treat reject as a move from flat
	    let newNameIndex = config.PROJ_COLS.indexOf( rejectLoc.hostColumnName );
	    pd.reqBody.projects_v2_item.node_id = cardId;
	    pd.reqBody.ceComment = "move request was rejected, card relocated and possibly split and removed.  If so, split cardId placed in node_id."; 
	    recordMove( authData, ghLinks, pd, -1, newNameIndex, link );
	}
    }
    else {
	// This is a failure case, until we are able to create columns.
	// Choice here is to move to a random column in project, or delete card.  Move to no status would be better, this is not possible (null field)
	// Card deletion is annoying, but no information is lost.
	console.log( authData.who, config.PROJ_COLS[config.PROJ_PLAN], "column does not exist .. deleting card." );
	ghV2.removeCard( authData, pid, cardId );
	ghLinks.removeLinkage( { authData: authData, ceProjId: ceProjId, issueId: issueId, cardId: cardId } );
    }
}


// Card operations: no PEQ label, not related to CodeEquity.  No action.
// Card operations: with PEQ label:  Record.  If relevant, create related issue and label. 
// Can generate several notifications in one operation - so if creator is <bot>, ignore as pending.

// NOTE this does not receive direct notifications, but is instead called from other handlers 
async function handler( authData, ceProjects, ghLinks, pd, action, tag, delayCount ) {

    pd.actor = pd.reqBody.sender.login;
    let card = pd.reqBody.projects_v2_item;

    delayCount = typeof delayCount === 'undefined' ? 0 : delayCount;
    
    console.log( authData.who, "Card", action, "Actor:", pd.actor, card.node_id );
    // pd.show();
    
    switch( action ) {
    case 'created' :
	{
	    // May or may not be PEQ.
	    assert( card.content_type == config.GH_ISSUE );
	    pd.issueId = card.content_node_id;

	    // Get from GH.. will not postpone if issue is already in place
	    let issue = await ghV2.getFullIssue( authData, pd.issueId);
	    assert( Object.keys( issue ).length > 0 );	    

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
	    if( postpone > 0 ) {
		console.log( authData.who, "issue:label has not yet arrived.  Postponing create card", pd.issueId, issue.title );
		return "postpone";
	    }
	    
	    // In issues dialog, if add to project, will automatically be placed in "No Status".
	    // Otherwise, unclaimed was generated, need to clean it.
	    let foundUnclaimed = await ghV2.cleanUnclaimed( authData, ghLinks, pd );
	    console.log( authData.who, "found unclaimed?", foundUnclaimed, pd.issueId );

	    // PNP adds colId.
	    // Ingest manages peq.psub (i.e. move relo does not manage peq.psub), excluding this first move from unclaimed to initial residence.
	    // if remade card, then update peq too, just this once.  This is the only time cross-project moves are allowed.
	    let specials = foundUnclaimed ? {pact: "addRelo", fromCard: true} : {fromCard: true};

	    // We have a peq.  Make sure project is linked in ceProj
	    console.log( "YYY Looking for", pd.ceProjectId, card.project_node_id );
	    let projLocs = ghLinks.getLocs( authData, { ceProjId: pd.ceProjectId, pid: card.project_node_id } );
	    if( projLocs === -1 ) { await ghLinks.linkProject( authData, pd.ceProjectId, card.project_node_id ); }
	    console.log( "YYY projLocs", projLocs );

	    // Call PNP to add linkage, resolve, etc.  
	    // pact is ignore, since 'create' is always accompanied by 'move'.  'move' does relo.
	    // Buut.. skip pnp if columnId in link is already meaningful.  Means GH finished processing before label notice arrived for ceServer
	    let skipPNP =            !foundUnclaimed;                                                               // skip if don't need to rebuild after remove unclaimed
	    skipPNP     = skipPNP && links.length == 1 && utils.validField( links[0], "hostColumnId" );             // skip if existing link could be meaningful
	    skipPNP     = skipPNP && links[0].hostColumnId != -1 && links[0].hostColumnId != config.GH_NO_STATUS;   // skip if existing link is meaningful
	    skipPNP     = skipPNP && links[0].hostCardId == card.node_id;                                           // skip if don't need to resolve 2nd card
	    // Wait.  Linkage should not be in progress when subsequent card:move is processed.
	    if( !skipPNP ) { await ingestUtils.processNewPEQ( authData, ghLinks, pd, issue, -1, specials ); }
	}
	break;
    case 'converted' :
	{
	    // Get here with: Convert to issue' on a newborn card, which also notifies with project_card converted.  handle here.
	    // Can only be non-PEQ.  Otherwise, would see created/content_url
	    // XXX card it.
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
		return;
	    }

	    let newCard = await ghV2.getCard( authData, cardId );

	    // This is the only op ceServer carries out on draft issues.  Protect reserved cols.
	    if( card.content_type == config.GH_ISSUE_DRAFT ) { 
		// Do not allow move into PEND if splitting in and non-peq
		if( newCard.columnName == config.PROJ_COLS[config.PROJ_PEND] || newCard.columnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
		    console.log( authData.who, "WARNING. " + newCard.columnName + " is reserved, can not create Draft Issues here.  Removing." );
		    ghV2.removeCard( authData, pd.projectId, cardId );
		}
		return;
	    }

	    const locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "pid": pd.projectId } );

	    // If no locs, this card belongs to project that is not part of a CodeEquity project (i.e. no current/past PEQ issues).  
	    if( locs == -1 ) {
		console.log( authData.who, "Card moves in projects not related to CodeEquity are ignored." );
		return;
	    }

	    // Note, config.MAIN_PROJ should not have PLAN
	    let rejectLoc = -1;
	    for( const aloc of locs ) {
		if( aloc.hostColumnName == config.PROJ_COLS[config.PROJ_PLAN] ) {
		    rejectLoc = { ...aloc };  // will modify rejectLoc below, so make it a shallow copy
		    break;
		}
	    }

	    // Locked?  postpone when a related resolve:split is still underway
	    // --------------
	    if( ingestUtils.isLocked( cardId ) ) { return "postpone"; }

	    // Move into.  Split results have no 'from' onto a 'to' location.  Changes reject logic slightly.
	    // --------------
	    if( newCard === -1 ) {

		// Check to see if this card was removed during split.
		let newLinks = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "hostUtility": cardId });
		if( newLinks.length == 1 ) {
		    
		    // newLink can come in with config.EMPTY col name, otherwise could avoid get card here
		    newCard = await ghV2.getCard( authData, newLinks[0].hostCardId );
		    
		    assert( newCard !== -1 );
		    console.log( ".. original card was removed by PNP.  Processing move for replacement card" );
		    newLinks[0].hostUtility = config.EMPTY;

		    // move within cols check does not make sense here.  API does not allow adding card to same col.
		    
		    // Do not allow move into ACCR if trying to split in.
		    if( newCard.columnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
			let msg = "WARNING. " + newLinks[0].hostColumnName + " is reserved, can not create cards here. Leaving card in " + config.PROJ_COLS[config.PROJ_PLAN];
			rejectCard( authData, ghLinks, pd, newCard, rejectLoc, msg, true );
		    }

		    // resolve doNotTrack sets link to empty.  but newCard has current loc
		    // Do not allow move into PEND if splitting in and non-peq
		    if( newCard.columnName == config.PROJ_COLS[config.PROJ_PEND] && newLinks[0].hostColumnName == config.EMPTY ) {
			let msg = "WARNING.  Can't split non-PEQ card into reserved column.  Move not processed. " + newCard.cardId;
			rejectCard( authData, ghLinks, pd, newCard, rejectLoc, msg, false );
		    }

		    // don't split allocs into x3
		    const fullIssue = await ghV2.getFullIssue( authData, newLinks[0].hostIssueId );
		    assert( Object.keys( fullIssue ).length > 0 );
		    
		    let [_, allocation] = ghUtils.theOnePEQ( fullIssue.labels );
		    if( allocation && config.PROJ_COLS.slice(config.PROJ_PROG).includes( newCard.columnName )) {
			let msg = "WARNING.  Allocations are only useful in planning, or flat columns.  Leaving card in " + config.PROJ_COLS[config.PROJ_PLAN];
			rejectCard( authData, ghLinks, pd, newCard, rejectLoc, msg, true );
		    }
		}
		else {
		    console.log( authData.who, "No such card, ignoring move request." );
		}
		return;
	    }

	    // Move from a loc to a loc.  Not result of a split resolve.
	    // --------------
	    let newColName   = newCard.columnName;
	    let newNameIndex = config.PROJ_COLS.indexOf( newColName );

	    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "cardId": cardId } );
	    if( links === -1 ) {
		if( delayCount <= config.MAX_GH_RETRIES ) {
		    // Both events are rare.  One does not require postpone (rejection), the other does.
		    // in the reject case, GH will finish deleting the card quickly, which causes ghV2:getCard to fail, which triggers 'no such card' above, eliminating further delay.
		    console.log( authData.who, "Card not found.  Either rejected in PNP during split, or move notification arrived before create notification.  Delay.", delayCount );
		    return "postpone"; 
		}
		else {
		    console.log( authData.who, "Card not found (probably rejected in PNP), ignoring move request.", delayCount );
		    return;
		}
	    }
	    assert( links.length == 1 );
	    let link = links[0]; // cards are 1:1 with issues
	    
	    if( link.hostColumnId == config.EMPTY ) {
		if( newNameIndex > config.PROJ_PROG ) {
		    // No origination data.  use default
		    // Don't wait
		    let msg = "WARNING.  Can't move non-PEQ card into reserved column.  Move not processed. " + cardId;
		    rejectCard( authData, ghLinks, pd, { issueId: link.hostIssueId, cardId: cardId }, rejectLoc, msg, false );
		}
		else { console.log( authData.who, "Non-PEQ cards are not tracked.  Ignoring.", cardId ); }
		return;
	    }
	    let oldColId  = link.hostColumnId;

	    if( newCard.columnId == oldColId ) {
		// console.log( authData.who, "Moves within columns are not tracked", link, newCard, pd.reqBody.changes );
		console.log( authData.who, "Moves within columns are not tracked", cardId, oldColId );
		return;
	    }
	    console.log( authData.who, "attempting to move card to", newColName, newCard.columnId, "from", oldColId );

	    // reform rejectLoc to old location, iff old loc is not No Status.
	    if( oldColId != -1 ) {
		rejectLoc.hostColumnId   = oldColId;
		rejectLoc.hostColumnName = link.hostColumnName;
	    }
		
	    // Do not allow move out of ACCR
	    if( link.hostColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
		let msg = "WARNING.  Can't move Accrued issue.  Move not processed. " + cardId;
		rejectCard( authData, ghLinks, pd, { issueId: link.hostIssueId, cardId: cardId }, rejectLoc, msg, true );
		return;
	    }

	    // allocations have issues
	    let issueId = link.hostIssueId;
	    assert( issueId != -1 );

	    const fullIssue = await ghV2.getFullIssue( authData, issueId );
	    assert( Object.keys( fullIssue ).length > 0 );	    
	    let [_, allocation] = ghUtils.theOnePEQ( fullIssue.labels );
	    if( allocation && config.PROJ_COLS.slice(config.PROJ_PROG).includes( newColName )) {
		let msg = "WARNING.  Allocations are only useful in config:PROJ_PLAN, or flat columns.  Moving card back.";
		rejectCard( authData, ghLinks, pd, { issueId: link.hostIssueId, cardId: cardId }, rejectLoc, msg, true );
		return;
	    }
	    
	    let oldNameIndex = config.PROJ_COLS.indexOf( link.hostColumnName );
	    assert( cardId == link.hostCardId );
	    assert( newCard.pid == link.hostProjectId );               // not yet supporting moves between projects

	    let success = await ghV2.checkReserveSafe( authData, link.hostIssueId, newNameIndex );
	    if( !success ) {
		let msg = "WARNING.  Need assignees before moving card to config.PROJ_PEND or config.PROJ_ACCR columns.  Moving card back.";
		rejectCard( authData, ghLinks, pd, { issueId: link.hostIssueId, cardId: cardId }, rejectLoc, msg, true );
		return;
	    }
	    ghLinks.updateLinkage( authData, pd.ceProjectId, issueId, cardId, newCard.columnId, newColName );
	    // ghLinks.show();
	    
	    // handle issue.  Don't update issue state if not clear reopen/closed
	    let newIssueState = "";
	    if(      oldNameIndex <= config.PROJ_PROG && newNameIndex >= config.PROJ_PEND ) {  newIssueState = config.GH_ISSUE_CLOSED; }
	    else if( oldNameIndex >= config.PROJ_PEND && newNameIndex <= config.PROJ_PROG ) {  newIssueState = config.GH_ISSUE_OPEN;   }
	    
	    if( newIssueState != "" ) {
		// Don't wait 
		ghV2.updateIssue( authData, link.hostIssueId, "state", newIssueState );
	    }
	    // Don't wait
	    recordMove( authData, ghLinks, pd, oldNameIndex, newNameIndex, link );
	}
	break;
    case 'deleted' :
	// Source of notification: delete col just moves to noStatus.  delete card ( delete proj, xfer   ???)
	await deleteCard( authData, ghLinks, ceProjects, pd, pd.reqBody.projects_v2_item.node_id );
	break;
    case 'edited' :   // Do nothing.
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
