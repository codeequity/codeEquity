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
   print( shortName );
   final appState  = container.state;

   // final gatewayURL = appState.apiBasePath + "/find";
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
      List<PEQ> peqs = l.map( (sketch)=> sketch == -1 ? PEQ.empty() : PEQ.fromJson(sketch) ).toList();
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
      print( "My GH Accts:" );
      print( appState.myGHAccounts );
      String ghUser = appState.myGHAccounts[0].ghUserName;
      String ghRepo = appState.myGHAccounts[0].repos[4];    // XXX XXX XXX
      appState.selectedRepo = ghRepo;

      // XXX could be thousands... too much.  Just get uningested, most recent, etc.
      // Get all PEQ data related to the selected repo.  
      appState.myPEQs = await fetchPEQs( context, container,
                                         '{ "Endpoint": "GetPEQ", "CEUID": "$uid", "GHUserName": "", "GHRepo": "$ghRepo" }' );

      // XXX Really just want mine?  Hmmmmmmmm.......no.  get all for peqs above.
      // XXX could be thousands... too much.   Just get uningested, most recent, etc.
      // To get here, user has both a CEUID and an association with ghUserLogin
      // Any PEQActions recorded from github before the user had a CELogin will have been updated as soon as the linkage was created.
      appState.myPEQActions = await fetchPEQActions( context, container,
                                                      '{ "Endpoint": "GetPEQActions", "CEUID": "$uid", "GHUserName": "", "GHRepo": "$ghRepo" }' );

      var postData = {};
      postData['GHRepo'] = ghRepo;
      var pd = { "Endpoint": "GetEntry", "tableName": "CEPEQSummary", "query": postData };
      appState.myPEQSummary  = await fetchPEQSummary( context, container, pd );
      
      if( appState.myPEQSummary != null ) { appState.updateAllocTree = true; }  // force alloc tree update
      
   }
}



// XXX associateGithub has to update appState.idMapGH
// PActions, PEQs are added by webServer, which does not have access to ceUID.
// set CEUID by matching my peqAction:ghUserName  or peq:ghUserNames to cegithub:ghUsername, then writing that CEOwnerId
// if there is not yet a corresponding ceUID, use "GHUSER: $ghUserName" in it's place, to be fixed later by associateGitub XXX (done?)
// NOTE: Expect multiple PActs for each PEQ.  For example, open, close, and accrue
Future<void> updateCEUID( appState, PEQAction pact, PEQ peq, context, container ) async {
   print( pact );
   print( peq );
   assert( pact.ceUID == EMPTY );
   String ghu  = pact.ghUserName;
   if( !appState.idMapGH.containsKey( ghu )) {
      appState.idMapGH[ ghu ] = await fetchString( context, container, '{ "Endpoint": "GetCEUID", "GHUserName": "$ghu" }', "GetCEUID" );
   }
   String ceu = appState.idMapGH[ ghu ];
   
   if( ceu != "" ) {
      // Don't await here, CEUID not used during processPEQ
      updateDynamo( context, container, '{ "Endpoint": "putPActCEUID", "CEUID": "$ceu", "PEQActionId": "${pact.id}" }', "putPActCEUID" );
   }

   // PEQ holder may have been set via earlier PAct.  But here, may be adding or removing CEUIDs
   peq.ceHolderId = new List<String>();
   for( var peqGHUser in peq.ghHolderId ) {
      if( !appState.idMapGH.containsKey( peqGHUser )) {
         appState.idMapGH[ peqGHUser ] = await fetchString( context, container, '{ "Endpoint": "GetCEUID", "GHUserName": "$peqGHUser" }', "GetCEUID" );
      }
      String ceUID = appState.idMapGH[ peqGHUser ];
      if( ceUID == "" ) { ceUID = "GHUSER: " + peqGHUser; }
      peq.ceHolderId.add( ceUID );
   }

   // 0 length is ok, when unassigned.
   String ceGrantor = EMPTY;
   // XXX ??? should grantor be CE or GH id?  Maybe depends on ability to permission prot a project column
   if( pact.action == PActAction.accrue && pact.verb == PActVerb.confirm ) {  ceGrantor = ghu;   }
   

   // Update PEQ, if there is one.
   if( peq.id != "-1" ) {
      var postData = {};
      postData['PEQId']       = peq.id;
      postData['CEHolderId']  = peq.ceHolderId;
      postData['CEGrantorId'] = ceGrantor;
      var pd = { "Endpoint": "UpdatePEQ", "pLink": postData }; 
      
      print( "Start update peq" );
      print( postData );
      // Do await, processPEQs needs holders
      await updateDynamo( context, container, json.encode( pd ), "UpdatePEQ" );
      print( "Finish update peq" );
   }
}



void adjustSummaryAlloc( appState, peqId, List<String> sub, String subsub, splitAmount, PeqType peqType, String assignee ) {
   
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

         if     ( alloc.amount == 0 )                                     { appState.myPEQSummary.allocations.remove( alloc ); }
         else if( alloc.sourcePeq.contains(  peqId ) && splitAmount < 0 ) { alloc.sourcePeq.remove( peqId ); }
         else if( !alloc.sourcePeq.contains( peqId ) && splitAmount > 0 ) { alloc.sourcePeq.add( peqId ); }
         else {
            // This should not be overly harsh.  Negotiations can remove then re-add.
            print( "Uh oh.  AdjustSummaryAlloc $splitAmount $peqId " + alloc.toString() );
            assert( false );
         }
         
         return;
      }
   }
   
   // If we get here, could not find existing match.  if peqType == end, we are reducing an existing allocation.
   assert( peqType != PeqType.end && splitAmount >= 0 );
   
   // Create allocs, if not already updated.. 1 per assignee
   assert( splitAmount > 0 );
   print( " ... adding new allocation" );
   if( subsub != "" ) { suba.add( subsub ); }
   Allocation alloc = new Allocation( category: suba, amount: splitAmount, sourcePeq: [peqId], allocType: peqType,
                                      ceUID: EMPTY, ghUserName: assignee, vestedPerc: 0.0, notes: "" );
   appState.myPEQSummary.allocations.add( alloc );
}


/* 
   Basic Flow, based on makeIssue, add label, make project card, add assignee x 2, close, accrue
   
   makeIssue
   add label
   hYMgLYxllp   confirm add	---	<empty>	      [ { "S" : "DAcWeodOvb" } ]
                 peq psub: [Software Contributions, Data Security]
                 actual location: unclaimed:unclaimed

   makeProjCard
   oJHIzkqTwP   confirm relocate---	<empty>	      [ { "S" : "DAcWeodOvb" }, { "S" : "13302090" }, { "S" : "15978796" } ]
                 pact sub: peqID, destination project ID, destination column ID
                 peq psub: [Software Contributions, Data Security]  
                 location in GH: dataSec:planned

https://github.com/ariCETester/CodeEquityTester/projects/428#column-15978796
   add assignees
   GMpDtDUucD   confirm change	---	add assignee  [ { "S" : "DAcWeodOvb" }, { "S" : "ariCETester" } ]
   HGyfhTfPCl   confirm change	---	add assignee  [ { "S" : "DAcWeodOvb" }, { "S" : "codeequity" } ]
   YIQBiXPbru   confirm notice	---	<empty>	      [ { "S" : "DAcWeodOvb" } ]
   fjbjbYCcYn   propose accrue	---	<empty>	      [ { "S" : "DAcWeodOvb" } ]
   JhkTqESCvR   confirm accrue	---	<empty>	      [ { "S" : "DAcWeodOvb" } ]
*/


// XXX string constants in here?
// XXX need to be updating PEQ in AWS after processing!  Ouch... slow, but could speed it up..
// XXX Hmm.. why is "allocated" treated differently than "planned", "proposed" and "accrued" ?  that's why the length sort.
//     Fix this before timestamp sort.  also interacts with adjustSummaryAlloc
// XXX this may need updating if allow 1:many ce/gh association.  maybe limit ce login to 1:1 - pick before see stuff.
// Assignees use gh names instead of ce ids - user comfort
void processPEQAction( PEQAction pact, PEQ peq, context, container ) async {
   print( "\n-------------------------------" );
   print( "processing " + enumToStr(pact.verb) + " " + enumToStr(pact.action) + ", " + enumToStr(peq.peqType) + " for " + peq.amount.toString() );
   final appState = container.state;

   // Wait here, else summary may be inaccurate
   await updateCEUID( appState, pact, peq, context, container );

   // Create, if need to
   if( appState.myPEQSummary == null ) {
      print( "Create new appstate PSum\n" );
      String pid = randomAlpha(10);
      appState.myPEQSummary = new PEQSummary( id: pid, ghRepo: peq.ghRepo,
                                              targetType: "repo", targetId: peq.ghProjectId, lastMod: getToday(), allocations: [] );
   }

   // XXX LabelTest dubs ends up with peqType == grant.  all others are plan or alloc
   List<String> subAllc = new List<String>.from( peq.ghProjectSub );
   List<String> subProp = new List<String>.from( peq.ghProjectSub ); subProp.add( "Pending" );
   List<String> subPlan = new List<String>.from( peq.ghProjectSub ); subPlan.add( "Planned" );
   List<String> subAccr = new List<String>.from( peq.ghProjectSub ); subAccr.add( "Accrued" );

   List<String> assignees = peq.ghHolderId;
   if( assignees.length == 0 ) { assignees = [ "Unassigned" ]; }
   int splitAmount = (peq.amount / assignees.length).floor();
   
   if( pact.action == PActAction.notice ) {
      print( "Peq Action is a notice event: " + pact.subject.toString() );
      print( "updated CEUID if available - no other action needed." );
   }
   else if( pact.action == PActAction.accrue ) {
      // Once see action accrue, should have already seen peqType.pending
      print( "Accrue PAct " + enumToStr( pact.action ) + " " + enumToStr( pact.verb ));
      List<String> sub = new List<String>.from( peq.ghProjectSub );

      if( assignees.length == 1 && assignees[0] == "Unassigned" ) {
         print( "WARNING.  Must have assignees in order to accrue!" );
         return;
      }
      
      // iterate over assignees
      for( var assignee in assignees ) {
         print( "\n Assignee: " + assignee );

         // XXX Could be faster.. would it matter?
         String newType = "";
         if( pact.verb == PActVerb.propose ) {
            // add propose, rem plan
            adjustSummaryAlloc( appState, peq.id, subProp, "", splitAmount, PeqType.pending, assignee );
            adjustSummaryAlloc( appState, peq.id, subPlan, "", -1 * splitAmount, PeqType.plan, assignee );
            newType = enumToStr( PeqType.pending );
         }
         else if( pact.verb == PActVerb.reject ) {
            // rem propose, add plan
            adjustSummaryAlloc( appState, peq.id, subProp, "", -1 * splitAmount, PeqType.pending, assignee );
            adjustSummaryAlloc( appState, peq.id, subPlan, "", splitAmount, PeqType.plan, assignee );
            newType = enumToStr( PeqType.plan );
         }
         // XXX  HERE
         else if( pact.verb == PActVerb.confirm ) {
            // rem propose, add accrue
            adjustSummaryAlloc( appState, peq.id, subProp, "", -1 * splitAmount, PeqType.pending, assignee );
            adjustSummaryAlloc( appState, peq.id, subAccr, "",  splitAmount, PeqType.grant, assignee );
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
         
         await updateDynamo( context, container, json.encode( pd ), "UpdatePEQ" );
         // await updateDynamo( context, container, '{ "Endpoint": "UpdatePEQType", "PEQId": "${peq.id}", "PeqType": "$newType" }', "UpdatePEQType" );
      }
   }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.add ) {
      // When adding, should only see peqType alloc or plan
      if( peq.peqType == PeqType.allocation ) {

         String pt = peq.ghIssueTitle;
         adjustSummaryAlloc( appState, peq.id, peq.ghProjectSub, pt, peq.amount, PeqType.allocation, EMPTY );
      }
      else if( peq.peqType == PeqType.plan ) {
         print( "Plan PEQ" );

         List<String> sub = new List<String>.from( peq.ghProjectSub ); sub.add( "Planned" );
         
         // iterate over assignees
         for( var assignee in assignees ) {
            print( "\n Assignee: " + assignee );
            adjustSummaryAlloc( appState, peq.id, sub, "", splitAmount, PeqType.plan, assignee );
         }
      }
      else {
         print( "Error.  Action add on peqType of " + peq.peqType.toString() );
         notYetImplemented( context );
      }
   }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.relocate ) {
      // Relocate, peqType can be anything

      // peq will be from the past.
      // psub:  [Software Contributions, Data Security]
      // alloc: [Software Contributions, Data Security, Planned, Unassigned]
      // note:  [DAcWeodOvb, 13302090, 15978796]
      print( "Relo PEQ" );
      
      List<String> sub = [];
      if     ( peq.peqType == PeqType.end )        { sub = subAllc; }
      else if( peq.peqType == PeqType.allocation ) { sub = subAllc; }
      else if( peq.peqType == PeqType.plan )       { sub = subPlan; }
      else if( peq.peqType == PeqType.pending )    { sub = subProp; }
      else if( peq.peqType == PeqType.grant )      { sub = subAccr; }

      /*
      // iterate over assignees
      for( var assignee in assignees ) {
         print( "\n Assignee: " + assignee );
         
         // Peq must be in allocations, somewhere.  Find it.
         var sourceAlloc = appState.myPEQSummary.firstWhere( (a) => a.sourcePeq.contains( peq.id ) && a.category.contains( assignee ) );
         if( sourceAlloc == null ) { print( "Error.  Can't move an allocation that does not exist" ); }
         
         adjustSummaryAlloc( appState, peq.id, sub, "", -1 * splitAmount, peq.peqType, assignee );
         let sourceAlloc = appState.myPEQSummary.firstWhere( (a) => a.sourcePeq.contains( peq.id ) && a.category.contains( assignee ) );
         if( sourceAlloc != null ) { print( "Error.  Allocation should not longer exist" ); }

         // Move to column.. Need to get name.
         // ghGet is public-only.  Our projects may be private.  Have initial PAT...
         adjustSummaryAlloc( appState, peq.id, subAccr, "",  splitAmount, PeqType.grant, assignee );
         
      }
      */
      
   }
   else { notYetImplemented( context ); }

}


// XXX Note.  locking is sticky.
// XXX sort by timestamp
// Record all PEQ actions:add, delete, accrue, relocate, change, notice
// Examples of useful actions without associated PEQ
//   change:'Column rename'
//   change:'Project rename'
//   change:'Column rename attempted'
//   notice:'PEQ label delete attempt'
//   notice:'PEQ label edit attempt'

Future<void> updatePEQAllocations( repoName, context, container ) async {
   print( "Updating allocations for ghRepo" );

   final appState  = container.state;
   final todoPActions = await lockFetchPActions( context, container, '{ "Endpoint": "GetUnPAct", "GHRepo": "$repoName" }' );

   if( todoPActions.length == 0 ) { return; }

   List<String> pactIds = [];
   List<String> peqIds = [];

   // Build pact peq pairs for active 'todo' PActions.  First, need to get ids where available
   for( var pact in todoPActions ) {
      // print( pact.toString() );
      assert( !pact.ingested );
      pactIds.add( pact.id );
      // Note: not all in peqIds are valid peqIds, even with non-zero subject
      pact.subject.length > 0 ? peqIds.add( pact.subject[0] ) : peqIds.add( "-1" );  
   }

   // XXX Could preprocess peqIds to cut aws workload.. remove dups, bad peqs, etc.
   
   // This returns in order of request, including duplicates
   String PeqIds = json.encode( peqIds );
   List<PEQ> todoPeqs = await fetchPEQs( context, container,'{ "Endpoint": "GetPEQsById", "PeqIds": $PeqIds }' );
   assert( pactIds.length == todoPActions.length );
   assert( peqIds.length  == todoPeqs.length );
   assert( peqIds.length  == pactIds.length );

   // XXX NOTE - timestamp sort may hurt this. stable sort in dart?
   // sort by peq category length before processing.
   List<Tuple2<PEQAction, PEQ>> todos = new List<Tuple2<PEQAction, PEQ>>();
   var foundPeqs = 0;
   for( var i = 0; i < todoPActions.length; i++ ) {
      // Can not assert the peqs are active - PAct might be a delete.
      assert( pactIds[i] == todoPActions[i].id );
      if( todoPeqs[i].id != "-1" ) {
         assert( peqIds[i] == todoPeqs[i].id );
         foundPeqs++;
      }
      
      // print( "associated peq-pact" );
      // print(  todoPActions[i] );
      // print(  todoPeqs[i] );
      todos.add( new Tuple2<PEQAction, PEQ>( todoPActions[i], todoPeqs[i] ) );
   }
   // todos.sort((a, b) => a.item2.ghProjectSub.length.compareTo(b.item2.ghProjectSub.length));
   todos.sort((a, b) => a.item1.timeStamp.compareTo(b.item1.timeStamp));

   // XXX Probably want another pass to stack up all updateCEUIDs.  Most can lay ontop of one another.
   print( "Will now process " + todoPActions.length.toString() + " pactions for " + foundPeqs.toString() + " non-unique peqs." );
   for( var tup in todos ) {
      final pa = tup.item1;
      final pp = tup.item2;
      print( "   " + pa.timeStamp.toString() + " <pact,peq> " + pa.id + " " + pp.id + " " + enumToStr(pa.verb) + " " + enumToStr(pa.action) + " " + pa.note + " " + pa.subject.toString());
   }
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
   // XXX check empty peq is OK
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
