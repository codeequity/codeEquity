import 'package:ceFlutter/models/hostLoc.dart';


// ceFlutter use only

class Linkage {
   final String      id;
   final String      ceProjectId;
   final String      lastMod;
   final List<HostLoc> locations;   

   Linkage({ required this.id, required this.ceProjectId, required this.lastMod, required this.locations });

   // Direction is ceServer -> aws -> ceFlutter, only.            
   factory Linkage.fromJson(Map<String, dynamic> json) {

      // locations in dynamo is list<map<string>>
      List<HostLoc> locs = [];
      var dynamicAlloc = json['Locations'];  
      dynamicAlloc.forEach((m) { if( m.length >= 1 ) { locs.add( HostLoc.fromJson( m ) ); } });  // linkage can have empty maps

      return Linkage(
         id:            json['CELinkageId'],
         ceProjectId:   json['CEProjectId'],
         lastMod:       json['LastMod'],
         locations:     locs
         );
   }
   
   String toString() {
      String res = "\n  Locations for ceProject, last modified: " + lastMod;
      locations.forEach((loc) => res += "\n     " + loc.toString() );
      return res;
   }

}
