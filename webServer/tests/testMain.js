const auth = require( "../auth");
var config  = require('../config');

const testSetup = require( './testSetup' );
const testFlat = require( './testFlat' );
const testData = require( './testData' );


async function runTests() {

    let td = new testData.TestData();
    td.GHOwner      = config.TEST_OWNER;
    td.GHRepo       = config.TEST_REPO;
    td.GHFullName   = td.GHOwner + "/" + td.GHRepo;

    // installClient is pair [installationAccessToken, creationSource]
    let token = await auth.getInstallationClient( td.GHOwner, td.GHRepo, td.GHOwner );
    let source = "<TEST: Setup> ";
    let installClient = [token, source];
    
    // await testSetup.runTests( installClient, td );

    await testFlat.runTests( installClient, td );

    // testPopulate();
    // here, unset pop for structured.  add some issues/cards and run. for split.
    // do same for flat

    // test standard add, move, close, reopen, accrue

    // label, unlabel, label

    // add assignees, assignee

    
    
}


runTests();
