import assert from 'assert';

import * as config  from '../../../config.js';

import * as utils   from '../../ceUtils.js';
import * as ghUtils from '../ghUtils.js';

/*
https://docs.github.com/en/free-pro-team@latest/graphql/reference/objects#repository
https://octokit.github.io/rest.js
https://developer.github.com/webhooks/event-payloads/#issues
https://developer.github.com/v3/issues/#create-an-issue
*/


// XXX All funcs using .then.catch pattern that call errorHandler need to rewrite using try catch with an await for the error handler.

var handlerRetries;

var githubSafe = {
    parsePEQ: function( cardContent, allocation ) {
	return parsePEQ( cardContent, allocation );
    },

    validatePEQ: function( authData, repo, issueId, title, projId ) {
	return validatePEQ( authData, repo, issueId, title, projId );
    },

    createIssue: function( authData, owner, repo, title, labels, allocation ) {
	return createIssue( authData, owner, repo, title, labels, allocation );
    },

    createProjectGQL: function( ownerId, PAT, repo, repoId, name, body, beta ) {
	return createProjectGQL( ownerId, PAT, repo, repoId, name, body, beta );
    },

    createProjectCard: function( authData, columnId, issueId, justId ) {
	return createProjectCard( authData, columnId, issueId, justId );
    },

    removeLabel: function( authData, owner, repo, issueNum, label ) {
	return removeLabel( authData, owner, repo, issueNum, label );
    },

    removePeqLabel: function( authData, owner, repo, issueNum ) {
	return removePeqLabel( authData, owner, repo, issueNum );
    },

    updateTitle: function( authData, owner, repo, issueNum, title ) {
	return updateTitle( authData, owner, repo, issueNum, title );
    },

    addLabel: function( authData, owner, repo, issueNum, label ) {
	return addLabel( authData, owner, repo, issueNum, label );
    },

    createLabel: function( authData, owner, repo, name, color, desc ) {
	return createLabel( authData, owner, repo, name, color, desc );
    },

    updateLabel: function( authData, owner, repo, name, newName, desc, color ) {
	return updateLabel( authData, owner, repo, name, newName, desc, color );
    },

    createPeqLabel: function( authData, owner, repo, allocation, peqValue ) {
	return createPeqLabel( authData, owner, repo, allocation, peqValue );
    },

    addComment: function( authData, owner, repo, issueNum, msg ) {
	return addComment( authData, owner, repo, issueNum, msg );
    },

    rebuildLabel: function( authData, owner, repo, issueNum, oldLabel, newLabel ) {
	return rebuildLabel( authData, owner, repo, issueNum, oldLabel, newLabel );
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

    checkRateLimit: function( authData ) {
	return checkRateLimit( authData );
    },

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

    getLabel: function( authData, owner, repo, name ) {
	return getLabel( authData, owner, repo, name );
    },
    
    getLabels: function( authData, owner, repo, issueNum ) {
	return getLabels( authData, owner, repo, issueNum );
    },
    
    findOrCreateLabel: function( authData, owner, repo, allocation, peqHumanLabelName, peqValue ) {
	return findOrCreateLabel( authData, owner, repo, allocation, peqHumanLabelName, peqValue );
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

};





async function checkRateLimit( authData ) {

    // console.log( "Rate limit check currently off" );
    
    await( authData.ic.rateLimit.get())
	.then( rl => {
	    console.log( "Core:", rl['data']['resources']['core']['limit'], rl['data']['resources']['core']['remaining'] );
	    console.log( "Search:", rl['data']['resources']['search']['limit'], rl['data']['resources']['search']['remaining'] );
	    console.log( "Graphql:", rl['data']['resources']['graphql']['limit'], rl['data']['resources']['graphql']['remaining'] );
	    console.log( "Integration:", rl['data']['resources']['integration_manifest']['limit'], rl['data']['resources']['integration_manifest']['remaining'] );
	})
	.catch( e => ghUtils.errorHandler( "checkRateLimit", e, checkRateLimit, authData ) );
}


// Note.. unassigned is normal for plan, abnormal for inProgress, not allowed for accrued.
// there are no assignees for card-created issues.. they are added, or created directly from issues.
// Note. alignment risk - card info could have moved on
async function getAssignees( authData, owner, repo, issueNum )
{
    let retVal = [];
    if( issueNum == -1 ) { console.log( "getAssignees: bad issue number", issueNum ); return retVal; }

    // console.log( authData.who, "Getting assignees for", owner, repo, issueNum );

    // XXX Fugly
    if( utils.TEST_EH && Math.random() < utils.TEST_EH_PCT ) {
	await utils.failHere( "getAssignees" )
	    .catch( e => retVal = ghUtils.errorHandler( "getAssignees", utils.FAKE_ISE, getAssignees, authData, owner, repo, issueNum));
    }
    else {
	await authData.ic.issues.get({ owner: owner, repo: repo, issue_number: issueNum }) 
	    .then( issue => {
		// console.log( issue['data'] );
		if( issue['data']['assignees'].length > 0 ) { 
		    for( assignee of issue['data']['assignees'] ) {
			retVal.push( assignee['login'] );
		    }
		}
	    })
	    .catch( e => retVal = ghUtils.errorHandler( "getAssignees", e, getAssignees, authData, owner, repo, issueNum));
    }
    
    return retVal;
}


// Note.  Should work for label, but this is currently untried.
async function checkExistsGQL( authData, nodeId, nodeType ) {

    let issue    = nodeType !== 'undefined' && nodeType.hasOwnProperty( "issue" )   ? nodeType.issue  : false;
    let label    = nodeType !== 'undefined' && nodeType.hasOwnProperty( "label" )   ? nodeType.label  : false;
    assert( issue ); 

    // Note: node_ids are typed
    let query = `
    query ($nodeId: ID!)
    {
	node(id: $nodeId ) {
        ... on Issue { title }}}`;
    
    let variables = {"nodeId": nodeId };
    query = JSON.stringify({ query, variables });

    let retVal = false;
    let res = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.catch( e => retVal = ghUtils.errorHandler( "checkExistsGQL", e, checkExistsGQL, authData, nodeId, nodeType ));

    // postGH masks errors, catch here.
    if( typeof res !== 'undefined' && typeof res.data === 'undefined' ) {
	retVal = await ghUtils.errorHandler( "checkExistsGQL", res, checkExistsGQL, authData, nodeId, nodeType );
    }
    else {
	// Hmm node was occasionally null here, then failing on title
	if( typeof res.data.node !== 'undefined' && res.data.node && typeof res.data.node.title !== 'undefined' ) { retVal = true; }
    }

    console.log( authData.who, "Issue node", nodeId, "exists?", retVal );
    return retVal;
}


// Depending on timing, GH will return status 410 (correct) or 404 (too bad) if issue is deleted first
async function checkIssue( authData, owner, repo, issueNum ) {
    
    let issue = -1;
    let retVal = false;
    // Wait.  Without additional wait, timing with multiple deletes is too tight.  Can still fail on transfers..
    await authData.ic.issues.get( { owner: owner, repo: repo, issue_number: issueNum })
	.then( iss => issue = iss.data )
	.catch( e => retVal = ghUtils.errorHandler( "checkIssue", e, checkIssue, authData, owner, repo, issueNum ));

    if( issue != -1 ) { retVal = await checkExistsGQL( authData, issue.node_id, {issue: true} ); }
    if( retVal == false ) { retVal = -1; }  // for settleWithVal
    return retVal;
}

// [id, content]
// Note. alignment risk - card info could have moved on
async function getIssue( authData, owner, repo, issueNum )
{
    let retVal   = [];
    if( issueNum == -1 ) { return retVal; }
    
    let issue = await getFullIssue( authData, owner, repo, issueNum ); 
    let retIssue = [];
    
    retIssue.push( issue.id );
    retVal.push( issue.title );
    if( issue.labels.length > 0 ) {
	for( label of issue.labels ) { retVal.push( label['description'] ); }
    }
    retIssue.push( retVal );
    return retIssue;
}

// Note. alignment risk - card info could have moved on
async function getFullIssue( authData, owner, repo, issueNum )
{
    if( issueNum == -1 ) { return -1; }
    let retIssue = "";

    await( authData.ic.issues.get( { owner: owner, repo: repo, issue_number: issueNum }))
	.then( issue =>  retIssue = issue['data'] )
	.catch( e => retIssue = ghUtils.errorHandler( "getFullIssue", e, getFullIssue, authData, owner, repo, issueNum ));
    
    return retIssue;
}

// Note. alignment risk - card info could have moved on
async function getCard( authData, cardId ) {
    let retCard = -1;
    if( cardId == -1 ) { return retCard; }
    
    await( authData.ic.projects.getCard( { card_id: cardId } ))
	.then(card => retCard = card.data )
	.catch( e => retCard = ghUtils.errorHandler( "getCard", e, getCard, authData, cardId ));

    return retCard;
}


async function rebuildIssue( authData, owner, repo, issue, msg, splitTag ) { 
    console.log( authData.who, "Rebuild issue" );
    let issueData = [-1,-1];  // issue id, num
    let title = issue.title;
    if( typeof splitTag !== 'undefined' ) { title = title + " split: " + splitTag; }

    let success = false;

    // XXX Fugly
    if( utils.TEST_EH && Math.random() < utils.TEST_EH_PCT ) {
	await utils.failHere( "rebuildIssue" )
	    .catch( e => issueData = ghUtils.errorHandler( "rebuildIssue", utils.FAKE_ISE, rebuildIssue, authData, owner, repo, issue, msg, splitTag ));
    }
    else {
	await authData.ic.issues.create( {
	    owner:     owner,
	    repo:      repo,
	    title:     title,
	    body:      issue.body,
	    milestone: issue.milestone,
	    labels:    issue.labels,
	    assignees: issue.assignees.map( person => person.login )})
	    .then( issue => {
		issueData[0] = issue['data']['id'];
		issueData[1] = issue['data']['number'];
		success = true;
	    })
	    .catch( e => issueData = ghUtils.errorHandler( "rebuildIssue", e, rebuildIssue, authData, owner, repo, issue, msg, splitTag ));
    }

    if( success ) {
	let comment = "";
	if( typeof splitTag !== 'undefined' ) {
	    comment = "CodeEquity duplicated this new issue from issue id:" + issue.id.toString() + " on " + utils.getToday().toString();
	    comment += " in order to maintain a 1:1 mapping between issues and cards."
	}
	else { comment = utils.getToday().toString() + ": " + msg; }
	    
	// Don't wait.
	addComment( authData, owner, repo, issueData[1], comment );
    }
    return issueData;
}

async function updateIssue( authData, owner, repo, issueNum, newState ) {
    let retVal = false;
    if( issueNum == -1 ) { return retVal; }

    await authData.ic.issues.update( { owner: owner, repo: repo, issue_number: issueNum, state: newState })
	.then( update => retVal = true )
	.catch( e => retVal = ghUtils.errorHandler( "updateIssue", e, updateIssue, authData, owner, repo, issueNum, newState ));

    if( retVal ) { console.log( authData.who, "updateIssue done" ); }
    return retVal;
}

async function updateColumn( authData, colId, newName ) {
    await authData.ic.projects.updateColumn({ column_id: colId, name: newName })
	.catch( e => ghUtils.errorHandler( "updateColumn", e, updateColumn, authData, colId, newName ));
}

async function updateProject( authData, projId, newName ) {
    await authData.ic.projects.update({ project_id: projId, name: newName })
	.catch( e => ghUtils.errorHandler( "updateProject", e, updateProject, authData, projId, newName ));
}

async function addAssignee( authData, owner, repo, issueNumber, assignee ) {

    if( utils.TEST_EH && Math.random() < utils.TEST_EH_PCT ) {
	await utils.failHere( "addAssignee" )
	    .catch( e => ghUtils.errorHandler( "addAssignee", utils.FAKE_ISE, addAssignee, authData, owner, repo, issueNumber, assignee )); 
    }
    else {
	await authData.ic.issues.addAssignees({ owner: owner, repo: repo, issue_number: issueNumber, assignees: [assignee] })
	    .catch( e => ghUtils.errorHandler( "addAssignee", e, addAssignee, authData, owner, repo, issueNumber, assignee ));
    }
}

async function remAssignee( authData, owner, repo, issueNumber, assignee ) {
    await authData.ic.issues.removeAssignees({ owner: owner, repo: repo, issue_number: issueNumber, assignees: [assignee] })
	.catch( e => ghUtils.errorHandler( "remAssignee", e, remAssignee, authData, owner, repo, issueNumber, assignee ));
}

async function updateLabel( authData, owner, repo, name, newName, desc, color ) {
    let lColor = typeof color !== 'undefined' ? color : false;
    if( lColor ) {
	await( authData.ic.issues.updateLabel( { owner: owner, repo: repo, name: name, new_name: newName, description: desc, color: lColor }))
	    .catch( e => ghUtils.errorHandler( "updateLabel", e, updateLabel, authData, owner, repo, name, newName, desc, color ));
    }
    else {
	await( authData.ic.issues.updateLabel( { owner: owner, repo: repo, name: name, new_name: newName, description: desc }))
	    .catch( e => ghUtils.errorHandler( "updateLabel", e, updateLabel, authData, owner, repo, name, newName, desc, color ));
    }
}

async function createLabel( authData, owner, repo, name, color, desc ) {
    let label = {};
    await( authData.ic.issues.createLabel( { owner: owner, repo: repo, name: name, color: color, description: desc }))
	.then( l => label = l['data'] )
	.catch( e => label = ghUtils.errorHandler( "createLabel", e, createLabel, authData, owner, repo, name, color, desc ));
    return label;
}

async function createPeqLabel( authData, owner, repo, allocation, peqValue ) {
    console.log( "Creating label", allocation, peqValue );
    let peqHumanLabelName = peqValue.toString() + " " + ( allocation ? config.ALLOC_LABEL : config.PEQ_LABEL );  
    let desc = ( allocation ? config.ADESC : config.PDESC ) + peqValue.toString();
    let pcolor = allocation ? config.APEQ_COLOR : config.PEQ_COLOR;
    let label = await createLabel( authData, owner, repo, peqHumanLabelName, pcolor, desc );
    return label;
}


async function getLabel( authData, owner, repo, name ) {
    let labelRes = {}
    labelRes.status = 200;
    await( authData.ic.issues.getLabel( { owner: owner, repo: repo, name: name }))
	.then( l => labelRes.label = l['data'] )
	.catch( e => {
	    if( e.status == 404 ) { labelRes.status = e.status; } 
	    else { labelRes = ghUtils.errorHandler( "getLabel", e, getLabel, authData, owner, repo, name ); }
	});
    return labelRes;
}

// Note.  (very) low risk for alignment trouble. warn if see same label create/delete on job queue.
async function findOrCreateLabel( authData, owner, repo, allocation, peqHumanLabelName, peqValue )
{
    // does label exist 

    const labelRes = await getLabel( authData, owner, repo, peqHumanLabelName );
    let   theLabel = labelRes.label;
    
    // if not, create
    if( labelRes.status == 404 ) {
	console.log( authData.who, "Label not found, creating.." );

	if( peqHumanLabelName == config.POPULATE ) {
	    await( authData.ic.issues.createLabel( { owner: owner, repo: repo, name: peqHumanLabelName, color: '111111', description: "populate" }))
		.then( label => theLabel = label['data'] )
		.catch( e => theLabel = ghUtils.errorHandler( "findOrCreateLabel", e, findOrCreateLabel, authData, owner, repo, allocation, peqHumanLabelName, peqValue ));
	}
	else if( peqValue < 0 ) {
	    await( authData.ic.issues.createLabel( { owner: owner, repo: repo, name: peqHumanLabelName, color: '654321', description: "Oi!" }))
		.then( label => theLabel = label['data'] )
		.catch( e => theLabel = ghUtils.errorHandler( "findOrCreateLabel", e, findOrCreateLabel, authData, owner, repo, allocation, peqHumanLabelName, peqValue ));
	}
	else {
	    theLabel = await createPeqLabel( authData, owner, repo, allocation, peqValue );
	}
    }

    assert.notStrictEqual( theLabel, undefined, "Did not manage to find or create the PEQ label" );
    return theLabel;
}


// New information being pushed into GH - alignment safe.
async function createIssue( authData, owner, repo, title, labels, allocation ) {
    console.log( authData.who, "Creating issue, from alloc?", allocation );
    let issueData = [-1,-1];  // issue id, num

    let body = "";
    if( allocation ) {
	body  = "This is an allocation issue added by CodeEquity.  It does not reflect specific work or issues to be resolved.  ";
	body += "It is simply a rough estimate of how much work will be carried out in this category.\n\n"
	body += "It is safe to filter this out of your issues list.\n\n";
	body += "It is NOT safe to close, reopen, or edit this issue.";
    }
    
    // NOTE: will see several notifications are pending here, like issue:open, issue:labelled
    await authData.ic.issues.create( { owner: owner, repo: repo, title: title, labels: labels, body: body } )
	.then( issue => {
	    issueData[0] = issue['data']['id'];
	    issueData[1] = issue['data']['number'];
	})
	.catch( e => issueData = ghUtils.errorHandler( "createIssue", e, createIssue, authData, owner, repo, title, labels, allocation ));
    
    return issueData;
}

async function getRepoLabelsGQL( PAT, owner, repo, data, cursor ) {
    const query1 = `
    query baseConnection($owner: String!, $repo: String!) 
    {
	repository(owner: $owner, name: $repo) {
	    labels(first: 100) {
		pageInfo { hasNextPage, endCursor },
		edges { node { id name description }}
		}}}`;
    
    const queryN = `
    query nthConnection($owner: String!, $repo: String!, $cursor: String!) 
    {
	repository(owner: $owner, name: $repo) {
	    labels(first: 100) {
		pageInfo { hasNextPage, endCursor },
		edges { node { id name description }}
		}}}`;

    
    let query     = cursor == -1 ? query1 : queryN;
    let variables = cursor == -1 ? {"owner": owner, "repo": repo } : {"owner": owner, "repo": repo, "cursor": cursor};
    query = JSON.stringify({ query, variables });

    let issues = -1;
    let res = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, query )
	.catch( e => ghUtils.errorHandler( "getRepoLabelsGQL", e, getRepoLabelsGQL, PAT, owner, repo, data, cursor ));  // probably never seen

    // postGH masks errors, catch here.
    if( typeof res !== 'undefined' && typeof res.data === 'undefined' ) {
	await ghUtils.errorHandler( "getRepoLabelsGQL", res, getRepoLabelsGQL, PAT, owner, repo, data, cursor ); 
    }
    else {
	labels = res.data.repository.labels;
	for( let i = 0; i < labels.edges.length; i++ ) {
	    const label  = labels.edges[i].node;
	    let datum = {};
	    datum.id    = label.id;
	    datum.name  = label.name;
	    datum.description  = label.description
	    data.push( datum );
	}
	// Wait.  Data is modified
	if( labels != -1 && labels.pageInfo.hasNextPage ) { await getRepoLabelsGQL( PAT, owner, repo, data, labels.pageInfo.endCursor ); }
    }
}

async function getReposGQL( PAT, owner, data, cursor ) {
    const query1 = `
    query baseConnection($queryString: String!) 
    {
        repositoryOwner( login: $queryString ) {
            repositories (first:100) {
               pageInfo { hasNextPage, endCursor },
               edges {node{ id name }}}
        }}`;
    
    const queryN = `
    query nthConnection($queryString: String!, $cursor: String!) 
    {
        repositoryOwner( login: $queryString ) {
            repositories (first:100) {
               pageInfo { hasNextPage, endCursor },
               edges {node{ id name isArchived }}}
        }}`;

    
    let query     = cursor == -1 ? query1 : queryN;
    let variables = cursor == -1 ? {"queryString": owner } : {"queryString": owner, "cursor": cursor};
    query = JSON.stringify({ query, variables });

    let issues = -1;
    let res = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, query )
	.catch( e => ghUtils.errorHandler( "getReposGQL", e, getReposGQL, PAT, owner, data, cursor ));  // probably never seen

    // postGH masks errors, catch here.
    if( typeof res !== 'undefined' && typeof res.data === 'undefined' ) {
	await ghUtils.errorHandler( "getReposGQL", res, getReposGQL, PAT, owner, data, cursor ); 
    }
    else {
	let repos = res.data.repositoryOwner.repositories;
	for( let i = 0; i < repos.edges.length; i++ ) {
	    const repo  = repos.edges[i].node;
	    let datum = {};
	    datum.id    = repo.id;
	    datum.name  = repo.name;
	    data.push( datum );
	}
	// Wait.  Data is modified
	if( repos != -1 && repos.pageInfo.hasNextPage ) { await getReposGQL( PAT, owner, data, repos.pageInfo.endCursor ); }
    }
}



async function getRepoIssuesGQL( PAT, owner, repo, data, cursor ) {
    const query1 = `
    query baseConnection($owner: String!, $repo: String!) 
    {
	repository(owner: $owner, name: $repo) {
	    issues(first: 100) {
		pageInfo { hasNextPage, endCursor },
		edges { node {
		    id databaseId url number title
		    projectCards(first: 100) {
			pageInfo { hasNextPage, endCursor },
			edges { node { databaseId 
                                       project { databaseId name } 
                                       column { databaseId name } }}
                    },
		    labels(first: 100) {
			pageInfo { hasNextPage, endCursor },
			edges { node { id name description }}
                    }
     }}}}}`;
    
    const queryN = `
    query nthConnection($owner: String!, $repo: String!, $cursor: String!) 
    {
	repository(owner: $owner, name: $repo) {
	    issues(first: 100) {
		pageInfo { hasNextPage, endCursor },
		edges { node {
		    id databaseId url number title
		    projectCards(first: 100) {
			pageInfo { hasNextPage, endCursor },
			edges { node { databaseId 
                                       project { databaseId name } 
                                       column { databaseId name } }}
                    },
		    labels(first: 100) {
			pageInfo { hasNextPage, endCursor },
			edges { node { id name description }}
                    }
     }}}}}`;
    
    let query     = cursor == -1 ? query1 : queryN;
    let variables = cursor == -1 ? {"owner": owner, "repo": repo } : {"owner": owner, "repo": repo, "cursor": cursor};
    query = JSON.stringify({ query, variables });

    let issues = -1;
    let res = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, query )
	.catch( e => ghUtils.errorHandler( "getRepoIssuesGQL", e, getRepoIssuesGQL, PAT, owner, repo, data, cursor ));  // probably never seen

    // postGH masks errors, catch here.
    if( typeof res !== 'undefined' && typeof res.data === 'undefined' ) {
	await ghUtils.errorHandler( "getRepoIssuesGQL", res, getRepoIssuesGQL, PAT, owner, repo, data, cursor ); 
    }
    else {
	issues = res.data.repository.issues;
	for( let i = 0; i < issues.edges.length; i++ ) {
	    const issue  = issues.edges[i].node;
	    assert( !issue.labels.pageInfo.hasNextPage );
	    assert( !issue.projectCards.pageInfo.hasNextPage );  
	    let datum = {};
	    datum.issueId     = issue.databaseId;
	    datum.issueURL    = issue.url
	    datum.issueNumber = issue.number;
	    datum.issueName   = issue.title;
	    // peq issues are 1:1, ignore the rest
	    if( issue.projectCards.edges.length == 1 ) {
		const card = issue.projectCards.edges[0].node;
		datum.projectId   = card.project.databaseId;
		datum.projectName = card.project.name;
		datum.columnId    = card.column.databaseId;
		datum.columnName  = card.column.name;
	    }
	    let labels = [];
	    for( let j = 0; j < issue.labels.edges.length; j++ ) {
		const label = issue.labels.edges[j].node;
		let lum = {};
		lum.id    = label.id;
		lum.name  = label.name;
		lum.description = label.description
		labels.push( lum );
	    }
	    datum.labels = labels;
	    data.push( datum );
	}
	// Wait.  Data is modified
	if( issues != -1 && issues.pageInfo.hasNextPage ) { await getRepoIssuesGQL( PAT, owner, repo, data, issues.pageInfo.endCursor ); }
    }
}

// GH has three reference types for an issue: number, databaseId, and nodeId.
//    Oddly, the databaseId, which is described as "the primary key from the database" is the worst choice to keep,
//           since this is the only reference that does not have a direct api to retrieve it.  Bah.
//           Unfortunately, this is the reference kept by CodeEquity.
//    Seems that best way to do this would be with search.  But search 'query' is hardly documented at all,
//           and search terms are well hidden.  So, for example, below fails because databaseId is not queriable?
//        search( first:1, type: ISSUE, query: $queryString ) {
//            edges{ node ... on Issue { id databaseId url number title }}
//        queryString: "repo:ariCETester/ceTesterAlt is:issue databaseId:1190745883"
//    So.. do this the hard way.  grunk.

async function getRepoIssueGQL( PAT, owner, repo, issueDatabaseId, data, cursor ) {
    const query1 = `
    query baseConnection($owner: String!, $repo: String!) 
    {
	repository(owner: $owner, name: $repo) {
	    issues(first: 100) {
		pageInfo { hasNextPage, endCursor },
		edges { node { id databaseId url number title }}
     }}}`;
    
    const queryN = `
    query nthConnection($owner: String!, $repo: String!, $cursor: String!) 
    {
	repository(owner: $owner, name: $repo) {
	    issues(first: 100) {
		pageInfo { hasNextPage, endCursor },
		edges { node { id databaseId url number title }}
     }}}`;
    
    let query     = cursor == -1 ? query1 : queryN;
    let variables = cursor == -1 ? {"owner": owner, "repo": repo } : {"owner": owner, "repo": repo, "cursor": cursor};
    query = JSON.stringify({ query, variables });

    let issues = -1;
    let res = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, query )
	.catch( e => ghUtils.errorHandler( "getRepoIssueGQL", e, getRepoIssueGQL, PAT, owner, repo, issueDatabaseId, data, cursor ));  // probably never seen

    // postGH masks errors, catch here.
    if( typeof res !== 'undefined' && typeof res.data === 'undefined' ) {
	await ghUtils.errorHandler( "getRepoIssueGQL", res, getRepoIssueGQL, PAT, owner, repo, issueDatabaseId, data, cursor ); 
    }
    else {
	issues = res.data.repository.issues;
	for( let i = 0; i < issues.edges.length; i++ ) {
	    const issue  = issues.edges[i].node;
	    if( issue.databaseId == issueDatabaseId ) {
		let datum = {};
		datum.issueId     = issue.databaseId;
		datum.issueURL    = issue.url
		datum.issueNumber = issue.number;
		datum.issueName   = issue.title;
		data.push( datum );
	    }
	}
	// Wait.  Data is modified
	if( issues != -1 && issues.pageInfo.hasNextPage ) { await getRepoIssueGQL( PAT, owner, repo, issueDatabaseId, data, issues.pageInfo.endCursor ); }
    }
}

// GraphQL to init link table
// Get all, open or closed.  Otherwise, for example, link table won't see pending issues properly.
async function getBasicLinkDataGQL( PAT, owner, repo, data, cursor ) {
    const query1 = `
    query baseConnection($owner: String!, $repo: String!) 
    {
	repository(owner: $owner, name: $repo) {
	    issues(first: 100) {
		pageInfo { hasNextPage, endCursor },
		edges { node {
		    id databaseId url number title
		    projectCards(first: 100) {
			pageInfo { hasNextPage, endCursor },
			edges { node { databaseId 
                                       project { databaseId name } 
                                       column { databaseId name } }}}
		    labels(first: 100) {
			pageInfo { hasNextPage, endCursor },
			edges { node { id name description }}}
		}}}}}`;
    
    const queryN = `
    query nthConnection($owner: String!, $repo: String!, $cursor: String!) 
    {
	repository(owner: $owner, name: $repo) {
	    issues(first: 100 after: $cursor) {
		pageInfo { hasNextPage, endCursor },
		edges { node {
		    id databaseId url number title
		    projectCards(first: 100) {
			pageInfo { hasNextPage, endCursor },
			edges { node { databaseId 
                                       project { databaseId name } 
                                       column { databaseId name } }}}
		    labels(first: 100) {
			pageInfo { hasNextPage, endCursor },
			edges { node { id name description }}}
		}}}}}`;
    
    let query     = cursor == -1 ? query1 : queryN;
    let variables = cursor == -1 ? {"owner": owner, "repo": repo } : {"owner": owner, "repo": repo, "cursor": cursor};
    query = JSON.stringify({ query, variables });

    let issues = -1;
    let res = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, query );

    // postGH masks errors, catch here.
    if( typeof res !== 'undefined' && typeof res.data === 'undefined' ) {
	await ghUtils.errorHandler( "getBasicLinkDataGQL", res, getBasicLinkDataGQL, PAT, owner, repo, data, cursor );
    }
    else {
	issues = res.data.repository.issues;
	for( let i = 0; i < issues.edges.length; i++ ) {
	    const issue  = issues.edges[i].node;
	    const cards  = issue.projectCards;
	    const labels = issue.labels;
	    
	    // Over 100 cards or 100 labels for 1 issue?  Don't use CE.  Warn here.
	    if( cards.pageInfo.hasNextPage || labels.hasNextPage ) {
		console.log( "WARNING. CodeEquity is not designed to handle issues with over a hundred cards or labels." );
		assert( false );
	    }
	    
	    for( const card of cards.edges ) {
		// console.log( card.node.project.name, issue.title );
		if( !card.node.column ) {
		    console.log( "Warning. Skipping issue:card for", issue.title, "which is awaiting triage." );
		    continue;
		}
		// console.log( card.node.project.name, card.node.column.databaseId );
		let datum = {};
		datum.hostIssueId     = issue.databaseId;
		datum.hostIssueNum    = issue.number;
		datum.hostIssueName   = issue.title;
		datum.hostCardId      = card.node.databaseId;
		datum.hostProjectName = card.node.project.name;
		datum.hostProjectId   = card.node.project.databaseId;
		datum.hostColumnName  = card.node.column.name;
		datum.hostColumnId    = card.node.column.databaseId;
		data.push( datum );
	    }
	}
	// Wait.  Data is modified
	if( issues != -1 && issues.pageInfo.hasNextPage ) { await getBasicLinkDataGQL( PAT, owner, repo, data, issues.pageInfo.endCursor ); }
    }
}


// Get all, open or closed.  Otherwise, for example, link table won't see pending issues properly.
async function getLabelIssuesGQL( PAT, owner, repo, labelName, data, cursor ) {
    const query1 = `
    query baseConnection($owner: String!, $repo: String!, $labelName: String! ) 
    {
	repository(owner: $owner, name: $repo) {
	    label(name: $labelName) {
	       issues(first: 100) {
	          pageInfo { hasNextPage, endCursor },
		  edges { node { databaseId title number }}
		}}}}`;
    
    const queryN = `
    query nthConnection($owner: String!, $repo: String!, $labelName: String!, $cursor: String!) 
    {
	repository(owner: $owner, name: $repo) {
	    label(name: $labelName) {
               issues(first: 100 after: $cursor ) {
	          pageInfo { hasNextPage, endCursor },
		     edges { node { databaseId title number }}
		}}}}`;

    let query     = cursor == -1 ? query1 : queryN;
    let variables = cursor == -1 ? {"owner": owner, "repo": repo, "labelName": labelName } : {"owner": owner, "repo": repo, "labelName": labelName, "cursor": cursor};
    query = JSON.stringify({ query, variables });

    let issues = -1;
    let res = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, query )
	.catch( e => ghUtils.errorHandler( "getLabelIssuesGQL", e, getLabelIssuesGQL, PAT, owner, repo, labelName, data, cursor ));  // probably only seen during testing

    // postGH masks errors, catch here.
    if( typeof res !== 'undefined' && typeof res.data === 'undefined' ) {
	await ghUtils.errorHandler( "getLabelIssuesGQL", res, getLabelIssuesGQL, PAT, owner, repo, labelName, data, cursor );
    }
    else {
	let label = res.data.repository.label;
	if( typeof label !== 'undefined' && label != null ) {
	    issues = label.issues;
	    for( const issue of issues.edges ) {
		let datum = {};
		datum.issueId = issue.node.databaseId;
		datum.num     = issue.node.number;
		datum.title   = issue.node.title;
		data.push( datum );
	    }
	    // Wait.  Data is modified
	    if( issues != -1 && issues.pageInfo.hasNextPage ) { await getLabelIssuesGQL( PAT, owner, repo, labelName, data, issues.pageInfo.endCursor ); }
	}
	else {
	    // XXX may not be an error.. 
	    console.log( "XXX Error, no issues for label", labelName, res );
	}
    }
}


// GraphQL to get all columns in repo 
async function getRepoColsGQL( PAT, owner, repo, data, cursor ) {

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
	.catch( e => ghUtils.errorHandler( "getRepoColsGQL", e, getRepoColsGQL, PAT, owner, repo, data, cursor ));  // this will probably never catch anything

    // postGH masks errors, catch here.
    if( typeof res !== 'undefined' && typeof res.data === 'undefined' ) {
	await ghUtils.errorHandler( "getRepoColsGQL", res, getRepoColsGQL, PAT, owner, repo, data, cursor );
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
		datum.hostProjectName = project.name;
		datum.hostProjectId   = project.databaseId.toString();
		datum.hostColumnName  = col.node.name;
		datum.hostColumnId    = col.node.databaseId.toString();
		data.push( datum );
	    }
	    
	    // Add project even if it has no cols
	    if( cols.edges.length == 0 ) {
		let datum = {};
		datum.hostProjectName = project.name;
		datum.hostProjectId   = project.databaseId.toString();
		datum.hostColumnName  = config.EMPTY;
		datum.hostColumnId    = "-1";
		data.push( datum );
	    }
	}

	// Wait.  Data.
	if( projects != -1 && projects.pageInfo.hasNextPage ) { await getRepoColsGQL( PAT, owner, repo, data, projects.pageInfo.endCursor ); }
    }
}



// Testing function
async function transferIssueGQL( authData, issueId, toRepoId) {
    // Note: node_ids are typed
    let query = `mutation ($issueId: ID!, $repoId: ID!) { transferIssue( input:{ issueId: $issueId, repositoryId: $repoId }) {clientMutationId}}`;
    let variables = {"issueId": issueId, "repoId": toRepoId };
    query = JSON.stringify({ query, variables });

    let ret = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.catch( e => ghUtils.errorHandler( "transferIssueGQL", e, transferIssueGQL, authData, issueId, toRepoId ));

    console.log( "TI_GQL:", ret );
}


// For testutils.
async function createProjectGQL( ownerId, PAT, repo, repoId, name, body, beta ) {
    let query        = "";
    let variables    = {};

    if( beta ) {
	query = `mutation ($ownerId: ID!, $name: String!) { createProjectV2( input:{ title: $name, ownerId: $ownerId}) { projectV2{id, number}}}`;
	variables = {"ownerId": ownerId, "name": name };
    }
    else {
	query = `mutation ($ownerId: ID!, $name: String!, $repos:[ID!]) { createProject( input:{ name: $name, ownerId: $ownerId, repositoryIds :$repos }) { project{id, number}}}`;
	variables = {"ownerId": ownerId, "name": name, "repos": [repoId] };
    }

    query = JSON.stringify({ query, variables });

    const ret = await ghUtils.postGH( PAT, config.GQL_ENDPOINT, query )
	  .catch( e => ghUtils.errorHandler( "createProjectGQL", e, createProjectGQL, ownerId, PAT, repo, repoId, name, body, beta ));

    let retId = -1;
    if( beta ) {
	console.log( "MP_GQL:", ret.data.createProjectV2.projectV2);	
	if( ret.hasOwnProperty( 'data' ) && ret.data.hasOwnProperty( 'createProjectV2' ) && ret.data.createProjectV2.hasOwnProperty( 'projectV2' ) ) {
	    retId = ret.data.createProjectV2.projectV2.id; 
	}
    }
    else 
    {
	console.log( "MP_GQL:", ret.data.createProject.project );
	if( ret.hasOwnProperty( 'data' ) && ret.data.hasOwnProperty( 'createProject' ) && ret.data.createProject.hasOwnProperty( 'project' ) ) {
	    retId = ret.data.createProject.project.id; 
	}
    }
    
    return retId;
}

async function removeCard( authData, cardId ) {
    await authData.ic.projects.deleteCard( { card_id: cardId } )
	.catch( e => ghUtils.errorHandler( "removeCard", e, removeCard, authData, cardId ));
}

// Note.  alignment risk - card info could have moved on
async function rebuildCard( authData, ceProjId, ghLinks, owner, repo, colId, origCardId, issueData, locData ) {

    let isReserved = typeof locData !== 'undefined' && locData.hasOwnProperty( "reserved" ) ? locData.reserved : false;    
    let projId     = typeof locData !== 'undefined' && locData.hasOwnProperty( "projId" )   ? locData.projId   : -1;
    let projName   = typeof locData !== 'undefined' && locData.hasOwnProperty( "projName" ) ? locData.projName : "";
    let fullName   = typeof locData !== 'undefined' && locData.hasOwnProperty( "fullName" ) ? locData.fullName : "";

    assert( issueData.length == 2 );
    let issueId  = issueData[0];
    let issueNum = issueData[1];
    assert.notEqual( issueId, -1, "Attempting to attach card to non-issue." );

    // If card has not been tracked, colId could be wrong.  relocate.
    // Note: do not try to avoid this step during populateCE - creates a false expectation (i.e. ce is tracking) for any simple carded issue.
    if( colId == -1 ) {
	let projCard = await getCard( authData, origCardId ); 
	colId = projCard.column_url.split('/').pop();
    }

    // Trying to build new card in reserved space .. move out of reserved, prog is preferred.
    // Finding or creating non-reserved is a small subset of getCEprojectLayout
    if( isReserved ) {
	assert( projId   != -1 );
	assert( fullName != "" );
	const planName = config.PROJ_COLS[ config.PROJ_PLAN ];
	const progName = config.PROJ_COLS[ config.PROJ_PROG ];

	const locs = ghLinks.getLocs( authData, { "ceProjId": ceProjId,"repo": fullName, "projId": projId } );   
	assert( locs != -1 );
	projName = projName == "" ? locs[0].hostProjectName : projName;

	colId = -1;
	let loc = locs.find( loc => loc.hostColumnName == progName );   // prefer PROG
	if( typeof loc !== 'undefined' ) { colId = loc.hostColumnId; }
	else {
	    loc = locs.find( loc => loc.hostColumnName == planName )
	    if( typeof loc !== 'undefined' ) { colId = loc.hostColumnId; }
	}

	// Create in progress, if needed
	if( colId == -1 ) {
	    let progCol = await createColumn( authData, projId, progName, "first" );
	    console.log( "Creating new column:", progName );
	    colId = progCol.data.id;
	    let nLoc = {};
	    nLoc.ceProjectId     = ceProjId; 
	    nLoc.hostProjectId   = projId;
	    nLoc.hostProjectName = projName;
	    nLoc.hostColumnId    = progName;
	    nLoc.hostColumnName  = colId;
	    nLoc.active          = "true";
	    await ghLinks.addLoc( authData, nLoc, true );
	}
    }
    
    // create issue-linked project_card, requires id not num
    let newCardId = await createProjectCard( authData, colId, issueId, true );
    assert.notEqual( newCardId, -1, "Unable to create new issue-linked card." );	    
    
    // remove orig card
    // Note: await waits for GH to finish - not for notification to be received by webserver.
    removeCard( authData, origCardId );

    return newCardId;
}

async function updateTitle( authData, owner, repo, issueNum, title ) {
    await authData.ic.issues.update({ owner: owner, repo: repo, issue_number: issueNum, title: title  } )
	.catch( e => ghUtils.errorHandler( "updateTitle", e, updateTitle, authData, owner, repo, issueNum, title ));
}

async function removeLabel( authData, owner, repo, issueNum, label ) {
    await authData.ic.issues.removeLabel({ owner: owner, repo: repo, issue_number: issueNum, name: label.name  } )
	.catch( e => ghUtils.errorHandler( "removeLabel", e, removeLabel, authData, owner, repo, issueNum, label ));
}


// issueNum is an int
async function getLabels( authData, owner, repo, issueNum ) {
    var labels = -1;
    await authData.ic.issues.listLabelsOnIssue({ owner: owner, repo: repo, issue_number: issueNum, per_page: 100  } )
	.then( res => labels = res )
	.catch( e => labels  = ghUtils.errorHandler( "getLabels", e, getLabels, authData, owner, repo, issueNum ));
    return labels;
}

// Note this can fail without being an error if issue is already gone.  'Note' instead of 'Error'
// This seems to happen more with transfer, since issueDelete appears to be slower, which confuses checkIssue.  Not a real issue.
async function removePeqLabel( authData, owner, repo, issueNum ) {
    let retVal = false;
    var labels = await getLabels( authData, owner, repo, issueNum );

    if( typeof labels === 'undefined' || labels == false ) { return retVal; }
    if( labels.length > 99 ) { console.log( "Error.  Too many labels for issue", issueNum );} 

    if( labels != -1 ) {
	let peqLabel = {};
	for( const label of labels.data ) {
	    const tval = ghUtils.parseLabelDescr( [label.description] );
	    if( tval > 0 ) { peqLabel = label; break; }
	}
	await removeLabel( authData, owner, repo, issueNum, peqLabel );
	retVal = true;
    }
    return retVal;
}

async function addLabel( authData, owner, repo, issueNum, label ) {
    await authData.ic.issues.addLabels({ owner: owner, repo: repo, issue_number: issueNum, labels: [label.name] })
	.catch( e => ghUtils.errorHandler( "addLabel", e, addLabel, authData, owner, repo, issueNum, label ));
}

async function addComment( authData, owner, repo, issueNum, msg ) {
    await( authData.ic.issues.createComment( { owner: owner, repo: repo, issue_number: issueNum, body: msg } ))
	.catch( e => ghUtils.errorHandler( "addComment", e, addComment, authData, owner, repo, issueNum, msg ));
}

async function rebuildLabel( authData, owner, repo, issueNum, oldLabel, newLabel ) {
    // Don't wait for delete, just for add

    // wait for it.. remove this await if double label appears again.  looks like GH is re-adding after quick sequence like this
    // await removeLabel( authData, owner, repo, issueNum, oldLabel );

    removeLabel( authData, owner, repo, issueNum, oldLabel );
    await addLabel( authData, owner, repo, issueNum, newLabel );
}


async function createProjectCard( authData, columnId, issueId, justId ) {
    let newCard = -1;
    let retVal = -1;
    
    await( authData.ic.projects.createCard({ column_id: columnId, content_id: issueId, content_type: 'Issue' }))
	.then( card => newCard = card.data )
	.catch( e => retVal = ghUtils.errorHandler( "createProjectCard", e, createProjectCard, authData, columnId, issueId, justId ));

    if( newCard != -1 ) { retVal = justId ? newCard['id'] : newCard; }
    return retVal;
}


async function createUnClaimedProject( authData, ghLinks, pd  )
{
    const unClaimed = config.UNCLAIMED;

    let unClaimedProjId = -1;
    let locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "projName": unClaimed } ); // XXX
    unClaimedProjId = locs == -1 ? locs : locs[0].hostProjectId;
    if( unClaimedProjId == -1 ) {
	console.log( "Creating UnClaimed project" );
	let body = "Temporary storage for issues with cards that have not yet been assigned to a column (triage)";
	await authData.ic.projects.createForRepo({ owner: pd.GHOwner, repo: pd.GHRepo, name: unClaimed, body: body })
	    .then(async (project) => {
		unClaimedProjId = project.data.id;

		let nLoc = {};
		nLoc.ceProjectId     = pd.ceProjectId;
		nLoc.hostProjectId   = unClaimedProjId
		nLoc.hostProjectName = unClaimed;
		nLoc.hostColumnId    = config.EMPTY;
		nLoc.hostColumnName  = -1;
		nLoc.active          = "true";
		
		await ghLinks.addLoc( authData, nLoc, true );
	    })
	    .catch( e => unClaimedProjId = ghUtils.errorHandler( "createUnClaimedProject", e, createUnClaimedProject, authData, ghLinks, pd ));
    }
    return unClaimedProjId;
}

async function createUnClaimedColumn( authData, ghLinks, pd, unClaimedProjId, issueId, accr )
{
    let unClaimedColId = -1;
    const unClaimed = config.UNCLAIMED;
    const colName = (typeof accr !== 'undefined') ? config.PROJ_COLS[config.PROJ_ACCR] : unClaimed;

    // Get locs again, to update after uncl. project creation 
    locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "projName": unClaimed } );
    assert( unClaimedProjId == locs[0].hostProjectId );

    const loc = locs.find( loc => loc.hostColumnName == colName );
    if( typeof loc !== 'undefined' ) { unClaimedColId = loc.hostColumnId; }
    if( unClaimedColId == -1 ) {
	console.log( authData.who, "Creating UnClaimed column:", colName );
	await authData.ic.projects.createColumn({ project_id: unClaimedProjId, name: colName })
	    .then(async (column) => {
		unClaimedColId = column.data.id;

		let nLoc = {};
		nLoc.ceProjectId     = pd.ceProjectId;
		nLoc.hostProjectId   = unClaimedProjId;
		nLoc.hostProjectName = unClaimed;
		nLoc.hostColumnId    = colName;
		nLoc.hostColumnName  = unClaimedColId;
		nLoc.active          = "true";
		
		await ghLinks.addLoc( authData, nLoc, true );
	    })
	    .catch( e => unClaimedColId = ghUtils.errorHandler( "createUnClaimedColumn", e, createUnClaimedColumn, authData, ghLinks, pd, unClaimedProjId, issueId, accr ));
    }
    return unClaimedColId;
}


// Note. alignment risk
// Don't care about state:open/closed.  unclaimed need not be visible.
async function createUnClaimedCard( authData, ghLinks, pd, issueId, accr )
{
    let unClaimedProjId = await createUnClaimedProject( authData, ghLinks, pd );
    let unClaimedColId  = await createUnClaimedColumn( authData, ghLinks, pd, unClaimedProjId, issueId, accr );
    
    assert( unClaimedProjId != -1 );
    assert( unClaimedColId != -1  );

    // create card in unclaimed:unclaimed
    let card = await createProjectCard( authData, unClaimedColId, issueId, false );
    return card;
}

// NOTE: ONLY call during new situated card.  This is the only means to move accr out of unclaimed safely.
// NOTE: issues can be closed while in unclaimed, before moving to intended project.
// Unclaimed cards are peq issues by definition (only added when labeling uncarded issue).  So, linkage table will be complete.
async function cleanUnclaimed( authData, ghLinks, pd ) {
    console.log( authData.who, "cleanUnclaimed", pd.issueId );
    let link = ghLinks.getUniqueLink( authData, pd.ceProjectId, pd.issueId );
    if( link == -1 ) { return; }

    // e.g. add allocation card to proj: add card -> add issue -> rebuild card    
    if( link.hostProjectName != config.UNCLAIMED && link.hostColumnName != config.PROJ_ACCR ) { return; }   
	
    assert( link.hostCardId != -1 );

    console.log( "Found unclaimed" );
    
    // Must wait.  success creates dependence.
    let success = false;

    // XXX Fugly
    if( utils.TEST_EH && Math.random() < utils.TEST_EH_PCT ) {
	await utils.failHere( "cleanUnclaimed" )
	    .catch( e => ghUtils.errorHandler( "cleanUnclaimed", utils.FAKE_ISE, cleanUnclaimed, authData, ghLinks, pd ));
    }
    else {
	await authData.ic.projects.deleteCard( { card_id: link.hostCardId } )
	    .then( r => success = true )
	    .catch( e => ghUtils.errorHandler( "cleanUnclaimed", e, cleanUnclaimed, authData, ghLinks, pd ));
    }

    // Remove turds, report.  
    if( success ) { ghLinks.removeLinkage({ "authData": authData, "ceProjID": pd.ceProjectId, "issueId": pd.issueId, "cardId": link.hostCardId }); }
    else { console.log( "WARNING.  cleanUnclaimed failed to remove linkage." ); }

    // No PAct or peq update here.  cardHandler rebuilds peq next via processNewPeq.
}

// Pos options are first, last, after x
async function createColumn( authData, projId, colName, pos ) {
    let rv = -1;

    // XXX Fugly
    if( utils.TEST_EH && Math.random() < utils.TEST_EH_PCT ) {
	await utils.failHere( "createColumn" )
    	    .catch( e => rv = ghUtils.errorHandler( "createColumn", utils.FAKE_ISE, createColumn, authData, projId, colName ));
    }
    else {
	rv = await authData.ic.projects.createColumn({ project_id: projId, name: colName })
	    .catch( e => rv = ghUtils.errorHandler( "createColumn", e, createColumn, authData, projId, colName ));

	// don't wait
	authData.ic.projects.moveColumn({ column_id: rv.data.id.toString(), position: pos })
	    .catch( e => console.log( "Error.  Move column failed.", e ));
    }
    return rv;
}

//                                   [ projId, colId:PLAN,     colId:PROG,     colId:PEND,      colId:ACCR ]
// If this is a flat project, return [ projId, colId:current,  colId:current,  colId:NEW-PEND,  colId:NEW-ACCR ]
// Note. alignment risk
async function getCEProjectLayout( authData, ghLinks, pd )
{
    // if not validLayout, won't worry about auto-card move
    // XXX will need workerthreads to carry this out efficiently, getting AWS data and GH simultaneously.
    // Note.  On rebuild, watch for potential hole in create card from isssue
    let issueId = pd.issueId;
    let link = ghLinks.getUniqueLink( authData, pd.ceProjectId, issueId );

    // moves are only tracked for peq issues
    let projId = link == -1 ? link : parseInt( link['GHProjectId'] );
    let curCol = link == -1 ? link : parseInt( link['GHColumnId'] );        

    // PLAN and PROG are used as a home in which to reopen issue back to.
    // If this is not a pure full project, try to reopen the issue back to where it started.
    if( link != -1 && link.hostColumnName == config.PROJ_COLS[ config.PROJ_PEND ] ) {
	curCol = parseInt( link.flatSource );
    }

    console.log( authData.who, "Found project id: ", projId );
    let foundReqCol = [projId, -1, -1, -1, -1];
    if( projId == -1 ) { return foundReqCol; }
    const locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "projId": projId } );
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
		progCol = createColumn( authData, projId, progName, "first" );
	    }
	}

	// Create PEND if missing
	if( foundReqCol[config.PROJ_PEND + 1] == -1 ) {
	    console.log( "Creating new column:", pendName );
	    // Wait later
	    pendCol = createColumn( authData, projId, pendName, "last" );
	}
	// Create ACCR if missing
	if( foundReqCol[config.PROJ_ACCR + 1] == -1 ) {
	    console.log( "Creating new column:", accrName );
	    // Wait later
	    accrCol = createColumn( authData, projId, accrName, "last" );
	}


	let nLoc = {};
	nLoc.ceProjectId     = pd.ceProjectId;
	nLoc.hostProjectId   = projId; 
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
    console.log( "Layout:", foundReqCol );
    return foundReqCol;
}

    
// issueId?  then verify "plan".  no issueId?  then verify "allocation".  No legal move of accrue.
async function validatePEQ( authData, repo, issueId, title, projId ) {
    let peq = -1;

    let peqType = "";
    assert( issueId != -1 );
    peq = await utils.getPeq( authData, issueId );

    if( peq != -1 && peq.issueName == title && peq.HostRepo == repo && peq.HostProjectId == projId )  {
	// console.log( authData.who, "validatePeq success" );
    }
    else {
	console.log( "WARNING.  Peq not valid.", peq.HostIssueTitle, title, peq.HostRepo, repo, peq.HostProjectId, projId );
    }
    return peq;
}

async function findCardInColumn( authData, ghLinks, ceProj, owner, repo, issueId, colId ) {

    let cardId = -1;
    let link = ghLinks.getUniqueLink( authData, ceProj, issueId );
	
    if( link != -1 && parseInt( link['GHColumnId'] ) == colId ) { cardId = parseInt( link['GHCardId'] ); }

    console.log( authData.who, "find card in col", issueId, colId, "found?", cardId );
    return cardId;
}

async function moveCard( authData, cardId, colId ) {
    colId = parseInt( colId );
    return await authData.ic.projects.moveCard({ card_id: cardId, position: "top", column_id: colId })
	.catch( e => ghUtils.errorHandler( "moveCard", e, moveCard, authData, cardId, colId ));
}

// GitHub add assignee can take a second or two to complete, internally.
// If this fails, retry a small number of times before returning false.
async function checkReserveSafe( authData, owner, repo, issueNum, colNameIndex ) {
    let retVal = true;
    if( colNameIndex > config.PROJ_PROG ) { 
	let assignees = await getAssignees( authData, owner, repo, issueNum );
	let retries = 0;
	while( assignees.length == 0 && retries < config.MAX_GH_RETRIES ) {
	    retries++;
	    console.log( "XXX WARNING.  No assignees found.  Retrying.", retries, Date.now() );
	    assignees = await getAssignees( authData, owner, repo, issueNum );	    
	}
	
	if( assignees.length == 0  ) {
	    console.log( "WARNING.  Update card failed - no assignees" );   // can't propose grant without a grantee
	    retVal = false;
	}
    }
    return retVal;
}

// Note. alignment risk if card moves in the middle of this
async function moveIssueCard( authData, ghLinks, pd, action, ceProjectLayout )
{
    console.log( "Moving issue card", pd.issueId, pd.GHIssueNum );
    let success    = false;
    let newColId   = -1;
    let newColName = "";
    assert.notEqual( ceProjectLayout[0], -1 );
    let cardId = -1;
    // let oldColId = -1;
    let pip = [ config.PROJ_PLAN, config.PROJ_PROG ];  
    let pac = [ config.PROJ_PEND, config.PROJ_ACCR ];  
    
    if( action == "closed" ) {

	const link = ghLinks.getUniqueLink( authData, pd.ceProjectId, pd.issueId );
	cardId = link.hostCardId;

	// Out of order notification is possible.  If already accrued, stop.
	// There is no symmetric issue - once accr, can't repoen.  if only pend, no subsequent move after reopen.
	if( link.hostColumnId == ceProjectLayout[ config.PROJ_ACCR + 1 ].toString() ) {
	    let issue = await getFullIssue( authData, pd.GHOwner, pd.GHRepo, pd.GHIssueNum );
	    if( issue.state == 'closed' ) {
		return false;
	    }
	}
	
	// move card to "Pending PEQ Approval"
	if( cardId != -1 ) {
	    console.log( "Issuing move card" );
	    newColId   = ceProjectLayout[ config.PROJ_PEND + 1 ];   // +1 is for leading projId
	    newColName = config.PROJ_COLS[ config.PROJ_PEND ];
	    
	    success = await checkReserveSafe( authData, pd.GHOwner, pd.GHRepo, pd.GHIssueNum, config.PROJ_PEND );
	    if( !success ) {
		// no need to put card back - didn't move it.  Don't wait.
		updateIssue( authData, pd.GHOwner, pd.GHRepo, pd.GHIssueNum, "open" ); // reopen issue
		return false;
	    }

	    success = await moveCard( authData, cardId, newColId );
	}
    }
    else if( action == "reopened" ) {
	
	// This is a PEQ issue.  Verify card is currently in the right place, i.e. PEND ONLY (can't move out of ACCR)
	cardId = await findCardInColumn( authData, ghLinks, pd.ceProjectId, pd.GHOwner, pd.GHRepo, pd.issueId, ceProjectLayout[ config.PROJ_PEND+1 ] );

	// move card to "In Progress".  planned is possible if issue originally closed with something like 'wont fix' or invalid.
	if( cardId != -1 ) {
	    console.log( "Issuing move card" );
	    newColId   = ceProjectLayout[ config.PROJ_PROG + 1 ];
	    newColName = getColumnName( authData, ghLinks, pd.ceProjectId, pd.repoName, newColId );
	    success = await moveCard( authData, cardId, newColId );
	}
	else {
	    // GH has opened this issue.  Close it back up.
	    console.log( "WARNING.  Can not reopen an issue that has accrued." );
	    // Don't wait.
	    updateIssue( authData, pd.GHOwner, pd.GHRepo, pd.GHIssueNum, "closed" ); // re-close issue
	    return false;
	}
    }

    // Note. updateLinkage should not occur unless successful.  Everywhere.  
    //     Should not need to wait, for example, for moveCard above.  Instead, be able to roll back if it fails.   Rollback.
    if( success ) { success = ghLinks.updateLinkage( authData, pd.ceProjectId, pd.issueId, cardId, newColId, newColName ); }
    
    return success ? newColId : false;
}

// Note. alignment risk
function getProjectName( authData, ghLinks, ceProjId, fullName, projId ) {

    if( projId == -1 ) { return -1; }

    const locs = ghLinks.getLocs( authData, { "ceProjId": ceProjId, "repo": fullName, "projId": projId } );

    const projName = locs == -1 ? locs : locs[0].hostProjectName;
    return projName
    
}

// Note.  alignment risk
function getColumnName( authData, ghLinks, ceProjId, fullName, colId ) {

    if( colId == -1 ) { return -1; }

    const locs = ghLinks.getLocs( authData, { "ceProjId": ceProjId, "repo": fullName, "colId": colId } );
    assert( locs == -1 || locs.length == 1 );

    const colName = locs == -1 ? locs : locs[0].hostColumnName;
    return colName;

}

// Allow:
//  <allocation, PEQ: 1000>
//  <allocation, PEQ: 1,000>
//  <PEQ: 1000>
//  <PEQ: 1,000>
function parsePEQ( content, allocation ) {
    let peqValue = 0;
    // content must be at least 2 lines, i.e. obj, else will be 1 char at a time
    assert( typeof content != "string" );
    for( const line of content ) {
	let s = -1;
	let c = -1;
	if( allocation ) {
	    s = line.indexOf( config.PALLOC );
	    if( s > -1 ) {
		s = line.indexOf( config.PEQ );   // both conds true for one line only in content
		c = config.PEQ.length;
	    }
	}
	else {
	    s = line.indexOf( config.PPLAN );
	    c = config.PPLAN.length;
	}

	if( s > -1 ){
	    let lineVal = line.substring( s );
	    // console.log( "Looking for peq in", s, c, lineVal );
	    let e = lineVal.indexOf( ">" );
	    if( e == -1 ) {
		console.log( "Malformed peq" );
		break;
	    }
	    // console.log( "Found peq val in ", s, e, lineVal.substring(c, e) );
	    // js parseint doesn't like commmas
	    peqValue = parseInt( lineVal.substring( c, e ).split(",").join("") );
	    break;
	}
    }
    return peqValue;
}

export {githubUtils};
export {githubSafe};



