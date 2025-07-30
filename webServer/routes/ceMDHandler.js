import assert from 'assert';

import * as ceAuth  from '../auth/ceAuth.js';

import * as ghV2    from '../utils/gh/gh2/ghV2Utils.js';


async function handler( hostLinks, reqBody, res ) {

    assert( reqBody.hasOwnProperty( "Request" ) );

    let retVal = -1;
    if(      reqBody.Request == "getBuilderPAT" ) { retVal = await ceAuth.getHostPAT( reqBody.host ); }
    else if( reqBody.Request == "getHPeqs" )      { retVal = await ghV2.getHostPeqs( reqBody.PAT, hostLinks, reqBody.cepId ); }
    else if( reqBody.Request == "getHLocs" )      { retVal = await ghV2.getHostLoc( reqBody.PAT, reqBody.pid ); }
    else if( reqBody.Request == "createHLabel" )  { retVal = await ghV2.createPeqLabel( { pat: reqBody.PAT, who: "ceMD" }, reqBody.rid, reqBody.peqVal ); }
    else if( reqBody.Request == "getHAssigns" )   {
	retVal = [];
	await ghV2.getHostAssign( reqBody.PAT, reqBody.rid, retVal, -1 );
    }
    else if( reqBody.Request == "getHLabels" )   {
	retVal = [];
	await ghV2.getHostLabels( reqBody.PAT, reqBody.rid, retVal, -1 );
    }
    else {
	console.log( "WARNING.  CE MD Handler request not recognized" );
    }

    // console.log( "XXX ceMD handler returns", retVal );
    return res
	.status(201)
	.json( retVal );
}

export default handler;
