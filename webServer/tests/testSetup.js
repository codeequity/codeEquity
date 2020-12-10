const auth = require( "../auth");
var utils = require('../utils');
var ghUtils = require('../ghUtils');
var config  = require('../config');
var assert = require('assert');
const peqData = require( '../peqData' );
const tu = require('./testUtils');

var gh = ghUtils.githubUtils;





async function createPreferredCEProjects( installClient, pd ) {
    console.log( "Building preferred CE project layout, a mini version" );

    // XXX  find or create first peq label. add newborn issue, then label it.  Trigger populate and wait.
    // Create 1000peq
    // create issue with label.
    // wait.
    // remove unclaimedproj, issue, label. ... or leave it alone..


    // ============ Build structure
    
    let githubOpsTitle   = "Github Operations";
    let unallocatedTitle = "Unallocated";
    let dataSecTitle     = "Data Security";

    // Master: softwareContr, businessOps, unallocated
    let masterPID = await tu.makeProject( installClient, pd, config.MAIN_PROJ, "Overall planned equity allocations, by category" );
    let mastCol1  = await tu.makeColumn( installClient, masterPID, "Software Contributions" );
    let mastCol2  = await tu.makeColumn( installClient, masterPID, "Business Operations" );
    let mastCol3  = await tu.makeColumn( installClient, masterPID, "Unallocated" );

    // dataSec: 4x
    let dataPID  = await tu.makeProject( installClient, pd, "Data Security", "Make PII safe" );
    let dataCols = await tu.make4xCols( installClient, dataPID );

    // githubOPs: 4x
    let ghOpPID  = await tu.makeProject( installClient, pd, "Github Operations", "Make it giddy" );
    let ghOpCols = await tu.make4xCols( installClient, ghOpPID );
    
    // softCont: dataSecurity, githubOps, unallocated
    let dsCardId = await tu.makeAllocCard( installClient, mastCol1, dataSecTitle, "1,000,000" )

    // Just triggered populate.
    console.log( "Wait while populating.." );
    await utils.sleep( 15000 );
    console.log( "Done waiting." );
    
    let ghCardId = await tu.makeAllocCard( installClient, mastCol1, githubOpsTitle, "1,500,000" )
    let usCardId = await tu.makeAllocCard( installClient, mastCol1, unallocatedTitle, "3,000,000" )
    
    // busOps:  unallocated
    let ubCardId = await tu.makeAllocCard( installClient, mastCol2, "Unallocated", "1,000,000" )



    // Wait for things to settle
    // XXX Note, this does have some merit - CE is built for human hands, and hands + native github delay means human
    //     operations are far slower than the test execution above.  However, this is still pretty darned slow ATM
    console.log( "Waiting to allow settle" );
    await utils.sleep( 15000 );
    console.log( "Done waiting" );

    // ============ check results

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    // Check proper peq
    let ghPeqs =  await utils.getPeqs( installClient[1], { "GHRepo": pd.GHFullName, "GHIssueTitle": githubOpsTitle });
    assert( ghPeqs.length > 0 ); // total fail if this fails
    testStatus = tu.checkEq( ghPeqs.length, 1,                                   testStatus, "Number of githubOps peq objects" );
    testStatus = tu.checkEq( ghPeqs[0].PeqType, "allocation",                    testStatus, "PeqType" );
    testStatus = tu.checkAr( ghPeqs[0].GHProjectSub, ['Software Contributions'], testStatus, "Project sub" );
    testStatus = tu.checkEq( ghPeqs[0].GHProjectId, masterPID,                  testStatus, "Project ID" );  
    testStatus = tu.checkEq( ghPeqs[0].Amount, "1500000",                        testStatus, "Project ID" );  
    
    let dsPeqs =  await utils.getPeqs( installClient[1], { "GHRepo": pd.GHFullName, "GHIssueTitle": dataSecTitle });
    testStatus = tu.checkEq( dsPeqs.length, 1,                                   testStatus, "Number of datasec peq objects" );
    testStatus = tu.checkEq( dsPeqs[0].PeqType, "allocation",                    testStatus, "PeqType" );
    testStatus = tu.checkAr( dsPeqs[0].GHProjectSub, ['Software Contributions'], testStatus, "Project sub" );

    let unPeqs =  await utils.getPeqs( installClient[1], { "GHRepo": pd.GHFullName, "GHIssueTitle": unallocatedTitle });
    testStatus = tu.checkEq( unPeqs.length, 2,                                   testStatus, "Number of unalloc peq objects" );
    testStatus = tu.checkEq( unPeqs[0].PeqType, "allocation",                    testStatus, "PeqType" );

    let busTest = unPeqs[0].GHProjectSub.includes('Business Operations') || unPeqs[1].GHProjectSub.includes( 'Business Operations' );
    testStatus = tu.checkEq( busTest, true,                            testStatus, "Project subs for unalloc" );    

    
    
    // XXX peqs are doubled.. alloc + plan
    // Expectations
    // have alloc labels
    // check a few card / cols
    // check issues exist
    // dynamo: links, peqs, pacts
    
    tu.testReport( testStatus, "Create preferred CE Projects" );

}


async function runTests() {
    console.log( "Testing" );
    let pd = new peqData.PeqData();
    pd.GHOwner      = config.TEST_OWNER;
    pd.GHRepo       = config.TEST_REPO;
    pd.GHFullName   = pd.GHOwner + "/" + pd.GHRepo;

    // installClient is pair [installationAccessToken, creationSource]
    let token = await auth.getInstallationClient( pd.GHOwner, pd.GHRepo, pd.GHOwner );
    let source = "<TEST: Setup> ";
    let installClient = [token, source];

    await createPreferredCEProjects( installClient, pd );

    // test add, delete, close, reopen, assign, etc.

    // createFlatProjects();

    // retest

    /*
    let issueData = await( gh.createIssue( installClient, pd.GHOwner, pd.GHRepo, "Yo hands!", [], false ));
    console.log( issueData );

    if( issueData[0] > -1 ) { 
	let card = await( gh.createUnClaimedCard( installClient, pd.GHOwner, pd.GHRepo, issueData[0] ) );
	console.log( card );
    }
    */


}

runTests();
