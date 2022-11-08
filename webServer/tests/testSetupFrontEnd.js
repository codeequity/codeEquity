var assert    = require( "assert" );
const awsAuth = require( "../auth/aws/awsAuth" );
const ghAuth  = require( "../auth/gh/ghAuth" );
var config    = require( "../config" );
const utils   = require( '../utils/ceUtils' );

var links     = require('../components/linkage.js');

const tu             = require('./testUtils');
const testSaveDynamo = require( './testSaveDynamo' );
const testDelete     = require( './testDelete' );

const testData  = require( './testData' );
const authDataC = require( '../auth/authData' );

// Separate ceServer testing from ceFlutter testing.
// Delete all from FLUTTER_TEST_REPO
// initialize, then populate from .... darg

async function runTests() {

    // GH Linkage table
    // Note: this table is a router object - need to rest-get from ceServer.  It ages quickly - best practice is to update just before use.
    let ghLinks = new links.Linkage();

    // TEST_REPO auth
    let td          = new testData.TestData();
    td.GHOwner      = config.TEST_OWNER;
    td.GHRepo       = config.TEST_REPO;
    td.GHFullName   = td.GHOwner + "/" + td.GHRepo;

    let authData     = new authDataC.AuthData();
    authData.who     = "<TEST: Main> ";
    authData.ic      = await ghAuth.getInstallationClient( td.GHOwner, td.GHRepo, td.GHOwner );
    authData.api     = utils.getAPIPath() + "/find";
    authData.cog     = await awsAuth.getCogIDToken();
    authData.cogLast = Date.now();                
    authData.pat     = await ghAuth.getPAT( td.GHOwner );

    // CROSS_TEST_REPO auth
    let tdX        = new testData.TestData();
    tdX.GHOwner    = config.CROSS_TEST_OWNER;
    tdX.GHRepo     = config.CROSS_TEST_REPO;
    tdX.GHFullName = tdX.GHOwner + "/" + tdX.GHRepo;
    
    let authDataX     = new authDataC.AuthData();
    authDataX.ic      = await ghAuth.getInstallationClient( tdX.GHOwner, tdX.GHRepo, tdX.GHOwner );
    authDataX.who     = authData.who;
    authDataX.api     = authData.api;
    authDataX.cog     = authData.cog;
    authDataX.cogLast = Date.now();                
    authDataX.pat     = await ghAuth.getPAT( tdX.GHOwner );

    // MULTI_TEST_REPO auth
    let tdM        = new testData.TestData();
    tdM.GHOwner    = config.MULTI_TEST_OWNER;
    tdM.GHRepo     = config.MULTI_TEST_REPO;
    tdM.GHFullName = tdM.GHOwner + "/" + tdM.GHRepo;
    
    let authDataM     = new authDataC.AuthData();
    authDataM.ic      = await ghAuth.getInstallationClient( tdM.GHOwner, tdM.GHRepo, tdM.GHOwner );
    authDataM.who     = authData.who;
    authDataM.api     = authData.api;
    authDataM.cog     = authData.cog;
    authDataM.cogLast = Date.now();                
    authDataM.pat     = await ghAuth.getPAT( tdM.GHOwner );


    
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

    // Undo assert to inspect active: false in CELinkage.  Need a test for this.
    let mastCol1  = await tu.makeColumn( authData, ghLinks, td.CEProjectId, td.GHFullName, wakeyPID, td.softContTitle );
    tu.remProject( authData, wakeyPID );
    // assert( false );


    // TESTS

    let testStatus = [ 0, 0, []];
    let subTest = "";

    // Save dynamo data

    subTest = await testSaveDynamo.runTests( );
    console.log( "\n\nSave Dynamo complete" );
    await utils.sleep( 1000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    await testDelete.runTests( authData, authDataX, authDataM, ghLinks, td, tdX, tdM );
    console.log( "\n\nInitial cleanup complete" );
    await utils.sleep( 5000 );
    
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
    
    subTest = await testCross.runTests( authData, authDataX, authDataM, ghLinks, td, tdX, tdM );
    console.log( "\n\nCross Repo test complete." );
    //await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await testPopulate.runTests( authData, ghLinks, td );
    console.log( "\n\nResolve test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await testComponents.runTests( authData, ghLinks, td );
    console.log( "\n\nComponents test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    tu.testReport( testStatus, "================= Testing complete =================" );

}


runTests();
