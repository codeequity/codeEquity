import 'dart:math';
import 'package:collection/collection.dart';      // list equals, firstwhereornull

import 'package:ceFlutter/components/equityTree.dart';
import 'package:ceFlutter/components/equityNode.dart';
import 'package:ceFlutter/components/equityLeaf.dart';

Function listEq = const ListEquality().equals;
Function deepEq = const DeepCollectionEquality().equals;

class EquityPlan {

   final String        ceVentureId;   // Summaries are per ceProject.. this is the pkey
   List<List<String>>  categories;    // e.g. [[ Software Contributions, Data Security], ... ]         
   List<int>           amounts;       // e.g. [ 1000000, ... ]                                         
   List<String>        hostNames;     // host project (name) this equity line is associated with
   int                 totalAllocation; // overall allocation for this project
   String              lastMod;

   EquityPlan({ required this.ceVentureId, required this.categories, required this.amounts, required this.hostNames, required this.totalAllocation, required this.lastMod }) {
      assert( categories.length == amounts.length );
      assert( categories.length == hostNames.length );
   }

   // No EP found.  return empty 
   factory EquityPlan.empty( id ) {
      return EquityPlan(
         ceVentureId: id,
         categories: [],
         amounts: [],
         hostNames: [],
         totalAllocation: 0,
         lastMod: "" );
   }
   
   dynamic toJson() => { 'ceVentureId': ceVentureId, 'categories': categories, 'amounts': amounts, 'hostNames': hostNames, 'totalAllocation': totalAllocation, 'lastMod': lastMod };
   
   factory EquityPlan.fromJson(Map<String, dynamic> json) {

      List<List<String>> cats = [];
      var dynamicCat = json['Categories'];
      dynamicCat.forEach( (c) {
            List<String> acat = new List<String>.from( c );
            cats.add( acat ); 
         });
      
      return EquityPlan(
         ceVentureId:     json['EquityPlanId'],
         categories:      cats,
         amounts:         new List<int>.from( json['Amounts'] ),
         hostNames:       new List<String>.from( json['HostNames'] ),
         totalAllocation: json['TotalAllocation'] ?? 0,
         lastMod:         json['LastMod'],
         );
   }

   // Meant for use ONLY when first building tree
   List<Map<String,dynamic>> initializeEquity( ) {

      List<Map<String, dynamic>> res = [];
      for( int i = 0; i < categories.length; i++ ) {
         res.add( {"category": categories[i], "amount": amounts[i], "hostName": hostNames[i]} );
      }

      return res;
   }

   // Have a cat that is hostProj + col + assignee.  Add hierarchy.
   // Have eqs that are hier + hier + hier + Proj.hostProj
   List<dynamic> site( List<String> cat ) {
      List<String> newCat = new List<String>.from( cat );
      int newAlloc = -1;
      assert( newCat.length >= 1 );
      for( int i = 0; i < hostNames.length; i++ ) {
         if( newCat[0] == hostNames[i] ) {
            newCat = categories[i].sublist(0, categories[i].length - 1 ) + newCat;
            newAlloc = amounts[i];
            // print( "  resited " + cat.toString() + " into " + newCat.toString() + " with amount " + newAlloc.toString() );
            break;
         }
      }

      // Host names are only present when there are host projects.  By definition, hierarchical elements do not have an associated host project.
      // hierarch elements have been added during previous call to site.  Now, just need alloc amount.
      if( newAlloc == -1 ) {
         for( int i = 0; i < categories.length; i++ ) {
            if( newCat[0] == categories[i].last ) {
               newAlloc = amounts[i];
               // print( "  hierarchical element found, amout:  " + newAlloc.toString() );
               break;
            }
         }
      }
      
      return [newCat, newAlloc];
   }

   // rebuild categories based on dfs walk of tree.
   bool updateEquity( EquityTree? tree ) {
      if( tree == null ) { return false; }

      List<EquityTree> treeList = tree.depthFirstWalk( [] );

      List<List<String>> oldCat = new List<List<String>>.from( categories );
      List<int>          oldAmt = new List<int>.from( amounts );
      List<String>       oldHN  = new List<String>.from( hostNames );
      int                oldTA  = totalAllocation;
      
      categories = [];
      amounts    = [];
      hostNames  = [];
      totalAllocation = 0;
      
      for( int i = 0; i < treeList.length; i++ ) {
         EquityTree t = treeList[i];
         // if( t.getTitle() != "Category" ) { // Category denotes top of tree, which is not user-facing
         if( !t.getIsTOT() ) { 
            categories.add( t.getPath( t.getParent(), t.getTitle()) );
            amounts.add( t.getAmount() );
            hostNames.add( t.getHostName() );
         }
      }

      for( var t in treeList ) {
         if( t.getParent() != null && t.getParent()!.getIsTOT() ) { totalAllocation += t.getAmount(); }
      }
      
      bool changed = !deepEq( categories, oldCat ) || !listEq( amounts, oldAmt ) || !listEq( hostNames, oldHN ) || ( oldTA != totalAllocation ) ;

      
      // print( "updateEquity done.. changed? " + changed.toString() );
      return changed;
   }


   EquityTree getTarg( int myIndex, EquityTree tree ) {
      assert( categories.length == amounts.length );

      // Equity Plan does not see treeIndex, or viewIndex.  Just equityPlanIndex.  Yay equity_frame!
      assert( myIndex < categories.length );

      // Get major elements here.  Tree/node/leaf should not see index.
      EquityTree? target = tree.findNode( categories[myIndex] );
      assert( target != null );
      
      return target!;
   }

   EquityTree? getDP( int myIndex, EquityTree tree ) {
      assert( categories.length == amounts.length );

      // Equity Plan does not see treeIndex, or viewIndex.  Just equityPlanIndex.  Yay equity_frame!
      assert( myIndex < categories.length );

      EquityTree? destPrev = tree;
      if( myIndex > 0 ) { destPrev = tree.findNode( categories[myIndex-1] ); }
      
      return destPrev;
   }

   void indent( int myIndex, EquityTree tree ) {
      print( "Indent " + myIndex.toString() );

      EquityTree target   = getTarg( myIndex, tree );
      EquityTree? destPrev = getDP( myIndex, tree );
      
      (tree as EquityNode).indent( target, tree, destPrev );
   }

   void unindent( int myIndex, EquityTree tree ) {
      print( "Unindent " + myIndex.toString() );

      EquityTree target   = getTarg( myIndex, tree );
      EquityTree? destPrev = getDP( myIndex, tree );
      
      (tree as EquityNode).unindent( target, tree, destPrev );
   }

   // Move between parent and child?  Become a child of index - 1.
   // Move elsewhere?  Become a sibling of index - 1.
   void move( int oldIndex, int newIndex, EquityTree tree ) {
      assert( categories.length == amounts.length );
      assert( newIndex <= categories.length );

      print( "ep move from " + oldIndex.toString() + " to " + newIndex.toString() );

      EquityTree target = getTarg( oldIndex, tree );

      EquityTree? destParent = null;
      EquityTree? destNext   = null;
      if( newIndex > 0 )                 { destParent = tree.findNode( categories[newIndex-1] ); }
      if( newIndex < categories.length ) { destNext   = tree.findNode( categories[newIndex] ); }

      print( categories[oldIndex] );
      
      // print( "target, parent, next indices: " + oldIndex.toString() + " " + (newIndex-1).toString() + " " + newIndex.toString() );
      if( target != null )     { print( "target " + target.getTitle() ); }
      if( destParent != null ) { print( "parent " + destParent.getTitle() ); }
      if( destNext != null )   { print( "next "   + destNext.getTitle() ); }
      
      (tree as EquityNode).moveTo( target!, tree!, destParent, destNext );
   }

   int getSize() { return categories.length; }

   String toString() {
      String res = "\n" + ceVentureId + " last modified: " + lastMod;
      for( int i = 0; i < categories.length; i++ ) {
         res += "   " + amounts[i].toString() + " " +  categories[i].toString() + " for hostProject: " + hostNames[i] + "\n";
         res += "   " + "total allocation: " + totalAllocation.toString();
      }
      return res;
   }

}
