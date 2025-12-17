import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/AcceptedDoc.dart';

class Agreement {
   String  id;
   DocType type;
   String  format;
   String  lastMod;
   String  content;
   String  version;

   Agreement( { required this.id, required this.type, required this.format, required this.lastMod, required this.content, required this.version } );
   
   dynamic toJson() {
      return { 'id': id, 'type': type, 'format': format, 'lastMod': lastMod, 'content': content, 'version': version };
   }

   // Nothing found.  return empty 
   factory Agreement.empty() {
      return Agreement(
         id:        "", 
         type:      DocType.end,
         format:    "",
         lastMod:   "",
         content:   "",
         version:   ""
         );
   }
   
   factory Agreement.fromJson(Map<String, dynamic> json) {

      return Agreement(
         id: json['AgreementId'],
         type: enumFromStr<DocType>( json['AgmtType'], DocType.values ),
         format: json['Format'],
         lastMod: json['Last Updated'],
         content: json['Document'],
         version: json['Version'],
         );
   }

   factory Agreement.from(p) {

      return Agreement(
         id:      p.id,
         type:    p.type,
         format:  p.format,
         lastMod: p.lastMod,
         content: p.content,
         version: p.version,
         );
   }

   String toString() {
      String res = "";
      res += "\n   Agreement type: " + enumToStr( type );
      res += "\n   Document id: " + id;
      res += "\n   Last modified: " + lastMod;

      return res;
   }
}
