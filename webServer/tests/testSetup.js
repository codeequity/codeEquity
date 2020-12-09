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
    // 

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
    let dsCardId = await tu.makeNewbornCard( installClient, mastCol1, "Data Security\n<allocation, PEQ: 1,000,000>" )
    let ghCardId = await tu.makeNewbornCard( installClient, mastCol1, "Github Operations\n<allocation, PEQ: 1,500,000>" )
    let usCardId = await tu.makeNewbornCard( installClient, mastCol1, "Unallocated\n<allocation, PEQ: 3,000,000>" )
    
    // busOps:  unallocated
    let ubCardId = await tu.makeNewbornCard( installClient, mastCol2, "Unallocated\n<allocation, PEQ: 1,000,000>" )


    // XXX peqs are doubled.. alloc + plan
    // Expectations
    // have alloc labels
    // check a few card / cols
    // check issues exist
    // dynamo: links, peqs, pacts
    
    
}


async function runTests() {
    console.log( "Testing" );
    let pd = new peqData.PeqData();
    pd.GHOwner      = config.TEST_OWNER;
    pd.GHRepo       = config.TEST_REPO;
    pd.GHFullName   = pd.GHOwner + "/" + pd.GHRepo;

    // installClient is pair [installationAccessToken, creationSource]
    let token = await auth.getInstallationClient( pd.GHOwner, pd.GHRepo );
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
