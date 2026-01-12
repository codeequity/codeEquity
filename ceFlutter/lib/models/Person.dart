import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/AcceptedDoc.dart';
import 'package:ceFlutter/models/Agreement.dart';

// Dynamodb serializes primary key before using it... so...
class Person {
   final String id;                // ceUID
   String       firstName;
   String       lastName;
   String       userName;
   String       email;
   bool         registered;
   bool         locked;
   Map< DocType, AcceptedDoc> acceptedDocs;   // { privacy: AcceptedDoc, equity: AcceptedDoc}

   Person({required this.id, required this.firstName, required this.lastName, required this.userName,
            required this.email, required this.registered, required this.acceptedDocs, required this.locked});
   
   dynamic toJson() {
      Map<String, AcceptedDoc> encodable = {};
      print( "Encoding Person's docs" );
      acceptedDocs.forEach( (k,v) {
            encodable[ enumToStr( k ) ] = v; 
         });
      print( "docs encoded" );
      
      return { 'id': id, 'firstName': firstName, 'lastName': lastName, 'userName': userName, 'email': email, 'locked': false,
            'registered': registered, 'acceptedDocs': encodable }; 
   }

   String getFullName() { return firstName + " " + lastName; }

   bool signedPrivacy() {
      if( acceptedDocs == null )                     { return false; }
      if( acceptedDocs![ DocType.privacy ] == null ) { return false; }

      return true;
   }

   bool signedEquity() {
      if( acceptedDocs == null )                    { return false; }
      if( acceptedDocs![ DocType.equity ] == null ) { return false; }

      return true;
   }
   
   void accept( Agreement agmt ) {
      acceptedDocs[ agmt.type ] = new AcceptedDoc( docType: agmt.type, docId: agmt.id, acceptedDate: getToday() );
      bool allAccepted = true;
      DocType.values.forEach( (dtype) {
            if( acceptedDocs[ dtype ] == null ) { allAccepted = false; }
         });
      if( allAccepted ) { registered = true; }
   }
   
   // No one found.  return empty 
   factory Person.empty() {
      return Person( 
         id:           "-1",
         firstName:    "", 
         lastName:     "",
         userName:     "",
         email:        "",
         registered:   false,
         acceptedDocs: {},
         locked:       false,
         );
   }
   
   factory Person.fromJson(Map<String, dynamic> json) {

      var dynamicDocs = json['AcceptedDocs'];  // json arriving as Map<String,Map<String,String>>

      Map<DocType, AcceptedDoc> docs = {};
      if( dynamicDocs != null ) {
         dynamicDocs.entries.forEach((entry) {
               DocType key = enumFromStr<DocType>( entry.key, DocType.values );
               docs[key] = AcceptedDoc.fromJson( entry.value );
            });
      }
      
      return Person(
         id:          json['CEUserId'],
         firstName:   json['First'],
         lastName:    json['Last'],
         userName:    json['CEUserName'],
         email:       json['Email'],
         registered:  json['FullyRegistered'] ?? false,
         acceptedDocs: docs,
         locked:      json['Locked'],
         );
   }

   factory Person.from(p) {

      return Person(
         id:          p.id,
         firstName:   p.firstName,
         lastName:    p.lastName,
         userName:    p.userName,
         email:       p.email,
         registered:  p.registered,
         acceptedDocs: p.acceptedDocs,
         locked:      p.locked,
         );
   }

   String toString() {
      firstName = firstName;
      lastName  = lastName;
      userName  = userName;
      email     = email;

      String res = "\nPerson : " + firstName + " " + lastName;
      res += "\n   userName: " + userName + " registered? " + registered.toString();
      res += "\n   email: " + email;
      res += "\n   id: " + id;
      res += "\n   Accepted Docs: ";
      (acceptedDocs ?? {}).forEach( (k,v) => res += "\n     " + v.toString() );

      return res;
   }
}
