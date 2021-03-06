import 'dart:convert';  // json encode/decode
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:random_string/random_string.dart';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';
import 'package:http/http.dart' as http;
import 'package:tuple/tuple.dart';

// This package is currently used only for authorization.  Github has deprecated username/passwd auth, so
// authentication is done by personal access token.  The user model and repo service in this package are too
// narrowly limited - not allowing access to user subscriptions, just user-owned repos.  So, auth-only.
// https://github.com/SpinlockLabs/github.dart/blob/master/lib/src/common/repos_service.dart
import 'package:github/github.dart';

import 'package:ceFlutter/utils.dart';

import 'package:ceFlutter/screens/launch_page.dart';
import 'package:ceFlutter/screens/home_page.dart';

import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/PEQAction.dart';
import 'package:ceFlutter/models/PEQSummary.dart';
import 'package:ceFlutter/models/PEQRaw.dart';
import 'package:ceFlutter/models/person.dart';
import 'package:ceFlutter/models/ghAccount.dart';
import 'package:ceFlutter/models/allocation.dart';

// XXX strip context, container where not needed


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


Future<String> fetchString( context, container, postData, shortName ) async {
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      String s = json.decode(utf8.decode(response.bodyBytes));
      return s;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchString( context, container, postData, shortName ); }
   }
}

Future<bool> updateDynamo( context, container, postData, shortName ) async {
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      // print( response.body.toString() );         
      return true;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await updateDynamo( context, container, postData, shortName ); }
   }
}

Future<List<PEQ>> fetchPEQs( context, container, postData ) async {
   String shortName = "fetchPEQs";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      Iterable l = json.decode(utf8.decode(response.bodyBytes));
      List<PEQ> peqs = l.map((sketch)=> PEQ.fromJson(sketch)).toList();
      return peqs;
   } else if( response.statusCode == 204) {
      print( "Fetch: no PEQs found" );
      return [];
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
   } else if( response.statusCode == 204) {
      print( "Fetch: no PEQ Actions found" );
      return [];
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

Future<PEQRaw> fetchPEQRaw( context, container, postData ) async {
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
      Iterable pacts = json.decode(utf8.decode(response.bodyBytes));
      List<PEQAction> pactions = pacts.map((pact) => PEQAction.fromJson(pact)).toList();
      return pactions;
   } else if( response.statusCode == 204) {
      return [];
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await lockFetchPActions( context, container, postData ); }
   }
}


// Called on signin
Future<void> reloadMyProjects( context, container ) async {
   print( "reloadMyProjects" );
   final appState  = container.state;

   if( appState.userId == "" ) {
      appState.userId = await fetchString( context, container, '{ "Endpoint": "GetID" }', "GetID" );
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
      appState.selectedRepo = ghRepo;

      // XXX could be thousands... too much.  Just get uningested, most recent, etc.
      // Get all PEQ data related to the selected repo.  
      appState.myPEQs       = await fetchPEQs( context, container,
                                                      '{ "Endpoint": "GetPEQ", "CEUID": "$uid", "GHUserName": "", "GHRepo": "$ghRepo" }' );

      // XXX could be thousands... too much.   Just get uningested, most recent, etc.
      // XXX Really just want mine?  Hmmmmmmmm.......
      // To get here, user has both a CEUID and an association with ghUserLogin
      // Any PEQActions recorded from github before the user had a CELogin will have been updated as soon as the linkage was created.
      appState.myPEQActions = await fetchPEQActions( context, container,
                                                      '{ "Endpoint": "GetPEQActions", "CEUID": "$uid", "GHUserName": "", "GHRepo": "$ghRepo" }' );

      var postData = {};
      postData['GHRepo'] = ghRepo;
      var pd = { "Endpoint": "GetEntry", "tableName": "CEPEQSummary", "query": postData };
      appState.myPEQSummary = await fetchPEQSummary( context, container, pd );

      // if( appState.myPEQSummary != null ) { buildAllocationTree( invokeDetail( context, container ), context, container ); }
      
   }
}



// XXX consider keeping a map in appstate, to reduce aws calls
// PActions, PEQs are added by webServer, which does not have nor require ceUID.
// set CEUID by matching my peqAction:ghUserName  or peq:ghUserNames to cegithub:ghUsername, then writing that CEOwnerId
// if there is not yet a corresponding ceUID, use "GHUSER: $ghUserName" in it's place, to be fixed later by associateGitub
// NOTE: Expect multiple PActs for each PEQ.  For example, open, close, and accrue
Future<void> updateCEUID( PEQAction pact, PEQ peq, context, container ) async {
   assert( pact.ceUID == EMPTY );
   String ghu  = pact.ghUserName;
   String ceu  = await fetchString( context, container, '{ "Endpoint": "GetCEUID", "GHUserName": "$ghu" }', "GetCEUID" );   
   await updateDynamo( context, container, '{ "Endpoint": "putPActCEUID", "CEUID": "$ceu", "PEQActionId": "${pact.id}" }', "putPActCEUID" );

   // PEQ holder may have been set via earlier PAct.  But here, may be adding or removing CEUIDs
   peq.ceHolderId = new List<String>();
   for( var peqGHUser in peq.ghHolderId ) {
      String ceUID = await fetchString( context, container, '{ "Endpoint": "GetCEUID", "GHUserName": "$peqGHUser" }', "GetCEUID" );
      if( ceUID == "" ) { ceUID = "GHUSER: " + peqGHUser; }
      peq.ceHolderId.add( ceUID );
   }

   // 0 length is ok, when unassigned.
   String ceHolders = json.encode( peq.ceHolderId );
   String ceGrantor = EMPTY;
   // XXX ??? should grantor be CE or GH id?  Maybe depends on ability to permission prot a project column
   if( pact.action == PActAction.accrue && pact.verb == PActVerb.confirm ) {  ceGrantor = ghu;   }

   var postData = {};
   postData['PEQId']       = peq.id;
   postData['CEHolderId']  = ceHolders;
   postData['CEGrantorId'] = ceGrantor;
   var pd = { "Endpoint": "UpdatePEQ", "pLink": postData }; 
      
   await updateDynamo( context, container, pd, "UpdatePEQ" );

   /*
   await updateDynamo( context, container,
                       '{ "Endpoint": "UpdatePEQ", "PEQId": "${peq.id}", "CEHolderId": $ceHolders, "CEGrantorId": "$ceGrantor" }', "updatePEQ" );
   */
}



void adjustSummaryAlloc( appState, List<String> sub, String subsub, splitAmount, PeqType peqType, String assignee ) {
   
   assert( appState.myPEQSummary.allocations != null );
   
   List<String> suba = new List<String>.from( sub );
   if( assignee != EMPTY ) { suba.add( assignee ); }
   
   print( "Adjust summary allocation " + suba.toString() );
   
   // Update, if already in place
   for( var alloc in appState.myPEQSummary.allocations ) {
      if( suba.toString() == alloc.category.toString() ) {
         print( " ... matched category: " + suba.toString()  );
         alloc.amount = alloc.amount + splitAmount;
         assert( alloc.amount >= 0 );

         if( alloc.amount == 0 ) {
            appState.myPEQSummary.allocations.remove( alloc );
         }
         return;
      }
   }
   
   // If we get here, could not find existing match.  if peqType == end, we are reducing an existing allocation.
   assert( peqType != PeqType.end && splitAmount >= 0 );
   
   // Create allocs, if not already updated.. 1 per assignee
   print( " ... adding new allocation" );
   if( subsub != "" ) { suba.add( subsub ); }
   Allocation alloc = new Allocation( category: suba, amount: splitAmount, allocType: peqType,
                                      ceUID: EMPTY, ghUserName: assignee, vestedPerc: 0.0, notes: "" );
   appState.myPEQSummary.allocations.add( alloc );
}


// XXX Hmm.. why is "allocated" treated differently than "planned", "proposed" and "accrued" ?  that's why the length sort.
//     Fix this before timestamp sort.  also interacts with adjustSummaryAlloc
// XXX this may need updating if allow 1:many ce/gh association.  maybe limit ce login to 1:1 - pick before see stuff.
// Assignees use gh names instead of ce ids - user comfort
void processPEQAction( PEQAction pact, PEQ peq, context, container ) async {
   print( "processing " + enumToStr(pact.verb) + " act " + enumToStr(pact.action) + " type " + enumToStr(peq.peqType) + " for " + peq.amount.toString() );
   final appState  = container.state;

   // Wait here, else summary may be inaccurate
   await updateCEUID( pact, peq, context, container );

   // Create, if need to
   if( appState.myPEQSummary == null ) {
      print( "Create new appstate PSum" );
      String pid = randomAlpha(10);
      appState.myPEQSummary = new PEQSummary( id: pid, ghRepo: peq.ghRepo,
                                              targetType: "repo", targetId: peq.ghProjectId, lastMod: getToday(), allocations: [] );
   }
   
   if( pact.action == PActAction.notice ) {
      print( "Peq Action is a notice event: " + pact.subject.toString() );
      print( "updated CEUID if available - no other action needed." );
   }
   else if( pact.action == PActAction.accrue ) {
      print( "Accrue PAct " + enumToStr( pact.action ) + " " + enumToStr( pact.verb ));
      List<String> sub = new List<String>.from( peq.ghProjectSub );

      List<String> assignees = peq.ghHolderId;
      if( assignees.length == 0 ) { print( "Must have assignees in order to accrue!" ); }
      assert( assignees.length > 0 );
      int splitAmount = (peq.amount / assignees.length).floor();
      
      List<String> subProp = new List<String>.from( peq.ghProjectSub ); subProp.add( "Pending" );
      List<String> subPlan = new List<String>.from( peq.ghProjectSub ); subPlan.add( "Planned" );
      List<String> subAccr = new List<String>.from( peq.ghProjectSub ); subAccr.add( "Accrued" );
      // iterate over assignees
      for( var assignee in assignees ) {
         print( "\n Assignee: " + assignee );

         // XXX Could be faster.. would it matter?
         String newType = "";
         if( pact.verb == PActVerb.propose ) {
            // add propose, rem plan
            adjustSummaryAlloc( appState, subProp, "", splitAmount, PeqType.pending, assignee );
            adjustSummaryAlloc( appState, subPlan, "", -1 * splitAmount, PeqType.plan, assignee );
            newType = enumToStr( PeqType.pending );
         }
         else if( pact.verb == PActVerb.reject ) {
            // rem propose, add plan
            adjustSummaryAlloc( appState, subProp, "", -1 * splitAmount, PeqType.pending, assignee );
            adjustSummaryAlloc( appState, subPlan, "", splitAmount, PeqType.plan, assignee );
            newType = enumToStr( PeqType.plan );
         }
         // XXX  HERE
         else if( pact.verb == PActVerb.confirm ) {
            // rem propose, add accrue
            adjustSummaryAlloc( appState, subProp, "", -1 * splitAmount, PeqType.pending, assignee );
            adjustSummaryAlloc( appState, subAccr, "",  splitAmount, PeqType.grant, assignee );
            newType = enumToStr( PeqType.grant );
         }
         else {
            print( "Unrecognized verb " + enumToStr( pact.verb ) );
            assert( false );
         }

         var postData = {};
         postData['PEQId']    = peq.id;
         postData['PeqType']  = newType;
         var pd = { "Endpoint": "UpdatePEQ", "pLink": postData }; 
         
         await updateDynamo( context, container, pd, "UpdatePEQ" );
         // await updateDynamo( context, container, '{ "Endpoint": "UpdatePEQType", "PEQId": "${peq.id}", "PeqType": "$newType" }', "UpdatePEQType" );
      }
   }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.add ) {

      if( peq.peqType == PeqType.allocation ) {

         String pt = peq.ghIssueTitle;
         adjustSummaryAlloc( appState, peq.ghProjectSub, pt, peq.amount, PeqType.allocation, EMPTY );
      }
      else if( peq.peqType == PeqType.plan ) {
         print( "Plan PEQ" );

         List<String> sub = new List<String>.from( peq.ghProjectSub ); sub.add( "Planned" );
         
         List<String> assignees = peq.ghHolderId;
         if( assignees.length == 0 ) { assignees = [ "Unassigned" ]; }
         int splitAmount = (peq.amount / assignees.length).floor();

         // iterate over assignees
         for( var assignee in assignees ) {
            print( "\n Assignee: " + assignee );
            adjustSummaryAlloc( appState, sub, "", splitAmount, PeqType.plan, assignee );
         }
      }
      else { notYetImplemented( context ); }
   }
   else { notYetImplemented( context ); }

}


// XXX sort by timestamp
Future<void> updatePEQAllocations( repoName, context, container ) async {
   print( "Updating allocations for ghRepo" );

   final appState  = container.state;
   final todoPActions = await lockFetchPActions( context, container, '{ "Endpoint": "GetUnPAct", "GHRepo": "$repoName" }' );

   if( todoPActions.length == 0 ) { return; }

   List<String> pactIds = [];
   List<String> peqIds = [];

   // Build pact peq pairs for active 'todo' PActions 
   for( var pact in todoPActions ) {
      print( pact.toString() );
      assert( !pact.ingested );

      if( pact.action != PActAction.relocate && pact.action != PActAction.change ) {
         assert( pact.subject.length == 1 );
         pactIds.add( pact.id );
         peqIds.add( pact.subject[0] );
         
      }
      else { notYetImplemented( context ); }
   }

   // This returns in order of request, including duplicates
   String PeqIds = json.encode( peqIds );
   List<PEQ> todoPeqs = await fetchPEQs( context, container,'{ "Endpoint": "GetPEQsById", "PeqIds": $PeqIds }' );
   assert( pactIds.length == todoPActions.length );
   assert( peqIds.length  == todoPeqs.length );

   // sort by peq category length before processing.
   // XXX NOTE - timestamp sort may hurt this. stable sort in dart?
   List<Tuple2<PEQAction, PEQ>> todos = new List<Tuple2<PEQAction, PEQ>>();
   for( var i = 0; i < todoPActions.length; i++ ) {
      assert( pactIds[i] == todoPActions[i].id );
      assert( peqIds[i]  == todoPeqs[i].id );
      assert( todoPeqs[i].active );
      todos.add( new Tuple2<PEQAction, PEQ>( todoPActions[i], todoPeqs[i] ) );
   }
   todos.sort((a, b) => a.item2.ghProjectSub.length.compareTo(b.item2.ghProjectSub.length));

   for( var tup in todos ) {
      await processPEQAction( tup.item1, tup.item2, context, container );
   }

   // XXX Skip this is no change (say, on a series of notices).
   if( appState.myPEQSummary != null ) {
      String psum = json.encode( appState.myPEQSummary );
      String postData = '{ "Endpoint": "PutPSum", "NewPSum": $psum }';
      await updateDynamo( context, container, postData, "PutPSum" );
   }

   // unlock, set ingested
   if( pactIds.length > 0 ) {
      String newPIDs = json.encode( pactIds );
      final status = await updateDynamo( context, container,'{ "Endpoint": "UpdatePAct", "PactIds": $newPIDs }', "UpdatePAct" );
   }
}

Future<void> updateUserPActions( container, context ) async {
   final appState  = container.state;
   String uname = appState.selectedUser;
   String rname = appState.selectedRepo;
   appState.userPActs[uname] = await fetchPEQActions( context, container,
                                                      '{ "Endpoint": "GetPEQActions", "CEUID": "", "GHUserName": "$uname", "GHRepo": "$rname" }' );
}

Future<void> updateUserPeqs( Set<String> peqSet, container, context ) async {
   final appState  = container.state;
   List<String> peqIds = new List<String>.from( peqSet );
   String PeqIds = json.encode( peqIds );
   String uname = appState.selectedUser;
   appState.userPeqs[uname] = await fetchPEQs( context, container, '{ "Endpoint": "GetPEQsById", "PeqIds": $PeqIds }' );
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

// XXX rewrite any ceUID or ceHolderId in PEQ, PEQAction that look like: "GHUSER: $ghUserName"
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
         await updateDynamo( context, container, postData, "PutGHA" );

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
