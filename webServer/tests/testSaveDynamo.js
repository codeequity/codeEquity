var fs = require('fs'), json;

var utils = require('../utils');
const tu  = require('./testUtils');

const execSync = require('child_process').execSync;


// time stamp is on file.  just want limited queue.  Easiest is by hour.
function execAWS_CLI( table ) {
    let success = true;
    let stamp = utils.getMillis( true )
    console.log( "Saving AWS Dynamo table:", table );

    // cmd = "aws dynamodb scan --table-name CEPEQs | jq '{"Ownerships": [.Items[] | {PutRequest: {Item: .}}]}' > testData/testDataCEPEQS.json"
    let fname = "tests/testData/dynamo" + table + "_" + stamp + ".json";
    let lname = "tests/testData/dynamo" + table +"_latest"    + ".json";
    let cmd = "aws dynamodb scan --table-name " + table + " | jq ";
    cmd    += "'{\"" + table + "\": [.Items[] | {PutRequest: {Item: .}}]}' > ";

    execSync( cmd + fname, { encoding: 'utf-8' });
    execSync( cmd + lname, { encoding: 'utf-8' });

    // if the tablename is bad, scan generates empty input to jq, which then file redirects as told.  No errors.
    // check for empty result to make sure we got something.
    let contents = "";
    try { contents = fs.readFileSync(fname, 'utf8'); }
    catch(e) {	console.log('Error:', e.stack);  }

    if( contents == "" ) { success = false; }
    return success;
}


// NOTE: Will need to be set up to run createCE.py (i.e. aws cli, etc) in order to run this.
async function runTests( ) {

    let testStatus = [ 0, 0, []];
    let success = false;

    success = execAWS_CLI( "CEPEQs" );
    testStatus = tu.checkEq( success, true, testStatus, "save PEQ Table" );

    success = execAWS_CLI( "CEPEQActions" );
    testStatus = tu.checkEq( success, true, testStatus, "save PAct Table" );

    success = execAWS_CLI( "CEPEQSummary" );
    testStatus = tu.checkEq( success, true, testStatus, "save Peq Summary Table" );

    success = execAWS_CLI( "CEPEQRaw" );
    testStatus = tu.checkEq( success, true, testStatus, "save raw PAct Table" );

    success = execAWS_CLI( "CERepoStatus" );
    testStatus = tu.checkEq( success, true, testStatus, "save Repo Status Table" );

    success = execAWS_CLI( "CEPeople" );
    testStatus = tu.checkEq( success, true, testStatus, "save People Table" );

    success = execAWS_CLI( "CEAgreements" );
    testStatus = tu.checkEq( success, true, testStatus, "save Agreements Table" );

    return testStatus
}


exports.runTests = runTests;
