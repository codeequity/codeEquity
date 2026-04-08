import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/CEVenture.dart';
import 'package:ceFlutter/models/UserDoc.dart';
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
   Map< DocType, List<UserDoc>> userDocs;   // { privacy: UserDoc, equity with venture 1, 2: UserDoc}

   Person({required this.id, required this.goesBy, required this.legalName, required this.userName,
            required this.email, required this.phone, required this.mailingAddress, required this.registered, required this.userDocs, required this.locked});
   
   dynamic toJson() {
      Map<String, List<UserDoc>> encodable = {};
      userDocs.forEach( (k,v) {
            encodable[ enumToStr( k ) ] = v; 
         });
      
      return { 'id': id, 'goesBy': goesBy, 'legalName': legalName, 'userName': userName, 'email': email, 'phone': phone,
            'mailingAddress': mailingAddress, 'locked': false, 'registered': registered, 'userDocs': encodable }; 
   }

   String getFullName() {
      String fn = legalName != "" ? legalName : "";
      fn += ( goesBy != "" ? " ("+goesBy+")" : "" );
      return fn;
   }

   bool hasEquityAgreement( String cevId ) {
      bool hasEA = false;
      if( userDocs[ DocType.equity ] == null ) { return hasEA; }
      List<UserDoc> ea = userDocs[ DocType.equity ]!;
      for( final accepted in ea ) {
         if( accepted.equityVals["VentureId"]! == cevId ) { hasEA = true; break;} 
      }
      return hasEA;
   }
   
   List<String> getEditable() { return ["Legal name", "Goes by", "Email", "Phone", "Mailing address"]; }
   List<String> getCurVal()   { return [ legalName,    goesBy,    email,   phone,   mailingAddress ]; }
   List<bool>   getRequired() { return [true,          false,     true,    true,    false ]; }
   List<String> getToolTip() {
      String tipR = "Required to participate in CodeEquity as a contributor that can earn equity.";
      String tipO = "Your Equity Agreement requires a mailing address for written correspondance.  While not required, it is strongly recommended.";
      return [ tipR, tipO, tipR, tipR, tipO ];
   }


   bool signedPrivacy() {
      if( registered )                              { return true; }
      if( userDocs[ DocType.privacy ] == null ) { return false; }

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
   
   void accept( DocType docType, UserDoc ad, String docId, CEVenture cev, bool isApplicant  ) {
      if( docType != DocType.equity ) { userDocs[ docType ] = [ ad ]; }

      // equity accepted docs come with filled in blank data
      if( docType == DocType.equity ) {
         assert( ad != null );
         // No model changes for approver on accept
         if( isApplicant ) {
            if( hasEquityAgreement( ad.equityVals["VentureId" ]! ) ) {
               // remove last edited doc to make room for new
               userDocs[ docType ]!.removeWhere( (d) => d.equityVals["VentureId"] == ad.equityVals["VentureId"] || d.equityVals["VentureId"] == "" );
            }
            
            if( userDocs[ docType ] == null ) { userDocs[ docType ] = [ ad ];   }
            else                                  { userDocs[ docType ]!.add( ad ); }

            // Become an applicant if this is not a counter-signature
            if( ad.equityVals["EffectiveDate"] == "" ) { ad.submitIfReady( cev, this ); }
         }
      }
         
      if( signedPrivacy() && completeProfile()) { registered = true; }
   }

   // Only called if Founder rejects application
   void reject( DocType docType, { cev = null } ) {
      if( docType == DocType.equity ) {
         if( userDocs[ docType ] != null ) {
            if( cev != null ) { userDocs[ docType ]!.removeWhere( (d) => d.equityVals["VentureId"] == cev.ceVentureId ); }
            else              { userDocs.remove( docType ); }
         }
      }
      else if( docType == DocType.privacy ) {
         if( userDocs[ docType ] != null ) { userDocs.remove( docType ); }
         registered = false;
      }
   }

   void withdraw() {
      reject( DocType.equity );
      reject( DocType.privacy );
      phone = "";
      assert( userDocs.length == 0 );
   }

   List<CEVenture> getCEVs( Map<String, CEVenture> knownCEVs ) {
      List<CEVenture> cevs = [];

      if( userDocs[ DocType.equity ] == null ) { return cevs; }
      
      for( UserDoc ad in userDocs[ DocType.equity ]! ) {
         assert( ad.equityVals["VentureId"] != null );
         CEVenture? cev = knownCEVs[ ad.equityVals["VentureId"]! ];
         assert( cev != null );
         cevs.add( cev! );
      }
      return cevs;
   }
   
   bool registeredWithCEV( CEVenture cev ) {
      return cev.roles[ id ] != null;
   }

   bool appliedToCEV( CEVenture cev ) {
      return cev.hasApplicant( id );
   }

   UserDoc copyStoredEquityVals( String cevId ) {
      assert( userDocs[DocType.equity] != null );
      print( "Copy stored equity vals from " + cevId + " to " + legalName );
      UserDoc doc = userDocs[DocType.equity]!.firstWhere( (d) => d.equityVals["VentureId"] == cevId );
      UserDoc receiver = UserDoc.from( doc );
      return receiver;
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
         userDocs:   {},
         locked:         false,
         );
   }
   
   factory Person.fromJson(Map<String, dynamic> json) {

      var dynamicDocs = json['UserDocs'];  // json arriving as Map<String,Map<String,String>>

      Map<DocType, List<UserDoc>> docs = {};
      if( dynamicDocs != null ) {
         dynamicDocs.entries.forEach((entry) {
               DocType key = enumFromStr<DocType>( entry.key, DocType.values );
               // docs[key] = entry.value.map( (accepted) => UserDoc.fromJson( accepted )).toList();
               List<UserDoc> a = [];
               entry.value.forEach( (v) => a.add( UserDoc.fromJson( v )) );
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
         userDocs:   docs,
         locked:         json['Locked'],
         );
   }

   factory Person.from(p) {

      return Person(
         id:             p.id,
         goesBy:         p.goesBy ?? "",
         legalName:      p.legalName,
         userName:       p.userName,
         email:          p.email ?? "",
         phone:          p.phone ?? "",
         mailingAddress: p.mailingAddress ?? "",
         registered:     p.registered,
         userDocs:   p.userDocs,
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
      (userDocs ?? {}).forEach( (k,v) => res += "\n     " + v.toString() );

      return res;
   }
}
