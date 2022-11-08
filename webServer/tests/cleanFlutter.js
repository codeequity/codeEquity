var assert = require('assert');

const awsAuth = require( '../auth/aws/awsAuth' );
const auth = require( "../auth/gh/ghAuth");
const config  = require('../config');
const utils = require( "../utils");

const testData  = require( './testData' );
const authDataC = require( '../authData' );


async function clearIngested( authData, td ) {
    let success = await utils.clearIngested( authData, { "GHRepo": td.GHFullName });
}

async function clearSummary( authData, td ) {
    const sums = await utils.getSummaries( authData, { "GHRepo": td.GHFullName });
    if( sums != -1 ) {
	const sumIds = sums.map( summary => [summary.PEQSummaryId] );    
	console.log( "Clearing summaries for", sumIds );
	await utils.cleanDynamo( authData, "CEPEQSummary", sumIds );
    }
}

async function runTests() {

    console.log( "Clear ceFlutter testing environment in AWS" );

    // TEST_REPO auth
    let td          = new testData.TestData();
    td.GHOwner      = config.TEST_OWNER;
    td.GHRepo       = config.FLUTTER_TEST_REPO;
    td.GHFullName   = td.GHOwner + "/" + td.GHRepo;

    let authData     = new authDataC.AuthData();
    authData.who     = "<TEST: Main> ";
    authData.ic      = await auth.getInstallationClient( td.GHOwner, td.GHRepo, td.GHOwner );
    authData.api     = utils.getAPIPath() + "/find";
    authData.cog     = await awsAuth.getCogIDToken();
    authData.cogLast = Date.now();        
    authData.pat     = await auth.getPAT( td.GHOwner );

    let promises = [];
    promises.push( clearIngested( authData, td ) );
    promises.push( clearSummary( authData, td ) );
    await Promise.all( promises );
}


// npm run cleanFlutter
runTests();
