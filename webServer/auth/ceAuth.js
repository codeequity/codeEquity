import * as awsAuth from './aws/awsAuth.js';
import * as config from '../config.js';

import * as gha from './gh/ghAuth.js';


// Sit here to allow a separate test process to run without creating a new ceServer.
// When this resided in ceRouter, testMain's new linkage would try creating a new ceServer just to get auths.
// Called from host handlers, switchers.  Mainly to allow refreshing host-independent tokens
async function getAuths( authData, host, pms, org, actor ) {
    // Cognito auth token expires every hour.  Can make it last longer if needed..
    const stamp = Date.now();
    if( stamp - authData.cogLast > 3500000 ) {
	console.log( "********  Old cognito auth.. refreshing." );
	authData.cog = await awsAuth.getCogIDToken();	
	authData.cogLast = Date.now();
    }

    if( host == config.HOST_GH ) { await gha.getAuths( authData, pms, org, actor ); }
}

export {getAuths};
