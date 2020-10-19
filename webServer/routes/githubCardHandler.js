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


async function processNewPEQ( installClient, repo, owner, reqBody, issueCardContent, creator, issueNum ) {

    // normal for card -> issue.  odd but legal for issue -> card
    let allocation = gh.getAllocated( issueCardContent );

    // XXX add label can occur before submit issue, after submit issue, or after add to card.  test all
    // If this new item is an issue becoming a card, any label will be human readable - different parse requirement
    let peqValue = 0;
    if( issueNum == -1 ) { peqValue = gh.parsePEQ( issueCardContent, allocation ); }
    else                 { peqValue = gh.parseLabelDescr( issueCardContent ); }   
    
    // should not be able to create a 'grant' or 'accrued' card.  check is below
    let peqType = allocation ? "allocation" : "plan";

    console.log( "processing", peqValue.toString(), peqType );
    
    if( peqValue > 0 ) {
	
	let peqHumanLabelName = peqValue.toString() + " PEQ";
	let peqLabel = await gh.findOrCreateLabel( installClient, owner, repo, peqHumanLabelName, peqValue );
	let colId    = reqBody['project_card']['column_id'];
	let fullName = reqBody['repository']['full_name'];
	let projId   = reqBody['project_card']['project_url'].split('/').pop(); 
	let colName  = await gh.getColumnName( installClient, colId );
	let projName = await gh.getProjectName( installClient, projId );
	let projSub  = await gh.getProjectSubs( installClient, fullName, projName, colId );
	let issueId  = -1;

	// XXX XXX XXX
	// If this is issue becoming card, issueId should be in the system already.
	if( issueNum > -1 ) {
	    // Add card issue linkage
	    console.log( "Adding card/issue to dynamo" );
	    // XXX get id from issueNum full name repo
	    // XXX fix this
	    await( utils.addIssueCard( fullName, issueId, issueNum, projId, projName, colId, colName, newCardId, issueCardContent[0] ));
	    
	}
	
	// No linked issues with allocations.
	assert( colName != 'Accrued' );
	if( peqType == "plan" && issueNum == -1 ) {
	    // create new issue
	    let issueData = await gh.createIssue( installClient, owner, repo, issueCardContent[0], [peqHumanLabelName] );
	    assert( issueData.length == 2 );
	    issueId  = issueData[0];
	    issueNum = issueData[1];
	    assert.notEqual( issueId, -1, "Unable to create issue linked to this card." );
	    
	    // create issue-linked project_card, requires id not num
	    let newCardId = await gh.createIssueCard( installClient, colId, issueId );
	    assert.notEqual( newCardId, -1, "Unable to create new issue-linked card." );	    
	    
	    // remove orig card
	    let origCardId = reqBody['project_card']['id'];
	    await( installClient.projects.deleteCard( { card_id: origCardId } ));	    
	    
	    // Add card issue linkage
	    console.log( "Adding card/issue to dynamo" );
	    await( utils.addIssueCard( fullName, issueId, issueNum, projId, projName, colId, colName, newCardId, issueCardContent[0] ));
	}

	// Note.. unassigned is normal for plan, abnormal for inProgress, not allowed for accrued.
	// there are no assignees for card-created issues.. they are added, or created directly from issues.
	let assignees = await gh.getAssignees( installClient, owner, repo, issueNum );
	
	console.log( "Record PEQ" );
	let newPEQId = await( utils.recordPEQ(
	    peqValue,                                  // amount
	    peqType,                                   // type of peq
	    assignees,                                 // list of ghUserLogins assigned
	    fullName,                                  // gh repo
	    projSub,                                   // gh project subs
	    projId,                                    // gh project id
	    issueId.toString(),                        // gh issue id
	    issueCardContent[0]                        // gh issue title
	));
	assert( newPEQId != -1 );
	
	console.log( "Record PEQ action" );
	let subject = [ newPEQId ];
	await( utils.recordPEQAction(
	    config.EMPTY,     // CE UID
	    creator,          // gh user name
	    fullName,         // gh repo
	    "confirm",        // verb
	    "add",            // action
	    subject,          // subject
	    "",               // note
	    utils.getToday(), // entryDate
	    reqBody           // raw
	));
    }
}

// Card operations: no PEQ label, not related to CodeEquity.  No action.
// Card operations: with PEQ label:  Record.  If relevant, create related issue and label. 
// Can generate several notifications in one operation - so if creator is <bot>, ignore as pending.

async function handler( action, repo, owner, reqBody, res ) {

    // Actions: created, deleted, moved, edited, converted

    let creator = reqBody['project_card']['creator']['login'];
    console.log( "Got Card.  Creator:", creator );
    console.log( "note", reqBody['project_card']['note'] );
    
    if( creator == config.CE_BOT ) {
	console.log( "Bot card, skipping." );
	return;
    }

    let installClient = await auth.getInstallationClient( owner, repo );

    if( action == "created" && reqBody['project_card']['content_url'] != null ) {

	// Coming from issueHandler - can't attach to summary object until we see it here, in project cards.
	console.log( "new card created from issue" );

	// e.g. content_url: 'https://api.github.com/repos/codeequity/codeEquity/issues/57' },
	let issueURL = reqBody['project_card']['content_url'].split('/');
	assert( issueURL.length > 0 );
	let issueNum = parseInt( issueURL[issueURL.length - 1] );
	let issueContent = await gh.getIssueContent( installClient, owner, repo, issueNum );

	console.log( "Found issue:", issueNum.toString(), issueContent );
	await processNewPEQ( installClient, repo, owner, reqBody, issueContent, creator, issueNum ); 
    }
    else if( action == "created" ) {
	console.log( "New card created in projects" );
	let cardContent = reqBody['project_card']['note'].split('\n');

	if( await gh.checkIssueExists( installClient, owner, repo, cardContent[0] ) ) {
	    console.log( "Issue with same title already exists.  Do nothing." );
	    return;
	}

	await processNewPEQ( installClient, repo, owner, reqBody, cardContent, creator, -1 );
    }
    else if( action == "converted" ) {
	console.log( "Non-PEQ card converted to issue.  No action." );
    }
    else if( action == "moved" || action == "deleted" || action == "edited" ) {
	// Note, if action source is issue-delete, linked card is deleted first.  Watch recording.
	console.log( "Card", action, "Recorded." )
	await( utils.recordPEQTodo( "XXX TBD. Content may be from issue, or card." , -1 ));	
    }

    return res.json({
	status: 200,
    });
}

exports.handler = handler;
