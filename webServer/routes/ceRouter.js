const express = require('express');
const assert  = require('assert');

const awsAuth = require( '../awsAuth' );
const auth    = require( "../auth");
const utils   = require( '../utils');
const config  = require( '../config');

const fifoQ    = require('../components/queue');
const links    = require('../components/linkage');
const hist     = require('../components/histogram');
const circBuff = require('../components/circBuff');

var testing   = require('./githubTestHandler');
var ghr       = require('./githubRouter');

// INIT  This happens during server startup.
//       Any major interface will get initialized here, once.
// ****************************************************************
console.log( "*** INITIALIZING CEROUTER ***" );

// CE Job Queue  just fifoQ
var ceJobs = {};
ceJobs.jobs = new fifoQ.Queue();
ceJobs.count = 0;
ceJobs.delay = 0;
ceJobs.maxDepth = 0;

// XXX verbosity control needed
var notificationCount = 0;

// CE arrival hist
var ceArrivals = new hist.Histogram( 1, 3, 5, 8, 12, 15, 20, 30 );

// CE Notification buffer, TESTING ONLY
var ceNotification = new circBuff.CircularBuffer( config.NOTICE_BUFFER_SIZE );

var authData = {};
var router   = express.Router();

console.log( "*** CEROUTER init, GH init ***" );

// GH Linkage table
var ghLinks  = new links.Linkage();

init();

async function init() {

    authData.ic      = -1;                // installation client for octokit
    authData.who     = "CE SERVER INIT";  // which event is underway
    authData.api     = -1;                // api path for aws
    authData.cog     = -1;                // cognito id token
    authData.pat     = -1;                // personal access token for gh
    authData.job     = -1;                // currently active job id
    authData.cogLast = -1;                // when was last token acquired

    await initAuth( authData );
    ghLinks.init( authData );  
}

async function initAuth( authData ) {
    // Wait later
    authData.api     = utils.getAPIPath() + "/find";
    authData.cog     = awsAuth.getCogIDToken();
    authData.cogLast = Date.now();

    // XXX NOTE this step needed for Linkage init, which needs PAT.  Would prefer alt solution.
    authData.api = await authData.api;
    authData.cog = await authData.cog;

}


// Called from host handlers, switchers.  Mainly to allow refreshing host-independent tokens
async function getAuths( authData, host, pms, org, actor ) {
    // Cognito auth token expires every hour.  Can make it last longer if needed..
    const stamp = Date.now();
    if( stamp - authData.cogLast > 3500000 ) {
	console.log( "********  Old cognito auth.. refreshing." );
	authData.cog = await awsAuth.getCogIDToken();	
	authData.cogLast = Date.now();
    }

    if( host == config.HOST_GH ) { await ghr.ghGetAuths( authData, pms, org, actor ); }
}


// ceRouter core
// Build, add jobs, get next job, send to platform handler
// ****************************************************************

// Without this call, incoming non-bot jobs that were delayed would not get executed.
// Only this call will remove from the queue before getting next.
// Called from host handlers's switcher routines.
async function getNextJob( authData, res ) {
    let jobData = await utils.getFromQueue( ceJobs );   
    if( jobData != -1 ) {

	let hostHandler = null; 
	if( jobData.Host == config.HOST_GH ) { hostHandler = ghr.ghRouter; }
	else {
	    console.log( "Warning.  Incoming notification is not from a known platform", jobData.ReqBody );
	    return res.end();
	}
	
	// Need a new authData, else source for non-awaited actions is overwritten
	let ic = {};
	ic.who     = "<"+jobData.Event+": "+jobData.Action+" "+jobData.Tag+"> ";   
	ic.api     = authData.api;
	ic.cog     = authData.cog;
	ic.cogLast = authData.cogLast;
	ic.job     = jobData.QueueId;

	// Send authData so cogLast, is correct.
	// But reset authData.pat to keep parent pat correct.
	let tmp = authData.pat;
	getAuths( authData, jobData.Host, jobData.ProjMgmtSys, jobData.Org, jobData.Actor );
	ic.pat = authData.pat;
	authData.pat = tmp;
	
	console.log( "\n\n", authData.who, "Got next job:", ic.who );
	await hostHandler( ic, ghLinks, jobData, res, jobData.Stamp );   
    }
    else {
	console.log( authData.who, "jobs done" );
	ghLinks.show( 5 );
	ceArrivals.show();
	//ghLinks.showLocs( 10 );
	console.log( "\n" );
    }
    return res.end();
}




// Notifications sent by webhook
// Keep this very light-weight.  All processing is done by host platform routers.
router.post('/:location?', async function (req, res) {

    console.log( "XXX XXX XXX XXX" );
    console.log( req.body, req.headers );

    // invisible, mostly
    if( req.body.hasOwnProperty( "Endpoint" ) && req.body.Endpoint == "Testing" ) { return testing.handler( ghLinks, ceJobs, ceNotification, req.body, res ); }

    let jobData         = {};
    jobData.Host        = "";                 // The host platform sending notifications to ceServer
    jobData.Org         = "";                 // Within the host, which organization does the notification belong to?  Example, GH version 2's 'organization:login'
    jobData.ProjMgmtSys = "";                 // Within the host, which project system is being used?  Example: GH classic vs version 2
    jobData.Actor       = "";                 // The entity that caused this specific notification to be sent
    jobData.Event       = "";                 // Primary data type for host notice.       Example - GH's 'project_v2_item'
    jobData.Action      = "";                 // Activity being reported on data type.    Example - project_v2_item 'create'
    jobData.Tag         = "";                 // host-specific name for object, debugging. Example - iss4810
    jobData.ReqBody     = req.body;
    jobData.DelayCount  = 0;
    jobData.QueueId     = utils.randAlpha(10);

    let hostHandler         = null;
    let hostBuildJobSummary = null;

    // Detect additional platform hosts here
    if( req.headers.hasOwnProperty( 'x-github-event' ) ) {
	jobData.Host   = config.HOST_GH;
	jobData.Actor  = req.body.sender.login;
	hostHandler    = ghr.ghRouter;
	hostGetJobData = ghr.ghGetJobSummaryData;

	if( req.body.hasOwnProperty( "projects_v2_item" ) ) { jobData.ProjMgmtSys = config.PMS_GH2; }
	else                                                { jobData.ProjMgmtSys = config.PMS_GHC; }
	
    }
    else {
	console.log( "Warning.  Incoming notification is not from a known platform", req.headers );
	return res.end();
    }

    if( jobData.Actor == config.CE_BOT) {
	console.log( "Notification for", jobData.Event, jobData.Action, "Bot-sent, skipping." );
	return res.end();
    }

    // XXX TESTING ONLY.  Remove before release.  Allow once on CEServer startup, only.
    notificationCount++;
    if( notificationCount % 50 == 0 ) { ghLinks.show(15); }
    
    let orgPath  = "";                       // Unique locator for CodeEquity project.   Example - "GitHub/ariCETester/codeEquityTests"
    let source   = "<";                      // Printable data for debugging notices.    Example - <item:create AnIssue>
    let newStamp = utils.getMillis();

    // Host platform get job data summary info
    let ret = hostGetJobData( newStamp, jobData, orgPath, source );
    if( ret == -1 ) { return res.end(); }
    
    ceArrivals.add( newStamp );                                    // how responsive is the server, debugging
    ceNotification.push( jobData.Event+" "+jobData.Action+" "+jobData.Tag+" "+orgPath );   // testing data

    // Only 1 externally driven job (i.e. triggered from non-CE host platform notification) active at any time
    // Continue with this job if it's the earliest on the queue.  Otherwise, add to queue and wait for internal activation from getNext
    let qTopJobData = utils.checkQueue( ceJobs, jobData ); 
    assert( qTopJobData != -1 );
    if( jobData.QueueId != qTopJobData.QueueId ) {
	console.log( source, "Busy with job#", qTopJobData.QueueId );
	return res.end();
    }

    // Don't set this earlier - authData should only overwrite if it is being processed next.
    // this first jobId is set by getNext to reflect the proposed next job.
    authData.who = source;
    authData.job = jobData.QueueId;
    
    console.log( authData.who, "job Q [" + orgPath + "] clean, start-er-up" );
    await hostHandler( authData, ghLinks, jobData, res, newStamp ); 
    
    // avoid socket hangup error, response undefined
    return res.end();
});


module.exports     = router;
// exports.router     = router;
exports.getNextJob = getNextJob; 
exports.getAuths   = getAuths;
