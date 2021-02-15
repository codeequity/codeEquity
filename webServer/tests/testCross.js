var assert = require('assert');
var utils = require('../utils');
var config  = require('../config');
var ghUtils = require('../ghUtils');
var gh = ghUtils.githubUtils;
const auth = require( '../auth' );

const testData = require( './testData' );
const tu = require('./testUtils');



async function testCrossRepo( authData, ghLinks, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];
    let testName = "CrossRepo";

    console.log( "Test", testName );
    authData.who = "<TEST: " + testName + ">";

    await tu.refreshRec( authData, td );
    await tu.refreshFlat( authData, td );
    await tu.refreshUnclaimed( authData, td );

    // Setup.
    // Add populate label to testProject2, to invoke repostatus
    // Create in testProject1, and in testProject2

    // Transfer each to the other
        
    tu.testReport( testStatus, "Test", testName );
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
    await tu.refreshFlat( authData, td );
    await tu.refreshUnclaimed( authData, td );

        
    tu.testReport( testStatus, "Test", testName );
    return testStatus;
}

async function runTests( authData, ghLinks, td ) {


    console.log( "Cross tests =================" );

    let testStatus = [ 0, 0, []];

    let t1 = await testCrossRepo( authData, ghLinks, td );
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
