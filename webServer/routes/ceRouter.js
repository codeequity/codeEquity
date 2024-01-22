const express = require( 'express' );
const assert  = require( 'assert' );

const awsAuth  = require( '../auth/aws/awsAuth' );
const utils    = require( '../utils/ceUtils' );
const awsUtils = require( '../utils/awsUtils' );
const links    = require( '../utils/linkage' );
const config   = require( '../config' );

const ceAuth   = require( '../auth/ceAuth' );

const fifoQ    = require( '../components/queue' );
const hist     = require( '../components/histogram' );
const circBuff = require( '../components/circBuff' );

const testing  = require( './githubTestHandler' );
const ghr      = require( './githubRouter' );

const authDataC  = require( '../auth/authData' );
const jobData    = require( './jobData' );
const ceProjData = require( './ceProjects' );

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
ceJobs.lastCEP = config.EMPTY;

// XXX verbosity control needed
var notificationCount = 0;

// CE arrival hist
var ceArrivals = new hist.Histogram( 1000, [1, 3, 5, 8, 12, 15, 20, 30] );

// CE Notification buffer, TESTING ONLY
var ceNotification = new circBuff.CircularBuffer( config.NOTICE_BUFFER_SIZE );

var authData = new authDataC.AuthData();
var router   = express.Router();

console.log( "*** CEROUTER init, HOST init ***" );

// CEProjects data.  Few link/unlink.  Many notices in the middle.
var ceProjects = new ceProjData.CEProjects();

// Host Linkage table
var hostLinks  = new links.Linkage();

init();

async function init() {
    authData.who = "CE SERVER INIT";

    await initAuth( authData );

    await ceProjects.init( authData );

    await hostLinks.init( authData );  
}

async function initAuth( authData ) {
    // Wait later
    authData.api     = awsUtils.getAPIPath() + "/find";
    authData.cog     = awsAuth.getCogIDToken();
    authData.cogLast = Date.now();

    // XXX NOTE this step needed for Linkage init, which needs PAT.  Would prefer alt solution.
    authData.api = await authData.api;
    authData.cog = await authData.cog;
}




// ceRouter core
// Build, add jobs, get next job, send to platform handler
// ****************************************************************
// do NOT update stampLat(ency), just stamp
// NOTE: on a clean job queue, jd.stamp will be set with stampLat upon initial arrival, then immediately updated by checkQueue.  
function stampJob( jd, delayCount ) {
    if( jd.host == "" || jd.projMgmtSys == "" || jd.actor == "" ) {
	console.log( "Warning.  Job does not indicate host, pms or actor.  Skipping." );
	jd.stamp = -1;
	return;
    }

    jd.delayCount  = delayCount;
    jd.stamp = Date.now();
    console.log( "STAMP", jd.queueId, jd.stamp );
}

function summarizeQueue( ceJobs, msg, limit, short ) {
    const jobs = ceJobs.jobs.getAll();
    limit = ceJobs.jobs.length < limit ? ceJobs.jobs.length : limit;
    if( short ) {
	let top3 = "";
	for( let i = 0; i < limit; i++ ) {
	    top3 += jobs[i].queueId + " ";
	}
	console.log( msg, " Depth", ceJobs.jobs.length, "Max depth", ceJobs.maxDepth, "Count:", ceJobs.count, "Demotions:", ceJobs.delay, "Top3:", top3);
    }
    else {
	console.log( msg, " Depth", ceJobs.jobs.length, "Max depth", ceJobs.maxDepth, "Count:", ceJobs.count, "Demotions:", ceJobs.delay);
	for( let i = 0; i < limit; i++ ) {
	    console.log( "   ", jobs[i].queueId, jobs[i].host, jobs[i].tag, jobs[i].stamp, jobs[i].delayCount );
	}
    }
}

// Do not remove top, that is getNextJob's sole perogative
// add at least 2 jobs down (top is self).  if Queue is empty, await.  If too many times, we have a problem.
async function demoteJob( jd ) {
    console.log( "    Demoting", jd.queueId, jd.delayCount );
    let oldDelayCount = jd.delayCount; 
    stampJob( jd, oldDelayCount+1 );

    // This can't be, since the job was already processed.
    assert( jd.stamp != -1 );
    
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
	await utils.sleep( delay );
    }
    else {
	// Have to push back at least once.  
	for( let i = 1; i < jobs.length; i++ ) {
	    spliceIndex = i+1;
	    if( jobs[i].stamp - jd.stamp > config.MIN_DIFF ) { break;  }
	}
    }
    if( spliceIndex == 1 && jobs.length >= 2 ) { spliceIndex = 2; }  // force progress where possible

    // console.log( "Got splice index of", spliceIndex );
    jobs.splice( spliceIndex, 0, jd );

    summarizeQueue( ceJobs, "\nceJobs, after demotion", 7, true );
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
    stampJob( jd, jd.delayCount );

    if( jd.stamp != -1 ) {
	ceJobs.jobs.push( jd );
	if( ceJobs.jobs.length > ceJobs.maxDepth ) { ceJobs.maxDepth = ceJobs.jobs.length; }
	ceJobs.count++;
    }

    summarizeQueue( ceJobs, "\nceJobs, after push", 3, true );
    
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
    if( jobData !== -1 ) {

	stampJob( jobData, jobData.delayCount );  // update to track cost
	
	let hostHandler = null;
	if( jobData.host == config.HOST_GH ) { hostHandler = ghr.ghSwitcher; }
	else {
	    console.log( "Warning.  Incoming notification is not from a known platform", jobData.reqBody );
	    return res.end();
	}
	
	// Need a new authData, else source for non-awaited actions is overwritten
	let ic = {};
	ic.who     = "<GNJ "+jobData.event+": "+jobData.action+" "+jobData.tag+"> ";   
	ic.api     = authData.api;
	ic.cog     = authData.cog;
	ic.cogLast = authData.cogLast;
	ic.job     = jobData.queueId;

	// Send authData so cogLast, is correct.
	// But reset authData.pat to keep parent pat correct.
	let tmp = authData.pat;
	ceAuth.getAuths( authData, jobData.host, jobData.projMgmtSys, jobData.org, jobData.actor );
	ic.pat = authData.pat;
	authData.pat = tmp;
	
	console.log( "\n\nGot next job:", ic.who );
	await hostHandler( ic, ceProjects, hostLinks, jobData, res );   
    }
    else {
	console.log( authData.who, "jobs done" );
	hostLinks.show( 5, ceJobs.lastCEP );
	ceArrivals.show( "CE notice arrivals (s):      ");
	// Cycle through each host's reporting
	ghr.reportCosts();
	
	//hostLinks.showLocs( 10 );
	console.log( "\n" );
    }
    return res.end();
}

function setLastCEP( cep ) {
    ceJobs.lastCEP = cep; 
}


// Notifications sent by webhook
// Keep this very light-weight.  All processing is done by host platform routers.
router.post('/:location?', async function (req, res) {

    // console.log( "XXX XXX XXX XXX" );
    // console.log( "BODY", req.body, "\nHEADERS", req.headers );

    // invisible, mostly
    if( req.body.hasOwnProperty( "Endpoint" ) && req.body.Endpoint == "Testing" ) { return testing.handler( hostLinks, ceJobs, ceProjects, ceNotification, req.body, res ); }

    let jd     = new jobData.JobData();
    jd.reqBody = req.body;

    let hostHandler    = null;
    let hostGetJobData = null;

    // Detect additional platform hosts here
    if( req.headers.hasOwnProperty( 'x-github-event' ) ) {
	jd.host   = config.HOST_GH;
	
	hostHandler    = ghr.ghSwitcher;
	hostGetJobData = ghr.ghGetJobSummaryData;
    }
    else {
	console.log( "Warning.  Incoming notification is not from a known platform", req.headers );
	return res.end();
    }

    // {projPath, source} where
    // projPath    Unique locator for hostProject. Example - "GitHub/ariCETester/codeEquityTests"
    // source      Printable data for debugging notices.    Example - <item:create AnIssue>
    let locator   = { projPath: "", source: "<" };   

    // Host platform get job data summary info, including original arrival time for stampLat(ency)
    let ret = hostGetJobData( jd, req.headers, locator );
    if( ret == -1 ) {
	console.log( "Ignoring notification" );
	return res.end();
    }

    // XXX GQL prefers using CE_ACTOR.  REST prefers CE_BOT.  Can they be reconciled?
    if( jd.actor == config.CE_ACTOR || jd.actor == config.CE_BOT || jd.actor == config.GH_BOT) {
	console.log( "\nNotification for", jd.event, jd.action, jd.actor, "is Bot-sent, skipping." );
	return res.end();
    }
    let newStamp  = utils.getMillis();   
    console.log( "Notification:", jd.actor, jd.event, jd.action, jd.tag, jd.queueId, "for", jd.org, newStamp );
    
    // XXX TESTING ONLY.  Remove before release.  Allow once on CEServer startup, only.
    notificationCount++;
    if( notificationCount % 50 == 0 ) { hostLinks.show(15); }
    

    ceArrivals.add( newStamp );                                                      // how quickly are notifications arriving?
    ceNotification.push( jd.event+" "+jd.action+" "+jd.tag+" "+locator.projPath );   // testing data

    // Only 1 externally driven job (i.e. triggered from non-CE host platform notification) active at any time
    // Continue with this job if it's the earliest on the queue.  Otherwise, add to queue and wait for internal activation from getNext
    let qTopJobData = checkQueue( ceJobs, jd ); 
    assert( qTopJobData !== -1 );
    if( jd.queueId != qTopJobData.queueId ) {
	console.log( locator.source, "Busy with job#", qTopJobData.queueId );
	return res.end();
    }

    // Don't set this earlier - authData should only overwrite if it is being processed next.
    // this first jobId is set by getNext to reflect the proposed next job.
    authData.who = locator.source;
    authData.job = jd.queueId;
    
    console.log( authData.who, "job Q [" + locator.projPath + "] clean, start-er-up" );
    await hostHandler( authData, ceProjects, hostLinks, jd, res ); 
    
    // avoid socket hangup error, response undefined
    return res.end();
});




module.exports     = router;

exports.getNextJob = getNextJob; 

exports.purgeQueue = purgeQueue;
exports.demoteJob  = demoteJob;

exports.setLastCEP = setLastCEP;
