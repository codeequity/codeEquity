import 'dart:convert';  // json encode/decode
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';
import 'package:http/http.dart' as http;
import 'package:github/github.dart';

import 'package:ceFlutter/utils.dart';

import 'package:ceFlutter/screens/launch_page.dart';

import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/person.dart';
import 'package:ceFlutter/models/ghAccount.dart';


Future<void> logoutWait( context, container, appState ) async {
   final wrapper = (() async {
         try {
            appState.cogUser = await appState.cogUserService.signOut();
            
            // Rebuilding page below, don't need to setState (which isn't available here). 
            appState.usernameController.clear();
            appState.passwordController.clear();
            appState.attributeController.clear();
            appState.confirmationCodeController.clear();
         } catch(e, stacktrace) {
            print(e);
            print(stacktrace);
            showToast( e.toString() );
         }           

      });
   wrapper();
}      


void logout( context, container, appState ) async {
   final wrapper = (() async {

         await logoutWait(context, container, appState );
            
         Navigator.pushAndRemoveUntil(
            context, 
            MaterialPageRoute(builder: (context) => CELaunchPage()),
            ModalRoute.withName("CESplashPage")
            );
      });
   wrapper();
}      


bool checkReauth( context, container ) {
   final appState  = container.state;
   print( "" );
   print( "" );
   print( "" );
   print (" !!! !!! !!!" );
   print (" !!! !!!" );
   print (" !!!" );
   print( "Refreshing tokens.." );
   print (" !!!" );
   print (" !!! !!!" );
   print (" !!! !!! !!!" );
   print( "" );
   print( "" );
   print( "" );
   showToast( "Cloud tokens expired, reauthorizing.." );
   
   appState.authRetryCount += 1; 
   if( appState.authRetryCount > 100 ) {
      print( "Too many reauthorizations, please sign in again" );
      logout( context, container, appState );
      showToast( "Reauthorizing failed - your cloud authorization has expired.  Please re-login." ); 
      return false;
   }
   else { return true; }
}

// XXX useful?
Future<bool> checkValidConfig( context ) async {
   print( "Validating configuration" );

   String baseConfigS = await DefaultAssetBundle.of(context).loadString('files/awsconfiguration.json');
   final baseConfig = json.decode( baseConfigS );

   final poolId = baseConfig["CognitoUserPool"]["Default"]["PoolId"];
   final region = baseConfig["CognitoUserPool"]["Default"]["Region"];
   final poolKeys = "https://cognito-idp." + region + ".amazonaws.com/" + poolId + "/.well-known/jwks.json";

   print( "Cog Key location: " + poolKeys );

   var response = await http.get( poolKeys );
   var rbody = json.decode(utf8.decode(response.bodyBytes));
   print( "RESPONSE " + rbody.toString() );

   if( rbody.toString().contains( "does not exist" )) { return false; }
   else{ return true; }
}


Future<http.Response> localPost( String shortName, postData ) async {
   print( shortName );
   // https://stackoverflow.com/questions/43871637/no-access-control-allow-origin-header-is-present-on-the-requested-resource-whe
   // https://medium.com/@alexishevia/using-cors-in-express-cac7e29b005b

   // XXX
   final gatewayURL = new Uri.http("127.0.0.1:3000", "/update/github");
   
   // need httpheaders app/json else body is empty
   final response =
      await http.post(
         gatewayURL,
         headers: {HttpHeaders.contentTypeHeader: 'application/json' },
         body: postData
         );
   
   return response;
}


Future<http.Response> postIt( String shortName, postData, container ) async {
   print( shortName );
   final appState  = container.state;

   final gatewayURL = appState.apiBasePath + "/find";

   if( appState.idToken == "" ) { print( "Access token appears to be empty!"); }
   
   final response =
      await http.post(
         gatewayURL,
         headers: {HttpHeaders.authorizationHeader: appState.idToken},
         body: postData
         );

   return response;
}


// If failure is authorization, we can reauthorize to fix it, usually
Future<bool> checkFailure( response, shortName, context, container ) async {
   bool retval = false;
   if (response.statusCode == 401 ) {  
      if( checkReauth( context, container ) ) {
         await container.getAuthTokens( true );
         retval = true;
      }
   }
   else {
      print( "RESPONSE: " + response.statusCode.toString() + " " + json.decode(utf8.decode(response.bodyBytes)).toString());
      throw Exception( shortName + ': AWS data failed to load.');
   }

   return retval;
}


Future<String> fetchUID( context, container, postData ) async {
   String shortName = "fetchUID";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      String s = json.decode(utf8.decode(response.bodyBytes));
      return s;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchUID( context, container, postData ); }
   }
}


Future<List<PEQ>> fetchPEQs( context, container, postData ) async {
   String shortName = "fetchPEQ";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      Iterable l = json.decode(utf8.decode(response.bodyBytes));
      List<PEQ> peqs = l.map((sketch)=> PEQ.fromJson(sketch)).toList();
      return peqs;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchPEQs( context, container, postData ); }
   }
}

Future<List<GHAccount>> fetchGHRepos( context, container, postData ) async {
   String shortName = "GetGHR";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      print( "FetchGHRepos: " );
      Iterable gha = json.decode(utf8.decode(response.bodyBytes));
      List<GHAccount> ghAccounts = gha.map((acct) => GHAccount.fromJson(acct)).toList();
      assert( ghAccounts.length > 0);
      print( ghAccounts[0].toString() );
      return ghAccounts;
   } else if( response.statusCode == 204) {
      print( "Fetch: no associated accounts found" );
      return null;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchGHRepos( context, container, postData ); }
   }
}

// XXX allow more than 1 gh account per user
Future<bool> putGHRepos( context, container, postData ) async {
   String shortName = "PutGHR";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      // print( response.body.toString() );         
      return true;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await putGHRepos( context, container, postData ); }
   }
}

Future<bool> putPerson( context, container, postData ) async {
   String shortName = "putPerson";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      // print( response.body.toString() );         
      return true;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await putPerson( context, container, postData ); }
   }
}



// Called on signin
Future<void> reloadMyProjects( context, container ) async {
   print( "reloadMyProjects" );
   final appState  = container.state;

   if( appState.userId == "" ) {
      appState.userId = await fetchUID( context, container, '{ "Endpoint": "GetID" }' );
   }
   print( "UID: " + appState.userId );
   assert( appState.userId != "" );
   String uid   = appState.userId;

   appState.myGHAccounts = await fetchGHRepos( context, container, '{ "Endpoint": "GetGHR", "PersonId": "$uid"  }' );

   
   appState.myPEQs = await fetchPEQs(  context, container, '{ "Endpoint": "GetPEQ" }' );

}


// Attempt to limit access patterns as:  dyanmo from dart/user, and github from js/ceServer
// 1 crossover for authorization

// XXX NOTE: PAT  create a token with a scope specific to codeEquity.
//     https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token
//     github has deprecated login/passwd auth.  So, pat.  just need top 4 scopes under repo.

Future<bool> associateGithub( container, personalAccessToken ) async {

   // Deprecated!!  Bah.
   // var github = await GitHub(auth: Authentication.basic( uname, pword));

   var github = await GitHub(auth: Authentication.withToken( personalAccessToken ));   

   bool validAuth = false;
   await github.users.getCurrentUser().then((final CurrentUser user) {
         print( "Should be good?" );
         validAuth = true;
      }).catchError((e) {
            print( "Could not validate github acct." + e.toString() );
            showToast( "Github validation failed.  Please try again." );
         });

   if( validAuth ) {
      print( "Goot, Got Auth'd" );
      // get username, repos
      // write to dynamo
      // get flutterRouter github repos

      // XXX nope, nope
      // Inform API that there's stuff to print out
      // setState(() { addGHAcct = false; });
   }
   return validAuth;
}


// FLUTTER ROUTER   unfinished 
/*
Future<bool> associateGithub( context, container, postData ) async {
   String shortName = "assocGH";
   final response = await localPost( shortName, postData, container );
                 
   setState(() { addGHAcct = false; });

   if (response.statusCode == 201) {
      // print( response.body.toString() );         
      return true;
   } else {
      return false;
   }
}
*/
