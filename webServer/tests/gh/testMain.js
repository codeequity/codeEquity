const assert    = require( 'assert' );
const awsAuth   = require( '../../auth/aws/awsAuth' );
const ghAuth    = require( '../../auth/gh/ghAuth' );
const config    = require( '../../config' );

const authDataC = require( '../../auth/authData' );
const utils     = require( '../../utils/ceUtils' );
const awsUtils  = require( '../../utils/awsUtils' );
const links     = require('../../utils/linkage.js');

const ghUtils   = require( '../../utils/gh/ghUtils' );
const ghV2      = require( '../../utils/gh/gh2/ghV2Utils' );

const circBuff  = require('../../components/circBuff.js');

const tu        = require( '../ceTestUtils' );

const ceProjData = require( '../../routes/ceProjects' );
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
const gh2TestDelete     = require( './gh2/testDelete' );
const gh2TestSetup      = require( './gh2/testSetup' );
const gh2TestFlat       = require( './gh2/testFlat' );
const gh2TestPopulate   = require( './gh2/testPopulate' );
const gh2TestBasicFlow  = require( './gh2/testBasicFlow' );
const gh2TestComponents = require( './gh2/testComponents' );


async function runV2Tests( testStatus, flutterTest, authData, authDataX, authDataM, td, tdX, tdM, testLinks ) {
    // GH, AWS and smee  can suffer long cold start times (up to 10s tot).
    // If this is first PAct for the day, start it up.  The purpose of wakey is to kick off both aws and each host.

    const wakeyName = "ceServer wakey XYZZYXXK837598";

    // XXX so far, V2 can't delete pv2, so no point making.  link and unlink instead.
    let wakeyPID = await gh2tu.createProjectWorkaround( authData, td, wakeyName, "" );
    assert( wakeyPID != -1 );
    console.log( "Found", wakeyName, "with PID:", wakeyPID, "for ceProj:", td.ceProjectId );
    
    const pacts    = await awsUtils.getPActs( authData,  { "CEProjectId": td.ceProjectId });
    if( pacts!= -1 ) { pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) ); }
    const mrp = pacts != -1 ? pacts[ pacts.length - 1] : {"EntryDate": "01/01/1970"};
    if( utils.getToday() != mrp.EntryDate ) {
	console.log( "Cold start?  Most recent pact", mrp.EntryDate, wakeyPID.toString() );
	await utils.sleep( 8000 );
    }

    // gh2tu.remProject( authData, wakeyPID );
    gh2tu.unlinkProject( authData, td.ceProjectId, wakeyPID, td.GHRepoId );

    // TESTS

    let subTest = "";
    await gh2TestDelete.runTests( authData, authDataX, authDataM, testLinks, td, tdX, tdM );
    console.log( "\n\nInitial cleanup complete" );
    await utils.sleep( 5000 );

    subTest = await gh2TestSetup.runTests( authData, testLinks, td );
    console.log( "\n\nSetup test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );
    
    subTest = await gh2TestFlat.runTests( authData, testLinks, td );
    console.log( "\n\nFlat test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await gh2TestComponents.runTests( authData, testLinks, td );
    console.log( "\n\nComponents test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await gh2TestBasicFlow.runTests( authData, testLinks, td );
    console.log( "\n\nFlow test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );
    
    /*
    subTest = await gh2TestCross.runTests( flutterTest, authData, authDataX, authDataM, testLinks, td, tdX, tdM );
    console.log( "\n\nCross Repo test complete." );
    //await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );
    */

    subTest = await gh2TestPopulate.runTests( authData, testLinks, td );
    console.log( "\n\nResolve test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );
    
    return testStatus;
}

async function runClassicTests( testStatus, flutterTest, authData, authDataX, authDataM, td, tdX, tdM, testLinks ) {
    // GH, AWS and smee  can suffer long cold start times (up to 10s tot).
    // If this is first PAct for the day, start it up
    const wakeyPID = await ghctu.makeProject( authData, td, "ceServer wakey XYZZYXXK837598", "" );
    // StayPut project to keep classics tab in play in GH, for now.
    // const aPID = await ghctu.makeProject( authData, td, "ceServer stayPut XYZZYXXK837598", "" );

    const pacts    = await awsUtils.getPActs( authData,  { "CEProjectId": td.ceProjectId });
    if( pacts!= -1 ) { pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) ); }
    const mrp = pacts != -1 ? pacts[ pacts.length - 1] : {"EntryDate": "01/01/1970"};
    if( utils.getToday() != mrp.EntryDate ) {
	console.log( "Cold start?  Most recent pact", mrp.EntryDate, wakeyPID.toString() );
	await utils.sleep( 8000 );
    }

    // Undo assert to inspect active: false in CELinkage.  Need a test for this.
    let mastCol1  = await ghctu.makeColumn( authData, testLinks, td.ceProjectId, td.GHFullName, wakeyPID, td.softContTitle );
    ghctu.remProject( authData, wakeyPID );
    assert( false );

    
    // TESTS

    let subTest = "";

    await ghcTestDelete.runTests( authData, authDataX, authDataM, testLinks, td, tdX, tdM );
    console.log( "\n\nInitial cleanup complete" );
    await utils.sleep( 5000 );
    
    subTest = await ghcTestSetup.runTests( authData, testLinks, td );
    console.log( "\n\nSetup test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await ghcTestFlat.runTests( authData, testLinks, td );
    console.log( "\n\nFlat test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await ghcTestBasicFlow.runTests( authData, testLinks, td );
    console.log( "\n\nFlow test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );
    
    subTest = await ghcTestCross.runTests( flutterTest, authData, authDataX, authDataM, testLinks, td, tdX, tdM );
    console.log( "\n\nCross Repo test complete." );
    //await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await ghcTestPopulate.runTests( authData, testLinks, td );
    console.log( "\n\nResolve test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await ghcTestComponents.runTests( authData, testLinks, td );
    console.log( "\n\nComponents test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );
}


async function runTests() {

    console.log( "ENTER RUNTESTS" );

    const args = process.argv.slice(2);
    let flutterTest = ( args[0] == "ceFlutter" );

    // GH Linkage table, i.e. ceServer's ghLinks.
    // Note: this table is a router object - need to rest-get from ceServer.  It ages quickly - best practice is to update just before use.
    let testLinks = new links.Linkage();

    
    // TEST_REPO auth
    let td          = new testData.TestData();
    td.GHOwner      = config.TEST_OWNER
    td.actor        = config.TEST_ACTOR;
    td.GHRepo       = flutterTest ? config.FLUTTER_TEST_REPO : config.TEST_REPO;
    td.GHFullName   = td.GHOwner + "/" + td.GHRepo;

    let authData     = new authDataC.AuthData(); 
    authData.who     = flutterTest ? "<TEST: ForFlutter> " : "<TEST: Main> ";
    authData.ic      = await ghAuth.getInstallationClient( td.GHOwner, td.GHRepo, td.GHOwner );
    authData.api     = awsUtils.getAPIPath() + "/find";
    authData.cog     = await awsAuth.getCogIDToken();
    authData.cogLast = Date.now();    
    authData.pat     = await ghAuth.getPAT( td.actor );
    console.log( "Get pat for owner", td.GHOwner );
    td.GHOwnerId     = await ghUtils.getOwnerId( authData.pat, td.GHOwner );
    console.log( "Get pat for actor", td.actor );
    
    td.actorId       = await ghUtils.getOwnerId( authData.pat, td.actor );
    td.GHRepoId      = await ghUtils.getRepoId( authData.pat, td.GHOwner, td.GHRepo );

    // First ceProj init requires authData, which needs .cog, .api and .who
    let ceProjects = new ceProjData.CEProjects();
    await ceProjects.init( authData );
    td.ceProjectId  = ceProjects.findByRepo( config.HOST_GH, "codeequity", td.GHFullName );
    assert( td.ceProjectId != config.EMPTY );
    
    // CROSS_TEST_REPO auth
    let tdX        = new testData.TestData();
    tdX.GHOwner    = config.CROSS_TEST_OWNER;
    tdX.actor      = config.CROSS_TEST_ACTOR;
    tdX.GHRepo     = config.CROSS_TEST_REPO;
    tdX.GHFullName = tdX.GHOwner + "/" + tdX.GHRepo;
    tdX.ceProjectId  = ceProjects.findByRepo( config.HOST_GH, "codeequity", tdX.GHFullName );
    
    let authDataX     = new authDataC.AuthData();
    authDataX.ic      = await ghAuth.getInstallationClient( tdX.GHOwner, tdX.GHRepo, tdX.GHOwner );
    authDataX.who     = authData.who;
    authDataX.api     = authData.api;
    authDataX.cog     = authData.cog;
    authDataX.cogLast = Date.now();        
    authDataX.pat     = await ghAuth.getPAT( tdX.actor );
    tdX.GHOwnerId     = await ghUtils.getOwnerId( authDataX.pat, tdX.GHOwner );
    tdX.actorId       = await ghUtils.getOwnerId( authDataX.pat, tdX.actor );
    tdX.GHRepoId      = await ghUtils.getRepoId( authDataX.pat, tdX.GHOwner, tdX.GHRepo );
    
    // MULTI_TEST_REPO auth
    let tdM        = new testData.TestData();
    tdM.GHOwner    = config.MULTI_TEST_OWNER;
    tdM.actor      = config.MULTI_TEST_ACTOR;
    tdM.GHRepo     = config.MULTI_TEST_REPO;
    tdM.GHFullName = tdM.GHOwner + "/" + tdM.GHRepo;
    tdM.ceProjectId  = ceProjects.findByRepo( config.HOST_GH, "codeequity", tdM.GHFullName );
    
    let authDataM     = new authDataC.AuthData();
    authDataM.ic      = await ghAuth.getInstallationClient( tdM.GHOwner, tdM.GHRepo, tdM.GHOwner );
    authDataM.who     = authData.who;
    authDataM.api     = authData.api;
    authDataM.cog     = authData.cog;
    authDataM.cogLast = Date.now();            
    authDataM.pat     = await ghAuth.getPAT( tdM.actor );
    tdM.GHOwnerId     = await ghUtils.getOwnerId( authDataM.pat, tdM.GHOwner );
    tdM.actorId       = await ghUtils.getOwnerId( authDataM.pat, tdM.actor );
    tdM.GHRepoId      = await ghUtils.getRepoId( authDataM.pat, tdM.GHOwner, tdM.GHRepo );

    let testStatus = [ 0, 0, []];

    // XXX Add an arg if these are ever useful again
    // await runClassicTests( testStatus, flutterTest, authData, authDataX, authDataM, td, tdX, tdM, testLinks );

    testStatus = await runV2Tests( testStatus, flutterTest, authData, authDataX, authDataM, td, tdX, tdM, testLinks );

    // Save dynamo data if run was successful
    if( testStatus[1] == 0 ) {
	subTest = await testSaveDynamo.runTests( flutterTest );   // XXXXXX
	console.log( "\n\nSave Dynamo complete" );
	await utils.sleep( 1000 );
	testStatus = tu.mergeTests( testStatus, subTest );
    }
    
    tu.testReport( testStatus, "================= Testing complete =================" );

}


runTests();
