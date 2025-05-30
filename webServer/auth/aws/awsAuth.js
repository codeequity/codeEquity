import assert from 'assert' ;

import * as awsUtils from '../../utils/awsUtils.js';

// https://medium.com/@prasadjay/amazon-cognito-user-pools-in-nodejs-as-fast-as-possible-22d586c5c8ec

import AmazonCognitoIdentity from 'amazon-cognito-identity-js';
const CognitoUserPool = AmazonCognitoIdentity.CognitoUserPool;

import fetch from 'node-fetch';



function asyncAuthenticateUser(cognitoUser, authenticationDetails) {
  return new Promise(function(resolve, reject) {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: resolve,
      onFailure: reject,
      newPasswordRequired: resolve
    });
  });
}

async function getCogIDToken( ) {
    let poolData = awsUtils.getCognito();
    let authData = awsUtils.getCEServer();
    
    let userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    let userData = { Username: authData.Username, Pool: userPool };

    let authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails( authData );
    let cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    let idToken = '';
    try {
	let result = await asyncAuthenticateUser(cognitoUser, authenticationDetails);
	
	if ('idToken' in result) {
	    // console.log( "User", authData.Username, "authenticated");
	    // note result.idToken.jwtToken == result.getIdToken().getJwtToken()
	    idToken = result.idToken.jwtToken;
	}
	else {
	    console.log('We need a new password.')
	}
    }
    catch (error) {
	console.log(error.message)
    }

    return idToken;
}


export {getCogIDToken};
