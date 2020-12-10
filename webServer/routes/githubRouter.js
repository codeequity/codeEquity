var express = require('express');
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

    if( event == "issues" ) {
	let tag = (req.body['issue']['title']).replace(/[\x00-\x1F\x7F-\x9F]/g, "");  	
	console.log( "Notification:", event, action, tag, "for", owner, repo );
	retVal = issues.handler( action, repo, owner, req.body, res, tag );
    }
    else if( event == "project_card" ) {

	let tag = "";
	
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
	
	console.log( "Notification:", event, action, tag, "for", owner, repo );
	retVal = cards.handler(  action, repo, owner, req.body, res, tag );
    }
    else {
	retVal = res.json({
	    status: 400,
	});
    }

    return retVal;
});


module.exports = router;
