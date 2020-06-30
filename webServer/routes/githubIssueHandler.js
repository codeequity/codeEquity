var express = require('express');
var testAuth = require('../testAuth');
var utils = require('../utils');
var ghUtils = require('../ghUtils');
//var ghUtils = require('../ceFlutter/files/ghUtils');
const auth = require( "../auth");

var gh = ghUtils.githubUtils;
var router = express.Router();

const OWNER   = "codeEquity";
const REPO    = "testbed";
const PROJ_ID = 4615696;     // GooGoo

// XXX github sends 1 post per label, assignee, and new open issue.  So... a new open issue can be seen 1 to n times
//     will need to save and compare entire request for reliable differences
// XXX see https://developer.github.com/webhooks/event-payloads/#issues

// push to me from GH
router.post('/:location?', async function (req, res) {


    gh.zoink();

    // move card to column id, pos
    // Issue:   id, title, repo:name, repo:id
    // Card:    id, column_url, project_url

    //console.log(req);
    let event  = req.headers['x-github-event'];
    let action = req.body['action'];
    let ownerId = req.body['repository']['owner']['id'];
    let repoId  = req.body['repository']['id'];
    console.log( "Working with", event, action );
    console.log( "Repo:", repoId, "Owner:", ownerId );
    if( event == "issues" ) {
	if( action == "closed" ) {
	    await testAuth.runTests();
	}
	else {
	    console.log( "ISSUE" );
	    console.log( "req id", req.headers['x-request-id'] );
	    console.log( "req time", req.headers['timestamp'] );

	    console.log( "title", req.body['issue']['title'] );
	    console.log( "id", req.body['issue']['id'] );
	    console.log( "labels", req.body['issue']['labels'] );
	    console.log( "assignee", req.body['issue']['assignee'] );
	    console.log( "assignees", req.body['issue']['assignees'] );
	    console.log( "REPO" );
	    console.log( "name", req.body['repository']['name'] );
	    console.log( "full name", req.body['repository']['full_name'] );
	    console.log( "id", req.body['repository']['id'] );
	    console.log( "SENDER" );
	    console.log( "login", req.body['sender']['login']);
	    console.log( "id", req.body['sender']['id']);
	    console.log( "INSTALLATION" );
	    console.log( "id", req.body['installation']['id']);

	}
	return res.json({
	    status: 200,
	});
    }
    else if( event == "project_card" ) {
	console.log( "Got Card" );
	console.log( "note", req.body['project_card']['note'] );
	console.log( "CARD_ID", req.body['project_card']['id'] );
	console.log( "url", req.body['project_card']['url'] );
	console.log( "col  url", req.body['project_card']['column_url'] );
	console.log( "proj url", req.body['project_card']['project_url'] );
	gh.zoink();
	// need owner, repo
	// gh.getColumns( ownerId, repoId );

	var installClient = await auth.getInstallationClient( OWNER, REPO );

	console.log( "GET PROJECT ID" );
	await installClient.paginate( installClient.projects.listForRepo, { owner: OWNER, repo: REPO } )
	    .then( project => {
		console.log( project );
	    });
	
	console.log( "GET COL ID" );
	await installClient.paginate( installClient.projects.listColumns, { project_id: PROJ_ID } )
	    .then( column => {
		console.log( column );
	    });
	
    }
    else {
	return res.json({
	    status: 400,
	});
    }
	
    
});


// get request, from app
router.get('/:location?', function (req, res, next) {
  res.json(getStubAppData(req.params.location));
});

function getStubAppData(location) {
  var currentSeconds = new Date().getSeconds();
  return {
    weather: {
      location: location || 'londonon',
      temperature: `${currentSeconds / 2}\u2103`,
      weatherDescription: currentSeconds % 2 == 0 ? 'partly snowy' : 'haily'
    }
  };
}

module.exports = router;
