var utils = require('../utils');
const tu  = require('./testUtils');

const execSync = require('child_process').execSync;


// time stamp is on file.  just want limited queue.  Easiest is by hour.
function execAWS_CLI( table ) {
    let success = true;
    let stamp = utils.getMillis( true )
    console.log( "Saving AWS Dynamo table:", table );

    // cmd = "aws dynamodb scan --table-name CEPEQs | jq '{"Ownerships": [.Items[] | {PutRequest: {Item: .}}]}' > testData/testDataCEPEQS.json"
    let cmd = "aws dynamodb scan --table-name " + table + " | jq ";
    cmd    += "'{\"" + table + "\": [.Items[] | {PutRequest: {Item: .}}]}' > tests/testData/dynamo" + table + "_" + stamp + ".json";

    // XXX Currently, if the tablename is bad, scan generates empty input to jq, which then file redirects as told.  No errors.
    //     Will need to check for empty result to make sure we got something.
    execSync( cmd, { encoding: 'utf-8' });
    return success;
}


// NOTE: Will need to be set up to run createCE.py (i.e. aws cli, etc) in order to run this.
async function runTests( ) {

    let testStatus = [ 0, 0, []];
    let success = false;

    // success = execAWS_CLI( "CEPEQs" );
    success = execAWS_CLI( "CEPkljsdjkhdgs" );
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

    // XXX kill linkage, cequeue
    // XXX ??? cegithub

    return testStatus
}


exports.runTests = runTests;
