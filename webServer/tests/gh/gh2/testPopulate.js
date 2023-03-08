var assert  = require( 'assert' );

var config  = require( '../../../config' );

const utils    = require( '../../../utils/ceUtils' );
const awsUtils = require( '../../../utils/awsUtils' );

const tu       = require( '../../ceTestUtils' );

const ghV2     = require( '../../../utils/gh/gh2/ghV2Utils' );

const testData = require( '../testData' );
const gh2tu    = require( './gh2TestUtils' );

const ISS_NEWBIE   = "A newborn issue";
const ISS_SINREC   = "A singly-carded issue";
const ISS_DUBREC   = "A doubly-carded issue";
const ISS_TRIPREC  = "A triply-carded issue";
const ISS_SINFLAT  = "single in Flatworld";
const ISS_DUBMIX   = "doubly in Flat-Recommended mix";


async function makePrePopulateData( authData, td ) {
    console.log( "Setting up for populate test" );

    await gh2tu.refreshRec( authData, td );
    await gh2tu.refreshFlat( authData, td );

    // !!!!!!!!!!!
    // NOTE: you must TURN OFF ceServer to construct this test.
    // !!!!!!!!!!!

    // This is for a recommended project structure
    let nbi0 = await ghSafe.createIssue( authData, td.GHOwner, td.GHRepo, ISS_NEWBIE, [], false );
    
    let nbi1   = await ghSafe.createIssue( authData, td.GHOwner, td.GHRepo, ISS_SINREC, [], false );
    let card11 = await ghSafe.createProjectCard( authData, td.scColID, nbi1[0] );
	
    let nbi2   = await ghSafe.createIssue( authData, td.GHOwner, td.GHRepo, ISS_DUBREC, [], false );
    let card21 = await ghSafe.createProjectCard( authData, td.boColID, nbi2[0] );
    let card22 = await ghSafe.createProjectCard( authData, td.dsPlanID, nbi2[0] );

    // GH allows multiple same-title cards per project.  But only 1 issue-card per project.
    let nbi3   = await ghSafe.createIssue( authData, td.GHOwner, td.GHRepo, ISS_TRIPREC, [], false );
    let card31 = await ghSafe.createProjectCard( authData, td.scColID, nbi3[0] );
    let card32 = await ghSafe.createProjectCard( authData, td.dsPlanID, nbi3[0] );
    let card33 = await ghSafe.createProjectCard( authData, td.ghProgID, nbi3[0] );
    
    // Now add a flat project structure in
    let nbi4   = await ghSafe.createIssue( authData, td.GHOwner, td.GHRepo, ISS_SINFLAT, [], false );
    let card41 = await ghSafe.createProjectCard( authData, td.col1ID, nbi4[0] );
	
    let nbi5   = await ghSafe.createIssue( authData, td.GHOwner, td.GHRepo, ISS_DUBMIX, [], false );
    let card51 = await ghSafe.createProjectCard( authData, td.col2ID, nbi5[0] );
    let card52 = await ghSafe.createProjectCard( authData, td.dsPlanID, nbi5[0] );
}

async function testPopulate( authData, td ) {

    // !!!!!!!!!!!
    // NOTE: you must TURN ON ceServer to run this test.
    // !!!!!!!!!!!

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    await gh2tu.refreshRec( authData, td );
    await gh2tu.refreshFlat( authData, td );

    // TRIGGER
    // Unset 'populated' flag
    await tu.setUnpopulated( authData, td );

    let popLabel    = await ghV2.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, config.POPULATE, -1 );
    let singleIssue = await gh2tu.findIssueByName( authData, td, ISS_SINREC );
    await gh2tu.addLabel( authData, td, [singleIssue.id, singleIssue.number, singleIssue.title], popLabel.name );       // ready.. set... Go!

    await utils.sleep( 15000 );


    // CHECK RESULTS
    td.show();


    // Check GITHUB issues & labels
    let allNames = [ ISS_NEWBIE, ISS_SINREC, ISS_DUBREC, ISS_TRIPREC, ISS_SINFLAT, ISS_DUBMIX ]; 
    let issues = await gh2tu.getIssues( authData, td );
    
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
    let softContCards = await gh2tu.getCards( authData, td.scColID );
    let busOpsCards   = await gh2tu.getCards( authData, td.boColID );
    let dsPlanCards   = await gh2tu.getCards( authData, td.dsPlanID );
    let ghProgCards   = await gh2tu.getCards( authData, td.ghProgID );
    let eggCards      = await gh2tu.getCards( authData, td.col1ID );
    let baconCards    = await gh2tu.getCards( authData, td.col2ID );

    let issueMap = tu.buildIssueMap( issues ); // {issue_num: {<issue>} }

    let softContData = softContCards.map((card) => gh2tu.getQuad( card, issueMap ));   // [ cardId, issueNum, issueId, issueTitle]
    let busOpsData   = busOpsCards.map((card) => gh2tu.getQuad( card, issueMap )); 
    let dsPlanData   = dsPlanCards.map((card) => gh2tu.getQuad( card, issueMap )); 
    let ghProgData   = ghProgCards.map((card) => gh2tu.getQuad( card, issueMap )); 
    let eggData      = eggCards.map((card) => gh2tu.getQuad( card, issueMap )); 
    let baconData    = baconCards.map((card) => gh2tu.getQuad( card, issueMap )); 

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
    let peqs =  await awsUtils.getPeqs( authData, { "CEProjectId": td.CEProjectId });
    for( const name of allNames ) {
	let fpeqs = peqs.filter((peq) => peq.HostIssueTitle.includes( name ));
	testStatus = tu.checkEq( fpeqs.length, 0,   testStatus, "Bad peq created" );
    }


    // test setup runs this portion - not top of the list to implement
    // Check DYNAMO PAct
    // Check DYNAMO RepoStatus
    // Check DYNAMO linkage

    tu.testReport( testStatus, "Create preferred CE Projects" );
}

async function testResolve( authData, ghLinks, td ) {

    // !!!!!!!!!!!
    // NOTE: you must TURN ON ceServer to run this test.
    // !!!!!!!!!!!

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Resolve, as part of populate" );

    await gh2tu.refreshRec( authData, td );
    await gh2tu.refreshFlat( authData, td );

    // First add a few normal labels
    // At the start, will have 3 triprecs, non are peq
    let tripleIssue = await gh2tu.findIssue( authData, td, ISS_TRIPREC );
    let tiDat = [tripleIssue.id, tripleIssue.number, tripleIssue.title];
    await gh2tu.addLabel( authData, td, tiDat, "bug" );       
    await gh2tu.addLabel( authData, td, tiDat, "enhancement" );       

    // Add a peq label
    let newLabel = await ghV2.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, "1000 " + config.PEQ_LABEL, 1000 );

    // Trigger resolve by adding a new card.  Note - do not catch the return here, as it will be resolved away.
    // NOTE: no sleep?  Perfectly bad notification interleaving can mean both issue and card PNP see an issue to split.
    // Note: what happens if label & column added by hand at the same time?  
    //       triage.  Adds a (bigger than this) delay.
    // Note: test setup has 2 random delays.  1: local -> gh rest time.  2: gh -> local.   by-hand has 1.
    console.log( "Send add label" );
    await gh2tu.addLabel( authData, td, tiDat, newLabel.name );       

    console.log( "Send create card" );
    await ghSafe.createProjectCard( authData, td.dsPlanID, tripleIssue.id, false );  // ready.. set... Go!

    await utils.sleep( 10000 );

    
    // CHECK RESULTS
    td.show();

    // Check GITHUB issues & labels
    let allNames = [ ISS_NEWBIE, ISS_SINREC, ISS_DUBREC, ISS_TRIPREC, ISS_SINFLAT, ISS_DUBMIX ]; 
    let issues = await gh2tu.getIssues( authData, td );


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
		    testStatus = tu.checkEq( issue.labels[0].name, "500 " + config.PEQ_LABEL, testStatus, "Bad issue label" );
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
    let softContCards = await gh2tu.getCards( authData, td.scColID );
    let busOpsCards   = await gh2tu.getCards( authData, td.boColID );
    let dsPlanCards   = await gh2tu.getCards( authData, td.dsPlanID );
    let ghProgCards   = await gh2tu.getCards( authData, td.ghProgID );
    let eggCards      = await gh2tu.getCards( authData, td.col1ID );
    let baconCards    = await gh2tu.getCards( authData, td.col2ID );

    let issueMap = tu.buildIssueMap( issues ); // {issue_num: {<issue>} }

    let softContData = softContCards.map((card) => gh2tu.getQuad( card, issueMap ));   // [ cardId, issueNum, issueId, issueTitle]
    let busOpsData   = busOpsCards.map((card) => gh2tu.getQuad( card, issueMap )); 
    let dsPlanData   = dsPlanCards.map((card) => gh2tu.getQuad( card, issueMap )); 
    let ghProgData   = ghProgCards.map((card) => gh2tu.getQuad( card, issueMap )); 
    let eggData      = eggCards.map((card) => gh2tu.getQuad( card, issueMap )); 
    let baconData    = baconCards.map((card) => gh2tu.getQuad( card, issueMap )); 

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
    let peqs =  await awsUtils.getPeqs( authData, { "CEProjectId": td.CEProjectId });

    for( const name of [ ISS_NEWBIE, ISS_SINREC, ISS_DUBREC, ISS_SINFLAT, ISS_DUBMIX ] ) {
	let fpeqs = peqs.filter((peq) => peq.HostIssueTitle.includes( name ));
	testStatus = tu.checkEq( fpeqs.length, 0,   testStatus, "Bad peq created" );
    }

    let tpeqs = peqs.filter((peq) => peq.HostIssueTitle.includes( ISS_TRIPREC ) );
    testStatus = tu.checkEq( tpeqs.length, 2,   testStatus, "Peq issues count" );
    assert( tpeqs.length == 2 );
    
    for( let i = 0; i < 2; i++ ) { testStatus = tu.checkEq( tpeqs[i].Amount, 500,           testStatus, "Peq Amount" ); }
    for( let i = 0; i < 2; i++ ) { testStatus = tu.checkEq( tpeqs[i].PeqType, config.PEQTYPE_PLAN, testStatus, "Peq Type" ); }
    for( let i = 0; i < 2; i++ ) { testStatus = tu.checkEq( tpeqs[i].Active, "true",        testStatus, "Peq Active" ); }
    for( let i = 0; i < 2; i++ ) { testStatus = tu.checkEq( tpeqs[i].CEHolderId.length, 0,  testStatus, "Peq ce holder ids" ); }
    for( let i = 0; i < 2; i++ ) { testStatus = tu.checkEq( tpeqs[i].HostHolderId.length, 0,  testStatus, "Peq gh holder ids" ); }
    let foundPeq = 0;
    // tpeqs is from dynamo.  ghdata below is from GH
    for( let i = 0; i < 2; i++ ) {
	console.log( tpeqs[i].HostProjectId, td.masterPID.toString(), tpeqs[i].HostHolderId );
	if( tpeqs[i].HostProjectId == td.masterPID.toString()) {
	    foundPeq++;
	    testStatus = tu.checkEq( tpeqs[i].HostProjectSub.length, 1,                            testStatus, "Project Sub" );
	    testStatus = tu.checkEq( tpeqs[i].HostProjectSub.includes(td.softContTitle ), true,    testStatus, "Project Sub" );
	    let ghdata = softContData.filter((datum) => datum[3] == tpeqs[i].HostIssueTitle);
	    console.log( "mas", ghdata[0][2], tpeqs[i].HostIssueId );
	    testStatus = tu.checkEq( ghdata[0][2], tpeqs[i].HostIssueId,                           testStatus, "Issue Id/title mismatch" );
	}
	else if( tpeqs[i].HostProjectId == td.dataSecPID.toString()) {
	    foundPeq++;
	    testStatus = tu.checkEq( tpeqs[i].HostProjectSub.length, 2,                            testStatus, "Project Sub" );
	    testStatus = tu.checkEq( tpeqs[i].HostProjectSub[0].includes(td.softContTitle ), true, testStatus, "Project Sub" );
	    testStatus = tu.checkEq( tpeqs[i].HostProjectSub[1].includes(td.dataSecTitle ), true,  testStatus, "Project Sub" );
	    let ghdata = dsPlanData.filter((datum) => datum[3] == tpeqs[i].HostIssueTitle);
	    console.log( "ds", ghdata[0][2], tpeqs[i].HostIssueId );
	    testStatus = tu.checkEq( ghdata[0][2], tpeqs[i].HostIssueId,                           testStatus, "Issue Id/title mismatch" );
	}
    }
    testStatus = tu.checkEq( foundPeq, 2, testStatus, "Missing trip rec peq" ); 


    // Check DYNAMO PAct
    let pacts = await awsUtils.getPActs( authData, { "CEProjectId": td.CEProjectId });
    let masPeq = tpeqs.filter((peq) => peq.HostProjectId == td.masterPID.toString() );
    let dsPeq  = tpeqs.filter((peq) => peq.HostProjectId == td.dataSecPID.toString() );
    testStatus = tu.checkGE( pacts.length, 3,         testStatus, "Number of PActs" );

    let f1 = 0;
    let f2 = 0;
    let f3 = 0;
    for( pact of pacts ) {
	if( pact.Subject[0] == masPeq[0].PEQId ) {
	    let hasRaw = await tu.hasRaw( authData, pact.PEQActionId );
	    testStatus = tu.checkEq( pact.Verb, config.PACTVERB_CONF,            testStatus, "PAct Verb"); 
	    testStatus = tu.checkEq( hasRaw, true,                               testStatus, "PAct Raw match" ); 
	    testStatus = tu.checkEq( pact.HostUserName, config.TESTER_BOT,         testStatus, "PAct user name" ); 
	    testStatus = tu.checkEq( pact.Ingested, "false",                     testStatus, "PAct ingested" );
	    testStatus = tu.checkEq( pact.Locked, "false",                       testStatus, "PAct locked" );
	    if     ( pact.Action == config.PACTACT_ADD )    { f1 = 1; }
	    else if( pact.Action == config.PACTACT_CHAN )   { f2 = 1; }
	}
	else if( pact.Subject[0] == dsPeq[0].PEQId ) {
	    let hasRaw = await tu.hasRaw( authData, pact.PEQActionId );
	    testStatus = tu.checkEq( pact.Verb, config.PACTVERB_CONF,            testStatus, "PAct Verb"); 
	    testStatus = tu.checkEq( pact.Action, config.PACTACT_ADD,            testStatus, "PAct Action" ); 
	    testStatus = tu.checkEq( hasRaw, true,                               testStatus, "PAct Raw match" ); 
	    testStatus = tu.checkEq( pact.Locked, "false",                       testStatus, "PAct locked" );
	    testStatus = tu.checkEq( pact.Ingested, "false",                     testStatus, "PAct ingested" );
	    f3 = 1;
	}
    }
    testStatus = tu.checkEq( f1+f2+f3, 3, testStatus, "Matched PActs with PEQs" );


    // Check DYNAMO RepoStatus
    let pop = await awsUtils.checkPopulated( authData, td.CEProjectId );
    testStatus = tu.checkEq( pop, "true", testStatus, "Repo status wrt populated" );


    // Check DYNAMO linkage
    // note.. newbie will not be here.. expect 10/11.
    let links = await tu.getLinks( authData, ghLinks, { "ceProjId": td.CEProjectId, "repo": td.GHFullName } );
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
	if( tripPeqIds.includes( link.hostIssueId )) {
	    let ghData = {};
	    if( link.hostProjectId == td.masterPID.toString() ) {
		tf0 = 1;
		ghData = ( softContData.filter((dat) => dat[2].toString() == link.hostIssueId ))[0];
		
		testStatus = tu.checkEq( link.hostIssueNum, ghData[1].toString(),  testStatus, "Linkage Issue num" );
		testStatus = tu.checkEq( link.hostCardId, ghData[0].toString(),    testStatus, "Linkage Card Id" );
		testStatus = tu.checkEq( link.hostColumnName, td.softContTitle,    testStatus, "Linkage Col name" );
		testStatus = tu.checkEq( link.hostIssueName, ghData[3],            testStatus, "Linkage Card Title" );
		testStatus = tu.checkEq( link.hostProjectName, config.MAIN_PROJ,   testStatus, "Linkage Project Title" );
		testStatus = tu.checkEq( link.hostColumnId, td.scColID.toString(), testStatus, "Linkage Col Id" );
	    }
	    else if( link.hostProjectId == td.dataSecPID.toString() ) {
		tf1 = 1;
		ghData = ( dsPlanData.filter((dat) => dat[2].toString() == link.hostIssueId ))[0];

		testStatus = tu.checkEq( link.hostIssueNum, ghData[1].toString(),   testStatus, "Linkage Issue num" );
		testStatus = tu.checkEq( link.hostCardId, ghData[0].toString(),     testStatus, "Linkage Card Id" );
		testStatus = tu.checkEq( link.hostColumnName, plan,                 testStatus, "Linkage Col name" );
		testStatus = tu.checkEq( link.hostIssueName, ghData[3],             testStatus, "Linkage Card Title" );
		testStatus = tu.checkEq( link.hostProjectName, td.dataSecTitle,     testStatus, "Linkage Project Title" );
		testStatus = tu.checkEq( link.hostColumnId, td.dsPlanID.toString(), testStatus, "Linkage Col Id" );
	    }
	}
	else if( othPeqIds.includes( link.hostIssueId )) {
	    tf2 += 1;
	    ghData = ( allGHData.filter((dat) => dat[2].toString() == link.hostIssueId ))[0];

	    if     ( link.hostProjectId == td.masterPID.toString() )    { lcounts[0]++; }
	    else if( link.hostProjectId == td.dataSecPID.toString() )   { lcounts[1]++; }
	    else if( link.hostProjectId == td.githubOpsPID.toString() ) { lcounts[2]++; }
	    else if( link.hostProjectId == td.flatPID.toString() )      { lcounts[3]++; }
	    
	    testStatus = tu.checkEq( link.hostIssueNum, ghData[1].toString(), testStatus, "Linkage Issue num" );
	    testStatus = tu.checkEq( link.hostCardId, ghData[0].toString(),   testStatus, "Linkage Card Id" );

	    testStatus = tu.checkEq( link.hostColumnName, config.EMPTY,       testStatus, "Linkage Col name" );
	    testStatus = tu.checkEq( link.hostIssueName, config.EMPTY,        testStatus, "Linkage Card Title" );
	    testStatus = tu.checkEq( link.hostProjectName, config.EMPTY,      testStatus, "Linkage Project Title" );
	    testStatus = tu.checkEq( link.hostColumnId, -1,                   testStatus, "Linkage Col Id" );
	}

    }
    testStatus = tu.checkEq( tf0 + tf1 + tf2, 10,     testStatus, "Total linkage count" );
    testStatus = tu.checkEq( lcounts.toString(), "2,3,1,2",      testStatus, "Basic linkage Proj id counts" );
    // NOTE Pre-existing newbies may exist without cards/linkages.  No expectations here.
    // testStatus = tu.checkEq( foundNewbie, false, testStatus, "Newborn issue showing up in linkage" );

    tu.testReport( testStatus, "Test Resolve" );
}


// During normal operation, when a second card is added to a carded or situated issue, it is immediately split
async function testIncrementalResolve( authData, ghLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test Incremental Resolve" );
    authData.who = "<TEST: Incr Resolve>";

    const ASSIGNEE1 = "ariCETester";
    const ASSIGNEE2 = "codeequity";

    const ISS_MOON = "IR Moons";
    const ISS_PLAN = "IR Plan";
    const ISS_PROG = "IR Prog";
    const ISS_PEND = "IR Pending";
    const ISS_ACCR = "IR Accrued";

    console.log( "Refresh rec" );
    await gh2tu.refreshRec( authData, td );
    console.log( "Refresh Flat" );
    await gh2tu.refreshFlat( authData, td );
    console.log( "make labels" );

    // 1. Setup.
    let label1k  = await ghV2.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, "1000 " + config.PEQ_LABEL, 1000 );
    let labelDoc = await ghV2.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, "documentation", -1 );
    let labelBug = await ghV2.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, "bug", -1 );

    console.log( "make issues" );
    const issMoonDat = await gh2tu.makeIssue( authData, td, ISS_MOON, [ labelBug, labelDoc ] );
    const issPlanDat = await gh2tu.makeIssue( authData, td, ISS_PLAN, [ label1k, labelDoc, labelBug ] );
    const issProgDat = await gh2tu.makeIssue( authData, td, ISS_PROG, [ label1k, labelDoc ] );
    const issPendDat = await gh2tu.makeIssue( authData, td, ISS_PEND, [ label1k ] );
    const issAccrDat = await gh2tu.makeIssue( authData, td, ISS_ACCR, [ label1k, labelDoc, labelBug ] );

    console.log( "make col herm" );
    await gh2tu.makeColumn( authData, ghLinks, td.CEProjectId, td.GHFullName, td.githubOpsPID, "Moons" );

    assert( false );

    // From
    const moonLoc = await gh2tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, "Moons" );
    const planLoc = await gh2tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PLAN] );
    const progLoc = await gh2tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PROG] );
    const pendLoc = await gh2tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_PEND] );
    const accrLoc = await gh2tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, config.PROJ_COLS[config.PROJ_ACCR] );
    
    // To
    const toBacnLoc = await gh2tu.getFlatLoc( authData, td.flatPID, td.flatTitle, td.col2Title );
    const toProgLoc = await gh2tu.getFullLoc( authData, td.softContTitle, td.dataSecPID, td.dataSecTitle, config.PROJ_COLS[config.PROJ_PROG] );
    const toPendLoc = await gh2tu.getFullLoc( authData, td.softContTitle, td.dataSecPID, td.dataSecTitle, config.PROJ_COLS[config.PROJ_PEND] );
    const toAccrLoc = await gh2tu.getFullLoc( authData, td.softContTitle, td.dataSecPID, td.dataSecTitle, config.PROJ_COLS[config.PROJ_ACCR] );
    
    // Need assignees for pend/accr. 
    await gh2tu.addAssignee( authData, td, issMoonDat, ASSIGNEE1 );	
    await gh2tu.addAssignee( authData, td, issPlanDat, ASSIGNEE1 );	
    await gh2tu.addAssignee( authData, td, issProgDat, ASSIGNEE2 );	
    await gh2tu.addAssignee( authData, td, issPendDat, ASSIGNEE1 );	
    await gh2tu.addAssignee( authData, td, issPendDat, ASSIGNEE2 );	
    await gh2tu.addAssignee( authData, td, issAccrDat, ASSIGNEE1 );

    // Set up first cards
    const cardMoon = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, moonLoc.colId, issMoonDat[0] );
    const cardPlan = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, planLoc.colId, issPlanDat[0] );
    const cardProg = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, progLoc.colId, issProgDat[0] );
    const cardPend = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, planLoc.colId, issPendDat[0] );
    const cardAccr = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, planLoc.colId, issAccrDat[0] );

    // Close & accrue
    await gh2tu.closeIssue( authData, td, issPendDat );

    await gh2tu.closeIssue( authData, td, issAccrDat );
    await gh2tu.moveCard( authData, td, cardAccr.id, accrLoc.colId );

    await utils.sleep( 2000 );	
    testStatus = await gh2tu.checkUntrackedIssue( authData, ghLinks, td, moonLoc, issMoonDat, cardMoon, testStatus, {lblCount: 2} );
    testStatus = await gh2tu.checkNewlySituatedIssue( authData, ghLinks, td, planLoc, issPlanDat, cardPlan, testStatus, {peq: true, lblCount: 3 } );
    testStatus = await gh2tu.checkNewlySituatedIssue( authData, ghLinks, td, progLoc, issProgDat, cardProg, testStatus, {peq: true, lblCount: 2 } );
    testStatus = await gh2tu.checkNewlyClosedIssue(   authData, ghLinks, td, pendLoc, issPendDat, cardPend, testStatus, {peq: true, lblCount: 1 } );
    testStatus = await gh2tu.checkNewlyAccruedIssue(  authData, ghLinks, td, accrLoc, issAccrDat, cardAccr, testStatus, {peq: true, lblCount: 3 } );
    if( typeof testStatus === 'undefined' ) { console.log( "ts is undefined!??" ); }
    
    if( typeof testStatus === 'undefined' ) { console.log( "ts is undefined!??" ); }
    tu.testReport( testStatus, "Incremental resolve setup" );

    // Can't add 2nd card within same project - needs to be cross project.
    // Use datasec & bacon
    
    // Plan += Bacon  (add new plan card to bacon column)
    {
	const cardNew = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, toBacnLoc.colId, issPlanDat[0] );
	await utils.sleep( 4000 );
	testStatus = await gh2tu.checkSplit( authData, ghLinks, td, issPlanDat, planLoc, toBacnLoc, 1000, 1000, testStatus, {peq: true, lblCount: 3 } );

	if( typeof testStatus === 'undefined' ) { console.log( "ts is undefined!??" ); }
	tu.testReport( testStatus, "Incremental resolve A" );
    }

    // Plan += Pend 
    {
	// At this point, plan lval is 500
	const cardNew = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, toPendLoc.colId, issPlanDat[0] );
	await utils.sleep( 3000 );
	testStatus = await gh2tu.checkSplit( authData, ghLinks, td, issPlanDat, planLoc, toPendLoc, 500, 1000, testStatus, {peq: true, lblCount: 3 } );

	if( typeof testStatus === 'undefined' ) { console.log( "ts is undefined!??" ); }
	tu.testReport( testStatus, "Incremental resolve B" );
    }

    // Moon += Pend .. Fail not peq.
    {
	const cardNew = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, toPendLoc.colId, issMoonDat[0] );
	await utils.sleep( 2000 );
	testStatus = await gh2tu.checkUntrackedIssue( authData, ghLinks, td, moonLoc, issMoonDat, cardMoon, testStatus, {lblCount: 2} );
	testStatus = await gh2tu.checkNoSplit( authData, ghLinks, td, issMoonDat, toPendLoc, cardNew.id, testStatus );

	if( typeof testStatus === 'undefined' ) { console.log( "ts is undefined!??" ); }
	tu.testReport( testStatus, "Incremental resolve C" );
    }
    
    // Moon += Prog 
    {
	const cardNew = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, toProgLoc.colId, issMoonDat[0] );
	await utils.sleep( 2000 );
	testStatus = await gh2tu.checkSplit( authData, ghLinks, td, issMoonDat, moonLoc, toProgLoc, -1, -1, testStatus, {peq: false, lblCount: 2 } );

	if( typeof testStatus === 'undefined' ) { console.log( "ts is undefined!??" ); }
	tu.testReport( testStatus, "Incremental resolve D" );
    }

    // Prog += Accr  .. Fail no create in accr
    {
	const cardNew = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, toAccrLoc.colId, issProgDat[0] );
	await utils.sleep( 2000 );
	testStatus = await gh2tu.checkSituatedIssue( authData, ghLinks, td, progLoc, issProgDat, cardProg, testStatus, {lblCount: 2 } );
	testStatus = await gh2tu.checkNoSplit( authData, ghLinks, td, issProgDat, toAccrLoc, cardNew.id, testStatus );
	
	if( typeof testStatus === 'undefined' ) { console.log( "ts is undefined!??" ); }
	tu.testReport( testStatus, "Incremental resolve E" );
    }

    
    // Pend += Accr  .. Fail no create in accr
    {
	const cardNew = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, toAccrLoc.colId, issPendDat[0] );
	await utils.sleep( 2000 );
	testStatus = await gh2tu.checkSituatedIssue( authData, ghLinks, td, pendLoc, issPendDat, cardPend, testStatus, {lblCount: 1 } );
	testStatus = await gh2tu.checkNoSplit( authData, ghLinks, td, issPendDat, toAccrLoc, cardNew.id, testStatus );

	if( typeof testStatus === 'undefined' ) { console.log( "ts is undefined!??" ); }
	tu.testReport( testStatus, "Incremental resolve F" );
    }

    // Accr += Pend  .. Fail no modify accr
    {
	const cardNew = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, toPendLoc.colId, issAccrDat[0] );
	await utils.sleep( 2000 );
	testStatus = await gh2tu.checkSituatedIssue( authData, ghLinks, td, accrLoc, issAccrDat, cardAccr, testStatus, {lblCount: 3 } );
	testStatus = await gh2tu.checkNoSplit( authData, ghLinks, td, issAccrDat, toPendLoc, cardNew.id, testStatus );

	tu.testReport( testStatus, "Incremental resolve G" );
    }
    
    tu.testReport( testStatus, "Test Incremental resolve" );

    return testStatus;
}

async function testSplitAlloc( authData, ghLinks, td ) {
    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Split Alloc" );
    authData.who = "<TEST: Split Alloc>";

    const ASSIGNEE2 = "codeequity";

    const ISS_ALLOC = "IR Alloc";

    await gh2tu.refreshRec( authData, td );
    await gh2tu.refreshFlat( authData, td );

    // 1. Setup.
    let label1m  = await ghV2.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, true, "1000000 " + config.ALLOC_LABEL, 1000000 );
    let labelBug = await ghV2.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, "bug", -1 );

    const issAllocDat = await gh2tu.makeIssue( authData, td, ISS_ALLOC, [ labelBug, label1m ] );

    // From
    const starLoc = await gh2tu.getFullLoc( authData, td.softContTitle, td.githubOpsPID, td.githubOpsTitle, "Stars" );
    
    // To
    const toBacnLoc = await gh2tu.getFlatLoc( authData, td.flatPID, td.flatTitle, td.col2Title );
    const toProgLoc = await gh2tu.getFullLoc( authData, td.softContTitle, td.dataSecPID, td.dataSecTitle, config.PROJ_COLS[config.PROJ_PROG] );
    const toAccrLoc = await gh2tu.getFullLoc( authData, td.softContTitle, td.dataSecPID, td.dataSecTitle, config.PROJ_COLS[config.PROJ_ACCR] );

    // NOTE: assignee added after makeIssue - will not show up
    await gh2tu.addAssignee( authData, td, issAllocDat, ASSIGNEE2 );
    
    // Set up first card
    const cardAlloc = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, starLoc.colId, issAllocDat[0] );
    await utils.sleep( 1000 );
    testStatus = await gh2tu.checkAlloc( authData, ghLinks, td, starLoc, issAllocDat, cardAlloc, testStatus, {lblCount: 2, val: 1000000} );
    
    tu.testReport( testStatus, "Split Alloc setup" );

    // += Prog.  Fail.  No create into x4
    {
	// At this point, lval is 500k
	const cardNew = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, toProgLoc.colId, issAllocDat[0] );
	await utils.sleep( 2000 );
	testStatus = await gh2tu.checkAlloc( authData, ghLinks, td, starLoc, issAllocDat, cardAlloc, testStatus, {lblCount: 2} );
	testStatus = await gh2tu.checkNoSplit( authData, ghLinks, td, issAllocDat, toProgLoc, cardNew.id, testStatus );

	tu.testReport( testStatus, "Split Alloc A" );
    }

    // += Accr.  Fail.  No create into x4
    {
	const cardNew = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, toAccrLoc.colId, issAllocDat[0] );
	await utils.sleep( 2000 );
	testStatus = await gh2tu.checkAlloc( authData, ghLinks, td, starLoc, issAllocDat, cardAlloc, testStatus, {lblCount: 2} );
	testStatus = await gh2tu.checkNoSplit( authData, ghLinks, td, issAllocDat, toAccrLoc, cardNew.id, testStatus );

	tu.testReport( testStatus, "Split Alloc B" );
    }

    // += Bacon
    // Note - this must be last, else will cause issue to be found in checkNoSplit
    {
	const cardNew = await gh2tu.makeProjectCard( authData, ghLinks, td.CEProjectId, td.GHFullName, toBacnLoc.colId, issAllocDat[0] );
	await utils.sleep( 2000 );
	testStatus = await gh2tu.checkAllocSplit( authData, ghLinks, td, issAllocDat, starLoc, toBacnLoc, 1000000, testStatus, { issAssignees: 1, lblCount: 2 } );

	tu.testReport( testStatus, "Split Alloc C" );
    }
    
    tu.testReport( testStatus, "Test Split Alloc" );

    return testStatus;
}



async function runTests( authData, ghLinks, td ) {

    /*  
    // Old tests, pre-dating most testUtil infras.  Hand massaging required.
    console.log( "Populate - add a repo to CE =================" );

    // *** these two tests are siblings (below)
    // TURN OFF ceServer
    //await makePrePopulateData( authData, td );
    
    // TURN ON ceServer
    // NOTE this test is flawed in concept, in that the current state of ceServer may already have
    //      PEQ issues, but populate assumes a binary none then some.  ghLinks.initOneRepo handles this flaw,
    //      but is slower than need be.
    // await testPopulate( authData, td );
    // *** these two tests are siblings (above)

    // Normal - leave it on.  A separate resolve test, run only after above 2.
    await testResolve( authData, ghLinks, td );
    */

    console.log( "Resolve tests =================" );

    let testStatus = [ 0, 0, []];

    let t1 = await testIncrementalResolve( authData, ghLinks, td );
    console.log( "\n\nIncremental resolve complete." );
    await utils.sleep( 5000 );

    let t2 = await testSplitAlloc( authData, ghLinks, td );
    console.log( "\n\nSplit Alloc complete." );
    // await utils.sleep( 5000 );

    testStatus = tu.mergeTests( testStatus, t1 );
    testStatus = tu.mergeTests( testStatus, t2 );

    return testStatus;

}


exports.runTests = runTests;
