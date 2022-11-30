var assert = require( 'assert' );

const config = require( '../../../config' );

const utils     = require( '../../ceUtils' );
const ghUtils   = require( '../ghUtils' );

// https://docs.github.com/en/free-pro-team@latest/graphql/reference/objects

// Get stuff from project_node_id
// https://github.com/community/community/discussions/5616

async function getProjectFromNode( PAT, pNodeId ) {

    // owner?  have this already in reqBody
    // items gives us issues, draft issues, pull requests
    // fields gives us things like reviewers and milestones
    // views is the magic
    // views:layout tells you board or table
    // status is in layout, no matter if visible.  Can be empty, which shows as "No Status"
    // So, just need first view.
    const query = `query projDetail($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            number title databaseId public resourcePath 
            repositories(first: 5) {
              edges {
                node {
                  ... on Repository {
                    name nameWithOwner}}}}
            items(first: 0) {
              edges {
                node {
                  ... on ProjectV2Item {
                    type databaseId }}}}
            fields(first: 0) {
              edges {
                node {
                  ... on ProjectV2Field {
                    name }}}}
            views(first: 1) {
              edges {
                node {
                  ... on ProjectV2View {
                    name layout 
                    fields(first: 99) {
                     edges {
                       node {
                         ... on ProjectV2FieldConfiguration {
                          ... on ProjectV2SingleSelectField { name options {name}
                              }}}}}}}}}
    }}}`;
    
    let variables = {"nodeId": pNodeId };
    let queryJ = JSON.stringify({ query, variables });

    const ret = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, queryJ )
	.catch( e => ghUtils.errorHandler( "getProjectFromNode", e, getProjectFromNode, PAT, pNodeId ));  // this will probably never catch anything

    let retVal = {};
    retVal.number       = ret.data.node.number;
    retVal.databaseId   = ret.data.node.databaseId;
    retVal.title        = ret.data.node.title;
    retVal.resourcePath = ret.data.node.resourcePath;
    retVal.public       = ret.data.node.public;
    retVal.repositories = [];
    retVal.status       = [];
    
    let repos = ret.data.node.repositories;
    for( let i = 0; i < repos.edges.length; i++ ) {
	const arepo = repos.edges[i].node;
	console.log( "repo:", arepo.name );
	console.log( "repo:", arepo );
	retVal.repositories.push( arepo.nameWithOwner );
    }
    
    let views = ret.data.node.views;
    for( let i = 0; i < views.edges.length; i++ ) {
	const aview = views.edges[i].node;
	// console.log( "view:", aview.name, aview.layout );
	for( let j = 0; j < aview.fields.edges.length; j++ ) {

	    // Kanban abuse.  call the authorities.
	    if( j >= 90 ) { console.log( "WARNING.  Detected a very large number of columns, ignoring some." ); }

	    const pfc = aview.fields.edges[j].node;
	    // console.log( "pfcs", pfc, pfc.name );
	    if( pfc.name == "Status" ) {
		for( let k = 0; k < pfc.options.length; k++ ) {
		    const option = pfc.options[k];
		    // console.log( " .. options", option.name );
		    retVal.status.push( pfc.options[k].name );
		}
	    }
	}
    }

    /*
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
    */

    return retVal;
}


// XXX
//       Items is returning the databaseId of the pv2Item, not the content_node_id, nor the issue_id.
//       how to use it?  Or get other stuff?
// Ahhhhhh.
// many objects implement 'node', which has field 'id', which is the node_id.  Use this to get issue node id.

// Need to get locData, linkData.  Note: column names are now unique within GH project.  i.e. name == columnId
// locData:
// a single project:col can have issues from multiple repos.  rather than present a list here, set to EMPTY, see how long can ignore.  repo == Comment now.
/*
		datum.HostRepository  = "---"
		datum.HostProjectName = project.name;
		datum.HostProjectId   = project.databaseId.toString();
		datum.HostColumnName  = col.node.name;
		datum.HostColumnId    = col.node.databaseId.toString();
*/
// linkData:
/*
		datum.issueId     = issue.databaseId;
		datum.issueNum    = issue.number;
		datum.title       = issue.title;
		datum.cardId      = card.node.databaseId;
		datum.projectName = card.node.project.name;
		datum.projectId   = card.node.project.databaseId;
		datum.columnName  = card.node.column.name;
		datum.columnId    = card.node.column.databaseId;
*/

async function getHostLinkLoc( PAT, pNodeId, locData, linkData, cursor ) {

    // XXX ? filter out all but Issue in items?  Currently filterBy is not available for projectV2Items.  Keep checking back, but for now get all (oi).
    //     items(first: 100 filterBy {ProjectItemType: ISSUE } ) 
    /*
                    content
                     ... on ProjectV2ItemContent {
                       ... on Issue { databaseId number repository {nameWithOwner} title }} 
}}}}
*/

    //await getFromIssueNode( PAT, "14536987" );
    //await getFromIssueNode( PAT, "14767734" );
    //await getFromIssueNode( PAT, "14767789" );
    
    const query1 = `query linkLoc($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            number title databaseId
            items(first: 100) {
              pageInfo { hasNextPage, endCursor }
              edges { node {
                  ... on ProjectV2Item { type databaseId id
                    content
                     ... on ProjectV2ItemContent {
                       ... on Issue { databaseId number repository {nameWithOwner} title }} 
                    fieldValues (first:100) { edges { node {
                     ... on ProjectV2ItemFieldValue { 
                       ... on ProjectV2ItemFieldValueCommon { field }}}}}
}}}}
            views(first: 1) {
              edges {
                node {
                  ... on ProjectV2View {
                    name layout 
                    fields(first: 99) {
                     edges {
                       node {
                         ... on ProjectV2FieldConfiguration {
                          ... on ProjectV2SingleSelectField { name options {name}
                              }}}}}}}}}
    }}}`;

    const queryN = `query linkLoc($nodeId: ID!, $cursor: String!) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            number title databaseId
            items(first: 100 after: $cursor filterBy {ProjectItemType: ISSUE } ) {
              pageInfo { hasNextPage, endCursor }
              edges { node {
                  ... on ProjectV2Item { type databaseId }}}}
            views(first: 1) {
              edges {
                node {
                  ... on ProjectV2View {
                    name layout 
                    fields(first: 99) {
                     edges {
                       node {
                         ... on ProjectV2FieldConfiguration {
                          ... on ProjectV2SingleSelectField { name options {name}
                              }}}}}}}}}
    }}}`;

    let query     = cursor == -1 ? query1 : queryN;
    let variables = cursor == -1 ? {"nodeId": pNodeId } : {"nodeId": pNodeId, "cursor": cursor };
    query = JSON.stringify({ query, variables });

    const ret = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, query )
	  .catch( e => ghUtils.errorHandler( "getHostLinkLoc", e, getHostLinkLoc, PAT, pNodeId, locData, linkData, cursor )); 

    // postGH masks errors, catch here.
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {
	await ghUtils.errorHandler( "getHostLinkLoc", ret, getHostLinkLoc, PAT, pNodeId, locData, linkData, cursor ); 
    }
    else {
	
	let project = ret.data.node;

	// Loc data only needs to be built once.  Will be the same for every issue.
	// XXX ??? will this be simpler to build from issue list below?
	if( locData.length <= 0 ) {

	    // Plunder the first view to get status (i.e. column) info
	    let views = project.views;
	    for( let i = 0; i < views.edges.length; i++ ) {
		const aview = views.edges[i].node;
		for( let j = 0; j < aview.fields.edges.length; j++ ) {
		    // Kanban abuse.  call the authorities.
		    if( j >= 90 ) { console.log( "WARNING.  Detected a very large number of columns, ignoring some." ); }
		    const pfc = aview.fields.edges[j].node;
		    if( pfc.name == "Status" ) {
			for( let k = 0; k < pfc.options.length; k++ ) {

			    let datum   = {};
			    datum.HostRepository  = config.EMPTY;
			    datum.HostProjectName = project.title;
			    datum.HostProjectId   = project.databaseId.toString();
			    
			    datum.HostColumnName  = pfc.options[k].name;
			    datum.HostColumnId    = datum.HostColumnName;
			    locData.push( datum );
			}
		    }
		}
	    }
	    
	}
	console.log( locData );
	assert( locData.length > 0 );
	
	let items = ret.data.node.items;
	for( let i = 0; i < items.edges.length; i++ ) {
	    const issue = items.edges[i].node;
	    console.log( issue );

	    for( let k = 0; k < issue.fieldValues.edges.length; k++ ) {
		const fv = issue.fieldValues.edges[k].node;
		console.log( fv );
	    }
	    
	    // console.log( issue.content.databaseId, issue.content.number, issue.content.title );
	    if( issue.type == "ISSUE" ) {
		let datum = {};
		datum.issueId     = issue.databaseId;
		datum.issueNum    = -1;
		datum.title       = config.EMPTY;
		datum.cardId      = config.EMPTY;
		datum.projectName = locData[0].HostProjectName;    
		datum.projectId   = locData[0].HostProjectId;    
		datum.columnName  = config.EMPTY;
		datum.columnId    = datum.columnName;
		
		linkData.push( datum );
	    }
	}

	// Wait.  Data is modified
	if( items != -1 && items.pageInfo.hasNextPage ) { await geHostLinkLoc( PAT, pNodeId, locData, linkData, items.pageInfo.endCursor ); }
    }
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
	.catch( e => ghUtils.errorHandler( "getProjectFromNode", e, getProjectFromNode, PAT, nodeId ));  // this will probably never catch anything

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
exports.getHostLinkLoc     = getHostLinkLoc;
exports.getFromIssueNode   = getFromIssueNode;
