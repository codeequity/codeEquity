import 'dart:convert';  // json encode/decode
import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:flutter/material.dart';

import 'package:ceFlutter/utils/awsUtils.dart';
import 'package:ceFlutter/utils/widgetUtils.dart';

import 'package:ceFlutter/screens/launch_page.dart';

import 'package:ceFlutter/models/EquityPlan.dart';
import 'package:ceFlutter/models/Person.dart';
import 'package:ceFlutter/models/CEVenture.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/HostAccount.dart';
import 'package:ceFlutter/models/PEQ.dart';


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

String makePercent(double n) {
   double v = n * 100.0;
   String ret = v.toStringAsFixed(n.truncateToDouble() == v ? 0 : 2);
   return ret + "%";
}

Future<void> logout( context, appState ) async {

   try {
      print( "pre cog signout" );
      appState.cogUser = await appState.cogUserService.signOut();
      print( "post cog signout" );
   } catch(e, stacktrace) {
      print(e);
      print(stacktrace);
      showToast( e.toString() );
   }           
   
   print( "To launch page" );
   assert( context != null );   
   Navigator.pushAndRemoveUntil(
      context, 
      MaterialPageRoute(builder: (context) => CELaunchPage()),
      ModalRoute.withName("CESplashPage")
      );
}

/*
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
*/


// Called with any ceProject, and if Venture clicked that has no project yet.
Future<void> reloadCEVentureOnly( context, container ) async {
   
   final appState  = container.state;

   String ceVent   = appState.selectedCEVenture;
   String uid      = appState.ceUserId;
   print( "Loading " + uid + "'s " + ceVent + " CodeEquity Venture." );

   var pdEP = json.encode( { "Endpoint": "GetEntry", "tableName": "CEEquityPlan", "query": {"EquityPlanId": "$ceVent"}} );

   // Consider separting fPSummary, since summary is the first thing that pops up.
   var futs = await Future.wait([
                                   (appState.ceEquityPlans[ceVent] == null ?
                                    fetchEquityPlan( context, container,  pdEP ).then( (p) => appState.ceEquityPlans[ceVent] = p ) :
                                    new Future<bool>.value(true) ),
                                   
                                   ]);
   appState.myEquityPlan = appState.ceEquityPlans[ceVent];
   
   if( appState.myEquityPlan == null ) { appState.myEquityPlan = new EquityPlan( ceVentureId: ceVent, categories: [], amounts: [], hostNames: [], totalAllocation: 0, lastMod: "" ); }

   if( appState.myEquityPlan != null ) { appState.updateEquityPlan = true; } // force equity tree update
   if( appState.myEquityPlan != null ) { appState.updateEquityView = true; } // force equity view creation on first pass
}

// Called each time click different ceProject, or ceVenture with only 1 ceProject on homepage
Future<void> reloadCEProject( context, container ) async {
   
   final appState  = container.state;

   String ceVent   = appState.selectedCEVenture;
   String ceProj   = appState.selectedCEProject;
   String uid      = appState.ceUserId;
   print( "Loading " + uid + "'s " + ceProj + " CodeEquity project." );

   var pdPS = json.encode( { "Endpoint": "GetEntry", "tableName": "CEPEQSummary", "query": {"PEQSummaryId": "$ceProj" }} );
   var pdHL = json.encode( { "Endpoint": "GetEntry", "tableName": "CELinkage",    "query": {"CEProjectId": "$ceProj" }} );

   // Consider separting fPSummary, since summary is the first thing that pops up.
   var futs = await Future.wait([
                                   (appState.cePEQSummaries[ceProj] == null ?
                                    fetchPEQSummary( context, container,  pdPS ).then( (p) => appState.cePEQSummaries[ceProj] = p ) :
                                    new Future<bool>.value(true) ),
                                   
                                   (appState.ceEquityPlans[ceVent] == null ?
                                    reloadCEVentureOnly( context, container ) :
                                    new Future<bool>.value(true) ),

                                   (appState.ceHostLinks[ceProj] == null ?
                                    fetchHostLinkage( context, container, pdHL ).then( (p) => appState.ceHostLinks[ceProj] = p ) :
                                    new Future<bool>.value(true) ),
                                   
                                   ]);
   appState.myPEQSummary = appState.cePEQSummaries[ceProj];
   appState.myHostLinks  = appState.ceHostLinks[ceProj];
   
   if( appState.verbose >= 3 ) {
      print( "Got Links?" ); 
      appState.myHostLinks == null ? print( "nope - no associated repo" ) : print( appState.myHostLinks.toString() );
   }

   if( appState.myPEQSummary != null ) { appState.updateAllocTree = true;  } // force alloc tree update
}


// Called on login, signup, refreshProjects
Future<void> initMDState( context, container ) async {
   print( "initMDState" );
   final appState  = container.state;

   appState.ceUserId = await fetchString( context, container, '{ "Endpoint": "GetID" }', "GetID" );
   String uid = appState.ceUserId;
   assert( uid != "" );
   print( "UID: " + uid );

   var pdHA   = json.encode( { "Endpoint": "GetHostA", "CEUserId": "$uid"  } );      // FetchHost sets hostAccounts.ceProjs

   List<CEProject> ceps  = [];
   List<CEVenture> cevs  = [];
   List<Person>    peeps = [];

   // NOTE Could push fetchCEPeople to reloadCEProject.  But, dynamo table does not carry that info, and constructing a
   //      a list of cep-specific names then fetching that is likely to provide minimal gains, if any.  Leave it here.
   await Future.wait([
                        (appState.ceHostAccounts[uid] == null ? 
                         fetchHostAcct( context, container, pdHA ).then( (p) => appState.ceHostAccounts[uid] = p ) :
                         new Future<bool>.value(true) ),
                        
                        fetchCEPeople( context, container ).then(       (p) => peeps = p ),
                        
                        fetchCEProjects( context, container ).then(     (p) => ceps = p ),
                        
                        fetchCEVentures( context, container ).then(     (p) => cevs = p ),
                        ]);
   appState.myHostAccounts = appState.ceHostAccounts[uid];

   // XXX Scales poorly - could do some of this in the background, force wait when build idMapHost
   for( CEProject cep in ceps ) { appState.ceProject[ cep.ceProjectId ] = cep; }
   for( CEVenture cev in cevs ) { appState.ceVenture[ cev.ceVentureId ] = cev; }
   for( Person p in peeps )     { appState.cePeople[ p.id ] = p; }
   
   // Set idMap to get from hostUID to hostUserName or ceUID easily.  All users for a given host platform.
   // XXX Scales poorly.  This could move to reloadCEProject, since idMapHost usage is by cep.
   //     Would be work to get cep, then hostRepo, which is stored in hostUser table, no real gains for a long time here.
   appState.idMapHost = await fetchHostMap( context, container, "GitHub", appState.cePeople ); // XXX gh
   
}



// appState.selectedHostUIDs is ceUID + UNASSIGN_USER
// the unassigned user tag is useful to grab PEQs that have yet to be ingested.
String ceUIDFromHost( appState, String hostUID ) {
   if( hostUID == appState.UNASSIGN_USER ) {
      return appState.UNASSIGN_USER;
   }
   else {
      assert( appState.idMapHost[ appState.selectedHostUID ] != null);
      String ceUID = appState.idMapHost[ hostUID ]![ "ceUID" ] ?? "";
      assert( ceUID != "" );
      return ceUID;
   }
}


// Note.  this only updates in detail_page when userPActUpdate flag is set by changing to new line.
//        Could reduce calls by further limiting update to dirty, where dirty is set when empty or after updatePeq.
//        small beer.. 
// NOTE this gets pacts for peqs held by selected user, not pacts that selected user was the actor for.
Future<void> updateUserPActions( peqs, container, context, cepId ) async {
   final appState  = container.state;
   String pids  = json.encode( peqs );
   
   String ceUID = ceUIDFromHost( appState, appState.selectedHostUID );
   appState.userPActs[ceUID] = await fetchPEQActions( context, container, '{ "Endpoint": "GetPActsById", "CEProjectId": "$cepId", "PeqIds": $pids }' );
}

 
// Note.  this only updates in detail_page when userPActUpdate flag is set by changing to new line.
//        Could reduce calls by further limiting update to dirty, where dirty is set when empty or after updatePeq.
//        small beer..
// Need both Active and Inactive (for accrued, only)
Future<void> updateUserPeqs( container, context, {getAll = false} ) async {
   final appState  = container.state;

   print( "building peq data..  getall? " + getAll.toString() );
   // SelectedUser will be adjusted if user clicks on an alloc (summaryFrame) or unassigned
   if( !getAll ) {
      // NOTE this is in terms of host user name, initially
      String huid = appState.selectedHostUID;
      if( huid == appState.UNASSIGN_USER ) { huid = ""; }
      
      String cep   = appState.selectedCEProject;
      print( "Building peq data for " + huid + ":" + cep );

      String ceUID = ceUIDFromHost( appState, appState.selectedHostUID );      
      appState.userPeqs[ceUID] =
         await fetchPEQs( context, container, '{ "Endpoint": "GetPEQ", "CEUID": "", "HostUserId": "$huid", "CEProjectId": "$cep", "allAccrued": "true" }' );

      // print( "Got " + appState.userPeqs[ceUID].length.toString() );
      // print( appState.userPeqs[ceUID] );
   }
   else {
      // Collect CEPs by host
      List<String> myCEPs = [];
      List<HostAccount> myHA = appState.ceHostAccounts[ appState.ceUserId ];
      for( final host in myHA ) { myCEPs.addAll( host.ceProjectIds );  }

      // Collect all peqs by cep
      String shortName = "GetEntries";
      List< Future<List<PEQ>> > futs = [];
      futs = myCEPs.map( (cep) {
            final postData = '{ "Endpoint": "GetEntries", "tableName": "CEPEQs", "query": { "CEProjectId": "$cep" }}';
            return fetchPEQs( context, container, postData );
         }).toList();

      appState.gotAllPeqs = true;
      List<List<PEQ>> cepPeqs = await Future.wait( futs );   // all peqs for all ceps user is part of
      
      // each peq has ceHolderId. accumulate per, put into appState.userPeqs
      // Note: peqs do not cross CEP boundaries
      for( final oneProjPeqs in cepPeqs ) {
         for( final peq in oneProjPeqs ) {
            for( final ceUID in peq.ceHolderId ) {
               // print( "got all peqs: " + ceUID + " " + peq.id );
               appState.userPeqs[ ceUID ] == null ?
                  appState.userPeqs[ ceUID ] =   [ peq ] :
                  appState.userPeqs[ ceUID ].add(  peq );
            }
         }
      }

   }
}



void confirmedNav( context, container, newPage ) {
   final appState  = container.state;

   if( appState.cogUser!.confirmed ) {
      Navigator.push( context, newPage );
   }
   else {
      assert( context != null );
      Navigator.pushAndRemoveUntil(
         context, 
         MaterialPageRoute(builder: (context) => CELaunchPage()),
         ModalRoute.withName("CESplashPage")
         );
   }

}


