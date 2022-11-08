const assert   = require( 'assert' );
const ceRouter = require( './ceRouter' );

async function handler( ghLinks, ceJobs, ceNotification, reqBody, res ) {

    assert( reqBody.hasOwnProperty( "Request" ) );

    let retVal = -1;
    if( reqBody.Request == "getLinks" ) {
	retVal = ghLinks.links;
    }
    // use ONLY to verify test outcome in CE before performing dependent step.
    else if( reqBody.Request == "getLocs" ) {
	retVal = ghLinks.locs;
    }
    // use ONLY to verify test outcome in CE before performing dependent step.
    else if( reqBody.Request == "getNotices" ) {  
	retVal = ceNotification;
    }
    else if( reqBody.Request == "purgeLinks" ) {
	retVal = ghLinks.purge( reqBody.Repo );
    }
    else if( reqBody.Request == "purgeJobs" ) {
	// NOTE, this removes ALL pending jobs for FullName, including user, server and tester jobs.
	ceRouter.purgeQueue( ceJobs );
    }
	
    return res
	.status(201)
	.json( retVal );
}

exports.handler = handler;
