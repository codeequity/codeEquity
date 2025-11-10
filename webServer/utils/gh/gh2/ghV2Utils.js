import assert from 'assert';

import * as config from  '../../../config.js';

import * as utils   from '../../ceUtils.js' ;
import * as ghUtils from '../ghUtils.js' ;

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
// Note: an issue will belong to 1 repo only, but 1 proj can have issues from multiple repos
// Note: it seems that "... on Issue" is applying a host-side filter, so no need to more explicitely filter out draft issues and pulls.
// Note: optionId is sufficient for columnId, given the pid.
// Note: view:options.id, pv2:ssfv.optionId stay stable across roadmap/table/board views, independent of sorting, display.
async function getHostLinkLoc( authData, pid, locData, linkData, cursor ) {

    // XXX Getting several values per issue here that are unused.  remove.
    // See notes above.  first:1 is appropriate here.
    const query1 = `query linkLoc($nodeId: ID!, $fName: String!) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            number title id
            items(first: 100) {
              pageInfo { hasNextPage, endCursor }
              edges { node {
                  ... on ProjectV2Item { type id
                    fieldValueByName(name: $fName ) {
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

    const queryN = `query linkLoc($nodeId: ID!, $cursor: String!, $fName: String!) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            number title id
            items(first: 100 after: $cursor) {
              pageInfo { hasNextPage, endCursor }
              edges { node {
                  ... on ProjectV2Item { type id
                    fieldValueByName(name: $fName) {
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
    let variables = cursor === -1 ? {"nodeId": pid, "fName": config.GH_COL_FIELD } : {"nodeId": pid, "cursor": cursor, "fName": config.GH_COL_FIELD };
    query = JSON.stringify({ query, variables });

    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "getHostLinkLoc" )
	    .then( async (raw) => {
		let project = raw.data.node;
		let statusId = -1;

		// Loc data only needs to be built once.  Will be the same for every issue.
		// Note: can not build this from issues below, since we may have empty columns in board view.
		if( locData.length <= 0 ) {
		    
		    // XXX Why process every view?  Plunder the first view to get status (i.e. column) info
		    let views = project.views;
		    if( typeof views === 'undefined' ) {
			console.log( "Warning.  Project views are not defined.  GH2 ceProject with classic project?", pid );
			statusId = 0;
			locData = [-1];
			return;
		    }
		    for( let i = 0; i < views.edges.length; i++ ) {
			// Views does not (yet?) have a fieldByName, which would make it much quicker to find status.
			const aview = views.edges[i].node;
			for( let j = 0; j < aview.fields.edges.length; j++ ) {
			    if( j >= 99 ) { console.log( authData.who, "WARNING.  Detected a very large number of columns, ignoring some." ); }
			    const pfc = aview.fields.edges[j].node;
			    if( pfc.name == config.GH_COL_FIELD ) { 
				statusId = pfc.id;
				for( let k = 0; k < pfc.options.length; k++ ) {
				    let datum   = {};
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
			datum.hostIssueId     = issue.content.id;                          // contentId I_*
			datum.hostIssueNum    = issue.content.number;
			datum.hostIssueName   = issue.content.title;
			datum.hostRepoId      = issue.content.repository.id                // R_*
			datum.hostRepoName    = issue.content.repository.nameWithOwner;
			datum.hostCardId      = issue.id;                                  // projectV2Item id PVTI_*
			datum.hostProjectName = locData[0].hostProjectName;    
			datum.hostProjectId   = locData[0].hostProjectId;    
			datum.hostColumnName  = status;
			datum.hostColumnId    = optionId;
			datum.allCards        = links.map( link => link.node.id );
			
			linkData.push( datum );
		    }
		}
		
		// console.log( "UTILS: Locs", locData );
		// console.log( "UTILS: Links", linkData );
		
		// Wait.  Data is modified
		if( items !== -1 && items.pageInfo.hasNextPage ) { await getHostLinkLoc( authData, pid, locData, linkData, items.pageInfo.endCursor ); }
	    });
    }
    catch( e ) {
	// NO!  This kills references
	// locData  = [];
	// linkData = [];
	locData.length  = 0;
	linkData.length = 0;
	cursor = -1;
	await ghUtils.errorHandler( "getHostLinkLoc", e, getHostLinkLoc, authData, pid, locData, linkData, cursor );
    }
}


async function getHostLoc( PAT, pid ) {
    let locData = [];
    
    let query = `query loc($nodeId: ID! ) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            number title id
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

    let variables = {"nodeId": pid };
    query = JSON.stringify({ query, variables });

    try {
	await ghUtils.postGH( PAT, config.GQL_ENDPOINT, query, "getHostLoc" )
	    .then( async (raw) => {
		let project = raw.data.node;
		let statusId = -1;

		if( locData.length <= 0 ) {
		    
		    // Why process every view?  Plunder the first view to get status (i.e. column) info
		    let views = project.views;
		    if( typeof views === 'undefined' ) {
			console.log( "Warning.  Project views are not defined.  GH2 ceProject with classic project?", pid );
			statusId = 0;
			locData = [-1];
			return;
		    }
		    for( let i = 0; i < views.edges.length; i++ ) {
			// Views does not (yet?) have a fieldByName, which would make it much quicker to find status.
			const aview = views.edges[i].node;
			for( let j = 0; j < aview.fields.edges.length; j++ ) {
			    if( j >= 99 ) { console.log( authData.who, "WARNING.  Detected a very large number of columns, ignoring some." ); }
			    const pfc = aview.fields.edges[j].node;
			    if( pfc.name == config.GH_COL_FIELD ) { 
				statusId = pfc.id;
				for( let k = 0; k < pfc.options.length; k++ ) {
				    let datum   = {};
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

	    });
    }
    catch( e ) {
	// NO!  This kills references
	// locData  = [];
	locData.length  = 0;
	locData = await ghUtils.errorHandler( "getHostLoc", e, getHostLoc, PAT, pid );
    }
    return locData;
}


async function getHostAssign( PAT, rid, assignees, cursor ) {
    
    let query1 = `query assign($nodeId: ID! ) {
	node( id: $nodeId ) {
        ... on Repository {
            assignableUsers( first: 100 ) {
             pageInfo { hasNextPage, endCursor }
             edges { node { login id }}}
    }}}`;

    let queryN = `query assign($nodeId: ID!, $cursor: String! ) {
	node( id: $nodeId ) {
        ... on Repository {
            assignableUsers( first: 100 after: $cursor ) {
             pageInfo { hasNextPage, endCursor }
             edges { node { login id }}}
    }}}`;

    let variables = cursor === -1 ? {"nodeId": rid } : {"nodeId": rid, "cursor": cursor };
    let query     = cursor === -1 ? query1 : queryN; 
    query = JSON.stringify({ query, variables });

    // console.log( "GHA", query );
    try {
	await ghUtils.postGH( PAT, config.GQL_ENDPOINT, query, "getHostAssign" )
	    .then( async (raw) => {
		let repo = raw.data.node;
		let users = repo.assignableUsers; 
		for( let i = 0; i < users.edges.length; i++ ) { assignees.push( users.edges[i].node.id ); }
		// console.log( assignees.toString() );

		// Wait.  Data is modified
		if( users !== -1 && users.pageInfo.hasNextPage ) { await getHostAssign( PAT, rid, assignees, users.pageInfo.endCursor ); }

	    });

    }
    catch( e ) {
	assignees.length  = 0;
	cursor = -1;
	await ghUtils.errorHandler( "getHostAssign", e, getHostAssign, PAT, rid, assignees, cursor );
    }
}

// Get label amounts from all peq labels in repo
async function getHostLabels( PAT, rid, labels, cursor ) {
    
    let query1 = `query label($nodeId: ID! ) {
	node( id: $nodeId ) {
        ... on Repository {
            labels( first: 100 ) {
             pageInfo { hasNextPage, endCursor }
             edges { node { name id description }}}
    }}}`;

    let queryN = `query label($nodeId: ID!, $cursor: String! ) {
	node( id: $nodeId ) {
        ... on Repository {
            labels( first: 100 after: $cursor ) {
             pageInfo { hasNextPage, endCursor }
             edges { node { name id description }}}
    }}}`;

    let variables = cursor === -1 ? {"nodeId": rid } : {"nodeId": rid, "cursor": cursor };
    let query     = cursor === -1 ? query1 : queryN; 
    query = JSON.stringify({ query, variables });

    // XXX should verify peq labels are well-formed here.
    try {
	await ghUtils.postGH( PAT, config.GQL_ENDPOINT, query, "getHostLabels" )
	    .then( async (raw) => {
		let repo = raw.data.node;
		let labs = repo.labels;
		for( let i = 0; i < labs.edges.length; i++ ) {
		    let lab = labs.edges[i].node;
		    let labVal = ghUtils.theOnePEQ( [ lab ] );
		    // console.log( "Checking", lab, labVal );
		    if( labVal > 0 ) { labels.push( [labVal, lab.id] ); }
		}

		// Wait.  Data is modified
		if( labs !== -1 && labs.pageInfo.hasNextPage ) { await getHostLabels( PAT, rid, labels, labs.pageInfo.endCursor ); }

	    });

    }
    catch( e ) {
	labels.length  = 0;
	cursor = -1;
	console.log( e );
	await ghUtils.errorHandler( "getHostLabels", e, getHostLabels, PAT, rid, labels, cursor );
    }
}

// aws peqs: amount, hostHolderId, hostIssueId, hostIssueTitle, hostRepoId, hostProjectSub, peqType
// gh issue: peq labels, assignees, issueId, title, repoId, link:projName,colName, open?  plan.   closed?  label sez pend or accr
async function getHostPeqs( PAT, ceProjects, ghLinks, ceProjId ) {
    let retVal = [];
    let authData = { pat: PAT, who: "ceMD" };
    console.log( "Get host peqs" );

    // Need relevant repos.  Pursue 2 paths to get there, either may be incomplete: 1) linkage to aws, 2) aws ceProjects tables
    // For example, ceProjects may be (should be!) in good shape, while aws linkage may be old.  
    let repoIds = [];
    let issues  = {};
    let ceProj  = ceProjects.findById( ceProjId );

    if( ghLinks == -1 ) { console.log( "No relevant linkage in AWS" ); }
    else {
	let links   = await ghLinks.getLinks( authData, { ceProjId: ceProjId } );
	if( links === -1 ) {
	    console.log( "No relevant links in AWS" );
	}
	else {
	    // Get issue data by repoId.  Build issue map to speed this up.
	    links.forEach( link => {
		// console.log( link );
		if( !repoIds.includes( link.hostRepoId ) ) { repoIds.push( link.hostRepoId ); }
		issues[link.hostIssueId] = {
		    amount:         -1,
		    hostHolderId:   [],
		    hostIssueId:    link.hostIssueId,
		    hostIssueTitle: link.hostIssueName,
		    hostRepoId:     link.hostRepoId,
		    hostProjectSub: [ link.hostProjectName, link.hostColumnName ],
		    peqType:        config.PEQTYPE_END
		};
	    });
	}
    }
    
    if( ceProj != config.EMPTY ) {
	// console.log( "CEPROJ: ", ceProj );
	if( !( utils.validField( ceProj, "HostParts" ) && utils.validField( ceProj.HostParts, "hostRepositories" )) ) {
	    console.log( "WARNING.  CEProjects table is missing host data for:", ceProjId );
	}
	else {
	    let repos = ceProj.HostParts.hostRepositories; // [ {repoId: xxx, repoName: xxx }, .. ]
	    repos.forEach( r => {
		if( !repoIds.includes( r.repoId ) ) { repoIds.push( r.repoId ); }
	    });
	}
    }
    // console.log( "repoIds:", repoIds );

    // Need to check for multiple pages of issues per repo
    for( let r = 0; r < repoIds.length; r++ ) {
	let cursor        = -1;
	let getNextPage   = true;
	let repoId = repoIds[r];
	while( getNextPage ) {
	    let query1 = `query($nodeId: ID!) {
	      node( id: $nodeId ) {
              ... on Repository {
                  issues(first:100) {
                     pageInfo { hasNextPage, endCursor }
                     edges {node { id title number body state
                        assignees(first: 100) {edges {node {id login }}}
                        labels(first: 100) {edges {node {id name }}}
                    }}}}
              }}`;
	    let queryN = `query($nodeId: ID!, $cursor: String!) {
	      node( id: $nodeId ) {
              ... on Repository {
                  issues(first:100 after: $cursor) {
                     pageInfo { hasNextPage, endCursor }
                     edges {node { id title number body state
                        assignees(first: 100) {edges {node {id login }}}
                        labels(first: 100) {edges {node {id name }}}
                    }}}}
              }}`;
	    
	    let query     = cursor === -1 ? query1 : queryN;
	    let variables = cursor === -1 ? {"nodeId": repoId } : {"nodeId": repoId, "cursor": cursor };
	    query = JSON.stringify({ query, variables });
	    
	    try {
		await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "getHostPeqs" )
		    .then( async (raw) => {
			let allItems = raw.data.node.issues;
			let items    = allItems.edges;
			// XXX XXX
			let verbose = false;
			if( items.length > 50 ) { verbose = true; }
			console.log( "ghV2 found", items.length.toString(), "host peqs", Date.now() );

			for( let i = 0; i < items.length; i++ ) {
			    let iss = items[i].node;
			    
			    // skip non-peq issue
			    if( verbose ) { console.log( "WORKING", i.toString(), iss.title, iss.id, iss ); }

			    // Use peq label to determine peqiness.  There are links at times, but they can not be depended on.
			    // This code is called when checking on errors between GH and CEServer.
			    // There should be only 1 peq label, but in case, make a crazy one that status checking will catch.
			    // Note this could also be handled by ignoring the issue, but that seems wrong.
			    let labels = iss.labels.edges.map( edge => edge.node );
			    let amount = 0;
			    labels.forEach( label => {
				amount = amount * 1000000 + ghUtils.parseLabelName( label.name );
			    });

			    // remove issues that are untracked
			    if( typeof issues[ iss.id ] === 'undefined' ) { issues[ iss.id ] = {}; }
			    if( amount < 1 )  {
				console.log( " .. skipping non-peq", iss.title );
				delete issues[ iss.id ];
				continue;
			    }
			    
			    issues[ iss.id ].amount = amount;

			    // Matching aws peqs, so keep id not name
			    issues[ iss.id ].hostHolderId =  iss.assignees.edges.map( edge => edge.node.id );

			    // at this point, if hostIssueTitle is "", we have the error case where aws does not contain the related peq,
			    // so link above is blank.
			    if( issues[ iss.id ].hostIssueTitle == config.EMPTY ) {
				let res    = await getCardFromIssue( authData, iss.id );
				let hpName = getProjectName( authData, ghLinks, ceProjId, res.pid );
				issues[ iss.id ].hostIssueTitle = iss.title;
				issues[ iss.id ].hostProjectSub = [ hpName, res.columnName ];
			    }
			    
			    
			    // require issue state and col name to be consistent with peq type
			    const pend = config.PROJ_COLS[ config.PROJ_PEND ];
			    const accr = config.PROJ_COLS[ config.PROJ_ACCR ];
			    // console.log( iss.title, iss.state, pend, accr, issues[ iss.id ].hostProjectSub[1] );
			    if( iss.state == config.GH_ISSUE_OPEN && issues[ iss.id ].hostProjectSub[1] != pend && issues[ iss.id ].hostProjectSub[1] != accr ) {
				issues[ iss.id ].peqType = config.PEQTYPE_PLAN;
			    }
			    else if( iss.state == config.GH_ISSUE_CLOSED && issues[ iss.id ].hostProjectSub[1] == pend ) {
				issues[ iss.id ].peqType = config.PEQTYPE_PEND;
			    }
			    else if( iss.state == config.GH_ISSUE_CLOSED && issues[ iss.id ].hostProjectSub[1] == accr ) {
				issues[ iss.id ].peqType = config.PEQTYPE_GRANT;
			    }

			    // XXX
			    if( Object.values(issues).length > 50 ) { console.log( issues[ iss.id ], iss ); }
			}
			
			if( allItems !== -1 && allItems.pageInfo.hasNextPage ) { cursor = allItems.pageInfo.endCursor; }
			else                                                   { getNextPage = false; }
		    });
	    }
	    catch( e ) { retVal = await ghUtils.errorHandler( "getHostPeqs", e, getHostPeqs, PAT, ceProjects, ghLinks, ceProjId ); }
	}
    }

    Object.values(issues).forEach( v => retVal.push( v ) );
    // XXX
    console.log( "ghV2 returning", Object.values(issues).length.toString(), retVal.length.toString(), "host peqs" );
	
    // console.log( retVal );

    return retVal;
}


// Create in No Status.
async function cardIssue( authData, pid, issDat ) {
    assert( issDat.length == 3 );
    let issueData = [issDat[0],issDat[1],-1]; // contentId, num, cardId
    
    let query     = "mutation( $proj:ID!, $contentId:ID! ) { addProjectV2ItemById( input:{ projectId: $proj, contentId: $contentId }) {clientMutationId, item{id}}}";
    let variables = {"proj": pid, "contentId": issDat[0]};
    let queryJ    = JSON.stringify({ query, variables });

    // console.log( authData.pat, config.GQL_ENDPOINT, queryJ );

    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "cardIssue" )
	    .then( ret => {
		if( !utils.validField( ret.data, "addProjectV2ItemById" )) { console.log( "Not seeing card data?", ret );  }	    
		issueData[2] = ret.data.addProjectV2ItemById.item.id;
		console.log( authData.who, " .. issue added to project, pv2ItemId:", issueData[2] );
	    });
    }
    catch( e ) { issueData = await ghUtils.errorHandler( "cardIssue", e, cardIssue, authData, pid, issDat ); }

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
    if( !utils.validField( issue, "body" ))       { issue.body = ""; }
    if( !utils.validField( issue, "labels" ))     { issue.labels = []; }
    if( !utils.validField( issue, "assignees" ))  { issue.assignees = []; }
    if( !utils.validField( issue, "milestone" ))  { issue.milestone = null; }

    console.log( authData.who, "Create issue", repoNode, pid, issue.title );
    
    // assignees, labels are lists of IDs, not full labels.
    issue.labels    = issue.labels.map(    lab  => Object.keys( lab  ).length > 0 ? lab.id  : lab );
    issue.assignees = issue.assignees.map( assn => Object.keys( assn ).length > 0 ? assn.id : assn );

    let query = `mutation( $repo:ID!, $title:String!, $body:String, $labels:[ID!], $assg:[ID!], $mile:ID )
                    { createIssue( input:{ repositoryId: $repo, title: $title, body: $body, labelIds: $labels, assigneeIds: $assg, milestoneId: $mile }) 
                    {clientMutationId, issue{id, number}}}`;

    let variables = {"repo": repoNode, "title": issue.title, "body": issue.body, "labels": issue.labels, "mile": issue.milestone, "assg": issue.assignees };
    let queryJ    = JSON.stringify({ query, variables });

    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "createIssue", true )
	    .then( ret => {
		issueData[0] = ret.data.createIssue.issue.id;
		issueData[1] = ret.data.createIssue.issue.number;
	    });
    }
    catch( e ) {
	if( e.status == 422 ) { console.log( authData.who, "WARNING. Issue not created.", issue, e.errors ); }
	issueData = await ghUtils.errorHandler( "createIssue", e, createIssue, authData, repoNode, pid, issue );
    }

    if( pid !== -1 ) { issueData = await cardIssue( authData, pid, issueData ); }
    console.log( authData.who, " .. issue created, issueData:", issueData );

    return issueData;
}

// get unusual faceplate info
async function getIssue( authData, issueId ) {
    let retVal   = [];
    if( issueId === -1 ) { return retVal; }
    
    let issue = await getFullIssue( authData, issueId );
    if( Object.keys( issue ).length <= 0 ) { return retVal; }
    let retIssue = [];
    
    retIssue.push( issue.id );
    retVal.push( issue.title );
    if( issue.labels.edges.length > 0 ) {
	for( const label of issue.labels ) { retVal.push( label.description ); }
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

    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "getIssues" )
	    .then( async (raw) => {
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
	    });
    }
    catch( e ) { issues = await ghUtils.errorHandler( "getIssues", e, getIssues, authData, repoNodeId ); }

    return issues;
}

// Note, this is not returning full issues. 
async function getColumnCount( authData, pid ) {
    let query = `query($nodeId: ID!) {
                 node(id:$nodeId) {
                 ... on ProjectV2 {
                     number title id
                     views(first: 1) { edges { node {
                     ... on ProjectV2View {
                         name layout 
                         fields(first: 100) { edges { node {
                         ... on ProjectV2FieldConfiguration {
                             ... on ProjectV2SingleSelectField {id name options {id name}
                          }}}}}}}}}}}}`;
    let variables = {"nodeId": pid };
    query = JSON.stringify({ query, variables });

    let colCount = 0;
    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "getColumnCount" )
	    .then( async (raw) => {
		let item = raw.data.node.views.edges[0];
		let fields = item.node.fields.edges;
		assert( fields.length <= 99, "Need to paginate getColumnCount." );
		for( let i = 0; i < fields.length; i++ ) {
		    let field = fields[i].node;
		    if( field.name == config.GH_COL_FIELD ) {
			colCount = field.options.length + 1;  // no status
			break;
		    }}
	    });
    }
    catch( e ) { issues = await ghUtils.errorHandler( "getColumnCount", e, getColumnCount, authData, pid ); }

    return colCount;
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
    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "getFullIssue" )
	    .then( ret => {
		if( !utils.validField( ret.data, "node" ))                    { return issue; }  // no such issue, can be checking existence, not an error.
		issue = ret.data.node;
		if( issue.assignees.edges.length > 99 ) { console.log( authData.who, "WARNING.  Large number of assignees.  Ignoring some." ); }
		if( issue.labels.edges.length > 99 )    { console.log( authData.who, "WARNING.  Large number of labels.  Ignoring some." ); }
		issue.assignees = issue.assignees.edges.map( edge => edge.node );
		issue.labels    = issue.labels.edges.map( edge => edge.node );
	    });
    }
    catch( e ) { issue = await ghUtils.errorHandler( "getFullIssue", e, getFullIssue, authData, issueId ); }

    return issue;
}

async function updateIssue( authData, issueId, field, newValue ) {

    let query     = "";
    if(      field == "state" ) { query = `mutation( $id:ID!, $value:IssueState ) { updateIssue( input:{ id: $id, state: $value }) {clientMutationId}}`; }
    else if( field == "title" ) { query = `mutation( $id:ID!, $value:String )     { updateIssue( input:{ id: $id, title: $value }) {clientMutationId}}`; }
    
    let variables = {"id": issueId, "value": newValue };
    let queryJ    = JSON.stringify({ query, variables });

    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "updateIssue" )
	    .then( ret => {
		console.log( authData.who, "updateIssue done" );
	    });
    }
    catch( e ) { await ghUtils.errorHandler( "updateIssue", e, updateIssue, authData, issueId, field, newValue ); }
    return true;
}

async function updateTitle( authData, issueId, title ) {
    return await updateIssue( authData, issueId, "title", title );
}

async function addComment( authData, issueId, msg ) {
    let query     = `mutation( $id:ID!, $msg:String! ) { addComment( input:{ subjectId: $id, body: $msg }) {clientMutationId}}`;
    let variables = {"id": issueId, "msg": msg };
    let queryJ    = JSON.stringify({ query, variables });

    try        { await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "addComment" ); }
    catch( e ) { await ghUtils.errorHandler( "addComment", e, addComment, authData, issueId, msg ); }
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
	try        { await utils.failHere( "rebuildIssue" ); }
	catch( e ) { issueData = await ghUtils.errorHandler( "rebuildIssue", utils.FAKE_ISE, rebuildIssue, authData, repoNodeId, projectNodeId, issue, msg, splitTag ); }
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
	try        { await utils.failHere( "addAssignee" ); }
	catch( e ) { ret = await ghUtils.errorHandler( "addAssignee", utils.FAKE_ISE, addAssignee, authData, issueId, aNodeId ); }
    }
    else {
	let query = `mutation( $id:ID!, $adds:[ID!]! )
                    { addAssigneesToAssignable( input:{ assignableId: $id, assigneeIds: $adds }) {clientMutationId}}`;
	
	let variables = {"id": issueId, "adds": [aNodeId] };
	let queryJ    = JSON.stringify({ query, variables });

	try {
	    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "addAssignee" )
		.then( raw => {
		    if( typeof raw.errors !== 'undefined' ) { console.log( "WARNING.  Assignment failed", raw.errors[0].message ); }
		    else                                    { ret = true; }
		});
	}
	catch( e ) { ret = await ghUtils.errorHandler( "addAssignee", ret, addAssignee, authData, issueId, aNodeId ); }
    }
    return ret;
}

async function remAssignee( authData, issueId, aNodeId ) {
    let query = `mutation( $id:ID!, $adds:[ID!]! )
                 { removeAssigneesFromAssignable( input:{ assignableId: $id, assigneeIds: $adds }) {clientMutationId}}`;
    
    let variables = {"id": issueId, "adds": [aNodeId] };
    let queryJ    = JSON.stringify({ query, variables });
    
    try { await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "remAssignee", true );  }
    catch( e ) {
	if( e.status == 422 ) { console.log( authData.who, "WARNING. Assignee(s) not removed.", issueId, aNodeId, e.errors ); }
	await ghUtils.errorHandler( "remAssignee", e, remAssignee, authData, issueId, aNodeId );
    }
}

// Note.. unassigned is normal for plan, abnormal for inProgress, not allowed for accrued.
// Note. alignment risk - card info could have moved on
async function getAssignees( authData, issueId ) {

    let retVal = [];
    if( issueId === -1 ) { console.log( authData.who, "getAssignees: bad issue", issueId ); return retVal; }

    // XXX Fugly
    if( utils.TEST_EH && Math.random() < utils.TEST_EH_PCT ) {
	try        { await utils.failHere( "getAssignees" ); }
	catch( e ) { retVal = await ghUtils.errorHandler( "getAssignees", utils.FAKE_ISE, getAssignees, authData, issueId); }
    }
    else {

	let query = `query( $id:ID! ) {
                       node( id: $id ) {
                        ... on Issue {
                           assignees(first: 100)    { edges { node { login id }}}
                  }}}`;
	let variables = {"id": issueId };
	let queryJ    = JSON.stringify({ query, variables });

	try {
	    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "getAssignee" )
		.then( raw => {
		    if( typeof raw.data.node === 'undefined' ) { console.log( "Error.  Missing assignee data.", raw.data ); }
		    if( typeof raw.errors != 'undefined' ) { console.log( raw.errors, raw.errors[0].message ); }
		    let assigns = raw.data.node.assignees;
		    for( let i = 0; i < assigns.edges.length; i++ ) {
			let a = assigns.edges[i].node;
			retVal.push( a.id );
		    }
		    
		});
	}
	catch( e ) { retVal = await ghUtils.errorHandler( "getAssignees", e, getAssignees, authData, issueId ); }
    }
    // Error handler will return false when faced with unknown error.
    if( retVal == false ) { retVal = []; }
    return retVal;
}

// Hmm.. do not seem to get assignees right off the bat on xfer.
async function transferIssue( authData, issueId, newRepoNodeId) {

    let query = `mutation ($issueId: ID!, $repoId: ID!) 
                    { transferIssue( input:{ issueId: $issueId, repositoryId: $repoId, createLabelsIfMissing: true })
                                   { clientMutationId, issue{id,number,assignees(first:100){edges{node{login id}}}}}}`;
    let variables = {"issueId": issueId, "repoId": newRepoNodeId };
    query = JSON.stringify({ query, variables });

    let ret = -1;
    try {
	ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "transferIssue", true );
	assert( utils.validField( ret.data.transferIssue, "issue" ) );
	ret = ret.data.transferIssue.issue;
	// console.log( "XyX", ret );
	ret.assignees = ret.assignees.edges.map( edge => edge.node );
    }
    catch( e ) {
	if( e.status == 422 ) { console.log( authData.who, "WARNING. Issue not transferred.", issueId, e.errors ); }
	ret = await ghUtils.errorHandler( "transferIssue", e, transferIssue, authData, issueId, newRepoNodeId );
    }
    return ret;
}

// This requires admin privs on repo at GH.  
async function remIssue( authData, issueId ) {

    let query     = "mutation( $id:ID! ) { deleteIssue( input:{ issueId: $id }) {clientMutationId}}";
    let variables = {"id": issueId };
    query         = JSON.stringify({ query, variables });

    let ret = -1;
    try {
	// console.log( authData );
	ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "removeIssue" );
	if( utils.validField( ret, "errors" )) {
	    console.log( "WARNING.  Delete issue failed.  Admin permissions may be required." );
	    console.log( ret );
	}
    }
    catch( e ) {
	ret = await ghUtils.errorHandler( "remIssue", e, remIssue, authData, issueId );
    }
    
    return ret;
}


async function createLabel( authData, repoNode, name, color, desc ) {

    console.log( authData.who, "Create label", repoNode, name, desc, color );

    let query     = `mutation( $id:ID!, $color:String!, $name:String!, $desc:String! )
                       { createLabel( input:{ repositoryId: $id, color: $color, description: $desc, name: $name }) {clientMutationId, label {id, name, color, description}}}`;

    let variables = {"id": repoNode, "name": name, "color": color, "desc": desc };
    let queryJ    = JSON.stringify({ query, variables });

    let label = {};
    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "createLabel" )
	    .then( ret => {
		if( typeof ret.errors !== 'undefined' ) {
		    console.log( authData.who, "WARNING. Label not created", ret.errors );
		    if( ret.errors.length == 1 && ret.errors[0].message.includes( "Name has already been taken" ) ) {
			label.taken = true;
		    }
		}
		else {
		    // console.log( authData.who, " .. label added to repo, pv2ItemId:", ret.data.createLabel.label.id ); 
		    label = ret.data.createLabel.label;
		}
	    });
    }
    catch( e ) { label = await ghUtils.errorHandler( "createLabel", e, createLabel, authData, repoNode, name, color, desc ); }
    
    return label;
}

async function getLabel( authData, repoNode, peqHumanLabelName ) {
    let labelRes = {}
    labelRes.status = 404;

    console.log( authData.who, "Get label", repoNode, peqHumanLabelName );

    // query below checks both name and description
    // Oddly, GH returns anything that partially matches the query, without means to limit to precise matches.  i.e. if name is 1M Alloc, multiple are returned
    // NOTE: As of 5/24, GH can no longer search label by name dependably.  Not long ago, GH could query"1M AllocPEQ" successfully.
    // Now, it can query "1M", "1M " and "AllocPEQ", but no longer "1M A" with anything following.  Strange new bug.
    // Need to search over all names now.
    /*
    let query = `query( $repoNode:ID!, $name:String! ) {
                   node( id: $repoNode ) {
                   ... on Repository {
                       labels(first: 99, query: $name) {
                          edges { node { id, name, color, description }}}
			  }}}`;
    let variables = {"repoNode": repoNode, "name": peqHumanLabelName };
    */
    let query = `query( $repoNode:ID! ) {
                   node( id: $repoNode ) {
                   ... on Repository {
                       labels(first: 99) {
                          edges { node { id, name, color, description }}}
			  }}}`;
    

    let variables = {"repoNode": repoNode };
    let queryJ    = JSON.stringify({ query, variables });

    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "getLabel" )
	    .then( ret => {
		let labels = ret.data.node.labels;
		if( typeof labels === 'undefined' ) { return labelRes; }

		// XXX relax this
		if( labels.edges.length > 99 ) { console.log( authData.who, "WARNING. Found too many labels.  Ignoring some." ); }
		
		for( let i = 0; i < labels.edges.length; i++ ) {
		    const lab = labels.edges[i].node;
		    if( lab.name == peqHumanLabelName ) {  // finish filtering
			labelRes.status = 200;
			labelRes.label = lab;
		    }
		}
	    });
    }
    catch( e ) { labelRes = await ghUtils.errorHandler( "getLabel", e, getLabel, authData, repoNode, peqHumanLabelName ); }

    // if( labelRes.status == 404 ) { console.log( queryJ ); }
    
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
    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "getLabels" )
	    .then( ret => {
		if( !utils.validField( ret.data, "node" ) || !utils.validField( ret.data.node, "labels" )) { return labels; }
		let raw    = ret.data.node.labels;
		
		for( let i = 0; i < raw.edges.length; i++ ) {
		    let label = raw.edges[i].node;
		    labels.push( label );
		}
	    });
    }
    catch( e ) { labels = await ghUtils.errorHandler( "getLabels", e, getLabels, authData, issueId ); }
    
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

async function createPeqLabel( authData, repoNode, peqValue ) {
    
    let peqHumanLabelName = makeHumanLabel( peqValue, config.PEQ_LABEL );
    
    let desc = config.PDESC + peqValue.toString();
    let pcolor = config.PEQ_COLOR;
    let label = await createLabel( authData, repoNode, peqHumanLabelName, pcolor, desc );
    return label;
}


async function findOrCreateLabel( authData, repoNode, peqHumanLabelName, peqValue ) {
    console.log( authData.who, "Find or create label", repoNode, peqHumanLabelName, peqValue );

    if( typeof peqValue == "string" ) { peqValue = parseInt( peqValue.replace(/,/g, "" )); }
    
    // Find?
    const labelRes = await getLabel( authData, repoNode, peqHumanLabelName );
    let   theLabel = labelRes.label;

    // Create?
    if( !utils.validField( labelRes, "status" ) || labelRes.status != 200 ) {
	console.log( authData.who, "Label not found, creating.." );
	
	if( peqValue < 0 ) { theLabel = await createLabel( authData, repoNode, peqHumanLabelName, '654321', "Oi!" ); }
	else               { theLabel = await createPeqLabel( authData, repoNode, peqValue );            }

	// If a label was just created, GH can be too slow in allowing it to be found
	try{
	    if( utils.validField( theLabel, "taken" )) {
		console.log( "BINGO XXXXXXXXXXXX" );
		let e = new Error( "GitHub needs a moment to make label available" );
		e.status = 502;
		throw e;
	    }}
	catch(e) { theLabel = await ghUtils.errorHandler( "findOrCreateLabel", e, findOrCreateLabel, authData, repoNode, peqHumanLabelName, peqValue ); }
	    
    }
    assert( theLabel != null && typeof theLabel !== 'undefined', "Did not manage to find or create the PEQ label" );
    return theLabel;
}

async function updateLabel( authData, labelNodeId, name, desc, color ) {

    console.log( "Update label", labelNodeId, "to", name, desc, "color:", color );

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

    try        {
	let res = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "updateLabel" );
	// Would need to update query for label.  see cardIssue
	// console.log( "UPDATE", res, res.label, res.label.id, res.label.name );
    }
    catch( e ) { await ghUtils.errorHandler( "updateLabel", e, updateLabel, authData, labelNodeId, name, desc, color ); }

    return true;
}

// Primarily used when double-peq label an issue
async function removeLabel( authData, labelNodeId, issueId ) {
    console.log( authData.who, "Remove label", labelNodeId, "from", issueId );

    let query     = `mutation( $labelIds:[ID!]!, $labelableId:ID! ) 
                        { removeLabelsFromLabelable( input:{ labelIds: $labelIds, labelableId: $labelableId })  {clientMutationId}}`;
    let variables = {"labelIds": [labelNodeId], "labelableId": issueId };
    let queryJ    = JSON.stringify({ query, variables });

    try { await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "removeLabel", true );  }
    catch( e ) {
	if( e.status == 422 ) { console.log( authData.who, "WARNING. Label(s) not removed.", issueId, labelNodeId, e.errors ); }
	await ghUtils.errorHandler( "removeLabel", e, removeLabel, authData, labelNodeId, issueId );
    }
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

    try        { await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "addLabel" ); }
    catch( e ) { await ghUtils.errorHandler( "addLabel", e, addLabel, authData, labelNodeId, issueId ); }
    return true;
}

function rebuildLabel( authData, oldLabelId, newLabelId, issueId ) {
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

    try        { await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "updateProject" ); }
    catch( e ) { await ghUtils.errorHandler( "updateProject", e, updateProject, authData, pid, title, body ); }
}


// XXX Can only create a shell with default host columns.
// Only repository owner can use this to create a project.  
async function createProject( authData, ownerNodeId, repoNodeId, title, body ) {
    console.log( "Create project", ownerNodeId, repoNodeId, title );
    let query     = `mutation( $ownerId:ID!, $repoId:ID!, $title:String! ) 
                             { createProjectV2( input:{ repositoryId: $repoId, ownerId: $ownerId, title: $title }) {clientMutationId projectV2 {id}}}`;
    let variables = {"repoId": repoNodeId, "ownerId": ownerNodeId, "title": title };
    let queryJ    = JSON.stringify({ query, variables });
	
    let pid = -1;
    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "createProject" )
	    .then( ret => {
		if( utils.validField( ret, "data" ) && utils.validField( ret.data, "createProjectV2" ) && utils.validField( ret.data.createProjectV2, "projectV2" ))
		{
		    pid = ret.data.createProjectV2.projectV2.id;
		}
		console.log( authData.who, "New project id: ", pid );
	    });
    }
    catch( e ) { pid = await ghUtils.errorHandler( "createProject", e, createProject, authData, ownerNodeId, repoNodeId, title ); }

    // XXX required?
    // arg GH.. would be nice to do this in 1 query!
    if( pid ) { await updateProject( authData, pid, "", body ); }
    
    return pid == false ? -1 : pid;
}

// XXX Can not get this to work. permissions look good, but explorer seems to have different token.
//     api error is useless: node:internal/process/promises:288 triggerUncaughtException
async function deleteProject( authData, projNodeId ) {
    console.log( "Delete project", projNodeId );
    let query     = `mutation( $projectId:ID! ) 
                             { deleteProjectV2( input:{ projectId: $projectId }) {clientMutationId}}`;
    let variables = {"projectId": projNodeId };
    let queryJ    = JSON.stringify({ query, variables });

    console.log( queryJ );
    try        { await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "deleteProject" );  }
    catch( e ) { await ghUtils.errorHandler( "deleteProject", e, deleteProject, authData, projNodeId ); }

    return true;
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
    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "createCustomField" )
	    .then( ret => {
		console.log( "Result", ret );	    
		retVal = ret;
	    });
    }
    catch( e ) { retVal = await ghUtils.errorHandler( "createCustomField", e, createCustomField, authData, fieldName, pid, sso ); }

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
    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "cloneFromTemplate" )
	    .then( ret => {
		if( !utils.validField( ret.data, "copyProjectV2" )) { console.log( "Not seeing new project?", ret ); }
		console.log( "Result", ret, ret.data.copyProjectV2.projectV2.id );
		retVal = ret.data.copyProjectV2.projectV2.id;
	    });
    }
    catch( e ) { retVal = await ghUtils.errorHandler( "closeFromTemplate", e, cloneFromTemplate, authData, ownerId, sourcePID, title ); }

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
    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "createColumnTest" )
	    .then( ret => {
		console.log( "Result", ret );
		retVal = true;
	    });
    }
    catch( e ) { retVal = await ghUtils.errorHandler( "createColumn", e, createColumn, authData, pid, newValue ); }

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
    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "deleteColumn" )
	    .then( ret => {
		console.log( "Result", ret );
		retVal = true;
	    });
    }
    catch( e ) { retVal = await ghUtils.errorHandler( "deleteColumn", e, deleteColumn, authData, newValue ); }

    return retVal;
}

// this will probably move me to no status.
async function clearColumn( authData, newValue ) {
    let query     = `mutation( $dt:DeleteProjectV2FieldInput! ) 
                             { clearProjectV2ItemFieldValue( input: $dt ) 
                             {clientMutationId}}`;

    let variables = {"dt": newValue };

    let queryJ    = JSON.stringify({ query, variables });

    console.log( "query", queryJ );
    
    let retVal = false;
    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "clearColumn" )
	    .then( ret => {
		console.log( "Result", ret );
		retVal = true;
	    });
    }
    catch( e ) { retVal = await ghUtils.errorHandler( "clearColumn", e, deleteColumn, authData, newValue ); }

    return retVal;
}


// Get location of an issue in a project from GH, i.e. status column for ghV2.
// PEQ issue will be 1:1, but non-peq issue may exist in several locations. 
//    Note: cardId, i.e. pv2 item nodeId PVTI_*, is unique per ghProject, and has a content pointer, which points to a single, shared issue id (i.e. I_*).
async function getCard( authData, cardId ) {
    let retVal = {};
    if( cardId === -1 ) { console.log( authData.who, "getCard didn't provide id", cardId ); return retVal; }

    let query = `query( $id:ID!, $fName: String! ) {
                   node( id: $id ) {
                     ... on ProjectV2Item {
                        project { id }
                        fieldValueByName(name: $fName ) {
                          ... on ProjectV2ItemFieldSingleSelectValue {optionId name field { ... on ProjectV2SingleSelectField { id }}}}
                        content { 
                          ... on ProjectV2ItemContent { ... on Issue { id number }}}
                  }}}`;
    let variables = {"id": cardId, "fName": config.GH_COL_FIELD };
    let queryJ    = JSON.stringify({ query, variables });

    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "getCard" )
	    .then( raw => {
		// A moveCard is generated after createProjectCard.  MoveCard getsCard first.
		// If CPC caused a split, the move notice is for a card that no longer exists.
		if( utils.validField( raw, "errors" ) && raw.errors.length == 1 && raw.errors[0].message.includes( "Could not resolve to a node with the global id" )) {  
		    console.log( authData.who, "Could not find card:", cardId, "possibly result of rebuilding for a split issue?" );
		    retVal = -1;
		    return -1;
		}
		let card = raw.data.node;
		retVal.cardId      = cardId;                        
		retVal.pid         = card.project.id;
		retVal.issueNum    = utils.validField( card, "content" ) ? card.content.number : -1;
		retVal.issueId     = utils.validField( card, "content" ) ? card.content.id     : -1;
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
	    });
    }
    catch( e ) { retVal = await ghUtils.errorHandler( "getCard", e, getCard, authData, cardId ); }

    return retVal;
}

async function getCardFromIssue( authData, issueId ) {
    let retVal = {};
    if( issueId === -1 ) { console.log( authData.who, "getCardFromIssue bad issueId", issueId ); return retVal; }

    let query = `query( $id:ID!, $fName: String! ) {
                   node( id: $id ) {
                   ... on Issue { 
                        id title number
                        projectItems (first:2) { edges { node {
                          id type
                          project { id }
                          fieldValueByName(name: $fName ) {
                           ... on ProjectV2ItemFieldSingleSelectValue {optionId name field { ... on ProjectV2SingleSelectField { id }}}}
                        }}}
                 }}}`;
    let variables = {"id": issueId, "fName": config.GH_COL_FIELD };
    let queryJ    = JSON.stringify({ query, variables });

    // console.log( authData.pat, config.GQL_ENDPOINT, queryJ );
    
    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "getCardFromIssue" )
	    .then( raw => {
		if( !utils.validField( raw.data, "node" ) ) { return -1; }
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
		
	    });
    }
    catch( e ) { retVal = await ghUtils.errorHandler( "getCardFromIssue", e, getCardFromIssue, authData, issueId ); }

    return retVal;
}


// Currently, just relocates issue to another column (i.e. status).
// Note: column ids (value) are not unique
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
    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "moveCard", true )
	    .then( r => { ret = r; });
    }
    catch( e ) {
	if( e.status == 422 ) { console.log( authData.who, "WARNING. Move card failed.", itemId, fieldId, value, e.errors ); }
	ret = await ghUtils.errorHandler( "moveCard", e, moveCard, authData, pid, itemId, fieldId, value );
    }

    // success looks like: { data: { updateProjectV2ItemFieldValue: { clientMutationId: null } }, status: 200 }
    return ret;
}

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
	    assert( Object.keys( issue ).length > 0 );	    
	    if( issue.state == config.GH_ISSUE_CLOSED ) {
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
		updateIssue( authData, pd.issueId, "state", config.GH_ISSUE_OPEN ); // reopen issue
		return false;
	    }

	    const locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, pid: link.hostProjectId, "colId": newColId } );
	    assert( locs.length = 1 );
	    success = await moveCard( authData, pd.projectId, cardId, locs[0].hostUtility, newColId );
	}
    }
    else if( action == "reopened" ) {
	
	// This is a PEQ issue.  Verify card is currently in the right place, i.e. PEND ONLY (can't move out of ACCR)
	if( link.hostColumnId != ceProjectLayout[ config.PROJ_PEND+1 ].toString() ) { cardId = -1; }

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
	    updateIssue( authData, pd.issueId, "state", config.GH_ISSUE_CLOSED ); // re-close issue
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
    
    console.log( authData.who, "create project card", ploc.pid, issueId, fieldId, ploc.colId, justId ) ;

    assert( typeof ploc.ceProjId !== 'undefined' );
    assert( typeof ploc.pid      !== 'undefined' );
    assert( typeof ploc.colId    !== 'undefined' );

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

    try { await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "removeCard", true ); }
    catch( e ) {
	if( e.status == 422 ) { console.log( authData.who, "WARNING. Remove card failed.", pid, cardId, e.errors ); }
	await ghUtils.errorHandler( "removeCard", e, removeCard, authData, pid, cardId );
    }

    // Successful post looks like the following. Could provide mutationId for tracking: { data: { deleteProjectV2Item: { clientMutationId: null } } }
    return true;
}


// Get all, open or closed.  Otherwise, for example, link table won't see pending issues properly.
// Returning issueId, not issueNodeId
async function getLabelIssues( authData, repoId, labelName, data, cursor ) {
    const query1 = `query( $rid: ID!, $labelName: String! ) {
          node( id:$rid ) {
             ... on Repository {
                label(name: $labelName) {
	            issues(first: 100) {
	               pageInfo { hasNextPage, endCursor },
		       edges { node { id title number }}
		}}}}}`;
    
    const queryN = `query( $rid: ID!, $labelName: String!, $cursor: String!) {
          node( id:$rid ) {
             ... on Repository {
                label(name: $labelName) {
                   issues(first: 100 after: $cursor ) {
	              pageInfo { hasNextPage, endCursor },
		      edges { node { id title number }}
		}}}}}`;

    let query     = cursor === -1 ? query1 : queryN;
    let variables = cursor === -1 ? {"rid": repoId, "labelName": labelName } : {"rid": repoId, "labelName": labelName, "cursor": cursor};
    query = JSON.stringify({ query, variables });
    
    let issues = -1;
    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "getLabelIssues" )
	    .then( async (raw) => {
		let label = utils.validField( raw.data.node, "label" ) ? raw.data.node.label : null;
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
		    console.log( authData.who, "No issues for label", labelName );
		}
	    });
    }
    catch( e ) {
	cursor = -1;
	data.length = 0;
	await ghUtils.errorHandler( "getLabelIssues", e, getLabelIssues, authData, repoId, labelName, data, cursor );
    }
}

async function getProjIdFromPeq ( authData, iid ) {

    // Peq issues only, meaning 1 project only.
    let query = `query($iid: ID!) {
        node(id: $iid ) {
         ... on Issue { id number title
                projectItems(first: 100) { edges {node {
                  id project { id } }}}}
		}}`;

    let variables = { iid: iid };
    query = JSON.stringify({ query, variables });

    let pid = -1;
    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "getProjIdFromPeq" )
	    .then( async (raw) => {
		// bad transfers leave peqs laying around with old, removed hostIssueIds until ingest is run
		if( !utils.validField( raw.data, "node" )) {
		    console.log( "YYY Bad xfer peq laying around until ingest runs", iid );
		    return pid;
		}
		let cards = raw.data.node.projectItems;
		assert( cards.edges.length == 1 );
		
		let pv2 = cards.edges[0].node.project;
		pid = pv2.id; 
	    });
    }
    catch( e ) {
	console.log( "Bad transfer? Didn't like", e, iid );
	return await ghUtils.errorHandler( "getProjIdFromPeq", e, getProjIdFromPeq, authData, iid );
    }

    return pid;
}

async function getProjectIds( authData, repoFullName, data, cursor ) {

    let rp = repoFullName.split('/');
    assert( rp.length == 2 );

    /*  classic projects sunsetted 4/1/25
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
    */

    const query1 = `query($owner: String!, $name: String!) {
	repository(owner: $owner, name: $name) {
           id
           projectsV2(first:100) {
             pageInfo{hasNextPage, endCursor}
             edges{node{title id}}}        
		}}`;
    
    const queryN = `query($owner: String!, $name: String!, $cursor: String!) {
	repository(owner: $owner, name: $name) {
           id
           projectsV2(first:100 after: $cursor) {
              pageInfo{hasNextPage, endCursor }
              edges{node{title id}}}
		}}`;
    
    let query     = cursor === -1 ? query1 : queryN;
    let variables = cursor === -1 ? {"owner": rp[0], "name": rp[1] } : {"owner": rp[0], "name": rp[1], "cursor": cursor };
    query = JSON.stringify({ query, variables });

    console.log( query );
    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "getProjectIds" )
	.then( async (raw) => {

	    console.log( raw );
	    let repoId = raw.data.repository.id; 
	    // Run this once only
	    /*
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
	    */
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
	});
    }
    catch( e ) {
	    cursor = -1;
	    data.length = 0;
	    await ghUtils.errorHandler( "getProjectIds", e, getProjectIds, authData, repoFullName, data, cursor )
    }

    // console.log( "ghV2:getProjectIds d", data );
}



// NOTE: ONLY call during new situated card.  This is the only means to move accr out of unclaimed safely.
// NOTE: issues can be closed while in unclaimed, before moving to intended project.
// Unclaimed cards are peq issues by definition (only added when labeling uncarded issue).  So, linkage table will be complete.
async function cleanUnclaimed( authData, ghLinks, pd ) {
    // console.log( authData.who, "cleanUnclaimed", pd.issueId );
    let link = ghLinks.getUniqueLink( authData, pd.ceProjectId, pd.issueId );
    if( link === -1 ) { return false; }

    // console.log( link );
    
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
	try        { await utils.failHere( "createColumn" ); }
	catch( e ) { loc = await ghUtils.errorHandler( "createColumn", utils.FAKE_ISE, createColumn, authData, ghLinks, ceProjectId, pid, colName); }
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

    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "findProjectByName" )
	    .then( async (raw) => {
		let projects = [];
		if( utils.validField( raw.data, "user" ))         { projects = raw.data.user.projectsV2.edges; }
		if( utils.validField( raw.data, "organization" )) { projects = projects.concat( raw.data.organization.projectsV2.edges ); }
		
		for( let i = 0; i < projects.length; i++ ) {
		    const proj = projects[i].node;
		    if( proj.title == projName ) { pid = proj.id; }
		}
	    });
    }
    catch( e ) { pid = await ghUtils.errorHandler( "findProjectByName", e, findProjectByName, authData, orgLogin, userLogin, projName ); }
    
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
    // let variables = {"rid": rNodeId, "pName": projName };
    query = JSON.stringify({ query, variables });

    try {
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "findProjectByRepo" )
	    .then( async (raw) => {
		// console.log( "FindProjectByRepo in createUnclaimed", raw );
		let projects = [];
		if( utils.validField( raw.data.node, "projectsV2" )) { projects = raw.data.node.projectsV2.edges; }
		
		for( let i = 0; i < projects.length; i++ ) {
		    const proj = projects[i].node;
		    if( proj.title == projName ) { pid = proj.id; }
		}
	    });
    }
    catch( e ) { pid = await ghUtils.errorHandler( "findProjectByRepo", e, findProjectByRepo, authData, rNodeId, projName ); }
    
    return pid;
}


// XXX in support of link workaround to avoid issue with creating columns.
//     workaround is to create project by hand in GH with all required columns.  then link and unlink from repo to replace create and delete.
async function linkProject( authData, ghLinks, ceProjects, ceProjId, orgLogin, ownerLogin, repoId, repoName, name ) {

    // console.log( "XXX Trying to link", ceProjId, repoId, repoName, name, orgLogin, ownerLogin );
    
    // Already linked?  Using links here may be overly conservative
    if( ghLinks !== -1 ) {
	let links  = await ghLinks.getLinks( authData, { ceProjId: ceProjId, repoId: repoId, projName: name } );    
	if( links !== -1 ) {
	    console.log( authData.who, "Shortcircuit linkProject, already linked" );
	    return links[0].hostProjectId;
	}
    }

    // console.log( "XXX FPN", orgLogin, ownerLogin, name );
    // project can exist, but be unlinked.  Need 1 call to see if it exists, a second if it is linked.    
    let pid = await findProjectByName( authData, orgLogin, ownerLogin, name );
    assert( pid !== -1 );


    // Could see if linked or not, but then average cost is higher (check & link + link vs always link).
    // let rp = await findProjectByRepo( authData, repoId, name );
    console.log( authData.who, "GH-linkProject", name, repoId );
    
    let query     = "mutation( $pid:ID!, $rid:ID! ) { linkProjectV2ToRepository( input:{projectId: $pid, repositoryId: $rid }) {clientMutationId}}";
    let variables = {"pid": pid, "rid": repoId };
    query         = JSON.stringify({ query, variables });
    
    try        { await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "linkProject" ) }
    catch( e ) { return await ghUtils.errorHandler( "linkProject", e, linkProject, authData, ghLinks, ceProjects, ceProjId, orgLogin, ownerLogin, repoId, repoName, name ); }
    
    return pid;
}


// NOTE: As of 1/2023 GH API does not support management of the status column for projects
//       For now, verify that a human has created this by hand.... https://github.com/orgs/community/discussions/44265
// NOTE: if this creates, then create unclaimed column below will fail.
async function createUnClaimedProject( authData, ghLinks, ceProjects, pd  )
{
    let unClaimedProjId = await linkProject( authData, ghLinks, ceProjects, pd.ceProjectId, pd.org, pd.actor, pd.repoId, pd.repoName,
					     config.UNCLAIMED, "All issues here should be attached to more appropriate projects" );
    
    if( unClaimedProjId === -1 ) {
	// XXX revisit once (if) GH API supports column creation
	//     note, we CAN create projects, but there is little point if required columns must also be created.
	//     note, could make do with 'no status' for unclaimed:unclaimed, but would fail for unclaimed:accrued and other required columns.
	console.log( authData.who, "Error.  Please create the", config.UNCLAIMED, "project by hand, for now." );
    }
    else {
	// Update locs.  
	// linkage init will drive unclaimed initialization.  And in other cases
	// unclaimed currently is linked up front, no peq needed.
	let projLocs = ghLinks.getLocs( authData, { ceProjId: pd.ceProjectId, pid: unClaimedProjId } );

	if( projLocs === -1 ) { await ghLinks.linkProject( authData, pd.ceProjectId, unClaimedProjId ); }
	
    }

    return unClaimedProjId;
}

// NOTE: As of 1/2023 GH API does not support management of the status column for projects
//       For now, verify that a human has created this by hand.... https://github.com/orgs/community/discussions/44265 
async function createUnClaimedColumn( authData, ghLinks, pd, unClaimedProjId, issueId, accr )
{
    let   loc = -1;
    const unClaimed = config.UNCLAIMED;
    const colName = accr ? config.PROJ_COLS[config.PROJ_ACCR] : unClaimed;

    console.log( authData.who, "create unclaimed col", unClaimedProjId, issueId, colName, accr );

    // Get locs again, to update after uncl. project creation 
    let locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "projName": unClaimed } );
    if( locs === -1 ) {
	// XXX revisit once (if) GH API supports column creation
	console.log( authData.who, "Error.  Please create the", unClaimed, "project by hand for", pd.ceProjectId  );
	locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId } );
	console.log( locs );
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

    // create card in unclaimed:unclaimed or unclaimed:accr
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
	while( assignees.length == 0 && retries < config.GH_MAX_RETRIES ) {
	    retries++;
	    console.log( "WARNING.  No assignees found.  Retrying.", retries, Date.now() );
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
    for( const loc of locs ) {
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
	nLoc.hostProjectId   = pid; 
	nLoc.hostProjectName = link.hostProjectName;
	nLoc.active          = "true";
	
	if( progCol ) {
	    progCol = await progCol;
	    nLoc.hostColumnName = progName;
	    nLoc.hostColumnId   = progCol.data.id;
	    await ghLinks.addLocs( authData, [nLoc], true );
	}

	if( pendCol ) {
	    pendCol = await pendCol;
	    nLoc.hostColumnName = pendName;
	    nLoc.hostColumnId   = pendCol.data.id;

	    foundReqCol[config.PROJ_PEND + 1] = pendCol.data.id;
	    await ghLinks.addLocs( authData, [nLoc], true );
	}

	if( accrCol ) {
	    accrCol = await accrCol;
	    nLoc.hostColumnName = accrName;
	    nLoc.hostColumnId   = accrCol.data.id;
	    
	    foundReqCol[config.PROJ_ACCR + 1] = accrCol.data.id;
	    await ghLinks.addLocs( authData, [nLoc], true );
	}
    }
    // console.log( "Layout:", foundReqCol );
    return foundReqCol;
}


export {getHostLinkLoc};
export {getHostLoc};
export {getHostAssign};
export {getHostLabels};
export {getHostPeqs};

export {createIssue};
export {getIssue};
export {getIssues};
export {getFullIssue};
export {updateIssue};
export {updateTitle};
export {addComment};
export {rebuildIssue};
export {addAssignee};
export {remAssignee};
export {getAssignees};
export {transferIssue};
export {remIssue};

export {makeHumanLabel};
export {createLabel};
export {createPeqLabel};
export {getLabel};
export {getLabels};
export {findOrCreateLabel};
export {updateLabel};
export {removeLabel};
export {removePeqLabel};
export {addLabel};
export {rebuildLabel};

export {getProjectName};
export {updateProject};
export {linkProject};
export {findProjectByName};
export {findProjectByRepo};

export {getColumnName};

export {getCard};
export {getCardFromIssue};
export {moveCard};
export {moveToStateColumn};
export {createProjectCard};
export {cardIssue};
export {removeCard};

export {getLabelIssues};

export {getProjIdFromPeq};
export {getProjectIds};

export {cleanUnclaimed};

export {getCEProjectLayout};

export {createProject};
export {deleteProject};
export {createUnClaimedProject}; // XXX NYI
export {createUnClaimedColumn};  // XXX NYI
export {createUnClaimedCard};    

export {cloneFromTemplate};      // XXX speculative.  useful?
export {createCustomField};      // XXX speculative.  useful?
export {createColumn};           
export {deleteColumn};           // XXX NYI
export {clearColumn};            // XXX NYI

export {checkReserveSafe};
