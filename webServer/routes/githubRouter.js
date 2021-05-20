var express = require('express');
var assert  = require('assert');

const awsAuth = require( '../awsAuth' );
const auth = require( "../auth");
var utils = require('../utils');
var config  = require('../config');

const peqData = require( '../peqData' );
var fifoQ     = require('../components/queue.js');
var links     = require('../components/linkage.js');
var hist      = require('../components/histogram.js');
var circBuff  = require('../components/circBuff.js');

var issues    = require('./githubIssueHandler');
var cards     = require('./githubCardHandler');
var projects  = require('./githubProjectHandler');
var columns   = require('./githubColumnHandler');
var labels    = require('./githubLabelHandler');
var testing   = require('./githubTestHandler');

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

// CE Notification buffer
var ceNotification = new circBuff.CircularBuffer( config.NOTICE_BUFFER_SIZE );

var authData       = {};
var octokitClients = {};
var githubPATs     = {};

// GH Linkage table
var ghLinks = new links.Linkage();

// Will contain parts of the last link that was deleted.
// Add: delete card.  Clear: any notification != delete issue.
// var justDeleted = {};


var router = express.Router();


// INIT  This happens during server startup.
console.log( "*** GH Link Data init ***" );
initGH();

async function initGH() {
    authData.ic  = -1;                // installation client for octokit
    authData.who = "CE SERVER INIT";  // which event is underway
    authData.api = -1;                // api path for aws
    authData.cog = -1;                // cognito id token
    authData.pat = -1;                // personal access token for gh
    authData.job = -1;                // currently active job id

    await initAuth( authData, config.CE_USER, config.SERVER_NOREPO );
    ghLinks.init( authData );  
}

// Need installation client from octokit for every owner/repo/jwt triplet.  
//   jwt is per app install, 1 codeEquity for all.
//   owner and repo can switch with notification.  need multiple.
async function initAuth( authData, owner, repo ) {
    // Wait later
    authData.api = utils.getAPIPath() + "/find";
    authData.cog = awsAuth.getCogIDToken();

    // XXX NOTE this step needed for Linkage init, which needs PAT.  Would prefer alt solution.
    authData.api = await authData.api;
    authData.cog = await authData.cog;

    await getGHAuths( authData, owner, repo );
}

// CE_USER used for app-wide jwt
// owner, repo needed for octokit installation client.
// owner needed for personal access token

// If private repo, get key from aws.  If public repo, use ceServer key.  if tester repos, use config keys.
async function getGHAuths( authData, owner, repo ) {

    if( !octokitClients.hasOwnProperty( owner ) ) { octokitClients[owner] = {}; }

    if( !octokitClients[owner].hasOwnProperty( repo )) {
	console.log( authData.who, "get octo", owner, repo );
	// Wait later
	octokitClients[owner][repo] = {}
	if( repo != config.SERVER_NOREPO ) { octokitClients[owner][repo].auth = auth.getInstallationClient( owner, repo, config.CE_USER ); }
	octokitClients[owner][repo].last = Date.now();
    }


    if( !githubPATs.hasOwnProperty( owner )) { githubPATs[owner] = {}; }

    // Wait later
    if( !githubPATs[owner].hasOwnProperty( repo )) {
	let reservedUsers = [config.CE_USER, config.TEST_OWNER, config.CROSS_TEST_OWNER, config.MULTI_TEST_OWNER];
	githubPATs[owner][repo] = reservedUsers.includes( owner ) ?  auth.getPAT( owner ) :  utils.getStoredPAT( authData, owner, repo );
    }
    
    githubPATs[owner][repo] = await githubPATs[owner][repo];
    // This is the expected outcome for public repos
    if( githubPATs[owner][repo] == -1 ) { githubPATs[owner][repo] = await auth.getPAT( config.CE_USER ); }
    authData.pat = githubPATs[owner][repo];

    if( repo != config.SERVER_NOREPO ) {
	octokitClients[owner][repo].auth = await octokitClients[owner][repo].auth; 
	authData.ic  = octokitClients[owner][repo].auth;
    }
    else { authData.ic  = -1; }

    // Might have gotten older auths above.  Check stamp and refresh as needed.
    await refreshAuths( authData, owner, repo );
    
    return;
}

// Octokit using auth-token ATM, which expires every hour. Refresh as needed.
async function refreshAuths( authData, owner, repo ) {

    const stamp = Date.now();
    if( stamp - octokitClients[owner][repo].last > 3500000 ) {
	console.log( "********  Old octo auth.. refreshing." );
	if( repo != config.SERVER_NOREPO ) {	
	    octokitClients[owner][repo].auth = await auth.getInstallationClient( owner, repo, config.CE_USER );
	    authData.ic  = octokitClients[owner][repo].auth;
	}
	else { authData.ic  = -1; }
	octokitClients[owner][repo].last = Date.now();

	authData.cog = await awsAuth.getCogIDToken();	
    }
    return;
}



// Without this call, incoming non-bot jobs that were delayed would not get executed.
// Only this call will remove from the queue before getting next.  
async function getNextJob( authData, pdOld, sender, res ) {
    let jobData = await utils.getFromQueue( ceJobs );
    if( jobData != -1 ) {

	// New job, new pd
	let pd          = new peqData.PeqData();
	pd.GHOwner      = jobData.GHOwner;
	pd.GHRepo       = jobData.GHRepo;
	pd.reqBody      = jobData.ReqBody;
	pd.GHFullName   = jobData.ReqBody['repository']['full_name'];
	
	// Need a new authData, else source for non-awaited actions is overwritten
	let ic = {};
	ic.who = "<"+jobData.Handler+": "+jobData.Action+" "+jobData.Tag+"> ";
	ic.api = authData.api;
	ic.cog = authData.cog;
	ic.pat = authData.pat;
	ic.job = jobData.QueueId;

	console.log( "\n\n", authData.who, "Got next job:", ic.who );

	await switcher( ic, ghLinks, pd, sender, jobData.Handler, jobData.Action, jobData.Tag, res, jobData.DelayCount, jobData.Stamp );
    }
    else {
	console.log( authData.who, "jobs done" );
	ghLinks.show( 5 );
	ceArrivals.show();
	// ghLinks.showLocs( 10 );
	console.log( "\n" );
    }
    return res.end();
}

async function switcher( authData, ghLinks, pd, sender, event, action, tag, res, delayCount, origStamp ) {
    let retVal = "";

    // clear justDeleted every time, unless possibly part of delete issue blast.
    // if( event != 'issue' || action != 'deleted' ) { justDeleted = {}; }

    await getGHAuths( authData, pd.GHOwner, pd.GHRepo );
    
    switch( event ) {
    case 'issue' :
	{
	    retVal = await issues.handler( authData, ghLinks, pd, action, tag )
		.catch( e => console.log( "Error.  Issue Handler failed.", e ));
	}
	break;
    case 'project_card' :
	{
	    retVal = await cards.handler( authData, ghLinks, pd, action, tag )
		.catch( e => console.log( "Error.  Card Handler failed.", e ));
	}
	break;
    case 'project' :
	{
	    retVal = await projects.handler( authData, ghLinks, pd, action, tag )
		.catch( e => console.log( "Error.  Project Handler failed.", e ));
	}
	break;
    case 'project_column' :
	{
	    retVal = await columns.handler( authData, ghLinks, pd, action, tag )
		.catch( e => console.log( "Error.  Column Handler failed.", e ));
	}
	break;
    case 'label' :
	{
	    retVal = await labels.handler( authData, ghLinks, pd, action, tag )
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
    if( retVal == "postpone" ) {
	// add current job back into queue.
	console.log( authData.who, "Delaying this job." );
	await utils.demoteJob( ceJobs, pd, authData.job, event, sender, tag, delayCount );
    }
    console.log( authData.who, "Millis:", Date.now() - origStamp, "Delays: ", delayCount );
    getNextJob( authData, pd, sender, res );	
}



// Notifications from GH webhooks
router.post('/:location?', async function (req, res) {

    // invisible, mostly
    if( req.body.hasOwnProperty( "Endpoint" ) && req.body.Endpoint == "Testing" ) { return testing.handler( ghLinks, ceJobs, ceNotification, req.body, res ); }
    
    console.log( "" );
    let action   = req.body['action'];
    let event    = req.headers['x-github-event'];

    if( event == "issues" )  { event = "issue"; }

    let sender  = req.body['sender']['login'];
    if( sender == config.CE_BOT) {
	console.log( "Notification for", event, action, "Bot-sent, skipping." );
	return res.end();
    }
    if( action == "synchronize" || req.body.hasOwnProperty( "pull_request" )) {
	console.log( "Notification for Pull Request.  CodeEquity does not require these.  Skipping." );
	return res.end();
    }

    if( !req.body.hasOwnProperty('repository') ) {
	console.log( "Notification for Delete repository.  CodeEquity does not require these.  Skipping." );
	return res.end();
    }
    
    let fullName = req.body['repository']['full_name'];
    let repo     = req.body['repository']['name'];
    let owner    = req.body['repository']['owner']['login'];

    let tag = "";
    let source = "<";
    if( event == "issue" )    {
	tag = (req.body['issue']['title']).replace(/[\x00-\x1F\x7F-\x9F]/g, "");  	
	source += "issue:";
    }
    else if( event == "project_card" ) {
	source += "card:";
	if( req.body['project_card']['content_url'] != null ) {
	    let issueURL = req.body['project_card']['content_url'].split('/');
	    let issueNum = parseInt( issueURL[issueURL.length - 1] );
	    tag = "iss"+parseInt(issueNum);
	}
	else {
	    let cardContent = req.body['project_card']['note'].split('\n');
	    tag = "*"+cardContent[0].substring(0,8)+"*";
	}
	tag = tag.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    }
    else {
	source += event + ":";

	if     ( !req.body.hasOwnProperty( event ) ) { console.log( req.body ); }
	else if( !req.body[event].hasOwnProperty( 'name' ) ) { console.log( req.body ); }

	req.body[event].name.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
	tag = req.body[event].name;
    }

    source += action+" "+tag+"> ";
    let jobId = utils.randAlpha(10);

    notificationCount++;
    if( notificationCount % 20 == 0 ) { ghLinks.show(); }

    // GH stamps are totally unreliable. Maybe good to the minute, which is not useful.  Use server arrival time.
    // let newStamp = req.body[event].updated_at;
    // if( typeof newStamp === 'undefined' ) { newStamp = "1970-01-01T12:00:00Z"; }      // label create doesn't have this

    let newStamp = utils.getMillis();
    ceArrivals.add( newStamp );
    console.log( "Notification:", event, action, tag, jobId, "for", owner, repo, newStamp );
    ceNotification.push( event+" "+action+" "+tag+" "+fullName );

    // Only 1 externally driven job (i.e. triggered from non-CE GH notification) active at any time, per repo/sender.
    // Continue with this job if it's the earliest on the queue.  Otherwise, add to queue and wait for internal activiation from getNext
    let jobData = utils.checkQueue( ceJobs, jobId, event, sender, req.body, tag );
    assert( jobData != -1 );
    if( jobId != jobData.QueueId ) {
	console.log( source, "Sender busy with job#", jobData.QueueId );
	return res.end();
    }

    // Don't set this earlier - authData should only overwrite if it is being processed next.
    // this first jobId is set by getNext to reflect the proposed next job.
    authData.who = source;
    authData.job = jobId;
    
    console.log( authData.who, "job Q [" + fullName + "] clean, start-er-up" );
    
    let pd          = new peqData.PeqData();
    pd.GHOwner      = owner;
    pd.GHRepo       = repo;
    pd.reqBody      = req.body;
    pd.GHFullName   = req.body['repository']['full_name'];

    await switcher( authData, ghLinks, pd, sender, event, action, tag, res, 0, jobData.Stamp );
    
    // avoid socket hangup error, response undefined
    return res.end();
});


module.exports = router;
