var assert = require( 'assert' );

const config = require( '../../../config' );

const utils     = require( '../../ceUtils' );
const ghUtils   = require( '../ghUtils' );

/*
https://docs.github.com/en/free-pro-team@latest/graphql/reference/objects#repository
https://octokit.github.io/rest.js
https://developer.github.com/webhooks/event-payloads/#issues
https://developer.github.com/v3/issues/#create-an-issue
*/


// GraphQL to get all status options (columns) in project
async function getProjectDetails( PAT, pNodeId, data, cursor ) {
    /*
    const query1 = `
    query baseCols($owner: String!, $repo: String!) 
    {
	repository(owner: $owner, name: $repo) {
	    projects(first: 100) {
		pageInfo { hasNextPage, endCursor },
		edges { node {
		    databaseId number name
		    columns(first: 100) {
			pageInfo { hasNextPage, endCursor },
			edges { node { databaseId name }}}
		}}}}}`;
    
    const queryN = `
    query nthCols($owner: String!, $repo: String!, $cursor: String!) 
    {
	repository(owner: $owner, name: $repo) {
	    projects(first: 100 after: $cursor) {
		pageInfo { hasNextPage, endCursor },
		edges { node {
		    databaseId number name
		    columns(first: 100) {
			pageInfo { hasNextPage, endCursor },
			edges { node { databaseId name }}
		}}}}}}`;
    
    let query     = cursor == -1 ? query1 : queryN;
    let variables = cursor == -1 ? {"owner": owner, "repo": repo } : {"owner": owner, "repo": repo, "cursor": cursor};
    query = JSON.stringify({ query, variables });

    let projects = -1;
    let res = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, query )
	.catch( e => errorHandler( "getRepoColsGQL", e, getRepoColsGQL, PAT, owner, repo, data, cursor ));  // this will probably never catch anything

    // postGH masks errors, catch here.
    if( typeof res !== 'undefined' && typeof res.data === 'undefined' ) {
	await errorHandler( "getRepoColsGQL", res, getRepoColsGQL, PAT, owner, repo, data, cursor );
    }
    else {
	projects = res.data.repository.projects;
	for( let i = 0; i < projects.edges.length; i++ ) {
	    const project = projects.edges[i].node;
	    const cols    = project.columns;
	    
	    // Note.  Over 100 cols for 1 project?  Warn here.
	    assert( !cols.pageInfo.hasNextPage );
	    
	    for( const col of cols.edges ) {
		// console.log( project.name, project.number, project.databaseId, col.node.name, col.node.databaseId );
		let datum = {};
		datum.HostRepository  = owner + "/" + repo;
		datum.HostProjectName = project.name;
		datum.HostProjectId   = project.databaseId.toString();
		datum.HostColumnName  = col.node.name;
		datum.HostColumnId    = col.node.databaseId.toString();
		data.push( datum );
	    }
	    
	    // Add project even if it has no cols
	    if( cols.edges.length == 0 ) {
		let datum = {};
		datum.HostRepository  = owner + "/" + repo;
		datum.HostProjectName = project.name;
		datum.HostProjectId   = project.databaseId.toString();
		datum.HostColumnName  = config.EMPTY;
		datum.HostColumnId    = "-1";
		data.push( datum );
	    }
	}

	// Wait.  Data.
	if( projects != -1 && projects.pageInfo.hasNextPage ) { await getRepoColsGQL( PAT, owner, repo, data, projects.pageInfo.endCursor ); }
    }
    */
}

// Get stuff from project_node_id
async function getProjectFromNode( PAT, pNodeId ) {

    const query = `query projDetail($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            number title databaseId public 
            fields(first: 5) {
            edges {
              node {
                ... on ProjectV2Field {
                  name
    }}}}}}}`;
    
    let variables = {"nodeId": pNodeId };
    let queryJ = JSON.stringify({ query, variables });

    const ret = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, queryJ )
	.catch( e => errorHandler( "getProjectFromNode", e, getProjectFromNode, PAT, pNodeId ));  // this will probably never catch anything

    console.log( "\n\n" );
    console.log( ret );

    let fields = ret.data.node.fields;
    for( let i = 0; i < fields.edges.length; i++ ) {
	const afield = fields.edges[i].node;
	console.log( "field:", afield.name );
    }
    console.log( "\n\n" );
    
    return ret;
}

exports.getProjectDetails  = getProjectDetails;
exports.getProjectFromNode = getProjectFromNode;
