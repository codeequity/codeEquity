var assert = require('assert');



async function handler( ghLinks, reqBody, res ) {

    console.log( "Test Handler" );

    assert( reqBody.hasOwnProperty( "Request" ) );

    let retVal = -1;
    if( reqBody.Request == "getLinks" ) {
	retVal = ghLinks.links;
    }
	
    return res
	.status(201)
	.json( retVal );
}

exports.handler = handler;
