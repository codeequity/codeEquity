// CodeEquity data interface

const AWS = require('aws-sdk');
const bsdb = new AWS.DynamoDB.DocumentClient();
var assert = require('assert');

// sigh.  thanks dynamodb.  
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
    else if( endPoint == "PutPerson")      { resultPromise = putPerson( rb.NewPerson ); }
    else if( endPoint == "RecordPEQ")      { resultPromise = recPeq( username, rb.Title, rb.PeqAmount ); }
    else if( endPoint == "GetPEQ")         { resultPromise = getPeq( rb.CEUID, rb.GHRepo ); }
    else if( endPoint == "GetPEQActions")  { resultPromise = getPeqActions( rb.CEUID, rb.GHRepo ); }
    else if( endPoint == "GetPEQSummary")  { resultPromise = getPeqSummary( rb.GHRepo ); }
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

// XXX JS testing func - going away
async function recPeq( username, title, peqAmount ) {
    const personId  = await getPersonId( username );
    const notyet = "---";
    const notyets = ["---"];
    
    const params = {
        TableName: 'CEPEQActions',
	Item: {
	    "PEQActionId":  randAlpha(10),
	    "CEUID":        personId,
	    "GHUserName":   notyet,
	    "GHRepo":       notyet,
	    "Verb":         notyet,
	    "Action":       notyet,
	    "Subject":      notyets,
	    "Note":         notyet,
	    "EntryDate":    notyet,
	    "RawRecBody":   notyet
	}
    };

    let recPromise = bsdb.put( params ).promise();
    return recPromise.then(() =>success( true ));

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

// Get all for uid, app can figure out whether or not to sort by associated ghUser
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

async function getPeqSummary( ghRepo ) {
    const paramsP = {
        TableName: 'CEPEQSummary',
        FilterExpression: 'GHRepo = :ghrepo AND MostRecent = :true',
        ExpressionAttributeValues: { ":ghrepo": ghRepo, ":true": true }
    };

    console.log( "Looking for peqSummary");
    let peqPromise = bsdb.scan( paramsP );
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
	} else
	{
	    return {
		statusCode: 204,
		body: JSON.stringify( "---" ),
		headers: { 'Access-Control-Allow-Origin': '*' }
	    };
	}
    });
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
    return ghaPromise.then(() => success( true ));
}

// putPEQSummary
// Note, on update be sure to set mostRecent to false for previous mostRecent
// Consider keeping only 2 records, max, at least initially


// XXX Placeholder
async function getAgreements( username ) {
    const paramsP = {
        TableName: 'CEAgreements',
        FilterExpression: 'UserName = :uname',
        ExpressionAttributeValues: { ":uname": username }
    };

    let personPromise = bsdb.scan( paramsP ).promise();
    return personPromise.then((persons) => {
	// console.log( "Persons: ", persons );
	assert(persons.Count == 1 );
	console.log( "Found person ", persons.Items[0] );
	console.log( "Found PersonId ", persons.Items[0].PersonId );
	return success( persons.Items[0].PersonId );
    });
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



