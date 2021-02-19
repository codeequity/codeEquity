var express = require('express');
var assert  = require('assert');

const awsAuth = require( '../awsAuth' );
const auth = require( "../auth");
var utils = require('../utils');
var config  = require('../config');

const peqData = require( '../peqData' );
var fifoQ     = require('../components/queue.js');
var links     = require('../components/linkage.js');

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

var notificationCount = 0;

var authData       = {};
var octokitClients = {};
var githubPATs     = {};

// GH Linkage table
var ghLinks = new links.Linkage();

// XXX temp, or add date
var lastEvent = {"h": 0, "m": 0, "s": 0 };

// Will contain parts of the last link that was deleted.
// Add: delete card.  Clear: any notification != delete issue.
// var justDeleted = {};


var router = express.Router();


// INIT  This happens during server startup.
console.log( "*** GH Link Data init ***" );
initGH();

async function initGH() {
    authData.ic  = -1;                // installation client for octokit    0
    authData.who = "CE SERVER INIT";  // which event is underway            1
    authData.api = -1;                // api path for aws                   2
    authData.cog = -1;                // cognito id token                   3
    authData.pat = -1;                // personal access token for gh       -
    authData.job = -1;                // currently active job id            4

    // XXX Generally, PAT will not be testOwner, testRepo.  Need CE-wide
    await initAuth( authData, config.TEST_OWNER, config.TEST_REPO  );
    ghLinks.init( authData );  
}

// Need installation client from octokit for every owner/repo/jwt triplet.  
//   jwt is per app install, 1 codeEquity for all.
//   owner and repo can switch with notification.  need multiple.
async function initAuth( authData, owner, repo ) {
    authData.api = await utils.getAPIPath() + "/find";
    authData.cog = await awsAuth.getCogIDToken();

    // XXX NOTE this step needed for Linkage init, which needs PAT.  Would prefer alt solution.
    await getGHAuths( authData, owner, repo );
}

// CE_USER used for app-wide jwt
// owner, repo needed for octokit installation client.
// owner needed for personal access token
async function getGHAuths( authData, owner, repo ) {
    /*
    let promises = [];
    if( !octokitClients.hasOwnProperty( owner ) ) { octokitClients[owner] = {}; }

    promises.push( 
	if( !octokitClients[owner].hasOwnProperty( repo )) {
	    console.log( authData.who, "get octo", owner, repo );
	    octokitClients[owner][repo] = await auth.getInstallationClient( owner, repo, config.CE_USER );
	}.promise()
    );

    promises.push( 
	if( !githubPATs.hasOwnProperty( owner )) {
	    console.log( authData.who, "get PAT", owner );
	    githubPATs[owner] = await auth.getPAT( owner );
	}.promise()
    );

    await Promise.all( promises );

    authData.ic  = octokitClients[owner][repo];
    authData.pat = githubPATs[owner];
    return;
    */


    if( !octokitClients.hasOwnProperty( owner ) ) { octokitClients[owner] = {}; }
    
    if( !octokitClients[owner].hasOwnProperty( repo )) {
	console.log( authData.who, "get octo", owner, repo );
	octokitClients[owner][repo] = await auth.getInstallationClient( owner, repo, config.CE_USER );
    }

    if( !githubPATs.hasOwnProperty( owner )) {
	githubPATs[owner] = await auth.getPAT( owner );
    }
    
    authData.ic  = octokitClients[owner][repo];
    authData.pat = githubPATs[owner];
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

	await switcher( ic, ghLinks, pd, sender, jobData.Handler, jobData.Action, jobData.Tag, res, jobData.DelayCount );
    }
    else {
	console.log( authData.who, "jobs done" );
	ghLinks.show( 5 );	
	// ghLinks.showLocs( 10 );
	console.log( "\n" );
    }
    return res.end();
}

async function switcher( authData, ghLinks, pd, sender, event, action, tag, res, delayCount ) {
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
    getNextJob( authData, pd, sender, res );	
}



// Notifications from GH webhooks
router.post('/:location?', async function (req, res) {

    // invisible, mostly
    if( req.body.hasOwnProperty( "Endpoint" ) && req.body.Endpoint == "Testing" ) { return testing.handler( ghLinks, ceJobs, req.body, res ); }
    
    console.log( "" );
    let action   = req.body['action'];
    let event    = req.headers['x-github-event'];

    if( event == "issues" )  { event = "issue"; }

    let sender  = req.body['sender']['login'];
    if( sender == config.CE_BOT) {
	console.log( "Notification for", event, action, "Bot-sent, skipping." );
	return res.end();
    }
    if( action == "synchronize" ) {
	console.log( "Notification for Pull Request.  CodeEquity does not require these.  Skipping." );
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

    let newStamp = req.body[event].updated_at;
    if( typeof newStamp === 'undefined' ) { newStamp = "1970-01-01T12:00:00Z"; }      // label create doesn't have this
    console.log( "Notification:", event, action, tag, jobId, "for", owner, repo, newStamp );

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

    await switcher( authData, ghLinks, pd, sender, event, action, tag, res, 0 );
    
    // avoid socket hangup error, response undefined
    return res.end();
});


module.exports = router;
