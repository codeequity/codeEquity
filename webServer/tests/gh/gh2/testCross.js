const assert = require( 'assert' );
const config = require( '../../../config' );

const utils    = require( '../../../utils/ceUtils' );
const awsUtils = require( '../../../utils/awsUtils' );

const tu       = require( '../../ceTestUtils' );

const testData = require( '../testData' );
const gh2tu    = require( './gh2TestUtils' );


async function cardPresentHelp( authData, pid, colId, issId ) {
    let retVal = false;

    let allCards  = await gh2tu.getCards( authData, pid, colId );
    
    let c = allCards.find( card => card.issueId == issId ); 
    if( typeof c !== 'undefined' ) { console.log( "CROSS XXX RV: " ); retVal = true; }

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
    let crossCid = await gh2tu.makeColumn( authDataX, testLinks, tdX.CEProjectId, tdX.GHFullName, crossPid, "Cross Col" );
    
    let issPopDat = await gh2tu.makeIssue( authDataX, tdX, "A special populate issue", [] );
    let cardPop   = await gh2tu.makeProjectCard( authDataX, testLinks, tdX.ceProjectId, crossPid, crossCid, issPopDat[0] );
    let popLabel  = await gh2tu.findOrCreateLabel( authDataX, tdX.GHRepoId, false, config.POPULATE, -1 );
    let ipDat     = [issPopDat[0], issPopDat[1], cardPop.cardId, "A special populate issue" ];
    await gh2tu.addLabel( authDataX, popLabel.id, ipDat );       
    await utils.sleep( 1000 );

    const LAB = "704 " + config.PEQ_LABEL;
    let lab   = await gh2tu.findOrCreateLabel( authData,  td.GHRepoId, false, LAB, 704 );
    let labX  = await gh2tu.findOrCreateLabel( authDataX, tdX.GHRepoId, false, LAB, 704 );

    const ASSIGNEE1 = "ariCETester";
    const ASSIGNEE2 = "builderCE";
        
    const stripeLoc = await gh2tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, "Stripes" );
    const crossLoc  = await gh2tu.getFlatLoc( authDataX, crossPid, "Cross Proj", "Cross Col" );


    // 1. Create in test Project
    let issDat = await gh2tu.blastIssue( authData, td, "CT Blast", [LAB], [ASSIGNEE1, ASSIGNEE2] );               
    await utils.sleep( 2000 );

    const card  = await gh2tu.makeProjectCard( authData, testLinks, td.CEProjectId, td.githubOpsPID, stripeLoc.colId, issDat[0] );
    await utils.sleep( 1000 );
    
    testStatus = await gh2tu.checkSituatedIssue( authData, testLinks, td, stripeLoc, issDat, card, testStatus, {label: 704, lblCount: 1, assign: 2});
    
    let allPeqs = await awsUtils.getPeqs( authData, { "CEProjectId": td.CEProjectId });
    let peq     = allPeqs.find(p => p.hostIssueId == issDat[0].toString() );
    let sub     = [peq.PEQId, td.githubOpsPID.toString(), stripeLoc.colId.toString() ];
    testStatus  = await gh2tu.checkPact( authData, testLinks, td, issDat[3], config.PACTVERB_CONF, config.PACTACT_RELO, "", testStatus, {sub: sub} );
    
    tu.testReport( testStatus, "Test " + testName + " A" );    
    

    // 2. Create in cross project
    let issDatX = await gh2tu.blastIssue( authDataX, tdX, "CT Blast X", [LAB], [ASSIGNEE1, ASSIGNEE2] );               
    await utils.sleep( 2000 );

    const cardX  = await gh2tu.makeProjectCard( authDataX, testLinks, tdX.CEProjectId, crossPid, crossLoc.colId, issDatX[0] );
    await tu.settleWithVal( "Cross test make cross card", cardPresentHelp, authData, crossPid, crossLoc.colId, issDatX[0] );
    
    testStatus = await gh2tu.checkSituatedIssue( authDataX, testLinks, tdX, crossLoc, issDatX, cardX, testStatus, {label: 704, lblCount: 1, assign: 2});
    
    allPeqs  = await awsUtils.getPeqs( authDataX, { "CEProjectId": tdX.CEProjectId });
    let peqX = allPeqs.find(p => p.hostIssueId == issDatX[0].toString() );
    sub      = [peqX.PEQId, crossPid.toString(), crossCid.toString() ];
    testStatus  = await gh2tu.checkPact( authDataX, testLinks, tdX, issDatX[3], config.PACTVERB_CONF, config.PACTACT_RELO, "", testStatus, {sub: sub} );

    tu.testReport( testStatus, "Test " + testName + " B" );    

    // 3. Transfer each to the other
    const issue  = await gh2tu.findIssue( authData, issDat[0] );
    const repo   = await gh2tu.findRepo( authData, td );
    const issueX = await gh2tu.findIssue( authDataX, issDatX[0] );
    const repoX  = await gh2tu.findRepo( authDataX, tdX );

    
    console.log( "TRANSFER BEGINNING" );
    console.log( "base : ", issue.node_id, repoX.node_id );
    console.log( "baseX: ", issueX.node_id, repo.node_id );
    await gh2tu.transferIssueGQL( authData, issue.node_id, repoX.node_id );
    await gh2tu.transferIssueGQL( authDataX, issueX.node_id, repo.node_id );
    await utils.sleep( 2000 );

    const newGHIssue = await gh2tu.findIssueByName( authData, td, issDatX[3] );
    const newXIssue  = await gh2tu.findIssueByName( authDataX, tdX, issDat[3] );
    
    testStatus = await gh2tu.checkNewbornIssue( authDataX, testLinks, td, [newGHIssue.id, newGHIssue.number, -1, issDatX[3]], testStatus, {lblCount: 1} );    
    testStatus = await gh2tu.checkNewbornIssue( authData, testLinks, tdX, [newXIssue.id, newXIssue.number, -1, issDat[3]], testStatus, {lblCount: 1} );    

    let testRepo = flutterTest ? config.FLUTTER_TEST_REPO : config.TEST_REPO;
	
    // Careful.. peq is gone at this point.   Delete may come after relocate, hence depth
    sub         = [peqX.PEQId, config.TEST_ACTOR + "/" + testRepo];
    testStatus  = await gh2tu.checkPact( authDataX, testLinks, tdX, -1, config.PACTVERB_CONF, config.PACTACT_RELO, "Transfer out", testStatus, {sub: sub, depth: 2} );
    sub         = [peq.PEQId, config.TEST_ACTOR + "/" + config.CROSS_TEST_REPO];
    testStatus  = await gh2tu.checkPact( authData, testLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_RELO, "Transfer out", testStatus, {sub: sub, depth: 2} );

    
    tu.testReport( testStatus, "Test " + testName );
    return testStatus;
}


// Simulate a simple multithread test here, by randomly ordering a set of blast issues
// for two different users/repos, and fire them all off nearly-simultaneously.  With the rest delay to and from GH,
// resulting notifications will interleave and stack up 
async function testMultithread( authData, authDataM, testLinks, td, tdM ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];
    let testName = "Multithread";

    console.log( "Test", testName );
    authData.who = "<TEST: " + testName + ">";

    await gh2tu.refreshRec( authData, td );

    // Setup for blasting from two different testers / repos. 
    assert( config.MULTI_TEST_ACTOR != config.TEST_ACTOR );
    assert( td.GHFullName != tdM.GHFullName );

    // Add populate label to testProject2, to invoke repostatus. 
    let multiPid = await gh2tu.createProjectWorkaround( authDataM, tdM, "Multi Proj", "For testing request interleaving" );
    let multiCid = await gh2tu.makeColumn( authDataM, testLinks, tdM.CEProjectId, tdM.GHFullName, multiPid, "Multi Col" );
    let issPopDat = await gh2tu.makeIssue( authDataM, tdM, "A special populate issue", [] );
    let cardPop   = await gh2tu.makeProjectCard( authDataM, testLinks, tdM.ceProjectId, multiPid, multiCid, issPopDat[0] );
    let popLabel  = await gh2tu.findOrCreateLabel( authDataM, tdM.GHRepoId, false, config.POPULATE, -1 );
    let ipDat     = [issPopDat[0], issPopDat[1], cardPop.cardId, "A special populate issue" ];
    await gh2tu.addLabel( authDataM, popLabel.id, ipDat );       
    await utils.sleep( 1000 );

    // Labels, Assignees & Locs
    const LAB    = "903 " + config.PEQ_LABEL;
    const LABNP1 = "bug";
    const LABNP2 = "documentation";
    let lab     = await gh2tu.findOrCreateLabel( authData,  td.GHRepoId, false, LAB, 903 );
    let labNP1  = await gh2tu.findOrCreateLabel( authData,  td.GHRepoId, false, LABNP1, -1 );
    let labNP2  = await gh2tu.findOrCreateLabel( authData,  td.GHRepoId, false, LABNP2, -1 );
    let labM    = await gh2tu.findOrCreateLabel( authDataM, tdM.GHRepoId, false, LAB, 903 );
    let labNP1M = await gh2tu.findOrCreateLabel( authDataM, tdM.GHRepoId, false, LABNP1, -1 );
    let labNP2M = await gh2tu.findOrCreateLabel( authDataM, tdM.GHRepoId, false, LABNP2, -1 );

    const ASSIGNEE1 = "ariCETester";
    const ASSIGNEE2 = "builderCE";
    const ASSIGNEE3 = "connieCE";
        
    // There are 5 blast issues of each repo, randomized, sent with a small random gap between 200-500ms.

    let issDatPromises = [0,1,2,3,4,5,6,7,8,9];
    let callIndex = [0,1,2,3,4,5,6,7,8,9];
    callIndex = tu.shuffle( callIndex );

    // Build promises with delays built in to keep GH from going crazy.  Then do some work before trying to collect.
    for( const index of callIndex ) {
	console.log( "Fire", index );
	let dat = [];
	switch( index ) {
	case 0: dat = gh2tu.blastIssue( authData,  td,  "Interleave 0",  [LAB],                 [ASSIGNEE1], {wait: false});                       break;
	case 1: dat = gh2tu.blastIssue( authData,  td,  "Interleave 1",  [LAB, LABNP2],         [ASSIGNEE1, ASSIGNEE2], {wait: false});            break;
	case 2: dat = gh2tu.blastIssue( authData,  td,  "Interleave 2",  [LAB, LABNP1],         [ASSIGNEE3, ASSIGNEE2], {wait: false});            break;
	case 3: dat = gh2tu.blastIssue( authData,  td,  "Interleave 3",  [LAB, LABNP1, LABNP2], [ASSIGNEE1, ASSIGNEE2, ASSIGNEE3], {wait: false}); break;
	case 4: dat = gh2tu.blastIssue( authData,  td,  "Interleave 4",  [LABNP1],              [ASSIGNEE1, ASSIGNEE3], {wait: false});            break;
	case 5: dat = gh2tu.blastIssue( authDataM, tdM, "InterleaveM 0", [LABNP2],              [ASSIGNEE1], {wait: false});                       break;
	case 6: dat = gh2tu.blastIssue( authDataM, tdM, "InterleaveM 1", [LAB],                 [ASSIGNEE3, ASSIGNEE2], {wait: false});            break;
	case 7: dat = gh2tu.blastIssue( authDataM, tdM, "InterleaveM 2", [LAB, LABNP1],         [ASSIGNEE3, ASSIGNEE1, ASSIGNEE2], {wait: false}); break;
	case 8: dat = gh2tu.blastIssue( authDataM, tdM, "InterleaveM 3", [LAB, LABNP1, LABNP2], [ASSIGNEE1, ASSIGNEE2], {wait: false});            break;
	case 9: dat = gh2tu.blastIssue( authDataM, tdM, "InterleaveM 4", [LAB, LABNP2],         [ASSIGNEE2, ASSIGNEE1], {wait: false});            break;
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
    await gh2tu.refreshUnclaimed( authData, td );
    const projects = await gh2tu.getProjects( authDataM, tdM );
    const uncProj  = projects.find( proj => proj.name == config.UNCLAIMED );

    const uncLoc  = await gh2tu.getFlatLoc( authData, td.unclaimPID, config.UNCLAIMED, config.UNCLAIMED );
    const uncLocM = await gh2tu.getFlatLoc( authDataM, uncProj.id, config.UNCLAIMED, config.UNCLAIMED );

    // Let CE completely finish before testing... mainly finishing cards.
    await utils.sleep( 3000 );  
    let allCards  = await gh2tu.getCards( authData,  uncLoc.colId );
    let allCardsM = await gh2tu.getCards( authDataM, uncLocM.colId );

    let c, cM = {};
    for( const i of callIndex ) {

	if( i <= 4 ) { c  = allCards.find( card => card.content_url.split('/').pop() == issDat[i][1].toString() ); }
	else         { cM = allCardsM.find( card => card.content_url.split('/').pop() == issDat[i][1].toString() ); }
	
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

    tu.testReport( testStatus, "Test", testName );
    return testStatus;
}




async function runTests( flutterTest, authData, authDataX, authDataM, testLinks, td, tdX, tdM ) {


    console.log( "Cross tests =================" );

    let testStatus = [ 0, 0, []];

    let t1 = await testCrossRepo( flutterTest, authData, authDataX, testLinks, td, tdX );
    console.log( "\n\nCross Repo test complete." );
    await utils.sleep( 5000 );

    let t2 = await testMultithread( authData, authDataM, testLinks, td, tdM );
    console.log( "\n\nMultithread test complete." );
    await utils.sleep( 5000 );

    testStatus = tu.mergeTests( testStatus, t1 );
    testStatus = tu.mergeTests( testStatus, t2 );

    return testStatus
}


exports.runTests = runTests;
