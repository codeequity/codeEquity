import 'dart:convert';  // json encode/decode
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:random_string/random_string.dart';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';
import 'package:http/http.dart' as http;

// This package is currently used only for authorization.  Github has deprecated username/passwd auth, so
// authentication is done by personal access token.  The user model and repo service in this package are too
// narrowly limited - not allowing access to user subscriptions, just user-owned repos.  So, auth-only.
// https://github.com/SpinlockLabs/github.dart/blob/master/lib/src/common/repos_service.dart
import 'package:github/github.dart';

import 'package:ceFlutter/utils.dart';

import 'package:ceFlutter/screens/launch_page.dart';

import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/PEQAction.dart';
import 'package:ceFlutter/models/PEQSummary.dart';
import 'package:ceFlutter/models/person.dart';
import 'package:ceFlutter/models/ghAccount.dart';
import 'package:ceFlutter/models/allocation.dart';


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

// XXX naming convention, pls
Future<http.Response> ghGet( url ) async {

   final response =
      await http.get(
         url,
         headers: {HttpHeaders.contentTypeHeader: 'application/json' },
         );

   return response;
}

// XXX awsPost
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

Future<PEQ> fetchaPEQ( context, container, postData ) async {
   String shortName = "fetchaPEQ";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      final js = json.decode(utf8.decode(response.bodyBytes));
      PEQ peq = PEQ.fromJson( js );
      return peq;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchaPEQ( context, container, postData ); }
   }
}


Future<List<PEQAction>> fetchPEQActions( context, container, postData ) async {
   String shortName = "fetchPEQAction";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      Iterable l = json.decode(utf8.decode(response.bodyBytes));
      List<PEQAction> peqActions = l.map((sketch)=> PEQAction.fromJson(sketch)).toList();
      return peqActions;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchPEQActions( context, container, postData ); }
   }
}

Future<PEQSummary> fetchPEQSummary( context, container, postData ) async {
   String shortName = "fetchPEQSummary";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      final ps = json.decode(utf8.decode(response.bodyBytes));
      PEQSummary peqSummary = PEQSummary.fromJson(ps);
      return peqSummary;
   } else if( response.statusCode == 204) {
      print( "Fetch: no previous PEQ Summary found" );
      return null;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchPEQSummary( context, container, postData ); }
   }
}

Future<List<GHAccount>> fetchGHAcct( context, container, postData ) async {
   String shortName = "GetGHA";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      print( "FetchGHAcct: " );
      Iterable gha = json.decode(utf8.decode(response.bodyBytes));
      List<GHAccount> ghAccounts = gha.map((acct) => GHAccount.fromJson(acct)).toList();
      assert( ghAccounts.length > 0);
      return ghAccounts;
   } else if( response.statusCode == 204) {
      print( "Fetch: no associated accounts found" );
      // Dangerous!  overwrites object type of receiver
      // return null;
      return [];
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchGHAcct( context, container, postData ); }
   }
}

// Lock uningested PEQActions, then return for processing.
Future<List<PEQAction>> lockFetchPActions( context, container, postData ) async {
   String shortName = "lockFetchPAction";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      print( shortName + " 201 return" );
      Iterable pacts = json.decode(utf8.decode(response.bodyBytes));
      List<PEQAction> pactions = pacts.map((pact) => PEQAction.fromJson(pact)).toList();
      return pactions;
   } else if( response.statusCode == 204) {
      print( "LockFetch: no unprocessed PActions found" );
      return [];
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await lockFetchPActions( context, container, postData ); }
   }
   
}

Future<bool> unlockPActions( context, container, postData ) async {
   String shortName = "unlockPactions";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      // print( response.body.toString() );         
      return true;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await putGHAcct( context, container, postData ); }
   }
}

Future<bool> putPEQSummary( context, container, postData ) async {
   String shortName = "PutPEQSummary";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      // print( response.body.toString() );         
      return true;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await putPEQSummary( context, container, postData ); }
   }
}

Future<bool> putGHAcct( context, container, postData ) async {
   String shortName = "PutGHA";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      // print( response.body.toString() );         
      return true;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await putGHAcct( context, container, postData ); }
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

   appState.myGHAccounts = await fetchGHAcct( context, container, '{ "Endpoint": "GetGHA", "PersonId": "$uid"  }' );

   // NOTE PEQ holder can only be CE user.  Otherwise, no agreements.
   // XXX could store 'lastViewed' with ghAccount.  For now, default is first.
   // XXX breaks if no repo yet
   if( appState.myGHAccounts.length > 0 ) {
      String ghUser = appState.myGHAccounts[0].ghUserName;
      String ghRepo = appState.myGHAccounts[0].repos[2];

      // XXX could be thousands... too much.  Just get uningested, most recent, etc.
      // Get all PEQ data related to the selected repo.  
      appState.myPEQs       = await fetchPEQs( context, container,
                                                      '{ "Endpoint": "GetPEQ", "CEUID": "$uid", "GHRepo": "$ghRepo" }' );

      // XXX could be thousands... too much.   Just get uningested, most recent, etc.
      // XXX Really just want mine?  Hmmmmmmmm.......
      // To get here, user has both a CEUID and an association with ghUserLogin
      // Any PEQActions recorded from github before the user had a CELogin will have been updated as soon as the linkage was created.
      appState.myPEQActions = await fetchPEQActions( context, container,
                                                      '{ "Endpoint": "GetPEQActions", "CEUID": "$uid", "GHRepo": "$ghRepo" }' );

      appState.myPEQSummary = await fetchPEQSummary( context, container,
                                                      '{ "Endpoint": "GetPEQSummary", "GHRepo": "$ghRepo" }' );
   }
}


// XXX not adding.
// XXX not writing back to dynamo
// XXX repo vs contributor
// XXX lots more work left to do in here.
// XXX category not quite there.
// XXX committed undone
void processPEQAction( PEQAction pact, PEQ peq, context, container ) {
   print( "processing " + pact.verb + " " + pact.action + " " + peq.type + " for " + peq.amount.toString() );
   final appState  = container.state;

   if( pact.verb == "confirm" && pact.action == "add" ) {

      if( peq.type == "Allocation" ) {

         // Create, if need to
         if( appState.myPEQSummary == null ) {
            print( "Create new appstate PSum" );
            String pid = randomAlpha(10);
            appState.myPEQSummary = new PEQSummary( id: pid, ghRepo: peq.ghRepo,
                                                    targetType: "repo", targetId: peq.ghProjectId, lastModified: getToday(), allocations: [] );
         }
         
         var updated = false;
         // Update, if already in place
         for( var alloc in appState.myPEQSummary.allocations ) {
            print( "Checking for match: " + peq.ghProjectSub.toString() + " " + alloc.category.toString() );
            if( peq.ghProjectSub.toString() == alloc.category.toString() ) {
               updated = true;
               print( "Matched category!" );
               alloc.amount = alloc.amount + peq.amount;
               break;
            }
         }

         // Create alloc, if not already updated
         if( !updated ) {
            print( "Adding new allocation" );
            Allocation alloc = new Allocation( category: peq.ghProjectSub, amount: peq.amount, committed: 0, notes: "" );
            appState.myPEQSummary.allocations.add( alloc );
         }

      }
      else { notYetImplemented( context ); }
   }
   else { notYetImplemented( context ); }

}


// XXX need to update peqsummary when hit repo button
// XXX sort by timestamp
Future<void> updatePEQAllocations( repoName, context, container ) async {
   print( "Updating allocations for ghRepo" );

   final appState  = container.state;
   final todoPActions = await lockFetchPActions( context, container, '{ "Endpoint": "GetUnPAct", "GHRepo": "$repoName" }' ); 

   List<String> pactIds = [];
   for( var pact in todoPActions ) {
      print( "1. Working on todo " );
      print( pact.toString() );
      // XXX can't do this unless wait in lambda handler
      // assert( pact.locked );
      assert( !pact.ingested );
      
      pactIds.add( pact.id );
      // XXX enum
      if( pact.action != "relocate" && pact.action != "change" ) {
         assert( pact.subject.length == 1 );
         String peqId = pact.subject[0];
         print( "2. Should see fetcha, then process, interleaved." );
         PEQ peq = await fetchaPEQ( context, container, '{ "Endpoint": "GetaPEQ", "Id": "$peqId" }' ); 
         await processPEQAction( pact, peq, context, container );
      }
      else { notYetImplemented( context ); }
   }

   if( appState.myPEQSummary != null ) {
      print( "3. Writing psum back to dynamo" );
      String psum = json.encode( appState.myPEQSummary );
      String postData = '{ "Endpoint": "PutPSum", "NewPSum": $psum }';
      await putPEQSummary( context, container, postData );
   }
   
   if( pactIds.length > 0 ) {
      print( "4. unlocking." );
      String newPIDs = json.encode( pactIds );
      final status = await unlockPActions( context, container,'{ "Endpoint": "UpdatePAct", "PactIds": $newPIDs }' );
   }
}


// XXX Consider splitting utils_load to utils_async and githubUtils
//     Attempt to limit access patterns as:  dyanmo from dart/user, and github from js/ceServer
//     1 crossover for authorization

Future<List<String>> getSubscriptions( container, subUrl ) async {
   print( "Getting subs at " + subUrl );
   final response = await ghGet( subUrl );
   Iterable subs = json.decode(utf8.decode(response.bodyBytes));
   List<String> fullNames = [];
   subs.forEach((sub) => fullNames.add( sub['full_name'] ) );
   
   return fullNames;
}


// XXX NOTE: PAT  create a token with a scope specific to codeEquity.
//     https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token
//     github has deprecated login/passwd auth.  So, pat.  just need top 4 scopes under repo.

Future<bool> associateGithub( context, container, personalAccessToken ) async {

   final appState  = container.state;
   var github = await GitHub(auth: Authentication.withToken( personalAccessToken ));   

   // NOTE id, node_id are available if needed
   String patLogin = "";
   List<String> repos = null;
   await github.users.getCurrentUser().then((final CurrentUser user) {
         patLogin = user.login;
      }).catchError((e) {
            print( "Could not validate github acct." + e.toString() );
            showToast( "Github validation failed.  Please try again." );
         });

   bool newAssoc = false;
   if( patLogin != "" ) {
      print( "Goot, Got Auth'd.  " + patLogin );
      
      bool newLogin = true;
      appState.myGHAccounts.forEach((acct) => newLogin = newLogin && ( acct.ghUserName != patLogin ) );

      if( newLogin ) {
         newAssoc = true;
         String subUrl = "https://api.github.com/users/" + patLogin + "/subscriptions";
         repos = await getSubscriptions( container, subUrl );

         String pid = randomAlpha(10);
         GHAccount myGHAcct = new GHAccount( id: pid, ceOwnerId: appState.userId, ghUserName: patLogin, repos: repos );
         
         appState.myGHAccounts.add( myGHAcct );
         
         String newGHA = json.encode( myGHAcct );
         String postData = '{ "Endpoint": "PutGHA", "NewGHA": $newGHA }';
         await putGHAcct( context, container, postData );

      }
   }
   return newAssoc;
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
