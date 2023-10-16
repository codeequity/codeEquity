const assert  = require('assert');

const config  = require( '../config');
const ceAuth  = require( '../auth/ceAuth' );

const utils   = require( '../utils/ceUtils' );
const links   = require( '../utils/linkage' );
const ghUtils = require( '../utils/gh/ghUtils' );

const ceRouter = require( './ceRouter' );

// PMS_GHC
const ghcIssues   = require( './gh/ghc/githubIssueHandler' );
const ghcCards    = require( './gh/ghc/githubCardHandler' );
const ghcProjects = require( './gh/ghc/githubProjectHandler' );
const ghcColumns  = require( './gh/ghc/githubColumnHandler' );
const ghcLabels   = require( './gh/ghc/githubLabelHandler' );
const ghcData     = require( './gh/ghc/ghcData' );

// PMS_GH2
const gh2Data   = require( './gh/gh2/gh2Data' );
const gh2Item   = require( './gh/gh2/itemHandler' );
const gh2Issue  = require( './gh/gh2/issueHandler' );
const gh2Label  = require( './gh/gh2/labelHandler' );

// When switching between GHC and GH2, look for pv2Notices that match contentNotices.
var pendingNotices = [];


// CE_ACTOR used for app-wide jwt
// owner, repo needed for octokit installation client.
// owner needed for personal access token



function getJobSummaryGHC( newStamp, jobData, locator ) {

    if( !jobData.reqBody.hasOwnProperty('repository') ) {
	console.log( "Notification for Delete repository.  CodeEquity does not require these.  Skipping." );
	console.log( jobData.reqBody );
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

    locator.source  += jobData.action+" "+jobData.tag+"> ";
    locator.projPath = config.HOST_GH + "/"  + config.TEST_OWNER + "/" + config.TEST_ACTOR;    
    return true;
}

function getJobSummaryGH2( newStamp, jobData, locator ) {

    if( !jobData.reqBody.hasOwnProperty('organization') ) {
	console.log( "Organization not present.  CodeEquity requires organizations for Github's Project Version 2.  Skipping." );
	console.log( jobData.reqBody );
	return -1;
    }

    // XXX Very little descriptive information known at this point, very hard to debug/track.  To get, say, an issue name,
    //     we'd have to wait for a roundtrip query back to GH right now.  ouch!
    // XXX fullName not known for pv2item.  replace with content_node_id (often issue?)  Repo is (?) no longer relevant
    let fullName = jobData.reqBody.organization.login + "/" + jobData.reqBody.projects_v2_item.content_node_id;
    jobData.org  = jobData.reqBody.organization.login;
    jobData.tag  = fullName; 

    if( jobData.event == "projects_v2_item" && jobData.reqBody.projects_v2_item.content_type == "Issue" ) {
	locator.source += "projects_v2_item:";
    }
    else if( jobData.event == "projects_v2_item" && jobData.reqBody.projects_v2_item.content_type == "DraftIssue" ) {
	locator.source += "draftIssue:";
    }
    else {
	locator.source += jobData.event + ":";
	console.log( "Not yet handled", jobData.reqBody ); 
    }

    locator.source  += jobData.action+" "+jobData.tag+"> ";
    locator.projPath = config.HOST_GH + "/"  + config.TEST_OWNER + "/" + config.TEST_ACTOR;    
    return true;
}


// At this point, a pv2 notice is fast and clear cut, but a content notice will take time to determine. 
function getJobSummary( newStamp, jobData, headers, locator ) {
    let retVal = -1;
    
    jobData.action = jobData.reqBody.action;
    jobData.actor  = jobData.reqBody.sender.login;

    jobData.event  = headers['x-github-event'];
    if( jobData.event == "issues" ) { jobData.event = "issue"; }

    // pv2Notice.  If not this, we have a content notice, which could be GH2 or GHC.
    if( jobData.reqBody.hasOwnProperty( "projects_v2_item" ) ) { jobData.projMgmtSys = config.PMS_GH2; }

    // If contentNotice, PMS is not yet known, however repo info is present, so use GHC.
    // ContentNotice does carry repo information, so stay closer to GHC
    if(jobData.event == "projects_v2_item" ) { retVal = getJobSummaryGH2( newStamp, jobData, locator ); }
    else                                     { retVal = getJobSummaryGHC( newStamp, jobData, locator ); }

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
    pd.ceProjectId  = ceProjects.findByRepo( jd.host, jd.org, pd.repoName );
    assert( pd.ceProjectId != -1 );
    ceRouter.setLastCEP( pd.ceProjectId );

    // XXX NOTE!  This is wrong for private repos.  Actor would not be builder.
    console.log( "XXX Switcher GHC" );
    await ceAuth.getAuths( authData, config.HOST_GH, jd.projMgmtSys, pd.repoName, config.CE_ACTOR );
    
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



/*
Notification: ariCETester issue deleted A special populate issue gPLIYUWIGp for codeequity/ceTesterAri 52.35.457
Notification: ariCETester label deleted populate uKmqbWrhjY for codeequity/ceTesterAri 52.42.83

Notification: ariCETester issue opened A special populate issue mTFRjQcztF for codeequity/ceTesterAri 52.54.709
Notification: ariCETester projects_v2_item created codeequity/I_kwDOIiH6ss5fOBwx dJZeEOtxIw for codeequity 52.56.726
Notification: ariCETester projects_v2_item edited codeequity/I_kwDOIiH6ss5fOBwx oQrlTGCJFx for codeequity 52.57.28
Notification: ariCETester label created populate fzUNPcBCYG for codeequity/ceTesterAri 53.00.292
Notification: ariCETester issue labeled A special populate issue EbJIwsnxNa for codeequity/ceTesterAri 53.01.92
Notification: ariCETester projects_v2_item edited codeequity/I_kwDOIiH6ss5fOBwx mxFNGsryyH for codeequity 53.01.197
*/
async function switcherGH2( authData, ceProjects, ghLinks, jd, res, origStamp, ceProjectId ) {

    let retVal = "";

    let pd = new gh2Data.GH2Data( authData, jd, ceProjects, ceProjectId );
    if( pd.ceProjectId == -1 ) { await pd.setCEProjectId( authData, jd, ceProjects ); }

    if( pd.ceProjectId == config.EMPTY ) {
	console.log( "WARNING.  Unlinked projects are not codeEquity projects.  No action is taken." );
    }
    else {
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
		retVal = await gh2Label.handler( authData, ghLinks, pd, jd.action, jd.tag )
		    .catch( e => console.log( "Error.  Label Handler failed.", e ));
	    }
	    break;
	default:
	    {
		console.log( "Event unhandled", event );
		retVal = res.json({ status: 400 });
		break;
	    }
	}
    }

    // Common occurance for out-of-order notices when first linking appId to projectId
    if( retVal == "postpone" ) {
	// add current job back into queue.
	console.log( authData.who, "Delaying this job." );
	await ceRouter.demoteJob( jd );
    }
    // initial ceRouter jobData stamps in raw millis.  handler has interpreted string.  origStamp could be either.
    let mdiff = ( typeof origStamp == "string" ) ? utils.millisDiff( utils.getMillis(), origStamp ) : Date.now() - origStamp; 
    console.log( authData.who, "Millis:", mdiff, "Delays: ", jd.delayCount );
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

	// Some notices can be for pv2 projects, but will never see a pv2 notice
	// Note: createIssue with label will generate issue:labeled.  May, or may not also generate pv2Notice, if carded issue.
	// Basically, any core content.  These become PV2.
	// NOTE: it would be fair at this point to cast everything as PV2, given evident demise of GHC...
	if( jd.event == "issue" && jd.action == "deleted" ||
	    jd.event == "issue" && jd.action == "labeled" ||    
	    jd.event == "issue" && jd.action == "unlabeled" ||    
	    jd.event == "issue" && jd.action == "assigned" ||    
	    jd.event == "issue" && jd.action == "unassigned" ||    
	    jd.event == "label" && jd.action == "deleted" ||
	    jd.event == "label" && jd.action == "created" )
	{
	    // console.log( "Found PV2.  Switching GH2 for content node" );

	    // if job has been delayed, org is already properly set.  Otherwise, build it from getJobSummaryGHC
	    if( jd.delayCount == 0 ) {
		let repo = jd.org.split('/');
		if( repo.length != 2 ) { console.log( repo ); }
		assert( repo.length == 2 );
		jd.org = repo[0];  // XXX revisit this.  recasting content notification to pv2 .. revisit getJobSummary here.
	    }
	    await switcherGH2( authData, ceProjects, ghLinks, jd, res, origStamp );
	}
	else {
	    // Look for matching notices for the rest
	    let nodeId = jd.reqBody[ jd.event ].node_id;
	    let found = false;
	    for( let i = 0; i < pendingNotices.length; i++ ) {
		// If the id's match, then we know the contentNotice is pv2.  No need to match further
		// console.log( "... looking at", pendingNotices[i], nodeId, jd.event );
		if( nodeId == pendingNotices[i].id ) {
		    // console.log( "Found pv2Notice matching contentNotice", pendingNotices[i] );
		    // console.log( "pendingNotices, after removal" );
		    
		    let cpid = await ceProjects.cacheFind( authData, jd.host, pendingNotices[i].org, pendingNotices[i].id, ghUtils.getIssueRepo );

		    // Many notifications come in as content (i.e. issue:label), initially identified as GHC.
		    // Adjust organization to fit GH2
		    jd.org = pendingNotices[i].org;
		    
		    found = true;
		    pendingNotices.splice( i, 1 );
		    await switcherGH2( authData, ceProjects, ghLinks, jd, res, origStamp, cpid );
		    break;
		}
	    }
	    
	    if( !found ) {
		console.log( authData.who, "Did not find matching pv2Notice, delaying." );
		if( jd.delayCount > 5 ) {
		    console.log( "This job has already been delayed several times.. Checking for PV2", nodeId, jd.event, jd.action );
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
    }
    
    if( demote || resolved ) {
	if( demote ) {
	    // console.log( authData.who, "Delaying this job." ); 
	    await ceRouter.demoteJob( jd );
	}
	ceRouter.getNextJob( authData, res );
    }
}

// issue:open is ignored.  issue:create is really card create.  issue:labeled.  item.edit.
function makePendingNotice( rb, action ) {
    // Need to push GH2 info, not GHC.
    assert( typeof rb.projects_v2_item !== 'undefined' );
    assert( typeof rb.projects_v2_item.content_node_id !== 'undefined' );

    let pn = {};
    if( action == "edited" ) {
 	// ghost creeps in sometimes, ignore it.  Seen during issue:close, card:move
	if( rb.sender.login == config.GH_GHOST ) {
	    console.log( "Boo!  GH ghost notification, do not create notice.", rb.projects_v2_item.project_node_id, rb.projects_v2_item.content_node_id );
	    return {id: config.EMPTY, hpid: config.EMPTY, org: config.EMPTY, mod: config.EMPTY};
	}

	assert( typeof rb.changes !== 'undefined' && typeof rb.changes.field_value !== 'undefined' && typeof rb.changes.field_value.field_type !== 'undefined' );
	assert( typeof rb.organization !== 'undefined' );
	pn.mod  = rb.changes.field_value.field_type;
    }
    
    pn.id   = rb.projects_v2_item.content_node_id;
    pn.org  = rb.organization.login;
	
    return pn;
}

async function switcher( authData, ceProjects, hostLinks, jd, res, origStamp ) {

    if( jd.action == "synchronize" || jd.reqBody.hasOwnProperty( "pull_request" )) {
	console.log( "Notification for Pull Request.  CodeEquity does not require these.  Skipping." );
	return res.end();
    }

    if( jd.projMgmtSys == config.PMS_GH2 ) {
	// deleting draft issue will cause 'deleted' to be sent
	if( jd.action == "edited" || jd.action == "created" || jd.action == "deleted" ) {
	    // Don't push labeled notices.  Must assume GH2 since may or may not come from carded issue.
	    let rb = jd.reqBody;
	    let validField = utils.validField( rb, "changes" ) && utils.validField( rb.changes, "field_value" );
	    if( !( jd.action == "edited" && validField && rb.changes.field_value.field_type == "labels" )) {
		pendingNotices.push( makePendingNotice( jd.reqBody, jd.action ) );
		// console.log( "pending after push", pendingNotices );
	    }
	    await switcherGH2( authData, ceProjects, hostLinks, jd, res, origStamp );
	}
	else {
	    console.log( "Error.  githubRouter switcher routing NYI", jd.action );
	    ceRouter.getNextJob( authData, res );	
	}
    }
    else {
        await switcherUNK( authData, ceProjects, hostLinks, jd, res, origStamp );
    }
    
}


exports.ghSwitcher          = switcher;
exports.ghGetJobSummaryData = getJobSummary;
