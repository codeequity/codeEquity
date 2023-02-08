const fetch = require( 'node-fetch' );

const config = require( '../../config' );

const utils = require( '../ceUtils' );

// XXX Accept header is for label preview.  Check back to delete.
async function postGH( PAT, url, postData ) {
    const params = {
	method: "POST",
        headers: {'Authorization': 'bearer ' + PAT, 'Accept': "application/vnd.github.bane-preview+json" },
	body: postData 
    };

    if( utils.TEST_EH ) {
	// Don't bother with testing only queries
	if( !postData.includes( "mutation" ) && Math.random() < utils.TEST_EH_PCT ) {
	    console.log( "Error.  Fake internal server error for GQL.", postData );
	    return utils.FAKE_ISE;
	}
    }

    let gotchya = false;
    let ret = await fetch( url, params )
	.catch( e => { gotchya = true; console.log(e); return e; });

    // XXX Still waiting to see this.. 
    if( gotchya ) { let x = await ret.json(); console.log( "Error.  XXXXXXXXXXXXXX got one!", x, ret ); }

    // Oddly, some GQl queries/mutations return with a status, some do not.
    ret = await ret.json();
    if( typeof ret !== 'undefined' && typeof ret.status === 'undefined' ) {
	if( typeof ret.data !== 'undefined' ) { ret.status = 200; }
    }
    
    return ret;
}


// GQL queries can return null field values that hurt when checking a chain
function validField( arr, field ) {
    return arr.hasOwnProperty( field ) && !!arr[field] && typeof arr[field] !== 'undefined';
}


// NOTE.  This is very simplistic.  Consider at least random backoff delay, elay entire chain.
// Ignore:
//   422:  validation failed.  e.g. create failed name exists.. chances are, will continue to fail.
async function errorHandler( source, e, func, ...params ) {
    if( ( e.status == 404 && source == "checkIssue" ) ||    
	( e.status == 410 && source == "checkIssue" ))
    {
	console.log( source, "Issue", arguments[6], "already gone" );  
	return -1;
    }
    else if( e.status == 423 )
    {
	console.log( "Error.  XXX", source, "There was a conflict accessing a PEQ in the PEQ table in AWS.", params );
    }
    else if( e.status == 404 && source == "updateLabel" )
    {
	console.log( source, "Label", arguments[6], "already gone" );  
    }
    else if( (e.status == 403 || e.status == 404) && ( source == "removeLabel" || source == "getLabels" || source == "addComment" ))
    {
	console.log( source, "Issue", arguments[6], "may already be gone, can't remove labels or add comments." );
    }
    else if( e.status == 401 ||                             // XXX authorization will probably keep failing
	     e.status == 500 ||                             // internal server error, wait and retry
	     e.status == 502 )                              // server error, please retry       
    {
	// manage retries
	if( typeof handlerRetries === 'undefined' )            { handlerRetries = {}; }
	if( !handlerRetries.hasOwnProperty( source ) )         { handlerRetries[source] = {}; }
	
	if( !handlerRetries[source].hasOwnProperty( 'stamp' )) { handlerRetries[source].stamp = Date.now(); }
	if( !handlerRetries[source].hasOwnProperty( 'count' )) { handlerRetries[source].count = 0; }

	if( Date.now() - handlerRetries[source].stamp > 5000 ) { handlerRetries[source].count = 0; }
	
	if( handlerRetries[source].count <= 4 ) {
	    console.log( "Github server troubles with", source, e );
	    console.log( "Retrying", source, handlerRetries[source].count );
	    handlerRetries[source].count++;
	    handlerRetries[source].stamp = Date.now();
	    console.log( "Error Handler Status:", handlerRetries );
	    return await func( ...params );
	}
	else { console.log( "Error.  Retries exhausted, command failed.  Please try again later." ); }
    }
    else {
	console.log( "Error in errorHandler, unknown status code.", source, e );
	console.log( arguments[0], arguments[1] );
    }
    return false;
}


// githubRouter needs to know how to switch a content notice.
// This helper function looks to see if the nodeId (of an issue) is part of a PV2 project.
async function checkForPV2( PAT, nodeId ) {
    const query = `query detail($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on ProjectV2ItemContent { 
          ... on Issue {
            projectItems(first: 100) {
              edges{ node{ 
                ... on ProjectV2Item {
                  project { id }
            }}}}
    }}}}`;

    let variables = {"nodeId": nodeId };
    let queryJ = JSON.stringify({ query, variables });

    let found = false;
    const ret = await postGH( PAT, config.GQL_ENDPOINT, queryJ )
	.catch( e => errorHandler( "getProjectFromNode", e, getProjectFromNode, PAT, nodeId ));  // this will probably never catch anything

    // XXX postGH masks errors, catch here.  eliminate need for this step
    if( typeof ret !== 'undefined' && typeof ret.data === 'undefined' ) {
	await errorHandler( "getProjectFromNode", ret, getProjectFromNode, PAT, nodeId ); 
    }
    else {
	let data = ret.data.node.projectItems;
	if( typeof data !== 'undefined' && typeof data.edges !== 'undefined' ) {
	    if( data.edges.length > 99 ) { console.log( "WARNING.  Detected a very large number of projectItems.  Ignoring some." ); }
	    for( let i = 0; i < data.edges.length; i++ ) {
		let project = data.edges[i];
		if( typeof project.id !== 'undefined' ) {
		    found = true;
		    break;
		}
	    }
	}
    }

    return found;

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



// no commas, no shorthand, just like this:  'PEQ value: 500'  or 'Allocation PEQ value: 30000'
function parseLabelDescr( labelDescr ) {
    let peqValue = 0;
    let pDescLen = config.PDESC.length;
    let aDescLen = config.ADESC.length;

    for( const line of labelDescr ) {
	// malformed labels can have a null entry here
	if( !line ) { return peqValue; }
	
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

// '500 PEQ'  or '500 AllocPEQ'
function parseLabelName( name ) {
    let peqValue = 0;
    let alloc = false;
    let splits = name.split(" ");
    if( splits.length == 2 && ( splits[1] == config.ALLOC_LABEL || splits[1] == config.PEQ_LABEL )) {
	peqValue = parseInt( splits[0] );
	alloc = splits[1] == config.ALLOC_LABEL;
    }
    return [peqValue, alloc];
}

// Allow:
// <allocation, PEQ: 1000>      typical by hand description
// <allocation, PEQ: 1,000>
// <allocation, PEQ: 1,000>
// Allocation PEQ value         typical by resolve description & existing label description
function getAllocated( content ) {
    let res = false;
    for( const line of content ) {
	let s = line.indexOf( config.ADESC );  // existing label desc
	if( s > -1 ){ res = true; break; }

	s = line.indexOf( config.PALLOC );      // by hand entry
	if( s > -1 ){ res = true; break; }
    }
    return res;
}


function theOnePEQ( labels ) {
    let peqValue = 0;
    let alloc = false;

    for( const label of labels ) {
	let content = label['description'];
	let tval = parseLabelDescr( [content] );
	let talloc = getAllocated( [content] );

	if( tval > 0 ) {
	    if( peqValue > 0 ) {
		console.log( "Two PEQ labels detected for this issue!!" );
		peqValue = 0;
		alloc = false;
		break;
	    }
	    else {
		peqValue = tval;
		alloc = talloc;
	    }
	}
    }

    return [peqValue, alloc];
}

// This needs to work for both users and orgs
async function getOwnerId( PAT, owner ) {
    let query       = `query ($login: String!) { user(login: $login) { id } organization(login: $login) { id } }`;
    const variables = {"login": owner};

    query = JSON.stringify({ query, variables });

    let retId = -1;
    await postGH( PAT, config.GQL_ENDPOINT, query )
	.then( ret => {
	    if( ret.status != 200 ) { throw ret; }
	    if ( validField( ret, "data" ) && validField( ret.data, "user" ) && validField( ret.data, "organization" )) {
		if( !!ret.data.user ) { retId = ret.data.user.id; }
		else                  { retId = ret.data.organization.id; }
	    }
	})
	.catch( e => retId = errorHandler( "getOwnerId", e, getOwnerId, PAT, owner ));

    return retId;
}

async function getRepoId( PAT, owner, repo ) {
    let query       = `query getRepo($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { id } }`;
    const variables = {"owner": owner, "repo": repo};

    query = JSON.stringify({ query, variables });

    let retId = -1;
    await postGH( PAT, config.GQL_ENDPOINT, query )
	.then( ret => {
	    if( ret.status != 200 ) { throw ret; }
	    if( validField( ret, "data" ) && validField( ret.data, "repository" )) { retId = ret.data.repository.id; }
	})
	.catch( e => retId = errorHandler( "getRepoId", e, getRepoId, PAT, owner, repo ));

    return retId;
}


exports.postGH       = postGH;
exports.validField   = validField;
exports.errorHandler = errorHandler;

exports.checkForPV2     = checkForPV2;

exports.populateRequest   = populateRequest;

exports.parseLabelDescr = parseLabelDescr;
exports.parseLabelName  = parseLabelName;
exports.getAllocated    = getAllocated;
exports.theOnePEQ       = theOnePEQ;

exports.getOwnerId      = getOwnerId;
exports.getRepoId       = getRepoId;
