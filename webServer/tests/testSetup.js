const auth = require( "../auth");
var utils = require('../utils');
var ghUtils = require('../ghUtils');
var config  = require('../config');
var assert = require('assert');
const peqData = require( '../peqData' );

var gh = ghUtils.githubUtils;




async function runTests() {

    console.log( "Testing" );
    let pd = new peqData.PeqData();
    pd.GHOwner      = config.TEST_OWNER;
    pd.GHRepo       = config.TEST_REPO;

    // installClient is pair [installationAccessToken, creationSource]
    let token = await auth.getInstallationClient( pd.GHOwner, pd.GHRepo );
    let source = "<TEST: Setup> ";
    let installClient = [token, source];

    let issueData = await( gh.createIssue( installClient, pd.GHOwner, pd.GHRepo, "Look ma, no hands!", [], false ));
    console.log( issueData );

    if( issueData[0] > -1 ) { 
	let card = await( gh.createUnClaimedCard( installClient, pd.GHOwner, pd.GHRepo, issueData[0] ) );
	console.log( card );
    }



}

runTests();

// exports.runTests = runTests;
