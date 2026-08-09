import 'dart:convert';  // json encode/decode

class PEQRaw {
   final String id;               // same as PEQAction:id
   final String cepid;
   final String rawReqBody;       // example use: final m = json.decode( rawReqBody ); print( m.keys ); print( m['project_card']['creator'] )

   PEQRaw({required this.id, required this.cepid, required this.rawReqBody });
            
   dynamic toJson() => {'id': id, 'cepid': cepid, 'rawReqBody': rawReqBody };

   String toDynamo() {
      Map<String,String> raw = {};
      
      raw["PEQRawId"]    = id;
      raw["CEProjectId"] = cepid;
      raw["RawBody"]     = rawReqBody;
      
      return json.encode( raw );
   }
   
   factory PEQRaw.fromJson(Map<String, dynamic> json) {

      // DynamoDB is not camelCase
      return PEQRaw(
         id:         json['PEQRawId'],
         cepid:      json['CEProjectId'],
         rawReqBody: json['RawBody'],         // start as string - rawBody can have many different types.  decode at runtime
         );
   }
   
   String toString() {
      String res = "\nPEQRaw for shared raw/action id: " + id + " from CE Project: " + cepid;
      res += "\n    " + rawReqBody.substring(0,10) + "..."; 
      return res;
   }


}

