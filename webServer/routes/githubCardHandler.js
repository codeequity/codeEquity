var testAuth = require('../testAuth');
var utils   = require('../utils');
var config  = require('../config');
var ghUtils = require('../ghUtils');
var assert = require('assert');
const auth = require( "../auth");

var gh = ghUtils.githubUtils;

/*
https://developer.github.com/webhooks/event-payloads/#issues
https://octokit.github.io/rest.js/v18#projects-delete-card
https://developer.github.com/v3/issues/#create-an-issue
*/

// XXX Looking slow - lots of waiting on GH.. not much work.  Hard to cache given access model


// XXX push through ceFlutter
// The implied action of an underlying move out of a column depends on the originating PEQType.
// PeqType:GRANT  Illegal       There are no 'takebacks' when it comes to provisional equity grants
//                              This type only exists for cards/issues in the 'Accrued' column... can not move out 
// PeqType:ALLOC  Notice only.  Master proj is not consistent with config.PROJ_COLS.
//                              !Master projects do not recognize <allocation>
// PeqType:PLAN  most common
async function recordMove( installClient, reqBody, fullName, oldCol, newCol, ghCard ) { 

    // XXX inform all contributors of this failure
    assert( oldCol != config.PROJ_ACCR );  // no take-backs

    // I want peqId for notice PActions, with or without issueId
    let peq = await( gh.validatePEQ( installClient, fullName, ghCard['GHIssueId'], ghCard['GHCardTitle'], ghCard['GHProjectId'] ));

    assert( peq['PeqType'] != "grant" );

    let verb   = "";
    let action = "";
    if( peq['PeqType'] == "allocation" ||
	( oldCol <= config.PROJ_PROG && newCol <= config.PROJ_PROG ) ) {
	// moving between plan, and in-progress has no impact on peq summary
	verb = "confirm";
	action = "notice";
    }
    else if( oldCol <= config.PROJ_PROG && newCol == config.PROJ_PEND ) {
	// task complete, waiting for peq approval
	verb = "propose";
	action = "accrue";
    }
    else if( oldCol == config.PROJ_PEND && newCol <= config.PROJ_PROG) {
	// proposed peq has been rejected
	verb = "reject";
	action = "accrue";
    }
    else if( oldCol <= config.PROJ_PEND && newCol == config.PROJ_ACCR ) {
	// approved!   PEQ will be updated to "type:accrue" when processed.
	verb = "confirm";
	action = "accrue";
    }
    else {
	console.log( installClient[1], "Verb, action combo not understood", verb, action );
	assert( false );
    }

    let subject = [ peq['PEQId'] ];
    await( utils.recordPEQAction(
	installClient[1],
	config.EMPTY,     // CE UID
	reqBody['sender']['login'],   // gh actor
	fullName,         // gh repo
	verb, 
	action, 
	subject,          // subject
	"",               // note
	utils.getToday(), // entryDate
	reqBody           // raw
    ));
}

async function processNewPEQ( installClient, repo, owner, reqBody, issueCardContent, creator, issueNum, issueId ) {

    // normal for card -> issue.  odd but legal for issue -> card
    let allocation = gh.getAllocated( issueCardContent );

    // XXX add label can occur before submit issue, after submit issue, or after add to card.  test all
    // If this new item is an issue becoming a card, any label will be human readable - different parse requirement
    let peqValue = 0;
    if( issueNum == -1 ) { peqValue = gh.parsePEQ( issueCardContent, allocation ); }
    else                 { peqValue = gh.parseLabelDescr( issueCardContent ); }   
    
    // should not be able to create a 'pending' or 'grant' card.  check is below
    let peqType = allocation ? "allocation" : "plan";

    console.log( "processing", peqValue.toString(), peqType );
    
    if( peqValue > 0 ) {
	
	let peqHumanLabelName = peqValue.toString() + " PEQ";
	let peqLabel = await gh.findOrCreateLabel( installClient, owner, repo, peqHumanLabelName, peqValue );
	let colId    = reqBody['project_card']['column_id'];
	let fullName = reqBody['repository']['full_name'];
	let projId   = reqBody['project_card']['project_url'].split('/').pop(); 
	let colName  = await gh.getColumnName( installClient, colId );
	let projName = await gh.getProjectName( installClient, projId );
	let projSub  = await gh.getProjectSubs( installClient, fullName, projName, colName );
	let origCardId = reqBody['project_card']['id'];

	// issue->card:  issueId is available, but linkage has not yet been added
	if( issueNum > -1 ) {
	    await( utils.addIssueCard( fullName, issueId, issueNum, projId, projName, colId, colName, origCardId, issueCardContent[0] ));
	}

	// OR, allocation, which still wants linkage for other lookups like projSub.. need to clean up title in this case
	if( peqType == "allocation" && projName == config.MAIN_PROJ ) {
	    let cardTitle = issueCardContent[0];
	    // some (not all) are full projects themselves.  Will have "Sub:" in front
	    if( cardTitle.length > 6 && cardTitle.substring( 0, 5 ) == "Sub: " ) {      // XXX config
		cardTitle = cardTitle.substring( 5 );
	    }
	    await( utils.addIssueCard( fullName, issueId, issueNum, projId, projName, colId, colName, origCardId, cardTitle ));
	}
    
	assert( colName != config.PROJ_COLS[ config.PROJ_PEND ] );
	assert( colName != config.PROJ_COLS[ config.PROJ_ACCR ] );
	// card -> issue
	if( peqType == "plan" && issueNum == -1 ) {
	    // create new issue
	    let issueData = await gh.createIssue( installClient, owner, repo, issueCardContent[0], [peqHumanLabelName] );
	    assert( issueData.length == 2 );
	    issueId  = issueData[0];
	    issueNum = issueData[1];
	    assert.notEqual( issueId, -1, "Unable to create issue linked to this card." );
	    
	    // create issue-linked project_card, requires id not num
	    let newCardId = await gh.createIssueCard( installClient, colId, issueId );
	    assert.notEqual( newCardId, -1, "Unable to create new issue-linked card." );	    
	    
	    // remove orig card
	    await( installClient[0].projects.deleteCard( { card_id: origCardId } ));	    
	    
	    // Add card issue linkage
	    await( utils.addIssueCard( fullName, issueId, issueNum, projId, projName, colId, colName, newCardId, issueCardContent[0] ));
	}

	// Note.. unassigned is normal for plan, abnormal for inProgress, not allowed for accrued.
	// there are no assignees for card-created issues.. they are added, or created directly from issues.
	let assignees = await gh.getAssignees( installClient, owner, repo, issueNum );
	
	let newPEQId = await( utils.recordPEQ(
	    installClient[1],
	    peqValue,                                  // amount
	    peqType,                                   // type of peq
	    assignees,                                 // list of ghUserLogins assigned
	    fullName,                                  // gh repo
	    projSub,                                   // gh project subs
	    projId,                                    // gh project id
	    issueId.toString(),                        // gh issue id
	    issueCardContent[0]                        // gh issue title
	));
	assert( newPEQId != -1 );
	
	let subject = [ newPEQId ];
	await( utils.recordPEQAction(
	    installClient[1],
	    config.EMPTY,     // CE UID
	    creator,          // gh user name
	    fullName,         // gh repo
	    "confirm",        // verb
	    "add",            // action
	    subject,          // subject
	    "",               // note
	    utils.getToday(), // entryDate
	    reqBody           // raw
	));
    }
}

// Card operations: no PEQ label, not related to CodeEquity.  No action.
// Card operations: with PEQ label:  Record.  If relevant, create related issue and label. 
// Can generate several notifications in one operation - so if creator is <bot>, ignore as pending.

async function handler( action, repo, owner, reqBody, res ) {

    // Actions: created, deleted, moved, edited, converted
    
    let creator = reqBody['project_card']['creator']['login'];
    let sender  = reqBody['sender']['login'];
    console.log( "Got Card.  Creator:", creator, "Sender:", sender );
    // console.log( "note", reqBody['project_card']['note'] );
    
    if( sender == config.CE_BOT) {
	console.log( "Bot card, skipping." );
	return;
    }

    // installClient is pair [installationAccessToken, creationSource]
    let token = await auth.getInstallationClient( owner, repo );
    let source = "<CAR:"+action+"> ";
    let installClient = [token, source];

    await gh.checkRateLimit(installClient);

    if( action == "created" && reqBody['project_card']['content_url'] != null ) {

	// Coming from issueHandler - can't attach to summary object until we see it here, in project cards.
	console.log( "new card created from issue" );

	// e.g. content_url: 'https://api.github.com/repos/codeequity/codeEquity/issues/57' },
	let issueURL = reqBody['project_card']['content_url'].split('/');
	assert( issueURL.length > 0 );
	let issueNum = parseInt( issueURL[issueURL.length - 1] );
	let issue = await gh.getIssue( installClient, owner, repo, issueNum );   // [ id, [content] ]

	console.log( "Found issue:", issueNum.toString(), issue[1] );
	await processNewPEQ( installClient, repo, owner, reqBody, issue[1], creator, issueNum, issue[0] ); 
    }
    else if( action == "created" ) {
	console.log( "New card created in projects" );
	let cardContent = reqBody['project_card']['note'].split('\n');

	if( await gh.checkIssueExists( installClient, owner, repo, cardContent[0] ) ) {
	    console.log( "Issue with same title already exists.  Do nothing." );
	    return;
	}

	await processNewPEQ( installClient, repo, owner, reqBody, cardContent, creator, -1, -1 );
    }
    else if( action == "converted" ) {
	console.log( "Non-PEQ card converted to issue.  No action." );
    }
    else if( action == "moved" ) {
	// within gh project, move card from 1 col to another.  
	console.log( installClient[1], "Card", action, "Sender:", sender )

	if( reqBody['changes'] == null ) {
	    console.log( installClient[1], "Move within columns are ignored." );
	    return;
	}

	let cardId    = reqBody['project_card']['id'];
	let oldColId  = reqBody['changes']['column_id']['from'];
	let newColId  = reqBody['project_card']['column_id'];
	let newProjId = reqBody['project_card']['project_url'].split('/').pop();
	let fullName  = reqBody['repository']['full_name'];
	
	// First, verify current status
	// XXX This chunk could be optimized out, down the road
	let card = await( utils.getFromCardId( installClient[1], fullName, cardId ));  
	if( card == -1 ) {
	    console.log( "Moved card not processed, could not find the card id", cardId );
	    return;
	}
	let issueId = card['GHIssueId'];
	let oldNameIndex = config.PROJ_COLS.indexOf( card['GHColumnName'] );
	assert( oldNameIndex != config.PROJ_ACCR );                   // can't move out of accrue.
	assert( cardId       == card['GHCardId'] );
	assert( oldColId     == card['GHColumnId'] );
	assert( issueId == -1 || oldNameIndex != -1 );                // likely allocation, or known project layout
	assert( newProjId     == card['GHProjectId'] );               // not yet supporting moves between projects

	// reflect card move in dynamo, if move is legal
	let newColName = await gh.getColumnName( installClient, newColId );
	let newNameIndex = config.PROJ_COLS.indexOf( newColName );
	assert( issueId == -1 || newNameIndex != -1 );
	if( newNameIndex > config.PROJ_PLAN ) { 
	    let assignees = await gh.getAssignees( installClient, owner, repo, card['GHIssueNum'] );
	    if( assignees.length == 0  ) {
		console.log( "Update card failed - no assignees" );   // can't propose grant without a grantee
		console.log( "XXX move card back by hand with ceServer off" );
		return;
	    }
	}
	let success = await( utils.updateCardFromCardId( installClient[1], fullName, cardId, newColId, newColName )) 
	    .catch( e => { console.log( installClient[1], "update card failed.", e ); });
	
	// handle issue
	let newIssueState = "";
	if(      oldNameIndex <= config.PROJ_PROG && newNameIndex >= config.PROJ_PEND ) {  newIssueState = "closed"; }
	else if( oldNameIndex >= config.PROJ_PEND && newNameIndex <= config.PROJ_PROG ) {  newIssueState = "open";   }
	
	if( issueId > -1 && newIssueState != "" ) {
	    success = success && await gh.updateIssue( installClient, owner, repo, card['GHIssueNum'], newIssueState );
	}

	// recordPeq
	recordMove( installClient, reqBody, fullName, oldNameIndex, newNameIndex, card );
    }
    else if( action == "deleted" || action == "edited" ) {
	// Note, if action source is issue-delete, linked card is deleted first.  Watch recording.
	console.log( "Card", action, "Recorded." )
	await( utils.recordPEQTodo( "XXX TBD. Content may be from issue, or card." , -1 ));	
    }

    return res.json({
	status: 200,
    });
}

exports.handler = handler;
