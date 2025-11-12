
import * as utils from '../utils/ceUtils.js';
import * as tu    from '../tests/ceTestUtils.js';

//  var fs = require( 'fs' ), json;
import fs from 'fs';
import {execSync} from 'child_process';
import { mkdir } from 'node:fs/promises';

// time stamp is on file.  just want limited queue.  Easiest is by hour.
// cmd = "aws dynamodb scan --table-name CEPEQs | jq '{"CEPEQA": [.Items[] | {PutRequest: {Item: .}}]}' > testData/testDataCEPEQS.json"
// cmd = "aws dynamodb scan --table-name CEHostUser --projection-expression "HostPlatform,HostUserName" | jq '{"CEHostUser": [.Items[] | {PutRequest: {Item: .}}]}' > ./testDataCEHostUser.json"
// cmd = "aws dynamodb scan --table-name CEPEQs --filter-expression "CEProjectId = :value" --expression-attribute-values '{":value": {"S": "CE_FlutTest_ks8asdlg42"}}'"
async function execAWS_CLI( table, cep ) {
    let success = true;
    const d = new Date();
    let stamp = d.getDate().toString();
    console.log( "Saving AWS Dynamo table:", table );

    let dirName = "checkPoints/data/" + cep;
    await mkdir("./" + dirName, { recursive: true });
    
    let fname = dirName + "/dynamo" + table + "_" + stamp + ".json";
    let lname = dirName + "/dynamo" + table +"_latest"    + ".json";
	
    // let cmd = "aws dynamodb scan --table-name " + table + " | jq ";
    let cmd   = "aws dynamodb scan --table-name " + table;
    cmd = cmd + " --filter-expression \"CEProjectId = :value\" --expression-attribute-values ";
    cmd = cmd + "'{\":value\": {\"S\": \"" + cep + "\"}}'";

    // Special case to eliminate PATs from hostUser table.  Not a secure fix, just a sloppy joe fix.
    // XXX Need different filtering.
    if( table == "CEHostUser" ) {
	cmd = cmd + " --projection-expression \"HostUserId,CEProjectIds,CEUserId,FutureCEProjects,HostPlatform,HostUserName\" ";
    }
    cmd = cmd + " | jq ";
    cmd    += "'{\"" + table + "\": [.Items[] | {PutRequest: {Item: .}}]}' > ";

    console.log( cmd );
    
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
async function runCP( ) {

    let testStatus = [ 0, 0, []];
    let success = false;

    // Don't read CEProjects table to get this.  Do not want to checkpoint test CEPs
    let ceProjects = ["CE_FlutTest_ks8asdlg42", "CE_ServTest_usda23k425", "CE_AltTest_hakeld80a2", "GarlicBeer_38fl0hlsjs", "BookShare_kd8fb.fl9s"]

    success = await execAWS_CLI( "CEHostUser", ceProjects[0] );
    testStatus = tu.checkEq( success, true, testStatus, "save PEQ Table" );

    return testStatus;

    // XXX
    // Create dirs once, array of promise.
    // Then, don't await here.

    // XXX pass filter expression in.  HostUser needs CONTAINS
    
    for( const cep of ceProjects ) {
	
	success = await execAWS_CLI( "CEPEQs", cep );
	testStatus = tu.checkEq( success, true, testStatus, "save PEQ Table" );
	
	success = await execAWS_CLI( "CEPEQActions", cep );
	testStatus = tu.checkEq( success, true, testStatus, "save PAct Table" );
	
	success = await execAWS_CLI( "CEPEQSummary", cep );
	testStatus = tu.checkEq( success, true, testStatus, "save Peq Summary Table" );
	
	success = await execAWS_CLI( "CEPEQRaw", cep );
	testStatus = tu.checkEq( success, true, testStatus, "save raw PAct Table" );
	
	success = await execAWS_CLI( "CEProjects", cep );
	testStatus = tu.checkEq( success, true, testStatus, "save Projects Table" );
	
	success = await execAWS_CLI( "CEPeople", cep );
	testStatus = tu.checkEq( success, true, testStatus, "save People Table" );
	
	success = await execAWS_CLI( "CEAgreements", cep );
	testStatus = tu.checkEq( success, true, testStatus, "save Agreements Table" );
	
	success = await execAWS_CLI( "CELinkage", cep );
	testStatus = tu.checkEq( success, true, testStatus, "save Linkage Table" );
	
	// XXX Has PATS.  Don't save this here, typically.
	success = await execAWS_CLI( "CEHostUser", cep );
	testStatus = tu.checkEq( success, true, testStatus, "save HostUser Table" );
	
	success = await execAWS_CLI( "CEProfileImage", cep );
	testStatus = tu.checkEq( success, true, testStatus, "save Profile Image Table" );
	
	success = await execAWS_CLI( "CEEquityPlan", cep );
	testStatus = tu.checkEq( success, true, testStatus, "save Equity Plan Table" );
	
	success = await execAWS_CLI( "CEVentures", cep );
	testStatus = tu.checkEq( success, true, testStatus, "save CEVenture Table" );
    }

    return testStatus
}

// Switch to runCP rather than exports if npm run checkPoint
runCP();
//export default runCP;
