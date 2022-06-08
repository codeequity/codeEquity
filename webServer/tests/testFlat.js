var utils = require('../utils');
var config  = require('../config');

const testData = require( './testData' );
const tu = require('./testUtils');


const FLAT_PROJ = "A Pre-Existing Project";


async function createFlatProject( authData, ghLinks, td ) {
    console.log( "Building a flat CE project layout, a mini version" );
    
    td.masterPID  = await tu.makeProject( authData, td, FLAT_PROJ, "" );
    let mastCol1  = await tu.makeColumn( authData, ghLinks, td.GHFullName, td.masterPID, "Eggs" );
    let mastCol2  = await tu.makeColumn( authData, ghLinks, td.GHFullName, td.masterPID, "Bacon" );

    await tu.makeNewbornCard( authData, ghLinks, td.GHFullName, mastCol1, "Parsley" );
    await tu.makeNewbornCard( authData, ghLinks, td.GHFullName, mastCol2, "Rosemary" );
    await tu.makeNewbornCard( authData, ghLinks, td.GHFullName, mastCol1, "Sage" );
}

async function testFlatProject( authData, ghLinks, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    await tu.refresh( authData, td, FLAT_PROJ );

    // Check DYNAMO Linkage.  Should be no relevant links.  No dynamo activity.
    let links = await tu.getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let foundFlat = false;
    if( links == -1 ) { links = []; }

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
    let issues = await tu.getIssues( authData, td );
    let foundIss = false;
    for( const issue of issues ) {
	if( issues.title == "Parlsey" || issues.title == "Rosemary" || issues.title == "Sage" ) {
	    foundIss = true;
	    break;
	}
    }
    testStatus = tu.checkEq( foundIss, false, testStatus, "Flat issues exist" );


    // Check GITHUB Projects
    let projects = await tu.getProjects( authData, td );
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
    let mastCols   = await tu.getColumns( authData, td.masterPID  );
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
    let eggCards = await tu.getCards( authData, eggsId );
    let bacCards = await tu.getCards( authData, baconId );

    testStatus = tu.checkEq( eggCards.length, 2, testStatus, "Egg col card count" );
    testStatus = tu.checkEq( bacCards.length, 1, testStatus, "Bacon col card count" );

    tu.testReport( testStatus, "Create preferred CE Projects" );
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
