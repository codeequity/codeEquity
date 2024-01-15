const { App }     = require("@octokit/app");
const { Octokit } = require("@octokit/rest");
const { request } = require("@octokit/request");
const { retry }   = require("@octokit/plugin-retry");

// Hmm.. this is looking very slow.  too bad.
const OctokitRetry = Octokit.plugin(retry);

const fetch  = require("node-fetch");
const dotenv = require("dotenv");
var   fs     = require('fs'), json;
const assert = require('assert');

const ceAuth   = require( '../ceAuth' );
const config   = require( '../../config' );
const awsUtils = require( '../../utils/awsUtils' );

// Auths
var octokitClients = {};
var githubPATs     = {};


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

async function getInstallationClient(actor, repo, source) {

    // Both the codeEquity app, and the ceTester app are installed for local development, both are authorized against the github repo.
    // the codeEquity app contains the webServer - use those credentials for posting to GH, otherwise secondary notification filtering
    // doesn't work (i.e. we filter sender:codeequity[bot] notifications, but can't filter cetester[bot] notifications.  The name of the
    // sender, for bot posts, appears to be drawn from the installed app name.
    // Use ceTester creds for testing, codeEquity for everything else
    let credPath = config.CREDS_PATH;
    if( source != config.CE_ACTOR &&
	( actor == config.TEST_ACTOR || actor == config.CROSS_TEST_ACTOR || actor == config.MULTI_TEST_ACTOR ) &&
	( repo == config.TEST_REPO   || repo == config.FLUTTER_TEST_REPO || repo == config.CROSS_TEST_REPO   || actor == config.MULTI_TEST_ACTOR )) {
	credPath = config.CREDS_TPATH;
    }

    // console.log( "GIC", actor, repo );
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

    installationAccessToken = await getInstallationAccessToken( actor, repo, app, jwt )
        .catch( e => {
	    console.log( "Get Install Client failed.", e );
	    return "";
	});

    console.log( "Get AUTH for", actor, repo, credPath, jwt.substring(0,15), installationAccessToken.substring( 0,50) );

    if( installationAccessToken == -1 ) { return -1; }
    return getInstallationClientFromToken(installationAccessToken);

}


async function getPAT( actor ) {
    let PAT = "";
    let fname = "";
    if(      actor == config.CE_ACTOR )         { fname = config.SERVER_PAT_PATH; }
    else if( actor == config.TEST_ACTOR )       { fname = config.TEST_PAT_PATH; }
    else if( actor == config.CROSS_TEST_ACTOR ) { fname = config.CROSS_PAT_PATH; }
    else if( actor == config.MULTI_TEST_ACTOR ) { fname = config.MULTI_PAT_PATH; }
    
    try { PAT = fs.readFileSync(fname, 'utf8'); }
    catch(e) { console.log('Error:', e.stack); }

    return PAT.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
}



// Octokit using auth-token ATM, which expires every hour. Refresh as needed.
async function refreshAuths( authData, pms, host, org, actor) {

    const stamp = Date.now();

    if( pms == config.PMS_GHC ) {
	let repoParts = org.split('/');        // XXX rp[1] is undefined for orgs	
	if( stamp - octokitClients[host][org][actor].last > 3500000 ) {
	    console.log( "********  Old octo auth.. refreshing." );
	    octokitClients[host][org][actor].auth = await auth.getInstallationClient( actor, repoParts[1], config.CE_ACTOR );
	    authData.ic  = octokitClients[host][org][actor].auth;
	    octokitClients[host][org][actor].last = Date.now();
	}
    }
    return;
}



// Auths are kept in distinct host.org.actor buckets.  For example, Connie from CodeEquity on GitHub will have different perms than
//       Connie from CodeEquity on Atlassian.
// If private repo, get key from aws.  If public repo, use ceServer key.  if tester repos, use config keys.
// NOTE this is called from ceRouter, only.  
async function getAuths( authData, pms, org, actor ) {

    const host = config.HOST_GH;

    // console.log( "GHR auths", pms, org, actor );
    
    // Only relevant for classic projects (!!)  Even so, keep auth breakdown consistent between parts.
    // Need installation client from octokit for every actor/repo/jwt triplet.  
    //   jwt is per app install, 1 codeEquity for all.
    //   actor and repo can switch with notification.  need multiple.
    if( pms == config.PMS_GHC ) {
	if( !octokitClients.hasOwnProperty( host ) )            { octokitClients[host] = {};      }
	if( !octokitClients[host].hasOwnProperty( org ))        { octokitClients[host][org] = {}; }
	if( !octokitClients[host][org].hasOwnProperty( actor )) {
	    console.log( authData.who, "get octo", host, org, actor );  
	    // Wait later
	    let repoParts = org.split('/');        // only called for GHC, so repo exists
	    octokitClients[host][org][actor] = {};
	    octokitClients[host][org][actor].auth = getInstallationClient( repoParts[0], repoParts[1], config.CE_ACTOR ); 
	    octokitClients[host][org][actor].last = Date.now();
	}
    }

    
    if( !githubPATs.hasOwnProperty( host ))             { githubPATs[host] = {}; }
    if( !githubPATs[host].hasOwnProperty( org ))        { githubPATs[host][org] = {}; }
    if( !githubPATs[host][org].hasOwnProperty( actor )) {
	// Wait later
	let reservedUsers = [config.CE_ACTOR, config.TEST_ACTOR, config.CROSS_TEST_ACTOR, config.MULTI_TEST_ACTOR];
	// console.log( "Get PAT for", actor, "in", host, org );
	githubPATs[host][org][actor] = reservedUsers.includes( actor ) ?  getPAT( actor ) :  awsUtils.getStoredPAT( authData, host, actor );
    }
    githubPATs[host][org][actor] = await githubPATs[host][org][actor];
    // console.log( "PATTY", githubPATs[host][org][actor] );

    if( actor == config.GH_GHOST ) {
	console.log( "Skipping PAT acquisition for GitHub ghost action" );
    }
    else if( githubPATs[host][org][actor] == -1 ) {
	console.log( "Warning.  Did not find PAT for", host, org, actor );
	assert( false );
    }
    else { authData.pat = githubPATs[host][org][actor]; }

    authData.ic  = -1;
    if( pms == config.PMS_GHC ) {    
	octokitClients[host][org][actor].auth = await octokitClients[host][org][actor].auth;
	authData.ic  = octokitClients[host][org][actor].auth;
    }

    // Might have gotten older auths above.  Check stamp and refresh as needed.
    await refreshAuths( authData, host, pms, org, actor );
    
    return;
}


exports.getInstallationAccessToken = getInstallationAccessToken;
exports.getInstallationClient      = getInstallationClient;
exports.getPAT                     = getPAT;
exports.getAuths                   = getAuths;
