const assert = require( 'assert' );
const config = require( '../../../config' );

const utils    = require( '../../../utils/ceUtils' );
const awsUtils = require( '../../../utils/awsUtils' );

const tu       = require( '../../ceTestUtils ');

const ghClassic = require( '../../../utils/gh/ghc/ghClassicUtils' );
const gh        = ghClassic.githubUtils;
const ghSafe    = ghClassic.githubSafe;

const testData = require( './testData' );
const ghctu    = require( './ghcTestUtils' );


async function cardPresentHelp( authData, colId, issNum ) {
    let retVal = false;

    let allCards  = await ghctu.getCards( authData, colId );
    
    let c = allCards.find( card => card.content_url.split('/').pop() == issNum ); 
    if( typeof c !== 'undefined' ) { console.log( "CROSS XXX RV: " ); retVal = true; }

    return retVal;
}


// Requires config.TEST_OWNER to have installed the codeEquity app for all repos, not just one.
// Requires config.CROSS_TEST_REPO & config.TEST_REPO & config.FLUTTER_TEST_REPO to allow both config.CE_USER and config.TEST_OWNER to have R/W access
// This way, authData is shared.   td is NOT shared.
async function testCrossRepo( flutterTest, authData, authDataX, ghLinks, td, tdX ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];
    let testName = "CrossRepo";

    console.log( "Test", testName );
    authData.who = "<TEST: " + testName + ">";

    await ghctu.refreshRec( authData, td );

    assert( config.CROSS_TEST_OWNER == config.TEST_OWNER );
    assert( config.CROSS_TEST_REPO  != config.TEST_REPO );
    assert( config.CROSS_TEST_REPO  != config.FLUTTER_TEST_REPO );

    // Setup.
    // Add populate label to testProject2, to invoke repostatus
    let crossPid = await ghctu.makeProject( authDataX, tdX, "Cross Proj", "For testing transfers to other repos" );
    let crossCid = await ghctu.makeColumn( authDataX, ghLinks, tdX.CEProjectId, tdX.GHFullName, crossPid, "Cross Col" );
    
    let issPopDat = await ghSafe.createIssue( authDataX, tdX.GHOwner, tdX.GHRepo, "A special populate issue", [], false );
    let cardPop   = await ghSafe.createProjectCard( authDataX, crossCid, issPopDat[0] );
    let popLabel  = await gh.findOrCreateLabel( authDataX, tdX.GHOwner, tdX.GHRepo, false, config.POPULATE, -1 );
    let ipDat     = [issPopDat[0], issPopDat[1], "A special populate issue" ];
    await ghctu.addLabel( authDataX, tdX, ipDat, popLabel.name );       
    await utils.sleep( 1000 );

    const LAB = "704 " + config.PEQ_LABEL;
    let lab   = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, LAB, 704 );
    let labX  = await gh.findOrCreateLabel( authDataX, tdX.GHOwner, tdX.GHRepo, false, LAB, 704 );

    const ASSIGNEE1 = "ariCETester";
    const ASSIGNEE2 = "codeequity";
        
    const stripeLoc = await ghctu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, "Stripes" );
    const crossLoc  = await ghctu.getFlatLoc( authDataX, crossPid, "Cross Proj", "Cross Col" );


    // 1. Create in test Project
    let issDat = await ghctu.blastIssue( authData, td, "CT Blast", [LAB], [ASSIGNEE1, ASSIGNEE2] );               
    await utils.sleep( 2000 );

    const card  = await ghctu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, stripeLoc.colId, issDat[0] );
    await utils.sleep( 1000 );
    
    testStatus = await ghctu.checkSituatedIssue( authData, ghLinks, td, stripeLoc, issDat, card, testStatus, {label: 704, lblCount: 1, assign: 2});
    
    let allPeqs = await awsUtils.getPeqs( authData, { "CEProjectId": td.CEProjectId });
    let peq     = allPeqs.find(p => p.GHIssueId == issDat[0].toString() );
    let sub     = [peq.PEQId, td.githubOpsPID.toString(), stripeLoc.colId.toString() ];
    testStatus  = await ghctu.checkPact( authData, ghLinks, td, issDat[2], config.PACTVERB_CONF, config.PACTACT_RELO, "", testStatus, {sub: sub} );
    
    tu.testReport( testStatus, "Test " + testName + " A" );    
    

    // 2. Create in cross project
    let issDatX = await ghctu.blastIssue( authDataX, tdX, "CT Blast X", [LAB], [ASSIGNEE1, ASSIGNEE2] );               
    await utils.sleep( 2000 );

    const cardX  = await ghctu.makeProjectCard( authDataX, ghLinks, tdX.CEProjectId, tdX.GHFullName, crossLoc.colId, issDatX[0] );
    await tu.settleWithVal( "Cross test make cross card", cardPresentHelp, authData, crossLoc.colId, issDatX[1] );
    
    testStatus = await ghctu.checkSituatedIssue( authDataX, ghLinks, tdX, crossLoc, issDatX, cardX, testStatus, {label: 704, lblCount: 1, assign: 2});
    
    allPeqs  = await awsUtils.getPeqs( authDataX, { "CEProjectId": tdX.CEProjectId });
    let peqX = allPeqs.find(p => p.GHIssueId == issDatX[0].toString() );
    sub      = [peqX.PEQId, crossPid.toString(), crossCid.toString() ];
    testStatus  = await ghctu.checkPact( authDataX, ghLinks, tdX, issDatX[2], config.PACTVERB_CONF, config.PACTACT_RELO, "", testStatus, {sub: sub} );

    tu.testReport( testStatus, "Test " + testName + " B" );    

    // 3. Transfer each to the other
    const issue  = await ghctu.findIssue( authData, td, issDat[0] );
    const repo   = await ghctu.findRepo( authData, td );
    const issueX = await ghctu.findIssue( authDataX, tdX, issDatX[0] );
    const repoX  = await ghctu.findRepo( authDataX, tdX );

    
    console.log( "TRANSFER BEGINNING" );
    console.log( "base : ", issue.node_id, repoX.node_id );
    console.log( "baseX: ", issueX.node_id, repo.node_id );
    await gh.transferIssueGQL( authData, issue.node_id, repoX.node_id );
    await gh.transferIssueGQL( authDataX, issueX.node_id, repo.node_id );
    await utils.sleep( 2000 );

    const newGHIssue = await ghctu.findIssueByName( authData, td, issDatX[2] );
    const newXIssue  = await ghctu.findIssueByName( authDataX, tdX, issDat[2] );
    
    testStatus = await ghctu.checkNewbornIssue( authDataX, ghLinks, td, [newGHIssue.id, newGHIssue.number, issDatX[2]], testStatus, {lblCount: 1} );    
    testStatus = await ghctu.checkNewbornIssue( authData, ghLinks, tdX, [newXIssue.id, newXIssue.number, issDat[2]], testStatus, {lblCount: 1} );    

    let testRepo = flutterTest ? config.FLUTTER_TEST_REPO : config.TEST_REPO;
	
    // Careful.. peq is gone at this point.   Delete may come after relocate, hence depth
    sub         = [peqX.PEQId, config.TEST_OWNER + "/" + testRepo];
    testStatus  = await ghctu.checkPact( authDataX, ghLinks, tdX, -1, config.PACTVERB_CONF, config.PACTACT_RELO, "Transfer out", testStatus, {sub: sub, depth: 2} );
    sub         = [peq.PEQId, config.TEST_OWNER + "/" + config.CROSS_TEST_REPO];
    testStatus  = await ghctu.checkPact( authData, ghLinks, td, -1, config.PACTVERB_CONF, config.PACTACT_RELO, "Transfer out", testStatus, {sub: sub, depth: 2} );

    
    tu.testReport( testStatus, "Test " + testName );
    return testStatus;
}


// Simulate a simple multithread test here, by randomly ordering a set of blast issues
// for two different users/repos, and fire them all off nearly-simultaneously.  With the rest delay to and from GH,
// resulting notifications will interleave and stack up 
async function testMultithread( authData, authDataM, ghLinks, td, tdM ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];
    let testName = "Multithread";

    console.log( "Test", testName );
    authData.who = "<TEST: " + testName + ">";

    await ghctu.refreshRec( authData, td );

    // Setup for blasting from two different testers / repos. 
    assert( config.MULTI_TEST_OWNER != config.TEST_OWNER );
    assert( td.GHFullName != tdM.GHFullName );

    // Add populate label to testProject2, to invoke repostatus. 
    let multiPid = await ghctu.makeProject( authDataM, tdM, "Multi Proj", "For testing request interleaving" );
    let multiCid = await ghctu.makeColumn( authDataM, ghLinks, tdM.CEProjectId, tdM.GHFullName, multiPid, "Multi Col" );
    let issPopDat = await ghSafe.createIssue( authDataM, tdM.GHOwner, tdM.GHRepo, "A special populate issue", [], false );
    let cardPop   = await ghSafe.createProjectCard( authDataM, multiCid, issPopDat[0] );
    let popLabel  = await gh.findOrCreateLabel( authDataM, tdM.GHOwner, tdM.GHRepo, false, config.POPULATE, -1 );
    let ipDat     = [issPopDat[0], issPopDat[1], "A special populate issue" ];
    await ghctu.addLabel( authDataM, tdM, ipDat, popLabel.name );       
    await utils.sleep( 1000 );

    // Labels, Assignees & Locs
    const LAB    = "903 " + config.PEQ_LABEL;
    const LABNP1 = "bug";
    const LABNP2 = "documentation";
    let lab     = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, LAB, 903 );
    let labNP1  = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, LABNP1, -1 );
    let labNP2  = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, LABNP2, -1 );
    let labM    = await gh.findOrCreateLabel( authDataM, tdM.GHOwner, tdM.GHRepo, false, LAB, 903 );
    let labNP1M = await gh.findOrCreateLabel( authDataM, tdM.GHOwner, tdM.GHRepo, false, LABNP1, -1 );
    let labNP2M = await gh.findOrCreateLabel( authDataM, tdM.GHOwner, tdM.GHRepo, false, LABNP2, -1 );

    const ASSIGNEE1 = "ariCETester";
    const ASSIGNEE2 = "codeequity";
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
	case 0: dat = ghctu.blastIssue( authData,  td,  "Interleave 0",  [LAB],                 [ASSIGNEE1], {wait: false});                       break;
	case 1: dat = ghctu.blastIssue( authData,  td,  "Interleave 1",  [LAB, LABNP2],         [ASSIGNEE1, ASSIGNEE2], {wait: false});            break;
	case 2: dat = ghctu.blastIssue( authData,  td,  "Interleave 2",  [LAB, LABNP1],         [ASSIGNEE3, ASSIGNEE2], {wait: false});            break;
	case 3: dat = ghctu.blastIssue( authData,  td,  "Interleave 3",  [LAB, LABNP1, LABNP2], [ASSIGNEE1, ASSIGNEE2, ASSIGNEE3], {wait: false}); break;
	case 4: dat = ghctu.blastIssue( authData,  td,  "Interleave 4",  [LABNP1],              [ASSIGNEE1, ASSIGNEE3], {wait: false});            break;
	case 5: dat = ghctu.blastIssue( authDataM, tdM, "InterleaveM 0", [LABNP2],              [ASSIGNEE1], {wait: false});                       break;
	case 6: dat = ghctu.blastIssue( authDataM, tdM, "InterleaveM 1", [LAB],                 [ASSIGNEE3, ASSIGNEE2], {wait: false});            break;
	case 7: dat = ghctu.blastIssue( authDataM, tdM, "InterleaveM 2", [LAB, LABNP1],         [ASSIGNEE3, ASSIGNEE1, ASSIGNEE2], {wait: false}); break;
	case 8: dat = ghctu.blastIssue( authDataM, tdM, "InterleaveM 3", [LAB, LABNP1, LABNP2], [ASSIGNEE1, ASSIGNEE2], {wait: false});            break;
	case 9: dat = ghctu.blastIssue( authDataM, tdM, "InterleaveM 4", [LAB, LABNP2],         [ASSIGNEE2, ASSIGNEE1], {wait: false});            break;
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
    await ghctu.refreshUnclaimed( authData, td );
    const projects = await ghctu.getProjects( authDataM, tdM );
    const uncProj  = projects.find( proj => proj.name == config.UNCLAIMED );

    const uncLoc  = await ghctu.getFlatLoc( authData, td.unclaimPID, config.UNCLAIMED, config.UNCLAIMED );
    const uncLocM = await ghctu.getFlatLoc( authDataM, uncProj.id, config.UNCLAIMED, config.UNCLAIMED );

    // Let CE completely finish before testing... mainly finishing cards.
    await utils.sleep( 3000 );  
    let allCards  = await ghctu.getCards( authData,  uncLoc.colId );
    let allCardsM = await ghctu.getCards( authDataM, uncLocM.colId );

    let c, cM = {};
    for( const i of callIndex ) {

	if( i <= 4 ) { c  = allCards.find( card => card.content_url.split('/').pop() == issDat[i][1].toString() ); }
	else         { cM = allCardsM.find( card => card.content_url.split('/').pop() == issDat[i][1].toString() ); }
	
	console.log( "Check", i );
	switch( i ) {
	case 0: testStatus = await ghctu.checkSituatedIssue( authData, ghLinks, td, uncLoc, issDat[i], c, testStatus, {label: 903, lblCount: 1, assign: 1});  break;
	case 1: testStatus = await ghctu.checkSituatedIssue( authData, ghLinks, td, uncLoc, issDat[i], c, testStatus, {label: 903, lblCount: 2, assign: 2});  break;
	case 2: testStatus = await ghctu.checkSituatedIssue( authData, ghLinks, td, uncLoc, issDat[i], c, testStatus, {label: 903, lblCount: 2, assign: 2});  break;
	case 3: testStatus = await ghctu.checkSituatedIssue( authData, ghLinks, td, uncLoc, issDat[i], c, testStatus, {label: 903, lblCount: 3, assign: 3});  break;
	case 4: testStatus = await ghctu.checkNewbornIssue( authData, ghLinks, td, issDat[i], testStatus, {lblCount: 1});  break;
	case 5: testStatus = await ghctu.checkNewbornIssue( authDataM, ghLinks, tdM, issDat[i], testStatus, {lblCount: 1});  break;
	case 6: testStatus = await ghctu.checkSituatedIssue( authDataM, ghLinks, tdM, uncLocM, issDat[i], cM, testStatus, {label: 903, lblCount: 1, assign: 2});  break;
	case 7: testStatus = await ghctu.checkSituatedIssue( authDataM, ghLinks, tdM, uncLocM, issDat[i], cM, testStatus, {label: 903, lblCount: 2, assign: 3});  break;
	case 8: testStatus = await ghctu.checkSituatedIssue( authDataM, ghLinks, tdM, uncLocM, issDat[i], cM, testStatus, {label: 903, lblCount: 3, assign: 2});  break;
	case 9: testStatus = await ghctu.checkSituatedIssue( authDataM, ghLinks, tdM, uncLocM, issDat[i], cM, testStatus, {label: 903, lblCount: 2, assign: 2});  break;
	default:  assert( false );  break;
	}

    }

    tu.testReport( testStatus, "Test", testName );
    return testStatus;
}




async function runTests( flutterTest, authData, authDataX, authDataM, ghLinks, td, tdX, tdM ) {


    console.log( "Cross tests =================" );

    let testStatus = [ 0, 0, []];

    let t1 = await testCrossRepo( flutterTest, authData, authDataX, ghLinks, td, tdX );
    console.log( "\n\nCross Repo test complete." );
    await utils.sleep( 5000 );

    let t2 = await testMultithread( authData, authDataM, ghLinks, td, tdM );
    console.log( "\n\nMultithread test complete." );
    await utils.sleep( 5000 );

    testStatus = tu.mergeTests( testStatus, t1 );
    testStatus = tu.mergeTests( testStatus, t2 );

    return testStatus
}


exports.runTests = runTests;
