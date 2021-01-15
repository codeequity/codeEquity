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

// The implied action of an underlying move out of a column depends on the originating PEQType.
// PeqType:GRANT  Illegal       There are no 'takebacks' when it comes to provisional equity grants
//                              This type only exists for cards/issues in the 'Accrued' column... can not move out 
// PeqType:ALLOC  Notice only.  Master proj is not consistent with config.PROJ_COLS.
//                              !Master projects do not recognize <allocation>
// PeqType:PLAN  most common
// PeqType:LIMB  do nothing
async function recordMove( installClient, reqBody, fullName, oldCol, newCol, ghCard ) { 

    // XXX inform all contributors of this failure
    assert( oldCol != config.PROJ_ACCR );  // no take-backs

    // I want peqId for notice PActions, with or without issueId
    let peq = await( ghSafe.validatePEQ( installClient, fullName, ghCard['GHIssueId'], ghCard['GHCardTitle'], ghCard['GHProjectId'] ));
    
    assert( peq['PeqType'] != "grant" );

    let verb   = "";
    let action = "";
    if( peq['PeqType'] == "allocation" ||
	( oldCol <= config.PROJ_PROG && newCol <= config.PROJ_PROG ) ) {
	// moving between plan, and in-progress has no impact on peq summary
	verb = "confirm";
	action = "notice";
    }
    else if( oldCol <= config.PROJ_PROG && newCol == config.PROJ_PEND ) {
	// task complete, waiting for peq approval
	verb = "propose";
	action = "accrue";
    }
    else if( oldCol == config.PROJ_PEND && newCol <= config.PROJ_PROG) {
	// proposed peq has been rejected
	verb = "reject";
	action = "accrue";
    }
    else if( oldCol <= config.PROJ_PEND && newCol == config.PROJ_ACCR ) {
	// approved!   PEQ will be updated to "type:accrue" when processed in ceFlutter.
	verb = "confirm";
	action = "accrue";
    }
    else {
	console.log( installClient[1], "Verb, action combo not understood", oldCol, newCol, peq.PeqType );
	assert( false );
    }

    let subject = [ peq['PEQId'] ];
    await( utils.recordPEQAction(
	installClient,
	config.EMPTY,     // CE UID
	reqBody['sender']['login'],   // gh actor
	fullName,         // gh repo
	verb, 
	action, 
	subject,          // subject
	"",               // note
	utils.getToday(), // entryDate
	reqBody           // raw
    ));
}


// Card operations: no PEQ label, not related to CodeEquity.  No action.
// Card operations: with PEQ label:  Record.  If relevant, create related issue and label. 
// Can generate several notifications in one operation - so if creator is <bot>, ignore as pending.

async function handler( installClient, ghLinks, pd, action, tag ) {

    let sender  = pd.reqBody['sender']['login'];
    // if( !reqBody.hasOwnProperty( 'project_card') || !reqBody.project_card.hasOwnProperty( 'updated_at')) { console.log( reqBody ); }
    console.log( installClient[4], pd.reqBody.project_card.updated_at, "Card", action );

    pd.GHCreator    = pd.reqBody['project_card']['creator']['login'];
    pd.GHFullName   = pd.reqBody['repository']['full_name'];

    // await gh.checkRateLimit(installClient);

    if( action == "created" && pd.reqBody['project_card']['content_url'] != null ) {
	// In issues, add to project, triage to add to column.  May or may not be PEQ.  
	// console.log( "new card created from issue" );

	// e.g. content_url: 'https://api.github.com/repos/codeequity/codeEquity/issues/57' },
	let issueURL = pd.reqBody['project_card']['content_url'].split('/');
	assert( issueURL.length > 0 );
	pd.GHIssueNum = parseInt( issueURL[issueURL.length - 1] );
	// XXX low alignment risk here... exists in theory, hard to imagine any real damage in practice, dependent on ID only
	let issue = await gh.getIssue( installClient, pd.GHOwner, pd.GHRepo, pd.GHIssueNum );   // [ id, [content] ]
	pd.GHIssueId = issue[0];
	// console.log( "Found issue:", pd.GHIssueNum.toString(), issue[1] );

	// Is underlying issue already linked to unclaimed?  if so, remove it.
	await ghSafe.cleanUnclaimed( installClient, ghLinks, pd );
	await utils.processNewPEQ( installClient, ghLinks, pd, issue[1], -1 ); 
    }
    else if( action == "created" ) {
	// In projects, creating a card that MAY have a human PEQ label in content...  PNP will create issue and label it, rebuild card, etc.
	// console.log( "New card created, unattached" );
	let cardContent = pd.reqBody['project_card']['note'].split('\n');

	await utils.processNewPEQ( installClient, ghLinks, pd, cardContent, -1 );
    }
    else if( action == "converted" ) {
	// Get here with: Convert to issue' on a newborn card, which also notifies with project_card converted.  handle here.
	// Can only be non-PEQ.  Otherwise, would see created/content_url
	console.log( "Non-PEQ card converted to issue.  No action." );
    }
    else if( action == "moved" ) {
	// Note: Unclaimed card - try to uncheck it directly from column bar gives: cardHander move within same column.  Check stays.
	//       Need to click on projects, then on pd.GHRepo, then can check/uncheck successfully.  Get cardHandler:card deleted
	// within gh project, move card from 1 col to another.
	// Note: significant overlap with issueHandler:open/close.  But more cases to handle here to preserve reserved cols
	console.log( installClient[1], "Card", action, "Sender:", sender )

	if( pd.reqBody['changes'] == null ) {
	    console.log( installClient[1], "Move within columns are ignored.", pd.reqBody['project_card']['id'] );
	    return;
	}

	let cardId    = pd.reqBody['project_card']['id'];
	let oldColId  = pd.reqBody['changes']['column_id']['from'];
	let newColId  = pd.reqBody['project_card']['column_id'];
	let newProjId = pd.reqBody['project_card']['project_url'].split('/').pop();

	let newColName = await gh.getColumnName( installClient, newColId );
	let newNameIndex = config.PROJ_COLS.indexOf( newColName );
	
	// Ignore newborn cards.
	let links = ghLinks.getLinks( installClient, { "repo": pd.GHFullName, "cardId": cardId } );
	if( links == -1 || links[0].GHColumnId == -1 ) {
	    console.log( "Moved card is untracked (carded or newborn).  Move not processed.", cardId );
	    // Trying to move untracked card into reserved column?  Move back.
	    if( newNameIndex > config.PROJ_PROG ) {
		await gh.moveCard( installClient, cardId, oldColId );
	    }
	    return;
	}
	let link = links[0]; // cards are 1:1 with issues
	
	// allocations have issues
	let issueId = link['GHIssueId'];
	assert( issueId != -1 );
	
	let oldNameIndex = config.PROJ_COLS.indexOf( link['GHColumnName'] );
	assert( oldNameIndex != config.PROJ_ACCR );                   // can't move out of accrue.
	assert( cardId       == link['GHCardId'] );

	// In speed mode, GH doesn't keep up - the changes_from column is a step behind.
	// assert( oldColId     == link['GHColumnId'] );

	assert( newProjId     == link['GHProjectId'] );               // not yet supporting moves between projects

	let success = await gh.checkReserveSafe( installClient, pd.GHOwner, pd.GHRepo, link['GHIssueNum'], newNameIndex );
	if( !success ) {
	    gh.moveCard( installClient, cardId, oldColId );
	    return;
	}
	ghLinks.updateLinkage( installClient, issueId, cardId, newColId, newColName );
	ghLinks.show();
	
	// handle issue.  Don't update issue state if not clear reopen/closed
	let newIssueState = "";
	if(      oldNameIndex <= config.PROJ_PROG && newNameIndex >= config.PROJ_PEND ) {  newIssueState = "closed"; }
	else if( oldNameIndex >= config.PROJ_PEND && newNameIndex <= config.PROJ_PROG ) {  newIssueState = "open";   }
	
	if( newIssueState != "" ) {
	    await ghSafe.updateIssue( installClient, pd.GHOwner, pd.GHRepo, link['GHIssueNum'], newIssueState );
	}

	// recordPAct
	recordMove( installClient, pd.reqBody, pd.GHFullName, oldNameIndex, newNameIndex, link );
    }
    else if( action == "deleted" || action == "edited" ) {
	// Note, if action source is issue-delete, linked card is deleted first.  Watch recording.
	// Note: Unclaimed card - try to uncheck it directly from column bar gives: cardHander move within same column.  Check stays.
	//       Need to click on projects, then on pd.GHRepo, then can check/uncheck successfully.  Get cardHandler:card deleted
	console.log( "Card", action, "Recorded." )
	await( utils.recordPEQTodo( "XXX TBD. Content may be from issue, or card." , -1 ));	
    }

    return;
}

exports.handler = handler;
