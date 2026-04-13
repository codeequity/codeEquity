import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/app_state.dart';
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

   
   List<Person> getWithRole( appState, MemberRole role ) {
      List<Person> res = [];
      roles.entries.forEach( (e) {
            if( e.value == role ) {
               Person? p = appState.cePeople[ e.key ];
               assert( p != null );
               res.add( p! );
            }} );
      return res;
   }

   // Don't include ancestors.  i.e. a Grantor is actually a Member as well, but don't include in getMember
   List<Person> getExecutives( appState ) { return getWithRole( appState, MemberRole.Executive ); }
   List<Person> getGrantors( appState )   { return getWithRole( appState, MemberRole.Grantor ); }
   List<Person> getMembers( appState )    { return getWithRole( appState, MemberRole.Member ); }

   void addApplicant( Person cePeep ) {
      if( !applicants.contains( cePeep.id ) ) {
         applicants.add( cePeep.id );
      }
   }

   void addNewCollaborator( Person applicant, String title ) {
      applicants.remove( applicant.id );
      roles[applicant.id] = title == "Founder" ? MemberRole.Executive : MemberRole.Member;
   }

   // Peep is withdrawing.  remove roles, applications.
   // Protect loss of sole executive
   List<dynamic> drop( AppState appState, Person cePeep ) {
      bool ret = false;
      List<Person> promoted = [];
      
      ret = applicants.remove( cePeep.id );

      final v = roles.remove( cePeep.id );
      ret = v == null ? ret : true;
         
      if( ret ) { print( "Dropping " + cePeep.id ); }

      if( v != null ) {  // dropped cepeep
         List<Person> execs = getExecutives( appState );
         if( execs.length == 0 ) {
            // Dropped sole exec.  If there are other collabs, promote all in highest group to exec
            if( roles.entries.length >= 1 ) {
               List<Person> grantors = getGrantors( appState );
               grantors.forEach( (p) {
                     roles[p.id] = MemberRole.Executive;
                     promoted.add( p );
                  });
               if( promoted.length == 0 ) {
                  List<Person> members = getMembers( appState );
                  members.forEach( (p) {
                        roles[p.id] = MemberRole.Executive;
                        promoted.add( p );
                     });
               }
            }
         }
      }
      return [ret, promoted];
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

