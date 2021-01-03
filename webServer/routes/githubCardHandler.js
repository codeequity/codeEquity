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

// XXX Looking slow - lots of waiting on GH.. not much work.  Hard to cache given access model


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
    console.log( peq );
    
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
	// approved!   PEQ will be updated to "type:accrue" when processed.
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
	// In projects, creating a card that MAY have a human PEQ label in content.
	// console.log( "New card created, unattached" );
	let cardContent = pd.reqBody['project_card']['note'].split('\n');

	await utils.processNewPEQ( installClient, ghLinks, pd, cardContent, -1 );
    }
    else if( action == "converted" ) {
	// Can only be non-PEQ.  Otherwise, would see created/content_url
	console.log( "Non-PEQ card converted to issue.  No action." );
    }
    else if( action == "moved" ) {
	// Note: Unclaimed card - try to uncheck it directly from column bar gives: cardHander move within same column.  Check stays.
	//       Need to click on projects, then on pd.GHRepo, then can check/uncheck successfully.  Get cardHandler:card deleted
	// within gh project, move card from 1 col to another.  
	console.log( installClient[1], "Card", action, "Sender:", sender )

	if( pd.reqBody['changes'] == null ) {
	    console.log( installClient[1], "Move within columns are ignored." );
	    return;
	}

	let cardId    = pd.reqBody['project_card']['id'];
	//let oldColId  = pd.reqBody['changes']['column_id']['from'];
	let newColId  = pd.reqBody['project_card']['column_id'];
	let newProjId = pd.reqBody['project_card']['project_url'].split('/').pop();
	
	// First, verify current status
	// XXX This chunk could be optimized out, down the road
	// YYY let link = await( utils.getFromCardId( installClient, pd.GHFullName, cardId ));  
	let links = ghLinks.getLinks( installClient, { "repo": pd.GHFullName, "cardId": cardId } );
	if( links == -1 ) {
	    console.log( "Moved card not processed, could not find the card id", cardId );
	    return;
	}
	let link = links[0]; // cards are 1:1 with issues
	
	let issueId = link['GHIssueId'];
	let oldNameIndex = config.PROJ_COLS.indexOf( link['GHColumnName'] );
	assert( oldNameIndex != config.PROJ_ACCR );                   // can't move out of accrue.
	assert( cardId       == link['GHCardId'] );

	// In speed mode, GH doesn't keep up - the changes_from column is a step behind.
	// assert( oldColId     == link['GHColumnId'] );

	// XXX This was pre-flat projects.  chunk below is probably bad
	// assert( issueId == -1 || oldNameIndex != -1 );                // likely allocation, or known project layout
	assert( newProjId     == link['GHProjectId'] );               // not yet supporting moves between projects

	// reflect card move in dynamo, if move is legal
	let newColName = await gh.getColumnName( installClient, newColId );
	let newNameIndex = config.PROJ_COLS.indexOf( newColName );
	assert( issueId == -1 || newNameIndex != -1 );
	if( newNameIndex > config.PROJ_PROG ) { 
	    let assignees = await gh.getAssignees( installClient, pd.GHOwner, pd.GHRepo, link['GHIssueNum'] );
	    if( assignees.length == 0  ) {
		console.log( "Update card failed - no assignees" );   // can't propose grant without a grantee
		console.log( "XXX move card back by hand with ceServer off" );
		return;
	    }
	}
	// YYY let success = await( utils.updateLinkage( installClient, issueId, cardId, newColId, newColName )) 
        // .catch( e => { console.log( installClient[1], "update card failed.", e ); });
	let success = ghLinks.updateLinkage( installClient, issueId, cardId, newColId, newColName );
	ghLinks.show();
	
	// handle issue
	let newIssueState = "";
	if(      oldNameIndex <= config.PROJ_PROG && newNameIndex >= config.PROJ_PEND ) {  newIssueState = "closed"; }
	else if( oldNameIndex >= config.PROJ_PEND && newNameIndex <= config.PROJ_PROG ) {  newIssueState = "open";   }
	
	if( issueId > -1 && newIssueState != "" ) {
	    success = success && await ghSafe.updateIssue( installClient, pd.GHOwner, pd.GHRepo, link['GHIssueNum'], newIssueState );
	}

	// recordPeq
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
