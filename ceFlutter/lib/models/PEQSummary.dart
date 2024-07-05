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

   late Map<String, int>       catIndex;      // index from category string to index into allocations list.   TRANSIENT
   late Map<String, List<int>> peqIndex;      // index from peq id to a list of indices into allocations.     TRANSIENT
   
   PEQSummary({ required this.id, required this.ceProjectId, required this.targetType, required this.targetId, required this.lastMod, required this.allocations }) {
      catIndex = new Map<String, int>();
      peqIndex = new Map<String, List<int>>();
      
      for( Allocation a in allocations ) {
         addAlloc( a, fromCopy: true ); 
      }
   }
            
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

   addAlloc( Allocation a, {fromCopy: false} ) {
      int index = allocations.length;

      if( fromCopy )   { index = allocations.indexOf( a ); }
      else             { allocations.add( a ); }
      
      // index 1
      final String cat = a.category.toString();
      assert( !catIndex.containsKey( cat ) );
      catIndex[cat] = index;

      print( "PES addAlloc " + cat + " " + index.toString() );
      print( catIndex.toString() );

      // index 2
      assert( a.sourcePeq != null );
      assert( a.sourcePeq!.keys.length == 1 ); // XXX right?
      for( final peqId in a.sourcePeq!.keys ) {
         if( peqIndex[peqId] == null )                  { peqIndex[ peqId ] = [ index ];  }  // no allocations for peq 13
         else if( !peqIndex[peqId]!.contains( peqId ) ) { peqIndex[ peqId ]!.add( index ); }  // peq 13 has allocations, add this one too
      }
   }

   removeAlloc( Allocation a ) {
      final index = allocations.indexOf( a );
      assert( index != -1 );

      allocations.remove( a );

      // index 1
      final String cat = a.category.toString();
      assert( catIndex.containsKey( cat ) );
      catIndex.removeWhere((key, value) => key == cat );

      // index 2
      assert( a.sourcePeq != null );
      for( final peqId in a.sourcePeq!.keys ) {
         assert( peqIndex[peqId] != null );
         if( peqIndex[peqId]!.length == 1 ) { peqIndex.removeWhere((key, value) => key == peqId ); }
         else                               { peqIndex[peqId]!.remove( index ); }
      }
      
   }

   
   
   Allocation? getByCategory( String cat ) {
      if( catIndex.containsKey( cat ) ) {

         print( "PES GetByCat " + cat + " " + allocations.length.toString() );
         print( catIndex.toString() );
         
         
         assert( allocations.length > catIndex[ cat ]! );
         return allocations[ catIndex[ cat ]! ];
      }
      else{
         return null;
      }
   }

   List<Allocation> getByPeqId( String peqId ) {
      List<Allocation> retVal = [];
      
      if( peqIndex.containsKey( peqId )) {
         for( var pid in peqIndex[ peqId ]! ) {
            assert( allocations.length > pid );
            retVal.add( allocations[pid] ); 
         }
      }
      return retVal;
   }

   
   String toString() {
      String res = "\n" + ceProjectId + " last modified: " + lastMod;
      res += "\n     Summary for " + targetType + ": " + targetId;
      allocations.forEach((alloc) => res += "\n     " + alloc.toString() );
      return res;
   }

}
