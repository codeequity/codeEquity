var assert = require('assert');

const awsAuth   = require( '../awsAuth' );
const auth      = require( "../auth");
const config    = require('../config');
const utils     = require( "../utils");

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

async function getAWSTestPeqs( authData, td ) {
    let res = await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    return res;
}

async function getAWSTestLocs( authData, td ) {
    let res = await utils.getStoredLocs( authData, td.GHFullName );
    return res;
}


function showRaw( authData, ghLabels, ghIssues, awsPeqs, awsLocs ) {

    if( ghLabels.length > 0 ) {
	console.log( "GH Labels: " );
	for( var label of ghLabels ) {
	    console.log( authData.who, label.name, "**", label.description, label.id );
	}
    }

    if( ghIssues.length > 0 ) {
	console.log( "GH Issues: " );
	for( var issue of ghIssues ) {
	    console.log( authData.who, issue.issueTitle, issue.issueNumber, issue.issueId, issue.issueURL );
	    for( var label of issue.labels ) {
		console.log( "                       ", label.name, "**", label.description, label.id );
	    }
	}
    }

    if( awsPeqs.length > 0 ) {
	console.log( "AWS PEQ:" );
	for( var peq of awsPeqs ) {
	    console.log( authData.who, peq.GHIssueId, peq.GHIssueTitle, peq.Active, peq.PeqType );
	}
    }

    if( awsLocs.hasOwnProperty( 'Locations' ) && awsLocs.Locations.length > 0 ) {
	console.log( "AWS Link:" );
	let limit = 0;
	for( var loc of awsLocs.Locations ) {
	    console.log( loc.Active, loc.GHProjectId, loc.GHProjectName, loc.GHColumnId, loc.GHColumnName );
	    if( limit++ > 50 ) {
		break;
	    }
	}
    }
}

function preIngestCheck( authData, ghLabels, ghIssues, awsPeqs, awsLocs ) {

    showRaw( authData, ghLabels, ghIssues, awsPeqs, awsLocs );
    console.log( "\n\n\n");
    
    if( ghIssues.length > 0 ) {
	for( var issue of ghIssues ) {
	    [issue.peqValue,_] = ghSafe.theOnePEQ( issue.labels );
	}
    }
    
    
    // AWS:(peq.active=true).id   1:1 match  GH:(issue) && GH:(issue has a peq label, may not match amount.)
    let peqNoIss = [];
    let peqNoLab = [];    
    let peqInactiveBut = [];    
    if( awsPeqs.length > 0 ) {
	for( var peq of awsPeqs ) {
	    if( peq.Active == "true" ) {
		let issue = ghIssues.find( iss => iss.issueId == peq.GHIssueId );
		if( typeof issue == 'undefined' ) { peqNoIss.push( peq ); }
		else if( issue.peqValue <= 0 )    { peqNoLab.push( peq ); }
	    }
	    else {
		let issue = ghIssues.find( iss => iss.issueId == peq.GHIssueId );
		if( typeof issue !== 'undefined' && issue.peqValue > 0 ) { peqInactiveBut.push( issue ); }
	    }
	}
    }
    let issNoPeq = [];
    if( ghIssues.length > 0 ) {
	for( var issue of ghIssues ) {
	    if( issue.peqValue > 0 ) {
		let peq = awsPeqs.find( p => p.GHIssueId == issue.issueId && p.Active == "true" );
		if( typeof peq == 'undefined' ) { issNoPeq.push( issue ); }
	    }
	}
    }

    console.log( "Number of peqs with no matching issues:    ", peqNoIss.length.toString() );
    showRaw( authData, [], [], peqNoIss, [] );

    console.log( "\nNumber of peqs with no matching peq labels:", peqNoLab.length.toString() );
    showRaw( authData, [], [], peqNoLab, [] );

    console.log( "\nNumber of inactive peqs but with issues with peq labels:", peqInactiveBut.length.toString() );
    showRaw( authData, [], [], peqInactiveBut, [] );

    console.log( "\nNumber of issues with no active peqs:      ", issNoPeq.length.toString() );
    showRaw( authData, [], issNoPeq, [], [] );
    
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
    // Most of what is in aws:peq is outdated. labels could be updated and removed.  No locations.  Can do:
    // CEPEQS
    //     * AWS:(peq.active=true).id   1:1 match  GH:(issue) && GH:(issue has peq label)
    //       - issueId match.  repo match.  That's it.
    //     * AWS:(peq.active=false).id !exist in GH:(issue s.t. issue has peq label)
    // CELinkage
    //     * GH:(issue has peq label).proj,col,repo exists in AWS with active=true
    //     * AWS(proj,col where active=true) has GH:(issue with peq label and matching proj,col,repo)

    let promises = [];
    let ghLabels = [];
    let ghIssues = [];
    let awsPeqs  = [];
    let awsLocs  = [];
    promises.push( getGHTestLabels( authData, td ).then( res => ghLabels = res ));
    promises.push( getGHTestIssues( authData, td ).then( res => ghIssues = res ));
    promises.push( getAWSTestPeqs( authData, td  ).then( res => awsPeqs = res ));
    promises.push( getAWSTestLocs( authData, td  ).then( res => awsLocs = res ));
    await Promise.all( promises );

    preIngestCheck( authData, ghLabels, ghIssues, awsPeqs, awsLocs );

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
