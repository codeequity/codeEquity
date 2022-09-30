const express = require( 'express' );
const assert  = require( 'assert' );

const awsAuth = require( '../awsAuth' );
const auth    = require( '../auth' );
const utils   = require( '../utils' );
const config  = require( '../config' );

const fifoQ    = require( '../components/queue' );
const links    = require( '../components/linkage' );
const hist     = require( '../components/histogram' );
const circBuff = require( '../components/circBuff' );

const testing  = require( './githubTestHandler' );
const ghr      = require( './githubRouter' );

const authDataC = require( '../authData' );
const jobData   = require( './jobData' );

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

var authData = new authDataC.AuthData();
var router   = express.Router();

console.log( "*** CEROUTER init, GH init ***" );

// GH Linkage table
var ghLinks  = new links.Linkage();

init();

async function init() {
    authData.who = "CE SERVER INIT";

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
function stampJob( jd, delayCount ) {
    if( jd.Host == "" || jd.ProjMgmtSys == "" || jd.Actor == "" ) {
	console.log( "Warning.  Job does not indicate host, pms or actor.  Skipping." );
	jd.Stamp = -1;
	return;
    }

    jd.DelayCount  = delayCount;
    jd.Stamp = Date.now();
}

function summarizeQueue( ceJobs, msg, limit ) {
    console.log( msg, " Depth", ceJobs.jobs.length, "Max depth", ceJobs.maxDepth, "Count:", ceJobs.count, "Demotions:", ceJobs.delay);
    const jobs = ceJobs.jobs.getAll();
    limit = ceJobs.jobs.length < limit ? ceJobs.jobs.length : limit;
    for( let i = 0; i < limit; i++ ) {
	console.log( "   ", jobs[i].QueueId, jobs[i].Host, jobs[i].Tag, jobs[i].Stamp, jobs[i].DelayCount );
    }
}

// Do not remove top, that is getNextJob's sole perogative
// add at least 2 jobs down (top is self).  if Queue is empty, await.  If too many times, we have a problem.
async function demoteJob( ceJobs, jd ) {
    console.log( "Demoting", jd.QueueId, jd.DelayCount );
    let oldDelayCount = jd.DelayCount; 
    stampJob( jd, oldDelayCount+1 );

    // This can't be, since the job was already processed.
    assert( jd.Stamp != -1 );
    
    // This has failed once, during cross repo blast test, when 2 label notifications were sent out
    // but stack separation was ~20, and so stamp time diff was > 2s. This would be (very) rare.
    // Doubled count, forced depth change, may be sufficient.  If not, change stamp time to next biggest and retry.
    
    assert( oldDelayCount < config.MAX_DELAYS );  
    ceJobs.delay++;
    
    // get splice index
    let spliceIndex = 1;
    let jobs = ceJobs.jobs.getAll();

    const stepCost = config.STEP_COST * oldDelayCount;   
    
    // If nothing else is here yet, delay.  Overall, will delay over a minute 
    if( jobs.length <= 1 ) {
	console.log( "... empty queue, sleep" );
	let delay = oldDelayCount > 4 ? stepCost + config.NOQ_DELAY : stepCost;
	await sleep( delay );
    }
    else {
	// Have to push back at least once.  
	for( let i = 1; i < jobs.length; i++ ) {
	    spliceIndex = i+1;
	    if( jobs[i].Stamp - jd.Stamp > config.MIN_DIFF ) { break;  }
	}
    }
    if( spliceIndex == 1 && jobs.length >= 2 ) { spliceIndex = 2; }  // force progress where possible

    console.log( "Got splice index of", spliceIndex );
    jobs.splice( spliceIndex, 0, jd );

    summarizeQueue( ceJobs, "\nceJobs, after demotion", 7 );
}

function purgeQueue( ceJobs ) {

    console.log( "Purging ceJobs" )
    ceJobs.count = 0;
    ceJobs.delay = 0;

    // Note, this should not be necessary.
    if( ceJobs.jobs.length > 0 ) { 
	summarizeQueue( ceJobs, "Error.  Should not be jobs to purge.", 200 );
	ceJobs.jobs.purge();
    }
}

// Put the job.  Then return first on queue.  Do NOT delete first.
function checkQueue( ceJobs, jd ) {
    stampJob( jd, jd.DelayCount );

    if( jd.Stamp != -1 ) {
	ceJobs.jobs.push( jd );
	if( ceJobs.jobs.length > ceJobs.maxDepth ) { ceJobs.maxDepth = ceJobs.jobs.length; }
	ceJobs.count++;
    }

    summarizeQueue( ceJobs, "\nceJobs, after push", 3 );
    
    return ceJobs.jobs.first;
}

// Remove top of queue, get next top.
async function getFromQueue( ceJobs ) {
    
    ceJobs.jobs.shift();
    return ceJobs.jobs.first;
}


// Without this call, incoming non-bot jobs that were delayed would not get executed.
// Only this call will remove from the queue before getting next.
// Called from host handlers's switcher routines.
async function getNextJob( authData, res ) {
    let jobData = await getFromQueue( ceJobs );   
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

    let jd     = new jobData.JobData();
    jd.ReqBody = req.body;

    let hostHandler         = null;
    let hostBuildJobSummary = null;

    // Detect additional platform hosts here
    if( req.headers.hasOwnProperty( 'x-github-event' ) ) {
	jd.Host   = config.HOST_GH;
	jd.Actor  = req.body.sender.login;
	hostHandler    = ghr.ghRouter;
	hostGetJobData = ghr.ghGetJobSummaryData;

	if( req.body.hasOwnProperty( "projects_v2_item" ) ) { jd.ProjMgmtSys = config.PMS_GH2; }
	else                                                { jd.ProjMgmtSys = config.PMS_GHC; }
	
    }
    else {
	console.log( "Warning.  Incoming notification is not from a known platform", req.headers );
	return res.end();
    }

    if( jd.Actor == config.CE_BOT) {
	console.log( "Notification for", jd.Event, jd.Action, "Bot-sent, skipping." );
	return res.end();
    }

    // XXX TESTING ONLY.  Remove before release.  Allow once on CEServer startup, only.
    notificationCount++;
    if( notificationCount % 50 == 0 ) { ghLinks.show(15); }
    
    let orgPath  = "";                       // Unique locator for CodeEquity project.   Example - "GitHub/ariCETester/codeEquityTests"
    let source   = "<";                      // Printable data for debugging notices.    Example - <item:create AnIssue>
    let newStamp = utils.getMillis();

    // Host platform get job data summary info
    let ret = hostGetJobData( newStamp, jd, orgPath, source );
    if( ret == -1 ) { return res.end(); }
    
    ceArrivals.add( newStamp );                                    // how responsive is the server, debugging
    ceNotification.push( jd.Event+" "+jd.Action+" "+jd.Tag+" "+orgPath );   // testing data

    // Only 1 externally driven job (i.e. triggered from non-CE host platform notification) active at any time
    // Continue with this job if it's the earliest on the queue.  Otherwise, add to queue and wait for internal activation from getNext
    let qTopJobData = checkQueue( ceJobs, jd ); 
    assert( qTopJobData != -1 );
    if( jd.QueueId != qTopJobData.QueueId ) {
	console.log( source, "Busy with job#", qTopJobData.QueueId );
	return res.end();
    }

    // Don't set this earlier - authData should only overwrite if it is being processed next.
    // this first jobId is set by getNext to reflect the proposed next job.
    authData.who = source;
    authData.job = jd.QueueId;
    
    console.log( authData.who, "job Q [" + orgPath + "] clean, start-er-up" );
    await hostHandler( authData, ghLinks, jd, res, newStamp ); 
    
    // avoid socket hangup error, response undefined
    return res.end();
});


module.exports     = router;

exports.getNextJob = getNextJob; 
exports.getAuths   = getAuths;

exports.purgeQueue = purgeQueue;
exports.demoteJob  = demoteJob;
