import 'dart:convert';  // json encode/decode
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';
import 'package:http/http.dart' as http;
import 'package:collection/collection.dart';  // firstWhereOrNull

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/PEQAction.dart';
import 'package:ceFlutter/models/PEQSummary.dart';
import 'package:ceFlutter/models/EquityPlan.dart';
import 'package:ceFlutter/models/PEQRaw.dart';
import 'package:ceFlutter/models/Person.dart';
import 'package:ceFlutter/models/HostAccount.dart';
import 'package:ceFlutter/models/Allocation.dart';
import 'package:ceFlutter/models/Linkage.dart';
import 'package:ceFlutter/models/HostLoc.dart';


Future<void> logoutWait( appState ) async {
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
   if( appState.authRetryCount > 5 ) {
      print( "Too many reauthorizations, please sign in again" );
      logout( context, appState );
      showToast( "Reauthorizing failed - your cloud authorization has expired.  Please re-login." ); 
      return false;
   }
   else { return true; }
}

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
   var rbody = json.decode(utf8.decode(response.bodyBytes));
   print( "RESPONSE " + rbody.toString() );

   if( rbody.toString().contains( "does not exist" )) { return false; }
   else{ return true; }
}


Future<http.Response> awsPost( String shortName, postData, context, container, {reauth = false} ) async {

   final appState  = container.state;
   if( appState.verbose >= 3 ) { print( shortName ); }  // pd is a string at this point

   final gatewayURL = Uri.parse( appState.apiBasePath + "/find" );

   if( appState.idToken == "" ) { print( "Access token appears to be empty!"); }

   var response;

   try {
      response = await http.post(
         gatewayURL,
         headers: {HttpHeaders.authorizationHeader: appState.idToken},
         body: postData
         );
   } catch( e, stacktrace ) {
      print( e );
      // XXX No status code?.. some errors are not auth
      String msg = e.toString();  // can't seem to cast as ClientException, the runtimeType, which has a message property
      if( msg.contains( "ClientException: XMLHttpRequest error.," ) && msg.contains( "amazonaws.com/prod/find" )) {
         print( "XML http request error, likely auth expired " + shortName + postData );
         checkReauth( context, container );
         await container.getAuthTokens( true );
         return await awsPost( shortName, postData, context, container, reauth: "true" );
      }
   }

   if (response.statusCode != 201 && response.statusCode != 204) { print( "Error.  aws post error " + shortName + " " + postData ); }
   
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
   final response = await awsPost( shortName, postData, context, container );
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
   final response = await awsPost( shortName, postData, context, container );
   
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

   
   final response = await awsPost( shortName, postData, context, container );
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

   // print( "updateDynamo " + postData );

   /*
   if( peqId != -1 ) {
      appState.ingestUpdates[peqId] = appState.ingestUpdates.containsKey( peqId ) ? appState.ingestUpdates[peqId] + 1 : 1;
   }
   */
   
   final response = await awsPost( shortName, postData, context, container );
   bool  res      = false;

   if( response.statusCode != 201 ) { print( "OI? " + response.toString() ); }
   
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
   // XXX Host can't do this yet.  Need to provide hostRepoId
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
   
   final response = await awsPost( shortName, json.encode( pd ), context, container );
   
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

   // XXX Host can't do this yet.  Need to provide hostRepoId
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
   
   final response = await awsPost( shortName, json.encode( pd ), context, container );
   
   if (response.statusCode == 201) {
      return true;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await updateProjectName( context, container, guide ); }
      else { return false; }
   }
}

Future<List<Person>> fetchCEPeople( context, container ) async {
   String shortName = "fetchCEPeople";
   final postData = '{ "Endpoint": "GetEntries", "tableName": "CEPeople", "query": { "empty": "" }}';
   final response = await awsPost( shortName, postData, context, container );
   
   if (response.statusCode == 201) {
      Iterable l = json.decode(utf8.decode(response.bodyBytes));
      List<Person> cePeeps = l.map( (sketch)=> sketch == -1 ? Person.empty() : Person.fromJson(sketch) ).toList();
      return cePeeps;
   } else if( response.statusCode == 204) {
      print( "Fetch: no CEPeople found" );
      return [];
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchCEPeople( context, container ); }
      else { return []; }
   }
}

Future<List<CEProject>> fetchCEProjects( context, container ) async {
   String shortName = "fetchCEProjects";
   final postData = '{ "Endpoint": "GetEntries", "tableName": "CEProjects", "query": { "empty": "" }}';
   final response = await awsPost( shortName, postData, context, container );
   
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

// XXX deprecated
// ce username comes from cert in idtoken on lambda side.
Future<Person?> fetchSignedInPerson( context, container ) async {
   String shortName = "fetchSignedInPerson";
   final postData = '{ "Endpoint": "GetPerson" }';
   final response = await awsPost( shortName, postData, context, container );
   
   if (response.statusCode == 201) {
      final p = json.decode(utf8.decode(response.bodyBytes));
      Person cePerson = Person.fromJson( p );
      return cePerson;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchSignedInPerson( context, container ); }
   }
   return null;
}

Future<Map<String, dynamic>> fetchProfileImage( context, container, query ) async {
   String shortName = "fetchProfileImage";
   final response = await awsPost( shortName, query, context, container );
   
   if (response.statusCode == 201) {
      final p = json.decode(utf8.decode(response.bodyBytes));
      return p;
   } else if( response.statusCode == 204) {
      print( "Fetch: no Profile Image found" );
      return {};
   }
   else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchProfileImage( context, container, query ); }
   }
   return {};
}

// Get any public ce person
Future<Person?> fetchAPerson( context, container, ceUserId ) async {
   String shortName = "fetchAPerson";
   print( "FETCH APERSON" );
   var postDataQ = {};
   postDataQ['CEUserId'] = ceUserId;
   final postData = { "Endpoint": "GetEntry", "tableName": "CEPeople", "query": postDataQ };
   final response = await awsPost( shortName, json.encode( postData ), context, container );
   
   if (response.statusCode == 201) {
      final p = json.decode(utf8.decode(response.bodyBytes));
      Person cePerson = Person.fromJson( p );
      return cePerson;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchAPerson( context, container, ceUserId ); }
   }
   return null;
}


// Populates idHostMap
Future<Map<String, Map<String,String>>> fetchHostMap( context, container, hostPlatform, Map<String, Person?> cePersons ) async {
   String shortName = "fetchHostMap";
   final postData = '{ "Endpoint": "GetEntries", "tableName": "CEHostUser", "query": { "HostPlatform": "$hostPlatform" }}';
   final response = await awsPost( shortName, postData, context, container );
   
   if (response.statusCode == 201) {
      Iterable hu = json.decode(utf8.decode(response.bodyBytes));
      Map<String, Map<String,String>> t = new Map<String, Map<String, String>>();
      for( final hostUser in hu ) {
         print( "fhm working on " + hostUser.toString() );
         Map<String,String> vals = {};
         vals['ceUID']        = hostUser['CEUserId'];
         vals['hostUserName'] = hostUser['HostUserName'];
         Person? peep = cePersons[ vals['ceUID'] ];
         assert( peep != null );
         vals['ceUserName']   = peep!.userName;
         t[ hostUser['HostUserId'] ] = vals;
      }
      return t;
   } else if( response.statusCode == 204) {
      print( "Fetch: no CEHostUsers found" );
      return {};
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchHostMap( context, container, hostPlatform, cePersons ); }
      else { return {}; }
   }
}


Future<List<PEQ>> fetchPEQs( context, container, postData ) async {
   String shortName = "fetchPEQs";
   final response = await awsPost( shortName, postData, context, container );
   
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
   final response = await awsPost( shortName, postData, context, container );
   
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
   final response = await awsPost( shortName, postData, context, container );
   
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
   print("FETCH PEQSUM" );
   final response = await awsPost( shortName, postData, context, container );

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

 Future<EquityPlan?> fetchEquityPlan( context, container, postData ) async {
   String shortName = "fetchEquityPlan";
   print("FETCH EQPLAN" );
   
   final response = await awsPost( shortName, postData, context, container );

   if (response.statusCode == 201) {
      final ep = json.decode(utf8.decode(response.bodyBytes));
      EquityPlan equityPlan = EquityPlan.fromJson(ep);
      return equityPlan;
   } else if( response.statusCode == 204) {
      print( "Fetch: no previous Equity Plan found" );
      return null;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchEquityPlan( context, container, postData ); }
   }
}

Future<Linkage?> fetchHostLinkage( context, container, postData ) async {
   String shortName = "fetchHostLinkage";
   print( "FETCH HOSTLINK" );
   
   final response = await awsPost( shortName, postData, context, container );

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
   final response = await awsPost( shortName, postData, context, container );
   
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

// Associates hostrepos with CEP.  single uid, or all for given platform
Future<List<HostAccount>> fetchHostAcct( context, container, postData ) async {
   String shortName = "GetHostA";
   final response = await awsPost( shortName, postData, context, container );
   print( "FETCH HOSTACC" );
   
   if (response.statusCode == 201) {
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
   final response = await awsPost( shortName, postData, context, container );
   
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
