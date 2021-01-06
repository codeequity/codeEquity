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
var testing   = require('./githubTestHandler');

// CE Job Queue  {fullName:  {sender1: fifoQ1, sender2: fifoQ2 }}
var ceJobs = {};
var notificationCount = 0;

// GH Linkage table
var ghLinks = new links.Linkage();

// XXX temp, or add date
var lastEvent = {"h": 0, "m": 0, "s": 0 };


var router = express.Router();


// INIT  This happens during server startup.
console.log( "*** GH Link Data init ***" );
initGH();

// XXX sys-wide init like this needs sys-wide ceServer auth for all GH apps
//     worst case, init on first call
async function initGH() {
    let installClient = [-1, "CE SERVER INIT", -1, -1, -1];

    // XXX Generally, will not be testOwner, testRepo
    await initAuth( installClient, config.TEST_OWNER, config.TEST_REPO  );
    ghLinks.init( installClient, config.TEST_OWNER );
}

// XXX can reduce amount of work - auths are re-acquired willy-nilly here.
async function initAuth( installClient, owner, repo ) {
    assert( installClient.length == 5 );
    installClient[0] = await auth.getInstallationClient( owner, repo, config.CE_USER );
    installClient[2] = await utils.getAPIPath() + "/find";
    installClient[3] = await awsAuth.getCogIDToken();
}


// Notifications from GH webhooks
router.post('/:location?', async function (req, res) {

    // invisible, mostly
    if( req.body.hasOwnProperty( "Endpoint" ) && req.body.Endpoint == "Testing" ) { return testing.handler( ghLinks, req.body, res ); }
    
    console.log( "" );
    let event    = req.headers['x-github-event'];
    let action   = req.body['action'];
    
    let sender  = req.body['sender']['login'];
    if( sender == config.CE_BOT) {
	console.log( "Notification for", event, action, "Bot-sent, skipping." );
	return res.end();
    }

    let fullName = req.body['repository']['full_name'];
    let repo     = req.body['repository']['name'];
    let owner    = req.body['repository']['owner']['login'];
    let retVal   = "";

    let tag = "";
    let source = "<";
    if( event == "issues" )    {
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
    source += action+" "+tag+"> ";
    let jobId = utils.randAlpha(10);

    let newStamp = "";
    if     ( req.body.hasOwnProperty( 'project_card' ) ) { newStamp = req.body.project_card.updated_at; }
    else if( req.body.hasOwnProperty( 'issue' ))         { newStamp = req.body.issue.updated_at; }
    else if( req.body.hasOwnProperty( 'project' ))       { newStamp = req.body.project.updated_at; }
    else { console.log( "XXX New event, update_at exists?", event, req.body ); }
    
    console.log( "Notification:", event, action, tag, jobId, "for", owner, repo, newStamp );

    // leave early for events not handled here
    if( event == "project" ) { return res.end(); }

    notificationCount++;
    if( notificationCount % 20 == 0 ) { ghLinks.show(); }

    // Look for out of order GH notifications.  Note the timestamp is only to within 1 second...
    let tdiff = utils.getTimeDiff( lastEvent, newStamp );  
    if( tdiff < 0 ) {
	console.log( "\n\n\n!!!!!!!!!!!!!" );
	console.log( "Out of order notification, diff", tdiff );
	console.log( "!!!!!!!!!!!!!\n\n\n" );
    }
    
    // installClient is pent [installationAccessToken, creationSource, apiPath, cognitoIdToken, jobId]
    // this first jobId is set by getNext to reflect the proposed next job.
    // let installClient = [-1, source, apiPath, idToken, jobId]; 
    let installClient = [-1, source, -1, -1, jobId];
    await initAuth( installClient, owner, repo );

    // Only 1 externally driven job (i.e. triggered from non-CE GH notification) active at any time, per repo/sender.
    // Continue with this job if it's the earliest on the queue.  Otherwise, add to queue and wait for internal activiation from getNext
    let jobData = utils.checkQueue( ceJobs, installClient, event, sender, req.body, tag );
    assert( jobData != -1 );
    if( installClient[4] != jobData.QueueId ) {
	console.log( installClient[1], "Sender busy with job#", jobData.QueueId );
	return res.end();
    }
    console.log( installClient[1], "job Q clean, start-er-up" );
    
    let pd          = new peqData.PeqData();
    pd.GHOwner      = owner;
    pd.GHRepo       = repo;
    pd.reqBody      = req.body;
    pd.GHFullName   = req.body['repository']['full_name'];

    if( event == "issues" ) {
	retVal = await issues.handler( installClient, ghLinks, pd, action, tag );
	getNextJob( installClient, pd, sender );	
    }
    else if( event == "project_card" ) {
	retVal = await cards.handler( installClient, ghLinks, pd, action, tag );
	getNextJob( installClient, pd, sender );	
    }
    else {
	retVal = res.json({
	    status: 400,
	});
    }

    // avoid socket hangup error, response undefined
    // return retVal;
    return res.end();
});


// Without this call, incoming non-bot jobs that were delayed would not get executed.
// Only this call will remove from the queue before getting next.  
async function getNextJob( installClient, pdOld, sender ) {
    let jobData = await utils.getFromQueue( ceJobs, installClient, pdOld.GHFullName, sender );
    if( jobData != -1 ) {

	// New job, new pd
	let pd          = new peqData.PeqData();
	pd.GHOwner      = jobData.GHOwner;
	pd.GHRepo       = jobData.GHRepo;
	pd.reqBody      = jobData.ReqBody;
	pd.GHFullName   = jobData.ReqBody['repository']['full_name'];
	
	// Need a new installClient, else source for non-awaited actions is overwritten
	let ic = [installClient[0], "", installClient[2], installClient[3], jobData.QueueId ];
	ic[1] = "<"+jobData.Handler+": "+jobData.Action+" "+jobData.Tag+"> ";
	console.log( "\n\n\n", installClient[1], "Got next job:", ic[1] );

	if     ( jobData.Handler == "issues" )       { await issues.handler( ic, ghLinks, pd, jobData.Action, jobData.Tag ); }
	else if( jobData.Handler == "project_card" ) { await cards.handler( ic, ghLinks, pd, jobData.Action, jobData.Tag );  }
	else                                         { assert( false ); }

	getNextJob( ic, pd, sender );
    }
    else {
	console.log( installClient[1], "jobs done" );
    }
    return;
}


module.exports = router;
