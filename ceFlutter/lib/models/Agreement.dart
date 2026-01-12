import 'package:ceFlutter/utils/ceUtils.dart';

enum DocType   { privacy, equity, end }

class Agreement {
   String  id;
   String  title;
   DocType type;
   String  format;
   String  lastMod;
   String  content;
   String  version;

   Agreement( { required this.id, required this.title, required this.type, required this.format, required this.lastMod, required this.content, required this.version } );
   
   dynamic toJson() {
      return { 'id': id, 'title': title, 'type': type, 'format': format, 'lastMod': lastMod, 'content': content, 'version': version };
   }

   // Nothing found.  return empty 
   factory Agreement.empty() {
      return Agreement(
         id:        "", 
         title:     "", 
         type:      DocType.end,
         format:    "",
         lastMod:   "",
         content:   "",
         version:   ""
         );
   }
   
   factory Agreement.fromJson(Map<String, dynamic> json) {

      String format = json['Format'];
      String content = "";

      // XXX nope docx
      if( format == "pdf" ) {
         print( "ook, go equity" );
         content = json['Document'];         
      }
      else if( format == "txt" ) {
         content = json['Document'];
      }
      
      return Agreement(
         id:      json['AgreementId'],
         title:   json['Title'] ?? "",
         type:    enumFromStr<DocType>( json['AgmtType'], DocType.values ),
         format:  format,
         lastMod: json['Last Updated'] ?? "",
         content: content,
         version: json['Version'] ?? "",
         );
   }

   factory Agreement.from(p) {

      return Agreement(
         id:      p.id,
         title:   p.title,
         type:    p.type,
         format:  p.format,
         lastMod: p.lastMod,
         content: p.content,
         version: p.version,
         );
   }

   String toString() {
      String res = "";
      res += "\n   Agreement " + title + ", type: " + enumToStr( type );
      res += "\n   Document id: " + id;
      res += "\n   Last modified: " + lastMod;

      return res;
   }
}
