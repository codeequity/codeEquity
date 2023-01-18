var assert = require( 'assert' );

var config = require( '../config' );

const utils    = require( '../utils/ceUtils' );
const awsUtils = require( '../utils/awsUtils' );
const ghUtils  = require( '../utils/gh/ghUtils' );

const ghClassic = require( '../utils/gh/ghc/ghClassicUtils' );
const gh        = ghClassic.githubUtils;
const ghSafe    = ghClassic.githubSafe;

const tu = require('./testUtils');


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
    
    let allLinks = await tu.getLinks( authData, ghLinks, { "ceProjId": pd.ceProjectId, "repo": pd.repoName } );
    
    // Could probably do this in one fel swoop, but for now
    // Note the awaits here wait for GH to complete, not for CE to complete...  promise.all doesn't help
    let endpoint = "https://api.github.com/graphql";
    for( const issue of issues) {
	const nodeId = issue.node_id;
	let query = "mutation( $id:ID! ) { deleteIssue( input:{ issueId: $id }) {clientMutationId}}";
	let variables = {"id": nodeId };
	query = JSON.stringify({ query, variables });

	res = await ghUtils.postGH( authData.pat, endpoint, query );
	let link = allLinks == -1 ? allLinks : allLinks.find(link => link.hostIssueId == issue.id.toString());
	if( link != -1 && typeof link != 'undefined' && link.hostColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) { await utils.sleep( 800 ); }
	else                                                                                                      { await utils.sleep( 400 ); }
	console.log( res );
    }
}


async function clearRepo( authData, ghLinks, pd ) {
    console.log( "\nClearing", pd.repoName );

    // Delete all issues, cards, projects, columns, labels.
    // Eeek.  This works a little too well.  Make sure the repo is expected.
    assert( pd.GHRepo == config.TEST_REPO || pd.GHRepo == config.FLUTTER_TEST_REPO || pd.GHRepo == config.CROSS_TEST_REPO || pd.GHRepo == config.MULTI_TEST_REPO );

    // Start promises
    let jobsP  = tu.purgeJobs( pd.GHRepo );

    // Issues.
    // Some deleted issues get recreated in unclaimed.  Wait for them to finish, then repeat
    await remIssues( authData, ghLinks, pd );
    await utils.sleep( 1000 );
    await remIssues( authData, ghLinks, pd );
    await utils.sleep( 1000 );

    // Start here, else lots left undeleted after issue munging. 
    let peqsP  = awsUtils.getPeqs( authData,  { "CEProjectId": td.CEProjectId });
    let pactsP = awsUtils.getPActs( authData, { "CEProjectId": td.CEProjectId });

    // Get all existing projects in repo for deletion
    console.log( "Removing all Projects. " );
    let projIds = [];
    await authData.ic.paginate( authData.ic.projects.listForRepo, { owner: pd.GHOwner, repo: pd.GHRepo, state: "all" } )
	.then((projects) => { projIds = projects.map((project) => project.id ); })
	.catch( e => { console.log( authData.who, "Problem in listProjects", e ); });
    console.log( "ProjIds", pd.repoName, projIds );
    
    for( const projId of projIds ) {
	await ( authData.ic.projects.delete( {project_id: projId}) )
	    .catch( e => { console.log( authData.who, "Problem in delete Project", e ); });
	// Option 1: big sleep at end.  This option: space things out a bit.
	await utils.sleep( 1000 );
    }

    await utils.sleep( 1000 );

    jobsP = await jobsP;
    
    // Clean up dynamo.
    // Note: awaits may not be needed here.  No dependencies... yet...
    // Note: this could easily be 1 big function in lambda handler, but for now, faster to build/debug here.

    // PEQs
    let peqs =  await peqsP;
    let peqIds = peqs == -1 ? [] : peqs.map(( peq ) => [peq.PEQId] );
    console.log( "Dynamo PEQ ids", pd.repoName, peqIds );
    let peqP = awsUtils.cleanDynamo( authData, "CEPEQs", peqIds );

    // PActions raw and otherwise
    // Note: bot, ceServer and GHOwner may have pacts.  Just clean out all.
    let pacts = await pactsP;
    let pactIds = pacts == -1 ? [] : pacts.map(( pact ) => [pact.PEQActionId] );
    console.log( "Dynamo bot PActIds", pd.repoName, pactIds );
    let pactP  = awsUtils.cleanDynamo( authData, "CEPEQActions", pactIds );
    let pactRP = awsUtils.cleanDynamo( authData, "CEPEQRaw", pactIds );
    
    // Get all peq labels in repo for deletion... dependent on peq removal first.
    console.log( "Removing all PEQ Labels.", pd.repoName );
    let labelNames = [];
    await authData.ic.paginate( authData.ic.issues.listLabelsForRepo, { owner: pd.GHOwner, repo: pd.GHRepo } )
	.then((labels) => {
	    for( const label of labels ) {
		if( ghUtils.parseLabelName( label.name )[0] > 0 ) { labelNames.push( label.name ); }
		else if( label.name == config.POPULATE )          { labelNames.push( label.name ); }
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
    

    // Linkages
    // Usually empty, since above deletes remove links as well.  but sometimes, der's turds.
    console.log( "Remove links", pd.repoName );
    await tu.remLinks( authData, ghLinks, pd.repoName );
    let links  = await tu.getLinks( authData, ghLinks, { "ceProjId": pd.ceProjectId, "repo": pd.repoName } );
    if( links != -1 ) { console.log( links ); }
    assert( links == -1 );

    peqP   = await peqP;
    pactP  = await pactP;
    pactRP = await pactRP;
    
    // RepoStatus
    // XXX no longer here
    console.log( "Error.  ceprojects does not hold repo" );
    assert( false );
    let status = await awsUtils.getProjectStatus( authData, pd.ceProjectId );
    let statusIds = status == -1 ? [] : [ [status.GHRepo] ];
    console.log( "Dynamo status id", statusIds );
    await awsUtils.cleanDynamo( authData, "CERepoStatus", statusIds );
}


async function runTests( authData, authDataX, authDataM, ghLinks, td, tdX, tdM ) {

    console.log( "Clear testing environment" );

    let promises = [];
    promises.push( clearRepo( authData,  ghLinks, td ));
    promises.push( clearRepo( authDataX, ghLinks, tdX ));
    promises.push( clearRepo( authDataM, ghLinks, tdM ));
    await Promise.all( promises );
}


// runTests();
exports.runTests = runTests;
