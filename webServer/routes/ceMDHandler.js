import assert from 'assert';

import * as config   from '../config.js';

import * as ceAuth  from '../auth/ceAuth.js';

import * as ghV2    from '../utils/gh/gh2/ghV2Utils.js';


async function handler( hostLinks, reqBody, res ) {

    assert( reqBody.hasOwnProperty( "Request" ) );

    let retVal = -1;
    if(      reqBody.Request == "getBuilderPAT" ) { retVal = await ceAuth.getHostPAT( reqBody.host ); }
    else if( reqBody.Request == "getHPeqs" )      { retVal = await ghV2.getHostPeqs( reqBody.PAT, hostLinks, reqBody.cepId ); }
    else if( reqBody.Request == "getHLocs" )      { retVal = await ghV2.getHostLoc( reqBody.PAT, reqBody.pid ); }
    else if( reqBody.Request == "createHLabel" )  { retVal = await ghV2.createPeqLabel( { pat: reqBody.PAT, who: "ceMD" }, reqBody.rid, reqBody.peqVal ); }
    else if( reqBody.Request == "createHIssue" )  {
	// ghV2 createIssue gets labels and assignees as List<Map<>> objects
	// ceMD is sending them as List<> of ids.
	assert( reqBody.issLabels.length == 1 );  // only 1 peq label
	let mlab = [ { id: reqBody.issLabels[0] } ];
	
	let mass = [];
	for( const a of reqBody.issAssign  ) { mass.push( { id: a } ); }

	let newIssue = { title: reqBody.issTitle, labels: mlab, assignees: mass };
	console.log( newIssue );

	retVal = await ghV2.createIssue( { pat: reqBody.PAT, who: "ceMD" }, reqBody.rid, reqBody.projId, newIssue );	
    }
    else if( reqBody.Request == "moveHCard" )     { retVal = await ghV2.moveCard( { pat: reqBody.PAT, who: "ceMD" }, reqBody.pid, reqBody.cid, reqBody.util, reqBody.colId ); }
    else if( reqBody.Request == "closeHIssue" )   { retVal = await ghV2.updateIssue( { pat: reqBody.PAT, who: "ceMD" }, reqBody.iid, "state", config.GH_ISSUE_CLOSED ); }
    else if( reqBody.Request == "remHIssue" )     { retVal = await ghV2.remIssue( { pat: reqBody.PAT }, reqBody.iid ); }
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
