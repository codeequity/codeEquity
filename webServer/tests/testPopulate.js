var utils = require('../utils');
var config  = require('../config');
var ghUtils = require('../ghUtils');
var gh = ghUtils.githubUtils;

const testData = require( './testData' );
const tu = require('./testUtils');

const ISS_NEWBIE   = "A newborn issue";
const ISS_SINREC   = "A singly-carded issue";
const ISS_DUBREC   = "A doubly-carded issue";
const ISS_TRIPREC  = "A triply-carded issue";
const ISS_SINFLAT  = "single in Flatworld";
const ISS_DUBMIX   = "doubly in Flat-Recommended mix";


async function makePrePopulateData( installClient, td ) {
    console.log( "Setting up for populate test" );

    await tu.refreshRec( installClient, td );
    await tu.refreshFlat( installClient, td );

    // !!!!!!!!!!!
    // NOTE: you must TURN OFF ceServer to construct this test.
    // !!!!!!!!!!!

    // This is for a recommended project structure
    let nbi0 = await gh.createIssue( installClient, td.GHOwner, td.GHRepo, ISS_NEWBIE, [], false );
    
    let nbi1   = await gh.createIssue( installClient, td.GHOwner, td.GHRepo, ISS_SINREC, [], false );
    let card11 = await gh.createProjectCard( installClient, td.scColID, nbi1[0] );
	
    let nbi2   = await gh.createIssue( installClient, td.GHOwner, td.GHRepo, ISS_DUBREC, [], false );
    let card21 = await gh.createProjectCard( installClient, td.boColID, nbi2[0] );
    let card22 = await gh.createProjectCard( installClient, td.dsPlanID, nbi2[0] );

    // GH allows multiple same-title cards per project.  But only 1 issue-card per project.
    let nbi3   = await gh.createIssue( installClient, td.GHOwner, td.GHRepo, ISS_TRIPREC, [], false );
    let card31 = await gh.createProjectCard( installClient, td.scColID, nbi3[0] );
    let card32 = await gh.createProjectCard( installClient, td.dsPlanID, nbi3[0] );
    let card33 = await gh.createProjectCard( installClient, td.ghProgID, nbi3[0] );
    
    // Now add a flat project structure in
    let nbi4   = await gh.createIssue( installClient, td.GHOwner, td.GHRepo, ISS_SINFLAT, [], false );
    let card41 = await gh.createProjectCard( installClient, td.col1ID, nbi4[0] );
	
    let nbi5   = await gh.createIssue( installClient, td.GHOwner, td.GHRepo, ISS_DUBMIX, [], false );
    let card51 = await gh.createProjectCard( installClient, td.col2ID, nbi5[0] );
    let card52 = await gh.createProjectCard( installClient, td.dsPlanID, nbi5[0] );
}

async function testPopulate( installClient, td ) {

    // !!!!!!!!!!!
    // NOTE: you must TURN ON ceServer to run this test.
    // !!!!!!!!!!!

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    await tu.refreshRec( installClient, td );
    await tu.refreshFlat( installClient, td );


    /*
    // TRIGGER
    // Unset 'populated' flag
    await tu.setUnpopulated( installClient, td );

    // peq-label the single - easier version of populate
    // let newLabel    = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );
    // let singleIssue = await tu.findIssue( installClient, td, ISS_SINREC );
    // await tu.addLabel( installClient, td, singleIssue.number, newLabel );       // ready.. set... Go!

    // peq-label the double-split 
    let newLabel    = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );
    let tripleIssue = await tu.findIssue( installClient, td, ISS_TRIPREC );
    await tu.addLabel( installClient, td, tripleIssue.number, newLabel );       // ready.. set... Go!    

    await utils.sleep( 35000 );
    */

    // XXX Need to catch at least two errors here, then fix.
    // 1) peq has 1 entry, 1k only.
    // 2) gh trip has 1@1k, 2@333
    
    // CHECK RESULTS

    td.show();
    // Check GITHUB issues  
    let allNames = [ ISS_NEWBIE, ISS_SINREC, ISS_DUBREC, ISS_TRIPREC, ISS_SINFLAT, ISS_DUBMIX ]; 
    let issues = await tu.getIssues( installClient, td );
    
    let tripIssues = [];
    let counts = [0,0,0,0,0,0];
    for( let i = 0; i < allNames.length; i++ ) {
	for( const issue of issues ) {
	    if( issue.title.includes( allNames[i] ) ) {
		if( allNames[i] == ISS_TRIPREC ) {
		    tripIssues.push( issue );
		    testStatus = tu.checkEq( issue.labels[0].name, "333 PEQ", testStatus, "Bad issue label" );
		}
		else {
		    testStatus = tu.checkEq( issue.labels.length, 0, testStatus, "Should not have issue label here" );
		}
		counts[i]++;
	    }
	}
    }
    testStatus = tu.checkEq( counts.toString(), [1, 1, 2, 3, 1, 2].toString(), testStatus, "Issue count is off" );

    
    // Check GITHUB card distribution
    let softContCards = await tu.getCards( installClient, td.scColID );
    let busOpsCards   = await tu.getCards( installClient, td.boColID );
    let dsPlanCards   = await tu.getCards( installClient, td.dsPlanID );
    let ghProgCards   = await tu.getCards( installClient, td.ghProgID );
    let eggCards      = await tu.getCards( installClient, td.col1ID );
    let baconCards    = await tu.getCards( installClient, td.col2ID );


/*




    
    
    // Check DYNAMO PEQ
    for( const name of [ ISS_NEWBIE, ISS_SINREC, ISS_DUBREC, ISS_SINFLAT, ISS_DUBMIX ] ) {
	let peqs = await utils.getPeqs( installClient[1], { "GHRepo": td.GHFullName, "GHIssueTitle": name });
	testStatus = tu.checkEq( peqs.length, 0,   testStatus, "Bad peq created" );
    }
    
    // XXX nope..  just 1, others have rand bob
    let peqs =  await utils.getPeqs( installClient[1], { "GHRepo": td.GHFullName, "GHIssueTitle": PEQ_ISSUE });
    testStatus = tu.checkEq( peqs.length, 3,   testStatus, "Peq issues count" );

    for( i = 0; i < 3; i++ ) { testStatus = tu.checkEq( peqs[i].Amount, 333,     testStatus, "Peq Amount" ); }
    for( i = 0; i < 3; i++ ) { testStatus = tu.checkEq( peqs[i].PeqType, "plan", testStatus, "Peq Amount" ); }


    testStatus = tu.checkAr( ghPeqs[0].GHProjectSub, [td.softContTitle], testStatus, "Project sub" );
    testStatus = tu.checkEq( ghPeqs[0].GHProjectId, td.masterPID,        testStatus, "Project ID" );  
    

    
    // Check DYNAMO PAct
    // Check DYNAMO RepoStatus


    // Check DYNAMO linkage

*/
    
    tu.testReport( testStatus, "Create preferred CE Projects" );
}


async function runTests( installClient ) {

    let td = new testData.TestData();
    td.GHOwner      = config.TEST_OWNER;
    td.GHRepo       = config.TEST_REPO;
    td.GHFullName   = td.GHOwner + "/" + td.GHRepo;

    console.log( "Populate - add a repo to CE =================" );

    // TURN OFF ceServer
    // await makePrePopulateData( installClient, td );

    // TURN ON ceServer
    await testPopulate( installClient, td );

}


exports.runTests = runTests;
