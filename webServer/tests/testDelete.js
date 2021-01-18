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


async function runTests( ghLinks ) {

    console.log( "Clear testing environment" );

    let pd = new peqData.PeqData();
    pd.GHOwner      = config.TEST_OWNER;
    pd.GHRepo       = config.TEST_REPO;
    pd.GHFullName   = pd.GHOwner + "/" + pd.GHRepo;

    let token = await auth.getInstallationClient( pd.GHOwner, pd.GHRepo );
    let PAT   = await auth.getPAT( pd.GHOwner );
    let source = "<TEST: Delete> ";

    // installClient is quad [installationAccessToken, creationSource, apiPath, cognitoIdToken]
    let apiPath = utils.getAPIPath() + "/find";
    let idToken = await awsAuth.getCogIDToken();
    let installClient = [token, source, apiPath, idToken];

    // Delete all issues, cards, projects, columns, labels.
    // Eeek.  This works a little too well.  Make sure the repo is expected.
    assert( pd.GHRepo == "CodeEquityTester" );

    /* 
    // Example delete issue 
    // let query = {query: "mutation { deleteIssue( input:{ issueId: \"MDU6SXNzdWU3NTk1NDY1NjE=\" }) { clientMutationId } }"  };

    // Example query with variables.  
    let nrepo = 3;
    let query = "query($number_of_repos:Int!) { viewer {name repositories(last: $number_of_repos) { nodes { name } }  } }" ;
    let variables = {"number_of_repos": nrepo };
    */


    // Get all existing issues for deletion.  GraphQL required node_id (global), rather than id.
    console.log( "Removing all issues. " );
    let issues = [];
    await installClient[0].paginate( installClient[0].issues.listForRepo, { owner: pd.GHOwner, repo: pd.GHRepo, state: "all" } )
	.then( results  => { issues = results.map((res) => res.node_id ); })
	.catch( e => { console.log( installClient[1], "Problem in listIssues", e ); });
    console.log( "Issue nodeIds", issues );

    // XXX Could probably do this in one fel swoop, but for now
    let endpoint = "https://api.github.com/graphql";
    for( const nodeId of issues) {
	let query = "mutation( $id:String! ) { deleteIssue( input:{ issueId: $id }) {clientMutationId}}";
	let variables = {"id": nodeId };
	query = JSON.stringify({ query, variables });

	let res = await utils.postGH( PAT, endpoint, query );
	console.log( res.data );
    }
    
    
    // Get all existing projects in repo for deletion
    console.log( "Removing all Projects. " );
    let projIds = [];
    await installClient[0].paginate( installClient[0].projects.listForRepo, { owner: pd.GHOwner, repo: pd.GHRepo, state: "all" } )
	.then((projects) => { projIds = projects.map((project) => project.id ); })
	.catch( e => { console.log( installClient[1], "Problem in listProjects", e ); });
    console.log( "ProjIds", projIds );
    
    for( const projId of projIds ) {
	await ( installClient[0].projects.delete( {project_id: projId}) )
	    .catch( e => { console.log( installClient[1], "Problem in delete Project", e ); });
    }

    await utils.sleep( 3000 );
    
    // Get all peq labels in repo for deletion
    console.log( "Removing all PEQ Labels. " );
    let labelNames = [];
    await installClient[0].paginate( installClient[0].issues.listLabelsForRepo, { owner: pd.GHOwner, repo: pd.GHRepo } )
	.then((labels) => {
	    for( const label of labels ) {
		if( ghSafe.parseLabelDescr( [label.description] ) > 0 ) { labelNames.push( label.name ); }
		else if( label.name == config.POPULATE )                { labelNames.push( label.name ); }
	    }
	})
	.catch( e => { console.log( installClient[1], "Problem in listLabels", e ); });
    console.log( "Labels", labelNames );

    for( const label of labelNames ) {
	await ( installClient[0].issues.deleteLabel( { owner: pd.GHOwner, repo: pd.GHRepo, name: label }) )
	    .catch( e => { console.log( installClient[1], "Problem in delete label", e ); });
    }




    // Clean up dynamo.
    // Note: awaits may not be needed here.  No dependencies... yet...
    // Note: this could easily be 1 big function in lambda handler, but for now, faster to build/debug here.
    // Eeek.  This works a little too well.  Make sure the repo is expected.
    assert( pd.GHFullName == "rmusick2000/CodeEquityTester" );

    // PActions raw and otherwise
    // Note: clean both bot and GHOwner pacts
    let pacts = await utils.getPActs( installClient, {"GHUserName": config.TESTER_BOT, "GHRepo": pd.GHFullName} );
    let pactIds = pacts == -1 ? [] : pacts.map(( pact ) => [pact.PEQActionId] );
    console.log( "Dynamo bot PActIds", pactIds );
    await utils.cleanDynamo( installClient, "CEPEQActions", pactIds );
    await utils.cleanDynamo( installClient, "CEPEQRaw", pactIds );

    await utils.sleep( 3000 );
    
    pacts = await utils.getPActs( installClient, {"GHUserName": pd.GHOwner, "GHRepo": pd.GHFullName} );
    pactIds = pacts == -1 ? [] : pacts.map(( pact ) => [pact.PEQActionId] );
    console.log( "Dynamo owner PActIds", pactIds );
    await utils.cleanDynamo( installClient, "CEPEQActions", pactIds );
    await utils.cleanDynamo( installClient, "CEPEQRaw", pactIds );

    await utils.sleep( 3000 );

    // PEQs
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": pd.GHFullName });
    let peqIds = peqs == -1 ? [] : peqs.map(( peq ) => [peq.PEQId] );
    console.log( "Dynamo PEQ ids", peqIds );
    await utils.cleanDynamo( installClient, "CEPEQs", peqIds );

    // Linkages
    console.log( "Remove links" );
    await tu.remLinks( installClient, ghLinks, pd.GHFullName );
    
    // Queue
    ceJobs = {};
    /*
    let notes = await utils.getQueue( installClient, pd.GHRepo );
    let noteIds = notes == -1 ? [] : notes.map(( note ) => [note.QueueId] );
    console.log( "Dynamo queue ids", noteIds );
    await utils.cleanDynamo( installClient, "CEQueue", noteIds );
    */
    
    // RepoStatus
    let status = await utils.getRepoStatus( installClient, pd.GHFullName );
    let statusIds = status == -1 ? [] : [ [status.GHRepo] ];
    console.log( "Dynamo status id", statusIds );
    await utils.cleanDynamo( installClient, "CERepoStatus", statusIds );

}


// runTests();
exports.runTests = runTests;
