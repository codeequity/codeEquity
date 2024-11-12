//import 'package:ceFlutter/utils.dart';

class PEQRaw {
   final String  id;               // same as PEQAction:id
   final String  rawReqBody;       // example use: final m = json.decode( rawReqBody ); print( m.keys ); print( m['project_card']['creator'] )

   PEQRaw({required this.id, required this.rawReqBody });
            
   dynamic toJson() => {'id': id, 'rawReqBody': rawReqBody };
   
   factory PEQRaw.fromJson(Map<String, dynamic> json) {

      // DynamoDB is not camelCase
      return PEQRaw(
         id:         json['PEQRawId'],

         rawReqBody: json['RawBody'],         // start as string - rawBody can have many different types.  decode at runtime
         );
   }
   
   String toString() {
      String res = "\nPEQRaw for shared raw/action id: " + id;
      res += "\n    " + rawReqBody.substring(0,10) + "..."; 
      return res;
   }


}

