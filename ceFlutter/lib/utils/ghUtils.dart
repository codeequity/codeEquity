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
import 'package:ceFlutter/utils/awsUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/HostAccount.dart';

// XXX strip context, container where not needed


// Post request to GitHub
Future<http.Response> postGH( PAT, postData, name ) async {
   // print( "XXX Warning.  postGH fired. " + postData + " " + name );

   final gatewayURL = Uri.parse( 'https://api.github.com/graphql' );
   
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

// XXX GitHub-specific.  Rename.
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

// XXX GitHub-specific.  Rename
// Called upon refresh.. maybe someday on signin (via app_state_container:finalizeUser)
// XXX This needs to check if PAT is known, query.
// XXX update docs, pat-related
Future<void> updateProjects( context, container ) async {
   final appState  = container.state;
   
   // Iterate over all known HostAccounts.  One per host.
   for( HostAccount acct in appState.myHostAccounts ) {

      if( acct.hostPlatform == "GitHub" ) {
      
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
