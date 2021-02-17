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
async function testMultithread( authData, ghLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];
    let testName = "Multithread";

    console.log( "Test", testName );
    authData.who = "<TEST: " + testName + ">";

    await tu.refreshRec( authData, td );

        
    tu.testReport( testStatus, "Test", testName );
    return testStatus;
}

async function runTests( authData, authDataX, ghLinks, td, tdX ) {


    console.log( "Cross tests =================" );

    let testStatus = [ 0, 0, []];

    let t1 = await testCrossRepo( authData, authDataX, ghLinks, td, tdX );
    console.log( "\n\nCross Repo test complete." );
    await utils.sleep( 10000 );

    let t2 = await testMultithread( authData, ghLinks, td );
    console.log( "\n\nMultithread test complete." );
    await utils.sleep( 10000 );

    testStatus = tu.mergeTests( testStatus, t1 );
    testStatus = tu.mergeTests( testStatus, t2 );

    return testStatus
}


exports.runTests = runTests;
