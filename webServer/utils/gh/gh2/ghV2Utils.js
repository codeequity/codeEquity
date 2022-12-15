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
async function getHostLinkLoc( authData, pNodeId, locData, linkData, cursor ) {

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

    const ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	  .catch( e => ghUtils.errorHandler( "getHostLinkLoc", e, getHostLinkLoc, authData, pNodeId, locData, linkData, cursor )); 

    // postGH masks errors, catch here.
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {
	await ghUtils.errorHandler( "getHostLinkLoc", ret, getHostLinkLoc, authData, pNodeId, locData, linkData, cursor ); 
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
	if( items != -1 && items.pageInfo.hasNextPage ) { await geHostLinkLoc( authData, pNodeId, locData, linkData, items.pageInfo.endCursor ); }
    }
    // await getFromIssueNode( authData, "PVTI_lADOA8JELs4AIeW_zgDhVnY" );
    // await getFromIssueNode( authData, "PVTI_lADOA8JELs4AIeW_zgDd0Rs" );
    // await getFromIssueNode( authData, "PVTI_lADOA8JELs4AIeW_zgDqxC0" );
}


// Get stuff from issue content_node_id pvti_*
async function getFromIssueNode( authData, nodeId ) {


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

    const ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.catch( e => ghUtils.errorHandler( "getProjectFromNode", e, getProjectFromNode, authData, nodeId ));  // this will probably never catch anything

    // postGH masks errors, catch here.
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {
	await ghUtils.errorHandler( "getProjectFromNode", ret, getProjectFromNode, authData, nodeId ); 
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
async function getProjectFromNode( authData, pNodeId ) {

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

    const ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.catch( e => ghUtils.errorHandler( "getProjectFromNode", e, getProjectFromNode, authData, pNodeId ));  // this will probably never catch anything

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
async function createIssue( authData, repoNode, projNode, title, labels, allocation ) {
    let issueData = [-1,-1]; // contentId, num
    
    console.log( "Create issue, from alloc?", repoNode, projNode, title, allocation );

    let body = "";
    if( allocation ) {
	body  = "This is an allocation issue added by CodeEquity.  It does not reflect specific work or issues to be resolved.  ";
	body += "It is simply a rough estimate of how much work will be carried out in this category.\n\n"
	body += "It is safe to filter this out of your issues list.\n\n";
	body += "It is NOT safe to close, reopen, or edit this issue.";
    }

    let query = `mutation( $repo:ID!, $title:String!, $body:String!, $labels:[ID!] )
                    { createIssue( input:{ repositoryId: $repo, title: $title, body: $body, labelIds: $labels }) {clientMutationId, issue{id, number}}}`;

    let variables = {"repo": repoNode, "title": title, "body": body, "labels": labels };
	
    let queryJ = JSON.stringify({ query, variables });

    let ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {  
	ret = await ghUtils.errorHandler( "createIssue", ret, createIssue, authData, repoNode, projNode, title );
	return ret;
    }
    issueData[0] = ret.data.createIssue.issue.id;
    issueData[1] = ret.data.createIssue.issue.number;
    console.log( " .. issue created, issueData:", issueData );
    
    query = "mutation( $proj:ID!, $contentId:ID! ) { addProjectV2ItemById( input:{ projectId: $proj, contentId: $contentId }) {clientMutationId, item{id}}}";
    variables = {"proj": projNode, "contentId": ret.data.createIssue.issue.id };

    queryJ = JSON.stringify({ query, variables });
    
    ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {  
	ret = await ghUtils.errorHandler( "createIssue", ret, createIssue, authData, repoNode, projNode, title );
	return ret;
    }

    ret = ret.data.addProjectV2ItemById.item.id;
    console.log( " .. issue added to project, pv2ItemId:", ret );
    return issueData;
}


// Label descriptions help determine if issue is an allocation
async function getIssue( authData, issueNodeId ) {
    let retVal   = [];
    if( issueNodeId == -1 ) { return retVal; }
    
    let issue = await getFullIssue( authData, issueNodeId );
    let retIssue = [];
    
    retIssue.push( issue.id );
    retVal.push( issue.title );
    if( issue.labels.edges.length > 0 ) {
	for( label of issue.labels.edges ) { retVal.push( label.node.description ); }
    }
    retIssue.push( retVal );
    return retIssue;
    
}

// More is available.. needed?
async function getFullIssue( authData, issueNodeId ) {
    console.log( "Get Full Issue", issueNodeId );

    let query = `query( $id:ID! ) {
                   node( id: $id ) {
                   ... on Issue {
                     id
                     body
                     assignees(first:99) { edges { node { id login }}}
                     labels(first: 99)   { edges { node { id name description }}}
                     milestone { id }
                     repository { id }
                     state
                     title
                  }}}`;

    let variables = {"id": issueNodeId};
    let queryJ    = JSON.stringify({ query, variables });

    let ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {  
	ret = await ghUtils.errorHandler( "getFullIssue", ret, getFullIssue, authData, issueNodeId );
	return ret;
    }
    
    let issue = ret.data.node;
    if( issue.assignees.edges.length > 99 ) { console.log( "WARNING.  Large number of assignees.  Ignoring some." ); }
    if( issue.labels.edges.length > 99 )    { console.log( "WARNING.  Large number of labels.  Ignoring some." ); }
    return issue;
}

async function createLabel( authData, repoNode, name, color, desc ) {

    console.log( "Create label", repoNode, name, desc, color );

    let query     = `mutation( $id:ID!, $color:String!, $name:String!, $desc:String! )
                       { createLabel( input:{ repositoryId: $id, color: $color, description: $desc, name: $name }) {clientMutationId, label {id, name, color, description}}}`;

    let variables = {"id": repoNode, "name": name, "color": color, "desc": desc };
    let queryJ    = JSON.stringify({ query, variables });

    let ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {  
	ret = await ghUtils.errorHandler( "createLabel", ret, createLabel, authData, repoNode, name, color, desc );
	return ret;
    }

    if( ret.errors !== 'undefined' ) { console.log( "WARNING. Label not created", ret.errors ); }
    else                             { console.log( " .. label added to repo, pv2ItemId:", ret.data.createLabel.label.id ); }

    return ret.data.createLabel.label;
}

async function getLabel( authData, repoNode, peqHumanLabelName ) {
    let labelRes = {}
    labelRes.status = 404;

    console.log( "Get label", repoNode, peqHumanLabelName );

    // query below checks both name and description
    let query = `query( $repoNode:ID!, $name:String! ) {
                   node( id: $repoNode ) {
                   ... on Repository {
                       labels(first: 99, query: $name) {
                          edges { node { id, name, color, description }}}
                  }}}`;

    let variables = {"repoNode": repoNode, "name": peqHumanLabelName };
    let queryJ    = JSON.stringify({ query, variables });

    let ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {  
	ret = await ghUtils.errorHandler( "getLabel", ret, getLabel, authData, repoNode, peqHumanLabelName );
	return ret;
    }

    let labels = ret.data.node.labels; 
    if( typeof labels === 'undefined' ) { return labelRes; }

    if( labels.edges.length > 99 ) { console.log( "WARNING. Found too many labels.  Ignoring some." ); }
    
    for( let i = 0; i < labels.edges.length; i++ ) {
	const lab = labels.edges[i].node;
	if( lab.name == peqHumanLabelName ) {
	    labelRes.status = 200;
	    labelRes.label = lab;
	}
    }
    
    return labelRes;
}

async function getLabels( authData, issueNodeId ) {
    console.log( "Get labels on issue", issueNodeId );

    let query = `query( $id:ID! ) {
                   node( id: $id ) {
                   ... on Issue {
                       labels(first: 99) {
                          edges { node { id, name, color, description }}}
                  }}}`;
    let variables = {"id": issueNodeId };
    let queryJ    = JSON.stringify({ query, variables });

    let ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {  
	ret = await ghUtils.errorHandler( "getLabels", ret, getLabels, authData, issueNodeId );
	return ret;
    }

    let raw    = ret.data.node.labels;
    let labels = [];
    if( typeof raw === 'undefined' ) { return labels; }

    for( let i = 0; i < raw.edges.length; i++ ) {
	let label = raw.edges[i].node;
	labels.push( label );
    }

    return labels;
}    

async function createPeqLabel( authData, repoNode, allocation, peqValue ) {
    console.log( "Creating PEQ label", allocation, peqValue );
    let peqHumanLabelName = peqValue.toString() + " " + ( allocation ? config.ALLOC_LABEL : config.PEQ_LABEL );  
    let desc = ( allocation ? config.ADESC : config.PDESC ) + peqValue.toString();
    let pcolor = allocation ? config.APEQ_COLOR : config.PEQ_COLOR;
    let label = await createLabel( authData, repoNode, peqHumanLabelName, pcolor, desc );
    return label;
}

async function findOrCreateLabel( authData, repoNode, allocation, peqHumanLabelName, peqValue ) {

    console.log( "\n\nFind or create label", repoNode, allocation, peqHumanLabelName, peqValue );

    // Find?
    const labelRes = await getLabel( authData, repoNode, peqHumanLabelName );
    let   theLabel = labelRes.label;

    // Create?
    if( labelRes.status != 200 ) {
	console.log( authData.who, "Label not found, creating.." );
	
	if( peqHumanLabelName == config.POPULATE ) { theLabel = await createLabel( authData, repoNode, peqHumanLabelName, '111111', "populate" ); }
	else if( peqValue < 0 )                    { theLabel = await createLabel( authData, repoNode, peqHumanLabelName, '654321', "Oi!" ); }
	else                                       { theLabel = await createPeqLabel( authData, repoNode, allocation, peqValue );            }
    }
    assert( theLabel != null && typeof theLabel !== 'undefined', "Did not manage to find or create the PEQ label" );
    return theLabel;
}

async function updateLabel( authData, labelNodeId, name, desc, color ) {

    console.log( "Update label to", name, desc, color );

    let query     = "";

    let variables = {"id": labelNodeId, "name": name, "desc": desc};

    if( typeof color === 'undefined' ) {
	query = `mutation( $id:ID!, $name:String!, $desc:String! )
                   { updateLabel( input:{id: $id, name: $name, description: $desc }) {clientMutationId}}`;
    }
    else {
	query = `mutation( $id:ID!, $color:String!, $name:String!, $desc:String! )
                   { updateLabel( input:{id: $id, color: $color, name: $name, description: $desc }) {clientMutationId}}`;
	variables.color = color;
    }
    let queryJ    = JSON.stringify({ query, variables });

    let ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {  
	ret = await ghUtils.errorHandler( "updateLabel", ret, updateLabel, authData, labelNodeId, name, desc, color );
	return ret;
    }
    return true;
}

// Primarily used when double-peq label an issue
async function removeLabel( authData, labelNodeId, issueNodeId ) {
    console.log( "Remove label", labelNodeId, "from", issueNodeId );

    let query     = `mutation( $labelIds:[ID!]!, $labelableId:ID! ) 
                        { removeLabelsFromLabelable( input:{ labelIds: $labelIds, labelableId: $labelableId })  {clientMutationId}}`;
    let variables = {"labelIds": [labelNodeId], "labelableId": issueNodeId };
    let queryJ    = JSON.stringify({ query, variables });
    
    let ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {  
	ret = await ghUtils.errorHandler( "removeLabel", ret, removeLabel, authData, labelNodeId, issueNodeId );
	return ret;
    }
    return true;
}
    
async function removePeqLabel( authData, issueNodeId ) {
    var labels = await getLabels( authData, issueNodeId );

    if( typeof labels === 'undefined' || labels == false || labels.length <= 0 ) { return false; }
    if( labels.length > 99 ) { console.log( "Error.  Too many labels for issue", issueNum );} 

    let peqLabel = {};
    // There can only be one, by definition.
    for( const label of labels ) {
	const tval = ghUtils.parseLabelDescr( [label.description] );
	if( tval > 0 ) { peqLabel = label; break; }
    }
    await removeLabel( authData, peqLabel.id, issueNodeId );

    return true;
}

async function addLabel( authData, labelNodeId, issueNodeId ) {
    console.log( "Add label", labelNodeId, "to", issueNodeId );

    let query     = `mutation( $labelIds:[ID!]!, $labelableId:ID! ) 
                        { addLabelsToLabelable( input:{ labelIds: $labelIds, labelableId: $labelableId })  {clientMutationId}}`;
    let variables = {"labelIds": [labelNodeId], "labelableId": issueNodeId };
    let queryJ    = JSON.stringify({ query, variables });
    
    let ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {  
	ret = await ghUtils.errorHandler( "addLabel", ret, addLabel, authData, labelNodeId, issueNodeId );
	return ret;
    }
    return true;
}

async function rebuildLabel( authData, oldLabelId, newLabelId, issueNodeId ) {
    // Don't wait.  
    removeLabel( authData, oldLabelId, issueNodeId );
    addLabel( authData, newLabelId, issueNodeId );
}


/*
// Targets
    getAllocated: function( cardContent ) {
	return getAllocated( cardContent );
    },

    parsePEQ: function( cardContent, allocation ) {
	return parsePEQ( cardContent, allocation );
    },

    theOnePEQ: function( labels ) {
	return theOnePEQ( labels );
    },

    validatePEQ: function( authData, repo, issueId, title, projId ) {
	return validatePEQ( authData, repo, issueId, title, projId );
    },

    createProjectGQL: function( ownerId, PAT, repo, repoId, name, body, beta ) {
	return createProjectGQL( ownerId, PAT, repo, repoId, name, body, beta );
    },

    getOwnerIdGQL: function( PAT, owner ) {
	return getOwnerIdGQL( PAT, owner );
    },

    getRepoIdGQL: function( PAT, owner, repo ) {
	return getRepoIdGQL( PAT, owner, repo );
    },
    
    createProjectCard: function( authData, columnId, issueId, justId ) {
	return createProjectCard( authData, columnId, issueId, justId );
    },

    updateTitle: function( authData, owner, repo, issueNum, title ) {
	return updateTitle( authData, owner, repo, issueNum, title );
    },

    addComment: function( authData, owner, repo, issueNum, msg ) {
	return addComment( authData, owner, repo, issueNum, msg );
    },

    rebuildIssue: function( authData, owner, repo, issue, msg, splitTag ) {
	return rebuildIssue( authData, owner, repo, issue, msg, splitTag );
    },

    cleanUnclaimed: function( authData, ghLinks, pd ) {
	return cleanUnclaimed( authData, ghLinks, pd );
    },
    
    updateIssue: function( authData, owner, repo, issueNum, newState ) {
	return updateIssue( authData, owner, repo, issueNum, newState );
    },

    updateColumn: function( authData, colId, newName ) {
	return updateColumn( authData, colId, newName );
    },

    updateProject: function( authData, projId, newName ) {
	return updateProject( authData, projId, newName );
    },

    addAssignee: function( authData, owner, repo, issueNumber, assignee ) {
	return addAssignee( authData, owner, repo, issueNumber, assignee );
    },
    
    remAssignee: function( authData, owner, repo, issueNumber, assignee ) {
	return remAssignee( authData, owner, repo, issueNumber, assignee );
    },
    
}


var githubUtils = {

    getAssignees: function( authData, owner, repo, issueNum ) {
	return getAssignees( authData, owner, repo, issueNum );
    },

    checkIssue: function( authData, owner, repo, issueNum ) {
	return checkIssue( authData, owner, repo, issueNum );  
    },

    getIssue: function( authData, owner, repo, issueNum ) {
	return getIssue( authData, owner, repo, issueNum );
    },

    getCard: function( authData, cardId ) {
	return getCard( authData, cardId );
    },

    getFullIssue: function( authData, owner, repo, issueNum ) {
	return getFullIssue( authData, owner, repo, issueNum );
    },

    removeCard: function( authData, cardId ) {
	return removeCard( authData, cardId );
    },
	
    rebuildCard: function( authData, ceProjId, ghLinks, owner, repo, colId, origCardId, issueData, locData ) {
	return rebuildCard( authData, ceProjId, ghLinks, owner, repo, colId, origCardId, issueData, locData );
    },

    createUnClaimedCard: function( authData, ghLinks, pd, issueId, accr ) {
	return createUnClaimedCard( authData, ghLinks, pd, issueId, accr );
    },

    getRepoLabelsGQL: function( PAT, owner, repo, data, cursor ) {
	return getRepoLabelsGQL( PAT, owner, repo, data, cursor );
    },

    getReposGQL: function( PAT, owner, data, cursor ) {
	return getReposGQL( PAT, owner, data, cursor );
    },

    getRepoIssuesGQL: function( PAT, owner, repo, data, cursor ) {
	return getRepoIssuesGQL( PAT, owner, repo, data, cursor );
    },

    getRepoIssueGQL: function( PAT, owner, repo, issueDatabaseId, data, cursor ) {
	return getRepoIssueGQL( PAT, owner, repo, issueDatabaseId, data, cursor );
    },

    getBasicLinkDataGQL: function( PAT, owner, repo, data, cursor ) {
	return getBasicLinkDataGQL( PAT, owner, repo, data, cursor );
    },

    getLabelIssuesGQL: function( PAT, owner, repo, labelName, data, cursor ) {
	return getLabelIssuesGQL( PAT, owner, repo, labelName, data, cursor );
    },

    getRepoColsGQL: function( PAT, owner, repo, data, cursor ) {
	return getRepoColsGQL( PAT, owner, repo, data, cursor );
    },

    transferIssueGQL: function( authData, issueId, toRepoId ) {
	return transferIssueGQL( authData, issueId, toRepoId );
    },

    populateRequest: function( labels ) {
	return populateRequest( labels );
    },

    getCEProjectLayout: function( authData, ghLinks, pd ) {
	return getCEProjectLayout( authData, ghLinks, pd );
    },
    
    moveCard: function( authData, cardId, colId ) {
	return moveCard( authData, cardId, colId ); 
    },

    checkReserveSafe: function( authData, owner, repo, issueNum, colNameIndex ) {
	return checkReserveSafe( authData, owner, repo, issueNum, colNameIndex );
    },
    
    moveIssueCard: function( authData, ghLinks, pd, action, ceProjectLayout ) {
	return moveIssueCard( authData, ghLinks, pd, action, ceProjectLayout ); 
    },

    getProjectName: function( authData, ghLinks, ceProjId, fullName, projId ) {
	return getProjectName( authData, ghLinks, ceProjId, fullName, projId ); 
    },

    getColumnName: function( authData, ghLinks, ceProjId, fullName, colId ) {
	return getColumnName( authData, ghLinks, ceProjId, fullName, colId ); 
    },
*/

exports.getProjectFromNode = getProjectFromNode;
exports.getFromIssueNode   = getFromIssueNode;
    
exports.getHostLinkLoc     = getHostLinkLoc;

exports.createIssue        = createIssue;
exports.getIssue           = getIssue;
exports.getFullIssue       = getFullIssue;

// checkIssue
// updateIssue
// rebuildIssue
// transferIssue
// addComment
// updateTitle
// addAssignee
// remAssignee
// getAssignees

// updateProject
// updateColumn


exports.createLabel        = createLabel;
exports.createPeqLabel     = createPeqLabel;
exports.getLabel           = getLabel;
exports.getLabels          = getLabels;
exports.findOrCreateLabel  = findOrCreateLabel;
exports.updateLabel        = updateLabel;
exports.removeLabel        = removeLabel;
exports.removePeqLabel     = removePeqLabel;
exports.addLabel           = addLabel;
exports.rebuildLabel       = rebuildLabel;
