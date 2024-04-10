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
const gh2TestCross      = require( './gh2/testCross' );


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
    gh2tu.unlinkProject( authData, td.ceProjectId, wakeyPID, td.ghRepoId );

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

    subTest = await gh2TestBasicFlow.runTests( authData, testLinks, td );
    console.log( "\n\nFlow test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await gh2TestPopulate.runTests( authData, testLinks, td );
    console.log( "\n\nResolve test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await gh2TestComponents.runTests( authData, testLinks, td );
    console.log( "\n\nComponents test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await gh2TestCross.runTests( flutterTest, authData, authDataX, authDataM, testLinks, td, tdX, tdM );
    console.log( "\n\nCross Repo test complete." );
    //await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    ghUtils.show( true );
    awsUtils.show( true );
    tu.showCallCounts( true );
    
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
    let mastCol1  = await ghctu.makeColumn( authData, testLinks, td.ceProjectId, td.ghFullName, wakeyPID, td.softContTitle );
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

function flutterRename ( td ) {
    td.mainTitle        = config.MAIN_PROJ_TEST;
    td.dataSecTitle     = td.dataSecTitle   + " Flut";
    td.githubOpsTitle   = td.githubOpsTitle + " Flut";
    td.flatTitle        = td.flatTitle      + " Flut";

    // td.softContTitle    = td.softContTitle  + " Flut";
    // td.busOpsTitle      = td.busOpsTitle    + " Flut";
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
    td.ghOwner      = config.TEST_OWNER
    td.actor        = config.TEST_ACTOR;
    td.ghRepo       = flutterTest ? config.FLUTTER_TEST_REPO : config.TEST_REPO;
    td.ghFullName   = td.ghOwner + "/" + td.ghRepo;

    let authData     = new authDataC.AuthData(); 
    authData.who     = flutterTest ? "<TEST: ForFlutter> " : "<TEST: Main> ";
    // authData.ic      = await ghAuth.getInstallationClient( td.ghOwner, td.ghRepo, td.ghOwner );
    authData.api     = awsUtils.getAPIPath() + "/find";
    authData.cog     = await awsAuth.getCogIDToken();
    authData.cogLast = Date.now();    
    authData.pat     = await ghAuth.getPAT( td.actor );
    console.log( "Get pat for owner", td.ghOwner );
    td.ghOwnerId     = await ghUtils.getOwnerId( authData.pat, td.ghOwner );
    console.log( "Get pat for actor", td.actor );
    
    td.actorId       = await ghUtils.getOwnerId( authData.pat, td.actor );
    td.ghRepoId      = await ghUtils.getRepoId( authData.pat, td.ghOwner, td.ghRepo );


    console.log( "Got repo: ", td.ghRepo, td.ghRepoId );
    
    // CROSS_TEST_REPO auth
    let tdX        = new testData.TestData();
    tdX.ghOwner    = config.CROSS_TEST_OWNER;
    tdX.actor      = config.CROSS_TEST_ACTOR;
    tdX.ghRepo     = config.CROSS_TEST_REPO;
    tdX.ghFullName = tdX.ghOwner + "/" + tdX.ghRepo;
    
    let authDataX     = new authDataC.AuthData();
    // authDataX.ic      = await ghAuth.getInstallationClient( tdX.ghOwner, tdX.ghRepo, tdX.ghOwner );
    authDataX.who     = authData.who;
    authDataX.api     = authData.api;
    authDataX.cog     = authData.cog;
    authDataX.cogLast = Date.now();        
    authDataX.pat     = await ghAuth.getPAT( tdX.actor );
    tdX.ghOwnerId     = await ghUtils.getOwnerId( authDataX.pat, tdX.ghOwner );
    tdX.actorId       = await ghUtils.getOwnerId( authDataX.pat, tdX.actor );
    tdX.ghRepoId      = await ghUtils.getRepoId( authDataX.pat, tdX.ghOwner, tdX.ghRepo );
    
    // MULTI_TEST_REPO auth
    let tdM        = new testData.TestData();
    tdM.ghOwner    = config.MULTI_TEST_OWNER;
    tdM.actor      = config.MULTI_TEST_ACTOR;
    tdM.ghRepo     = config.MULTI_TEST_REPO;
    tdM.ghFullName = tdM.ghOwner + "/" + tdM.ghRepo;
    
    let authDataM     = new authDataC.AuthData();
    // authDataM.ic      = await ghAuth.getInstallationClient( tdM.ghOwner, tdM.ghRepo, tdM.ghOwner );
    authDataM.who     = authData.who;
    authDataM.api     = authData.api;
    authDataM.cog     = authData.cog;
    authDataM.cogLast = Date.now();            
    authDataM.pat     = await ghAuth.getPAT( tdM.actor );
    tdM.ghOwnerId     = await ghUtils.getOwnerId( authDataM.pat, tdM.ghOwner );
    tdM.actorId       = await ghUtils.getOwnerId( authDataM.pat, tdM.actor );
    tdM.ghRepoId      = await ghUtils.getRepoId( authDataM.pat, tdM.ghOwner, tdM.ghRepo );


    // ceFlutter fix ?? If so, would have a 3-phase test nightly.  1: ceFlutter init.  2: ceServer.  3: ceFlutter ingest.  hmmm.
    // This is yucky.  ceFlutter is responsible to initiate cep, and id (link) initial repo(s).
    // linkRepo assumes cep exists.  it helps during testing to have fixed repo and cep ids, makes debugging much simpler.
    // testDelete may have already removed ceProjects.HostParts.
    // Use testing-only map here to set initial ceProjectIds.
    // let ceProjects = new ceProjData.CEProjects();
    // await ceProjects.init( authData );
    // td.ceProjectId  = ceProjects.findByRepo( config.HOST_GH, "codeequity", td.ghFullName );
    // tdX.ceProjectId = ceProjects.findByRepo( config.HOST_GH, "codeequity", tdX.ghFullName );
    // tdM.ceProjectId = ceProjects.findByRepo( config.HOST_GH, "codeequity", tdM.ghFullName );
    td.ceProjectId  = flutterTest ? config.FLUTTER_TEST_CEPID : config.TEST_CEPID;
    tdX.ceProjectId = config.CROSS_TEST_CEPID;
    tdM.ceProjectId = config.MULTI_TEST_CEPID;

    // Convert project names to flutter as needed to avoid crossover infection between server tests and flutter tests (the CEPIDs otherwise share projects)
    if( flutterTest ) {
	flutterRename( td  );
	flutterRename( tdX );
	flutterRename( tdM );
    }
    
    // cepDetails, typically set from ceFlutter
    let tdBlank = {};
    tdBlank.projComponent = "ceServer Testing";   
    tdBlank.description   = "testing only";       
    tdBlank.platform      = config.HOST_GH;
    tdBlank.org           = config.TEST_OWNER;
    tdBlank.ownerCategory = "Organization";       
    tdBlank.pms           = config.PMS_GH2;

    let tdXBlank = { ...tdBlank }; 
    tdXBlank.CEProjectComponent = "ceServer Alt Testing";

    td.cepDetails  = tdBlank;  // same CEP
    tdM.cepDetails = tdBlank;  // same CEP
    tdX.cepDetails = tdXBlank;
    
    let testStatus = [ 0, 0, []];

    // XXX Add an arg if these are ever useful again
    // await runClassicTests( testStatus, flutterTest, authData, authDataX, authDataM, td, tdX, tdM, testLinks );

    testStatus = await runV2Tests( testStatus, flutterTest, authData, authDataX, authDataM, td, tdX, tdM, testLinks );

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
