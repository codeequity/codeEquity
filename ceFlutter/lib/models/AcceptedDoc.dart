import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/models/CEVenture.dart';
import 'package:ceFlutter/models/Agreement.dart';
import 'package:ceFlutter/models/Person.dart';

class _aBox {
   String               type;        // what type of editable values do we expect
   double               percDepth;   // scroll past this depth to see edit box
   bool                 triggered;   // bookkeeping
   Map<String, String>? values;      // editable values if exist
   List<String>?        choices;     // available selections
   String?              choiceTitle; 

   _aBox( { required this.type, required this.triggered, required this.percDepth });
}

class AcceptedDoc {
   DocType      docType;  
   String       docId;
   String       acceptedDate;  // the date that 'Accept' was pressed

   // Equity agreement.  Only fully valid agreements store these values.
   String? effectiveDate;      // the effective date filled in on the agreement instance
   String? execName;
   String? execSignature;
   String? execEmail;
   String? execPhone;
   String? execMailingAddress;
   String? ventureName;
   String? ventureId;
   String? ventureWebsite;
   String? partnerName;
   String? partnerSignature;
   String? partnerEmail;
   String? partnerPhone;
   String? partnerMailingAddress;
   String? partnerTitle;

   String?  filledIn;           //  TRANSIENT do not store
   List<_aBox>? boxes;          //  TRANSIENT do not store

   
   AcceptedDoc( {required this.docType, required this.docId, required this.acceptedDate} );

   // signature all moddable
   // sched B not moddable.
   void setEditBox() {
      boxes = [];
      if( this.docType == DocType.equity ) {
         // preamble  
         _aBox box = new _aBox( type: "radio", triggered: false, percDepth: 0.2 );
         box.choices     = ["Collaborator", "Founder"];   // XXX formalize
         box.choiceTitle = "Partner's Title";
         
         boxes!.add( box );

         // Signature
         box = new  _aBox( type: "editList", triggered: false, percDepth: 66.0 );
         box.values = {};

         // XXX Partner can't sign for exec, vice versa
         box.values!["ExecutivePhone"]          = this.execPhone ?? "";
         box.values!["ExecutiveSignature"]      = this.execSignature ?? "";
         box.values!["ExecutiveMailingAddress"] = this.execMailingAddress ?? "";

         box.values!["PartnerPhone"]            = this.partnerPhone ?? "";
         box.values!["PartnerSignature"]        = this.partnerSignature ?? "";
         box.values!["PartnerMailingAddress"]   = this.partnerMailingAddress ?? "";

         boxes!.add( box );
      }
      
   }
   
   // Replace tags in content
   String compose( appState, Person cePeep, Agreement agmt, String cevId ) {
      // NOTE if the pattern from is not found, the <codeEquityTag> will be visible at best, or lost part of the doc at worst.
      print( agmt.content.length.toString() + " " + agmt.toString() );
      String res = "";
      if( agmt.type == DocType.equity ) {

         CEVenture? cev = appState.ceVenture[ cevId ];
         assert( cev != null );

         // Exec
         List<Person> execs = cev!.getExecutives( appState );
         assert( execs.length >= 1 );

         // no use signing with yourself
         execs = execs.where( (p) => p.id != cePeep.id ).toList();
         if( execs.length == 0 ) { return "-1"; }
         
         // XXX
         String pMA = cePeep.mailingAddress != "" ? cePeep.mailingAddress : "&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp";
         String oMA = "&nbsp&nbsp&nbsp&nbsp&nbspXXX&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp";
         String nyi = "XXX";

         // Can edit XXX
         // All edits should update profile?  Yes.  No parallel existence
         effectiveDate  = getToday();       
         partnerTitle   = "Contributor";    // XXX only 2 choices

         // Can NOT edit
         partnerName    = cePeep.legalName; 
         partnerEmail   = cePeep.email;     
         partnerPhone   = cePeep.phone;
         ventureId      = cevId;
         ventureName    = cev!.name;
         ventureWebsite = cev!.web == "" ? "https://www.codeequity.org/XXX" : cev!.web;
         
         // XXX Any exec will do.  Show first available, but pending tasks for all execs.
         execName      = execs[0].legalName;
         execEmail     = execs[0].email;
         execPhone     = execs[0].phone;
         
         res = agmt.content;
         res = res.replaceAll( "<codeEquityTag=\"PartnerTitle\">", "<u>" + partnerTitle! + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"EffectiveDate\">", "<u>" + effectiveDate! + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"ExecutiveName\">", "<u>" + execName! + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"ExecutiveSignature\">", "<u>" + nyi + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"ExecutiveEmail\">", "<u>" + execEmail! + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"ExecutivePhone\">", "<u>" + execPhone! + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"ExecutiveMailingAddress\">", "<u>" + oMA + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"VentureName\">", "<u>" + ventureName! + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"VentureWebsite\">", "<u>" + ventureWebsite! + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"PartnerName\">", "<u>" + partnerName! + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"PartnerSignature\">", "<u>" + nyi + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"PartnerEmail\">", "<u>" + partnerEmail! + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"PartnerPhone\">", "<u>" + partnerPhone! + "</u>" );
         res = res.replaceAll( "<codeEquityTag=\"PartnerMailingAddress\">", "<u>" + pMA + "</u>" );
      }
      setEditBox();
      filledIn = res;
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
