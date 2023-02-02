var assert    = require( 'assert' );
const awsAuth = require( '../../auth/aws/awsAuth' );
const ghAuth  = require( '../../auth/gh/ghAuth' );
var config    = require( '../../config' );

const authDataC = require( '../../auth/authData' );
const utils     = require( '../../utils/ceUtils' );
const awsUtils  = require( '../../utils/awsUtils' );

const ghUtils  = require( '../../utils/gh/ghUtils' );

var links     = require('../../components/linkage.js');
var circBuff  = require('../../components/circBuff.js');

const tu        = require( '../ceTestUtils' );
const testData  = require( './testData' );

const testSaveDynamo = require( '../testSaveDynamo' );

// GH Classic
const ghctu             = require( './ghc/ghcTestUtils' );
const ghcTestDelete     = require( './ghc/testDelete' );
const ghcTestSetup      = require( './ghc/testSetup' );
const ghcTestFlat       = require( './ghc/testFlat' );
const ghcTestPopulate   = require( './ghc/testPopulate' );
const ghcTestBasicFlow  = require( './ghc/testBasicFlow' );
const ghcTestComponents = require( './ghc/testComponents' );
const ghcTestCross      = require( './ghc/testCross' );

// GH V2
const gh2tu             = require( './gh2/gh2TestUtils' );
const gh2TestPopulate   = require( './gh2/testPopulate' );


async function runV2Tests( testStatus, flutterTest, authData, authDataX, authDataM, td, tdX, tdM, ghLinks ) {
    // GH, AWS and smee  can suffer long cold start times (up to 10s tot).
    // If this is first PAct for the day, start it up
    // XXX so far, V2 can't delete pv2, so no point making.  link and unlink instead.
    const wakeyPID = await gh2tu.makeProject( authData, td, "ceServer wakey XYZZYXXK837598", "" );

    await gh2tu.linkProject( authData, wakeyPID, td.GHRepoId );
    
    const pacts    = await awsUtils.getPActs( authData,  { "CEProjectId": td.ceProjectId });
    if( pacts!= -1 ) { pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) ); }
    const mrp = pacts != -1 ? pacts[ pacts.length - 1] : {"EntryDate": "01/01/1970"};
    if( utils.getToday() != mrp.EntryDate ) {
	console.log( "Cold start?  Most recent pact", mrp.EntryDate, wakeyPID.toString() );
	await utils.sleep( 8000 );
    }

    // Undo assert to inspect active: false in CELinkage.  Need a test for this.
    await gh2tu.makeColumn( authData, ghLinks, td.ceProjectId, td.GHFullName, wakeyPID, td.softContTitle );

    // gh2tu.remProject( authData, wakeyPID );
    gh2tu.unlinkProject( authData, wakeyPID, td.GHRepoId );
    assert( false );

    
    // TESTS

    let subTest = "";

    await gh2TestDelete.runTests( authData, authDataX, authDataM, ghLinks, td, tdX, tdM );
    console.log( "\n\nInitial cleanup complete" );
    await utils.sleep( 5000 );

    /*
    subTest = await gh2TestSetup.runTests( authData, ghLinks, td );
    console.log( "\n\nSetup test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await gh2TestFlat.runTests( authData, ghLinks, td );
    console.log( "\n\nFlat test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await gh2TestBasicFlow.runTests( authData, ghLinks, td );
    console.log( "\n\nFlow test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );
    
    subTest = await gh2TestCross.runTests( flutterTest, authData, authDataX, authDataM, ghLinks, td, tdX, tdM );
    console.log( "\n\nCross Repo test complete." );
    //await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );
    */
    
    subTest = await gh2TestPopulate.runTests( authData, ghLinks, td );
    console.log( "\n\nResolve test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );
    /*
    subTest = await gh2TestComponents.runTests( authData, ghLinks, td );
    console.log( "\n\nComponents test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );
    */
}

async function runClassicTests( testStatus, flutterTest, authData, authDataX, authDataM, td, tdX, tdM, ghLinks ) {
    // GH, AWS and smee  can suffer long cold start times (up to 10s tot).
    // If this is first PAct for the day, start it up
    const wakeyPID = await ghctu.makeProject( authData, td, "ceServer wakey XYZZYXXK837598", "" );
    // StayPut project to keep classics tab in play in GH, for now.
    // const aPID = await ghctu.makeProject( authData, td, "ceServer stayPut XYZZYXXK837598", "" );

    const pacts    = await awsUtils.getPActs( authData,  { "CEProjectId": td.CEProjectId });
    if( pacts!= -1 ) { pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) ); }
    const mrp = pacts != -1 ? pacts[ pacts.length - 1] : {"EntryDate": "01/01/1970"};
    if( utils.getToday() != mrp.EntryDate ) {
	console.log( "Cold start?  Most recent pact", mrp.EntryDate, wakeyPID.toString() );
	await utils.sleep( 8000 );
    }

    // Undo assert to inspect active: false in CELinkage.  Need a test for this.
    let mastCol1  = await ghctu.makeColumn( authData, ghLinks, td.CEProjectId, td.GHFullName, wakeyPID, td.softContTitle );
    ghctu.remProject( authData, wakeyPID );
    assert( false );

    
    // TESTS

    let subTest = "";

    await ghcTestDelete.runTests( authData, authDataX, authDataM, ghLinks, td, tdX, tdM );
    console.log( "\n\nInitial cleanup complete" );
    await utils.sleep( 5000 );
    
    subTest = await ghcTestSetup.runTests( authData, ghLinks, td );
    console.log( "\n\nSetup test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await ghcTestFlat.runTests( authData, ghLinks, td );
    console.log( "\n\nFlat test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await ghcTestBasicFlow.runTests( authData, ghLinks, td );
    console.log( "\n\nFlow test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );
    
    subTest = await ghcTestCross.runTests( flutterTest, authData, authDataX, authDataM, ghLinks, td, tdX, tdM );
    console.log( "\n\nCross Repo test complete." );
    //await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await ghcTestPopulate.runTests( authData, ghLinks, td );
    console.log( "\n\nResolve test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await ghcTestComponents.runTests( authData, ghLinks, td );
    console.log( "\n\nComponents test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );
}


async function runTests() {

    const args = process.argv.slice(2);
    let flutterTest = ( args[0] == "ceFlutter" );

    // GH Linkage table
    // Note: this table is a router object - need to rest-get from ceServer.  It ages quickly - best practice is to update just before use.
    let ghLinks = new links.Linkage();

    let ceProjects = new ceProjData.CEProjects();
    await ceProjects.init( authData );
    
    // TEST_REPO auth
    // XXX get ceProjectId
    let td          = new testData.TestData();
    td.GHOwner      = config.TEST_OWNER;
    td.GHRepo       = flutterTest ? config.FLUTTER_TEST_REPO : config.TEST_REPO;
    td.GHFullName   = td.GHOwner + "/" + td.GHRepo;
    td.ceProjectId  = ceProjects.findByRepo( config.HOST_GH, "codeequity", td.GHFullName );

    let authData     = new authDataC.AuthData(); 
    authData.who     = flutterTest ? "<TEST: ForFlutter> " : "<TEST: Main> ";
    authData.ic      = await ghAuth.getInstallationClient( td.GHOwner, td.GHRepo, td.GHOwner );
    authData.api     = awsUtils.getAPIPath() + "/find";
    authData.cog     = await awsAuth.getCogIDToken();
    authData.cogLast = Date.now();    
    authData.pat     = await ghAuth.getPAT( td.GHOwner );
    td.GHOwnerId     = await ghUtils.getOwnerId( authData.pat, td.GHOwner );
    td.GHRepoId      = await ghUtils.getRepoId( authData.pat, td.GHOwner, td.GHRepo );

    // CROSS_TEST_REPO auth
    let tdX        = new testData.TestData();
    tdX.GHOwner    = config.CROSS_TEST_OWNER;
    tdX.GHRepo     = config.CROSS_TEST_REPO;
    tdX.GHFullName = tdX.GHOwner + "/" + tdX.GHRepo;
    tdX.ceProjectId  = ceProjects.findByRepo( config.HOST_GH, "codeequity", tdX.GHFullName );
    
    let authDataX     = new authDataC.AuthData();
    authDataX.ic      = await ghAuth.getInstallationClient( tdX.GHOwner, tdX.GHRepo, tdX.GHOwner );
    authDataX.who     = authData.who;
    authDataX.api     = authData.api;
    authDataX.cog     = authData.cog;
    authDataX.cogLast = Date.now();        
    authDataX.pat     = await ghAuth.getPAT( tdX.GHOwner );
    tdX.GHOwnerId     = await ghUtils.getOwnerId( authDataX.pat, tdX.GHOwner );
    tdX.GHRepoId      = await ghUtils.getRepoId( authDataX.pat, tdX.GHOwner, tdX.GHRepo );
    
    // MULTI_TEST_REPO auth
    let tdM        = new testData.TestData();
    tdM.GHOwner    = config.MULTI_TEST_OWNER;
    tdM.GHRepo     = config.MULTI_TEST_REPO;
    tdM.GHFullName = tdM.GHOwner + "/" + tdM.GHRepo;
    tdM.ceProjectId  = ceProjects.findByRepo( config.HOST_GH, "codeequity", tdM.GHFullName );
    
    let authDataM     = new authDataC.AuthData();
    authDataM.ic      = await ghAuth.getInstallationClient( tdM.GHOwner, tdM.GHRepo, tdM.GHOwner );
    authDataM.who     = authData.who;
    authDataM.api     = authData.api;
    authDataM.cog     = authData.cog;
    authDataM.cogLast = Date.now();            
    authDataM.pat     = await ghAuth.getPAT( tdM.GHOwner );
    tdM.GHOwnerId     = await ghUtils.getOwnerId( authDataM.pat, tdM.GHOwner );
    tdM.GHRepoId      = await ghUtils.getRepoId( authDataM.pat, tdM.GHOwner, tdM.GHRepo );

    let testStatus = [ 0, 0, []];

    // XXX Add an arg if these are ever useful again
    // runClassicTests( testStatus, flutterTest, authData, authDataX, authDataM, td, tdX, tdM, ghLinks );

    runV2Tests( testStatus, flutterTest, authData, authDataX, authDataM, td, tdX, tdM, ghLinks );
	
    // Save dynamo data if run was successful
    if( testStatus[1] == 0 ) {
	subTest = await testSaveDynamo.runTests( flutterTest );
	console.log( "\n\nSave Dynamo complete" );
	await utils.sleep( 1000 );
	testStatus = tu.mergeTests( testStatus, subTest );
    }
    
    tu.testReport( testStatus, "================= Testing complete =================" );

}


runTests();
