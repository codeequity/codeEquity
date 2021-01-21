var assert = require('assert');
var utils = require('../utils');
var config  = require('../config');
var ghUtils = require('../ghUtils');
var gh = ghUtils.githubUtils;
const auth = require( '../auth' );

const testData = require( './testData' );
const tu = require('./testUtils');

const ISS_ASS   = "AssignTest";
const ISS_LAB   = "LabelTest";
const ISS_LAB2  = "LabelTest Dubs";
const ISS_LAB3  = "LabelTest Carded";
const ISS_LAB4  = "Close Open test";
const ASSIGNEE1 = "rmusick2000";
const ASSIGNEE2 = "codeequity";



async function checkNoAssignees( installClient, td, ass1, ass2, issueData, testStatus ) {
    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    
    // CHECK github issues
    let meltIssue = await tu.findIssue( installClient, td, issueData[0] );
    testStatus = tu.checkEq( meltIssue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.assignees.length, 0,             testStatus, "Issue assignee count" );

    // CHECK Dynamo PEQ
    // Should be no change
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0] );
    testStatus = tu.checkEq( meltPeqs.length, 1,                          testStatus, "Peq count" );
    let meltPeq = meltPeqs[0];
    testStatus = tu.checkEq( meltPeq.PeqType, "plan",                     testStatus, "peq type invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub.length, 2,              testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHIssueTitle, issueData[2],          testStatus, "peq title is wrong" );
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
    testStatus = tu.checkGE( meltPacts.length, 5,                            testStatus, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let len = meltPacts.length;
    let addMP  = meltPacts[len-5];   // add the issue
    let addA1  = meltPacts[len-4];   // add assignee 1
    let addA2  = meltPacts[len-3];   // add assignee 2
    let remA1  = meltPacts[len-2];   // rem assignee 1
    let remA2  = meltPacts[len-1];   // rem assignee 2
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

async function checkProgAssignees( installClient, td, ass1, ass2, issueData, testStatus ) {
    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    
    // CHECK github issues
    let meltIssue = await tu.findIssue( installClient, td, issueData[0] );
    testStatus = tu.checkEq( meltIssue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.assignees.length, 2,             testStatus, "Issue assignee count" );

    // CHECK Dynamo PEQ  .. no change already verified
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0] );
    testStatus = tu.checkEq( meltPeqs.length, 1, testStatus, "Peq count" );
    let meltPeq = meltPeqs[0];
    
    // CHECK Dynamo PAct
    // Check new relevant actions
    let pacts = await utils.getPActs( installClient, {"GHRepo": td.GHFullName} );
    let meltPacts = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    testStatus = tu.checkGE( meltPacts.length, 8, testStatus, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    // earlier 5 verified: add peq, add assignees, rem assignees
    let len = meltPacts.length;
    let addA1  = meltPacts[len-3];   // add assignee 1
    let addA2  = meltPacts[len-2];   // add assignee 2
    let note1  = meltPacts[len-1];   // move to Prog
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

async function checkDubLabel( installClient, ghLinks, td, loc, issueData, card, testStatus ) {

    // CHECK github issues
    let issue = await tu.findIssue( installClient, td, issueData[0] );
    testStatus = tu.checkEq( issue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( issue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( issue.labels.length, 2,                testStatus, "Issue label" );
    const labels0 = issue.labels[0].name == "1000 PEQ" && issue.labels[1].name == "documentation";
    const labels1 = issue.labels[1].name == "1000 PEQ" && issue.labels[0].name == "documentation";
    testStatus = tu.checkEq( labels0 || labels1, true,              testStatus, "Issue label" );

    // CHECK dynamo PAct only has 3 entries (add uncl, del uncl, add bacon)  - should not get notices/adds/etc for non-initial peq labeling
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });
    peqs = peqs.filter((peq) => peq.GHIssueId == issueData[0] );
    testStatus = tu.checkEq( peqs.length, 1,                          testStatus, "Peq count" );
    let peq = peqs[0];

    let pacts = await utils.getPActs( installClient, {"GHRepo": td.GHFullName} );
    pacts = pacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    testStatus = tu.checkEq( pacts.length, 3,                         testStatus, "PAct count" );     
    
    return testStatus;
}


async function testLabel( installClient, ghLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Label" );
    installClient[1] = "<TEST: Label>";

    await tu.refreshRec( installClient, td );
    await tu.refreshFlat( installClient, td );
    await tu.refreshUnclaimed( installClient, td );

    const dsPlan = td.getDSPlanLoc();
    const dsProg = td.getDSProgLoc();
    const dsPend = td.getDSPendLoc();
    const dsAccr = td.getDSAccrLoc();
    const bacon  = td.getBaconLoc();

    const flatUntrack = td.getUntrackLoc( td.flatPID );

    {    
	console.log( "Test label/unlabel in full CE structure" );

	// 1. create peq issue in dsplan
	console.log( "Make newly situated issue in dsplan" );
	let issueData = await tu.makeIssue( installClient, td, ISS_LAB, [] );     // [id, number, title]  
	let label     = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );
	await tu.addLabel( installClient, td, issueData[1], label.name );
	
	let card  = await tu.makeProjectCard( installClient, td.dsPlanID, issueData[0] );
	await utils.sleep( 6000 );
	testStatus = await tu.checkNewlySituatedIssue( installClient, ghLinks, td, dsPlan, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 1" );
	
	// 2. unlabel
	await tu.remLabel( installClient, td, issueData[1], label );
	await utils.sleep( 1000 );
	testStatus = await tu.checkDemotedIssue( installClient, ghLinks, td, dsPlan, issueData, card, testStatus );
	tu.testReport( testStatus, "A" );
	
	// 3. move to accr (untracked), watch it bounce back
	await tu.moveCard( installClient, card.id, td.dsAccrID );        
	testStatus = await tu.checkDemotedIssue( installClient, ghLinks, td, dsPlan, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 3" );
	
	// 4. move to pend, bounce
	await tu.moveCard( installClient, card.id, td.dsPendID );
	testStatus = await tu.checkDemotedIssue( installClient, ghLinks, td, dsPlan, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 4" );
	
	// 5. move to prog (untracked), label
	await tu.moveCard( installClient, card.id, td.dsProgID );
	await tu.addLabel( installClient, td, issueData[1], label.name );
	await utils.sleep( 2000 );
	testStatus = await tu.checkSituatedIssue( installClient, ghLinks, td, dsProg, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 5" );
	
	// 6. unlabel, label
	await tu.remLabel( installClient, td, issueData[1], label );
	await tu.addLabel( installClient, td, issueData[1], label.name ); 
	await utils.sleep( 2000 );
	testStatus = await tu.checkSituatedIssue( installClient, ghLinks, td, dsProg, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 6" );
	
	// 7. move to accr, unlabel (fail)
	await tu.addAssignee( installClient, td, issueData[1], ASSIGNEE1 );   // can't ACCR without this.    
	await tu.moveCard( installClient, card.id, td.dsAccrID );
	await tu.remLabel( installClient, td, issueData[1], label );          // will be added back
	await utils.sleep( 2000 );
	testStatus = await tu.checkSituatedIssue( installClient, ghLinks, td, dsAccr, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 7" );
    }	

    {
	// add two peq labels
	console.log( "Double-labels" );

	// 1. create 1k peq issue in bacon
	console.log( "Make newly situated issue in bacon" );
	let issueData = await tu.makeIssue( installClient, td, ISS_LAB2, [] );     // [id, number, title] 
	let label     = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );
	await tu.addLabel( installClient, td, issueData[1], label.name );
	let card  = await tu.makeProjectCard( installClient, bacon.colId, issueData[0] );

	await utils.sleep( 6000 );
	testStatus = await tu.checkNewlySituatedIssue( installClient, ghLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label Dub 1" );
	
	// 2. add "documentation" twice (fail - will not receive 2nd notification)
	let docLabel  = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "documentation", -1 );	
	await tu.addLabel( installClient, td, issueData[1], docLabel.name );
	await tu.addLabel( installClient, td, issueData[1], docLabel.name );
	testStatus = await checkDubLabel( installClient, ghLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label Dub 2" );
	
	// 3. add 500 peq (fail)
	let label500  = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "500 PEQ", 500 );	
	await tu.addLabel( installClient, td, issueData[1], label500.name );
	await utils.sleep( 2000 );
	testStatus = await checkDubLabel( installClient, ghLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label Dub 3" );	

	console.log( "Double-labels done." );
	await utils.sleep( 10000 );


	console.log( "\nTest label/unlabel in flat projects structure" );
	
	// 1. unlabel
	await tu.remLabel( installClient, td, issueData[1], docLabel );    
	await tu.remLabel( installClient, td, issueData[1], label );
	await utils.sleep( 2000 );
	testStatus = await tu.checkDemotedIssue( installClient, ghLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label flat 1" );
	
	// 2. label
	await tu.addLabel( installClient, td, issueData[1], label.name );    
	await utils.sleep( 2000 );
	testStatus = await tu.checkSituatedIssue( installClient, ghLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label flat 2" );

	// 3. close (should create pend/accr cols) (fail, no assignee)
	await tu.closeIssue( installClient, td, issueData[1] );
	await utils.sleep( 2000 );
	testStatus = await tu.checkSituatedIssue( installClient, ghLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label flat 3" );
	
	// 4. assign and close
	await tu.addAssignee( installClient, td, issueData[1], ASSIGNEE1 );   // can't PEND without this.
	await tu.closeIssue( installClient, td, issueData[1] );
	await utils.sleep( 2000 );
	
	// get new cols/locs pend/accr
	const flatPend = await tu.getFlatLoc( installClient, td.flatPID, td.flatTitle, config.PROJ_COLS[config.PROJ_PEND] );
	const flatAccr = await tu.getFlatLoc( installClient, td.flatPID, td.flatTitle, config.PROJ_COLS[config.PROJ_ACCR] );
	
	testStatus = await tu.checkSituatedIssue( installClient, ghLinks, td, flatPend, issueData, card, testStatus );
	tu.testReport( testStatus, "Label flat 4" );
	
	// 5. unlabel (OK here, negotiating)
	await tu.remLabel( installClient, td, issueData[1], label );    
	await utils.sleep( 2000 );
	testStatus = await tu.checkDemotedIssue( installClient, ghLinks, td, flatPend, issueData, card, testStatus );
	tu.testReport( testStatus, "Label flat 5" );

	// PEQ is rebuilt below, when it is re-activated.
	flatPend.projSub = [ td.flatTitle ];
	flatAccr.projSub = [ td.flatTitle ];

	// 5. relabel (OK here, negotiating)
	await tu.addLabel( installClient, td, issueData[1], label500.name );    
	await utils.sleep( 2000 );
	testStatus = await tu.checkSituatedIssue( installClient, ghLinks, td, flatPend, issueData, card, testStatus, {"label": 500 } );
	await utils.sleep( 2000 );
	tu.testReport( testStatus, "Label flat 6" );
	
	// 6. move to accr
	await tu.moveCard( installClient, card.id, flatAccr.colId );
	await utils.sleep( 2000 );
	testStatus = await tu.checkSituatedIssue( installClient, ghLinks, td, flatAccr, issueData, card, testStatus, {"label": 500 } );
	tu.testReport( testStatus, "Label flat 7" );
    }

    tu.testReport( testStatus, "Test Label" );
    return testStatus;
}

async function testAssignment( installClient, ghLinks, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Assignment" );
    installClient[1] = "<TEST: Assign>";

    await tu.refreshRec( installClient, td );
    await tu.refreshFlat( installClient, td );
    await tu.refreshUnclaimed( installClient, td );

    const VERBOSE = true;
    const assPlan = await tu.getFullLoc( installClient, td.softContTitle, td.dataSecPID, td.dataSecTitle, config.PROJ_COLS[config.PROJ_PLAN] );
    
    // 1. Create PEQ issue, add to proj
    console.log( "Make newly situated issue" );
    let assData = await tu.makeIssue( installClient, td, ISS_ASS, [] );     // [id, number, title]  

    let newLabel = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );
    await tu.addLabel( installClient, td, assData[1], newLabel.name );

    let assCard  = await tu.makeProjectCard( installClient, td.dsPlanID, assData[0] );
    await utils.sleep( 6000 );
    testStatus = await tu.checkNewlySituatedIssue( installClient, ghLinks, td, assPlan, assData, assCard, testStatus );

    if( VERBOSE ) { tu.testReport( testStatus, "A" ); }

    // 2. add assignee
    console.log( "Add assignees" );
    await tu.addAssignee( installClient, td, assData[1], ASSIGNEE1 );
    await tu.addAssignee( installClient, td, assData[1], ASSIGNEE2 );
    await utils.sleep( 2000 );
    testStatus = await tu.checkAssignees( installClient, td, ASSIGNEE1, ASSIGNEE2, assData, testStatus );

    if( VERBOSE ) { tu.testReport( testStatus, "B" ); }

    // 3. remove assignees
    console.log( "Rem assignees" );
    await tu.remAssignee( installClient, td, assData[1], ASSIGNEE1 );
    await tu.remAssignee( installClient, td, assData[1], ASSIGNEE2 );
    await utils.sleep( 2000 );
    testStatus = await checkNoAssignees( installClient, td, ASSIGNEE1, ASSIGNEE2, assData, testStatus );

    if( VERBOSE ) { tu.testReport( testStatus, "C" ); }
    
    // 4. add assignees
    console.log( "Add assignees" );
    await tu.addAssignee( installClient, td, assData[1], ASSIGNEE1 );
    await tu.addAssignee( installClient, td, assData[1], ASSIGNEE2 );

    // 5. move to Prog
    await tu.moveCard( installClient, assCard.id, td.dsProgID );
    await utils.sleep( 2000 );
    testStatus = await checkProgAssignees( installClient, td, ASSIGNEE1, ASSIGNEE2, assData, testStatus );

    // There is no further relevant logic.  
    
    tu.testReport( testStatus, "Test Assign" );
    return testStatus;
}

async function testLabelCarded( installClient, ghLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Label Carded" );
    installClient[1] = "<TEST: Label Carded>";

    await tu.refreshRec( installClient, td );
    await tu.refreshFlat( installClient, td );
    await tu.refreshUnclaimed( installClient, td );

    const bacon       = td.getBaconLoc();

    {    
	console.log( "Test label carded in flat" );

	// 1. make carded issue in bacon
	console.log( "Make carded issue" );
	const issueData = await tu.makeIssue( installClient, td, ISS_LAB3, [] );     // [id, number, title] 
	const card      = await tu.makeProjectCard( installClient, bacon.colId, issueData[0] );
	await utils.sleep( 2000 );
	testStatus     = await tu.checkUntrackedIssue( installClient, ghLinks, td, bacon, issueData, card, testStatus );

	// 2. add label
	const label     = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );
	await tu.addLabel( installClient, td, issueData[1], label.name );
	await utils.sleep( 3000 );
	testStatus     = await tu.checkNewlySituatedIssue( installClient, ghLinks, td, bacon, issueData, card, testStatus );
    }	

    tu.testReport( testStatus, "Test Label Carded" );
    return testStatus;
}

async function testCloseReopen( installClient, ghLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Close Reopen" );
    installClient[1] = "<TEST: Close Reopen>";

    await tu.refreshRec( installClient, td );
    await tu.refreshFlat( installClient, td );
    await tu.refreshUnclaimed( installClient, td );

    const bacon      = td.getBaconLoc();
    const eggs       = td.getEggsLoc();

    {
	console.log( "Open/close in flat" );
	// 0. make peq in bacon
	const label     = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );
	const issueData = await tu.makeIssue( installClient, td, ISS_LAB4, [label] );     // [id, number, title] 
	const card      = await tu.makeProjectCard( installClient, bacon.colId, issueData[0] );
	await utils.sleep( 5000 );
	testStatus     = await tu.checkNewlySituatedIssue( installClient, ghLinks, td, bacon, issueData, card, testStatus );

	tu.testReport( testStatus, "A" );
	
	// 1. close
	await tu.addAssignee( installClient, td, issueData[1], ASSIGNEE1 );	
	await tu.closeIssue( installClient, td, issueData[1] );
	await utils.sleep( 2000 );

	// get new cols/locs pend/accr
	const flatPend = await tu.getFlatLoc( installClient, td.flatPID, td.flatTitle, config.PROJ_COLS[config.PROJ_PEND] );
	const flatAccr = await tu.getFlatLoc( installClient, td.flatPID, td.flatTitle, config.PROJ_COLS[config.PROJ_ACCR] );
	
	testStatus = await tu.checkNewlyClosedIssue( installClient, ghLinks, td, flatPend, issueData, card, testStatus );
	
	tu.testReport( testStatus, "B" );
	
	// 2. close again (no change - looks like notification never sent)
	await tu.closeIssue( installClient, td, issueData[1] );
	await utils.sleep( 2000 );
	testStatus = await tu.checkNewlyClosedIssue( installClient, ghLinks, td, flatPend, issueData, card, testStatus );
	
	tu.testReport( testStatus, "C" );

	// Erm.  Simulate ceFlutter processing to ingest propose:accrue, else won't see bacon col in step 3
	// await tu.ingestPActs( installClient, issueData );
	
	// 3. Reopen
	await tu.reopenIssue( installClient, td, issueData[1] );
	await utils.sleep( 2000 );
	testStatus = await tu.checkNewlyOpenedIssue( installClient, ghLinks, td, bacon, issueData, card, testStatus );
	
	tu.testReport( testStatus, "D" );

	// 4. Reopen again (fail)
	await tu.reopenIssue( installClient, td, issueData[1] );
	await utils.sleep( 2000 );
	testStatus = await tu.checkNewlyOpenedIssue( installClient, ghLinks, td, bacon, issueData, card, testStatus );
	
	tu.testReport( testStatus, "E" );

	// 5. move to eggs
	await tu.moveCard( installClient, card.id, eggs.colId );
	await utils.sleep( 2000 );
	testStatus = await tu.checkSituatedIssue( installClient, ghLinks, td, eggs, issueData, card, testStatus, {"state": "open" } );

	tu.testReport( testStatus, "F" );
	
	// 6. close
	await tu.closeIssue( installClient, td, issueData[1] );
	await utils.sleep( 2000 );
	testStatus = await tu.checkNewlyClosedIssue( installClient, ghLinks, td, flatPend, issueData, card, testStatus );
	
	tu.testReport( testStatus, "G" );

	// 7. reopen
	await tu.reopenIssue( installClient, td, issueData[1] );
	await utils.sleep( 2000 );

	testStatus = await tu.checkNewlyOpenedIssue( installClient, ghLinks, td, eggs, issueData, card, testStatus );
	
	tu.testReport( testStatus, "H" );

	// 8. close
	await tu.closeIssue( installClient, td, issueData[1] );
	await utils.sleep( 2000 );
	testStatus = await tu.checkNewlyClosedIssue( installClient, ghLinks, td, flatPend, issueData, card, testStatus );
	
	tu.testReport( testStatus, "I" );

	// 9. move to accr
	await tu.moveCard( installClient, card.id, flatAccr.colId );
	await utils.sleep( 2000 );
	testStatus = await tu.checkSituatedIssue( installClient, ghLinks, td, flatAccr, issueData, card, testStatus, {"state": "closed" } );

	tu.testReport( testStatus, "J" );
	

	// 10. reopen (fail)
	await tu.reopenIssue( installClient, td, issueData[1] );
	await utils.sleep( 2000 );
	testStatus = await tu.checkSituatedIssue( installClient, ghLinks, td, flatAccr, issueData, card, testStatus, {"state": "closed" } );

	tu.testReport( testStatus, "K" );
    }	

    {
	console.log( "\n\nOpen/close in full++" );

	await tu.makeColumn( installClient, td.githubOpsPID, "Stars" );	
	await tu.makeColumn( installClient, td.githubOpsPID, "Stripes" );

	const stars      = await tu.getFullLoc( installClient, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, "Stars" );
	const stripes    = await tu.getFullLoc( installClient, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, "Stripes" );

	const ghoProg = await tu.getFullLoc( installClient, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PROG] );
	const ghoPend = await tu.getFullLoc( installClient, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PEND] );
	const ghoAccr = await tu.getFullLoc( installClient, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_ACCR] );

	// peqs are out of date (need ingesting) by the time these are used.
	ghoPend.projSub = stars.projSub;
	ghoAccr.projSub = stars.projSub;
	
	// 0. make peq in stars
	const label     = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );
	const issueData = await tu.makeIssue( installClient, td, ISS_LAB4, [label] );     // [id, number, title] 
	const card      = await tu.makeProjectCard( installClient, stars.colId, issueData[0] );
	await utils.sleep( 5000 );
	testStatus     = await tu.checkNewlySituatedIssue( installClient, ghLinks, td, stars, issueData, card, testStatus );

	tu.testReport( testStatus, "A" );
	
	// 1. close
	await tu.addAssignee( installClient, td, issueData[1], ASSIGNEE1 );	
	await tu.closeIssue( installClient, td, issueData[1] );
	await utils.sleep( 2000 );
	testStatus = await tu.checkNewlyClosedIssue( installClient, ghLinks, td, ghoPend, issueData, card, testStatus );
	
	tu.testReport( testStatus, "B" );

	// 2  Simulate ceFlutter processing to ingest propose:accrue, else won't see stars col in step 3
	// await tu.ingestPActs( installClient, issueData );
	
	// 3. Reopen
	await tu.reopenIssue( installClient, td, issueData[1] );
	await utils.sleep( 2000 );
	testStatus = await tu.checkNewlyOpenedIssue( installClient, ghLinks, td, stars, issueData, card, testStatus );
	
	tu.testReport( testStatus, "C" );

	// 4. move to stripes
	await tu.moveCard( installClient, card.id, stripes.colId );
	await utils.sleep( 2000 );
	testStatus = await tu.checkSituatedIssue( installClient, ghLinks, td, stripes, issueData, card, testStatus );

	tu.testReport( testStatus, "D" );
	
	// 5. close
	await tu.closeIssue( installClient, td, issueData[1] );
	await utils.sleep( 2000 );
	testStatus = await tu.checkNewlyClosedIssue( installClient, ghLinks, td, ghoPend, issueData, card, testStatus );
	
	tu.testReport( testStatus, "E" );

	// 6. reopen
	await tu.reopenIssue( installClient, td, issueData[1] );
	await utils.sleep( 2000 );
	testStatus = await tu.checkNewlyOpenedIssue( installClient, ghLinks, td, stripes, issueData, card, testStatus );
	
	tu.testReport( testStatus, "F" );

	// 7. close
	await tu.closeIssue( installClient, td, issueData[1] );
	await utils.sleep( 2000 );
	testStatus = await tu.checkNewlyClosedIssue( installClient, ghLinks, td, ghoPend, issueData, card, testStatus );
	
	tu.testReport( testStatus, "G" );

	// 8. move to accr
	await tu.moveCard( installClient, card.id, ghoAccr.colId );
	await utils.sleep( 2000 );
	testStatus = await tu.checkSituatedIssue( installClient, ghLinks, td, ghoAccr, issueData, card, testStatus );

	tu.testReport( testStatus, "H" );
    }

    
    tu.testReport( testStatus, "Test Close Reopen" );
    return testStatus;
}


// create in place?  Yes, major mode.  
// PROG PEND ACCR create/delete newborn, carded, situated.
async function testCreateDelete( installClient, ghLinks, td, PAT ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Create Delete" );
    installClient[1] = "<TEST: Create Delete>";
    
    const ISS_NEWB = "Newborn";
    const ISS_CRDD = "Carded"; 
    const ISS_SITU = "Situated"; 

    await tu.refreshRec( installClient, td );
    await tu.refreshFlat( installClient, td );
    await tu.refreshUnclaimed( installClient, td );

    const stars      = await tu.getFullLoc( installClient, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, "Stars" );
    const stripes    = await tu.getFullLoc( installClient, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, "Stripes" );
    
    const ghoProg = await tu.getFullLoc( installClient, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PROG] );
    const ghoPend = await tu.getFullLoc( installClient, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PEND] );
    const ghoAccr = await tu.getFullLoc( installClient, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_ACCR] );

    {
	console.log( "\nNewborn testing" );

	const ISS_FLAT = ISS_NEWB + " Flat";
	const ISS_PROG = ISS_NEWB + " In Progress";
	const ISS_PEND = ISS_NEWB + " Pending";
	const ISS_ACCR = ISS_NEWB + " Accrued";

	// 0. make newborns
	const cardIdFlat  = await tu.makeNewbornCard( installClient, stars.colId, ISS_FLAT );
	const cardIdProg  = await tu.makeNewbornCard( installClient, ghoProg.colId, ISS_PROG );
	const cardIdPend  = await tu.makeNewbornCard( installClient, ghoPend.colId, ISS_PEND );
	const cardIdAccr  = await tu.makeNewbornCard( installClient, ghoAccr.colId, ISS_ACCR );
	await utils.sleep( 2000 );
	testStatus     = await tu.checkNewbornCard( installClient, ghLinks, td, stars, cardIdFlat, ISS_FLAT, testStatus );
	testStatus     = await tu.checkNewbornCard( installClient, ghLinks, td, ghoProg, cardIdProg, ISS_PROG, testStatus );
	testStatus     = await tu.checkNoCard( installClient, ghLinks, td, ghoPend, cardIdPend, ISS_PEND, testStatus );
	testStatus     = await tu.checkNoCard( installClient, ghLinks, td, ghoAccr, cardIdAccr, ISS_ACCR, testStatus );

	// 2. remove them.
	await tu.remCard( installClient, cardIdFlat );
	await tu.remCard( installClient, cardIdProg );
	testStatus     = await tu.checkNoCard( installClient, ghLinks, td, stars, cardIdFlat, ISS_FLAT, testStatus );
	testStatus     = await tu.checkNoCard( installClient, ghLinks, td, ghoProg, cardIdProg, ISS_PROG, testStatus );

	tu.testReport( testStatus, "newborn A" );
    }
    
    {
	// Note this leaves two newborn issues in place: ISS_PEND, ISS_ACCR
	console.log( "Carded testing" );

	const ISS_FLAT = ISS_CRDD + " Flat";
	const ISS_PROG = ISS_CRDD + " In Progress";
	const ISS_PEND = ISS_CRDD + " Pending";
	const ISS_ACCR = ISS_CRDD + " Accrued";

	// 0. make carded issues
	const issDatFlat = await tu.makeIssue( installClient, td, ISS_FLAT, [] );     
	const issDatProg = await tu.makeIssue( installClient, td, ISS_PROG, [] );
	const issDatPend = await tu.makeIssue( installClient, td, ISS_PEND, [] );
	const issDatAccr = await tu.makeIssue( installClient, td, ISS_ACCR, [] );

	const flatCard   = await tu.makeProjectCard( installClient, stars.colId,   issDatFlat[0] );
	const progCard   = await tu.makeProjectCard( installClient, ghoProg.colId, issDatProg[0] );
	const pendCard   = await tu.makeProjectCard( installClient, ghoPend.colId, issDatPend[0] );
	const accrCard   = await tu.makeProjectCard( installClient, ghoAccr.colId, issDatAccr[0] );

	await utils.sleep( 2000 );
	testStatus     = await tu.checkUntrackedIssue( installClient, ghLinks, td, stars,   issDatFlat, flatCard, testStatus );
	testStatus     = await tu.checkUntrackedIssue( installClient, ghLinks, td, ghoProg, issDatProg, progCard, testStatus );
	testStatus     = await tu.checkNoCard( installClient, ghLinks, td, ghoPend, pendCard.id, ISS_PEND, testStatus );
	testStatus     = await tu.checkNoCard( installClient, ghLinks, td, ghoAccr, accrCard.id, ISS_ACCR, testStatus );

	tu.testReport( testStatus, "carded A" );

	// 2. remove them.
	await tu.remCard( installClient, flatCard.id );             // remove card, then issue
	await tu.remIssue( installClient, td, issDatFlat[0], PAT );
	await tu.remIssue( installClient, td, issDatProg[0], PAT ); // just remove issue
	
	await utils.sleep( 2000 );
	testStatus     = await tu.checkNoCard( installClient, ghLinks, td, stars,   flatCard.id, ISS_FLAT, testStatus );
	testStatus     = await tu.checkNoCard( installClient, ghLinks, td, ghoProg, progCard.id, ISS_PROG, testStatus );

	tu.testReport( testStatus, "carded B" );
    }
    
    {
	console.log( "Situated testing" );

	const ISS_FLAT = ISS_SITU + " Flat";
	const ISS_PROG = ISS_SITU + " In Progress";
	const ISS_PEND = ISS_SITU + " Pending";
	const ISS_ACCR = ISS_SITU + " Accrued";

	// 0. make situated issues
	const label     = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );	
	const issDatFlat = await tu.makeIssue( installClient, td, ISS_FLAT, [label] );     
	const issDatProg = await tu.makeIssue( installClient, td, ISS_PROG, [label] );
	const issDatPend = await tu.makeIssue( installClient, td, ISS_PEND, [label] );
	const issDatAccr = await tu.makeIssue( installClient, td, ISS_ACCR, [label] );

	const flatCard   = await tu.makeProjectCard( installClient, stars.colId,   issDatFlat[0] );
	const progCard   = await tu.makeProjectCard( installClient, ghoProg.colId, issDatProg[0] );
	const pendCard   = await tu.makeProjectCard( installClient, ghoPend.colId, issDatPend[0] );
	const accrCard   = await tu.makeProjectCard( installClient, ghoAccr.colId, issDatAccr[0] );

	await utils.sleep( 8000 );
	testStatus = await tu.checkNewlySituatedIssue( installClient, ghLinks, td, stars,   issDatFlat, flatCard, testStatus );
	testStatus = await tu.checkNewlySituatedIssue( installClient, ghLinks, td, ghoProg, issDatProg, progCard, testStatus );
	testStatus = await tu.checkNewlySituatedIssue( installClient, ghLinks, td, ghoPend, issDatPend, pendCard, testStatus );
	testStatus = await tu.checkNoCard( installClient, ghLinks, td, ghoAccr, accrCard.id, ISS_ACCR, testStatus, {"peq": true} );

	tu.testReport( testStatus, "situated A" );
	
	// 2. remove them.
	await tu.remIssue( installClient, td, issDatFlat[0], PAT );
	await tu.remIssue( installClient, td, issDatProg[0], PAT ); 
	await tu.remIssue( installClient, td, issDatPend[0], PAT );
	
	await utils.sleep( 5000 );
	testStatus     = await tu.checkNoCard( installClient, ghLinks, td, stars,   flatCard.id, ISS_FLAT, testStatus, {"peq": true} );
	testStatus     = await tu.checkNoCard( installClient, ghLinks, td, ghoProg, progCard.id, ISS_PROG, testStatus, {"peq": true} );
	testStatus     = await tu.checkNoCard( installClient, ghLinks, td, ghoPend, pendCard.id, ISS_PEND, testStatus, {"peq": true} );

	tu.testReport( testStatus, "situated B" );
    }
    
    tu.testReport( testStatus, "Test Create Delete" );

    return testStatus;
}


async function runTests( installClient, ghLinks, td ) {

    const PAT   = await auth.getPAT( td.GHOwner );

    console.log( "Component tests =================" );

    let testStatus = [ 0, 0, []];

    let t1 = await testAssignment( installClient, ghLinks, td );
    console.log( "\n\nAssignment test complete." );
    await utils.sleep( 10000 );
    
    let t2 = await testLabel( installClient, ghLinks, td ); 
    console.log( "\n\nLabel test complete." );
    await utils.sleep( 10000 );

    let t3 = await testLabelCarded( installClient, ghLinks, td );
    console.log( "\n\nLabel Carded complete." );
    await utils.sleep( 10000 );

    let t4 = await testCloseReopen( installClient, ghLinks, td ); 
    console.log( "\n\nClose / Reopen complete." );
    await utils.sleep( 10000 );
    
    let t5 = await testCreateDelete( installClient, ghLinks, td, PAT );
    console.log( "\n\nCreate / Delete complete." );
    // await utils.sleep( 10000 );
    
    testStatus = tu.mergeTests( testStatus, t1 );
    testStatus = tu.mergeTests( testStatus, t2 );
    testStatus = tu.mergeTests( testStatus, t3 );
    testStatus = tu.mergeTests( testStatus, t4 );
    testStatus = tu.mergeTests( testStatus, t5 );
    return testStatus
}


exports.runTests = runTests;
