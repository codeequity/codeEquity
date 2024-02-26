import 'package:flutter/material.dart';

class HostAccount {
   String         hostPlatform;
   String         hostUserName;
   String         ceUserId;
   final String   hostUserId;
   List<String>?  ceProjectIds;
   List<String>?  futureCEProjects;

   HostAccount({required this.hostPlatform, required this.hostUserName, required this.ceUserId, required this.hostUserId, this.ceProjectIds, this.futureCEProjects});
   
   dynamic toJson() {
      return { 'hostPlatform': hostPlatform, 'hostUserId': hostUserId, 'ceUserId': ceUserId, 'hostUserName': hostUserName, 'ceProjs': ceProjectIds, 'futProjs': futureCEProjects };
   }

   factory HostAccount.fromJson(Map<String, dynamic> json) {

      print( "in fromJson" );
      var dynamicProjs = json['CEProjectIds'];
      var dynamicFuts  = json['FutureCEProjects'];
      
      return HostAccount(
         hostPlatform:     json['HostPlatform'], 
         hostUserName:     json['HostUserName'],
         ceUserId:         json['CEUserId'],
         hostUserId:       json['HostUserId'], 
         ceProjectIds:     new List<String>.from( dynamicProjs ),
         futureCEProjects: new List<String>.from( dynamicFuts )
         );
   }

   String toString() {
      String res = "\nHost user : " + hostUserName + " CE user id: " + ceUserId + " ceProjectIds: ";

      return res;
   }
}
