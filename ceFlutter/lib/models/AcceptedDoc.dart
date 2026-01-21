import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/CEVenture.dart';
import 'package:ceFlutter/models/Agreement.dart';
import 'package:ceFlutter/models/Person.dart';

class AcceptedDoc {
   DocType      docType;  
   String       docId;
   String       acceptedDate;  // the date that 'Accept' was pressed

   // Equity agreement.  Only fully valid agreements store these values.
   String? effectiveDate;      // the effective date filled in on the agreement instance
   String? ownerName;
   String? ownerSignature;
   String? ownerEmail;
   String? ownerPhone;
   String? ownerMailingAddress;
   String? ventureName;
   String? ventureId;
   String? ventureWebsite;
   String? partnerName;
   String? partnerSignature;
   String? partnerEmail;
   String? partnerPhone;
   String? partnerMailingAddress;

   AcceptedDoc( {required this.docType, required this.docId, required this.acceptedDate} );

   // Replace tags in content
   String compose( Person cePeep, Agreement agmt, String cevId, String cevName ) {
      // NOTE if the pattern from is not found, the <codeEquityTag> will be visible at best, or lost part of the doc at worst.
      print( agmt.content.length.toString() + " " + agmt.toString() );
      String res = "";
      if( agmt.type == DocType.equity ) {

         
         // XXX
         String pMA = cePeep.mailingAddress != "" ? cePeep.mailingAddress : "&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp";
         String oMA = "&nbsp&nbsp&nbsp&nbsp&nbspXXX&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp";
         String nyi = "XXX";
         
         effectiveDate = getToday();
         partnerName   = cePeep.legalName;
         partnerEmail  = cePeep.email;
         partnerPhone  = cePeep.phone;
         ventureId     = cevId;
         ventureName   = cevName;
         
         res = agmt.content;
         res = res.replaceAll( "<codeEquityTag=\"EffectiveDate\">", "<u>" + effectiveDate! + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"OwnerName\">", "<u>" + nyi + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"OwnerSignature\">", "<u>" + nyi + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"OwnerEmail\">", "<u>" + nyi + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"OwnerPhone\">", "<u>" + nyi + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"OwnerMailingAddress\">", "<u>" + oMA + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"VentureName\">", "<u>" + ventureName! + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"VentureWebsite\">", "<u>" + "https://www.codeequity.com/XXX" + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"PartnerName\">", "<u>" + partnerName! + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"PartnerSignature\">", "<u>" + nyi + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"PartnerEmail\">", "<u>" + partnerEmail! + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"PartnerPhone\">", "<u>" + partnerPhone! + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"PartnerMailingAddress\">", "<u>" + pMA + "</u>" );
      }
      return res;
   }

   
   dynamic toJson() {
      print( "Encoding acceptedDocs" );
      return { 'docType': enumToStr( docType ), 'docId': docId, 'acceptedDate': acceptedDate };
   }
   
   // Nothing found.  return empty 
   factory AcceptedDoc.empty() {
      return AcceptedDoc( 
         docType:      DocType.end,
         docId:        "", 
         acceptedDate: "",
         );
   }
   
   factory AcceptedDoc.fromJson(Map<String, dynamic> json) {
      return AcceptedDoc(
         docType:      enumFromStr<DocType>( json['docType'] ?? "end", DocType.values ),
         docId:        json['docId'] ?? "",
         acceptedDate: json['acceptedDate'] ?? "",
         );
   }

   factory AcceptedDoc.from(p) {

      return AcceptedDoc(
         docType:      p.docType,
         docId:        p.docId,
         acceptedDate: p.acceptedDate,
         );
   }

   String toString() {
      String res = "";
      res += "\n   Document type: " + enumToStr( docType );
      res += "\n   Document id: " + docId;
      res += "\n   Date accepted:" + acceptedDate;

      return res;
   }
}
