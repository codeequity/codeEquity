const auth = require( "../auth");
var utils = require('../utils');
var ghUtils = require('../ghUtils');
var config  = require('../config');
var assert = require('assert');
const peqData = require( '../peqData' );

var gh = ghUtils.githubUtils;

/*
https://developer.github.com/webhooks/event-payloads/#issues
https://octokit.github.io/rest.js/v18#projects-delete-card
https://developer.github.com/v3/issues/#create-an-issue
https://docs.github.com/en/free-pro-team@latest/rest/reference/issues
https://developer.github.com/v4/explorer/
https://graphql.org/graphql-js/graphql-clients/
*/


async function runTests() {

    console.log( "Clear testing environment" );
    let pd = new peqData.PeqData();
    pd.GHOwner      = config.TEST_OWNER;
    pd.GHRepo       = config.TEST_REPO;

    let token = await auth.getInstallationClient( pd.GHOwner, pd.GHRepo );
    let PAT   = await auth.getPAT( pd.GHOwner );
    let source = "<TEST: Delete> ";
    let installClient = [token, source];

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


    // Get all peq labels in repo for deletion
    console.log( "Removing all PEQ Labels. " );
    let labelNames = [];
    await installClient[0].paginate( installClient[0].issues.listLabelsForRepo, { owner: pd.GHOwner, repo: pd.GHRepo } )
	.then((labels) => {
	    for( const label of labels ) {
		if( gh.parseLabelDescr( [label.description] ) > 0 ) {
		    labelNames.push( label.name );
		}
	    }
	})
	.catch( e => { console.log( installClient[1], "Problem in listLabels", e ); });
    console.log( "Labels", labelNames );

    for( const label of labelNames ) {
	await ( installClient[0].issues.deleteLabel( { owner: pd.GHOwner, repo: pd.GHRepo, name: label }) )
	    .catch( e => { console.log( installClient[1], "Problem in delete label", e ); });
    }

    // Clean up dynamo too!
    
}


runTests();
