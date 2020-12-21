// const awsAuth = require( '../awsAuth' );
// const auth = require( "../auth");
var utils = require('../utils');
var ghUtils = require('../ghUtils');
var config  = require('../config');
var assert = require('assert');
const peqData = require( '../peqData' );

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

// Guarantee: Once populateCEProjects has been run once for a repo:
//            1) Every carded issues in that repo resides in the linkage table.
//            2) Newborn issues and newborn cards can still exist (pre-existing, or post-populate), and will not reside in the linkage table.
//            3) {label, add card} operation on newborn issues will cause conversion to carded (unclaimed) or situated issue as needed,
//               and inclusion in linkage table.
//            Implies: {open} newborn issue will not create linkage.. else the attached PEQ would be confusing


async function getNextJob( installClient, owner, repo, sender ) {
    let jobData = await utils.getFromQueue( installClient, owner, repo, sender );
    if( jobData != -1 ) {
	console.log( "Got next job" )
	// jobData: [ action, repo, owner, reqBody, res, tag ]
	handler( installClient, jobData[0], jobData[1], jobData[2], jobData[3], jobData[4], jobData[5], true );
    }
    else {
	console.log( sender, "jobs done" );
    }
    
    return;
}


// Actions: opened, edited, deleted, closed, reopened, labeled, unlabeled, transferred, 
//          pinned, unpinned, assigned, unassigned,  locked, unlocked, milestoned, or demilestoned.
// Note: issue:opened         notification after 'submit' is pressed.
//       issue:labeled        notification after click out of label section
//       project_card:created notification after submit, then projects:triage to pick column.
async function handler( installClient, action, repo, owner, reqBody, res, tag, internal ) {

    // Sender is the event generator.
    let sender   = reqBody['sender']['login'];
    console.log( reqBody.issue.updated_at, "title:", reqBody['issue']['title'] );

    /*
    if( sender == config.CE_BOT ) {
	console.log( "Bot issue.. taking no action" );
	return;
    }
    // installClient is quad [installationAccessToken, creationSource, apiPath, cognitoIdToken]
    let source = "<issue:"+action+" "+tag+"> ";
    let apiPath = utils.getAPIPath() + "/find";
    let idToken = await awsAuth.getCogIDToken();
    let installClient = [-1, source, apiPath, idToken];
    */
    

    // XXX Will probably want to move peq value check here or further up, for all below, once this if filled out

    if( !internal ) {
	let tstart = Date.now();
	// ??? don't pass res along - ceServer is a dead-end as far as GH notifications are concerned
	// XXX Speed can vary between .25s and 2s .. seems to be dependent on how 'hot' amazon instance is.
	//     upgrade instance == better results here
	let senderPending = await utils.checkQueue( installClient, owner, repo, sender, action, reqBody, "", tag );
	if( senderPending > 0 ) {
	    console.log( installClient[1], "Sender busy", senderPending );
	    return;
	}
	console.log( installClient[1], "check Q done", Date.now() - tstart );
    }
    
    // title can have bad, invisible control chars that break future matching, esp. w/issues created from GH cards
    let pd = new peqData.PeqData();
    pd.GHOwner      = owner;
    pd.GHRepo       = repo;
    pd.reqBody      = reqBody;
    pd.GHIssueId    = reqBody['issue']['id'];
    pd.GHCreator    = reqBody['issue']['user']['login'];
    pd.GHIssueTitle = (reqBody['issue']['title']).replace(/[\x00-\x1F\x7F-\x9F]/g, "");  
    pd.GHFullName   = reqBody['repository']['full_name'];
    
    // installClient[0] = await auth.getInstallationClient( pd.GHOwner, pd.GHRepo, config.CE_USER );
    // await gh.checkRateLimit(installClient);
    
    switch( action ) {
    case 'labeled':
	// Can get here at any point in issue interface by adding a label, peq or otherwise
	// Should not get here from adding alloc card - that is a bot action.
	// Can peq-label any type of issue (newborn, carded, situated) that is not >= PROJ_ACCR
	// ... but it if is situated already, adding a second peq label is ignored.
	// Note: a 1:1 mapping issue:card is maintained here, via utils:resolve.  So, this labeling is relevant to 1 card only 

	// XXXX XXXXX This will go away with ceFlutter
	if( gh.populateRequest( pd.reqBody['issue']['labels'] )) {
	    await gh.populateCELinkage( installClient, pd );
	    getNextJob( installClient, owner, repo, sender );
	    return;
	}
	
	pd.peqValue = gh.theOnePEQ( pd.reqBody['issue']['labels'] );
	if( pd.peqValue <= 0 ) {
	    console.log( "Not a PEQ issue, no action taken." );
	    getNextJob( installClient, owner, repo, sender );
	    return;
	}
	
	// Was this a carded issue?  Get linkage
	let links = await( utils.getIssueLinkage( installClient, pd.GHIssueId ));
	assert( links == -1 || links.length == 1 );
	let link = links == -1 ? links : links[0];

	// Newborn PEQ issue.  Create card in unclaimed... need to maintain promise of linkage in dynamo.
	// but can't create card without column_id.  No project, or column_id without triage.
	if( link == -1 || link.GHColumnId == -1) {
	    if( link == -1 ) {    
		link = {};
		let card = await gh.createUnClaimedCard( installClient, pd.GHOwner, pd.GHRepo, pd.GHIssueId );
		let issueURL = card.content_url.split('/');
		assert( issueURL.length > 0 );
		link.GHIssueNum  = parseInt( issueURL[issueURL.length - 1] );
		link.GHCardId    = card.id
		link.GHProjectId = card.project_url.split('/').pop();
		link.GHColumnId  = card.column_url.split('/').pop();
	    }
	    else {  // newborn card.
		let card = await gh.getCard( installClient, link.GHCardId );
		link.GHColumnId  = card.column_url.split('/').pop();
	    }
	}

	pd.updateFromLink( link );
	console.log( "Ready to update Proj PEQ PAct:", link.GHCardId, link.GHIssueNum );

	let content = [];
	content.push( pd.GHIssueTitle );
	content.push( config.PDESC + pd.peqValue.toString() );
	await utils.processNewPEQ( installClient, pd, content, link );
	break;
    case 'unlabeled':
	// Can unlabel issue that may or may not have a card, as long as not >= PROJ_ACCR.  PROJ_PEND is OK, since could just demote to PROG/PLAN
	// Do not move card, would be confusing for user.

	// Unlabel'd label data is not located under issue.. parseLabel looks in arrays
	pd.peqValue = gh.parseLabelDescr( [ pd.reqBody['label']['description'] ] );
	if( pd.peqValue <= 0 ) {
	    console.log( "Not a PEQ issue, no action taken." );
	    getNextJob( installClient, owner, repo, sender );
	    return;
	}
	// XXX Inform contributors that status is now UNTRACKED

	console.log( "PEQ Issue unlabeled" );
	utils.rebaseLinkage( installClient, pd.GHFullName, pd.GHIssueId );   // setting various to -1, as it is now untracked
	let peq = await utils.getPeq( installClient, pd.GHIssueId );	
	utils.recordPEQAction(
	    installClient,
	    config.EMPTY,     // CE UID
	    pd.GHCreator,     // gh user name
	    pd.GHFullName,    // of the repo
	    "confirm",        // verb
	    "delete",         // action
	    [ peq.PEQId ],    // subject
	    "unlabel",        // note
	    utils.getToday(), // entryDate
	    pd.reqBody           // raw
	);
	break;
    case 'edited':
	// XXX what happens to push this notice?
	await( utils.recordPEQTodo( pd.GHIssueTitle, pd.peqValue ));
    case 'deleted':
	// XXX if peq, confirm:delete    similar to unlabel?
	await( utils.recordPEQTodo( pd.GHIssueTitle, pd.peqValue ));
	break;
    case 'closed':
    case 'reopened':
	console.log( "closed or reopened" );

	pd.peqValue = gh.theOnePEQ( pd.reqBody['issue']['labels'] );
	if( pd.peqValue <= 0 ) {
	    console.log( "Not a PEQ issue, no action taken." );
	    getNextJob( installClient, owner, repo, sender );
	    return;
	}

	// Get array: [proj_id, col_idx4]
	// XXX getLayout and moveIssue both call getGHCard
	let ceProjectLayout = await gh.getCEProjectLayout( installClient, pd.GHIssueId );
	if( ceProjectLayout[0] == -1 ) {
	    console.log( "Project does not have recognizable CE column layout.  No action taken." );
	}
	else {
	    let success = await gh.moveIssueCard( installClient, pd.GHOwner, pd.GHRepo, pd.GHIssueId, action, ceProjectLayout ); 
	    if( success ) {
		console.log( source, "Find & validate PEQ" );
		let peqId = ( await( gh.validatePEQ( installClient, pd.GHFullName, pd.GHIssueId, pd.GHIssueTitle, ceProjectLayout[0] )) )['PEQId'];
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
		    utils.recordPEQAction(
			installClient,
			config.EMPTY,     // CE UID
			sender,           // gh user name
			pd.GHFullName,    // of the repo
			verb,
			action,
			subject,          // subject
			"",               // note
			utils.getToday(), // entryDate
			pd.reqBody        // raw
		    );
		}
	    }
	    else { console.log( "Unable to complete move of issue card.  No action taken" ); }
	}
	break;
    case 'transferred':
	// XXX Need to handle confirm add/delete here if peq
	//     Optionally, revisit and try to handle xfer automatically if between PEQ projects.
	await( utils.recordPEQTodo( pd.GHIssueTitle, pd.peqValue ));
	break;
    case 'assigned':
	{
	    // Careful - reqBody.issue carries it's own assignee data, which is not what we want here
	    console.log( "Assign", pd.reqBody.assignee.login, "to issue", pd.GHIssueId );
	    
	    pd.peqValue = gh.theOnePEQ( pd.reqBody['issue']['labels'] );
	    if( pd.peqValue <= 0 ) {
		console.log( "Not a PEQ issue, no action taken." );
		getNextJob( installClient, owner, repo, sender );
		return;
	    }
	    
	    // Peq issues only.  PEQ tracks assignees from ceFlutter.  Just send PAct upstream.
	    let peq = await utils.getPeq( installClient, pd.GHIssueId );
	    let assignee = pd.reqBody.assignee.login;
	    let verb = "confirm";
	    let action = "change";
	    let subject = [peq.PEQId.toString(), assignee];
	    utils.recordPEQAction(
		installClient,
		config.EMPTY,     // CE UID
		sender,           // gh user name
		pd.GHFullName,    // of the repo
		verb,
		action,
		subject,          // subject
		"add assignee",   // note
		utils.getToday(), // entryDate
		pd.reqBody        // raw
	    );
	}
	break;
    case 'unassigned':
	{
	    console.log( "Unassign", pd.reqBody.assignee.login, "from issue", pd.GHIssueId );
	    
	    pd.peqValue = gh.theOnePEQ( pd.reqBody['issue']['labels'] );
	    if( pd.peqValue <= 0 ) {
		console.log( "Not a PEQ issue, no action taken." );
		getNextJob( installClient, owner, repo, sender );
		return;
	    }
	    
	    let peq = await utils.getPeq( installClient, pd.GHIssueId );
	    let assignee = pd.reqBody.assignee.login;
	    let verb = "confirm";
	    let action = "change";
	    let subject = [peq.PEQId.toString(), assignee];
	    utils.recordPEQAction(
		installClient,
		config.EMPTY,     // CE UID
		sender,           // gh user name
		pd.GHFullName,    // of the repo
		verb,
		action,
		subject,          // subject
		"remove assignee",   // note
		utils.getToday(), // entryDate
		pd.reqBody        // raw
	    );
	}
	break;
    case 'opened':
	// Can get here by 'convert to issue' on a newborn card, or more commonly, New issue with submit.
	// XXX Do NOT convert newborn issue -> carded issue (unclaimed)
	console.log( installClient[1], "Issue id:", reqBody['issue']['id'], "nodeId:", reqBody['issue']['node_id'] );
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
    
    getNextJob( installClient, owner, repo, sender );
    return;
}

exports.handler = handler;
