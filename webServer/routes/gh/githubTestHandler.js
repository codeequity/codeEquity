import assert from 'assert';

import * as ceRouter from '../../routes/ceRouter.js';
import * as awsUtils from '../../utils/awsUtils.js';
import * as ghUtils  from '../../utils/gh/ghUtils.js';

async function handler( ghLinks, ceJobs, ceProjects, ceNotification, reqBody, res ) {

    assert( reqBody.hasOwnProperty( "Request" ) );

    let retVal = -1;
    if( reqBody.Request == "getLinks" ) {
	retVal = ghLinks.links;
    }
    // use ONLY to verify test outcome in CE before performing dependent step.
    else if( reqBody.Request == "getLocs" ) {
	// console.log( "Test handler returning locs" );
	retVal = ghLinks.locs;
    }
    // use ONLY to verify test outcome in CE before performing dependent step.
    else if( reqBody.Request == "getNotices" ) {  
	retVal = ceNotification;
    }
    else if( reqBody.Request == "purgeLinks" ) {
	retVal = ghLinks.purge( reqBody.CEProjectId, reqBody.HostRepoId );
    }
    else if( reqBody.Request == "purgeJobs" ) {
	// NOTE, this removes ALL pending jobs for FullName, including user, server and tester jobs.
	ceRouter.purgeQueue( ceJobs );
    }
    else if( reqBody.Request == "linkProject" ) {
	retVal = await ghLinks.linkProject( reqBody.auth, reqBody.ceProjId, reqBody.pid );
    }
    else if( reqBody.Request == "unlinkProject" ) {
	retVal = await ghLinks.unlinkProject( reqBody.auth, ceProjects, reqBody.ceProjId, reqBody.pid, reqBody.rNodeId );
    }
    else if( reqBody.Request == "linkRepo" ) {
	retVal = await ghLinks.linkRepo( reqBody.auth, ceProjects, reqBody.ceProjId, reqBody.rNodeId, reqBody.rName, reqBody.cepDetails );
    }
    else if( reqBody.Request == "unlinkRepo" ) {
	retVal = await ghLinks.unlinkRepo( reqBody.auth, ceProjects, reqBody.ceProjId, reqBody.rNodeId );
    }
    else if( reqBody.Request == "showCallCounts" ) {
	retVal = true;
	ghUtils.show( reqBody.full );
	awsUtils.show( reqBody.full );
    }
	
    return res
	.status(201)
	.json( retVal );
}

// exports.handler = handler;
export default handler;
