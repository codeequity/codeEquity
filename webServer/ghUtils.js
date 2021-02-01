/*
https://docs.github.com/en/free-pro-team@latest/graphql/reference/objects#repository
https://octokit.github.io/rest.js
https://developer.github.com/webhooks/event-payloads/#issues
https://developer.github.com/v3/issues/#create-an-issue
*/

var assert = require('assert');

const auth = require( "./auth");
var config  = require('./config');
var utils = require('./utils');


var githubSafe = {
    getAllocated: function( cardContent ) {
	return getAllocated( cardContent );
    },

    parsePEQ: function( cardContent, allocation ) {
	return parsePEQ( cardContent, allocation );
    },

    parseLabelDescr: function( labelDescr ) {
	return parseLabelDescr( labelDescr );
    },
	
    theOnePEQ: function( labels ) {
	return theOnePEQ( labels );
    },

    validatePEQ: function( authData, repo, issueId, title, projId ) {
	return validatePEQ( authData, repo, issueId, title, projId );
    },

    createIssue: function( authData, owner, repo, title, labels, allocation ) {
	return createIssue( authData, owner, repo, title, labels, allocation );
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

    addComment: function( authData, owner, repo, issueNum, msg ) {
	return addComment( authData, owner, repo, issueNum, msg );
    },

    rebuildLabel: function( authData, owner, repo, issueNum, oldLabel, newLabel ) {
	return rebuildLabel( authData, owner, repo, issueNum, oldLabel, newLabel );
    },

    splitIssue: function( authData, owner, repo, issue, splitTag ) {
	return splitIssue( authData, owner, repo, issue, splitTag );
    },

    rebuildIssue: function( authData, owner, repo, issue, msg ) {
	return rebuildIssue( authData, owner, repo, issue, msg );
    },

    cleanUnclaimed: function( authData, ghLinks, pd ) {
	return cleanUnclaimed( authData, ghLinks, pd );
    },
    
    updateIssue: function( authData, owner, repo, issueNum, newState ) {
	return updateIssue( authData, owner, repo, issueNum, newState );
    },
    
}


var githubUtils = {

    checkRateLimit: function( authData ) {
	return checkRateLimit( authData );
    },

    checkIssueExists: function( authData, owner, repo, title ) {
	return checkIssueExists( authData, owner, repo, title );
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

    getColumns: function( authData, ghLinks, projId ) {
	return getColumns( authData, ghLinks, projId );
    },

    getFullIssue: function( authData, owner, repo, issueNum ) {
	return getFullIssue( authData, owner, repo, issueNum );
    },

    updateLabel: function( authData, owner, repo, name, newName, desc ) {
	return updateLabel( authData, owner, repo, name, newName, desc );
    }

    createLabel: function( authData, owner, repo, name, color, desc ) {
	return createLabel( authData, owner, repo, name, color, desc );
    }

    createPeqLabel: function( authData, owner, repo, allocation, peqValue ) {
	return createPeqLabel( authData, owner, repo, allocation, peqValue );
    }

    findOrCreateLabel: function( authData, owner, repo, allocation, peqHumanLabelName, peqValue ) {
	return findOrCreateLabel( authData, owner, repo, allocation, peqHumanLabelName, peqValue );
    },

    removeCard: function( authData, cardId ) {
	return removeCard( authData, cardId );
    },
	
    rebuildCard: function( authData, owner, repo, colId, origCardId, issueData ) {
	return rebuildCard( authData, owner, repo, colId, origCardId, issueData );
    },

    createUnClaimedCard: function( authData, ghLinks, pd, issueId, accr ) {
	return createUnClaimedCard( authData, ghLinks, pd, issueId, accr );
    },

    getBasicLinkDataGQL: function( PAT, owner, repo, data, cursor ) {
	return getBasicLinkDataGQL( PAT, owner, repo, data, cursor );
    },

    getRepoColsGQL: function( PAT, owner, repo, data, cursor ) {
	return getRepoColsGQL( PAT, owner, repo, data, cursor );
    },

    populateCELinkage: function( authData, ghLinks, pd ) {
	return populateCELinkage( authData, ghLinks, pd );
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
    
    moveIssueCard: function( authData, ghLinks, owner, repo, issueId, action, ceProjectLayout ) {
	return moveIssueCard( authData, ghLinks, owner, repo, issueId, action, ceProjectLayout ); 
    },

    getProjectName: function( authData, ghLinks, projId ) {
	return getProjectName( authData, ghLinks, projId ); 
    },

    getColumnName: function( authData, ghLinks, colId ) {
	return getColumnName( authData, ghLinks, colId ); 
    },

};


async function checkRateLimit( authData ) {

    // console.log( "Rate limit check currently off" );
    return;
    
    await( authData.ic.rateLimit.get())
	.then( rl => {
	    console.log( "Core:", rl['data']['resources']['core']['limit'], rl['data']['resources']['core']['remaining'] );
	    console.log( "Search:", rl['data']['resources']['search']['limit'], rl['data']['resources']['search']['remaining'] );
	    console.log( "Graphql:", rl['data']['resources']['graphql']['limit'], rl['data']['resources']['graphql']['remaining'] );
	    console.log( "Integration:", rl['data']['resources']['integration_manifest']['limit'], rl['data']['resources']['integration_manifest']['remaining'] );
	})
	.catch( e => { console.log( authData.who, "Problem in check Rate Limit", e );   });
}

// XXX paginate
async function checkIssueExists( authData, owner, repo, title )
{
    let retVal = false;

    // Issue with same title may already exist, in which case, check for label, then point to that issue.
    await( authData.ic.issues.listForRepo( { owner: owner, repo: repo }))
	.then( issues => {
	    for( issue of issues['data'] ) {
		if( issue['title'] == title ) {
		    retVal = true;
		    break;
		}
	    }
	})
	.catch( e => {
	    console.log( authData.who, "Problem in checkIssueExists", e );
	});
    return retVal;
}

// Note.. unassigned is normal for plan, abnormal for inProgress, not allowed for accrued.
// there are no assignees for card-created issues.. they are added, or created directly from issues.
// XXX alignment risk - card info could have moved on
async function getAssignees( authData, owner, repo, issueNum )
{
    let retVal = [];
    if( issueNum == -1 ) { console.log( "getAssignees: bad issue number", issueNum ); return retVal; }

    // console.log( authData.who, "Getting assignees for", owner, repo, issueNum );
    await( authData.ic.issues.get( { owner: owner, repo: repo, issue_number: issueNum }))
	.then( issue => {
	    // console.log( issue['data'] );
	    if( issue['data']['assignees'].length > 0 ) { 
		for( assignee of issue['data']['assignees'] ) {
		    retVal.push( assignee['login'] );
		}
	    }
	})
	.catch( e => console.log( authData.who, "Problem in getAssignees", e ));
    return retVal;
}

async function checkIssue( authData, owner, repo, issueNum ) {
    let issueExists = false;
    await( authData.ic.issues.get( { owner: owner, repo: repo, issue_number: issueNum }))
	.then( issue => issueExists = true )
	.catch( e => {
	    if( e.status == 410 ) { console.log( authData.who, "Issue", issueNum, "already gone" ); }
	    else                  { console.log( authData.who, "Problem in checkIssue", e );        }
	});
    
    return issueExists;
}

// [id, content]
// XXX alignment risk - card info could have moved on
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

// XXX alignment risk - card info could have moved on
async function getFullIssue( authData, owner, repo, issueNum )
{
    if( issueNum == -1 ) { return -1; }
    let retIssue = "";

    await( authData.ic.issues.get( { owner: owner, repo: repo, issue_number: issueNum }))
	.then( issue => { retIssue = issue['data']; })
	.catch( e => { console.log( authData.who, "Problem in getIssueContent", e ); });
    
    return retIssue;
}

// XXX alignment risk - card info could have moved on
async function getCard( authData, cardId ) {
    let retCard = -1;
    if( cardId == -1 ) { return retCard; }
    
    await( authData.ic.projects.getCard( { card_id: cardId } ))
	.then((card) => {  retCard = card.data; } )
	.catch( e => { console.log( authData.who, "Get card failed.", e ); });
    return retCard;
}

function getColumns( authData, ghLinks, projId ) {
    let cols = "";

    let locs = ghLinks.getLocs( authData, { "repo": pd.GHFullName, "projId": projId } );
    cols = locs.map( loc => loc.GHColumnId );
    
    return cols;
}


async function splitIssue( authData, owner, repo, issue, splitTag ) {
    console.log( "Split issue" );
    let issueData = [-1,-1];  // issue id, num
    let title = issue.title + " split: " + splitTag;
    
    await( authData.ic.issues.create( {
	owner:     owner,
	repo:      repo,
	title:     title,
	body:      issue.body,
	milestone: issue.milestone,
	labels:    issue.labels,
	assignees: issue.assignees.map( person => person.login )
    } ))
	.then( issue => {
	    issueData[0] = issue['data']['id'];
	    issueData[1] = issue['data']['number'];
	})
	.catch( e => {
	    console.log( authData.who, "Create issue failed.", e );
	});

    let comment = "CodeEquity duplicated this new issue from issue id:" + issue.id.toString() + " on " + utils.getToday().toString();
    comment += " in order to maintain a 1:1 mapping between issues and cards."

    await addComment( authData, owner, repo, issueData[1], comment );
    return issueData;
}

async function rebuildIssue( authData, owner, repo, issue, msg ) {
    console.log( authData.who, "Rebuilding issue" );
    let issueData = [-1,-1];  // issue id, num

    await authData.ic.issues.create( {
	owner:     owner,
	repo:      repo,
	title:     issue.title,
	body:      issue.body,
	milestone: issue.milestone,
	labels:    issue.labels,
	assignees: issue.assignees.map( person => person.login )
    })
	.then( issue => {
	    issueData[0] = issue['data']['id'];
	    issueData[1] = issue['data']['number'];
	})
	.catch( e => console.log( authData.who, "Error.  Create issue failed.", e ));

    let comment = utils.getToday().toString() + ": " + msg;
    
    await( authData.ic.issues.createComment( { owner: owner, repo: repo, issue_number: issueData[1], body: comment } ))
	.catch( e =>  console.log( authData.who, "Error.  Create issue comment failed.", e ));
    
    return issueData;
}

async function updateIssue( authData, owner, repo, issueNum, newState ) {
    let retVal = false;
    if( issueNum == -1 ) { return retVal; }

    await( authData.ic.issues.update( { owner: owner, repo: repo, issue_number: issueNum, state: newState }))
	.then( update => {
	    console.log( authData.who, "updateIssue done" );
	    retVal = true;
	})
	.catch( e => {
	    console.log( authData.who, "Problem in updateIssue", e );
	});
    return retVal;
}

async function updateLabel( authData, owner, repo, name, newName, desc ) {
    await( authData.ic.issues.updateLabel( { owner: owner, repo: repo, name: name, new_name: newName, description: descr }))
	.catch( e => console.log( authData.who, "Update label failed.", e ));
}

async function createLabel( authData, owner, repo, name, color, desc );
    let label = {};
    await( authData.ic.issues.createLabel( { owner: owner, repo: repo, name: name, color: color, description: descr }))
	.then( l => label = l['data'] )
	.catch( e => { console.log( authData.who, "Create label failed.", e ); });
    return label;
}

async function createPeqLabel( authData, owner, repo, allocation, peqValue ) {
    let peqHumanLabelName = peqValue.toString() + ( allocation ? " AllocPEQ" : " PEQ" );  // XXX config
    let descr = ( allocation ? config.ADESC : config.PDESC ) + peqValue.toString();
    let pcolor = allocation ? config.APEQ_COLOR : config.PEQ_COLOR;
    let label = await createLabel( authData, owner, repo, name, color, desc );
    return label;
}


// XXX (very) low risk for alignment trouble. warn if see same label create/delete on job queue.
async function findOrCreateLabel( authData, owner, repo, allocation, peqHumanLabelName, peqValue )
{
    // does label exist 
    let peqLabel = "";
    let status = 200;
    await( authData.ic.issues.getLabel( { owner: owner, repo: repo, name: peqHumanLabelName }))
	.then( label => {
	    peqLabel = label['data'];
	})
	.catch( e => {
	    status = e['status'];
	    if( status != 404 ) {
		console.log( authData.who, "Get label failed.", e );
	    }
	});
    
    // if not, create
    if( status == 404 ) {
	console.log( authData.who, "Label not found, creating.." );

	if( peqHumanLabelName == config.POPULATE ) {
	await( authData.ic.issues.createLabel( { owner: owner, repo: repo, name: peqHumanLabelName, color: '111111', description: "populate" }))
	    .then( label => { peqLabel = label['data']; })
	    .catch( e => { console.log( authData.who, "Create label failed.", e );  });
	}
	else { peqLabel = createPeqLabel( authData, owner, repo, allocation, peqValue ); }
    }

    assert.notStrictEqual( peqLabel, undefined, "Did not manage to find or create the PEQ label" );
    return peqLabel;
}


// New information being pushed into GH - alignment safe.
async function createIssue( authData, owner, repo, title, labels, allocation )
{
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
    await( authData.ic.issues.create( { owner: owner, repo: repo, title: title, labels: labels, body: body } ))
	.then( issue => {
	    issueData[0] = issue['data']['id'];
	    issueData[1] = issue['data']['number'];
	})
	.catch( e => {
	    console.log( authData.who, "Create issue failed.", e );
	});
    
    return issueData;
}


function populateRequest( labels ) {
    let retVal = false;

    for( label of labels ) {
	if( label.name == config.POPULATE ) {
	    retVal = true;
	    break;
	}
    }

    return retVal;
}

// GraphQL to init link table
// XXX getting open only is probably a mistake.  what if added back?  does this get all?
async function getBasicLinkDataGQL( PAT, owner, repo, data, cursor ) {

    // XXX move these
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

    let res = await utils.postGH( PAT, config.GQL_ENDPOINT, query )
	.catch( e => console.log( "Error. GQL links issue", e ));

    const issues = res.data.repository.issues;
    for( let i = 0; i < issues.edges.length; i++ ) {
	const issue  = issues.edges[i].node;
	const cards  = issue.projectCards;
	const labels = issue.labels;

	// XXX Over 100 cards or 100 labels for 1 issue?  Don't use CE.  Warn here.
	assert( !cards.pageInfo.hasNextPage && !labels.hasNextPage );

	for( const card of cards.edges ) {
	    // console.log( card.node.project.name, issue.title );
	    if( !card.node.column ) {
		console.log( "Warning. Skipping issue:card for", issue.title, "which is awaiting triage." );
		continue;
	    }
	    console.log( card.node.project.name, ",", card.node.column.databaseId );
	    let datum = {};
	    datum.issueId     = issue.databaseId;
	    datum.issueNum    = issue.number;
	    datum.title       = issue.title;
	    datum.cardId      = card.node.databaseId;
	    datum.projectName = card.node.project.name;
	    datum.projectId   = card.node.project.databaseId;
	    datum.columnName  = card.node.column.name;
	    datum.columnId    = card.node.column.databaseId;
	    data.push( datum );
	}
    }

    if( issues.pageInfo.hasNextPage ) { await getBasicLinkDataGQL( PAT, owner, repo, data, issues.pageInfo.endCursor ); }
}


// GraphQL to get all columns in repo 
async function getRepoColsGQL( PAT, owner, repo, data, cursor ) {

    // XXX move these
    const query1 = `
    query baseConnection($owner: String!, $repo: String!) 
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
    query nthConnection($owner: String!, $repo: String!, $cursor: String!) 
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

    let res = await utils.postGH( PAT, config.GQL_ENDPOINT, query )
	.catch( e => console.log( "Error.  GQL cols issue", e ));

    const projects = res.data.repository.projects;
    for( let i = 0; i < projects.edges.length; i++ ) {
	const project = projects.edges[i].node;
	const cols    = project.columns;

	// XXX Over 100 cols for 1 project?  Warn here.
	assert( !cols.pageInfo.hasNextPage );

	for( const col of cols.edges ) {
	    // console.log( project.name, project.number, project.databaseId, col.node.name, col.node.databaseId );
	    let datum = {};
	    datum.GHProjectName = project.name;
	    datum.GHProjectId   = project.databaseId.toString();
	    datum.GHColumnName  = col.node.name;
	    datum.GHColumnId    = col.node.databaseId.toString();
	    data.push( datum );
	}

	// Add project even if it has no cols
	if( cols.edges.length == 0 ) {
	    let datum = {};
	    datum.GHProjectName = project.name;
	    datum.GHProjectId   = project.databaseId.toString();
	    datum.GHColumnName  = config.EMPTY;
	    datum.GHColumnId    = "-1";
	    data.push( datum );
	}
    }

    
    if( projects.pageInfo.hasNextPage ) { await getRepoColsGQL( PAT, owner, repo, data, projects.pageInfo.endCursor ); }
}



// Add linkage data for all carded issues in a project.
// 
// As soon as 1 situated (or carded) issue is labeled, all this work must be done to find it if not already in dynamo.
// May as well just do this once.
//
// This occurs once only per repo, preferably when CE usage starts.
// Afterwards, if a newborn issue adds a card, githubCardHandler will pick it up.
// Afterwards, if a newborn issue adds peqlabel, create card, githubCardHandler will pick it up.
// Afterwards, if a newborn card converts to issue, pick it up in githubIssueHandler
//
// Would be soooo much better if Octokit/Github had reverse link from issue to card.
// newborn issues not populated.  newborn cards not populated.  Just linkages.
// XXX something like this really needs graphQL
async function populateCELinkage( authData, ghLinks, pd )
{
    console.log( authData.who, "Populate CE Linkage start" );
    assert( !utils.checkPopulated( authData, pd.GHFullName ) != -1);

    // XXX this does more work than is needed - checks for peqs which only exist during testing.
    let linkage = await ghLinks.initOneRepo( authData, pd.GHFullName );

    // At this point, we have happily added 1:m issue:card relations to linkage table (no other table)
    // Resolve here to split those up.  Normally, would then worry about first time users being confused about
    // why the new peq label applied to their 1:m issue, only 'worked' for one card.
    // But, populate will be run from ceFlutter, separately from actual label notification.
    pd.peqType    = "end";
    
    // Only resolve once per issue.
    let showOnce  = [];
    let showTwice = [];
    let one2Many = [];
    for( const link of linkage ) {
	if( !showOnce.includes( link[3] ))       { showOnce.push( link[3] ); }
	else if( !showTwice.includes( link[3] )) {
	    showTwice.push( link[3] );
	    one2Many.push( link );
	}
    }
    
    console.log( "Remaining links to resolve", one2Many );
    
    // [ [projId, cardId, issueNum, issueId], ... ]
    // Note - this can't be a promise.all - parallel execution with shared pd == big mess
    //        serial... SLOOOOOOOOOOW   will revisit entire populate with graphql.
    // Note - this mods values of pd, but exits immediately afterwards.
    for( const link of one2Many ) {
	pd.GHIssueId  = link[3];
	pd.GHIssueNum = link[2];
	await utils.resolve( authData, ghLinks, pd, "???" );
    }
    
    await utils.setPopulated( authData, pd.GHFullName );
    console.log( authData.who, "Populate CE Linkage Done" );
    return true;
}


async function removeCard( authData, cardId ) {
    await authData.ic.projects.deleteCard( { card_id: cardId } )
	.catch( e => console.log( authData.who, "Remove card failed.", e ));
}

// XXX alignment risk - card info could have moved on
async function rebuildCard( authData, owner, repo, colId, origCardId, issueData ) {
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
	.catch( e => console.log( authData.who, "Error.  Update title failed.", e ));
}

async function removeLabel( authData, owner, repo, issueNum, label ) {
    await authData.ic.issues.removeLabel({ owner: owner, repo: repo, issue_number: issueNum, name: label.name  } )
	.catch( e => { console.log( authData.who, "Remove label from issue failed.", e ); });
}

// XXX Note this can fail without being an error if issue is already gone.  'Note' instead of 'Error'
async function removePeqLabel( authData, owner, repo, issueNum ) {
    let labels = await authData.ic.issues.listLabelsOnIssue({ owner: owner, repo: repo, issue_number: issueNum, per_page: 100  } )
	.catch( e => console.log( authData.who, "Get labels for issue failed.", e ));

    if( typeof labels === 'undefined' ) { return; }
    if( labels.length > 99 ) { console.log( "Error.  Too many labels for issue", issueNum ); } // XXX paginate? grump grump }

    let peqLabel = {};
    for( const label of labels.data ) {
	const tval = parseLabelDescr( [label.description] );
	if( tval > 0 ) { peqLabel = label; break; }
    }
    await removeLabel( authData, owner, repo, issueNum, peqLabel );
}

async function addLabel( authData, owner, repo, issueNum, label ) {
    await authData.ic.issues.addLabels({ owner: owner, repo: repo, issue_number: issueNum, labels: [label.name] })
	.catch( e => { console.log( authData.who, "Add label failed.", e ); });
}

async function addComment( authData, owner, repo, issueNum, msg ) {
    await( authData.ic.issues.createComment( { owner: owner, repo: repo, issue_number: issueNum, body: msg } ))
	.catch( e => console.log( authData.who, "Create issue comment failed.", e ));
}

async function rebuildLabel( authData, owner, repo, issueNum, oldLabel, newLabel ) {
    await removeLabel( authData, owner, repo, issueNum, oldLabel );
    await addLabel( authData, owner, repo, issueNum, newLabel );
}


async function createProjectCard( authData, columnId, issueId, justId )
{
    let newCard = -1;

    await( authData.ic.projects.createCard({ column_id: columnId, content_id: issueId, content_type: 'Issue' }))
	.then( card => { newCard = card['data']; })
	.catch( e => { console.log( authData.who, "Create issue-linked project card failed.", e ); });

    if( justId ) { return newCard['id']; }
    else         { return newCard; }
}


// XXX alignment risk
// Don't care about state:open/closed.  unclaimed need not be visible.
async function createUnClaimedCard( authData, ghLinks, pd, issueId, accr )
{
    const makeAccrued = (typeof accr === 'undefined') ? false : true;
    const unClaimed = config.UNCLAIMED;

    let unClaimedProjId = -1;
    let locs = ghLinks.getLocs( authData, { "projName": unClaimed } );
    unClaimedProjId = locs == -1 ? locs : locs[0].GHProjectId;
    if( unClaimedProjId == -1 ) {
	console.log( "Creating UnClaimed project" );
	let body = "Temporary storage for issues with cards that have not yet been assigned to a column (triage)";
	await authData.ic.projects.createForRepo({ owner: pd.GHOwner, repo: pd.GHRepo, name: unClaimed, body: body })
	    .then((project) => {
		unClaimedProjId = project.data.id;
		ghLinks.addLoc( authData, pd.GHFullName, unClaimed, unClaimedProjId, config.EMPTY, -1 );		
	    })
	    .catch( e => { console.log( authData.who, "Create unclaimed project failed.", e ); });
    }

    let unClaimedColId = -1;
    const colName = makeAccrued ? config.PROJ_COLS[config.PROJ_ACCR] : unClaimed;
    // Get locs again, to update after creation above
    locs = ghLinks.getLocs( authData, { "projName": unClaimed } );
    assert( unClaimedProjId == locs[0].GHProjectId );

    const loc = locs.find( loc => loc.GHColumnName == colName );
    if( typeof loc !== 'undefined' ) { unClaimedColId = loc.GHColumnId; }
    if( unClaimedColId == -1 ) {
	console.log( authData.who, "Creating UnClaimed column" );
	await authData.ic.projects.createColumn({ project_id: unClaimedProjId, name: colName })
	    .then((column) => {
		unClaimedColId = column.data.id;
		ghLinks.addLoc( authData, pd.GHFullName, unClaimed, unClaimedProjId, colName, unClaimedColId );		
	    })
	    .catch( e => { console.log( authData.who, "Create unclaimed column failed.", e ); });
    }
    
    assert( unClaimedProjId != -1 );
    assert( unClaimedColId != -1  );

    // create card in unclaimed:unclaimed
    let card = await createProjectCard( authData, unClaimedColId, issueId, false );
    return card;
}

// NOTE: ONLY call during new situated card.  This is the only means to move accr out of unclaimed safely.
// Unclaimed cards are peq issues by definition (only added when labeling uncarded issue).  So, linkage table will be complete.
async function cleanUnclaimed( authData, ghLinks, pd ) {
    console.log( authData.who, "cleanUnclaimed", pd.GHIssueId );
    let link = ghLinks.getUniqueLink( authData, pd.GHIssueId );
    if( link == -1 ) { return; }
    let allowed = [ config.UNCLAIMED, config.PROJ_ACCR ];
    if( !allowed.includes( link.GHColumnName )) { return; }   // i.e. add allocation card to proj: add card -> add issue -> rebuild card
	
    assert( link.GHCardId != -1 );

    console.log( "Found unclaimed" );
    await authData.ic.projects.deleteCard( { card_id: link.GHCardId } )
	.catch( e => console.log( "Error.  Card not deleted", e ));
    
    // Remove turds, report.  
    ghLinks.removeLinkage({ "authData": authData, "issueId": pd.GHIssueId, "cardId": link.GHCardId });


    // No PAct or peq update here.  cardHandler rebuilds peq next via processNewPeq.
    /*
    let daPEQ = await utils.getPeq( authData, pd.GHIssueId );
    await utils.removePEQ( authData, daPEQ.PEQId );

    utils.recordPEQAction(
	authData,
	config.EMPTY,     // CE UID
	pd.GHCreator,     // gh user name
	pd.GHFullName,        
	"confirm",        // verb
	"delete",         // action
	[daPEQ.PEQId],    // subject
	"unclaimed",      // note
	utils.getToday(), // entryDate
	pd.reqBody        // raw
    );
    */
}


//                                   [ projId, colId:PLAN,     colId:PROG,     colId:PEND,      colId:ACCR ]
// If this is a flat project, return [ projId, colId:current,  colId:current,  colId:NEW-PEND,  colId:NEW-ACCR ]
// XXX alignment risk
async function getCEProjectLayout( authData, ghLinks, pd )
{
    // if not validLayout, won't worry about auto-card move
    // XXX will need workerthreads to carry this out efficiently, getting AWS data and GH simultaneously.
    // XXX Revisit if ever decided to track cols, projects.
    // XXX may be hole in create card from isssue
    let issueId = pd.GHIssueId;
    let link = ghLinks.getUniqueLink( authData, issueId );

    // moves are only tracked for peq issues
    let projId = link == -1 ? link : parseInt( link['GHProjectId'] );
    let curCol = link == -1 ? link : parseInt( link['GHColumnId'] );        

    // PLAN and PROG are used as a home in which to reopen issue back to.
    // If this is not a pure full project, try to reopen the issue back to where it started.
    if( link != -1 && link.GHColumnName == config.PROJ_COLS[ config.PROJ_PEND ] ) {
	curCol = parseInt( link.flatSource );
    }

    console.log( authData.who, "Found project id: ", projId );
    let foundReqCol = [projId, -1, -1, -1, -1];
    if( projId == -1 ) { return foundReqCol; }
    const locs = ghLinks.getLocs( authData, { "projId": projId } );
    assert( locs != -1 );
    assert( link.GHProjectName == locs[0].GHProjectName );

    let foundCount = 0;
    for( loc of locs ) {
	let colName = loc.GHColumnName;
	for( let i = 0; i < 4; i++ ) {
	    if( colName == config.PROJ_COLS[i] ) {
		if( foundReqCol[i+1] == -1 ) { foundCount++; }
		else {
		    console.log( "Validate CE Project Layout found column repeat: ", config.PROJ_COLS[i] );
		    assert( false );
		}
		foundReqCol[i+1] = loc.GHColumnId;
		break;
	    }
	}
	// no need to check every col when required are found
	if( foundCount == 4 ) { missing = false; break; }
    }

    
    // Make this project viable for PEQ tracking
    if( missing || curCol != -1 ) {

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
		const progName = config.PROJ_COLS[ config.PROJ_PROG]; 
		console.log( "Creating new column:", progName );
		await authData.ic.projects.createColumn({ project_id: projId, name: progName })
		    .then((column) => {
			curCol = column.data.id;
			ghLinks.addLoc( authData, pd.GHFullName, link.GHProjectName, projId, progName, curCol );			
		    })
		    .catch( e => { console.log( authData.who, "Create column failed.", e ); });
	    }
	}

	// Create PEND if missing
	if( foundReqCol[config.PROJ_PEND + 1] == -1 ) {
	    let pendName = config.PROJ_COLS[ config.PROJ_PEND ];
	    console.log( "Creating new column:", pendName );
	    await authData.ic.projects.createColumn({ project_id: projId, name: pendName })
		.then((column) => {
		    foundReqCol[config.PROJ_PEND + 1] = column.data.id;
		    ghLinks.addLoc( authData, pd.GHFullName, link.GHProjectName, projId, pendName, column.data.id );			
		    
		})
		.catch( e => { console.log( authData.who, "Create column failed.", e ); });
	}
	// Create ACCR if missing
	if( foundReqCol[config.PROJ_ACCR + 1] == -1 ) {
	    let accrName = config.PROJ_COLS[ config.PROJ_ACCR ];
	    console.log( "Creating new column:", accrName );
	    await authData.ic.projects.createColumn({ project_id: projId, name: accrName })
		.then((column) => {
		    foundReqCol[config.PROJ_ACCR + 1] = column.data.id;
		    ghLinks.addLoc( authData, pd.GHFullName, link.GHProjectName, projId, accrName, column.data.id );			
		})
		.catch( e => { console.log( authData.who, "Create column failed.", e ); });
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

    if( peq != -1 && peq.GHIssueTitle == title && peq.GHRepo == repo && peq.GHProjectId == projId )  {
	console.log( authData.who, "validatePeq success" );
    }
    else {
	console.log( "Error.  Peq not valid.", peq.GHIssueTitle, title, peq.GHRepo, repo, peq.GHProjectId, projId );
    }
    return peq;
}

async function findCardInColumn( authData, ghLinks, owner, repo, issueId, colId ) {

    let cardId = -1;
    let link = ghLinks.getUniqueLink( authData, issueId );
	
    if( link != -1 && parseInt( link['GHColumnId'] ) == colId ) { cardId = parseInt( link['GHCardId'] ); }

    console.log( authData.who, "find card in col", issueId, colId, "found?", cardId );
    return cardId;
}

async function moveCard( authData, cardId, colId ) {
    colId = parseInt( colId );
    return await( authData.ic.projects.moveCard({ card_id: cardId, position: "top", column_id: colId }))
	.catch( e => { console.log( authData.who, "Move card failed.", e );	});
}


async function checkReserveSafe( authData, owner, repo, issueNum, colNameIndex ) {
    let retVal = true;
    if( colNameIndex > config.PROJ_PROG ) { 
	let assignees = await getAssignees( authData, owner, repo, issueNum );
	if( assignees.length == 0  ) {
	    console.log( "WARNING.  Update card failed - no assignees" );   // can't propose grant without a grantee
	    retVal = false;
	}
    }
    return retVal;
}

// XXX alignment risk if card moves in the middle of this
async function moveIssueCard( authData, ghLinks, owner, repo, issueData, action, ceProjectLayout )
{
    console.log( "Moving issue card", issueData );
    let success    = false;
    let newColId   = -1;
    let newColName = "";
    assert.notEqual( ceProjectLayout[0], -1 );
    let cardId = -1;
    // let oldColId = -1;
    let pip = [ config.PROJ_PLAN, config.PROJ_PROG ];  
    let pac = [ config.PROJ_PEND, config.PROJ_ACCR ];  
    
    if( action == "closed" ) {

	const link = ghLinks.getUniqueLink( authData, issueData[0] );
	cardId = link.GHCardId;
	
	// move card to "Pending PEQ Approval"
	if( cardId != -1 ) {
	    console.log( "Issuing move card" );
	    newColId   = ceProjectLayout[ config.PROJ_PEND + 1 ];   // +1 is for leading projId
	    newColName = config.PROJ_COLS[ config.PROJ_PEND ];
	    
	    success = await checkReserveSafe( authData, owner, repo, issueData[1], config.PROJ_PEND );
	    if( !success ) {
		// no need to put card back - didn't move it.
		await updateIssue( authData, owner, repo, issueData[1], "open" ); // reopen issue
		return false;
	    }

	    success = await moveCard( authData, cardId, newColId );
	}
    }
    else if( action == "reopened" ) {
	
	// This is a PEQ issue.  Verify card is currently in the right place, i.e. PEND ONLY (can't move out of ACCR)
	cardId = await findCardInColumn( authData, ghLinks, owner, repo, issueData[0], ceProjectLayout[ config.PROJ_PEND+1 ] );

	// move card to "In Progress".  planned is possible if issue originally closed with something like 'wont fix' or invalid.
	if( cardId != -1 ) {
	    console.log( "Issuing move card" );
	    newColId   = ceProjectLayout[ config.PROJ_PROG + 1 ];
	    newColName = getColumnName( authData, ghLinks, newColId );
	    success = moveCard( authData, cardId, newColId );
	}
	else {
	    // GH has opened this issue.  Close it back up.
	    console.log( "WARNING.  Can not reopen an issue that has accrued." );
	    await updateIssue( authData, owner, repo, issueData[1], "closed" ); // reopen issue
	    return false;
	}
    }

    if( success ) {
	success = ghLinks.updateLinkage( authData, issueData[0], cardId, newColId, newColName );
    }

    
    return success;
}

// XXX alignment risk
function getProjectName( authData, ghLinks, projId ) {

    if( projId == -1 ) { return -1; }

    const locs = ghLinks.getLocs( authData, { "projId": projId } );

    const projName = locs == -1 ? locs : locs[0].GHProjectName;
    return projName
    
    /*
    let project = await( authData.ic.projects.get({ project_id: projId }))
	.catch( e => {
	    console.log( authData.who, "Get Project failed.", e );
	    return "";
	});

    return project['data']['name'];
    */
}

// XXX add repo to all these queries?
// XXX alignment risk
function getColumnName( authData, ghLinks, colId ) {

    if( colId == -1 ) { return -1; }

    const locs = ghLinks.getLocs( authData, { "colId": colId } );
    assert( locs == -1 || locs.length == 1 );

    const colName = locs == -1 ? locs : locs[0].GHColumnName;
    return colName;

    /*
    let column = await( authData.ic.projects.getColumn({ column_id: colId }))
	.catch( e => {
	    console.log( authData.who, "Get Column failed.", e );
	    return "";
	});
    
    return column['data']['name'];
    */
}


function getAllocated( content ) {
    let res = false;
    for( const line of content ) {
	let s =  line.indexOf( config.PALLOC );

	if( s > -1 ){
	    res = true;
	    break;
	}
    }
    return res;
}


// Allow:
//  <allocation, PEQ: 1000>
//  <allocation, PEQ: 1,000>
//  <PEQ: 1000>
//  <PEQ: 1,000>
function parsePEQ( content, allocation ) {
    let peqValue = 0;
    // content must be at least 2 lines...  XXX title <PEQ: 1000> will fail here .. will be 1 char at a time
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

// no commas, no shorthand, just like this:  'PEQ value: 500'  or 'Allocation PEQ value: 30000'
function parseLabelDescr( labelDescr ) {
    let peqValue = 0;
    let pDescLen = config.PDESC.length;
    let aDescLen = config.ADESC.length;

    for( const line of labelDescr ) {
	if( line.indexOf( config.PDESC ) == 0 ) {
	    //console.log( "Found peq val in", line.substring( pDescLen ) );
	    peqValue = parseInt( line.substring( pDescLen ) );
	    break;
	}
	else if( line.indexOf( config.ADESC ) == 0 ) {
	    // console.log( "Found peq val in", line.substring( aDescLen ) );
	    peqValue = parseInt( line.substring( aDescLen ) );
	    break;
	}
    }

    return peqValue;
}

function theOnePEQ( labels ) {
    let peqValue = 0;

    for( const label of labels ) {
	let content = label['description'];
	let tval = parseLabelDescr( [content] );

	if( tval > 0 ) {
	    if( peqValue > 0 ) {
		console.log( "Two PEQ labels detected for this issue!!" );
		peqValue = 0;
		break;
	    }
	    else { peqValue = tval; }
	}
    }

    return peqValue;
}

exports.githubUtils = githubUtils;
exports.githubSafe = githubSafe;



