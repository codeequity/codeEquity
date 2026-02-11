import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/Person.dart';

enum MemberRole  { Executive, Grantor, Member, end }

class CEVenture {
   final String  ceVentureId;
   final String  name;
   final String? web;
   final Map< String, MemberRole > roles;  // ceUID: role
   final List<String> applicants;          // CEPeople that have applied to register with this venture

   CEVenture({ required this.ceVentureId, required this.name, this.web, required this.roles, required this.applicants });

   dynamic toJson() {
      final Map< String, String> sRoles = {};
      assert( roles != null );
      roles.forEach( (k,v) { sRoles[k] = enumToStr( v ); } );
      return { 'CEVentureId': ceVentureId, 'Name': name, 'Website': web, 'Roles': sRoles, 'Applicants': applicants };
   }

   // No CEVenture found.  return empty 
   factory CEVenture.empty() {
      return CEVenture(
         ceVentureId:  "-1",
         name:         "", 
         web:          "",
         roles:        {},
         applicants:   []
         );
   }
      
   factory CEVenture.fromJson(Map<String, dynamic> json) {

      var dynamicRoles           = json['Roles'];
      Map <String, MemberRole> r = {};
      if( dynamicRoles != null ) { dynamicRoles.forEach( (k,v) { r[k] = enumFromStr<MemberRole>( v, MemberRole.values ); }); }

      var dynamicApps            = json['Applicants'] ?? [];
      List<String> apps          = new List<String>.from(dynamicApps);
      
      // DynamoDB is not camelCase
      return CEVenture(
         ceVentureId:   json['CEVentureId'],
         name:          json['Name'],
         web:           json['Website'],
         roles:         r,
         applicants:    apps
         );
   }

   List<Person> getExecutives( appState ) {
      List<Person> res = [];
      roles.entries.forEach( (e) {
            if( e.value == MemberRole.Executive ) {
               Person? p = appState.cePeople[ e.key ];
               assert( p != null );
               res.add( p! );
            }} );
      return res;
   }

   void addApplicant( Person cePeep ) {
      if( !applicants.contains( cePeep.id ) ) {
         applicants.add( cePeep.id );
      }
   }

   void addNewCollaborator( Person applicant, String title ) {
      print( "applicants before " + applicants.toString() );
      applicants.remove( applicant.id );
      print( "applicants after " + applicants.toString() );
      roles[applicant.id] = title == "Founder" ? MemberRole.Executive : MemberRole.Member;
   }

   // Peep is withdrawing.  remove roles, applications.
   void drop( Person cePeep ) {
      applicants.remove( cePeep.id );
      roles.remove( cePeep.id );
   }
   
   bool hasApplicant( String pid ) { return applicants.contains( pid ); }
   
   String toString() {
      String res = "\n" + name + " (" + ceVentureId + ") " + (web ?? "");
      res += "Roles:\n";
      for( MapEntry<String, MemberRole> role in roles.entries ) {
         res += "   " + role.key + ": " + enumToStr( role.value );
      }
      res += "\nApplicants: " + applicants.toString();
      res += "\n";
      return res;
   }

}

