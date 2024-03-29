import 'package:flutter/material.dart';

// Combines dynamo:CEHostUser with dynamo:CEProjects
class HostAccount {
   String         hostPlatform;
   String         hostUserName;
   String         ceUserId;
   final String   hostUserId;
   List<String>   ceProjectIds;
   List<String>   futureCEProjects;
   Map<String, List<String>> ceProjRepos;

   HostAccount({required this.hostPlatform, required this.hostUserName, required this.ceUserId, required this.hostUserId,
            required this.ceProjectIds, required this.futureCEProjects, required this.ceProjRepos});

   // Will be going up to dynamo
   dynamic toJson() {
      return { 'hostPlatform': hostPlatform, 'hostUserId': hostUserId, 'ceUserId': ceUserId, 'hostUserName': hostUserName,
            'ceProjectIds': ceProjectIds, 'futureCEProjects': futureCEProjects };
   }

   factory HostAccount.fromJson(Map<String, dynamic> json) {

      print( "in fromJson" );
      var dynamicProjs = json['CEProjectIds'];
      var dynamicFuts  = json['FutureCEProjects'];
      var dynamicCEPs  = json['ceProjects'];

      Map<String, List<String>> cepRepos = {};

      // ceProjects are full ceProject tables from aws for each ceProjectId.  We just need the corresponding repos.
      List<dynamic> ceProjects = new List<dynamic>.from( dynamicCEPs );
      for( var dynamicCEP in ceProjects ) {

         List<dynamic> repos = new List<dynamic>.from( dynamicCEP["HostParts"]["hostRepositories"] );
         cepRepos[ dynamicCEP["CEProjectId"] ] = [];
         for( var repo in repos ) {
            cepRepos[ dynamicCEP["CEProjectId"] ]!.add( repo["repoName"] ?? "" ); 
         }
         

      }
      
      return HostAccount(
         hostPlatform:     json['HostPlatform'], 
         hostUserName:     json['HostUserName'],
         ceUserId:         json['CEUserId'],
         hostUserId:       json['HostUserId'], 
         ceProjectIds:     new List<String>.from( dynamicProjs ),
         futureCEProjects: new List<String>.from( dynamicFuts ),
         ceProjRepos:      cepRepos
         );
   }

   String toString() {
      String res = "\nHost user : " + hostUserName + " CE user id: " + ceUserId + " ceProjectIds: ";
      for( var cepId in ceProjectIds ) {
         res += "\nCEProject: " + cepId;
         var first = true;
         if( ceProjRepos != null ) {
            for( var repo in ceProjRepos[ cepId ] ?? [] ) {
               if( first ) { res += "\n   "; first = false; }
               res += repo + " ";
            }
         }
      }

      return res;
   }
}
