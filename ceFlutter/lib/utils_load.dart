import 'dart:convert';  // json encode/decode
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';
import 'package:http/http.dart' as http;
import 'package:tuple/tuple.dart';
import 'package:collection/collection.dart';  // firstWhereOrNull

// This package is currently used only for authorization.  Github has deprecated username/passwd auth, so
// authentication is done by personal access token.  The user model and repo service in this package are too
// narrowly limited - not allowing access to user subscriptions, just user-owned repos.  So, auth-only.
// https://github.com/SpinlockLabs/github.dart/blob/master/lib/src/common/repos_service.dart
import 'package:github/github.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/ingest.dart';

import 'package:ceFlutter/screens/launch_page.dart';
import 'package:ceFlutter/screens/home_page.dart';

import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/PEQAction.dart';
import 'package:ceFlutter/models/PEQSummary.dart';
import 'package:ceFlutter/models/equityPlan.dart';
import 'package:ceFlutter/models/PEQRaw.dart';
import 'package:ceFlutter/models/person.dart';
import 'package:ceFlutter/models/hostAccount.dart';
import 'package:ceFlutter/models/allocation.dart';
import 'package:ceFlutter/models/Linkage.dart';
import 'package:ceFlutter/models/hostLoc.dart';

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
Future<http.Response> hostGet( url ) async {

   final urlUri = Uri.parse( url );
   
   final response =
      await http.get(
         urlUri,
         headers: {HttpHeaders.contentTypeHeader: 'application/json' },
         );

   return response;
}


Future<http.Response> postGH( PAT, postData, name ) async {

   // XXX formalize
   final gatewayURL = Uri.parse( 'https://api.github.com/graphql' );
   
   // XXX formalize
   // Accept header is for label 'preview'.
   // next global id is to avoid getting old IDs that don't work in subsequent GQL queries.
   final response =
      await http.post(
         gatewayURL,
         headers: {'Authorization': 'bearer ' + PAT, 'Accept': "application/vnd.github.bane-preview+json", 'X-Github-Next-Global-ID': '1' },
         body: postData
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

   if (response.statusCode != 201) { print( "Error.  aws post error " + shortName + " " + postData ); }
   
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
      final hosta = json.decode(utf8.decode(response.bodyBytes));
      return hosta['HostPAT'] ?? failure;
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
Future<bool> updateDynamoPeqMods( context, container, postData, shortName ) async {
   final appState  = container.state;

   print( "updateDynamoPeqMods " );

   
   final response = await postIt( shortName, postData, container );
   bool  res      = false;
   
   if (response.statusCode == 201) { res = true; }
   else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { res = await updateDynamoPeqMods( context, container, postData, shortName ); }
   }

   return res;
}
   
// This is primarily an ingest utility.
Future<bool> updateDynamo( context, container, postData, shortName, { peqId = -1 } ) async {
   final appState  = container.state;

   print( "updateDynamo " + postData );

   /*
   if( peqId != -1 ) {
      appState.ingestUpdates[peqId] = appState.ingestUpdates.containsKey( peqId ) ? appState.ingestUpdates[peqId] + 1 : 1;
   }
   */
   
   final response = await postIt( shortName, postData, container );
   bool  res      = false;
   
   if (response.statusCode == 201) { res = true; }
   else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { res = await updateDynamo( context, container, postData, shortName, peqId: peqId ); }
   }

   /*
   if( peqId != -1 ) {
      assert( appState.ingestUpdates[peqId] >= 1 );
      appState.ingestUpdates[peqId] = appState.ingestUpdates[peqId] - 1;
   }
   */
   
   return res;
}

// Called from ingest, which has up to date linkage
// Guide is [colId, oldName, newName]
Future<bool> updateColumnName( context, container, guide ) async {

   print( "Update Column Name: " + guide.toString() );
   // XXX Need to provide hostRepoId
   assert( false );  // NYI
   assert( guide.length == 3 );

   // myLocs reflects current state in HOST, after the rename.  Use it to get projId before sending rename up to aws
   final appState  = container.state;
   final myLocs    = appState.myHostLinks.locations;

   HostLoc loc = myLocs.firstWhereOrNull( (a) => a.hostColumnId == guide[0] );
   assert( loc != null );
   assert( loc.hostColumnName == guide[2] );

   // HOST column names are unique within project.
   const shortName = "UpdateColProj";
   var postData = {};
   postData['HostRepo']      = appState.myHostLinks.hostRepo;
   postData['HostProjectId'] = loc.hostProjectId;
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

   // XXX Need to provide hostRepoId
   assert( false ); 


   print( "Update Project Name: " + guide.toString() );
   assert( guide.length == 3 );

   final appState  = container.state;
   const shortName = "UpdateColProj";
   
   // HOST column names are unique within project. 
   var postData = {};
   postData['HostRepo']      = appState.myHostLinks.hostRepo;
   postData['HostProjectId'] = guide[0];
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

Future<List<CEProject>> fetchCEProjects( context, container ) async {
   String shortName = "fetchCEProjects";
   final postData = '{ "Endpoint": "GetEntries", "tableName": "CEProjects", "query": { "empty": "" }}';
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      Iterable l = json.decode(utf8.decode(response.bodyBytes));
      List<CEProject> ceps = l.map( (sketch)=> sketch == -1 ? CEProject.empty() : CEProject.fromJson(sketch) ).toList();
      return ceps;
   } else if( response.statusCode == 204) {
      print( "Fetch: no CEProjects found" );
      return [];
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchCEProjects( context, container ); }
      else { return []; }
   }
}

Future<Map<String, Map<String,String>>> fetchHostMap( context, container, hostPlatform ) async {
   String shortName = "fetchCEProjects";
   final postData = '{ "Endpoint": "GetEntries", "tableName": "CEHostUser", "query": { "HostPlatform": "$hostPlatform" }}';
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      Iterable hu = json.decode(utf8.decode(response.bodyBytes));
      Map<String, Map<String,String>> t = new Map<String, Map<String, String>>();
      for( final hostUser in hu ) {
         print( "working on " + hostUser.toString() );
         Map<String,String> vals = {};
         vals['ceUID']        = hostUser['CEUserId'];
         vals['hostUserName'] = hostUser['HostUserName'];
         t[ hostUser['HostUserId'] ] = vals;
      }
      return t;
   } else if( response.statusCode == 204) {
      print( "Fetch: no CEHostUsers found" );
      return {};
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchHostMap( context, container, hostPlatform ); }
      else { return {}; }
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

Future<Linkage?> fetchHostLinkage( context, container, postData ) async {
   String shortName = "fetchHostLinkage";

   final response = await postIt( shortName, json.encode( postData ), container );

   if (response.statusCode == 201) {
      final hostl = json.decode(utf8.decode(response.bodyBytes));
      Linkage hostLinks = Linkage.fromJson(hostl);
      return hostLinks;
   } else if( response.statusCode == 204) {
      print( "Fetch: no GitHub Linkage data found" );
      return null;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchHostLinkage( context, container, postData ); }
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
      print( "FetchHostAcct: " );
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
   String hostRepo = appState.selectedRepo;
   String uid    = appState.userId;
   print( "Loading " + hostRepo + " for " + uid + "'s " + ceProj + " CodeEquity project." );

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
   var postDataPS = {};
   postDataPS['PEQSummaryId'] = ceProj;
   var pd = { "Endpoint": "GetEntry", "tableName": "CEPEQSummary", "query": postDataPS };
   appState.myPEQSummary  = await fetchPEQSummary( context, container, pd );

   // XXXXXXX
   var cats = [ ["Software Contributions", "Data Security" ], ["A Pre-Existing Project"], ["Software Contributions"] ];
   var amts = [ 2000000, 3000000, 7000000 ];
   appState.equityPlan = new EquityPlan( ceProjectId: ceProj, categories: cats, amounts: amts, lastMod: "" );
   
   // Get linkage
   var postDataL = {};
   postDataL['CEProjectId'] = ceProj;
   pd = { "Endpoint": "GetEntry", "tableName": "CELinkage", "query": postDataL };
   appState.myHostLinks  = await fetchHostLinkage( context, container, pd );

   if( appState.verbose >= 2 ) {
      print( "Got Links?" ); 
      appState.myHostLinks == null ? print( "nope - no associated repo" ) : print( appState.myHostLinks.toString() );
   }

   if( appState.myPEQSummary != null ) { appState.updateAllocTree = true; }  // force alloc tree update
   if( appState.equityPlan != null ) { appState.updateEquityPlan = true; }  // force equity plan update
}


// Called on signin
Future<void> reloadMyProjects( context, container ) async {
   print( "reloadMyProjects" );
   final appState  = container.state;

   appState.userId = await fetchString( context, container, '{ "Endpoint": "GetID" }', "GetID" );
   print( "UID: " + appState.userId );
   assert( appState.userId != "" );
   String uid   = appState.userId;

   // FetchHost sets hostAccounts.ceProjs
   appState.myHostAccounts = await fetchHostAcct( context, container, '{ "Endpoint": "GetHostA", "CEUserId": "$uid"  }' );

   // XXX This map should be limited to CEPs known by UID, no matter platform.  
   // Set idMap to get from hostUID to hostUserName or ceUID easily
   appState.idMapHost = await fetchHostMap( context, container, "GitHub" ); 

   print( "My CodeEquity Projects:" );
   print( appState.myHostAccounts );
}

// NOTE: GitHub-specific
// Build the association between ceProjects and github repos by finding all repos on github that user has auth on,
// then associating those with known repos in aws:CEProjects.
Future<void> _buildCEProjectRepos( context, container, PAT, github, hostLogin ) async {
   final appState  = container.state;

   // XXX useful?
   // String subUrl = "https://api.github.com/users/" + patLogin + "/subscriptions";
   // repos = await getSubscriptions( container, subUrl );
   
   // GitHub does not know ceProjectId.  Get repos from GH...
   // https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-organization-repositories
   // This gets all repos the user is a member of, even if not on top list.  
   List<String> repos = [];
   var repoStream =  await github.repositories.listRepositories( type: 'all' );
   await for (final r in repoStream) {
      // print( 'Repo: ${r.fullName}' );
      repos.add( r.fullName );
   }
   print( "Found GitHub Repos " + repos.toString() );
   
   // then check which are associated with which ceProjects.  The rest are in futureProjects.
   // XXX do this on the server?  shipping all this data is not scalable
   final ceps = await fetchCEProjects( context, container );
   print( ceps.toString() );
   
   List<String> futProjs = [];
   List<String> ceProjs  = [];
   Map<String, List<String>> ceProjRepos = {};
   for( String repo in repos ) {
      var cep = ceps.firstWhereOrNull( (c) => c.repositories.contains( repo ) );
      if( cep != null && cep.ceProjectId != null ) {
         if( !ceProjs.contains( cep.ceProjectId )) {
            ceProjs.add( cep.ceProjectId );
            ceProjRepos[ cep.ceProjectId ] = cep.repositories;
         }
      }
      else { futProjs.add( repo ); }
   }
   
   // XXX formalize 'GitHub'
   // XXX Chck if have U_*  if so, has been active on GH, right?
   
   // Do not have, can not get, the U_* user id from GH.  initially use login.
   if( appState.userId == "" ) { appState.userId = await fetchString( context, container, '{ "Endpoint": "GetID" }', "GetID" ); }
   String huid = await getOwnerId( PAT, hostLogin );
   print( "HOI! " + appState.userId + " " + huid );
   assert( huid != "-1" );
   HostAccount myHostAcct = new HostAccount( hostPlatform: "GitHub", hostUserName: hostLogin, ceUserId: appState.userId, hostUserId: huid, 
                                             ceProjectIds: ceProjs, futureCEProjects: futProjs, ceProjRepos: ceProjRepos );
   
   String newHostA = json.encode( myHostAcct );
   print( newHostA );
   String postData = '{ "Endpoint": "PutHostA", "NewHostA": $newHostA, "udpate": "false", "pat": "$PAT" }';
   await updateDynamo( context, container, postData, "PutHostA" );
}

// NOTE: GitHub-specific
// Called upon refresh.. maybe someday on signin (via app_state_container:finalizeUser)
// XXX This needs to check if PAT is known, query.
// XXX update docs, pat-related
// XXX formalize
Future<void> updateProjects( context, container ) async {
   final appState  = container.state;
   
   // Iterate over all known HostAccounts.  One per host.
   for( HostAccount acct in appState.myHostAccounts ) {

      if( acct.hostPlatform == "GitHub" ) {
      
         // XXX formalize GitHub
         // Each hostUser (acct.hostUserName) has a unique PAT.  read from dynamo here, don't want to hold on to it.
         var pd = { "Endpoint": "GetEntry", "tableName": "CEHostUser", "query": { "HostUserName": acct.hostUserName, "HostPlatform": "GitHub" } };
         final PAT = await fetchPAT( context, container, json.encode( pd ), "GetEntry" );
         
         var github = await GitHub(auth: Authentication.withToken( PAT ));
         await github.users.getCurrentUser().then((final CurrentUser user) { assert( user.login == acct.hostUserName ); })
            .catchError((e) {
                  print( "Could not validate github acct." + e.toString() + " " + PAT + " " + acct.hostUserName );
                  showToast( "Github validation failed.  Please try again." );
               });
         
         await _buildCEProjectRepos( context, container, PAT, github, acct.hostUserName );
      }
   }

   await reloadMyProjects( context, container );
   appState.myHostAccounts = await fetchHostAcct( context, container, '{ "Endpoint": "GetHostA", "CEUserId": "${appState.userId}"  }' );
}

// XXX Only update if dirty.  Only dirty after updatePeq.
// NOTE this gets pacts for peqs held by selected user, not pacts that selected user was the actor for.
Future<void> updateUserPActions( peqs, container, context ) async {
   final appState  = container.state;
   String uname = appState.selectedUser;
   String cep   = appState.selectedCEProject;
   String pids  = json.encode( peqs );
   appState.userPActs[uname] = await fetchPEQActions( context, container, '{ "Endpoint": "GetPActsById", "CEProjectId": "$cep", "PeqIds": $pids }' );
}

 
// XXX Only update if dirty.  Only dirty after updatePeq.
// Need both Active and Inactive (for accrued, only)
Future<void> updateUserPeqs( container, context ) async {
   final appState  = container.state;

   // SelectedUser will be adjusted if user clicks on an alloc (summaryFrame) or unassigned
   String uname = appState.selectedUser;
   if( uname == appState.ALLOC_USER || uname == appState.UNASSIGN_USER ) { uname = ""; }
   
   String cep   = appState.selectedCEProject;
   print( "Building detail data for " + uname + ":" + cep );

   if( appState.selectedUser == appState.ALLOC_USER ) {
      appState.userPeqs[appState.selectedUser] =
         await fetchPEQs( context, container, '{ "Endpoint": "GetPEQ", "CEUID": "", "HostUserName": "$uname", "CEProjectId": "$cep", "isAlloc": "true" }' );
   }
   else {
      appState.userPeqs[appState.selectedUser] =
         await fetchPEQs( context, container, '{ "Endpoint": "GetPEQ", "CEUID": "", "HostUserName": "$uname", "CEProjectId": "$cep", "allAccrued": "true" }' );
   }
}

// XXX Consider splitting utils_load to utils_async and githubUtils
//     Attempt to limit access patterns as:  dyanmo from dart/user, and github from js/ceServer
//     1 crossover for authorization

Future<List<String>> getSubscriptions( container, subUrl ) async {
   print( "Getting subs at " + subUrl );
   final response = await hostGet( subUrl );
   Iterable subs = json.decode(utf8.decode(response.bodyBytes));
   List<String> fullNames = [];
   subs.forEach((sub) => fullNames.add( sub['full_name'] ) );
   
   return fullNames;
}

// This needs to work for both users and orgs
Future<String> getOwnerId( PAT, owner ) async {

   Map<String, dynamic> query = {};
   query["query"]     = "query (\$login: String!) { user(login: \$login) { id } organization(login: \$login) { id } }";
   query["variables"] = {"login": owner };

   final jsonEncoder = JsonEncoder();
   final queryS = jsonEncoder.convert( query );
   print( queryS );

   var retId = "-1";

   final response = await postGH( PAT, queryS, "getOwnerId" );
   print( response );

   final huid = json.decode( utf8.decode( response.bodyBytes ) );
   print( huid );

   if( huid.containsKey( "data" )) {
      if( huid["data"].containsKey( "user" ))              { retId = huid["data"]["user"]["id"]; }
      else if( huid["data"].containsKey( "organization" )) { retId = huid["data"]["organization"]["id"]; }
   }
   
   return retId;
}


// XXX rewrite any ceUID or ceHolderId in PEQ, PEQAction that look like: "HOSTUSER: $hostUserName"  XXXX erm?
Future<bool> associateGithub( context, container, PAT ) async {

   final appState  = container.state;
   var github = await GitHub(auth: Authentication.withToken( PAT ));   

   // NOTE id, node_id are available if needed
   // To see what's available, look in ~/.pub-cache/*
   String? patLogin = "";
   await github.users.getCurrentUser()
      .then((final CurrentUser user) {
            patLogin = user.login;
            print( "USER: " + user.id.toString() + " " + (user.login ?? "") );
         })
      .catchError((e) {
            print( "Could not validate github acct." + e.toString() );
            showToast( "Github validation failed.  Please try again." );
         });
   
   bool newAssoc = false;
   if( patLogin != "" && patLogin != null ) {
      print( "Goot, Got Auth'd.  " + patLogin! );
      newAssoc = true;
      appState.myHostAccounts.forEach((acct) => newAssoc = ( newAssoc && ( acct.hostUserName != patLogin! )) );
      
      if( newAssoc ) {
         // At this point, we are connected with GitHub, have PAT and host login (not id).  Separately, we have a CEPerson.
         // CEHostUser may or may not exist, depending on if the user has been active on the host with peqs.
         // Either way, CEHostUser and CEPeople are not yet connected (i.e. CEHostUser.ceuid is "")

         await _buildCEProjectRepos( context, container, PAT, github, patLogin! );
         
         await reloadMyProjects( context, container );
         appState.myHostAccounts = await fetchHostAcct( context, container, '{ "Endpoint": "GetHostA", "CEUserId": "${appState.userId}"  }' );
      }
   }
   return newAssoc;
}


// FLUTTER ROUTER   unfinished 
/*
Future<bool> associateGithub( context, container, postData ) async {
   String shortName = "assocHost";
   final response = await localPost( shortName, postData, container );
                 
   setState(() { addHostAcct = false; });

   if (response.statusCode == 201) {
      // print( response.body.toString() );         
      return true;
   } else {
      return false;
   }
}
*/
