var utils = require('../utils');
var ghUtils = require('../ghUtils');
var config  = require('../config');
var assert = require('assert');

const tu = require('./testUtils');

var gh = ghUtils.githubUtils;


// Adding a small sleep in each tu.make* - GH seems to get confused if requests come in too fast
async function createPreferredCEProjects( installClient, td ) {
    console.log( "Building preferred CE project layout, a mini version" );
    
    // Master: softwareContr, businessOps, unallocated
    td.masterPID  = await tu.makeProject( installClient, td, config.MAIN_PROJ, "Overall planned equity allocations, by category" );
    let mastCol1  = await tu.makeColumn( installClient, td.masterPID, td.softContTitle );
    let mastCol2  = await tu.makeColumn( installClient, td.masterPID, td.busOpsTitle );
    let mastCol3  = await tu.makeColumn( installClient, td.masterPID, td.unallocTitle );

    // dataSec: 4x
    let dataPID  = await tu.makeProject( installClient, td, td.dataSecTitle, "Make PII safe" );
    let dataCols = await tu.make4xCols( installClient, dataPID );

    // githubOPs: 4x
    let ghOpPID  = await tu.makeProject( installClient, td, td.githubOpsTitle, "Make it giddy" );
    let ghOpCols = await tu.make4xCols( installClient, ghOpPID );
    
    // softCont: dataSecurity, githubOps, unallocated
    let dsCardId = await tu.makeAllocCard( installClient, mastCol1, td.dataSecTitle, "1,000,000" );

    // Just triggered populate.
    console.log( "Wait while populating.." );
    await utils.sleep( 15000 );
    console.log( "Done waiting." );
    
    let ghCardId = await tu.makeAllocCard( installClient, mastCol1, td.githubOpsTitle, "1,500,000" );
    let usCardId = await tu.makeAllocCard( installClient, mastCol1, td.unallocTitle, "3,000,000" );
    
    // busOps:  unallocated
    let ubCardId = await tu.makeAllocCard( installClient, mastCol2, td.unallocTitle, "1,000,000" );
}

async function testPreferredCEProjects( installClient, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    await tu.refresh( installClient, td, config.MAIN_PROJ );

    // Check DYNAMO PEQ table
    let ghPeqs =  await utils.getPeqs( installClient[1], { "GHRepo": td.GHFullName, "GHIssueTitle": td.githubOpsTitle });
    assert( ghPeqs.length > 0 ); // total fail if this fails
    testStatus = tu.checkEq( ghPeqs.length, 1,                           testStatus, "Number of githubOps peq objects" );
    testStatus = tu.checkEq( ghPeqs[0].PeqType, "allocation",            testStatus, "PeqType" );
    testStatus = tu.checkEq( ghPeqs[0].Amount, "1500000",                testStatus, "Peq Amount" );  
    testStatus = tu.checkAr( ghPeqs[0].GHProjectSub, [td.softContTitle], testStatus, "Project sub" );
    testStatus = tu.checkEq( ghPeqs[0].GHProjectId, td.masterPID,        testStatus, "Project ID" );  
    
    let dsPeqs =  await utils.getPeqs( installClient[1], { "GHRepo": td.GHFullName, "GHIssueTitle": td.dataSecTitle });
    testStatus = tu.checkEq( dsPeqs.length, 1,                           testStatus, "Number of datasec peq objects" );
    testStatus = tu.checkEq( dsPeqs[0].PeqType, "allocation",            testStatus, "PeqType" );
    testStatus = tu.checkAr( dsPeqs[0].GHProjectSub, [td.softContTitle], testStatus, "Project sub" );

    let unPeqs =  await utils.getPeqs( installClient[1], { "GHRepo": td.GHFullName, "GHIssueTitle": td.unallocTitle });
    testStatus = tu.checkEq( unPeqs.length, 2,                           testStatus, "Number of unalloc peq objects" );
    testStatus = tu.checkEq( unPeqs[0].PeqType, "allocation",            testStatus, "PeqType" );

    let busTest = unPeqs[0].GHProjectSub.includes(td.busOpsTitle) || unPeqs[1].GHProjectSub.includes( td.busOpsTitle );
    testStatus = tu.checkEq( busTest, true,                              testStatus, "Project subs for unalloc" );    

    
    // Check DYNAMO PAct 
    let pacts = await utils.getPActs( installClient[1], {"GHRepo": td.GHFullName} );
    testStatus = tu.checkGE( pacts.length, 4,         testStatus, "Number of PActs" );
    let foundPActs = 0;
    for( pact of pacts ) {
	if( pact.Subject[0] == ghPeqs[0].PEQId ) {
	    let hasRaw = await tu.hasRaw( installClient[1], pact.PEQActionId );
	    testStatus = tu.checkEq( pact.Verb, "confirm",                       testStatus, "PAct Verb"); 
	    testStatus = tu.checkEq( pact.Action, "add",                         testStatus, "PAct Action" ); 
	    testStatus = tu.checkEq( hasRaw, true,                               testStatus, "PAct Raw match" ); 
	    testStatus = tu.checkEq( pact.GHUserName, config.TESTER_BOT,         testStatus, "PAct user name" ); 
	    testStatus = tu.checkEq( pact.Ingested, "false",                     testStatus, "PAct ingested" );
	    testStatus = tu.checkEq( pact.Locked, "false",                       testStatus, "PAct locked" );
	    foundPActs++;
	}
	else if( pact.Subject[0] == dsPeqs[0].PEQId ) {
	    let hasRaw = await tu.hasRaw( installClient[1], pact.PEQActionId );
	    testStatus = tu.checkEq( pact.Verb, "confirm",                       testStatus, "PAct Verb"); 
	    testStatus = tu.checkEq( pact.Action, "add",                         testStatus, "PAct Action" ); 
	    testStatus = tu.checkEq( hasRaw, true,                               testStatus, "PAct Raw match" ); 
	    testStatus = tu.checkEq( pact.Ingested, "false",                     testStatus, "PAct ingested" );
	    foundPActs++;
	}
	else if( pact.Subject[0] == unPeqs[0].PEQId ) {
	    let hasRaw = await tu.hasRaw( installClient[1], pact.PEQActionId );
	    testStatus = tu.checkEq( pact.Verb, "confirm",                       testStatus, "PAct Verb"); 
	    testStatus = tu.checkEq( hasRaw,  true,                              testStatus, "PAct Raw match" ); 
	    testStatus = tu.checkEq( pact.Ingested, "false",                     testStatus, "PAct ingested" );
	    foundPActs++;
	}
    }
    testStatus = tu.checkEq( foundPActs, 3 ,           testStatus, "Matched PActs with PEQs" );

    // Check DYNAMO RepoStatus
    let pop = await utils.checkPopulated( installClient[1], td.GHFullName );
    testStatus = tu.checkEq( pop, "true", testStatus, "Repo status wrt populated" );
    

    // Check GITHUB Labels
    let peqLabels = await tu.getPeqLabels( installClient, td );
    testStatus = tu.checkGE( peqLabels.length, 3,   testStatus, "Peq Label count" );
    let foundLabs = 0;
    for( label of peqLabels ) {
	if( gh.parseLabelDescr( [label.description] ) == 1000000 ) {
	    testStatus = tu.checkEq( label.description.includes( "Allocation" ), true, testStatus, "Peq label descr" );
	    foundLabs++;
	}
	else if( gh.parseLabelDescr( [label.description] ) == 1500000 ) { foundLabs++; }
	else if( gh.parseLabelDescr( [label.description] ) == 3000000 ) { foundLabs++; }
    }
    testStatus = tu.checkEq( foundLabs, 3,   testStatus, "Peq Label matching peq amounts" );

    
    // Check GITHUB Issues
    let issues = await tu.getIssues( installClient, td );
    testStatus = tu.checkGE( issues.length, 4,     testStatus, "Issue count" );
    let foundIss = 0;
    for( const issue of issues ) {
	if( issue.title == td.githubOpsTitle ) {
	    testStatus = tu.checkEq( issue.body.includes( "allocation issue added by CodeEquity" ), true, testStatus, "issue body" );
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
    testStatus = tu.checkEq( foundIss, 4,       testStatus, "Matching issue count" );


    // Check GITHUB Projects
    let projects = await tu.getProjects( installClient, td );
    testStatus = tu.checkGE( projects.length, 3,     testStatus, "Project count" );
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
    testStatus = tu.checkEq( foundProj, 3,       testStatus, "Matching project count" );

    
    // Check GITHUB Columns
    // td.show();
    let mastCols = await tu.getColumns( installClient, td.masterPID  );
    let dsCols   = await tu.getColumns( installClient, td.dataSecPID  );
    let ghCols   = await tu.getColumns( installClient, td.githubOpsPID  );

    testStatus = tu.checkEq( mastCols.length, 3,   testStatus, "Master proj col count" );
    testStatus = tu.checkEq( dsCols.length, 4,     testStatus, "Data security proj col count" );
    testStatus = tu.checkEq( ghCols.length, 4,     testStatus, "Github ops proj col count" );

    let colNames = mastCols.map((col) => col.name );
    testStatus = tu.checkEq( colNames.includes( td.softContTitle ), true,   testStatus, "Master col names" );
    testStatus = tu.checkEq( colNames.includes( td.busOpsTitle ), true,     testStatus, "Master col names" );
    testStatus = tu.checkEq( colNames.includes( td.unallocTitle ), true,   testStatus, "Master col names" );
    
    colNames = dsCols.map((col) => col.name );
    testStatus = tu.checkEq( colNames.includes( config.PROJ_COLS[0] ), true,   testStatus, "Data sec col names" );
    testStatus = tu.checkEq( colNames.includes( config.PROJ_COLS[1] ), true,   testStatus, "Data sec  col names" );

    colNames = ghCols.map((col) => col.name );
    testStatus = tu.checkEq( colNames.includes( config.PROJ_COLS[2] ), true,   testStatus, "Github ops col names" );
    testStatus = tu.checkEq( colNames.includes( config.PROJ_COLS[3] ), true,   testStatus, "Github ops  col names" );

    for( const col of mastCols ) {
	if     ( col.name == td.softContTitle ) { td.scColID = col.id; }
	else if( col.name == td.busOpsTitle )   { td.boColID = col.id; }
	else if( col.name == td.unallocTitle )  { td.unColID = col.id; }
    }


    // Check GITHUB Cards
    // Don't try checking names - they belong to & were already checked, in issues.
    let scCards = await tu.getCards( installClient, td.scColID );
    let boCards = await tu.getCards( installClient, td.boColID );
    let noCards = await tu.getCards( installClient, td.unColID );

    testStatus = tu.checkEq( scCards.length, 3, testStatus, "Soft cont col card count" );
    testStatus = tu.checkEq( boCards.length, 1, testStatus, "Bus ops col card count" );
    testStatus = tu.checkEq( noCards.length, 0, testStatus, "Unalloc col card count" );

    // Check a random col
    let rn2 = Math.floor(Math.random() * 2); // (0,1)
    let rn4 = Math.floor(Math.random() * 4);
    console.log( "rands", rn2, rn4 );
    let cols = dsCols;
    if( rn2 == 1 )  { cols = ghCols; }
    noCards = await tu.getCards( installClient, cols[rn4].id );
    testStatus = tu.checkEq( noCards.length, 0, testStatus, "Unalloc col card count" );


    // Check DYNAMO Linkage
    let links = await utils.getLinks( installClient[1], td.GHFullName );
    testStatus = tu.checkGE( links.length, 4, testStatus, "Linkage count" );
    let unallocSoft = false;   let lSoft = -1;
    let unallocBus  = false;   let lBus  = -1;
    // td.show();
    for( const link of links ) {
	let found = false;
	if( link.GHIssueId == td.githubOpsIss[0] ) {
	    testStatus = tu.checkEq( link.GHIssueNum, td.githubOpsIss[1],    testStatus, "Linkage Issue num" );
	    testStatus = tu.checkEq( link.GHColumnName, td.softContTitle,    testStatus, "Linkage Col name" );
	    testStatus = tu.checkEq( link.GHColumnId, td.scColID.toString(), testStatus, "Linkage Col Id" );
	    testStatus = tu.checkEq( link.GHCardTitle, td.githubOpsTitle,    testStatus, "Linkage Card Id" );
	    let cardId = tu.findCardForIssue( scCards, link.GHIssueNum );
	    testStatus = tu.checkEq( link.GHCardId, cardId,                  testStatus, "Linkage Card Id" );
	    found = true;
	}
	else if( link.GHIssueId == td.dataSecIss[0] ) {
	    testStatus = tu.checkEq( link.GHIssueNum, td.dataSecIss[1],      testStatus, "Linkage Issue num" );
	    testStatus = tu.checkEq( link.GHColumnName, td.softContTitle,    testStatus, "Linkage Col name" );
	    testStatus = tu.checkEq( link.GHColumnId, td.scColID.toString(), testStatus, "Linkage Col Id" );
	    testStatus = tu.checkEq( link.GHCardTitle, td.dataSecTitle,      testStatus, "Linkage Card Id" );
	    let cardId = tu.findCardForIssue( scCards, link.GHIssueNum );
	    testStatus = tu.checkEq( link.GHCardId, cardId,                  testStatus, "Linkage Card Id" );
	    found = true;
	}
	else if( link.GHIssueId == td.unallocIss1[0] ) {
	    testStatus = tu.checkEq( link.GHIssueNum, td.unallocIss1[1],  testStatus, "Linkage Issue num" );
	    testStatus = tu.checkEq( link.GHCardTitle, td.unallocTitle,   testStatus, "Linkage Card Id" );
	    if( link.GHColumnName == td.softContTitle ) { unallocSoft = true; lSoft = link.GHColumnId; }
	    else                                        { unallocBus  = true; lBus  = link.GHColumnId; }
	    found = true;
	}
	else if( link.GHIssueId == td.unallocIss2[0] ) {
	    testStatus = tu.checkEq( link.GHIssueNum, td.unallocIss2[1],  testStatus, "Linkage Issue num" );
	    testStatus = tu.checkEq( link.GHCardTitle, td.unallocTitle,   testStatus, "Linkage Card Id" );
	    if( link.GHColumnName == td.softContTitle ) { unallocSoft = true; lSoft = link.GHColumnId; }
	    else                                        { unallocBus  = true; lBus  = link.GHColumnId; }
	    found = true;
	}

	if( found ) {
	    testStatus = tu.checkEq( link.GHProjectName, config.MAIN_PROJ, testStatus, "Linkage Proj name" );
	    testStatus = tu.checkEq( link.GHProjectId, td.masterPID,       testStatus, "Linkage Proj id" );
	}
    }
    testStatus = tu.checkEq( (unallocSoft && unallocBus), true, testStatus, "Linkage unalloc unique count" );
    if( unallocSoft ) { testStatus = tu.checkEq( lSoft, td.scColID.toString(), testStatus, "Linkage Col Id" ); }
    if( unallocBus )  { testStatus = tu.checkEq( lBus,  td.boColID.toString(), testStatus, "Linkage Col Id" ); }
    
    tu.testReport( testStatus, "Create preferred CE Projects" );
}


// XXX Waiting for things to settle
//     this does have some merit - CE is built for human hands, and hands + native github delay means human
//     operations are far slower than the test execution above.  However, this is still pretty darned slow ATM

async function runTests( installClient, td ) {

    console.log( "Preferred CE project structure =================" );

    // await createPreferredCEProjects( installClient, td );
    // await utils.sleep( 15000 );

    await testPreferredCEProjects( installClient, td );

}

//runTests();

exports.runTests = runTests;
