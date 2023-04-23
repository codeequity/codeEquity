var assert = require( 'assert' );

var config = require( '../../../config' );

const utils    = require( '../../../utils/ceUtils' );
const awsUtils = require( '../../../utils/awsUtils' );
const ghUtils  = require( '../../../utils/gh/ghUtils' );
const ghV2     = require( '../../../utils/gh/gh2/ghV2Utils' );

const tu       = require( '../../ceTestUtils' );

const gh2tu    = require( './gh2TestUtils' );

// XXXXXXXXXXXXXXXXXXXXXXXXX
//     2/2023
// XXX Until ghV2 allows us to make columns, much of this portion of the test is defunct.  We can make
//     projects, but that is not useful without being able to manage columns as well (i.e. issue status).
//     So projects are constructed by hand, as are columns.  MakeCol currently is simply verifying existence.
// XXXXXXXXXXXXXXXXXXXXXXXXX

// Adding a small sleep in each gh2tu.make* - GH seems to get confused if requests come in too fast
async function createPreferredCEProjects( authData, ghLinks, td ) {
    console.log( "Building preferred CE project layout, a mini version" );
    
    // Modules: softwareContr, businessOps, unallocated
    td.masterPID  = await gh2tu.findOrCreateProject( authData, td, config.MAIN_PROJ, "Overall planned equity allocations, by category" );
    let mastCol1  = await gh2tu.makeColumn( authData, ghLinks, td.ceProjectId, td.GHFullName, td.masterPID, td.softContTitle );
    let mastCol2  = await gh2tu.makeColumn( authData, ghLinks, td.ceProjectId, td.GHFullName, td.masterPID, td.busOpsTitle );
    let mastCol3  = await gh2tu.makeColumn( authData, ghLinks, td.ceProjectId, td.GHFullName, td.masterPID, td.unallocTitle );

    // dataSec: 4x
    let dataPID  = await gh2tu.findOrCreateProject( authData, td, td.dataSecTitle, "Make PII safe" );
    let dataCols = await gh2tu.make4xCols( authData, ghLinks, td.ceProjectId, td.GHFullName, dataPID );

    // githubOPs: 4x
    let ghOpPID  = await gh2tu.findOrCreateProject( authData, td, td.githubOpsTitle, "Make it giddy" );
    let ghOpCols = await gh2tu.make4xCols( authData, ghLinks, td.ceProjectId, td.GHFullName, ghOpPID );
    await gh2tu.makeColumn( authData, ghLinks, td.ceProjectId, td.GHFullName, ghOpPID, "Stars" );	
    await gh2tu.makeColumn( authData, ghLinks, td.ceProjectId, td.GHFullName, ghOpPID, "Stripes" );

    // TRIGGER
    let nbi1     = await gh2tu.makeIssue( authData, td, "A special populate issue", [] );
    let card11   = await gh2tu.makeProjectCard( authData, ghLinks, td.ceProjectId, td.masterPID, mastCol1.hostColumnId, nbi1[0], true );
    let popLabel = await ghV2.findOrCreateLabel( authData, td.GHRepoId, false, config.POPULATE, -1 );
    let nbiDat   = [nbi1[0], nbi1[1], "A special populate issue"];
    await gh2tu.addLabel( authData, popLabel.id, nbiDat );       // ready.. set... Go!
    await utils.sleep( 1000 );

    // softCont: dataSecurity, githubOps, unallocated
    await gh2tu.makeAllocCard( authData, ghLinks, td.ceProjectId, td.GHRepoId, td.masterPID, mastCol1.hostColumnId, td.dataSecTitle, "1,000,000" );
    await gh2tu.makeAllocCard( authData, ghLinks, td.ceProjectId, td.GHRepoId, td.masterPID, mastCol1.hostColumnId, td.githubOpsTitle, "1,500,000" );
    await gh2tu.makeAllocCard( authData, ghLinks, td.ceProjectId, td.GHRepoId, td.masterPID, mastCol1.hostColumnId, td.unallocTitle, "3,000,000" );
    
    // busOps:  unallocated
    await gh2tu.makeAllocCard( authData, ghLinks, td.ceProjectId, td.GHRepoId, td.masterPID, mastCol2.hostColumnId, td.unallocTitle, "1,000,000" );
}

async function testPreferredCEProjects( authData, ghLinks, td ) {

    // [pass, fail, msgs]
    let subTest  = [ 0, 0, []];
    
    await gh2tu.refresh( authData, td, config.MAIN_PROJ );

    // Check DYNAMO PEQ table
    let ghPeqs =  await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId, "HostIssueTitle": td.githubOpsTitle });
    assert( ghPeqs.length > 0 ); // total fail if this fails
    subTest = tu.checkEq( ghPeqs.length, 1,                             subTest, "Number of githubOps peq objects" );
    subTest = tu.checkEq( ghPeqs[0].PeqType, config.PEQTYPE_ALLOC,      subTest, "PeqType" );
    subTest = tu.checkEq( ghPeqs[0].Amount, "1500000",                  subTest, "Peq Amount" );  
    subTest = tu.checkAr( ghPeqs[0].HostProjectSub, [td.softContTitle], subTest, "Project sub" );
    subTest = tu.checkEq( ghPeqs[0].HostProjectId, td.masterPID,        subTest, "Project ID" );  
    
    let dsPeqs =  await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId, "HostIssueTitle": td.dataSecTitle });
    subTest = tu.checkEq( dsPeqs.length, 1,                             subTest, "Number of datasec peq objects" );
    subTest = tu.checkEq( typeof dsPeqs[0] !== 'undefined', true,       subTest, "Peq not in place yet" );
    if( typeof dsPeqs[0] !== 'undefined' ) {
	subTest = tu.checkEq( dsPeqs[0].PeqType, config.PEQTYPE_ALLOC,      subTest, "PeqType" );
	subTest = tu.checkAr( dsPeqs[0].HostProjectSub, [td.softContTitle], subTest, "Project sub" );
    }
	
    let unPeqs =  await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId, "HostIssueTitle": td.unallocTitle });
    subTest = tu.checkEq( unPeqs.length, 2,                            subTest, "Number of unalloc peq objects" );
    subTest = tu.checkEq( unPeqs[0].PeqType, config.PEQTYPE_ALLOC,     subTest, "PeqType" );
    subTest = tu.checkEq( typeof unPeqs[0] !== 'undefined', true,      subTest, "have unpeq 0" );
    subTest = tu.checkEq( typeof unPeqs[1] !== 'undefined', true,      subTest, "have unpeq 1" );

    if( typeof dsPeqs[0] !== 'undefined' && unPeqs[0] !== 'undefined' && typeof unPeqs[1] !== 'undefined' ) {
	
	let busTest = unPeqs[0].HostProjectSub.includes(td.busOpsTitle) || unPeqs[1].HostProjectSub.includes( td.busOpsTitle );
	subTest = tu.checkEq( busTest, true,                              subTest, "Project subs for unalloc" );    
	
	
	// Check DYNAMO PAct
	// New makeAlloc has add, then relocate.  Order may vary.
	let pacts = await awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
	subTest = tu.checkGE( pacts.length, 4,         subTest, "Number of PActs" );
	let foundPActs = 0;
	for( pact of pacts ) {
	    let hasRaw = await tu.hasRaw( authData, pact.PEQActionId );
	    subTest = tu.checkEq( pact.Ingested, "false",                     subTest, "PAct ingested" );
	    subTest = tu.checkEq( pact.Locked, "false",                       subTest, "PAct locked" );
	    subTest = tu.checkEq( hasRaw, true,                               subTest, "PAct Raw match" );
	    subTest = tu.checkEq( pact.Verb, config.PACTVERB_CONF,            subTest, "PAct Verb"); 
	    subTest = tu.checkEq( pact.HostUserName, config.TEST_ACTOR,       subTest, "PAct user name" ); 
	    
	    if( pact.Subject[0] == ghPeqs[0].PEQId && pact.Action == config.PACTACT_ADD   ||
		pact.Subject[0] == ghPeqs[0].PEQId && pact.Action == config.PACTACT_RELO  ||
		pact.Subject[0] == dsPeqs[0].PEQId && pact.Action == config.PACTACT_ADD   ||
		pact.Subject[0] == dsPeqs[0].PEQId && pact.Action == config.PACTACT_RELO  ||
		pact.Subject[0] == unPeqs[0].PEQId && pact.Action == config.PACTACT_ADD   ||
		pact.Subject[0] == unPeqs[0].PEQId && pact.Action == config.PACTACT_RELO  ) {
		foundPActs++;
	    }
	}
	subTest = tu.checkEq( foundPActs, 6,           subTest, "Matched PActs with PEQs" );
	
	// Check DYNAMO RepoStatus
	let pop = await awsUtils.checkPopulated( authData, td.ceProjectId );
	subTest = tu.checkEq( pop, "true", subTest, "Repo status wrt populated" );
	
	
	// Check GITHUB Labels
	let peqLabels = await gh2tu.getLabels( authData, td );
	subTest = tu.checkGE( peqLabels.length, 3,   subTest, "Peq Label count" );
	let foundLabs = 0;
	for( label of peqLabels ) {
	    if( ghUtils.parseLabelDescr( [label.description] ) == 1000000 ) {
		subTest = tu.checkEq( label.description.includes( "Allocation" ), true, subTest, "Peq label descr" );
		foundLabs++;
	    }
	    else if( ghUtils.parseLabelDescr( [label.description] ) == 1500000 ) { foundLabs++; }
	    else if( ghUtils.parseLabelDescr( [label.description] ) == 3000000 ) { foundLabs++; }
	}
	subTest = tu.checkEq( foundLabs, 3,   subTest, "Peq Label matching peq amounts" );
	
	
	// Check GITHUB Issues
	let issues = await gh2tu.getIssues( authData, td );
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
	let projects = await gh2tu.getProjects( authData, td );
	subTest = tu.checkGE( projects.length, 3,     subTest, "Project count" );
	let foundProj = 0;
	for( const proj of projects ) {
	    if( proj.title == config.MAIN_PROJ ) {
		td.masterPID = proj.id;
		foundProj++;
	    }
	    if( proj.title == td.dataSecTitle )   {
		td.dataSecPID = proj.id;
		foundProj++;
	    }
	    if( proj.title == td.githubOpsTitle ) {
		td.githubOpsPID = proj.id;
		foundProj++;
	    }  
	}
	subTest = tu.checkEq( foundProj, 3,       subTest, "Matching project count" );
	
	
	// Check GITHUB Columns
	// td.show();
	let mastCols = await gh2tu.getColumns( authData, td.masterPID  );
	let dsCols   = await gh2tu.getColumns( authData, td.dataSecPID  );
	let ghCols   = await gh2tu.getColumns( authData, td.githubOpsPID  );
	
	subTest = tu.checkEq( mastCols.length, 3,   subTest, "Master proj col count" );
	subTest = tu.checkEq( dsCols.length, 4,     subTest, "Data security proj col count" );
	subTest = tu.checkEq( ghCols.length, 6,     subTest, "Github ops proj col count" );

	let colNames = mastCols.map((col) => col.name );
	subTest = tu.checkEq( colNames.includes( td.softContTitle ), true,   subTest, "Master col names" );
	subTest = tu.checkEq( colNames.includes( td.busOpsTitle ),   true,   subTest, "Master col names" );
	subTest = tu.checkEq( colNames.includes( td.unallocTitle ),  true,   subTest, "Master col names" );
	
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
	let scCards = await gh2tu.getCards( authData, td.masterPID, td.scColID );
	let boCards = await gh2tu.getCards( authData, td.masterPID, td.boColID );
	let noCards = await gh2tu.getCards( authData, td.masterPID, td.unColID );
	
	subTest = tu.checkEq( scCards.length, 4, subTest, "Soft cont col card count" );
	subTest = tu.checkEq( boCards.length, 1, subTest, "Bus ops col card count" );
	subTest = tu.checkEq( noCards.length, 0, subTest, "Unalloc col card count" );
	
	// Check a random col
	let rn2 = Math.floor(Math.random() * 2); // (0,1)
	let rn4 = Math.floor(Math.random() * 4);
	console.log( "rands", rn2, rn4 );
	let cols    = dsCols;
	let randPID = td.dataSecPID;
	if( rn2 == 1 )  { cols = ghCols; randPID = td.githubOpsPID; }
	noCards = await gh2tu.getCards( authData, randPID, cols[rn4].id );
	subTest = tu.checkEq( noCards.length, 0, subTest, "Unalloc col card count" );

	
	// Check DYNAMO Linkage
	let links = await tu.getLinks( authData, ghLinks, { "ceProjId": td.ceProjectId, "repo": td.GHFullName } );
	subTest = tu.checkGE( links.length, 4, subTest, "Linkage count" );
	let unallocSoft = false;   let lSoft = -1;
	let unallocBus  = false;   let lBus  = -1;
	// td.show();
	let foundDS = 0;
	for( const link of links ) {
	    let found = false;
	    if( link.hostIssueId == td.githubOpsIss[0] ) {
		subTest = tu.checkEq( link.hostIssueNum, td.githubOpsIss[1],    subTest, "Linkage Issue num" );
		subTest = tu.checkEq( link.hostColumnName, td.softContTitle,    subTest, "Linkage Col name" );
		subTest = tu.checkEq( link.hostColumnId, td.scColID.toString(), subTest, "Linkage Col Id" );
		subTest = tu.checkEq( link.hostIssueName, td.githubOpsTitle,    subTest, "Linkage Card Title" );
		let cardId = gh2tu.findCardForIssue( scCards, link.hostIssueNum );
		subTest = tu.checkEq( link.hostCardId, cardId,                  subTest, "Linkage Card Id" );
		found = true;
	    }
	    else if( link.hostIssueId == td.dataSecIss[0] ) {
		subTest = tu.checkEq( link.hostIssueNum, td.dataSecIss[1],      subTest, "Linkage Issue num" );
		subTest = tu.checkEq( link.hostColumnName, td.softContTitle,    subTest, "Linkage Col name" );
		subTest = tu.checkEq( link.hostColumnId, td.scColID.toString(), subTest, "Linkage Col Id" );
		subTest = tu.checkEq( link.hostIssueName, td.dataSecTitle,      subTest, "Linkage Card Title" );
		let cardId = gh2tu.findCardForIssue( scCards, link.hostIssueNum );
		subTest = tu.checkEq( link.hostCardId, cardId,                  subTest, "Linkage Card Id" );
		found = true;
	    }
	    else if( link.hostIssueId == td.unallocIss1[0] ) {
		subTest = tu.checkEq( link.hostIssueNum, td.unallocIss1[1],  subTest, "Linkage Issue num" );
		subTest = tu.checkEq( link.hostIssueName, td.unallocTitle,   subTest, "Linkage Card Title" );
		if( link.hostColumnName == td.softContTitle ) { unallocSoft = true; lSoft = link.hostColumnId; }
		else                                        { unallocBus  = true; lBus  = link.hostColumnId; }
		found = true;
	    }
	    else if( link.hostIssueId == td.unallocIss2[0] ) {
		subTest = tu.checkEq( link.hostIssueNum, td.unallocIss2[1],  subTest, "Linkage Issue num" );
		subTest = tu.checkEq( link.hostIssueName, td.unallocTitle,   subTest, "Linkage Card Title" );
		if( link.hostColumnName == td.softContTitle ) { unallocSoft = true; lSoft = link.hostColumnId; }
		else                                        { unallocBus  = true; lBus  = link.hostColumnId; }
		found = true;
	    }
	    
	    if( link.hostIssueName == td.dataSecTitle ) { foundDS++; }
	    
	    if( found ) {
		subTest = tu.checkEq( link.hostProjectName, config.MAIN_PROJ, subTest, "Linkage Proj name" );
		subTest = tu.checkEq( link.hostProjectId, td.masterPID,       subTest, "Linkage Proj id" );
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
