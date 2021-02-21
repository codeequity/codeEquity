var assert = require('assert');
var utils = require('../utils');


async function handler( ghLinks, ceJobs, reqBody, res ) {

    assert( reqBody.hasOwnProperty( "Request" ) );

    let retVal = -1;
    if( reqBody.Request == "getLinks" ) {
	retVal = ghLinks.links;
    }
    else if( reqBody.Request == "purgeLinks" ) {
	retVal = ghLinks.purge( reqBody.Repo );
    }
    else if( reqBody.Request == "purgeJobs" ) {
	// NOTE, this removes ALL pending jobs for FullName, including user, server and tester jobs.
	utils.purgeQueue( ceJobs );
    }
	
    return res
	.status(201)
	.json( retVal );
}

exports.handler = handler;
