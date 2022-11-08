const assert  = require('assert');

const auth    = require( '../auth/gh/ghAuth' );
const utils   = require( '../utils/ceUtils' );
const config  = require( '../config');

const links   = require( '../components/linkage' );

const ceRouter = require( './ceRouter' );

// PMS_GHC
const issues   = require( './ghClassic/githubIssueHandler' );
const cards    = require( './ghClassic/githubCardHandler' );
const projects = require( './ghClassic/githubProjectHandler' );
const columns  = require( './ghClassic/githubColumnHandler' );
const labels   = require( './ghClassic/githubLabelHandler' );
const ghcData  = require( './ghClassic/ghcData' );

// PMS_GH2
const items   = require( './ghVersion2/githubPV2ItemHandler' );
const gh2Data = require( './ghVersion2/gh2Data' );

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
	githubPATs[host][org][actor] = reservedUsers.includes( actor ) ?  auth.getPAT( actor ) :  utils.getStoredPAT( authData, actor );
    }
    githubPATs[host][org][actor] = await githubPATs[host][org][actor];
    // console.log( "PATTY", githubPATs[host][org][actor] );
    
    if( githubPATs[host][org][actor] == -1 ) {
	console.log( "Warning.  Did not find PAT for", actor );
	assert( false );
    }
    authData.pat = githubPATs[host][org][actor];

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



function getJobSummaryGHC( newStamp, jobData, orgPath, source ) {

    if( !jobData.ReqBody.hasOwnProperty('repository') ) {
	console.log( "Notification for Delete repository.  CodeEquity does not require these.  Skipping." );
	return -1;
    }
    
    jobData.Org  = jobData.ReqBody.repository.full_name;

    if( jobData.Event == "issue" )    {
	jobData.Tag = (jobData.ReqBody.issue.title).replace(/[\x00-\x1F\x7F-\x9F]/g, "");  	
	source += "issue:";
    }
    else if( jobData.Event == "project_card" ) {
	source += "card:";
	if( jobData.ReqBody.project_card.content_url != null ) {
	    let issueURL = jobData.ReqBody.project_card.content_url.split('/');
	    let issueNum = parseInt( issueURL[issueURL.length - 1] );
	    jobData.Tag = "iss"+parseInt(issueNum);
	}
	else {
	    //  random timing.  thanks GQL.  XXX can not assert.
	    if( jobData.ReqBody.project_card.note == null )
	    {
		assert( jobData.Action == 'deleted' );
		jobData.Tag = "<title deleted>";
	    }
	    else {
		let cardContent = jobData.ReqBody.project_card.note.split('\n');
		jobData.Tag = "*"+cardContent[0].substring(0,8)+"*";
	    }
	}
	jobData.Tag = jobData.Tag.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    }
    else {
	source += jobData.Event + ":";

	if     ( !jobData.ReqBody.hasOwnProperty( jobData.Event ) ) { console.log( jobData.ReqBody ); }
	else if( !jobData.ReqBody[jobData.Event].hasOwnProperty( 'name' ) ) { console.log( jobData.ReqBody ); }

	jobData.ReqBody[jobData.Event].name.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
	jobData.Tag = jobData.ReqBody[jobData.Event].name;
    }

    source += jobData.Action+" "+jobData.Tag+"> ";
    console.log( "Notification:", jobData.Event, jobData.Action, jobData.Tag, jobId, "for", jobData.Org, newStamp );

    orgPath = config.HOST_GH + "/" + jobData.ReqBody.repository.full_name;
    return true;
}

function getJobSummaryGH2( newStamp, jobData, orgPath, source ) {

    if( !jobData.ReqBody.hasOwnProperty('organization') ) {
	console.log( "Organization not present.  CodeEquity requires organizations for Github's Project Version 2.  Skipping." );
	return -1;
    }

    // XXX umm... no?  check getauths
    // XXX Very little descriptive information known at this point, very hard to debug/track.  To get, say, an issue name,
    //     we'd have to wait for a roundtrip query back to GH right now.  ouch!
    // XXX fullName not known for pv2item.  replace with content_node_id (often issue?)  Repo is (?) no longer relevant
    let fullName = jobData.ReqBody.organization.login + "/" + jobData.ReqBody.projects_v2_item.content_node_id;
    jobData.Org  = jobData.ReqBody.organization.login;

    if( jobData.Event == "projects_v2_item"  && jobData.ReqBody.projects_v2_item.content_type == "Issue" ) {
	jobData.Tag = fullName; 
	source += "issue:";
    }
    else {
	source += jobData.Event + ":";
	console.log( "Not yet handled", jobData.ReqBody ); 
	jobData.Tag = jobData.ReqBody[jobData.Event];
    }

    source += jobData.Action+" "+jobData.Tag+"> ";
    console.log( "Notification:", jobData.Event, jobData.Action, jobData.Tag, jobData.QueueId, "for", jobData.Org, newStamp );

    orgPath = config.HOST_GH + "/" + fullName;
    return true;
}

function getJobSummary( newStamp, jobData, orgPath, source ) {

    jobData.Action = jobData.ReqBody.action;
    jobData.Event  = jobData.ReqBody.headers['x-github-event'];

    let retVal = -1;
    
    if( jobData.Event == "issues" )  { jobData.Event = "issue"; }

    // XXXXX classic look for headers.
    if(      jobData.Event == "projects_vs_item" ) { retVal = getJobSummaryGH2( newStamp, jobData, orgPath, source ); }
    else if( !jobData.ReqData.hasOwnProperty("organization")) { retVal = getJobSummaryGHC( newStamp, jobData, orgPath, source ); }
    else                                           { console.log( "Warning.  Can't identify type of project mgmt sys for notification." );      }

    return retVal;
}


async function switcherGHC( authData, ceProjects, ghLinks, jd, res, origStamp ) {
    let retVal = "";
    assert( jd.QueueId == authData.job ) ;
    
    let pd          = new ghcData.GHCData();
    pd.GHOwner      = jd.ReqBody['repository']['owner']['login'];
    pd.GHRepo       = jd.ReqBody['repository']['name'];
    pd.reqBody      = jd.ReqBody;
    pd.GHFullName   = jd.ReqBody['repository']['full_name'];

    // XXX can set ghLinks... and locs..?  more args?  hmmm
    pd.CEProjectId  = ceProjects.find( jd.Host, jd.Org, jd.ReqBody.repository );
    assert( pd.CEProjectId != -1 );

    // XXX NOTE!  This is wrong for private repos.  Actor would not be builder.
    console.log( "XXX Switcher GHC" );
    await ceRouter.getAuths( authData, config.HOST_GH, jd.ProjMgmtSys, pd.GHFullName, config.CE_USER );
    
    switch( jd.Event ) {
    case 'issue' :
	{
	    retVal = await issues.handler( authData, ghLinks, pd, jd.Action, jd.Tag )
		.catch( e => console.log( "Error.  Issue Handler failed.", e ));
	}
	break;
    case 'project_card' :
	{
	    retVal = await cards.handler( authData, ghLinks, pd, jd.Action, jd.Tag )
		.catch( e => console.log( "Error.  Card Handler failed.", e ));
	}
	break;
    case 'project' :
	{
	    retVal = await projects.handler( authData, ghLinks, pd, jd.Action, jd.Tag )
		.catch( e => console.log( "Error.  Project Handler failed.", e ));
	}
	break;
    case 'project_column' :
	{
	    retVal = await columns.handler( authData, ghLinks, pd, jd.Action, jd.Tag )
		.catch( e => console.log( "Error.  Column Handler failed.", e ));
	}
	break;
    case 'label' :
	{
	    retVal = await labels.handler( authData, ghLinks, pd, jd.Action, jd.Tag )
		.catch( e => console.log( "Error.  Label Handler failed.", e ));
	}
	break;
    default:
	{
	    console.log( "Event unhandled", jd.Event );
	    retVal = res.json({ status: 400 });
	    break;
	}
    }
    if( retVal == "postpone" ) {
	// add current job back into queue.
	console.log( authData.who, "Delaying this job." );
	await ceRouter.demoteJob( ceJobs, jd ); 
    }
    console.log( authData.who, "Millis:", Date.now() - origStamp, "Delays: ", jd.DelayCount );
    ceRouter.getNextJob( authData, res );	
}


async function switcherGH2( authData, ceProjects, ghLinks, jd, res, origStamp ) {
    let retVal = "";
    let org = jd.ReqBody.organization.login;

    let pd            = new gh2Data.GH2Data();
    pd.GHOrganization = org;
    
    assert( jd.QueueId == authData.job ) ;
    console.log( "XXX Swither GH2" );
    await ceRouter.getAuths( authData, config.HOST_GH, jd.ProjMgmtSys, org, jd.Actor );
    
    switch( jd.Event ) {
    case 'projects_v2_item' :
	{
	    retVal = await items.handler( authData, ghLinks, pd, jd.Action, jd.Tag )
		.catch( e => console.log( "Error.  Issue Handler failed.", e ));
	}
	break;
    case 'issue' :
	{
	    console.log( "Issue event arrived - new handler needed" );
	}
	break;
    default:
	{
	    console.log( "Event unhandled", event );
	    retVal = res.json({ status: 400 });
	    break;
	}
    }
    if( retVal == "postpone" ) {
	// add current job back into queue.
	console.log( authData.who, "Delaying this job." );
	await ceRouter.demoteJob( ceJobs, jd );
    }
    console.log( authData.who, "Millis:", Date.now() - origStamp, "Delays: ", jd.DelayCount );
    ceRouter.getNextJob( authData, res );	
}



async function switcher( authData, ceProjects, hostLinks, jd, res, origStamp ) {

    console.log( "" );

    if( jd.Action == "synchronize" || jd.ReqBody.hasOwnProperty( "pull_request" )) {
	console.log( "Notification for Pull Request.  CodeEquity does not require these.  Skipping." );
	return res.end();
    }

    if(      jd.ProjMgmtSys == config.PMS_GH2 ) { await switcherGH2( authData, ceProjects, hostLinks, jd, res, origStamp ); }
    else if( jd.ProjMgmtSys == config.PMS_GHC ) { await switcherGHC( authData, ceProjects, hostLinks, jd, res, origStamp ); }
    else                                        { console.log( "Warning.  Can't identify proj mgmt sys for notification." );      }
    
}


exports.ghSwitcher          = switcher;
exports.ghGetAuths          = getAuths;
exports.ghGetJobSummaryData = getJobSummary;
