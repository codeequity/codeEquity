import 'dart:collection';              // hashset

import 'package:ceFlutter/models/Allocation.dart';
import 'package:ceFlutter/models/PEQ.dart';

// ceFlutter use only

// No source here - only project owner / founder has perms to do this, and
// each individual grant is stored with full metadata
// Summaries stored for each project, and separately herein each contributor
class PEQSummary {
   final String           ceProjectId;   // Summaries are per ceProject.. this is the pkey
   final String           targetType;    // "ceProject", "repo", "contributor"   XXX currently unused.
   final String           targetId;      // HostProjectId ... ?  or repo now?    XXX currently unused.
         String           lastMod;
   final Map<String, Allocation> allocations;   // gives fast lookup from category string to allocation
   int                    accruedTot;    // how many peqs have accrued
   int                    taskedTot;     // how many peqs have been planned out (i.e. exist in PLAN, PROG, or PEND)
   
   final List<Allocation> jsonAllocs;           // AWS data.  need index to exist before converting to allocations. TRANSIENT
   late  Map<String, HashSet<String>> peqIndex; // index from peqId to a hash set of category string for allocs.     TRANSIENT

   
   PEQSummary({ required this.ceProjectId, required this.targetType, required this.targetId, required this.lastMod, required this.allocations,
            required this.accruedTot, required this.taskedTot, required this.jsonAllocs }) {
      peqIndex = new Map<String, HashSet<String>>();
      allocations.forEach( (key, val) => addAlloc( val ) );
      for( Allocation a in jsonAllocs ) { addAlloc( a, fromJson: true ); }
      jsonAllocs.clear();
   }

   // No PS found.  return empty 
   factory PEQSummary.empty( id ) {
      return PEQSummary(
         ceProjectId: id,
         targetType: "",
         targetId: "",
         lastMod: "",
         accruedTot: 0,
         taskedTot: 0,
         allocations: {},
         jsonAllocs: [] );
   }

   
   dynamic toJson() => { 'ceProjectId': ceProjectId, 'targetType': targetType, 'targetId': targetId,
         'lastMod': lastMod, 'allocations': getAllAllocs(), 'accruedTot': accruedTot, 'taskedTot': taskedTot};
   
   factory PEQSummary.fromJson(Map<String, dynamic> json) {
      // Allocations in dynamo is list<map<string>>
      List<Allocation> allocs = [];
      var dynamicAlloc = json['Allocations'];  
      dynamicAlloc.forEach((m) { allocs.add( Allocation.fromJson( m ) ); });
      
      return PEQSummary(
         ceProjectId:   json['PEQSummaryId'],
         targetType:    json['TargetType'],
         targetId:      json['TargetId'],
         lastMod:       json['LastMod'],
         accruedTot:    json['AccruedTot'] ?? 0,
         taskedTot:     json['TaskedTot'] ?? 0,
         allocations:   new Map<String,Allocation>(),
         jsonAllocs:    allocs                // Can't process allocs as allocations until index exists
         );
   }

   addAlloc( Allocation a, {fromJson: false} ) {

      final String cat = a.category.toString();      
      assert( !allocations.containsKey( cat ) );
      allocations[cat] = a;

      if( a.allocType == PeqType.grant )                                       { accruedTot += a.amount ?? 0; }
      else if( a.allocType == PeqType.plan || a.allocType == PeqType.pending ) { taskedTot += a.amount ?? 0; }
      
      // index
      if( fromJson ) {
         // There must be one or more source peqs.  add each to index.
         assert( a.sourcePeq != null );
         a.sourcePeq!.keys.forEach( (peqId) {
               if( !peqIndex.containsKey(peqId))         { peqIndex[ peqId ] = HashSet<String>();  }  
               if( !peqIndex[peqId]!.contains( peqId ) ) { peqIndex[ peqId ]!.add( cat ); }       
            });
      }
      else {
         // There is only 1 sourcePeq, else would not be adding alloc
         assert( a.sourcePeq != null );
         assert( a.sourcePeq!.keys.length == 1 );
         final peqId = a.sourcePeq!.keys.first;

         // print( "AddAlloc " + cat + " " + peqId );
         // print( peqIndex.toString() );
         
         if( !peqIndex.containsKey(peqId))         { peqIndex[ peqId ] = HashSet<String>();  }  
         if( !peqIndex[peqId]!.contains( peqId ) ) { peqIndex[ peqId ]!.add( cat ); }         // peq 13 has allocations, add this one too
      }
   }

   removeAlloc( Allocation a ) {
      final String cat = a.category.toString();

      if( a.allocType == PeqType.grant )                                       { accruedTot -= a.amount ?? 0; }
      else if( a.allocType == PeqType.plan || a.allocType == PeqType.pending ) { taskedTot -= a.amount ?? 0; }
      
      assert( allocations.containsKey( cat )); 
      allocations.removeWhere((key, value) => key == cat );

      // index 
      assert( a.sourcePeq != null );
      for( final peqId in a.sourcePeq!.keys ) {
         assert( peqIndex[peqId] != null );
         if( peqIndex[peqId]!.length == 1 ) { peqIndex.removeWhere((key, value) => key == peqId ); }
         else                               { peqIndex[peqId]!.remove( cat ); }
      }
   }

   // ingest handles modification of a.amount
   removeSourcePeq( Allocation a, String peqId ) {
      assert( a.sourcePeq!.containsKey( peqId ));
      
      final String cat = a.category.toString();
      assert( peqIndex[peqId]!.contains( cat ));
      
      a.sourcePeq!.remove( peqId );
      
      peqIndex[peqId]!.remove( cat );
      if( peqIndex[peqId]!.isEmpty ) { peqIndex.remove( peqId ); }  // XXX resolve just 1
   }
   
   // ingest handles modification of a.amount.
   addSourcePeq( Allocation a, String peqId, int amount ) {
      assert( !a.sourcePeq!.containsKey( peqId ) );
      final String cat = a.category.toString();

      // print( "AddSourcePeq " + cat + " " + peqId );
      // print( peqIndex.toString() );

      a.sourcePeq![peqId] = amount;
      
      // Note: The allocation (i.e. 'cat') can exist from another peq, but the peqId may be new.
      if( !peqIndex.containsKey( peqId )) { peqIndex[ peqId ] = HashSet<String>();  }
      peqIndex[ peqId ]!.add( cat ); 
   }
   
   List<Allocation> getAllAllocs() {
      List<Allocation> retVal = [];

      allocations.forEach( (key, val) { retVal.add( val ); });
      // Need a stable ordering.  Things like IR Alloc split contain random alph id, so sort order is random.
      // remove alphId, add amount
      retVal.sort((a,b) {
            
            var astr = a.category.toString();
            if( astr.contains( " split: " )) {
               astr = astr.substring( 0, astr.indexOf( " split: " ) );
            }

            var bstr = b.category.toString();
            if( bstr.contains( " split: " )) {
               bstr = bstr.substring( 0, bstr.indexOf( " split: " ) );
            }

            astr = astr + a.amount.toString();
            bstr = bstr + b.amount.toString();
            // print( astr + " . " + bstr + " . " + astr.compareTo( bstr ).toString());
            return astr.compareTo( bstr ); 
         });
      
      return retVal;
   }
   
   Allocation? getByCategory( String cat ) {
      return allocations[cat];
   }

   List<Allocation> getByPeqId( String peqId ) {
      List<Allocation> retVal = [];
      
      if( peqIndex.containsKey( peqId )) {
         assert( !peqIndex[peqId]!.isEmpty );
         peqIndex[ peqId ]!.forEach( ( cat ) {
               assert( allocations.containsKey( cat ));
               retVal.add( allocations[ cat ]! );
            });
      }
      return retVal;
   }

   
   String toString() {
      String res = "\n" + ceProjectId + " last modified: " + lastMod;
      res += "\n     Summary for " + targetType + ": " + targetId;
      res += "\n     Accrued total: " + accruedTot.toString() + ", Tasked Total: " + taskedTot.toString();
      allocations.forEach((key, alloc) => res += "\n     " + alloc.toString() );
      return res;
   }

}
