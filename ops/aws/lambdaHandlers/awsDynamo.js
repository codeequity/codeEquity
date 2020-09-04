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
    if(      endPoint == "GetPeople")      { resultPromise = getPeople( username ); }
    else if( endPoint == "RecordPEQ")      { resultPromise = recPeq( username, rb.Title, rb.PeqAmount ); }
    else if( endPoint == "GetPEQ")         { resultPromise = getPeq( username ); }
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

function getPersonId( username ) {
    // Params to get PersonID from UserName
    console.log( "getPID, checking ", username );
    const paramsP = {
        TableName: 'CEPeople',
        FilterExpression: 'UserName = :uname',
        ExpressionAttributeValues: { ":uname": username }
    };

    let personPromise = bsdb.scan( paramsP ).promise();
    return personPromise.then((persons) => {
	// console.log( "Persons: ", persons );
	assert(persons.Count == 1 );
	console.log( "Found person ", persons.Items[0] );
	return persons.Items[0].PersonId;
    });
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

async function getPeople( username ) {
    const paramsP = {
        TableName: 'CEPeople',
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

async function recPeq( username, title, peqAmount ) {
    const personId  = await getPersonId( username );

    const params = {
        TableName: 'CEPEQs',
	Item: {
	    "PEQId":     randAlpha(10),
	    "UserId":    personId,
	    "Title":     title,
	    "PeqAmount": peqAmount
	}
    };

    let recPromise = bsdb.put( params ).promise();
    return recPromise.then(() =>success( true ));

}

async function getPeq( username ) {
    const paramsP = {
        TableName: 'CEPEQs',
	Limit: 99,
    };

    console.log( "Looking for all peqs");
    let peqPromise = paginatedScan( paramsP );
    return peqPromise.then((peqs) => {
	console.log( "Found peqs ", peqs );
	return success( peqs );
    });
}


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



