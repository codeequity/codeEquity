import assert   from 'assert';

import * as config   from '../../../config.js';
import * as utils    from '../../../utils/ceUtils.js';
import * as awsUtils from '../../../utils/awsUtils.js';

import * as tu       from '../../ceTestUtils.js';
import * as ghUtils  from '../../../utils/gh/ghUtils.js';
import * as gh2tu    from './gh2TestUtils.js';

import testData from '../testData.js';


const ISS_LAB   = "LabelTest";
const ISS_LAB2  = "LabelTest Dubs";
const ISS_LAB3  = "LabelTest Carded";
const ISS_LAB4  = "Close Open test";
const ASSIGNEE1 = "ariCETester";
const ASSIGNEE2 = "builderCE";


async function checkDubLabel( authData, testLinks, td, loc, issueData, card, testStatus ) {

    let subTest = [ 0, 0, []];

    // CHECK github issues
    let kp = "1000 " + config.PEQ_LABEL;
    let kpConv = gh2tu.convertName( kp );
    let issue = await gh2tu.findIssue( authData, issueData[0] );

    if( issue.labels.length >= 2 ) {
	subTest = tu.checkEq( issue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
	subTest = tu.checkEq( issue.number, issueData[1].toString(), subTest, "Github issue troubles" );
	subTest = tu.checkEq( issue.labels.length, 2,                subTest, "Issue label" );
	const labels0 = issue.labels[0].name == kpConv && issue.labels[1].name == "documentation";
	const labels1 = issue.labels[1].name == kpConv && issue.labels[0].name == "documentation";
	subTest = tu.checkEq( labels0 || labels1, true,              subTest, "Issue label" );

	let peqs =  await awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId });
	peqs = peqs.filter((peq) => peq.HostIssueId == issueData[0] );
	subTest = tu.checkEq( peqs.length, 1,                          subTest, "Peq count" );
	let peq = peqs[0];
	
	// CHECK dynamo PAct only has 3 entries (add uncl, del uncl, add bacon)  - should not get notices/adds/etc for non-initial peq labeling
	// But.. when testing does makeIssue, addLabel, makeProjCard in succession (awaits don't matter - just control issue not reception of command or ce notice)
	//       makeProjCard can begin at GH before labelIssue in CE runs.  This means it is valid to either create card in project:nostatus then relo, or
	//       first create in unclaimed, then continue.  i.e. add/relo/relo or add/relo add/relo/relo (relo/relo is typically to noStatus, then to col).
	let pacts = await awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
	pacts = pacts.filter((pact) => pact.Subject[0] == peq.PEQId );
	let goodCount = pacts.length == 3 || pacts.length == 5;
	subTest = tu.checkEq( goodCount, true,                         subTest, "PAct count" );      // add/relo (unclaimed) add/relo/relo (bacon)
    }
    
    return await tu.settle( subTest, testStatus, checkDubLabel, authData, testLinks, td, loc, issueData, card, testStatus );
}


async function testLabel( authData, testLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Label" );
    authData.who = "<TEST: Label>";

    await gh2tu.refreshRec( authData, td );
    await gh2tu.refreshFlat( authData, td );
    await gh2tu.refreshUnclaimed( authData, td );

    const dsPlan = td.getDSPlanLoc();
    const dsProg = td.getDSProgLoc();
    const dsPend = td.getDSPendLoc();
    const dsAccr = td.getDSAccrLoc();
    const bacon  = td.getBaconLoc();

    const flatUntrack = td.getUntrackLoc( td.flatPID );
    const kp     = "1000 " + config.PEQ_LABEL;
    const halfKP = "500 " + config.PEQ_LABEL;

    const assignee1 = await gh2tu.getAssignee( authData, ASSIGNEE1 );

    await gh2tu.refreshRec( authData, td );
    await gh2tu.refreshFlat( authData, td );
    
    {    
	console.log( "Test label/unlabel in full CE structure" );

	// 1. create peq issue in dsplan
	console.log( "Make newly peq'd issue in dsplan" );
	let issueData = await gh2tu.makeIssue( authData, td, ISS_LAB, [] );     // [id, number, cardId, title]  
	let label     = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, kp, 1000 );
	await gh2tu.addLabel( authData, label.id, issueData );

	let card  = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.dataSecPID, td.dsPlanId, issueData[0] );
	testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, dsPlan, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 1" );

	// First creation can take time for GH to register
	await tu.settleWithVal( "forced refresh unclaimed", gh2tu.forcedRefreshUnclaimed, authData, testLinks, td );
	
	// 2. unlabel
	await gh2tu.remLabel( authData, label, issueData );
	testStatus = await gh2tu.checkDemotedIssue( authData, testLinks, td, dsPlan, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 2" );
	
	// 3. move to accr (untracked), watch it bounce back
	await gh2tu.moveCard( authData, testLinks, td.ceProjectId, card.cardId, td.dsAccrId );
	await utils.sleep( gh2tu.GH_DELAY );
	testStatus = await gh2tu.checkDemotedIssue( authData, testLinks, td, dsPlan, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 3" );
	
	// 4. move to pend, bounce
	await gh2tu.moveCard( authData, testLinks, td.ceProjectId, card.cardId, td.dsPendId );
	await utils.sleep( gh2tu.GH_DELAY );
	testStatus = await gh2tu.checkDemotedIssue( authData, testLinks, td, dsPlan, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 4" );
	
	// 5. move to prog (untracked), label
	await gh2tu.moveCard( authData, testLinks, td.ceProjectId, card.cardId, td.dsProgId );
	await gh2tu.addLabel( authData, label.id, issueData );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, dsProg, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 5" );
	
	// 6. unlabel, label
	// await gh2tu.remLabel( authData, label, issueData, {depth: 2} );
	await gh2tu.remLabel( authData, label, issueData );
	// second add can happen before del.  Then after del, label not found.  wait..
	await tu.settleWithVal( "LabelTest remove peqLabel", labNotInIssueHelp, authData, td, label.name, issueData[0] );
	// remLabel notice can be slow, and can defeat findNotice in this test since there are a chain of add/rem.
	// for now, add sleep.  if this arises again, consider a more permanent solution
	await utils.sleep( 2000 );
	
	await gh2tu.addLabel( authData, label.id, issueData );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, dsProg, issueData, card, testStatus );
	tu.testReport( testStatus, "Label 6" );
	
	// 7. move to accr, unlabel (fail)
	await gh2tu.addAssignee( authData, issueData, assignee1 );       // can't ACCR without this.    
	await gh2tu.moveCard( authData, testLinks, td.ceProjectId, card.cardId, td.dsAccrId, {issId: issueData[0]} );
	await gh2tu.remLabel( authData, label, issueData );              // will be added back
	// Assignee may be processed before relabel.. 
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, dsAccr, issueData, card, testStatus, {peqHolder: "maybe"} );
	tu.testReport( testStatus, "Label 7" );
    }	

    {
	// add two peq labels
	console.log( "Double-labels" );

	// 1. create 1k peq issue in bacon
	console.log( "Make newly peq'd issue in bacon" );
	let issueData = await gh2tu.makeIssue( authData, td, ISS_LAB2, [] );     // [id, number, cardId, title] 
	let label     = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, kp, 1000 );
	await gh2tu.addLabel( authData, label.id, issueData );
	let card  = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.flatPID, bacon.colId, issueData[0] );

	testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label Dub 1" );
	
	// 2. add "documentation" twice (fail - will not receive 2nd notification)
	let docLabel  = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, "documentation", -1 );	
	await gh2tu.addLabel( authData, docLabel.id, issueData );
	await gh2tu.addLabel( authData, docLabel.id, issueData );
	testStatus = await checkDubLabel( authData, testLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label Dub 2" );
	
	// 3. add 500 peq (fail)
	let label500  = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, halfKP, 500 );	
	await gh2tu.addLabel( authData, label500.id, issueData );
	testStatus = await checkDubLabel( authData, testLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label Dub 3" );	

	console.log( "Double-labels done." );
	await utils.sleep( 5000 );


	console.log( "\nTest label/unlabel in flat projects structure" );
	
	// 1. unlabel
	await gh2tu.remLabel( authData, docLabel, issueData );    
	await gh2tu.remLabel( authData, label, issueData );
	testStatus = await gh2tu.checkDemotedIssue( authData, testLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label flat 1" );
	
	// 2. label
	await gh2tu.addLabel( authData, label.id, issueData );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label flat 2" );

	// 3. close (should create pend/accr cols) (fail, no assignee)
	await gh2tu.closeIssue( authData, td, issueData );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, bacon, issueData, card, testStatus );
	tu.testReport( testStatus, "Label flat 3" );
	
	// 4. assign and close
	await gh2tu.addAssignee( authData, issueData, assignee1 );   // can't PEND without this.
	await gh2tu.closeIssue( authData, td, issueData );
	await utils.sleep( 1000 );
	
	// get new cols/locs pend/accr
	const flatPend = await gh2tu.getFlatLoc( authData, td.flatPID, td.flatTitle, config.PROJ_COLS[config.PROJ_PEND] );
	const flatAccr = await gh2tu.getFlatLoc( authData, td.flatPID, td.flatTitle, config.PROJ_COLS[config.PROJ_ACCR] );
	// psub will be set when re-labeled in bacon above
	flatPend.projSub = [ td.flatTitle, td.col2Title ];
	flatAccr.projSub = [ td.flatTitle, td.col2Title ];
	
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, flatPend, issueData, card, testStatus );
	tu.testReport( testStatus, "Label flat 4" );
	
	// 5. unlabel (NO LONGER ok here, negotiating.  label will be re-added)
	await gh2tu.remLabel( authData, label, issueData );    
	// testStatus = await gh2tu.checkDemotedIssue( authData, testLinks, td, flatPend, issueData, card, testStatus );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, flatPend, issueData, card, testStatus, {label: 1000 } );	
	tu.testReport( testStatus, "Label flat 5" );

	// PEQ is rebuilt below, when it is re-activated.
	flatPend.projSub = [ td.flatTitle, config.PROJ_COLS[config.PROJ_PEND] ];
	flatAccr.projSub = [ td.flatTitle, config.PROJ_COLS[config.PROJ_ACCR] ];

	// 5. relabel (OK here, negotiating)
	await gh2tu.addLabel( authData, label500.id, issueData );
	// peq is NO LONGER re-created, i.e. re-peq-labeled.  Assignees are no longer re-established with aws.
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, flatPend, issueData, card, testStatus, {opVal: 1000, label: 500 } );
	tu.testReport( testStatus, "Label flat 6" );
	
	// 6. move to accr
	await gh2tu.moveCard( authData, testLinks, td.ceProjectId, card.cardId, flatAccr.colId, {issId: issueData[0]} );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, flatAccr, issueData, card, testStatus, {opVal: 1000, label: 500 } );
	tu.testReport( testStatus, "Label flat 7" );
    }

    tu.testReport( testStatus, "Test Label" );
    return testStatus;
}

async function testAssignment( authData, testLinks, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Assignment" );
    authData.who = "<TEST: Assign>";

    await gh2tu.refreshRec( authData, td );
    await gh2tu.refreshFlat( authData, td );
    await gh2tu.refreshUnclaimed( authData, td );

    const ISS_ASS   = "AssignTest";
    const VERBOSE = true;
    const assPlan = await gh2tu.getFlatLoc( authData, td.dataSecPID, td.dataSecTitle, config.PROJ_COLS[config.PROJ_PLAN] );

    const assignee1 = await gh2tu.getAssignee( authData, ASSIGNEE1 );
    const assignee2 = await gh2tu.getAssignee( authData, ASSIGNEE2 );
    
    // 1. Create PEQ issue, add to proj
    const kp = "1000 " + config.PEQ_LABEL;
    console.log( "Make newly peq'd issue" );
    let assData = await gh2tu.makeIssue( authData, td, ISS_ASS, [] );     // [id, number, cardId, title]  

    let newLabel = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, kp, 1000 );
    await gh2tu.addLabel( authData, newLabel.id, assData );

    let assCard  = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.dataSecPID, td.dsPlanId, assData[0] );
    testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, assPlan, assData, assCard, testStatus );

    const pendLoc = await gh2tu.getFlatLoc( authData, td.dataSecPID, td.dataSecTitle, config.PROJ_COLS[config.PROJ_PEND] );

    if( VERBOSE ) { tu.testReport( testStatus, "A" ); }

    // 2. add assignee
    console.log( "Add assignees" );
    await gh2tu.addAssignee( authData, assData, assignee1 );
    await gh2tu.addAssignee( authData, assData, assignee2 );
    testStatus = await gh2tu.checkAssignees( authData, td, [ASSIGNEE1, ASSIGNEE2], assData, testStatus );
    testStatus = await gh2tu.checkPact( authData, testLinks, td, ISS_ASS, config.PACTVERB_CONF, config.PACTACT_CHAN, config.PACTNOTE_ADDA, testStatus );

    if( VERBOSE ) { tu.testReport( testStatus, "B" ); }

    // 3. remove assignees
    console.log( "Rem assignees" );
    await gh2tu.remAssignee( authData, assData[0], assignee1 );
    await gh2tu.remAssignee( authData, assData[0], assignee2 );
    testStatus = await gh2tu.checkNoAssignees( authData, td, ASSIGNEE1, ASSIGNEE2, assData, testStatus );

    if( VERBOSE ) { tu.testReport( testStatus, "C" ); }
    
    // 4. add assignees
    console.log( "Add assignees" );
    await gh2tu.addAssignee( authData, assData, assignee1 );
    await gh2tu.addAssignee( authData, assData, assignee2 );

    // 5. move to Prog
    await gh2tu.moveCard( authData, testLinks, td.ceProjectId, assCard.cardId, td.dsProgId, {issId: assData[0]} );
    testStatus = await gh2tu.checkProgAssignees( authData, td, ASSIGNEE1, ASSIGNEE2, assData, testStatus );

    // 6. test ACCR
    await gh2tu.remAssignee( authData, assData[0], assignee2 );
    // XXX HARSH.  If rem notification arrives late (out of order), CE will see "accr", then add assignee2 back after "d", then fail the next check.
    //     Can't check jobq, jobs already gone.  Can't check GH, it's in a good state.  No local state to check.. yet.....
    //     Impact only occurs when rem assignee right before rapid-fire close + accr, then assignee is added back in.  Low risk of occurence, but bad when it happens.
    //     11/22/21 2x
    await  utils.sleep( 5000 );

    await gh2tu.closeIssue( authData, td, assData, pendLoc );

    // XXX HARSH.  If move to accrue notification arrives late, addAssignee will pass.  This is not expected to be an uncommon, fast sequence.
    //     3/8/21 fail, move notification is 8 seconds after assignment!
    //     Could settlewait here, but this issue is too important, allows someone to modify an accrued issue.  
    await gh2tu.moveCard( authData, testLinks, td.ceProjectId, assCard.cardId, td.dsAccrId, {issId: assData[0]} );
    await  utils.sleep( 5000 );
    // Add, fail
    await gh2tu.addAssignee( authData, assData, assignee2 );

    
    testStatus = await gh2tu.checkAssignees( authData, td, [ASSIGNEE1], assData, testStatus );
    testStatus = await gh2tu.checkPact( authData, testLinks, td, ISS_ASS, config.PACTVERB_CONF, config.PACTACT_NOTE, "Bad assignment attempted", testStatus );

    if( VERBOSE ) { tu.testReport( testStatus, "D" ); }

    // Rem, fail
    await gh2tu.remAssignee( authData, assData[0], assignee1 );
    testStatus = await gh2tu.checkAssignees( authData, td, [ASSIGNEE1], assData, testStatus );
    testStatus = await gh2tu.checkPact( authData, testLinks, td, ISS_ASS, config.PACTVERB_CONF, config.PACTACT_NOTE, "Bad assignment attempted", testStatus );
    
    tu.testReport( testStatus, "Test Assign" );
    return testStatus;
}

async function testLabelCarded( authData, testLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Label Carded" );
    authData.who = "<TEST: Label Carded>";

    await gh2tu.refreshRec( authData, td );
    await gh2tu.refreshFlat( authData, td );
    await gh2tu.refreshUnclaimed( authData, td );

    const bacon       = td.getBaconLoc();

    {    
	console.log( "Test label carded in flat" );

	// 1. make carded issue in bacon
	console.log( "Make carded issue" );
	const issueData = await gh2tu.makeIssue( authData, td, ISS_LAB3, [] );     // [id, number, title] 
	const card      = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.flatPID, bacon.colId, issueData[0] );
	testStatus      = await gh2tu.checkUntrackedIssue( authData, testLinks, td, bacon, issueData, card, testStatus );

	// 2. add label
	const kp = "1000 " + config.PEQ_LABEL;
	const label     = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, kp, 1000 );
	await gh2tu.addLabel( authData, label.id, issueData );
	testStatus     = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, bacon, issueData, card, testStatus );
    }	

    tu.testReport( testStatus, "Test Label Carded" );
    return testStatus;
}

async function testCloseReopen( authData, testLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Close Reopen" );
    authData.who = "<TEST: Close Reopen>";

    await gh2tu.refreshRec( authData, td );
    await gh2tu.refreshFlat( authData, td );
    await gh2tu.refreshUnclaimed( authData, td );

    const bacon      = td.getBaconLoc();
    const eggs       = td.getEggsLoc();

    const kp = "1000 " + config.PEQ_LABEL;

    const assignee1 = await gh2tu.getAssignee( authData, ASSIGNEE1 );
    
    {
	console.log( "Open/close in flat" );
	// 0. make peq in bacon
	const label     = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, kp, 1000 );
	const issueData = await gh2tu.makeIssue( authData, td, ISS_LAB4, [label] );     // [id, number, cardId, title] 
	const card      = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.flatPID, bacon.colId, issueData[0] );
	issueData[2]    = card.cardId;
	testStatus      = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, bacon, issueData, card, testStatus );

	tu.testReport( testStatus, "A" );
	
	// 1. close
	await gh2tu.addAssignee( authData, issueData, assignee1 );
	await tu.settleWithVal( "Ensure assignee in place", assignPresentHelp, authData, td, issueData, ASSIGNEE1 );
	await gh2tu.closeIssue( authData, td, issueData );
	await utils.sleep( 1000 );

	// get new cols/locs pend/accr
	const flatPend = await gh2tu.getFlatLoc( authData, td.flatPID, td.flatTitle, config.PROJ_COLS[config.PROJ_PEND] );
	const flatAccr = await gh2tu.getFlatLoc( authData, td.flatPID, td.flatTitle, config.PROJ_COLS[config.PROJ_ACCR] );
	// psub will be set when re-labeled in bacon above
	flatPend.projSub = [ td.flatTitle, td.col2Title ];
	flatAccr.projSub = [ td.flatTitle, td.col2Title ];
	
	testStatus = await gh2tu.checkNewlyClosedIssue( authData, testLinks, td, flatPend, issueData, card, testStatus, {peqHolder: "maybe"} );
	
	tu.testReport( testStatus, "B" );
	
	// 2. close again (no change - this will NOT generate a notification, or PAct)
	await gh2tu.closeIssue( authData, td, issueData );
	testStatus = await gh2tu.checkNewlyClosedIssue( authData, testLinks, td, flatPend, issueData, card, testStatus, {peqHolder: "maybe"} );
	
	tu.testReport( testStatus, "C" );

	// Erm.  Simulate ceFlutter processing to ingest propose:accrue, else won't see bacon col in step 3
	// await gh2tu.ingestPActs( authData, issueData );
	
	// 3. Reopen
	await gh2tu.reopenIssue( authData, td, issueData[0] );
	testStatus = await gh2tu.checkNewlyOpenedIssue( authData, testLinks, td, bacon, issueData, card, testStatus );
	
	tu.testReport( testStatus, "D" );

	// 4. Reopen again (fail)
	await gh2tu.reopenIssue( authData, td, issueData[0] );
	testStatus = await gh2tu.checkNewlyOpenedIssue( authData, testLinks, td, bacon, issueData, card, testStatus );
	
	tu.testReport( testStatus, "E" );

	// 5. move to eggs
	await gh2tu.moveCard( authData, testLinks, td.ceProjectId, card.cardId, eggs.colId, {issId: issueData[0]} );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, eggs, issueData, card, testStatus, {"state": config.GH_ISSUE_OPEN } );

	tu.testReport( testStatus, "F" );
	
	// 6. close
	await gh2tu.closeIssue( authData, td, issueData );
	testStatus = await gh2tu.checkNewlyClosedIssue( authData, testLinks, td, flatPend, issueData, card, testStatus, {peqHolder: "maybe"} );
	
	tu.testReport( testStatus, "G" );

	// 7. reopen
	await gh2tu.reopenIssue( authData, td, issueData[0] );
	testStatus = await gh2tu.checkNewlyOpenedIssue( authData, testLinks, td, eggs, issueData, card, testStatus );
	
	tu.testReport( testStatus, "H" );

	// 8. close
	await gh2tu.closeIssue( authData, td, issueData );
	testStatus = await gh2tu.checkNewlyClosedIssue( authData, testLinks, td, flatPend, issueData, card, testStatus, {peqHolder: "maybe"} );
	
	tu.testReport( testStatus, "I" );

	// 9. move to accr
	await gh2tu.moveCard( authData, testLinks, td.ceProjectId, card.cardId, flatAccr.colId, {issId: issueData[0]} );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, flatAccr, issueData, card, testStatus, {"state": config.GH_ISSUE_CLOSED } );

	tu.testReport( testStatus, "J" );
	
	// 10. reopen (fail)
	await gh2tu.reopenIssue( authData, td, issueData[0] );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, flatAccr, issueData, card, testStatus, {"state": config.GH_ISSUE_CLOSED } );

	tu.testReport( testStatus, "K" );

	// 10. move to PEND (fail)
	await gh2tu.moveCard( authData, testLinks, td.ceProjectId, card.cardId, flatPend.colId );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, flatAccr, issueData, card, testStatus, {"state": config.GH_ISSUE_CLOSED } );

	tu.testReport( testStatus, "L" );
    }	

    {
	// NOTE!  Same issue name (Close Open Test), different projects.  GH allows it, we test.
	console.log( "\n\nOpen/close in full++" );

	const stars      = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, "Stars" );
	const stripes    = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, "Stripes" );

	const ghoProg = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PROG] );
	const ghoPend = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PEND] );
	const ghoAccr = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_ACCR] );

	// peqs are out of date (need ingesting) by the time these are used.
	ghoPend.projSub = stars.projSub;
	ghoAccr.projSub = stars.projSub;
	
	// 0. make peq in stars
	const label     = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, kp, 1000 );
	const issueData = await gh2tu.makeIssue( authData, td, ISS_LAB4, [label] );     // [id, number, title] 
	const card      = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, stars.pid, stars.colId, issueData[0] );
	testStatus     = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, stars, issueData, card, testStatus );

	tu.testReport( testStatus, "A" );
	
	// 1. close
	await gh2tu.addAssignee( authData, issueData, assignee1 );	
	await gh2tu.closeIssue( authData, td, issueData );
	testStatus = await gh2tu.checkNewlyClosedIssue( authData, testLinks, td, ghoPend, issueData, card, testStatus );
	
	tu.testReport( testStatus, "B" );

	// 2  Simulate ceFlutter processing to ingest propose:accrue, else won't see stars col in step 3
	// await gh2tu.ingestPActs( authData, issueData );
	
	// 3. Reopen
	await gh2tu.reopenIssue( authData, td, issueData[0] );
	testStatus = await gh2tu.checkNewlyOpenedIssue( authData, testLinks, td, stars, issueData, card, testStatus );
	
	tu.testReport( testStatus, "C" );

	// 4. move to stripes
	await gh2tu.moveCard( authData, testLinks, td.ceProjectId, card.cardId, stripes.colId, {issId: issueData[0]} );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, stripes, issueData, card, testStatus );

	tu.testReport( testStatus, "D" );
	
	// 5. close
	await gh2tu.closeIssue( authData, td, issueData );
	testStatus = await gh2tu.checkNewlyClosedIssue( authData, testLinks, td, ghoPend, issueData, card, testStatus );
	
	tu.testReport( testStatus, "E" );

	// 6. reopen
	await gh2tu.reopenIssue( authData, td, issueData[0] );
	testStatus = await gh2tu.checkNewlyOpenedIssue( authData, testLinks, td, stripes, issueData, card, testStatus );
	
	tu.testReport( testStatus, "F" );

	// 7. close
	await gh2tu.closeIssue( authData, td, issueData );
	testStatus = await gh2tu.checkNewlyClosedIssue( authData, testLinks, td, ghoPend, issueData, card, testStatus );
	
	tu.testReport( testStatus, "G" );

	// 8. move to accr
	await gh2tu.moveCard( authData, testLinks, td.ceProjectId, card.cardId, ghoAccr.colId, {issId: issueData[0]} );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, ghoAccr, issueData, card, testStatus );

	tu.testReport( testStatus, "H" );
    }

    
    tu.testReport( testStatus, "Test Close Reopen" );
    return testStatus;
}


// create in place?  Yes, major mode.  
// PROG PEND ACCR create/delete newborn, carded, situated.
async function testCreateDelete( authData, testLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Create Delete" );
    authData.who = "<TEST: Create Delete>";
    
    const ISS_NEWB = "Newborn";
    const ISS_CRDD = "Carded"; 
    const ISS_SITU = "Situated"; 

    await gh2tu.refreshRec( authData, td );
    await gh2tu.refreshFlat( authData, td );
    await gh2tu.refreshUnclaimed( authData, td );

    const ghoPlan = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PLAN] );
    const ghoProg = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PROG] );
    const ghoPend = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PEND] );
    const ghoAccr = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_ACCR] );

    const stars      = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, "Stars" );
    const stripes    = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, "Stripes" );

    const kp = "1000 " + config.PEQ_LABEL;    

    const assignee1 = await gh2tu.getAssignee( authData, ASSIGNEE1 );
    
    {
	console.log( "\nNewborn testing" );

	const ISS_FLAT = ISS_NEWB + " Flat";
	const ISS_PROG = ISS_NEWB + " In Progress";
	const ISS_PEND = ISS_NEWB + " Pending";
	const ISS_ACCR = ISS_NEWB + " Accrued";

	// 0. make newborns
	const cardIdFlat  = await gh2tu.makeNewbornCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, stars.colId,   ISS_FLAT );
	const cardIdProg  = await gh2tu.makeNewbornCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, ghoProg.colId, ISS_PROG );
	const cardIdPend  = await gh2tu.makeNewbornCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, ghoPend.colId, ISS_PEND );
	const cardIdAccr  = await gh2tu.makeNewbornCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, ghoAccr.colId, ISS_ACCR );
	testStatus     = await gh2tu.checkNewbornCard( authData, testLinks, td, stars, cardIdFlat, ISS_FLAT, testStatus );
	testStatus     = await gh2tu.checkNewbornCard( authData, testLinks, td, ghoProg, cardIdProg, ISS_PROG, testStatus );
	testStatus     = await gh2tu.checkNoCard( authData, testLinks, td, ghoPend, cardIdPend, ISS_PEND, testStatus );
	testStatus     = await gh2tu.checkNoCard( authData, testLinks, td, ghoAccr, cardIdAccr, ISS_ACCR, testStatus );

	// 2. remove them.
	await gh2tu.remCard( authData, td.ceProjectId, td.githubOpsPID, cardIdFlat );
	await gh2tu.remCard( authData, td.ceProjectId, td.githubOpsPID, cardIdProg );
	testStatus     = await gh2tu.checkNoCard( authData, testLinks, td, stars, cardIdFlat, ISS_FLAT, testStatus );
	testStatus     = await gh2tu.checkNoCard( authData, testLinks, td, ghoProg, cardIdProg, ISS_PROG, testStatus );

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
	const issDatFlat = await gh2tu.makeIssue( authData, td, ISS_FLAT, [] );     
	const issDatProg = await gh2tu.makeIssue( authData, td, ISS_PROG, [] );
	const issDatPend = await gh2tu.makeIssue( authData, td, ISS_PEND, [] );
	const issDatAccr = await gh2tu.makeIssue( authData, td, ISS_ACCR, [] );

	const flatCard   = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, stars.colId,   issDatFlat[0] );
	const progCard   = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, ghoProg.colId, issDatProg[0] );
	const pendCard   = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, ghoPend.colId, issDatPend[0] );
	const accrCard   = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, ghoAccr.colId, issDatAccr[0] );

	testStatus     = await gh2tu.checkUntrackedIssue( authData, testLinks, td, stars,   issDatFlat, flatCard, testStatus );
	testStatus     = await gh2tu.checkUntrackedIssue( authData, testLinks, td, ghoProg, issDatProg, progCard, testStatus );

	// These two are created, and moved out of reserved into PLAN.
	testStatus     = await gh2tu.checkUntrackedIssue( authData, testLinks, td, ghoPlan, issDatPend, pendCard, testStatus );
	testStatus     = await gh2tu.checkUntrackedIssue( authData, testLinks, td, ghoPlan, issDatAccr, accrCard, testStatus );

	tu.testReport( testStatus, "carded A" );

	// 2. remove them.
	await gh2tu.remCard( authData, td.ceProjectId, td.githubOpsPID, flatCard.cardId );             // remove card, then issue
	await gh2tu.remIssue( authData, issDatFlat[0] );
	await gh2tu.remIssue( authData, issDatProg[0] ); // just remove issue
	
	testStatus     = await gh2tu.checkNoCard( authData, testLinks, td, stars,   flatCard.cardId, ISS_FLAT, testStatus );
	testStatus     = await gh2tu.checkNoCard( authData, testLinks, td, ghoProg, progCard.cardId, ISS_PROG, testStatus );

	tu.testReport( testStatus, "carded B" );
    }
    
    {
	console.log( "PEQ testing" );

	const ISS_FLAT = ISS_SITU + " Flat";
	const ISS_PROG = ISS_SITU + " In Progress";
	const ISS_PEND = ISS_SITU + " Pending";
	const ISS_ACCR = ISS_SITU + " Accrued";

	// 0. make situated issues
	const label     = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, kp, 1000 );	
	const issDatFlat = await gh2tu.makeIssue( authData, td, ISS_FLAT, [label] );     
	const issDatProg = await gh2tu.makeIssue( authData, td, ISS_PROG, [label] );
	const issDatPend = await gh2tu.makeIssue( authData, td, ISS_PEND, [label] );
	const issDatAccr = await gh2tu.makeIssue( authData, td, ISS_ACCR, [label] );

	const flatCard   = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, stars.colId,   issDatFlat[0] );
	const progCard   = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, ghoProg.colId, issDatProg[0] );

	// note: pend never closes here (i.e. fail, not assigned).
	const pendCard   = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, ghoPend.colId, issDatPend[0] );
	const accrCard   = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, ghoAccr.colId, issDatAccr[0] );

	testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, stars,   issDatFlat, flatCard, testStatus );
	testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, ghoProg, issDatProg, progCard, testStatus );

	// Can't move to pend or accr without assignee
	testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, ghoPlan, issDatPend, pendCard, testStatus );
	testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, ghoPlan, issDatAccr, accrCard, testStatus );
	// testStatus = await gh2tu.checkNoCard( authData, testLinks, td, ghoAccr, accrCard.cardId, ISS_ACCR, testStatus, {"peq": true} );

	tu.testReport( testStatus, "situated A" );
	
	// 2. remove them.
	await gh2tu.remIssue( authData, issDatFlat[0] );
	await gh2tu.remIssue( authData, issDatProg[0] ); 
	await gh2tu.remIssue( authData, issDatPend[0] );

	testStatus     = await gh2tu.checkNoCard( authData, testLinks, td, stars,   flatCard.cardId, ISS_FLAT, testStatus, {"peq": true} );
	testStatus     = await gh2tu.checkNoCard( authData, testLinks, td, ghoProg, progCard.cardId, ISS_PROG, testStatus, {"peq": true} );
	testStatus     = await gh2tu.checkNoCard( authData, testLinks, td, ghoPend, pendCard.cardId, ISS_PEND, testStatus, {"peq": true} );

	tu.testReport( testStatus, "situated B" );
    }
    
    {
	console.log( "Delete Accrued testing" );

	const ISS_AGHO1 = ISS_SITU + " Accrued card1st";
	const ISS_AGHO2 = ISS_SITU + " Accrued iss1st";

	// 0. make situated issues
	const label      = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, kp, 1000 );	
	const issDatAgho1 = await gh2tu.makeIssue( authData, td, ISS_AGHO1, [label] );
	const issDatAgho2 = await gh2tu.makeIssue( authData, td, ISS_AGHO2, [label] );

	// Assign.
	await gh2tu.addAssignee( authData, issDatAgho1, assignee1 );	
	await gh2tu.addAssignee( authData, issDatAgho2, assignee1 );	

	// add to gho pend
	const aghoCard1   = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, ghoPend.colId, issDatAgho1[0] );
	const aghoCard2   = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, ghoPend.colId, issDatAgho2[0] );

	// Close.. no need given ghey were created in PEND
	// await gh2tu.closeIssue( authData, td, issDatAgho1, ghoPend );
	// await gh2tu.closeIssue( authData, td, issDatAgho2, ghoPend );

	// Accrue
	await gh2tu.moveCard( authData, testLinks, td.ceProjectId, aghoCard1.cardId, ghoAccr.colId, {issId: issDatAgho1[0]} );
	await gh2tu.moveCard( authData, testLinks, td.ceProjectId, aghoCard2.cardId, ghoAccr.colId, {issId: issDatAgho2[0]} );

	await utils.sleep( 1000 );
	// Often unneeded, but useful if doing this as a one-off test
	await gh2tu.refreshUnclaimed( authData, td );
	// peqHolder maybe to allow more careful assign test in checkNewly to take place, instead of using checkSit
	// if gh assignment occurs fast, and ceServer label notification processing is slow, processNewPeq will see ghV2.getAssignees before
	// recording first aws PEQ.
	testStatus = await gh2tu.checkNewlyAccruedIssue( authData, testLinks, td, ghoAccr, issDatAgho1, aghoCard1, testStatus, {preAssign: 1, peqHolder: "maybe"} );
	testStatus = await gh2tu.checkNewlyAccruedIssue( authData, testLinks, td, ghoAccr, issDatAgho2, aghoCard2, testStatus, {preAssign: 1, peqHolder: "maybe"} );

	tu.testReport( testStatus, "accrued A" );
	
	// 2. remove them 1s with del card, remove 2s with del issue
	await gh2tu.remCard( authData, td.ceProjectId, td.githubOpsPID, aghoCard1.cardId );
	await gh2tu.remIssue( authData, issDatAgho2[0] );

	await utils.sleep( 2000 );

	testStatus = await gh2tu.checkNewbornIssue( authData, testLinks, td, issDatAgho1, testStatus );
	testStatus = await gh2tu.checkNoCard( authData, testLinks, td, ghoAccr, aghoCard1.cardId, ISS_AGHO1, testStatus, {"peq": true} );
	testStatus = await gh2tu.checkPact( authData, testLinks, td, ISS_AGHO1, config.PACTVERB_CONF, config.PACTACT_DEL, "", testStatus );

	testStatus = await gh2tu.checkNoIssue( authData, testLinks, td, issDatAgho2, testStatus );
	testStatus = await gh2tu.checkNoCard( authData, testLinks, td, ghoAccr, aghoCard2.cardId, ISS_AGHO2, testStatus, {"peq": true} );
	tu.testReport( testStatus, "accrued B" );
    }
    
    tu.testReport( testStatus, "Test Create Delete" );

    return testStatus;
}

async function getCardHelp( authData, td, pid, colId, cardName, testStatus ) {
    let uCards = await gh2tu.getCards( authData, td.ghRepoId, pid, colId );
    const card = uCards.find( card => card.title == cardName );
    return card;
}

async function labHelp( authData, td, getName, checkName, descr, testStatus ) {
    let subTest  = [ 0, 0, []];

    let labelRes = await gh2tu.getLabel( authData, td.ghRepoId, getName );
    let label    = labelRes.label;
    subTest      = await gh2tu.checkLabel( authData, label, checkName, descr, subTest );

    return await tu.settle( subTest, testStatus, labHelp, authData, td, getName, checkName, descr, testStatus );
}

async function getLabHelp( authData, td, name ) {
    const labelRes = await gh2tu.getLabel( authData, td.ghRepoId, name );
    return labelRes.label;
}

async function issueClosedHelp( authData, td, issId ) {
    let iss = await gh2tu.findIssue( authData, issId );
    return iss.state == 'closed'; 
}

async function labNotInIssueHelp( authData, td, labName, issId ) {
    let retVal = true;
    let accrIss = await gh2tu.findIssue( authData, issId );
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

    let iss = await gh2tu.findIssue( authData, issDat[0] );
    let ass = iss.assignees.find( a => a.login == assignee );
    if( typeof ass !== 'undefined' ) { retVal = true; }

    return retVal;
}

// edit, delete peq labels for open, pend and accr issues.  test a non-peq.
async function testLabelMods( authData, testLinks, td ) {
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
    
    await gh2tu.refreshRec( authData, td );
    await gh2tu.refreshFlat( authData, td );

    const ghoPlan = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PLAN] );
    const ghoPend = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PEND] );
    const ghoAccr = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_ACCR] );

    const assignee1 = await gh2tu.getAssignee( authData, ASSIGNEE1 );
    const assignee2 = await gh2tu.getAssignee( authData, ASSIGNEE2 );

    {
	// 1. Setup
	console.log( "\nMake labels, issues" );
	let lab1   = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, LAB1, 501 );
	let labNP1 = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, LABNP1, -1 );	
	let labNP2 = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, LABNP2, -1 );	

	const issNewbDat = await gh2tu.makeIssue( authData, td, ISS_NEWB, [labNP1] );                // [id, number, cardId, title] 
	const issPlanDat = await gh2tu.makeIssue( authData, td, ISS_PLAN, [lab1, labNP1, labNP2] );  
	const issPendDat = await gh2tu.makeIssue( authData, td, ISS_PEND, [lab1, labNP1, labNP2] );     
	const issAccrDat = await gh2tu.makeIssue( authData, td, ISS_ACCR, [lab1, labNP1, labNP2] );     

	// First unclaimed creation takes a sec
	await utils.sleep( 1000 );
	
	// Need assignees for pend/accr. 
	await gh2tu.addAssignee( authData, issPendDat, assignee1 );	
	await gh2tu.addAssignee( authData, issPendDat, assignee2 );	
	await gh2tu.addAssignee( authData, issAccrDat, assignee2 );

	// Set up cards
	const cardPlan = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, ghoPlan.colId, issPlanDat[0] );
	const cardPend = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, ghoPlan.colId, issPendDat[0] );
	const cardAccr = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, ghoPlan.colId, issAccrDat[0] );

	// Close & accrue
	await gh2tu.closeIssue( authData, td, issPendDat );
	await gh2tu.closeIssue( authData, td, issAccrDat, ghoPend );
	await gh2tu.moveCard( authData, testLinks, td.ceProjectId, cardAccr.cardId, ghoAccr.colId, {issId: issAccrDat[0]} );

	await utils.sleep( 2000 );	
	testStatus = await gh2tu.checkNewbornIssue( authData, testLinks, td, issNewbDat, testStatus, {lblCount: 1} );
	testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, ghoPlan, issPlanDat, cardPlan, testStatus, {label: 501, lblCount: 3} );
	testStatus = await gh2tu.checkNewlyClosedIssue( authData, testLinks, td, ghoPend, issPendDat, cardPend, testStatus, {label: 501, lblCount: 3} );
	testStatus = await gh2tu.checkNewlyAccruedIssue( authData, testLinks, td, ghoAccr, issAccrDat, cardAccr, testStatus, {label: 501, lblCount: 3} );

	tu.testReport( testStatus, "Label mods A" );

	// 2. Mod newborn label, label should be as modded.
	console.log( "Mod newborn label" );
	await gh2tu.updateLabel( authData, labNP1, {name: "newName", description: "newDesc"} );
	testStatus = await labHelp( authData, td, "newName", "newName", "newDesc", testStatus );
	tu.testReport( testStatus, "Label mods B" );
	
	// 3. delete np2, should no longer find it.
	console.log( "Remove nonPeq(2) label" );
	await gh2tu.delLabel( authData, labNP2 );
	testStatus = await labHelp( authData, td, LABNP2, -1, -1, testStatus );
	tu.testReport( testStatus, "Label mods C" );

	// 4. Edit lab1 name, fail and create new
	console.log( "Mod peq label name" );
	const smallKP = "51 " + config.PEQ_LABEL;    
	await gh2tu.updateLabel( authData, lab1, {name: smallKP} );

	testStatus = await labHelp( authData, td, LAB1, LAB1, "PEQ value: 501", testStatus );
	testStatus = await labHelp( authData, td, smallKP, smallKP, "PEQ value: 51", testStatus );
	testStatus = await gh2tu.checkPact( authData, testLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_NOTE, "PEQ label edit attempt", testStatus );	
	testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, ghoPlan, issPlanDat, cardPlan, testStatus, {label: 501, lblCount: 2} );
	testStatus = await gh2tu.checkNewlyAccruedIssue( authData, testLinks, td, ghoAccr, issAccrDat, cardAccr, testStatus, {label: 501, lblCount: 2} );	
	tu.testReport( testStatus, "Label mods D" );

	// 5. Edit lab1 descr, fail
	console.log( "Mod peq label descr" );
	await gh2tu.updateLabel( authData, lab1, {description: "PEQ value: 51"} );

	testStatus = await labHelp( authData, td, LAB1, LAB1, "PEQ value: 501", testStatus );
	testStatus = await gh2tu.checkPact( authData, testLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_NOTE, "PEQ label edit attempt", testStatus );	
	tu.testReport( testStatus, "Label mods E" );

	// 6. Edit lab1 all, fail & create new
	console.log( "Mod peq label name,descr" );
	const small52KP = "52 " + config.PEQ_LABEL;
	await gh2tu.updateLabel( authData, lab1, {name: small52KP,  description: "PEQ value: 52"} );
	
	testStatus = await labHelp( authData, td, LAB1, LAB1, "PEQ value: 501", testStatus );
	testStatus = await labHelp( authData, td, small52KP, small52KP, "PEQ value: 52", testStatus );
	testStatus = await gh2tu.checkPact( authData, testLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_NOTE, "PEQ label edit attempt", testStatus );	
	tu.testReport( testStatus, "Label mods F" );

	// 7. Delete lab1, fail
	console.log( "Delete peq label" );
	await gh2tu.delLabel( authData, lab1 );

	testStatus = await labHelp( authData, td, LAB1, LAB1, "PEQ value: 501", testStatus );	
	testStatus = await gh2tu.checkPact( authData, testLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_NOTE, "PEQ label delete attempt", testStatus );	
	testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, ghoPlan, issPlanDat, cardPlan, testStatus, {label: 501, lblCount: 2} );
	testStatus = await gh2tu.checkNewlyAccruedIssue( authData, testLinks, td, ghoAccr, issAccrDat, cardAccr, testStatus, {label: 501, lblCount: 2} );	
	tu.testReport( testStatus, "Label mods G" );

	// 8. Make partial peq label.  Three will be unlabeled (can't have 2 peq labels), one will remain.  Changed labNP1 from newName to 105P
	console.log( "Make partial peq label" );
	const pl105 = "105 " + config.PEQ_LABEL; 

	await utils.sleep( 1500 );
	// NOTE updateLabel returns subtest, but we don't catch it here so settle time can go crazy and still claim success.
	//      labHelp confirms that GH made the change, and updateLabel failure confirms that ceServer never got the notice.
	//      XXX this is incomplete - ceServer needs to do some work here, needs the notification.
	labNP1 = await tu.settleWithVal( "Label mods newName", getLabHelp, authData, td, "newName" );
	await gh2tu.updateLabel( authData, labNP1, {name: pl105, description: "newDesc"} );
	testStatus = await labHelp( authData, td, pl105, pl105, "PEQ value: 105", testStatus );
	tu.testReport( testStatus, "Label mods H" );

	// Clean
	// NOTE: if delete before update-driven LM Accrued remove label is complete, will see server error 404.
	//       update label above drives a bunch of asynch unwaited-for labelings.  So, wait until can't see issue's label any longer (i.e. remove is done)
	await tu.settleWithVal( "LabelMods remove from lmAccr", labNotInIssueHelp, authData, td, pl105, issAccrDat[0] );
	// updateLabel has changed values - get new stuff
	labNP1 = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, pl105, -1 );		
	await gh2tu.delLabel( authData, labNP1 );
    }
    
    tu.testReport( testStatus, "Label Mod" );

    return testStatus;
}

// edit proj / col names
async function testProjColMods( authData, testLinks, td ) {
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

    const assignee1 = await gh2tu.getAssignee( authData, ASSIGNEE1 );
    const assignee2 = await gh2tu.getAssignee( authData, ASSIGNEE2 );
    
    {
	// 1. Setup.  New project. full cols. 1 peq issue each.
	const projId    = await gh2tu.makeProject( authData, td, PROJ_NAME, "" );
	const planColId = await gh2tu.makeColumn( authData, testLinks, td.ceProjectId, td.ghFullName, projId, planName );
	const pendColId = await gh2tu.makeColumn( authData, testLinks, td.ceProjectId, td.ghFullName, projId, pendName );
	const accrColId = await gh2tu.makeColumn( authData, testLinks, td.ceProjectId, td.ghFullName, projId, accrName );

	const planLoc = await gh2tu.getFlatLoc( authData, projId, PROJ_NAME, planName );
	const pendLoc = await gh2tu.getFlatLoc( authData, projId, PROJ_NAME, pendName );
	const accrLoc = await gh2tu.getFlatLoc( authData, projId, PROJ_NAME, accrName );

	let label1k  = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, kp, 1000 );	

	const issPlanDat = await gh2tu.makeIssue( authData, td, ISS_PLAN, [ label1k ] );
	const issPendDat = await gh2tu.makeIssue( authData, td, ISS_PEND, [ label1k ] );
	const issAccrDat = await gh2tu.makeIssue( authData, td, ISS_ACCR, [ label1k ] );

	// First unclaimed creation takes a sec
	await utils.sleep( 1000 );
	
	// Need assignees for pend/accr. 
	await gh2tu.addAssignee( authData, issPendDat, assignee2 );	
	await gh2tu.addAssignee( authData, issAccrDat, assignee1 );

	// Set up cards
	const cardPlan = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, projId, planLoc.colId, issPlanDat[0] );
	const cardPend = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, projId, planLoc.colId, issPendDat[0] );
	const cardAccr = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, projId, planLoc.colId, issAccrDat[0] );

	// Close & accrue
	await gh2tu.closeIssue( authData, td, issPendDat );
	await gh2tu.closeIssue( authData, td, issAccrDat, pendLoc );
	// closeIssue returns only after notice seen.  but notice-job can be demoted.  be extra sure.
	await tu.settleWithVal( "closeIssue", issueClosedHelp, authData, td, issAccrDat[0] );	
	await gh2tu.moveCard( authData, testLinks, td.ceProjectId, cardAccr.cardId, accrLoc.colId, {issId: issAccrDat[0]} );

	await utils.sleep( 2000 );	
	testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, planLoc, issPlanDat, cardPlan, testStatus );
	testStatus = await gh2tu.checkNewlyClosedIssue(   authData, testLinks, td, pendLoc, issPendDat, cardPend, testStatus, {peqHolder: "maybe"} );
	testStatus = await gh2tu.checkNewlyAccruedIssue(  authData, testLinks, td, accrLoc, issAccrDat, cardAccr, testStatus, {peqHolder: "maybe"} );

	tu.testReport( testStatus, "ProjCol mods A" );

	// XXX uh oh.. 
	// 2. Edit plan column.
	console.log( "Mod Plan col" );
	await gh2tu.updateColumn( authData, planLoc.colId, "New plan name" );
	planLoc.colName = "New plan name";
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, planLoc, issPlanDat, cardPlan, testStatus );
	testStatus = await gh2tu.checkPact( authData, testLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_CHAN, config.PACTNOTE_CREN, testStatus, {sub:[planLoc.colId.toString(), planName, "New plan name" ]} );

	tu.testReport( testStatus, "ProjCol mods B" );

	// 3. Edit pend, accr column.  fail, reserved.
	console.log( "Mod Pend col" );
	await gh2tu.updateColumn( authData, pendLoc.colId, "New pend name" );
	await gh2tu.updateColumn( authData, accrLoc.colId, "New accr name" );
	// do not update locs, nothing should have changed.
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, pendLoc, issPendDat, cardPend, testStatus );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, accrLoc, issAccrDat, cardAccr, testStatus );
	testStatus = await gh2tu.checkPact( authData, testLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_NOTE, config.PACTNOTE_CREN + " attempted", testStatus, {sub:[accrName]} );	
	
	tu.testReport( testStatus, "ProjCol mods C" );

	// 4. Edit proj name.
	console.log( "Mod Proj Name" );
	const newProjName = "New " + PROJ_NAME;
	await gh2tu.updateProject( authData, projId, newProjName );
	planLoc.projName = newProjName;
	pendLoc.projName = newProjName;
	accrLoc.projName = newProjName;
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, planLoc, issPlanDat, cardPlan, testStatus );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, pendLoc, issPendDat, cardPend, testStatus );
	testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, accrLoc, issAccrDat, cardAccr, testStatus );
	testStatus = await gh2tu.checkPact( authData, testLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_CHAN, config.PACTNOTE_PREN, testStatus, {sub:[projId.toString(), PROJ_NAME, newProjName]} );	
    }
    
    
    tu.testReport( testStatus, "Test ProjCol Mod" );

    return testStatus;
}


// XXX Can not get ghv2:deleteProject to work, so actual delete must be by hand.
// XXX Can not create custom columns, so auto-create limits testing to non-PEND/ACCR peqs.
// NOTE this is not an onboarding test.  Requires testSetup to push ceProj into aws ceProject table
// simplified project delete test until can create columns.
// So.. 1) comment out delete section, run.  2) comment out create section, delete by hand.  3) uncomment delete section, run
async function testProjDel( authData, testLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test ProjDel" );
    authData.who = "<TEST: ProjDel>";
    
    const ISS_PLAN = "PD Open";
    const ISS_PROG = "PD Prog";
    const PROJ_NAME = "ProjDel Proj";

    const todoName = "Todo";
    const progName = "In Progress";

    const kp = "1000 " + config.PEQ_LABEL;

    const assignee1 = await gh2tu.getAssignee( authData, ASSIGNEE1 );
    const assignee2 = await gh2tu.getAssignee( authData, ASSIGNEE2 );

    
    {
	// 1. Setup.  New project. default cols. 1 peq issue each.
	const projId    = await gh2tu.createDefaultProject( authData, td, PROJ_NAME, "" );
	const planColId = await gh2tu.makeColumn( authData, testLinks, td.ceProjectId, td.ghFullName, projId, todoName );
	const progColId = await gh2tu.makeColumn( authData, testLinks, td.ceProjectId, td.ghFullName, projId, progName );

	const planLoc = await gh2tu.getFlatLoc( authData, projId, PROJ_NAME, todoName );
	const progLoc = await gh2tu.getFlatLoc( authData, projId, PROJ_NAME, progName );

	let label1k  = await gh2tu.findOrCreateLabel( authData, td.ghRepoId, kp, 1000 );	

	const issPlanDat = await gh2tu.makeIssue( authData, td, ISS_PLAN, [ label1k ] );
	const issProgDat = await gh2tu.makeIssue( authData, td, ISS_PROG, [ label1k ] );

	// First unclaimed creation takes a sec
	await utils.sleep( 1000 );
	
	await gh2tu.addAssignee( authData, issPlanDat, assignee2 );	
	await gh2tu.addAssignee( authData, issProgDat, assignee1 );

	// Set up cards
	const cardPlan = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, projId, planLoc.colId, issPlanDat[0] );
	const cardProg = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, projId, progLoc.colId, issProgDat[0] );

	// can NOT Close & accrue without creating columns.
	testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, planLoc, issPlanDat, cardPlan, testStatus );
	testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, progLoc, issProgDat, cardProg, testStatus );

	tu.testReport( testStatus, "ProjDel mods A" );

    
	// XXX Can't get delete to work yet, so this step must occur by hand.
	// gh2tu.remProject( authData, projId );
	await gh2tu.refreshUnclaimed( authData, td );
	/*
	  const unclLoc = await gh2tu.getFlatLoc( authData, td.unclaimPID, td.unclaimTitle, td.unclaimTitle );
	  // Cards are now in unclaimed.  remake proj/col id.
	  assert( cardPlan.length == cardProg.length );
	  assert( cardPlan.length == 5 );
	  
	  let query = { ceProjId: td.ceProjectId, pid: td.unclaimPID, colId: td.unclaimCID };  
	  const locs = testLinks.getLocs( authData, query );    
	  assert( locs !== -1 );
	  let statusId = locs[0].hostUtility;
	  cardPlan[2] = statusId;
	  cardPlan[3] = td.unclaimCID;
	  cardPlan[4] = td.unclaimTitle;
	  cardProg[2] = statusId;
	  cardProg[3] = td.unclaimCID;
	  cardProg[4] = td.unclaimTitle;

	  testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, unclLoc, issPlanDat, cardPlan, testStatus );
	  testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, unclLoc, issProgDat, cardProg, testStatus );

	  tu.testReport( testStatus, "ProjDel mods B" );
	  
	 */
    }

    
    tu.testReport( testStatus, "Test ProjCol Mod" );

    return testStatus;
}




async function runTests( authData, testLinks, td ) {


    console.log( "Component tests =================" );

    let testStatus = [ 0, 0, []];


    /*
    // NOTE: MUST leave this test off without manual cleanup - otherwise setup phase will create a bazillion projdel projects.
    let t0 = await testProjDel( authData, testLinks, td );
    console.log( "\n\nProjDel test complete." );
    // ghUtils.show( true );    
    await utils.sleep( 5000 );
    */

    let t1 = await testAssignment( authData, testLinks, td );
    console.log( "\n\nAssignment test complete." );
    // ghUtils.show( true );    
    await utils.sleep( 5000 );
    
    let t2 = await testLabel( authData, testLinks, td ); 
    console.log( "\n\nLabel test complete." );
    // ghUtils.show( true );
    await utils.sleep( 5000 );

    let t3 = await testLabelCarded( authData, testLinks, td );
    console.log( "\n\nLabel Carded complete." );
    // ghUtils.show( true );
    await utils.sleep( 5000 );
    
    let t4 = await testCloseReopen( authData, testLinks, td ); 
    console.log( "\n\nClose / Reopen complete." );
    // ghUtils.show( true );
    await utils.sleep( 5000 );

    let t5 = await testCreateDelete( authData, testLinks, td );
    console.log( "\n\nCreate / Delete complete." );
    // ghUtils.show( true );
    await utils.sleep( 5000 );

    let t6 = await testLabelMods( authData, testLinks, td );
    console.log( "\n\nLabel mods complete." );
    // ghUtils.show( true );
    await utils.sleep( 5000 );

    /*
    // XXX As of 10/2023 still can't create or edit status field values, i.e. columns
    //     these tests are largely worthless until then. 
    let t7 = await testProjColMods( authData, testLinks, td );
    console.log( "\n\nProjCol mods complete." );
    // await utils.sleep( 5000 );
    */

    // testStatus = tu.mergeTests( testStatus, t0 );

    testStatus = tu.mergeTests( testStatus, t1 );
    testStatus = tu.mergeTests( testStatus, t2 );
    testStatus = tu.mergeTests( testStatus, t3 );
    testStatus = tu.mergeTests( testStatus, t4 );
    testStatus = tu.mergeTests( testStatus, t5 );
    testStatus = tu.mergeTests( testStatus, t6 );

    // testStatus = tu.mergeTests( testStatus, t7 );

    return testStatus
}


export default runTests;
