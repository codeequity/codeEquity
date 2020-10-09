import 'package:random_string/random_string.dart';
import 'package:ceFlutter/models/allocation.dart';

// No source here - only project owner / founder has perms to do this, and
// each individual grant is stored with full metadata

// Summaries stored for each project, and separately herein each contributor

class PEQSummary {
   final String           id;
   final String           ghRepo;        // reponame is form /owner/repo, so is unique
   final String           targetType;    // "repo", "contributor"
   final String           targetId;      // ceProject:ghProjectId, PEQAction:ceUID
   final String           lastModified;
   final List<Allocation> allocations;   

   PEQSummary({ this.id, this.ghRepo, this.targetType, this.targetId, this.lastModified, this.allocations });
            
   dynamic toJson() => { 'id': id, 'ghRepo': ghRepo, 'targetType': targetType, 'targetId': targetId,
                            'lastModified': lastModified, 'allocations': allocations };
   
   factory PEQSummary.fromJson(Map<String, dynamic> json) {

      // Allocations in dynamo is list<map<string>>
      List<Allocation> allocs = [];
      var dynamicAlloc = json['Allocations'];  
      dynamicAlloc.forEach((m) { allocs.add( Allocation.fromJson( m ) ); });
      
      return PEQSummary(
         id:            json['PEQSummaryId'],
         ghRepo:        json['GHRepo'],
         targetType:    json['TargetType'],
         targetId:      json['TargetId'],
         lastModified:  json['LastModified'],
         allocations:   allocs
         );
   }
   
   String toString() {
      String res = "\n" + ghRepo + " last modified: " + lastModified;
      res += "\n     Summary for " + targetType + ": " + targetId;
      allocations.forEach((alloc) => res += "\n     " + alloc.toString() );
      return res;
   }

}
