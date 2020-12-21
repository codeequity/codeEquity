var assert = require('assert');
var utils = require('../utils');
var config  = require('../config');
var ghUtils = require('../ghUtils');
var gh = ghUtils.githubUtils;

const testData = require( './testData' );
const tu = require('./testUtils');

const ISS_FLOW = "Snow melt";
const ASSIGNEE1 = "rmusick2000";
const ASSIGNEE2 = "codeequity";


// Newborn issues are not carded, by definition.  Too clunky in projects if we were to do so.
async function checkNewbornIssue( installClient, td, issueData, testStatus ) {

    // CHECK github issues
    let meltIssue = await tu.findIssue( installClient, td, ISS_FLOW );
    testStatus = tu.checkEq( meltIssue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    
    // CHECK github location  .. should not be present.  This is overkill, but will do it once.
    let projs = await tu.getProjects( installClient, td );
    let cols = [];
    let cards = [];
    for( const proj of projs ) { cols = cols.concat( await tu.getColumns( installClient, proj.id )); }
    for( const col of cols )   { cards = cards.concat( await tu.getCards( installClient, col.id )); }
    let meltCards = cards.filter((card) => card.hasOwnProperty( 'content_url' ) && card.content_url.split('/').pop() == issueData[1].toString() );
    testStatus = tu.checkEq( meltCards.length, 0,    testStatus, "invalid card" );
    
    
    // CHECK dynamo linkage
    let links    = await utils.getLinks( installClient, td.GHFullName );
    let meltLink = links.filter((link) => link.GHIssueId == issueData[0] );
    testStatus = tu.checkEq( meltLink.length, 0, testStatus, "invalid linkage" );
    
    // CHECK dynamo Peq
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0] );
    testStatus = tu.checkEq( meltPeqs.length, 0, testStatus, "invalid peq" );
    
    return testStatus;
}


// Peq-labeling a newborn issue is valid.  In which case, we need a card, a linkage, a pec and a pact.
// But no card/column has been provided.  So, CE creates an unclaimed area for safe keeping.
async function checkUnclaimedIssue( installClient, td, issueData, testStatus ) {
    // CHECK github issues
    let meltIssue = await tu.findIssue( installClient, td, ISS_FLOW );
    testStatus = tu.checkEq( meltIssue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.labels.length, 1,                testStatus, "Issue label" );
    testStatus = tu.checkEq( meltIssue.labels[0].name, "1000 PEQ",      testStatus, "Issue label" );
    
    // CHECK github location
    let cards = await tu.getCards( installClient, td.unclaimCID );   // everything here has an issue
    let meltCard = ( cards.filter((card) => card.content_url.split('/').pop() == issueData[1].toString() ))[0];
    testStatus = tu.checkEq( meltCard.column_url.split('/').pop(), td.unclaimCID,     testStatus, "Card location" );
    
    // CHECK dynamo linkage
    let links    = await utils.getLinks( installClient, td.GHFullName );
    let meltLink = ( links.filter((link) => link.GHIssueId == issueData[0] ))[0];
    testStatus = tu.checkEq( meltLink.GHIssueNum, issueData[1].toString(), testStatus, "Linkage Issue num" );
    testStatus = tu.checkEq( meltLink.GHCardId, meltCard.id,               testStatus, "Linkage Card Id" );
    testStatus = tu.checkEq( meltLink.GHColumnName, config.UNCLAIMED,      testStatus, "Linkage Col name" );
    testStatus = tu.checkEq( meltLink.GHCardTitle, ISS_FLOW,               testStatus, "Linkage Card Title" );
    testStatus = tu.checkEq( meltLink.GHProjectName, config.UNCLAIMED,     testStatus, "Linkage Project Title" );
    testStatus = tu.checkEq( meltLink.GHColumnId, td.unclaimCID,           testStatus, "Linkage Col Id" );
    testStatus = tu.checkEq( meltLink.GHProjectId, td.unclaimPID,          testStatus, "Linkage project id" );

    // CHECK dynamo Peq
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });
    let meltPeq = ( peqs.filter((peq) => peq.GHIssueId == issueData[0] ))[0];
    testStatus = tu.checkEq( meltPeq.PeqType, "plan",                     testStatus, "peq type invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub.length, 2,              testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub[0], config.UNCLAIMED,   testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub[1], config.UNCLAIMED,   testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectId, td.unclaimPID,          testStatus, "peq unclaimed PID bad" );
    testStatus = tu.checkEq( meltPeq.GHIssueTitle, ISS_FLOW,              testStatus, "peq title is wrong" );
    testStatus = tu.checkEq( meltPeq.GHHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = tu.checkEq( meltPeq.CEHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = tu.checkEq( meltPeq.CEGrantorId, config.EMPTY,           testStatus, "peq grantor wrong" );
    testStatus = tu.checkEq( meltPeq.Amount, 1000,                        testStatus, "peq amount" );
    testStatus = tu.checkEq( meltPeq.Active, "true",                      testStatus, "peq" );

    // CHECK dynamo Pact
    let pacts = await utils.getPActs( installClient, {"GHRepo": td.GHFullName} );
    let meltPact = (pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId ))[0];
    let hasRaw = await tu.hasRaw( installClient, meltPact.PEQActionId );
    testStatus = tu.checkEq( hasRaw, true,                                   testStatus, "PAct Raw match" ); 
    testStatus = tu.checkEq( meltPact.Verb, "confirm",                       testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( meltPact.Action, "add",                         testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( meltPact.GHUserName, config.TESTER_BOT,         testStatus, "PAct user name" ); 
    testStatus = tu.checkEq( meltPact.Ingested, "false",                     testStatus, "PAct ingested" );
    testStatus = tu.checkEq( meltPact.Locked, "false",                       testStatus, "PAct locked" );

    return testStatus;
}


async function checkNewlySituatedIssue( installClient, td, issueData, meltCard, testStatus ) {
    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    
    // CHECK github issues
    let meltIssue = await tu.findIssue( installClient, td, ISS_FLOW );
    testStatus = tu.checkEq( meltIssue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.labels.length, 1,                testStatus, "Issue label" );
    testStatus = tu.checkEq( meltIssue.labels[0].name, "1000 PEQ",      testStatus, "Issue label" );

    // CHECK github location
    let cards = await tu.getCards( installClient, td.unclaimCID );   
    let tCard = cards.filter((card) => card.content_url.split('/').pop() == issueData[1].toString() );
    testStatus = tu.checkEq( tCard.length, 0,                           testStatus, "No unclaimed" );

    cards = await tu.getCards( installClient, td.dsPlanID );   
    let mCard = cards.filter((card) => card.content_url.split('/').pop() == issueData[1].toString() );
    testStatus = tu.checkEq( mCard.length, 1,                           testStatus, "Card claimed" );
    testStatus = tu.checkEq( mCard[0].id, meltCard.id,                  testStatus, "Card claimed" );

    // CHECK dynamo linkage
    let links    = await utils.getLinks( installClient, td.GHFullName );
    let meltLink = ( links.filter((link) => link.GHIssueId == issueData[0] ))[0];
    testStatus = tu.checkEq( meltLink.GHIssueNum, issueData[1].toString(), testStatus, "Linkage Issue num" );
    testStatus = tu.checkEq( meltLink.GHCardId, meltCard.id,               testStatus, "Linkage Card Id" );
    testStatus = tu.checkEq( meltLink.GHColumnName, plan,                  testStatus, "Linkage Col name" );
    testStatus = tu.checkEq( meltLink.GHCardTitle, ISS_FLOW,               testStatus, "Linkage Card Title" );
    testStatus = tu.checkEq( meltLink.GHProjectName, td.dataSecTitle,      testStatus, "Linkage Project Title" );
    testStatus = tu.checkEq( meltLink.GHColumnId, td.dsPlanID,             testStatus, "Linkage Col Id" );
    testStatus = tu.checkEq( meltLink.GHProjectId, td.dataSecPID,          testStatus, "Linkage project id" );

    // CHECK dynamo Peq
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0] );
    testStatus = tu.checkEq( meltPeqs.length, 2,                          testStatus, "Peq count" );
    let meltPeq = meltPeqs[0].Active == "true" ? meltPeqs[0] : meltPeqs[1];
    let deadPeq = meltPeqs[0].Active == "true" ? meltPeqs[1] : meltPeqs[0];
    for( const peq of meltPeqs ) {
	testStatus = tu.checkEq( peq.PeqType, "plan",                     testStatus, "peq type invalid" );
	testStatus = tu.checkEq( peq.GHProjectSub.length, 2,              testStatus, "peq project sub invalid" );
	testStatus = tu.checkEq( peq.GHIssueTitle, ISS_FLOW,              testStatus, "peq title is wrong" );
	testStatus = tu.checkEq( peq.GHHolderId.length, 0,                testStatus, "peq holders wrong" );
	testStatus = tu.checkEq( peq.CEHolderId.length, 0,                testStatus, "peq holders wrong" );
	testStatus = tu.checkEq( peq.CEGrantorId, config.EMPTY,           testStatus, "peq grantor wrong" );
	testStatus = tu.checkEq( peq.Amount, 1000,                        testStatus, "peq amount" );
    }
    testStatus = tu.checkEq( meltPeq.GHProjectSub[0], td.softContTitle,   testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub[1], td.dataSecTitle,    testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectId, td.dataSecPID,          testStatus, "peq unclaimed PID bad" );
    testStatus = tu.checkEq( meltPeq.Active, "true",                      testStatus, "peq" );

    testStatus = tu.checkEq( deadPeq.GHProjectSub[0], config.UNCLAIMED,   testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( deadPeq.GHProjectSub[1], config.UNCLAIMED,   testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( deadPeq.GHProjectId, td.unclaimPID,          testStatus, "peq unclaimed PID bad" );
    testStatus = tu.checkEq( deadPeq.Active, "false",                      testStatus, "peq" );


    // CHECK dynamo Pact
    let pacts = await utils.getPActs( installClient, {"GHRepo": td.GHFullName} );
    let mps = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    let dps = pacts.filter((pact) => pact.Subject[0] == deadPeq.PEQId );
    let meltPacts = mps.concat( dps );
    testStatus = tu.checkEq( meltPacts.length, 3,                            testStatus, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let addUncl  = meltPacts[0];
    let remUncl  = meltPacts[1];
    let meltPact = meltPacts[2];
    for( const pact of meltPacts ) {
	let hasRaw = await tu.hasRaw( installClient, pact.PEQActionId );
	testStatus = tu.checkEq( hasRaw, true,                                testStatus, "PAct Raw match" ); 
	testStatus = tu.checkEq( pact.Verb, "confirm",                    testStatus, "PAct Verb"); 
	testStatus = tu.checkEq( pact.GHUserName, config.TESTER_BOT,      testStatus, "PAct user name" ); 
	testStatus = tu.checkEq( pact.Ingested, "false",                  testStatus, "PAct ingested" );
	testStatus = tu.checkEq( pact.Locked, "false",                    testStatus, "PAct locked" );
    }
    testStatus = tu.checkEq( addUncl.Action, "add",                         testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( remUncl.Action, "delete",                      testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( meltPact.Action, "add",                        testStatus, "PAct Verb"); 

    return testStatus;
}

async function checkAssignees( installClient, td, issueData, testStatus ) {
    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    
    // CHECK github issues
    let meltIssue = await tu.findIssue( installClient, td, ISS_FLOW );
    testStatus = tu.checkEq( meltIssue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.assignees.length, 2,             testStatus, "Issue assignee count" );
    testStatus = tu.checkEq( meltIssue.assignees[0].login, ASSIGNEE1,    testStatus, "assignee1" );
    testStatus = tu.checkEq( meltIssue.assignees[1].login, ASSIGNEE2,    testStatus, "assignee2" );

    // CHECK Dynamo PEQ
    // Should be no change
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0] );
    testStatus = tu.checkEq( meltPeqs.length, 2,                          testStatus, "Peq count" );
    let meltPeq = meltPeqs[0].Active == "true" ? meltPeqs[0] : meltPeqs[1];
    testStatus = tu.checkEq( meltPeq.PeqType, "plan",                     testStatus, "peq type invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub.length, 2,              testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHIssueTitle, ISS_FLOW,              testStatus, "peq title is wrong" );
    testStatus = tu.checkEq( meltPeq.GHHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = tu.checkEq( meltPeq.CEHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = tu.checkEq( meltPeq.CEGrantorId, config.EMPTY,           testStatus, "peq grantor wrong" );
    testStatus = tu.checkEq( meltPeq.Amount, 1000,                        testStatus, "peq amount" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub[0], td.softContTitle,   testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub[1], td.dataSecTitle,    testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectId, td.dataSecPID,          testStatus, "peq unclaimed PID bad" );
    testStatus = tu.checkEq( meltPeq.Active, "true",                      testStatus, "peq" );

    
    // CHECK Dynamo PAct
    // Should show relevant change action
    let pacts = await utils.getPActs( installClient, {"GHRepo": td.GHFullName} );
    let meltPacts = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    testStatus = tu.checkEq( meltPacts.length, 3,                            testStatus, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let addMP  = meltPacts[0];   // add the issue
    let addA1  = meltPacts[1];   // add assignee 1
    let addA2  = meltPacts[2];   // add assignee 2
    for( const pact of [addMP, addA1, addA2] ) {
	let hasRaw = await tu.hasRaw( installClient, pact.PEQActionId );
	testStatus = tu.checkEq( hasRaw, true,                            testStatus, "PAct Raw match" ); 
	testStatus = tu.checkEq( pact.Verb, "confirm",                    testStatus, "PAct Verb"); 
	testStatus = tu.checkEq( pact.GHUserName, config.TESTER_BOT,      testStatus, "PAct user name" ); 
	testStatus = tu.checkEq( pact.Ingested, "false",                  testStatus, "PAct ingested" );
	testStatus = tu.checkEq( pact.Locked, "false",                    testStatus, "PAct locked" );
    }
    testStatus = tu.checkEq( addMP.Action, "add",                         testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( addA1.Action, "change",                      testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( addA2.Action, "change",                      testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( addA1.Subject[1], ASSIGNEE1,                 testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( addA2.Subject[1], ASSIGNEE2,                 testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( addA1.Note, "add assignee",                  testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( addA2.Note, "add assignee",                  testStatus, "PAct Verb"); 
    
    return testStatus;
}

async function checkMove( installClient, td, colId, meltCard, testStatus ) {

    // CHECK github issues
    // id, num in linkage
    let meltIssue = await tu.findIssue( installClient, td, ISS_FLOW );
    testStatus = tu.checkEq( meltIssue.assignees.length, 2,                              testStatus, "Issue assignee count" );
    if     ( colId == td.dsPendID ) { testStatus = tu.checkEq( meltIssue.state, "closed",     testStatus, "Issue status" );  }
    else if( colId == td.dsAccrID ) { testStatus = tu.checkEq( meltIssue.state, "closed",     testStatus, "Issue status" );  }
    else                            { testStatus = tu.checkEq( meltIssue.state, "open",       testStatus, "Issue status" );  }

    // CHECK github location
    let cards = await tu.getCards( installClient, colId );   
    let mCard = cards.filter((card) => card.content_url.split('/').pop() == meltIssue.number );
    testStatus = tu.checkGE( mCard.length, 1,                           testStatus, "Card location" );
    let foundCard = false;
    for( const c of mCard ) {
	if( c.id == meltCard.id ) { foundCard = true; }
    }
    testStatus = tu.checkEq( foundCard, true,                           testStatus, "Card location" );   

    
    // CHECK Dynamo PEQ
    // Should be no change
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == meltIssue.id );
    testStatus = tu.checkEq( meltPeqs.length, 2,                          testStatus, "Peq count" );
    let meltPeq = meltPeqs[0].Active == "true" ? meltPeqs[0] : meltPeqs[1];
    testStatus = tu.checkEq( meltPeq.PeqType, "plan",                     testStatus, "peq type invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub.length, 2,              testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHIssueTitle, ISS_FLOW,              testStatus, "peq title is wrong" );
    testStatus = tu.checkEq( meltPeq.GHHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = tu.checkEq( meltPeq.CEHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = tu.checkEq( meltPeq.CEGrantorId, config.EMPTY,           testStatus, "peq grantor wrong" );
    testStatus = tu.checkEq( meltPeq.Amount, 1000,                        testStatus, "peq amount" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub[0], td.softContTitle,   testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub[1], td.dataSecTitle,    testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectId, td.dataSecPID,          testStatus, "peq unclaimed PID bad" );
    testStatus = tu.checkEq( meltPeq.Active, "true",                      testStatus, "peq" );

    // CHECK Dynamo PAct
    // Should show relevant change 
    let pacts = await utils.getPActs( installClient, {"GHRepo": td.GHFullName} );
    let meltPacts = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    testStatus = tu.checkGE( meltPacts.length, 4,                     testStatus, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let pact = {};
    if     ( colId == td.dsProgID ) { pact  = meltPacts[3];  }  // move
    else if( colId == td.dsPendID ) { pact  = meltPacts[4];  }  // close
    else if( colId == td.dsAccrID ) { pact  = meltPacts[5];  }  // grant

    let hasRaw = await tu.hasRaw( installClient, pact.PEQActionId );
    testStatus = tu.checkEq( hasRaw, true,                            testStatus, "PAct Raw match" ); 
    testStatus = tu.checkEq( pact.GHUserName, config.TESTER_BOT,      testStatus, "PAct user name" ); 
    testStatus = tu.checkEq( pact.Ingested, "false",                  testStatus, "PAct ingested" );
    testStatus = tu.checkEq( pact.Locked, "false",                    testStatus, "PAct locked" );
    if( colId == td.dsProgID ) {
	testStatus = tu.checkEq( pact.Verb, "confirm",                testStatus, "PAct Verb"); 
	testStatus = tu.checkEq( pact.Action, "notice",               testStatus, "PAct Verb");
    }
    else if( colId == td.dsPendID ) {
	testStatus = tu.checkEq( pact.Verb, "propose",                testStatus, "PAct Verb"); 
	testStatus = tu.checkEq( pact.Action, "accrue",               testStatus, "PAct Verb");
    }
    else if( colId == td.dsAccrID ) {
	testStatus = tu.checkEq( pact.Verb, "confirm",                testStatus, "PAct Verb"); 
	testStatus = tu.checkEq( pact.Action, "accrue",               testStatus, "PAct Verb");
    }


    // CHECK dynamo linkage
    let prog = config.PROJ_COLS[ config.PROJ_PROG ]; 
    let pend = config.PROJ_COLS[ config.PROJ_PEND ]; 
    let accr = config.PROJ_COLS[ config.PROJ_ACCR ]; 
    let links    = await utils.getLinks( installClient, td.GHFullName );
    let meltLink = ( links.filter((link) => link.GHIssueId == meltIssue.id ))[0];
    testStatus = tu.checkEq( meltLink.GHIssueNum, meltIssue.number,        testStatus, "Linkage Issue num" );
    testStatus = tu.checkEq( meltLink.GHCardId, meltCard.id,               testStatus, "Linkage Card Id" );
    testStatus = tu.checkEq( meltLink.GHCardTitle, ISS_FLOW,               testStatus, "Linkage Card Title" );
    testStatus = tu.checkEq( meltLink.GHProjectName, td.dataSecTitle,      testStatus, "Linkage Project Title" );
    testStatus = tu.checkEq( meltLink.GHProjectId, td.dataSecPID,          testStatus, "Linkage project id" );
    testStatus = tu.checkEq( meltLink.GHColumnId, colId,                   testStatus, "Linkage Col Id" );
    if     ( colId == td.dsProgID ) { testStatus = tu.checkEq( meltLink.GHColumnName, prog,  testStatus, "Linkage Col name" ); }
    else if( colId == td.dsPendID ) { testStatus = tu.checkEq( meltLink.GHColumnName, pend,  testStatus, "Linkage Col name" ); }
    else if( colId == td.dsAccrID ) { testStatus = tu.checkEq( meltLink.GHColumnName, accr,  testStatus, "Linkage Col name" ); }
    
    return testStatus;
}

async function testCycle( installClient, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test basic lifecycle of an issue" );

    /*
    let meltData  = await tu.makeIssue( installClient, td, "Mog", [] );               // [id, number]  (mix str/int)
    let newLabel = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );
    await tu.addLabel( installClient, td, meltData[1], newLabel.name );
    let meltData1 = await tu.makeIssue( installClient, td, "Dob", [] );               // [id, number]  (mix str/int)
    */
    
    await tu.refreshRec( installClient, td );
    await tu.refreshFlat( installClient, td );

    // 1. Create issue 
    let meltData = await tu.makeIssue( installClient, td, ISS_FLOW, [] );               // [id, number]  (mix str/int)
    testStatus = await checkNewbornIssue( installClient, td, meltData, testStatus );
    
    // 2. add peq label
    let newLabel = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );
    await tu.addLabel( installClient, td, meltData[1], newLabel.name );
    await utils.sleep( 10000 );
    await tu.refreshUnclaimed( installClient, td );
    testStatus = await checkUnclaimedIssue( installClient, td, meltData, testStatus );
    
    // 3. Add to project
    let meltCard  = await tu.makeProjectCard( installClient, td.dsPlanID, meltData[0] );
    await utils.sleep( 15000 );
    testStatus = await checkNewlySituatedIssue( installClient, td, meltData, meltCard, testStatus );

    // 4. add assignee
    await tu.addAssignee( installClient, td, meltData[1], ASSIGNEE1 );
    await tu.addAssignee( installClient, td, meltData[1], ASSIGNEE2 );
    await utils.sleep( 10000 );
    testStatus = await checkAssignees( installClient, td, meltData, testStatus );

    // 5. move to prog
    await tu.moveCard( installClient, meltCard.id, td.dsProgID );
    await utils.sleep( 10000 );
    testStatus = await checkMove( installClient, td, td.dsProgID, meltCard, testStatus );
	
    // 6. close
    await tu.closeIssue( installClient, td, meltData[1] );
    await utils.sleep( 10000 );
    testStatus = await checkMove( installClient, td, td.dsPendID, meltCard, testStatus );

    // 7. move to accr
    await tu.moveCard( installClient, meltCard.id, td.dsAccrID );
    await utils.sleep( 10000 );
    testStatus = await checkMove( installClient, td, td.dsAccrID, meltCard, testStatus );
    
    // let meltData = [771113772, 116];
    // let meltCard = await gh.getCard( installClient, 51515045 );
    // await tu.refreshUnclaimed( installClient, td );
     

    tu.testReport( testStatus, "Test Resolve" );
}



async function runTests( installClient, td ) {

    console.log( "Populate - add a repo to CE =================" );

    await testCycle( installClient, td );

    // XXX test all basic flows.  e.g. create, add, label   // (no unclaimed/peq)
    
    // await cleanupCycle( installClient, td );
}


exports.runTests = runTests;
