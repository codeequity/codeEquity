var express = require('express');

const awsAuth = require( '../awsAuth' );
const auth = require( "../auth");
var utils = require('../utils');
var config  = require('../config');

var issues  = require('./githubIssueHandler');
var cards   = require('./githubCardHandler');


var router = express.Router();

// Notifications from GH webhooks
router.post('/:location?', async function (req, res) {

    console.log( "" );
    let event  = req.headers['x-github-event'];
    let action = req.body['action'];
    let repo   = req.body['repository']['name'];
    let owner  = req.body['repository']['owner']['login'];
    let retVal = "";


    let tag = "";
    let source = "<";
    if( event == "issues" )    {
	tag = (req.body['issue']['title']).replace(/[\x00-\x1F\x7F-\x9F]/g, "");  	
	source += "issue:";
    }
    else if( event == "card" ) {
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
    console.log( "Notification:", event, action, tag, "for", owner, repo );

    let sender  = req.body['sender']['login'];
    if( sender == config.CE_BOT) {
	console.log( "Bot-sent, skipping." );
	return;
    }

    // installClient is quad [installationAccessToken, creationSource, apiPath, cognitoIdToken]
    let apiPath = utils.getAPIPath() + "/find";
    let idToken = await awsAuth.getCogIDToken();
    let installClient = [-1, source, apiPath, idToken];
    installClient[0] = await auth.getInstallationClient( owner, repo, config.CE_USER );
    
    if( event == "issues" ) {
	retVal = issues.handler( installClient, action, repo, owner, req.body, res, tag, false );
    }
    else if( event == "project_card" ) {
	retVal = cards.handler( installClient, action, repo, owner, req.body, res, tag, false );
    }
    else {
	retVal = res.json({
	    status: 400,
	});
    }

    return retVal;
});


module.exports = router;
