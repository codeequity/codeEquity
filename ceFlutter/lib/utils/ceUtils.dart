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

void logout( context, appState ) async {
   final wrapper = (() async {

         await logoutWait( appState );
            
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

   var postDataPS = {};
   postDataPS['PEQSummaryId'] = ceProj;
   var pd = { "Endpoint": "GetEntry", "tableName": "CEPEQSummary", "query": postDataPS };
   appState.myPEQSummary  = await fetchPEQSummary( context, container, json.encode( pd ) );
   
   postDataPS = {};
   postDataPS['EquityPlanId'] = ceProj;
   pd = { "Endpoint": "GetEntry", "tableName": "CEEquityPlan", "query": postDataPS };
   appState.equityPlan = await fetchEquityPlan( context, container, json.encode( pd ) );
   if( appState.equityPlan == null ) { appState.equityPlan = new EquityPlan( ceProjectId: ceProj, categories: [], amounts: [], hostNames: [], lastMod: "" ); }
   
   // Get linkage
   var postDataL = {};
   postDataL['CEProjectId'] = ceProj;
   pd = { "Endpoint": "GetEntry", "tableName": "CELinkage", "query": postDataL };
   appState.myHostLinks  = await fetchHostLinkage( context, container, json.encode( pd ) );

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



// Note.  this only updates in detail_page when userPActUpdate flag is set by changing to new line.
//        Could reduce calls by further limiting update to dirty, where dirty is set when empty or after updatePeq.
//        small beer.. 
// NOTE this gets pacts for peqs held by selected user, not pacts that selected user was the actor for.
Future<void> updateUserPActions( peqs, container, context ) async {
   final appState  = container.state;
   String uname = appState.selectedUser;
   String cep   = appState.selectedCEProject;
   String pids  = json.encode( peqs );
   appState.userPActs[uname] = await fetchPEQActions( context, container, '{ "Endpoint": "GetPActsById", "CEProjectId": "$cep", "PeqIds": $pids }' );
}

 
// Note.  this only updates in detail_page when userPActUpdate flag is set by changing to new line.
//        Could reduce calls by further limiting update to dirty, where dirty is set when empty or after updatePeq.
//        small beer.. 
// Need both Active and Inactive (for accrued, only)
Future<void> updateUserPeqs( container, context ) async {
   final appState  = container.state;

   // SelectedUser will be adjusted if user clicks on an alloc (summaryFrame) or unassigned
   String uname = appState.selectedUser;
   if( uname == appState.UNASSIGN_USER ) { uname = ""; }
   
   String cep   = appState.selectedCEProject;
   print( "Building detail data for " + uname + ":" + cep );

   appState.userPeqs[appState.selectedUser] =
      await fetchPEQs( context, container, '{ "Endpoint": "GetPEQ", "CEUID": "", "HostUserName": "$uname", "CEProjectId": "$cep", "allAccrued": "true" }' );
}




