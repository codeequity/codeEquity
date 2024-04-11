import 'package:ceFlutter/models/allocation.dart';

// ceFlutter use only

// No source here - only project owner / founder has perms to do this, and
// each individual grant is stored with full metadata
// Summaries stored for each project, and separately herein each contributor
class PEQSummary {
   final String           id;
   final String           ceProjectId;   // Summaries are per ceProject
   final String           targetType;    // "ceProject", "repo", "contributor"   XXX currently unused.
   final String           targetId;      // HostProjectId ... ?  or repo now?    XXX
         String           lastMod;
   final List<Allocation> allocations;   

   PEQSummary({ required this.id, required this.ceProjectId, required this.targetType, required this.targetId, required this.lastMod, required this.allocations });
            
   dynamic toJson() => { 'id': id, 'ceProjectId': ceProjectId, 'targetType': targetType, 'targetId': targetId,
                            'lastMod': lastMod, 'allocations': allocations };
   
   factory PEQSummary.fromJson(Map<String, dynamic> json) {

      // Allocations in dynamo is list<map<string>>
      List<Allocation> allocs = [];
      var dynamicAlloc = json['Allocations'];  
      dynamicAlloc.forEach((m) { allocs.add( Allocation.fromJson( m ) ); });
      
      return PEQSummary(
         id:            json['PEQSummaryId'],
         ceProjectId:   json['CEProjectId'],
         targetType:    json['TargetType'],
         targetId:      json['TargetId'],
         lastMod:       json['LastMod'],
         allocations:   allocs
         );
   }
   
   String toString() {
      String res = "\n" + ceProjectId + " last modified: " + lastMod;
      res += "\n     Summary for " + targetType + ": " + targetId;
      allocations.forEach((alloc) => res += "\n     " + alloc.toString() );
      return res;
   }

}
