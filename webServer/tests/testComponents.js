var assert = require('assert');
var utils = require('../utils');
var config  = require('../config');
var ghUtils = require('../ghUtils');
var gh = ghUtils.githubUtils;

const testData = require( './testData' );
const tu = require('./testUtils');

const ISS_ASS = "Assignee";
const ASSIGNEE1 = "rmusick2000";
const ASSIGNEE2 = "codeequity";



async function checkNoAssignees( installClient, td, issueName, ass1, ass2, issueData, testStatus ) {
    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    
    // CHECK github issues
    let meltIssue = await tu.findIssue( installClient, td, issueName );
    testStatus = tu.checkEq( meltIssue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.assignees.length, 0,             testStatus, "Issue assignee count" );

    // CHECK Dynamo PEQ
    // Should be no change
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0] );
    testStatus = tu.checkEq( meltPeqs.length, 2,                          testStatus, "Peq count" );
    let meltPeq = meltPeqs[0].Active == "true" ? meltPeqs[0] : meltPeqs[1];
    testStatus = tu.checkEq( meltPeq.PeqType, "plan",                     testStatus, "peq type invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub.length, 2,              testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHIssueTitle, issueName,             testStatus, "peq title is wrong" );
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
    testStatus = tu.checkEq( meltPacts.length, 5,                            testStatus, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let addMP  = meltPacts[0];   // add the issue
    let addA1  = meltPacts[1];   // add assignee 1
    let addA2  = meltPacts[2];   // add assignee 2
    let remA1  = meltPacts[3];   // rem assignee 1
    let remA2  = meltPacts[4];   // rem assignee 2
    for( const pact of [addMP, addA1, addA2, remA1, remA2] ) {
	let hasRaw = await tu.hasRaw( installClient, pact.PEQActionId );
	testStatus = tu.checkEq( hasRaw, true,                            testStatus, "PAct Raw match" ); 
	testStatus = tu.checkEq( pact.Verb, "confirm",                    testStatus, "PAct Verb"); 
	testStatus = tu.checkEq( pact.GHUserName, config.TESTER_BOT,      testStatus, "PAct user name" ); 
	testStatus = tu.checkEq( pact.Ingested, "false",                  testStatus, "PAct ingested" );
	testStatus = tu.checkEq( pact.Locked, "false",                    testStatus, "PAct locked" );
    }
    testStatus = tu.checkEq( addMP.Action, "add",                         testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( remA1.Action, "change",                      testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( remA2.Action, "change",                      testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( remA1.Subject[1], ass1,                      testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( remA2.Subject[1], ass2,                      testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( remA1.Note, "remove assignee",               testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( remA2.Note, "remove assignee",               testStatus, "PAct Verb"); 
    
    return testStatus;
}

async function checkProgAssignees( installClient, td, issueName, ass1, ass2, issueData, testStatus ) {
    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    
    // CHECK github issues
    let meltIssue = await tu.findIssue( installClient, td, issueName );
    testStatus = tu.checkEq( meltIssue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.assignees.length, 2,             testStatus, "Issue assignee count" );

    // CHECK Dynamo PEQ  .. no change already verified
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0] );
    testStatus = tu.checkEq( meltPeqs.length, 2, testStatus, "Peq count" );
    let meltPeq = meltPeqs[0].Active == "true" ? meltPeqs[0] : meltPeqs[1];
    
    // CHECK Dynamo PAct
    // Check new relevant actions
    let pacts = await utils.getPActs( installClient, {"GHRepo": td.GHFullName} );
    let meltPacts = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    testStatus = tu.checkEq( meltPacts.length, 8, testStatus, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    // 0-4: verified: add peq, add assignees, rem assignees
    let addA1  = meltPacts[5];   // add assignee 1
    let addA2  = meltPacts[6];   // add assignee 2
    let note1  = meltPacts[7];   // move to Prog
    for( const pact of [note1, addA1, addA2] ) {
	let hasRaw = await tu.hasRaw( installClient, pact.PEQActionId );
	testStatus = tu.checkEq( hasRaw, true,                            testStatus, "PAct Raw match" ); 
	testStatus = tu.checkEq( pact.Verb, "confirm",                    testStatus, "PAct Verb"); 
	testStatus = tu.checkEq( pact.GHUserName, config.TESTER_BOT,      testStatus, "PAct user name" ); 
	testStatus = tu.checkEq( pact.Ingested, "false",                  testStatus, "PAct ingested" );
	testStatus = tu.checkEq( pact.Locked, "false",                    testStatus, "PAct locked" );
    }
    testStatus = tu.checkEq( note1.Action, "notice",                      testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( addA1.Action, "change",                      testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( addA2.Action, "change",                      testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( addA1.Subject[1], ass1,                      testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( addA2.Subject[1], ass2,                      testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( addA1.Note, "add assignee",                  testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( addA2.Note, "add assignee",                  testStatus, "PAct Verb"); 
    
    return testStatus;
}


async function testAssignment( installClient, ghLinks, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Assignment" );

    await tu.refreshRec( installClient, td );
    await tu.refreshFlat( installClient, td );
    await tu.refreshUnclaimed( installClient, td );

    // 1. Create PEQ issue, add to proj
    console.log( "Make newly situated issue" );
    let assData = await tu.makeIssue( installClient, td, ISS_ASS, [] );     // [id, number]  (mix str/int)

    let newLabel = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );
    await tu.addLabel( installClient, td, assData[1], newLabel.name );

    let assCard  = await tu.makeProjectCard( installClient, td.dsPlanID, assData[0] );
    await utils.sleep( 4000 );
    testStatus = await tu.checkNewlySituatedIssue( installClient, ghLinks, td, ISS_ASS, assData, assCard, testStatus );

    // 2. add assignee
    console.log( "Add assignees" );
    await tu.addAssignee( installClient, td, assData[1], ASSIGNEE1 );
    await tu.addAssignee( installClient, td, assData[1], ASSIGNEE2 );
    await utils.sleep( 2000 );
    testStatus = await tu.checkAssignees( installClient, td, ISS_ASS, ASSIGNEE1, ASSIGNEE2, assData, testStatus );

    // 3. remove assignees
    console.log( "Rem assignees" );
    await tu.remAssignee( installClient, td, assData[1], ASSIGNEE1 );
    await tu.remAssignee( installClient, td, assData[1], ASSIGNEE2 );
    await utils.sleep( 2000 );
    testStatus = await checkNoAssignees( installClient, td, ISS_ASS, ASSIGNEE1, ASSIGNEE2, assData, testStatus );
    
    // 4. add assignees
    console.log( "Add assignees" );
    await tu.addAssignee( installClient, td, assData[1], ASSIGNEE1 );
    await tu.addAssignee( installClient, td, assData[1], ASSIGNEE2 );

    // 5. move to Prog
    await tu.moveCard( installClient, assCard.id, td.dsProgID );
    await utils.sleep( 2000 );
    testStatus = await checkProgAssignees( installClient, td, ISS_ASS, ASSIGNEE1, ASSIGNEE2, assData, testStatus );

    // There is no further relevant logic.  
    
    tu.testReport( testStatus, "Test Resolve" );
}


async function runTests( installClient, ghLinks, td ) {

    console.log( "One-off tests =================" );

    await testAssignment( installClient, ghLinks, td );

}


exports.runTests = runTests;
