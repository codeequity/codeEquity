const auth = require( "../auth");
var utils = require('../utils');
var ghUtils = require('../ghUtils');
var config  = require('../config');
var assert = require('assert');

const testData = require( './testData' );
const tu = require('./testUtils');

var gh = ghUtils.githubUtils;


// Adding a small sleep in each tu.make* - GH seems to get confused if requests come in too fast
async function createPreferredCEProjects( installClient, td ) {
    console.log( "Building preferred CE project layout, a mini version" );
    
    // Master: softwareContr, businessOps, unallocated
    td.masterPID  = await tu.makeProject( installClient, td, config.MAIN_PROJ, "Overall planned equity allocations, by category" );
    let mastCol1  = await tu.makeColumn( installClient, td.masterPID, td.softContTitle );
    let mastCol2  = await tu.makeColumn( installClient, td.masterPID, td.busOpsTitle );
    let mastCol3  = await tu.makeColumn( installClient, td.masterPID, td.unallocTitle );

    // dataSec: 4x
    let dataPID  = await tu.makeProject( installClient, td, td.dataSecTitle, "Make PII safe" );
    let dataCols = await tu.make4xCols( installClient, dataPID );

    // githubOPs: 4x
    let ghOpPID  = await tu.makeProject( installClient, td, td.githubOpsTitle, "Make it giddy" );
    let ghOpCols = await tu.make4xCols( installClient, ghOpPID );
    
    // softCont: dataSecurity, githubOps, unallocated
    let dsCardId = await tu.makeAllocCard( installClient, mastCol1, td.dataSecTitle, "1,000,000" )

    // Just triggered populate.
    console.log( "Wait while populating.." );
    await utils.sleep( 15000 );
    console.log( "Done waiting." );
    
    let ghCardId = await tu.makeAllocCard( installClient, mastCol1, td.githubOpsTitle, "1,500,000" )
    let usCardId = await tu.makeAllocCard( installClient, mastCol1, td.unallocTitle, "3,000,000" )
    
    // busOps:  unallocated
    let ubCardId = await tu.makeAllocCard( installClient, mastCol2, td.unallocTitle, "1,000,000" )
}

async function testPreferredCEProjects( installClient, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    await tu.refresh( installClient, td );
    
    // Check DYNAMO PEQ table
    let ghPeqs =  await utils.getPeqs( installClient[1], { "GHRepo": td.GHFullName, "GHIssueTitle": td.githubOpsTitle });
    assert( ghPeqs.length > 0 ); // total fail if this fails
    testStatus = tu.checkEq( ghPeqs.length, 1,                           testStatus, "Number of githubOps peq objects" );
    testStatus = tu.checkEq( ghPeqs[0].PeqType, "allocation",            testStatus, "PeqType" );
    testStatus = tu.checkEq( ghPeqs[0].Amount, "1500000",                testStatus, "Peq Amount" );  
    testStatus = tu.checkAr( ghPeqs[0].GHProjectSub, [td.softContTitle], testStatus, "Project sub" );
    testStatus = tu.checkEq( ghPeqs[0].GHProjectId, td.masterPID,        testStatus, "Project ID" );  
    
    let dsPeqs =  await utils.getPeqs( installClient[1], { "GHRepo": td.GHFullName, "GHIssueTitle": td.dataSecTitle });
    testStatus = tu.checkEq( dsPeqs.length, 1,                           testStatus, "Number of datasec peq objects" );
    testStatus = tu.checkEq( dsPeqs[0].PeqType, "allocation",            testStatus, "PeqType" );
    testStatus = tu.checkAr( dsPeqs[0].GHProjectSub, [td.softContTitle], testStatus, "Project sub" );

    let unPeqs =  await utils.getPeqs( installClient[1], { "GHRepo": td.GHFullName, "GHIssueTitle": td.unallocTitle });
    testStatus = tu.checkEq( unPeqs.length, 2,                           testStatus, "Number of unalloc peq objects" );
    testStatus = tu.checkEq( unPeqs[0].PeqType, "allocation",            testStatus, "PeqType" );

    let busTest = unPeqs[0].GHProjectSub.includes(td.busOpsTitle) || unPeqs[1].GHProjectSub.includes( td.busOpsTitle );
    testStatus = tu.checkEq( busTest, true,                              testStatus, "Project subs for unalloc" );    

    
    // Check DYNAMO PAct 
    let pacts = await utils.getPActs( installClient[1], {"GHRepo": td.GHFullName} );
    testStatus = tu.checkGE( pacts.length, 4,         testStatus, "Number of PActs" );
    let foundPActs = 0;
    for( pact of pacts ) {
	if( pact.Subject[0] == ghPeqs[0].PEQId ) {
	    let hasRaw = await tu.hasRaw( installClient[1], pact.PEQActionId );
	    testStatus = tu.checkEq( pact.Verb, "confirm",                       testStatus, "PAct Verb"); 
	    testStatus = tu.checkEq( pact.Action, "add",                         testStatus, "PAct Action" ); 
	    testStatus = tu.checkEq( hasRaw, true,                               testStatus, "PAct Raw match" ); 
	    testStatus = tu.checkEq( pact.GHUserName, config.TESTER_BOT,         testStatus, "PAct user name" ); 
	    testStatus = tu.checkEq( pact.Ingested, "false",                     testStatus, "PAct ingested" );
	    testStatus = tu.checkEq( pact.Locked, "false",                       testStatus, "PAct locked" );
	    foundPActs++;
	}
	else if( pact.Subject[0] == dsPeqs[0].PEQId ) {
	    let hasRaw = await tu.hasRaw( installClient[1], pact.PEQActionId );
	    testStatus = tu.checkEq( pact.Verb, "confirm",                       testStatus, "PAct Verb"); 
	    testStatus = tu.checkEq( pact.Action, "add",                         testStatus, "PAct Action" ); 
	    testStatus = tu.checkEq( hasRaw, true,                               testStatus, "PAct Raw match" ); 
	    testStatus = tu.checkEq( pact.Ingested, "false",                     testStatus, "PAct ingested" );
	    foundPActs++;
	}
	else if( pact.Subject[0] == unPeqs[0].PEQId ) {
	    let hasRaw = await tu.hasRaw( installClient[1], pact.PEQActionId );
	    testStatus = tu.checkEq( pact.Verb, "confirm",                       testStatus, "PAct Verb"); 
	    testStatus = tu.checkEq( hasRaw,  true,                              testStatus, "PAct Raw match" ); 
	    testStatus = tu.checkEq( pact.Ingested, "false",                     testStatus, "PAct ingested" );
	    foundPActs++;
	}
    }
    testStatus = tu.checkEq( foundPActs, 3 ,           testStatus, "Matched PActs with PEQs" );

    // Check DYNAMO RepoStatus
    let pop = await utils.checkPopulated( installClient[1], td.GHFullName );
    testStatus = tu.checkEq( pop, "true", testStatus, "Repo status wrt populated" );
    

    // Check GITHUB Labels
    let peqLabels = await tu.getPeqLabels( installClient, td );
    testStatus = tu.checkGE( peqLabels.length, 3,   testStatus, "Peq Label count" );
    let foundLabs = 0;
    for( label of peqLabels ) {
	if( gh.parseLabelDescr( [label.description] ) == 1000000 ) {
	    testStatus = tu.checkEq( label.description.includes( "Allocation" ), true, testStatus, "Peq label descr" );
	    foundLabs++;
	}
	else if( gh.parseLabelDescr( [label.description] ) == 1500000 ) { foundLabs++; }
	else if( gh.parseLabelDescr( [label.description] ) == 3000000 ) { foundLabs++; }
    }
    testStatus = tu.checkEq( foundLabs, 3,   testStatus, "Peq Label matching peq amounts" );

    
    // check issues
    // check proj count, cols per

    
    tu.testReport( testStatus, "Create preferred CE Projects" );
}


// XXX Waiting for things to settle
//     this does have some merit - CE is built for human hands, and hands + native github delay means human
//     operations are far slower than the test execution above.  However, this is still pretty darned slow ATM

async function runTests() {
    console.log( "Testing" );
    let td = new testData.TestData();
    td.GHOwner      = config.TEST_OWNER;
    td.GHRepo       = config.TEST_REPO;
    td.GHFullName   = td.GHOwner + "/" + td.GHRepo;

    // installClient is pair [installationAccessToken, creationSource]
    let token = await auth.getInstallationClient( td.GHOwner, td.GHRepo, td.GHOwner );
    let source = "<TEST: Setup> ";
    let installClient = [token, source];

    console.log( "Preferred CE project structure =================" );
    // await createPreferredCEProjects( installClient, td );
    // await utils.sleep( 15000 );
    await testPreferredCEProjects( installClient, td );

    // createFlatProjects();

    // test add, delete, close, reopen, assign, etc.

    // retest


}

runTests();
