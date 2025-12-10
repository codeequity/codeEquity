import assert from 'assert';

import * as config  from '../config.js';

import * as ceAuth  from '../auth/ceAuth.js';

import * as ghV2    from '../utils/gh/gh2/ghV2Utils.js';

import * as aws     from '../utils/awsUtils.js';


async function handler( ceJobs, reqBody, res ) {

    assert( reqBody.hasOwnProperty( "Request" ) );

    let retVal = -1;
    if(      reqBody.Request == "getJobQCount" ) { retVal = ceJobs.jobs.length; }
    else if( reqBody.Request == "closeJobQ" )    { ceJobs.blocked = true;  retVal = true; }
    else if( reqBody.Request == "openJobQ" )     { ceJobs.blocked = false; retVal = true; }
    else if( reqBody.Request == "summarizeJQ" )  {
	const jobs  = ceJobs.jobs.getAll();
	const limit = ceJobs.jobs.length < 5 ? ceJobs.jobs.length : 5;
	let top5 = "";
	for( let i = 0; i < limit; i++ ) {
	    top5 += jobs[i].queueId + " ";
	}
	retVal = "Checkpoint failed.  ceServer has " + ceJobs.jobs.length.toString() + " pending jobs.  Top 5: " + top5;
    }
    else {
	console.log( "WARNING.  CheckPoint Handler request not recognized" );
    }

    return res
	.status(201)
	.json( retVal );
}

export default handler;
