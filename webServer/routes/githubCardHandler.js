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

// XXX Looking slow - should probably get much of this up front, once, and cache it

async function handler( action, repo, owner, reqBody, res ) {

    // gh.zoink();

    let creator = reqBody['project_card']['creator']['login'];

    console.log( "Got Card" );
    console.log( "creator", creator );
    console.log( "note", reqBody['project_card']['note'] );
    
    let columnID = reqBody['project_card']['column_id'];
    var installClient = await auth.getInstallationClient( owner, repo );
    
    let cardNote = "";
    if( creator == CE_BOT ) {
	console.log( "Bot card, skipping." );
    }
    else if( action == 'deleted' ) {
	console.log( "Card deleted, no action" );
    }
    else if( reqBody['project_card']['content_url'] != null ) {
	console.log( "card points to an issue" );
	// XXX mishmash
	/*
	await( installClient.issues.get( { owner: owner, repo: repo, issue_number: 3 } ))
	    .then( issue => {
		cardNote = issue['title'];
	    });
	console.log( "Title: ", cardNote );
	*/
    }
    else {
	cardNote = reqBody['project_card']['note'].split('\n');
	console.log( "Title: ", cardNote[0] );
	// create issue
	let issueID = 0;
	await( installClient.issues.create( { owner: owner, repo: repo, title: cardNote[0], labels: ['1k PEQ'] } ))
	    .then( issue => {
		issueID = issue['data']['id'];
	    });
	
	// add back as card by setting project/col
	// XXX NOTE!  Create finishes, but several notifications are pending( issue:open, issue:labelled ) .. no prob
	console.log( "Adding ", columnID, issueID );
	await( installClient.projects.createCard( { column_id: columnID, content_id: issueID, content_type: 'Issue' } ));
	// remove orig card
	// XXX check if above succeeded first
	let origCardID = reqBody['project_card']['id'];
	await( installClient.projects.deleteCard( { card_id: origCardID } ));	    
	console.log( "DONE YYY" );
    }

    /*
    console.log( "GET PROJECT ID" );
    await installClient.paginate( installClient.projects.listForRepo, { owner: owner, repo: repo } )
	.then( project => {
	    // console.log( project );
	});
    
    console.log( "GET COL ID" );
    await installClient.paginate( installClient.projects.listColumns, { project_id: PROJ_ID } )
	.then( column => {
	    console.log( column );
	});
    
    console.log( "GET ISSUES" );
    let foundIssue = false;
    await installClient.paginate( installClient.issues.listForRepo, { owner: owner, repo: repo } )
	.then( issue => {
	    if( cardNote[0] == issue['title'] ) {
		console.log( "Issue already exists, will not convert" );
		console.log( issue );
		foundIssue = true;
	    }
	});
    
    if( !foundIssue ) {
	console.log( "Issue not found.  Converting." );
	// XXX too limited
	if( cardNote[1].includes( "<PEQ:" ) ) {
	    console.log( "Found PEQ value for label", cardNote[1] );
	}
    }
    */
    
    return res.json({
	status: 200,
    });
}

exports.handler = handler;
