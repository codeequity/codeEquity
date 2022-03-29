var assert = require('assert');

const awsAuth = require( '../awsAuth' );
const auth = require( "../auth");
const config  = require('../config');
const utils = require( "../utils");

const ghUtils = require( "../ghUtils");
var gh      = ghUtils.githubUtils;
var ghSafe  = ghUtils.githubSafe;

const testData = require( './testData' );



async function getGHTestLabels( authData, td ) {
    let res = [];
    await gh.getRepoLabelsGQL( authData.pat, td.GHOwner, td.GHRepo, res, -1 );
    return res;
}

async function getGHTestIssues( authData, td ) {
    let res = [];
    await gh.getRepoIssuesGQL( authData.pat, td.GHOwner, td.GHRepo, res, -1 );
    return res;
}

function preIngestCheck( authData, ghLabels, ghIssues ) {

    if( ghLabels.length > 0 ) {
	console.log( "GH Labels: " );
	for( var label of ghLabels ) {
	    console.log( authData.who, label.labelName, "**", label.labelDesc, label.labelId );
	}
    }

    if( ghIssues.length > 0 ) {
	console.log( "GH Issues: " );
	for( var issue of ghIssues ) {
	    console.log( authData.who, issue.title, issue.number, issue.databaseId, issue.url );
	    for( var label of issue.labels ) {
		console.log( "                       ", label.labelName, "**", label.labelDesc, label.labelId );
	    }
	}
    }
}


// Testing consistency checks
// Get current state in GH  for ariCETester/CodeEquityTester
// Get current state in AWS for the same
// Identify differences
// Correct differences
// Repeat
async function runTests() {

    console.log( "Do GH & AWS agree on current state of ariCETester/CodeEquityTester?" );

    // TEST_REPO auth
    let td          = new testData.TestData();
    td.GHOwner      = config.TEST_OWNER;
    td.GHRepo       = config.TEST_REPO;
    td.GHFullName   = td.GHOwner + "/" + td.GHRepo;

    let authData = {};
    authData.who = "<SANITY: Main> ";
    authData.ic  = await auth.getInstallationClient( td.GHOwner, td.GHRepo, td.GHOwner );
    authData.api = utils.getAPIPath() + "/find";
    authData.cog = await awsAuth.getCogIDToken();
    authData.pat = await auth.getPAT( td.GHOwner );


    // Pre-ingest
    // Most of what is in aws:peq is outdated. No locations.  Can do:
    // CEPEQS
    //     * GH:(project labels) contain AWS:(amount).    1:1 peqLabel to issue.  When labeled, pushed to aws.  when re-activated, push to aws.
    //     * AWS:(peq.active=true).id   1:1 match  GH:(issue) && GH:(issue has peq label)
    //       - issueId match.  repo match.  That's it.
    //     * AWS:(peq.active=false).id !exist in GH:(issue s.t. issue has peq label)
    // CELinkage
    //     * GH:(issue has peq label).proj,col,repo exists in AWS with active=true
    //     * AWS(proj,col where active=true) has GH:(issue with peq label and matching proj,col,repo)

    let promises = [];
    let ghLabels = [];
    let ghIssues = [];
    promises.push( getGHTestLabels( authData, td ).then( res => ghLabels = res ));
    promises.push( getGHTestIssues( authData, td ).then( res => ghIssues = res ));
    await Promise.all( promises );

    preIngestCheck( authData, ghLabels, ghIssues );

    // Post-ingest
    //     * All pre-ingest tests remain true
    // CEPEQS
    //     * AWS:(peq.active=true).id   1:1 match  GH:(issue) && GH:(issue has peq label)
    //       - issueId match.  repo match.
    //       - AWS:GHHolderId == GH:assignees
    //       - AWS:ProjSub matches GH.location
    //       - AWS:(projectId, issueTitle) equals GH
    //       - AWS:amount  matches GH.peqLabel
    //       - AWS:peqType matches GH.peqLabel, status
    // CELinkage
    //     * identical to pre-ingest
    

}


// npm run sanityCheck
runTests();
