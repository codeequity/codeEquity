import 'dart:convert';  // json encode/decode
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';

import 'package:http/http.dart' as http;
import 'package:collection/collection.dart';  // firstWhereOrNull

import 'package:ceFlutter/screens/project_page.dart';
import 'package:ceFlutter/screens/add_host_page.dart';

// This package is currently used only for authorization.  Github has deprecated username/passwd auth, so
// authentication is done by personal access token.  The user model and repo service in this package are too
// narrowly limited - not allowing access to user subscriptions, just user-owned repos.  So, auth-only.
// https://github.com/SpinlockLabs/github.dart/blob/master/lib/src/common/repos_service.dart
import 'package:github/github.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/awsUtils.dart';    // fetchPAT
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/HostUser.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/HostLoc.dart';


class GHVals {
   // project profile related data
   static const List<String> _profHeader        = ["Host platform", "Owner category", "Host project management version", "Organization name on host"];
   static const List<bool>   _profDD            = [ true,           true,             true,                              false ];
   static const List<List<String>> _profOptions = [["GitHub"],
                                                   ["Organization", "Individual"],
                                                   ["GH Version 2", "GH Classic" ],
                                                   [ ] ];
   static const List<String> _profCurVals       = ["", "", "", ""];
   static const List<String> _profToolTips      = ["CodeEquity is working to expand to other hosting platforms",
                                                   "Individual owners are no longer fully supported on GitHub, nor on CodeEquity",
                                                   "GH Classic is legacy on GitHub, no longer supported on CodeEquity",
                                                   "Enter the name of the host organization that owns your code repositories" ];

   static List<String>       get profHeader   => _profHeader;
   static List<bool>         get profDD       => _profDD;
   static List<List<String>> get profOptions  => _profOptions;
   static List<String>       get profCurVals  => _profCurVals;
   static List<String>       get profToolTips => _profToolTips;
}                                  


// Post request to GitHub
Future<http.Response> _postGH( PAT, postData, name ) async {
   // print( "Warning.  postGH fired. " + postData + " " + name );

   // final gatewayURL = Uri.parse( 'https://api.github.com/graphql' );
   final gatewayURL = Uri.parse( "https://api.github.com/graphql" );
                                                               
   // Accept header is for label 'preview'.
   // next global id is to avoid getting old IDs that don't work in subsequent GQL queries.
   final response =
      await http.post(
         gatewayURL,
         headers: {'Authorization': 'bearer ' + PAT, 'Accept': "application/vnd.github.bane-preview+json", 'X-Github-Next-Global-ID': '1' },
         body: postData
         );

   if (response.statusCode != 201 && response.statusCode != 204) { print( "Error.  GH post error " + name + " " + postData ); }
   
   return response;
}

Future<String> getHostPAT( container, CEProject cep ) async {
   final appState  = container.state;
   if( appState.myGHPAT != "" ) { return appState.myGHPAT; }
   
   HostPlatforms host  = cep.hostPlatform;
   assert( host == HostPlatforms.GitHub );
   String hp = enumToStr( host );
   
   var postData = '{"Endpoint": "ceMD", "Request": "getBuilderPAT", "host": "$hp" }';
   var response = await postCE( appState, postData );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return "";
   }
   final builderPAT = json.decode( utf8.decode( response.bodyBytes ));
   appState.myGHPAT = builderPAT;

   return builderPAT;
}

Future<List<PEQ>> updateGHPeqs( container, CEProject cep ) async {
   final appState  = container.state;
   List<PEQ> hostPeqs = [];

   String cepId = cep.ceProjectId; 
   
   final builderPAT = await getHostPAT( container, cep );
   if( builderPAT == "" ) { return hostPeqs; }
   
   // Have cep, gives me repo name per cepId,  have hostOrg.
   // print( cep.repositories.toString() );
   var postData = '{"Endpoint": "ceMD", "Request": "getPeqs", "PAT": "$builderPAT", "cepId": "$cepId" }'; 
   var response = await postCE( appState, postData );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return hostPeqs;
   }

   final peqs = await json.decode( utf8.decode( response.bodyBytes ));
   print( " .. updateGHPeqs decoding " + peqs.length.toString() + " peqs ");

   for( final peq in peqs ) {

      var dynamicHHId = new List<String>.from( peq['hostHolderId'] );
      var dynamicHPS  = new List<String>.from( peq['hostProjectSub'] );
      var peqType     = enumFromStr<PeqType>( peq['peqType'], PeqType.values );

      // PEQs coming from GH will not have ceHolderIds.  Find and add if possible.
      List<String> ceuids = [];
      for( String hhid in dynamicHHId ) {
         if( appState.idMapHost.containsKey( hhid ) ) {
            assert( appState.idMapHost[hhid].containsKey( "ceUID" ));
            ceuids.add( appState.idMapHost[hhid]!["ceUID"]! );
         }
      }
      
      // print( "WORKING " + peq.toString() + dynamicHHId.toString() );
      
      hostPeqs.add( new PEQ( id: "", ceProjectId: cepId, ceHolderId: ceuids, hostHolderId: dynamicHHId,
                              ceGrantorId: "", hostProjectSub: dynamicHPS, amount: peq['amount'],
                              vestedPerc: 0.0, accrualDate: "", peqType: peqType, hostIssueTitle: peq['hostIssueTitle'],
                              hostIssueId: peq['hostIssueId'], hostRepoId: peq['hostRepoId'], active: true ) );
   }
   // XXX XXX
   if( peqs.length > 50 ) { print( "Loaded: " + hostPeqs.toString() ); }
   
   return hostPeqs;
}

Future<List<HostLoc>> getGHLocs( container, CEProject cep, String ghProjectId ) async {
   final appState  = container.state;
   List<HostLoc> hostLocs = [];

   final builderPAT = await getHostPAT( container, cep );
   if( builderPAT == "" ) { return hostLocs; }
   
   var postData = '{"Endpoint": "ceMD", "Request": "getLocs", "PAT": "$builderPAT", "pid": "$ghProjectId" }'; 
   var response = await postCE( appState, postData );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return hostLocs;
   }

   Iterable locs = json.decode( utf8.decode( response.bodyBytes ));
   locs.forEach( (l) {
         l["ceProjectId"] = cep.ceProjectId;
         l["active"]      = "true";
      });
   
   hostLocs = locs.map( (l) => HostLoc.fromJson( l ) ).toList();
   
   return hostLocs;
}

Future<List<String>> getGHAssignees( container, CEProject cep, String repoId ) async {
   final appState  = container.state;
   List<String> assigneeIds = [];

   final builderPAT = await getHostPAT( container, cep );
   if( builderPAT == "" ) { return assigneeIds; }
   
   var postData = '{"Endpoint": "ceMD", "Request": "getAssigns", "PAT": "$builderPAT", "rid": "$repoId" }'; 
   var response = await postCE( appState, postData );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return assigneeIds;
   }

   Iterable assigns = json.decode( utf8.decode( response.bodyBytes ));
   assigneeIds = assigns.map( (a) => a.toString() ).toList();
   
   return assigneeIds;
}

// Get peq label values  [ [val, id], ..]
// Host labels need not be ceMD data type
Future< List<List<dynamic>> > getGHLabels( container, CEProject cep, String repoId ) async {
   final appState  = container.state;
   List<List<dynamic>> labelVals = [];

   final builderPAT = await getHostPAT( container, cep );
   if( builderPAT == "" ) { return labelVals; }
   
   var postData = '{"Endpoint": "ceMD", "Request": "getLabels", "PAT": "$builderPAT", "rid": "$repoId" }'; 
   var response = await postCE( appState, postData );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return labelVals;
   }

   var labs = json.decode( utf8.decode( response.bodyBytes ));
   if( labs != -1 ) {
      // print( labs.toString() );
      // labelVals = labs.map( (a) => a as int ).toList();
      // labelVals = List<int>.from( labs );
      for( var lab in labs ) {
         List<dynamic> l = [];
         l.add( lab[0] as int );
         l.add( lab[1] as String );
         labelVals.add( l );
      }
   }
   
   return labelVals;
}

// create peq label
Future<bool> createGHLabel( container, CEProject cep, String repoId, int peqVal ) async {
   final appState  = container.state;

   final builderPAT = await getHostPAT( container, cep );
   if( builderPAT == "" ) { return false; }
   
   var postData = '{"Endpoint": "ceMD", "Request": "createLabel", "PAT": "$builderPAT", "rid": "$repoId", "peqVal": "$peqVal" }'; 
   var response = await postCE( appState, postData );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return false;
   }

   return true;
}

// create GH issue
Future<List<dynamic>> createGHIssue( container, CEProject cep, String repoId, String projId, newIssue ) async {
   final appState  = container.state;
   List<dynamic> issDat = [];
   
   final builderPAT = await getHostPAT( container, cep );
   if( builderPAT == "" ) { return issDat; }

   var title  = newIssue['title'];
   var lab    = newIssue['labels'];
   var assign = newIssue['assignees'];
   var postData = {"Endpoint": "ceMD", "Request": "createIssue", "PAT": "$builderPAT", "rid": "$repoId", "projId": "$projId",
         "issTitle": "$title", "issLabels": lab, "issAssign": assign};
   
   var response = await postCE( appState, json.encode( postData ) );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return issDat;
   }

   var issue = json.decode( utf8.decode( response.bodyBytes ));
   // print( "New host issue " + issue.toString() );
   
   if( issue.length == 3 ) {
      issDat.add( issue[0] is String ? issue[0] as String  : -1);
      issDat.add( issue[1] is int    ? issue[1].toString() : -1);
      issDat.add( issue[2] is String ? issue[2] as String  : -1);
   }

   return issDat;
}

// create peq label
Future<bool> moveGHCard( container, CEProject cep, HostLoc pLoc, String cardId ) async {
   final appState  = container.state;

   String projId   = pLoc.hostProjectId;
   String hostUtil = pLoc.hostUtility;
   String colId    = pLoc.hostColumnId;

   final builderPAT = await getHostPAT( container, cep );
   if( builderPAT == "" ) { return false; }
   
   var postData = '{"Endpoint": "ceMD", "Request": "moveCard", "PAT": "$builderPAT", "pid": "$projId", "cid": "$cardId", "util": "$hostUtil", "colId": "$colId" }'; 
   var response = await postCE( appState, postData );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return false;
   }

   return true;
}

Future<bool> remGHIssue( container, CEProject cep, String hostIssueId ) async {
   final appState  = container.state;

   final builderPAT = await getHostPAT( container, cep );
   if( builderPAT == "" ) { return false; }
   
   var postData = '{"Endpoint": "ceMD", "Request": "remIssue", "PAT": "$builderPAT", "iid": "$hostIssueId" }'; 
   var response = await postCE( appState, postData );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return false;
   }

   // Update linkage to keep ceServer in sync  
   await remLinkage( container, cep, hostIssueId );

   return true;
}

Future<bool> closeGHIssue( container, CEProject cep, String hostIssueId ) async {
   final appState  = container.state;

   final builderPAT = await getHostPAT( container, cep );
   if( builderPAT == "" ) { return false; }
   
   var postData = '{"Endpoint": "ceMD", "Request": "closeIssue", "PAT": "$builderPAT", "iid": "$hostIssueId" }'; 
   var response = await postCE( appState, postData );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return false;
   }

   return true;
}

Future<bool> remLinkage( container, CEProject cep, String issueId ) async {
   final appState  = container.state;

   var cepId = cep.ceProjectId;
   var postData = {"Endpoint": "ceMD", "Request": "removeLinkage", "ceProjId": "$cepId", "issueId": issueId }; 
   var response = await postCE( appState, json.encode( postData ));
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return false;
   }

   return true;
}

Future<bool> updateLinkage( container, CEProject cep, PEQ p, HostLoc pLoc, List<dynamic> createdIssue ) async {
   final appState  = container.state;

   print( "Update linkage with " + createdIssue.toString() );
          
   var link = {};
   link["ceProjectId"]     = cep.ceProjectId;
   link["hostRepoId"]      = p.hostRepoId;
   link["hostIssueId"]     = createdIssue[0];
   link["hostIssueNum"]    = createdIssue[1];
   link["hostProjectId"]   = pLoc.hostProjectId;
   link["hostProjectName"] = pLoc.hostProjectName;
   link["hostColumnId"]    = pLoc.hostColumnId;
   link["hostColumnName"]  = pLoc.hostColumnName;
   link["hostCardId"]      = createdIssue[2];
   link["hostIssueName"]   = p.hostIssueTitle;
   link["hostUtility"]     = pLoc.hostUtility;

   var ridx = cep.hostRepoId.indexOf( p.hostRepoId );
   link["hostRepoName"]    = cep.repositories[ ridx ];

   var cepId = cep.ceProjectId;
   var postData = {"Endpoint": "ceMD", "Request": "addLinkage", "ceProjId": "$cepId", "link": link }; 
   var response = await postCE( appState, json.encode( postData ));
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return false;
   }

   return true;
}

// hostLabels are repoId to list of label objects
Future<void> makeHostIssue( context, container, cep, PEQ p, List<HostLoc> ghLocs, Map<String, List<dynamic>> hostLabels ) async {

   // 1) deleteIssue and link with same issueId in same project
   //    XXX look for same issueTitle as well?
   await remGHIssue( container, cep, p.hostIssueId );
   print( "Deleted host issue " + p.hostIssueTitle + " (" + p.hostIssueId + ")");

   // 2) create new host Issue that matches peq
   var newIssLabel = hostLabels[p.hostRepoId]!.firstWhere( (l) => l[0] == p.amount ); 
   Map<String,dynamic> newIssue = {};
   newIssue['title']     = p.hostIssueTitle;
   newIssue['labels']    = [ newIssLabel[1] ];
   newIssue['assignees'] = p.hostHolderId;
   
   List<HostLoc> pLoc = ghLocs.where( (l) => l.ceProjectId == p.ceProjectId && l.hostProjectName == p.hostProjectSub[0] && l.hostColumnName == p.hostProjectSub[1] ).toList();
   if( pLoc.length != 1 ) {
      print( p.toString() );
      print( pLoc.toString() );
      print( ghLocs.toString() );
      assert( pLoc.length == 1 );
   }
   
   var createdIssue = await createGHIssue( container, cep, p.hostRepoId, pLoc[0].hostProjectId, newIssue );
   print( "Created issue " + createdIssue.toString() );
   assert( createdIssue.length == 3 );
   assert( createdIssue[0] is String );  // hostIssueId
   assert( createdIssue[1] is String );  // hostIssueNum
   assert( createdIssue[2] is String );  // hostCardId

   // 3) move it to the right spot, then close it if needed.  createdIssue is in the host project, but not the correct column.
   // Need to wait, else subsequent load has race condition
   await moveGHCard( container, cep, pLoc[0], createdIssue[2] );

   if( p.peqType == PeqType.pending || p.peqType == PeqType.grant ) { await closeGHIssue( container, cep, createdIssue[0] ); }

   // Update linkage to keep ceServer in sync
   await updateLinkage( container, cep, p, pLoc[0], createdIssue );
   
   // 4) update source with new hostIssueId
   var pLink = { "PEQId": p.id, "HostIssueId": createdIssue[0] };
   await updateDynamo( context, container, json.encode( { "Endpoint": "UpdatePEQ", "pLink": pLink }), "UpdatePEQ" ) ;
}


// This needs to work for both users and orgs
Future<String> _getOwnerId( PAT, owner ) async {

   Map<String, dynamic> query = {};
   query["query"]     = "query (\$login: String!) { user(login: \$login) { id } organization(login: \$login) { id } }";
   query["variables"] = {"login": owner };

   final jsonEncoder = JsonEncoder();
   final queryS = jsonEncoder.convert( query );
   print( queryS );

   var retId = "-1";

   final response = await _postGH( PAT, queryS, "getOwnerId" );
   print( response );

   final huid = json.decode( utf8.decode( response.bodyBytes ) );
   print( huid );

   if( huid.containsKey( "data" )) {
      if( huid["data"].containsKey( "user" ))              { retId = huid["data"]["user"]["id"]; }
      else if( huid["data"].containsKey( "organization" )) { retId = huid["data"]["organization"]["id"]; }
   }
   
   return retId;
}

// Called when associating a futureGHRepo with a CEProject.  Need the id, finally.  PAT exists.
// Don't do this until last moment, in case GH changes ids again.
Future<List<String>> getGHRepoIds( appState, repoNames ) async {

   // Iterate over all known HostAccounts.  One per host.
   for( HostUser acct in appState.myHostAccounts ) {

      if( acct.hostPlatform == HostPlatforms.GitHub ) {

         assert( acct.hostPAT != null );
         final PAT = acct.hostPAT!;
         
         var github = await GitHub(auth: Authentication.withToken( PAT ));
         await github.users.getCurrentUser().then((final CurrentUser user) { assert( user.login == acct.hostUserName ); })
            .catchError((e) {
                  print( "Could not validate github acct." + e.toString() + " " + PAT + " " + acct.hostUserName );
                  showToast( "Github validation failed.  Please try again." );
               });
         
         List<String> repos = [];
         var repoStream =  await github.repositories.listRepositories( type: 'all' );
         
         await for (final r in repoStream) {
            // print( 'Checking Repo: ${r.fullName} ${r.nodeId}' );
            assert( r.nodeId != null );
            if( repoNames.contains( r.fullName ) ) { repos.add( r.nodeId! ); }
         }
         return repos;
      }}
   return [];
}

Future<void> initGHRepos( context, container, CEProject cep, reposLoadedCallback ) async {
   final appState = container.state;
   assert( cep.hostPlatform == HostPlatforms.GitHub );
   final textWidth = appState.MIN_PANE_WIDTH * 0.6;

   List<String> candidate = [];

   // NOTE: having local _cancel simplifies access to context, thus calling method in buttons
   void _cancel() { Navigator.of( context ).pop( 'cancel'); }

   print( "We have ce person " + appState.ceUserId );
   HostUser? myAcct = getPlatformAccount( appState.ceHostAccounts[ appState.ceUserId ], cep.hostPlatform );

   // NOTE CELinkage is under server control.
   void _save( List<bool> on ) async {
      assert( on.length == candidate.length );
      List<String> repoNames = [];
      for( int i = 0; i < on.length; i++ ) {
         if( on[i] ) {
            print( "Adding " + candidate[i] + " to project." );
            repoNames.add( candidate[i] );
         }
      }
      if( repoNames.length == 0 ) { return; }

      // have name.. get id
      List<String> repoIds = await getGHRepoIds( appState, repoNames );
      assert( repoIds.length == repoNames.length );

      // update CEP with new repo(s).  Don't wait.
      bool added = false;
      for( int i = 0; i < repoNames.length; i++ ) { added = cep.addRepo( repoNames[i], repoIds[i] ); }
      if( added ) { writeCEProject( appState, context, container, cep ); } 

      // update hostAccount
      myAcct = getPlatformAccount( appState.ceHostAccounts[ appState.ceUserId ], cep.hostPlatform );
      assert( myAcct != null );
      for( String rn in repoNames ) {
         myAcct!.futureCEProjects.remove( rn );
      }
      String newHostA = json.encode( myAcct! );
      String postData = '{ "Endpoint": "PutHostA", "NewHostA": $newHostA, "update": "true" }';
      updateDynamo( context, container, postData, "PutHostA" ); // Don't wait
      
      // all objects created on the heap, even from within a class method
      // update appState  myHostAcct is pointer, myAcct is pointer both acting on appState.ceHostAccounts object.  CEP may have been created.
      assert( myAcct! == appState.ceHostAccounts[ appState.ceUserId ][0] );
      assert( myAcct! == appState.myHostAccounts[0] );
      appState.ceProject[ cep.ceProjectId ] = cep;
      assert( appState.ceProject[ cep.ceProjectId ] == cep );

      // Jump to equity page
      Navigator.of( context ).pop();  // save dialog
      appState.selectedCEVenture = cep.ceVentureId;
      Map<String,int> sa = {"initialPage": 2};
      MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEProjectPage(), settings: RouteSettings( arguments: sa ));
      confirmedNav( context, container, newPage );

      String msg  = "PEQs arrive with a host classification that is the host project name and column in which that issue is located.  ";
      msg        += "For example, a PEQ issue in your new repository in the Planned column of the Operations project is classified as:  ";
      msg        += "Operations:Planned:<issueName>.  You can connect host classifications to your Equity Plan by clicking on the Equity categories.";
      msg        += "Doing so can make your stats in the Peq Summary tab more informative.";
      Widget body = makeBodyText( appState, msg, appState.MIN_PANE_WIDTH, true, 6 );
      await justConfirm( context, "Connect the Equity Table and your Host Repository", msg, _cancel, body: body );
   }

   if( myAcct != null ) {
      print( "Already have Host Account.  " );

      // refresh - this will update futureCERepos - i.e. those not already part of a CEP.  
      // NOTE initRepo is only called within the context of a given CEP.  So, orgs must match.
      // NOTE GH repo names are <owner>/<name>, and organizations own repos.
      await updateGHRepos( context, container );
      if( reposLoadedCallback != null ) { reposLoadedCallback(); }

      // refresh myAcct since updateGHRepos created a new object
      myAcct = getPlatformAccount( appState.ceHostAccounts[ appState.ceUserId ], cep.hostPlatform );
      assert( myAcct != null );
      // May be simply adding a repo
      if( !myAcct!.ceProjectIds.contains( cep.ceProjectId )) { myAcct!.ceProjectIds.add( cep.ceProjectId ); }

      for( String repo in myAcct!.futureCEProjects ) {
         List<String> parts = repo.split( '/' );
         assert( parts.length == 2 );
         if( parts[0] == cep.hostOrganization ) { candidate.add( repo ); }
      }
      
      if( candidate.length == 0 ) {
         String msg = "No candidate repositories were found.  Candidates must be in the " + cep.hostOrganization + " organization, ";
         msg       += "and you must be a member of that organization with access to the candidate repository.";
         Widget body = makeBodyText( appState, msg, textWidth * 3, true, 2 );
         confirm( context, "No candidates found", msg, _cancel, _cancel, body: body );
      }
      else {
         String header = "Check the repos to add";
         await showDialog(
            context: context,
            builder: (BuildContext context) => CheckboxDialog( appState: appState, header: header, choices: candidate, saveFunc: _save, cancelFunc: _cancel ));
      }
   }
   else {
      print( "No host account yet.  add it" );
      MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEAddHostPage(), settings: RouteSettings( arguments: { "hostPlat": cep.hostPlatform } ));
      confirmedNav( context, container, newPage );
   }
   
}


Future<void> initGHProject( context, container, CEProject cep, TextEditingController cont ) async {
   void _cancel() { Navigator.of( context ).pop(); }

   List<TextEditingController?> controllers = [ null, null, null, cont ];

   void _save( List<String> saveData ) async {
      assert( controllers.length == 4 && controllers[3] != null );

      cep.hostPlatform     = enumFromStr<HostPlatforms>( saveData[0], HostPlatforms.values );
      cep.ownerCategory    = saveData[1];
      cep.projectMgmtSys   = saveData[2];
      cep.hostOrganization = controllers[3]!.text;

      String cepS = json.encode( cep );
      String postData = '{ "Endpoint": "UpdateCEP", "ceProject": $cepS }';
      await updateDynamo( context, container, postData, "UpdateCEP" );
      
      Navigator.of( context ).pop();
   }
   
   assert( cep.ceProjectId != "" );
   assert( cep.ceVentureId != "" );
   final appState = container.state;

   // Note profOptions plus controllers means every header will either be paired with a list of options, or a textEditingController
   String popupTitle = "Describe where and how your code is hosted:";
   await showDropdownDialog( context, container, popupTitle,
                             GHVals.profHeader, GHVals.profDD, GHVals.profOptions, GHVals.profCurVals, GHVals.profToolTips, controllers, _save, _cancel );   
}


// Called when click on assocGH, or refresh projects buttons.  Some calls require filtering repo by hostOrg
// Build the association between ceProjects and github repos by finding all repos on github that user has auth on,
// then associating those with known repos in aws:CEProjects.
Future<void> _buildCEProjectRepos( context, container, PAT, github, hostLogin ) async {
   final appState  = container.state;

   // Are subscriptions useful?
   // String subUrl = "https://api.github.com/users/" + patLogin + "/subscriptions";
   // repos = await getSubscriptions( container, subUrl );
   
   // GitHub does not know ceProjectId.  Get repos from GH...
   // https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-organization-repositories
   // This gets all repos the user is a member of, even if not on top list.  
   List<String> repos = [];

   var repoStream =  await github.repositories.listRepositories( type: 'all' );
   await for (final r in repoStream) {
      repos.add( r.fullName );
   }
   // print( "Found GitHub Repos " + repos.toString() );
   
   // then check which are associated with which ceProjects.  The rest are in futureProjects.
   // XXX do this on the server?  shipping all this data is not scalable
   final ceps = await fetchCEProjects( context, container );
   // print( ceps.toString() );
   
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
   
   // XXX Chck if have U_*  if so, has been active on GH, right?
   // Do not have, can not get, the U_* user id from GH.  initially use login.
   if( appState.ceUserId == "" ) { appState.ceUserId = await fetchString( context, container, '{ "Endpoint": "GetID" }', "GetID" ); }
   String huid = await _getOwnerId( PAT, hostLogin );
   print( "HOI! " + appState.ceUserId + " " + huid );
   assert( huid != "-1" );
   HostUser hostUser      = new HostUser( hostPlatform: HostPlatforms.GitHub, hostUserName: hostLogin, ceUserId: appState.ceUserId, hostUserId: huid, 
                                          hostPAT: PAT, ceProjectIds: ceProjs, futureCEProjects: futProjs );
   
   String newHostA = json.encode( hostUser );
   // print( newHostA );
   // XXX update should not always be false.  False sez this is a new addition not an update, so check peqs.
   //     but this func is called when about to add futureRepos to a new CEP - there will not be peqs at this point.
   String postData = '{ "Endpoint": "PutHostA", "NewHostA": $newHostA, "update": "false" }';
   await updateDynamo( context, container, postData, "PutHostA" );

   // Update CEMD state
   await updateHostAccts( context, container );
}


// Called upon refreshProjects button press, initRepos
// XXX update docs, pat-related
Future<void> updateGHRepos( context, container ) async {
   final appState  = container.state;
   
   // Iterate over all known HostAccounts.  One per host.
   for( HostUser acct in appState.myHostAccounts ) {

      if( acct.hostPlatform == HostPlatforms.GitHub ) {

         // Each hostUser (acct.hostUserName) has a unique PAT.  read from dynamo here
         String hp = enumToStr( HostPlatforms.GitHub );
         var pd = { "Endpoint": "GetEntry", "tableName": "CEHostUser", "query": { "HostUserName": acct.hostUserName, "HostPlatform": "$hp" } };
         final PAT = await fetchPAT( context, container, json.encode( pd ), "GetEntry" );

         // print( "UpdateGHRepo has PAT " + PAT.toString() );
         
         var github = await GitHub(auth: Authentication.withToken( PAT ));
         await github.users.getCurrentUser().then((final CurrentUser user) { assert( user.login == acct.hostUserName ); })
            .catchError((e) {
                  print( "Could not validate github acct." + e.toString() + " " + PAT + " " + acct.hostUserName );
                  showToast( "Github validation failed.  Please try again." );
               });
         
         await _buildCEProjectRepos( context, container, PAT, github, acct.hostUserName );
      }
   }

   await initMDState( context, container );
}


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
         
         await initMDState( context, container );
      }
   }
   return newAssoc;
}



// FLUTTER ROUTER   unfinished 
/*

Future<http.Response> hostGet( url ) async {

   final urlUri = Uri.parse( url );
   
   final response =
      await http.get(
         urlUri,
         headers: {HttpHeaders.contentTypeHeader: 'application/json' },
         );

   return response;
}

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

   // oi?
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
 
