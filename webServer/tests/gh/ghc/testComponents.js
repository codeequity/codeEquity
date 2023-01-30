const assert = require( 'assert' );
const config = require( '../config' );

const utils    = require( '../utils/ceUtils' );
const awsUtils = require( '../utils/awsUtils' );

const ghClassic = require( '../utils/gh/ghc/ghClassicUtils' );
const gh        = ghClassic.githubUtils;
const ghSafe    = ghClassic.githubSafe;

const testData = require( './testData' );
const tu = require('./testUtils');

const ISS_LAB   = "LabelTest";
const ISS_LAB2  = "LabelTest Dubs";
const ISS_LAB3  = "LabelTest Carded";
const ISS_LAB4  = "Close Open test";
const ASSIGNEE1 = "ariCETester";
const ASSIGNEE2 = "codeequity";


async function checkDubLabel( authData, ghLinks, td, loc, issueData, card, testStatus ) {

    let subTest = [ 0, 0, []];

    // CHECK github issues
    let kp = "1000 " + config.PEQ_LABEL;    
    let issue = await tu.findIssue( authData, td, issueData[0] );

    if( issue.labels.length >= 2 ) {
	subTest = tu.checkEq( issue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
	subTest = tu.checkEq( issue.number, issueData[1].toString(), subTest, "Github issue troubles" );
	subTest = tu.checkEq( issue.labels.length, 2,                subTest, "Issue label" );
	const labels0 = issue.labels[0].name == kp && issue.labels[1].name == "documentation";
	const labels1 = issue.labels[1].name == kp && issue.labels[0].name == "documentation";
	subTest = tu.checkEq( labels0 || labels1, true,              subTest, "Issue label" );
	
	// CHECK dynamo PAct only has 3 entries (add uncl, del uncl, add bacon)  - should not get notices/adds/etc for non-initial peq labeling
	let peqs =  await awsUtils.getPeqs( authData, { "CEProjectId": td.CEProjectId });
	peqs = peqs.filter((peq) => peq.HostIssueId == issueData[0] );
	subTest = tu.checkEq( peqs.length, 1,                          subTest, "Peq count" );
	let peq = peqs[0];
	
	let pacts = await awsUtils.getPActs( authData, { "CEProjectId": td.CEProjectId });
	pacts = pacts.filter((pact) => pact.Subject[0] == peq.PEQId );
	subTest = tu.checkEq( pacts.length, 2,                         subTest, "PAct count" );     
    }
    
    return await tu.settle( subTest, testStatus, checkDubLabel, authData, ghLinks, td, loc, issueData, card, testStatus );
}


async function testLabel( authData, ghLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Label" );
    authData.who = "<TEST: Label>";

    await tu.refreshRec( authData, td );
    await tu.refreshFlat( authData, td );
    await tu.refreshUnclaimed( authData, td );

    const dsPlan = td.getDSPlanLoc();
    const dsProg = td.getDSProgLoc();
    const dsPend = td.getDSPendLoc();
    const dsAccr = td.getDSAccrLoc();
    const bacon  = td.getBaconLoc();

    const flatUntrack = td.getUntrackLoc( td.flatPID );
    const kp     = "1000 " + config.PEQ_LABEL;
    const halfKP = "500 " + config.PEQ_LABEL;
    
    {    
	console.log( "Test label/unlabel in full CE structure" );

	// 1. create peq issue in dsplan
	console.log( "Make newly situated issue in dsplan" );
	let issueData = await tu.makeIssue( authData, td, ISS_LAB, [] );     // [id, number, title]  
	let label     = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, kp, 1000 );
	await tu.addLabel( authData, td, issueData, label.name );
	
	let card  = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, td.dsPlanID, issueData[0] );
	testStatus = await tu.checkNewlySituatedIssue( authData, ghLinks, td, dsPlan, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 1" );
	
	// 2. unlabel
	await tu.remLabel( authData, td, issueData, label );
	testStatus = await tu.checkDemotedIssue( authData, ghLinks, td, dsPlan, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 2" );
	
	// 3. move to accr (untracked), watch it bounce back
	await tu.moveCard( authData, td, card.id, td.dsAccrID );
	await utils.sleep( tu.GH_DELAY );
	testStatus = await tu.checkDemotedIssue( authData, ghLinks, td, dsPlan, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 3" );
	
	// 4. move to pend, bounce
	await tu.moveCard( authData, td, card.id, td.dsPendID );
	await utils.sleep( tu.GH_DELAY );
	testStatus = await tu.checkDemotedIssue( authData, ghLinks, td, dsPlan, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 4" );
	
	// 5. move to prog (untracked), label
	await tu.moveCard( authData, td, card.id, td.dsProgID );
	await tu.addLabel( authData, td, issueData, label.name );
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, dsProg, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 5" );
	
	// 6. unlabel, label
	await tu.remLabel( authData, td, issueData, label, {depth: 2} );
	// second add can happen before del.  Then after del, label not found.  wait..
	await tu.settleWithVal( "LabelTest remove peqLabel", labNotInIssueHelp, authData, td, label.name, issueData[0] );
	// remLabel notice can be slow, and can defeat findNotice in this test since there are a chain of add/rem.
	// for now, add sleep.  if this arises again, consider a more permanent solution
	await utils.sleep( 2000 );
	
	await tu.addLabel( authData, td, issueData, label.name ); 
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, dsProg, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 6" );
	
	// 7. move to accr, unlabel (fail)
	await tu.addAssignee( authData, td, issueData, ASSIGNEE1 );   // can't ACCR without this.    
	await tu.moveCard( authData, td, card.id, td.dsAccrID, {issNum: issueData[1]} );
	await tu.remLabel( authData, td, issueData, label );          // will be added back
	// Assignee may be processed before relabel.. 
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, dsAccr, issueData, card, testStatus, {peqHolder: "maybe"} );
	tu.testReport( testStatus, "Label 7" );
    }	

    {
	// add two peq labels
	console.log( "Double-labels" );

	// 1. create 1k peq issue in bacon
	console.log( "Make newly situated issue in bacon" );
	let issueData = await tu.makeIssue( authData, td, ISS_LAB2, [] );     // [id, number, title] 
	let label     = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, kp, 1000 );
	await tu.addLabel( authData, td, issueData, label.name );
	let card  = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, bacon.colId, issueData[0] );

	testStatus = await tu.checkNewlySituatedIssue( authData, ghLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label Dub 1" );
	
	// 2. add "documentation" twice (fail - will not receive 2nd notification)
	let docLabel  = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, "documentation", -1 );	
	await tu.addLabel( authData, td, issueData, docLabel.name );
	await tu.addLabel( authData, td, issueData, docLabel.name );
	testStatus = await checkDubLabel( authData, ghLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label Dub 2" );
	
	// 3. add 500 peq (fail)
	let label500  = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, halfKP, 500 );	
	await tu.addLabel( authData, td, issueData, label500.name );
	testStatus = await checkDubLabel( authData, ghLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label Dub 3" );	

	console.log( "Double-labels done." );
	await utils.sleep( 5000 );


	console.log( "\nTest label/unlabel in flat projects structure" );
	
	// 1. unlabel
	await tu.remLabel( authData, td, issueData, docLabel );    
	await tu.remLabel( authData, td, issueData, label );
	testStatus = await tu.checkDemotedIssue( authData, ghLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label flat 1" );
	
	// 2. label
	await tu.addLabel( authData, td, issueData, label.name );    
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label flat 2" );

	// 3. close (should create pend/accr cols) (fail, no assignee)
	await tu.closeIssue( authData, td, issueData );
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label flat 3" );
	
	// 4. assign and close
	await tu.addAssignee( authData, td, issueData, ASSIGNEE1 );   // can't PEND without this.
	await tu.closeIssue( authData, td, issueData );
	await utils.sleep( 1000 );
	
	// get new cols/locs pend/accr
	const flatPend = await tu.getFlatLoc( authData, td.flatPID, td.flatTitle, config.PROJ_COLS[config.PROJ_PEND] );
	const flatAccr = await tu.getFlatLoc( authData, td.flatPID, td.flatTitle, config.PROJ_COLS[config.PROJ_ACCR] );
	// psub will be set when re-labeled in bacon above
	flatPend.projSub = [ td.flatTitle, td.col2Title ];
	flatAccr.projSub = [ td.flatTitle, td.col2Title ];
	
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, flatPend, issueData, card, testStatus );
	tu.testReport( testStatus, "Label flat 4" );
	
	// 5. unlabel (OK here, negotiating)
	await tu.remLabel( authData, td, issueData, label );    
	testStatus = await tu.checkDemotedIssue( authData, ghLinks, td, flatPend, issueData, card, testStatus );
	tu.testReport( testStatus, "Label flat 5" );

	// PEQ is rebuilt below, when it is re-activated.
	flatPend.projSub = [ td.flatTitle, config.PROJ_COLS[config.PROJ_PEND] ];
	flatAccr.projSub = [ td.flatTitle, config.PROJ_COLS[config.PROJ_ACCR] ];

	// 5. relabel (OK here, negotiating)
	await tu.addLabel( authData, td, issueData, label500.name );    
	// re-created peq, i.e. re-peq-labeled.  Gets assignees again.
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, flatPend, issueData, card, testStatus, {label: 500, assign: 1 } );
	tu.testReport( testStatus, "Label flat 6" );
	
	// 6. move to accr
	await tu.moveCard( authData, td, card.id, flatAccr.colId, {issNum: issueData[1]} );
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, flatAccr, issueData, card, testStatus, {label: 500, assign: 1 } );
	tu.testReport( testStatus, "Label flat 7" );
    }

    tu.testReport( testStatus, "Test Label" );
    return testStatus;
}

async function testAssignment( authData, ghLinks, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Assignment" );
    authData.who = "<TEST: Assign>";

    await tu.refreshRec( authData, td );
    await tu.refreshFlat( authData, td );
    await tu.refreshUnclaimed( authData, td );

    const ISS_ASS   = "AssignTest";
    const VERBOSE = true;
    const assPlan = await tu.getFullLoc( authData, td.softContTitle, td.dataSecPID, td.dataSecTitle, config.PROJ_COLS[config.PROJ_PLAN] );
    
    // 1. Create PEQ issue, add to proj
    const kp = "1000 " + config.PEQ_LABEL;
    console.log( "Make newly situated issue" );
    let assData = await tu.makeIssue( authData, td, ISS_ASS, [] );     // [id, number, title]  

    let newLabel = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, kp, 1000 );
    await tu.addLabel( authData, td, assData, newLabel.name );

    let assCard  = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, td.dsPlanID, assData[0] );
    testStatus = await tu.checkNewlySituatedIssue( authData, ghLinks, td, assPlan, assData, assCard, testStatus );

    if( VERBOSE ) { tu.testReport( testStatus, "A" ); }

    // 2. add assignee
    console.log( "Add assignees" );
    await tu.addAssignee( authData, td, assData, ASSIGNEE1 );
    await tu.addAssignee( authData, td, assData, ASSIGNEE2 );
    testStatus = await tu.checkAssignees( authData, td, [ASSIGNEE1, ASSIGNEE2], assData, testStatus );
    testStatus = await tu.checkPact( authData, ghLinks, td, ISS_ASS, config.PACTVERB_CONF, config.PACTACT_CHAN, "add assignee", testStatus );

    if( VERBOSE ) { tu.testReport( testStatus, "B" ); }

    // 3. remove assignees
    console.log( "Rem assignees" );
    await tu.remAssignee( authData, td, assData[1], ASSIGNEE1 );
    await tu.remAssignee( authData, td, assData[1], ASSIGNEE2 );
    testStatus = await tu.checkNoAssignees( authData, td, ASSIGNEE1, ASSIGNEE2, assData, testStatus );

    if( VERBOSE ) { tu.testReport( testStatus, "C" ); }
    
    // 4. add assignees
    console.log( "Add assignees" );
    await tu.addAssignee( authData, td, assData, ASSIGNEE1 );
    await tu.addAssignee( authData, td, assData, ASSIGNEE2 );

    // 5. move to Prog
    await tu.moveCard( authData, td, assCard.id, td.dsProgID, {issNum: assData[1]} );
    testStatus = await tu.checkProgAssignees( authData, td, ASSIGNEE1, ASSIGNEE2, assData, testStatus );

    // 6. test ACCR
    await tu.remAssignee( authData, td, assData[1], ASSIGNEE2 );
    // XXX HARSH.  If rem notification arrives late (out of order), CE will see "accr", then add assignee2 back after "d", then fail the next check.
    //     Can't check jobq, jobs already gone.  Can't check GH, it's in a good state.  No local state to check.. yet.....
    //     Impact only occurs when rem assignee right before rapid-fire close + accr, then assignee is added back in.  Low risk of occurence, but bad when it happens.
    //     11/22/21 2x
    await  utils.sleep( 10000 );

    await tu.closeIssue( authData, td, assData );

    // XXX HARSH.  If move to accrue notification arrives late, addAssignee will pass.  This is not expected to be an uncommon, fast sequence.
    //     3/8/21 fail, move notification is 8 seconds after assignment!
    //     Could settlewait here, but this issue is too important, allows someone to modify an accrued issue. 
    await tu.moveCard( authData, td, assCard.id, td.dsAccrID, {issNum: assData[1]} );
    await  utils.sleep( 10000 );
    // Add, fail
    await tu.addAssignee( authData, td, assData, ASSIGNEE2 );

    
    testStatus = await tu.checkAssignees( authData, td, [ASSIGNEE1], assData, testStatus );
    testStatus = await tu.checkPact( authData, ghLinks, td, ISS_ASS, config.PACTVERB_CONF, config.PACTACT_NOTE, "Bad assignment attempted", testStatus );

    if( VERBOSE ) { tu.testReport( testStatus, "D" ); }

    // Rem, fail
    await tu.remAssignee( authData, td, assData[1], ASSIGNEE1 );
    testStatus = await tu.checkAssignees( authData, td, [ASSIGNEE1], assData, testStatus );
    testStatus = await tu.checkPact( authData, ghLinks, td, ISS_ASS, config.PACTVERB_CONF, config.PACTACT_NOTE, "Bad assignment attempted", testStatus );
    
    tu.testReport( testStatus, "Test Assign" );
    return testStatus;
}

async function testLabelCarded( authData, ghLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Label Carded" );
    authData.who = "<TEST: Label Carded>";

    await tu.refreshRec( authData, td );
    await tu.refreshFlat( authData, td );
    await tu.refreshUnclaimed( authData, td );

    const bacon       = td.getBaconLoc();

    {    
	console.log( "Test label carded in flat" );

	// 1. make carded issue in bacon
	console.log( "Make carded issue" );
	const issueData = await tu.makeIssue( authData, td, ISS_LAB3, [] );     // [id, number, title] 
	const card      = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, bacon.colId, issueData[0] );
	testStatus      = await tu.checkUntrackedIssue( authData, ghLinks, td, bacon, issueData, card, testStatus );

	// 2. add label
	const kp = "1000 " + config.PEQ_LABEL;
	const label     = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, kp, 1000 );
	await tu.addLabel( authData, td, issueData, label.name );
	testStatus     = await tu.checkNewlySituatedIssue( authData, ghLinks, td, bacon, issueData, card, testStatus );
    }	

    tu.testReport( testStatus, "Test Label Carded" );
    return testStatus;
}

async function testCloseReopen( authData, ghLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Close Reopen" );
    authData.who = "<TEST: Close Reopen>";

    await tu.refreshRec( authData, td );
    await tu.refreshFlat( authData, td );
    await tu.refreshUnclaimed( authData, td );

    const bacon      = td.getBaconLoc();
    const eggs       = td.getEggsLoc();

    const kp = "1000 " + config.PEQ_LABEL;
    
    {
	console.log( "Open/close in flat" );
	// 0. make peq in bacon
	const label     = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, kp, 1000 );
	const issueData = await tu.makeIssue( authData, td, ISS_LAB4, [label] );     // [id, number, title] 
	const card      = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, bacon.colId, issueData[0] );
	testStatus     = await tu.checkNewlySituatedIssue( authData, ghLinks, td, bacon, issueData, card, testStatus );

	tu.testReport( testStatus, "A" );
	
	// 1. close
	await tu.addAssignee( authData, td, issueData, ASSIGNEE1 );
	await tu.settleWithVal( "Ensure assignee in place", assignPresentHelp, authData, td, issueData, ASSIGNEE1 );
	await tu.closeIssue( authData, td, issueData );
	await utils.sleep( 1000 );

	// get new cols/locs pend/accr
	const flatPend = await tu.getFlatLoc( authData, td.flatPID, td.flatTitle, config.PROJ_COLS[config.PROJ_PEND] );
	const flatAccr = await tu.getFlatLoc( authData, td.flatPID, td.flatTitle, config.PROJ_COLS[config.PROJ_ACCR] );
	// psub will be set when re-labeled in bacon above
	flatPend.projSub = [ td.flatTitle, td.col2Title ];
	flatAccr.projSub = [ td.flatTitle, td.col2Title ];
	
	testStatus = await tu.checkNewlyClosedIssue( authData, ghLinks, td, flatPend, issueData, card, testStatus, {peqHolder: "maybe"} );
	
	tu.testReport( testStatus, "B" );
	
	// 2. close again (no change - this will NOT generate a notification, or PAct)
	await tu.closeIssue( authData, td, issueData );
	testStatus = await tu.checkNewlyClosedIssue( authData, ghLinks, td, flatPend, issueData, card, testStatus, {peqHolder: "maybe"} );
	
	tu.testReport( testStatus, "C" );

	// Erm.  Simulate ceFlutter processing to ingest propose:accrue, else won't see bacon col in step 3
	// await tu.ingestPActs( authData, issueData );
	
	// 3. Reopen
	await tu.reopenIssue( authData, td, issueData[1] );
	testStatus = await tu.checkNewlyOpenedIssue( authData, ghLinks, td, bacon, issueData, card, testStatus );
	
	tu.testReport( testStatus, "D" );

	// 4. Reopen again (fail)
	await tu.reopenIssue( authData, td, issueData[1] );
	testStatus = await tu.checkNewlyOpenedIssue( authData, ghLinks, td, bacon, issueData, card, testStatus );
	
	tu.testReport( testStatus, "E" );

	// 5. move to eggs
	await tu.moveCard( authData, td, card.id, eggs.colId, {issNum: issueData[1]} );
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, eggs, issueData, card, testStatus, {"state": "open" } );

	tu.testReport( testStatus, "F" );
	
	// 6. close
	await tu.closeIssue( authData, td, issueData );
	testStatus = await tu.checkNewlyClosedIssue( authData, ghLinks, td, flatPend, issueData, card, testStatus, {peqHolder: "maybe"} );
	
	tu.testReport( testStatus, "G" );

	// 7. reopen
	await tu.reopenIssue( authData, td, issueData[1] );
	testStatus = await tu.checkNewlyOpenedIssue( authData, ghLinks, td, eggs, issueData, card, testStatus );
	
	tu.testReport( testStatus, "H" );

	// 8. close
	await tu.closeIssue( authData, td, issueData );
	testStatus = await tu.checkNewlyClosedIssue( authData, ghLinks, td, flatPend, issueData, card, testStatus, {peqHolder: "maybe"} );
	
	tu.testReport( testStatus, "I" );

	// 9. move to accr
	await tu.moveCard( authData, td, card.id, flatAccr.colId, {issNum: issueData[1]} );
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, flatAccr, issueData, card, testStatus, {"state": "closed" } );

	tu.testReport( testStatus, "J" );
	
	// 10. reopen (fail)
	await tu.reopenIssue( authData, td, issueData[1] );
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, flatAccr, issueData, card, testStatus, {"state": "closed" } );

	tu.testReport( testStatus, "K" );

	// 10. move to PEND (fail)
	await tu.moveCard( authData, td, card.id, flatPend.colId );
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, flatAccr, issueData, card, testStatus, {"state": "closed" } );

	tu.testReport( testStatus, "L" );
    }	

    {
	console.log( "\n\nOpen/close in full++" );

	const stars      = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, "Stars" );
	const stripes    = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, "Stripes" );

	const ghoProg = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PROG] );
	const ghoPend = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PEND] );
	const ghoAccr = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_ACCR] );

	// peqs are out of date (need ingesting) by the time these are used.
	ghoPend.projSub = stars.projSub;
	ghoAccr.projSub = stars.projSub;
	
	// 0. make peq in stars
	const label     = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, kp, 1000 );
	const issueData = await tu.makeIssue( authData, td, ISS_LAB4, [label] );     // [id, number, title] 
	const card      = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, stars.colId, issueData[0] );
	testStatus     = await tu.checkNewlySituatedIssue( authData, ghLinks, td, stars, issueData, card, testStatus );

	tu.testReport( testStatus, "A" );
	
	// 1. close
	await tu.addAssignee( authData, td, issueData, ASSIGNEE1 );	
	await tu.closeIssue( authData, td, issueData );
	testStatus = await tu.checkNewlyClosedIssue( authData, ghLinks, td, ghoPend, issueData, card, testStatus );
	
	tu.testReport( testStatus, "B" );

	// 2  Simulate ceFlutter processing to ingest propose:accrue, else won't see stars col in step 3
	// await tu.ingestPActs( authData, issueData );
	
	// 3. Reopen
	await tu.reopenIssue( authData, td, issueData[1] );
	testStatus = await tu.checkNewlyOpenedIssue( authData, ghLinks, td, stars, issueData, card, testStatus );
	
	tu.testReport( testStatus, "C" );

	// 4. move to stripes
	await tu.moveCard( authData, td, card.id, stripes.colId, {issNum: issueData[1]} );
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, stripes, issueData, card, testStatus );

	tu.testReport( testStatus, "D" );
	
	// 5. close
	await tu.closeIssue( authData, td, issueData );
	testStatus = await tu.checkNewlyClosedIssue( authData, ghLinks, td, ghoPend, issueData, card, testStatus );
	
	tu.testReport( testStatus, "E" );

	// 6. reopen
	await tu.reopenIssue( authData, td, issueData[1] );
	testStatus = await tu.checkNewlyOpenedIssue( authData, ghLinks, td, stripes, issueData, card, testStatus );
	
	tu.testReport( testStatus, "F" );

	// 7. close
	await tu.closeIssue( authData, td, issueData );
	testStatus = await tu.checkNewlyClosedIssue( authData, ghLinks, td, ghoPend, issueData, card, testStatus );
	
	tu.testReport( testStatus, "G" );

	// 8. move to accr
	await tu.moveCard( authData, td, card.id, ghoAccr.colId, {issNum: issueData[1]} );
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, ghoAccr, issueData, card, testStatus );

	tu.testReport( testStatus, "H" );
    }

    
    tu.testReport( testStatus, "Test Close Reopen" );
    return testStatus;
}


// create in place?  Yes, major mode.  
// PROG PEND ACCR create/delete newborn, carded, situated.
async function testCreateDelete( authData, ghLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Create Delete" );
    authData.who = "<TEST: Create Delete>";
    
    const ISS_NEWB = "Newborn";
    const ISS_CRDD = "Carded"; 
    const ISS_SITU = "Situated"; 

    await tu.refreshRec( authData, td );
    await tu.refreshFlat( authData, td );
    await tu.refreshUnclaimed( authData, td );

    const ghoProg = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PROG] );
    const ghoPend = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PEND] );
    const ghoAccr = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_ACCR] );

    const stars      = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, "Stars" );
    const stripes    = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, "Stripes" );

    const kp = "1000 " + config.PEQ_LABEL;    
    {
	console.log( "\nNewborn testing" );

	const ISS_FLAT = ISS_NEWB + " Flat";
	const ISS_PROG = ISS_NEWB + " In Progress";
	const ISS_PEND = ISS_NEWB + " Pending";
	const ISS_ACCR = ISS_NEWB + " Accrued";

	// 0. make newborns
	const cardIdFlat  = await tu.makeNewbornCard( authData, ghLinks, td.CEProjectId, td.GHFullName, stars.colId, ISS_FLAT );
	const cardIdProg  = await tu.makeNewbornCard( authData, ghLinks, td.CEProjectId, td.GHFullName, ghoProg.colId, ISS_PROG );
	const cardIdPend  = await tu.makeNewbornCard( authData, ghLinks, td.CEProjectId, td.GHFullName, ghoPend.colId, ISS_PEND );
	const cardIdAccr  = await tu.makeNewbornCard( authData, ghLinks, td.CEProjectId, td.GHFullName, ghoAccr.colId, ISS_ACCR );
	testStatus     = await tu.checkNewbornCard( authData, ghLinks, td, stars, cardIdFlat, ISS_FLAT, testStatus );
	testStatus     = await tu.checkNewbornCard( authData, ghLinks, td, ghoProg, cardIdProg, ISS_PROG, testStatus );
	testStatus     = await tu.checkNoCard( authData, ghLinks, td, ghoPend, cardIdPend, ISS_PEND, testStatus );
	testStatus     = await tu.checkNoCard( authData, ghLinks, td, ghoAccr, cardIdAccr, ISS_ACCR, testStatus );

	// 2. remove them.
	await tu.remCard( authData, cardIdFlat );
	await tu.remCard( authData, cardIdProg );
	testStatus     = await tu.checkNoCard( authData, ghLinks, td, stars, cardIdFlat, ISS_FLAT, testStatus );
	testStatus     = await tu.checkNoCard( authData, ghLinks, td, ghoProg, cardIdProg, ISS_PROG, testStatus );

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
	const issDatFlat = await tu.makeIssue( authData, td, ISS_FLAT, [] );     
	const issDatProg = await tu.makeIssue( authData, td, ISS_PROG, [] );
	const issDatPend = await tu.makeIssue( authData, td, ISS_PEND, [] );
	const issDatAccr = await tu.makeIssue( authData, td, ISS_ACCR, [] );

	const flatCard   = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, stars.colId,   issDatFlat[0] );
	const progCard   = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, ghoProg.colId, issDatProg[0] );
	const pendCard   = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, ghoPend.colId, issDatPend[0] );
	const accrCard   = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, ghoAccr.colId, issDatAccr[0] );

	testStatus     = await tu.checkUntrackedIssue( authData, ghLinks, td, stars,   issDatFlat, flatCard, testStatus );
	testStatus     = await tu.checkUntrackedIssue( authData, ghLinks, td, ghoProg, issDatProg, progCard, testStatus );
	testStatus     = await tu.checkNoCard( authData, ghLinks, td, ghoPend, pendCard.id, ISS_PEND, testStatus );
	testStatus     = await tu.checkNoCard( authData, ghLinks, td, ghoAccr, accrCard.id, ISS_ACCR, testStatus );

	tu.testReport( testStatus, "carded A" );

	// 2. remove them.
	await tu.remCard( authData, flatCard.id );             // remove card, then issue
	await tu.remIssue( authData, td, issDatFlat[0] );
	await tu.remIssue( authData, td, issDatProg[0] ); // just remove issue
	
	testStatus     = await tu.checkNoCard( authData, ghLinks, td, stars,   flatCard.id, ISS_FLAT, testStatus );
	// XXX This will exist until GH gets it back together.  See 6/8/2022 notes.	
	// testStatus     = await tu.checkNoCard( authData, ghLinks, td, ghoProg, progCard.id, ISS_PROG, testStatus );

	tu.testReport( testStatus, "carded B" );
    }
    
    {
	// note: pend never closes here (not assigned).  But, there is no PEND delete logic in the handlers.
	console.log( "Situated testing" );

	const ISS_FLAT = ISS_SITU + " Flat";
	const ISS_PROG = ISS_SITU + " In Progress";
	const ISS_PEND = ISS_SITU + " Pending";
	const ISS_ACCR = ISS_SITU + " Accrued";

	// 0. make situated issues
	const label     = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, kp, 1000 );	
	const issDatFlat = await tu.makeIssue( authData, td, ISS_FLAT, [label] );     
	const issDatProg = await tu.makeIssue( authData, td, ISS_PROG, [label] );
	const issDatPend = await tu.makeIssue( authData, td, ISS_PEND, [label] );
	const issDatAccr = await tu.makeIssue( authData, td, ISS_ACCR, [label] );

	const flatCard   = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, stars.colId,   issDatFlat[0] );
	const progCard   = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, ghoProg.colId, issDatProg[0] );
	const pendCard   = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, ghoPend.colId, issDatPend[0] );
	const accrCard   = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, ghoAccr.colId, issDatAccr[0] );

	testStatus = await tu.checkNewlySituatedIssue( authData, ghLinks, td, stars,   issDatFlat, flatCard, testStatus );
	testStatus = await tu.checkNewlySituatedIssue( authData, ghLinks, td, ghoProg, issDatProg, progCard, testStatus );
	testStatus = await tu.checkNewlySituatedIssue( authData, ghLinks, td, ghoPend, issDatPend, pendCard, testStatus );
	testStatus = await tu.checkNoCard( authData, ghLinks, td, ghoAccr, accrCard.id, ISS_ACCR, testStatus, {"peq": true} );

	tu.testReport( testStatus, "situated A" );
	
	// 2. remove them.
	await tu.remIssue( authData, td, issDatFlat[0] );
	await tu.remIssue( authData, td, issDatProg[0] ); 
	await tu.remIssue( authData, td, issDatPend[0] );

	testStatus     = await tu.checkNoCard( authData, ghLinks, td, stars,   flatCard.id, ISS_FLAT, testStatus, {"peq": true} );
	testStatus     = await tu.checkNoCard( authData, ghLinks, td, ghoProg, progCard.id, ISS_PROG, testStatus, {"peq": true} );
	testStatus     = await tu.checkNoCard( authData, ghLinks, td, ghoPend, pendCard.id, ISS_PEND, testStatus, {"peq": true} );

	tu.testReport( testStatus, "situated B" );
    }
    
    {
	console.log( "Delete Accrued testing" );

	const ISS_AGHO1 = ISS_SITU + " Accrued card1st";
	const ISS_AGHO2 = ISS_SITU + " Accrued iss1st";

	// 0. make situated issues
	const label      = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, kp, 1000 );	
	const issDatAgho1 = await tu.makeIssue( authData, td, ISS_AGHO1, [label] );
	const issDatAgho2 = await tu.makeIssue( authData, td, ISS_AGHO2, [label] );

	// Assign.
	await tu.addAssignee( authData, td, issDatAgho1, ASSIGNEE1 );	
	await tu.addAssignee( authData, td, issDatAgho2, ASSIGNEE1 );	

	// add to gho pend
	const aghoCard1   = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, ghoPend.colId, issDatAgho1[0] );
	const aghoCard2   = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, ghoPend.colId, issDatAgho2[0] );

	// Close
	await tu.closeIssue( authData, td, issDatAgho1, ghoPend );
	await tu.closeIssue( authData, td, issDatAgho2, ghoPend );

	// Accrue
	await tu.moveCard( authData, td, aghoCard1.id, ghoAccr.colId, {issNum: issDatAgho1[1]} );
	await tu.moveCard( authData, td, aghoCard2.id, ghoAccr.colId, {issNum: issDatAgho2[1]} );

	await utils.sleep( 1000 );
	// Often unneeded, but useful if doing this as a one-off test
	await tu.refreshUnclaimed( authData, td );
	// peqHolder maybe to allow more careful assign test in checkNewly to take place, instead of using checkSit
	// if gh assignment occurs fast, and ceServer label notification processing is slow, processNewPeq will see gh.getAssignees before
	// recording first aws PEQ.
	testStatus = await tu.checkNewlyAccruedIssue( authData, ghLinks, td, ghoAccr, issDatAgho1, aghoCard1, testStatus, {preAssign: 1, peqHolder: "maybe"} );
	testStatus = await tu.checkNewlyAccruedIssue( authData, ghLinks, td, ghoAccr, issDatAgho2, aghoCard2, testStatus, {preAssign: 1, peqHolder: "maybe"} );

	tu.testReport( testStatus, "accrued A" );
	
	// 2. remove them 1s with del card, remove 2s with del issue
	await tu.remCard( authData, aghoCard1.id );
	await tu.remIssue( authData, td, issDatAgho2[0] );

	await utils.sleep( 2000 );

	// get newly created issue, cards.   card only for remCard, issue and card for remIssue
	const uncAccr = await tu.getFlatLoc( authData, td.unclaimPID, config.UNCLAIMED, config.PROJ_COLS[config.PROJ_ACCR] );
	const newIss = await tu.findIssueByName( authData, td, issDatAgho2[2] );
	const aghoIss2New = [newIss.id, newIss.number, newIss.title];

	// XXX Sometimes this checks too quickly, then checkUnc can not pick up the new card.  better..
	// let uCards = await tu.getCards( authData, uncAccr.colId );
	// aghoCard1New = uCards.find( card => card.content_url.split('/').pop() == issDatAgho1[1].toString() );
	// aghoCard2New = uCards.find( card => card.content_url.split('/').pop() == aghoIss2New[1].toString() );
	aghoCard1New = await tu.settleWithVal( "Get new card", getCardHelp, authData, uncAccr.colId, issDatAgho1[1].toString(), testStatus );
	aghoCard2New = await tu.settleWithVal( "Get new card", getCardHelp, authData, uncAccr.colId, aghoIss2New[1].toString(), testStatus );
	
	// card: old issue, new card.  issue: new issue, new card
	// peq for remCard is active for old issue.  peq for remIssue is active for new issue.
	testStatus = await tu.checkUnclaimedAccr( authData, ghLinks, td, uncAccr, issDatAgho1, issDatAgho1, aghoCard1New, testStatus, "card" );
	testStatus = await tu.checkUnclaimedAccr( authData, ghLinks, td, uncAccr, issDatAgho2, aghoIss2New, aghoCard2New, testStatus, "issue" );  

	// Old stuff wont be present
	testStatus = await tu.checkNoCard( authData, ghLinks, td, uncAccr, aghoCard1.id, ISS_AGHO1, testStatus, {"skipAllPeq": true} );  
	testStatus = await tu.checkNoIssue( authData, ghLinks, td, issDatAgho2, testStatus );
	testStatus = await tu.checkNoCard( authData, ghLinks, td, uncAccr, aghoCard2.id, ISS_AGHO2, testStatus, {"skipAllPeq": true} );  
	tu.testReport( testStatus, "accrued B" );

	// 3. Remove one more time
	await tu.remCard( authData, aghoCard1New.id );      // newborn
	await tu.remIssue( authData, td, aghoIss2New[0]);   // gone

	testStatus = await tu.checkNewbornIssue( authData, ghLinks, td, issDatAgho1, testStatus );
	testStatus = await tu.checkNoCard( authData, ghLinks, td, uncAccr, aghoCard1New.id, ISS_AGHO1, testStatus, {"peq": true} );
	testStatus = await tu.checkPact( authData, ghLinks, td, ISS_AGHO1, config.PACTVERB_CONF, config.PACTACT_NOTE, "Disconnected issue", testStatus );

	testStatus = await tu.checkNoIssue( authData, ghLinks, td, aghoIss2New, testStatus );
	testStatus = await tu.checkNoCard( authData, ghLinks, td, uncAccr, aghoCard2New.id, ISS_AGHO2, testStatus, {"peq": true} );
	tu.testReport( testStatus, "accrued C" );
    }
    
    tu.testReport( testStatus, "Test Create Delete" );

    return testStatus;
}

async function getCardHelp( authData, colId, cardName, testStatus ) {
    let uCards = await tu.getCards( authData, colId );
    const card = uCards.find( card => card.content_url.split('/').pop() == cardName );
    return card;
}

async function labHelp( authData, td, getName, checkName, descr, testStatus ) {
    let subTest  = [ 0, 0, []];    
    let labelRes = await gh.getLabel( authData, td.GHOwner, td.GHRepo, getName );
    let label    = labelRes.label;
    subTest      = await tu.checkLabel( authData, label, checkName, descr, subTest );

    return await tu.settle( subTest, testStatus, labHelp, authData, td, getName, checkName, descr, testStatus );
}

async function getLabHelp( authData, td, name ) {
    const labelRes = await gh.getLabel( authData, td.GHOwner, td.GHRepo, name );
    return labelRes.label;
}

async function issueClosedHelp( authData, td, issId ) {
    let iss = await tu.findIssue( authData, td, issId );
    return iss.state == 'closed'; 
}

async function labNotInIssueHelp( authData, td, labName, issId ) {
    let retVal = true;
    let accrIss = await tu.findIssue( authData, td, issId );
    for( const lab of accrIss.labels ) {
	if( lab.name == labName ) {
	    retVal = false;
	    break;
	}
    }
    return retVal;
}

async function assignPresentHelp( authData, td, issDat, assignee ) {
    let retVal = false;

    let iss = await tu.findIssue( authData, td, issDat[0] );
    let ass = iss.assignees.find( a => a.login == assignee );
    if( typeof ass !== 'undefined' ) { retVal = true; }

    return retVal;
}

// edit, delete peq labels for open, pend and accr issues.  test a non-peq.
async function testLabelMods( authData, ghLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Label Mods" );
    authData.who = "<TEST: Label Mods>";
    
    const ISS_NEWB = "LM Newborn";
    const ISS_PLAN = "LM Open";
    const ISS_PEND = "LM Pending";
    const ISS_ACCR = "LM Accrued";

    const LAB1     = "501 " + config.PEQ_LABEL;    
    const LABNP1   = "nonPeq1";
    const LABNP2   = "nonPeq2";
    
    await tu.refreshRec( authData, td );
    await tu.refreshFlat( authData, td );

    const ghoPlan = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PLAN] );
    const ghoPend = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PEND] );
    const ghoAccr = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_ACCR] );

    {
	// 1. Setup
	console.log( "\nMake labels, issues" );
	let lab1   = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, LAB1, 501 );
	let labNP1 = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, LABNP1, -1 );	
	let labNP2 = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, LABNP2, -1 );	

	const issNewbDat = await tu.makeIssue( authData, td, ISS_NEWB, [labNP1] );                // [id, number, title] 
	const issPlanDat = await tu.makeIssue( authData, td, ISS_PLAN, [LAB1, labNP1, labNP2] );  
	const issPendDat = await tu.makeIssue( authData, td, ISS_PEND, [LAB1, labNP1, labNP2] );     
	const issAccrDat = await tu.makeIssue( authData, td, ISS_ACCR, [LAB1, labNP1, labNP2] );     

	// First unclaimed creation takes a sec
	await utils.sleep( 1000 );
	
	// Need assignees for pend/accr. 
	await tu.addAssignee( authData, td, issPendDat, ASSIGNEE1 );	
	await tu.addAssignee( authData, td, issPendDat, ASSIGNEE2 );	
	await tu.addAssignee( authData, td, issAccrDat, ASSIGNEE2 );

	// Set up cards
	const cardPlan = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, ghoPlan.colId, issPlanDat[0] );
	const cardPend = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, ghoPlan.colId, issPendDat[0] );
	const cardAccr = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, ghoPlan.colId, issAccrDat[0] );

	// Close & accrue
	await tu.closeIssue( authData, td, issPendDat );
	await tu.closeIssue( authData, td, issAccrDat, ghoPend, cardAccr );
	await tu.moveCard( authData, td, cardAccr.id, ghoAccr.colId, {issNum: issAccrDat[1]} );

	await utils.sleep( 2000 );	
	testStatus = await tu.checkNewbornIssue( authData, ghLinks, td, issNewbDat, testStatus, {lblCount: 1} );
	testStatus = await tu.checkNewlySituatedIssue( authData, ghLinks, td, ghoPlan, issPlanDat, cardPlan, testStatus, {label: 501, lblCount: 3} );
	testStatus = await tu.checkNewlyClosedIssue( authData, ghLinks, td, ghoPend, issPendDat, cardPend, testStatus, {label: 501, lblCount: 3} );
	testStatus = await tu.checkNewlyAccruedIssue( authData, ghLinks, td, ghoAccr, issAccrDat, cardAccr, testStatus, {label: 501, lblCount: 3} );

	tu.testReport( testStatus, "Label mods A" );

	// 2. Mod newborn label, label should be as modded.
	console.log( "Mod newborn label" );
	await tu.updateLabel( authData, td, labNP1, {name: "newName", description: "newDesc"} );
	testStatus = await labHelp( authData, td, "newName", "newName", "newDesc", testStatus );
	tu.testReport( testStatus, "Label mods B" );
	
	// 3. delete np2, should no longer find it.
	console.log( "Remove nonPeq(2) label" );
	await tu.delLabel( authData, td, labNP2.name );
	testStatus = await labHelp( authData, td, LABNP2, -1, -1, testStatus );
	tu.testReport( testStatus, "Label mods C" );

	// 4. Edit lab1 name, fail and create new
	console.log( "Mod peq label name" );
	const smallKP = "51 " + config.PEQ_LABEL;    
	await tu.updateLabel( authData, td, lab1, {name: smallKP} );

	testStatus = await labHelp( authData, td, LAB1, LAB1, "PEQ value: 501", testStatus );
	testStatus = await labHelp( authData, td, smallKP, smallKP, "PEQ value: 51", testStatus );
	testStatus = await tu.checkPact( authData, ghLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_NOTE, "PEQ label edit attempt", testStatus );	
	testStatus = await tu.checkNewlySituatedIssue( authData, ghLinks, td, ghoPlan, issPlanDat, cardPlan, testStatus, {label: 501, lblCount: 2} );
	testStatus = await tu.checkNewlyAccruedIssue( authData, ghLinks, td, ghoAccr, issAccrDat, cardAccr, testStatus, {label: 501, lblCount: 2} );	
	tu.testReport( testStatus, "Label mods D" );

	// 5. Edit lab1 descr, fail
	console.log( "Mod peq label descr" );
	await tu.updateLabel( authData, td, lab1, {description: "PEQ value: 51"} );

	testStatus = await labHelp( authData, td, LAB1, LAB1, "PEQ value: 501", testStatus );
	testStatus = await tu.checkPact( authData, ghLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_NOTE, "PEQ label edit attempt", testStatus );	
	tu.testReport( testStatus, "Label mods E" );

	// 6. Edit lab1 all, fail & create new
	console.log( "Mod peq label name,descr" );
	const small52KP = "52 " + config.PEQ_LABEL;
	await tu.updateLabel( authData, td, lab1, {name: small52KP,  description: "PEQ value: 52"} );
	
	testStatus = await labHelp( authData, td, LAB1, LAB1, "PEQ value: 501", testStatus );
	testStatus = await labHelp( authData, td, small52KP, small52KP, "PEQ value: 52", testStatus );
	testStatus = await tu.checkPact( authData, ghLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_NOTE, "PEQ label edit attempt", testStatus );	
	tu.testReport( testStatus, "Label mods F" );

	// 7. Delete lab1, fail
	console.log( "Delete peq label" );
	await tu.delLabel( authData, td, lab1.name );

	testStatus = await labHelp( authData, td, LAB1, LAB1, "PEQ value: 501", testStatus );	
	testStatus = await tu.checkPact( authData, ghLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_NOTE, "PEQ label delete attempt", testStatus );	
	testStatus = await tu.checkNewlySituatedIssue( authData, ghLinks, td, ghoPlan, issPlanDat, cardPlan, testStatus, {label: 501, lblCount: 2} );
	testStatus = await tu.checkNewlyAccruedIssue( authData, ghLinks, td, ghoAccr, issAccrDat, cardAccr, testStatus, {label: 501, lblCount: 2} );	
	tu.testReport( testStatus, "Label mods G" );

	// 8. Make partial peq label.  Three will be unlabeled (can't have 2 peq labels), one will remain.
	console.log( "Make partial peq label" );
	const pl105 = "105 " + config.PEQ_LABEL;

	labNP1 = await tu.settleWithVal( "Label mods newName", getLabHelp, authData, td, "newName" );
	await tu.updateLabel( authData, td, labNP1, {name: pl105, description: "newDesc"} );

	testStatus = await labHelp( authData, td, pl105, pl105, "PEQ value: 105", testStatus );	
	tu.testReport( testStatus, "Label mods H" );

	
	// Clean
	// NOTE: if delete before update-driven LM Accrued remove label is complete, will see server error 404.
	//       update label above drives a bunch of asynch unwaited-for labelings.  So, wait until can't see issue's label any longer (i.e. remove is done)
	await tu.settleWithVal( "LabelMods remove from lmAccr", labNotInIssueHelp, authData, td, pl105, issAccrDat[0] );
	await tu.delLabel( authData, td, pl105 );
	
    }
    
    
    tu.testReport( testStatus, "Label Mod" );

    return testStatus;
}

// edit proj / col names
async function testProjColMods( authData, ghLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test ProjCol Mods" );
    authData.who = "<TEST: ProjCol Mods>";
    
    const ISS_PLAN = "PC Open";
    const ISS_PEND = "PC Pending";
    const ISS_ACCR = "PC Accrued";
    const PROJ_NAME = "ProjCol Proj";

    const planName = config.PROJ_COLS[config.PROJ_PLAN];
    const pendName = config.PROJ_COLS[config.PROJ_PEND];
    const accrName = config.PROJ_COLS[config.PROJ_ACCR];

    const kp = "1000 " + config.PEQ_LABEL;
    {
	// 1. Setup.  New project. full cols. 1 peq issue each.
	const projId    = await tu.makeProject( authData, td, PROJ_NAME, "" );
	const planColId = await tu.makeColumn( authData, ghLinks, td.CEProjectId, td.GHFullName, projId, planName );
	const pendColId = await tu.makeColumn( authData, ghLinks, td.CEProjectId, td.GHFullName, projId, pendName );
	const accrColId = await tu.makeColumn( authData, ghLinks, td.CEProjectId, td.GHFullName, projId, accrName );

	const planLoc = await tu.getFlatLoc( authData, projId, PROJ_NAME, planName );
	const pendLoc = await tu.getFlatLoc( authData, projId, PROJ_NAME, pendName );
	const accrLoc = await tu.getFlatLoc( authData, projId, PROJ_NAME, accrName );

	let label1k  = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, kp, 1000 );	

	const issPlanDat = await tu.makeIssue( authData, td, ISS_PLAN, [ label1k ] );
	const issPendDat = await tu.makeIssue( authData, td, ISS_PEND, [ label1k ] );
	const issAccrDat = await tu.makeIssue( authData, td, ISS_ACCR, [ label1k ] );

	// First unclaimed creation takes a sec
	await utils.sleep( 1000 );
	
	// Need assignees for pend/accr. 
	await tu.addAssignee( authData, td, issPendDat, ASSIGNEE2 );	
	await tu.addAssignee( authData, td, issAccrDat, ASSIGNEE1 );

	// Set up cards
	const cardPlan = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, planLoc.colId, issPlanDat[0] );
	const cardPend = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, planLoc.colId, issPendDat[0] );
	const cardAccr = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, planLoc.colId, issAccrDat[0] );

	// Close & accrue
	await tu.closeIssue( authData, td, issPendDat );
	await tu.closeIssue( authData, td, issAccrDat, pendLoc );
	// closeIssue returns only after notice seen.  but notice-job can be demoted.  be extra sure.
	await tu.settleWithVal( "closeIssue", issueClosedHelp, authData, td, issAccrDat[0] );	
	await tu.moveCard( authData, td, cardAccr.id, accrLoc.colId, {issNum: issAccrDat[1]} );

	await utils.sleep( 2000 );	
	testStatus = await tu.checkNewlySituatedIssue( authData, ghLinks, td, planLoc, issPlanDat, cardPlan, testStatus );
	testStatus = await tu.checkNewlyClosedIssue(   authData, ghLinks, td, pendLoc, issPendDat, cardPend, testStatus, {peqHolder: "maybe"} );
	testStatus = await tu.checkNewlyAccruedIssue(  authData, ghLinks, td, accrLoc, issAccrDat, cardAccr, testStatus, {peqHolder: "maybe"} );

	tu.testReport( testStatus, "ProjCol mods A" );

	// 2. Edit plan column.
	console.log( "Mod Plan col" );
	await tu.updateColumn( authData, planLoc.colId, "New plan name" );
	planLoc.colName = "New plan name";
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, planLoc, issPlanDat, cardPlan, testStatus );
	testStatus = await tu.checkPact( authData, ghLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_CHAN, "Column rename", testStatus, {sub:[planLoc.colId.toString(), planName, "New plan name" ]} );

	tu.testReport( testStatus, "ProjCol mods B" );

	// 3. Edit pend, accr column.  fail, reserved.
	console.log( "Mod Pend col" );
	await tu.updateColumn( authData, pendLoc.colId, "New pend name" );
	await tu.updateColumn( authData, accrLoc.colId, "New accr name" );
	// do not update locs, nothing should have changed.
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, pendLoc, issPendDat, cardPend, testStatus );
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, accrLoc, issAccrDat, cardAccr, testStatus );
	testStatus = await tu.checkPact( authData, ghLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_NOTE, "Column rename attempted", testStatus, {sub:[accrName]} );	
	
	tu.testReport( testStatus, "ProjCol mods C" );

	// 4. Edit proj name.
	console.log( "Mod Proj Name" );
	const newProjName = "New " + PROJ_NAME;
	await tu.updateProject( authData, projId, newProjName );
	planLoc.projName = newProjName;
	pendLoc.projName = newProjName;
	accrLoc.projName = newProjName;
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, planLoc, issPlanDat, cardPlan, testStatus );
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, pendLoc, issPendDat, cardPend, testStatus );
	testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, accrLoc, issAccrDat, cardAccr, testStatus );
	testStatus = await tu.checkPact( authData, ghLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_CHAN, "Project rename", testStatus, {sub:[projId.toString(), PROJ_NAME, newProjName]} );	
    }
    
    
    tu.testReport( testStatus, "Test ProjCol Mod" );

    return testStatus;
}


// Alloc basic create from card or issue, assign, split with x4 prevent tested in setup and populate.
// Here, check  move, dubLabel, label mods, close/reopen, create/delete
async function testAlloc( authData, ghLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Alloc" );
    authData.who = "<TEST: Alloc>";
    
    const ISS_ALLOC = "Component Alloc";
    const ASSIGNEE2 = "codeequity";

    await tu.refreshRec( authData, td );
    await tu.refreshFlat( authData, td );

    // 1. Setup.
    let ap1m = "1000000 " + config.ALLOC_LABEL;
    let label1m  = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, true, ap1m, 1000000 );
    let label2m  = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, true, "2000000 " + config.ALLOC_LABEL, 2000000 );
    let label1k  = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, "1000 "   + config.PEQ_LABEL, 1000 );
    let labelBug = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, "bug", -1 );

    const issAllocDat = await tu.makeAllocIssue( authData, td, ISS_ALLOC, [ label1m ] );

    const starLoc   = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, "Stars" );
    const stripeLoc = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, "Stripes" );
    const progLoc   = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PROG] );
    const accrLoc   = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_ACCR] );

    // NOTE: assignee added after makeIssue - will not show up
    await tu.addAssignee( authData, td, issAllocDat, ASSIGNEE2 );
    const cardAlloc = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, starLoc.colId, issAllocDat[0] );

    await utils.sleep( 2000 ); 
    testStatus = await tu.checkAlloc( authData, ghLinks, td, starLoc, issAllocDat, cardAlloc, testStatus, { lblCount: 1, val: 1000000} );
    
    tu.testReport( testStatus, "Alloc setup" );

    
    // Move to stripe OK, not prog/accr
    {
	await tu.moveCard( authData, td, cardAlloc.id, stripeLoc.colId, {issNum: issAllocDat[1]} );

	// Peq is now out of date.  Change stripeLoc psub to fit.
	stripeLoc.projSub[2] = "Stars";
	
	testStatus = await tu.checkAlloc( authData, ghLinks, td, stripeLoc, issAllocDat, cardAlloc, testStatus, {lblCount: 1} );

	await tu.moveCard( authData, td, cardAlloc.id, progLoc.colId );   // FAIL
	testStatus = await tu.checkAlloc( authData, ghLinks, td, stripeLoc, issAllocDat, cardAlloc, testStatus, {lblCount: 1} );

	await tu.moveCard( authData, td, cardAlloc.id, accrLoc.colId );   // FAIL
	testStatus = await tu.checkAlloc( authData, ghLinks, td, stripeLoc, issAllocDat, cardAlloc, testStatus, {lblCount: 1} );

	tu.testReport( testStatus, "Alloc A" );
    }

    // Dub label
    {
	await tu.addLabel( authData, td, issAllocDat, labelBug.name );
	testStatus = await tu.checkAlloc( authData, ghLinks, td, stripeLoc, issAllocDat, cardAlloc, testStatus, {lblCount: 2} );
	
	await tu.addLabel( authData, td, issAllocDat, label2m.name );  // FAIL
	testStatus = await tu.checkAlloc( authData, ghLinks, td, stripeLoc, issAllocDat, cardAlloc, testStatus, {lblCount: 2} );

	await tu.addLabel( authData, td, issAllocDat, label1k.name );  // FAIL
	testStatus = await tu.checkAlloc( authData, ghLinks, td, stripeLoc, issAllocDat, cardAlloc, testStatus, {lblCount: 2} );

	tu.testReport( testStatus, "Alloc B" );
    }

    // Label mods
    {
	// Mod label2m, success
	let ap100 = "100 "  + config.ALLOC_LABEL;
	let ap2k  = "2000 " + config.ALLOC_LABEL;
	let labelRes = {};
	await tu.updateLabel( authData, td, label2m, {name: ap100 });
	testStatus = await labHelp( authData, td, ap100, ap100, "Allocation PEQ value: 100", testStatus );	
	    
	// delete label2m, ap100, good
	labelRes = await gh.getLabel( authData, td.GHOwner, td.GHRepo, ap100 );
	await tu.delLabel( authData, td, labelRes.label.name );
	testStatus = await labHelp( authData, td, ap100, -1, -1, testStatus );		
	
	// Mod label1m, fail and create
	await tu.updateLabel( authData, td, label1m, {name: ap2k });
	testStatus = await labHelp( authData, td, label1m.name, ap1m, "Allocation PEQ value: 1000000", testStatus );
	testStatus = await labHelp( authData, td, ap2k, ap2k, "Allocation PEQ value: 2000", testStatus );
	testStatus = await tu.checkPact( authData, ghLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_NOTE, "PEQ label edit attempt", testStatus );
	testStatus = await tu.checkAlloc( authData, ghLinks, td, stripeLoc, issAllocDat, cardAlloc, testStatus, {lblCount: 2} );	

	// Delete label1m, fail
	await tu.delLabel( authData, td, label1m.name );
	testStatus = await labHelp( authData, td, ap1m, ap1m, "Allocation PEQ value: 1000000", testStatus );
	testStatus = await tu.checkPact( authData, ghLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_NOTE, "PEQ label delete attempt", testStatus );
	testStatus = await tu.checkAlloc( authData, ghLinks, td, stripeLoc, issAllocDat, cardAlloc, testStatus, {lblCount: 2} );	
	
	tu.testReport( testStatus, "Alloc C" );
    }

    // Close/reopen
    {
	// Should stay in stripe, allocs don't move.
	await tu.closeIssue( authData, td, issAllocDat );
	testStatus = await tu.checkAlloc( authData, ghLinks, td, stripeLoc, issAllocDat, cardAlloc, testStatus, {lblCount: 2, state: "closed"} );

	await tu.reopenIssue( authData, td, issAllocDat[1] );
	testStatus = await tu.checkAlloc( authData, ghLinks, td, stripeLoc, issAllocDat, cardAlloc, testStatus, {lblCount: 2} );
	
	tu.testReport( testStatus, "Alloc D" );
    }

    // Create/delete good column
    {
	// Create from card .. NOTE!  card is rebuilt to point to issue.  Re-find it.
	await tu.makeAllocCard( authData, ghLinks, td.CEProjectId, td.GHFullName, starLoc.colId, "Alloc star 1", "1,000,000" );     
	await utils.sleep( 2000 );
	const links       = await tu.getLinks( authData, ghLinks, { "ceProjId": td.CEProjectId, "repo": td.GHFullName } );
	const link        = links.find( link => link.hostIssueName == "Alloc star 1" );
	const starCard1   = await tu.getCard( authData, link.hostCardId );
	const issStarDat1 = [link.hostIssueId, link.hostIssueNum, link.hostIssueName];
	testStatus        = await tu.checkAlloc( authData, ghLinks, td, starLoc, issStarDat1, starCard1, testStatus, {assignees: 0, lblCount: 1} );

	// Create from issue  ... should be makeAllocIssue to create comment, but not testing that here
	const issStarDat2 = await tu.makeAllocIssue( authData, td, "Alloc star 2", [ label1m ] );
	const starCard2   = await tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, starLoc.colId, issStarDat2[0] );
	await utils.sleep( 1000 );
	testStatus        = await tu.checkAlloc( authData, ghLinks, td, starLoc, issStarDat2, starCard2, testStatus, {assignees: 0, lblCount: 1} );

	// Delete 2 ways
	await tu.remCard( authData, starCard1.id );            // card, then issue
	await tu.remIssue( authData, td, issStarDat1[0] ); 
	await tu.remIssue( authData, td, issStarDat2[0] );     // just issue

	testStatus = await tu.checkNoCard( authData, ghLinks, td, starLoc, starCard1.id, "Alloc star 1", testStatus, {"peq": true} );
	// XXX This will exist until GH gets it back together.  See 6/8/2022 notes.
	// testStatus = await tu.checkNoCard( authData, ghLinks, td, starLoc, starCard2.id, "Alloc star 2", testStatus, {"peq": true} );	
	testStatus = await tu.checkNoIssue( authData, ghLinks, td, issStarDat1, testStatus );
	testStatus = await tu.checkNoIssue( authData, ghLinks, td, issStarDat2, testStatus );
	
	tu.testReport( testStatus, "Alloc E" );
    }

    // Create/delete x4 column
    {
	// Create from card 
	await tu.makeAllocCard( authData, ghLinks, td.CEProjectId, td.GHFullName, progLoc.colId, "Alloc prog", "1,000,000" ); // returns here are no good
	await tu.makeAllocCard( authData, ghLinks, td.CEProjectId, td.GHFullName, accrLoc.colId, "Alloc accr", "1,000,000" );
	await utils.sleep( 2000 );
	const links      = await tu.getLinks( authData, ghLinks, { "ceProjId": td.CEProjectId, "repo": td.GHFullName } );
	const linkProg   = links.find( link => link.hostIssueName == "Alloc prog" );
	const linkAccr   = links.find( link => link.hostIssueName == "Alloc accr" );

	testStatus = tu.checkEq( typeof linkProg, 'undefined',     testStatus, "link should not exist" );
	testStatus = tu.checkEq( typeof linkAccr, 'undefined',     testStatus, "link should not exist" );
	
	tu.testReport( testStatus, "Alloc F" );
    }
    
    tu.testReport( testStatus, "Test Alloc" );

    return testStatus;
}




async function runTests( authData, ghLinks, td ) {


    console.log( "Component tests =================" );

    let testStatus = [ 0, 0, []];

    let t1 = await testAssignment( authData, ghLinks, td );
    console.log( "\n\nAssignment test complete." );
    await utils.sleep( 5000 );

    let t8 = await testAlloc( authData, ghLinks, td );
    console.log( "\n\nAlloc complete." );
    await utils.sleep( 5000 );
    
    let t2 = await testLabel( authData, ghLinks, td ); 
    console.log( "\n\nLabel test complete." );
    await utils.sleep( 5000 );

    let t3 = await testLabelCarded( authData, ghLinks, td );
    console.log( "\n\nLabel Carded complete." );
    await utils.sleep( 5000 );
    
    let t4 = await testCloseReopen( authData, ghLinks, td ); 
    console.log( "\n\nClose / Reopen complete." );
    await utils.sleep( 5000 );

    let t5 = await testCreateDelete( authData, ghLinks, td );
    console.log( "\n\nCreate / Delete complete." );
    await utils.sleep( 5000 );

    let t6 = await testLabelMods( authData, ghLinks, td );
    console.log( "\n\nLabel mods complete." );
    await utils.sleep( 5000 );

    let t7 = await testProjColMods( authData, ghLinks, td );
    console.log( "\n\nProjCol mods complete." );
    // await utils.sleep( 5000 );


    testStatus = tu.mergeTests( testStatus, t1 );
    testStatus = tu.mergeTests( testStatus, t8 );
    testStatus = tu.mergeTests( testStatus, t2 );
    testStatus = tu.mergeTests( testStatus, t3 );
    testStatus = tu.mergeTests( testStatus, t4 );
    testStatus = tu.mergeTests( testStatus, t5 );
    testStatus = tu.mergeTests( testStatus, t6 );
    testStatus = tu.mergeTests( testStatus, t7 );
    
    return testStatus
}


exports.runTests = runTests;
