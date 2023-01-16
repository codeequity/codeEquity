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
	if( data.edges.length > 99 ) { console.log( "WARNING.  Detected a very large number of projectItems.  Ignoring some." ); }
	for( let i = 0; i < data.edges.length; i++ ) {
	    let project = data.edges[i];
	    if( typeof project.id !== 'undefined' ) {
		found = true;
		break;
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

// Add linkage data for all carded issues in a new project, then resolve to guarantee 1:1
// 
// This occurs once only per repo, preferably when CE usage starts.
// Afterwards, if a newborn issue adds a card, cardHandler will pick it up.
// Afterwards, if a newborn issue adds peqlabel, create card, cardHandler will pick it up.
// Afterwards, if a newborn card converts to issue, pick it up in issueHandler
async function populateCELinkage( authData, ghLinks, pd )
{
    console.log( authData.who, "Populate CE Linkage start" );
    // Wait later
    let origPop = awsUtils.checkPopulated( authData, pd.CEProjectId );

    // XXX this does more work than is needed - checks for peqs which only exist during testing.
    const proj = await awsUtils.getProjectStatus( authData, pd.CEProjectId );
    let linkage = await ghLinks.initOneProject( authData, proj );

    // At this point, we have happily added 1:m issue:card relations to linkage table (no other table)
    // Resolve here to split those up.  Normally, would then worry about first time users being confused about
    // why the new peq label applied to their 1:m issue, only 'worked' for one card.
    // But, populate will be run from ceFlutter, separately from actual label notification.
    pd.peqType    = "end";
    
    // Only resolve once per issue.  Happily, PV2 gql model has reverse links from issueContentId to cards (pvti_* node ids)
    // Note: allCards are still raw: [ {node: {id:}}, {{}}, ... ]
    // Note: linkage is also raw.. XXX unify naming?
    // Note: GH allows an issue to have multiple locations, but only 1 per host project.
    //       A ceProject may have multiple host projects, linkage is per ceProject, iteration to create linkage is per card, so issueContent may show up twice.
    let promises = [];
    for( link in linkage ) {
	if( typeof link.duplicate === 'undefined' ) {
	    if( link.allCards.length > 1 ) {
		console.log( "Found link with multiple cards", link );
		pd.issueId  = link.issueId;
		pd.issueNum = link.issueNum;
		let pdCopy = new gh2Data.copyCons( pd );
		promises.push( resolve( authData, ghLinks, pdCopy, "???" ) );
	    }
	}
	// mark duplicates
	linkage.forEach(l => if( l.issueId == link.issueId ) { l.duplicate = true; } );
    }
    await Promise.all( promises );

    origPop = await origPop;  // any reason to back out of this sooner?
    assert( !origPop );
    // Don't wait.
    awsUtils.setPopulated( authData, pd.CEProjectId );
    console.log( authData.who, "Populate CE Linkage Done" );
    return true;
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


exports.errorHandler = errorHandler;
exports.postGH       = postGH;

exports.checkForPV2     = checkForPV2;
exports.populateRequest = populateRequest;

exports.parseLabelDescr = parseLabelDescr;
exports.parseLabelName  = parseLabelName;
exports.getAllocated    = getAllocated;
exports.theOnePEQ       = theOnePEQ;
