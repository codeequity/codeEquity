import 'package:flutter/material.dart';

class GHAccount {
   final String id;
   String       ceOwnerId;
   String       ghUserName;
   List<String> repos;       // note repos may be ghUserName/repo or <someOtherUser>/repo

   GHAccount({this.id, this.ceOwnerId, this.ghUserName, this.repos});
   
   dynamic toJson() {
      return { 'id': id, 'ceOwnerId': ceOwnerId, 'ghUserName': ghUserName, 'repos': repos };
   }

   factory GHAccount.fromJson(Map<String, dynamic> json) {

      print( "in fromJson" );
      var dynamicRepos = json['Repos'];
      
      return GHAccount(
         id:          json['GHAccountId'], 
         ceOwnerId:   json['CEOwnerId'],
         ghUserName:  json['GHUserName'],
         repos:       new List<String>.from(dynamicRepos)
         );
   }

   String toString() {
      ghUserName = ghUserName ?? "";
      repos      = repos ?? [];

      String res = "\nGH user : " + ghUserName + " CE owner id: " + ceOwnerId + " repos: ";
      repos.forEach((repo) => res += " " + repo );

      return res;
   }
}
