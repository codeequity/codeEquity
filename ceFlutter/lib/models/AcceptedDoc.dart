import 'package:ceFlutter/utils/ceUtils.dart';

enum DocType   { privacy, equity, end }

class AcceptedDoc {
   DocType      docType;  
   String       docId;
   String       acceptedDate;

   AcceptedDoc( {required this.docType, required this.docId, required this.acceptedDate} );
   
   dynamic toJson() {
      return { 'docType': docType, 'docId': docId, 'acceptedDate': acceptedDate };
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
         docType:      enumFromStr<DocType>( json['DocType'], DocType.values ),
         docId:        json['docId'],
         acceptedDate: json['acceptedDate'],
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
