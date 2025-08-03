import 'dart:convert';  // json encode/decode
import 'dart:async';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:collection/collection.dart';  // firstWhereOrNull

// This package is currently used only for authorization.  Github has deprecated username/passwd auth, so
// authentication is done by personal access token.  The user model and repo service in this package are too
// narrowly limited - not allowing access to user subscriptions, just user-owned repos.  So, auth-only.
// https://github.com/SpinlockLabs/github.dart/blob/master/lib/src/common/repos_service.dart
import 'package:github/github.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/awsUtils.dart';    // fetchPAT
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/HostAccount.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/HostLoc.dart';

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
   
   String host  = cep.hostPlatform;
   assert( host == "GitHub" );
   
   var postData = '{"Endpoint": "ceMD", "Request": "getBuilderPAT", "host": "$host" }';
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
   print( cep.repositories.toString() );
   var postData = '{"Endpoint": "ceMD", "Request": "getHPeqs", "PAT": "$builderPAT", "cepId": "$cepId" }'; 
   var response = await postCE( appState, postData );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return hostPeqs;
   }

   final peqs = json.decode( utf8.decode( response.bodyBytes ));

   for( final peq in peqs ) {

      var dynamicHHId = new List<String>.from( peq['hostHolderId'] );
      var dynamicHPS  = new List<String>.from( peq['hostProjectSub'] );
      var peqType     = enumFromStr<PeqType>( peq['peqType'], PeqType.values );
      
      // print( "WORKING " + peq.toString() + dynamicHHId.toString() );
      
      hostPeqs.add( new PEQ( id: "", ceProjectId: cepId, ceHolderId: [], hostHolderId: dynamicHHId,
                              ceGrantorId: "", hostProjectSub: dynamicHPS, amount: peq['amount'],
                              vestedPerc: 0.0, accrualDate: "", peqType: peqType, hostIssueTitle: peq['hostIssueTitle'],
                              hostIssueId: peq['hostIssueId'], hostRepoId: peq['hostRepoId'], active: true ) );
   }
   
   return hostPeqs;
}

Future<List<HostLoc>> getGHLocs( container, CEProject cep, String ghProjectId ) async {
   final appState  = container.state;
   List<HostLoc> hostLocs = [];

   final builderPAT = await getHostPAT( container, cep );
   if( builderPAT == "" ) { return hostLocs; }
   
   var postData = '{"Endpoint": "ceMD", "Request": "getHLocs", "PAT": "$builderPAT", "pid": "$ghProjectId" }'; 
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
   
   var postData = '{"Endpoint": "ceMD", "Request": "getHAssigns", "PAT": "$builderPAT", "rid": "$repoId" }'; 
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
   
   var postData = '{"Endpoint": "ceMD", "Request": "getHLabels", "PAT": "$builderPAT", "rid": "$repoId" }'; 
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
   
   var postData = '{"Endpoint": "ceMD", "Request": "createHLabel", "PAT": "$builderPAT", "rid": "$repoId", "peqVal": "$peqVal" }'; 
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

   // XXX wild goose chase.  this is cleaner, and should now work.
   // var postData = {"Endpoint": "ceMD", "Request": "createHIssue", "PAT": "$builderPAT", "rid": "$repoId", "projId": "$projId", "newIss": newIssue }; 

   var title  = newIssue['title'];
   var lab    = newIssue['labels'];
   var assign = newIssue['assignees'];
   var postData = {"Endpoint": "ceMD", "Request": "createHIssue", "PAT": "$builderPAT", "rid": "$repoId", "projId": "$projId",
         "issTitle": "$title", "issLabels": lab, "issAssign": assign};
   
   // var response = await postCE( appState, json.encode( postData ) );
   var response = await postCE( appState, json.encode( postData ) );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return issDat;
   }

   var issue = json.decode( utf8.decode( response.bodyBytes ));
   print( "New host issue " + issue.toString() );
   
   if( issue.length == 3 ) {
      issDat.add( issue[0] is String ? issue[0] as String  : -1);
      issDat.add( issue[1] is String ? issue[1] as String  : -1);
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
   
   var postData = '{"Endpoint": "ceMD", "Request": "moveHCard", "PAT": "$builderPAT", "pid": "$projId", "cid": "$cardId", "util": "$hostUtil", "colId": "$colId" }'; 
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
   
   var postData = '{"Endpoint": "ceMD", "Request": "remHIssue", "PAT": "$builderPAT", "iid": "$hostIssueId" }'; 
   var response = await postCE( appState, postData );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return false;
   }

   return true;
}

Future<bool> closeGHIssue( container, CEProject cep, String hostIssueId ) async {
   final appState  = container.state;

   final builderPAT = await getHostPAT( container, cep );
   if( builderPAT == "" ) { return false; }
   
   var postData = '{"Endpoint": "ceMD", "Request": "closeHIssue", "PAT": "$builderPAT", "iid": "$hostIssueId" }'; 
   var response = await postCE( appState, postData );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      return false;
   }

   return true;
}

// hostLabels are repoId to list of label objects
Future<void> makeHostIssue( context, container, cep, PEQ p, List<HostLoc> ghLocs, Map<String, List<dynamic>> hostLabels ) async {

   // 1) deleteIssue with same issueId or issueTitle in same project
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
   // createdIssue[1] or hostIssueNum is not interesting
   assert( createdIssue[2] is String );  // hostCardId
   
   // 3) move it to the right spot, then close it if needed.  createdIssue is in the host project, but not the correct column.
   // No need to wait for either
   moveGHCard( container, cep, pLoc[0], createdIssue[2] );

   if( p.peqType == PeqType.pending || p.peqType == PeqType.grant ) { closeGHIssue( container, cep, createdIssue[0] ); }
   
   // 4) update source with new hostIssueId
   // no need to wait
   var pLink = { "PEQId": p.id, "HostIssueId": createdIssue[0] };
   updateDynamo( context, container, json.encode( { "Endpoint": "UpdatePEQ", "pLink": pLink }), "UpdatePEQ" ) ;
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

// Called when click on assocGH, or refresh projects buttons.
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
   
   // XXX Chck if have U_*  if so, has been active on GH, right?
   // Do not have, can not get, the U_* user id from GH.  initially use login.
   if( appState.ceUserId == "" ) { appState.ceUserId = await fetchString( context, container, '{ "Endpoint": "GetID" }', "GetID" ); }
   String huid = await _getOwnerId( PAT, hostLogin );
   print( "HOI! " + appState.ceUserId + " " + huid );
   assert( huid != "-1" );
   HostAccount myHostAcct = new HostAccount( hostPlatform: "GitHub", hostUserName: hostLogin, ceUserId: appState.ceUserId, hostUserId: huid, 
                                             ceProjectIds: ceProjs, futureCEProjects: futProjs, ceProjRepos: ceProjRepos );
   
   String newHostA = json.encode( myHostAcct );
   print( newHostA );
   String postData = '{ "Endpoint": "PutHostA", "NewHostA": $newHostA, "udpate": "false", "pat": "$PAT" }';
   await updateDynamo( context, container, postData, "PutHostA" );
}


// Called upon refreshProjects button press.. maybe someday on signin (via app_state_container:finalizeUser)
// XXX This needs to check if PAT is known, query.
// XXX update docs, pat-related
Future<void> updateGHRepos( context, container ) async {
   final appState  = container.state;
   
   // Iterate over all known HostAccounts.  One per host.
   for( HostAccount acct in appState.myHostAccounts ) {

      if( acct.hostPlatform == "GitHub" ) {

         // XXX
         print( "XXX XXX Not yet storing PAT.  Not yet decided.  Skip" );
         /*
         // Each hostUser (acct.hostUserName) has a unique PAT.  read from dynamo here, don't want to hold on to it.
         var pd = { "Endpoint": "GetEntry", "tableName": "CEHostUser", "query": { "HostUserName": acct.hostUserName, "HostPlatform": "GitHub" } };
         final PAT = await fetchPAT( context, container, json.encode( pd ), "GetEntry" );

         print( "UpdateGHRepo has PAT " + PAT.toString() );
         
         var github = await GitHub(auth: Authentication.withToken( PAT ));
         await github.users.getCurrentUser().then((final CurrentUser user) { assert( user.login == acct.hostUserName ); })
            .catchError((e) {
                  print( "Could not validate github acct." + e.toString() + " " + PAT + " " + acct.hostUserName );
                  showToast( "Github validation failed.  Please try again." );
               });
         
         await _buildCEProjectRepos( context, container, PAT, github, acct.hostUserName );
         */
      }
   }

   await initMDState( context, container );
   // appState.myHostAccounts = await fetchHostAcct( context, container, '{ "Endpoint": "GetHostA", "CEUserId": "${appState.ceUserId}"  }' );
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
         // appState.myHostAccounts = await fetchHostAcct( context, container, '{ "Endpoint": "GetHostA", "CEUserId": "${appState.ceUserId}"  }' );
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
 
