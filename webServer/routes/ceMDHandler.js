import assert from 'assert';

import * as ceAuth  from '../auth/ceAuth.js';

async function handler( reqBody, res ) {

    assert( reqBody.hasOwnProperty( "Request" ) );

    let retVal = -1;
    if( reqBody.Request == "getBuilderPAT" ) { retVal = await ceAuth.getHostPAT( reqBody.host ); }

    // console.log( "XXX ceMD handler returns", retVal );
    return res
	.status(201)
	.json( retVal );
}

export default handler;
