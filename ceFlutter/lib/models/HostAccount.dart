import 'package:flutter/material.dart';

import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/CEVenture.dart';
import 'package:ceFlutter/models/HostUser.dart';

// Combines dynamo:CEHostUser with dynamo:CEProjects
class HostAccount {
   final HostUser hostUser;
   final Map<String, List<String>> ceProjRepos;   // ceProjectId to list of host repos


   HostAccount({required this.hostUser, required this.ceProjRepos});

   // Will be going up to dynamo
   dynamic toJson() {
      return hostUser.toJson(); 
   }

   factory HostAccount.fromJson(Map<String, dynamic> json) {

      var dynamicCEPs  = json['ceProjects'];
      Map<String, List<String>> cepRepos = {};

      // ceProjects are full ceProject tables from aws for each ceProjectId.  We just need the corresponding repos.
      List<dynamic> ceProjects = new List<dynamic>.from( dynamicCEPs );
      for( var dynamicCEP in ceProjects ) {

         if( dynamicCEP["HostParts"] != null ) {
            List<dynamic> repos = new List<dynamic>.from( dynamicCEP["HostParts"]["hostRepositories"] );
            cepRepos[ dynamicCEP["CEProjectId"] ] = [];
            for( var repo in repos ) {
               cepRepos[ dynamicCEP["CEProjectId"] ]!.add( repo["repoName"] ?? "" ); 
            }
         }
      }

      return HostAccount(
         hostUser:    HostUser.fromJson( json ),
         ceProjRepos: cepRepos
         );
   }

   String get hostPlatform     => hostUser.hostPlatform;
   String get hostUserName     => hostUser.hostUserName;
   String get ceUserId         => hostUser.ceUserId;
   String get hostUserId       => hostUser.hostUserId;

   List<String> get ceProjectIds     => hostUser.ceProjectIds;
   List<String> get futureCEProjects => hostUser.futureCEProjects;
   
   List<CEVenture> getVentures( appState ) { return hostUser.getVentures( appState );  }
   
   List<CEProject> getCEPsPerVenture( appState, String cevId ) { return hostUser.getCEPsPerVenture( appState, cevId ); }

   String toString() {
      String res = hostUser.toString();
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
