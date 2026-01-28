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
   Map< DocType, List<AcceptedDoc>> acceptedDocs;   // { privacy: AcceptedDoc, equity with venture 1, 2: AcceptedDoc}

   Person({required this.id, required this.goesBy, required this.legalName, required this.userName,
            required this.email, required this.phone, required this.mailingAddress, required this.registered, required this.acceptedDocs, required this.locked});
   
   dynamic toJson() {
      Map<String, List<AcceptedDoc>> encodable = {};
      print( "Encoding Person's docs" );
      acceptedDocs.forEach( (k,v) {
            encodable[ enumToStr( k ) ] = v; 
         });
      
      return { 'id': id, 'goesBy': goesBy, 'legalName': legalName, 'userName': userName, 'email': email, 'phone': phone,
            'mailingAddress': mailingAddress, 'locked': false, 'registered': registered, 'acceptedDocs': encodable }; 
   }

   String getFullName() {
      String fn = legalName != "" ? legalName : "";
      fn += ( goesBy != "" ? " ("+goesBy+")" : "" );
      return fn;
   }

   bool hasEquityAgreement( String cevId ) {
      bool hasEA = false;
      if( acceptedDocs[ DocType.equity ] == null ) { return hasEA; }
      List<AcceptedDoc> ea = acceptedDocs[ DocType.equity ]!;
      for( final accepted in ea ) {
         if( accepted.ventureId == cevId ) { hasEA = true; break;} 
      }
      return hasEA;
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
      if( registered )                              { return true; }
      if( acceptedDocs[ DocType.privacy ] == null ) { return false; }

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
   
   void accept( Agreement agmt, AcceptedDoc ad ) {
      // equity accepted docs come with filled in blank data
      if( agmt.type != DocType.equity ) {
         ad = new AcceptedDoc( docType: agmt.type, docId: agmt.id, acceptedDate: getToday() );
      }
      if( acceptedDocs[ agmt.type ] == null )  { acceptedDocs[ agmt.type ] = [ ad ];  }
      else                                     { acceptedDocs[ agmt.type ]!.add( ad ); }
      if( signedPrivacy() && completeProfile()) { registered = true; }
   }

   bool registeredWithCEV( cevId ) {
      bool res = false;

      List<AcceptedDoc>? docs = acceptedDocs[ DocType.equity ];
      if( docs == null ) { return res; }

      docs.forEach( (d) {
            if( d.ventureId == cevId ) { res = true; }
         });
      
      return res;
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

      Map<DocType, List<AcceptedDoc>> docs = {};
      if( dynamicDocs != null ) {
         dynamicDocs.entries.forEach((entry) {
               DocType key = enumFromStr<DocType>( entry.key, DocType.values );
               // docs[key] = entry.value.map( (accepted) => AcceptedDoc.fromJson( accepted )).toList();
               List<AcceptedDoc> a = [];
               entry.value.forEach( (v) => a.add( AcceptedDoc.fromJson( v )) );
               docs[key] = a;
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
