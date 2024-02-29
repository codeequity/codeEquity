import 'dart:convert';  // json encode/decode
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';
import 'package:http/http.dart' as http;
import 'package:tuple/tuple.dart';

// This package is currently used only for authorization.  Github has deprecated username/passwd auth, so
// authentication is done by personal access token.  The user model and repo service in this package are too
// narrowly limited - not allowing access to user subscriptions, just user-owned repos.  So, auth-only.
// https://github.com/SpinlockLabs/github.dart/blob/master/lib/src/common/repos_service.dart
import 'package:github/github.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/ingest.dart';

import 'package:ceFlutter/screens/launch_page.dart';
import 'package:ceFlutter/screens/home_page.dart';

import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/PEQAction.dart';
import 'package:ceFlutter/models/PEQSummary.dart';
import 'package:ceFlutter/models/PEQRaw.dart';
import 'package:ceFlutter/models/person.dart';
import 'package:ceFlutter/models/hostAccount.dart';
import 'package:ceFlutter/models/allocation.dart';
import 'package:ceFlutter/models/Linkage.dart';
import 'package:ceFlutter/models/ghLoc.dart';

// XXX strip context, container where not needed


Future<void> logoutWait( context, container, appState ) async {
   final wrapper = (() async {
         try {
            appState.cogUser = await appState.cogUserService.signOut();
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

   var url = Uri.parse( poolKeys );
   var response = await http.get( url );   
   // var response = await http.get( poolKeys );
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

   final urlUri = Uri.parse( url );
   
   final response =
      await http.get(
         urlUri,
         headers: {HttpHeaders.contentTypeHeader: 'application/json' },
         );

   return response;
}

// XXX awsPost
Future<http.Response> postIt( String shortName, postData, container ) async {

   final appState  = container.state;
   if( appState.verbose >= 3 ) { print( shortName ); }  // pd is a string at this point

   final gatewayURL = Uri.parse( appState.apiBasePath + "/find" );

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
      throw Exception( shortName + ': AWS data failed to load, or update.');
   }

   return retval;
}


Future<String> fetchPAT( context, container, postData, shortName ) async {
   final response = await postIt( shortName, postData, container );
   final failure = "-1";
   
   if (response.statusCode == 201) {
      final gha = json.decode(utf8.decode(response.bodyBytes));
      return gha['PAT'] ?? failure;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchPAT( context, container, postData, shortName ); }
   }
   return failure;
}

Future<String> fetchString( context, container, postData, shortName ) async {
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      String s = json.decode(utf8.decode(response.bodyBytes));
      return s;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchString( context, container, postData, shortName ); }
      else return "-1";
   }
}

// This is primarily an ingest utility.
Future<bool> updateDynamo( context, container, postData, shortName, { peqId = -1 } ) async {
   final appState  = container.state;

   // print( "updateDynamo " + postData );
   
   if( peqId != -1 ) {
      appState.ingestUpdates[peqId] = appState.ingestUpdates.containsKey( peqId ) ? appState.ingestUpdates[peqId] + 1 : 1;
   }

   final response = await postIt( shortName, postData, container );
   bool  res      = false;
   
   if (response.statusCode == 201) { res = true; }
   else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { res = await updateDynamo( context, container, postData, shortName, peqId: peqId ); }
   }

   if( peqId != -1 ) {
      assert( appState.ingestUpdates[peqId] >= 1 );
      appState.ingestUpdates[peqId] = appState.ingestUpdates[peqId] - 1;
   }
   return res;
}

// Called from ingest, which has up to date linkage
// Guide is [colId, oldName, newName]
Future<bool> updateColumnName( context, container, guide ) async {

   print( "Update Column Name: " + guide.toString() );
   assert( false );  // NYI
   assert( guide.length == 3 );

   // myLocs reflects current state in GH, after the rename.  Use it to get projId before sending rename up to aws
   final appState  = container.state;
   final myLocs    = appState.myGHLinks.locations;

   GHLoc loc = myLocs.firstWhere( (a) => a.hostColumnId == guide[0], orElse: () => null );
   assert( loc != null );
   assert( loc.hostColumnName == guide[2] );

   // GH column names are unique within project.
   const shortName = "UpdateColProj";
   var postData = {};
   postData['GHRepo']      = appState.myGHLinks.ghRepo;
   postData['GHProjectId'] = loc.hostProjectId;
   postData['OldName']     = guide[1];
   postData['NewName']     = guide[2];
   postData['Column']      = "true";
   var pd = { "Endpoint": shortName, "query": postData }; 
   
   final response = await postIt( shortName, json.encode( pd ), container );
   
   if (response.statusCode == 201) {
      return true;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await updateColumnName( context, container, guide ); }
      else { return false; }
   }
}

// Called from ingest, which has up to date linkage
// Guide is [projId, oldName, newName]
Future<bool> updateProjectName( context, container, guide ) async {

   print( "Update Project Name: " + guide.toString() );
   assert( guide.length == 3 );

   final appState  = container.state;
   const shortName = "UpdateColProj";
   
   // GH column names are unique within project. 
   var postData = {};
   postData['GHRepo']      = appState.myGHLinks.ghRepo;
   postData['GHProjectId'] = guide[0];
   postData['OldName']     = guide[1];
   postData['NewName']     = guide[2];
   postData['Column']      = "false";
   var pd = { "Endpoint": shortName, "query": postData }; 
   
   final response = await postIt( shortName, json.encode( pd ), container );
   
   if (response.statusCode == 201) {
      return true;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await updateProjectName( context, container, guide ); }
      else { return false; }
   }
}

Future<List<PEQ>> fetchPEQs( context, container, postData ) async {
   String shortName = "fetchPEQs";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      Iterable l = json.decode(utf8.decode(response.bodyBytes));
      List<PEQ> peqs = l.map( (sketch)=> sketch == -1 ? PEQ.empty() : PEQ.fromJson(sketch) ).toList();
      return peqs;
   } else if( response.statusCode == 204) {
      print( "Fetch: no PEQs found" );
      return [];
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchPEQs( context, container, postData ); }
      else { return []; }
   }
}

/*
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
*/

Future<List<PEQAction>> fetchPEQActions( context, container, postData ) async {
   String shortName = "fetchPEQAction";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      Iterable l = json.decode(utf8.decode(response.bodyBytes));
      List<PEQAction> peqActions = l.map((sketch)=> PEQAction.fromJson(sketch)).toList();
      return peqActions;
   } else if( response.statusCode == 204) {
      print( "Fetch: no PEQ Actions found" );
      return [];
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchPEQActions( context, container, postData ); }
      else { return []; }
   }
}

Future<PEQSummary?> fetchPEQSummary( context, container, postData ) async {
   String shortName = "fetchPEQSummary";

   final response = await postIt( shortName, json.encode( postData ), container );

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

Future<Linkage?> fetchGHLinkage( context, container, postData ) async {
   String shortName = "fetchGHLinkage";

   final response = await postIt( shortName, json.encode( postData ), container );

   if (response.statusCode == 201) {
      final ghl = json.decode(utf8.decode(response.bodyBytes));
      Linkage ghLinks = Linkage.fromJson(ghl);
      return ghLinks;
   } else if( response.statusCode == 204) {
      print( "Fetch: no GitHub Linkage data found" );
      return null;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchGHLinkage( context, container, postData ); }
   }
}

Future<PEQRaw?> fetchPEQRaw( context, container, postData ) async {
   String shortName = "fetchPEQRaw";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      final ps = json.decode(utf8.decode(response.bodyBytes));
      PEQRaw peqRaw = PEQRaw.fromJson(ps);
      return peqRaw;
   } else if( response.statusCode == 204) {
      print( "Fetch: no PEQ Raw found" );
      return null;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchPEQRaw( context, container, postData ); }
   }
}

Future<List<HostAccount>> fetchHostAcct( context, container, postData ) async {
   String shortName = "GetHostA";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      print( "FetchGHAcct: " );
      Iterable ha = json.decode(utf8.decode(response.bodyBytes));
      List<HostAccount> hostAccounts = ha.map((acct) => HostAccount.fromJson(acct)).toList();
      assert( hostAccounts.length > 0);
      return hostAccounts;
   } else if( response.statusCode == 204) {
      print( "Fetch: no associated accounts found" );
      // Dangerous!  overwrites object type of receiver
      // return null;
      return [];
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchHostAcct( context, container, postData ); }
      else{ return []; }
   }
}


// Lock uningested PEQActions, then return for processing.
Future<List<PEQAction>> lockFetchPActions( context, container, postData ) async {
   String shortName = "lockFetchPAction";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      Iterable pacts = json.decode(utf8.decode(response.bodyBytes));
      List<PEQAction> pactions = pacts.map((pact) => PEQAction.fromJson(pact)).toList();
      return pactions;
   } else if( response.statusCode == 204) {
      return [];
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await lockFetchPActions( context, container, postData ); }
      else { return []; }
   }
}

// Called each time click different repo on homepage
Future<void> reloadRepo( context, container ) async {
   
   final appState  = container.state;

   String ceProj = appState.selectedCEProject;
   String ghRepo = appState.selectedRepo;
   String uid    = appState.userId;
   print( "Loading " + ghRepo + " for " + uid + "'s " + ceProj + " CodeEquity project." );

   // XXX could be thousands... too much.  Just get uningested, most recent, etc.
   // Get all PEQ data related to the selected repo.  
   appState.myPEQs = await fetchPEQs( context, container,
                                      '{ "Endpoint": "GetPEQ", "CEUID": "$uid", "HostUserId": "", "CEProjectId": "$ceProj" }' );
   
   // XXX Really just want mine?  Hmmmmmmmm.......no.  get all for peqs above.
   // XXX could be thousands... too much.   Just get uningested, most recent, etc.
   // To get here, user has both a CEUID and an association with hostUserLogin
   // Any PEQActions recorded from github before the user had a CELogin will have been updated as soon as the linkage was created.
   appState.myPEQActions = await fetchPEQActions( context, container,
                                                  '{ "Endpoint": "GetPEQActions", "CEUID": "$uid", "HostUserName": "", "CEProjectId": "$ceProj" }' );
   var postData = {};
   postData['CEProjectId'] = ceProj;
   var pd = { "Endpoint": "GetEntry", "tableName": "CEPEQSummary", "query": postData };
   appState.myPEQSummary  = await fetchPEQSummary( context, container, pd );
   
   // Get linkage
   pd = { "Endpoint": "GetEntry", "tableName": "CELinkage", "query": postData };
   appState.myGHLinks  = await fetchGHLinkage( context, container, pd );

   if( appState.verbose >= 2 ) {
      print( "Got Links?" ); 
      appState.myGHLinks == null ? print( "nope - no associated repo" ) : print( appState.myGHLinks.toString() );
   }

   if( appState.myPEQSummary != null ) { appState.updateAllocTree = true; }  // force alloc tree update
}


// Called on signin
Future<void> reloadMyProjects( context, container ) async {
   print( "reloadMyProjects" );
   final appState  = container.state;

   appState.userId = await fetchString( context, container, '{ "Endpoint": "GetID" }', "GetID" );
   print( "UID: " + appState.userId );
   assert( appState.userId != "" );
   String uid   = appState.userId;

   // FetchGH sets ghAccounts.ceProjs
   appState.myGHAccounts = await fetchHostAcct( context, container, '{ "Endpoint": "GetHostA", "CEUserId": "$uid"  }' );

   print( "My CodeEquity Projects:" );
   print( appState.myGHAccounts );
}

// Called upon refresh.. maybe someday on signin (via app_state_container:finalizeUser)
// XXX This needs to check if PAT is known, query.
// XXX update docs, pat-related
Future<void> updateProjects( context, container ) async {
   final appState  = container.state;
   
   // Iterate over all known GHAccounts.
   for( HostAccount acct in appState.myGHAccounts ) {
      
      // get from gh
      // XXX combine with assocGH?  split out GHUtils?

      // XXX Need ceProjectId, at least, to make this unique.
      print( "XXX hostUser is not unique" );
      
      // Each hostUser (acct.hostUserName) has a unique PAT.  read from dynamo here, don't want to hold on to it.
      var pd = { "Endpoint": "GetEntry", "tableName": "CEHostUser", "query": { "HostUserName": acct.hostUserName } };
      final PAT = await fetchPAT( context, container, json.encode( pd ), "GetEntry" );
         
      var github = await GitHub(auth: Authentication.withToken( PAT ));   
      await github.users.getCurrentUser().then((final CurrentUser user) { assert( user.login == acct.hostUserName ); })
         .catchError((e) {
               print( "Could not validate github acct." + e.toString() );
               showToast( "Github validation failed.  Please try again." );
            });

      List<String> repos = [];
      var repoStream =  await github.repositories.listRepositories( type: 'all' );
      print( "Repo listen" );
      await for (final r in repoStream) {
         print( 'Repo: ${r.fullName}' );
         repos.add( r.fullName );
      }
      print( "Repo done " + repos.toString() );

      // acct.repos = repos;

      // XXX NOPE, repo-centric
      // write to dynamo.
      String newGHA = json.encode( acct );
      String postData = '{ "Endpoint": "PutHostA", "NewGHA": $newGHA, "update": "true", "pat": ""  }';
      print( "XXX Update hostAccounts to AWS needs work" );
      // await updateDynamo( context, container, postData, "PutGHA" );
   }

   await reloadMyProjects( context, container );
}

// XXX Only update if dirty.  Only dirty after updatePeq.
// NOTE this gets pacts for peqs held by selected user, not pacts that selected user was the actor for.
Future<void> updateUserPActions( peqs, container, context ) async {
   final appState  = container.state;
   String uname = appState.selectedUser;
   String rname = appState.selectedRepo;
   String pids = json.encode( peqs );
   appState.userPActs[uname] = await fetchPEQActions( context, container, '{ "Endpoint": "GetPActsById", "GHRepo": "$rname", "PeqIds": $pids }' );
}

// XXX Only update if dirty.  Only dirty after updatePeq.
Future<void> updateUserPeqs( container, context ) async {
   final appState  = container.state;

   // SelectedUser will be adjusted if user clicks on an alloc (summaryFrame)
   String uname = appState.selectedUser;
   if( uname == appState.ALLOC_USER || uname == appState.UNASSIGN_USER ) { uname = ""; }
   
   String rname = appState.selectedRepo;
   String cep   = appState.selectedCEProject;
   print( "Building detail data for " + uname + ":" + rname );

   if( appState.selectedUser == appState.ALLOC_USER ) {
      appState.userPeqs[appState.selectedUser] =
         await fetchPEQs( context, container, '{ "Endpoint": "GetPEQ", "CEUID": "", "HostUserName": "$uname", "CEProjectId": "$cep", "isAlloc": "true" }' );
   }
   else {
      appState.userPeqs[appState.selectedUser] =
         await fetchPEQs( context, container, '{ "Endpoint": "GetPEQ", "CEUID": "", "HostUserName": "$uname", "CEProjectId": "$cep" }' );
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

// XXX rewrite any ceUID or ceHolderId in PEQ, PEQAction that look like: "GHUSER: $hostUserName"  XXXX erm?
Future<bool> associateGithub( context, container, personalAccessToken ) async {

   final appState  = container.state;
   var github = await GitHub(auth: Authentication.withToken( personalAccessToken ));   

   // NOTE id, node_id are available if needed
   String? patLogin = "";
   await github.users.getCurrentUser()
      .then((final CurrentUser user) {
            patLogin = user.login;
         })
      .catchError((e) {
            print( "Could not validate github acct." + e.toString() );
            showToast( "Github validation failed.  Please try again." );
         });
   
   bool newAssoc = false;
   if( patLogin != "" && patLogin != null ) {
      print( "Goot, Got Auth'd.  " + patLogin! );
      
      bool newLogin = true;
      appState.myGHAccounts.forEach((acct) => newLogin = ( newLogin && ( acct.hostUserName != patLogin! )) );

      if( newLogin ) {
         newAssoc = true;
         
         // This only returns github accounts that are owned by current user(!).  Actually want subscriptions too.
         // String subUrl = "https://api.github.com/users/" + patLogin + "/subscriptions";
         // repos = await getSubscriptions( container, subUrl );
         
         List<String> repos = [];
         print( "Repo stream" );
         var repoStream =  await github.repositories.listRepositories( type: 'all' );
         print( "Repo listen" );
         await for (final r in repoStream) {
            print( 'Repo: ${r.fullName}' );
            repos.add( r.fullName );
         }
         print( "Repo done " + repos.toString() );
   
         String pid = randAlpha(10);
         // XXX nope
         // HostAccount myGHAcct = new HostAccount( hostUserId: pid, ceUserId: appState.userId, hostUserName: patLogin!, repos: repos );
         print( "XXX NYI kjsdf-1" );

         // XXX nope
         // String newGHA = json.encode( myGHAcct );
         // String postData = '{ "Endpoint": "PutHostA", "NewGHA": $newGHA, "udpate": "false", "pat": $personalAccessToken }';
         // await updateDynamo( context, container, postData, "PutGHA" );
         print( "XXX NYI kjsdf-2" );

         await reloadMyProjects( context, container );
         // if( appState.userId == "" ) { appState.userId = await fetchString( context, container, '{ "Endpoint": "GetID" }', "GetID" ); }
         // appState.myGHAccounts = await fetchHostAcct( context, container, '{ "Endpoint": "GetHostA", "PersonId": "${appState.userId}"  }' );
         print( "XXX NYI kjsdf-3" );

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
