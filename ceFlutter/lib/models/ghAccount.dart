import 'package:flutter/material.dart';

class GHAccount {
   final String id;
   String       ceOwnerId;
   String       ghLogin;
   List<String> repos;       // note repos may be ghLogin/repo or <someOtherUser>/repo

   GHAccount({this.id, this.ceOwnerId, this.ghLogin, this.repos});
   
   dynamic toJson() {
      return { 'id': id, 'ceOwnerId': ceOwnerId, 'ghLogin': ghLogin, 'repos': repos };
   }

   factory GHAccount.fromJson(Map<String, dynamic> json) {

      print( "in fromJson" );
      var dynamicRepos = json['Repos'];
      
      return GHAccount(
         id:          json['GHAccountId'], 
         ceOwnerId:   json['CEOwnerId'],
         ghLogin:     json['GHLogin'],
         repos:       new List<String>.from(dynamicRepos)
         );
   }

   String toString() {
      ghLogin = ghLogin ?? "";
      repos      = repos ?? [];

      String res = "\nGH user : " + ghLogin + " CE owner id: " + ceOwnerId + " repos: ";
      repos.forEach((repo) => res += " " + repo );

      return res;
   }
}
