var assert = require( 'assert' );

const config = require( '../../../config' );

const utils     = require( '../../ceUtils' );
const ghUtils   = require( '../ghUtils' );

/*
https://docs.github.com/en/free-pro-team@latest/graphql/reference/objects
https://developer.github.com/webhooks/event-payloads/#issues
https://developer.github.com/v3/issues/#create-an-issue
*/



// Get stuff from project_node_id
// https://github.com/community/community/discussions/5616
// https://github.blog/changelog/2022-06-23-the-new-github-issues-june-23rd-update/
// Might need to be looking at view
async function getProjectFromNode( PAT, pNodeId ) {

    // owner?  have this already in reqBody
    // layout tells you board or table
    const query = `query projDetail($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            number title databaseId public resourcePath 
            repositories(first: 5) {
              edges {
                node {
                  ... on Repository {
                    name }}}}
            items(first: 5) {
              edges {
                node {
                  ... on ProjectV2Item {
                    type databaseId }}}}
            fields(first: 50) {
              edges {
                node {
                  ... on ProjectV2Field {
                    name }}}}
            views(first: 3) {
              edges {
                node {
                  ... on ProjectV2View {
                    name layout 
                    fields(first: 50) {
                     edges {
                       node {
                         ... on ProjectV2FieldConfiguration {
                          ... on ProjectV2SingleSelectField { name options {name}
                              }}}}}}}}}
    }}}`;
    
    let variables = {"nodeId": pNodeId };
    let queryJ = JSON.stringify({ query, variables });

    const ret = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, queryJ )
	.catch( e => errorHandler( "getProjectFromNode", e, getProjectFromNode, PAT, pNodeId ));  // this will probably never catch anything

    console.log( "\n\n" );
    console.log( ret );

    let repos = ret.data.node.repositories;
    for( let i = 0; i < repos.edges.length; i++ ) {
	const arepo = repos.edges[i].node;
	console.log( "repo:", arepo.name );
    }
    let items = ret.data.node.items;
    for( let i = 0; i < items.edges.length; i++ ) {
	const aitem = items.edges[i].node;
	console.log( "item:", aitem.type, aitem.databaseId );
    }
    let fields = ret.data.node.fields;
    for( let i = 0; i < fields.edges.length; i++ ) {
	const afield = fields.edges[i].node;
	console.log( "field:", afield.name );
    }

    let views = ret.data.node.views;
    for( let i = 0; i < views.edges.length; i++ ) {
	const aview = views.edges[i].node;
	console.log( "view:", aview.name, aview.layout );
	if( aview.layout == "BOARD_LAYOUT" ) {
	    console.log( aview );
	    for( let j = 0; j < aview.fields.edges.length; j++ ) {
		const pfc = aview.fields.edges[j].node;
		console.log( "pfcs", pfc, pfc.name );
		if( pfc.name == "Status" ) {
		    for( let k = 0; k < pfc.options.length; k++ ) {
			const option = pfc.options[k];
			console.log( " .. options", option.name );
		    }
		}
	    }
	}
    }
    /*
    let views = ret.data.node.views;
    for( let i = 0; i < views.edges.length; i++ ) {
	const aview = views.edges[i].node;
	console.log( "view:", aview.name, aview.layout );
	if( aview.layout == "BOARD" ) {
	    for( let j = 0; j < aview.edges.length; j++ ) {
		const pfc = aview.edges[j].node;
		console.log( "pfcs" );
		for( let k = 0; k < pfc.edges.length; k++ ) {
		    const ssf = pfc.edges[k].node;
		    console.log( "SSF:", ssf.name );
		}
	    }
	}
    }
*/

    console.log( "\n\n" );
    
    return ret;
}

// Get stuff from issue content_node_id
async function getFromIssueNode( PAT, nodeId ) {

    // no
    // status{
    // state
    // contexts{ state context description createdAt targetUrl }}

    
    const query = `query detail($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on ProjectV2ItemContent {
         ... on Issue {
           title body createdAt databaseId number state
            projectItems(first: 5) {
              edges {
                node { id }}}
            projectCards {
              edges {
                node { id }}}
    }}}}`;
    
    let variables = {"nodeId": nodeId };
    let queryJ = JSON.stringify({ query, variables });

    const ret = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, queryJ )
	.catch( e => errorHandler( "getProjectFromNode", e, getProjectFromNode, PAT, nodeId ));  // this will probably never catch anything

    console.log( "\n\n" );
    console.log( ret );

    let pi = ret.data.node.projectItems;
    for( let i = 0; i < pi.edges.length; i++ ) {
	const api = pi.edges[i].node;
	console.log( "projectItem:", api.id );
    }
    let pc = ret.data.node.projectCards;
    for( let i = 0; i < pc.edges.length; i++ ) {
	const apc = pc.edges[i].node;
	console.log( "projectCard:", apc.id );
    }

    console.log( "\n\n" );
    
    return ret;
}

exports.getProjectFromNode = getProjectFromNode;
exports.getFromIssueNode   = getFromIssueNode;
