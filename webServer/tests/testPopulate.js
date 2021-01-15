var assert = require('assert');
var utils = require('../utils');
var config  = require('../config');

var ghUtils = require('../ghUtils');
var gh      = ghUtils.githubUtils;
var ghSafe  = ghUtils.githubSafe;

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
    let nbi0 = await ghSafe.createIssue( installClient, td.GHOwner, td.GHRepo, ISS_NEWBIE, [], false );
    
    let nbi1   = await ghSafe.createIssue( installClient, td.GHOwner, td.GHRepo, ISS_SINREC, [], false );
    let card11 = await ghSafe.createProjectCard( installClient, td.scColID, nbi1[0] );
	
    let nbi2   = await ghSafe.createIssue( installClient, td.GHOwner, td.GHRepo, ISS_DUBREC, [], false );
    let card21 = await ghSafe.createProjectCard( installClient, td.boColID, nbi2[0] );
    let card22 = await ghSafe.createProjectCard( installClient, td.dsPlanID, nbi2[0] );

    // GH allows multiple same-title cards per project.  But only 1 issue-card per project.
    let nbi3   = await ghSafe.createIssue( installClient, td.GHOwner, td.GHRepo, ISS_TRIPREC, [], false );
    let card31 = await ghSafe.createProjectCard( installClient, td.scColID, nbi3[0] );
    let card32 = await ghSafe.createProjectCard( installClient, td.dsPlanID, nbi3[0] );
    let card33 = await ghSafe.createProjectCard( installClient, td.ghProgID, nbi3[0] );
    
    // Now add a flat project structure in
    let nbi4   = await ghSafe.createIssue( installClient, td.GHOwner, td.GHRepo, ISS_SINFLAT, [], false );
    let card41 = await ghSafe.createProjectCard( installClient, td.col1ID, nbi4[0] );
	
    let nbi5   = await ghSafe.createIssue( installClient, td.GHOwner, td.GHRepo, ISS_DUBMIX, [], false );
    let card51 = await ghSafe.createProjectCard( installClient, td.col2ID, nbi5[0] );
    let card52 = await ghSafe.createProjectCard( installClient, td.dsPlanID, nbi5[0] );
}

async function testPopulate( installClient, td ) {

    // !!!!!!!!!!!
    // NOTE: you must TURN ON ceServer to run this test.
    // !!!!!!!!!!!

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    await tu.refreshRec( installClient, td );
    await tu.refreshFlat( installClient, td );

    // TRIGGER
    // Unset 'populated' flag
    await tu.setUnpopulated( installClient, td );

    let popLabel    = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, config.POPULATE, -1 );
    let singleIssue = await tu.findIssueByName( installClient, td, ISS_SINREC );
    await tu.addLabel( installClient, td, singleIssue.number, popLabel.name );       // ready.. set... Go!

    await utils.sleep( 15000 );


    // CHECK RESULTS
    td.show();


    // Check GITHUB issues & labels
    let allNames = [ ISS_NEWBIE, ISS_SINREC, ISS_DUBREC, ISS_TRIPREC, ISS_SINFLAT, ISS_DUBMIX ]; 
    let issues = await tu.getIssues( installClient, td );
    
    let counts = [0,0,0,0,0,0];
    for( let i = 0; i < allNames.length; i++ ) {
	for( const issue of issues ) {
	    if( issue.title.includes( allNames[i] ) ) {
		if( allNames[i] == ISS_SINREC ) {
		    testStatus = tu.checkEq( issue.labels[0].name, "populate", testStatus, "Bad issue label" );
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
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });
    for( const name of allNames ) {
	let fpeqs = peqs.filter((peq) => peq.GHIssueTitle.includes( name ));
	testStatus = tu.checkEq( fpeqs.length, 0,   testStatus, "Bad peq created" );
    }


    // XXX test setup runs this portion - not top of the list to implement
    // Check DYNAMO PAct
    // Check DYNAMO RepoStatus
    // Check DYNAMO linkage

    tu.testReport( testStatus, "Create preferred CE Projects" );
}

async function testResolve( installClient, ghLinks, td ) {

    // !!!!!!!!!!!
    // NOTE: you must TURN ON ceServer to run this test.
    // !!!!!!!!!!!

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Resolve, as part of populate" );

    await tu.refreshRec( installClient, td );
    await tu.refreshFlat( installClient, td );


    // XXX try adding assignees
    // First add a few normal labels
    // At the start, will have 3 triprecs, non are peq
    let tripleIssue = await tu.findIssue( installClient, td, ISS_TRIPREC );
    await tu.addLabel( installClient, td, tripleIssue.number, "bug" );       
    await tu.addLabel( installClient, td, tripleIssue.number, "enhancement" );       

    // Add a peq label
    let newLabel = await gh.findOrCreateLabel( installClient, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );

    // Trigger resolve by adding a new card.  Note - do not catch the return here, as it will be resolved away.
    // NOTE: no sleep?  Perfectly bad notification interleaving can mean both issue and card PNP see an issue to split.
    // Note: what happens if label & column added by hand at the same time?  
    //       triage.  Adds a (bigger than this) delay.
    // Note: test setup has 2 random delays.  1: local -> gh rest time.  2: gh -> local.   by-hand has 1.
    console.log( "Send add label" );
    await tu.addLabel( installClient, td, tripleIssue.number, newLabel.name );       

    console.log( "Send create card" );
    await ghSafe.createProjectCard( installClient, td.dsPlanID, tripleIssue.id, false );  // ready.. set... Go!

    await utils.sleep( 10000 );

    
    // CHECK RESULTS
    td.show();

    // Check GITHUB issues & labels
    let allNames = [ ISS_NEWBIE, ISS_SINREC, ISS_DUBREC, ISS_TRIPREC, ISS_SINFLAT, ISS_DUBMIX ]; 
    let issues = await tu.getIssues( installClient, td );


    let tripIssues = [];
    let othIssues  = [];
    let counts = [0,0,0,0,0,0];
    let labCount = 0;
    for( let i = 0; i < allNames.length; i++ ) {
	for( const issue of issues ) {
	    if( issue.title.includes( allNames[i] ) ) {
		if( allNames[i] == ISS_TRIPREC && issue.labels.length > 0 ) {
		    labCount++;
		    tripIssues.push( issue );
		    testStatus = tu.checkEq( issue.labels[0].name, "500 PEQ", testStatus, "Bad issue label" );
		}
		else if( allNames[i] == ISS_SINREC ) {
		    othIssues.push( issue );
		    testStatus = tu.checkEq( issue.labels[0].name, "populate", testStatus, "Bad issue label" );
		}
		else {
		    othIssues.push( issue );
		    testStatus = tu.checkEq( issue.labels.length, 0, testStatus, "Should not have issue label here" );
		}
		counts[i]++;
	    }
	}
    }
    testStatus = tu.checkEq( labCount, 2,                                      testStatus, "Issue count is off" );
    testStatus = tu.checkEq( counts.toString(), [1, 1, 2, 4, 1, 2].toString(), testStatus, "Issue count is off" );

    
    // Check trip GITHUB card distribution
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

    testStatus = tu.checkEq( softContTitles.reduce( tu.makeTitleReducer( ISS_TRIPREC), false ), true, testStatus, "Trip rec" );
    testStatus = tu.checkEq( busOpsTitles.reduce(   tu.makeTitleReducer( ISS_TRIPREC), false ), false, testStatus, "Trip rec" );
    testStatus = tu.checkEq( dsPlanTitles.reduce(   tu.makeTitleReducer( ISS_TRIPREC), false ), true, testStatus, "Trip rec" );
    testStatus = tu.checkEq( ghProgTitles.reduce(   tu.makeTitleReducer( ISS_TRIPREC), false ), true, testStatus, "Trip rec" );
    testStatus = tu.checkEq( eggTitles.reduce(      tu.makeTitleReducer( ISS_TRIPREC), false ), false, testStatus, "Trip rec" );
    testStatus = tu.checkEq( baconTitles.reduce(    tu.makeTitleReducer( ISS_TRIPREC), false ), false, testStatus, "Trip rec" );


    // Check DYNAMO PEQ
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });

    for( const name of [ ISS_NEWBIE, ISS_SINREC, ISS_DUBREC, ISS_SINFLAT, ISS_DUBMIX ] ) {
	let fpeqs = peqs.filter((peq) => peq.GHIssueTitle.includes( name ));
	testStatus = tu.checkEq( fpeqs.length, 0,   testStatus, "Bad peq created" );
    }

    let tpeqs = peqs.filter((peq) => peq.GHIssueTitle.includes( ISS_TRIPREC ) );
    testStatus = tu.checkEq( tpeqs.length, 2,   testStatus, "Peq issues count" );
    assert( tpeqs.length == 2 );
    
    for( let i = 0; i < 2; i++ ) { testStatus = tu.checkEq( tpeqs[i].Amount, 500,           testStatus, "Peq Amount" ); }
    for( let i = 0; i < 2; i++ ) { testStatus = tu.checkEq( tpeqs[i].PeqType, "plan",       testStatus, "Peq Type" ); }
    for( let i = 0; i < 2; i++ ) { testStatus = tu.checkEq( tpeqs[i].Active, "true",        testStatus, "Peq Active" ); }
    for( let i = 0; i < 2; i++ ) { testStatus = tu.checkEq( tpeqs[i].CEHolderId.length, 0,  testStatus, "Peq ce holder ids" ); }
    for( let i = 0; i < 2; i++ ) { testStatus = tu.checkEq( tpeqs[i].GHHolderId.length, 0,  testStatus, "Peq gh holder ids" ); }
    let foundPeq = 0;
    // tpeqs is from dynamo.  ghdata below is from GH
    for( let i = 0; i < 2; i++ ) {
	console.log( tpeqs[i].GHProjectId, td.masterPID.toString(), tpeqs[i].GHHolderId );
	if( tpeqs[i].GHProjectId == td.masterPID.toString()) {
	    foundPeq++;
	    testStatus = tu.checkEq( tpeqs[i].GHProjectSub.length, 1,                            testStatus, "Project Sub" );
	    testStatus = tu.checkEq( tpeqs[i].GHProjectSub.includes(td.softContTitle ), true,    testStatus, "Project Sub" );
	    let ghdata = softContData.filter((datum) => datum[3] == tpeqs[i].GHIssueTitle);
	    console.log( "mas", ghdata[0][2], tpeqs[i].GHIssueId );
	    testStatus = tu.checkEq( ghdata[0][2], tpeqs[i].GHIssueId,                           testStatus, "Issue Id/title mismatch" );
	}
	else if( tpeqs[i].GHProjectId == td.dataSecPID.toString()) {
	    foundPeq++;
	    testStatus = tu.checkEq( tpeqs[i].GHProjectSub.length, 2,                            testStatus, "Project Sub" );
	    testStatus = tu.checkEq( tpeqs[i].GHProjectSub[0].includes(td.softContTitle ), true, testStatus, "Project Sub" );
	    testStatus = tu.checkEq( tpeqs[i].GHProjectSub[1].includes(td.dataSecTitle ), true,  testStatus, "Project Sub" );
	    let ghdata = dsPlanData.filter((datum) => datum[3] == tpeqs[i].GHIssueTitle);
	    console.log( "ds", ghdata[0][2], tpeqs[i].GHIssueId );
	    testStatus = tu.checkEq( ghdata[0][2], tpeqs[i].GHIssueId,                           testStatus, "Issue Id/title mismatch" );
	}
    }
    testStatus = tu.checkEq( foundPeq, 2, testStatus, "Missing trip rec peq" ); 


    // Check DYNAMO PAct
    let pacts = await utils.getPActs( installClient, {"GHRepo": td.GHFullName} );
    let masPeq = tpeqs.filter((peq) => peq.GHProjectId == td.masterPID.toString() );
    let dsPeq  = tpeqs.filter((peq) => peq.GHProjectId == td.dataSecPID.toString() );
    testStatus = tu.checkGE( pacts.length, 3,         testStatus, "Number of PActs" );

    let f1 = 0;
    let f2 = 0;
    let f3 = 0;
    for( pact of pacts ) {
	if( pact.Subject[0] == masPeq[0].PEQId ) {
	    let hasRaw = await tu.hasRaw( installClient, pact.PEQActionId );
	    testStatus = tu.checkEq( pact.Verb, "confirm",                       testStatus, "PAct Verb"); 
	    testStatus = tu.checkEq( hasRaw, true,                               testStatus, "PAct Raw match" ); 
	    testStatus = tu.checkEq( pact.GHUserName, config.TESTER_BOT,         testStatus, "PAct user name" ); 
	    testStatus = tu.checkEq( pact.Ingested, "false",                     testStatus, "PAct ingested" );
	    testStatus = tu.checkEq( pact.Locked, "false",                       testStatus, "PAct locked" );
	    if     ( pact.Action == "add" )    { f1 = 1; }
	    else if( pact.Action == "change" ) { f2 = 1; }
	}
	else if( pact.Subject[0] == dsPeq[0].PEQId ) {
	    let hasRaw = await tu.hasRaw( installClient, pact.PEQActionId );
	    testStatus = tu.checkEq( pact.Verb, "confirm",                       testStatus, "PAct Verb"); 
	    testStatus = tu.checkEq( pact.Action, "add",                         testStatus, "PAct Action" ); 
	    testStatus = tu.checkEq( hasRaw, true,                               testStatus, "PAct Raw match" ); 
	    testStatus = tu.checkEq( pact.Locked, "false",                       testStatus, "PAct locked" );
	    testStatus = tu.checkEq( pact.Ingested, "false",                     testStatus, "PAct ingested" );
	    f3 = 1;
	}
    }
    testStatus = tu.checkEq( f1+f2+f3, 3, testStatus, "Matched PActs with PEQs" );


    // Check DYNAMO RepoStatus
    let pop = await utils.checkPopulated( installClient, td.GHFullName );
    testStatus = tu.checkEq( pop, "true", testStatus, "Repo status wrt populated" );


    // Check DYNAMO linkage
    // note.. newbie will not be here.. expect 10/11.
    let links = await tu.getLinks( installClient, ghLinks, { "repo": td.GHFullName } );
    testStatus = tu.checkGE( links.length, 10, testStatus, "Linkage count" );
    let tripPeqIds = tripIssues.map((iss) => iss.id.toString() );
    let othPeqIds  = othIssues.map((iss) => iss.id.toString() );

    let tf0 = 0;
    let tf1 = 0;
    let tf2 = 0;
    let plan = config.PROJ_COLS[ config.PROJ_PLAN ];
    let prog = config.PROJ_COLS[ config.PROJ_PROG ];
    let allGHData = softContData.concat( busOpsData ).concat( dsPlanData ).concat( ghProgData ).concat( eggData ).concat( baconData );
    let lcounts = [0,0,0,0];
    for( const link of links ) {
	if( tripPeqIds.includes( link.GHIssueId )) {
	    let ghData = {};
	    if( link.GHProjectId == td.masterPID.toString() ) {
		tf0 = 1;
		ghData = ( softContData.filter((dat) => dat[2].toString() == link.GHIssueId ))[0];
		
		testStatus = tu.checkEq( link.GHIssueNum, ghData[1].toString(),  testStatus, "Linkage Issue num" );
		testStatus = tu.checkEq( link.GHCardId, ghData[0].toString(),    testStatus, "Linkage Card Id" );
		testStatus = tu.checkEq( link.GHColumnName, td.softContTitle,    testStatus, "Linkage Col name" );
		testStatus = tu.checkEq( link.GHCardTitle, ghData[3],            testStatus, "Linkage Card Title" );
		testStatus = tu.checkEq( link.GHProjectName, config.MAIN_PROJ,   testStatus, "Linkage Project Title" );
		testStatus = tu.checkEq( link.GHColumnId, td.scColID.toString(), testStatus, "Linkage Col Id" );
	    }
	    else if( link.GHProjectId == td.dataSecPID.toString() ) {
		tf1 = 1;
		ghData = ( dsPlanData.filter((dat) => dat[2].toString() == link.GHIssueId ))[0];

		testStatus = tu.checkEq( link.GHIssueNum, ghData[1].toString(),   testStatus, "Linkage Issue num" );
		testStatus = tu.checkEq( link.GHCardId, ghData[0].toString(),     testStatus, "Linkage Card Id" );
		testStatus = tu.checkEq( link.GHColumnName, plan,                 testStatus, "Linkage Col name" );
		testStatus = tu.checkEq( link.GHCardTitle, ghData[3],             testStatus, "Linkage Card Title" );
		testStatus = tu.checkEq( link.GHProjectName, td.dataSecTitle,     testStatus, "Linkage Project Title" );
		testStatus = tu.checkEq( link.GHColumnId, td.dsPlanID.toString(), testStatus, "Linkage Col Id" );
	    }
	}
	else if( othPeqIds.includes( link.GHIssueId )) {
	    tf2 += 1;
	    ghData = ( allGHData.filter((dat) => dat[2].toString() == link.GHIssueId ))[0];

	    if     ( link.GHProjectId == td.masterPID.toString() )    { lcounts[0]++; }
	    else if( link.GHProjectId == td.dataSecPID.toString() )   { lcounts[1]++; }
	    else if( link.GHProjectId == td.githubOpsPID.toString() ) { lcounts[2]++; }
	    else if( link.GHProjectId == td.flatPID.toString() )      { lcounts[3]++; }
	    
	    testStatus = tu.checkEq( link.GHIssueNum, ghData[1].toString(), testStatus, "Linkage Issue num" );
	    testStatus = tu.checkEq( link.GHCardId, ghData[0].toString(),   testStatus, "Linkage Card Id" );

	    testStatus = tu.checkEq( link.GHColumnName, config.EMPTY,       testStatus, "Linkage Col name" );
	    testStatus = tu.checkEq( link.GHCardTitle, config.EMPTY,        testStatus, "Linkage Card Title" );
	    testStatus = tu.checkEq( link.GHProjectName, config.EMPTY,      testStatus, "Linkage Project Title" );
	    testStatus = tu.checkEq( link.GHColumnId, -1,                   testStatus, "Linkage Col Id" );
	}

    }
    testStatus = tu.checkEq( tf0 + tf1 + tf2, 10,     testStatus, "Total linkage count" );
    testStatus = tu.checkEq( lcounts.toString(), "2,3,1,2",      testStatus, "Basic linkage Proj id counts" );
    // NOTE Pre-existing newbies may exist without cards/linkages.  No expectations here.
    // testStatus = tu.checkEq( foundNewbie, false, testStatus, "Newborn issue showing up in linkage" );

    tu.testReport( testStatus, "Test Resolve" );
}



async function runTests( installClient, ghLinks, td ) {

    console.log( "Populate - add a repo to CE =================" );

    // *** these two tests are siblings (below)
    // TURN OFF ceServer
    //await makePrePopulateData( installClient, td );
    
    // TURN ON ceServer
    // NOTE this test is flawed in concept, in that the current state of ceServer may already have
    //      PEQ issues, but populate assumes a binary none then some.  ghLinks.initOneRepo handles this flaw,
    //      but is slower than need be.
    // await testPopulate( installClient, td );
    // *** these two tests are siblings (above)

    // Normal - leave it on.  A separate resolve test, run only after above 2.
    await testResolve( installClient, ghLinks, td );

}


exports.runTests = runTests;
