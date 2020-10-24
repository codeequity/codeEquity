var testAuth = require('../testAuth');
var utils = require('../utils');
var ghUtils = require('../ghUtils');
var config  = require('../config');
var assert = require('assert');
const auth = require( "../auth");

var gh = ghUtils.githubUtils;

/*
https://developer.github.com/webhooks/event-payloads/#issues
https://octokit.github.io/rest.js/v18#projects-delete-card
https://developer.github.com/v3/issues/#create-an-issue
*/

async function handler( action, repo, owner, reqBody, res ) {

    // Actions: opened, edited, deleted, closed, reopened, labeled, unlabeled, transferred, 
    //          pinned, unpinned, assigned, unassigned,  locked, unlocked, milestoned, or demilestoned.
    // Note: issue:opened         notification after 'submit' is pressed.
    //       issue:labeled        notification after submit
    //       project_card:created notification after submit, then projects:triage to pick column.

    // Sender is the event generator.  Issue:user is ... the original creator of the issue?
    let sender   = reqBody['sender']['login'];
    let userName = reqBody['issue']['user']['login'];
    let title    = reqBody['issue']['title']; 

    if( sender == config.CE_BOT ) {
	console.log( "Bot issue.. taking no action" );
	return;
    }

    console.log( "Got issue, sender:", sender, "action", action );
    console.log( "title:", title );
    
    if( sender == config.CE_BOT ) {
	console.log( "Bot card, skipping." );
	return;
    }

    let installClient = await auth.getInstallationClient( owner, repo );
    let peqValue = -1;

    console.log( "Issues: rate limit" );
    await gh.checkRateLimit(installClient);
    
    // action:open  not relevant until issue: labeled
    switch( action ) {
    case 'labeled':
    case 'unlabeled':
	peqValue = gh.parseHumanPEQ( reqBody['issue']['labels'] );
	if( peqValue <= 0 ) {
	    console.log( "Not a PEQ issue, no action taken." );
	    return;
	}
	else {
	    // XXX add this to Master:unallocated, handle peqSummary if/when moved to new proj/col.
	    // We know this is PEQ now.  Also know this is issue only, ATM.
	    // If or when this issue is added to proj/col, cardHandler takes over.
	    console.log( "Issue labeled with PEQ value." );
	}
	// Would like to speculatively add project_card to planned col of project, pre-triage.
	// unfortunately, can't see project info pre-triage
	await( utils.recordPEQTodo( title, peqValue ));
	break;
    case 'edited': 
    case 'deleted':
	await( utils.recordPEQTodo( title, peqValue ));
	break;
    case 'closed':
    case 'reopened':
	console.log( "closed or reopened" );

	peqValue = gh.parseHumanPEQ( reqBody['issue']['labels'] );
	if( peqValue <= 0 ) {
	    console.log( "Not a PEQ issue, no action taken." );
	    return;
	}

	// Get array: [proj_id, col_idx4]
	let issueId = reqBody['issue']['id'];
	let ceProjectLayout = await gh.validateCEProjectLayout( installClient, issueId );
	if( ceProjectLayout[0] == -1 ) {
	    console.log( "Project does not have recognizable CE column layout.  No action taken." );
	}
	else {
	    await gh.moveIssueCard( installClient, owner, repo, issueId, action, ceProjectLayout ); 
	}
	await( utils.recordPEQTodo( title, peqValue ));
	break;
    case 'transferred':
	// XXX Initially, report transfer out of project.
	//     Optionally, revisit and try to handle xfer automatically if between PEQ projects.
	await( utils.recordPEQTodo( title, peqValue ));
	break;
    case 'opened':       // not PEQ until labeled action
    case 'pinned': 
    case 'unpinned': 
    case 'assigned': 
    case 'unassigned': 
    case 'locked': 
    case 'unlocked': 
    case 'milestoned': 
    case 'demilestoned':
	console.log( "Issue", action, "- no action taken.");
	break;
    default:
	console.log( "Unrecognized action" );
	break;
    }
    
    return res.json({
	status: 200,
    });
}

exports.handler = handler;
