var assert = require('assert');
const auth = require( '../auth' );

var utils   = require('../utils');
var config  = require('../config');

var ghUtils = require('../ghUtils');
var gh      = ghUtils.githubUtils;
var ghSafe  = ghUtils.githubSafe;

const testData = require( './testData' );
const tu = require('./testUtils');

// Requires config.TEST_OWNER to have installed the codeEquity app for all repos, not just one.
// Requires config.CROSS_TEST_REPO & config.TEST_REPO to allow both config.CE_USER and config.TEST_OWNER to have R/W access
// This way, authData is shared.   td is NOT shared.
async function testCrossRepo( authData, authDataX, ghLinks, td, tdX ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];
    let testName = "CrossRepo";

    console.log( "Test", testName );
    authData.who = "<TEST: " + testName + ">";

    await tu.refreshRec( authData, td );

    assert( config.CROSS_TEST_OWNER == config.TEST_OWNER );
    assert( config.CROSS_TEST_REPO  != config.TEST_REPO );

    // Setup.
    // Add populate label to testProject2, to invoke repostatus
    let crossPid = await tu.makeProject( authDataX, tdX, "Cross Proj", "For testing transfers to other repos" );
    let crossCid = await tu.makeColumn( authDataX, crossPid, "Cross Col" );
    
    let issPopDat = await ghSafe.createIssue( authDataX, tdX.GHOwner, tdX.GHRepo, "A special populate issue", [], false );
    let cardPop   = await ghSafe.createProjectCard( authDataX, crossCid, issPopDat[0] );
    let popLabel  = await gh.findOrCreateLabel( authDataX, tdX.GHOwner, tdX.GHRepo, false, config.POPULATE, -1 );
    await tu.addLabel( authDataX, tdX, issPopDat[1], popLabel.name );       
    await utils.sleep( 1000 );

    const LAB = "704 PEQ";
    let lab   = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, LAB, 704 );
    let labX  = await gh.findOrCreateLabel( authDataX, tdX.GHOwner, tdX.GHRepo, false, LAB, 704 );

    const ASSIGNEE1 = "rmusick2000";
    const ASSIGNEE2 = "codeequity";
        
    const stripeLoc = await tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, "Stripes" );
    const crossLoc  = await tu.getFlatLoc( authDataX, crossPid, "Cross Proj", "Cross Col" );


    // 1. Create in test Project
    let issDat = await tu.blastIssue( authData, td, "CT Blast", [LAB], [ASSIGNEE1, ASSIGNEE2] );               
    await utils.sleep( 2000 );

    const card  = await tu.makeProjectCard( authData, stripeLoc.colId, issDat[0] );
    await utils.sleep( 1000 );
    
    testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, stripeLoc, issDat, card, testStatus, {label: 704, lblCount: 1});
    
    let allPeqs = await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let peq     = allPeqs.find(p => p.GHIssueId == issDat[0].toString() );
    let sub     = [peq.PEQId, td.githubOpsPID.toString(), stripeLoc.colId.toString() ];
    testStatus  = await tu.checkPact( authData, ghLinks, td, issDat[2], "confirm", "relocate", "", testStatus, {sub: sub} );
    
    tu.testReport( testStatus, "Test " + testName + " A" );    
    

    // 2. Create in cross project
    let issDatX = await tu.blastIssue( authDataX, tdX, "CT Blast X", [LAB], [ASSIGNEE1, ASSIGNEE2] );               
    await utils.sleep( 2000 );

    const cardX  = await tu.makeProjectCard( authDataX, crossLoc.colId, issDatX[0] );
    await utils.sleep( 1000 );
    
    testStatus = await tu.checkSituatedIssue( authDataX, ghLinks, tdX, crossLoc, issDatX, cardX, testStatus, {label: 704, lblCount: 1});
    
    allPeqs  = await utils.getPeqs( authDataX, { "GHRepo": tdX.GHFullName });
    let peqX = allPeqs.find(p => p.GHIssueId == issDatX[0].toString() );
    sub      = [peqX.PEQId, crossPid.toString(), crossCid.toString() ];
    testStatus  = await tu.checkPact( authDataX, ghLinks, tdX, issDatX[2], "confirm", "relocate", "", testStatus, {sub: sub} );

    tu.testReport( testStatus, "Test " + testName + " B" );    

    // 3. Transfer each to the other
    const issue  = await tu.findIssue( authData, td, issDat[0] );
    const repo   = await tu.findRepo( authData, td );
    const issueX = await tu.findIssue( authDataX, tdX, issDatX[0] );
    const repoX  = await tu.findRepo( authDataX, tdX );
    
    await gh.transferIssueGQL( authData, issue.node_id, repoX.node_id );
    await gh.transferIssueGQL( authDataX, issueX.node_id, repo.node_id );
    await utils.sleep( 2000 );

    const newGHIssue = await tu.findIssueByName( authData, td, issDatX[2] );
    const newXIssue  = await tu.findIssueByName( authDataX, tdX, issDat[2] );
    
    testStatus = await tu.checkNewbornIssue( authDataX, ghLinks, td, [newGHIssue.id, newGHIssue.number, issDatX[2]], testStatus );    
    testStatus = await tu.checkNewbornIssue( authData, ghLinks, tdX, [newXIssue.id, newXIssue.number, issDat[2]], testStatus );    

    // Careful.. peq is gone at this point.   Delete may come after relocate, hence depth
    sub         = [peqX.PEQId, config.TEST_OWNER + "/" + config.TEST_REPO];
    testStatus  = await tu.checkPact( authDataX, ghLinks, tdX, -1, "confirm", "relocate", "Transfer out", testStatus, {sub: sub, depth: 2} );
    sub         = [peq.PEQId, config.TEST_OWNER + "/" + config.CROSS_TEST_REPO];
    testStatus  = await tu.checkPact( authData, ghLinks, td, -1, "confirm", "relocate", "Transfer out", testStatus, {sub: sub, depth: 2} );

    
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

    await tu.refreshRec( authData, td );

    // Setup for blasting from two different testers / repos. 
    assert( config.MULTI_TEST_OWNER != config.TEST_OWNER );
    assert( td.GHFullName != tdM.GHFullName );

    // Add populate label to testProject2, to invoke repostatus. 
    let multiPid = await tu.makeProject( authDataM, tdM, "Multi Proj", "For testing request interleaving" );
    let multiCid = await tu.makeColumn( authDataM, multiPid, "Multi Col" );
    let issPopDat = await ghSafe.createIssue( authDataM, tdM.GHOwner, tdM.GHRepo, "A special populate issue", [], false );
    let cardPop   = await ghSafe.createProjectCard( authDataM, multiCid, issPopDat[0] );
    let popLabel  = await gh.findOrCreateLabel( authDataM, tdM.GHOwner, tdM.GHRepo, false, config.POPULATE, -1 );
    await tu.addLabel( authDataM, tdM, issPopDat[1], popLabel.name );       
    await utils.sleep( 1000 );

    // Labels, Assignees & Locs
    const LAB    = "903 PEQ";
    const LABNP1 = "bug";
    const LABNP2 = "documentation";
    let lab     = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, LAB, 903 );
    let labNP1  = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, LABNP1, -1 );
    let labNP2  = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, LABNP2, -1 );
    let labM    = await gh.findOrCreateLabel( authDataM, tdM.GHOwner, tdM.GHRepo, false, LAB, 903 );
    let labNP1M = await gh.findOrCreateLabel( authDataM, tdM.GHOwner, tdM.GHRepo, false, LABNP1, -1 );
    let labNP2M = await gh.findOrCreateLabel( authDataM, tdM.GHOwner, tdM.GHRepo, false, LABNP2, -1 );

    const ASSIGNEE1 = "rmusick2000";
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
	case 0: dat = tu.blastIssue( authData,  td,  "Interleave 0",  [LAB],                 [ASSIGNEE1], {wait: false});                       break;
	case 1: dat = tu.blastIssue( authData,  td,  "Interleave 1",  [LAB, LABNP2],         [ASSIGNEE1, ASSIGNEE2], {wait: false});            break;
	case 2: dat = tu.blastIssue( authData,  td,  "Interleave 2",  [LAB, LABNP1],         [ASSIGNEE3, ASSIGNEE2], {wait: false});            break;
	case 3: dat = tu.blastIssue( authData,  td,  "Interleave 3",  [LAB, LABNP1, LABNP2], [ASSIGNEE1, ASSIGNEE2, ASSIGNEE3], {wait: false}); break;
	case 4: dat = tu.blastIssue( authData,  td,  "Interleave 4",  [LABNP1],              [ASSIGNEE1, ASSIGNEE3], {wait: false});            break;
	case 5: dat = tu.blastIssue( authDataM, tdM, "InterleaveM 0", [LABNP2],              [ASSIGNEE1], {wait: false});                       break;
	case 6: dat = tu.blastIssue( authDataM, tdM, "InterleaveM 1", [LAB],                 [ASSIGNEE3, ASSIGNEE2], {wait: false});            break;
	case 7: dat = tu.blastIssue( authDataM, tdM, "InterleaveM 2", [LAB, LABNP1],         [ASSIGNEE3, ASSIGNEE1, ASSIGNEE2], {wait: false}); break;
	case 8: dat = tu.blastIssue( authDataM, tdM, "InterleaveM 3", [LAB, LABNP1, LABNP2], [ASSIGNEE1, ASSIGNEE2], {wait: false});            break;
	case 9: dat = tu.blastIssue( authDataM, tdM, "InterleaveM 4", [LAB, LABNP2],         [ASSIGNEE2, ASSIGNEE1], {wait: false});            break;
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
    await utils.sleep( 7000 );  

    // No moving, all cards appear in unclaimed.  This must be after promises, Unclaimed may not get created for a while.
    await tu.refreshUnclaimed( authData, td );
    const projects = await tu.getProjects( authDataM, tdM );
    const uncProj  = projects.find( proj => proj.name == config.UNCLAIMED );

    const uncLoc  = await tu.getFlatLoc( authData, td.unclaimPID, config.UNCLAIMED, config.UNCLAIMED );
    const uncLocM = await tu.getFlatLoc( authDataM, uncProj.id, config.UNCLAIMED, config.UNCLAIMED );
    let allCards  = await tu.getCards( authData,  uncLoc.colId );
    let allCardsM = await tu.getCards( authDataM, uncLocM.colId );

    // Let CE completely finish before testing
    await utils.sleep( 4000 );  

    let c, cM = {};
    for( const i of callIndex ) {

	if( i <= 4 ) { c  = allCards.find( card => card.content_url.split('/').pop() == issDat[i][1].toString() ); }
	else         { cM = allCardsM.find( card => card.content_url.split('/').pop() == issDat[i][1].toString() ); }
	
	console.log( "Check", i );
	switch( i ) {
	case 0: testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, uncLoc, issDat[i], c, testStatus, {label: 903, lblCount: 1, assign: 1});  break;
	case 1: testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, uncLoc, issDat[i], c, testStatus, {label: 903, lblCount: 2, assign: 2});  break;
	case 2: testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, uncLoc, issDat[i], c, testStatus, {label: 903, lblCount: 2, assign: 2});  break;
	case 3: testStatus = await tu.checkSituatedIssue( authData, ghLinks, td, uncLoc, issDat[i], c, testStatus, {label: 903, lblCount: 3, assign: 3});  break;
	case 4: testStatus = await tu.checkNewbornIssue( authData, ghLinks, td, issDat[i], testStatus, {lblCount: 1});  break;
	case 5: testStatus = await tu.checkNewbornIssue( authDataM, ghLinks, tdM, issDat[i], testStatus, {lblCount: 1});  break;
	case 6: testStatus = await tu.checkSituatedIssue( authDataM, ghLinks, tdM, uncLocM, issDat[i], cM, testStatus, {label: 903, lblCount: 1, assign: 2});  break;
	case 7: testStatus = await tu.checkSituatedIssue( authDataM, ghLinks, tdM, uncLocM, issDat[i], cM, testStatus, {label: 903, lblCount: 2, assign: 3});  break;
	case 8: testStatus = await tu.checkSituatedIssue( authDataM, ghLinks, tdM, uncLocM, issDat[i], cM, testStatus, {label: 903, lblCount: 3, assign: 2});  break;
	case 9: testStatus = await tu.checkSituatedIssue( authDataM, ghLinks, tdM, uncLocM, issDat[i], cM, testStatus, {label: 903, lblCount: 2, assign: 2});  break;
	default:  assert( false );  break;
	}

    }

    tu.testReport( testStatus, "Test", testName );
    return testStatus;
}




async function runTests( authData, authDataX, authDataM, ghLinks, td, tdX, tdM ) {


    console.log( "Cross tests =================" );

    let testStatus = [ 0, 0, []];

    let t1 = await testCrossRepo( authData, authDataX, ghLinks, td, tdX );
    console.log( "\n\nCross Repo test complete." );
    await utils.sleep( 10000 );

    let t2 = await testMultithread( authData, authDataM, ghLinks, td, tdM );
    console.log( "\n\nMultithread test complete." );
    await utils.sleep( 10000 );

    testStatus = tu.mergeTests( testStatus, t1 );
    testStatus = tu.mergeTests( testStatus, t2 );

    return testStatus
}


exports.runTests = runTests;
