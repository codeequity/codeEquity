var assert = require('assert');
const awsAuth = require( '../awsAuth' );
const auth = require( "../auth");
const utils = require( "../utils");
var config  = require('../config');

var links     = require('../components/linkage.js');

const tu             = require('./testUtils');
const testDelete     = require( './testDelete' );
const testSetup      = require( './testSetup' );
const testFlat       = require( './testFlat' );
const testPopulate   = require( './testPopulate' );
const testBasicFlow  = require( './testBasicFlow' );
const testComponents = require( './testComponents' );
const testCross      = require( './testCross' );

const testData = require( './testData' );



/*
function nester( arg1 ) {
    if( arg1 == 0 ) { eh( "zero", "basts", nester, arg1 ); }
    else {            return [arg1]; }
}


function tester( arg1, arg2, arg3, arg4 ) {
    if( arg1 == 0 ) { eh( "zero", "basts", tester, arg1, arg2, arg3, arg4 ); }
    else {            return [arg1, arg2, arg3, arg4]; }
}






async function eh( a, b, func, a1, a2, ...params ) {
    console.log( "Retry", a, b );
    let x = await func( 1, a2, ...params );
    console.log( "Eh sez:", x );
    return x;
}

async function buster( arg1 ) {
    await utils.sleep( 2000 );
    assert( arg1 != 0 );
}


async function cester( arg1 ) {
    let success = false;
    let retVal = false;
    
    await buster( arg1 )
	.then( rs => {
	    console.log( "igor" );
	    retVal = [2];
	    success = true;
	})
	.catch( e => retVal = eh( "zero", "egg", cester, arg1 ));

    if( success ) {
	console.log( "go", arg1 );
    }
    return retVal;
}
*/


async function runTests() {
    // tester( 0, 1, 2, 3 );
    // nester( 0 );
    /*
    console.log( "\nStart" );
    let x = await cester( 0 );
    console.log( "AAAYAYAA", x );
    console.log( "\nStart" );
    x = await cester( 1 );
    console.log( "BBAYAYAA", x );

    return;
    */
    
    // GH Linkage table
    // Note: this table is a router object - need to rest-get from ceServer.  It ages quickly - best practice is to update just before use.
    let ghLinks = new links.Linkage();

    // TEST_REPO auth
    let td = new testData.TestData();
    td.GHOwner      = config.TEST_OWNER;
    td.GHRepo       = config.TEST_REPO;
    td.GHFullName   = td.GHOwner + "/" + td.GHRepo;

    let authData = {};
    authData.who = "<TEST: Main> ";
    authData.ic  = await auth.getInstallationClient( td.GHOwner, td.GHRepo, td.GHOwner );
    authData.api = utils.getAPIPath() + "/find";
    authData.cog = await awsAuth.getCogIDToken();
    authData.pat = await auth.getPAT( td.GHOwner );

    // CROSS_TEST_REPO auth
    let tdX = new testData.TestData();
    tdX.GHOwner    = config.CROSS_TEST_OWNER;
    tdX.GHRepo     = config.CROSS_TEST_REPO;
    tdX.GHFullName = tdX.GHOwner + "/" + tdX.GHRepo;
    
    let authDataX = {};
    authDataX.ic  = await auth.getInstallationClient( tdX.GHOwner, tdX.GHRepo, tdX.GHOwner );
    authDataX.who = authData.who;
    authDataX.api = authData.api;
    authDataX.cog = authData.cog;
    authDataX.pat = await auth.getPAT( tdX.GHOwner );

    // MULTI_TEST_REPO auth
    let tdM = new testData.TestData();
    tdM.GHOwner    = config.MULTI_TEST_OWNER;
    tdM.GHRepo     = config.MULTI_TEST_REPO;
    tdM.GHFullName = tdM.GHOwner + "/" + tdM.GHRepo;
    
    let authDataM = {};
    authDataM.ic  = await auth.getInstallationClient( tdM.GHOwner, tdM.GHRepo, tdM.GHOwner );
    authDataM.who = authData.who;
    authDataM.api = authData.api;
    authDataM.cog = authData.cog;
    authDataM.pat = await auth.getPAT( tdM.GHOwner );


    
    // GH, AWS and smee  can suffer long cold start times (up to 10s tot).
    // If this is first PAct for the day, start it up
    const wakeyPID = await tu.makeProject( authData, td, "ceServer wakey XYZZYXXK837598", "" );
    const pacts    = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    if( pacts!= -1 ) { pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) ); }
    const mrp = pacts != -1 ? pacts[ pacts.length - 1] : {"EntryDate": "01/01/1970"};
    if( utils.getToday() != mrp.EntryDate ) {
	console.log( "Cold start?  Most recent pact", mrp.EntryDate );
	await utils.sleep( 8000 );
    }
    tu.remProject( authData, wakeyPID );


    // TESTS

    let testStatus = [ 0, 0, []];
    let subTest = "";
    
    await testDelete.runTests( authData, authDataX, authDataM, ghLinks, td, tdX, tdM );

    subTest = await testSetup.runTests( authData, ghLinks, td );
    console.log( "\n\nSetup test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await testFlat.runTests( authData, ghLinks, td );
    console.log( "\n\nFlat test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await testBasicFlow.runTests( authData, ghLinks, td );
    console.log( "\n\nFlow test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await testPopulate.runTests( authData, ghLinks, td );
    console.log( "\n\nResolve test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await testComponents.runTests( authData, ghLinks, td );
    console.log( "\n\nComponents test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await testCross.runTests( authData, authDataX, authDataM, ghLinks, td, tdX, tdM );
    console.log( "\n\nCross Repo test complete." );
    //await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    tu.testReport( testStatus, "================= Testing complete =================" );

}


runTests();
