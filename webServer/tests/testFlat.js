var utils = require('../utils');
var config  = require('../config');

const testData = require( './testData' );
const tu = require('./testUtils');


// XXX use td names
const FLAT_PROJ = "A Pre-Existing Project";


async function createFlatProject( installClient, td ) {
    console.log( "Building a flat CE project layout, a mini version" );
    
    td.masterPID  = await tu.makeProject( installClient, td, FLAT_PROJ, "" );

    let mastCol1  = await tu.makeColumn( installClient, td.masterPID, "Eggs" );
    let mastCol2  = await tu.makeColumn( installClient, td.masterPID, "Bacon" );

    await tu.makeNewbornCard( installClient, mastCol1, "Parsley" );
    await tu.makeNewbornCard( installClient, mastCol2, "Rosemary" );
    await tu.makeNewbornCard( installClient, mastCol1, "Sage" );
    
}

async function testFlatProject( installClient, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    await tu.refresh( installClient, td, FLAT_PROJ );

    // Check DYNAMO Linkage.  Should be no relevant links.  No dynamo activity.
    let links = await utils.getLinks( installClient[1], td.GHFullName );
    let foundFlat = false;
    for( const link of links ) {
	if( link.GHProjectName == FLAT_PROJ    ||
	    link.GHProjectID   == td.masterPID ||
	    link.GHColumnName  == "Eggs"       ||
	    link.GHColumnName  == "Bacon"      ||
	    link.GHColumnName  == "Bacon"      ||
	    link.GHCardName    == "Parsley"    ||
	    link.GHCardName    == "Sage"       ||
	    link.GHCardName    == "Rosemary"  )
	{
	    foundFlat = true;
	}
    }
    testStatus = tu.checkEq( foundFlat, false, testStatus, "Dynamo leakage" );
    
    
    // Check GITHUB Issues... weak test - only verify herbs were not issue-ified.
    let issues = await tu.getIssues( installClient, td );
    let foundIss = false;
    for( const issue of issues ) {
	if( issues.title == "Parlsey" || issues.title == "Rosemary" || issues.title == "Sage" ) {
	    foundIss = true;
	    break;
	}
    }
    testStatus = tu.checkEq( foundIss, false, testStatus, "Flat issues exist" );


    // Check GITHUB Projects
    let projects = await tu.getProjects( installClient, td );
    testStatus = tu.checkGE( projects.length, 1,     testStatus, "Project count" );
    let foundProj = 0;
    for( const proj of projects ) {
	if( proj.name == FLAT_PROJ ) {
	    td.masterPID = proj.id;
	    foundProj++;
	}
    }
    testStatus = tu.checkEq( foundProj, 1,       testStatus, "Matching project count" );

    
    // Check GITHUB Columns
    let mastCols   = await tu.getColumns( installClient, td.masterPID  );
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
    let eggCards = await tu.getCards( installClient, eggsId );
    let bacCards = await tu.getCards( installClient, baconId );

    testStatus = tu.checkEq( eggCards.length, 2, testStatus, "Egg col card count" );
    testStatus = tu.checkEq( bacCards.length, 1, testStatus, "Bacon col card count" );

    tu.testReport( testStatus, "Create preferred CE Projects" );
}


async function runTests( installClient ) {

    let td = new testData.TestData();
    td.GHOwner      = config.TEST_OWNER;
    td.GHRepo       = config.TEST_REPO;
    td.GHFullName   = td.GHOwner + "/" + td.GHRepo;

    console.log( "Flat CE project structure =================" );

    await createFlatProject( installClient, td );
    await utils.sleep( 1000 );
    await testFlatProject( installClient, td );

}


exports.runTests = runTests;
