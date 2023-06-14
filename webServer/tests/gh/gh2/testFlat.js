const config = require( '../../../config' );

const utils  = require( '../../../utils/ceUtils' );

const tu     = require( '../../ceTestUtils' );

const testData = require( '../testData' );
const gh2tu    = require( './gh2TestUtils' );


const FLAT_PROJ = "A Pre-Existing Project";


async function createFlatProject( authData, ghLinks, td ) {
    console.log( "Building a flat CE project layout, a mini version" );
    
    td.masterPID  = await gh2tu.findOrCreateProject( authData, td, FLAT_PROJ, "" );
    let mastCol1  = await gh2tu.makeColumn( authData, ghLinks, td.ceProjectId, td.GHFullName, td.masterPID, "Eggs" );
    let mastCol2  = await gh2tu.makeColumn( authData, ghLinks, td.ceProjectId, td.GHFullName, td.masterPID, "Bacon" );

    // i.e. draft issues
    await gh2tu.makeNewbornCard( authData, ghLinks, td.ceProjectId, td.masterPID, mastCol1, "Parsley" );
    await gh2tu.makeNewbornCard( authData, ghLinks, td.ceProjectId, td.masterPID, mastCol2, "Rosemary" );
    await gh2tu.makeNewbornCard( authData, ghLinks, td.ceProjectId, td.masterPID, mastCol1, "Sage" );
}

async function testFlatProject( authData, ghLinks, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    await gh2tu.refresh( authData, td, FLAT_PROJ );

    // Check DYNAMO Linkage.  Should be no relevant links.  No dynamo activity.
    let links = await tu.getLinks( authData, ghLinks, { "ceProjId": td.ceProjectId, "repo": td.GHFullName } );
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
    let mastCols   = await gh2tu.getColumns( authData, td.masterPID  );
    testStatus = tu.checkEq( mastCols.length, 2,   testStatus, "Master proj col count" );

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

    tu.testReport( testStatus, "Create Flat CE Projects" );
    return testStatus;
}


async function runTests( authData, ghLinks, td ) {

    console.log( "Flat CE project structure =================" );

    let testStatus = [ 0, 0, []];

    await createFlatProject( authData, ghLinks, td );
    await utils.sleep( 1000 );
    let t1 = await testFlatProject( authData, ghLinks, td );

    testStatus = tu.mergeTests( testStatus, t1 );
    return testStatus
}


exports.runTests = runTests;
