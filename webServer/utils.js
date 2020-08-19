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
	console.log(data);
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
	console.log(jdata);

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
	console.log(jdata);

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


// XXX will save entire issue, plus pull out specific metadata (title, name, date, peq)
// action( add, remove, update )  verb( propose, confirm, reject)  assignees   sender(login)  date  raw_reqBody
// also allow actionNote, i.e. 'issue reopened, not full CE project layout, no related card moved"
// Assignees split evenly
async function recordPEQ( title, peqAmount ) {
    console.log( "Recording", peqAmount, "PEQs for", title );

    let shortName = "RecordPEQ";
    let postData = `{ "Endpoint": "${shortName}", "Title": "${title}", "PeqAmount": "${peqAmount}" }`;

    let response = await postIt( shortName, postData )
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

exports.getCognito = getCognito;
exports.getCEServer = getCEServer;
exports.getRemotePackageJSONObject = getRemotePackageJSONObject;
exports.recordPEQ = recordPEQ;
