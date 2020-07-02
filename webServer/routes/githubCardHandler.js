var testAuth = require('../testAuth');
var utils   = require('../utils');
var config  = require('../config');
var ghUtils = require('../ghUtils');
const auth = require( "../auth");

var gh = ghUtils.githubUtils;

/*
https://developer.github.com/webhooks/event-payloads/#issues
https://octokit.github.io/rest.js/v18#projects-delete-card
https://developer.github.com/v3/issues/#create-an-issue
*/

const PROJ_ID = 4788718; // code equity web server front end

// XXX BEWARE!  mulitiple notifications per user-level action are common.  Labeled.  Opened.  Assigned.
//              Don't double-process, watch for bot

// XXX Looking slow - should probably get much of this up front, once, and cache it

async function handler( action, repo, owner, reqBody, res ) {

    // gh.zoink();

    // Actions: created, deleted, moved, edited, converted
    // XXX handle when issue is closed, move related card

    let creator = reqBody['project_card']['creator']['login'];

    console.log( "Got Card" );
    console.log( "creator", creator );
    console.log( "note", reqBody['project_card']['note'] );
    
    let columnID = reqBody['project_card']['column_id'];
    let installClient = await auth.getInstallationClient( owner, repo );
    let cardContent = [];

    if( creator == config.CE_BOT ) {
	console.log( "Bot card, skipping." );
    }
    else if( action == 'deleted' ) {
	console.log( "Card deleted, no action" );
    }
    else if( action == "created" && reqBody['project_card']['content_url'] != null ) {
	// case: collab adds peq-issue to project
	console.log( "new card from issue" );
	await( installClient.issues.get( { owner: owner, repo: repo, issue_number: 3 } ))
	    .then( issue => {
		cardContent.push( issue['title'] );
		
		// XXX will save entire issue, plus pull out specific metadata (title, name, date, peq)
		await( utils.recordPEQ( cardContent[0], gh.getPEQLabel( issue['labels'] ) ));
	    });
	
    }
    else {
	// case: card was added in project.  If PEQ, make it an issue, record it, and convert card.
	cardContent = reqBody['project_card']['note'].split('\n');
	console.log( "New card in projects:", cardContent[0] );

	let peqValue = gh.parsePEQ( cardContent );

	if( peqValue > 0 ) {
	    // XXX check label exists, if not, create it
	    // create issue if doesn't already exist
	    let issueID = 0;
	    await( installClient.issues.create( { owner: owner, repo: repo, title: cardContent[0], labels: ['1k PEQ'] } ))
		.then( issue => {
		    issueID = issue['data']['id'];
		});
	    
	    // add back as card by setting project/col
	    // NOTE!  Create finishes, but several notifications are pending( issue:open, issue:labelled ) .. no prob
	    console.log( "Adding ", columnID, issueID );
	    await( installClient.projects.createCard( { column_id: columnID, content_id: issueID, content_type: 'Issue' } ));
	    // remove orig card
	    // XXX check if above succeeded first
	    let origCardID = reqBody['project_card']['id'];
	    await( installClient.projects.deleteCard( { card_id: origCardID } ));	    
	}
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
	    if( cardContent[0] == issue['title'] ) {
		console.log( "Issue already exists, will not convert" );
		console.log( issue );
		foundIssue = true;
	    }
	});
    
    if( !foundIssue ) {
	console.log( "Issue not found.  Converting." );
	// XXX too limited
	if( cardContent[1].includes( "<PEQ:" ) ) {
	    console.log( "Found PEQ value for label", cardContent[1] );
	}
    }
    */
    
    return res.json({
	status: 200,
    });
}

exports.handler = handler;
