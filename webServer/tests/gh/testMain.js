import assert  from 'assert';

import * as awsAuth from '../../auth/aws/awsAuth.js';
import * as ghAuth  from '../../auth/gh/ghAuth.js';
import * as config  from '../../config.js';

import authDataC      from '../../auth/authData.js';
import * as utils     from '../../utils/ceUtils.js';
import * as awsUtils  from '../../utils/awsUtils.js';
import links          from '../../utils/linkage.js';

import * as ghUtils   from '../../utils/gh/ghUtils.js';
import * as ghV2      from '../../utils/gh/gh2/ghV2Utils.js';

import circBuff       from '../../components/circBuff.js';

import * as tu        from '../ceTestUtils.js';

import ceProjData     from '../../routes/ceProjects.js';
import testData       from './testData.js';

import testSaveDynamo from '../testSaveDynamo.js';

// GH Classic
import * as ghctu        from './ghc/ghcTestUtils.js';
import ghcTestDelete     from './ghc/testDelete.js';
import ghcTestSetup      from './ghc/testSetup.js';
import ghcTestFlat       from './ghc/testFlat.js';
import ghcTestPopulate   from './ghc/testPopulate.js';
import ghcTestBasicFlow  from './ghc/testBasicFlow.js';
import ghcTestComponents from './ghc/testComponents.js';
import ghcTestCross      from './ghc/testCross.js';

// GH V2
import * as gh2tu        from './gh2/gh2TestUtils.js';
import gh2TestDelete     from './gh2/testDelete.js';
import gh2TestSetup      from './gh2/testSetup.js';
import gh2TestFlat       from './gh2/testFlat.js';
import gh2TestPopulate   from './gh2/testPopulate.js';
import gh2TestBasicFlow  from './gh2/testBasicFlow.js';
import gh2TestComponents from './gh2/testComponents.js';
import gh2TestCross      from './gh2/testCross.js';


async function runV2Tests( testStatus, flutterTest, authData, authDataX, authDataM, authDataF, td, tdX, tdM, tdF, testLinks ) {
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

    await gh2TestDelete( authData, authDataX, authDataM, authDataF, testLinks, td, tdX, tdM, tdF );
    console.log( "\n\nInitial cleanup complete" );
    await utils.sleep( 5000 );

    subTest = await gh2TestSetup( authData, testLinks, td );
    console.log( "\n\nSetup test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await gh2TestFlat( authData, testLinks, td );
    console.log( "\n\nFlat test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await gh2TestBasicFlow( authData, testLinks, td );
    console.log( "\n\nFlow test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await gh2TestPopulate( authData, testLinks, td );
    console.log( "\n\nResolve test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await gh2TestComponents( authData, testLinks, td );
    console.log( "\n\nComponents test complete." );
    await utils.sleep( 5000 );
    testStatus = tu.mergeTests( testStatus, subTest );

    subTest = await gh2TestCross( flutterTest, authData, authDataX, authDataM, authDataF, testLinks, td, tdX, tdM, tdF );
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
    // let mastCol1  = await ghctu.makeColumn( authData, testLinks, td.ceProjectId, td.ghFullName, wakeyPID, td.softContTitle );
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
    td.testType         = "FrontEnd";
    td.dataSecTitle     = td.dataSecTitle   + " Flut";
    td.githubOpsTitle   = td.githubOpsTitle + " Flut";
    td.flatTitle        = td.flatTitle      + " Flut";
}


async function runTests() {

    console.log( "ENTER RUNTESTS" );

    const args = process.argv.slice(2);
    let flutterTest = ( args[0] == "ceFlutter" );

    // GH Linkage table, i.e. ceServer's ghLinks.
    // Note: this table is a router object - need to rest-get from ceServer.  It ages quickly - best practice is to update just before use.
    let testLinks = new links();

    
    // TEST_REPO auth
    let td          = new testData();
    td.ghOwner      = config.TEST_OWNER
    td.actor        = config.TEST_ACTOR;
    td.ghRepo       = flutterTest ? config.FLUTTER_TEST_REPO : config.TEST_REPO;
    td.ghFullName   = td.ghOwner + "/" + td.ghRepo;

    let authData     = new authDataC(); 
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

    // FAIL_CROSS_TEST_REPO auth
    let tdF        = new testData();
    tdF.ghOwner    = config.FAIL_CROSS_TEST_OWNER;
    tdF.actor      = config.FAIL_CROSS_TEST_ACTOR;
    tdF.ghRepo     = config.FAIL_CROSS_TEST_REPO;
    tdF.ghFullName = tdF.ghOwner + "/" + tdF.ghRepo;
    
    let authDataF     = new authDataC();
    // authDataF.ic      = await ghAuth.getInstallationClient( tdF.ghOwner, tdF.ghRepo, tdF.ghOwner );
    authDataF.who     = authData.who;
    authDataF.api     = authData.api;
    authDataF.cog     = authData.cog;
    authDataF.cogLast = Date.now();        
    authDataF.pat     = await ghAuth.getPAT( tdF.actor );
    tdF.ghOwnerId     = await ghUtils.getOwnerId( authDataF.pat, tdF.ghOwner );
    tdF.actorId       = await ghUtils.getOwnerId( authDataF.pat, tdF.actor );
    tdF.ghRepoId      = await ghUtils.getRepoId( authDataF.pat, tdF.ghOwner, tdF.ghRepo );
    
    // CROSS_TEST_REPO auth
    let tdX        = new testData();
    tdX.ghOwner    = config.CROSS_TEST_OWNER;
    tdX.actor      = config.CROSS_TEST_ACTOR;
    tdX.ghRepo     = flutterTest ? config.FLUTTER_CROSS_TEST_REPO : config.CROSS_TEST_REPO;
    tdX.ghFullName = tdX.ghOwner + "/" + tdX.ghRepo;
    
    let authDataX     = new authDataC();
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
    let tdM        = new testData();
    tdM.ghOwner    = config.MULTI_TEST_OWNER;
    tdM.actor      = config.MULTI_TEST_ACTOR;
    tdM.ghRepo     = flutterTest ? config.FLUTTER_MULTI_TEST_REPO : config.MULTI_TEST_REPO;
    tdM.ghFullName = tdM.ghOwner + "/" + tdM.ghRepo;
    
    let authDataM     = new authDataC();
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
    td.ceProjectId  = flutterTest ? config.FLUTTER_TEST_CEPID       : config.TEST_CEPID;
    tdM.ceProjectId = flutterTest ? config.FLUTTER_MULTI_TEST_CEPID : config.MULTI_TEST_CEPID;
    tdX.ceProjectId = flutterTest ? config.FLUTTER_CROSS_TEST_CEPID : config.CROSS_TEST_CEPID;
    tdF.ceProjectId = config.FAIL_CROSS_TEST_CEPID;

    // Convert project names to flutter as needed to avoid crossover infection between server tests and flutter tests (the CEPIDs otherwise share projects)
    if( flutterTest ) {
	flutterRename( td  );
	flutterRename( tdX );
	flutterRename( tdM );
	flutterRename( tdF );
    }
    
    // cepDetails, typically set from ceFlutter
    let tdBlank = {};

    tdBlank.platform      = config.HOST_GH;
    tdBlank.org           = config.TEST_OWNER;
    tdBlank.ownerCategory = "Organization";       
    tdBlank.pms           = config.PMS_GH2;

    let tdXBlank = { ...tdBlank }; 
    let tdFBlank = { ...tdBlank }; 
    // tdXBlank.CEProjectComponent = "ceServer Alt Testing";

    td.cepDetails  = tdBlank;  // same CEP
    tdM.cepDetails = tdBlank;  // same CEP
    tdX.cepDetails = tdXBlank;
    tdF.cepDetails = tdFBlank;

    // XXX very ugly calling convention to linkRepo .. needs updating
    td.cepDetails.ceVentureId = flutterTest ? config.FLUTTER_TEST_CEVID : config.TEST_CEVID;
    td.cepDetails.name        = flutterTest ? config.FLUTTER_TEST_NAME : config.TEST_NAME;
    td.cepDetails.description = flutterTest ? config.FLUTTER_TEST_DESC : config.TEST_DESC;

    tdM.cepDetails.ceVentureId = flutterTest ? config.FLUTTER_MULTI_TEST_CEVID : config.MULTI_TEST_CEVID;
    tdM.cepDetails.name        = flutterTest ? config.FLUTTER_MULTI_TEST_NAME  : config.MULTI_TEST_NAME;
    tdM.cepDetails.description = flutterTest ? config.FLUTTER_MULTI_TEST_DESC  : config.MULTI_TEST_DESC;
    
    tdX.cepDetails.ceVentureId = flutterTest ? config.FLUTTER_CROSS_TEST_CEVID : config.CROSS_TEST_CEVID;
    tdX.cepDetails.name        = flutterTest ? config.FLUTTER_CROSS_TEST_NAME : config.CROSS_TEST_NAME;
    tdX.cepDetails.description = flutterTest ? config.FLUTTER_CROSS_TEST_DESC : config.CROSS_TEST_DESC;

    tdF.cepDetails.ceVentureId = config.FAIL_CROSS_TEST_CEVID;
    tdF.cepDetails.name        = config.FAIL_CROSS_TEST_NAME;
    tdF.cepDetails.description = config.FAIL_CROSS_TEST_DESC;
    
    let testStatus = [ 0, 0, []];

    // XXX Add an arg if these are ever useful again
    // await runClassicTests( testStatus, flutterTest, authData, authDataX, authDataM, td, tdX, tdM, testLinks );

    testStatus = await runV2Tests( testStatus, flutterTest, authData, authDataX, authDataM, authDataF, td, tdX, tdM, tdF, testLinks );

    // Save dynamo data if run was successful
    if( testStatus[1] == 0 ) {
	let subTest = await testSaveDynamo( flutterTest ); 
	console.log( "\n\nSave Dynamo complete" );
	await utils.sleep( 1000 );
	testStatus = tu.mergeTests( testStatus, subTest );
    }
    
    tu.testReport( testStatus, "================= Testing complete =================" );

}


runTests();
