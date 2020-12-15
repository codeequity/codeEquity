var assert = require('assert');
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


    // XXX REDO testSetup w/populate
    // XXX new populate mechanic.  create populate label.  add it to singly.

    // TRIGGER
    // Unset 'populated' flag
    await tu.setUnpopulated( installClient, td );

    let popLabel    = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, config.POPULATE, -1 );
    let singleIssue = await tu.findIssue( installClient, td, ISS_SINREC );
    await tu.addLabel( installClient, td, singleIssue.number, popLabel.name );       // ready.. set... Go!

    /*
    // peq-label the single - easier version of populate
    // let newLabel    = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );
    // let singleIssue = await tu.findIssue( installClient, td, ISS_SINREC );
    // await tu.addLabel( installClient, td, singleIssue.number, newLabel );       // ready.. set... Go!

    // First add a few normal labels    
    let tripleIssue = await tu.findIssue( installClient, td, ISS_TRIPREC );
    await tu.addLabel( installClient, td, tripleIssue.number, "bug" );       
    await tu.addLabel( installClient, td, tripleIssue.number, "enhancement" );       
    
    // peq-label the split
    let newLabel    = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );
    await tu.addLabel( installClient, td, tripleIssue.number, newLabel.name );       // ready.. set... Go!    
    */

    
    await utils.sleep( 35000 );


    // Test Resolve here.  Add a tripIss PEQ.  Add new card.  CHeck results.
    

    // CHECK RESULTS
    td.show();


    // Check GITHUB issues & labels
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

    let issueMap = tu.buildIssueMap( issues ); // {issue_num: {<issue>} }

    let softContData = softContCards.map((card) => tu.getQuad( card, issueMap ));   // [ cardId, issueNum, issueId, issueTitle]
    let busOpsData   = busOpsCards.map((card) => tu.getQuad( card, issueMap )); 
    let dsPlanData   = dsPlanCards.map((card) => tu.getQuad( card, issueMap )); 
    let ghProgData   = ghProgCards.map((card) => tu.getQuad( card, issueMap )); 
    let eggData      = eggCards.map((card) => tu.getQuad( card, issueMap )); 
    let baconData    = baconCards.map((card) => tu.getQuad( card, issueMap )); 

    let softContTitles = softContData.map((datum) => datum[3] );
    let busOpsTitles   = busOpsData.map((datum) => datum[3] );
    let dsPlanTitles   = dsPlanData.map((datum) => datum[3] );
    let ghProgTitles   = ghProgData.map((datum) => datum[3] );
    let eggTitles      = eggData.map((datum) => datum[3] );
    let baconTitles    = baconData.map((datum) => datum[3] );

    testStatus = tu.checkEq( softContTitles.reduce( tu.makeTitleReducer( ISS_SINREC), false ), true, testStatus, "Sin rec" );
    testStatus = tu.checkEq( busOpsTitles.reduce(   tu.makeTitleReducer( ISS_SINREC), false ), false, testStatus, "Sin rec" );
    testStatus = tu.checkEq( dsPlanTitles.reduce(   tu.makeTitleReducer( ISS_SINREC), false ), false, testStatus, "Sin rec" );
    testStatus = tu.checkEq( ghProgTitles.reduce(   tu.makeTitleReducer( ISS_SINREC), false ), false, testStatus, "Sin rec" );
    testStatus = tu.checkEq( eggTitles.reduce(      tu.makeTitleReducer( ISS_SINREC), false ), false, testStatus, "Sin rec" );
    testStatus = tu.checkEq( baconTitles.reduce(    tu.makeTitleReducer( ISS_SINREC), false ), false, testStatus, "Sin rec" );

    testStatus = tu.checkEq( softContTitles.reduce( tu.makeTitleReducer( ISS_DUBREC), false ), false, testStatus, "Dub rec" );
    testStatus = tu.checkEq( busOpsTitles.reduce(   tu.makeTitleReducer( ISS_DUBREC), false ), true, testStatus, "Dub rec" );
    testStatus = tu.checkEq( dsPlanTitles.reduce(   tu.makeTitleReducer( ISS_DUBREC), false ), true, testStatus, "Dub rec" );
    testStatus = tu.checkEq( ghProgTitles.reduce(   tu.makeTitleReducer( ISS_DUBREC), false ), false, testStatus, "Dub rec" );
    testStatus = tu.checkEq( eggTitles.reduce(      tu.makeTitleReducer( ISS_DUBREC), false ), false, testStatus, "Dub rec" );
    testStatus = tu.checkEq( baconTitles.reduce(    tu.makeTitleReducer( ISS_DUBREC), false ), false, testStatus, "Dub rec" );

    testStatus = tu.checkEq( softContTitles.reduce( tu.makeTitleReducer( ISS_TRIPREC), false ), true, testStatus, "Trip rec" );
    testStatus = tu.checkEq( busOpsTitles.reduce(   tu.makeTitleReducer( ISS_TRIPREC), false ), false, testStatus, "Trip rec" );
    testStatus = tu.checkEq( dsPlanTitles.reduce(   tu.makeTitleReducer( ISS_TRIPREC), false ), true, testStatus, "Trip rec" );
    testStatus = tu.checkEq( ghProgTitles.reduce(   tu.makeTitleReducer( ISS_TRIPREC), false ), true, testStatus, "Trip rec" );
    testStatus = tu.checkEq( eggTitles.reduce(      tu.makeTitleReducer( ISS_TRIPREC), false ), false, testStatus, "Trip rec" );
    testStatus = tu.checkEq( baconTitles.reduce(    tu.makeTitleReducer( ISS_TRIPREC), false ), false, testStatus, "Trip rec" );

    testStatus = tu.checkEq( softContTitles.reduce( tu.makeTitleReducer( ISS_SINFLAT), false ), false, testStatus, "Sin Flat" );
    testStatus = tu.checkEq( busOpsTitles.reduce(   tu.makeTitleReducer( ISS_SINFLAT), false ), false, testStatus, "Sin Flat" );
    testStatus = tu.checkEq( dsPlanTitles.reduce(   tu.makeTitleReducer( ISS_SINFLAT), false ), false, testStatus, "Sin Flat" );
    testStatus = tu.checkEq( ghProgTitles.reduce(   tu.makeTitleReducer( ISS_SINFLAT), false ), false, testStatus, "Sin Flat" );
    testStatus = tu.checkEq( eggTitles.reduce(      tu.makeTitleReducer( ISS_SINFLAT), false ), true, testStatus, "Sin Flat" );
    testStatus = tu.checkEq( baconTitles.reduce(    tu.makeTitleReducer( ISS_SINFLAT), false ), false, testStatus, "Sin Flat" );
    
    testStatus = tu.checkEq( softContTitles.reduce( tu.makeTitleReducer( ISS_DUBMIX), false ), false, testStatus, "Dub Mix" );
    testStatus = tu.checkEq( busOpsTitles.reduce(   tu.makeTitleReducer( ISS_DUBMIX), false ), false, testStatus, "Dub Mix" );
    testStatus = tu.checkEq( dsPlanTitles.reduce(   tu.makeTitleReducer( ISS_DUBMIX), false ), true, testStatus, "Dub Mix" );
    testStatus = tu.checkEq( ghProgTitles.reduce(   tu.makeTitleReducer( ISS_DUBMIX), false ), false, testStatus, "Dub Mix" );
    testStatus = tu.checkEq( eggTitles.reduce(      tu.makeTitleReducer( ISS_DUBMIX), false ), false, testStatus, "Dub Mix" );
    testStatus = tu.checkEq( baconTitles.reduce(    tu.makeTitleReducer( ISS_DUBMIX), false ), true, testStatus, "Dub Mix" );

    
    // Check DYNAMO PEQ
    let peqs =  await utils.getPeqs( installClient[1], { "GHRepo": td.GHFullName });
    for( const name of [ ISS_NEWBIE, ISS_SINREC, ISS_DUBREC, ISS_SINFLAT, ISS_DUBMIX ] ) {
	let fpeqs = peqs.filter((peq) => peq.GHIssueTitle.includes( name ));
	testStatus = tu.checkEq( fpeqs.length, 0,   testStatus, "Bad peq created" );
    }

    let tpeqs = peqs.filter((peq) => peq.GHIssueTitle.includes( ISS_TRIPREC ) );
    testStatus = tu.checkEq( tpeqs.length, 3,   testStatus, "Peq issues count" );
    // no point to go on if this is false
    assert( tpeqs.length == 3 );
    
    for( let i = 0; i < 3; i++ ) { testStatus = tu.checkEq( tpeqs[i].Amount, 333,           testStatus, "Peq Amount" ); }
    for( let i = 0; i < 3; i++ ) { testStatus = tu.checkEq( tpeqs[i].PeqType, "plan",       testStatus, "Peq Type" ); }
    for( let i = 0; i < 3; i++ ) { testStatus = tu.checkEq( tpeqs[i].Active, "true",        testStatus, "Peq Active" ); }
    for( let i = 0; i < 3; i++ ) { testStatus = tu.checkEq( tpeqs[i].CEHolderId.length, 0,  testStatus, "Peq ce holder ids" ); }
    for( let i = 0; i < 3; i++ ) { testStatus = tu.checkEq( tpeqs[i].GHHolderId.length, 0,  testStatus, "Peq gh holder ids" ); }
    let foundPeq = 0;
    // tpeqs is from dynamo.  ghdata below is from GH
    for( let i = 0; i < 3; i++ ) {
	console.log( tpeqs[i].GHProjectId, td.masterPID.toString(), tpeqs[i].GHHolderId );
	if( tpeqs[i].GHProjectId == td.masterPID.toString()) {
	    foundPeq++;
	    testStatus = tu.checkEq( tpeqs[i].GHProjectSub.length, 1,                            testStatus, "Project Sub" );
	    testStatus = tu.checkEq( tpeqs[i].GHProjectSub.includes(td.softContTitle ), true,    testStatus, "Project Sub" );
	    let ghdata = softContData.filter((datum) => datum[3] == tpeqs[i].GHIssueTitle);
	    testStatus = tu.checkEq( ghdata[0][2], tpeqs[i].GHIssueId,                           testStatus, "Issue Id/title mismatch" );
	}
	else if( tpeqs[i].GHProjectId == td.dataSecPID.toString()) {
	    foundPeq++;
	    testStatus = tu.checkEq( tpeqs[i].GHProjectSub.length, 2,                            testStatus, "Project Sub" );
	    testStatus = tu.checkEq( tpeqs[i].GHProjectSub[1].includes(td.dataSecTitle ), true,  testStatus, "Project Sub" );
	    let ghdata = dsPlanData.filter((datum) => datum[3] == tpeqs[i].GHIssueTitle);
	    testStatus = tu.checkEq( ghdata[0][2], tpeqs[i].GHIssueId,                           testStatus, "Issue Id/title mismatch" );
	}
	else if( tpeqs[i].GHProjectId == td.githubOpsPID.toString()) {
	    foundPeq++;
	    testStatus = tu.checkEq( tpeqs[i].GHProjectSub.length, 2,                             testStatus, "Project Sub" );
	    testStatus = tu.checkEq( tpeqs[i].GHProjectSub[1].includes(td.githubOpsTitle ), true, testStatus, "Project Sub" );
	    let ghdata = ghProgData.filter((datum) => datum[3] == tpeqs[i].GHIssueTitle);
	    testStatus = tu.checkEq( ghdata[0][2], tpeqs[i].GHIssueId,                            testStatus, "Issue Id/title mismatch" );
	}
    }
    testStatus = tu.checkEq( foundPeq, 3, testStatus, "Missing trip rec peq" ); 
    
    // Check DYNAMO PAct
    // Check DYNAMO RepoStatus


    // Check DYNAMO linkage


    
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
