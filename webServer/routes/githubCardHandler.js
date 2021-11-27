var utils   = require('../utils');
var config  = require('../config');
var assert = require('assert');

var ghUtils = require('../ghUtils');
var gh      = ghUtils.githubUtils;
var ghSafe  = ghUtils.githubSafe;

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
async function recordMove( authData, reqBody, fullName, oldCol, newCol, link, peq ) { 

    assert( oldCol != config.PROJ_ACCR );  // no take-backs

    // I want peqId for notice PActions, with or without issueId
    if( typeof peq == 'undefined' ) {
	peq = await ghSafe.validatePEQ( authData, fullName, link.GHIssueId, link.GHIssueTitle, link.GHProjectId );
    }
    
    assert( peq['PeqType'] != config.PEQTYPE_GRANT );

    let verb   = "";
    let action = "";
    // Note, eggs and bacon fall into this group
    if( peq['PeqType'] == config.PEQTYPE_ALLOC ||
	( oldCol <= config.PROJ_PROG && newCol <= config.PROJ_PROG ) ) {
	// moving between plan, and in-progress has no impact on peq summary
	verb = config.PACTVERB_CONF;
	action = config.PACTACT_NOTE;
    }
    else if( oldCol <= config.PROJ_PROG && newCol == config.PROJ_PEND ) {
	// task complete, waiting for peq approval
	verb = config.PACTVERB_PROP;
	action = config.PACTACT_ACCR;
    }
    else if( oldCol == config.PROJ_PEND && newCol <= config.PROJ_PROG) {
	// proposed peq has been rejected
	verb = config.PACTVERB_REJ;
	action = config.PACTACT_ACCR;
    }
    else if( oldCol <= config.PROJ_PEND && newCol == config.PROJ_ACCR ) {
	// approved!   PEQ will be updated to "type:accrue" when processed in ceFlutter.
	verb = config.PACTVERB_CONF;
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
	let locs = ghLinks.getLocs( authData, { "repo": fullName, "colName": config.PROJ_COLS[newCol] } );
	assert( locs != -1 );
	subject = [ peq.PEQId, locs[0].GHColumnName ];
    }
    
    // Don't wait
    utils.recordPEQAction( authData, config.EMPTY, reqBody['sender']['login'], fullName, 
			   verb, action, subject, "", 
			   utils.getToday(), reqBody );
}


// Card operations: no PEQ label, not related to CodeEquity.  No action.
// Card operations: with PEQ label:  Record.  If relevant, create related issue and label. 
// Can generate several notifications in one operation - so if creator is <bot>, ignore as pending.

async function handler( authData, ghLinks, pd, action, tag ) {

    let sender  = pd.reqBody['sender']['login'];
    // if( !reqBody.hasOwnProperty( 'project_card') || !reqBody.project_card.hasOwnProperty( 'updated_at')) { console.log( reqBody ); }
    // console.log( authData.job, pd.reqBody.project_card.updated_at, "Card", action );
    console.log( authData.who, "start", authData.job );

    pd.GHCreator    = pd.reqBody['project_card']['creator']['login'];
    pd.GHFullName   = pd.reqBody['repository']['full_name'];

    switch( action ) {
    case 'created' :
	if( pd.reqBody['project_card']['content_url'] != null ) {
	    // In issues, add to project, triage to add to column.  May or may not be PEQ.  
	    // content_url: 'https://api.github.com/repos/codeequity/codeEquity/issues/57' },
	    let issueURL = pd.reqBody['project_card']['content_url'].split('/');
	    assert( issueURL.length > 0 );
	    pd.GHIssueNum = parseInt( issueURL[issueURL.length - 1] );
	    let issue = await gh.getIssue( authData, pd.GHOwner, pd.GHRepo, pd.GHIssueNum );   // [ id, [content] ]
	    pd.GHIssueId = issue[0];
	    
	    // Is underlying issue already linked to unclaimed?  if so, remove it.
	    // Wait here, else unclaimed link can force a resolve-split
	    await ghSafe.cleanUnclaimed( authData, ghLinks, pd );
	    // Don't wait.
	    utils.processNewPEQ( authData, ghLinks, pd, issue[1], -1, "relocate" ); 
	}
	else {
	    // In projects, creating a card that MAY have a human PEQ label in content...  PNP will create issue and label it, rebuild card, etc.
	    // console.log( "New card created, unattached" );
	    let cardContent = pd.reqBody['project_card']['note'].split('\n');
	    cardContent = cardContent.map( line => line.replace(/[\x00-\x1F\x7F-\x9F]/g, "") );
	    
	    utils.processNewPEQ( authData, ghLinks, pd, cardContent, -1 );
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
	    // Note: Unclaimed card - try to uncheck it directly from column bar gives: cardHander move within same column.  Check stays.
	    //       Need to click on projects, then on pd.GHRepo, then can check/uncheck successfully.  Get cardHandler:card deleted
	    // within gh project, move card from 1 col to another.
	    // Note: significant overlap with issueHandler:open/close.  But more cases to handle here to preserve reserved cols
	    console.log( authData.who, "Card", action, "Sender:", sender )
	    
	    if( pd.reqBody['changes'] == null ) {
		console.log( authData.who, "Move within columns are ignored.", pd.reqBody['project_card']['id'] );
		return;
	    }
	    
	    let cardId    = pd.reqBody['project_card']['id'];
	    let oldColId  = pd.reqBody['changes']['column_id']['from'];
	    let newColId  = pd.reqBody['project_card']['column_id'];
	    let newProjId = pd.reqBody['project_card']['project_url'].split('/').pop();
	    
	    let newColName = gh.getColumnName( authData, ghLinks, pd.GHFullName, newColId );
	    let newNameIndex = config.PROJ_COLS.indexOf( newColName );

	    // Ignore newborn cards.
	    let links = ghLinks.getLinks( authData, { "repo": pd.GHFullName, "cardId": cardId } );
	    if( links == -1 || links[0].GHColumnId == -1 ) {
		console.log( "WARNING.  Can't move non-PEQ card into reserved column.  Move not processed.", cardId );
		if( newNameIndex > config.PROJ_PROG ) {
		    // Don't wait
		    gh.moveCard( authData, cardId, oldColId );
		}
		return;
	    }
	    let link = links[0]; // cards are 1:1 with issues

	    // Do not allow move out of ACCR
	    if( link.GHColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
		console.log( "WARNING.  Can't move Accrued issue.  Move not processed.", cardId );
		gh.moveCard( authData, cardId, oldColId );
		return;
	    }

	    // allocations have issues
	    let issueId = link.GHIssueId;
	    assert( issueId != -1 );

	    const fullIssue = await gh.getFullIssue( authData, pd.GHOwner, pd.GHRepo, link.GHIssueNum );   
	    let [_, allocation] = ghSafe.theOnePEQ( fullIssue.labels );
	    if( allocation && config.PROJ_COLS.slice(config.PROJ_PROG).includes( newColName )) {
		console.log( authData.who, "WARNING.", "Allocations are only useful in config:PROJ_PLAN, or flat columns.  Moving card back." );
		gh.moveCard( authData, cardId, oldColId );
		return;
	    }
	    
	    let oldNameIndex = config.PROJ_COLS.indexOf( link.GHColumnName );
	    assert( cardId == link.GHCardId );
	    
	    // In speed mode, GH doesn't keep up - the changes_from column is a step behind.
	    // assert( oldColId     == link['GHColumnId'] );
	    
	    assert( newProjId     == link['GHProjectId'] );               // not yet supporting moves between projects
	    
	    let success = await gh.checkReserveSafe( authData, pd.GHOwner, pd.GHRepo, link['GHIssueNum'], newNameIndex );
	    if( !success ) {
		gh.moveCard( authData, cardId, oldColId );
		return;
	    }
	    ghLinks.updateLinkage( authData, issueId, cardId, newColId, newColName );
	    ghLinks.show();
	    
	    // handle issue.  Don't update issue state if not clear reopen/closed
	    let newIssueState = "";
	    if(      oldNameIndex <= config.PROJ_PROG && newNameIndex >= config.PROJ_PEND ) {  newIssueState = "closed"; }
	    else if( oldNameIndex >= config.PROJ_PEND && newNameIndex <= config.PROJ_PROG ) {  newIssueState = "open";   }
	    
	    if( newIssueState != "" ) {
		// Don't wait
		ghSafe.updateIssue( authData, pd.GHOwner, pd.GHRepo, link['GHIssueNum'], newIssueState );
	    }
	    // Don't wait
	    recordMove( authData, pd.reqBody, pd.GHFullName, oldNameIndex, newNameIndex, link );
	}
	break;
    case 'deleted' :
	// Source of notification: delete card, delete (carded) issue, delete col, delete proj, xfer
	// From here, can't tell which source, or which order of arrival, just know GH has already deleted the card, and maybe the issue.
	// No matter the source, delete card must manage linkage, peq, pact, etc.
	{
	    // Not carded?  no-op.  or maybe delete issue arrived first.
	    let links = ghLinks.getLinks( authData, { "repo": pd.GHFullName, "cardId": pd.reqBody.project_card.id } );
	    if( links == -1 ) { return; }

	    let link    = links[0];
	    const accr  = link.GHColumnName == config.PROJ_COLS[config.PROJ_ACCR];
	    let comment = "CodeEquity removed the PEQ label from this issue when the attached project_card was deleted.";
	    comment    += " PEQ issues require a 1:1 mapping between issues and cards.";

	    // Carded, untracked?   Just remove linkage, since GH removed card.
	    if( link.GHColumnId == -1 ) {
		ghLinks.removeLinkage({"authData": authData, "issueId": link.GHIssueId });
		return;
	    }

	    // PEQ.  Card is gone in GH, issue may be gone depending on source.  Need to manage linkage, location, peq label, peq/pact.
	    // Wait later
	    let peq = utils.getPeq( authData, link.GHIssueId );

	    // Is the source a delete issue or transfer? 
	    let issueExists = await gh.checkIssue( authData, pd.GHOwner, pd.GHRepo, link.GHIssueNum );  

	    // Regular peq?  or ACCR already in unclaimed?  remove it no matter what.
	    if( !accr || link.GHProjectName == config.UNCLAIMED ) {
		console.log( authData.who, "Removing peq", accr, issueExists );
		if( issueExists ) {
		    let success = await ghSafe.removePeqLabel( authData, pd.GHOwner, pd.GHRepo, link.GHIssueNum );
		    // Don't wait
		    if( success ) { ghSafe.addComment( authData, pd.GHOwner, pd.GHRepo, link.GHIssueNum, comment ); }
		}
		ghLinks.removeLinkage({"authData": authData, "issueId": link.GHIssueId });

		// no need to wait.
		// Notice for accr since we are NOT deleting an accrued peq, just removing GH records.
		peq = await peq;
		utils.removePEQ( authData, peq.PEQId );
		let action = accr ? config.PACTACT_NOTE  : config.PACTACT_DEL;
		let note   = accr ? "Disconnected issue" : "";
		utils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.GHFullName,
				       config.PACTVERB_CONF, action, [peq.PEQId], note,
				       utils.getToday(), pd.reqBody );
	    }
	    // ACCR, not in unclaimed.  
	    else if( issueExists ) {
		console.log( authData.who, "Moving ACCR", accr, issueExists, link.GHIssueId );
		// XXX BUG.  When attempting to transfer an accrued issue, GH issue delete is slow, can be in process when get here.
		//           card creation can fail, and results can be uncertain at this point.  
		let card = await gh.createUnClaimedCard( authData, ghLinks, pd, parseInt( link.GHIssueId ), accr );  
		link.GHCardId      = card.id.toString();
		link.GHProjectId   = card.project_url.split('/').pop();
		link.GHProjectName = config.UNCLAIMED;
		link.GHColumnId    = card.column_url.split('/').pop();
		link.GHColumnName  = config.PROJ_COLS[config.PROJ_ACCR];

		const psub = [ link.GHProjectName, link.GHColumnName ];

		// No need to wait
		peq = await peq;
		utils.updatePEQPSub( authData, peq.PEQId, psub );
		utils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.GHFullName,
				       config.PACTVERB_CONF, config.PACTACT_RELO, [peq.PEQId, link.GHProjectId, link.GHColumnId], "",
				       utils.getToday(), pd.reqBody );
		
	    }
	    // ACCR, not unclaimed, but issue deleted.  Delete issue must handle this since we don't have label, allocation.
	    else {
		console.log( authData.who, "Issue handler will recreate ACCR in unclaimed", accr, issueExists );
	    }
	}
	break;
    case 'edited' :
	// Only newborn can be edited.   Track issue-free creation above.
	{
	    let cardContent = pd.reqBody['project_card']['note'].split('\n');
	    cardContent = cardContent.map( line => line.replace(/[\x00-\x1F\x7F-\x9F]/g, "") );

	    // Don't wait
	    utils.processNewPEQ( authData, ghLinks, pd, cardContent, -1 );
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
