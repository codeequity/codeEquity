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

import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/PEQAction.dart';
import 'package:ceFlutter/models/PEQSummary.dart';
import 'package:ceFlutter/models/person.dart';
import 'package:ceFlutter/models/ghAccount.dart';
import 'package:ceFlutter/models/allocation.dart';

import 'package:ceFlutter/components/tree.dart';
import 'package:ceFlutter/components/leaf.dart';
import 'package:ceFlutter/components/node.dart';

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


// XXX Split this into services dir, break utils into widgets and appstate.  This update doesn't belong here.
// XXX this could easily be made iterative

// Categories: Software Contributions: codeEquity web front end: Planned: unassigned:
// header      alloc                   sub alloc                 plan
buildAllocationTree( context, container ) {
   print( "Build allocation tree" );
   final appState  = container.state;
   final width = appState.screenWidth * .6;

   appState.allocTree = Node( "Category    Alloc / Plan / Accr", 0, null, width, true );

   for( var alloc in appState.myPEQSummary.allocations ) {

      Tree curNode = appState.allocTree;

      // when allocs are created, they are leaves.
      // down the road, they become nodes
      for( int i = 0; i < alloc.category.length; i++ ) {

         print( "working on " + alloc.category.toString() + " : " + alloc.category[i] );

         bool lastCat = false;
         if( i == alloc.category.length - 1 ) { lastCat = true; }
         Tree childNode = curNode.findNode( alloc.category[i] );

         if( childNode is Leaf && !lastCat ) {
            // allocation leaf, convert to a node to accomodate plan/accrue
            print( "... leaf in middle - convert" );
            curNode = (curNode as Node).convertToNode( childNode );
         }
         else if( childNode == null ) {
            if( !lastCat ) {
               print( "... nothing - add node" );
               Node tmpNode = Node( alloc.category[i], 0, null, width );
               (curNode as Node).addLeaf( tmpNode );
               curNode = tmpNode;
            }
            else {
               print( "... nothing found, last cat, add leaf" );
               // leaf.  amounts stay at leaves
               int allocAmount  = ( alloc.allocType == PeqType.allocation ? alloc.amount : 0 );
               int planAmount   = ( alloc.allocType == PeqType.plan       ? alloc.amount : 0 );
               int accrueAmount = ( alloc.allocType == PeqType.grant      ? alloc.amount : 0 );
               Leaf tmpLeaf = Leaf( alloc.category[i], allocAmount, planAmount, accrueAmount, null, width ); 
               (curNode as Node).addLeaf( tmpLeaf );
            }
         }
         else if( childNode is Node ) {
            if( !lastCat ) {
               print( "... found - move on" );
               curNode = childNode;
            }
            else {
               print( "... alloc adding into existing chain" );
               assert( alloc.allocType == PeqType.allocation );
               (childNode as Node).addAlloc( alloc.amount );
            }
         }
         else {
            print( "XXXXXXXXXXXXXXXX BAD" );
            print( "XXXXXXXXXXXXXXXX BOOBOO" );
            print( "XXXXXXXXXXXXXXXX BABY" );
         }
      }
   }
   // print( appState.allocTree.toStr() );
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

      if( appState.myPEQSummary != null ) { buildAllocationTree( context, container ); }
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
   await updateDynamo( context, container, '{ "Endpoint": "UpdatePEQ", "PEQId": "${peq.id}", "CEHolderId": $ceHolders }', "updatePEQ" );
}

// XXX this may need updating if allow 1:many ce/gh association.  maybe limit ce login to 1:1 - pick before see stuff.
void processPEQAction( PEQAction pact, PEQ peq, context, container ) async {
   print( "processing " + enumToStr(pact.verb) + " act " + enumToStr(pact.action) + " type " + enumToStr(peq.peqType) + " for " + peq.amount.toString() );
   final appState  = container.state;

   // Wait here, else summary may be inaccurate
   await updateCEUID( pact, peq, context, container );

   if( pact.action == PActAction.notice ) {
      print( "Peq Action is a notice event: " + pact.subject.toString() );
      print( "updated CEUID if available - no other action needed." );
   }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.add ) {

      // Create, if need to
      if( appState.myPEQSummary == null ) {
         print( "Create new appstate PSum" );
         String pid = randomAlpha(10);
         appState.myPEQSummary = new PEQSummary( id: pid, ghRepo: peq.ghRepo,
                                                 targetType: "repo", targetId: peq.ghProjectId, lastMod: getToday(), allocations: [] );
      }
         
      if( peq.peqType == PeqType.allocation ) {

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
            List<String> sub = new List<String>.from( peq.ghProjectSub );
            String pt = peq.ghIssueTitle;
            // some (not all) allocations are tied to full projects
            if( pt.length > 6 && pt.substring( 0,5 ) == "Sub: " ) { pt = pt.substring( 5 ); }
            sub.add( pt );
            Allocation alloc = new Allocation( category: sub, amount: peq.amount, allocType: PeqType.allocation,
                                               ceUID: EMPTY, ghUserName: EMPTY, vestedPerc: 0.0, notes: "" );
            appState.myPEQSummary.allocations.add( alloc );
         }

      }
      else if( peq.peqType == PeqType.plan ) {
         print( "Plan PEQ" );

         List<String> sub = new List<String>.from( peq.ghProjectSub );
         sub.add( "Planned" );
         
         // Use gh names instead of ce ids - user comfort
         List<String> assignees = peq.ghHolderId;
         if( assignees.length == 0 ) { assignees = [ "Unassigned" ]; }
         int splitAmount = (peq.amount / assignees.length).floor();

         // iterate over assignees
         for( var assignee in assignees ) {
            var updated = false;
            print( "\n Assignee: " + assignee );
            List<String> suba = new List<String>.from( sub );
            suba.add( assignee );

            print( "..... sub: " +  sub.toString() );
            print( "..... suba: " + suba.toString() );
            
            // Update, if already in place
            for( var alloc in appState.myPEQSummary.allocations ) {
               print( "Checking for match: " + suba.toString() + " " + alloc.category.toString() );
               if( suba.toString() == alloc.category.toString() ) {
                  updated = true;
                  print( "Matched category!" );
                  alloc.amount = alloc.amount + splitAmount;
                  break;
               }
            }
            
            // Create allocs, if not already updated.. 1 per assignee
            if( !updated ) {
               print( "Adding new allocation" );
               Allocation alloc = new Allocation( category: suba, amount: splitAmount, allocType: PeqType.plan,
                                                  ceUID: EMPTY, ghUserName: assignee, vestedPerc: 0.0, notes: "" );
               appState.myPEQSummary.allocations.add( alloc );
            }
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

   for( var pact in todoPActions ) {
      print( pact.toString() );
      assert( !pact.ingested );

      if( pact.action != PActAction.relocate && pact.action != PActAction.change ) {
         if( pact.action == PActAction.notice ) {
            assert( pact.subject.length == 2 );
         }
         else {
            assert( pact.subject.length == 1 );
         }
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
   List<Tuple2<PEQAction, PEQ>> todos = new List<Tuple2<PEQAction, PEQ>>();
   for( var i = 0; i < todoPActions.length; i++ ) {
      assert( pactIds[i] == todoPActions[i].id );
      assert( peqIds[i]  == todoPeqs[i].id );
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
