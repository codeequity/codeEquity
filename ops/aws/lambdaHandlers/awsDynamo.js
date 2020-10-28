// CodeEquity data interface

const AWS = require('aws-sdk');
const bsdb = new AWS.DynamoDB.DocumentClient();
var assert = require('assert');

// NOTE, as of 5/20 dynamo supports empty strings.  yay.  Save this for sets & etc.
const EMPTY = "---EMPTY---";  

// Because we're using a Cognito User Pools authorizer, all of the claims
// included in the authentication token are provided in the request context.
// This includes the username as well as other attributes.
// The body field of the event in a proxy integration is a raw string.
// In order to extract meaningful values, we need to first parse this string
// into an object. A more robust implementation might inspect the Content-Type
// header first and use a different parsing strategy based on that value.
exports.handler = (event, context, callback) => {

    console.log( 'awsDynamo Handler start' );
    
    if (!event.requestContext.authorizer) {
	callback( null, errorResponse("401", 'Authorization not configured, dude', context.awsRequestId));
	return;
    }

    console.log('Received event: ', event.body);

    const username = event.requestContext.authorizer.claims['cognito:username'];
    const rb = JSON.parse(event.body);

    var endPoint = rb.Endpoint;
    var resultPromise;

    console.log( "User:", username, "Endpoint:", endPoint );
    if(      endPoint == "GetID")          { resultPromise = getPersonId( username ); }
    else if( endPoint == "GetCEUID")       { resultPromise = getCEUID( rb.GHUserName ); }
    else if( endPoint == "PutPerson")      { resultPromise = putPerson( rb.NewPerson ); }
    else if( endPoint == "RecordPEQ")      { resultPromise = putPeq( rb.newPEQ ); }
    else if( endPoint == "RecordPEQAction"){ resultPromise = putPAct( rb.newPAction ); }
    else if( endPoint == "RecordGHCard")   { resultPromise = putGHC( rb.icLink ); }
    else if( endPoint == "UpdateGHCard")   { resultPromise = updateGHC( rb.GHIssueId, rb.GHColumnId ); }
    else if( endPoint == "GetGHCard")      { resultPromise = getGHC( rb.GHIssueId ); }
    else if( endPoint == "GetGHCFromCard") { resultPromise = getGHCFromCard( rb.GHRepo, rb.GHProjName, rb.GHCardTitle ); }
    else if( endPoint == "GetPEQ")         { resultPromise = getPeq( rb.CEUID, rb.GHRepo ); }
    else if( endPoint == "GetPEQByIssue")  { resultPromise = getPeqByIssue( rb.GHIssueId ); }
    else if( endPoint == "GetPEQsById")    { resultPromise = getPeqsById( rb.PeqIds ); }
    else if( endPoint == "GetaPEQ")        { resultPromise = getaPeq( rb.Id ); }
    else if( endPoint == "GetPEQActions")  { resultPromise = getPeqActions( rb.CEUID, rb.GHRepo ); }
    else if( endPoint == "GetUnPAct")      { resultPromise = getUnPActions( rb.GHRepo ); }
    else if( endPoint == "UpdatePAct")     { resultPromise = updatePActions( rb.PactIds ); }
    else if( endPoint == "UpdatePEQ")      { resultPromise = updatePEQ( rb.PEQId, rb.CEHolderId ); }
    else if( endPoint == "putPActCEUID")   { resultPromise = updatePActCE( rb.CEUID, rb.PEQActionId); }
    else if( endPoint == "GetPEQSummary")  { resultPromise = getPeqSummary( rb.GHRepo ); }
    else if( endPoint == "PutPSum")        { resultPromise = putPSum( rb.NewPSum ); }
    else if( endPoint == "GetGHA")         { resultPromise = getGHA( rb.PersonId ); }
    else if( endPoint == "PutGHA")         { resultPromise = putGHA( rb.NewGHA ); }
    else if( endPoint == "GetAgreements")  { resultPromise = getAgreements( username ); }
    else {
	callback( null, errorResponse( "500", "EndPoint request not understood", context.awsRequestId));
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



// Note: .Count and .Items do not show up here, as they do in bsdb.scan
function paginatedScan( params ) {

    return new Promise((resolve, reject) => {
	var result = [];
	
	// adding 1 extra items due to a corner case bug in DynamoDB
	params.Limit = params.Limit + 1;
	bsdb.scan( params, onScan );

	function onScan(err, data) {
	    if (err) {
		return reject(err);
	    }
	    result = result.concat(data.Items);
	    //console.log( "on scan.." );
	    //data.Items.forEach(function(book) { console.log( book.Title ); });	    
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


async function getPersonId( username ) {
    const paramsP = {
        TableName: 'CEPeople',
        FilterExpression: 'UserName = :uname',
        ExpressionAttributeValues: { ":uname": username }
    };

    let personPromise = bsdb.scan( paramsP ).promise();
    return personPromise.then((persons) => {
	assert(persons.Count == 1 );
	console.log( "Found PersonId ", persons.Items[0].PersonId );
	return success( persons.Items[0].PersonId );
    });
}

async function getCEUID( ghUser ) {
    const params = {
        TableName: 'CEGithub',
        FilterExpression: 'GHUserName = :uname',
        ExpressionAttributeValues: { ":uname": ghUser }
    };

    let promise = bsdb.scan( params ).promise();
    return promise.then((gh) => {
	if( gh.Count == 1 ) {
	    console.log( "Found ceOwnerId ", gh.Items[0].CEOwnerId );
	    return success( gh.Items[0].CEOwnerId );
	}
	else {
	    // may not be one yet
	    return success( "" );
	}
    });
}

// XXX it is likely that CEProjects:ProjectId is good simply as issueId.
//     Buuut, keep the split a little longer to be sure.
async function getGHId( issueId ) {
    const paramsP = {
        TableName: 'CEProjects',
        FilterExpression: 'GHIssueId = :iid',
        ExpressionAttributeValues: { ":iid": issueId }
    };

    let ghPromise = bsdb.scan( paramsP ).promise();
    return ghPromise.then((ghc) => {
	assert(ghc.Count == 1 );
	console.log( "Found Id ", ghc.Items[0].ProjectId );
	return ghc.Items[0].ProjectId;
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

// GitHub card/issue association
async function getGHC( issueId ) {
    const paramsP = {
        TableName: 'CEProjects',
        FilterExpression: 'GHIssueId = :iid',
        ExpressionAttributeValues: { ":iid": issueId }
    };

    console.log( "GH card - issue");
    let ghcPromise = bsdb.scan( paramsP ).promise();
    return ghcPromise.then((ghc) => {
	if( ghc.Count == 1 ) {
	    return success( ghc.Items[0] );
	}
	else {
	    return {
		statusCode: 204,
		body: JSON.stringify( "---" ),
		headers: { 'Access-Control-Allow-Origin': '*' }
	    };
	}
    });
}

// GitHub card/issue association
async function getGHCFromCard( repo, projName, cardTitle) {
    const paramsP = {
        TableName: 'CEProjects',
        FilterExpression: 'GHRepo = :repo AND GHProjectName = :pname AND GHCardTitle = :ctitle',
        ExpressionAttributeValues: { ":repo": repo, ":pname": projName, ":ctitle": cardTitle }
    };

    console.log( "GH card - issue from card");
    let ghcPromise = bsdb.scan( paramsP ).promise();
    return ghcPromise.then((ghc) => {
	if( ghc.Count == 1 ) {
	    return success( ghc.Items[0] );
	}
	else {
	    return {
		statusCode: 204,
		body: JSON.stringify( "---" ),
		headers: { 'Access-Control-Allow-Origin': '*' }
	    };
	}
    });
}

async function putGHC( icLink ) {

    const params = {
        TableName: 'CEProjects',
	Item: {
	    "ProjectId":   randAlpha(10),
	    "GHRepo":      icLink.GHRepo,
	    "GHIssueId":   icLink.GHIssueId,
	    "GHIssueNum":  icLink.GHIssueNum,
	    "GHProjectId": icLink.GHProjectId,
	    "GHProjectName": icLink.GHProjectName,
	    "GHColumnId":  icLink.GHColumnId,
	    "GHColumnName": icLink.GHColumnName,
	    "GHCardId":    icLink.GHCardId,
	    "GHCardTitle": icLink.GHCardTitle,
	}
    };

    let recPromise = bsdb.put( params ).promise();
    return recPromise.then(() =>success( true ));
}

async function updateGHC( issueId, columnId ) {

    const projId  = await getGHId( issueId );
    console.log( "Updating by key", projId, columnId );

    const params = {
	TableName: 'CEProjects',
	Key: {"ProjectId": projId },
	UpdateExpression: 'set GHColumnId = :colId',
	ExpressionAttributeValues: { ':colId': columnId }};
    
    let uPromise = bsdb.update( params ).promise();
    return uPromise.then(() => success( true ));
}


async function putPeq( newPEQ ) {

    let newId = randAlpha(10);
    const params = {
        TableName: 'CEPEQs',
	Item: {
	    "PEQId":        newId,
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
	    "GHIssueTitle": newPEQ.GHIssueTitle
	}
    };

    let recPromise = bsdb.put( params ).promise();
    return recPromise.then(() =>success( newId ));
}


async function putPAct( newPAction ) {

    let newId = randAlpha(10);
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
	    "RawBody":      newPAction.RawBody,
	    "Ingested":     newPAction.Ingested,
	    "Locked":       newPAction.Locked,
	    "TimeStamp":    newPAction.TimeStamp
	}
    };

    let recPromise = bsdb.put( params ).promise();
    return recPromise.then(() =>success( newId ));
}


// Get all for uid, app can figure out whether or not to sort by associated ghUser
async function getPeq( uid, ghRepo ) {
    const paramsP = {
        TableName: 'CEPEQs',
        FilterExpression: 'CEHolderId = :ceid AND GHRepo = :ghrepo',
        ExpressionAttributeValues: { ":ceid": uid, ":ghrepo": ghRepo },
	Limit: 99,
    };

    console.log( "Looking for peqs");
    let peqPromise = paginatedScan( paramsP );
    return peqPromise.then((peqs) => {
	console.log( "Found peqs ", peqs );
	return success( peqs );
    });
}

async function getaPeq( peqid ) {
    const paramsP = {
        TableName: 'CEPEQs',
        FilterExpression: 'PEQId = :peqid',
        ExpressionAttributeValues: { ":peqid": peqid }
    };

    let peqPromise = bsdb.scan( paramsP ).promise();
    return peqPromise.then((peq) => {
	assert(peq.Count == 1 );
	console.log( "Found Peq ", peq.Items[0] );
	return success( peq.Items[0] );
    });
}

async function getPeqByIssue( issueId ) {
    const paramsP = {
        TableName: 'CEPEQs',
        FilterExpression: 'GHIssueId = :id',
        ExpressionAttributeValues: { ":id": issueId }
    };

    let peqPromise = bsdb.scan( paramsP ).promise();
    return peqPromise.then((peq) => {
	assert(peq.Count == 1 );
	console.log( "Found Peq ", peq.Items[0] );
	return success( peq.Items[0] );
    });
}

async function getPeqActions( uid, ghRepo ) {
    const paramsP = {
        TableName: 'CEPEQActions',
        FilterExpression: 'CEUID = :ceid AND GHRepo = :ghrepo',
        ExpressionAttributeValues: { ":ceid": uid, ":ghrepo": ghRepo },
	Limit: 99,
    };

    console.log( "Looking for peqActions");
    let peqPromise = paginatedScan( paramsP );
    return peqPromise.then((peqs) => {
	console.log( "Found peqActions ", peqs );
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
	    else {
		return {
		    statusCode: 204,
		    body: JSON.stringify( "---" ),
		    headers: { 'Access-Control-Allow-Origin': '*' }
		};
	    }
		
	});
}

// Unlock.  set PEQActions ingested to true
// XXX no update where.  this will be too slow
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

// Dynamo - to have a filterExpression that is, say, x in <a list>,
// you must construct the expression and the expressionAttrVals piece by piece, explicitly.  Then ordering is in question.
// For now, use promises.all to ensure ordering and skip explicit construction.  more aws calls, buuuuttt....
async function getPeqsById( peqIds ) {

    console.log( "Get peqs by id, mamasita", peqIds );

    let promises = [];
    peqIds.forEach(function (peqId) {
	const params = {
	    TableName: 'CEPEQs',
	    FilterExpression: 'PEQId = :peqId',
	    ExpressionAttributeValues: { ":peqId": peqId }};
	
	promises.push( bsdb.scan( params ).promise() );
    });

    // Promises execute in parallel, collect in order
    return await Promise.all( promises )
	.then((results) => {
	    console.log( '...promises done' );
	    let res = [];
	    results.forEach( function ( peq ) {
		assert( peq.Count == 1 );
		res.push( peq.Items[0] );
	    });
	    
	    if( res.length > 0 ) { return success( res ); }
	    else {
		return {
		    statusCode: 500,
		    body: JSON.stringify( "---" ),
		    headers: { 'Access-Control-Allow-Origin': '*' }
		};
	    }
	});
}

async function updatePEQ( peqId, ceHolderIds ) {

    console.log( "Updating assignees for", peqId );

    const params = {
	TableName: 'CEPEQs',
	Key: {"PEQId": peqId },
	UpdateExpression: 'set CEHolderId = :cehold',
	ExpressionAttributeValues: { ':cehold': ceHolderIds }};
    
    let promise = bsdb.update( params ).promise();
    return promise.then(() => success( true ));
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



async function getPeqSummary( ghRepo ) {
    const paramsP = {
        TableName: 'CEPEQSummary',
        FilterExpression: 'GHRepo = :ghrepo',
        ExpressionAttributeValues: { ":ghrepo": ghRepo }
    };

    console.log( "Looking for peqSummary");
    let peqPromise = bsdb.scan( paramsP ).promise();
    return peqPromise.then((peqs) => {
	assert( peqs.Count <= 1 );
	console.log( "Found peqSummary ", peqs );
	if( peqs.Count == 1 ) {
	    return success( peqs.Items[0] );
	}
	else {
	    return {
		statusCode: 204,
		body: JSON.stringify( "---" ),
		headers: { 'Access-Control-Allow-Origin': '*' }
	    };
	}
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
    return ghaPromise.then((ghas) => {
	console.log( "Found GH account ", ghas );

	if( Array.isArray(ghas) && ghas.length ) {
	    return success( ghas );
	}
	else {
	    return {
		statusCode: 204,
		body: JSON.stringify( "---" ),
		headers: { 'Access-Control-Allow-Origin': '*' }
	    };
	}
    });
}

async function getPEQActionsFromGH( ghUserName, ceUID ) {
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
    const ghPEQA = await getPEQActionsFromGH( newGHAcct.ghUserName, newGHAcct.ceOwnerId );
    await ghPEQA.forEach( async ( peqa ) => updated = updated && await updatePEQActions( peqa, newGHAcct.ceOwnerId ));
    console.log( "putGHA returning", updated );
    return success( updated );
}

// XXX Placeholder
async function getAgreements( username ) {
    return success( true );
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



