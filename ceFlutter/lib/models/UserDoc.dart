import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/models/CEVenture.dart';
import 'package:ceFlutter/models/EquityPlan.dart';
import 'package:ceFlutter/models/Agreement.dart';
import 'package:ceFlutter/models/Person.dart';

class _aBox {
   String               type;        // what type of editable values do we expect
   double               percDepth;   // scroll past this depth to see edit box
   bool                 triggered;   // bookkeeping
   
   String?              blankTitle;
   String?              blankSub;
   Map<String, String>? values;      // editable values for blanks type

   String?              radioTitle;
   List<String>?        rchoices;     // available selections for radio type
   String?              rInitChoice;  // What is the radio option initially set to
   
   String?              hybridTitle;  // i.e. update radio or blank?
   List<String>?        hchoices;     // available selections for hybrid meta-type

   
   _aBox( { required this.type, required this.triggered, required this.percDepth });

   bool validate() {
      bool res = true;
      bool found = false;
      if( this.type == "blanks" ) {
         res = res && this.values != null;
         found = true;
      }
      else if( type == "radio" ) {
         res = res && this.radioTitle != null;
         res = res && this.rchoices != null;
         res = res && this.rInitChoice != null;
         res = res && this.rchoices!.length >= 1;
         res = res && this.rchoices!.contains( this.rInitChoice );
         found = true;
      }
      if( !found ) { res = false; }
      
      return res;
   }

}

class UserDoc {
   DocType      docType;  
   String       docId;
   String       acceptedDate;  // the date that 'Accept' was pressed, or for multi-state docs like equity agreement, this is basically 'lastMod'.

   
   // Equity agreement.  Only fully valid agreements store these values.
   late Map<String,String> equityVals;   // htmlDoc tag to value

   final String sigHint   = "(type your full legal name)";
   final String phoneHint = "1 111-222-3333";
   
   String?  filledIn;           //  TRANSIENT do not store
   List<_aBox>? boxes;          //  TRANSIENT do not store

   
   UserDoc( {required this.docType, required this.docId, required this.acceptedDate, required this.equityVals } ) {

      if( docType == DocType.privacy ) { equityVals = {}; }
      else if( docType == DocType.equity ) {
         if( equityVals.entries.length == 0 ) { 
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
      }
   }


   // Set up which fields can be edited, along with hints for the edit box
   void setEditBox( bool applicant, bool useCurrent ) {
      boxes = [];
      if( this.docType == DocType.equity ) {

         // preamble section
         // Neither party can change these once other party has signed
         // Neither party can change Effective Date - this is fixed upon counter-signature
         if( ( applicant &&  !validExecSig() ) ||
             ( !applicant && !validPartnerSig() ) ) {

            _aBox box = new _aBox( type: "radio", triggered: false, percDepth: 0.2 );
            box.radioTitle  = "Partner's Title";
         
            // NOTE radioTitle will not be passed to the radio dialog as a selectable option.  It is used to help determine which hybrid option the user chose
            box.rchoices    = [ box.radioTitle!, "Contributor", "Founder"];            // XXX formalize.
            box.rInitChoice = useCurrent ? equityVals["PartnerTitle"] : "Contributor";

            boxes!.add( box );
         }
         
         // Signature section
         // Even if the other party has signed, current peep should be able to update these three fields, unless doc is fully executed
         if( !validExecSig() || !validPartnerSig() ) {
            _aBox box = new  _aBox( type: "blanks", triggered: false, percDepth: 66.0 );
            box.values = {};
            
            if( !applicant ) {
               box.blankTitle = "Executive Signature Page";
               box.blankSub = "BEFORE SIGNING: verify Partner Title is correct on Page 1!  Your phone number and signature are required.";
               box.blankSub = box.blankSub! + "  Your mailing address is strongly recommended.";
               box.values!["ExecutivePhone"]          = equityVals["ExecutivePhone"]     == "" ? phoneHint : equityVals["ExecutivePhone"]!;
               box.values!["ExecutiveSignature"]      = equityVals["ExecutiveSignature"] == "" ? sigHint   : equityVals["ExecutiveSignature"]!;
               box.values!["ExecutiveMailingAddress"] = equityVals["ExecutiveMailingAddress"]!;
            }
            else {
               box.blankTitle = "Partner Signature Page";
               box.blankSub = "Your phone number and signature are required.  Your mailing address is strongly recommended.  Once signed, this agreement will be ";
               box.blankSub = box.blankSub! + "submitted to the Founders for review and counter-signature.";
               box.values!["PartnerPhone"]            = equityVals["PartnerPhone"]     == "" ? phoneHint : equityVals["PartnerPhone"]!;
               box.values!["PartnerSignature"]        = equityVals["PartnerSignature"] == "" ? sigHint   : equityVals["PartnerSignature"]!;
               box.values!["PartnerMailingAddress"]   = equityVals["PartnerMailingAddress"]!;
            }
            boxes!.add( box );
         }
      }
   }

   // Replace tags in content from applicant
   String compose( appState, Person applicant, Person approver, Agreement agmt, String cevId, { bool useCurrent = false, bool isApplicant = true } ) {
      // NOTE if the pattern from is not found, the <codeEquityTag> will be visible at best, or lost part of the doc at worst.
      String res = "";
      if( agmt.type == DocType.equity ) {

         String spaces = "&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp";
         if( !useCurrent) {
            CEVenture? cev = appState.ceVenture[ cevId ];
            assert( cev != null );
            EquityPlan? ep = appState.ceEquityPlans[ cevId ];
            assert( ep != null );
               
            equityVals["EffectiveDate"]         = "";
            equityVals["VentureId"]             = cevId;
            equityVals["VentureName"]           = cev!.name;
            equityVals["VentureWebsite"]        = cev!.web == "" ? "https://www.codeequity.org/XXX" : cev!.web!;
            equityVals["OutstandingShares"]     = addCommas( ep!.totalAllocation );
            
            // no use signing with yourself
            List<Person> execs = cev!.getExecutives( appState );
            assert( execs.length >= 1 );
            execs = execs.where( (p) => p.id != applicant.id ).toList();
            if( execs.length == 0 ) { return "-1"; }
            
            equityVals["PartnerName"]           = applicant.legalName; 
            equityVals["PartnerEmail"]          = applicant.email;     
            equityVals["PartnerPhone"]          = applicant.phone;
            equityVals["PartnerMailingAddress"] = applicant.mailingAddress;

            if( isApplicant ) {
               // We can't know which exec will countersign, yet
               equityVals["PartnerTitle"]            = "Contributor"; 
               equityVals["ExecutiveName"]           = "";
               equityVals["ExecutiveEmail"]          = "";
               equityVals["ExecutivePhone"]          = "";
               equityVals["ExecutiveMailingAddress"] = "";
            }
            else
            {
               assert( approver.id != "" );               
               equityVals["ExecutiveName"]           = approver!.legalName;     
               equityVals["ExecutiveEmail"]          = approver!.email;
               equityVals["ExecutivePhone"]          = approver!.phone;
               equityVals["ExecutiveMailingAddress"] = approver!.mailingAddress;
            }
         }
         
         // profile may not contain phone, mailing address
         res = agmt.content;

         for( final entry in equityVals.entries ) {
            String tmp =  entry.value == "" ? spaces : entry.value;
            res = res.replaceAll( "<codeEquityTag=\"" + entry.key + "\">", "<u>" + tmp + "</u>" );
         }
      }
      setEditBox( isApplicant, useCurrent );
      filledIn = res;
      return res;
   }

   // User has filled in a blank or choosen a value.  update doc.
   void modify( Map<String, String> update ) {
      for( final entry in update.entries ) {
         print( "Modify " + entry.key + " => " + entry.value );
         equityVals[entry.key] = entry.value;
      }
      return;
   }

   String checkExecuted( Person approver, Person applicant, CEVenture cev ) {
      String failures = "";
      assert( equityVals["ExecutiveSignature"] != null );
      assert( equityVals["PartnerSignature"] != null );
      
      if( equityVals["VentureName"] != cev.name ) { failures += "\n   Venture name error: " + (equityVals["VentureName"] ?? "") + " vs " + cev.name; }
      if( equityVals["VentureId"]   != cev.ceVentureId ) { failures += "\n   Venture id error: " + (equityVals["VentureId"] ?? "") + " vs " + cev.ceVentureId; }
      if( equityVals["VentureWebsite"] == "" ) { failures += "\n   Venture website is blank."; }
      if( equityVals["OutstandingShares"] == "" ) { failures += "\n   Outstanding shares is blank."; }
      if( equityVals["ExecutiveName"] != approver.legalName ) { failures += "\n   Executive name error: " + (equityVals["ExecutiveName"] ?? "") + " vs " + approver.legalName; }
      if( equityVals["ExecutiveSignature"]!.toLowerCase() != approver.legalName.toLowerCase() ) { failures += "\n   Executive signature."; }
      if( equityVals["ExecutiveEmail"] == ""  ) { failures += "\n   Executive email is blank."; }
      if( equityVals["ExecutivePhone"] == "" ) { failures += "\n   Executive phone is blank."; }
      if( equityVals["PartnerName"] != applicant.legalName ) { failures += "\n   Partner name error: " + (equityVals["PartnerName"] ?? "") + " vs " + applicant.legalName; }
      if( equityVals["PartnerSignature"]!.toLowerCase() != applicant.legalName.toLowerCase() ) { failures += "\n   Partner signature."; }
      if( equityVals["PartnerEmail"] == ""  ) { failures += "\n   Partner email is blank."; }
      if( equityVals["PartnerPhone"] == "" ) { failures += "\n   Partner phone is blank."; }

      return failures;
   }

   void setExecutionDate() { equityVals["EffectiveDate"] = getToday(); }
   
   // Stored edits
   bool validExecSig() {
      assert( equityVals["ExecutiveSignature"] != null && equityVals["ExecutiveName"] != null );
      return (equityVals["ExecutiveSignature"]!.toLowerCase() == equityVals["ExecutiveName"]!.toLowerCase()) && equityVals["ExecutiveSignature"] != "";
   }
   bool validPartnerSig() {
      assert( equityVals["PartnerSignature"] != null && equityVals["PartnerName"] != null );
      return (equityVals["PartnerSignature"]!.toLowerCase() == equityVals["PartnerName"]!.toLowerCase()) && equityVals["PartnerSignature"] != "" ;
   }
   
   // Current edits possibly to be stored
   // Valid is no edits in signature area, or good edits.
   bool validate( Person cePeep, Map<String, String> edits, bool isApplicant ) {
      bool valid = true;

      if( isApplicant ) {
         // These are current edits, not stored values
         assert( edits["ExecutiveSignature"] == null );
         if( edits["PartnerSignature"] != null && edits["PartnerSignature"] != sigHint && edits["PartnerSignature"]!.toLowerCase() != cePeep.legalName.toLowerCase() ) { valid = false; }
      }
      else {
         // approver gets doc after partner signature.  Should be no edits here.
         assert( edits["PartnerSignature"] == null );
         if( edits["ExecutiveSignature"] != null && edits["ExecutiveSignature"] != sigHint && edits["ExecutiveSignature"]!.toLowerCase() != cePeep.legalName.toLowerCase() ) { valid = false; }
      }
      
      return valid;
   }

   // If required blanks have been filled in, add id to CEV applicants.
   void submitIfReady( CEVenture cev, Person cePeep ) {
      assert( equityVals["PartnerSignature"] != null );
      if( equityVals["EffectiveDate"]    == ""                                            && // XXX better date checking pls
          equityVals["PartnerSignature"]!.toLowerCase() == cePeep.legalName.toLowerCase() &&
          equityVals["PartnerPhone"]     != "" ) {                                           // XXX better phone checking pls

         cev.addApplicant( cePeep );

      }
   }
   
   dynamic toJson() {

      // do not save signature hint.
      if( equityVals["ExecutiveSignature"] == sigHint ) { equityVals["ExecutiveSignature"] = ""; }
      if( equityVals["PartnerSignature"]   == sigHint ) { equityVals["PartnerSignature"] = ""; }
      
      return { 'docType': enumToStr( docType ), 'docId': docId, 'acceptedDate': acceptedDate, 'equityVals': equityVals };
   }
   
   factory UserDoc.empty() {
      return UserDoc( 
         docType:      DocType.end,
         docId:        "", 
         acceptedDate: "",
         equityVals:   {}
         );
   }
   
   factory UserDoc.fromJson(Map<String, dynamic> json) {
      var dynamicVals = json['equityVals'];  

      Map<String, String> vals = {};
      if( dynamicVals != null ) {
         dynamicVals.entries.forEach((entry) {
               vals[entry.key] = entry.value;
            });
      }
      
      return UserDoc(
         docType:      enumFromStr<DocType>( json['docType'] ?? "end", DocType.values ),
         docId:        json['docId'] ?? "",
         acceptedDate: json['acceptedDate'] ?? "",
         equityVals:   vals
         );
   }

   factory UserDoc.from(p) {

      return UserDoc(
         docType:      p.docType,
         docId:        p.docId,
         acceptedDate: p.acceptedDate,
         equityVals:   p.equityVals
         );
   }

   String toString() {
      String res = "";
      res += "\n   Document type: " + enumToStr( docType );
      res += "\n   Document id: " + docId;
      res += "\n   Date accepted:" + acceptedDate;
      res += "\n" + equityVals.toString();

      return res;
   }
}
