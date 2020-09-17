import 'package:flutter/material.dart';

class GHAccount {
   final String id;
   String       ghUserName;
   String       ceOwnerId;
   List<String> repos;       // note repos may be ghUserName/repo or <someOtherUser>/repo

   GHAccount({this.id, this.ghUserName, this.ceOwnerId, this.repos});
   
   dynamic toJson() {
      return { 'id': id, 'ghUserName': ghUserName, 'ceOwnerId': ceOwnerId, 'repos': repos };
   }

   factory GHAccount.fromJson(Map<String, dynamic> json) {

      return GHAccount(
         id:          json['GHAccountId'],   // XXX redundant fix here, utils, saminfras
         ghUserName:  json['GHUserName'],
         ceOwnerId:   json['CEOwnerId'],
         repos:       json['Repos']
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
