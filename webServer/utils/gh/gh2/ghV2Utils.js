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
// Note: a single project:col can have issues from multiple repos.  rather than present a list in locData, set repo to EMPTY.
// Note: an issue will belong to 1 repo only
// Note: it seems that "... on Issue" is applying a host-side filter, so no need to more explicitely filter out draft issues and pulls.
// Note: optionId is sufficient for columnId, given the projectId.
// XXX if optionId changes per view... ? 
// XXX views does not (yet?) have a fieldByName, which would make it much quicker to find status.
// XXX Getting several values per issue here that are unused.  remove.
async function getHostLinkLoc( authData, pNodeId, locData, linkData, cursor ) {

    const query1 = `query linkLoc($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            number title id
            items(first: 100) {
              pageInfo { hasNextPage, endCursor }
              edges { node {
                  ... on ProjectV2Item { type id
                    fieldValueByName(name: "Status") {
                     ... on ProjectV2ItemFieldSingleSelectValue { name optionId field { ... on ProjectV2SingleSelectField { id }}}}
                    content {
                     ... on ProjectV2ItemContent {
                       ... on Issue { id number repository {nameWithOwner} title projectItems(first: 100) { edges {node { id }}} }}}
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
                          ... on ProjectV2SingleSelectField {id name options {id name}
                              }}}}}}}}}
    }}}`;

    const queryN = `query linkLoc($nodeId: ID!, $cursor: String!) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            number title id
            items(first: 100 after: $cursor) {
              pageInfo { hasNextPage, endCursor }
              edges { node {
                  ... on ProjectV2Item { type id
                    fieldValueByName(name: "Status") {
                     ... on ProjectV2ItemFieldSingleSelectValue { name optionId field { ... on ProjectV2SingleSelectField { id }}}}
                    content {
                     ... on ProjectV2ItemContent {
                       ... on Issue { id number repository {nameWithOwner} title projectItems(first: 100) { edges {node { id }}} }}}
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
                          ... on ProjectV2SingleSelectField {id name options {id name}
                              }}}}}}}}}
    }}}`;


    let query     = cursor == -1 ? query1 : queryN;
    let variables = cursor == -1 ? {"nodeId": pNodeId } : {"nodeId": pNodeId, "cursor": cursor };
    query = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( raw.status != 200 ) { throw raw; }
	    let project = raw.data.node;
	    let statusId = -1;
	    
	    // Loc data only needs to be built once.  Will be the same for every issue.
	    // Note: can not build this from issues below, since we may have empty columns in board view.
	    if( locData.length <= 0 ) {

		// XXX why process every view?
		// Plunder the first view to get status (i.e. column) info
		let views = project.views;
		if( typeof views === 'undefined' ) {
		    console.log( "Warning.  Project views are not defined.  GH2 ceProject with classic project?" );
		    statusId = 0;
		    locData = [-1];
		    return;
		}
		for( let i = 0; i < views.edges.length; i++ ) {
		    const aview = views.edges[i].node;
		    for( let j = 0; j < aview.fields.edges.length; j++ ) {
			if( j >= 99 ) { console.log( authData.who, "WARNING.  Detected a very large number of columns, ignoring some." ); }
			const pfc = aview.fields.edges[j].node;
			if( pfc.name == "Status" ) {
			    statusId = pfc.id;
			    for( let k = 0; k < pfc.options.length; k++ ) {
				let datum   = {};
				datum.hostRepository  = config.EMPTY;
				datum.hostProjectName = project.title;
				datum.hostProjectId   = project.id;             // all ids should be projectV2 or projectV2Item ids
				datum.hostColumnName  = pfc.options[k].name;
				datum.hostColumnId    = pfc.options[k].id;
				datum.hostUtility     = statusId;
				locData.push( datum );
			    }
			}
		    }
		}
		// Build "No Status" by hand, since it corresponds to a null entry
		let datum   = {};
		datum.hostRepository  = config.EMPTY;
		datum.hostProjectName = project.title;
		datum.hostProjectId   = project.id;             // all ids should be projectV2 or projectV2Item ids
		datum.hostColumnName  = config.GH_NO_STATUS; 
		datum.hostColumnId    = config.EMPTY;           // no status column does not exist in view options above.  special case.
		datum.hostUtility     = statusId;
		locData.push( datum );
	    }

	    if( statusId == 0 ) { return; }
	    assert( locData.length > 0 );
	    assert( statusId != -1 );
	    
	    let items = raw.data.node.items;
	    for( let i = 0; i < items.edges.length; i++ ) {
		const issue    = items.edges[i].node;
		const status   = issue.fieldValueByName == null  ? config.GH_NO_STATUS : issue.fieldValueByName.name;
		const optionId = issue.fieldValueByName == null  ? config.EMPTY        : issue.fieldValueByName.optionId; 
		
		if( issue.type == "ISSUE" ) {

		    let links = issue.content.projectItems.edges;    // reverse links.. yay!  used only for populateCELinkage, then tossed
		    if( links.length >= 100 ) { console.log( authData.who, "WARNING.  Detected a very large number of cards, ignoring some." ); }
		    
		    let datum = {};
		    datum.issueId     = issue.content.id;              // contentId I_*
		    datum.issueNum    = issue.content.number;
		    datum.title       = issue.content.title;
		    datum.cardId      = issue.id;                      // projectV2Item id PVTI_*
		    datum.projectName = locData[0].hostProjectName;    
		    datum.projectId   = locData[0].hostProjectId;    
		    datum.columnName  = status;
		    datum.columnId    = optionId;
		    datum.allCards    = links.map( link => link.node.id );
		    
		    linkData.push( datum );
		}
	    }
	    
	    // console.log( "UTILS: Locs", locData );
	    // console.log( "UTILS: Links", linkData );
	    
	    // Wait.  Data is modified
	    if( items != -1 && items.pageInfo.hasNextPage ) { await geHostLinkLoc( authData, pNodeId, locData, linkData, items.pageInfo.endCursor ); }
	})
	.catch( e => ghUtils.errorHandler( "getHostLinkLoc", e, getHostLinkLoc, authData, pNodeId, locData, linkData, cursor )); 
}


// XXX can remove
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

    let retVal = {};
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    if( ret.status != 200 ) { throw ret; }
	    console.log( "Looking for info on", nodeId );
	    console.log( ret.data.node.content );
	    
	    let data = ret.data.node.fieldValueByName;
	    console.log( "Status", data );
	    
	    printEdges( ret.data.node.content, "assignees" );
	    printEdges( ret.data.node.content, "labels" );
	    // printEdges( ret.data.node.content, "projectItems", ["id"] );  
	    // printEdges( ret.data.node.content, "projectCards", ["id"] );
	    retVal = ret;
	    
	    if( ret.data.node.content.assignees.length > 99 ) { console.log( "WARNING.  Detected a very large number of assignees, ignoring some." ); }
	    if( ret.data.node.content.labels.length > 99 ) { console.log( "WARNING.  Detected a very large number of labels, ignoring some." ); }
	    
	})
	.catch( e => ghUtils.errorHandler( "getProjectFromNode", e, getProjectFromNode, authData, nodeId ));  // this will probably never catch anything
    return retVal;
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
	.catch( e => ghUtils.errorHandler( "getProjectFromNode", e, getProjectFromNode, authData, pNodeId ));  // XXX this will probably never catch anything

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


// createIssue, then addProjectV2ItemById
// Note: mutation:createIssue with inputObject that includes projIds only works for classic projects, not PV2.
// Note: mutation:addProjectV2DraftIssue works, but can't seem to find how to convert draft to full issue in gql?!!??
// Note: issue below is a collection of issue details, not a true issue.
async function createIssue( authData, repoNode, projNode, issue ) {
    let issueData = [-1,-1,-1]; // contentId, num, cardId

    assert( typeof issue.title !== 'undefined', "Error.  createIssue requires a title." );
    if( typeof issue.allocation === 'undefined' ) { issue.allocation = false; }
    if( typeof issue.body === 'undefined' )       { issue.body = ""; }
    if( typeof issue.labels === 'undefined' )     { issue.labels = []; }
    if( typeof issue.assignees === 'undefined' )  { issue.assignees = []; }
    if( typeof issue.milestone === 'undefined' )  { issue.milestone = null; }
    
    console.log( authData.who, "Create issue, from alloc?", repoNode, projNode, issue.title, issue.allocation );

    assert( !issue.allocation || typeof issue.body === 'undefined', "Error.  createIssue body is about to be overwritten." );
    if( issue.allocation ) {
	issue.body  = "This is an allocation issue added by CodeEquity.  It does not reflect specific work or issues to be resolved.  ";
	issue.body += "It is simply a rough estimate of how much work will be carried out in this category.\n\n"
	issue.body += "It is safe to filter this out of your issues list.\n\n";
	issue.body += "It is NOT safe to close, reopen, or edit this issue.";
    }

    // assignees, labels are lists of IDs, not full labels.
    issue.labels    = issue.labels.map(    lab  => Object.keys( lab  ).length > 0 ? lab.id  : lab );
    issue.assignees = issue.assignees.map( assn => Object.keys( assn ).length > 0 ? assn.id : assn );
    
    let query = `mutation( $repo:ID!, $title:String!, $body:String!, $labels:[ID!], $assg:[ID!], $mile:ID )
                    { createIssue( input:{ repositoryId: $repo, title: $title, body: $body, labelIds: $labels, assigneeIds: $assg, milestoneId: $mile }) 
                    {clientMutationId, issue{id, number}}}`;

    let variables = {"repo": repoNode, "title": issue.title, "body": issue.body, "labels": issue.labels, "mile": issue.milestone, "assg": issue.assignees };
    let queryJ    = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    if( ret.status != 200 ) { throw ret; }
	    issueData[0] = ret.data.createIssue.issue.id;
	    issueData[1] = ret.data.createIssue.issue.number;
	    console.log( authData.who, " .. issue created, issueData:", issueData );
	})
	.catch( e => ghUtils.errorHandler( "createIssue", e, createIssue, authData, repoNode, projNode, issue ));

    // Sometimes, just want unsituated issue
    if( projNode != -1 ) {
	query     = "mutation( $proj:ID!, $contentId:ID! ) { addProjectV2ItemById( input:{ projectId: $proj, contentId: $contentId }) {clientMutationId, item{id}}}";
	variables = {"proj": projNode, "contentId": issueData[0]};
	queryJ    = JSON.stringify({ query, variables });
	
	// XXX If the create above succeeds and this triggers, the it will attempt to create again.  Copy made?  Split this out.
	let pvId = -1;
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	    .then( ret => {
		if( ret.status != 200 ) { throw ret; }
		pvId = ret.data.addProjectV2ItemById.item.id;
		issueData[2] = pvId;
		console.log( authData.who, " .. issue added to project, pv2ItemId:", pvId );
	    })
	    .catch( e => ghUtils.errorHandler( "createIssue", e, createIssue, authData, repoNode, projNode, issue ));
    }
    
    return issueData;
}

// get unusual faceplate info
// Label descriptions help determine if issue is an allocation
async function getIssue( authData, issueId ) {
    let retVal   = [];
    if( issueId == -1 ) { return retVal; }
    
    let issue = await getFullIssue( authData, issueId );
    let retIssue = [];
    
    retIssue.push( issue.id );
    retVal.push( issue.title );
    if( issue.labels.edges.length > 0 ) {
	for( label of issue.labels ) { retVal.push( label.description ); }
    }
    retIssue.push( retVal );
    return retIssue;
    
}

// More is available.. needed?.  Content id here, not project item id
async function getFullIssue( authData, issueId ) {
    console.log( authData.who, "Get Full Issue", issueId );

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

    let variables = {"id": issueId};
    let queryJ    = JSON.stringify({ query, variables });

    let issue = {};
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    if( ret.status != 200 ) { throw ret; }
	    issue = ret.data.node;
	    if( issue.assignees.edges.length > 99 ) { console.log( authData.who, "WARNING.  Large number of assignees.  Ignoring some." ); }
	    if( issue.labels.edges.length > 99 )    { console.log( authData.who, "WARNING.  Large number of labels.  Ignoring some." ); }
	    issue.assignees = issue.assignees.edges.map( edge => edge.node );
	    issue.labels    = issue.labels.edges.map( edge => edge.node );
	})
	.catch( e => issue = ghUtils.errorHandler( "getFullIssue", e, getFullIssue, authData, issueId ));


    return issue;
}

async function updateIssue( authData, issueId, field, newValue ) {

    let query     = "";
    if(      field == "state" ) { query = `mutation( $id:ID!, $value:IssueState ) { updateIssue( input:{ id: $id, state: $value }) {clientMutationId}}`; }
    else if( field == "title" ) { query = `mutation( $id:ID!, $value:String )     { updateIssue( input:{ id: $id, title: $value }) {clientMutationId}}`; }
    
    let variables = {"id": issueId, "value": newValue };
    let queryJ    = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    if( ret.status != 200 ) { throw ret; }
	    console.log( authData.who, "updateIssue done" );
	})
	.catch( e => ghUtils.errorHandler( "updateIssue", e, updateIssue, authData, issueId, field, newValue ));
    return true;
}

async function updateTitle( authData, issueId, title ) {
    return await updateIssue( authData, issueId, "title", title );
}

async function addComment( authData, issueId, msg ) {
    let query     = `mutation( $id:ID!, $msg:String! ) { addComment( input:{ subjectId: $id, body: $msg }) {clientMutationId}}`;
    let variables = {"id": issueId, "msg": msg };
    let queryJ    = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.catch( e => ghUtils.errorHandler( "addComment", e, addComment, authData, issueId, msg ));
    return true;
}

async function rebuildIssue( authData, repoNodeId, projectNodeId, issue, msg, splitTag ) { 
    console.log( authData.who, "Rebuild issue from", issue.id );
    let issueData = [-1,-1];  // issue id, num
    assert( typeof issue.id !== 'undefined', "Error.  rebuildIssue needs an issue to point back to" );

    let title = issue.title;
    if( typeof splitTag !== 'undefined' ) { issue.title = issue.title + " split: " + splitTag; }

    let success = false;

    // XXX Fugly
    if( utils.TEST_EH && Math.random() < utils.TEST_EH_PCT ) {
	await utils.failHere( "rebuildIssue" )
	    .catch( e => issueData = ghUtils.errorHandler( "rebuildIssue", utils.FAKE_ISE, rebuildIssue, authData, repoNodeId, projectNodeId, issue, msg, splitTag ));
    }
    else {
	// console.log( "Calling create", repoNodeId, projectNodeId, issue );
	issueData = await createIssue( authData, repoNodeId, projectNodeId, issue );
	if( issueData[0] != -1 && issueData[1] != -1 && issueData[2] != -1 ) { success = true; }
    }

    if( success ) {
	let comment = "";
	if( typeof splitTag !== 'undefined' ) {
	    comment = "CodeEquity duplicated this new issue from issue id:" + issue.id.toString() + " on " + utils.getToday().toString();
	    comment += " in order to ensure that issues have exactly one location."
	}
	else { comment = utils.getToday().toString() + ": " + msg; }
	    
	// Don't wait.
	addComment( authData, issueData[0], comment );
    }
    return issueData;
}


async function addAssignee( authData, issueId, aNodeId ) {

    let ret = false;
    console.log( authData.who, "Add assignee", issueId, aNodeId );
    if( utils.TEST_EH && Math.random() < utils.TEST_EH_PCT ) {
	await utils.failHere( "addAssignee" )
	    .catch( e => ghUtils.errorHandler( "addAssignee", utils.FAKE_ISE, addAssignee, authData, issueId, aNodeId )); 
    }
    else {
	let query = `mutation( $id:ID!, $adds:[ID!]! )
                    { addAssigneesToAssignable( input:{ assignableId: $id, assigneeIds: $adds }) {clientMutationId}}`;
	
	let variables = {"id": issueId, "adds": [aNodeId] };
	let queryJ    = JSON.stringify({ query, variables });
	
	ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {  
	    ret = await ghUtils.errorHandler( "addAssignee", ret, addAssignee, authData, issueId, aNodeId );
	    return ret;
	}
    }
    return ret;
}

async function remAssignee( authData, issueId, aNodeId ) {
    let query = `mutation( $id:ID!, $adds:[ID!]! )
                 { removeAssigneesFromAssignable( input:{ assignableId: $id, assigneeIds: $adds }) {clientMutationId}}`;
    
    let variables = {"id": issueId, "adds": [aNodeId] };
    let queryJ    = JSON.stringify({ query, variables });
    
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.catch( e => ghUtils.errorHandler( "remAssignee", e, remAssignee, authData, issueId, aNodeId ));
}

// Note.. unassigned is normal for plan, abnormal for inProgress, not allowed for accrued.
// Note. alignment risk - card info could have moved on
async function getAssignees( authData, issueId ) {

    let retVal = [];
    if( issueId == -1 ) { console.log( authData.who, "getAssignees: bad issue", issueId ); return retVal; }

    // XXX Fugly
    if( utils.TEST_EH && Math.random() < utils.TEST_EH_PCT ) {
	await utils.failHere( "getAssignees" )
	    .catch( e => retVal = ghUtils.errorHandler( "getAssignees", utils.FAKE_ISE, getAssignees, authData, issueId));
    }
    else {

	let query = `query( $id:ID! ) {
                       node( id: $id ) {
                        ... on Issue {
                           assignees(first: 100)    { edges { node { login id }}}
                  }}}`;
	let variables = {"id": issueId };
	let queryJ    = JSON.stringify({ query, variables });
	
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	    .then( raw => {
		if( raw.status != 200 ) { throw raw; }
		let assigns = raw.data.node.assignees;
		for( let i = 0; i < assigns.edges.length; i++ ) {
		    let a = assigns.edges[i].node;
		    retVal.push( a.id );
		}
		
	    })
	    .catch( e => retVal = ghUtils.errorHandler( "getAssignees", e, getAssignees, authData, issueId ));
    }
    return retVal;
}

// XXX untested
async function transferIssue( authData, issueId, newRepoNodeId) {

    let query = `mutation ($issueId: ID!, $repoId: ID!) 
                    { transferIssue( input:{ issueId: $issueId, repositoryId: $repoId, createLabelsIfMissing: true }) {clientMutationId}}`;
    let variables = {"issueId": issueId, "repoId": newRepoNodeId };
    query = JSON.stringify({ query, variables });

    let ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.catch( e => ghUtils.errorHandler( "transferIssue", e, transferIssue, authData, issueId, newRepoNodeId ));
}




async function createLabel( authData, repoNode, name, color, desc ) {

    console.log( authData.who, "Create label", repoNode, name, desc, color );

    let query     = `mutation( $id:ID!, $color:String!, $name:String!, $desc:String! )
                       { createLabel( input:{ repositoryId: $id, color: $color, description: $desc, name: $name }) {clientMutationId, label {id, name, color, description}}}`;

    let variables = {"id": repoNode, "name": name, "color": color, "desc": desc };
    let queryJ    = JSON.stringify({ query, variables });

    let label = {};
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    if( ret.status != 200 ) { throw ret; }
	    if( typeof ret.errors !== 'undefined' ) { console.log( authData.who, "WARNING. Label not created", ret.errors ); }
	    else {
		console.log( authData.who, " .. label added to repo, pv2ItemId:", ret.data.createLabel.label.id ); 
		label = ret.data.createLabel.label;
	    }
	})
	.catch( e => label = ghUtils.errorHandler( "createLabel", e, createLabel, authData, repoNode, name, color, desc ));
    
    return label;
}

async function getLabel( authData, repoNode, peqHumanLabelName ) {
    let labelRes = {}
    labelRes.status = 404;

    console.log( authData.who, "Get label", repoNode, peqHumanLabelName );

    // query below checks both name and description
    let query = `query( $repoNode:ID!, $name:String! ) {
                   node( id: $repoNode ) {
                   ... on Repository {
                       labels(first: 99, query: $name) {
                          edges { node { id, name, color, description }}}
                  }}}`;

    let variables = {"repoNode": repoNode, "name": peqHumanLabelName };
    let queryJ    = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    if( ret.status != 200 ) { throw ret; }
	    let labels = ret.data.node.labels; 
	    if( typeof labels === 'undefined' ) { return labelRes; }
	    
	    if( labels.edges.length > 99 ) { console.log( authData.who, "WARNING. Found too many labels.  Ignoring some." ); }
	    
	    for( let i = 0; i < labels.edges.length; i++ ) {
		const lab = labels.edges[i].node;
		if( lab.name == peqHumanLabelName ) {
		    labelRes.status = 200;
		    labelRes.label = lab;
		}
	    }
	})
	.catch( e => ghUtils.errorHandler( "getLabel", e, getLabel, authData, repoNode, peqHumanLabelName ));
		
    return labelRes;
}

async function getLabels( authData, issueId ) {
    console.log( authData.who, "Get labels on issue", issueId );

    let query = `query( $id:ID! ) {
                   node( id: $id ) {
                   ... on Issue {
                       labels(first: 99) {
                          edges { node { id, name, color, description }}}
                  }}}`;
    let variables = {"id": issueId };
    let queryJ    = JSON.stringify({ query, variables });

    let labels = [];
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    if( ret.status != 200 ) { throw ret; }
	    let raw    = ret.data.node.labels;
	    if( typeof raw === 'undefined' ) { return labels; }
	    
	    for( let i = 0; i < raw.edges.length; i++ ) {
		let label = raw.edges[i].node;
		labels.push( label );
	    }
	})
	.catch( e => labels = ghUtils.errorHandler( "getLabels", e, getLabels, authData, issueId ));
    
    return labels;
}    

async function createPeqLabel( authData, repoNode, allocation, peqValue ) {
    console.log( authData.who, "Creating PEQ label", allocation, peqValue );
    let peqHumanLabelName = peqValue.toString() + " " + ( allocation ? config.ALLOC_LABEL : config.PEQ_LABEL );  
    let desc = ( allocation ? config.ADESC : config.PDESC ) + peqValue.toString();
    let pcolor = allocation ? config.APEQ_COLOR : config.PEQ_COLOR;
    let label = await createLabel( authData, repoNode, peqHumanLabelName, pcolor, desc );
    return label;
}

async function findOrCreateLabel( authData, repoNode, allocation, peqHumanLabelName, peqValue ) {

    console.log( authData.who, "Find or create label", repoNode, allocation, peqHumanLabelName, peqValue );

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

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.catch( e => ghUtils.errorHandler( "updateLabel", e, updateLabel, authData, labelNodeId, name, desc, color ));

    return true;
}

// Primarily used when double-peq label an issue
async function removeLabel( authData, labelNodeId, issueId ) {
    console.log( authData.who, "Remove label", labelNodeId, "from", issueId );

    let query     = `mutation( $labelIds:[ID!]!, $labelableId:ID! ) 
                        { removeLabelsFromLabelable( input:{ labelIds: $labelIds, labelableId: $labelableId })  {clientMutationId}}`;
    let variables = {"labelIds": [labelNodeId], "labelableId": issueId };
    let queryJ    = JSON.stringify({ query, variables });
    
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.catch( e => ghUtils.errorHandler( "removeLabel", e, removeLabel, authData, labelNodeId, issueId ));
    return true;
}
    
async function removePeqLabel( authData, issueId ) {
    var labels = await getLabels( authData, issueId );

    if( typeof labels === 'undefined' || labels == false || labels.length <= 0 ) { return false; }
    if( labels.length > 99 ) { console.log( authData.who, "Error.  Too many labels for issue", issueNum );} 

    let peqLabel = {};
    // There can only be one, by definition.
    for( const label of labels ) {
	const tval = ghUtils.parseLabelDescr( [label.description] );
	if( tval > 0 ) { peqLabel = label; break; }
    }
    await removeLabel( authData, peqLabel.id, issueId );

    return true;
}

async function addLabel( authData, labelNodeId, issueId ) {
    console.log( authData.who, "Add label", labelNodeId, "to", issueId );

    let query     = `mutation( $labelIds:[ID!]!, $labelableId:ID! ) 
                        { addLabelsToLabelable( input:{ labelIds: $labelIds, labelableId: $labelableId })  {clientMutationId}}`;
    let variables = {"labelIds": [labelNodeId], "labelableId": issueId };
    let queryJ    = JSON.stringify({ query, variables });
    
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.catch( e => ghUtils.errorHandler( "addLabel", e, addLabel, authData, labelNodeId, issueId ));
    return true;
}

async function rebuildLabel( authData, oldLabelId, newLabelId, issueId ) {
    // Don't wait.  
    removeLabel( authData, oldLabelId, issueId );
    addLabel( authData, newLabelId, issueId );
}

function getProjectName( authData, ghLinks, ceProjId, projId ) {
    if( projId == -1 ) { return -1; }

    const locs = ghLinks.getLocs( authData, { "ceProjId": ceProjId, "projId": projId } );

    const projName = locs == -1 ? locs : locs[0].hostProjectName;
    return projName
}

async function updateProject( authData, projNodeId, title ) {
    let query     = `mutation( $projId:ID!, $title:String ) { updateProjectV2( input:{ projectId: $projId, title: $title })  {clientMutationId}}`;
    let variables = {"projId": projNodeId, "title": title };
    let queryJ    = JSON.stringify({ query, variables });
	
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.catch( e => ghUtils.errorHandler( "updateProject", e, updateProject, authData, projNodeId, title ));
}

// Only repository owner can use this to create a project.  
async function createProject( authData, ownerNodeId, repoNodeId, title ) {
    console.log( "Create project", ownerNodeId, repoNodeId, title );
    let query     = `mutation( $ownerId:ID!, $repoId:ID!, $title:String! ) 
                             { createProjectV2( input:{ repositoryId: $repoId, ownerId: $ownerId, title: $title }) {clientMutationId projectV2 {id}}}`;
    let variables = {"repoId": repoNodeId, "ownerId": ownerNodeId, "title": title };
    let queryJ    = JSON.stringify({ query, variables });
	
    let pid = -1;
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    if( ret.status != 200 ) { throw ret; }
	    if( ghUtils.validField( ret, "data" ) && ghUtils.validField( ret.data, "createProjectV2" ) && ghUtils.validField( ret.data.createProjectV2, "projectV2" ))
	    {
		pid = ret.data.createProjectV2.projectV2.id;
	    }
	    console.log( authData.who, "New project id: ", pid );
	})
	.catch( e => pid = ghUtils.errorHandler( "createProject", e, createProject, authData, ownerNodeId, repoNodeId, title ));

    return pid == false ? -1 : pid;
}

// XXX revisit once column id is fixed.
function getColumnName( authData, ghLinks, ceProjId, colId ) {
    if( colId == -1 ) { return -1; }

    const locs = ghLinks.getLocs( authData, { "ceProjId": ceProjId, "colId": colId } );

    const colName = locs == -1 ? locs : locs[0].hostColumnName;
    return colName
}

// 12/22
async function updateColumn( authData, projNodeId, colId, title ) {
    console.log( authData.who, "NYI.  Github does not yet support managing status with the API" );
    console.log( authData.who, "https://github.com/orgs/community/discussions/38225" );
}


// Get location of an issue in a project from GH, not linkage data, to ensure linkage consistency.
// Status column for ghV2.
// PEQ issue will be 1:1, but non-peq issue may exist in several locations. However.  issueNodeId belongs to 1 GHproject, only.
//    i.e. add an issue to a GHproject, then add it to another project in GH.  The issueNodeId changes for the second issue.
//    Each issueNodeId (i.e. PVTI_*) has a content pointer, which points to a single, shared issue id (i.e. I_*).
async function getCard( authData, issueNodeId ) {
    let retVal = {};
    if( issueNodeId == -1 ) { console.log( authData.who, "getCard bad issue", issueNodeId ); return retVal; }

    let query = `query( $id:ID! ) {
                   node( id: $id ) {
                     ... on ProjectV2Item {
                        project { id }
                        fieldValueByName(name: "Status") {
                          ... on ProjectV2ItemFieldSingleSelectValue {optionId field { ... on ProjectV2SingleSelectField { id }}}}
                        content { 
                          ... on ProjectV2ItemContent { ... on Issue { number }}}
                  }}}`;
    let variables = {"id": issueNodeId };
    let queryJ    = JSON.stringify({ query, variables });
    
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( raw => {
	    if( raw.status != 200 ) { throw raw; }
	    let card = raw.data.node;
	    retVal.cardId      = issueNodeId;                        
	    retVal.projId      = card.project.id;                    
	    retVal.statusId    = card.fieldValueByName.field.id;     // status field node id,          i.e. PVTSSF_*
	    retVal.columnId    = card.fieldValueByName.optionId;     // single select value option id, i.e. 8dc*
	    retVal.issueNum    = card.content.number; 
	})
	.catch( e => retVal = ghUtils.errorHandler( "getCard", e, getCard, authData, issueNodeId ));

    return retVal;
}


// Currently, just relocates issue to another column (i.e. status).
async function moveCard( authData, projId, itemId, fieldId, value ) {
    console.log( authData.who, "Updating column: project item field value", projId, itemId, fieldId, value );

    let query     = `mutation( $projId:ID!, $itemId:ID!, $fieldId:ID! $value:String! ) 
                      { updateProjectV2ItemFieldValue( input:{ projectId: $projId, itemId: $itemId, fieldId: $fieldId, value: {singleSelectOptionId: $value }})  
                      { clientMutationId }}`;

    let variables = {"projId": projId, "itemId": itemId, "fieldId": fieldId, "value": value };

    let queryJ    = JSON.stringify({ query, variables });
	
    let ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.catch( e => ghUtils.errorHandler( "moveCard", e, moveCard, authData, projId, itemId, fieldId, value ));

    return ret;
}

// Moving from status: "No Status" to a different value
async function createProjectCard( authData, projNodeId, issueNodeId, fieldId, valueId, justId ) {
    let retVal = await moveCard( authData, projNodeId, issueNodeId, fieldId, valueId );

    if( retVal != -1 ) {
	retVal = justId ?
	    issueNodeId : 
	    {"projId": projNodeId, "issueId": issueNodeId, "statusId": fieldId, "statusValId": valueId };
    }

    return retVal;
}

// Deleting the pv2 node has no impact on the underlying issue content, as is expected
async function removeCard( authData, projNodeId, issueNodeId ) {
    console.log( authData.who, "RemoveCard", projNodeId, issueNodeId );
    let query     = `mutation( $projId:ID!, $itemId:ID! ) { deleteProjectV2Item( input:{ projectId: $projId, itemId: $itemId })  {clientMutationId}}`;
    let variables = {"projId": projNodeId, "itemId": issueNodeId };
    let queryJ    = JSON.stringify({ query, variables });
	
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.catch( e => ghUtils.errorHandler( "removeCard", e, removeCard, authData, projNodeId, issueNodeId ));

    // Successful post looks like the following. Could provide mutationId for traking: { data: { deleteProjectV2Item: { clientMutationId: null } } }
    return true;
}

async function rebuildCard( authData, ceProjId, ghLinks, colId, origCardId, issueData, locData ) {
    
    let isReserved = typeof locData !== 'undefined' && locData.hasOwnProperty( "reserved" ) ? locData.reserved : false;    
    let projId     = typeof locData !== 'undefined' && locData.hasOwnProperty( "projId" )   ? locData.projId   : -1;
    let projName   = typeof locData !== 'undefined' && locData.hasOwnProperty( "projName" ) ? locData.projName : "";
    let fullName   = typeof locData !== 'undefined' && locData.hasOwnProperty( "fullName" ) ? locData.fullName : "";

    assert( issueData.length == 3 );
    let issueId   = issueData[0];
    let issueNum  = issueData[1];
    let newCardId = issueData[2];

    if( colId == config.EMPTY ) {
	console.log( authData.who, "Card rebuild is for No Status column, which is a no-op.  Early return." );
	return newCardId;
    }
    
    let statusId  = -1;
    assert.notEqual( issueId, -1, "Attempting to attach card to non-issue." );

    // If card has not been tracked, colId could be wrong.  relocate.
    // Note: do not try to avoid this step during populateCE - creates a false expectation (i.e. ce is tracking) for any simple carded issue.
    if( colId == -1 ) {
	let projCard = await getCard( authData, origCardId ); 
	colId = projCard.columnId;
	statusId = projCard.statusId;
    }
    else {
	const locs = ghLinks.getLocs( authData, { "ceProjId": ceProjId, "projId": projId, "colId": colId } );
	assert( locs != -1 );
	statusId = locs[0].hostUtility;
    }

    // XXX Untested
    // Trying to build new card in reserved space .. move out of reserved, prog is preferred.
    // Finding or creating non-reserved is a small subset of getCEprojectLayout
    // StatusId is per-project.  No need to find again.
    if( isReserved ) {
	assert( projId   != -1 );
	assert( fullName != "" );
	const planName = config.PROJ_COLS[ config.PROJ_PLAN ];
	const progName = config.PROJ_COLS[ config.PROJ_PROG ];

	const locs = ghLinks.getLocs( authData, { "ceProjId": ceProjId, "projId": projId } );   
	assert( locs != -1 );
	projName = projName == "" ? locs[0].hostProjectName : projName;

	colId = -1;
	let loc = locs.find( loc => loc.hostColumnName == progName );   // prefer PROG
	if( typeof loc !== 'undefined' ) { colId = loc.hostColumnId; }
	else {
	    loc = locs.find( loc => loc.hostColumnName == planName )
	    if( typeof loc !== 'undefined' ) { colId = loc.hostColumnId; }
	}

	// XXX this currently fails since columns can't be created programmatically.
	// Create in progress, if needed
	if( colId == -1 ) {
	    let progCol = await createColumn( authData, ghLinks, ceProjId, projId, progName );
	    console.log( authData.who, "Creating new column:", progName );
	    colId = progCol.data.id;
	    let nLoc = {};
	    nLoc.ceProjectId     = ceProjId; 
	    nLoc.hostRepository  = fullName;
	    nLoc.hostProjectId   = projId;
	    nLoc.hostProjectName = projName;
	    nLoc.hostColumnId    = progName;
	    nLoc.hostColumnName  = colId;
	    nLoc.active          = "true";
	    await ghLinks.addLoc( authData, nLoc, true );
	}
    }

    // issue-linked project_card already exists if issue exists, in No Status.  Move it.
    await createProjectCard( authData, projId, newCardId, statusId, colId, true );
    assert.notEqual( newCardId, -1, "Unable to create new issue-linked card." );	    
    
    // remove orig card
    // Note: await waits for GH to finish - not for notification to be received by webserver.
    removeCard( authData, projId, origCardId );

    return newCardId;
}



// Get all, open or closed.  Otherwise, for example, link table won't see pending issues properly.
// Returning issueId, not issueNodeId
async function getLabelIssues( authData, owner, repo, labelName, data, cursor ) {
    const query1 = `query($owner: String!, $repo: String!, $labelName: String! ) {
	repository(owner: $owner, name: $repo) {
	    label(name: $labelName) {
	       issues(first: 100) {
	          pageInfo { hasNextPage, endCursor },
		  edges { node { id title number }}
		}}}}`;
    
    const queryN = `query($owner: String!, $repo: String!, $labelName: String!, $cursor: String!) {
	repository(owner: $owner, name: $repo) {
	    label(name: $labelName) {
               issues(first: 100 after: $cursor ) {
	          pageInfo { hasNextPage, endCursor },
		     edges { node { id title number }}
		}}}}`;

    let query     = cursor == -1 ? query1 : queryN;
    let variables = cursor == -1 ? {"owner": owner, "repo": repo, "labelName": labelName } : {"owner": owner, "repo": repo, "labelName": labelName, "cursor": cursor};
    query = JSON.stringify({ query, variables });

    let issues = -1;
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( raw.status != 200 ) { throw raw; }
	    let label = raw.data.repository.label;
	    if( typeof label !== 'undefined' && label != null ) {
		issues = label.issues;
		for( const issue of issues.edges ) {
		    let datum = {};
		    datum.issueId = issue.node.id;
		    datum.num     = issue.node.number;
		    datum.title   = issue.node.title;
		    data.push( datum );
		}
		// Wait.  Data is modified
		if( issues != -1 && issues.pageInfo.hasNextPage ) { await getLabelIssues( authData, owner, repo, labelName, data, issues.pageInfo.endCursor ); }
	    }
	    else {
		// XXX may not be an error.. 
		console.log( authData.who, "XXX Error, no issues for label", labelName, res );
	    }
	})
	.catch( e => ghUtils.errorHandler( "getLabelIssues", e, getLabelIssues, authData, owner, repo, labelName, data, cursor ));
}

async function getProjectIds( authData, repoFullName, data, cursor ) {

    console.log( "GPID", repoFullName );
    
    let rp = repoFullName.split('/');
    assert( rp.length == 2 );

    const query1 = `query($owner: String!, $name: String!) {
	repository(owner: $owner, name: $name) {
           id
           projectsV2(first:100) {
             pageInfo{hasNextPage, endCursor}
             edges{node{title id}}}        
           projects(first:100) {edges{node{name id}}}
		}}`;
    
    const queryN = `query($owner: String!, $name: String!, $cursor: String!) {
	repository(owner: $owner, name: $name) {
           id
           projectsV2(first:100 after: $cursor) {
              pageInfo{hasNextPage, endCursor }
              edges{node{title id}}}
           projects(first:100) {edges{node{name id}}}
		}}`;

    let query     = cursor == -1 ? query1 : queryN;
    let variables = cursor == -1 ? {"owner": rp[0], "name": rp[1] } : {"owner": rp[0], "name": rp[1], "cursor": cursor };
    query = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( raw.status != 200 ) { throw raw; }

	    let repoId = raw.data.repository.id; 
	    // Run this once only
	    if( cursor == -1 )
	    {
		let classics = raw.data.repository.projects;
		if(classics.edges.length >= 100 ) { console.log( authData.who, "WARNING.  Too many classic projects, ignoring some." ); }
		for( const c of classics.edges ) {
		    console.log( authData.who, "   - pushing", c.node.name, repoFullName, repoId );
		    let datum = {};
		    datum.hostProjectId   = c.node.id;
		    datum.hostProjectName = c.node.name;
		    datum.hostRepoName    = repoFullName;
		    datum.hostRepoId      = repoId;
		    data.push( datum );
		}
	    }
	    
	    let projs = raw.data.repository.projectsV2;
	    for( const p of projs.edges ) {
		console.log( authData.who, "   - pushing", p.node.title, repoFullName, repoId );
		let datum = {};
		datum.hostProjectId   = p.node.id;
		datum.hostProjectName = p.node.title;
		datum.hostRepoName    = repoFullName;
		datum.hostRepoId      = repoId;
		data.push( datum );
	    }
	    // Wait.  Data is modified
	    if( projs.pageInfo.hasNextPage ) { await getProjectIds( authData, repoFullName, data, issues.pageInfo.endCursor ); }
	})
	.catch( e => ghUtils.errorHandler( "getProjectIds", e, getProjectIds, authData, repoFullName, data, cursor ));
}


// NOTE: As of 1/2023 GH API does not support management of the status column for projects
//       For now, verify that a human has created this by hand.... https://github.com/orgs/community/discussions/44265 
async function createColumn( authData, ghLinks, ceProjectId, projId, colName )
{
    let loc = -1;
    // XXX Fugly
    if( utils.TEST_EH && Math.random() < utils.TEST_EH_PCT ) {
	await utils.failHere( "createColumn" )
	    .catch( e => retVal = ghUtils.errorHandler( "createColumn", utils.FAKE_ISE, createColumn, authData, issueId));
    }
    else {
	locs = ghLinks.getLocs( authData, { "ceProjId": ceProjectId, "projId": projId, "colName": colName } );    
	    
	if( typeof locs === 'undefined' ) {
	    // XXX revisit once (if) GH API supports column creation
	    console.log( authData.who, "Error.  Please create the column", colName, "by hand, for now." );
	    loc = -1;
	}
	else { loc = locs[0]; }
    }
    return loc;
}

// NOTE: As of 1/2023 GH API does not support management of the status column for projects
//       For now, verify that a human has created this by hand.... https://github.com/orgs/community/discussions/44265 
async function createUnClaimedProject( authData, ghLinks, pd  )
{
    const unClaimed = config.UNCLAIMED;

    let unClaimedProjId = -1;
    let locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "projName": unClaimed } );
    unClaimedProjId = locs == -1 ? locs : locs[0].hostProjectId;
    if( unClaimedProjId == -1 ) {
	// XXX revisit once (if) GH API supports column creation
	//     note, we CAN create projects, but there is little point if required columns must also be created.
	//     note, could make do with 'no status' for unclaimed:unclaimed, but would fail for unclaimed:accrued and other required columns.
	console.log( authData.who, "Error.  Please create the", unClaimed, "project by hand, for now." );
    }

    return unClaimedProjId;
}

// NOTE: As of 1/2023 GH API does not support management of the status column for projects
//       For now, verify that a human has created this by hand.... https://github.com/orgs/community/discussions/44265 
async function createUnClaimedColumn( authData, ghLinks, pd, unClaimedProjId, issueId, accr )
{
    let   loc = -1;
    const unClaimed = config.UNCLAIMED;
    const colName = (typeof accr !== 'undefined') ? config.PROJ_COLS[config.PROJ_ACCR] : unClaimed;

    // Get locs again, to update after uncl. project creation 
    locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "projName": unClaimed } );
    if( locs == -1 ) {
	// XXX revisit once (if) GH API supports column creation
	console.log( authData.who, "Error.  Please create the", unClaimed, "project by hand, for now." );
    }
    else {
	assert( unClaimedProjId == locs[0].hostProjectId );
	
	loc = locs.find( loc => loc.hostColumnName == colName );
	
	if( typeof loc === 'undefined' ) {
	    // XXX revisit once (if) GH API supports column creation
	    console.log( authData.who, "Error.  Please create the", unClaimed, "and", config.PROJ_COLS[config.PROJ_ACCR], "columns, by hand, for now." );
	    loc = -1;
	}
    }
    return loc;
}


// Note. alignment risk
// Don't care about state:open/closed.  unclaimed need not be visible.
async function createUnClaimedCard( authData, ghLinks, pd, issueId, accr )
{
    let unClaimedProjId = await createUnClaimedProject( authData, ghLinks, pd );
    let loc             = await createUnClaimedColumn( authData, ghLinks, pd, unClaimedProjId, issueId, accr );

    assert( unClaimedProjId != -1 );
    assert( loc.hostColumnId != -1  );
    assert( loc != -1  );

    // create card in unclaimed:unclaimed
    let card = await createProjectCard( authData, unClaimedProjId, issueId, loc.hostUtility, loc.hostColumnId, false );
    return card;
}



exports.getProjectFromNode = getProjectFromNode;
exports.getFromIssueNode   = getFromIssueNode;
    
exports.getHostLinkLoc     = getHostLinkLoc;

exports.createIssue        = createIssue;
exports.getIssue           = getIssue;
exports.getFullIssue       = getFullIssue;
exports.updateIssue        = updateIssue;
exports.updateTitle        = updateTitle;
exports.addComment         = addComment;
exports.rebuildIssue       = rebuildIssue;
exports.addAssignee        = addAssignee;
exports.remAssignee        = remAssignee;
exports.getAssignees       = getAssignees;
exports.transferIssue      = transferIssue;

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

exports.getProjectName     = getProjectName;
exports.updateProject      = updateProject;
exports.createProject      = createProject;

exports.getColumnName      = getColumnName;

exports.getCard            = getCard;
exports.moveCard           = moveCard;
exports.createProjectCard  = createProjectCard;
exports.removeCard         = removeCard; 
exports.rebuildCard        = rebuildCard;

exports.getLabelIssues     = getLabelIssues;

exports.getProjectIds      = getProjectIds;

exports.createColumn           = createColumn;           // XXX NYI
exports.createUnClaimedProject = createUnClaimedProject; // XXX NYI
exports.createUnClaimedColumn  = createUnClaimedColumn;  // XXX NYI
exports.createUnClaimedCard    = createUnClaimedCard;    // XXX NYI
exports.updateColumn           = updateColumn;           // XXX NYI
