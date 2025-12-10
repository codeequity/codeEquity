import assert from 'assert';

import * as utils from '../utils/ceUtils.js';
import * as tu    from '../tests/ceTestUtils.js';

//  var fs = require( 'fs' ), json;
import fs from 'fs';
import {execSync} from 'child_process';
import { mkdir } from 'node:fs/promises';


async function getJQSize() {
    let postData = {"Endpoint": "checkPoint", "Request": "getJobQCount" };
    let count = await utils.postCE( "checkPointHandler", JSON.stringify( postData ));
    return count;
}

async function closeJQ() {
    let postData = {"Endpoint": "checkPoint", "Request": "closeJobQ" };
    let retVal = await utils.postCE( "checkPointHandler", JSON.stringify( postData ));
    return retVal;
}

async function openJQ() {
    let postData = {"Endpoint": "checkPoint", "Request": "openJobQ" };
    let retVal = await utils.postCE( "checkPointHandler", JSON.stringify( postData ));
    return retVal;
}

async function summarizeJQ() {
    let postData = {"Endpoint": "checkPoint", "Request": "summarizeJQ" };
    let retVal = await utils.postCE( "checkPointHandler", JSON.stringify( postData ));
    return retVal;
}



// time stamp is on file.  just want limited queue.  Easiest is by hour.
// cmd = "aws dynamodb scan --table-name CEPEQs | jq '{"CEPEQA": [.Items[] | {PutRequest: {Item: .}}]}' > testData/testDataCEPEQS.json"
// cmd = "aws dynamodb scan --table-name CEHostUser --projection-expression "HostPlatform,HostUserName" | jq '{"CEHostUser": [.Items[] | {PutRequest: {Item: .}}]}' > ./testDataCEHostUser.json"
// cmd = "aws dynamodb scan --table-name CEPEQs --filter-expression "CEProjectId = :value" --expression-attribute-values '{":value": {"S": "CE_FlutTest_ks8asdlg42"}}'"
async function execAWS_CLI( table, cep, fexp, fval, fproj ) {

    let success = true;
    const d = new Date();
    let stamp = d.getDate().toString();
    console.log( "Saving AWS Dynamo table:", table );

    let dirName = "checkPoints/data/" + cep;
    
    let fname = dirName + "/dynamo" + table + "_" + stamp + ".json";
    let lname = dirName + "/dynamo" + table +"_latest"    + ".json";
	
    let cmd   = "aws dynamodb scan --table-name " + table;
    if( fexp != "" )
    {
	assert( fval != "" );
	cmd = cmd + " --filter-expression " + fexp + " --expression-attribute-values " + fval;
    }

    if( fproj != "" ) { cmd = cmd + " --projection-expression " + fproj; }

    cmd = cmd + " | jq ";
    cmd    += "'{\"" + table + "\": [.Items[] | {PutRequest: {Item: .}}]}' > ";

    // console.log( cmd );
    
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

async function writeTables( cev, cep ) {

    console.log( "Working on", cev, cep );
    let fexp  = "\"CEProjectId = :value\"";
    let fval  = "'{\":value\": {\"S\": \"" + cep + "\"}}'";
    let fproj = "";
	
    let success = true;
    let jsize   = 0;

    success = await execAWS_CLI( "CEPEQs", cep, fexp, fval, fproj );
    if( !success ) { console.log( "Failed save PEQ Table" ); }
    jsize = await getJQSize();

    success = await execAWS_CLI( "CEPEQActions", cep, fexp, fval, fproj );
    if( !success ) { console.log( "Failed save PAct Table" ); }
    jsize = await getJQSize();
    
    success = await execAWS_CLI( "CEPEQRaw", cep, fexp, fval, fproj );
    if( !success ) { console.log( "Failed save raw PAct Table" ); }
    jsize = await getJQSize();
    
    success = await execAWS_CLI( "CEProjects", cep, fexp, fval, fproj );
    if( !success ) { console.log( "Failed save Projects Table" ); }
    jsize = await getJQSize();
    
    success = await execAWS_CLI( "CELinkage", cep, fexp, fval, fproj );
    if( !success ) { console.log( "Failed save Linkage Table" ); }
    jsize = await getJQSize();
    
    fexp  = "\"PEQSummaryId = :value\"";
    success = await execAWS_CLI( "CEPEQSummary", cep, fexp, fval, fproj );
    if( !success ) { console.log( "Failed save Peq Summary Table" ); }
    jsize = await getJQSize();
    
    fexp  = "\"CEProfileId = :value\"";
    success = await execAWS_CLI( "CEProfileImage", cep, fexp, fval, fproj );
    if( !success ) { console.log( "Failed save Profile Image Table" ); }
    jsize = await getJQSize();
    
    // May have PATS.  Don't save this here
    fexp  = "\"contains( \"CEProjectIds\", :value )\"";
    fval  = "'{\":value\": {\"S\": \"" + cep + "\"}}'";
    fproj = " \"HostUserId,CEProjectIds,CEUserId,FutureCEProjects,HostPlatform,HostUserName\" ";
    success = await execAWS_CLI( "CEHostUser", cep, fexp, fval, fproj );
    if( !success ) { console.log( "Failed save HostUser Table" ); }
    jsize = await getJQSize();
    
    fexp  = "\"CEVentureId = :value\"";
    fval  = "'{\":value\": {\"S\": \"" + cev + "\"}}'";
    fproj = "";
    success = await execAWS_CLI( "CEVentures", cep, fexp, fval, fproj );
    if( !success ) { console.log( "Failed save CEVenture Table" ); }
    jsize = await getJQSize();
    
    fexp  = "\"EquityPlanId = :value\"";
    success = await execAWS_CLI( "CEEquityPlan", cep, fexp, fval, fproj );
    if( !success ) { console.log( "Failed save Equity Plan Table" ); }
    jsize = await getJQSize();
    
    fexp = "";
    fval = "";
    // All public info
    success = await execAWS_CLI( "CEPeople", cep, fexp, fval, fproj );
    if( !success ) { console.log( "Failed save People Table" ); }
    jsize = await getJQSize();
    
    /*
    // uninstantiated as of yet
    success = await execAWS_CLI( "CEAgreements", cep, fexp, fval, fproj );
    if( !success ) { console.log( "Failed save Agreements Table" ); }
    */

    return jsize;    
}


// NOTE: Will need to be set up to run createCE.py (i.e. aws cli, etc) in order to run this.
async function runCP( ) {


    // Ask ceServer if it is quiescent, if not, checkpointing fails
    let jqSize = await getJQSize();
    if( jqSize > 0 ) {
	console.log( "Error.  Checkpointing failed.  CEServer has pending jobs." );
	let jqReport = await summarizeJQ();
	console.log( jqReport );
	return false;
    }

    // otherwise, block the queue
    await closeJQ();

    // Don't read CEProjects table to get this.  Do not want to checkpoint test CEPs
    let ceProjects = ["CE_FlutTest_ks8asdlg42", "CE_ServTest_usda23k425", "CE_AltTest_hakeld80a2", "GarlicBeer_38fl0hlsjs", "BookShare_kd8fb.fl9s" ];
    let ceVentures = ["CE_TEST_Flut_abcde12345", "CE_TEST_Serv_abcde12345", "CE_TEST_Alt_abcde12345", "Connie_Create_4kd8gmc2jf", "BookShare_uvsi38fkg9" ];
    assert( ceProjects.length == ceVentures.length );
    
    // Create dirs once, array of promise.
    let promises = [];
    for( const cep of ceProjects ) {
	let dirName = "checkPoints/data/" + cep;
	promises.push( mkdir("./" + dirName, { recursive: true }) );
    }
    await Promise.all( promises )

    for( let i = 0; i < ceProjects.length; i++ ) {
	let jsize = await writeTables( ceVentures[i], ceProjects[i] );
	if( jsize > 0 ) {
	    console.log( "Error.  Checkpointing did not complete.  CEServer has pending jobs." );
	    let jqReport = await summarizeJQ();
	    console.log( jqReport );
	    break;
	}
    }

    // Let ceServer get back to normal
    await openJQ();
    return true;
}

// Switch to runCP rather than exports if npm run checkPoint
await runCP();
//export default runCP;
