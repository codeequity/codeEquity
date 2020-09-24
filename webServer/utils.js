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


async function postIt( shortName, postData ) {
    let apiPath = getAPIPath() + "/find";
    let idToken = await awsAuth.getCogIDToken();
    console.log( "postIt:", shortName, postData );
    
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


async function getFromIssue( issueId ) {
    console.log( "Get card data from issue:", issueId );

    let shortName = "GetGHCard";
    let postData = `{ "Endpoint": "${shortName}", "GHIssueId": "${issueId}" }`;

    let response = await postIt( shortName, postData )
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

// XXX Dup boilerplate
async function addIssueCard( repo, issueId, projURL, colId, newCardId ) {
    console.log( "Adding issue / card linkage" );
    console.log( repo, issueId, projURL, projURL.split('/').pop(), colId, newCardId );

    let shortName = "RecordGHCard";
    let projId   = projURL.split('/').pop();
    let postData = `{ "Endpoint": "${shortName}", "GHRepo": "${repo}", "GHIssueId": "${issueId}", "GHProjectId": "${projId}", "GHColumnId": "${colId}", "GHCardId": "${newCardId}"  }`;

    let response = await postIt( shortName, postData )
    if( typeof response === 'undefined' ) return null;
    
    if (response['status'] == 201) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else {
	console.log("Unhandled status code:", response['status'] );
	let body = await response.json();
	console.log("Body:", body);
	return body;
    }
}

async function updateCardFromIssue( issueId, newColId ) {
    console.log( "Updating issue / card linkage" );

    let shortName = "UpdateGHCard";
    let postData = `{ "Endpoint": "${shortName}", "GHIssueId": "${issueId}", "GHColumnId": "${newColId}" }`;

    let response = await postIt( shortName, postData )
    if( typeof response === 'undefined' ) return null;
    
    if (response['status'] == 201) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else {
	console.log("Unhandled status code:", response['status'] );
	let body = await response.json();
	console.log("Body:", body);
	return false;
    }
}


// also allow actionNote, i.e. 'issue reopened, not full CE project layout, no related card moved"
async function recordPEQAction( ceUID, ghUserName, ghRepo, verb, action, subject, note, entryDate, rawBody ) {
    console.log( "Recording PEQAction: ", verb, action );

    let shortName = "RecordPEQAction";

    let postData      = { "CEUID": ceUID, "GHUserName": ghUserName, "GHRepo": ghRepo };
    postData.Verb     = verb;
    postData.Action   = action;
    postData.Subject  = subject; 
    postData.Note     = note;
    postData.Date     = entryDate;
    postData.RawBody  = rawBody;

    let pd = { "Endpoint": shortName, "newPAction": postData };
    let response = await postIt( shortName, JSON.stringify( pd ))
    if( typeof response === 'undefined' ) return null;
    
    if (response['status'] == 201) {
	let body = await response.json();
 	console.log("Good status.  Body:", body);
	return body;
    }
    else {
	console.log("Unhandled status code:", response['status'] );
	let body = await response.json();
	console.log("Body:", body);
	return body;
    }
    
}

async function recordPEQPlanned( amount, repo, projURL, issueId, title ) {
    console.log( "Recording PEQ Planned", amount, "PEQs for", title );

    // Erm.. model is defined in .dart.  Could jump through hoops to access it via public_flutter, buuuuut this is simpler?

    let nyet = "---";
    let shortName = "RecordPEQ";
    let postData         = { "CEHolderId": nyet, "CEGrantorId": nyet, "Type": nyet };
    postData.Amount      = amount;
    postData.AccrualDate = nyet;
    postData.VestedPerc  = nyet;
    postData.GHRepo      = repo;
    postData.GHProject   = projURL;    // XXX break into url, need name and master.   can already get id from aws
    postData.GHIssueId   = issueId;
    postData.Title       = title;

    let pd = { "Endpoint": shortName, "newPEQ": postData };

    let response = await postIt( shortName, JSON.stringify( pd ))
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

function getToday() {
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = today.getFullYear();
    
    today = mm + '/' + dd + '/' + yyyy;

    return today.toString();
}


exports.getCognito = getCognito;
exports.getCEServer = getCEServer;
exports.getRemotePackageJSONObject = getRemotePackageJSONObject;
exports.recordPEQAction = recordPEQAction;
exports.recordPEQPlanned = recordPEQPlanned;
exports.addIssueCard = addIssueCard;
exports.getFromIssue = getFromIssue;
exports.updateCardFromIssue = updateCardFromIssue;
exports.getToday = getToday;
