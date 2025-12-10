import 'package:ceFlutter/utils/ceUtils.dart';

enum MemberRole  { Executive, Grantor, Member, end }

class CEVenture {
   final String  ceVentureId;
   final String  name;
   final String? web;
   final Map< String, MemberRole > roles;

   CEVenture({ required this.ceVentureId, required this.name, this.web, required this.roles });

   // dynamic toJson() => { 'CEVentureId': ceVentureId, 'Name': name, 'Website': web, 'Roles': roles };
   dynamic toJson() {
      final Map< String, String> sRoles = {};
      assert( roles != null );
      roles.forEach( (k,v) { sRoles[k] = enumToStr( v ); } );
      return { 'CEVentureId': ceVentureId, 'Name': name, 'Website': web, 'Roles': sRoles };
   }

   // No CEVenture found.  return empty 
   factory CEVenture.empty() {
      return CEVenture(
         ceVentureId:  "-1",
         name:         "", 
         web:          "",
         roles:        {}
         );
   }
      
   factory CEVenture.fromJson(Map<String, dynamic> json) {

      var dynamicRoles           = json['Roles'];
      Map <String, MemberRole> r = {};

      // if( dynamicRoles != null ) { dynamicRoles.forEach( (k,v) { r[k] = v; }); }
      if( dynamicRoles != null ) { dynamicRoles.forEach( (k,v) { r[k] = enumFromStr<MemberRole>( v, MemberRole.values ); }); }
      
      // DynamoDB is not camelCase
      return CEVenture(
         ceVentureId:   json['CEVentureId'],
         name:          json['Name'],
         web:           json['Website'],
         roles:         r
         );
   }

   
   String toString() {
      String res = "\n" + name + " (" + ceVentureId + ") " + (web ?? "");
      res += "Roles:\n";
      for( MapEntry<String, MemberRole> role in roles.entries ) {
         res += "   " + role.key + ": " + enumToStr( role.value );
      }
      res += "\n";
      return res;
   }

}

