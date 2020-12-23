var utils   = require('../utils');
var config  = require('../config');
var ghUtils = require('../ghUtils');
var assert = require('assert');
const peqData = require( '../peqData' );
var issueHandler = require('./githubIssueHandler.js' );

var gh     = ghUtils.githubUtils;
var ghSafe = ghUtils.githubSafe;
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


// XXX Move this up?
async function getNextJob( installClient, owner, repo, sender, committedJob ) {
    let jobData = await utils.getFromQueue( installClient, owner, repo, sender );
    if( jobData != -1 ) {
	// Need a new installClient, else source for non-awaited actions is overwritten
	let ic = [installClient[0], "", installClient[2], installClient[3], jobData.QueueId];
	ic[1] = "<"+jobData.Handler+": "+jobData.Action+" "+jobData.Tag+"> ";
	console.log( "\n\n\n installClient[1], Got next job:", ic[1] );
	if( jobData.Handler == "card" ) {
	    handler( ic, jobData.Action, jobData.GHRepo, jobData.GHOwner, jobData.ReqBody, "", jobData.Tag, true, committedJob );
	}
	else {
	    issueHandler.handler( ic, jobData.Action, jobData.GHRepo, jobData.GHOwner, jobData.ReqBody, "", jobData.Tag, true, committedJob );
	}
    }
    else {
	console.log( installClient[1], "jobs done" );
    }
    return;
}


// Card operations: no PEQ label, not related to CodeEquity.  No action.
// Card operations: with PEQ label:  Record.  If relevant, create related issue and label. 
// Can generate several notifications in one operation - so if creator is <bot>, ignore as pending.

async function handler( installClient, action, repo, owner, reqBody, res, tag, internal, committedJob ) {

    let sender  = reqBody['sender']['login'];
    // if( !reqBody.hasOwnProperty( 'project_card') || !reqBody.project_card.hasOwnProperty( 'updated_at')) { console.log( reqBody ); }
    console.log( installClient[4], reqBody.project_card.updated_at, "Card", action, internal ? "internal" : "external" );

    // Continue with this job if it's the earliest on the queue.  Otherwise, add to queue and wait for internal activiation from getNext
    if( !internal ) {
	let tstart = Date.now();
	let jobData = await utils.checkQueue( installClient, "card", owner, repo, sender, action, reqBody, tag );
	assert( jobData != -1 );
	if( installClient[4] != jobData.QueueId ) {
	    console.log( installClient[1], "Sender busy with job#", jobData.QueueId, Date.now() - tstart, "millis" );
	    return;
	}
	console.log( installClient[1], "check Q done", Date.now() - tstart, "millis" );
    }
    // It is possible for external:checkQ and the internal:getNext interleave perfectly with AWs so 2 are running at same time.
    // Check for that, bail on the late comer.
    // NOTE: it may be remotely possible to interleave around this instruction.. XXX bug
    console.log( "\n\n\nCommitted, job", committedJob.id, installClient[4] );
    if( committedJob.id == installClient[4] ) {
	console.log( "I'm a latecomer - bailing" );
	return;
    }
    else {
	committedJob.id = installClient[4];
    }
    
    
    let pd = new peqData.PeqData();
    pd.GHOwner      = owner;
    pd.GHRepo       = repo;
    pd.reqBody      = reqBody;
    pd.GHCreator    = reqBody['project_card']['creator']['login'];
    pd.GHFullName   = reqBody['repository']['full_name'];

    // await gh.checkRateLimit(installClient);

    if( action == "created" && pd.reqBody['project_card']['content_url'] != null ) {
	// In issues, add to project, triage to add to column.  May or may not be PEQ.  
	// console.log( "new card created from issue" );

	// e.g. content_url: 'https://api.github.com/repos/codeequity/codeEquity/issues/57' },
	let issueURL = pd.reqBody['project_card']['content_url'].split('/');
	assert( issueURL.length > 0 );
	pd.GHIssueNum = parseInt( issueURL[issueURL.length - 1] );
	let issue = await gh.getIssue( installClient, pd.GHOwner, pd.GHRepo, pd.GHIssueNum );   // [ id, [content] ]
	pd.GHIssueId = issue[0];
	// console.log( "Found issue:", pd.GHIssueNum.toString(), issue[1] );

	// Is underlying issue already linked to unclaimed?  if so, remove it.
	await gh.cleanUnclaimed( installClient, pd );
	await utils.processNewPEQ( installClient, pd, issue[1], -1 ); 
    }
    else if( action == "created" ) {
	// In projects, creating a card that MAY have a human PEQ label in content.
	// console.log( "New card created, unattached" );
	let cardContent = pd.reqBody['project_card']['note'].split('\n');

	await utils.processNewPEQ( installClient, pd, cardContent, -1 );
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
	    getNextJob( installClient, owner, repo, sender, committedJob );
	    return;
	}

	let cardId    = pd.reqBody['project_card']['id'];
	//let oldColId  = pd.reqBody['changes']['column_id']['from'];
	let newColId  = pd.reqBody['project_card']['column_id'];
	let newProjId = pd.reqBody['project_card']['project_url'].split('/').pop();
	
	// First, verify current status
	// XXX This chunk could be optimized out, down the road
	let card = await( utils.getFromCardId( installClient, pd.GHFullName, cardId ));  
	if( card == -1 ) {
	    console.log( "Moved card not processed, could not find the card id", cardId );
	    getNextJob( installClient, owner, repo, sender, committedJob );
	    return;
	}
	
	let issueId = card['GHIssueId'];
	let oldNameIndex = config.PROJ_COLS.indexOf( card['GHColumnName'] );
	assert( oldNameIndex != config.PROJ_ACCR );                   // can't move out of accrue.
	assert( cardId       == card['GHCardId'] );

	// In speed mode, GH doesn't keep up - the changes_from column is a step behind.
	// assert( oldColId     == card['GHColumnId'] );

	// XXX This was pre-flat projects.  chunk below is probably bad
	// assert( issueId == -1 || oldNameIndex != -1 );                // likely allocation, or known project layout
	assert( newProjId     == card['GHProjectId'] );               // not yet supporting moves between projects

	// reflect card move in dynamo, if move is legal
	let newColName = await gh.getColumnName( installClient, newColId );
	let newNameIndex = config.PROJ_COLS.indexOf( newColName );
	assert( issueId == -1 || newNameIndex != -1 );
	if( newNameIndex > config.PROJ_PROG ) { 
	    let assignees = await gh.getAssignees( installClient, pd.GHOwner, pd.GHRepo, card['GHIssueNum'] );
	    if( assignees.length == 0  ) {
		console.log( "Update card failed - no assignees" );   // can't propose grant without a grantee
		console.log( "XXX move card back by hand with ceServer off" );
		getNextJob( installClient, owner, repo, sender, committedJob );
		return;
	    }
	}
	let success = await( utils.updateLinkage( installClient, issueId, cardId, newColId, newColName )) 
	    .catch( e => { console.log( installClient[1], "update card failed.", e ); });
	
	// handle issue
	let newIssueState = "";
	if(      oldNameIndex <= config.PROJ_PROG && newNameIndex >= config.PROJ_PEND ) {  newIssueState = "closed"; }
	else if( oldNameIndex >= config.PROJ_PEND && newNameIndex <= config.PROJ_PROG ) {  newIssueState = "open";   }
	
	if( issueId > -1 && newIssueState != "" ) {
	    success = success && await gh.updateIssue( installClient, pd.GHOwner, pd.GHRepo, card['GHIssueNum'], newIssueState );
	}

	// recordPeq
	recordMove( installClient, pd.reqBody, pd.GHFullName, oldNameIndex, newNameIndex, card );
    }
    else if( action == "deleted" || action == "edited" ) {
	// Note, if action source is issue-delete, linked card is deleted first.  Watch recording.
	// Note: Unclaimed card - try to uncheck it directly from column bar gives: cardHander move within same column.  Check stays.
	//       Need to click on projects, then on pd.GHRepo, then can check/uncheck successfully.  Get cardHandler:card deleted
	console.log( "Card", action, "Recorded." )
	await( utils.recordPEQTodo( "XXX TBD. Content may be from issue, or card." , -1 ));	
    }

    getNextJob( installClient, owner, repo, sender, committedJob );
    return;
}

exports.handler = handler;
