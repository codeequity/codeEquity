/*
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

    validatePEQ: function( installClient, repo, issueId, title, projId ) {
	return validatePEQ( installClient, repo, issueId, title, projId );
    },

    createIssue: function( installClient, owner, repo, title, labels, allocation ) {
	return createIssue( installClient, owner, repo, title, labels, allocation );
    },

    createProjectCard: function( installClient, columnId, issueId, justId ) {
	return createProjectCard( installClient, columnId, issueId, justId );
    },

    removeLabel: function( installClient, owner, repo, issueNum, label ) {
	return removeLabel( installClient, owner, repo, issueNum, label );
    },

    addLabel: function( installClient, owner, repo, issueNum, label ) {
	return addLabel( installClient, owner, repo, issueNum, label );
    },

    rebuildLabel: function( installClient, owner, repo, issueNum, oldLabel, newLabel ) {
	return rebuildLabel( installClient, owner, repo, issueNum, oldLabel, newLabel );
    },

    splitIssue: function( installClient, owner, repo, issue, splitTag ) {
	return splitIssue( installClient, owner, repo, issue, splitTag );
    },

    cleanUnclaimed: function( installClient, ghLinks, pd ) {
	return cleanUnclaimed( installClient, ghLinks, pd );
    },
    
    updateIssue: function( installClient, owner, repo, issueNum, newState ) {
	return updateIssue( installClient, owner, repo, issueNum, newState );
    },
    
}


var githubUtils = {

    checkRateLimit: function( installClient ) {
	return checkRateLimit( installClient );
    },

    checkIssueExists: function( installClient, owner, repo, title ) {
	return checkIssueExists( installClient, owner, repo, title );
    },

    getAssignees: function( installClient, owner, repo, issueNum ) {
	return getAssignees( installClient, owner, repo, issueNum );
    },

    getIssue: function( installClient, owner, repo, issueNum ) {
	return getIssue( installClient, owner, repo, issueNum );
    },

    getCard: function( installClient, cardId ) {
	return getCard( installClient, cardId );
    },

    getFullIssue: function( installClient, owner, repo, issueNum ) {
	return getFullIssue( installClient, owner, repo, issueNum );
    },

    findOrCreateLabel: function( installClient, owner, repo, allocation, peqHumanLabelName, peqValue ) {
	return findOrCreateLabel( installClient, owner, repo, allocation, peqHumanLabelName, peqValue );
    },

    rebuildCard: function( installClient, owner, repo, colId, origCardId, issueData ) {
	return rebuildCard( installClient, owner, repo, colId, origCardId, issueData );
    },

    createUnClaimedCard: function( installClient, owner, repo, issueId ) {
	return createUnClaimedCard( installClient, owner, repo, issueId );
    },

    getBasicLinkDataGQL: function( PAT, owner, repo, data, cursor ) {
	return getBasicLinkDataGQL( PAT, owner, repo, data, cursor );
    },

    populateCELinkage: function( installClient, ghLinks, pd ) {
	return populateCELinkage( installClient, ghLinks, pd );
    },

    populateRequest: function( labels ) {
	return populateRequest( labels );
    },

    getCEProjectLayout: function( installClient, ghLinks, issueId ) {
	return getCEProjectLayout( installClient, ghLinks, issueId );
    },
    
    moveCard: function( installClient, cardId, colId ) {
	return moveCard( installClient, cardId, colId ); 
    },

    checkReserveSafe: function( installClient, owner, repo, issueNum, colNameIndex ) {
	return checkReserveSafe( installClient, owner, repo, issueNum, colNameIndex );
    },
    
    moveIssueCard: function( installClient, ghLinks, owner, repo, issueId, action, ceProjectLayout ) {
	return moveIssueCard( installClient, ghLinks, owner, repo, issueId, action, ceProjectLayout ); 
    },

    getProjectName: function( installClient, projId ) {
	return getProjectName( installClient, projId ); 
    },

    getColumnName: function( installClient, colId ) {
	return getColumnName( installClient, colId ); 
    },

};


async function checkRateLimit( installClient ) {

    // console.log( "Rate limit check currently off" );
    return;
    
    await( installClient[0].rateLimit.get())
	.then( rl => {
	    console.log( "Core:", rl['data']['resources']['core']['limit'], rl['data']['resources']['core']['remaining'] );
	    console.log( "Search:", rl['data']['resources']['search']['limit'], rl['data']['resources']['search']['remaining'] );
	    console.log( "Graphql:", rl['data']['resources']['graphql']['limit'], rl['data']['resources']['graphql']['remaining'] );
	    console.log( "Integration:", rl['data']['resources']['integration_manifest']['limit'], rl['data']['resources']['integration_manifest']['remaining'] );
	})
	.catch( e => { console.log( installClient[1], "Problem in check Rate Limit", e );   });
}

// XXX paginate
async function checkIssueExists( installClient, owner, repo, title )
{
    let retVal = false;

    // Issue with same title may already exist, in which case, check for label, then point to that issue.
    await( installClient[0].issues.listForRepo( { owner: owner, repo: repo }))
	.then( issues => {
	    for( issue of issues['data'] ) {
		if( issue['title'] == title ) {
		    retVal = true;
		    break;
		}
	    }
	})
	.catch( e => {
	    console.log( installClient[1], "Problem in checkIssueExists", e );
	});
    return retVal;
}

// Note.. unassigned is normal for plan, abnormal for inProgress, not allowed for accrued.
// there are no assignees for card-created issues.. they are added, or created directly from issues.
// XXX alignment risk - card info could have moved on
async function getAssignees( installClient, owner, repo, issueNum )
{
    let retVal = [];
    if( issueNum == -1 ) { console.log( "getAssignees: bad issue number", issueNum ); return retVal; }

    // console.log( installClient[1], "Getting assignees for", owner, repo, issueNum );
    await( installClient[0].issues.get( { owner: owner, repo: repo, issue_number: issueNum }))
	.then( issue => {
	    // console.log( issue['data'] );
	    if( issue['data']['assignees'].length > 0 ) { 
		for( assignee of issue['data']['assignees'] ) {
		    retVal.push( assignee['login'] );
		}
	    }
	})
	.catch( e => {
	    console.log( installClient[1], "Problem in getAssignees", e );
	});
    return retVal;
}

// [id, content]
// XXX alignment risk - card info could have moved on
async function getIssue( installClient, owner, repo, issueNum )
{
    if( issueNum == -1 ) { return retVal; }
    
    let issue = await getFullIssue( installClient, owner, repo, issueNum ); 
    let retIssue = [];
    let retVal   = [];
    
    retIssue.push( issue.id );
    retVal.push( issue.title );
    if( issue.labels.length > 0 ) {
	for( label of issue.labels ) { retVal.push( label['description'] ); }
    }
    retIssue.push( retVal );
    return retIssue;
}

// XXX alignment risk - card info could have moved on
async function getFullIssue( installClient, owner, repo, issueNum )
{
    if( issueNum == -1 ) { return retVal; }
    let retIssue = "";

    await( installClient[0].issues.get( { owner: owner, repo: repo, issue_number: issueNum }))
	.then( issue => { retIssue = issue['data']; })
	.catch( e => { console.log( installClient[1], "Problem in getIssueContent", e ); });
    
    return retIssue;
}

// XXX alignment risk - card info could have moved on
async function getCard( installClient, cardId ) {
    let retCard = -1;
    if( cardId == -1 ) { return retCard; }
    
    await( installClient[0].projects.getCard( { card_id: cardId } ))
	.then((card) => {  retCard = card.data; } )
	.catch( e => { console.log( installClient[1], "Get card failed.", e ); });
    return retCard;
}


async function splitIssue( installClient, owner, repo, issue, splitTag ) {
    console.log( "Split issue" );
    let issueData = [-1,-1];  // issue id, num
    let title = issue.title + " split: " + splitTag;
    
    await( installClient[0].issues.create( {
	owner:     owner,
	repo:      repo,
	title:     title,
	body:      issue.body,
	milestone: issue.milestone,
	labels:    issue.labels,
	assignees: issue.assignees
    } ))
	.then( issue => {
	    issueData[0] = issue['data']['id'];
	    issueData[1] = issue['data']['number'];
	})
	.catch( e => {
	    console.log( installClient[1], "Create issue failed.", e );
	});

    let comment = "CodeEquity duplicated this new issue from issue id:" + issue.id.toString() + " on " + utils.getToday().toString();
    comment += " in order to maintain a 1:1 mapping between issues and cards."
    
    await( installClient[0].issues.createComment( { owner: owner, repo: repo, issue_number: issueData[1], body: comment } ))
	.catch( e => {
	    console.log( installClient[1], "Create issue comment failed.", e );
	});
    
    return issueData;
}

async function updateIssue( installClient, owner, repo, issueNum, newState ) {
    let retVal = false;
    if( issueNum == -1 ) { return retVal; }

    await( installClient[0].issues.update( { owner: owner, repo: repo, issue_number: issueNum, state: newState }))
	.then( update => {
	    console.log( installClient[1], "updateIssue done" );
	    retVal = true;
	})
	.catch( e => {
	    console.log( installClient[1], "Problem in updateIssue", e );
	});
    return retVal;
}


// XXX (very) low risk for alignment trouble. warn if see same label create/delete on job queue.
async function findOrCreateLabel( installClient, owner, repo, allocation, peqHumanLabelName, peqValue )
{
    // does label exist 
    let peqLabel = "";
    let status = 200;
    await( installClient[0].issues.getLabel( { owner: owner, repo: repo, name: peqHumanLabelName }))
	.then( label => {
	    peqLabel = label['data'];
	})
	.catch( e => {
	    status = e['status'];
	    if( status != 404 ) {
		console.log( installClient[1], "Get label failed.", e );
	    }
	});
    
    // if not, create
    if( status == 404 ) {
	console.log( installClient[1], "Label not found, creating.." );

	if( peqHumanLabelName == config.POPULATE ) {
	await( installClient[0].issues.createLabel( { owner: owner, repo: repo, name: peqHumanLabelName, color: '111111', description: "populate" }))
	    .then( label => { peqLabel = label['data']; })
	    .catch( e => { console.log( installClient[1], "Create label failed.", e );  });
	}
	else {
	    let descr = ( allocation ? config.ADESC : config.PDESC ) + peqValue.toString();
	    let pcolor = allocation ? config.APEQ_COLOR : config.PEQ_COLOR;
	    await( installClient[0].issues.createLabel( { owner: owner, repo: repo, name: peqHumanLabelName, color: pcolor, description: descr }))
		.then( label => { peqLabel = label['data']; })
		.catch( e => { console.log( installClient[1], "Create label failed.", e ); });
	}
    }

    assert.notStrictEqual( peqLabel, undefined, "Did not manage to find or create the PEQ label" );
    return peqLabel;
}


// New information being pushed into GH - alignment safe.
async function createIssue( installClient, owner, repo, title, labels, allocation )
{
    console.log( installClient[1], "Creating issue, from alloc?", allocation );
    let issueData = [-1,-1];  // issue id, num

    let body = "";
    if( allocation ) {
	body  = "This is an allocation issue added by CodeEquity.  It does not reflect specific work or issues to be resolved.  ";
	body += "It is simply a rough estimate of how much work will be carried out in this category.\n\n"
	body += "It is safe to filter this out of your issues list.\n\n";
	body += "It is NOT safe to close, reopen, or edit this issue.";
    }
    
    // NOTE: will see several notifications are pending here, like issue:open, issue:labelled
    await( installClient[0].issues.create( { owner: owner, repo: repo, title: title, labels: labels, body: body } ))
	.then( issue => {
	    issueData[0] = issue['data']['id'];
	    issueData[1] = issue['data']['number'];
	})
	.catch( e => {
	    console.log( installClient[1], "Create issue failed.", e );
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
	.catch( e => console.log( "GQL issue", e ));

    const issues = res.data.repository.issues;
    for( let i = 0; i < issues.edges.length; i++ ) {
	const issue  = issues.edges[i].node;
	const cards  = issue.projectCards;
	const labels = issue.labels;

	// XXX Over 100 cards or 100 labels for 1 issue?  Don't use CE.  Warn here.
	assert( !cards.pageInfo.hasNextPage && !labels.hasNextPage );

	for( const card of cards.edges ) {
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
	// XXX Unused
	/*
	for( const label of labels.edges ) {
	    console.log( label.node.name, ",", label.node.description );
	}
	*/
    }

    if( issues.pageInfo.hasNextPage ) { await getBasicLinkDataGQL( PAT, owner, repo, data, issues.pageInfo.endCursor ); }
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
async function populateCELinkage( installClient, ghLinks, pd )
{
    console.log( installClient[1], "Populate CE Linkage start" );
    assert( !utils.checkPopulated( installClient, pd.GHFullName ) != -1);

    // XXX this does more work than is needed - checks for peqs which only exist during testing.
    let PAT     = await auth.getPAT( pd.GHOwner );
    let linkage = await ghLinks.initOneRepo( installClient, pd.GHFullName, PAT );

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
	await utils.resolve( installClient, ghLinks, pd, "???" );
    }
    
    await utils.setPopulated( installClient, pd.GHFullName );
    console.log( installClient[1], "Populate CE Linkage Done" );
    return true;
}


// XXX alignment risk - card info could have moved on
async function rebuildCard( installClient, owner, repo, colId, origCardId, issueData ) {
    assert( issueData.length == 2 );
    let issueId  = issueData[0];
    let issueNum = issueData[1];
    assert.notEqual( issueId, -1, "Attempting to attach card to non-issue." );

    // If card has not been tracked, colId could be wrong.  relocate.
    // Note: do not try to avoid this step during populateCE - creates a false expectation (i.e. ce is tracking) for any simple carded issue.
    if( colId == -1 ) {
	let projCard = await getCard( installClient, origCardId ); 
	colId = projCard.column_url.split('/').pop();
    }
    
    // create issue-linked project_card, requires id not num
    let newCardId = await createProjectCard( installClient, colId, issueId, true );
    assert.notEqual( newCardId, -1, "Unable to create new issue-linked card." );	    
    
    // remove orig card
    // Note: await waits for GH to finish - not for notification to be received by webserver.
    await( installClient[0].projects.deleteCard( { card_id: origCardId } ));

    return newCardId;
}

async function removeLabel( installClient, owner, repo, issueNum, label ) {
    await installClient[0].issues.removeLabel({ owner: owner, repo: repo, issue_number: issueNum, name: label.name  } )
	.catch( e => { console.log( installClient[1], "Remove label from issue failed.", e ); });
}

async function addLabel( installClient, owner, repo, issueNum, label ) {
    await installClient[0].issues.addLabels({ owner: owner, repo: repo, issue_number: issueNum, labels: [label.name] })
	.catch( e => { console.log( installClient[1], "Add label failed.", e ); });
}

async function rebuildLabel( installClient, owner, repo, issueNum, oldLabel, newLabel ) {
    await removeLabel( installClient, owner, repo, issueNum, oldLabel );
    await addLabel( installClient, owner, repo, issueNum, newLabel );
}


async function createProjectCard( installClient, columnId, issueId, justId )
{
    let newCard = -1;

    await( installClient[0].projects.createCard({ column_id: columnId, content_id: issueId, content_type: 'Issue' }))
	.then( card => { newCard = card['data']; })
	.catch( e => { console.log( installClient[1], "Create issue-linked project card failed.", e ); });

    if( justId ) { return newCard['id']; }
    else         { return newCard; }
}


// XXX alignment risk
// XXX could look in linkage for unclaimed proj / col ids .. ?
async function createUnClaimedCard( installClient, owner, repo, issueId )
{
    let unClaimedProjId = -1;
    const unClaimed = config.UNCLAIMED;

    // Get, or create, unclaimed project id
    // Note.  pagination removes .headers, .data and etc.
    await installClient[0].paginate( installClient[0].projects.listForRepo, { owner: owner, repo: repo, state: "open" } )
	.then((projects) => {
	    for( project of projects ) {
		if( project.name == unClaimed ) { unClaimedProjId = project.id; }
	    }})
	.catch( e => { console.log( installClient[1], "List projects failed.", e ); });
    if( unClaimedProjId == -1 ) {
	console.log( "Creating UnClaimed project" );
	let body = "Temporary storage for issues with cards that have not yet been assigned to a column (triage)";
	await installClient[0].projects.createForRepo({ owner: owner, repo: repo, name: unClaimed, body: body })
	    .then((project) => { unClaimedProjId = project.data.id; })
	    .catch( e => { console.log( installClient[1], "Create unclaimed project failed.", e ); });
    }


    // Get, or create, unclaimed column id
    let unClaimedColId = -1;
    await installClient[0].paginate( installClient[0].projects.listColumns, { project_id: unClaimedProjId, per_page: 100 } )
	.then((columns) => {
	    for( column of columns ) {
		if( column.name == unClaimed ) { unClaimedColId = column.id; }
	    }})
    	.catch( e => { console.log( installClient[1], "List Columns failed.", e ); });
    if( unClaimedColId == -1 ) {
	console.log( "Creating UnClaimed column" );
	await installClient[0].projects.createColumn({ project_id: unClaimedProjId, name: unClaimed })
	    .then((column) => { unClaimedColId = column.data.id; })
	    .catch( e => { console.log( installClient[1], "Create unclaimed column failed.", e ); });
    }

    assert( unClaimedProjId != -1 );
    assert( unClaimedColId != -1  );
    // console.log( "unclaimed p,c", unClaimedProjId, unClaimedColId );
    
    // create card in unclaimed:unclaimed
    let card = await createProjectCard( installClient, unClaimedColId, issueId, false );
    return card;
}

// Unclaimed cards are peq issues by definition (only added when labeling uncarded issue).  So, linkage table will be complete.
async function cleanUnclaimed( installClient, ghLinks, pd ) {
    console.log( installClient[1], "cleanUnclaimed", pd.GHIssueId );
    let link = ghLinks.getUniqueLink( installClient, pd.GHIssueId );
    if( link == -1 ) { return; }
    if( link.GHColumnName != config.UNCLAIMED ) { return; }   // i.e. add allocation card to proj: add card -> add issue -> rebuild card
	
    assert( link.GHCardId != -1 );
    assert( link.GHColumnName != config.EMPTY );

    console.log( "Found unclaimed" );
    await installClient[0].projects.deleteCard( { card_id: link.GHCardId } );
    
    // Remove turds, report.  
    ghLinks.removeLinkage({ "installClient": installClient, "issueId": pd.GHIssueId, "cardId": link.GHCardId });
    
    // do not delete peq - set it inactive.
    let daPEQ = await utils.getPeq( installClient, pd.GHIssueId );
    await utils.removePEQ( installClient, daPEQ.PEQId );

    utils.recordPEQAction(
	installClient,
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
    
	   
}

//                                   [ projId, colId:PLAN,     colId:PROG,     colId:PEND,      colId:ACCR ]
// If this is a flat project, return [ projId, colId:current,  colId:current,  colId:NEW-PEND,  colId:NEW-ACCR ]
// XXX alignment risk
async function getCEProjectLayout( installClient, ghLinks, issueId )
{
    // if not validLayout, won't worry about auto-card move
    // XXX will need workerthreads to carry this out efficiently, getting AWS data and GH simultaneously.
    // XXX Revisit if ever decided to track cols, projects.
    // XXX may be hole in create card from isssue

    let link = ghLinks.getUniqueLink( installClient, issueId );

    let projId = link == -1 ? link : parseInt( link['GHProjectId'] );
    let curCol = link == -1 ? link : parseInt( link['GHColumnId'] );        // moves are only tracked for peq issues

    console.log( installClient[1], "Found project id: ", projId );
    let foundReqCol = [projId, -1, -1, -1, -1];
    if( projId == -1 ) { return foundReqCol; }

    let missing = true;
    let allColumns = [];
    await( installClient[0].projects.listColumns({ project_id: projId, per_page: 100 }))
	.then( columns => {
	    allColumns = columns;
	    let foundCount = 0;
	    for( column of columns['data'] ) {
		// console.log( "checking", column );
		let colName = column['name'];
		for( let i = 0; i < 4; i++ ) {
		    if( colName == config.PROJ_COLS[i] ) {
			if( foundReqCol[i+1] == -1 ) { foundCount++; }
			else {
			    console.log( "Validate CE Project Layout found column repeat: ", config.PROJ_COLS[i] );
			    assert( false );
			}
			foundReqCol[i+1] = column['id'];
			break;
		    }
		}
		// no need to check every col when required are found
		if( foundCount == 4 ) { missing = false; break; }
	    }
	})
	.catch( e => {
	    console.log( installClient[1], "Validate CE Project Layout failed.", e );
	});

    // Make this project viable for PEQ tracking
    if( missing ) {
	// Check if curCol needs to be reset
	if( link != -1 && link.GHColumnName == config.PROJ_COLS[ config.PROJ_PEND ] ) {
	    // currently in PEND, being reopened.  Move out of reserved space.  XXX Warn?
	    const peq = await( utils.getPeq( installClient, issueId ));
	    let curColName = peq.GHProjectSub[ peq.GHProjectSub.length - 1];
	    let tmpCol = allColumns.find( col => col.name == curColName );
	    if( tmpCol.length > 0 ) {
		curCol = tmpCol.id;
		console.log( "Will open issue back to col", curColName );
	    }
	    else {  // Should only happen if projSubs fails in some way.
		console.log( "Could not find original column." );
		curCol = -1;
	    }
	}
	
	// use PLAN or PROG if present
	if( foundReqCol[config.PROJ_PLAN + 1] == -1 && foundReqCol[config.PROJ_PROG + 1] != -1 ) {
	    foundReqCol[config.PROJ_PLAN + 1] = foundReqCol[config.PROJ_PROG + 1];
	}
	if( foundReqCol[config.PROJ_PLAN + 1] != -1 && foundReqCol[config.PROJ_PROG + 1] == -1 ) {
	    foundReqCol[config.PROJ_PROG + 1] = foundReqCol[config.PROJ_PLAN + 1];
	}
	// Use current if both are missing
	if( foundReqCol[config.PROJ_PLAN + 1] == -1 && foundReqCol[config.PROJ_PROG + 1] == -1 ) {
	    // No curCol?  create in progress.
	    // XXX probably unneeded
	    if( curCol == -1 ) {
		const progName = config.PROJ_COLS[ config.PROJ_PROG]; 
		console.log( "Creating new column:", progName );
		await installClient[0].projects.createColumn({ project_id: projId, name: progName })
		    .then((column) => { curCol = column.data.id; })
		    .catch( e => { console.log( installClient[1], "Create column failed.", e ); });
	    }
	    foundReqCol[config.PROJ_PLAN + 1] = curCol;
	    foundReqCol[config.PROJ_PROG + 1] = curCol;
	}
	// Create PEND if missing
	if( foundReqCol[config.PROJ_PEND + 1] == -1 ) {
	    let pendName = config.PROJ_COLS[ config.PROJ_PEND ];
	    console.log( "Creating new column:", pendName );
	    await installClient[0].projects.createColumn({ project_id: projId, name: pendName })
		.then((column) => { foundReqCol[config.PROJ_PEND + 1] = column.data.id; })
		.catch( e => { console.log( installClient[1], "Create column failed.", e ); });
	}
	// Create ACCR if missing
	if( foundReqCol[config.PROJ_ACCR + 1] == -1 ) {
	    let accrName = config.PROJ_COLS[ config.PROJ_ACCR ];
	    console.log( "Creating new column:", accrName );
	    await installClient[0].projects.createColumn({ project_id: projId, name: accrName })
		.then((column) => { foundReqCol[config.PROJ_ACCR + 1] = column.data.id; })
		.catch( e => { console.log( installClient[1], "Create column failed.", e ); });
	}
    }
    console.log( "Layout:", foundReqCol );
    return foundReqCol;
}

    
// issueId?  then verify "plan".  no issueId?  then verify "allocation".  No legal move of accrue.
async function validatePEQ( installClient, repo, issueId, title, projId ) {
    let peq = -1;

    let peqType = "";
    if( issueId == -1 ) {
	peqType = "allocation";
	peq = await( utils.getPeqFromTitle( installClient, repo, projId, title ));
    }
    else {
	peqType = "plan";
	peq = await( utils.getPeq( installClient, issueId ));
    }

    if( peq != -1 && peq['GHIssueTitle'] == title && peq['PeqType'] == peqType && peq['GHRepo'] == repo)  {
	console.log( installClient[1], "validatePeq success" );
    }
    else {
	console.log( "... oops", peq['GHIssueTitle'], title, peq['PeqType'], "plan", peq['GHRepo'], repo );
    }
    return peq;
}

async function findCardInColumn( installClient, ghLinks, owner, repo, issueId, colId ) {

    let cardId = -1;
    let link = ghLinks.getUniqueLink( installClient, issueId );
	
    if( link != -1 && parseInt( link['GHColumnId'] ) == colId ) { cardId = parseInt( link['GHCardId'] ); }

    console.log( installClient[1], "find card in col", issueId, colId, "found?", cardId );
    return cardId;
}

async function moveCard( installClient, cardId, colId ) {
    return await( installClient[0].projects.moveCard({ card_id: cardId, position: "top", column_id: colId }))
	.catch( e => { console.log( installClient[1], "Move card failed.", e );	});
}


async function checkReserveSafe( installClient, owner, repo, issueNum, colNameIndex ) {
    let retVal = true;
    if( colNameIndex > config.PROJ_PROG ) { 
	let assignees = await getAssignees( installClient, owner, repo, issueNum );
	if( assignees.length == 0  ) {
	    console.log( "WARNING.  Update card failed - no assignees" );   // can't propose grant without a grantee
	    retVal = false;
	}
    }
    return retVal;
}

// XXX alignment risk if card moves in the middle of this
async function moveIssueCard( installClient, ghLinks, owner, repo, issueData, action, ceProjectLayout )
{
    console.log( "Moving issue card", issueData );
    let success    = false;
    let newColId   = -1;
    let newColName = "";
    assert.notEqual( ceProjectLayout[0], -1 );
    let cardId = -1;
    let oldColId = -1;
    let pip = [ config.PROJ_PLAN, config.PROJ_PROG ];  
    let pac = [ config.PROJ_PEND, config.PROJ_ACCR ];  
    
    if( action == "closed" ) {

	// verify card is in the right place
	for( let i = 0; i < 2; i++ ) {
	    oldColId = ceProjectLayout[ pip[i]+1 ];
	    cardId = await findCardInColumn( installClient, ghLinks, owner, repo, issueData[0], oldColId );
	    if( cardId != -1 ) { break; }
	}

	// move card to "Pending PEQ Approval"
	if( cardId != -1 ) {
	    console.log( "Issuing move card" );
	    newColId   = ceProjectLayout[ config.PROJ_PEND + 1 ];   // +1 is for leading projId
	    newColName = config.PROJ_COLS[ config.PROJ_PEND ];
	    
	    success = await checkReserveSafe( installClient, owner, repo, issueData[1], config.PROJ_PEND );
	    if( !success ) {
		// no need to put card back - didn't move it.
		await updateIssue( installClient, owner, repo, issueData[1], "open" ); // reopen issue
		return false;
	    }

	    success = await moveCard( installClient, cardId, newColId );
	}
    }
    else if( action == "reopened" ) {
	
	// This is a PEQ issue.  Verify card is currently in the right place, i.e. PEND ONLY (can't move out of ACCR)
	cardId = await findCardInColumn( installClient, ghLinks, owner, repo, issueData[0], ceProjectLayout[ config.PROJ_PEND+1 ] );

	// move card to "In Progress".  planned is possible if issue originally closed with something like 'wont fix' or invalid.
	if( cardId != -1 ) {
	    console.log( "Issuing move card" );
	    newColId   = ceProjectLayout[ config.PROJ_PROG + 1 ];
	    newColName = config.PROJ_COLS[ config.PROJ_PROG ]; 	    
	    success = moveCard( installClient, cardId, newColId );
	}
    }

    if( success ) {
	success = ghLinks.updateLinkage( installClient, issueData[0], cardId, newColId, newColName );
    }

    
    return success;
}

// XXX alignment risk
async function getProjectName( installClient, projId ) {

    let project = await( installClient[0].projects.get({ project_id: projId }))
	.catch( e => {
	    console.log( installClient[1], "Get Project failed.", e );
	    return "";
	});

    return project['data']['name'];
}

// XXX alignment risk
async function getColumnName( installClient, colId ) {

    if( colId == -1 ) { return -1; }
    
    let column = await( installClient[0].projects.getColumn({ column_id: colId }))
	.catch( e => {
	    console.log( installClient[1], "Get Column failed.", e );
	    return "";
	});
    
    return column['data']['name'];
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

    for( label of labels ) {
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



