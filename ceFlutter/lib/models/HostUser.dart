import 'package:flutter/material.dart';

import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/CEVenture.dart';

// Combines dynamo:CEHostUser with dynamo:CEProjects
class HostUser {
   final String   hostPlatform;
   final String   hostUserName;
   final String   ceUserId;
   final String   hostUserId;
   List<String>   ceProjectIds;
   List<String> futureCEProjects;           // list of host repos not yet part of CE
   Map<String, List<String>>? vToc;         // TRANSIENT.  VentureId to ProjId, built during first homepage view

   HostUser({required this.hostPlatform, required this.hostUserName, required this.ceUserId, required this.hostUserId,
            required this.ceProjectIds, required this.futureCEProjects, this.vToc})
   {
      if( vToc == null ) { this.vToc = {}; }
   }

   // Will be going up to dynamo
   dynamic toJson() {
      return { 'hostPlatform': hostPlatform, 'hostUserId': hostUserId, 'ceUserId': ceUserId, 'hostUserName': hostUserName,
            'ceProjectIds': ceProjectIds, 'futureCEProjects': futureCEProjects };
   }

   factory HostUser.fromJson(Map<String, dynamic> json) {

      var dynamicProjs = json['CEProjectIds'];
      var dynamicFuts  = json['FutureCEProjects'];

      return HostUser(
         hostPlatform:     json['HostPlatform'], 
         hostUserName:     json['HostUserName'],
         ceUserId:         json['CEUserId'],
         hostUserId:       json['HostUserId'], 
         ceProjectIds:     new List<String>.from( dynamicProjs ),
         futureCEProjects: new List<String>.from( dynamicFuts ),
         vToc:             {}
         );
   }

   List<CEVenture> getVentures( appState ) {
      assert( vToc != null );
      for( final cepId in ceProjectIds ) {
         CEProject cep = appState.ceProject[ cepId ] ?? CEProject.empty();
         if( vToc![ cep.ceVentureId ] == null )            { vToc![ cep.ceVentureId ] = []; }
         if( !vToc![ cep.ceVentureId ]!.contains( cepId ) ) { vToc![ cep.ceVentureId ]!.add( cepId ); }
      }
      List<CEVenture> res = [];
      for( String vid in vToc!.keys ) {
         res.add( appState.ceVenture[ vid ]); 
      }
      return res;
   }
   
   List<CEProject> getCEPsPerVenture( appState, String cevId ) {
      assert( vToc != null );

      List<CEProject> res = [];
      for( String cid in ( vToc![cevId] ?? [] ) ) {
         res.add( appState.ceProject[ cid ]); 
      }
      return res;
   }

   String toString() {
      String res = "\nHost user : " + hostUserName + " CE user id: " + ceUserId + " ceProjectIds: ";
      for( var cepId in ceProjectIds ) {
         res += "\nCEProject: " + cepId;
         var first = true;
      }

      return res;
   }
}
