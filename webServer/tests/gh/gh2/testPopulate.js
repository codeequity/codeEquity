var assert  = require( 'assert' );

var config  = require( '../../../config' );

const utils    = require( '../../../utils/ceUtils' );
const awsUtils = require( '../../../utils/awsUtils' );
const ghUtils  = require( '../../../utils/gh/ghUtils' );

const tu       = require( '../../ceTestUtils' );

const testData = require( '../testData' );
const gh2tu    = require( './gh2TestUtils' );

const ISS_NEWBIE   = "A newborn issue";
const ISS_SINREC   = "A singly-carded issue";
const ISS_DUBREC   = "A doubly-carded issue";
const ISS_TRIPREC  = "A triply-carded issue";
const ISS_SINFLAT  = "single in Flatworld";
const ISS_DUBMIX   = "doubly in Flat-Recommended mix";


// During normal operation, when a second card is added to a situated issue, it is immediately split
async function testIncrementalResolve( authData, testLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Incremental Resolve" );
    authData.who = "<TEST: Incr Resolve>";

    let ASSIGNEE1 = gh2tu.getAssignee( authData, "ariCETester" );
    let ASSIGNEE2 = gh2tu.getAssignee( authData, "builderCE" );

    const ISS_MOON = "IR Moons";
    const ISS_PLAN = "IR Plan";
    const ISS_PROG = "IR Prog";
    const ISS_PEND = "IR Pending";
    const ISS_ACCR = "IR Accrued";

    await gh2tu.refreshRec( authData, td );
    await gh2tu.refreshFlat( authData, td );
    await gh2tu.refreshUnclaimed( authData, td );

    // 1. Setup.
    console.log( "make labels" );
    let label1k  = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, "", 1000 );
    let labelDoc = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, "documentation", -1 );
    let labelBug = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, "bug", -1 );

    console.log( "make issues" );
    const issMoonDat = await gh2tu.makeIssue( authData, td, ISS_MOON, [ labelBug, labelDoc ] );
    const issPlanDat = await gh2tu.makeIssue( authData, td, ISS_PLAN, [ label1k, labelDoc, labelBug ] );
    const issProgDat = await gh2tu.makeIssue( authData, td, ISS_PROG, [ label1k, labelDoc ] );
    const issPendDat = await gh2tu.makeIssue( authData, td, ISS_PEND, [ label1k ] );
    const issAccrDat = await gh2tu.makeIssue( authData, td, ISS_ACCR, [ label1k, labelDoc, labelBug ] );

    await gh2tu.makeColumn( authData, testLinks, td.ceProjectId, td.ghFullName, td.githubOpsPID, "Moons" );

    // From
    const moonLoc = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, "Moons" );
    const planLoc = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PLAN] );
    const progLoc = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PROG] );
    const pendLoc = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PEND] );
    const accrLoc = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_ACCR] );
    
    // To
    const toBacnLoc = await gh2tu.getFlatLoc( authData, td.flatPID, td.flatTitle, td.col2Title );
    const toProgLoc = await gh2tu.getFlatLoc( authData, td.dataSecPID, td.dataSecTitle, config.PROJ_COLS[config.PROJ_PROG] );
    const toPendLoc = await gh2tu.getFlatLoc( authData, td.dataSecPID, td.dataSecTitle, config.PROJ_COLS[config.PROJ_PEND] );
    const toAccrLoc = await gh2tu.getFlatLoc( authData, td.dataSecPID, td.dataSecTitle, config.PROJ_COLS[config.PROJ_ACCR] );
    const toRejectLoc = await gh2tu.getFlatLoc( authData, td.dataSecPID, td.dataSecTitle, config.PROJ_COLS[config.PROJ_PLAN] );
    
    // Need assignees for pend/accr.
    ASSIGNEE1 = await ASSIGNEE1;
    ASSIGNEE2 = await ASSIGNEE2;
    await gh2tu.addAssignee( authData, issMoonDat, ASSIGNEE1 );	
    await gh2tu.addAssignee( authData, issPlanDat, ASSIGNEE1 );	
    await gh2tu.addAssignee( authData, issProgDat, ASSIGNEE2 );	
    await gh2tu.addAssignee( authData, issPendDat, ASSIGNEE1 );	
    await gh2tu.addAssignee( authData, issPendDat, ASSIGNEE2 );	
    await gh2tu.addAssignee( authData, issAccrDat, ASSIGNEE1 );

    // Set up first cards
    const cardMoon = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, moonLoc.pid, moonLoc.colId, issMoonDat[0] );
    const cardPlan = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, planLoc.pid, planLoc.colId, issPlanDat[0] );
    const cardProg = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, progLoc.pid, progLoc.colId, issProgDat[0] );
    const cardPend = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, planLoc.pid, planLoc.colId, issPendDat[0] );
    const cardAccr = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, planLoc.pid, planLoc.colId, issAccrDat[0] );

    // Close & accrue
    await gh2tu.closeIssue( authData, td, issPendDat );

    await gh2tu.closeIssue( authData, td, issAccrDat, pendLoc );
    await gh2tu.moveCard( authData, testLinks, td.ceProjectId, cardAccr.cardId, accrLoc.colId );
    
    await utils.sleep( 2000 );	
    testStatus = await gh2tu.checkUntrackedIssue( authData, testLinks, td, moonLoc, issMoonDat, cardMoon, testStatus, {lblCount: 2} );
    testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, planLoc, issPlanDat, cardPlan, testStatus, {peq: true, lblCount: 3 } );
    testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, progLoc, issProgDat, cardProg, testStatus, {peq: true, lblCount: 2 } );
    testStatus = await gh2tu.checkNewlyClosedIssue(   authData, testLinks, td, pendLoc, issPendDat, cardPend, testStatus, {peq: true, lblCount: 1 } );
    testStatus = await gh2tu.checkNewlyAccruedIssue(  authData, testLinks, td, accrLoc, issAccrDat, cardAccr, testStatus, {peq: true, lblCount: 3 } );
    
    if( typeof testStatus === 'undefined' ) { console.log( "ts is undefined!??" ); }
    tu.testReport( testStatus, "Incremental resolve setup" );

    // Can't add 2nd card within same project - needs to be cross project.
    // Use datasec & bacon
    
    // Plan += Bacon  (add new plan card to bacon column)
    {
	const cardNew = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, toBacnLoc.pid, toBacnLoc.colId, issPlanDat[0] );
	await utils.sleep( 4000 );
	testStatus = await gh2tu.checkSplit( authData, testLinks, td, issPlanDat, planLoc, toBacnLoc, 1000, 1000, testStatus, {peq: true, lblCount: 3, checkPeq: true } );

	if( typeof testStatus === 'undefined' ) { console.log( "ts is undefined!??" ); }
	tu.testReport( testStatus, "Incremental resolve A" );
    }

    // Plan += Pend 
    {
	// At this point, plan lval is 500
	const cardNew = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, toPendLoc.pid, toPendLoc.colId, issPlanDat[0] );
	await utils.sleep( 3000 );
	testStatus = await gh2tu.checkSplit( authData, testLinks, td, issPlanDat, planLoc, toPendLoc, 500, 1000, testStatus, {peq: true, lblCount: 3, checkPeq: true } );

	if( typeof testStatus === 'undefined' ) { console.log( "ts is undefined!??" ); }
	tu.testReport( testStatus, "Incremental resolve B" );
    }

    // Moon += Pend .. Fail not peq.  Move to PLAN
    {
	const cardNew = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, toPendLoc.pid, toPendLoc.colId, issMoonDat[0] );
	await utils.sleep( 2000 );
	testStatus = await gh2tu.checkUntrackedIssue( authData, testLinks, td, moonLoc, issMoonDat, cardMoon, testStatus, {lblCount: 2} );
	// testStatus = await gh2tu.checkNoSplit( authData, testLinks, td, issMoonDat, toPendLoc, cardNew.cardId, testStatus );
	testStatus = await gh2tu.checkSplit( authData, testLinks, td, issMoonDat, moonLoc, toRejectLoc, -1, -1, testStatus, {peq: false, lblCount: 2 } );
	
	if( typeof testStatus === 'undefined' ) { console.log( "ts is undefined!??" ); }
	tu.testReport( testStatus, "Incremental resolve C" );
    }
    
    // Moon += Prog 
    {
	const cardNew = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, toProgLoc.pid, toProgLoc.colId, issMoonDat[0] );
	await utils.sleep( 2000 );
	testStatus = await gh2tu.checkSplit( authData, testLinks, td, issMoonDat, moonLoc, toProgLoc, -1, -1, testStatus, {peq: false, lblCount: 2 } );

	if( typeof testStatus === 'undefined' ) { console.log( "ts is undefined!??" ); }
	tu.testReport( testStatus, "Incremental resolve D" );
	// moon to pend above now leaves card in plan.  split should work here, should get a split tag, above card is for different issue..!
    }

    // Prog += Accr  .. Fail no create in accr.  Move to PLAN
    {
	const cardNew = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, toAccrLoc.pid, toAccrLoc.colId, issProgDat[0] );
	await utils.sleep( 2000 );
	// testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, progLoc, issProgDat, cardProg, testStatus, {lblCount: 2 } );
	// testStatus = await gh2tu.checkNoSplit( authData, testLinks, td, issProgDat, toAccrLoc, cardNew.cardId, testStatus );
	testStatus = await gh2tu.checkSplit( authData, testLinks, td, issProgDat, progLoc, toRejectLoc, 1000, 1000, testStatus,
					     {peq: true, lblCount: 2, checkPeq: true, rejected: true } );
	
	if( typeof testStatus === 'undefined' ) { console.log( "ts is undefined!??" ); }
	tu.testReport( testStatus, "Incremental resolve E" );
    }

    
    // Pend += Accr  .. Fail no create in accr.  Issue is closed, do not re-open.  Do not move to plan.
    {
	const cardNew = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, toAccrLoc.pid, toAccrLoc.colId, issPendDat[0] );
	await utils.sleep( 2000 );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, pendLoc, issPendDat, cardPend, testStatus, {lblCount: 1 } );
	testStatus = await gh2tu.checkNoSplit( authData, testLinks, td, issPendDat, toAccrLoc, cardNew.cardId, testStatus );
	// testStatus = await gh2tu.checkSplit( authData, testLinks, td, issPendDat, pendLoc, toRejectLoc, 1000, 1000, testStatus, {peq: true, lblCount: 1 } );

	if( typeof testStatus === 'undefined' ) { console.log( "ts is undefined!??" ); }
	tu.testReport( testStatus, "Incremental resolve F" );
    }

    // Accr += Pend  .. Fail no modify accr
    {
	const cardNew = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, toPendLoc.pid, toPendLoc.colId, issAccrDat[0] );
	await utils.sleep( 2000 );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, accrLoc, issAccrDat, cardAccr, testStatus, {lblCount: 3 } );
	testStatus = await gh2tu.checkNoSplit( authData, testLinks, td, issAccrDat, toPendLoc, cardNew.cardId, testStatus );

	tu.testReport( testStatus, "Incremental resolve G" );
    }
    
    tu.testReport( testStatus, "Test Incremental resolve" );

    return testStatus;
}



async function runTests( authData, testLinks, td ) {

    console.log( "Resolve tests =================" );

    let testStatus = [ 0, 0, []];

    let t1 = await testIncrementalResolve( authData, testLinks, td );
    console.log( "\n\nIncremental resolve complete." );
    // ghUtils.show( true );
    await utils.sleep( 5000 );


    testStatus = tu.mergeTests( testStatus, t1 );

    return testStatus;

}


exports.runTests = runTests;
