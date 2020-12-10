const { App }     = require("@octokit/app");
const { Octokit } = require("@octokit/rest");
const { request } = require("@octokit/request");

const fetch = require("node-fetch");
const dotenv = require("dotenv");
var fs = require('fs'), json;

var config    = require('./config');


// Generate an installationAccessToken, for use in creating installation client for GitHub API.
// onwer: name of github account, repository with installation of this github app
// repo:  name of a repository with GitHub App installed
async function getInstallationAccessToken(owner, repo, app, jwt) {



    const result = await fetch(`https://api.github.com/repos/${owner}/${repo}/installation`,
			       {
				   headers: {
				       authorization: `Bearer ${jwt}`,
				       accept: 'application/vnd.github.machine-man-preview+json',
				   },
			       });
    
    const installationId = (await result.json()).id;
    const installationAccessToken = await app.getInstallationAccessToken({ installationId });

    return installationAccessToken;
};


function getInstallationClientFromToken(installationAccessToken) {
    return new Octokit({ auth: `token ${installationAccessToken}` });
}

async function getInstallationClient(owner, repo, source) {

    // Both the codeEquity app, and the ceTester app are installed for local development, both are authorized against the github repo.
    // the codeEquity app contains the webServer - use those credentials for posting to GH, otherwise secondary notification filtering
    // doesn't work (i.e. we filter sender:codeequity[bot] notifications, but can't filter cetester[bot] notifications.  The name of the
    // sender, for bot posts, appears to be drawn from the installed app name.
    let credPath = config.CREDS_PATH;
    if( source != config.CE_USER && owner == config.TEST_OWNER && repo == config.TEST_REPO ) {
	credPath = config.CREDS_TPATH;
    }
    
    dotenv.config({ path: credPath });
    
    // Initialize GitHub App with id:private_key pair and generate JWT which is used for application level authorization
    // Note: js dotenv is crazy stupid about reading the multiline pkey.  needed to add \n, make all 1 line, then strip 
    const app = new App({ id: process.env.GITHUB_APP_IDENTIFIER, privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n') });
    const jwt = app.getSignedJsonWebToken();

    installationAccessToken = await getInstallationAccessToken( owner, repo, app, jwt )
        .catch( e => {
	    console.log( "Get Install Client failed.", e );
	    return "";
	});

    return getInstallationClientFromToken(installationAccessToken);
}


async function getPAT( owner ) {
    let PAT = "";
    if( owner == config.TEST_OWNER ) {
	let fname = config.PAT_PATH;
	try { PAT = fs.readFileSync(fname, 'utf8'); }
	catch(e) { console.log('Error:', e.stack); }
    }
    return PAT.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
}

exports.getInstallationAccessToken = getInstallationAccessToken;
exports.getInstallationClient      = getInstallationClient;
exports.getPAT                     = getPAT;
