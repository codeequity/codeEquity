var assert = require('assert');

var config  = require('../config');
const awsAuth = require( '../awsAuth' );
const auth = require( "../auth");

var utils = require('../utils');
var ghUtils = require('../ghUtils');
const tu = require('./testUtils');

const peqData = require( '../peqData' );

var gh     = ghUtils.githubUtils;
var ghSafe = ghUtils.githubSafe;
/*
https://developer.github.com/webhooks/event-payloads/#issues
https://octokit.github.io/rest.js/v18#projects-delete-card
https://developer.github.com/v3/issues/#create-an-issue
https://docs.github.com/en/free-pro-team@latest/rest/reference/issues
https://developer.github.com/v4/explorer/
https://graphql.org/graphql-js/graphql-clients/
*/


async function remIssues( authData, ghLinks, pd ) {
    // Get all existing issues for deletion.  GraphQL required node_id (global), rather than id.
    console.log( "Removing all issues. " );
    let issues = await authData.ic.paginate( authData.ic.issues.listForRepo, { owner: pd.GHOwner, repo: pd.GHRepo, state: "all" } )
	.catch( e => console.log( authData.who, "Problem in listIssues", e ));
    
    let allLinks = await tu.getLinks( authData, ghLinks, { "repo": pd.GHFullName } );
    
    // XXX Could probably do this in one fel swoop, but for now
    // XXX Note the awaits here wait for GH to complete, not for CE to complete...  promise.all doesn't help
    let endpoint = "https://api.github.com/graphql";
    for( const issue of issues) {
	const nodeId = issue.node_id;
	let query = "mutation( $id:String! ) { deleteIssue( input:{ issueId: $id }) {clientMutationId}}";
	let variables = {"id": nodeId };
	query = JSON.stringify({ query, variables });

	res = await utils.postGH( authData.pat, endpoint, query );
	let link = allLinks == -1 ? allLinks : allLinks.find(link => link.GHIssueId == issue.id.toString());
	if( link != -1 && typeof link != 'undefined' && link.GHColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) { await utils.sleep( 1500 ); }
	else                                                                                                      { await utils.sleep( 400 ); }
	console.log( res );
    }
}

async function runTests( ghLinks ) {

    console.log( "Clear testing environment" );

    let pd = new peqData.PeqData();
    pd.GHOwner      = config.TEST_OWNER;
    pd.GHRepo       = config.TEST_REPO;
    pd.GHFullName   = pd.GHOwner + "/" + pd.GHRepo;

    let authData = {};
    authData.ic  = await auth.getInstallationClient( pd.GHOwner, pd.GHRepo );
    authData.pat = await auth.getPAT( pd.GHOwner );
    authData.who = "<TEST: Delete> ";
    authData.api = await( utils.getAPIPath() ) + "/find";
    authData.cog = await awsAuth.getCogIDToken();

    // Delete all issues, cards, projects, columns, labels.
    // Eeek.  This works a little too well.  Make sure the repo is expected.
    assert( pd.GHRepo == "CodeEquityTester" );

    // Queue
    await tu.purgeJobs( pd.GHRepo, pd.GHOwner );

    // Issues.
    // Some deleted issues get recreated in unclaimed.  Wait for them to finish, then repeat
    await remIssues( authData, ghLinks, pd );
    await utils.sleep( 4000 );
    await remIssues( authData, ghLinks, pd );
    await utils.sleep( 2000 );


    // Get all existing projects in repo for deletion
    console.log( "Removing all Projects. " );
    let projIds = [];
    await authData.ic.paginate( authData.ic.projects.listForRepo, { owner: pd.GHOwner, repo: pd.GHRepo, state: "all" } )
	.then((projects) => { projIds = projects.map((project) => project.id ); })
	.catch( e => { console.log( authData.who, "Problem in listProjects", e ); });
    console.log( "ProjIds", projIds );
    
    for( const projId of projIds ) {
	await ( authData.ic.projects.delete( {project_id: projId}) )
	    .catch( e => { console.log( authData.who, "Problem in delete Project", e ); });
	// Option 1: big sleep at end.  This option: space things out a bit.
	await utils.sleep( 1000 );
    }

    await utils.sleep( 4000 );
    

    // Clean up dynamo.
    // Note: awaits may not be needed here.  No dependencies... yet...
    // Note: this could easily be 1 big function in lambda handler, but for now, faster to build/debug here.
    // Eeek.  This works a little too well.  Make sure the repo is expected.
    assert( pd.GHFullName == "rmusick2000/CodeEquityTester" );


    // PEQs
    let peqs =  await utils.getPeqs( authData, { "GHRepo": pd.GHFullName });
    let peqIds = peqs == -1 ? [] : peqs.map(( peq ) => [peq.PEQId] );
    console.log( "Dynamo PEQ ids", peqIds );
    await utils.cleanDynamo( authData, "CEPEQs", peqIds );

    await utils.sleep( 6000 );

    // Get all peq labels in repo for deletion... dependent on peq removal first.
    console.log( "Removing all PEQ Labels. " );
    let labelNames = [];
    await authData.ic.paginate( authData.ic.issues.listLabelsForRepo, { owner: pd.GHOwner, repo: pd.GHRepo } )
	.then((labels) => {
	    for( const label of labels ) {
		if( ghSafe.parseLabelName( label.name ) > 0 ) { labelNames.push( label.name ); }
		else if( label.name == config.POPULATE )        { labelNames.push( label.name ); }
	    }
	})
	.catch( e => { console.log( authData.who, "Problem in listLabels", e ); });
    console.log( "Labels", labelNames );

    for( const label of labelNames ) {
	await ( authData.ic.issues.deleteLabel( { owner: pd.GHOwner, repo: pd.GHRepo, name: label }) )
	    .catch( e => { console.log( authData.who, "Problem in delete label", e ); });
    }

    // Delete special label mod adds
    let labelRes = await gh.getLabel( authData, pd.GHOwner, pd.GHRepo, "nonPeq1" );
    if( typeof labelRes.label != 'undefined' ) { tu.delLabel( authData, pd, labelRes.label.name ); }
    labelRes = await gh.getLabel( authData, pd.GHOwner, pd.GHRepo, "nonPeq2" );
    if( typeof labelRes.label != 'undefined' ) { tu.delLabel( authData, pd, labelRes.label.name ); }
    labelRes = await gh.getLabel( authData, pd.GHOwner, pd.GHRepo, "newName" );
    if( typeof labelRes.label != 'undefined' ) { tu.delLabel( authData, pd, labelRes.label.name ); }
    
    // PActions raw and otherwise
    // Note: bot, ceServer and GHOwner may have pacts.  Just clean out all.
    let pacts = await utils.getPActs( authData, {"GHRepo": pd.GHFullName} );
    let pactIds = pacts == -1 ? [] : pacts.map(( pact ) => [pact.PEQActionId] );
    console.log( "Dynamo bot PActIds", pactIds );
    await utils.cleanDynamo( authData, "CEPEQActions", pactIds );
    await utils.cleanDynamo( authData, "CEPEQRaw", pactIds );

    // Linkages
    // Usually empty, since above deletes remove links as well.  but sometimes, der's turds.
    console.log( "Remove links" );
    await tu.remLinks( authData, ghLinks, pd.GHFullName );
    let links  = await tu.getLinks( authData, ghLinks, { "repo": pd.GHFullName } );
    if( links != -1 ) { console.log( links ); }
    assert( links == -1 );
    
    // RepoStatus
    let status = await utils.getRepoStatus( authData, pd.GHFullName );
    let statusIds = status == -1 ? [] : [ [status.GHRepo] ];
    console.log( "Dynamo status id", statusIds );
    await utils.cleanDynamo( authData, "CERepoStatus", statusIds );

}


// runTests();
exports.runTests = runTests;
