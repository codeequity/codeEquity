const { App }     = require("@octokit/app");
const { Octokit } = require("@octokit/rest");
const { request } = require("@octokit/request");
const { retry } = require("@octokit/plugin-retry");

// Hmm.. this is looking very slow.  too bad.
const OctokitRetry = Octokit.plugin(retry);


const fetch = require("node-fetch");
const dotenv = require("dotenv");
var fs = require('fs'), json;
var assert = require('assert');

var config    = require('../../config');


// Generate an installationAccessToken, for use in creating installation client for GitHub API.
// base: name of github account, repository with installation of this github app
// repo:  name of a repository with GitHub App installed
// OR
// if this is for an organization,
// base is org, repo is undefined
async function getInstallationAccessToken(base, repo, app, jwt) {

    let loc = "";
    if( typeof repo === 'undefined' ) { loc = "https://api.github.com/orgs/"  + base              + "/installation"; }
    else                              { loc = "https://api.github.com/repos/" + base + "/" + repo + "/installation";}
    
    const result = await fetch( loc, 
			       {
				   headers: {
				       authorization: `Bearer ${jwt}`,
				       accept: 'application/vnd.github.machine-man-preview+json',
				   },
			       });

    const installationId = (await result.json()).id;
    // console.log( "GIAT", installationId, base, repo );
    if( typeof installationId === 'undefined' ) {
	console.log( "Warning.  Octokit can't find the app installation for", base, repo, ".  Is the app instead installed for your organization's account?" );
	return -1;
    }
	
    const installationAccessToken = await app.getInstallationAccessToken({ installationId });
    
    return installationAccessToken;
};



function getInstallationClientFromToken(installationAccessToken) {
    return new Octokit({ auth: `token ${installationAccessToken}` });
    //return new OctokitRetry({ auth: `token ${installationAccessToken}` });
}

async function getInstallationClient(owner, repo, actor) {

    // Both the codeEquity app, and the ceTester app are installed for local development, both are authorized against the github repo.
    // the codeEquity app contains the webServer - use those credentials for posting to GH, otherwise secondary notification filtering
    // doesn't work (i.e. we filter sender:codeequity[bot] notifications, but can't filter cetester[bot] notifications.  The name of the
    // sender, for bot posts, appears to be drawn from the installed app name.
    // Use ceTester creds for testing, codeEquity for everything else
    let credPath = config.CREDS_PATH;
    if( actor != config.CE_USER &&
	( owner == config.TEST_OWNER || owner == config.CROSS_TEST_OWNER || owner == config.MULTI_TEST_OWNER ) &&
	( repo == config.TEST_REPO   || repo == config.FLUTTER_TEST_REPO || repo == config.CROSS_TEST_REPO   || owner == config.MULTI_TEST_OWNER )) {
	credPath = config.CREDS_TPATH;
    }

    // console.log( "GIC", owner, repo );
    // console.log( "GIC", credPath );
    
    dotenv.config({ path: credPath });

    // console.log( "Dot results", process.env.GITHUB_APP_IDENTIFIER );
    // console.log( "Dot results", process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n') );
    
    // Initialize GitHub App with id:private_key pair and generate JWT which is used for application level authorization
    // Note: js dotenv is crazy stupid about reading the multiline pkey.  needed to add \n, make all 1 line, then strip 
    const app = new App({ id: process.env.GITHUB_APP_IDENTIFIER, privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n') });

    const jwt = app.getSignedJsonWebToken();

    // console.log( "GIC app", app );
    // console.log( "GIC jwt", jwt );

    installationAccessToken = await getInstallationAccessToken( owner, repo, app, jwt )
        .catch( e => {
	    console.log( "Get Install Client failed.", e );
	    return "";
	});

    console.log( "Get AUTH for", owner, repo, credPath, jwt.substring(0,15), installationAccessToken.substring( 0,50) );

    if( installationAccessToken == -1 ) { return -1; }
    return getInstallationClientFromToken(installationAccessToken);

}


async function getPAT( owner ) {
    let PAT = "";
    let fname = "";
    if(      owner == config.CE_USER )          { fname = config.SERVER_PAT_PATH; }
    else if( owner == config.TEST_OWNER )       { fname = config.TEST_PAT_PATH; }
    else if( owner == config.CROSS_TEST_OWNER ) { fname = config.CROSS_PAT_PATH; }
    else if( owner == config.MULTI_TEST_OWNER ) { fname = config.MULTI_PAT_PATH; }
    
    try { PAT = fs.readFileSync(fname, 'utf8'); }
    catch(e) { console.log('Error:', e.stack); }

    return PAT.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
}

exports.getInstallationAccessToken = getInstallationAccessToken;
exports.getInstallationClient      = getInstallationClient;
exports.getPAT                     = getPAT;
