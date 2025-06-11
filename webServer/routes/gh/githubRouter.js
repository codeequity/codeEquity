import assert  from 'assert';

import * as ceAuth  from '../../auth/ceAuth.js';

import * as config  from '../../config.js';
import * as utils   from '../../utils/ceUtils.js';
import * as ghUtils from '../../utils/gh/ghUtils.js';

import links         from '../../utils/linkage.js';
import * as ceRouter from '../../routes/ceRouter.js';

import hist          from '../../components/histogram.js';


// PMS_GHC

// PMS_GH2
import gh2Data         from '../../routes/gh/gh2/gh2Data.js';
import * as gh2Item    from '../../routes/gh/gh2/itemHandler.js';
import * as gh2Issue   from '../../routes/gh/gh2/issueHandler.js';
import * as gh2Label   from '../../routes/gh/gh2/labelHandler.js';
import * as gh2Project from '../../routes/gh/gh2/projectHandler.js';

// var noticeCount = 0;

// CE_ACTOR used for app-wide jwt
// owner, repo needed for octokit installation client.
// owner needed for personal access token

// GitHub cost hist, latency hist
var ghCost    = new hist( 1, [300, 600, 900, 1500, 3000, 5000, 8000, 30000] );
var ghLatency = new hist( 1, [300, 600, 900, 1500, 3000, 5000, 8000, 30000] );


// Github Demote queue

function getJobSummaryGHC( jobData, locator ) {
    console.log( "GHC DEPRECATED" );
    assert( false );
}

function getJobSummaryGH2( jobData, locator ) {

    // ContentNotice carries repo information, pv2Item does not. (issue, draftIssue, label)
    if(jobData.event != "projects_v2_item" && jobData.event != "projects_v2") {
	if( !jobData.reqBody.hasOwnProperty('repository') ) {
	    console.log( "Content notice without repository.  Skipping.", jobData.reqBody );
	    return -1;
	}

	let repo = jobData.reqBody.repository.full_name.split('/');
	if( repo.length != 2 ) { console.log( repo ); }
	assert( repo.length == 2 );
	jobData.org = repo[0];
	
	if( jobData.event == "issue" )    {
	    jobData.tag = (jobData.reqBody.issue.title).replace(/[\x00-\x1F\x7F-\x9F]/g, "");  	
	    locator.source += "issue:";
	}
	else {
	    locator.source += jobData.event + ":";

	    if     ( !jobData.reqBody.hasOwnProperty( jobData.event ) )         { console.log( "WARNING.  Unhandled.", jobData.reqBody ); }
	    else if( !jobData.reqBody[jobData.event].hasOwnProperty( 'name' ) ) { console.log( "WARNING.  Unhandled.", jobData.reqBody ); }
	    
	    jobData.reqBody[jobData.event].name.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
	    jobData.tag = jobData.reqBody[jobData.event].name;
	}
    }
    else {
	if( !jobData.reqBody.hasOwnProperty('organization') ) {
	    console.log( "Organization not present.  CodeEquity requires organizations for Github's Project Version 2.  Skipping." );
	    console.log( jobData.reqBody );
	    return -1;
	}
	
	jobData.org  = jobData.reqBody.organization.login;

	// NOTE Very little descriptive information known at this point, very hard to debug/track.  To get, say, an issue name,
	//      we'd have to wait for a roundtrip query back to GH right now.  ouch!
	let tagId = jobData.event == "projects_v2" ? jobData.reqBody.projects_v2.node_id : jobData.reqBody.projects_v2_item.content_node_id;
	jobData.tag  = jobData.org + "/" + tagId;

	if( jobData.event == "projects_v2" ) {
	    locator.source += "projects_v2:";
	}
	else if( jobData.event == "projects_v2_item" && jobData.reqBody.projects_v2_item.content_type == config.GH_ISSUE ) {
	    locator.source += "projects_v2_item:";
	}
	else if( jobData.event == "projects_v2_item" && jobData.reqBody.projects_v2_item.content_type == config.GH_ISSUE_DRAFT ) {
	    locator.source += "draftIssue:";
	}
	else {
	    locator.source += jobData.event + ":";
	    console.log( "Not yet handled", jobData.reqBody ); 
	}
	
    }
    locator.source  += jobData.action+" "+jobData.tag+"> ";
    locator.projPath = config.HOST_GH + "/"  + config.TEST_OWNER + "/" + config.TEST_ACTOR;
    return true;
	
}


// At this point, a pv2 notice is fast and clear cut, but a content notice will take time to determine.
function getJobSummaryData( jobData, headers, locator ) {
    let retVal = -1;
    
    jobData.action = jobData.reqBody.action;
    jobData.actor  = jobData.reqBody.sender.login;

    jobData.event  = headers['x-github-event'];

    // Initial job creation, set initial stamps.
    let now = Date.now();
    jobData.stamp    = now;
    jobData.stampLat = now;

    // Nothing to do for pull requests
    if( jobData.event == "pull_request" ) { console.log( "Pull request" ); return retVal; }

    if( jobData.event == "issues" ) { jobData.event = "issue"; }

    // pv2Notice.  If not this, we have a content notice, which could be GH2 or GHC.
    // if( jobData.reqBody.hasOwnProperty( "projects_v2_item" ) ) { jobData.projMgmtSys = config.PMS_GH2; }
    jobData.projMgmtSys = config.PMS_GH2;

    // if(jobData.event == "projects_v2_item" ) { retVal = getJobSummaryGH2( jobData, locator ); }
    // else                                     { retVal = getJobSummaryGHC( jobData, locator ); }

    retVal = getJobSummaryGH2( jobData, locator );
    return retVal;
}


async function switcherGHC( authData, ceProjects, ghLinks, jd, res ) {
    console.log( "GHC DEPRECATED" );
    assert( false );
}


async function switcherGH2( authData, ceProjects, ghLinks, jd, res ) {

    let retVal = "";

    assert( typeof jd.reqBody[ jd.event ] !== 'undefined' );

    // Some notices are ignored.  Handle those here.
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

    if( !resolved ) {
	// Basically, any core content.  These become PV2.
	// Note: createIssue with label will generate issue:labeled.  May, or may not also generate pv2Notice, if carded issue.
	// Note: reopen/closed will generate pv notice with ghost pv2 edit (no changes).  Treat this here to avoid dependence on Ghost.
	//       ghost is unspecified, or incorrectly specified for github as of 10/23.  

	// Can not set ceProjectId if this is a project_v2 notice - they live cross-repo.
	// NOTE: pd.actorId starts as a promise - no real way to use it before resolves unless something is really broken,
	//       and that something will cause error in server first.
	let pd = new gh2Data( authData, jd, ceProjects );
	if( pd.ceProjectId == -1 ) { await pd.setCEProjectId( authData, jd, ceProjects ); }
	console.log( "GHR: cePID", pd.ceProjectId );
	
	ceRouter.setLastCEP( pd.ceProjectId );
	assert( jd.queueId == authData.job ) ;
	// await ceAuth.getAuths( authData, config.HOST_GH, jd.projMgmtSys, jd.org, jd.actor );
	await ceAuth.getAuths( authData, config.HOST_GH, jd.projMgmtSys, jd.org, config.CE_ACTOR );
	
	switch( jd.event ) {
	case 'projects_v2_item' :
	    {
		// item created/deleted is ~ cardHandler.  Edited..?
		retVal = await gh2Item.handler( authData, ceProjects, ghLinks, pd, jd.action, jd.tag, jd.delayCount )
		    .catch( e => console.log( "Error.  Item Handler failed.", e ));
	    }
	    break;
	case 'issue' :
	    {
		retVal = await gh2Issue.handler( authData, ceProjects, ghLinks, pd, jd.action, jd.tag )
		    .catch( e => console.log( "Error.  Issue Handler failed.", e ));
	    }
	    break;
	case 'label' :
	    {
		retVal = await gh2Label.handler( authData, ceProjects, ghLinks, pd, jd.action, jd.tag )
		    .catch( e => console.log( "Error.  Label Handler failed.", e ));
	    }
	    break;
	case 'projects_v2' :
	    {
		retVal = await gh2Project.handler( authData, ceProjects, ghLinks, pd, jd.action, jd.tag )
		    .catch( e => console.log( "Error.  Project Handler failed.", e ));
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
    }

    // initial ceRouter jobData stamps in raw millis.  handler has interpreted string.
    let now = Date.now();
    let stampDiff = now - jd.stamp;
    let latDiff   = now - jd.stampLat;
    let pre       = "Mid";

    if( retVal != "postpone" ) {
	pre = "Final";
	ghCost.addDiff( stampDiff );
	ghLatency.addDiff( latDiff );
    }
    
    // console.log( authData.who, pre, "Millis:", stampDiff, "(", jd.stamp, ")", latDiff, "(", jd.stampLat, ")", "Delays:", jd.delayCount );
    console.log( authData.who, pre, "Millis:", stampDiff, latDiff, "Delays:", jd.delayCount );
    ceRouter.getNextJob( authData, res );	
}



async function switcherUNK( authData, ceProjects, ghLinks, jd, res ) {
    assert( false );
}

async function switcher( authData, ceProjects, hostLinks, jd, res ) {

    // noticeCount = noticeCount + 1;
    // if( noticeCount % 25 == 0 ) { ghUtils.show( true ); }  // XXX formalize or remove
	
    if( jd.action == "synchronize" || jd.reqBody.hasOwnProperty( "pull_request" )) {
	console.log( "Notification for Pull Request.  CodeEquity does not require these.  Skipping." );
	return res.end();
    }

    if( jd.projMgmtSys == config.PMS_GH2 ) { await switcherGH2( authData, ceProjects, hostLinks, jd, res ); }
    else {                                   await switcherUNK( authData, ceProjects, hostLinks, jd, res ); }
    
}

async function reportCosts( ) {
    ghCost.show(    "GH processing costs (ms):    " );
    ghLatency.show( "GH processing latencies (ms):" );
}


export {switcher};
export {getJobSummaryData};
export {reportCosts};

