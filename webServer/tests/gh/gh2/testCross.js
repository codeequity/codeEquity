import assert   from 'assert';

import * as config   from '../../../config.js';
import * as utils    from '../../../utils/ceUtils.js';
import * as awsUtils from '../../../utils/awsUtils.js';

import * as tu       from '../../ceTestUtils.js';
import * as ghUtils  from '../../../utils/gh/ghUtils.js';
import * as gh2tu    from './gh2TestUtils.js';

import testData from '../testData.js';


async function cardPresentHelp( authData, td, pid, colId, issId ) {
    let retVal = false;

    let allCards  = await gh2tu.getCards( authData, td.ghRepoId, pid, colId );

    let c = allCards.find( card => card.issueId == issId ); 
    if( typeof c !== 'undefined' ) { retVal = true; }

    return retVal;
}


// Requires config.TEST_ACTOR to have installed the codeEquity app for all repos, not just one.
// Requires config.CROSS_TEST_REPO & config.TEST_REPO & config.FLUTTER_TEST_REPO to allow both config.CE_ACTOR and config.TEST_ACTOR to have R/W access
// This way, authData is shared.   td is NOT shared.
async function testCrossRepo( flutterTest, authData, authDataX, testLinks, td, tdX ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];
    let testName = "CrossRepo";

    console.log( "Test", testName );
    authData.who = "<TEST: " + testName + ">";

    await gh2tu.refreshRec( authData, td );

    assert( config.CROSS_TEST_ACTOR == config.TEST_ACTOR );
    assert( config.CROSS_TEST_REPO  != config.TEST_REPO );
    assert( config.CROSS_TEST_REPO  != config.FLUTTER_TEST_REPO );

    // Setup.
    // Add populate label to testProject2, to invoke repostatus
    let crossPid = await gh2tu.createProjectWorkaround( authDataX, tdX, "Cross Proj", "For testing transfers to other repos" );
    let crossCid = await gh2tu.makeColumn( authDataX, testLinks, tdX.ceProjectId, tdX.ghFullName, crossPid, "Cross Col" );
    
    const LAB = "704 " + config.PEQ_LABEL;
    let lab   = await gh2tu.findOrCreateLabel( authData,  td.ghRepoId,  LAB, 704 );
    let labX  = await gh2tu.findOrCreateLabel( authDataX, tdX.ghRepoId, LAB, 704 );

    const ASSIGNEE1 = "ariCETester";
    const ASSIGNEE2 = "builderCE";

    let assignee1   = await gh2tu.getAssignee( authData,  ASSIGNEE1 );
    let assignee2   = await gh2tu.getAssignee( authData,  ASSIGNEE2 );
    let assignee1X  = await gh2tu.getAssignee( authDataX, ASSIGNEE1 );
    let assignee2X  = await gh2tu.getAssignee( authDataX, ASSIGNEE2 );
    
    const stripeLoc = await gh2tu.getFlatLoc( authData, td.githubOpsPID, td.githubOpsTitle, "Stripes" );
    const crossLoc  = await gh2tu.getFlatLoc( authDataX, crossPid, "Cross Proj", "Cross Col" );


    // 1. Create in test Project
    let issDat = await gh2tu.blastIssue( authData, td, "CT Blast", [lab], [assignee1, assignee2] );               
    await utils.sleep( 2000 );

    const card  = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.githubOpsPID, stripeLoc.colId, issDat[0] );
    await utils.sleep( 1000 );

    // Adding makeProjectCard creates second add/relo which clears assignees found in pnp:fromLabelIssue.  It's ok, PACt has it.
    testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, stripeLoc, issDat, card, testStatus, {label: 704, lblCount: 1});
    
    let oldPeqs = await awsUtils.getPEQs( authData, { "ceProjectId": td.ceProjectId });
    let peq     = oldPeqs.find(p => p.HostIssueId == issDat[0].toString() );
    let sub     = [peq.PEQId, td.githubOpsPID.toString(), stripeLoc.colId.toString() ];
    testStatus  = await gh2tu.checkPact( authData, testLinks, td, issDat[3], config.PACTVERB_CONF, config.PACTACT_RELO, "", testStatus, {sub: sub} );
    
    tu.testReport( testStatus, "Test " + testName + " A" );    
    

    // 2. Create in cross project
    let issDatX = await gh2tu.blastIssue( authDataX, tdX, "CT Blast X", [labX], [assignee1X, assignee2X] );               
    await utils.sleep( 2000 );

    const cardX  = await gh2tu.makeProjectCard( authDataX, testLinks, tdX.ceProjectId, crossPid, crossLoc.colId, issDatX[0] );
    await tu.settleWithVal( "Cross test make cross card", cardPresentHelp, authDataX, tdX, crossPid, crossLoc.colId, issDatX[0] );
    
    testStatus = await gh2tu.checkSituatedIssue( authDataX, testLinks, tdX, crossLoc, issDatX, cardX, testStatus, {label: 704, lblCount: 1});
    
    let oldPeqsX  = await awsUtils.getPEQs( authDataX, { "ceProjectId": tdX.ceProjectId });
    let peqX      = oldPeqsX.find(p => p.HostIssueId == issDatX[0].toString() );
    sub           = [peqX.PEQId, crossPid.toString(), crossCid.toString() ];
    testStatus    = await gh2tu.checkPact( authDataX, testLinks, tdX, issDatX[3], config.PACTVERB_CONF, config.PACTACT_RELO, "", testStatus, {sub: sub} );

    tu.testReport( testStatus, "Test " + testName + " B" );    

    // 3. Transfer each to the other
    const issue  = await gh2tu.findIssue( authData, issDat[0] );
    const repo   = await gh2tu.findRepo( authData, td );
    const issueX = await gh2tu.findIssue( authDataX, issDatX[0] );
    const repoX  = await gh2tu.findRepo( authDataX, tdX );

    
    console.log( "TRANSFER BEGINNING" );  
    console.log( "base : ", issue.id, repoX.id );
    console.log( "baseX: ", issueX.id, repo.id );
    await gh2tu.transferIssue( authData, issue.id, repoX.id );
    await gh2tu.transferIssue( authDataX, issueX.id, repo.id );
    await utils.sleep( 2000 );

    // Note: at this point, locs for both CEProjects will contain Cross Proj and ghOps.  This is because
    //       projects are still linked.
    
    const newGHIssue = await gh2tu.findIssueByName( authData, td, issDatX[3] );
    const newXIssue  = await gh2tu.findIssueByName( authDataX, tdX, issDat[3] );

    // Id, number, repo has changed. Card, Card location, peqiness has not
    let oldId  = issDat[0];
    issDat[0]  = newXIssue.id;
    issDat[1]  = newXIssue.number;

    let oldIdX = issDatX[0];
    issDatX[0] = newGHIssue.id;
    issDatX[1] = newGHIssue.number;

    // issDatX now has new id, same card, and belongs to td's ceProject and repo.  Peqs have been deleted, and re-added.
    // issDat still resides in githubOps, but now is part of tdx.ceProjectId.  
    //        i.e. pre-transfer, peq proj sub is SoftCont:githubOps:NS, post transfer it is githubOps:stripes.
    // Both GhOps and crossProj show up in both ari and ariAlt, at least until unlink proj from td and projx from tdx.
    // But, choosing not to unlink in order to create confusion then cure in deeper way.
    stripeLoc.projSub = ["Github Operations", "Stripes" ];
    if( td.testType == "FrontEnd" ) { stripeLoc.projSub = ["Github Operations Flut", "Stripes" ]; }
	
    testStatus = await gh2tu.checkSituatedIssue( authDataX, testLinks, tdX, stripeLoc, issDat, card, testStatus, {assign: 2, label: 704, lblCount: 1, peqCEP: tdX.ceProjectId} );    
    testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, crossLoc, issDatX, cardX, testStatus, {assign: 2, label: 704, lblCount: 1, peqCEP: td.ceProjectId} );    

    let newPeqs  = awsUtils.getPEQs( authDataX, { "ceProjectId": td.ceProjectId });
    let newPeqsX = awsUtils.getPEQs( authDataX, { "ceProjectId": tdX.ceProjectId });

    
    let testRepo = flutterTest ? config.FLUTTER_TEST_REPO : config.TEST_REPO;

    // PAct is found from oldCEP
    sub         = [peqX.PEQId, oldIdX, tdX.ghRepoId, tdX.ceProjectId, issDatX[0], td.ghRepoId, td.ceProjectId ];
    testStatus  = await gh2tu.checkPact( authDataX, testLinks, tdX, -1, config.PACTVERB_CONF, config.PACTACT_RELO, config.PACTNOTE_GXFR, testStatus, {sub: sub, depth: 4} );

    sub         = [peq.PEQId, oldId, td.ghRepoId, td.ceProjectId, issDat[0], tdX.ghRepoId, tdX.ceProjectId ];
    testStatus  = await gh2tu.checkPact( authData, testLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_RELO, config.PACTNOTE_GXFR, testStatus, {sub: sub, depth: 4} );

    // New Peqs were validated above.  Check delete/add pacts.  
    newPeqs      = await newPeqs;
    newPeqsX     = await newPeqsX;
    let oldPeq   = oldPeqs.find(p => p.HostIssueId == oldId );
    let oldPeqX  = oldPeqsX.find(p => p.HostIssueId == oldIdX );
    let newPeq   = newPeqs.find(p => p.HostIssueId == issDat[0] );
    let newPeqX  = newPeqsX.find(p => p.HostIssueId == issDatX[0] );

    // console.log( "oldPeq", oldPeq );
    // console.log( "oldPeqX", oldPeqX );
    // console.log( "newPeq", newPeq );
    // console.log( "newPeqX", newPeqX );
    
    testStatus  = await gh2tu.checkPact( authData, testLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_DEL, config.PACTNOTE_XFRD, testStatus, {sub: [oldPeq.PEQId], depth: 4} );
    testStatus  = await gh2tu.checkPact( authDataX, testLinks, tdX, -1, config.PACTVERB_CONF, config.PACTACT_ADD, "", testStatus, {sub: [newPeq.PEQId], depth: 4} );
    testStatus  = await gh2tu.checkPact( authDataX, testLinks, tdX, -1, config.PACTVERB_CONF, config.PACTACT_DEL, config.PACTNOTE_XFRD, testStatus, {sub: [oldPeqX.PEQId], depth: 4} );
    testStatus  = await gh2tu.checkPact( authData, testLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_ADD, "", testStatus, {sub: [newPeqX.PEQId], depth: 4} );

    tu.testReport( testStatus, "Test " + testName );
    return testStatus;
}

// NOTE, this is sensitive.  Add more interleave cards in unclaimed before testCross runs, and this will fail.
async function getCardsHelp( authData, rid, pid, cid, desiredCount ) {
    let allCards = await gh2tu.getCards( authData, rid, pid, cid );
    let ret = false;
    let interleaveCards = allCards.filter( card => card.title.includes( "Interleave" ) && card.repoId == rid );
    if( interleaveCards.length == desiredCount ) { ret = interleaveCards; }

    return ret;
}

// XXX consider using multiPid, multiCid to interleave across projects as well.  Currently, Multi proj just .. sits there.
// Simulate a simple multithread test here, by randomly ordering a set of blast issues
// for two different users/repos, and fire them all off nearly-simultaneously.  With the rest delay to and from GH,
// resulting notifications will interleave and stack up 
async function testMultithread( authData, authDataM, testLinks, td, tdM ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];
    let testName = "Multithread";

    console.log( "Test", testName, td.ghRepoId, tdM.ghRepoId );
    authData.who = "<TEST: " + testName + ">";

    await gh2tu.refreshRec( authData, td );

    // Setup for blasting from two different testers / repos. 
    assert( config.MULTI_TEST_ACTOR != config.TEST_ACTOR );
    assert( td.ghFullName != tdM.ghFullName );

    // Add populate label to testProject2, to invoke repostatus. 
    let unclPid  = await gh2tu.createProjectWorkaround( authDataM, tdM, "UnClaimed", "For testing request interleaving" );
    let multiPid = await gh2tu.createProjectWorkaround( authDataM, tdM, "Multi Proj", "For testing request interleaving" );
    let multiCid = await gh2tu.makeColumn( authDataM, testLinks, tdM.ceProjectId, tdM.ghFullName, multiPid, "Multi Col" );

    // Labels, Assignees & Locs
    const LAB    = "903 " + config.PEQ_LABEL;
    const LABNP1 = "bug";
    const LABNP2 = "documentation";
    let lab     = await gh2tu.findOrCreateLabel( authData,  td.ghRepoId, LAB, 903 );
    let labNP1  = await gh2tu.findOrCreateLabel( authData,  td.ghRepoId, LABNP1, -1 );
    let labNP2  = await gh2tu.findOrCreateLabel( authData,  td.ghRepoId, LABNP2, -1 );
    let labM    = await gh2tu.findOrCreateLabel( authDataM, tdM.ghRepoId, LAB, 903 );
    let labNP1M = await gh2tu.findOrCreateLabel( authDataM, tdM.ghRepoId, LABNP1, -1 );
    let labNP2M = await gh2tu.findOrCreateLabel( authDataM, tdM.ghRepoId, LABNP2, -1 );

    const ASSIGNEE1 = "ariCETester";
    const ASSIGNEE2 = "builderCE";
    const ASSIGNEE3 = "connieCE";
    let assignee1   = await gh2tu.getAssignee( authData,  ASSIGNEE1 );
    let assignee2   = await gh2tu.getAssignee( authData,  ASSIGNEE2 );
    let assignee3   = await gh2tu.getAssignee( authData,  ASSIGNEE3 );
    let assignee1M  = await gh2tu.getAssignee( authDataM, ASSIGNEE1 );
    let assignee2M  = await gh2tu.getAssignee( authDataM, ASSIGNEE2 );
    let assignee3M  = await gh2tu.getAssignee( authDataM, ASSIGNEE3 );

    console.log( authData.who, lab, td.ghRepoId );
    console.log( authDataM.who, labM, tdM.ghRepoId );
    
    // There are 5 blast issues of each repo, randomized, sent with a small random gap between 200-500ms.

    let issDatPromises = [0,1,2,3,4,5,6,7,8,9];
    let callIndex = [0,1,2,3,4,5,6,7,8,9];
    callIndex = tu.shuffle( callIndex );

    // Build promises with delays built in to keep GH from going crazy.  Then do some work before trying to collect.
    for( const index of callIndex ) {
	console.log( "Fire", index );
	let dat = [];
	switch( index ) {
	case 0: dat = gh2tu.blastIssue( authData,  td,  "Interleave 0",  [lab],                 [assignee1], {wait: false});                       break;
	case 1: dat = gh2tu.blastIssue( authData,  td,  "Interleave 1",  [lab, labNP2],         [assignee1, assignee2], {wait: false});            break;
	case 2: dat = gh2tu.blastIssue( authData,  td,  "Interleave 2",  [lab, labNP1],         [assignee3, assignee2], {wait: false});            break;
	case 3: dat = gh2tu.blastIssue( authData,  td,  "Interleave 3",  [lab, labNP1, labNP2], [assignee1, assignee2, assignee3], {wait: false}); break;
	case 4: dat = gh2tu.blastIssue( authData,  td,  "Interleave 4",  [labNP1],              [assignee1, assignee3], {wait: false});            break;
	case 5: dat = gh2tu.blastIssue( authDataM, tdM, "InterleaveM 0", [labNP2M],              [assignee1M], {wait: false});                       break;
	case 6: dat = gh2tu.blastIssue( authDataM, tdM, "InterleaveM 1", [labM],                 [assignee3M, assignee2M], {wait: false});            break;
	case 7: dat = gh2tu.blastIssue( authDataM, tdM, "InterleaveM 2", [labM, labNP1M],         [assignee3M, assignee1M, assignee2M], {wait: false}); break;
	case 8: dat = gh2tu.blastIssue( authDataM, tdM, "InterleaveM 3", [labM, labNP1M, labNP2M], [assignee1M, assignee2M], {wait: false});            break;
	case 9: dat = gh2tu.blastIssue( authDataM, tdM, "InterleaveM 4", [labM, labNP2M],         [assignee2M, assignee1M], {wait: false});            break;
	default: assert( false );  break;
	}
	issDatPromises[index] =  dat;
	const delay = Math.floor(Math.random() * 300);
	await utils.sleep( 200 + delay );
    }
    assert( issDatPromises.length == callIndex.length );

    let issDat = [];
    console.log( callIndex );
    await Promise.all( issDatPromises )
	.then( results => results.forEach( function (dat) { issDat.push( dat ); }));
    console.log( issDat );

    // Promises have resolved.  Wait for CE to catch up to at least unclaimed
    await utils.sleep( 9000 );  

    // No moving, all cards appear in unclaimed.  This must be after promises, Unclaimed may not get created for a while.
    // Note, unclaimed is the same here for td, tdM
    await gh2tu.refreshUnclaimed( authData, td );
    await gh2tu.refreshUnclaimed( authDataM, tdM );  
    const projects = await gh2tu.getProjects( authDataM, tdM );
    const uncProj  = projects.find( proj => proj.title == config.UNCLAIMED );

    const uncLoc  = await gh2tu.getFlatLoc( authData, td.unclaimPID, config.UNCLAIMED, config.UNCLAIMED );
    const uncLocM = await gh2tu.getFlatLoc( authDataM, uncProj.id, config.UNCLAIMED, config.UNCLAIMED );

    // NOTE uncLoc and uncLocM are identical now that unclaimed is same project (view) used for both repos.
    //      Leave this in place - down the road may test multithread over multiple ceProjects.
    // This waits until interleave creations above has finished, which currently takes ~15s.  Each peq label is costing ~2s
    let allCards  = await tu.settleWithVal( "Get cards from unclaimed ", getCardsHelp, authData, td.ghRepoId, uncLoc.pid, uncLoc.colId, 4 ); 
    let allCardsM = await tu.settleWithVal( "Get cards from unclaimedM ", getCardsHelp, authDataM, tdM.ghRepoId, uncLocM.pid, uncLocM.colId, 4 ); 

    if( allCards && allCardsM ) {
	let c, cM = {};
	for( const i of callIndex ) {
	    
	    if( i <= 4 ) { c  = allCards.find( card => card.issueNum == issDat[i][1].toString() ); }
	    else         { cM = allCardsM.find( card => card.issueNum == issDat[i][1].toString() ); }
	    
	    console.log( "Check", i );
	    switch( i ) {
	    case 0: testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, uncLoc, issDat[i], c, testStatus, {label: 903, lblCount: 1, assign: 1});  break;
	    case 1: testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, uncLoc, issDat[i], c, testStatus, {label: 903, lblCount: 2, assign: 2});  break;
	    case 2: testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, uncLoc, issDat[i], c, testStatus, {label: 903, lblCount: 2, assign: 2});  break;
	    case 3: testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, uncLoc, issDat[i], c, testStatus, {label: 903, lblCount: 3, assign: 3});  break;
	    case 4: testStatus = await gh2tu.checkNewbornIssue( authData, testLinks, td, issDat[i], testStatus, {lblCount: 1});  break;
	    case 5: testStatus = await gh2tu.checkNewbornIssue( authDataM, testLinks, tdM, issDat[i], testStatus, {lblCount: 1});  break;
	    case 6: testStatus = await gh2tu.checkSituatedIssue( authDataM, testLinks, tdM, uncLocM, issDat[i], cM, testStatus, {label: 903, lblCount: 1, assign: 2});  break;
	    case 7: testStatus = await gh2tu.checkSituatedIssue( authDataM, testLinks, tdM, uncLocM, issDat[i], cM, testStatus, {label: 903, lblCount: 2, assign: 3});  break;
	    case 8: testStatus = await gh2tu.checkSituatedIssue( authDataM, testLinks, tdM, uncLocM, issDat[i], cM, testStatus, {label: 903, lblCount: 3, assign: 2});  break;
	    case 9: testStatus = await gh2tu.checkSituatedIssue( authDataM, testLinks, tdM, uncLocM, issDat[i], cM, testStatus, {label: 903, lblCount: 2, assign: 2});  break;
	    default:  assert( false );  break;
	    }
	}
    }

    tu.testReport( testStatus, "Test", testName );
    return testStatus;
}




async function runTests( flutterTest, authData, authDataX, authDataM, testLinks, td, tdX, tdM ) {


    console.log( "Cross tests =================" );

    let testStatus = [ 0, 0, []];

    // First build up aws CEProjects hostRepositories for repo: ceTesterAriAlt, ceTesterConnie
    await gh2tu.linkRepo( authDataM, tdM.ceProjectId, tdM.ghRepoId, tdM.ghFullName, tdM.cepDetails );
    await gh2tu.linkRepo( authDataX, tdX.ceProjectId, tdX.ghRepoId, tdX.ghFullName, tdX.cepDetails );

    let t1 = await testCrossRepo( flutterTest, authData, authDataX, testLinks, td, tdX );
    console.log( "\n\nCross Repo test complete." );
    // ghUtils.show( true );
    await utils.sleep( 5000 );
    
    let t2 = await testMultithread( authData, authDataM, testLinks, td, tdM );
    console.log( "\n\nMultithread test complete." );
    // ghUtils.show( true );
    await utils.sleep( 5000 );

    testStatus = tu.mergeTests( testStatus, t1 );
    testStatus = tu.mergeTests( testStatus, t2 );

    return testStatus
}


export default runTests;
