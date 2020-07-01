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
    console.log( "Working with", event, action, "for", owner, repo );

    if( event == "issues" ) {
	retVal = issues.handler( action, repo, owner, req.body, res );
    }
    else if( event == "project_card" ) {
	retVal = cards.handler(  action, repo, owner, req.body, res );
    }
    else {
	retVal = res.json({
	    status: 400,
	});
    }

    return retVal;
});


module.exports = router;
