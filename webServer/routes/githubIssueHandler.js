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

// Terminology:
// situated issue: an issue with a card in a CE-valid project structure
// carded issue:   an issue with a card not in a CE-valid structure
// newborn issue:  a plain issue without a project card, without PEQ label
// newborn card :  a card without an issue

// Note: Once populateCEProjects has been run once for a repo, all carded issues in that repo
//       are added to linkage table.  Newborn issues and cards can still exist.
//       {label, open, add card} operation on newborn issues will cause conversion to carded (unclaimed) or situated issue,
//       and inclusion in linkage table.

async function handler( action, repo, owner, reqBody, res ) {

    // Actions: opened, edited, deleted, closed, reopened, labeled, unlabeled, transferred, 
    //          pinned, unpinned, assigned, unassigned,  locked, unlocked, milestoned, or demilestoned.
    // Note: issue:opened         notification after 'submit' is pressed.
    //       issue:labeled        notification after click out of label section
    //       project_card:created notification after submit, then projects:triage to pick column.

    // Sender is the event generator.  Issue:user is ... the original creator of the issue?
    // title can have bad, invisible control chars that break future matching, esp. w/issues created from GH cards
    let sender   = reqBody['sender']['login'];
    let creator  = reqBody['issue']['user']['login'];
    let title    = (reqBody['issue']['title']).replace(/[\x00-\x1F\x7F-\x9F]/g, "");  
    let fullName = reqBody['repository']['full_name'];
    
    console.log( "Got issue, sender:", sender, "action", action );
    console.log( "title:", title );

    if( sender == config.CE_BOT ) {
	console.log( "Bot issue.. taking no action" );
	return;
    }

    // installClient is pair [installationAccessToken, creationSource]
    let token = await auth.getInstallationClient( owner, repo );
    let source = "<ISS:"+action+"> ";
    let installClient = [token, source];
    let issueId = reqBody['issue']['id'];

    let peqValue = -1;
    await gh.checkRateLimit(installClient);

    switch( action ) {
    case 'labeled':
	// Can get here at any point in issue interface by adding a label, peq or otherwise
	// Can peq-label any type of issue (newborn, carded, situated) that is not >= PROJ_ACCR
	// ... but it if is situated already, adding a second peq label is ignored.
	// Note: a 1:1 mapping issue:card is maintained here, via utils:resolve.  So, this labeling is relevant to 1 card only 
	
	peqValue = gh.theOnePEQ( reqBody['issue']['labels'] );
	if( peqValue <= 0 ) {
	    console.log( "Not a PEQ issue, no action taken." );
	    return;
	}

	// Was this a carded issue?  Get that card.  If populate not yet done, do it and try again.
	let links = await( utils.getIssueLinkage( installClient[1], issueId ));
	assert( links == -1 || links.length == 1 );
	let link = links == -1 ? links : links[0];
	if( link == -1 ) {  
	    console.log( "Card linkage not present in dynamo" );
	    if( await( gh.populateCEProjects( installClient, owner, repo, fullName ) ) ) {  
		links = await( utils.getIssueLinkage( installClient[1], issueId ));
		link = links == -1 ? links : links[0];
	    }
	}

	if( link == -1 ) {
	    console.log( "Newborn PEQ issue.  Create card in unclaimed" );
	    // Can't create card without column_id.  No project, or column_id without triage.
	    // Create in proj:col UnClaimed:Unclaimed to maintain promise of linkage in dynamo.
	    let card = await( gh.createUnClaimedCard( installClient, owner, repo, issueId ) );
	    link = {};
	    link.GHCardId    = card.id
	    link.GHColumnId  = card.column_url.split('/').pop();
	    link.GHProjectId = card.project_url.split('/').pop();
	    let issueURL = card.content_url.split('/');
	    assert( issueURL.length > 0 );
	    link.GHIssueNum  = parseInt( issueURL[issueURL.length - 1] );
	}

	console.log( "Ready to update Proj PEQ PAct, first linkage:", link.GHCardId, link.GHIssueNum );

	let content = [];
	content.push( reqBody['issue']['title'] );
	content.push( config.PDESC + peqValue.toString() );

	await utils.processNewPEQ( installClient, repo, owner, reqBody, content, creator, issueNum, issueId, link );
	break;
    case 'unlabeled':
	// Can unlabel issue that may or may not have a card, as long as not >= PROJ_ACCR.  PROJ_PEND is OK, since could just demote to PROG/PLAN
	// Do not move card, would be confusing for user.

	// Unlabel'd label data is not located under issue.. parseLabel looks in arrays
	peqValue = gh.parseLabelDescr( [ reqBody['label']['description'] ] );
	if( peqValue <= 0 ) {
	    console.log( "Not a PEQ issue, no action taken." );
	    return;
	}
	// XXX Inform contributors that status is now UNTRACKED

	console.log( "PEQ Issue unlabeled" );
	utils.rebaseLinkage( fullName, issueId );   // setting various to -1, as it is now untracked
	let peq = await utils.getPeq( installClient[1], issueId );	
	utils.recordPEQAction(
	    installClient[1],
	    config.EMPTY,     // CE UID
	    creator,          // gh user name
	    fullName,         // gh repo
	    "confirm",        // verb
	    "delete",         // action
	    [ peq.PEQId ],    // subject
	    "unlabel",        // note
	    utils.getToday(), // entryDate
	    reqBody           // raw
	);
	
	break;
    case 'edited':
	// XXX what happens to push this notice?
	await( utils.recordPEQTodo( title, peqValue ));
    case 'deleted':
	// XXX if peq, confirm:delete    similar to unlabel?
	await( utils.recordPEQTodo( title, peqValue ));
	break;
    case 'closed':
    case 'reopened':
	console.log( "closed or reopened" );

	peqValue = gh.theOnePEQ( reqBody['issue']['labels'] );
	if( peqValue <= 0 ) {
	    console.log( "Not a PEQ issue, no action taken." );
	    return;
	}

	// XXX validateCE and moveIssue both call getGHCard
	
	// Get array: [proj_id, col_idx4]
	let ceProjectLayout = await gh.validateCEProjectLayout( installClient, issueId );
	if( ceProjectLayout[0] == -1 ) {
	    console.log( "Project does not have recognizable CE column layout.  No action taken." );
	}
	else {
	    let success = await gh.moveIssueCard( installClient, owner, repo, fullName, issueId, action, ceProjectLayout ); 
	    if( success ) {
		console.log( source, "Find & validate PEQ" );
		let peqId = ( await( gh.validatePEQ( installClient, fullName, issueId, title, ceProjectLayout[0] )) )['PEQId'];
		if( peqId == -1 ) {
		    console.log( source, "Could not find or verify associated PEQ.  Trouble in paradise." );
		}
		else {
		    // githubCardHandler:recordMove must handle many more options.  Choices here are limited.
		    // Closed: 
		    let verb = "propose";
		    let action = "accrue";
		    if( action == "reopened" ) { verb = "reject"; }   // XXX this will not be seen!!
		    
		    let subject = [ peqId.toString() ];
		    await( utils.recordPEQAction(
			source,
			config.EMPTY,     // CE UID
			sender,           // gh user name
			fullName,         // gh repo
			verb,
			action,
			subject,          // subject
			"",               // note
			utils.getToday(), // entryDate
			reqBody           // raw
		    ));
		}
	    }
	    else { console.log( "Unable to complete move of issue card.  No action taken" ); }
	}
	break;
    case 'transferred':
	// XXX Need to handle confirm add/delete here if peq
	//     Optionally, revisit and try to handle xfer automatically if between PEQ projects.
	await( utils.recordPEQTodo( title, peqValue ));
	break;
    case 'assigned':
	// XXX
	console.log( "Check if peq, then assign" );
    case 'unassigned': 
	// XXX  could need to move to unattr, probably need to submit peq action
	console.log( "Check if peq, then unassign" );
    case 'opened':
	// Can get here by 'convert to issue' on a newborn card, or more commonly, New issue with submit.
	// XXX If the latter, convert newborn issue -> carded issue (unclaimed)
    case 'pinned': 
    case 'unpinned': 
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
