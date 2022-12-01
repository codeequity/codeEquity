const fetch = require( 'node-fetch' );

const utils = require( '../ceUtils' );



async function postGH( PAT, url, postData ) {
    const params = {
	method: "POST",
        headers: {'Authorization': 'bearer ' + PAT },
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
    
    return await ret.json();
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
	return false;
    }
    else if( (e.status == 403 || e.status == 404) && ( source == "removeLabel" || source == "getLabels" || source == "addComment" ))
    {
	console.log( source, "Issue", arguments[6], "may already be gone, can't remove labels or add comments." );
	return false;
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
}


exports.errorHandler = errorHandler;
exports.postGH       = postGH;
