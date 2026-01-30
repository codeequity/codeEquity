import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/models/CEVenture.dart';
import 'package:ceFlutter/models/Agreement.dart';
import 'package:ceFlutter/models/Person.dart';

class _aBox {
   String               type;        // what type of editable values do we expect
   double               percDepth;   // scroll past this depth to see edit box
   bool                 triggered;   // bookkeeping
   
   String?              blankTitle;
   Map<String, String>? values;      // editable values for blanks type

   String?              radioTitle;
   List<String>?        rchoices;     // available selections for radio type

   String?              hybridTitle;  // i.e. update radio or blank?
   List<String>?        hchoices;     // available selections for hybrid meta-type

   
   _aBox( { required this.type, required this.triggered, required this.percDepth });

   bool validate() {
      bool res = true;
      bool found = false;
      if( this.type == "blanks" || this.type == "hybrid" ) {
         res = res && this.values != null;
         found = true;
      }
      if( type == "hybrid" ) {
         res = res && this.radioTitle != null;
         res = res && this.rchoices != null;
         res = res && this.rchoices!.length >= 1;
         res = res && this.hybridTitle != null;
         res = res && this.hchoices != null;
         res = res && this.hchoices!.length >= 1;
         found = true;
      }
      if( !found ) { res = false; }
      
      return res;
   }

}

class AcceptedDoc {
   DocType      docType;  
   String       docId;
   String       acceptedDate;  // the date that 'Accept' was pressed

   // Equity agreement.  Only fully valid agreements store these values.
   late Map<String,String> equityVals;   // htmlDoc tag to value

   String?  filledIn;           //  TRANSIENT do not store
   List<_aBox>? boxes;          //  TRANSIENT do not store

   
   AcceptedDoc( {required this.docType, required this.docId, required this.acceptedDate} ) {
      equityVals = {};

      equityVals["EffectiveDate"] = "";             // the effective date filled in on the agreement instance
      equityVals["VentureName"] = "";
      equityVals["VentureId"] = "";
      equityVals["VentureWebsite"] = "";
      equityVals["OutstandingShares"] = "";
      equityVals["ExecutiveName"] = "";
      equityVals["ExecutiveSignature"] = "";
      equityVals["ExecutiveEmail"] = "";
      equityVals["ExecutivePhone"] = "";
      equityVals["ExecutiveMailingAddress"] = "";
      equityVals["PartnerName"] = "";
      equityVals["PartnerSignature"] = "";
      equityVals["PartnerEmail"] = "";
      equityVals["PartnerPhone"] = "";
      equityVals["PartnerMailingAddress"] = "";
      equityVals["PartnerTitle"] = "";
   }


   // Set up which fields can be edited, along with hints for the edit box
   void setEditBox() {
      boxes = [];
      if( this.docType == DocType.equity ) {
         // preamble section
         _aBox box = new _aBox( type: "hybrid", triggered: false, percDepth: 0.2 );
         box.radioTitle  = "Partner's Title";
         box.blankTitle  = "Effective Date";

         // NOTE radioTitle will not be passed to the radio dialog as a selectable option.  It is used to help determine which hybrid option the user chose
         box.rchoices    = [ box.radioTitle!, "Collaborator", "Founder"];   // XXX formalize.  

         box.hybridTitle = "Which would you like to update?";
         box.hchoices    = [ box.radioTitle!, box.blankTitle! ];

         box.values = {};
         box.values!["EffectiveDate"] = equityVals["EffectiveDate"]!;
         
         boxes!.add( box );

         
         // Signature section
         box = new  _aBox( type: "blanks", triggered: false, percDepth: 66.0 );
         box.values = {};

         // XXX Partner can't sign for exec, vice versa
         box.values!["ExecutivePhone"]          = equityVals["ExecutivePhone"]!;
         box.values!["ExecutiveSignature"]      = equityVals["ExecutiveSignature"] == "" ? "(type your full legal name)" : equityVals["ExecutiveSignature"]!;
         box.values!["ExecutiveMailingAddress"] = equityVals["ExecutiveMailingAddress"]!;

         box.values!["PartnerPhone"]            = equityVals["PartnerPhone"]!;
         box.values!["PartnerSignature"]        = equityVals["PartnerSignature"] == "" ? "(type your full legal name)" : equityVals["PartnerSignature"]!;
         box.values!["PartnerMailingAddress"]   = equityVals["PartnerMailingAddress"]!;

         boxes!.add( box );
      }
      
   }

   // User has filled in a blank or choosen a value.  update doc.
   void modify( appState, Map<String, String> update ) {
      for( final entry in update.entries ) {
         equityVals[entry.key] = entry.value;
      }
      return;
   }
   
   // Replace tags in content
   String compose( appState, Person cePeep, Agreement agmt, String cevId, {useCurrent = false} ) {
      // NOTE if the pattern from is not found, the <codeEquityTag> will be visible at best, or lost part of the doc at worst.
      print( agmt.content.length.toString() + " " + agmt.toString() );
      String res = "";
      if( agmt.type == DocType.equity ) {

         if( !useCurrent ) {
            CEVenture? cev = appState.ceVenture[ cevId ];
            assert( cev != null );
            
            // Exec
            List<Person> execs = cev!.getExecutives( appState );
            assert( execs.length >= 1 );
            
            // no use signing with yourself
            execs = execs.where( (p) => p.id != cePeep.id ).toList();
            if( execs.length == 0 ) { return "-1"; }
            
            // Each signing instance has multiple values that get filled in, most automatically.  Only a few are editable.
            // All edits must update required profile elements first, which are used here.  No parallel existence.
            equityVals["EffectiveDate"]         = getToday();       
            equityVals["VentureId"]             = cevId;
            equityVals["VentureName"]           = cev!.name;
            equityVals["VentureWebsite"]        = cev!.web == "" ? "https://www.codeequity.org/XXX" : cev!.web!;
            equityVals["OutstandingShares"]     = "987348746";
            
            equityVals["PartnerTitle"]          = "Contributor"; 
            equityVals["PartnerName"]           = cePeep.legalName; 
            equityVals["PartnerEmail"]          = cePeep.email;     
            equityVals["PartnerPhone"]          = cePeep.phone;
            equityVals["PartnerMailingAddress"] = cePeep.mailingAddress;
            
            // Any exec will do.  Show first available, but pending tasks for all execs.
            equityVals["ExecutiveName"]           = execs[0].legalName;
            equityVals["ExecutiveEmail"]          = execs[0].email;
            equityVals["ExecutivePhone"]          = execs[0].phone;
            equityVals["ExecutiveMailingAddress"] = execs[0].mailingAddress;
         }
         
         // profile may not contain phone, mailing address
         String spaces = "&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp";
         res = agmt.content;

         for( final entry in equityVals.entries ) {
            String tmp =  entry.value == "" ? spaces : entry.value;
            res = res.replaceAll( "<codeEquityTag=\"" + entry.key + "\">", "<u>" + tmp + "</u>" );
         }
      }
      setEditBox();
      filledIn = res;
      return res;
   }
   dynamic toJson() {
      print( "Encoding acceptedDocs" );
      return { 'docType': enumToStr( docType ), 'docId': docId, 'acceptedDate': acceptedDate };
   }
   
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
