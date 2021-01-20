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

const testData = require( './testData' );



async function runTests() {

    // GH Linkage table
    // Note: this table is a router object - need to rest-get from ceServer.  It ages quickly - best practice is to update just before use.
    let ghLinks = new links.Linkage();
    
    let td = new testData.TestData();
    td.GHOwner      = config.TEST_OWNER;
    td.GHRepo       = config.TEST_REPO;
    td.GHFullName   = td.GHOwner + "/" + td.GHRepo;

    // installClient is quad [installationAccessToken, creationSource, apiPath, cognitoIdToken]
    let token = await auth.getInstallationClient( td.GHOwner, td.GHRepo, td.GHOwner );
    let source = "<TEST: Main> ";
    let apiPath = utils.getAPIPath() + "/find";
    let idToken = await awsAuth.getCogIDToken();
    let installClient = [token, source, apiPath, idToken];

    // GH, AWS and smee  can suffer long cold start times (up to 10s tot).
    // If this is first PAct for the day, start it up
    const wakeyPID = await tu.makeProject( installClient, td, "ceServer wakey XYZZYXXK837598", "" );
    const pacts    = await utils.getPActs( installClient, {"GHRepo": td.GHFullName} );
    if( pacts!= -1 ) { pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) ); }
    const mrp = pacts != -1 ? pacts[ pacts.length - 1] : {"EntryDate": "01/01/1970"};
    if( utils.getToday() != mrp.EntryDate ) {
	console.log( "Cold start?  Most recent pact", mrp.EntryDate );
	await utils.sleep( 8000 );
    }
    tu.remProject( installClient, wakeyPID );


    // TESTS

    let testStatus = [ 0, 0, []];
    let subTest = "";

    await testDelete.runTests( ghLinks );

    subTest = await testSetup.runTests( installClient, ghLinks, td );
    console.log( "\n\nSetup test complete." );
    await utils.sleep( 10000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await testFlat.runTests( installClient, ghLinks, td );
    console.log( "\n\nFlat test complete." );
    await utils.sleep( 10000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await testBasicFlow.runTests( installClient, ghLinks, td );
    console.log( "\n\nFlow test complete." );
    await utils.sleep( 10000 );
    testStatus = tu.mergeTests( testStatus, subTest );
    
    subTest = await testComponents.runTests( installClient, ghLinks, td );
    console.log( "\n\nComponents test complete." );
    await utils.sleep( 10000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    tu.testReport( testStatus, "================= Testing complete =================" );
    
    // XXX test add, peq, then add new card to peq issue.  unclaimed.  split issue with assignees?
    // XXX test standard add, move, close, reopen, accrue

    
    // NOTE: you must TURN OFF ceServer to construct part of this test, and turn it back on to execute it.
    // Have already populated in setup, but will re-pop here.  No harm.  
    // can't split current resolve test off without rewriting it to be incremental (i.e. can't generate 1:3 without server being off)
    // await testPopulate.runTests( installClient, ghLinks, td );
}


runTests();
