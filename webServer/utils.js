var config    = require('./config');
const auth    = require( "./auth" );
const awsAuth = require( "./awsAuth" );
var fetch     = require('node-fetch');

// read apiBasePath
// XXX combine
var fs = require('fs'), json;


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
function getCEServer() {
    let fname = config.CESERVER_CONFIG_LOC;
    try {
	let data = fs.readFileSync(fname, 'utf8');
	let jdata = JSON.parse( data );
	// console.log(jdata);

	let rdata = { 'Username': jdata['Username'],
		      'Password': jdata['Password'] };

	return rdata;
    } catch(e) {
	console.log('Error:', e.stack);
    }
}

// XXX Gimme a fname
async function getRemotePackageJSONObject(owner, repo, installationAccessToken) {
    // const installationClient = await auth.getInstallationClient(installationAccessToken);
    const installationClient = await auth.getInstallationClient(owner, repo);
    const fileData = await installationClient.repos.getContents({
	owner,
	repo,
	path: 'package.json',
    });
    const fileObject = JSON.parse(Buffer.from(fileData.data.content, 'base64').toString());
    return fileObject;
};


// XXX unused, untested as of yet.
// XXX naming convention
async function getGH( url ) {

    const params = {
        url: url,
	method: "GET",
        headers: {'contentTypeHeader': 'application/json' }
    };
    
    return fetch( url, params )
	.then((res) => {
	    console.log( res );
	    return res;
	})
	.catch(err => console.log(err));
}

// XXX This is called many times during one create/move.  Should keep where possible.
async function postIt( source, shortName, postData ) {
    let apiPath = getAPIPath() + "/find";
    let idToken = await awsAuth.getCogIDToken();
    // console.log( "postIt:", shortName, postData );
    console.log( source, "postIt:", shortName );
    
    const params = {
        url: apiPath,
	method: "POST",
        headers: { 'Authorization': idToken },
        body: postData
    };

    return fetch( apiPath, params )
	.then((res) => {
	    return res;
	})
	.catch(err => console.log(err));
};


async function getFromIssue( source, issueId ) {
    console.log( source, "Get card data from issue:", issueId );

    let shortName = "GetGHCard";
    let postData = `{ "Endpoint": "${shortName}", "GHIssueId": "${issueId}" }`;

    let response = await postIt( source, shortName, postData )
    if( typeof response === 'undefined' ) return null;
    
    if (response['status'] == 201) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else if (response['status'] == 204) {
	console.log(source, "Issue not found.", response['status'] );
	return -1;
    }
    else {
	console.log(source, "Unhandled status code:", response['status'] );
	return -1;
    }
}

// Note - this returns flat, json-style uninterpreted dynamo results 
async function getPeq( source, issueId ) {
    console.log( "Get PEQ from issueId:", issueId );

    let shortName = "GetPEQByIssue";
    let postData = `{ "Endpoint": "${shortName}", "GHIssueId": "${issueId}" }`;

    let response = await postIt( source, shortName, postData )
    if( typeof response === 'undefined' ) return null;
    
    if (response['status'] == 201) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else if (response['status'] == 204) {
	console.log("Issue not found.", response['status'] );
	return -1;
    }
    else {
	console.log("Unhandled status code:", response['status'] );
	return -1;
    }
}

async function getPeqFromTitle( source, repo, projId, title ) {
    console.log( source, "Get PEQ from title:", title, projId );

    let shortName = "GetPEQByTitle";
    let postData = `{ "Endpoint": "${shortName}", "GHRepo": "${repo}", "GHProjectId": "${projId}", "GHCardTitle": "${title}" }`;

    let response = await postIt( source, shortName, postData )
    if( typeof response === 'undefined' ) return null;
    
    if (response['status'] == 201) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else if (response['status'] == 204) {
	console.log("Issue not found.", response['status'] );
	return -1;
    }
    else {
	console.log("Unhandled status code:", response['status'] );
	return -1;
    }
}

// XXX dup boilerplate
async function getFromCardName( source, repoName, projName, cardTitle ) {
    console.log( source, "Get linkage from repo, card info", repoName, projName, cardTitle );

    let shortName = "GetGHCFromCard";
    let postData = `{ "Endpoint": "${shortName}", "GHRepo": "${repoName}", "GHProjName": "${projName}", "GHCardTitle": "${cardTitle}" }`;

    let response = await postIt( source, shortName, postData )
    if( typeof response === 'undefined' ) return null;
    
    if (response['status'] == 201) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else if (response['status'] == 204) {
	console.log(source, "Card data not found.", response['status'] );
	return -1;
    }
    else {
	console.log(source, "Unhandled status code:", response['status'] );
	return -1;
    }
}

// XXX dup boilerplate
async function getFromCardId( source, repo, cardId ) {
    console.log( source, "Get linkage from repo, card Id", repo, cardId );

    let shortName = "GetGHCardFID";
    let postData = `{ "Endpoint": "${shortName}", "GHRepo": "${repo}", "GHCardId": "${cardId}" }`;

    let response = await postIt( source, shortName, postData )
    if( typeof response === 'undefined' ) return null;
    
    if (response['status'] == 201) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else if (response['status'] == 204) {
	console.log(source, "Card data not found.", response['status'] );
	return -1;
    }
    else {
	console.log(source, "Unhandled status code:", response['status'] );
	return -1;
    }
}

// XXX Dup boilerplate
async function addIssueCard( repo, issueId, issueNum, projId, projName, colId, colName, newCardId, cardTitle ) {
    console.log( "Adding issue / card linkage", repo, issueId, projName, colId );

    let shortName = "RecordGHCard";
    let cardTitleStrip = cardTitle.replace(/[\x00-\x1F\x7F-\x9F]/g, "");   // was keeping invisible linefeeds
    
    let postData = { "GHRepo": repo };
    postData.GHIssueId     = issueId.toString();          // all headed into dynamo is String, future flexibility
    postData.GHProjectId   = projId.toString();
    postData.GHIssueNum    = issueNum.toString();
    postData.GHProjectName = projName;
    postData.GHColumnId    = colId.toString();
    postData.GHColumnName  = colName;
    postData.GHCardId      = newCardId.toString();
    postData.GHCardTitle   = cardTitleStrip;

    let pd = { "Endpoint": shortName, "icLink": postData };
    let response = await postIt( "", shortName, JSON.stringify( pd ))
    if( typeof response === 'undefined' ) return null;
    
    if (response['status'] == 201) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else {
	console.log("Unhandled status code:", response['status'] );
	let body = await response.json();
	// console.log("Body:", body);
	return body;
    }
}

// XXX handle move to new project?
async function updateCardFromIssue( source, issueId, newColId, newColName ) {
    console.log( source, "Updating issue / card linkage" );

    let shortName = "UpdateGHCard";
    let postData = `{ "Endpoint": "${shortName}", "GHIssueId": "${issueId}", "GHColumnId": "${newColId}", "GHColumnName": "${newColName}" }`;

    let response = await postIt( source, shortName, postData )
    if( typeof response === 'undefined' ) return null;
    
    if (response['status'] == 201) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else {
	console.log("Unhandled status code:", response['status'] );
	let body = await response.json();
	console.log(source, "Body:", body);
	return false;
    }
}

async function updateCardFromCardId( source, repo, cardId, colId, colName ) {
    console.log( source, "Updating issue / card linkage from cardId" );

    let shortName = "UpdateGHCardFID";
    let postData = `{ "Endpoint": "${shortName}", "GHRepo": "${repo}", "GHCardId": "${cardId}", "GHColumnId": "${colId}", "GHColumnName": "${colName}" }`;

    let response = await postIt( source, shortName, postData )
    if( typeof response === 'undefined' ) return null;
    
    if (response['status'] == 201) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else {
	console.log("Unhandled status code:", response['status'] );
	let body = await response.json();
	console.log(source, "Body:", body);
	return false;
    }
}


// also allow actionNote, i.e. 'issue reopened, not full CE project layout, no related card moved"
async function recordPEQAction( source, ceUID, ghUserName, ghRepo, verb, action, subject, note, entryDate, rawBody ) {
    console.log( source, "Recording PEQAction: ", verb, action );

    let shortName = "RecordPEQAction";

    let postData      = { "CEUID": ceUID, "GHUserName": ghUserName, "GHRepo": ghRepo };
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
    let response = await postIt( source, shortName, JSON.stringify( pd ))
    if( typeof response === 'undefined' ) return null;
    
    if (response['status'] == 201) {
	let body = await response.json();
 	console.log(source, "Good status.  Body:", body);
	return body;
    }
    else {
	console.log("Unhandled status code:", response['status'] );
	let body = await response.json();
	console.log(source, "Body:", body);
	return body;
    }
    
}


async function recordPEQ( source, amount, peqType, assignees, repo, projSub, projId, issueId, title ) {
    console.log( source, "Recording PEQ", peqType, amount, "PEQs for", title );

    // Erm.. model is defined in .dart.  Could jump through hoops to access it via public_flutter, buuuuut this is simpler?
    
    let shortName = "RecordPEQ";
    let titleStrip = title.replace(/[\x00-\x1F\x7F-\x9F]/g, "");   // was keeping invisible linefeeds

    let postData = {}

    if( peqType == "allocation" || peqType == "plan" ) {
	postData.CEGrantorId = config.EMPTY;
	postData.AccrualDate = config.EMPTY;
	postData.VestedPerc  = 0.0;
    }
    else
    {
	// XXX accrued - todo
    }

    postData.CEHolderId   = [];            // no access to this, yet
    postData.GHHolderId   = assignees;     
    postData.PeqType      = peqType;
    postData.Amount       = amount;
    postData.GHRepo       = repo;
    postData.GHProjectSub = projSub;
    postData.GHProjectId  = projId;
    postData.GHIssueId    = issueId;
    postData.GHIssueTitle = titleStrip;
    postData.Active       = "true";

    let pd = { "Endpoint": shortName, "newPEQ": postData };

    let response = await postIt( source, shortName, JSON.stringify( pd ))
    if( typeof response === 'undefined' ) return null;
    
    if (response['status'] == 201) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else {
	console.log("Unhandled status code:", response['status'] );
	let body = await response.json();
	// console.log("Body:", body);
	return -1;
    }
}

async function recordPEQTodo( blit, blot ) {
    console.log( "Musta hava sum tingy here" );
}

function getToday() {
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = today.getFullYear();
    
    today = mm + '/' + dd + '/' + yyyy;

    return today.toString();
}

exports.getGH = getGH;
exports.getCognito = getCognito;
exports.getCEServer = getCEServer;
exports.getRemotePackageJSONObject = getRemotePackageJSONObject;
exports.recordPEQAction = recordPEQAction;
exports.recordPEQ = recordPEQ;
exports.recordPEQTodo = recordPEQTodo;
exports.addIssueCard = addIssueCard;
exports.getFromIssue = getFromIssue;
exports.getFromCardName = getFromCardName;
exports.getFromCardId = getFromCardId;
exports.getPeq = getPeq;
exports.getPeqFromTitle = getPeqFromTitle;
exports.updateCardFromIssue = updateCardFromIssue;
exports.updateCardFromCardId = updateCardFromCardId;
exports.getToday = getToday;
