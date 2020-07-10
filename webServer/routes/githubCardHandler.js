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

// Card operations: no PEQ label:  --

// Card operations: with PEQ label: 
// * <bot> <action> card:    just record
// * remove/archive card:    record
// * move card:              record   (close issue moves related card, or human can move it)

// * create card:            <user> create card, <bot> create issue, <bot> create new card, <bot> delete old card, record
//   issue title exists:     --
// * create card:            <user> adds issue to project, <bot> <create/convert> card, record

// * convert card:           <user> --

// * delete issue with card: <bot> <delete> card  record
//          deletes card, then issue
//          will not delete other cards that share title.. only linked issue cards

// * update issue with card: <bot>  issues:assigned      record
//   issue modify milestone, notification/assignee  does not reach cards, just part of issue.  
//   pull request (check this carefully)

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
	
	let peqValue = gh.parsePEQ( cardContent );

	if( peqValue > 0 ) {

	    let peqHumanLabelName = peqValue.toString() + " PEQ";
	    let peqLabel = await gh.findOrCreateLabel( installClient, owner, repo, peqHumanLabelName, peqValue );

	    // create new issue
	    let issueID = await gh.createIssue( installClient, owner, repo, cardContent[0], [peqHumanLabelName] );
	    assert.notEqual( issueID, -1, "Unable to create issue linked to this card." );

	    // create issue-linked project_card
	    let newCardID = await gh.createIssueCard( installClient, reqBody['project_card']['column_id'], issueID );
	    assert.notEqual( newCardID, -1, "Unable to create new issue-linked card." );	    
	    
	    await( utils.recordPEQ( cardContent[0], peqValue ));

	    // remove orig card
	    let origCardID = reqBody['project_card']['id'];
	    await( installClient.projects.deleteCard( { card_id: origCardID } ));	    
	}
    }
    else if( action == "converted" ) {
	console.log( "Non-PEQ card converted to issue.  No action." );
    }
    else if( action == "moved" || action == "deleted" || action == "edited" ) {
	console.log( "Card", action, "Recorded." )
	await( utils.recordPEQ( "XXX TBD. Content may be from issue, or card." , -1 ));	
    }

    return res.json({
	status: 200,
    });
}

exports.handler = handler;
