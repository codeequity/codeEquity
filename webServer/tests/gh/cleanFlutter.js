var assert = require( 'assert' );

const awsAuth = require( '../../auth/aws/awsAuth' );
const auth    = require( '../../auth/gh/ghAuth' );
const config  = require( '../../config' );

const awsUtils = require( '../../utils/awsUtils' );

const testData  = require( './testData' );
const authDataC = require( '../../auth/authData' );


async function clearIngested( authData, td ) {
    let success = await awsUtils.clearIngested( authData, { "CEProjectId": td.CEProjectId });
}

async function clearSummary( authData, td ) {
    const sums = await awsUtils.getSummaries( authData, { "CEProjectId": td.CEProjectId });
    if( sums != -1 ) {
	const sumIds = sums.map( summary => [summary.PEQSummaryId] );    
	console.log( "Clearing summaries for", sumIds );
	await awsUtils.cleanDynamo( authData, "CEPEQSummary", sumIds );
    }
}

async function runTests() {

    console.log( "Clear ceFlutter testing environment in AWS" );

    // TEST_REPO auth
    let td          = new testData.TestData();
    td.ghOwner      = config.TEST_OWNER;
    td.actor        = config.TEST_ACTOR;
    td.ghRepo       = config.FLUTTER_TEST_REPO;
    td.ghFullName   = td.ghOwner + "/" + td.ghRepo;

    let authData     = new authDataC.AuthData();
    authData.who     = "<TEST: Main> ";
    authData.ic      = await auth.getInstallationClient( td.actor, td.ghRepo, td.ghOwner );
    authData.api     = awsUtils.getAPIPath() + "/find";
    authData.cog     = await awsAuth.getCogIDToken();
    authData.cogLast = Date.now();        
    authData.pat     = await auth.getPAT( td.actor );

    let promises = [];
    promises.push( clearIngested( authData, td ) );
    promises.push( clearSummary( authData, td ) );
    await Promise.all( promises );
}


// npm run cleanFlutter
runTests();
