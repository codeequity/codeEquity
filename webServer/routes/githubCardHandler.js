var testAuth = require('../testAuth');
var utils   = require('../utils');
var config  = require('../config');
var ghUtils = require('../ghUtils');
var assert = require('assert');
const auth = require( "../auth");

var gh = ghUtils.githubUtils;

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
    let peq = await( gh.validatePEQ( installClient, fullName, ghCard['GHIssueId'], ghCard['GHCardTitle'], ghCard['GHProjectId'] ));

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
	console.log( installClient[1], "Verb, action combo not understood", verb, action );
	assert( false );
    }

    let subject = [ peq['PEQId'] ];
    await( utils.recordPEQAction(
	installClient[1],
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

async function handler( action, repo, owner, reqBody, res ) {

    // Actions: created, deleted, moved, edited, converted
    
    let creator = reqBody['project_card']['creator']['login'];
    let sender  = reqBody['sender']['login'];
    console.log( "Got Card.  Creator:", creator, "Sender:", sender );
    // console.log( "note", reqBody['project_card']['note'] );
    
    if( sender == config.CE_BOT) {
	console.log( "Bot card, skipping." );
	return;
    }

    // installClient is pair [installationAccessToken, creationSource]
    let token = await auth.getInstallationClient( owner, repo );
    let source = "<CAR:"+action+"> ";
    let installClient = [token, source];

    await gh.checkRateLimit(installClient);

    if( action == "created" && reqBody['project_card']['content_url'] != null ) {
	// In issues, add to project, triage to add to column.  May or may not be PEQ.
	console.log( "new card created from issue" );

	// e.g. content_url: 'https://api.github.com/repos/codeequity/codeEquity/issues/57' },
	let issueURL = reqBody['project_card']['content_url'].split('/');
	assert( issueURL.length > 0 );
	let issueNum = parseInt( issueURL[issueURL.length - 1] );
	let issue = await gh.getIssue( installClient, owner, repo, issueNum );   // [ id, [content] ]

	console.log( "Found issue:", issueNum.toString(), issue[1] );
	await utils.processNewPEQ( installClient, repo, owner, reqBody, issue[1], creator, issueNum, issue[0], -1 ); 
    }
    else if( action == "created" ) {
	// In projects, creating a card that MAY have a human PEQ label in content.
	console.log( "New card created, unattached" );
	let cardContent = reqBody['project_card']['note'].split('\n');

	// XXX This may be overly restrictive..?
	if( await gh.checkIssueExists( installClient, owner, repo, cardContent[0] ) ) {
	    console.log( "Issue with same title already exists.  Do nothing." );
	    return;
	}

	await utils.processNewPEQ( installClient, repo, owner, reqBody, cardContent, creator, -1, -1, -1 );
    }
    else if( action == "converted" ) {
	// Can only be non-PEQ.  Otherwise, would see created/content_url
	console.log( "Non-PEQ card converted to issue.  No action." );
    }
    else if( action == "moved" ) {
	// Note: Unclaimed card - try to uncheck it directly from column bar gives: cardHander move within same column.  Check stays.
	//       Need to click on projects, then on repo, then can check/uncheck successfully.  Get cardHandler:card deleted
	// within gh project, move card from 1 col to another.  
	console.log( installClient[1], "Card", action, "Sender:", sender )

	if( reqBody['changes'] == null ) {
	    console.log( installClient[1], "Move within columns are ignored." );
	    return;
	}

	let cardId    = reqBody['project_card']['id'];
	let oldColId  = reqBody['changes']['column_id']['from'];
	let newColId  = reqBody['project_card']['column_id'];
	let newProjId = reqBody['project_card']['project_url'].split('/').pop();
	let fullName  = reqBody['repository']['full_name'];
	
	// First, verify current status
	// XXX This chunk could be optimized out, down the road
	let card = await( utils.getFromCardId( installClient[1], fullName, cardId ));  
	if( card == -1 ) {
	    console.log( "Moved card not processed, could not find the card id", cardId );
	    return;
	}
	// XXX could have limbo card/issue, in which case do not perform actions below
	
	let issueId = card['GHIssueId'];
	let oldNameIndex = config.PROJ_COLS.indexOf( card['GHColumnName'] );
	assert( oldNameIndex != config.PROJ_ACCR );                   // can't move out of accrue.
	assert( cardId       == card['GHCardId'] );
	assert( oldColId     == card['GHColumnId'] );
	assert( issueId == -1 || oldNameIndex != -1 );                // likely allocation, or known project layout
	assert( newProjId     == card['GHProjectId'] );               // not yet supporting moves between projects

	// reflect card move in dynamo, if move is legal
	let newColName = await gh.getColumnName( installClient, newColId );
	let newNameIndex = config.PROJ_COLS.indexOf( newColName );
	assert( issueId == -1 || newNameIndex != -1 );
	if( newNameIndex > config.PROJ_PROG ) { 
	    let assignees = await gh.getAssignees( installClient, owner, repo, card['GHIssueNum'] );
	    if( assignees.length == 0  ) {
		console.log( "Update card failed - no assignees" );   // can't propose grant without a grantee
		console.log( "XXX move card back by hand with ceServer off" );
		return;
	    }
	}
	let success = await( utils.updateCardFromCardId( installClient[1], fullName, cardId, newColId, newColName )) 
	    .catch( e => { console.log( installClient[1], "update card failed.", e ); });
	
	// handle issue
	let newIssueState = "";
	if(      oldNameIndex <= config.PROJ_PROG && newNameIndex >= config.PROJ_PEND ) {  newIssueState = "closed"; }
	else if( oldNameIndex >= config.PROJ_PEND && newNameIndex <= config.PROJ_PROG ) {  newIssueState = "open";   }
	
	if( issueId > -1 && newIssueState != "" ) {
	    success = success && await gh.updateIssue( installClient, owner, repo, card['GHIssueNum'], newIssueState );
	}

	// recordPeq
	recordMove( installClient, reqBody, fullName, oldNameIndex, newNameIndex, card );
    }
    else if( action == "deleted" || action == "edited" ) {
	// Note, if action source is issue-delete, linked card is deleted first.  Watch recording.
	// Note: Unclaimed card - try to uncheck it directly from column bar gives: cardHander move within same column.  Check stays.
	//       Need to click on projects, then on repo, then can check/uncheck successfully.  Get cardHandler:card deleted
	console.log( "Card", action, "Recorded." )
	await( utils.recordPEQTodo( "XXX TBD. Content may be from issue, or card." , -1 ));	
    }

    return res.json({
	status: 200,
    });
}

exports.handler = handler;
