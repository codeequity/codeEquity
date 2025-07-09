import assert from 'assert';

import * as ceAuth  from '../auth/ceAuth.js';

import * as ghV2    from '../utils/gh/gh2/ghV2Utils.js';


async function handler( hostLinks, reqBody, res ) {

    assert( reqBody.hasOwnProperty( "Request" ) );

    let retVal = -1;
    if(      reqBody.Request == "getBuilderPAT" ) { retVal = await ceAuth.getHostPAT( reqBody.host ); }
    else if( reqBody.Request == "getHPeqs" )      { retVal = await ghV2.getHostPeqs( reqBody.PAT, hostLinks, reqBody.host, reqBody.cepId, -1 ); }

    // console.log( "XXX ceMD handler returns", retVal );
    return res
	.status(201)
	.json( retVal );
}

export default handler;
