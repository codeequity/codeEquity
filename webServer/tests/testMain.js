const awsAuth = require( '../awsAuth' );
const auth = require( "../auth");
const utils = require( "../utils");
var config  = require('../config');

var links     = require('../components/linkage.js');

const testSetup = require( './testSetup' );
const testFlat = require( './testFlat' );
const testPopulate = require( './testPopulate' );
const testBasicFlow = require( './testBasicFlow' );
const testData = require( './testData' );


async function runTests() {

    // GH Linkage table
    // Note: this table is a router object - need to rest-get from ceServer.  It ages quickly - best practice is to update just before use.
    // let postData = {"Endpoint": "Testing", "Request": "getLinks" };
    // let linkData = await utils.postCE( "Grog", JSON.stringify( postData ));
    let ghLinks = new links.Linkage();
    // ghLinks.fromJson( linkData );
    
    let td = new testData.TestData();
    td.GHOwner      = config.TEST_OWNER;
    td.GHRepo       = config.TEST_REPO;
    td.GHFullName   = td.GHOwner + "/" + td.GHRepo;

    // installClient is quad [installationAccessToken, creationSource, apiPath, cognitoIdToken]
    let token = await auth.getInstallationClient( td.GHOwner, td.GHRepo, td.GHOwner );
    let source = "<TEST: Setup> ";
    let apiPath = utils.getAPIPath() + "/find";
    let idToken = await awsAuth.getCogIDToken();
    let installClient = [token, source, apiPath, idToken];

    /*
    await testSetup.runTests( installClient, ghLinks, td );
    await utils.sleep( 10000 );
    await testFlat.runTests( installClient, ghLinks, td );
    */

    // Have already populated in setup, but will re-pop here.  No harm.
    // NOTE: you must TURN OFF ceServer to construct part of this test, and turn it back on to execute it.
    // XXX should break this into setup/test
    // await testPopulate.runTests( installClient, ghLinks, td );

    await testBasicFlow.runTests( installClient, ghLinks, td );
    
    
    // test add, peq, then add new card to peq issue.  unclaimed.  split issue with assignees?
    
    // test standard add, move, close, reopen, accrue

    // label, unlabel, label

    // add assignees, assignee

    ghLinks.show();
    
}


runTests();
