var assert = require( 'assert' );

const config = require( '../../../config' );

const utils     = require( '../../ceUtils' );
const ghUtils   = require( '../ghUtils' );

// https://docs.github.com/en/free-pro-team@latest/graphql/reference/objects


// NOTE
// All project, card, repo ids are GQL node ids.  All issue ids are content ids.   
// Focus on communication with GitHub.  Interpretation of results is left to handlers.



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
// Note: optionId is sufficient for columnId, given the pid.
// XXX if optionId changes per view... ? 
// XXX views does not (yet?) have a fieldByName, which would make it much quicker to find status.
// XXX Getting several values per issue here that are unused.  remove.
async function getHostLinkLoc( authData, pid, locData, linkData, cursor ) {

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
                       ... on Issue { id number repository {id nameWithOwner} title projectItems(first: 100) { edges {node { id }}} }}}
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
                       ... on Issue { id number repository {id nameWithOwner} title projectItems(first: 100) { edges {node { id }}} }}}
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


    let query     = cursor === -1 ? query1 : queryN;
    let variables = cursor === -1 ? {"nodeId": pid } : {"nodeId": pid, "cursor": cursor };
    query = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( !utils.validField( raw, "status" ) || raw.status != 200 ) { throw raw; }
	    let project = raw.data.node;
	    let statusId = -1;
	    

	    // XXX This should not stand.
	    let hostRepo = {};
	    {
		let hostItems = raw.data.node.items;
		for( let i = 0; i < hostItems.edges.length; i++ ) {
		    const issue   = hostItems.edges[i].node;
		    if( issue.type == "ISSUE" ) {
			hostRepo.hostRepoName = issue.content.repository.nameWithOwner;
			hostRepo.hostRepoId   = issue.content.repository.id;
			break;
		    }
		}
	    }
		

	    // Loc data only needs to be built once.  Will be the same for every issue.
	    // Note: can not build this from issues below, since we may have empty columns in board view.
	    if( locData.length <= 0 ) {

		// XXX why process every view?
		// Plunder the first view to get status (i.e. column) info
		let views = project.views;
		if( typeof views === 'undefined' ) {
		    console.log( "Warning.  Project views are not defined.  GH2 ceProject with classic project?", pid );
		    statusId = 0;
		    locData = [-1];
		    return;
		}
		for( let i = 0; i < views.edges.length; i++ ) {
		    const aview = views.edges[i].node;
		    for( let j = 0; j < aview.fields.edges.length; j++ ) {
			if( j >= 99 ) { console.log( authData.who, "WARNING.  Detected a very large number of columns, ignoring some." ); }
			const pfc = aview.fields.edges[j].node;
			if( pfc.name == "Status" ) {                            // XXX formalize.  generalize?
			    statusId = pfc.id;
			    for( let k = 0; k < pfc.options.length; k++ ) {
				let datum   = {};
				datum.hostRepository   = hostRepo.hostRepoName;
				datum.hostRepositoryId = hostRepo.hostRepoId;
				datum.hostProjectName  = project.title;
				datum.hostProjectId    = project.id;             // all ids should be projectV2 or projectV2Item ids
				datum.hostColumnName   = pfc.options[k].name;
				datum.hostColumnId     = pfc.options[k].id;
				datum.hostUtility      = statusId;
				locData.push( datum );
			    }
			}
		    }
		}
		// Build "No Status" by hand, since it corresponds to a null entry
		let datum   = {};
		datum.hostRepository   = hostRepo.hostRepoName;
		datum.hostRepositoryId = hostRepo.hostRepoId;
		datum.hostProjectName  = project.title;
		datum.hostProjectId    = project.id;             // all ids should be projectV2 or projectV2Item ids
		datum.hostColumnName   = config.GH_NO_STATUS; 
		datum.hostColumnId     = config.GH_NO_STATUS;    // no status column does not exist in view options above.  special case.
		datum.hostUtility      = statusId;
		locData.push( datum );
	    }

	    if( statusId == 0 ) { return; }
	    assert( locData.length > 0 );
	    assert( statusId !== -1 );
	    
	    let items = raw.data.node.items;
	    for( let i = 0; i < items.edges.length; i++ ) {
		const issue    = items.edges[i].node;
		const status   = utils.validField( issue, "fieldValueByName" )  ? issue.fieldValueByName.name     : config.GH_NO_STATUS;
		const optionId = utils.validField( issue, "fieldValueByName" )  ? issue.fieldValueByName.optionId : config.GH_NO_STATUS;
		
		if( issue.type == "ISSUE" ) {

		    let links = issue.content.projectItems.edges;    // reverse links.. yay!  used only for populateCELinkage, then tossed
		    if( links.length >= 100 ) { console.log( authData.who, "WARNING.  Detected a very large number of cards, ignoring some." ); }
		    
		    let datum = {};
		    datum.hostIssueId     = issue.content.id;              // contentId I_*
		    datum.hostIssueNum    = issue.content.number;
		    datum.hostIssueName   = issue.content.title;
		    datum.hostCardId      = issue.id;                      // projectV2Item id PVTI_*
		    datum.hostProjectName = locData[0].hostProjectName;    
		    datum.hostProjectId   = locData[0].hostProjectId;    
		    datum.hostColumnName  = status;
		    datum.hostColumnId    = optionId;
		    datum.hostRepoId      = hostRepo.hostRepoId;
		    datum.hostRepoName    = hostRepo.hostRepoName;
		    datum.allCards        = links.map( link => link.node.id );
		    
		    linkData.push( datum );
		}
	    }
	    
	    // console.log( "UTILS: Locs", locData );
	    // console.log( "UTILS: Links", linkData );
	    
	    // Wait.  Data is modified
	    if( items !== -1 && items.pageInfo.hasNextPage ) { await geHostLinkLoc( authData, pid, locData, linkData, items.pageInfo.endCursor ); }
	})
	.catch( e => {
	    // NO!  This kills references
	    // locData  = [];
	    // linkData = [];
	    locData.length  = 0;
	    linkData.length = 0;
	    cursor = -1;
	    ghUtils.errorHandler( "getHostLinkLoc", e, getHostLinkLoc, authData, pid, locData, linkData, cursor )
		     }); 
}

// Create in No Status.
async function cardIssue( authData, pid, issDat ) {
    assert( issDat.length == 3 );
    let issueData = [issDat[0],issDat[1],-1]; // contentId, num, cardId
    
    query     = "mutation( $proj:ID!, $contentId:ID! ) { addProjectV2ItemById( input:{ projectId: $proj, contentId: $contentId }) {clientMutationId, item{id}}}";
    variables = {"proj": pid, "contentId": issDat[0]};
    queryJ    = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    if( !utils.validField( ret, "status" ) || ret.status != 200 ) { throw ret; }
	    if( !utils.validField( ret.data, "addProjectV2ItemById" )) { console.log( "Not seeing card data?", ret );  }	    
	    issueData[2] = ret.data.addProjectV2ItemById.item.id;
	    console.log( authData.who, " .. issue added to project, pv2ItemId:", issueData[2] );
	})
	.catch( e => issueData = ghUtils.errorHandler( "cardIssue", e, cardIssue, authData, pid, issDat ));

    return issueData;
}

// createIssue, then addProjectV2ItemById
// NOTE!  If pid is not -1, createIssue is being asked to create a carded issue.
// NOTE!  This takes an issue returned (largely) by gql format, not reqBody format.  e.g. assn.id rather than assn.node_id
// this can generate Notification: issue:open (content), pv2:create (card)
// Note: mutation:createIssue with inputObject that includes pids only works for classic projects, not PV2.
// Note: mutation:addProjectV2DraftIssue works, but can't seem to find how to convert draft to full issue in gql?!!??
// Note: issue below is a collection of issue details, not a true issue.
async function createIssue( authData, repoNode, pid, issue ) {
    let issueData = [-1,-1,-1]; // contentId, num, cardId

    assert( typeof issue.title !== 'undefined', "Error.  createIssue requires a title." );
    if( !utils.validField( issue, "allocation" )) { issue.allocation = false; }
    if( !utils.validField( issue, "body" ))       { issue.body = ""; }
    if( !utils.validField( issue, "labels" ))     { issue.labels = []; }
    if( !utils.validField( issue, "assignees" ))  { issue.assignees = []; }
    if( !utils.validField( issue, "milestone" ))  { issue.milestone = null; }
    
    console.log( authData.who, "Create issue, from alloc?", repoNode, pid, issue.title, issue.allocation );

    assert( !issue.allocation || issue.body == "", "Error.  createIssue body is about to be overwritten." );
    if( issue.allocation ) {
	issue.body  = "This is an allocation issue added by CodeEquity.  It does not reflect specific work or issues to be resolved.  ";
	issue.body += "It is simply a rough estimate of how much work will be carried out in this category.\n\n"
	issue.body += "It is safe to filter this out of your issues list.\n\n";
	issue.body += "It is NOT safe to close, reopen, or edit this issue.";
    }

    // assignees, labels are lists of IDs, not full labels.
    issue.labels    = issue.labels.map(    lab  => Object.keys( lab  ).length > 0 ? lab.id  : lab );
    issue.assignees = issue.assignees.map( assn => Object.keys( assn ).length > 0 ? assn.id : assn );

    let query = `mutation( $repo:ID!, $title:String!, $body:String, $labels:[ID!], $assg:[ID!], $mile:ID )
                    { createIssue( input:{ repositoryId: $repo, title: $title, body: $body, labelIds: $labels, assigneeIds: $assg, milestoneId: $mile }) 
                    {clientMutationId, issue{id, number}}}`;

    let variables = {"repo": repoNode, "title": issue.title, "body": issue.body, "labels": issue.labels, "mile": issue.milestone, "assg": issue.assignees };
    let queryJ    = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    if( !utils.validField( ret, "status" ) || ret.status != 200 ) { throw ret; }
	    issueData[0] = ret.data.createIssue.issue.id;
	    issueData[1] = ret.data.createIssue.issue.number;
	})
	.catch( e => issueData = ghUtils.errorHandler( "createIssue", e, createIssue, authData, repoNode, pid, issue ));

    if( pid !== -1 ) { issueData = await cardIssue( authData, pid, issueData ); }
    console.log( authData.who, " .. issue created, issueData:", issueData );
    
    return issueData;
}

// get unusual faceplate info
// Label descriptions help determine if issue is an allocation
async function getIssue( authData, issueId ) {
    let retVal   = [];
    if( issueId === -1 ) { return retVal; }
    
    let issue = await getFullIssue( authData, issueId );
    let retIssue = [];
    
    retIssue.push( issue.id );
    retVal.push( issue.title );
    if( issue.labels.edges.length > 0 ) {
	for( label of issue.labels ) { retVal.push( label.description ); }
    }
    retIssue.push( retVal );
    retIssue.push( issue.number );
    return retIssue;
    
}

// Note, this is not returning full issues. 
async function getIssues( authData, repoNodeId ) {
    let issues = [];

    let query = `query($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on Repository {
            issues(first:100) {edges {node { id title number body state
               assignees(first: 100) {edges {node {id login }}}
               labels(first: 100) {edges {node {id name }}}
              }}}}
    }}`;
    let variables = {"nodeId": repoNodeId };
    query = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( raw.status != 200 ) { throw raw; }
	    let items = raw.data.node.issues.edges;
	    assert( items.length <= 99, "Need to paginate getIssues." );
	    for( let i = 0; i < items.length; i++ ) {
		let iss = items[i].node;
		let datum = {};
		datum.id       = iss.id;
		datum.number   = iss.number;
		datum.body     = iss.body;
		datum.state    = iss.state;
		datum.title    = iss.title;
		datum.assignees = iss.assignees.edges.map( edge => edge.node );
		datum.labels    = iss.labels.edges.map( edge => edge.node );
		
		issues.push( datum );
	    }
	})
	.catch( e => issues = ghUtils.errorHandler( "getIssues", e, getIssues, authData, td )); 

    return issues;
}


// More is available.. needed?.  Content id here, not project item id
async function getFullIssue( authData, issueId ) {
    // console.log( authData.who, "Get Full Issue", issueId );

    let query = `query( $id:ID! ) {
                   node( id: $id ) {
                   ... on Issue {
                     id number
                     body
                     assignees(first:99) { edges { node { id login }}}
                     labels(first: 99)   { edges { node { id name description }}}
                     milestone { id }
                     repository { id nameWithOwner }
                     state
                     title
                  }}}`;

    let variables = {"id": issueId};
    let queryJ    = JSON.stringify({ query, variables });

    let issue = {};
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    if( !utils.validField( ret, "status" ) || ret.status != 200 ) { throw ret; }
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
	    if( !utils.validField( ret, "status" ) || ret.status != 200 ) { throw ret; }
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

// This works on GQL-formated data, not json response data.  I.e. *.id not *.node_id 
async function rebuildIssue( authData, repoNodeId, projectNodeId, issue, msg, splitTag ) { 
    console.log( authData.who, "Rebuild issue from", issue.id );
    let issueData = [-1,-1,-1];  // issue id, num, cardId
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
	issueData = await createIssue( authData, repoNodeId, projectNodeId, issue );
	if( issueData[0] !== -1 && issueData[1] !== -1 && ( projectNodeId == -1 || issueData[2] !== -1 )) { success = true; }
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
	    .catch( e => ret = ghUtils.errorHandler( "addAssignee", utils.FAKE_ISE, addAssignee, authData, issueId, aNodeId )); 
    }
    else {
	let query = `mutation( $id:ID!, $adds:[ID!]! )
                    { addAssigneesToAssignable( input:{ assignableId: $id, assigneeIds: $adds }) {clientMutationId}}`;
	
	let variables = {"id": issueId, "adds": [aNodeId] };
	let queryJ    = JSON.stringify({ query, variables });
	
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	    .then( raw => {
		if( typeof raw.errors !== 'undefined' ) { console.log( "WARNING.  Assignment failed", raw.errors[0].message ); }
		else                                    { ret = true; }
	    })
	    .catch( e => ret = ghUtils.errorHandler( "addAssignee", ret, addAssignee, authData, issueId, aNodeId ));
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
    if( issueId === -1 ) { console.log( authData.who, "getAssignees: bad issue", issueId ); return retVal; }

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
		if( !utils.validField( raw, "status" ) || raw.status != 200 ) { throw raw; }
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

    // console.log( authData.who, "Create label", repoNode, name, desc, color );

    let query     = `mutation( $id:ID!, $color:String!, $name:String!, $desc:String! )
                       { createLabel( input:{ repositoryId: $id, color: $color, description: $desc, name: $name }) {clientMutationId, label {id, name, color, description}}}`;

    let variables = {"id": repoNode, "name": name, "color": color, "desc": desc };
    let queryJ    = JSON.stringify({ query, variables });

    let label = {};
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    if( !utils.validField( ret, "status" ) || ret.status != 200 ) { throw ret; }
	    if( typeof ret.errors !== 'undefined' ) { console.log( authData.who, "WARNING. Label not created", ret.errors ); }
	    else {
		// console.log( authData.who, " .. label added to repo, pv2ItemId:", ret.data.createLabel.label.id ); 
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
    // Oddly, GH returns anything that partially matches the query, without means to limit to precise matches.  i.e. if name is 1M Alloc, multiple are returned
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
	    if( !utils.validField( ret, "status" ) || ret.status != 200 ) { throw ret; }
	    let labels = ret.data.node.labels;
	    if( typeof labels === 'undefined' ) { return labelRes; }
	    
	    if( labels.edges.length > 99 ) { console.log( authData.who, "WARNING. Found too many labels.  Ignoring some." ); }
	    
	    for( let i = 0; i < labels.edges.length; i++ ) {
		const lab = labels.edges[i].node;
		if( lab.name == peqHumanLabelName ) {  // finish filtering
		    labelRes.status = 200;
		    labelRes.label = lab;
		}
	    }
	})
	.catch( e => labelRes = ghUtils.errorHandler( "getLabel", e, getLabel, authData, repoNode, peqHumanLabelName ));

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
	    if( !utils.validField( ret, "status" ) || ret.status != 200 ) { throw ret; }
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

// GH no longer allows commas in label names.  Convert, say, 1,500 PEQ to 1.5k PEQ
// Turn 1000000 or "1,000,000" into "1M" then plus label type.  Leave properly formed alone.
function makeHumanLabel( amount, peqTypeLabel ) {
    let retVal = "";
    if( typeof amount == "string" ) {
	let unit = amount.slice(-1);
	if ( unit == "M" || unit == "k" ) { retVal = amount; }
	else { amount = parseInt( amount.replace(/,/g, "" )); }   // create int for further processing below
    }
    
    if( typeof amount == "number" ) {
	assert ( amount < 1000000000, "Error. Peq values can not reach the billions.  Something is wrong with your usage." );
	if     ( amount >= 1000000 ) { retVal = (amount / 1000000).toString() + "M"; }
	else if( amount >= 1000 )    { retVal = (amount / 1000).toString() + "k"; }
	else                         { retVal = amount.toString(); }
    }

    return retVal + " " + peqTypeLabel;
}

async function createPeqLabel( authData, repoNode, allocation, peqValue ) {
    
    let peqHumanLabelName = makeHumanLabel( peqValue, ( allocation ? config.ALLOC_LABEL : config.PEQ_LABEL ) );
    
    let desc = ( allocation ? config.ADESC : config.PDESC ) + peqValue.toString();
    let pcolor = allocation ? config.APEQ_COLOR : config.PEQ_COLOR;
    let label = await createLabel( authData, repoNode, peqHumanLabelName, pcolor, desc );
    return label;
}

async function findOrCreateLabel( authData, repoNode, allocation, peqHumanLabelName, peqValue ) {

    console.log( authData.who, "Find or create label", repoNode, allocation, peqHumanLabelName, peqValue );

    if( typeof peqValue == "string" ) { peqValue = parseInt( peqValue.replace(/,/g, "" )); }
    
    // Find?
    const labelRes = await getLabel( authData, repoNode, peqHumanLabelName );
    let   theLabel = labelRes.label;

    // Create?
    if( !utils.validField( labelRes, "status" ) || labelRes.status != 200 ) {
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

function getProjectName( authData, ghLinks, ceProjId, pid ) {
    if( pid === -1 ) { return -1; }

    const locs = ghLinks.getLocs( authData, { "ceProjId": ceProjId, "pid": pid } );

    const projName = locs === -1 ? locs : locs[0].hostProjectName;
    return projName
}

async function updateProject( authData, pid, title, body ) {

    let query = "";
    let variables = "";
    if( typeof body === 'undefined' ) {
	query     = `mutation( $pid:ID!, $title:String ) { updateProjectV2( input:{ projectId: $pid, title: $title })  {clientMutationId}}`;
	variables = {"pid": pid, "title": title };
    }
    else {
	query     = `mutation( $pid:ID!, $body:String ) { updateProjectV2( input:{ projectId: $pid, shortDescription: $body })  {clientMutationId}}`;
	variables = {"pid": pid, "body": body };
    }
    let queryJ    = JSON.stringify({ query, variables });
	
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.catch( e => ghUtils.errorHandler( "updateProject", e, updateProject, authData, pid, title, body ));
}

// Only repository owner can use this to create a project.  
async function createProject( authData, ownerNodeId, repoNodeId, title, body ) {
    console.log( "Create project", ownerNodeId, repoNodeId, title );
    let query     = `mutation( $ownerId:ID!, $repoId:ID!, $title:String! ) 
                             { createProjectV2( input:{ repositoryId: $repoId, ownerId: $ownerId, title: $title }) {clientMutationId projectV2 {id}}}`;
    let variables = {"repoId": repoNodeId, "ownerId": ownerNodeId, "title": title };
    let queryJ    = JSON.stringify({ query, variables });
	
    let pid = -1;
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    if( !utils.validField( ret, "status" ) || ret.status != 200 ) { throw ret; }
	    if( utils.validField( ret, "data" ) && utils.validField( ret.data, "createProjectV2" ) && utils.validField( ret.data.createProjectV2, "projectV2" ))
	    {
		pid = ret.data.createProjectV2.projectV2.id;
	    }
	    console.log( authData.who, "New project id: ", pid );
	})
	.catch( e => pid = ghUtils.errorHandler( "createProject", e, createProject, authData, ownerNodeId, repoNodeId, title ));

    // arg GH.. would be nice to do this in 1 query!
    if( pid ) { await updateProject( authData, pid, "", body ); }
    
    return pid == false ? -1 : pid;
}


function getColumnName( authData, ghLinks, ceProjId, colId ) {
    if( colId === -1 ) { return -1; }

    // colId is not unique, but does represent a single name.
    const locs = ghLinks.getLocs( authData, { "ceProjId": ceProjId, "colId": colId } );

    const colName = locs === -1 ? locs : locs[0].hostColumnName;
    return colName
}


// Create new field.  May not be a need for this?
// This works.  Note that "No Status" column becomes "No XYZ", where XYZ is fieldName.
async function createCustomField( authData, fieldName, pid, sso ) {
    let query     = `mutation( $name: String!, $pid: ID!, $ssoVal:[ProjectV2SingleSelectFieldOptionInput!] ) 
                        { createProjectV2Field( input: { dataType: SINGLE_SELECT, name: $name, projectId: $pid, singleSelectOptions: $ssoVal })
                        { clientMutationId }}`;

    let variables = { name: fieldName, pid: pid, ssoVal: sso  };
    query         = JSON.stringify({ query, variables });

    let retVal = false;
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( ret => {
	    console.log( "Result", ret );	    
	    if( !utils.validField( ret, "status" ) || ret.status != 200 ) { throw ret; }
	    retVal = ret;
	})
	.catch( e => retVal = ghUtils.errorHandler( "createCustomField", e, createCustomField, authData, fieldName, pid, sso ));

    return retVal;
}

// clone makes project v1??? sigh.  use copy.
async function cloneFromTemplate( authData, ownerId, sourcePID, title ) {
    let query     = `mutation( $ownerId:ID!, $sourcePID:ID!, $title:String! ) 
                        { copyProjectV2( input: { ownerId: $ownerId, projectId: $sourcePID, title: $title })
                        { clientMutationId, projectV2{id} }}`;

    let variables = { ownerId: ownerId, sourcePID: sourcePID, title: title };
    query         = JSON.stringify({ query, variables });

    console.log( "QUERY", query );
    let retVal = false;
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( ret => {
	    if( !utils.validField( ret, "status" ) || ret.status != 200 ) { throw ret; }
	    if( !utils.validField( ret.data, "copyProjectV2" )) { console.log( "Not seeing new project?", ret ); }
	    console.log( "Result", ret, ret.data.copyProjectV2.projectV2.id );
	    retVal = ret.data.copyProjectV2.projectV2.id;
	})
	.catch( e => retVal = ghUtils.errorHandler( "closeFromTemplate", e, cloneFromTemplate, authData, ownerId, sourcePID, title ));

    return retVal;
}




async function createColumnTest( authData, pid, colId, name ) {
    console.log( "createColumn", pid, newValue );

    let query     = `mutation( $dt:ProjectV2CustomFieldType!, $pid:ID!, $val:[ProjectV2SingleSelectFieldOptionInput!] ) 
                             { createProjectV2Field( input:{ dataType: $dt, name: "Statusus", projectId: $pid, singleSelectOptions: $val }) 
                             {clientMutationId}}`;

    let variables = {"dt": "SINGLE_SELECT", "pid": pid, "val": newValue };

    let queryJ    = JSON.stringify({ query, variables });

    console.log( "query", queryJ );
    
    let retVal = false;
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    console.log( "Result", ret );
	    if( !utils.validField( ret, "status" ) || ret.status != 200 ) { throw ret; }
	    retVal = true;
	})
	.catch( e => retVal = ghUtils.errorHandler( "createColumn", e, createColumn, authData, pid, newValue ));

    return retVal;
}

async function deleteColumn( authData, newValue ) {
    let query     = `mutation( $dt:DeleteProjectV2FieldInput! ) 
                             { deleteProjectV2Field( input: $dt ) 
                             {clientMutationId}}`;

    let variables = {"dt": newValue };

    let queryJ    = JSON.stringify({ query, variables });

    console.log( "query", queryJ );
    
    let retVal = false;
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    console.log( "Result", ret );
	    if( !utils.validField( ret, "status" ) || ret.status != 200 ) { throw ret; }
	    retVal = true;
	})
	.catch( e => retVal = ghUtils.errorHandler( "deleteColumn", e, deleteColumn, authData, newValue ));

    return retVal;
}

// XXX not done  .. this will probably move me to no status.
async function clearColumn( authData, newValue ) {
    let query     = `mutation( $dt:DeleteProjectV2FieldInput! ) 
                             { clearProjectV2ItemFieldValue( input: $dt ) 
                             {clientMutationId}}`;

    let variables = {"dt": newValue };

    let queryJ    = JSON.stringify({ query, variables });

    console.log( "query", queryJ );
    
    let retVal = false;
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    console.log( "Result", ret );
	    if( !utils.validField( ret, "status" ) || ret.status != 200 ) { throw ret; }
	    retVal = true;
	})
	.catch( e => retVal = ghUtils.errorHandler( "clearColumn", e, deleteColumn, authData, newValue ));

    return retVal;
}


// Get location of an issue in a project from GH, i.e. status column for ghV2.
// PEQ issue will be 1:1, but non-peq issue may exist in several locations. 
//    Note: cardId, i.e. pv2 item nodeId PVTI_*, is unique per ghProject, and has a content pointer, which points to a single, shared issue id (i.e. I_*).
async function getCard( authData, cardId ) {
    let retVal = {};
    if( cardId === -1 ) { console.log( authData.who, "getCard didn't provide id", cardId ); return retVal; }

    let query = `query( $id:ID! ) {
                   node( id: $id ) {
                     ... on ProjectV2Item {
                        project { id }
                        fieldValueByName(name: "Status") {
                          ... on ProjectV2ItemFieldSingleSelectValue {optionId name field { ... on ProjectV2SingleSelectField { id }}}}
                        content { 
                          ... on ProjectV2ItemContent { ... on Issue { id number }}}
                  }}}`;
    let variables = {"id": cardId };
    let queryJ    = JSON.stringify({ query, variables });
    
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( raw => {
	    // A moveCard is generated after createProjectCard.  MoveCard getsCard first.
	    // If CPC caused a split, the move notice is for a card that no longer exists.
	    // XXX formalize message
	    if( utils.validField( raw, "errors" ) && raw.errors.length == 1 && raw.errors[0].message.includes( "Could not resolve to a node with the global id" )) {  
		console.log( authData.who, "Could not find card:", cardId, "possibly result of rebuilding for a split issue?" );
		retVal = -1;
		return -1;
	    }
	    if( !utils.validField( raw, "status" ) || raw.status != 200 ) { throw raw; }
	    let card = raw.data.node;
	    retVal.cardId      = cardId;                        
	    retVal.pid      = card.project.id;
	    retVal.issueNum    = card.content.number; 
	    retVal.issueId     = card.content.id;
	    if( utils.validField( card, "fieldValueByName" ) ) {
		retVal.statusId    = card.fieldValueByName.field.id;     // status field node id,          i.e. PVTSSF_*
		retVal.columnId    = card.fieldValueByName.optionId;     // single select value option id, i.e. 8dc*
		retVal.columnName  = card.fieldValueByName.name;
	    }
	    else {
		console.log( authData.who, "Card is No Status, could not get column info." );
		retVal.columnId    = "No Status";
		retVal.columnName  = "No Status";
	    }
	})
	.catch( e => retVal = ghUtils.errorHandler( "getCard", e, getCard, authData, cardId ));

    return retVal;
}

async function getCardFromIssue( authData, issueId ) {
    let retVal = {};
    if( issueId === -1 ) { console.log( authData.who, "getCardFromIssue bad issueId", issueId ); return retVal; }

    let query = `query( $id:ID! ) {
                   node( id: $id ) {
                   ... on Issue { 
                        id title number
                        projectItems (first:2) { edges { node {
                          id type
                          project { id }
                          fieldValueByName(name: "Status") {
                           ... on ProjectV2ItemFieldSingleSelectValue {optionId name field { ... on ProjectV2SingleSelectField { id }}}}
                        }}}
                 }}}`;
    let variables = {"id": issueId };
    let queryJ    = JSON.stringify({ query, variables });
    
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( raw => {
	    if( !utils.validField( raw, "status" ) || raw.status != 200 ) { throw raw; }
	    let issue = raw.data.node;
	    retVal.issueId     = issue.id;
	    retVal.issueNum    = issue.number;

	    let cards = issue.projectItems.edges;
	    cards     = cards.filter((card) => card.node.type == "ISSUE" );
	    assert( cards.length <= 1, "Error.  Issue has multiple cards." );
	    
	    if( cards.length > 0 ) {
		cards.forEach( card => {
		    retVal.pid      = card.node.project.id;                    
		    retVal.cardId      = card.node.id;
		    if( utils.validField( card.node, "fieldValueByName" ) ) {
			retVal.statusId    = card.node.fieldValueByName.field.id;     // status field node id,          i.e. PVTSSF_*
			retVal.columnId    = card.node.fieldValueByName.optionId;     // single select value option id, i.e. 8dc*
			retVal.columnName  = card.node.fieldValueByName.name;
		    }
		    else {
			console.log( "Card is No Status, could not get column info." );
			retVal.columnId    = "No Status";
			retVal.columnName  = "No Status";
		    }
		});
	    }

	})
	.catch( e => retVal = ghUtils.errorHandler( "getCardFromIssue", e, getCardFromIssue, authData, issueId ));

    return retVal;
}


// Currently, just relocates issue to another column (i.e. status).
async function moveCard( authData, pid, itemId, fieldId, value ) {
    console.log( authData.who, "Updating card's column: project item field value", pid, itemId, fieldId, value );

    // can not move directly to no status.  test utils need to handle this case.
    assert( value != config.GH_NO_STATUS ); 
    
    let query     = `mutation( $pid:ID!, $itemId:ID!, $fieldId:ID! $value:String! ) 
                      { updateProjectV2ItemFieldValue( input:{ projectId: $pid, itemId: $itemId, fieldId: $fieldId, value: {singleSelectOptionId: $value }})  
                      { clientMutationId }}`;

    let variables = {"pid": pid, "itemId": itemId, "fieldId": fieldId, "value": value };

    let queryJ    = JSON.stringify({ query, variables });

    let ret = -1;
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( r => { ret = r; })
	.catch( e => ret = ghUtils.errorHandler( "moveCard", e, moveCard, authData, pid, itemId, fieldId, value ));

    // success looks like: { data: { updateProjectV2ItemFieldValue: { clientMutationId: null } }, status: 200 }
    return ret;
}

// XXX check for pd.GH*
// Note. alignment risk if card moves in the middle of this
async function moveToStateColumn( authData, ghLinks, pd, action, ceProjectLayout )
{
    console.log( authData.who, "Moving issue card", pd.issueId, pd.issueNum );
    let success    = false;
    let newColId   = -1;
    let newColName = "";
    assert.notEqual( ceProjectLayout[0], -1 );

    const link = ghLinks.getUniqueLink( authData, pd.ceProjectId, pd.issueId );
    let cardId = link.hostCardId;

    if( action == "closed" ) {

	// Out of order notification is possible.  If already accrued, stop.
	// There is no symmetric issue - once accr, can't repoen.  if only pend, no subsequent move after reopen.
	if( link.hostColumnId == ceProjectLayout[ config.PROJ_ACCR + 1 ].toString() ) {
	    let issue = await getFullIssue( authData, pd.issueId );
	    if( issue.state == 'CLOSED' ) {
		return false;
	    }
	}
	
	// move card to "Pending PEQ Approval"
	if( cardId != -1 ) {
	    console.log( authData.who, "Issuing move card" );
	    newColId   = ceProjectLayout[ config.PROJ_PEND + 1 ];   // +1 is for leading pid
	    newColName = config.PROJ_COLS[ config.PROJ_PEND ];
	    
	    success = await checkReserveSafe( authData, pd.issueId, config.PROJ_PEND );
	    if( !success ) {
		// no need to put card back - didn't move it.  Don't wait.
		updateIssue( authData, pd.issueId, "state", "OPEN" ); // reopen issue
		return false;
	    }

	    const locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, pid: link.hostProjectId, "colId": newColId } );
	    assert( locs.length = 1 );
	    success = await moveCard( authData, pd.projectId, cardId, locs[0].hostUtility, newColId );
	}
    }
    else if( action == "reopened" ) {
	
	// This is a PEQ issue.  Verify card is currently in the right place, i.e. PEND ONLY (can't move out of ACCR)
	if( link.hostColumnId != ceProjectLayout[ config.PROJ_PEND+1 ].toStirng() ) { cardId = -1; }

	// move card to "In Progress".  planned is possible if issue originally closed with something like 'wont fix' or invalid.
	if( cardId != -1 ) {
	    console.log( authData.who, "Issuing move card" );
	    newColId   = ceProjectLayout[ config.PROJ_PROG + 1 ];
	    const locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, pid: link.hostProjectId, "colId": newColId } );
	    assert( locs.length = 1 );
	    newColName = locs[0].hostColumnName;
	    success = await moveCard( authData, pd.projectId, cardId, locs[0].hostUtility, newColId );
	}
	else {
	    // GH has opened this issue.  Close it back up.
	    console.log( authData.who, "WARNING.  Can not reopen an issue that has accrued." );
	    // Don't wait.
	    updateIssue( authData, pd.issueId, "state", "CLOSED" ); // re-close issue
	    return false;
	}
    }

    // Note. updateLinkage should not occur unless successful.  Everywhere.  
    // Should not need to wait, for example, for moveCard above.  Instead, be able to roll back if it fails.   Rollback.
    if( success ) { success = ghLinks.updateLinkage( authData, pd.ceProjectId, pd.issueId, cardId, newColId, newColName ); }
    
    return success ? newColId : false;
}


// Note this is used to situate an issue, then put into correct column.
// Note issueId is contentId.  issDat[2] is issueNodeId
async function createProjectCard( authData, ghLinks, ploc, issueId, fieldId, justId ) {
    let issDat = [issueId, -1, -1];

    assert( typeof ploc.ceProjId !== 'undefined' );
    assert( typeof ploc.pid      !== 'undefined' );
    assert( typeof ploc.colId    !== 'undefined' );
    
    console.log( authData.who, "create project card", ploc.pid, issueId, fieldId, ploc.colId, justId ) ;

    // If wanted to link for user here, would need repo id, name.
    let tlocs = ghLinks.getLocs( authData, { "ceProjId": ploc.ceProjId, "pid": ploc.pid } );
    if ( tlocs.length < 1 ) {
	console.log( authData.who, "WARNING.  Attempted to create card for unlinked project.  Please link project to your repository first." );
	return -1;
    }

    issDat = await cardIssue( authData, ploc.pid, issDat );
    
    // Move from "No Status".  If good, retVal contains null clientMutationId
    let retVal = await moveCard( authData, ploc.pid, issDat[2], fieldId, ploc.colId );
    
    if( retVal !== -1 ) {
	let locs = ghLinks.getLocs( authData, { "ceProjId": ploc.ceProjId, "pid": ploc.pid, "colId": ploc.colId } );
	assert( locs.length == 1 );
	assert( locs[0].hostColumnId == ploc.colId );
	
	retVal = justId ? 
	    issDat[2] : 
	    {"pid": ploc.pid, "cardId": issDat[2], "statusId": fieldId, "columnId": ploc.colId, "columnName": locs[0].hostColumnName };
    }
    
    return retVal;
}

// Deleting the pv2 node has no impact on the underlying issue content, as is expected
async function removeCard( authData, pid, cardId ) {
    console.log( authData.who, "RemoveCard", pid, cardId );
    let query     = `mutation( $pid:ID!, $itemId:ID! ) { deleteProjectV2Item( input:{ projectId: $pid, itemId: $itemId })  {clientMutationId}}`;
    let variables = {"pid": pid, "itemId": cardId };
    let queryJ    = JSON.stringify({ query, variables });
	
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.catch( e => ghUtils.errorHandler( "removeCard", e, removeCard, authData, pid, cardId ));

    // Successful post looks like the following. Could provide mutationId for tracking: { data: { deleteProjectV2Item: { clientMutationId: null } } }
    return true;
}

/*
// XXX unnecessary?
async function rebuildCard( authData, ceProjId, ghLinks, colId, origCardId, issueData, locData ) {
    
    let isReserved = typeof locData !== 'undefined' && locData.hasOwnProperty( "reserved" ) ? locData.reserved : false;    
    let pid     = typeof locData !== 'undefined' && locData.hasOwnProperty( "pid" )   ? locData.pid   : -1;
    let projName   = typeof locData !== 'undefined' && locData.hasOwnProperty( "projName" ) ? locData.projName : "";
    let fullName   = typeof locData !== 'undefined' && locData.hasOwnProperty( "fullName" ) ? locData.fullName : "";

    assert( issueData.length == 3 );
    let issueId   = issueData[0];
    let issueNum  = issueData[1];
    let newCardId = issueData[2];  // rebuildIssue called for peq issues, will card the issue

    if( colId == config.EMPTY ) {
	console.log( authData.who, "Card rebuild is for No Status column, which is a no-op.  Early return." );
	return newCardId;
    }
    
    let statusId  = -1;
    assert.notEqual( issueId, -1, "Attempting to attach card to non-issue." );

    // If card has not been tracked, colId could be wrong.  relocate.
    // Note: do not try to avoid this step during populateCE - creates a false expectation (i.e. ce is tracking) for any simple carded issue.
    if( colId === -1 ) {
	let projCard = await getCard( authData, origCardId ); 
	colId = projCard.columnId;
	statusId = projCard.statusId;
    }
    else {
	const locs = ghLinks.getLocs( authData, { "ceProjId": ceProjId, "pid": pid, "colId": colId } );
	assert( locs !== -1 );
	statusId = locs[0].hostUtility;
    }

    // XXX Untested
    // Trying to build new card in reserved space .. move out of reserved, prog is preferred.
    // Finding or creating non-reserved is a small subset of getCEprojectLayout
    // StatusId is per-project.  No need to find again.
    if( isReserved ) {
	assert( pid   !== -1 );
	assert( fullName != "" );
	const planName = config.PROJ_COLS[ config.PROJ_PLAN ];
	const progName = config.PROJ_COLS[ config.PROJ_PROG ];

	const locs = ghLinks.getLocs( authData, { "ceProjId": ceProjId, "pid": pid } );   
	assert( locs !== -1 );
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
	if( colId === -1 ) {
	    let progCol = await createColumn( authData, ghLinks, ceProjId, pid, progName );
	    console.log( authData.who, "Creating new column:", progName );
	    assert( progCol !== -1 );
	    colId = progCol.hostColumnId;
	    let nLoc = {};
	    nLoc.ceProjectId     = ceProjId; 
	    nLoc.hostRepository  = fullName;
	    nLoc.hostProjectId   = pid;
	    nLoc.hostProjectName = projName;
	    nLoc.hostColumnId    = progName;
	    nLoc.hostColumnName  = colId;
	    nLoc.active          = "true";
	    await ghLinks.addLoc( authData, nLoc, true );
	}
    }

    // issue-linked project_card already exists if issue exists, in No Status.  Move it.
    await createProjectCard( authData, ghLinks, {"ceProjId": ceProjId, "pid": pid, "colId": colId}, issueId, statusId, true );
    assert.notEqual( newCardId, -1, "Unable to create new issue-linked card." );	    
    
    // remove orig card
    // Note: await waits for GH to finish - not for notification to be received by webserver.
    removeCard( authData, pid, origCardId );

    return newCardId;
}
*/


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

    let query     = cursor === -1 ? query1 : queryN;
    let variables = cursor === -1 ? {"owner": owner, "repo": repo, "labelName": labelName } : {"owner": owner, "repo": repo, "labelName": labelName, "cursor": cursor};
    query = JSON.stringify({ query, variables });

    let issues = -1;
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( !utils.validField( raw, "status" ) || raw.status != 200 ) { throw raw; }
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
		if( issues !== -1 && issues.pageInfo.hasNextPage ) { await getLabelIssues( authData, owner, repo, labelName, data, issues.pageInfo.endCursor ); }
	    }
	    else {
		// XXX may not be an error.. 
		console.log( authData.who, "XXX Error, no issues for label", labelName, res );
	    }
	})
	.catch( e => {
	    cursor = -1;
	    data.length = 0;
	    ghUtils.errorHandler( "getLabelIssues", e, getLabelIssues, authData, owner, repo, labelName, data, cursor )
	});
}

async function getProjectIds( authData, repoFullName, data, cursor ) {

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

    let query     = cursor === -1 ? query1 : queryN;
    let variables = cursor === -1 ? {"owner": rp[0], "name": rp[1] } : {"owner": rp[0], "name": rp[1], "cursor": cursor };
    query = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( !utils.validField( raw, "status" ) || raw.status != 200 ) { throw raw; }

	    let repoId = raw.data.repository.id; 
	    // Run this once only
	    if( cursor === -1 )
	    {
		let classics = raw.data.repository.projects;
		if(classics.edges.length >= 100 ) { console.log( authData.who, "WARNING.  Too many classic projects, ignoring some." ); }
		for( const c of classics.edges ) {
		    console.log( authData.who, "   - pushing classic", c.node.name, repoFullName, repoId );
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
		console.log( authData.who, "   - pushing", p.node.title, p.node.id, repoFullName, repoId );
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
	.catch( e => {
	    cursor = -1;
	    data.length = 0;
	    ghUtils.errorHandler( "getProjectIds", e, getProjectIds, authData, repoFullName, data, cursor )
	});

    // console.log( "ghV2:getProjectIds", data );
}



// NOTE: ONLY call during new situated card.  This is the only means to move accr out of unclaimed safely.
// NOTE: issues can be closed while in unclaimed, before moving to intended project.
// Unclaimed cards are peq issues by definition (only added when labeling uncarded issue).  So, linkage table will be complete.
async function cleanUnclaimed( authData, ghLinks, pd ) {
    // console.log( authData.who, "cleanUnclaimed", pd.issueId );
    let link = ghLinks.getUniqueLink( authData, pd.ceProjectId, pd.issueId );
    if( link === -1 ) { return false; }

    // console.log( link );
    
    // e.g. add allocation card to proj: add card -> add issue -> rebuild card    
    if( link.hostProjectName != config.UNCLAIMED && link.hostColumnName != config.PROJ_ACCR ) { return false; }   
	
    assert( link.hostCardId != -1 );

    console.log( "Found unclaimed" );
    
    // Must wait.  success creates dependence.
    let success = await removeCard( authData, link.hostProjectId, link.hostCardId ); 

    // Remove turds, report.  
    if( success ) { ghLinks.removeLinkage({ "authData": authData, "ceProjId": pd.ceProjectId, "issueId": pd.issueId, "cardId": link.hostCardId }); }
    else { console.log( "WARNING.  cleanUnclaimed failed to remove linkage." ); }

    // No PAct or peq update here.  cardHandler rebuilds peq next via processNewPeq.
    return true;
}


// NOTE: As of 1/2023 GH API does not support management of the status column for projects
//       For now, verify that a human has created this by hand.... https://github.com/orgs/community/discussions/44265 
async function createColumn( authData, ghLinks, ceProjectId, pid, colName, position )
{
    let loc = -1;
    // XXX Fugly
    if( utils.TEST_EH && Math.random() < utils.TEST_EH_PCT ) {
	await utils.failHere( "createColumn" )
	    .catch( e => loc = ghUtils.errorHandler( "createColumn", utils.FAKE_ISE, createColumn, authData, ghLinks, ceProjectId, pid, colName));
    }
    else {
	let locs = ghLinks.getLocs( authData, { "ceProjId": ceProjectId, "pid": pid, "colName": colName } );    
	    
	if( locs === -1 ) {
	    // XXX revisit once (if) GH API supports column creation
	    console.log( authData.who, "Error.  Please create the column", colName, "by hand, for now." );
	}
	else { loc = locs[0]; }
    }
    return loc;
}


/* 
  XXX query inside gql can't seem to deal with whitespace.  It appears to pay attention to the first word, only.
      Adding "AND" does not help.  Adding \"\" around name does not help.  `` nope.  \\\ nope.
      The query below works because both words are unique in current tiny world.  adding "A" in front matches everything.
  
  So the code below assumes query is useless, does extra filtering as with label.

{
  user(login:"ariCETester"){
    login id projectsV2(query: "Pre-Existing Project in:title", first:99 ) {edges{ node{ id title }}}}
  organization( login:"codeEquity"){
    login id projectsV2(query: "Pre-Existing Project in:title", first:99) {edges{ node{ id title }}}}
}
*/

async function findProjectByName( authData, orgLogin, userLogin, projName ) {
    let pid = -1;
    let pNameQuery = "name:" + projName;
    // console.log( "Find project", orgLogin, userLogin, projName );
    
    let query = `query($oLogin: String!, $uLogin: String!, $pName: String!) {
        user( login: $uLogin ) {
           login id
           projectsV2(first: 99, query: $pName ) {edges{ node{ id title }}}}
        organization( login: $oLogin ) {
           login id
           projectsV2(first: 99, query: $pName ) {edges{ node{ id title }}}}
    }`;
    let variables = {"oLogin": orgLogin, "uLogin": userLogin, "pName": pNameQuery };
    query = JSON.stringify({ query, variables });

    // XXX arggh.  if only query worked as expected
    /*
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( !utils.validField( raw, "status" ) || raw.status != 200 ) { throw raw; }
	    let projects = [];
	    if( utils.validField( raw.data, "user" ))                                 { projects = raw.data.user.projectsV2.edges; }
	    if( projects.length == 0 && utils.validField( raw.data, "organization" )) { projects = raw.data.organization.projectsV2.edges; }

	    if( projects.length == 1 )     { pid = projects[0].node.id; }
	    else if( projects.length > 1 ) { pid = -1 * projects.length; }
	})
	.catch( e => pid = ghUtils.errorHandler( "findProjectByName", e, findProjectByName, authData, orgLogin, userLogin, projName ));
    */
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( !utils.validField( raw, "status" ) || raw.status != 200 ) { throw raw; }
	    let projects = [];
	    if( utils.validField( raw.data, "user" ))         { projects = raw.data.user.projectsV2.edges; }
	    if( utils.validField( raw.data, "organization" )) { projects = projects.concat( raw.data.organization.projectsV2.edges ); }

	    for( let i = 0; i < projects.length; i++ ) {
		const proj = projects[i].node;
		if( proj.title == projName ) { pid = proj.id; }
	    }
	})
	.catch( e => pid = ghUtils.errorHandler( "findProjectByName", e, findProjectByName, authData, orgLogin, userLogin, projName ));
    
    return pid;
}

async function findProjectByRepo( authData, rNodeId, projName ) {
    let pid = -1;
    let pNameQuery = "name:" + projName;
    
    let query = `query($rid:ID!, $pName:String!) {
        node( id:$rid ) {
           ... on Repository {
              id nameWithOwner
              projectsV2(first:99, query: $pName ) {edges{ node{ id title }}}}
    }}`;
    let variables = {"rid": rNodeId, "pName": pNameQuery };
    query = JSON.stringify({ query, variables });

    // XXX same as findByName
    /*
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( !utils.validField( raw, "status" ) || raw.status != 200 ) { throw raw; }
	    let projects = [];
	    if( utils.validField( raw.data.node, "projectsV2" )) { projects = raw.data.node.projectsV2.edges; }

	    if( projects.length == 1 )     { pid = projects[0].node.id; }
	    else if( projects.length > 1 ) { pid = -1 * projects.length; }
	})
	.catch( e => pid = ghUtils.errorHandler( "findProjectByRepo", e, findProjectByRepo, authData, rNodeId, projName ));
    */
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( !utils.validField( raw, "status" ) || raw.status != 200 ) { throw raw; }
	    let projects = [];
	    if( utils.validField( raw.data.node, "projectsV2" )) { projects = raw.data.node.projectsV2.edges; }

	    for( let i = 0; i < projects.length; i++ ) {
		const proj = projects[i].node;
		if( proj.title == projName ) { pid = proj.id; }
	    }
	})
	.catch( e => pid = ghUtils.errorHandler( "findProjectByRepo", e, findProjectByRepo, authData, rNodeId, projName ));
    
    return pid;
}

// XXX unit testing required
async function linkProject( authData, ghLinks, ceProjects, ceProjId, pid, rNodeId, rName ) {
    let query     = "mutation( $pid:ID!, $rid:ID! ) { linkProjectV2ToRepository( input:{projectId: $pid, repositoryId: $rid }) {clientMutationId}}";
    let variables = {"pid": pid, "rid": rNodeId };
    query         = JSON.stringify({ query, variables });

    let res = -1;
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( ret => {
	    if( !utils.validField( ret, "status" ) || ret.status != 200 ) { throw ret; }
	    res = ret;
	})
	.catch( e => res = ghUtils.errorHandler( "linkProject", e, linkProject, authData, ghLinks, ceProjects, ceProjId, pid, rNodeId, rName ));

    if( typeof res.data === 'undefined' ) { console.log( "LinkProject failed.", res ); }
    else if( ghLinks !== -1 ) {
	// testServer needs to do this for itself, since testServer ghLinks is not the same object as ceServer ghLinks
	// XXX fix when handle link/unlink in projectHandler.  if ever.  notifications missing.
	await ghLinks.linkProject( authData, ceProjects, ceProjId, pid, rNodeId, rName );
    }
}



// XXX Placed here to support createUnclaimedProject..
//     relocate to gh2TestUtils once column support in the API is resolved.
async function findOrCreateProject( authData, ghLinks, ceProjects, ceProjId, orgLogin, ownerLogin, ownerId, repoId, repoName, name, body ) {
    let linkageDone = false;

    console.log( authData.who, "FindOrCreateProject", name );
    // project can exist, but be unlinked.  Need 1 call to see if it exists, a second if it is linked.    
    let pid = await findProjectByName( authData, orgLogin, ownerLogin, name );
    if( pid === -1 ) {
	pid = await createProject( authData, ownerId, repoId, name, body );
    }
    else {
	let rp = await findProjectByRepo( authData, repoId, name );
	if( rp === -1 ) {
	    await linkProject( authData, ghLinks, ceProjects, ceProjId, pid, repoId, repoName );
	    linkageDone = (ghLinks !== -1);
	}
    }
    
    return [pid, linkageDone];
}


// NOTE: As of 1/2023 GH API does not support management of the status column for projects
//       For now, verify that a human has created this by hand.... https://github.com/orgs/community/discussions/44265
// NOTE: if this creates, then create unclaimed column below will fail.
async function createUnClaimedProject( authData, ghLinks, ceProjects, pd  )
{
    let [unClaimedProjId,_] = await findOrCreateProject( authData, ghLinks, ceProjects, pd.ceProjectId, pd.org, pd.actor, pd.actorId, pd.repoId, pd.repoName,
							 config.UNCLAIMED, "All issues here should be attached to more appropriate projects" );
    
    if( unClaimedProjId === -1 ) {
	// XXX revisit once (if) GH API supports column creation
	//     note, we CAN create projects, but there is little point if required columns must also be created.
	//     note, could make do with 'no status' for unclaimed:unclaimed, but would fail for unclaimed:accrued and other required columns.
	console.log( authData.who, "Error.  Please create the", config.UNCLAIMED, "project by hand, for now." );
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

    console.log( "create unclaimed col", unClaimedProjId, issueId, colName, accr );

    // Get locs again, to update after uncl. project creation 
    locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "projName": unClaimed } );
    if( locs === -1 ) {
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
// Don't care about state:OPEN/CLOSED.  unclaimed need not be visible.
async function createUnClaimedCard( authData, ghLinks, ceProjects, pd, issueId, accr )
{
    let unClaimedProjId = await createUnClaimedProject( authData, ghLinks, ceProjects, pd );
    assert( unClaimedProjId !== -1 );

    let loc = await createUnClaimedColumn( authData, ghLinks, pd, unClaimedProjId, issueId, accr );
    assert( loc !== -1  );
    assert( loc.hostColumnId !== config.EMPTY  );

    // create card in unclaimed:unclaimed
    let ploc = {"ceProjId": pd.ceProjectId, "pid": unClaimedProjId, "colId": loc.hostColumnId} ;
    let card = await createProjectCard( authData, ghLinks, ploc, issueId, loc.hostUtility, false );
    return card;
}

// GitHub add assignee can take a second or two to complete, internally.
// If this fails, retry a small number of times before returning false.
async function checkReserveSafe( authData, issueId, colNameIndex ) {
    let retVal = true;
    if( colNameIndex > config.PROJ_PROG ) { 
	let assignees = await getAssignees( authData, issueId );
	let retries = 0;
	while( assignees.length == 0 && retries < config.MAX_GH_RETRIES ) {
	    retries++;
	    console.log( "XXX WARNING.  No assignees found.  Retrying.", retries, Date.now() );
	    assignees = await getAssignees( authData, issueId );	    
	}
	
	if( assignees.length == 0  ) {
	    console.log( "WARNING.  Update card failed - no assignees" );   // can't propose grant without a grantee
	    retVal = false;
	}
    }
    return retVal;
}

//                                   [ pid, colId:PLAN,     colId:PROG,     colId:PEND,      colId:ACCR ]
// If this is a flat project, return [ pid, colId:current,  colId:current,  colId:NEW-PEND,  colId:NEW-ACCR ]
// Note. alignment risk
// XXX NOTE  this is optimistically creating required cols if they are missing.
//           until PV2 supports this ability, much of this code is useless.
async function getCEProjectLayout( authData, ghLinks, pd )
{
    // if not validLayout, won't worry about auto-card move
    // XXX will need workerthreads to carry this out efficiently, getting AWS data and GH simultaneously.
    // Note.  On rebuild, watch for potential hole in create card from isssue
    let issueId = pd.issueId;
    let link = ghLinks.getUniqueLink( authData, pd.ceProjectId, issueId );

    let pid = link === -1 ? link : link.hostProjectId;
    let curCol = link === -1 ? link : link.hostColumnId;

    // PLAN and PROG are used as a home in which to reopen issue back to.
    // If this is not a pure full project, try to reopen the issue back to where it started.
    if( link !== -1 && link.hostColumnName == config.PROJ_COLS[ config.PROJ_PEND ] ) {
	curCol = link.flatSource;
    }

    console.log( authData.who, "Getting ceProjLayout for", pid );
    let foundReqCol = [pid, -1, -1, -1, -1];
    if( pid == -1 ) { return foundReqCol; }
    const locs = ghLinks.getLocs( authData, { ceProjId: pd.ceProjectId, repo: pd.repoName, pid: pid } );
    assert( locs != -1 );
    assert( link.hostProjectName == locs[0].hostProjectName );

    let missing = true;
    let foundCount = 0;
    for( loc of locs ) {
	let colName = loc.hostColumnName;
	for( let i = 0; i < 4; i++ ) {
	    if( colName == config.PROJ_COLS[i] ) {
		if( foundReqCol[i+1] == -1 ) { foundCount++; }
		else {
		    console.log( "Validate CE Project Layout found column repeat: ", config.PROJ_COLS[i] );
		    assert( false );
		}
		foundReqCol[i+1] = loc.hostColumnId;
		break;
	    }
	}
	// no need to check every col when required are found
	if( foundCount == 4 ) { missing = false; break; }
    }

    
    // Make this project viable for PEQ tracking
    if( missing || curCol != -1 ) {
	let progCol, pendCol, accrCol = false;
	const progName = config.PROJ_COLS[ config.PROJ_PROG ]; 
	const pendName = config.PROJ_COLS[ config.PROJ_PEND ];
	const accrName = config.PROJ_COLS[ config.PROJ_ACCR ];
	
	// first, use curCol if present
	if( curCol != -1 ) {
	    foundReqCol[config.PROJ_PLAN + 1] = curCol;
	    foundReqCol[config.PROJ_PROG + 1] = curCol;
	}
	else { // else use PLAN or PROG if present, else make prog and use it
	    if( foundReqCol[config.PROJ_PLAN + 1] == -1 && foundReqCol[config.PROJ_PROG + 1] != -1 ) {
		foundReqCol[config.PROJ_PLAN + 1] = foundReqCol[config.PROJ_PROG + 1];
	    }
	    if( foundReqCol[config.PROJ_PLAN + 1] != -1 && foundReqCol[config.PROJ_PROG + 1] == -1 ) {
		foundReqCol[config.PROJ_PROG + 1] = foundReqCol[config.PROJ_PLAN + 1];
	    }
	    if( foundReqCol[config.PROJ_PLAN + 1] == -1 && foundReqCol[config.PROJ_PROG + 1] == -1 ) {
		console.log( "Creating new column:", progName );
		// Wait later
		progCol = createColumn( authData, ghLinks, pd.ceProjectId, pid, progName, "first" );
	    }
	}

	// Create PEND if missing
	if( foundReqCol[config.PROJ_PEND + 1] == -1 ) {
	    console.log( "Creating new column:", pendName );
	    // Wait later
	    pendCol = createColumn( authData, ghLinks, pd.ceProjectId, pid, pendName, "last" );
	}
	// Create ACCR if missing
	if( foundReqCol[config.PROJ_ACCR + 1] == -1 ) {
	    console.log( "Creating new column:", accrName );
	    // Wait later
	    accrCol = createColumn( authData, ghLinks, pd.ceProjectId, pid, accrName, "last" );
	}


	let nLoc = {};
	nLoc.ceProjectId     = pd.ceProjectId;
	nLoc.hostRepository  = pd.repoName;
	nLoc.hostProjectId   = pid; 
	nLoc.hostProjectName = link.hostProjectName;
	nLoc.active          = "true";
	
	if( progCol ) {
	    progCol = await progCol;
	    nLoc.hostColumnName = progName;
	    nLoc.hostColumnId   = progCol.data.id;
	    await ghLinks.addLoc( authData, nLoc, true );
	}

	if( pendCol ) {
	    pendCol = await pendCol;
	    nLoc.hostColumnName = pendName;
	    nLoc.hostColumnId   = pendCol.data.id;

	    foundReqCol[config.PROJ_PEND + 1] = pendCol.data.id;
	    await ghLinks.addLoc( authData, nLoc, true );
	}

	if( accrCol ) {
	    accrCol = await accrCol;
	    nLoc.hostColumnName = accrName;
	    nLoc.hostColumnId   = accrCol.data.id;
	    
	    foundReqCol[config.PROJ_ACCR + 1] = accrCol.data.id;
	    await ghLinks.addLoc( authData, nLoc, true );
	}
    }
    // console.log( "Layout:", foundReqCol );
    return foundReqCol;
}


exports.getHostLinkLoc     = getHostLinkLoc;

exports.createIssue        = createIssue;
exports.getIssue           = getIssue;
exports.getIssues          = getIssues;
exports.getFullIssue       = getFullIssue;
exports.updateIssue        = updateIssue;
exports.updateTitle        = updateTitle;
exports.addComment         = addComment;
exports.rebuildIssue       = rebuildIssue;
exports.addAssignee        = addAssignee;
exports.remAssignee        = remAssignee;
exports.getAssignees       = getAssignees;
exports.transferIssue      = transferIssue;

exports.makeHumanLabel     = makeHumanLabel;
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

exports.getProjectName      = getProjectName;
exports.updateProject       = updateProject;
exports.createProject       = createProject;
exports.linkProject         = linkProject;
exports.findProjectByName   = findProjectByName;
exports.findProjectByRepo   = findProjectByRepo;
exports.findOrCreateProject = findOrCreateProject;

exports.getColumnName      = getColumnName;

exports.getCard            = getCard;
exports.getCardFromIssue   = getCardFromIssue;
exports.moveCard           = moveCard;
exports.moveToStateColumn  = moveToStateColumn;
exports.createProjectCard  = createProjectCard;
exports.cardIssue          = cardIssue;
exports.removeCard         = removeCard; 
// exports.rebuildCard        = rebuildCard;

exports.getLabelIssues     = getLabelIssues;

exports.getProjectIds      = getProjectIds;

exports.cleanUnclaimed     = cleanUnclaimed;

exports.getCEProjectLayout = getCEProjectLayout;

exports.createUnClaimedProject = createUnClaimedProject; // XXX NYI
exports.createUnClaimedColumn  = createUnClaimedColumn;  // XXX NYI
exports.createUnClaimedCard    = createUnClaimedCard;    // XXX NYI

exports.cloneFromTemplate      = cloneFromTemplate;      // XXX speculative.  useful?
exports.createCustomField      = createCustomField;      // XXX speculative.  useful?
exports.createColumn           = createColumn;           
exports.deleteColumn           = deleteColumn;           // XXX NYI
exports.clearColumn            = clearColumn;           // XXX NYI

exports.checkReserveSafe       = checkReserveSafe;
