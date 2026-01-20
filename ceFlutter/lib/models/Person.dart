import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/AcceptedDoc.dart';
import 'package:ceFlutter/models/Agreement.dart';

// Dynamodb serializes primary key before using it... so...
class Person {
   final String id;                // ceUID
   String       goesBy;
   String       legalName;
   String       userName;
   String       email;
   String       phone;
   String       mailingAddress;
   bool         registered;        // with CodeEquity.  i.e. signed privacy, completed profile
   bool         locked;
   Map< DocType, AcceptedDoc> acceptedDocs;   // { privacy: AcceptedDoc, equity: AcceptedDoc}

   Person({required this.id, required this.goesBy, required this.legalName, required this.userName,
            required this.email, required this.phone, required this.mailingAddress, required this.registered, required this.acceptedDocs, required this.locked});
   
   dynamic toJson() {
      Map<String, AcceptedDoc> encodable = {};
      print( "Encoding Person's docs" );
      acceptedDocs.forEach( (k,v) {
            encodable[ enumToStr( k ) ] = v; 
         });
      print( "docs encoded" );
      
      return { 'id': id, 'goesBy': goesBy, 'legalName': legalName, 'userName': userName, 'email': email, 'phone': phone,
            'mailingAddress': mailingAddress, 'locked': false, 'registered': registered, 'acceptedDocs': encodable }; 
   }

   String getFullName() {
      String fn = legalName != "" ? legalName : "";
      fn += ( goesBy != "" ? " ("+goesBy+")" : "" );
      return fn;
   }

   List<String> getEditable() { return ["Legal name", "Goes by", "Email", "Phone", "Mailing Address"]; }
   List<String> getCurVal()   { return [ legalName,    goesBy,    email,   phone,   mailingAddress ]; }
   List<bool>   getRequired() { return [true,          false,     true,    true,    false ]; }
   List<String> getToolTip() {
      String tipR = "Required to participate in CodeEquity as a contributor that can earn equity.";
      String tipO = "Your Equity Agreement requires a mailing address for written correspondance.  While not required, it is strongly recommended.";
      return [ tipR, tipO, tipR, tipR, tipO ];
   }


   bool signedPrivacy() {
      if( registered )                               { return true; }
      if( acceptedDocs == null )                     { return false; }
      if( acceptedDocs![ DocType.privacy ] == null ) { return false; }

      return true;
   }

   bool signedEquity() {
      if( acceptedDocs == null )                    { return false; }
      if( acceptedDocs![ DocType.equity ] == null ) { return false; }

      return true;
   }
   
   bool completeProfile() {

      if( legalName != "" && userName != "" && email != "" && phone != "" ) {
         if( signedPrivacy() ) { registered = true; }
         return true;
      }
      if( registered ) { return true; }
      return false;
   }

   void accept( Agreement agmt ) {
      acceptedDocs[ agmt.type ] = new AcceptedDoc( docType: agmt.type, docId: agmt.id, acceptedDate: getToday() );
      bool allAccepted = true;
      DocType.values.forEach( (dtype) {
            if( acceptedDocs[ dtype ] == null ) { allAccepted = false; }
         });
      
      if( signedEquity() && completeProfile()) { registered = true; }
   }
   
   // No one found.  return empty 
   factory Person.empty() {
      return Person( 
         id:             "-1",
         goesBy:         "", 
         legalName:      "",
         userName:       "",
         email:          "",
         phone:          "",
         mailingAddress: "",
         registered:     false,
         acceptedDocs:   {},
         locked:         false,
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
         id:             json['CEUserId'],
         goesBy:         json['GoesBy'] ?? "",
         legalName:      json['LegalName']  ?? "",
         userName:       json['CEUserName'],
         email:          json['Email'] ?? "",
         phone:          json['Phone'] ?? "",
         mailingAddress: json['mailingAddress'] ?? "",
         registered:     json['Registered'] ?? false,
         acceptedDocs:   docs,
         locked:         json['Locked'],
         );
   }

   factory Person.from(p) {

      return Person(
         id:             p.id,
         goesBy:         p.goesBy,
         legalName:      p.legalName,
         userName:       p.userName,
         email:          p.email,
         phone:          p.phone,
         mailingAddress: p.mailingAddress,
         registered:     p.registered,
         acceptedDocs:   p.acceptedDocs,
         locked:         p.locked,
         );
   }

   String toString() {

      String res = "\nPerson : " + legalName + "(" + goesBy + ")";
      res += "\n   userName: " + userName + " registered? " + registered.toString();
      res += "\n   email: " + email + "  phone: " + phone;
      res += "\n   mailingAddress: " + mailingAddress;
      res += "\n   id: " + id;
      res += "\n   Accepted Docs: ";
      (acceptedDocs ?? {}).forEach( (k,v) => res += "\n     " + v.toString() );

      return res;
   }
}
