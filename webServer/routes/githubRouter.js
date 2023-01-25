const assert  = require('assert');

const config  = require( '../config');
const auth    = require( '../auth/gh/ghAuth' );

const utils    = require( '../utils/ceUtils' );
const awsUtils = require( '../utils/awsUtils' );
const ghUtils  = require( '../utils/gh/ghUtils' );

const links   = require( '../components/linkage' );

const ceRouter = require( './ceRouter' );

// PMS_GHC
const ghcIssues   = require( './ghClassic/githubIssueHandler' );
const ghcCards    = require( './ghClassic/githubCardHandler' );
const ghcProjects = require( './ghClassic/githubProjectHandler' );
const ghcColumns  = require( './ghClassic/githubColumnHandler' );
const ghcLabels   = require( './ghClassic/githubLabelHandler' );
const ghcData  = require( './ghClassic/ghcData' );

// PMS_GH2
const gh2Items  = require( './ghVersion2/githubPV2ItemHandler' );
const gh2Data   = require( './ghVersion2/gh2Data' );
const gh2Issues = require( './ghVersion2/githubPV2IssueHandler' );

// When switching between GHC and GH2, look for pv2Notices that match contentNotices.
var pendingNotices = [];

// Auths
var octokitClients = {};
var githubPATs     = {};



// CE_USER used for app-wide jwt
// owner, repo needed for octokit installation client.
// owner needed for personal access token

// Auths are kept in distinct host.org.actor buckets.  For example, Connie from CodeEquity on GitHub will have different perms than
//       Connie from CodeEquity on Atlassian.
// If private repo, get key from aws.  If public repo, use ceServer key.  if tester repos, use config keys.
// NOTE this is called from ceRouter, only.  
async function getAuths( authData, pms, org, actor ) {

    const host = config.HOST_GH;

    // console.log( "GHR auths", pms, org, actor );
    
    // Only relevant for classic projects (!!)  Even so, keep auth breakdown consistent between parts.
    // Need installation client from octokit for every owner/repo/jwt triplet.  
    //   jwt is per app install, 1 codeEquity for all.
    //   owner and repo can switch with notification.  need multiple.
    if( pms == config.PMS_GHC ) {
	if( !octokitClients.hasOwnProperty( host ) )            { octokitClients[host] = {};      }
	if( !octokitClients[host].hasOwnProperty( org ))        { octokitClients[host][org] = {}; }
	if( !octokitClients[host][org].hasOwnProperty( actor )) {
	    console.log( authData.who, "get octo", host, org, actor );  
	    // Wait later
	    let repoParts = org.split('/');        // XXX rp[1] is undefined for orgs
	    octokitClients[host][org][actor] = {};
	    octokitClients[host][org][actor].auth = auth.getInstallationClient( repoParts[0], repoParts[1], actor ); 
	    octokitClients[host][org][actor].last = Date.now();
	}
    }

    
    if( !githubPATs.hasOwnProperty( host ))             { githubPATs[host] = {}; }
    if( !githubPATs[host].hasOwnProperty( org ))        { githubPATs[host][org] = {}; }
    if( !githubPATs[host][org].hasOwnProperty( actor )) {
	// Wait later
	let reservedUsers = [config.CE_USER, config.TEST_OWNER, config.CROSS_TEST_OWNER, config.MULTI_TEST_OWNER];
	// console.log( "Get PAT for", actor, "in", host, org );
	githubPATs[host][org][actor] = reservedUsers.includes( actor ) ?  auth.getPAT( actor ) :  awsUtils.getStoredPAT( authData, host, actor );
    }
    githubPATs[host][org][actor] = await githubPATs[host][org][actor];
    // console.log( "PATTY", githubPATs[host][org][actor] );

    if( actor == config.GH_GHOST ) {
	console.log( "Skipping PAT acquisition for GitHub ghost action" );
    }
    else if( githubPATs[host][org][actor] == -1 ) {
	console.log( "Warning.  Did not find PAT for", host, org, actor );
	assert( false );
    }
    else { authData.pat = githubPATs[host][org][actor]; }

    authData.ic  = -1;
    if( pms == config.PMS_GHC ) {    
	octokitClients[host][org][actor].auth = await octokitClients[host][org][actor].auth;
	authData.ic  = octokitClients[host][org][actor].auth;
    }

    // Might have gotten older auths above.  Check stamp and refresh as needed.
    await refreshAuths( authData, host, pms, org, actor );
    
    return;
}

// Octokit using auth-token ATM, which expires every hour. Refresh as needed.
async function refreshAuths( authData, pms, host, org, actor) {

    const stamp = Date.now();

    if( pms == config.PMS_GHC ) {
	if( stamp - octokitClients[host][org][actor].last > 3500000 ) {
	    console.log( "********  Old octo auth.. refreshing." );
	    octokitClients[host][org][actor].auth = await auth.getInstallationClient( org, actor, actor );
	    authData.ic  = octokitClients[host][org][actor].auth;
	    octokitClients[host][org][actor].last = Date.now();
	}
    }
    return;
}



function getJobSummaryGHC( newStamp, jobData, locator ) {

    if( !jobData.reqBody.hasOwnProperty('repository') ) {
	console.log( "Notification for Delete repository.  CodeEquity does not require these.  Skipping." );
	return -1;
    }
    
    jobData.org  = jobData.reqBody.repository.full_name;

    if( jobData.event == "issue" )    {
	jobData.tag = (jobData.reqBody.issue.title).replace(/[\x00-\x1F\x7F-\x9F]/g, "");  	
	locator.source += "issue:";
    }
    else if( jobData.event == "project_card" ) {
	locator.source += "card:";
	if( jobData.reqBody.project_card.content_url != null ) {
	    let issueURL = jobData.reqBody.project_card.content_url.split('/');
	    let issueNum = parseInt( issueURL[issueURL.length - 1] );
	    jobData.tag = "iss"+parseInt(issueNum);
	}
	else {
	    //  random timing.  thanks GQL.  XXX can not assert.
	    if( jobData.reqBody.project_card.note == null )
	    {
		assert( jobData.action == 'deleted' );
		jobData.tag = "<title deleted>";
	    }
	    else {
		let cardContent = jobData.reqBody.project_card.note.split('\n');
		jobData.tag = "*"+cardContent[0].substring(0,8)+"*";
	    }
	}
	jobData.tag = jobData.tag.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    }
    else {
	locator.source += jobData.event + ":";

	if     ( !jobData.reqBody.hasOwnProperty( jobData.event ) ) { console.log( jobData.reqBody ); }
	else if( !jobData.reqBody[jobData.event].hasOwnProperty( 'name' ) ) { console.log( jobData.reqBody ); }

	jobData.reqBody[jobData.event].name.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
	jobData.tag = jobData.reqBody[jobData.event].name;
    }

    locator.source += jobData.action+" "+jobData.tag+"> ";
    console.log( "Notification:", jobData.event, jobData.action, jobData.tag, jobData.queueId, "for", jobData.org, newStamp );

    locator.projPath = config.HOST_GH + "/" + jobData.reqBody.repository.full_name;
    return true;
}

function getJobSummaryGH2( newStamp, jobData, locator ) {

    if( !jobData.reqBody.hasOwnProperty('organization') ) {
	console.log( "Organization not present.  CodeEquity requires organizations for Github's Project Version 2.  Skipping." );
	return -1;
    }

    // XXX Very little descriptive information known at this point, very hard to debug/track.  To get, say, an issue name,
    //     we'd have to wait for a roundtrip query back to GH right now.  ouch!
    // XXX fullName not known for pv2item.  replace with content_node_id (often issue?)  Repo is (?) no longer relevant
    let fullName = jobData.reqBody.organization.login + "/" + jobData.reqBody.projects_v2_item.content_node_id;
    jobData.org  = jobData.reqBody.organization.login;
    jobData.tag  = fullName; 

    if( jobData.event == "projects_v2_item" && jobData.reqBody.projects_v2_item.content_type == "Issue" ) {
	locator.source += "issue:";
    }
    else if( jobData.event == "projects_v2_item" && jobData.reqBody.projects_v2_item.content_type == "DraftIssue" ) {
	locator.source += "draftIssue:";
    }
    else {
	locator.source += jobData.event + ":";
	console.log( "Not yet handled", jobData.reqBody ); 
    }

    locator.source += jobData.action+" "+jobData.tag+"> ";
    console.log( "Notification:", jobData.event, jobData.action, jobData.tag, jobData.queueId, "for", jobData.org, newStamp );

    locator.projPath = config.HOST_GH + "/" + fullName;
    return true;
}


// At this point, a pv2 notice is fast and clear cut, but a content notice will take time to determine. 
function getJobSummary( newStamp, jobData, headers, locator ) {
    let retVal = -1;
    
    jobData.actor  = jobData.reqBody.sender.login;
    jobData.action = jobData.reqBody.action;

    jobData.event  = headers['x-github-event'];
    if( jobData.event == "issues" ) { jobData.event = "issue"; }

    // pv2Notice.  If not this, we have a content notice, which could be GH2 or GHC.
    if( jobData.reqBody.hasOwnProperty( "projects_v2_item" ) ) { jobData.projMgmtSys = config.PMS_GH2; }

    // If contentNotice, PMS is not yet known, however repo info is present, so use GHC.
    // ContentNotice does carry repo information, so stay closer to GHC
    if(      jobData.event == "projects_v2_item" )            { retVal = getJobSummaryGH2( newStamp, jobData, locator ); }
    else                                                      { retVal = getJobSummaryGHC( newStamp, jobData, locator ); }

    return retVal;
}


async function switcherGHC( authData, ceProjects, ghLinks, jd, res, origStamp ) {
    let retVal = "";
    assert( jd.queueId == authData.job ) ;
    
    let pd        = new ghcData.GHCData();
    pd.GHOwner    = jd.reqBody['repository']['owner']['login'];
    pd.GHRepo     = jd.reqBody['repository']['name'];
    pd.reqBody    = jd.reqBody;
    pd.repoName   = jd.reqBody['repository']['full_name'];

    // XXX can set ghLinks... and locs..?  more args?  hmmm
    pd.ceProjectId  = ceProjects.find( jd.host, jd.org, jd.reqBody.repository );
    assert( pd.ceProjectId != -1 );

    // XXX NOTE!  This is wrong for private repos.  Actor would not be builder.
    console.log( "XXX Switcher GHC" );
    await ceRouter.getAuths( authData, config.HOST_GH, jd.projMgmtSys, pd.repoName, config.CE_USER );
    
    switch( jd.event ) {
    case 'issue' :
	{
	    retVal = await ghcIssues.handler( authData, ghLinks, pd, jd.action, jd.tag )
		.catch( e => console.log( "Error.  Issue Handler failed.", e ));
	}
	break;
    case 'project_card' :
	{
	    retVal = await ghcCards.handler( authData, ghLinks, pd, jd.action, jd.tag )
		.catch( e => console.log( "Error.  Card Handler failed.", e ));
	}
	break;
    case 'project' :
	{
	    retVal = await ghcProjects.handler( authData, ghLinks, pd, jd.action, jd.tag )
		.catch( e => console.log( "Error.  Project Handler failed.", e ));
	}
	break;
    case 'project_column' :
	{
	    retVal = await ghcColumns.handler( authData, ghLinks, pd, jd.action, jd.tag )
		.catch( e => console.log( "Error.  Column Handler failed.", e ));
	}
	break;
    case 'label' :
	{
	    retVal = await ghcLabels.handler( authData, ghLinks, pd, jd.action, jd.tag )
		.catch( e => console.log( "Error.  Label Handler failed.", e ));
	}
	break;
    default:
	{
	    console.log( "Event unhandled", jd.event );
	    retVal = res.json({ status: 400 });
	    break;
	}
    }
    if( retVal == "postpone" ) {
	// add current job back into queue.
	console.log( authData.who, "Delaying this job." );
	await ceRouter.demoteJob( jd ); 
    }
    console.log( authData.who, "Millis:", Date.now() - origStamp, "Delays: ", jd.delayCount );
    ceRouter.getNextJob( authData, res );	
}


async function switcherGH2( authData, ceProjects, ghLinks, jd, res, origStamp, ceProjectId ) {

    let retVal = "";

    let pd = new gh2Data.GH2Data( jd, ceProjects, ceProjectId );

    console.log( "switcherGH2.." );
    
    assert( jd.queueId == authData.job ) ;
    await ceRouter.getAuths( authData, config.HOST_GH, jd.projMgmtSys, jd.org, jd.actor );

    switch( jd.event ) {
    case 'projects_v2_item' :
	{
	    retVal = await gh2Items.handler( authData, ghLinks, pd, jd.action, jd.tag )
		.catch( e => console.log( "Error.  Item Handler failed.", e ));
	}
	break;
    case 'issue' :
	{
	    retVal = await gh2Issues.handler( authData, ghLinks, pd, jd.action, jd.tag )
		.catch( e => console.log( "Error.  Issue Handler failed.", e ));
	}
	break;
    default:
	{
	    console.log( "Event unhandled", event );
	    retVal = res.json({ status: 400 });
	    break;
	}
    }

    // Common occurance for out-of-order notices when first linking appId to projectId
    if( retVal == "postpone" ) {
	// add current job back into queue.
	console.log( authData.who, "Delaying this job." );
	await ceRouter.demoteJob( jd );
    }
    console.log( authData.who, "Millis:", Date.now() - origStamp, "Delays: ", jd.delayCount );
    ceRouter.getNextJob( authData, res );	
}

// This is a contentNotice. Is it part of a GH2 project?
async function switcherUNK( authData, ceProjects, ghLinks, jd, res, origStamp ) {
    assert( typeof jd.reqBody[ jd.event ] !== 'undefined' );

    // Some notices are ignored, for both GHC and GH2.  Handle those here.
    let resolved = false;
    if( jd.event == "issue" ) {
	switch( jd.action ) {
	case 'opened':
	case 'pinned':   
	case 'unpinned': 
	case 'locked':   
	case 'unlocked': 
	case 'milestoned': 
	case 'demilestoned':
	    console.log(authData.who, "No action required." );
	    resolved = true;
	    break;
	default:
	    break;
	}
    }

    let demote = false;
    if( !resolved ) {
	let nodeId = jd.reqBody[ jd.event ].node_id;
	let found = false;
	for( let i = 0; i < pendingNotices.length; i++ ) {
	    // If the id's match, then we know the contentNotice is pv2.  No need to match further
	    // console.log( "... looking at", pendingNotices[i], nodeId, jd.event );
	    if( nodeId == pendingNotices[i].id ) {
		console.log( "Found pv2Notice matching contentNotice", pendingNotices[i] );
		// console.log( "pendingNotices, after removal" );
		let cpid = ceProjects.find( jd.host, pendingNotices[i].org, pendingNotices[i].hpid );
		found = true;
		pendingNotices.splice( i, 1 );
		await switcherGH2( authData, ceProjects, ghLinks, jd, res, origStamp, cpid );
		break;
	    }
	}
	
	if( !found ) {
	    console.log( authData.who, "Did not find matching pv2Notice." );
	    if( jd.delayCount > 5 ) {
		console.log( "This job has already been delayed several times.. Checking for PV2" );
		let foundPV2 = await ghUtils.checkForPV2( authData.pat, nodeId );
		// XXX disturbing?  where's the pv2Notice?
		if( foundPV2 ) {
		    console.log( "Found PV2.  Switching GH2" );
		    console.log( "XXX Increase delay count?  Otherwise Pending will grow?" );
		    await switcherGH2( authData, ceProjects, ghLinks, jd, res, origStamp );
		}
		else {
		    console.log( "Did not find PV2.  Switching GHC" );
		    await switcherGHC( authData, ceProjects, ghLinks, jd, res, origStamp );
		}
	    }
	    else { demote = true; }
	}
    }
    
    if( demote || resolved ) {
	if( demote ) {
	    console.log( authData.who, "Delaying this job." ); 
	    await ceRouter.demoteJob( jd );
	}
	ceRouter.getNextJob( authData, res );
    }
}

function makePendingNotice( rb ) {
    // Need to push GH2 info, not GHC.
    assert( typeof rb.projects_v2_item !== 'undefined' );
    assert( typeof rb.projects_v2_item.content_node_id !== 'undefined' );
    assert( typeof rb.changes !== 'undefined' && typeof rb.changes.field_value !== 'undefined' && typeof rb.changes.field_value.field_type !== 'undefined' );
    assert( typeof rb.organization !== 'undefined' );
    
    let pn = {};
    pn.id   = rb.projects_v2_item.content_node_id;
    pn.mod  = rb.changes.field_value.field_type;
    pn.hpid = rb.projects_v2_item.project_node_id;
    pn.org  = rb.organization.login;
	
    return pn;
}

async function switcher( authData, ceProjects, hostLinks, jd, res, origStamp ) {

    console.log( "Switching.. " );
    if( jd.action == "synchronize" || jd.reqBody.hasOwnProperty( "pull_request" )) {
	console.log( "Notification for Pull Request.  CodeEquity does not require these.  Skipping." );
	return res.end();
    }

    if( jd.projMgmtSys == config.PMS_GH2 ) {
	if( jd.action == "edited" ) {
	    pendingNotices.push( makePendingNotice( jd.reqBody ) );
	    // console.log( "pending after push", pendingNotices );
	    await switcherGH2( authData, ceProjects, hostLinks, jd, res, origStamp );
	}
	else {
	    console.log( "githubRouter switcher routing NYI", jd.action );
	    assert( false );
	}
    }
    else {
        await switcherUNK( authData, ceProjects, hostLinks, jd, res, origStamp );
    }
    
}


exports.ghSwitcher          = switcher;
exports.ghGetAuths          = getAuths;
exports.ghGetJobSummaryData = getJobSummary;
