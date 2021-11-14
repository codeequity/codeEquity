import 'package:ceFlutter/models/ghLoc.dart';


// ceFlutter use only

class Linkage {
   final String      id;
   final String      ghRepo;        // reponame is form /owner/repo, so is unique
   final String      lastMod;
   final List<GHLoc> locations;   

   Linkage({ this.id, this.ghRepo, this.lastMod, this.locations });

   // Direction is ceServer -> aws -> ceFlutter, only.            
   factory Linkage.fromJson(Map<String, dynamic> json) {

      // locations in dynamo is list<map<string>>
      List<GHLoc> locs = [];
      var dynamicAlloc = json['Locations'];  
      dynamicAlloc.forEach((m) { if( m.length == 4 ) { locs.add( GHLoc.fromJson( m ) ); } });  // linkage can have empty maps

      return Linkage(
         id:            json['CELinkageId'],
         ghRepo:        json['GHRepo'],
         lastMod:       json['LastMod'],
         locations:     locs
         );
   }
   
   String toString() {
      String res = "\n  Locations for ghRepo, last modified: " + lastMod;
      locations.forEach((loc) => res += "\n     " + loc.toString() );
      return res;
   }

}
