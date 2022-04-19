// CodeEquity data interface

const AWS = require('aws-sdk');
const bsdb = new AWS.DynamoDB.DocumentClient();
var assert = require('assert');

// NOTE, as of 5/20 dynamo supports empty strings.  yay.  Save this for sets & etc.
const EMPTY = "---EMPTY---";  

const SPIN_DELAY = 200; // spin wait on fine-grained lock conflict
const MAX_SPIN   = 20;  // how many times will we retry

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

exports.handler = (event, context, callback) => {

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
    else if( endPoint == "GetID")          { resultPromise = getPersonId( username ); }             // username is local
    else if( endPoint == "GetCEUID")       { resultPromise = getCEUID( rb.GHUserName ); }           // return varies on no_content
    else if( endPoint == "RecordPEQ")      { resultPromise = putPeq( rb.newPEQ ); }
    else if( endPoint == "RecordPEQAction"){ resultPromise = putPAct( rb.newPAction ); }
    else if( endPoint == "CheckSetGHPop")  { resultPromise = checkSetGHPop( rb.GHRepo, rb.Set ); }
    else if( endPoint == "GetPEQ")         { resultPromise = getPeq( rb.CEUID, rb.GHUserName, rb.GHRepo ); }
    else if( endPoint == "GetPEQsById")    { resultPromise = getPeqsById( rb.PeqIds ); }
    else if( endPoint == "GetPEQActions")  { resultPromise = getPeqActions( rb.CEUID, rb.GHUserName, rb.GHRepo ); }
    else if( endPoint == "GetPActsById")   { resultPromise = getPActsById( rb.GHRepo, rb.PeqIds ); }
    else if( endPoint == "GetUnPAct")      { resultPromise = getUnPActions( rb.GHRepo ); }
    else if( endPoint == "UpdatePAct")     { resultPromise = updatePActions( rb.PactIds ); }
    else if( endPoint == "Uningest")       { resultPromise = unIngest( rb.tableName, rb.query ); }    
    else if( endPoint == "UpdatePEQ")      { resultPromise = updatePEQ( rb.pLink ); }
    else if( endPoint == "putPActCEUID")   { resultPromise = updatePActCE( rb.CEUID, rb.PEQActionId); }
    else if( endPoint == "UpdateColProj")  { resultPromise = updateColProj( rb.query ); }
    else if( endPoint == "PutPSum")        { resultPromise = putPSum( rb.NewPSum ); }
    else if( endPoint == "GetGHA")         { resultPromise = getGHA( rb.PersonId ); }
    else if( endPoint == "PutGHA")         { resultPromise = putGHA( rb.NewGHA ); }
    else if( endPoint == "PutPerson")      { resultPromise = putPerson( rb.NewPerson ); }
    else if( endPoint == "RecordLinkage")  { resultPromise = putLinkage( rb.summary ); }
    else if( endPoint == "UpdateLinkage")  { resultPromise = updateLinkage( rb.newLoc ); }
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

};


function sleep(ms) {
    console.log( "Sleep for", ms, "ms" );
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Note: .Count and .Items do not show up here, as they do in bsdb.scan
function paginatedScan( params ) {

    return new Promise((resolve, reject) => {
	var result = [];
	
	// adding 1 extra items due to a corner case bug in DynamoDB
	params.Limit = params.Limit + 1;
	bsdb.scan( params, onScan );

	function onScan(err, data) {
	    if (err) { return reject(err); }
	    result = result.concat(data.Items);
	    if (typeof data.LastEvaluatedKey === "undefined") {
		return resolve(result);
	    } else {
		params.ExclusiveStartKey = data.LastEvaluatedKey;
		//console.log( "scan more, last: ", data.LastEvaluatedKey );
		bsdb.scan( params, onScan );
	    }

	}
    });
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

    let promise = bsdb.update( params ).promise();
    return promise.then(() => true );
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

    const paramsSL = {
	TableName: 'CEPEQActions',
	Key: {"PEQActionId": pactId },
	UpdateExpression: 'set Locked = :lockVal',
	ExpressionAttributeValues: { ':lockVal': lockVal }};
    
    let lockPromise = bsdb.update( paramsSL ).promise();
    return lockPromise.then(() => success( true ));
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
	props = ["PersonId", "UserName", "Email", "First", "Last"];
	break;
    case "CEPEQs":
	props = [ "PEQId", "Active", "CEGrantorId", "PeqType", "Amount", "GHRepo", "GHProjectId", "GHIssueId", "GHIssueTitle" ];
	break;
    case "CEPEQActions":
	props = [ "PEQActionId", "CEUID", "GHUserName", "GHRepo", "Verb", "Action"];
	break;
    case "CEPEQRaw":
	props = [ "PEQRawId" ];
	break;
    case "CERepoStatus":
	props = [ "GHRepo" ];
	break;
    case "CEPEQSummary":
	props = [ "GHRepo" ];
	break;
    case "CELinkage":
	props = [ "GHRepo" ];
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
	props = [ "PEQId", "Active", "CEGrantorId", "GHHolderId", "PeqType", "Amount", "GHRepo", "GHProjectId", "GHIssueId", "GHIssueTitle" ];
	break;
    case "CEPEQActions":
	props = [ "PEQActionId", "CEUID", "GHUserName", "GHRepo", "Verb", "Action", "Subject", "Ingested"];
	break;
    case "CEPEQRaw":
	props = [ "PEQRawId" ];
	break;
    case "CERepoStatus": 
	props = [ "GHRepo" ];
	break;
    case "CEPEQSummary": 
	props = [ "GHRepo" ];
	break;
    default:
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
    case "CERepoStatus": 
	pkey1 = "GHRepo";
	break;
    case "CEPEQSummary": 
	pkey1 = "PEQSummaryId";
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

	promises.push( bsdb.delete( params ).promise() );
    }

    return await Promise.all( promises )
	.then((results) => {
	    console.log( '...promises done' );
	    return success( true );
	});
}




async function getPersonId( username ) {
    const paramsP = {
        TableName: 'CEPeople',
        FilterExpression: 'UserName = :uname',
        ExpressionAttributeValues: { ":uname": username }
    };

    let personPromise = paginatedScan( paramsP );
    return personPromise.then((persons) => {
	assert(persons.length == 1 );
	console.log( "Found PersonId ", persons[0].PersonId );
	return success( persons[0].PersonId );
    });
}


async function getCEUID( ghUser ) {
    const params = {
        TableName: 'CEGithub',
        FilterExpression: 'GHUserName = :uname',
        ExpressionAttributeValues: { ":uname": ghUser }
    };

    let promise = paginatedScan( params );
    return promise.then((gh) => {
	if( gh.length == 1 ) {
	    console.log( "Found ceOwnerId ", gh[0].CEOwnerId );
	    return success( gh[0].CEOwnerId );
	}
	else {
	    // may not be one yet
	    return success( "" );
	}
    });
}

async function putPerson( newPerson ) {
    // console.log('Put Person!', newPerson.firstName );

    const paramsPP = {
	TableName: 'CEPeople',
	Item: {
	    "PersonId": newPerson.id,
	    "First":    newPerson.firstName,
	    "Last":     newPerson.lastName,
	    "UserName": newPerson.userName,
	    "Email":    newPerson.email,
	    "Locked":   newPerson.locked,
	    "ImagePng": newPerson.imagePng            
	}
    };
    
    let personPromise = bsdb.put( paramsPP ).promise();
    return personPromise.then(() => success( true ));
}

async function getLinkage( ghRepo ) {
    const params = {
        TableName: 'CELinkage',
        FilterExpression: 'GHRepo = :ghRepo',
        ExpressionAttributeValues: { ":ghRepo": ghRepo }
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

    let pPromise = bsdb.put( params ).promise();
    return pPromise.then(() => success( summary.CELinkageId ));
}

async function putLinkage( summary ) {
    // get any entry with summary.GHRepo, overwrite
    let oldSummary = await getLinkage( summary.GHRepo );
    
    // write new summary
    summary.CELinkageId = oldSummary == -1 ? randAlpha(10) : oldSummary.CELinkageId;
    console.log( "overwriting CELinks for", summary.CELinkageId );
    return await writeLinkHelp( summary );
}

async function updateLinkage( newLoc ) {
    // get any entry with summary.GHRepo, overwrite
    let oldSummary = await getLinkage( newLoc.GHRepo );

    // Note!  First created project in repo will not have summary.
    if( oldSummary == -1 ) {
	oldSummary = {};
	oldSummary.CELinkageId = randAlpha(10);
	oldSummary.GHRepo      = newLoc.GHRepo;
	console.log( "Created new summary object" );
    }

    // Update to catch and overwrite with name changes
    oldSummary.LastMod = newLoc.LastMod;
    let foundLoc = false;
    if( 'Locations' in oldSummary ) {
	for( var loc of oldSummary.Locations ) {
	    if( loc.GHProjectId == newLoc.Location.GHProjectId && loc.GHColumnId == newLoc.Location.GHColumnId ) {
		console.log( "updating with", newLoc.Location.GHProjectName, newLoc.Location.GHColumnName );
		loc.GHProjectName = newLoc.Location.GHProjectName;
		loc.GHColumnName  = newLoc.Location.GHColumnName;
		loc.Active        = newLoc.Location.Active;
		foundLoc = true;
	    }
	}
    }
    else { oldSummary.Locations = []; }

    // Add, if not already present
    if( !foundLoc ) {
	let aloc = {};
	console.log( "Create new for", newLoc.Location.GHProjectName, newLoc.Location.GHColumnName );
	aloc.GHProjectId   = newLoc.Location.GHProjectId;
	aloc.GHProjectName = newLoc.Location.GHProjectName;
	aloc.GHColumnId    = newLoc.Location.GHColumnId;
	aloc.GHColumnName  = newLoc.Location.GHColumnName;
	aloc.Active        = newLoc.Location.Active;
	oldSummary.Locations.push( aloc );
    }
    
    return await writeLinkHelp( oldSummary );
}

async function checkSetGHPop( repo, setVal ) {

    let params = { TableName: 'CERepoStatus' };
    let promise = null;

    if( setVal == "true" ) {
	params.Key                       = { "GHRepo": repo };
	params.UpdateExpression          = 'set Populated = :lockVal';
	params.ExpressionAttributeValues = { ':lockVal': setVal };

	promise = bsdb.update( params ).promise();
	return promise.then(() => success( true ));
    }
    else {
	params.FilterExpression          = 'GHRepo = :repo';
	params.ExpressionAttributeValues = { ':repo': repo };

	promise = paginatedScan( params );
	return promise.then((res) => {
	    if( res && res.length > 0 ) { return success( res[0].Populated ); }
	    else      { return success( false ); }
	});
    }
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
    
    const params = {
        TableName: 'CEPEQs',
	Item: {
	    "PEQId":        newPEQ.PEQId,
	    "CEHolderId":   newPEQ.CEHolderId,
	    "GHHolderId":   newPEQ.GHHolderId,
	    "CEGrantorId":  newPEQ.CEGrantorId,
	    "PeqType":      newPEQ.PeqType,
	    "Amount":       newPEQ.Amount,
	    "AccrualDate":  newPEQ.AccrualDate,
	    "VestedPerc":   newPEQ.VestedPerc,
	    "GHRepo":       newPEQ.GHRepo,
	    "GHProjectSub": newPEQ.GHProjectSub,
	    "GHProjectId":  newPEQ.GHProjectId,
	    "GHIssueId":    newPEQ.GHIssueId,
	    "GHIssueTitle": newPEQ.GHIssueTitle,
	    "Active":       newPEQ.Active
	}
    };

    let recPromise = bsdb.put( params ).promise();
    let retVal = recPromise.then(() => success( newPEQ.PEQId ));
    retVal = await retVal;

    // No need to wait for unset lock
    setPeqLock( newPEQ.PEQId, false );
    return retVal;
}


async function putPAct( newPAction ) {

    let rewrite = newPAction.hasOwnProperty( "PEQActionId" );
    assert( !rewrite || newPAction.RawBody == "" );  // comment out for loadRaw
    
    let newId = rewrite ? newPAction.PEQActionId : randAlpha(10);
    console.log( newId, newPAction.Verb, newPAction.Action, newPAction.Subject );
    const params = {
        TableName: 'CEPEQActions',
	Item: {
	    "PEQActionId":  newId,
	    "CEUID":        newPAction.CEUID,
	    "GHUserName":   newPAction.GHUserName,
	    "GHRepo":       newPAction.GHRepo,
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

    let promise = "";
    if( rewrite ) { promise = bsdb.put( params ).promise(); }  // set to false for loadRaw
    else {
	const paramsR = {
            TableName: 'CEPEQRaw',
	    Item: {
		"PEQRawId":  newId,
		"RawBody":   newPAction.RawBody,
	    }
	};
	
	promise = bsdb.transactWrite({
	    TransactItems: [
		{ Put: params }, 
		{ Put: paramsR }, 
	    ]}).promise();
    }
    
    return promise.then(() =>success( newId ));
}


// XXX Slow
// Get all for uid, app can figure out whether or not to sort by associated ghUser
// NOTE: ignore locks on read
async function getPeq( uid, ghUser, ghRepo ) {
    const params = { TableName: 'CEPEQs', Limit: 99, };

    if( uid != "" ) {
        params.FilterExpression = 'contains( CEHolderId, :ceid) AND GHRepo = :ghrepo AND Active = :true';
        params.ExpressionAttributeValues = { ":ceid": uid, ":ghrepo": ghRepo, ":true": true };
    }
    else {
        params.FilterExpression = 'contains( GHHolderId, :id) AND GHRepo = :ghrepo AND Active = :true';
        params.ExpressionAttributeValues = { ":id": ghUser, ":ghrepo": ghRepo, ":true": true };
    }

    console.log( "Looking for peqs", params);
    let peqPromise = paginatedScan( params );
    return peqPromise.then((peqs) => {
	console.log( "Found peqs ", peqs );
	return success( peqs );
    });
}

async function getPeqActions( uid, ghUser, ghRepo ) {
    let params = { TableName: 'CEPEQActions', Limit: 99, };

    if( uid != "" ) {
	params.FilterExpression = 'CEUID = :ceid AND GHRepo = :ghrepo';
        params.ExpressionAttributeValues = { ":ceid": uid, ":ghrepo": ghRepo };
    }
    else {
	params.FilterExpression = 'GHUserName = :id AND GHRepo = :ghrepo';
        params.ExpressionAttributeValues = { ":id": ghUser, ":ghrepo": ghRepo };
    }
    
    console.log( "Looking for peqActions");
    let peqPromise = paginatedScan( params );
    return peqPromise.then((peqs) => {
	//console.log( "Found peqActions ", peqs );
	return success( peqs );
    });
}

// Lock.  Then get uningested PEQActions
async function getUnPActions( ghRepo ) {
    const paramsP = {
        TableName: 'CEPEQActions',
        FilterExpression: 'GHRepo = :ghrepo AND Ingested = :false',
        ExpressionAttributeValues: { ":ghrepo": ghRepo, ":false": "false" },
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
	
	promises.push( bsdb.update( params ).promise() );
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

    console.log( "Updating pactions to not ingested for", query.GHRepo );

    // Find uningested
    const params = {
        TableName: tableName,
        FilterExpression: 'GHRepo = :ghrepo AND Ingested = :true',
        ExpressionAttributeValues: { ':ghrepo': query.GHRepo , ':true': "true" },
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
	
	promises.push( bsdb.update( params ).promise() );
    });


    // All locked should be unlocked.
    const lParams = {
        TableName: tableName,
        FilterExpression: 'GHRepo = :ghrepo AND Locked = :true',
        ExpressionAttributeValues: { ':ghrepo': query.GHRepo , ':true': "true" },
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
	
	promises.push( bsdb.update( params ).promise() );
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

    console.log( "Get peqs by id, mamasita", peqIds );

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
async function getPActsById( ghRepo, peqIds ) {

    console.log( "Get pacts by peq id", peqIds );

    let promises = [];
    peqIds.forEach(function (peqId) {
	const params = {
	    TableName: 'CEPEQActions',
	    FilterExpression: 'contains( Subject, :peqId) AND GHRepo = :ghrepo',
	    ExpressionAttributeValues: { ":peqId": peqId, ":ghrepo": ghRepo }};
	
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

async function getRepoStatus( repos ) {
    console.log( "Which GHAs are CEPs?", repos );

    let promises = [];
    repos.forEach(function (fullName) {
	const params = {
	    TableName: 'CERepoStatus',
	    FilterExpression: 'GHRepo = :ghRepo',
	    ExpressionAttributeValues: { ":ghRepo": fullName }};
	
	promises.push( paginatedScan( params ) );
    });

    // Promises execute in parallel, collect in order
    return await Promise.all( promises )
	.then((results) => {
	    console.log( '...promises done' );
	    let res = [];
	    results.forEach( function ( repo ) {
		assert( repo.length <= 1 );
		if( repo.length == 1 ) {
		    res.push( repo[0] );
		}
		else {
		    res.push( -1 );
		}
	    });
	    
	    if( res.length > 0 ) { return res; }        // internal, no additional json layer
	    else                 { return []; }
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
    let props = [ "AccrualDate", "Active", "Amount", "CEGrantorId", "CEHolderId", "GHHolderId", "GHIssueTitle", "GHProjectSub", "PeqType", "VestedPerc" ];
    let updateVals = buildUpdateParams( pLink, props );
    assert( updateVals.length == 2 );

    let params = {};
    params.TableName                  = 'CEPEQs';
    params.Key                        = {"PEQId": pLink.PEQId };
    params.UpdateExpression           = updateVals[0];
    params.ExpressionAttributeValues  = updateVals[1];

    let promise = bsdb.update( params ).promise();
    let retVal = promise.then(() => success( true ));
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
    
    let promise = bsdb.update( params ).promise();
    return promise.then(() => success( true ));
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

    // query: GHRepo, GHProjectId, OldName, NewName, Column
    // if proj name mode, every peq in project gets updated.  big change.
    // XXX if col name change, could be much smaller, but would need to generate list of peqIds in ingest from myGHLinks.  Possible.. 

    // Get all active peqs in GHProjId, ghRepo
    const query = { GHRepo: update.GHRepo, GHProjectId: update.GHProjectId, Active: "true" };
    var peqsWrap = await getEntries( "CEPEQs", query );
    // console.log( "Found peqs, raw:", peqsWrap );

    if( peqsWrap.statusCode != 201 ) { return peqsWrap; }

    const peqs = JSON.parse( peqsWrap.body );
    // console.log( "Found peqs:", peqs );
    
    //   if Proj, if psub.len > 1,  update psub.last-1 where matches query.OldName with query.NewName
    for( var peq of peqs ) {
	assert( peq.GHProjectSub.length >= 1 );
	console.log( "working on", peq );
	// not all peqs in project belong to this column.  
	if( update.Column == "true" ) {
	    let lastElt = peq.GHProjectSub[ peq.GHProjectSub.length - 1];
	    if( lastElt == update.OldName ) {
		peq.GHProjectSub[ peq.GHProjectSub.length - 1] = update.NewName;
		console.log( "Updated column portion of psub", peq.GHIssueTitle, peq.GHProjectSub );
	    }
	}
	else if( peq.GHProjectSub.length >= 2 ) {
	    let pElt = peq.GHProjectSub[ peq.GHProjectSub.length - 2];
	    assert( pElt == update.OldName || pElt == update.NewName );
	    peq.GHProjectSub[ peq.GHProjectSub.length - 2] = update.NewName;
	    console.log( "Updated project portion of psub", peq.GHIssueTitle, peq.GHProjectSub );
	}
    }

    let promises = [];
    for( const peq of peqs ) {
	const params = {
	    TableName: 'CEPEQs',
	    Key: {"PEQId": peq.PEQId},
	    UpdateExpression: 'set GHProjectSub = :psub',
	    ExpressionAttributeValues: { ':psub': peq.GHProjectSub }};

	promises.push( bsdb.update( params ).promise() );
    }

    return await Promise.all( promises )
	.then((results) => {
	    console.log( '...promises done' );
	    return success( true );
	});
}




// Overwrites any existing record
async function putPSum( psum ) {
    const params = {
        TableName: 'CEPEQSummary',
	Item: {
	    "PEQSummaryId": psum.id, 
	    "GHRepo":       psum.ghRepo,
	    "TargetType":   psum.targetType,
	    "TargetId":     psum.targetId,
	    "LastMod":      psum.lastMod,
	    "Allocations":  psum.allocations
	}
    };

    console.log( "PEQSummary put");

    let promise = bsdb.put( params ).promise();
    return promise.then(() => success( true ));
}

async function getGHA( uid ) {
    const paramsP = {
        TableName: 'CEGithub',
        FilterExpression: 'CEOwnerId = :ceid',
        ExpressionAttributeValues: { ":ceid": uid },
	Limit: 99,
    };

    console.log( "GH Account repos");
    let ghaPromise = paginatedScan( paramsP );

    let ghas = await ghaPromise;
    if( ! Array.isArray(ghas) || !ghas.length ) { return NO_CONTENT; }

    for( const gha of ghas ) {
	console.log( "Found GH account ", gha );

	let ceps = await getRepoStatus( gha.Repos );
	console.log( "...working with ", ceps );
	
	gha.ceProjs = ceps.map( cep => (cep == -1 || cep.Populated == "false") ? "false" : "true" );
    }
    return success( ghas );
}

// XXX this gets all, not just needing update
// XXX as it is, replace with getPeqActions
async function getPEQActionsFromGH( ghUserName ) {
    const params = {
        TableName: 'CEPEQActions',
        FilterExpression: 'GHUserName = :ghun',
        ExpressionAttributeValues: { ":ghun": ghUserName },
	Limit: 99,
    };

    console.log( "PEQActions needing update");
    let gPromise = paginatedScan( params );
    return gPromise.then((peqas) => peqas );
}

// Conditional update would have been nice as an extra check, but dynamo has issues with expressoinAttrVal vs. conditionalExpression
// Is OK without it, since all peqa have already matched the condition.
async function updatePEQActions( peqa, ceUID ) {
    
    const paramsU = {
	TableName: 'CEPEQActions',
	Key: { "PEQActionId": peqa.PEQActionId },
	UpdateExpression: 'set CEUID = :ceuid',
        ExpressionAttributeValues: {
            ':ceuid':  ceUID,
        }
    };
    console.log( "update peqa where gh is", peqa.GHUserName, peqa.PEQActionId, ceUID);
    assert( peqa.CEUID == "" );

    let uPromise = bsdb.update( paramsU ).promise();
    return uPromise.then(() => true );
}

async function putGHA( newGHAcct ) {
    const paramsP = {
        TableName: 'CEGithub',
	Item: {
	    "GHAccountId": newGHAcct.id, 
	    "CEOwnerId":   newGHAcct.ceOwnerId,
	    "GHUserName":  newGHAcct.ghUserName,
	    "Repos":       newGHAcct.repos
	}
    };

    console.log( "GHAcct put repos");

    let ghaPromise = bsdb.put( paramsP ).promise();
    await ghaPromise;

    // Must update any PEQActions created before ghUser had ceUID
    // Suure would be nice to have a real 'update where'.   bah
    // Majority of cases will be 0 or just a few PEQActions without a CE UID, 
    // especially since a PEQAction requires a PEQ label.
    let updated = true;
    const ghPEQA = await getPEQActionsFromGH( newGHAcct.ghUserName );
    await ghPEQA.forEach( async ( peqa ) => updated = updated && await updatePEQActions( peqa, newGHAcct.ceOwnerId ));
    console.log( "putGHA returning", updated );
    return success( updated );
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
