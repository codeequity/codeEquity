import 'dart:convert';  // json encode/decode
import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:flutter/material.dart';

import 'package:ceFlutter/utils/awsUtils.dart';

import 'package:ceFlutter/screens/launch_page.dart';

import 'package:ceFlutter/models/EquityPlan.dart';


// enum accessibility funcs
// https://medium.com/@amir.n3t/advanced-enums-in-flutter-a8f2e2702ffd
String enumToStr(Object? o) => (o ?? "").toString().split('.').last;

T enumFromStr<T>(String key, List<T> values) => values.firstWhere((v) => key == enumToStr(v),
                                                                  orElse: (() { print( "Warning " + key + " not found"); return values[values.length - 1]; }));



String getToday() {
   final now = new DateTime.now();
   String date = "";

   if( now.month < 10 ) { date += "0"; }
   date = now.month.toString() + "/";

   if( now.day < 10 ) { date += "0"; }
   date += now.day.toString() + "/";
   
   date += now.year.toString();
   return date;
}

String randAlpha(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
   var charactersLength = characters.length;
   var rng = Random();
   for ( var i = 0; i < length; i++ ) {
      result += characters[ rng.nextInt( charactersLength ) ];
   }
   print( "Ralph returning " + result );
   return result;
}


String addCommas( int amount ) {
   String res = "";
   bool neg = amount < 0 ? true : false;
   if( neg ) { amount = -1 * amount; }
         
   String t = amount.toString();

   while( t.length > 3 ) {
      res = "," + t.substring( t.length - 3 ) + res;
      t = t.substring( 0, t.length - 3 );
   }
   res = t + res;
   
   if( neg ) { res = "-" + res; }
   return res;
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



// Called each time click different repo on homepage
Future<void> reloadRepo( context, container ) async {
   
   final appState  = container.state;

   String ceProj   = appState.selectedCEProject;
   String uid      = appState.userId;
   print( "Loading " + uid + "'s " + ceProj + " CodeEquity project." );

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

   postDataPS = {};
   postDataPS['EquityPlanId'] = ceProj;
   pd = { "Endpoint": "GetEntry", "tableName": "CEEquityPlan", "query": postDataPS };
   appState.equityPlan = await fetchEquityPlan( context, container, pd );
   if( appState.equityPlan == null ) { appState.equityPlan = new EquityPlan( ceProjectId: ceProj, categories: [], amounts: [], hostNames: [], lastMod: "" ); }
   
   // Get linkage
   var postDataL = {};
   postDataL['CEProjectId'] = ceProj;
   pd = { "Endpoint": "GetEntry", "tableName": "CELinkage", "query": postDataL };
   appState.myHostLinks  = await fetchHostLinkage( context, container, pd );

   if( appState.verbose >= 2 ) {
      print( "Got Links?" ); 
      appState.myHostLinks == null ? print( "nope - no associated repo" ) : print( appState.myHostLinks.toString() );
   }

   if( appState.myPEQSummary != null ) { appState.updateAllocTree = true;  } // force alloc tree update
   if( appState.equityPlan != null )   { appState.updateEquityPlan = true; } // force equity tree update
   if( appState.equityPlan != null )   { appState.updateEquityView = true; } // force equity view creation on first pass
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




// FLUTTER ROUTER   unfinished 
/*

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
