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

    let cardContent = [];
    let installClient = await auth.getInstallationClient( owner, repo );

    // create card notification driven from issues, or directly in project_cards?
    if( action == "created" && reqBody['project_card']['content_url'] != null ) {
	// handled in issueHandler
	console.log( "new card created from issue" );
    }
    else if( action == "created" ) {
	console.log( "New card created in projects" );
	cardContent = reqBody['project_card']['note'].split('\n');

	if( await gh.checkIssueExists( installClient, owner, repo, cardContent[0] ) ) {
	    console.log( "Issue with same title already exists.  Do nothing." );
	    return;
	}
	
	let allocation = gh.getAllocated( cardContent );
	let peqValue = gh.parsePEQ( cardContent, allocation );

	if( peqValue > 0 ) {

	    let peqHumanLabelName = peqValue.toString() + " PEQ";
	    let peqLabel = await gh.findOrCreateLabel( installClient, owner, repo, peqHumanLabelName, peqValue );
	    let colId = reqBody['project_card']['column_id'];
	    let colName = await gh.getColumnName( installClient, colId );
	    let fullName = reqBody['repository']['full_name'];

	    // create new issue
	    let issueID = await gh.createIssue( installClient, owner, repo, cardContent[0], [peqHumanLabelName] );
	    assert.notEqual( issueID, -1, "Unable to create issue linked to this card." );

	    // create issue-linked project_card
	    let newCardID = await gh.createIssueCard( installClient, colId, issueID );
	    assert.notEqual( newCardID, -1, "Unable to create new issue-linked card." );	    
	    
	    // remove orig card
	    let origCardID = reqBody['project_card']['id'];
	    await( installClient.projects.deleteCard( { card_id: origCardID } ));	    

	    // Add card issue linkage
	    console.log( "Adding card/issue to dynamo" );
	    let projId = reqBody['project_card']['project_url'].split('/').pop(); 
	    let projName = await gh.getProjectName( installClient, projId );
	    await( utils.addIssueCard( fullName, issueID, projId, projName, colId, colName, newCardID, cardContent[0] ));

	    let projSub = await gh.getProjectSubs( installClient, fullName, projName, colId );
	    let peqType = allocation ? "Allocation" : "Plan";
	    
	    console.log( "Record PEQ" );
	    let newPEQId = await( utils.recordPEQPlanned(
		peqValue,                                  // amount
		peqType,                                   // type of peq
		fullName,                                  // gh repo
		projSub,                                   // gh project subs
		projId,                                    // gh project id
		issueID.toString(),                        // gh issue id
		cardContent[0]                             // gh issue title
	    ));

	    if( newPEQId != -1 ) {
		let subject = [ newPEQId ];
		console.log( "Record PEQ action" );
		await( utils.recordPEQAction(
		    "---",            // CE UID
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
    }
    else if( action == "converted" ) {
	console.log( "Non-PEQ card converted to issue.  No action." );
    }
    else if( action == "moved" || action == "deleted" || action == "edited" ) {
	// Note, if action source is issue-delete, linked card is deleted first.  Watch recording.
	console.log( "Card", action, "Recorded." )
	await( utils.recordPEQ( "XXX TBD. Content may be from issue, or card." , -1 ));	
    }

    return res.json({
	status: 200,
    });
}

exports.handler = handler;
