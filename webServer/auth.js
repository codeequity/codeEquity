const { App }     = require("@octokit/app");
const { Octokit } = require("@octokit/rest");
const { request } = require("@octokit/request");

const fetch = require("node-fetch");
const dotenv = require("dotenv");

// XXX CONFIG FILE
// XXX army of one until fixed server?
dotenv.config({ path: '../../ops/github/auth/ghAppCredentials' })
//const result = dotenv.config({ encoding: 'utf8' });


// Initialize GitHub App with id:private_key pair and generate JWT which is used for application level authorization
// Note: js dotenv is crazy stupid about reading the multiline pkey.  needed to add \n, make all 1 line, then strip 
const app = new App({ id: process.env.GITHUB_APP_IDENTIFIER, privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n') });
const jwt = app.getSignedJsonWebToken();


// Generate an installationAccessToken, for use in creating installation client for GitHub API.
// onwer: name of github account, repository with installation of this github app
// repo:  name of a repository with GitHub App installed
async function getInstallationAccessToken(owner, repo) {
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

async function getInstallationClient(owner, repo) {
    installationAccessToken = await getInstallationAccessToken( owner, repo );
    return getInstallationClientFromToken(installationAccessToken);
}


exports.getInstallationAccessToken = getInstallationAccessToken;
exports.getInstallationClient      = getInstallationClient;
