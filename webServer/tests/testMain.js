const auth = require( "../auth");
var config  = require('../config');

const testSetup = require( './testSetup' );
const testFlat = require( './testFlat' );
const testPopulate = require( './testPopulate' );
const testBasicFlow = require( './testBasicFlow' );
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

    // await testFlat.runTests( installClient, td );

    // Have already populated in setup, but will re-pop here.  No harm.
    // NOTE: you must TURN OFF ceServer to construct part of this test, and turn it back on to execute it.
    // XXX should break this into setup/test
    // await testPopulate.runTests( installClient, td );

    await testBasicFlow.runTests( installClient, td );
    
    
    // test add, peq, then add new card to peq issue.  unclaimed.  split issue with assignees?
    
    // test standard add, move, close, reopen, accrue

    // label, unlabel, label

    // add assignees, assignee

    
    
}


runTests();
