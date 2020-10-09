var config  = require('./config');
var utils = require('./utils');
var assert = require('assert');

var githubUtils = {

    zoink: function() {
	return poink();
    },

    getColumns: function( ownerId, repoId ) {
	return columnInfo( ownerId, repoId );
    },

    getAllocated: function( cardContent ) {
	return getAllocated( cardContent );
    },

    parsePEQ: function( cardContent, allocation ) {
	return parsePEQ( cardContent, allocation );
    },

    parseHumanPEQ: function( labels ) {
	return parseHumanPEQ( labels );
    },

    checkIssueExists: function( installClient, owner, repo, title ) {
	return checkIssueExists( installClient, owner, repo, title );
    },
    
    findOrCreateLabel: function( installClient, owner, repo, peqHumanLabelName, peqValue ) {
	return findOrCreateLabel( installClient, owner, repo, peqHumanLabelName, peqValue );
    },

    createIssue: function( installClient, owner, repo, title, labels ) {
	return createIssue( installClient, owner, repo, title, labels );
    },

    createIssueCard: function( installClient, columnID, issueID ) {
	return createIssueCard( installClient, columnID, issueID );
    },

    validateCEProjectLayout: function( installClient, issueId ) {
	return validateCEProjectLayout( installClient, issueId );
    },

    moveIssueCard: function( installClient, owner, repo, issueId, action, ceProjectLayout ) {
	return moveIssueCard( installClient, owner, repo, issueId, action, ceProjectLayout ); 
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


async function checkIssueExists( installClient, owner, repo, title )
{
    let retVal = false;

    // Issue with same title may already exist, in which case, check for label, then point to that issue.
    await( installClient.issues.listForRepo( { owner: owner, repo: repo }))
	.then( issues => {
	    for( issue of issues['data'] ) {
		if( issue['title'] == title ) {
		    retVal = true;
		    break;
		}
	    }
	})
	.catch( e => {
	    console.log( "Problem in checkIssueExists", e );
	});
    return retVal;
}


async function findOrCreateLabel( installClient, owner, repo, peqHumanLabelName, peqValue )
{
    // does label exist 
    let peqLabel = "";
    let status = 200;
    await( installClient.issues.getLabel( { owner: owner, repo: repo, name: peqHumanLabelName }))
	.then( label => {
	    peqLabel = label['data'];
	})
	.catch( e => {
	    status = e['status'];
	    if( status != 404 ) {
		console.log( "Get label failed.", e );
	    }
	});
    
    // if not, create
    if( status == 404 ) {
	console.log( "Not found, creating.." );
	let descr = "PEQ value: " + peqValue.toString();
	await( installClient.issues.createLabel( { owner: owner, repo: repo,
						   name: peqHumanLabelName, color: config.PEQ_COLOR,
						   description: descr }))
	    .then( label => {
		peqLabel = label['data'];
	    })
	    .catch( e => {
		console.log( "Create label failed.", e );
	    });
    }

    assert.notStrictEqual( peqLabel, undefined, "Did not manage to find or create the PEQ label" );
    return peqLabel;
}


async function createIssue( installClient, owner, repo, title, labels )
{
    let issueID = -1;
    
    // NOTE: will see several notifications are pending here, like issue:open, issue:labelled
    await( installClient.issues.create( { owner: owner, repo: repo, title: title, labels: labels } ))
	.then( issue => {
	    issueID = issue['data']['id'];
	})
	.catch( e => {
	    console.log( "Create issue failed.", e );
	});
    
    return issueID;
}

async function createIssueCard( installClient, columnID, issueID )
{
    let newCardID = -1;

    await( installClient.projects.createCard({ column_id: columnID, content_id: issueID, content_type: 'Issue' }))
	.then( card => {
	    newCardID = card['data']['id'];
	})
	.catch( e => {
	    console.log( "Create issue-linked card failed.", e );
	});
    
    return newCardID;
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

    // XXX Push these to config?
    let reqCols = ["Planned", "In Progress", "Pending PEQ Approval", "Accrued" ];

    let card = await( utils.getFromIssue( issueId ));
    let projId = card == -1 ? card : parseInt( card['GHProjectId'] );
    
    console.log( "Found project id: ", projId );
    let foundReqCol = [projId, -1, -1, -1, -1];
    if( projId == -1 ) { return foundReqCol; }

    await( installClient.projects.listColumns({ project_id: projId, per_page: 100 }))
	.then( columns => {
	    let foundCount = 0;
	    for( column of columns['data'] ) {
		// console.log( "checking", column );
		let colName = column['name'];
		for( let i = 0; i < 4; i++ ) {
		    if( colName == reqCols[i] ) {
			if( foundReqCol[i+1] == -1 ) { foundCount++; }
			else                         { console.log( "Validate CE Project Layout found column repeat: ", reqCols[i] ); }
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
	    console.log( "Validate CE Project Layout failed.", e );
	});
    
    return foundReqCol;
}

async function findCardInColumn( installClient, owner, repo, issueId, colId ) {

    let cardId = -1;
    let card = await( utils.getFromIssue( issueId ));
    if( card != -1 && parseInt( card['GHColumnId'] ) == colId ) { cardId = parseInt( card['GHCardId'] ); }

    /*
    // pre-AWS
    // THIS WILL NOT SCALE
    let issueNums = [];
    let cardIDs   = [];
    await( installClient.projects.listCards({ column_id: colID, per_page: 100 }))
	.then( cards => {
	    for( card of cards['data'] ) {
		if( card['content_url'] ) {
		    console.log( "Checking card", card['content_url'] );
		    let issuePath = card['content_url'].split('/');
		    issueNums.push( issuePath[ issuePath.length - 1 ] );
		    cardIDs.push( card['id'] );
		}
	    }
	})
	.catch( e => {
	    console.log( "Find card in column failed.", e );
	});

    for( let i = 0; i < issueNums.length; i++ ) {
	let issueNum = issueNums[i];
	await( installClient.issues.get({ owner: owner, repo: repo, issue_number: issueNum } ))
	    .then( issue => {
		console.log( "Checking", issue['data']['title'] );
		if( target == issue['data']['title'] ) {
		    cardID = cardIDs[i];
		}
	    })
	    .catch( e => {
		console.log( "Find issue from card url failed.", e );
	    });
	if( cardID != -1 ) { break; }
	}
    */
    
    console.log( "find card in col", issueId, colId, "found?", cardId );
    return cardId;
}


async function moveIssueCard( installClient, owner, repo, issueId, action, ceProjectLayout )
{
    let success = false;
    let newColId = -1;
    assert.notEqual( ceProjectLayout[0], -1 );
    let cardID = -1;

    if( action == "closed" ) {

	// verify card is currently in column "Planned" or "In Progress"
	for( let i = 0; i < 2; i++ ) {
	    cardID = await findCardInColumn( installClient, owner, repo, issueId, ceProjectLayout[i+1] );
	    if( cardID != -1 ) { break; }
	}

	// XXX ENUM, pls
	// move card to "Pending PEQ Approval"
	if( cardID != -1 ) {
	    newColId = ceProjectLayout[3]
	    success = await( installClient.projects.moveCard({ card_id: cardID, position: "top", column_id: newColId }))
		.catch( e => {
		    console.log( "Move card failed.", e );
		});
	}
	
    }
    else if( action == "reopened" ) {

	// verify card is currently in column ""Pending PEQ Approval", "Accrued"
	for( let i = 0; i < 2; i++ ) {
	    cardID = await findCardInColumn( installClient, owner, repo, issueId, ceProjectLayout[i+3] );
	    if( cardID != -1 ) { break; }
	}

	// move card to "In Progress".  planned is possible if issue originally closed with something like 'wont fix' or invalid.
	if( cardID != -1 ) {
	    newColId = ceProjectLayout[2]
	    success = await( installClient.projects.moveCard({ card_id: cardID, position: "top", column_id: newColId }))
		.catch( e => {
		    console.log( "Move card failed.", e );
		});
	}
    }

    if( success ) {
	success = await( utils.updateCardFromIssue( issueId, newColId ))
	    .catch( e => { console.log( "update card failed.", e ); });
    }

    
    return success;
}

async function getProjectName( installClient, projId ) {

    let project = await( installClient.projects.get({ project_id: projId }))
	.catch( e => {
	    console.log( "Get Project failed.", e );
	    return "";
	});

    return project['data']['name'];
}

async function getColumnName( installClient, colId ) {

    let column = await( installClient.projects.getColumn({ column_id: colId }))
	.catch( e => {
	    console.log( "Get Column failed.", e );
	    return "";
	});
    
    return column['data']['name'];
}

// XXX app will need to allow moving unallocated around - will be lots of misses.
// If Master has already been created, with sub projects, then aws lookup will work.
// If not, then neither aws nor GH lookup will work, since project layout will probably not be valid
// Safer from aws as well - known if need to be unallocated
async function getProjectSubs( installClient, repoName, projName, colId ) {
    let projSub = [ "Unallocated" ];

    if( projName == "Master" ) {
	let column = await( getColumnName( installClient, colId ) );
	if( column == "" ) { return projSub; }
	projSub = [ column ];
    }
    else {
	let subName = "Sub: " + projName;
	let card = await( utils.getFromCardName( repoName, "Master", subName ));    // xxx config const
	if( card != -1 ) { projSub = [ card['GHColumnName'], projName ]; }
    }
    
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
//  <allocated, PEQ: 1000>
//  <allocated, PEQ: 1,000>
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
	    console.log( "In plan" );
	    s = line.indexOf( config.PPLAN );
	    c = config.PPLAN.length;
	}

	if( s > -1 ){
	    let lineVal = line.substring( s );
	    console.log( "Looking for peq in", s, c, lineVal );
	    let e = lineVal.indexOf( ">" );
	    if( e == -1 ) {
		console.log( "Malformed peq" );
		break;
	    }
	    console.log( "Found peq val in ", s, e, lineVal.substring(c, e) );
	    // js parseint doesn't like commmas
	    peqValue = parseInt( lineVal.substring( c, e ).split(",").join("") );
	    console.log( peqValue );
	    break;
	}
	else {  console.log( "PEQ value not found" ); }
    }
    return peqValue;
}

// XXX remove in favor of above
function parseHumanPEQ( labels ) {
    let peqValue = 0;

    for( label of labels ) {
	let content = label['name'];
	let e =  content.indexOf( config._PEQ );
	console.log( "PEQ?", content, e, config._PEQ );

	if( e > -1 ){
	    let lineVal = content.substring( 0, e );
	    
	    // XXX
	    // Find number formatted as one of { '1000', '1,000', '1k' }
	    peqValue = 100;
	    console.log( peqValue );
	}
	if( peqValue > 0 ) { break; }
    }

    return peqValue;
}

function columnInfo( ownerId, repoId ) {
    console.log( "Cols et. al.", ownerId, repoId );
    
}

function poink() {
    console.log( "ZOINK your PEQ!" );
}








// XXX 
// !!! Keep this, backend (githubIssueHandler) works.
//     remove this, remove load error for localHost
// ??  ifdef for window being global obj?
// ??  third by-hand step?  fug
exports.githubUtils = githubUtils;



