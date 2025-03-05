var assert = require( 'assert' );

var config = require( '../../../config' );

const utils    = require( '../../../utils/ceUtils' );
const awsUtils = require( '../../../utils/awsUtils' );
const ghUtils  = require( '../../../utils/gh/ghUtils' );

const tu       = require( '../../ceTestUtils' );

const gh2tu    = require( './gh2TestUtils' );

// XXXXXXXXXXXXXXXXXXXXXXXXX
//     2/2023
// XXX Until ghV2 allows us to make columns, much of this portion of the test is defunct.  We can make
//     projects, but that is not useful without being able to manage columns as well (i.e. issue status).
//     So projects are constructed by hand, as are columns.  MakeCol currently is simply verifying existence.
// XXXXXXXXXXXXXXXXXXXXXXXXX

// Adding a small sleep in each gh2tu.make* - GH seems to get confused if requests come in too fast
async function createPreferredCEProjects( authData, testLinks, td ) {
    console.log( "Building preferred CE project layout, a mini version" );

    // First build up aws CEProjects hostRepositories for repo: ceTesterAri
    await gh2tu.linkRepo( authData, td.ceProjectId, td.ghRepoId, td.ghFullName, td.cepDetails );

    // dataSec: 4x
    let dataPID  = await gh2tu.createProjectWorkaround( authData, td, td.dataSecTitle, "Make PII safe" );
    let dataCols = await gh2tu.make4xCols( authData, testLinks, td.ceProjectId, td.ghFullName, dataPID );

    // githubOPs: 4x
    let ghOpPID  = await gh2tu.createProjectWorkaround( authData, td, td.githubOpsTitle, "Make it giddy" );
    let ghOpCols = await gh2tu.make4xCols( authData, testLinks, td.ceProjectId, td.ghFullName, ghOpPID );
    await gh2tu.makeColumn( authData, testLinks, td.ceProjectId, td.ghFullName, ghOpPID, "Stars" );	
    await gh2tu.makeColumn( authData, testLinks, td.ceProjectId, td.ghFullName, ghOpPID, "Stripes" );

    await tu.settleWithVal( "checkPopulated", awsUtils.checkPopulated, authData, td.ceProjectId, td.ghRepoId ); 
    
    // This should NOT be needed.  But last makeAlloc above can be unfinished by the time test runs (i.e. can get card, but field is not yet available).
    // This rare sluggishness happened 6/30/23
    await utils.sleep( 1000 );
}

async function testPreferredCEProjects( authData, testLinks, td ) {

    // [pass, fail, msgs]
    let subTest  = [ 0, 0, []];
    
    // Check GITHUB Projects
    let projects = await gh2tu.getProjects( authData, td );
    subTest = tu.checkGE( projects.length, 2,     subTest, "Project count" );
    let foundProj = 0;
    for( const proj of projects ) {
	if( proj.title == td.dataSecTitle )   {
	    td.dataSecPID = proj.id;
	    foundProj++;
	}
	if( proj.title == td.githubOpsTitle ) {
	    td.githubOpsPID = proj.id;
	    foundProj++;
	}  
    }
    subTest = tu.checkEq( foundProj, 2,       subTest, "Matching project count" );
    
    // Check GITHUB Columns
    // td.show();
    let dsCols   = await gh2tu.getColumns( authData, td.dataSecPID  );
    let ghCols   = await gh2tu.getColumns( authData, td.githubOpsPID  );
	    
    subTest = tu.checkEq( dsCols.length, 4,     subTest, "Data security proj col count" );
    subTest = tu.checkGE( ghCols.length, 6,     subTest, "Github ops proj col count" );     // can't confirm exact, since can't create/delete cols
	    
    let colNames = dsCols.map((col) => col.name );
    subTest = tu.checkEq( colNames.includes( config.PROJ_COLS[0] ), true,   subTest, "Data sec col names" );
    subTest = tu.checkEq( colNames.includes( config.PROJ_COLS[1] ), true,   subTest, "Data sec  col names" );
    
    colNames = ghCols.map((col) => col.name );
    subTest = tu.checkEq( colNames.includes( config.PROJ_COLS[2] ), true,   subTest, "Github ops col names" );
    subTest = tu.checkEq( colNames.includes( config.PROJ_COLS[3] ), true,   subTest, "Github ops  col names" );
    
    // Check a random col
    let rn2 = Math.floor(Math.random() * 2); // (0,1)
    let rn4 = Math.floor(Math.random() * 4);
    console.log( "rands", rn2, rn4 );
    let cols    = dsCols;
    let randPID = td.dataSecPID;
    if( rn2 == 1 )  { cols = ghCols; randPID = td.githubOpsPID; }
    noCards = await gh2tu.getCards( authData, td.ghRepoId, randPID, cols[rn4].id );
    subTest = tu.checkEq( noCards.length, 0, subTest, "Unalloc col card count" );
    
    // Check DYNAMO Linkage.. no cards no links
    let links = await tu.getLinks( authData, testLinks, { "ceProjId": td.ceProjectId, "repo": td.ghFullName } );
    subTest = tu.checkEq( links, -1, subTest, "Empty Linkage" );

    return await tu.settle( subTest, [ 0, 0, []], testPreferredCEProjects, authData, testLinks, td );
}


async function runTests( authData, testLinks, td ) {

    console.log( "Preferred CE project structure =================" );

    let testStatus = [ 0, 0, []];

    await createPreferredCEProjects( authData, testLinks, td );
    await utils.sleep( 2000 );
    let t1 = await testPreferredCEProjects( authData, testLinks, td );

    testStatus = tu.mergeTests( testStatus, t1 );
    tu.testReport( testStatus, "Create preferred CE Projects" );
    // ghUtils.show( true );
    return testStatus;
}

//runTests();

exports.runTests = runTests;
