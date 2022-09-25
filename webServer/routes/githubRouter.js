const assert  = require('assert');

const auth    = require( "../auth");
const utils   = require( '../utils');
const config  = require( '../config');

const peqData = require( '../peqData' );
const links   = require( '../components/linkage' );

const ceRouter = require( '../ceRouter' );

var issues    = config.PROJ_SOURCE == config.PMS_GHC ? require('./ghClassic/githubIssueHandler')   : null; 
var cards     = config.PROJ_SOURCE == config.PMS_GHC ? require('./ghClassic/githubCardHandler')    : null; 
var projects  = config.PROJ_SOURCE == config.PMS_GHC ? require('./ghClassic/githubProjectHandler') : null; 
var columns   = config.PROJ_SOURCE == config.PMS_GHC ? require('./ghClassic/githubColumnHandler')  : null; 
var labels    = config.PROJ_SOURCE == config.PMS_GHC ? require('./ghClassic/githubLabelHandler')   : null; 

var items     = config.PROJ_SOURCE == config.PMS_GH2 ? require('./ghVersion2/githubPV2ItemHandler') : null; 

var octokitClients = {};
var githubPATs     = {};


// CE_USER used for app-wide jwt
// owner, repo needed for octokit installation client.
// owner needed for personal access token

// Auths are kept in distinct host.org.actor buckets.  For example, Connie from CodeEquity on GitHub will have different perms than
//       Connie from CodeEquity on Atlassian.
// If private repo, get key from aws.  If public repo, use ceServer key.  if tester repos, use config keys.
// NOTE this is called from ceRouter, only.  
async function getAuths( authData, org, actor ) {

    const host = config.HOST_GH;
    
    
    // Only relevant for classic projects (!!)  Even so, keep auth breakdown consistent between parts.
    // Used to be owner/repo.  owner = org, repo = actor (oddly)
    // Need installation client from octokit for every owner/repo/jwt triplet.  
    //   jwt is per app install, 1 codeEquity for all.
    //   owner and repo can switch with notification.  need multiple.
    if( config.PROJ_SOURCE == config.PMS_GHC ) {
	if( !octokitClients.hasOwnProperty( host ) )            { octokitClients[host] = {};      }
	if( !octokitClients[host].hasOwnProperty( org ))        { octokitClients[host][org] = {}; }
	if( !octokitClients[host][org].hasOwnProperty( actor )) {
	    console.log( authData.who, "get octo", host, org, actor );  
	    // Wait later
	    octokitClients[host][org][actor] = {}
	    if( actor != config.SERVER_NOREPO ) { octokitClients[host][org][actor].auth = auth.getInstallationClient( org, actor, config.CE_USER ); }
	    octokitClients[host][org][actor].last = Date.now();
	}
    }

    
    if( !githubPATs.hasOwnProperty( host ))             { githubPATs[host] = {}; }
    if( !githubPATs.hasOwnProperty[host]( org ))        { githubPATs[host][org] = {}; }
    if( !githubPATs[host][org].hasOwnProperty( actor )) {
	// Wait later
	// For Classic, PAT is relying on the org (owner), rather than the repo (actor)
	let patOwner = config.PROJ_SOURCE == config.PMS_GHC ? org : actor;
	let reservedUsers = [config.CE_USER, config.TEST_OWNER, config.CROSS_TEST_OWNER, config.MULTI_TEST_OWNER];
	githubPATs[host][org][actor] = reservedUsers.includes( patOwner ) ?  auth.getPAT( patOwner ) :  utils.getStoredPAT( authData, patOwner );
    }
    githubPATs[host][org][actor] = await githubPATs[host][org][actor];

    // This is the expected outcome for public repos
    // XXX Within an org, this may grant actor too much authority.  Double-check outcomes here.
    if( githubPATs[host][org][actor] == -1 ) { githubPATs[host][org][actor] = await auth.getPAT( config.CE_USER ); }
    authData.pat = githubPATs[host][org][actor];

    authData.ic  = -1;
    if( config.PROJ_SOURCE == config.PMS_GHC ) {    
	if( actor != config.SERVER_NOREPO ) {
	    octokitClients[host][org][actor].auth = await octokitClients[host][org][actor].auth;
	    authData.ic  = octokitClients[host][org][actor].auth;
	}
    }

    // Might have gotten older auths above.  Check stamp and refresh as needed.
    await refreshAuths( authData, host, org, actor );
    
    return;
}

// Octokit using auth-token ATM, which expires every hour. Refresh as needed.
async function refreshAuths( authData, host, org, actor) {

    const stamp = Date.now();

    if( config.PROJ_SOURCE == config.PMS_GHC ) {
	if( stamp - octokitClients[host][org][actor].last > 3500000 ) {
	    console.log( "********  Old octo auth.. refreshing." );
	    if( actor != config.SERVER_NOREPO ) {	
		octokitClients[host][org][actor].auth = await auth.getInstallationClient( org, actor, config.CE_USER );
		authData.ic  = octokitClients[host][org][actor].auth;
	    }
	    else { authData.ic  = -1; }
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
    
    let fullName = jobData.ReqBody.repository.full_name;
    let repo     = jobData.ReqBody.repository.name;
    let owner    = jobData.ReqBody.repository.owner.login;

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
    console.log( "Notification:", jobData.Event, jobData.Action, jobData.Tag, jobId, "for", owner +"/"+ repo, newStamp );

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
    let owner    = jobData.ReqBody.organization.login;

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
    console.log( "Notification:", jobData.Event, jobData.Action, jobData.Tag, jobData.QueueId, "for", owner, newStamp );

    orgPath = config.HOST_GH + "/" + fullName;
    return true;
}

function getJobSummary( newStamp, jobData, orgPath, source ) {

    jobData.Action = jobData.ReqBody.action;
    jobData.Event  = jobData.ReqBody.headers['x-github-event'];

    let retVal = -1;
    
    if( jobData.Event == "issues" )  { jobData.Event = "issue"; }
    
    if(      config.PROJ_SOURCE == config.PMS_GH2 ) { retVal = getJobSummaryGH2( newStamp, jobData, orgPath, source ); }
    else if( config.PROJ_SOURCE == config.PMS_GHC ) { retVal = getJobSummaryGHC( newStamp, jobData, orgPath, source ); }
    else                                            { console.log( "Warning.  Did you forget to set PROJ_SOURCE for GitHub in config.js?" );      }

    return retVal;
}


async function switcherGHC( authData, ghLinks, jd, res, origStamp ) {
    let retVal = "";
    assert( jd.QueueId == authData.job ) ;
    
    let pd          = new peqData.PeqData(); // XXX
    pd.GHOwner      = jd.ReqBody['repository']['owner']['login'];
    pd.GHRepo       = jd.ReqBody['repository']['name'];
    pd.reqBody      = jd.ReqBody;
    pd.GHFullName   = jd.ReqBody['repository']['full_name'];
    
    await ceRouter.getAuths( authData, config.HOST_GH, pd.GHOwner, pd.GHRepo );
    
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
	await utils.demoteJob( ceJobs, jd ); 
    }
    console.log( authData.who, "Millis:", Date.now() - origStamp, "Delays: ", jd.DelayCount );
    ceRouter.getNextJob( authData, res );	
}


async function switcherGH2( authData, ghLinks, jd, res, origStamp ) {
    let retVal = "";
    let org = jd.ReqBody.organization.login;

    let pd            = new peqData.PeqData();                      // XXX
    pd.GHOrganization = org;
    
    assert( jd.QueueId == authData.job ) ;
    await ceRouter.getAuths( authData, config.HOST_GH, org, jd.Actor );
    
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
	await utils.demoteJob( ceJobs, jd );
    }
    console.log( authData.who, "Millis:", Date.now() - origStamp, "Delays: ", jd.DelayCount );
    ceRouter.getNextJob( authData, res );	
}



async function switcher( authData, ghLinks, jd, res, origStamp ) {

    console.log( "" );

    if( jd.Action == "synchronize" || jd.ReqBody.hasOwnProperty( "pull_request" )) {
	console.log( "Notification for Pull Request.  CodeEquity does not require these.  Skipping." );
	return res.end();
    }

    if(      config.PROJ_SOURCE == config.PMS_GH2 ) { await switcherGH2( authData, ghLinks, jd, res, origStamp ); }
    else if( config.PROJ_SOURCE == config.PMS_GHC ) { await switcherGHC( authData, ghLinks, jd, res, origStamp ); }
    else                                            { console.log( "Warning.  Did you forget to set PROJ_SOURCE for GitHub in config.js?" );      }
    
});


exports.ghSwitcher          = switcher;
exports.ghGetAuths          = getAuths;
exports.ghGetJobSummaryData = getJobSummary;
