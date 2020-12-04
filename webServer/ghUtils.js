var config  = require('./config');
var utils = require('./utils');
var assert = require('assert');

var githubUtils = {

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

    getFullIssue: function( installClient, owner, repo, issueNum ) {
	return getFullIssue( installClient, owner, repo, issueNum );
    },

    splitIssue: function( installClient, owner, repo, issue, splitTag ) {
	return splitIssue( installClient, owner, repo, issue, splitTag );
    }

    updateIssue: function( installClient, owner, repo, issueNum, newState ) {
	return updateIssue( installClient, owner, repo, issueNum, newState );
    },
    
    findOrCreateLabel: function( installClient, owner, repo, allocation, peqHumanLabelName, peqValue ) {
	return findOrCreateLabel( installClient, owner, repo, allocation, peqHumanLabelName, peqValue );
    },

    createIssue: function( installClient, owner, repo, title, labels, allocation ) {
	return createIssue( installClient, owner, repo, title, labels, allocation );
    },

    createProjectCard: function( installClient, columnID, issueID, justId ) {
	return createProjectCard( installClient, columnID, issueID, justId );
    },

    createUnClaimedCard: function( installClient, owner, repo, issueId ) {
	return createUnClaimedCard( installClient, owner, repo, issueId );
    },

    populateCELinkage: function( installClient, owner, repo, fullName ) {
	return populateCELinkage( installClient, owner, repo, fullName );
    },

    validateCEProjectLayout: function( installClient, issueId ) {
	return validateCEProjectLayout( installClient, issueId );
    },
    
    validatePEQ: function( installClient, repo, issueId, title, projId ) {
	return validatePEQ( installClient, repo, issueId, title, projId );
    },

    moveIssueCard: function( installClient, owner, repo, fullName, issueId, action, ceProjectLayout ) {
	return moveIssueCard( installClient, owner, repo, fullName, issueId, action, ceProjectLayout ); 
    },

    getProjectName: function( installClient, projId ) {
	return getProjectName( installClient, projId ); 
    },

    getColumnName: function( installClient, colId ) {
	return getColumnName( installClient, colId ); 
    },

    getProjectSubs: function( installClient, repoName, projName, colId ) {
	return getProjectSubs( installClient, repoName, projName, colId ); 
    },
};


async function checkRateLimit( installClient ) {

    console.log( "Rate limit check currently off" );
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
async function getAssignees( installClient, owner, repo, issueNum )
{
    let retVal = [];
    if( issueNum == -1 ) { return retVal; }

    console.log( installClient[1], "Getting assignees for", owner, repo, issueNum );
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

async function getFullIssue( installClient, owner, repo, issueNum )
{
    if( issueNum == -1 ) { return retVal; }
    let retIssue = "";

    await( installClient[0].issues.get( { owner: owner, repo: repo, issue_number: issueNum }))
	.then( issue => { retIssue = issue['data']; })
	.catch( e => { console.log( installClient[1], "Problem in getIssueContent", e ); });
    
    return retIssue;
}

async function splitIssue( installClient, owner, repo, issue, splitTag ) {

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

    let comment = "CodeEquity duplicated this new issue from " + issue.id.toString() + " on " + getToday().toString();
    comment += " in order to maintain a 1:1 mapping between issues and cards."

    await( installClient[0].issues.createComment( { owner: owner, repo: repo, issue_number: issueData[1], body: comment } )
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
	console.log( installClient[1], "Not found, creating.." );
	let descr = ( allocation ? config.ADESC : config.PDESC ) + peqValue.toString();
	let pcolor = allocation ? config.APEQ_COLOR : config.PEQ_COLOR;
	await( installClient[0].issues.createLabel( { owner: owner, repo: repo, name: peqHumanLabelName, color: pcolor, description: descr }))
	    .then( label => {
		peqLabel = label['data'];
	    })
	    .catch( e => {
		console.log( installClient[1], "Create label failed.", e );
	    });
    }

    assert.notStrictEqual( peqLabel, undefined, "Did not manage to find or create the PEQ label" );
    return peqLabel;
}


async function createIssue( installClient, owner, repo, title, labels, allocation )
{
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
async function populateCELinkage( installClient, owner, repo, fullName )
{
    let alreadyDone = await utils.checkPopulated( installClient[1], fullName );
    if( alreadyDone ) { return false; }
    
    // Get project IDs
    let projIds = [];
    await installClient[0].paginate( installClient[0].projects.listForRepo, { owner: owner, repo: repo, state: "open" } )
	.then((projects) => {
	    projIds = projects.map((project) => project.id );
	});
    // console.log( "Project ids", projIds );

    // Get column Ids per project
    let colIds = [];         // list [ [projId, [col ids]], ...]
    let colPromises = [];
    for( const projId of projIds ) {
	colPromises.push(
	    installClient[0].paginate( installClient[0].projects.listColumns, { project_id: projId } )
		.then((columns) => {
		    let tcol = columns.map((column)=> column.id );
		    return [projId, tcol];
		})
	);
    }
    await Promise.all( colPromises )
	.then((pairs) => {
	    colIds = colIds.concat( pairs );
	});
    // console.log( "Column ids", colIds );

    // Get card Ids per column Id
    let cardIds = [];         // list [ [projId, colId, [cardIds], [issueNums]], ... ]
    let cardPromises = [];
    for( const projCols of colIds ) {  
	for( const colId of projCols[1] ) {
	    cardPromises.push(
		installClient[0].paginate( installClient[0].projects.listCards, { column_id: colId, archived_state: "not_archived" } )
		    .then((cards) => {
			let tcards  = cards.map((card)=> card.id );
			let issNums = cards.map((card) => {
			    if( card['content_url'] == null ) { return ""; }
			    let parts = card['content_url'].split('/');
			    return parts[ parts.length - 1] ; 
			});
			
			return [projCols[0], colId, tcards, issNums];
		    })
	    );
	}
    }
    await Promise.all( cardPromises )
	.then((quads) => {
	    cardIds = cardIds.concat( quads );
	});
    // console.log( "Card ids", cardIds );

    // list of trips [projid, cardid, issuenum].. all "" are stripped.
    // Clean this list up before pushing to populate.
    let trips = [];
    for( const column of cardIds ) {
	assert( column.length == 4 );
	assert( column[2].length == column[3].length );
	for( let i = 0; i < column[2].length; i++ ) {
	    if( column[2][i] != "" && column[3][i] != "" ) {
		trips.push( [ column[0], column[2][i], column[3][i] ] ); 
	    }
	}
    }
    // console.log( "Trips", trips );

    // XXX may not be necessary
    // Eliminate trips where cardId already exists
    // Note: this is largely overkill, since 99% of the time this will be done before serious use of CE starts.
    let idsOnly = trips.map((trip) => trip[1] );
    let existingIds = await utils.getExistCardIds( installClient[1], fullName, idsOnly );
    if( existingIds != -1 ) {
	for( const id of existingIds ) {
	    let index = -1;
	    for( let i = 0; i < trips.length; i++ ) {
		if( trips[i][1].toString() == id ) {
		    index = i;
		    break;
		}
	    }
	    if( index > -1 ) { trips.splice( index, 1 ); }
	}
    }
    console.log( "Clean trips", trips );
    
    // Add issueId to each trip, to complete linkage pkey and enable typical usage pattern
    let lPromises = [];
    for( const trip of trips ) {
	lPromises.push( getIssue( installClient, owner, repo, trip[2] )
			.then((issue) => [ trip[0], trip[1], trip[2], issue[0] ] ));
    }
    let linkage = await Promise.all( lPromises );
    console.log( "linkages", linkage );
		      
    await utils.populateIssueCards( fullName, linkage );

    // At this point, we have happily added 1:m issue:card relations to linkage table (no other table)
    // Resolve here to split those up.  Normally, would then worry about first time users being confused about
    // why the new peq label applied to their 1:m issue, only 'worked' for one card.
    // But, populate will be run from ceFlutter, separately from actual label notification.
    let pd = {};
    pd.GHOwner    = owner;
    pd.GHRepo     = repo;
    pd.peqType    = "end";

    let rPromises = [];
    for( const trip of trips ) {
	pd.GHIssueId  = issueId;
	pd.GHIssueNum = issueNum;
	console.log( "Start resolve for", trip );
	rPromises.push( utils.resolve( installClient, pd, false ) );
    }
    await Promise.all( rPromises );
    
    await utils.setPopulated( installClient[1], fullName );
    return true;
}



async function createProjectCard( installClient, columnID, issueID, justId )
{
    let newCard = -1;

    await( installClient[0].projects.createCard({ column_id: columnID, content_id: issueID, content_type: 'Issue' }))
	.then( card => { newCard = card['data']; })
	.catch( e => { console.log( installClient[1], "Create issue-linked project card failed.", e ); });

    if( justId ) { return newCard['id']; }
    else         { return newCard; }
}


// XXX could look in linkage for unclaimed proj / col ids .. ?
async function createUnClaimedCard( installClient, owner, repo, issueId )
{
    let unClaimedProjId = -1;
    const unClaimed = "UnClaimed";   // XXX config 

    // Get, or create, unclaimed project id
    console.log( "List proj for repo", repo, issueId );
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
    console.log( "List col for proj", unClaimedProjId );
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



// This function is called ONLY during an issue close / reopen notification.
// The difficulty is that a GH issue is a leaf in a big tree.  Project_cards can point to those leaves,
// but there is no reverse pointer.   Looking for related project_card from issue would require getting
// a list of projects, and a list of columns per project, and a list of cards per column, which could be
// a LARGE number of REST calls.
// CE's approach to resolving this: as a matter of course, CE is tracking all PEQ-issues-and-cards, including ids.
// This call will get and set proj/col/card ids for an issue from AWS:dynamodb, while simultaneously
// validating the project column layout (worker threads).
// Alternatively, we could solve part of the problem by moving to graphQL and requiring a project label for every PEQ-issue.
// But that is an extra layer of requirement on the client, and the result will most likely be slower.
async function validateCEProjectLayout( installClient, issueId )
{
    // if not validLayout, won't worry about auto-card move
    // XXX will need workerthreads to carry this out efficiently, getting AWS data and GH simultaneously.
    // XXX revisit cardHandler to track all of this.  part of record.
    // XXX may be hole in create card from isssue
    // XXX card move, need new id/col/proj id
    // ??? how long will IDs last within project?  at a minimum, should get edit notification

    let card = await( utils.getFromIssue( installClient[1], issueId ));
    let projId = card == -1 ? card : parseInt( card['GHProjectId'] );
    
    console.log( installClient[1], "Found project id: ", projId );
    let foundReqCol = [projId, -1, -1, -1, -1];
    if( projId == -1 ) { return foundReqCol; }

    await( installClient[0].projects.listColumns({ project_id: projId, per_page: 100 }))
	.then( columns => {
	    let foundCount = 0;
	    for( column of columns['data'] ) {
		// console.log( "checking", column );
		let colName = column['name'];
		for( let i = 0; i < 4; i++ ) {
		    if( colName == config.PROJ_COLS[i] ) {
			if( foundReqCol[i+1] == -1 ) { foundCount++; }
			else                         { console.log( "Validate CE Project Layout found column repeat: ", config.PROJ_COLS[i] ); }
			foundReqCol[i+1] = column['id'];
			break;
		    }
		}
		// no need to check every col when required are found
		if( foundCount == 4 ) { break; }
	    }
	    // every required col must have been found by now
	    if( foundCount != 4 ) { foundReqCol[0] = -1; }
	})
	.catch( e => {
	    console.log( installClient[1], "Validate CE Project Layout failed.", e );
	});
    
    return foundReqCol;
}

// issueId?  then verify "plan".  no issueId?  then verify "allocation".  No legal move of accrue.
async function validatePEQ( installClient, repo, issueId, title, projId ) {
    let peq = -1;

    let peqType = "";
    if( issueId == -1 ) {
	peqType = "allocation";
	peq = await( utils.getPeqFromTitle( installClient[1], repo, projId, title ));
    }
    else {
	peqType = "plan";
	peq = await( utils.getPeq( installClient[1], issueId ));
    }

    if( peq != -1 && peq['GHIssueTitle'] == title && peq['PeqType'] == peqType && peq['GHRepo'] == repo)  {
	console.log( installClient[1], "validatePeq success" );
    }
    else {
	console.log( "... oops", peq['GHIssueTitle'], title, peq['PeqType'], "plan", peq['GHRepo'], repo );
    }
    return peq;
}

async function findCardInColumn( installClient, owner, repo, issueId, colId ) {

    let cardId = -1;
    let card = await( utils.getFromIssue( installClient[1], issueId ));
    if( card != -1 && parseInt( card['GHColumnId'] ) == colId ) { cardId = parseInt( card['GHCardId'] ); }

    console.log( installClient[1], "find card in col", issueId, colId, "found?", cardId );
    return cardId;
}


async function moveIssueCard( installClient, owner, repo, fullName, issueId, action, ceProjectLayout )
{
    let success    = false;
    let newColId   = -1;
    let newColName = "";
    assert.notEqual( ceProjectLayout[0], -1 );
    let cardID = -1;
    let pip = [ config.PROJ_PLAN, config.PROJ_PROG ];  
    let pac = [ config.PROJ_PEND, config.PROJ_ACCR ];  
    
    if( action == "closed" ) {

	// verify card is in the right place
	for( let i = 0; i < 2; i++ ) {
	    cardID = await findCardInColumn( installClient, owner, repo, issueId, ceProjectLayout[ pip[i]+1 ] );
	    if( cardID != -1 ) { break; }
	}

	// move card to "Pending PEQ Approval"
	if( cardID != -1 ) {
	    newColId   = ceProjectLayout[ config.PROJ_PEND + 1 ];   // +1 is for leading projId
	    newColName = config.PROJ_COLS[ config.PROJ_PEND ]; 
	    success = await( installClient[0].projects.moveCard({ card_id: cardID, position: "top", column_id: newColId }))
		.catch( e => {
		    console.log( installClient[1], "Move card failed.", e );
		});
	}
	
    }
    else if( action == "reopened" ) {

	// verify card is currently in the right place
	for( let i = 0; i < 2; i++ ) {
	    cardID = await findCardInColumn( installClient, owner, repo, issueId, ceProjectLayout[ pac[i]+1 ] );
	    if( cardID != -1 ) { break; }
	}

	// move card to "In Progress".  planned is possible if issue originally closed with something like 'wont fix' or invalid.
	if( cardID != -1 ) {
	    newColId   = ceProjectLayout[ config.PROJ_PROG + 1 ];
	    newColName = config.PROJ_COLS[ config.PROJ_PROG ]; 	    
	    success = await( installClient[0].projects.moveCard({ card_id: cardID, position: "top", column_id: newColId }))
		.catch( e => {
		    console.log( installClient[1], "Move card failed.", e );
		});
	}
    }

    if( success ) {
	success = await( utils.updateCardFromIssue( installClient[1], issueId, fullName, newColId, newColName ))
	    .catch( e => { console.log( installClient[1], "update card failed.", e ); });
    }

    
    return success;
}

async function getProjectName( installClient, projId ) {

    let project = await( installClient[0].projects.get({ project_id: projId }))
	.catch( e => {
	    console.log( installClient[1], "Get Project failed.", e );
	    return "";
	});

    return project['data']['name'];
}

async function getColumnName( installClient, colId ) {
    
    let column = await( installClient[0].projects.getColumn({ column_id: colId }))
	.catch( e => {
	    console.log( installClient[1], "Get Column failed.", e );
	    return "";
	});
    
    return column['data']['name'];
}

// This needs to occur after linkage is overwritten.
// Provide good subs no matter if using Master project indirection, or flat projects.
async function getProjectSubs( installClient, repoName, projName, colName ) {
    let projSub = [ "Unallocated" ];  // Should not occur.

    console.log( installClient[1], "Set up proj subs", repoName, projName, colName );
	
    if( projName == config.MAIN_PROJ ) { projSub = [ colName ]; }
    else {
	// Check if project is a card in Master
	let card = await( utils.getFromCardName( installClient[1], repoName, config.MAIN_PROJ, projName ));   
	if( card != -1 ) { projSub = [ card['GHColumnName'], projName ]; }
	else             { projSub = [ projName ]; }

	// If col isn't a CE organizational col, add to psub
	if( ! config.PROJ_COLS.includes( colName ) ) { projSub.push( colName ); }
    }
	    
    console.log( "... returning", projSub.toString() );
    return projSub;
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
	    console.log( "In alloc" );
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
	    console.log( "Found peq val in ", s, e, lineVal.substring(c, e) );
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
	    console.log( "Found peq val in", line.substring( pDescLen ) );
	    peqValue = parseInt( line.substring( pDescLen ) );
	    break;
	}
	else if( line.indexOf( config.ADESC ) == 0 ) {
	    console.log( "Found peq val in", line.substring( aDescLen ) );
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



// XXX 
// !!! Keep this, backend (githubIssueHandler) works.
//     remove this, remove load error for localHost
// ??  ifdef for window being global obj?
// ??  third by-hand step?  fug
exports.githubUtils = githubUtils;



