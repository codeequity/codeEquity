const config = require( '../../../config' );

const utils  = require( '../../../utils/ceUtils' );

const tu     = require( '../../ceTestUtils' );

const testData = require( '../testData' );
const gh2tu    = require( './gh2TestUtils' );


const FLAT_PROJ = "A Pre-Existing Project";


async function createFlatProject( authData, testLinks, td ) {
    console.log( "Building a flat CE project layout, a mini version" );
    
    td.masterPID  = await gh2tu.createProjectWorkaround( authData, td, FLAT_PROJ, "" );
    let mastCol1  = await gh2tu.makeColumn( authData, testLinks, td.ceProjectId, td.GHFullName, td.masterPID, "Eggs" );
    let mastCol2  = await gh2tu.makeColumn( authData, testLinks, td.ceProjectId, td.GHFullName, td.masterPID, "Bacon" );
    let mastCol3  = await gh2tu.makeColumn( authData, testLinks, td.ceProjectId, td.GHFullName, td.masterPID, config.PROJ_COLS[config.PROJ_PLAN] );

    // i.e. draft issues
    await gh2tu.makeNewbornCard( authData, testLinks, td.ceProjectId, td.masterPID, mastCol1, "Parsley" );
    await gh2tu.makeNewbornCard( authData, testLinks, td.ceProjectId, td.masterPID, mastCol2, "Rosemary" );
    await gh2tu.makeNewbornCard( authData, testLinks, td.ceProjectId, td.masterPID, mastCol1, "Sage" );
}

async function testFlatProject( authData, testLinks, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    await gh2tu.refresh( authData, td, FLAT_PROJ );

    // Check DYNAMO Linkage.  Should be no relevant links.  No dynamo activity.
    let links = await tu.getLinks( authData, testLinks, { "ceProjId": td.ceProjectId, "repo": td.GHFullName } );
    let foundFlat = false;
    if( links == -1 ) { links = []; }

    for( const link of links ) {
	if( link.hostProjectName == FLAT_PROJ    ||
	    link.hostProjectID   == td.masterPID ||
	    link.hostColumnName  == "Eggs"       ||
	    link.hostColumnName  == "Bacon"      ||
	    link.hostColumnName  == "Bacon"      ||
	    link.hostCardName    == "Parsley"    ||
	    link.hostCardName    == "Sage"       ||
	    link.hostCardName    == "Rosemary"  )
	{
	    foundFlat = true;
	}
    }
    testStatus = tu.checkEq( foundFlat, false, testStatus, "Dynamo leakage" );
    
    
    // Check GITHUB Issues... weak test - only verify herbs were not issue-ified.
    let issues = await gh2tu.getIssues( authData, td );
    let foundIss = false;
    for( const issue of issues ) {
	if( issues.title == "Parlsey" || issues.title == "Rosemary" || issues.title == "Sage" ) {
	    foundIss = true;
	    break;
	}
    }
    testStatus = tu.checkEq( foundIss, false, testStatus, "Flat issues exist" );


    // Check GITHUB Projects
    let projects = await gh2tu.getProjects( authData, td );
    testStatus = tu.checkGE( projects.length, 1,     testStatus, "Project count" );
    let foundProj = 0;
    for( const proj of projects ) {
	if( proj.title == FLAT_PROJ ) {
	    td.masterPID = proj.id;
	    foundProj++;
	}
    }
    testStatus = tu.checkEq( foundProj, 1,       testStatus, "Matching project count" );

    
    // Check GITHUB Columns
    // Unfortunately, now need to pre-create PEND, ACCR.
    let mastCols   = await gh2tu.getColumns( authData, td.masterPID  );
    testStatus = tu.checkEq( mastCols.length, 5,   testStatus, "Master proj col count" );

    let colNames = mastCols.map((col) => col.name );
    testStatus = tu.checkEq( colNames.includes( "Eggs" ), true,    testStatus, "Col names" );
    testStatus = tu.checkEq( colNames.includes( "Bacon" ), true,   testStatus, "Col names" );

    let eggsId = -1;
    let baconId = -1;
    for( const col of mastCols ) {
	if     ( col.name == "Eggs" )  { eggsId  = col.id; }
	else if( col.name == "Bacon" ) { baconId = col.id; }
    }


    // Check GITHUB Cards
    let eggCards = await gh2tu.getCards( authData, td.masterPID, eggsId );
    let bacCards = await gh2tu.getCards( authData, td.masterPID, baconId );

    testStatus = tu.checkEq( eggCards.length, 2, testStatus, "Egg col card count" );
    testStatus = tu.checkEq( bacCards.length, 1, testStatus, "Bacon col card count" );

    return await tu.settle( testStatus, [0, 0, []], testFlatProject, authData, testLinks, td ); 
}


async function runTests( authData, testLinks, td ) {

    console.log( "Flat CE project structure =================" );

    let testStatus = [ 0, 0, []];

    await createFlatProject( authData, testLinks, td );
    await utils.sleep( 1000 );
    let t1 = await testFlatProject( authData, testLinks, td );

    testStatus = tu.mergeTests( testStatus, t1 );
    tu.testReport( testStatus, "Create Flat CE Projects" );
    
    return testStatus;
}


exports.runTests = runTests;
