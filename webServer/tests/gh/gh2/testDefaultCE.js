const config = require( '../../../config' );

const utils  = require( '../../../utils/ceUtils' );

const tu     = require( '../../ceTestUtils' );

const testData = require( '../testData' );
const gh2tu    = require( './gh2TestUtils' );


const DEFAULT_PROJ = "A Default Layout for any CodeEquity Project";


async function createDefaultProject( authData, testLinks, td ) {
    console.log( "Building a default CE project layout, a mini version" );
}

async function testDefaultProject( authData, testLinks, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];
    return await tu.settle( testStatus, [0, 0, []], testDefaultProject, authData, testLinks, td ); 
}


// Can create a custom field with any columns
// Can create a new project by cloning from a template which was set as template by hand
// Link is not yet working.  Add col to existing field does not work.  Change to default field does not work.
async function runTests( authData, testLinks, td ) {

    console.log( "Default CE project structure =================" );

    let testStatus = [ 0, 0, []];
    
    // codeequity org: "O_kgDOA8JELg"
    // ariCETester:    "U_kgDOBP2eEw"
    // template:       "PVT_kwDOA8JELs4AS5_h"
    // a pre-existing: "PVT_kwDOA8JELs4APR2J"

    // Any of this in API?
    // https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/managing-your-views

    // This gives me a new field 'smuckers' with two columns, 'No smuckers', 'smee' and 'fee' in 'a pre-existing project'
    gh2tu.createCustomField( authData, "smuckers", "PVT_kwDOA8JELs4APR2J", [{ color: "GRAY", description: "smoo", name: "smee" }, { color: "GRAY", description: "fum", name: "fee" }] );

    // This should copy template into new project.. but puts it into user space, not under repo (should expect this).
    // let newPID = await gh2tu.cloneFromTemplate( authData, "O_kgDOA8JELg", "PVT_kwDOA8JELs4AS5_h", "a newbier project" );
    // await tu.linkProject( authData, td.ceProjectId, newPID, td.GHRepoId, td.GHFullName );

    
    return testStatus;
}


exports.runTests = runTests;
