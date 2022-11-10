const fetch  = require( 'node-fetch' );
const assert = require( 'assert' );
const fs     = require( 'fs' ), json;    // read apiBasePath

const config = require( '../config' );


// aws lambda interface, stay sync
function getAPIPath() {
    let fname = config.APIPATH_CONFIG_LOC;
    try {
	var data = fs.readFileSync(fname, 'utf8');
	// console.log(data);
	return data;
    } catch(e) {
	console.log('Error:', e.stack);
    }
}

// aws auth, stay sync
function getCognito() {
    let fname = config.COGNITO_CONFIG_LOC;
    try {
	let data = fs.readFileSync(fname, 'utf8');
	let jdata = JSON.parse( data );
	// console.log(jdata);

	let rdata = { 'UserPoolId': jdata['CognitoUserPool']['Default']['PoolId'], 
		      'ClientId': jdata['CognitoUserPool']['Default']['AppClientId'],
		      'Region': jdata['CognitoUserPool']['Default']['Region'] };
	
	return rdata;
    } catch(e) {
	console.log('Error:', e.stack);
    }
}

// aws base accounts
function getCEServer() {
    let fname = config.CESERVER_CONFIG_LOC;
    try {
	let data = fs.readFileSync(fname, 'utf8');
	let jdata = JSON.parse( data );
	// console.log(jdata);

	if( !jdata.hasOwnProperty( "ceServer" ) || !jdata.ceServer.hasOwnProperty( "Username" ) ) {
	    console.log( "Error.  Data in ops/aws/auth/ceServerConfig.json is not well-constructed." )
	    console.log( "expecting something of the form: {\"ceServer\": {\"Username\": <username here>, \"Password\" : <passwd here>, \"Email\" : <email here> }}" );
	    assert( false );
	}
	
	let rdata = { 'Username': jdata.ceServer.Username,
		      'Password': jdata.ceServer.Password };

	return rdata;
    } catch(e) {
	console.log('Error:', e.stack);
    }
}

async function postAWS( authData, shortName, postData ) {

    // console.log( authData.who, "postAWS:", shortName );
    
    const params = {
        url: authData.api,
	method: "POST",
        headers: { 'Authorization': authData.cog },
        body: postData
    };

    return fetch( authData.api, params )
	.catch(err => console.log(err));
};

async function wrappedPostAWS( authData, shortName, postData ) {
    let response = await postAWS( authData, shortName, JSON.stringify( postData ))
    if( typeof response === 'undefined' ) return null;

    if( response['status'] == 504 && shortName == "GetEntries" ) {
	let retries = 0;
	while( retries < config.MAX_AWS_RETRIES && response['status'] == 504 ) {
	    console.log( authData.who, "Error. Timeout.  Retrying.", retries );
	    response = await postAWS( authData, shortName, JSON.stringify( postData ))
	    if( typeof response === 'undefined' ) return null;
	}
    }
    
    let tableName = "";
    if( shortName == "GetEntry" || shortName == "GetEntries" ) { tableName = postData.tableName; }
    
    if( response['status'] == 201 ) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else if( response['status'] == 204 ) {
	if( tableName != "CEPEQs" ) { console.log(authData.who, tableName, "Not found.", response['status'] ); }
	return -1;
    }
    else if( response['status'] == 422 ) {
	console.log(authData.who, "Semantic error.  Normally means more items found than expected.", response['status'] );
	return -1;
    }
    else {
	console.log("Unhandled status code:", response['status'] );
	let body = await response.json();
	console.log(authData.who, shortName, postData, "Body:", body);
	return -1;
    }
}

// Check for stored PAT.  Not available means public repo that uses ceServer PAT
async function getStoredPAT( authData, host, actor ) {
    console.log( authData.who, "Get stored PAT for:", host, actor );

    let shortName = "GetEntry";
    let query     = { "HostPlatform": host, "HostUserName": actor };
    let postData  = { "Endpoint": shortName, "tableName": "CEHostUser", "query": query };

    let repoStatus = await wrappedPostAWS( authData, shortName, postData );
    if( repoStatus == -1 ) { return -1; }
    else                   { return repoStatus.PAT; }
}

// XXX inconsistent caps
async function getPeq( authData, ceProjId, issueId, checkActive ) {
    console.log( authData.who, "Get PEQ from issueId:", ceProjId, issueId );
    let active = true;
    if( typeof checkActive !== 'undefined' ) { active = checkActive; }

    let shortName = "GetEntry";
    let query     = active ? { "CEProjectId": ceProjId, "HostIssueId": issueId.toString(), "Active": "true" } : { "CEProjectId": ceProjId, "HostIssueId": issueId.toString() }; 
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQs", "query": query };

    return await wrappedPostAWS( authData, shortName, postData );
}

async function removePEQ( authData, peqId ) {

    let shortName = "UpdatePEQ";
    let query = { "PEQId": peqId, "Active": "false" };

    let pd = { "Endpoint": shortName, "pLink": query };
    return await wrappedPostAWS( authData, shortName, pd );
}

async function updatePEQPSub( authData, peqId, projSub ) {
    console.log( authData.who, "Updating PEQ project sub", projSub.toString() );

    let shortName = "UpdatePEQ";

    let postData = {};
    postData.PEQId          = peqId.toString();
    postData.HostProjectSub = projSub;
    
    let pd = { "Endpoint": shortName, "pLink": postData }; 
    return await wrappedPostAWS( authData, shortName, pd );
}

// also allow actionNote, i.e. 'issue reopened, not full CE project layout, no related card moved"
async function recordPEQAction( authData, ceUID, hostUserName, ceProjId, verb, action, subject, note, entryDate, rawBody ) {
    console.log( authData.who, "Recording PEQAction: ", verb, action, ceUID );

    let shortName = "RecordPEQAction";

    let postData      = { "CEUID": ceUID, "HostUserName": hostUserName, "CEProjectId": ceProjId };
    postData.Verb     = verb;
    postData.Action   = action;
    postData.Subject  = subject; 
    postData.Note     = note;
    postData.Date     = entryDate;
    postData.RawBody  = JSON.stringify( rawBody );
    postData.Ingested  = "false";
    postData.Locked    = "false";
    postData.TimeStamp = JSON.stringify( Date.now() );

    let pd = { "Endpoint": shortName, "newPAction": postData };
    return await wrappedPostAWS( authData, shortName, pd );
}

async function checkPopulated( authData, ceProjId ) {
    console.log( authData.who, "check populated: ", repo );

    let shortName = "CheckSetHostPop";
    let postData = { "Endpoint": shortName, "CEProjectId": ceProjId, "Set": "false" };
    
    return await wrappedPostAWS( authData, shortName, postData );
}

async function setPopulated( authData, ceProjId ) {
    console.log( authData.who, "Set populated: ", repo );

    let shortName = "CheckSetHostPop";
    let postData = { "Endpoint": shortName, "CEProjectId": ceProjId, "Set": "true" };
    
    return await wrappedPostAWS( authData, shortName, postData );
}

async function rewritePAct( authData, postData ) {
    let shortName = "RecordPEQAction";

    let pd = { "Endpoint": shortName, "newPAction": postData };
    return await wrappedPostAWS( authData, shortName, pd );
}



/* Not in use.  Ingest does this work.
// XXX Note.   This must be guarded, at a minimum, not ACCR
async function updatePEQVal( authData, peqId, peqVal ) {
    console.log( authData.who, "Updating PEQ value after label split", peqVal );

    let shortName = "UpdatePEQ";

    let postData = {};
    postData.PEQId        = peqId.toString();
    postData.Amount       = peqVal;
    
    let pd = { "Endpoint": shortName, "pLink": postData }; 
    return await wrappedPostAWS( authData, shortName, pd );
}
*/


exports.getAPIPath   = getAPIPath;
exports.getCognito   = getCognito;
exports.getCEServer  = getCEServer;
exports.getStoredPAT = getStoredPAT;

exports.getPeq          = getPeq;
exports.removePEQ       = removePEQ;
exports.recordPEQAction = recordPEQAction;
exports.checkPopulated  = checkPopulated;
exports.setPopulated    = setPopulated;
exports.updatePEQPSub   = updatePEQPSub;
exports.rewritePAct     = rewritePAct;

