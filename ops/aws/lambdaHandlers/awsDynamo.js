// CodeEquity data interface

// sdk version 2
// const AWS = require('aws-sdk');
// const bsdb = new AWS.DynamoDB.DocumentClient();

// sdk version 3
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { TransactWriteCommand, ScanCommand, DeleteCommand, PutCommand, UpdateCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient();
const bsdb  = DynamoDBDocumentClient.from( client, { marshallOptions: { removeUndefinedValues: true } } );


// var assert = require('assert');
import {strict as assert} from "node:assert";

// NOTE, as of 5/20 dynamo supports empty strings.  yay.  Save this for sets & etc.
const EMPTY = "---EMPTY---";  

// On a large ingest, MAX_SPIN 20 is insufficient.  Bump to 50.
const SPIN_DELAY = 200; // spin wait on fine-grained lock conflict
const MAX_SPIN   = 50;  // how many times will we retry

const NO_CONTENT = {
		statusCode: 204,
		body: JSON.stringify( "---" ),
		headers: { 'Access-Control-Allow-Origin': '*' }
	    };

const LOCKED = {
		statusCode: 423,
		body: JSON.stringify( "---" ),
		headers: { 'Access-Control-Allow-Origin': '*' }
	    };

const BAD_SEMANTICS = {
		statusCode: 422,
		body: JSON.stringify( "---" ),
		headers: { 'Access-Control-Allow-Origin': '*' }
	    };

// Because we're using a Cognito User Pools authorizer, all of the claims
// included in the authentication token are provided in the request context.
// This includes the username as well as other attributes.
// The body field of the event in a proxy integration is a raw string.
// In order to extract meaningful values, we need to first parse this string
// into an object. A more robust implementation might inspect the Content-Type
// header first and use a different parsing strategy based on that value.

// NOTE.  Dynamo scan limit is PRE-FILTER..!  So basically every .scan needs to be paginated, unless the table is
//        not expected to carry more than 100 items.  

// exports.handler = (event, context, callback) => {
export function handler( event, context, callback) {
    
    console.log( 'awsDynamo Handler start' );
    
    if (!event.requestContext.authorizer) {
	callback( null, errorResponse("401", 'Authorization not configured, dude', context.awsRequestId));
	return;
    }

    console.log('Received event: ', event.body);
    console.log('Authorization: ', event.requestContext.authorizer.claims['cognito:username'],  );
    console.log('Authorization: ', event.requestContext.authorizer.claims['auth_time'],  );
    console.log('Authorization: ', event.requestContext.authorizer.claims['exp'],  );
    console.log('Authorization: ', event.requestContext.authorizer.claims['sub'],  );

    const username = event.requestContext.authorizer.claims['cognito:username'];
    const rb = JSON.parse(event.body);

    var endPoint = rb.Endpoint;
    var resultPromise;

    // console.log( "User:", username, "Endpoint:", endPoint );
    if(      endPoint == "GetEntry")       { resultPromise = getEntry( rb.tableName, rb.query ); }
    else if( endPoint == "GetEntries")     { resultPromise = getEntries( rb.tableName, rb.query ); }
    else if( endPoint == "RemoveEntries")  { resultPromise = removeEntries( rb.tableName, rb.ids ); }
    else if( endPoint == "GetID")          { resultPromise = getCEUIDFromCE( username ); }             // username is local
    else if( endPoint == "GetCEUID")       { resultPromise = getCEUIDFromHost( rb.HostUserName, rb.HostUserId ); }           // return varies on no_content
    else if( endPoint == "RecordPEQ")      { resultPromise = putPeq( rb.newPEQ ); }
    else if( endPoint == "RecordPEQAction"){ resultPromise = putPAct( rb.newPAction ); }
    else if( endPoint == "CheckHostPop")   { resultPromise = checkHostPop( rb.CEProjectId, rb.RepoId ); }
    else if( endPoint == "GetPEQ")         { resultPromise = getPeq( rb.CEUID, rb.HostUserName, rb.CEProjectId, rb.isAlloc ); }
    else if( endPoint == "GetPEQsById")    { resultPromise = getPeqsById( rb.PeqIds ); }
    else if( endPoint == "GetPEQActions")  { resultPromise = getPeqActions( rb.CEUID, rb.HostUserName, rb.CEProjectId ); }
    else if( endPoint == "GetPActsById")   { resultPromise = getPActsById( rb.CEProjectId, rb.PeqIds ); }
    else if( endPoint == "GetUnPAct")      { resultPromise = getUnPActions( rb.CEProjectId ); }
    else if( endPoint == "UpdatePAct")     { resultPromise = updatePActions( rb.PactIds ); }
    else if( endPoint == "Uningest")       { resultPromise = unIngest( rb.tableName, rb.query ); }    
    else if( endPoint == "UpdatePEQ")      { resultPromise = updatePEQ( rb.pLink ); }
    else if( endPoint == "putPActCEUID")   { resultPromise = updatePActCE( rb.CEUID, rb.PEQActionId); }
    else if( endPoint == "UpdateColProj")  { resultPromise = updateColProj( rb.query ); }
    else if( endPoint == "PutPSum")        { resultPromise = putPSum( rb.NewPSum ); }
    else if( endPoint == "GetHostA")       { resultPromise = getHostA( rb.CEUserId ); }
    else if( endPoint == "PutHostA")       { resultPromise = putHostA( rb.NewHostA, rb.update, rb.pat ); }
    else if( endPoint == "PutPerson")      { resultPromise = putPerson( rb.NewPerson ); }
    else if( endPoint == "RecordLinkage")  { resultPromise = putLinkage( rb.summary ); }
    else if( endPoint == "UpdateLinkage")  { resultPromise = updateLinkage( rb.newLoc ); }
    else if( endPoint == "UpdateCEP")      { resultPromise = putCEP( rb.ceProject ); }
    else if( endPoint == "GetHostProjects"){ resultPromise = getHostProjs( rb.query ); }
    else {
	callback( null, errorResponse( "500", "EndPoint request not understood: " + endPoint, context.awsRequestId));
	return;
    }

    resultPromise.then((result) => {
	console.log( 'Result: ', result.statusCode ); 
	callback( null, result );
    }).catch((err) => {
        console.error(err);
        callback( null, errorResponse(err.statusCode, err.message, context.awsRequestId));
    });

}


function sleep(ms) {
    console.log( "Sleep for", ms, "ms" );
    return new Promise(resolve => setTimeout(resolve, ms));
}


// Note: .Count and .Items do not show up here, as they do in bsdb.scan
function paginatedScan( params ) {

    var result = [];
    
    params.Limit = 99;
    
    let cmd = new ScanCommand( params );

    async function scanit( scanCmd ) {
	
	return bsdb.send( scanCmd )
	    .then((data) => {
		result = result.concat( data.Items );
		
		if (typeof data.LastEvaluatedKey === "undefined") {
		    return result;
		} else {
		    params.ExclusiveStartKey = data.LastEvaluatedKey;
		    cmd = new ScanCommand( params );			
		    return scanit( cmd );
		}
	    });
    }
    
    return scanit( cmd );
}


function success( result ) {
    return {
	statusCode: 201,
	body: JSON.stringify( result ),
	headers: { 'Access-Control-Allow-Origin': '*' }
    };
}

function randAlpha(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}


async function checkPeqLock( peqId ) {
    const params = {
        TableName: 'CEPEQs',
        FilterExpression: 'PEQId = :pid',
        ExpressionAttributeValues: { ":pid": peqId }
    };

    let promise = paginatedScan( params );
    return promise.then((peq) => {
	assert(peq.length == 1 );
	console.log( "checking peqlock ", peq[0].PEQId, peq[0].LockId );
	return peq[0].LockId;
    });
}

async function setPeqLock( peqId, lockId ) {
    if( !lockId ) { lockId = "false" }
    console.log( "set peqLock", peqId, lockId );
    
    let params = {};
    params.TableName                  = 'CEPEQs';
    params.Key                        = {"PEQId": peqId };
    params.UpdateExpression           = 'set LockId = :lockVal';
    params.ExpressionAttributeValues  = {":lockVal": lockId };

    const updateCmd = new UpdateCommand( params );
    return bsdb.send( updateCmd ).then(() => true);

}

// Three phase lock to avoid multiple parties reading 'false', setting 'true' at same time, then both proceeding 
// phase 1: read.  if false, phase2: set with ID.  phase 3 read.  if same ID, proceed.
// Dynamo can't fine-grain lock tables!  graaaaack.  
// Implement fine-grained lock to avoid this type of (actual) interleaving error
// Example failure prior to fine-grained lock
//    50m 16s 620ms  start delete
//    50m 16s 770ms  start add
//    50m 16s 803ms  finish add
//    50m 17s 224ms  finish delete  (delete via update does much more work, very slow)

async function acquireLock( peqId, lockId ) {
    let retVal = false;
    let firstCheck = await checkPeqLock( peqId );
    if( firstCheck == "false" ) {
	console.log( "try setting lock" );
	await setPeqLock( peqId, lockId );
	console.log( "done" );
	if( (await checkPeqLock( peqId )) == lockId ) { retVal = true; }
    }
    else if( firstCheck == lockId ) { retVal = true; }  // first time through, second checkPeqLock can return before set is finished writing.
    else{ console.log("Acquire lock failed, lock busy.", peqId, lockId, firstCheck ); }
	
    return retVal;
}


function buildUpdateParams( obj, props ) {
    let first = true;

    let updateExpr = "";
    let attrVals = {};
    
    for( const prop of props ) {
	if( prop in obj ) {
	    if( first ) { updateExpr  = 'set '; }
	    else        { updateExpr += ', '; }
	    let pval = ":" + prop;
	    updateExpr += ( prop + " = " + pval );

	    attrVals[pval] = obj[prop];
	    first = false;
	}
    }

    assert( updateExpr.length >= 5 );
    return [updateExpr, attrVals];
}

// Simple conjunctive params for a scan, not intended for pagination
function buildConjScanParams( obj, props ) {
    let first = true;

    let filterExpr = "";
    let attrVals = {};
    
    for( const prop of props ) {
	if( prop in obj ) {
	    if( !first ) { filterExpr += ' AND '; }
	    let pval = ":" + prop;
	    filterExpr += ( prop + " = " + pval );

	    attrVals[pval] = obj[prop];
	    first = false;
	}
    }
    
    assert( filterExpr.length == 0 || filterExpr.length >= 5 );
    return [filterExpr, attrVals];
}

async function setLock( pactId, lockVal ) {
    console.log( "Locking", pactId, lockVal );

    const params = {
	TableName: 'CEPEQActions',
	Key: {"PEQActionId": pactId },
	UpdateExpression: 'set Locked = :lockVal',
	ExpressionAttributeValues: { ':lockVal': lockVal }};

    const updateCmd = new UpdateCommand( params );
    return bsdb.send( updateCmd ).then(() => success( true ));
}


// NOTE: ignore locks on reads
// NOTE: scan return limit, before filter, is 1m. If desired item is not found, will return empty set.
//      So, paginate is required, for every scan.
async function getEntry( tableName, query ) {
    console.log( "Get from", tableName, ":", query );

    let props = [];
    // Possibilities for non-paginated (Count 0 or 1) returns
    switch( tableName ) {
    case "CEPeople":
	props = ["CEUserId", "CEUserName", "Email", "First", "Last"];
	break;
    case "CEHostUser":
	props = ["HostUserName", "HostPlatform"];
	break;
    case "CEPEQs":
	props = [ "PEQId", "Active", "CEGrantorId", "PeqType", "Amount", "CEProjectId", "HostRepoId", "HostIssueId", "HostIssueTitle" ];
	break;
    case "CEPEQActions":
	props = [ "PEQActionId", "CEUID", "HostUserName", "CEProjectId", "Verb", "Action"];
	break;
    case "CEPEQRaw":
	props = [ "PEQRawId" ];
	break;
    case "CEProjects":
	props = [ "CEProjectId" ];
	break;
    case "CEPEQSummary":
	props = [ "CEProjectId" ];
	break;
    case "CELinkage":
	props = [ "CEProjectId" ];
	break;
    default:
	assert( false );
    }
    
    let scanVals = buildConjScanParams( query, props );
    assert( scanVals.length == 2 );

    let params = {};
    params.TableName                  = tableName;
    params.FilterExpression           = scanVals[0];
    params.ExpressionAttributeValues  = scanVals[1];

    // console.log( params );

    let daPromise = paginatedScan( params );
    return daPromise.then((entries) => {
	if( entries.length == 1 )     { return success( entries[0] ); }
	else if( entries.length > 1 ) { return BAD_SEMANTICS; }
	else                          { return NO_CONTENT; }
    });
}

// NOTE: ignore locks on reads
async function getEntries( tableName, query ) {
    console.log( "Get from", tableName, ":", query );
    
    let props = [];
    switch( tableName ) {
    case "CEPEQs":
	props = [ "PEQId", "Active", "CEGrantorId", "HostHolderId", "PeqType", "Amount", "CEProjectId", "HostRepoId", "HostIssueId", "HostIssueTitle" ];
	break;
    case "CEPEQActions":
	props = [ "PEQActionId", "CEUID", "HostUserName", "CEProjectId", "Verb", "Action", "Subject", "Ingested"];
	break;
    case "CEPEQRaw":
	props = [ "PEQRawId", "CEProjectId" ];
	break;
    case "CEProjects":
	props = [ "CEProjectId" ];
	break;
    case "CELinkage":
	props = [ "CEProjectId" ];
	break;
    case "CEPEQSummary": 
	props = [ "CEProjectId" ];
	break;
    default:
	console.log( "*"+tableName+"*", "not found" );
	assert( false );
    }

    let scanVals = buildConjScanParams( query, props );
    assert( scanVals.length == 2 );

    let params = {};
    params.TableName                  = tableName;
    if( scanVals[0] != "" ) {
	params.FilterExpression           = scanVals[0];
	params.ExpressionAttributeValues  = scanVals[1];
    }

    let daPromise = paginatedScan( params ); 
    return daPromise.then((entries) => {
	if( entries.length == 0 ) { return NO_CONTENT; }
	else                      { return success( entries ); }
    });
}

// NOTE: ignore locks on peq item delete, which is only for testing
async function removeEntries( tableName, ids ) {
    console.log( "Remove from", tableName, ":", ids );
    
    let pkey1 = "";
    let pkey2 = "";
    switch( tableName ) {
    case "CEPEQs":
	pkey1 = "PEQId";
	break;
    case "CEPEQActions":
	pkey1 = "PEQActionId";
	break;
    case "CEPEQRaw":
	pkey1 = "PEQRawId";
	break;
    case "CEProjects": 
	pkey1 = "CEProjectId";
	break;
    case "CEPEQSummary": 
	pkey1 = "PEQSummaryId";
	break;
    case "CELinkage":
	pkey1 = "CELinkageId";
	break;
    default:
	assert( false );
    }

    let promises = [];
    for( const id of ids ) {
	let keyPhrase = {};
	keyPhrase[pkey1] = id[0];
	if( pkey2 != "" ) {
	    assert( id.length == 2 );
	    keyPhrase[pkey2] = id[1]; 
	}
	const params = {
	    TableName: tableName,
	    Key: keyPhrase
	};

	const deleteCmd = new DeleteCommand( params );
	promises.push( bsdb.send( deleteCmd ));
    }

    return await Promise.all( promises )
	.then((results) => {
	    console.log( '...promises done' );
	    return success( true );
	});
}



// get from ce table
async function getCEUIDFromCE( username ) {
    const paramsP = {
        TableName: 'CEPeople',
        FilterExpression: 'CEUserName = :uname',
        ExpressionAttributeValues: { ":uname": username }
    };

    let personPromise = paginatedScan( paramsP );
    return personPromise.then((persons) => {
	if( persons.length == 0 )     { return NO_CONTENT; }
	else if( persons.length > 1 ) { return BAD_SEMANTICS; }
	else {
	    console.log( "Found CEUserId ", persons[0].CEUserId );
	    return success( persons[0].CEUserId );
	}
    });
}

// get from host table
async function getCEUIDFromHost( hostUserName, hostUserId ) {
    let params = {};
    params.TableName = 'CEHostUser';

    if( typeof hostUserId !== 'undefined' ) {
	params.FilterExpression = 'HostUserId = :uname';
	params.ExpressionAttributeValues = { ":uname": hostUserId };
    }
    else {
	params.FilterExpression = 'HostUserName = :uname';
	params.ExpressionAttributeValues = { ":uname": hostUserName };
    }  

    let promise = paginatedScan( params );
    return promise.then((host) => {
	if( host.length == 1 ) {
	    console.log( "Found ceUserId ", host[0].CEUserId );
	    return success( host[0].CEUserId );
	}
	else {
	    // may not be one yet
	    return success( "" );
	}
    });
}

async function putPerson( newPerson ) {
    // XXX Expand error code for this - might be common

    if( newPerson.email == "" || newPerson.userName == "" || newPerson.id == "" ) {
	console.log( "Need both username and email.", newPerson.userName, newPerson.email, newPerson.id );
	return BAD_SEMANTICS; 
    }
    
    // XXX getEntry is conjunction.  If allow disjunction, this would avoid a call
    // First verify person does not exist already
    let ceUID = await getCEUIDFromCE( newPerson.userName );
    let origPerson = await getEntry( "CEPeople", { Email: newPerson.email } );
    if( ceUID.statusCode != 204 || origPerson.statusCode != 204 ) {
	console.log( "person already exists, failing." );
	return BAD_SEMANTICS; 
    }
    
    const params = {
	TableName: 'CEPeople',
	Item: {
	    "CEUserId": newPerson.id,
	    "First":    newPerson.firstName,
	    "Last":     newPerson.lastName,
	    "CEUserName": newPerson.userName,
	    "Email":    newPerson.email,
	    "Locked":   newPerson.locked,
	    "ImagePng": newPerson.imagePng            
	}
    };
    const putCmd = new PutCommand( params );

    return bsdb.send( putCmd ).then(() => success( true )); 
}

async function getLinkage( ceProjectId ) {
    const params = {
        TableName: 'CELinkage',
        FilterExpression: 'CEProjectId = :anid',
        ExpressionAttributeValues: { ":anid": ceProjectId }
    };

    let lPromise = paginatedScan( params );
    return lPromise.then((l) => {
	if( l.length >= 1 ) {
	    assert( l.length == 1 );
	    console.log( "Found linkage summary ", l[0].CELinkageId );
	    return l[0];
	}
	else return -1;
    });
}

// Write an already well-formed summary
async function writeLinkHelp( summary ) {
    const params = {
        TableName: 'CELinkage',
	Item:      summary
    };
    const putCmd = new PutCommand( params );

    return bsdb.send( putCmd ).then(() => success( summary.CELinkageId ));
}

async function putLinkage( summary ) {
    // get any entry with summary.CEProjectId, overwrite
    let oldSummary = await getLinkage( summary.CEProjectId );
    
    // write new summary
    summary.CELinkageId = oldSummary == -1 ? randAlpha(10) : oldSummary.CELinkageId;
    console.log( "overwriting CELinks for", summary.CELinkageId );
    return await writeLinkHelp( summary );
}

// NOTE: if this is called multiple times with new repo, new locs, very quickly, more than 1 thread can pass the test, creating multiple
//       linkages.  Which is bad.  Also, can overwrite, which is stinky.
async function updateLinkage( newLocs ) {
    // get any entry with summary.CEProjectId, overwrite
    let oldSummary = await getLinkage( newLocs.CEProjectId );

    // XXX not thread-safe, see above
    // Note!  First created project in repo will not have summary.
    if( oldSummary == -1 ) {
	oldSummary = {};
	oldSummary.CELinkageId = randAlpha(10);
	oldSummary.CEProjectId = newLocs.CEProjectId;
	console.log( "Created new summary object" );
    }
    if( oldSummary.Locations === -1 ) {
	oldSummary.Locations = [];
    }

    oldSummary.LastMod = newLocs.LastMod;
    for( const nLoc of newLocs.Locs ) {
	
	assert( newLocs.CEProjectId == nLoc.ceProjectId );
	
	// Update to catch and overwrite with name changes
	let foundLoc = false;
	if( 'Locations' in oldSummary ) {
	    for( var loc of oldSummary.Locations ) {
		if( loc.hostProjectId == nLoc.hostProjectId && loc.hostColumnId == nLoc.hostColumnId ) {
		    console.log( "updating with", nLoc.hostProjectName, nLoc.hostColumnName );
		    loc.hostProjectName = nLoc.hostProjectName;
		    loc.hostColumnName  = nLoc.hostColumnName;
		    loc.hostUtility     = nLoc.hostUtility;
		    loc.active          = nLoc.active;
		    loc.ceProjectId     = nLoc.ceProjectId;
		    foundLoc = true;
		    break;
		}
	    }
	}
	else { oldSummary.Locations = []; }
	
	// Add, if not already present
	if( !foundLoc ) {
	    let aloc = {};
	    console.log( "Create new for", nLoc.hostProjectName, nLoc.hostColumnName );
	    aloc.hostProjectId   = nLoc.hostProjectId;
	    aloc.hostProjectName = nLoc.hostProjectName;
	    aloc.hostColumnId    = nLoc.hostColumnId;
	    aloc.hostColumnName  = nLoc.hostColumnName;
	    aloc.hostUtility     = nLoc.hostUtility;
	    aloc.active          = nLoc.active;
	    aloc.ceProjectId     = nLoc.ceProjectId;
	    oldSummary.Locations.push( aloc );
	}
    }
    
    return await writeLinkHelp( oldSummary );
}

// overwrite
async function putCEP( ceProject ) {
    const params = {
        TableName: 'CEProjects',
	Item:      ceProject
    };
    const putCmd = new PutCommand( params );

    return bsdb.send( putCmd ).then(() => success( true ));
}


async function checkHostPop( ceProjId, repoId ) {

    let params = { TableName: 'CEProjects' };
    
    params.FilterExpression          = 'CEProjectId = :pid';
    params.ExpressionAttributeValues = { ':pid': ceProjId };
    
    let promise = paginatedScan( params );
    return promise.then((res) => {
	if( res && res.length > 0 ) {
	    assert( res.length == 1 );
	    let found = false;
	    if( typeof res[0].HostParts !== 'undefined' && typeof res[0].HostParts.hostRepositories !== 'undefined' ) {
		let repo = res[0].HostParts.hostRepositories.find( r => r.repoId == repoId );
		if( typeof repo !== 'undefined' ) { found = true; }
	    }
	    return success( found );
	}
	else { return success( false ); }
    });
}


// acquire fine-grained lock
// Skiplock is ONLY set during cleanLoad for testing purposes
async function putPeq( newPEQ ) {

    // No need to acquire lock if creating a brand-new peq
    if( newPEQ.PEQId == -1 ) { newPEQ.PEQId = randAlpha(10); }
    else if( !newPEQ.hasOwnProperty( 'skipLock' ) || newPEQ.skipLock == "false" )
    {
	let spinCount = 0;
	let peqLockId = randAlpha(10);
	while( !(await acquireLock( newPEQ.PEQId, peqLockId )) && spinCount < MAX_SPIN )  {
	    spinCount++;
	    await sleep( SPIN_DELAY );
	}
	if( spinCount >= MAX_SPIN ) { return LOCKED; }
    }

    if( !newPEQ.hasOwnProperty( 'CEProjectId' ) || !newPEQ.hasOwnProperty( 'HostRepoId' ) || !newPEQ.hasOwnProperty( 'Amount' ) ) {
	console.log( "Peq malformed", newPEQ.toString() );
	return BAD_SEMANTICS;
    }
    
    const params = {
        TableName: 'CEPEQs',
	Item: {
	    "PEQId":        newPEQ.PEQId,
	    "CEProjectId":  newPEQ.CEProjectId,
	    "CEHolderId":   newPEQ.CEHolderId,
	    "HostHolderId": newPEQ.HostHolderId,
	    "CEGrantorId":  newPEQ.CEGrantorId,
	    "PeqType":      newPEQ.PeqType,
	    "Amount":       newPEQ.Amount,
	    "AccrualDate":  newPEQ.AccrualDate,
	    "VestedPerc":   newPEQ.VestedPerc,
	    "HostProjectSub": newPEQ.HostProjectSub,
	    "HostRepoId":     newPEQ.HostRepoId,
	    "HostIssueId":    newPEQ.HostIssueId,
	    "HostIssueTitle": newPEQ.HostIssueTitle,
	    "Active":         newPEQ.Active
	}
    };
    const putCmd = new PutCommand( params );

    let retVal = bsdb.send( putCmd ).then(() => success( newPEQ.PEQId ));
    retVal     = await retVal;

    // No need to wait for unset lock
    setPeqLock( newPEQ.PEQId, false );
    return retVal;
}


async function putPAct( newPAction ) {

    let rewrite = newPAction.hasOwnProperty( "PEQActionId" );
    
    let newId = rewrite ? newPAction.PEQActionId : randAlpha(10);
    console.log( newId, newPAction.Verb, newPAction.Action, newPAction.Subject );
    const params = {
        TableName: 'CEPEQActions',
	Item: {
	    "PEQActionId":  newId,
	    "CEUID":        newPAction.CEUID,
	    "HostUserId":   newPAction.HostUserId,
	    "CEProjectId":  newPAction.CEProjectId,
	    "Verb":         newPAction.Verb,
	    "Action":       newPAction.Action,
	    "Subject":      newPAction.Subject,
	    "Note":         newPAction.Note,
	    "EntryDate":    newPAction.Date,
	    "Ingested":     newPAction.Ingested,
	    "Locked":       newPAction.Locked,
	    "TimeStamp":    newPAction.TimeStamp
	}
    };

    const paramsR = {
        TableName: 'CEPEQRaw',
	Item: {
	    "PEQRawId":    newId,
	    "CEProjectId": newPAction.CEProjectId,
	    "RawBody":     newPAction.RawBody,
	}
    };

    const twCmd = new TransactWriteCommand({
	TransactItems: [
	    { Put: params }, 
	    { Put: paramsR }, 
	]}
    );
    return bsdb.send( twCmd ).then(() =>success( newId ));
}


// XXX used only by ceFlutter.  replace with getEntry?
// XXX Slow
// Get all for uid, app can figure out whether or not to sort by associated hostUser
// NOTE: ignore locks on read
async function getPeq( uid, hostUser, ceProjId, isAlloc ) {
    if( isAlloc == "true" ) { isAlloc = true; }
    else                    { isAlloc = false; }

    console.log( "isAlloc?", isAlloc.toString() );
    const params = { TableName: 'CEPEQs', Limit: 99, };
    
    if( uid != "" ) {
        params.FilterExpression = 'contains( CEHolderId, :ceid) AND CEProjectId = :pid AND Active = :true';
        params.ExpressionAttributeValues = { ":ceid": uid, ":pid": ceProjId, ":true": "true" };
    }
    else if( hostUser == "" ) {  // allocation, or unassigned
	if( isAlloc ) { params.FilterExpression = 'size( HostHolderId ) < :empty AND PeqType = :alloc  AND CEProjectId = :pid AND Active = :true'; }
	else {          params.FilterExpression = 'size( HostHolderId ) < :empty AND PeqType <> :alloc AND CEProjectId = :pid AND Active = :true'; }
        params.ExpressionAttributeValues = { ":empty": 5, ":alloc": "allocation", ":pid": ceProjId, ":true": "true" };
    }
    else {
        params.FilterExpression = 'contains( HostHolderId, :id) AND CEProjectId = :pid AND Active = :true';
        params.ExpressionAttributeValues = { ":id": hostUser, ":pid": ceProjId, ":true": "true" };
    }

    console.log( "Looking for peqs", params);
    let peqPromise = paginatedScan( params );
    return peqPromise.then((peqs) => {
	console.log( "Found peqs ", peqs );
	return success( peqs );
    });
}

async function getPeqActions( uid, hostUser, ceProjId ) {
    let params = { TableName: 'CEPEQActions', Limit: 99, };

    if( uid != "" ) {
	params.FilterExpression = 'CEUID = :ceid AND CEProjectId = :pid';
        params.ExpressionAttributeValues = { ":ceid": uid, ":pid": ceProjId };
    }
    else {
	params.FilterExpression = 'HostUserName = :id AND CEProjectId = :pid';
        params.ExpressionAttributeValues = { ":id": hostUser, ":pid": ceProjId };
    }
    
    console.log( "Looking for peqActions");
    let peqPromise = paginatedScan( params );
    return peqPromise.then((peqs) => {
	//console.log( "Found peqActions ", peqs );
	return success( peqs );
    });
}

// Lock.  Then get uningested PEQActions
async function getUnPActions( ceProjId ) {
    const paramsP = {
        TableName: 'CEPEQActions',
        FilterExpression: 'CEProjectId = :pid AND Ingested = :false',
        ExpressionAttributeValues: { ":pid": ceProjId, ":false": "false" },
	Limit: 99,
    };

    // Find uningested
    let unprocPromise = paginatedScan( paramsP );
    return unprocPromise
	.then((pacts) => {
	    console.log( "Found uningested, locking", pacts.length );
	    
	    // XXX Fire these off, consider waiting, with Promises.all
	    //     would be expensive for multiple uningested.  where oh where is updateWhere
	    pacts.forEach( function(pact) { setLock( pact.PEQActionId, "true" );   });
	    return pacts;
	})
	.then(( pacts ) => {
	    console.log( "Returning uningested pacts" );
	    if( pacts.length > 0 ) { return success( pacts ); }
	    else                   { return NO_CONTENT;       }
		
	});
}

// Unlock.  set PEQActions ingested to true
// XXX PAGINATE!!!
// XXX no update where.  this will be too slow
// XXX fix res, all like it
async function updatePActions( pactIds ) {

    console.log( "Updating pactions to unlocked and ingested" );

    let promises = [];
    pactIds.forEach(function (pactId) {
	console.log( "update", pactId );

	const params = {
	    TableName: 'CEPEQActions',
	    Key: {"PEQActionId": pactId },
	    UpdateExpression: 'set Locked = :false, Ingested = :true',
	    ExpressionAttributeValues: { ':false': "false", ':true': "true" }};

	const updateCmd = new UpdateCommand( params );
	promises.push( bsdb.send( updateCmd ) );
    });

    let res = true;
    // Promises execute in parallel, collect in order
    return await Promise.all( promises )
	.then((results) => {
	    console.log( '...promises done', results.toString() );
	    //results.forEach(function(result) { res = res && result; });
	    //console.log( "Returning from update,", res.toString() );

	    if( res ) { return success( res ); }
	    else {
		return {
		    statusCode: 500,
		    body: JSON.stringify( "---" ),
		    headers: { 'Access-Control-Allow-Origin': '*' }
		};
	    }
	});
}

// set PEQActions ingested to false
// XXX no update where.  this will be too slow
async function unIngest( tableName, query ) {

    console.log( "Updating pactions to not ingested for", query.CEProjectId );

    // Find uningested
    const params = {
        TableName: tableName,
        FilterExpression: 'CEProjectId = :pid AND Ingested = :true',
        ExpressionAttributeValues: { ':pid': query.CEProjectId , ':true': "true" },
	Limit: 99,
    };
    let unprocPromise = paginatedScan( params );
    let pacts   = await unprocPromise;
    let pactIds = pacts.map( pact => pact.PEQActionId );
    
    let promises = [];
    pactIds.forEach(function (pactId) {
	const params = {
	    TableName: tableName,
	    Key: {"PEQActionId": pactId },
	    UpdateExpression: 'set Ingested = :false',
	    ExpressionAttributeValues: { ':false': "false" }};
	
	const updateCmd = new UpdateCommand( params );
	promises.push( bsdb.send( updateCmd ));
    });


    // All locked should be unlocked.
    const lParams = {
        TableName: tableName,
        FilterExpression: 'CEProjectId = :pid AND Locked = :true',
        ExpressionAttributeValues: { ':pid': query.CEProjectId , ':true': "true" },
	Limit: 99,
    };
    unprocPromise = paginatedScan( lParams );
    pacts   = await unprocPromise;
    pactIds = pacts.map( pact => pact.PEQActionId );
    
    pactIds.forEach(function (pactId) {
	const params = {
	    TableName: tableName,
	    Key: {"PEQActionId": pactId },
	    UpdateExpression: 'set Locked = :false',
	    ExpressionAttributeValues: { ':false': "false" }};
	
	const updateCmd = new UpdateCommand( params );
	promises.push( bsdb.send( updateCmd ));
    });


    // Promises execute in parallel, collect in order
    return await Promise.all( promises )
	.then((results) => {
	    let res = !results.some( result => !result ); // all true or not?
	    if( res ) { return success( res ); }
	    else {
		return {
		    statusCode: 500,
		    body: JSON.stringify( "---" ),
		    headers: { 'Access-Control-Allow-Origin': '*' }
		};
	    }
	});
}

// Dynamo - to have a filterExpression that is, say, x in <a list>,
// you must construct the expression and the expressionAttrVals piece by piece, explicitly.  Then ordering is in question.
// For now, use promises.all to ensure ordering and skip explicit construction.  more aws calls, buuuuttt....
// NOTE: ignore locks on read
async function getPeqsById( peqIds ) {

    let promises = [];
    peqIds.forEach(function (peqId) {
	const params = {
	    TableName: 'CEPEQs',
	    FilterExpression: 'PEQId = :peqId',
	    ExpressionAttributeValues: { ":peqId": peqId }};
	
	promises.push( paginatedScan( params ) );
    });

    // Promises execute in parallel, collect in order
    return await Promise.all( promises )
	.then((results) => {
	    console.log( '...promises done' );
	    let res = [];
	    results.forEach( function ( peq ) {
		assert( peq.length <= 1 );
		if( peq.length == 1 ) {
		    res.push( peq[0] );
		}
		else {
		    res.push( -1 );
		}
	    });
	    
	    if( res.length > 0 ) { return success( res ); }
	    else                 { return NO_CONTENT; }
	});
}

// XXX narrow this to subject[0]?
// Dynamo - to have a filterExpression that is, say, x in <a list>,
// you must construct the expression and the expressionAttrVals piece by piece, explicitly.  Then ordering is in question.
// For now, use promises.all to ensure ordering and skip explicit construction.  more aws calls, buuuuttt....
// NOTE: ignore locks on read
async function getPActsById( ceProjId, peqIds ) {

    console.log( "Get pacts by peq id", peqIds );

    let promises = [];
    peqIds.forEach(function (peqId) {
	const params = {
	    TableName: 'CEPEQActions',
	    FilterExpression: 'contains( Subject, :peqId) AND CEProjectId = :pid',
	    ExpressionAttributeValues: { ":peqId": peqId, ":pid": ceProjId }};
	
	promises.push( paginatedScan( params ) );
    });

    // Promises execute in parallel, collect in order
    return await Promise.all( promises )
	.then((results) => {
	    console.log( '...promises done' );
	    let res = [];
	    // console.log( results );
	    // console.log( res );
	    results.forEach( function ( pact ) { res.push.apply( res, pact ); });
	    
	    if( res.length > 0 ) { return success( res ); }
	    else                 { return NO_CONTENT; }
	});
}


async function updatePEQ( pLink ) {

    console.log( "Updating PEQ", pLink.PEQId );

    let spinCount = 0;
    let peqLockId = randAlpha(10);
    while( !(await acquireLock( pLink.PEQId, peqLockId )) && spinCount < MAX_SPIN )  {
	spinCount++;
	await sleep( SPIN_DELAY );
    }
    if( spinCount >= MAX_SPIN ) { return LOCKED; }
    
    // Only props that get updated
    let props = [ "AccrualDate", "Active", "Amount", "CEGrantorId", "CEHolderId", "HostHolderId", "HostIssueTitle", "HostProjectSub", "PeqType", "VestedPerc" ];
    let updateVals = buildUpdateParams( pLink, props );
    assert( updateVals.length == 2 );

    let params = {};
    params.TableName                  = 'CEPEQs';
    params.Key                        = {"PEQId": pLink.PEQId };
    params.UpdateExpression           = updateVals[0];
    params.ExpressionAttributeValues  = updateVals[1];

    const updateCmd = new UpdateCommand( params );
    let retVal = bsdb.send( updateCmd ).then(() => success( true ));

    retVal = await retVal;

    // No need to wait for unset lock
    setPeqLock( pLink.PEQId, false );
    return retVal;
}


async function updatePActCE( ceUID, pactId ) {

    console.log( "Updating CEUID for", pactId );

    const params = {
	TableName: 'CEPEQActions',
	Key: {"PEQActionId": pactId },
	UpdateExpression: 'set CEUID = :ceuid',
	ExpressionAttributeValues: { ':ceuid': ceUID }};
    
    const updateCmd = new UpdateCommand( params );
    return bsdb.send( updateCmd ).then(() => success( true ));
}


// peq psub: last element is ALWAYS the column name.  Examples: 
// [ { "S" : "Software Contributions" }, { "S" : "Github Operations" }, { "S" : "Planned" } ]
// [ { "S" : "UnClaimed" }, { "S" : "UnClaimed" } ]
// [ { "S" : "Software Contributions" } ]
// The first comes from master:softCont and softCont:gitOps:Planned
// The second is a flat structure
// The third is from adding an allocation into the master proj.  Master name is redacted.

// Does the old name always match PEQ psub?  Yes, barring out of order arrival.  
// 1. The only cross project move allowed that can generate a rename is from unclaimed -> new home.  Delete accrued generates a 'recreate'.
// 2. Peqs can be deactivated, then grossly manipulated while untracked.  But upon re-labelling as a PEQ, all info is updated from ceServer.
// 3. There may be multiple renames for a given project within one ingest batch.  It is very unlikely that they will arrive out of order.  But possible.
// 4. Ingest can occur well after new peqs added to new col/proj name.  In which case psub will be correct already.
// So, require oldName or newName to match dynamo.
async function updateColProj( update ) {

    // query: CEProjectId, HostProjectId, OldName, NewName, Column
    // if proj name mode, every peq in project gets updated.  big change.
    // XXX if col name change, could be much smaller, but would need to generate list of peqIds in ingest from myHostLinks.  Possible.. 

    // XXX Would need to grab all peqs, then filter by current psub.  hostprojectId no longer part of peq
    //     first, make sure this is still needed.
    assert( false );
    
    // Get all active peqs in HostProjId, ceProjId
    const query = { CEProjectId: update.CEProjectId, HostRepoId: update.HostRepoId, Active: "true" };
    var peqsWrap = await getEntries( "CEPEQs", query );
    // console.log( "Found peqs, raw:", peqsWrap );

    if( peqsWrap.statusCode != 201 ) { return peqsWrap; }

    const peqs = JSON.parse( peqsWrap.body );
    // console.log( "Found peqs:", peqs );
    
    //   if Proj, if psub.len > 1,  update psub.last-1 where matches query.OldName with query.NewName
    for( var peq of peqs ) {
	assert( peq.HostProjectSub.length >= 1 );
	console.log( "working on", peq );
	// not all peqs in project belong to this column.  
	if( update.Column == "true" ) {
	    let lastElt = peq.HostProjectSub[ peq.HostProjectSub.length - 1];
	    if( lastElt == update.OldName ) {
		peq.HostProjectSub[ peq.HostProjectSub.length - 1] = update.NewName;
		console.log( "Updated column portion of psub", peq.HostIssueTitle, peq.HostProjectSub );
	    }
	}
	else if( peq.HostProjectSub.length >= 2 ) {
	    let pElt = peq.HostProjectSub[ peq.HostProjectSub.length - 2];
	    assert( pElt == update.OldName || pElt == update.NewName );
	    peq.HostProjectSub[ peq.HostProjectSub.length - 2] = update.NewName;
	    console.log( "Updated project portion of psub", peq.HostIssueTitle, peq.HostProjectSub );
	}
    }

    let promises = [];
    for( const peq of peqs ) {
	const params = {
	    TableName: 'CEPEQs',
	    Key: {"PEQId": peq.PEQId},
	    UpdateExpression: 'set HostProjectSub = :psub',
	    ExpressionAttributeValues: { ':psub': peq.HostProjectSub }};

	const updateCmd = new UpdateCommand( params );
	promises.push( bsdb.send( updateCmd ));
    }

    return await Promise.all( promises )
	.then((results) => {
	    console.log( '...promises done' );
	    return success( true );
	});
}



// Overwrites any existing record by ID.
// XXX Due to https://github.com/flutter/flutter/issues/67090, if repo exists already but with different id, don't write.
async function putPSum( psum ) {

    // XXX START workaround: Remove this once issue 67090 is resolved
    const params = {
        TableName: 'CEPEQSummary',
        FilterExpression: 'CEProjectId = :hostr',
        ExpressionAttributeValues: { ":hostr": psum.ceProjectId },
	Limit: 99,
    };
    let gPromise = paginatedScan( params );
    let skip = false;
    await gPromise.then((ps) => {
	for( const eps of ps ) {
	    if( eps.PEQSummaryId != psum.id ) {
		// Oops.  We have an existing summary for ceProj with a different ID.  Don't write this new, second copy.
		assert( eps.Allocations.length == psum.allocations.length );
		console.log( "Found duplicate ceProj, will not write current.", eps.PEQSummaryId.toString(), psum.id, psum.ceProjectId, eps.Allocations.length.toString() );
		skip = true;
	    }
	    
	}
    });
    if( skip ) { return success( true ); }
    // XXX END

    console.log( "PEQSummary put", psum.id.toString());

    const paramsP = {
        TableName: 'CEPEQSummary',
	Item: {
	    "PEQSummaryId": psum.id, 
	    "CEProjectId":  psum.ceProjectId,
	    "TargetType":   psum.targetType,
	    "TargetId":     psum.targetId,
	    "LastMod":      psum.lastMod,
	    "Allocations":  psum.allocations
	}
    };
    const putCmd = new PutCommand( paramsP );

    return bsdb.send( putCmd ).then(() => success( true ));
}


// XXX this gets all, not just needing update
// XXX as it is, replace with getPeqActions
// XXX NOTE: this also gets all from all repos belonging to hostUserName.  Not wrong, but too sloppy.
async function getPEQActionsFromHost( hostUserName ) {
    const params = {
        TableName: 'CEPEQActions',
        FilterExpression: 'HostUserName = :hostun',
        ExpressionAttributeValues: { ":hostun": hostUserName },
	Limit: 99,
    };

    console.log( "PEQActions needing update");
    let gPromise = paginatedScan( params );
    return gPromise.then((peqas) => peqas );
}

// Conditional update would have been nice as an extra check, but dynamo has issues with expressionAttrVal vs. conditionalExpression
// Is OK without it, since all peqa have already matched the condition.
async function updatePEQActions( peqa, ceUID ) {
    
    const params = {
	TableName: 'CEPEQActions',
	Key: { "PEQActionId": peqa.PEQActionId },
	UpdateExpression: 'set CEUID = :ceuid',
        ExpressionAttributeValues: {
            ':ceuid':  ceUID,
        }
    };
    console.log( "update peqa where host data is", peqa.HostUserName, peqa.PEQActionId, peqa.CEUID, ceUID);
    assert( peqa.CEUID == "---" || peqa.CEUID == ceUID );

    const updateCmd = new UpdateCommand( params );
    return bsdb.send( updateCmd ).then(() => true );
}



// Note: newHostAcct.id is NOT the same as the Host ownerId
async function putHostA( newHostAcct, update, pat ) {
    if( update == "true" ) {
	const params = {
            TableName: 'CEHostUser',
	    Key: { "HostUserId": newHostAcct.hostUserId },
	    UpdateExpression: 'set CEUserId = :ceoid, HostUserName = :hostun, CEProjectIds = :pid, FutureCEProjects = :fid',
	    ExpressionAttributeValues: { ':ceoid': newHostAcct.ceUserId, ':hostun': newHostAcct.hostUserName, ':pid': newHostAcct.ceProjectIds, ':fid': newHostAcct.futureCEProjects }
	};
	
	console.log( "HostAcct update repos", params);
	const updateCmd = new UpdateCommand( params );	
	await bsdb.send( updateCmd ); 
    }
    else {
	const params = {
            TableName: 'CEHostUser',
	    Item: {
		"HostUserId":       newHostAcct.hostUserId, 
		"CEUserId":         newHostAcct.ceUserId,
		"HostUserName":     newHostAcct.hostUserName,
		"HostPlatform":     newHostAcct.hostPlatform,
		"CEProjectIds":     newHostAcct.ceProjectIds,
		"FutureCEProjects": newHostAcct.futureCEProjects,
		"HostPAT":          pat
	    }
	};
	
	console.log( "HostAcct put repos", params);
	const putCmd = new PutCommand( params );
	
	await bsdb.send( putCmd ); 
    }


    let updated = true;
    if( update == "false" ) {
	// Must update any PEQActions created before hostUser had ceUID
	// Suure would be nice to have a real 'update where'.   bah
	// Majority of cases will be 0 or just a few PEQActions without a CE UID, 
	// especially since a PEQAction requires a PEQ label.
	const hostPEQA = await getPEQActionsFromHost( newHostAcct.hostUserName );
	await hostPEQA.forEach( async ( peqa ) => updated = updated && await updatePEQActions( peqa, newHostAcct.ceUserId ));
	console.log( "putHostA returning", updated );
    }

    return success( updated );
}

// NOTE.  Repos is an array of current ceProjIds, together with full name repos that are not yet CEProjects
async function getProjectStatus( repos ) {
    console.log( "Which HostAs are CEPs?", repos );

    let promises = [];
    repos.forEach(function (projName) {
	const params = {
	    TableName: 'CEProjects',
	    FilterExpression: 'CEProjectId = :pid',
	    ExpressionAttributeValues: { ":pid": projName }};
	
	promises.push( paginatedScan( params ) );
    });

    // Promises execute in parallel, collect in order
    return await Promise.all( promises )
	.then((results) => {
	    console.log( '...promises done' );
	    let res = [];
	    results.forEach( function ( project ) {
		assert( project.length <= 1 );
		if( project.length == 1 ) {
		    res.push( project[0] );
		}
		else {
		    res.push( -1 );
		}
	    });
	    
	    if( res.length > 0 ) { return res; }        // internal, no additional json layer
	    else                 { return []; }
	});
}

async function getHostA( uid ) {
    const paramsP = {
        TableName: 'CEHostUser',
        FilterExpression: 'CEUserId = :ceid',
        ExpressionAttributeValues: { ":ceid": uid },
	Limit: 99,
    };

    console.log( "Host Account repos");
    let hostAccPromise = paginatedScan( paramsP );

    let hostAccs = await hostAccPromise;
    if( ! Array.isArray(hostAccs) || !hostAccs.length ) { return NO_CONTENT; }

    for( const hostAcc of hostAccs ) {
	console.log( "Found Host account ", hostAcc );

	// FutureCEProjects are repos, currently, no need to check
	// let ceps = await getProjectStatus( hostAcc.CEProjectIds.concat( hostAcc.FutureCEProjects ) );
	// hostAcc.ceProjs = ceps.map( cep => cep == -1 ? "false" : "true" );

	hostAcc.ceProjects = await getProjectStatus( hostAcc.CEProjectIds );
	console.log( "...working with ", hostAcc.ceProjs );
    }
    return success( hostAccs );
}

async function getHostProjs( query ) {

    // XXX no longer in use
    assert( false ); 
    
    console.log( "Get host projects from", query.CEProjectId );

    const peqsWrap = await getEntries( "CEPEQs", {"CEProjectId": query.CEProjectId } );
    const peqs     = JSON.parse( peqsWrap.body );

    if( peqsWrap.statusCode != 201 ) { return peqsWrap; }
    // console.log( peqsWrap, peqs );
    
    let hprojs = [];
    for( const peq of peqs ) {
	if( !hprojs.includes( peq.HostProjectId ) ) { hprojs.push( peq.HostProjectId ); }
    }

    return success( hprojs );
}


function errorResponse(status, errorMessage, awsRequestId) {
    return {
	statusCode: status, 
	body: JSON.stringify({
	    Error: errorMessage,
	    Reference: awsRequestId,
	}),
	headers: { 'Access-Control-Allow-Origin': '*' }
    };
}






