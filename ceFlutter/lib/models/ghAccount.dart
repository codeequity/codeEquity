import 'package:flutter/material.dart';

class GHAccount {
   final String id;
   String       ceOwnerId;
   String       ghUserName;
   List<String> repos;       // note repos may be ghUserName/repo or <someOtherUser>/repo
   List<bool>?  ceProject;   // XXX no longer 1:1 with repos.  NOTE: this is set in utils_load:reloadMyProjects from awsDynamo on fetch.

   GHAccount({required this.id, required this.ceOwnerId, required this.ghUserName, required this.repos, this.ceProject});
   
   dynamic toJson() {
      return { 'id': id, 'ceOwnerId': ceOwnerId, 'ghUserName': ghUserName, 'repos': repos, 'ceProjs': ceProject };
   }

   factory GHAccount.fromJson(Map<String, dynamic> json) {

      print( "in fromJson" );
      var dynamicRepos = json['Repos'];
      var dynamicProjs = json['ceProjs'].map((ceProj) => ceProj == "true" ? true : false );  // listDynamic -> mappedIterable
      
      return GHAccount(
         id:          json['GHAccountId'], 
         ceOwnerId:   json['CEOwnerId'],
         ghUserName:  json['GHUserName'],
         repos:       new List<String>.from(dynamicRepos),
         ceProject:   new List<bool>.from( dynamicProjs )
         );
   }

   String toString() {
      ghUserName = ghUserName;
      repos      = repos;

      String res = "\nGH user : " + ghUserName + " CE owner id: " + ceOwnerId + " repos: ";
      repos.forEach((repo) => res += " " + repo );
      if( ceProject != null ) {
         ceProject!.forEach((ceProj) => res += " " + ceProj.toString() );
      }

      return res;
   }
}
