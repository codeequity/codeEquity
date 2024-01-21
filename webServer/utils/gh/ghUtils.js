const assert  = require( 'assert' );
const fetch = require( 'node-fetch' );

const config = require( '../../config' );

const utils    = require( '../ceUtils' );
const awsUtils = require( '../awsUtils' );

var handlerRetries = {}; 
var postRecord = {}; 


function show( full ) {
    full =  typeof full === 'undefined' ? false : full;

    let arr = [];
    for( const [name, count] of Object.entries( postRecord )) {
	arr.push( [name, count] );
    }

    arr.sort( (a,b) => b[1] - a[1] );

    console.log( "-------------" );
    let tot = 0;
    for( let i = 0; i < arr.length; i++ ) {
	if( full || i < 4 ) { console.log( arr[i][0], arr[i][1] ); }
	tot = tot + arr[i][1]
    }
    console.log( "Total postGH calls:", tot );
    console.log( "-------------" );
}

async function postGH( PAT, url, postData, name, check422 ) {
    if( typeof check422 === 'undefined' ) { check422 = false; }

    // if( typeof name === 'undefined' ) { console.log( "uh oh", postData ); }
    // assert( typeof name !== 'undefined' );

    if( typeof postRecord[name] === 'undefined' ) { postRecord[name] = 0; }
    postRecord[name] = postRecord[name] + 1;

    // Accept header is for label 'preview'.
    const params = {
	method: "POST",
        headers: {'Authorization': 'bearer ' + PAT, 'Accept': "application/vnd.github.bane-preview+json" },
	body: postData 
    };

    let ret = "";
    
    // Don't bother with testing only queries    
    if( utils.TEST_EH && !postData.includes( "mutation" ) && Math.random() < utils.TEST_EH_PCT ) {
	console.log( "Err.  Fake internal server err for GQL." );
	ret = utils.FAKE_ISE;
    }
    else {
	ret = await fetch( url, params )
	    .catch( e => { console.log("Fetch failed.", e); throw e; });

	ret = await ret.json();
    }
    
    // Oddly, some GQl queries/mutations return with a status, some do not.
    if( typeof ret !== 'undefined' ) {
	// can not do this, as many valid gql queries will ask for, say, orgId and userId, fully expecting one to fail.
	// if( utils.validField( ret, "errors" ))                                  { ret.status = 422; }
	if( typeof ret.data !== 'undefined' && typeof ret.status === 'undefined' ) { ret.status = 200; }
    }
    
    // Throw?
    let throwMe = false;
    throwMe     = throwMe || !utils.validField( ret, "status" );                                       // don't have valid status
    throwMe     = throwMe || ret.status != 200;                                                        // bad status
    let have422 = !throwMe && check422 && typeof ret.errors !== 'undefined';                           
    throwMe     = throwMe || have422;                                                                  // have 422
    
    if( have422 ) { ret.status = 422; }
    if( throwMe ) { throw ret; }

    return ret;
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
    else if( e.status == 401 ||                             // authorization will probably keep failing
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
	    console.log( "Err Handler Status:", handlerRetries );
	    return await func( ...params );
	}
	else { console.log( "Error.  Retries exhausted, command failed.  Please try again later." ); }
    }
    else if( e.status == 422 ) {
	console.log( "Semantic error, unlikely to repair upon retry.", source, e );
    }
    else {
	console.log( "Error in errorHandler, unknown status code. Bad GQL argument construction?", source, e );
	console.log( arguments[0], arguments[1] );
    }
    return false;
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
	// read "k" or "M" to make up for GH no longer allowing comma's in label names (big numbers became unreadable)
	let unit = splits[0].slice(-1);
	peqValue = ( unit == "M" || unit == "k" ) ? parseFloat( splits[0].slice(0,-1) ) : parseInt( splits[0] );
	peqValue = ( unit == "M" )                ? peqValue * 1000000 : peqValue;
	peqValue = (                unit == "k" ) ? peqValue * 1000    : peqValue;
	
	alloc = splits[1] == config.ALLOC_LABEL;
    }
    return [peqValue, alloc];
}

// Allocation PEQ value         typical by resolve description & existing label description
function getAllocated( content ) {
    let res = false;
    for( const line of content ) {
	let s = line.indexOf( config.ADESC );  // existing label desc
	if( s > -1 ){ res = true; break; }

	s = line.indexOf( config.PALLOC );      // by hand entry
	if( s > -1 ){ assert( false ); res = true; break; }
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
		console.log( "Two PEQ labels detected for this issue.  Negotiation?" );
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

    // console.log( "GetOwnerId", PAT, owner );
    
    let retId = -1;
    try{ 
	await postGH( PAT, config.GQL_ENDPOINT, query, "getOwnerId" )
	    .then( ret => {
		if( ret.status != 200 ) { throw ret; }
		if ( utils.validField( ret, "data" ) && (utils.validField( ret.data, "user" ) || utils.validField( ret.data, "organization" ))) {
		    if( !!ret.data.user ) { retId = ret.data.user.id; }
		    else                  { retId = ret.data.organization.id; }
		}
	    })
    }
    catch( e ) { retId = await errorHandler( "getOwnerId", e, getOwnerId, PAT, owner ); }

    return retId;
}

async function getRepoId( PAT, owner, repo ) {
    let query       = `query getRepo($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { id } }`;
    const variables = {"owner": owner, "repo": repo};

    query = JSON.stringify({ query, variables });

    let retId = -1;
    try {
	await postGH( PAT, config.GQL_ENDPOINT, query, "getRepoId" )
	    .then( ret => {
		if( ret.status != 200 ) { throw ret; }
		if( utils.validField( ret, "data" ) && utils.validField( ret.data, "repository" )) { retId = ret.data.repository.id; }
	    })
    }
    catch( e ) { retId = await errorHandler( "getRepoId", e, getRepoId, PAT, owner, repo ); }

    return retId;
}

async function getIssueRepo( authData, issueId ) {
    // console.log( authData.who, "Get Issue's repo", issueId );

    let query = `query( $id:ID! ) {
                   node( id: $id ) {
                   ... on Issue {
                     repository { id nameWithOwner }
                  }}}`;

    let variables = {"id": issueId};
    let queryJ    = JSON.stringify({ query, variables });

    let repo = {};
    try{ 
	await postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "getIssueRepo" )
	    .then( ret => {
		if( !utils.validField( ret, "status" ) || ret.status != 200 ) { throw ret; }
		let issue = ret.data.node;
		repo.id   = issue.repository.id;
		repo.name = issue.repository.nameWithOwner;
	    })
    }
    catch( e ) { repo = await errorHandler( "getIssueRepo", e, getIssueRepo, authData, issueId ); }

    return repo;
}


exports.postGH       = postGH;
exports.errorHandler = errorHandler;

exports.parseLabelDescr = parseLabelDescr;
exports.parseLabelName  = parseLabelName;
exports.getAllocated    = getAllocated;
exports.theOnePEQ       = theOnePEQ;

exports.getOwnerId      = getOwnerId;
exports.getRepoId       = getRepoId;
exports.getIssueRepo    = getIssueRepo;

exports.show            = show;
