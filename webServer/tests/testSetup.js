var utils = require('../utils');
var ghUtils = require('../ghUtils');
var config  = require('../config');
var assert = require('assert');

const tu = require('./testUtils');

var gh     = ghUtils.githubUtils;
var ghSafe = ghUtils.githubSafe;


// Adding a small sleep in each tu.make* - GH seems to get confused if requests come in too fast
async function createPreferredCEProjects( authData, ghLinks, td ) {
    console.log( "Building preferred CE project layout, a mini version" );
    
    // Master: softwareContr, businessOps, unallocated
    td.masterPID  = await tu.makeProject( authData, td, config.MAIN_PROJ, "Overall planned equity allocations, by category" );
    let mastCol1  = await tu.makeColumn( authData, ghLinks, td.GHFullName, td.masterPID, td.softContTitle );
    let mastCol2  = await tu.makeColumn( authData, ghLinks, td.GHFullName, td.masterPID, td.busOpsTitle );
    let mastCol3  = await tu.makeColumn( authData, ghLinks, td.GHFullName, td.masterPID, td.unallocTitle );

    // dataSec: 4x
    let dataPID  = await tu.makeProject( authData, td, td.dataSecTitle, "Make PII safe" );
    let dataCols = await tu.make4xCols( authData, ghLinks, td.GHFullName, dataPID );

    // githubOPs: 4x
    let ghOpPID  = await tu.makeProject( authData, td, td.githubOpsTitle, "Make it giddy" );
    let ghOpCols = await tu.make4xCols( authData, ghLinks, td.GHFullName, ghOpPID );
    await tu.makeColumn( authData, ghLinks, td.GHFullName, ghOpPID, "Stars" );	
    await tu.makeColumn( authData, ghLinks, td.GHFullName, ghOpPID, "Stripes" );


    // TRIGGER
    let nbi1     = await ghSafe.createIssue( authData, td.GHOwner, td.GHRepo, "A special populate issue", [], false );
    let card11   = await ghSafe.createProjectCard( authData, mastCol1, nbi1[0] );
    let popLabel = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, config.POPULATE, -1 );
    await tu.addLabel( authData, td, nbi1[1], popLabel.name );       // ready.. set... Go!
    await utils.sleep( 1000 );

    // softCont: dataSecurity, githubOps, unallocated
    await tu.makeAllocCard( authData, ghLinks, td.GHFullName, mastCol1, td.dataSecTitle, "1,000,000" );
    await tu.makeAllocCard( authData, ghLinks, td.GHFullName, mastCol1, td.githubOpsTitle, "1,500,000" );
    await tu.makeAllocCard( authData, ghLinks, td.GHFullName, mastCol1, td.unallocTitle, "3,000,000" );
    
    // busOps:  unallocated
    await tu.makeAllocCard( authData, ghLinks, td.GHFullName, mastCol2, td.unallocTitle, "1,000,000" );
}

async function testPreferredCEProjects( authData, ghLinks, td ) {

    // [pass, fail, msgs]
    let subTest  = [ 0, 0, []];
    
    await tu.refresh( authData, td, config.MAIN_PROJ );

    // Check DYNAMO PEQ table
    let ghPeqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName, "GHIssueTitle": td.githubOpsTitle });
    assert( ghPeqs.length > 0 ); // total fail if this fails
    subTest = tu.checkEq( ghPeqs.length, 1,                           subTest, "Number of githubOps peq objects" );
    subTest = tu.checkEq( ghPeqs[0].PeqType, config.PEQTYPE_ALLOC,            subTest, "PeqType" );
    subTest = tu.checkEq( ghPeqs[0].Amount, "1500000",                subTest, "Peq Amount" );  
    subTest = tu.checkAr( ghPeqs[0].GHProjectSub, [td.softContTitle], subTest, "Project sub" );
    subTest = tu.checkEq( ghPeqs[0].GHProjectId, td.masterPID,        subTest, "Project ID" );  
    
    let dsPeqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName, "GHIssueTitle": td.dataSecTitle });
    subTest = tu.checkEq( dsPeqs.length, 1,                           subTest, "Number of datasec peq objects" );
    subTest = tu.checkEq( dsPeqs[0].PeqType, config.PEQTYPE_ALLOC,            subTest, "PeqType" );
    subTest = tu.checkAr( dsPeqs[0].GHProjectSub, [td.softContTitle], subTest, "Project sub" );

    let unPeqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName, "GHIssueTitle": td.unallocTitle });
    subTest = tu.checkEq( unPeqs.length, 2,                           subTest, "Number of unalloc peq objects" );
    subTest = tu.checkEq( unPeqs[0].PeqType, config.PEQTYPE_ALLOC,            subTest, "PeqType" );
    subTest = tu.checkEq( typeof unPeqs[0] !== 'undefined', true,             subTest, "have unpeq 0" );
    subTest = tu.checkEq( typeof unPeqs[1] !== 'undefined', true,             subTest, "have unpeq 1" );

    if( typeof unPeqs[0] !== 'undefined' && typeof unPeqs[1] !== 'undefined' ) {
	
	let busTest = unPeqs[0].GHProjectSub.includes(td.busOpsTitle) || unPeqs[1].GHProjectSub.includes( td.busOpsTitle );
	subTest = tu.checkEq( busTest, true,                              subTest, "Project subs for unalloc" );    
	
	
	// Check DYNAMO PAct 
	let pacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
	subTest = tu.checkGE( pacts.length, 4,         subTest, "Number of PActs" );
	let foundPActs = 0;
	for( pact of pacts ) {
	    if( pact.Subject[0] == ghPeqs[0].PEQId ) {
		let hasRaw = await tu.hasRaw( authData, pact.PEQActionId );
		subTest = tu.checkEq( pact.Verb, config.PACTVERB_CONF,            subTest, "PAct Verb"); 
		subTest = tu.checkEq( pact.Action, config.PACTACT_ADD,            subTest, "PAct Action" ); 
		subTest = tu.checkEq( hasRaw, true,                               subTest, "PAct Raw match" ); 
		subTest = tu.checkEq( pact.GHUserName, config.TESTER_BOT,         subTest, "PAct user name" ); 
		subTest = tu.checkEq( pact.Ingested, "false",                     subTest, "PAct ingested" );
		subTest = tu.checkEq( pact.Locked, "false",                       subTest, "PAct locked" );
		foundPActs++;
	    }
	    else if( pact.Subject[0] == dsPeqs[0].PEQId ) {
		let hasRaw = await tu.hasRaw( authData, pact.PEQActionId );
		subTest = tu.checkEq( pact.Verb, config.PACTVERB_CONF,            subTest, "PAct Verb"); 
		subTest = tu.checkEq( pact.Action, config.PACTACT_ADD,            subTest, "PAct Action" ); 
		subTest = tu.checkEq( hasRaw, true,                               subTest, "PAct Raw match" ); 
		subTest = tu.checkEq( pact.Ingested, "false",                     subTest, "PAct ingested" );
		foundPActs++;
	    }
	    else if( pact.Subject[0] == unPeqs[0].PEQId ) {
		let hasRaw = await tu.hasRaw( authData, pact.PEQActionId );
		subTest = tu.checkEq( pact.Verb, config.PACTVERB_CONF,            subTest, "PAct Verb"); 
		subTest = tu.checkEq( hasRaw,  true,                              subTest, "PAct Raw match" ); 
		subTest = tu.checkEq( pact.Ingested, "false",                     subTest, "PAct ingested" );
		foundPActs++;
	    }
	}
	subTest = tu.checkEq( foundPActs, 3 ,           subTest, "Matched PActs with PEQs" );
	
	// Check DYNAMO RepoStatus
	let pop = await utils.checkPopulated( authData, td.GHFullName );
	subTest = tu.checkEq( pop, "true", subTest, "Repo status wrt populated" );
	
	
	// Check GITHUB Labels
	let peqLabels = await tu.getPeqLabels( authData, td );
	subTest = tu.checkGE( peqLabels.length, 3,   subTest, "Peq Label count" );
	let foundLabs = 0;
	for( label of peqLabels ) {
	    if( ghSafe.parseLabelDescr( [label.description] ) == 1000000 ) {
		subTest = tu.checkEq( label.description.includes( "Allocation" ), true, subTest, "Peq label descr" );
		foundLabs++;
	    }
	    else if( ghSafe.parseLabelDescr( [label.description] ) == 1500000 ) { foundLabs++; }
	    else if( ghSafe.parseLabelDescr( [label.description] ) == 3000000 ) { foundLabs++; }
	}
	subTest = tu.checkEq( foundLabs, 3,   subTest, "Peq Label matching peq amounts" );
	
	
	// Check GITHUB Issues
	let issues = await tu.getIssues( authData, td );
	subTest = tu.checkGE( issues.length, 4,     subTest, "Issue count" );
	let foundIss = 0;
	for( const issue of issues ) {
	    if( issue.title == td.githubOpsTitle ) {
		subTest = tu.checkEq( issue.body.includes( "allocation issue added by CodeEquity" ), true, subTest, "issue body" );
		td.githubOpsIss = [issue.id, issue.number];
		foundIss++;
	    }
	    if( issue.title == td.dataSecTitle ) {
		td.dataSecIss = [issue.id, issue.number];	    
		foundIss++;
	    }
	    if( issue.title == td.unallocTitle ) {
		if( td.unallocIss1 == config.EMPTY ) { td.unallocIss1 = [issue.id, issue.number]; }
		else                                 { td.unallocIss2 = [issue.id, issue.number]; }
		foundIss++;
	    }  // 2 of these
	}
	subTest = tu.checkEq( foundIss, 4,       subTest, "Matching issue count" );

	
	// Check GITHUB Projects
	let projects = await tu.getProjects( authData, td );
	subTest = tu.checkGE( projects.length, 3,     subTest, "Project count" );
	let foundProj = 0;
	for( const proj of projects ) {
	    if( proj.name == config.MAIN_PROJ ) {
		td.masterPID = proj.id;
		foundProj++;
	    }
	    if( proj.name == td.dataSecTitle )   {
		td.dataSecPID = proj.id;
		foundProj++;
	    }
	    if( proj.name == td.githubOpsTitle ) {
		td.githubOpsPID = proj.id;
		foundProj++;
	    }  
	}
	subTest = tu.checkEq( foundProj, 3,       subTest, "Matching project count" );
	
	
	// Check GITHUB Columns
	// td.show();
	let mastCols = await tu.getColumns( authData, td.masterPID  );
	let dsCols   = await tu.getColumns( authData, td.dataSecPID  );
	let ghCols   = await tu.getColumns( authData, td.githubOpsPID  );
	
	subTest = tu.checkEq( mastCols.length, 3,   subTest, "Master proj col count" );
	subTest = tu.checkEq( dsCols.length, 4,     subTest, "Data security proj col count" );
	subTest = tu.checkEq( ghCols.length, 6,     subTest, "Github ops proj col count" );

	let colNames = mastCols.map((col) => col.name );
	subTest = tu.checkEq( colNames.includes( td.softContTitle ), true,   subTest, "Master col names" );
	subTest = tu.checkEq( colNames.includes( td.busOpsTitle ), true,     subTest, "Master col names" );
	subTest = tu.checkEq( colNames.includes( td.unallocTitle ), true,   subTest, "Master col names" );
	
	colNames = dsCols.map((col) => col.name );
	subTest = tu.checkEq( colNames.includes( config.PROJ_COLS[0] ), true,   subTest, "Data sec col names" );
	subTest = tu.checkEq( colNames.includes( config.PROJ_COLS[1] ), true,   subTest, "Data sec  col names" );
	
	colNames = ghCols.map((col) => col.name );
	subTest = tu.checkEq( colNames.includes( config.PROJ_COLS[2] ), true,   subTest, "Github ops col names" );
	subTest = tu.checkEq( colNames.includes( config.PROJ_COLS[3] ), true,   subTest, "Github ops  col names" );
	
	for( const col of mastCols ) {
	    if     ( col.name == td.softContTitle ) { td.scColID = col.id; }
	    else if( col.name == td.busOpsTitle )   { td.boColID = col.id; }
	    else if( col.name == td.unallocTitle )  { td.unColID = col.id; }
	}
	
	
	// Check GITHUB Cards
	// Don't try checking names - they belong to & were already checked, in issues.
	let scCards = await tu.getCards( authData, td.scColID );
	let boCards = await tu.getCards( authData, td.boColID );
	let noCards = await tu.getCards( authData, td.unColID );
	
	subTest = tu.checkEq( scCards.length, 4, subTest, "Soft cont col card count" );
	subTest = tu.checkEq( boCards.length, 1, subTest, "Bus ops col card count" );
	subTest = tu.checkEq( noCards.length, 0, subTest, "Unalloc col card count" );
	
	// Check a random col
	let rn2 = Math.floor(Math.random() * 2); // (0,1)
	let rn4 = Math.floor(Math.random() * 4);
	console.log( "rands", rn2, rn4 );
	let cols = dsCols;
	if( rn2 == 1 )  { cols = ghCols; }
	noCards = await tu.getCards( authData, cols[rn4].id );
	subTest = tu.checkEq( noCards.length, 0, subTest, "Unalloc col card count" );

	
	// Check DYNAMO Linkage
	let links = await tu.getLinks( authData, ghLinks, { "repo": td.GHFullName } );
	subTest = tu.checkGE( links.length, 4, subTest, "Linkage count" );
	let unallocSoft = false;   let lSoft = -1;
	let unallocBus  = false;   let lBus  = -1;
	// td.show();
	let foundDS = 0;
	for( const link of links ) {
	    let found = false;
	    if( link.GHIssueId == td.githubOpsIss[0] ) {
		subTest = tu.checkEq( link.GHIssueNum, td.githubOpsIss[1],    subTest, "Linkage Issue num" );
		subTest = tu.checkEq( link.GHColumnName, td.softContTitle,    subTest, "Linkage Col name" );
		subTest = tu.checkEq( link.GHColumnId, td.scColID.toString(), subTest, "Linkage Col Id" );
		subTest = tu.checkEq( link.GHIssueTitle, td.githubOpsTitle,    subTest, "Linkage Card Title" );
		let cardId = tu.findCardForIssue( scCards, link.GHIssueNum );
		subTest = tu.checkEq( link.GHCardId, cardId,                  subTest, "Linkage Card Id" );
		found = true;
	    }
	    else if( link.GHIssueId == td.dataSecIss[0] ) {
		subTest = tu.checkEq( link.GHIssueNum, td.dataSecIss[1],      subTest, "Linkage Issue num" );
		subTest = tu.checkEq( link.GHColumnName, td.softContTitle,    subTest, "Linkage Col name" );
		subTest = tu.checkEq( link.GHColumnId, td.scColID.toString(), subTest, "Linkage Col Id" );
		subTest = tu.checkEq( link.GHIssueTitle, td.dataSecTitle,      subTest, "Linkage Card Title" );
		let cardId = tu.findCardForIssue( scCards, link.GHIssueNum );
		subTest = tu.checkEq( link.GHCardId, cardId,                  subTest, "Linkage Card Id" );
		found = true;
	    }
	    else if( link.GHIssueId == td.unallocIss1[0] ) {
		subTest = tu.checkEq( link.GHIssueNum, td.unallocIss1[1],  subTest, "Linkage Issue num" );
		subTest = tu.checkEq( link.GHIssueTitle, td.unallocTitle,   subTest, "Linkage Card Title" );
		if( link.GHColumnName == td.softContTitle ) { unallocSoft = true; lSoft = link.GHColumnId; }
		else                                        { unallocBus  = true; lBus  = link.GHColumnId; }
		found = true;
	    }
	    else if( link.GHIssueId == td.unallocIss2[0] ) {
		subTest = tu.checkEq( link.GHIssueNum, td.unallocIss2[1],  subTest, "Linkage Issue num" );
		subTest = tu.checkEq( link.GHIssueTitle, td.unallocTitle,   subTest, "Linkage Card Title" );
		if( link.GHColumnName == td.softContTitle ) { unallocSoft = true; lSoft = link.GHColumnId; }
		else                                        { unallocBus  = true; lBus  = link.GHColumnId; }
		found = true;
	    }
	    
	    if( link.GHIssueTitle == td.dataSecTitle ) { foundDS++; }
	    
	    if( found ) {
		subTest = tu.checkEq( link.GHProjectName, config.MAIN_PROJ, subTest, "Linkage Proj name" );
		subTest = tu.checkEq( link.GHProjectId, td.masterPID,       subTest, "Linkage Proj id" );
	    }
	}
	subTest = tu.checkEq( foundDS, 1, subTest, "Duplicate links" );
	subTest = tu.checkEq( (unallocSoft && unallocBus), true, subTest, "Linkage unalloc unique count" );
	if( unallocSoft ) { subTest = tu.checkEq( lSoft, td.scColID.toString(), subTest, "Linkage Col Id" ); }
	if( unallocBus )  { subTest = tu.checkEq( lBus,  td.boColID.toString(), subTest, "Linkage Col Id" ); }
    }

    return await tu.settle( subTest, [ 0, 0, []], testPreferredCEProjects, authData, ghLinks, td );
}


async function runTests( authData, ghLinks, td ) {

    console.log( "Preferred CE project structure =================" );

    let testStatus = [ 0, 0, []];

    await createPreferredCEProjects( authData, ghLinks, td );
    await utils.sleep( 2000 );
    let t1 = await testPreferredCEProjects( authData, ghLinks, td );

    testStatus = tu.mergeTests( testStatus, t1 );
    tu.testReport( testStatus, "Create preferred CE Projects" );
    return testStatus;
}

//runTests();

exports.runTests = runTests;
