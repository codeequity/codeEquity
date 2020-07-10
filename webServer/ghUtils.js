var config  = require('./config');
var assert = require('assert');

var githubUtils = {

    zoink: function() {
	return poink();
    },

    getColumns: function( ownerId, repoId ) {
	return columnInfo( ownerId, repoId );
    },

    parsePEQ: function( cardContent ) {
	return parsePEQ( cardContent );
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


// XXX ==>  utils
function parsePEQ( content ) {
    let peqValue = 0;
    console.log( "Looking for planned PEQ" );
    for( const line of content ) {
	let s =  line.indexOf( config.PEQ_ );

	if( s > -1 ){
	    let lineVal = line.substring( s );
	    let e = lineVal.indexOf( ">" );
	    if( e == -1 ) {
		console.log( "Malformed peq" );
		break;
	    }
	    let numStart = config.PEQ_.length;
	    console.log( "Found peq val in ", s, e, lineVal.substring(numStart, e) );
	    peqValue = parseInt( lineVal.substring( numStart, e ) );
	    console.log( peqValue );
	    break;
	}
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



