var assert = require( 'assert' );

const config = require( '../../../config' );

const utils     = require( '../../ceUtils' );
const ghUtils   = require( '../ghUtils' );

// https://docs.github.com/en/free-pro-team@latest/graphql/reference/objects



function printEdges( base, item, values ) {
    for( let i = 0; i < base[item].edges.length; i++ ) {
	const datum = base[item].edges[i].node;

	if( typeof values === 'undefined' ) {
	    console.log( item, datum );
	}
	else {
	    for( let k = 0; k < values.length; k++ ) {
		console.log( item, values[k], datum[k] );
	    }
	}
    }
}



// Get locData, linkData for server linkage to host.
// Note: column names are now unique within GH project.  i.e. name == columnId
// Note: most pv2 objects implement 'node', which has field 'id', which is the node_id. 
// Note: a single project:col can have issues from multiple repos.  rather than present a list in locData, set to EMPTY.
// Note: an issue will belong to 1 repo only
// Note: it seems that "... on Issue" is applying a host-side filter, so no need to more explicitely filter out draft issues and pulls.
// XXX views does not (yet?) have a fieldByName, which would make it much quicker to find status.
async function getHostLinkLoc( PAT, pNodeId, locData, linkData, cursor ) {

    const query1 = `query linkLoc($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            number title databaseId id
            items(first: 100) {
              pageInfo { hasNextPage, endCursor }
              edges { node {
                  ... on ProjectV2Item { type databaseId id
                    fieldValueByName(name: "Status") {
                     ... on ProjectV2ItemFieldSingleSelectValue { name }}
                    content {
                     ... on ProjectV2ItemContent {
                       ... on Issue { databaseId number repository {nameWithOwner} title }}}
            }}}}
            views(first: 1) {
              edges {
                node {
                  ... on ProjectV2View {
                    name layout 
                    fields(first: 100) {
                     edges {
                       node {
                         ... on ProjectV2FieldConfiguration {
                          ... on ProjectV2SingleSelectField { name options {name}
                              }}}}}}}}}
    }}}`;

    const queryN = `query linkLoc($nodeId: ID!, $cursor: String!) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            number title databaseId id
            items(first: 100 after: $cursor) {
              pageInfo { hasNextPage, endCursor }
              edges { node {
                  ... on ProjectV2Item { type databaseId id
                    fieldValueByName(name: "Status") {
                     ... on ProjectV2ItemFieldSingleSelectValue { name }}
                    content {
                     ... on ProjectV2ItemContent {
                       ... on Issue { databaseId number repository {nameWithOwner} title }}}
            }}}}
            views(first: 1) {
              edges {
                node {
                  ... on ProjectV2View {
                    name layout 
                    fields(first: 100) {
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
	// Note: can not build this from issues below, since we may have empty columns in board view.
	if( locData.length <= 0 ) {

	    // Build "No Status" by hand, since it corresponds to a null entry
	    let datum   = {};
	    datum.HostRepository  = config.EMPTY;
	    datum.HostProjectName = project.title;
	    datum.HostProjectId   = project.id;             // all ids should be projectV2 or projectV2Item ids
	    datum.HostColumnName  = "No Status";            // XXX config
	    datum.HostColumnId    = datum.HostColumnName;
	    locData.push( datum );
	    
	    // Plunder the first view to get status (i.e. column) info
	    let views = project.views;
	    for( let i = 0; i < views.edges.length; i++ ) {
		const aview = views.edges[i].node;
		for( let j = 0; j < aview.fields.edges.length; j++ ) {
		    if( j >= 99 ) { console.log( "WARNING.  Detected a very large number of columns, ignoring some." ); }
		    const pfc = aview.fields.edges[j].node;
		    if( pfc.name == "Status" ) {
			for( let k = 0; k < pfc.options.length; k++ ) {
			    let datum   = {};
			    datum.HostRepository  = config.EMPTY;
			    datum.HostProjectName = project.title;
			    datum.HostProjectId   = project.id;             // all ids should be projectV2 or projectV2Item ids
			    datum.HostColumnName  = pfc.options[k].name;
			    datum.HostColumnId    = datum.HostColumnName;
			    locData.push( datum );
			}
		    }
		}
	    }
	    
	}
	assert( locData.length > 0 );

	let items = ret.data.node.items;
	for( let i = 0; i < items.edges.length; i++ ) {
	    const issue = items.edges[i].node;
	    // console.log( issue );

	    let status = issue.fieldValueByName == null ? "No Status" : issue.fieldValueByName.name;
	    
	    if( issue.type == "ISSUE" ) {
		let datum = {};
		datum.issueId     = issue.id;   // projectV2Item id pvti
		datum.issueNum    = issue.content.number;
		datum.title       = issue.content.title;
		datum.cardId      = config.EMPTY;
		datum.projectName = locData[0].HostProjectName;    
		datum.projectId   = locData[0].HostProjectId;    
		datum.columnName  = status;
		datum.columnId    = status;
		
		linkData.push( datum );
	    }
	}
	
	// console.log( "UTILS: Locs", locData );
	// console.log( "UTILS: Links", linkData );
	
	// Wait.  Data is modified
	if( items != -1 && items.pageInfo.hasNextPage ) { await geHostLinkLoc( PAT, pNodeId, locData, linkData, items.pageInfo.endCursor ); }
    }
    // await getFromIssueNode( PAT, "PVTI_lADOA8JELs4AIeW_zgDhVnY" );
    // await getFromIssueNode( PAT, "PVTI_lADOA8JELs4AIeW_zgDd0Rs" );
    // await getFromIssueNode( PAT, "PVTI_lADOA8JELs4AIeW_zgDqxC0" );
}


// Get stuff from issue content_node_id pvti_*
async function getFromIssueNode( PAT, nodeId ) {


    // contexts{ state context description createdAt targetUrl }}

    const query = `query detail($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on ProjectV2Item { databaseId type 
           fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }}
           content {
            ... on ProjectV2ItemContent {
             ... on Issue { title databaseId number state repository {nameWithOwner}
                assignees(first: 100)    { edges { node { login id }}}
                labels(first: 100)       { edges { node { name description color id }}}
                projectItems(first: 100) { edges { node { id type }}}
                projectCards(first: 100) { edges { node { id }}}
         }}}
    }}}`;

    let variables = {"nodeId": nodeId };
    let queryJ = JSON.stringify({ query, variables });

    const ret = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, queryJ )
	.catch( e => ghUtils.errorHandler( "getProjectFromNode", e, getProjectFromNode, PAT, nodeId ));  // this will probably never catch anything

    // postGH masks errors, catch here.
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {
	await ghUtils.errorHandler( "getProjectFromNode", ret, getProjectFromNode, PAT, nodeId ); 
    }
    else {
	
	console.log( "Looking for info on", nodeId );
	
	console.log( ret );
	console.log( ret.data.node.content );
	
	let data = ret.data.node.fieldValueByName;
	console.log( "Status", data );

	printEdges( ret.data.node.content, "assignees" );
	printEdges( ret.data.node.content, "labels" );
	// printEdges( ret.data.node.content, "projectItems", ["id"] );  
	// printEdges( ret.data.node.content, "projectCards", ["id"] );

	if( ret.data.node.content.assignees.length > 99 ) { console.log( "WARNING.  Detected a very large number of assignees, ignoring some." ); }
	if( ret.data.node.content.labels.length > 99 ) { console.log( "WARNING.  Detected a very large number of labels, ignoring some." ); }

    }

    return ret;
}


// XXX Eliminate this, or check limits (first n).
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
            number title databaseId public resourcePath id
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

// Note: mutation:createIssue with inputObject that includes projIds only works for classic projects, not PV2.
// Note: mutation:addProjectV2DraftIssue works, but can't seem to find how to convert draft to full issue in gql?!!??
async function createIssue( PAT, repoNode, projNode, title, labels, allocation ) {
    let issueData = [-1,-1]; // contentId, num
    
    console.log( "\n\nCreate issue, from alloc?", repoNode, projNode, title, allocation );

    let body = "";
    if( allocation ) {
	body  = "This is an allocation issue added by CodeEquity.  It does not reflect specific work or issues to be resolved.  ";
	body += "It is simply a rough estimate of how much work will be carried out in this category.\n\n"
	body += "It is safe to filter this out of your issues list.\n\n";
	body += "It is NOT safe to close, reopen, or edit this issue.";
    }

    let query = "mutation( $repo:ID!, $title:String!, $body:String!, $labels:[ID!] ) " 
    query +=    "{ createIssue( input:{ repositoryId: $repo, title: $title, body: $body, labelIds: $labels }) {clientMutationId, issue{id, number}}}";
    
    let variables = {"repo": repoNode, "title": title, "body": body, "labels": labels };
	
    let queryJ = JSON.stringify({ query, variables });

    let ret = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, queryJ )
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {  
	ret = await ghUtils.errorHandler( "createIssue", ret, createIssue, PAT, repoNode, projNode, title );
	if( !ret ) { return ret; }
    }
    issueData[0] = ret.data.createIssue.issue.id;
    issueData[1] = ret.data.createIssue.issue.number;
    console.log( " .. issue created, issueData:", issueData );
    
    query = "mutation( $proj:ID!, $contentId:ID! ) { addProjectV2ItemById( input:{ projectId: $proj, contentId: $contentId }) {clientMutationId, item{id}}}";
    variables = {"proj": projNode, "contentId": ret.data.createIssue.issue.id };

    queryJ = JSON.stringify({ query, variables });
    
    ret = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, queryJ )
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {  
	ret = await ghUtils.errorHandler( "createIssue", ret, createIssue, PAT, repoNode, projNode, title );
	if( !ret ) { return ret; }
    }

    ret = ret.data.addProjectV2ItemById.item.id;
    console.log( " .. issue added to project, pv2ItemId:", ret );
    return issueData;
}

// update label
// delete label
// find label
// create label
async function createLabel( PAT, repoNode, name, color, desc ) {

    console.log( "Create label", repoNode, name, desc, color );
    let query = "mutation( $id:ID! ) { createLabel( input:{ repositoryId: $id, color: color, description: desc, name: name }) {clientMutationId}}";


    let variables = {"id": repoNode };
    let queryJ = JSON.stringify({ query, variables });

    const ret = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, queryJ )
	.catch( e => ghUtils.errorHandler( "getProjectFromNode", e, getProjectFromNode, PAT, nodeId ));  // this will probably never catch anything

    // postGH masks errors, catch here.
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {
	await ghUtils.errorHandler( "getProjectFromNode", ret, getProjectFromNode, PAT, repoNode ); 
    }
    else {
	console.log( ret );
    }

    return ret;
}




exports.getHostLinkLoc     = getHostLinkLoc;
exports.getProjectFromNode = getProjectFromNode;
exports.getFromIssueNode   = getFromIssueNode;

exports.createIssue        = createIssue;
exports.createLabel        = createLabel;
