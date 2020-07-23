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

    // This includes auth, etc
    // console.log('Received event: ', event);
    console.log('Received event: ', event.body);

    const username = event.requestContext.authorizer.claims['cognito:username'];
    const rb = JSON.parse(event.body);

    var endPoint = rb.Endpoint;
    var resultPromise;

    if(      endPoint == "GetPeople")      { resultPromise = getPeople( username ); }
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

function success( result ) {
    return {
	statusCode: 201,
	body: JSON.stringify( result ),
	headers: { 'Access-Control-Allow-Origin': '*' }
    };
}


// XXX PLACEHOLDER
async function getPeople( username ) {

    const uname = username + "_";

    const paramsGL = {
	TableName: 'People',
	FilterExpression: 'begins_with(UserName, :username ) AND Locked = :false',
	ExpressionAttributeValues: { ":username": uname, ":false": "false" }};
    
    let lockPromise = bsdb.scan( paramsGL ).promise();
    return lockPromise.then((persons) => {
	console.log( "Pass", persons.Items );
	if( persons.Items.length > 0 ) { return success( persons.Items[0].UserName ); }
	else                           { return success( "" ); }
    });
}

// XXX PLACEHOLDER
async function getAgreements( username ) {

    const uname = username + "_";

    const paramsGL = {
	TableName: 'People',
	FilterExpression: 'begins_with(UserName, :username ) AND Locked = :false',
	ExpressionAttributeValues: { ":username": uname, ":false": "false" }};
    
    let lockPromise = bsdb.scan( paramsGL ).promise();
    return lockPromise.then((persons) => {
	console.log( "Pass", persons.Items );
	if( persons.Items.length > 0 ) { return success( persons.Items[0].UserName ); }
	else                           { return success( "" ); }
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



