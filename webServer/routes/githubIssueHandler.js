var testAuth = require('../testAuth');
var utils = require('../utils');
var ghUtils = require('../ghUtils');
const auth = require( "../auth");

var gh = ghUtils.githubUtils;

/*
https://developer.github.com/webhooks/event-payloads/#issues
https://octokit.github.io/rest.js/v18#projects-delete-card
https://developer.github.com/v3/issues/#create-an-issue
*/

const CE_BOT = 'codeequity[bot]';
const PROJ_ID = 4788718; // code equity web server front end

// XXX BEWARE!  mulitiple notifications per user-level action are common.  Labeled.  Opened.  Assigned.
//              Don't double-process, watch for bot


async function handler( action, repo, owner, reqBody, res ) {

    // gh.zoink();

    let userName = reqBody['issue']['user']['login'];

    if( action == "closed" ) {
	await testAuth.runTests();
    }
    else if( userName == CE_BOT ) {
	console.log( "Bot issue.. taking no action" );
    }
    else {
	/*
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
	*/
	
    }
    
    return res.json({
	status: 200,
    });
}

exports.handler = handler;
