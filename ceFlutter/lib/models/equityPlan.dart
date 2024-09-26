import 'dart:math';
import 'package:collection/collection.dart';      // list equals, firstwhereornull

import 'package:ceFlutter/components/equityTree.dart';
import 'package:ceFlutter/components/equityNode.dart';
import 'package:ceFlutter/components/equityLeaf.dart';

Function listEq = const ListEquality().equals;
Function deepEq = const DeepCollectionEquality().equals;

class EquityPlan {

   final String        ceProjectId;   // Summaries are per ceProject.. this is the pkey
   List<List<String>>  categories;    // e.g. [[ Software Contributions, Data Security], ... ]
   List<int>           amounts;       // e.g. [ 1000000, ... ]
   List<String>        hostNames;     // host project (name) this equity line is associated with
   String              lastMod;       // XXX unused.

   EquityPlan({ required this.ceProjectId, required this.categories, required this.amounts, required this.hostNames, required this.lastMod }) {
      assert( categories.length == amounts.length );
      assert( categories.length == hostNames.length );
   }

   dynamic toJson() => { 'ceProjectId': ceProjectId, 'categories': categories, 'amounts': amounts, 'hostNames': hostNames, 'lastMod': lastMod };
   
   factory EquityPlan.fromJson(Map<String, dynamic> json) {

      List<List<String>> cats = [];
      var dynamicCat = json['Categories'];
      dynamicCat.forEach( (c) {
            List<String> acat = new List<String>.from( c );
            cats.add( acat ); 
         });
      
      return EquityPlan(
         ceProjectId:   json['EquityPlanId'],
         categories:    cats,
         amounts:       new List<int>.from( json['Amounts'] ),
         hostNames:     new List<String>.from( json['HostNames'] ),
         lastMod:       json['LastMod'],
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
      categories = [];
      amounts    = [];
      hostNames  = [];
      
      for( int i = 0; i < treeList.length; i++ ) {
         EquityTree t = treeList[i];
         if( t.getTitle() != "Category" ) { // XXX formalize
            // if( t is EquityNode)      { categories.add( t.getPath( t.parent, t.getTitle() ) ); }
            // else if( t is EquityLeaf) { categories.add( t.getPath( t.parent, t.getTitle() ) ); }
            
            categories.add( t.getPath( t.getParent(), t.getTitle()) );
            amounts.add( t.getAmount() );
            hostNames.add( t.getHostName() );
         }
      }

      bool changed = !deepEq( categories, oldCat ) || !listEq( amounts, oldAmt ) || !listEq( hostNames, oldHN );
      
      print( "updateEquity done.. changed? " + changed.toString() );
      return changed;
   }

   // XXX indent, unindent, move are nearly identical.  Fix.
   void indent( int myIndex, EquityTree tree ) {
      assert( categories.length == amounts.length );

      print( "Indent " + myIndex.toString() );

      // Account for header.  Categories does not have Top of Tree (header).  Indexes come from UI, which does have header.
      myIndex -= 1;
      assert( myIndex < categories.length );

      // Get major elements here.  Tree/node/leaf should not see index.
      EquityTree? target = tree.findNode( categories[myIndex] );
      assert( target != null );

      EquityTree? destPrev = tree;
      if( myIndex > 0 ) { destPrev = tree.findNode( categories[myIndex-1] ); }
      
      (tree as EquityNode).indent( target!, tree!, destPrev );
   }

   void unindent( int myIndex, EquityTree tree ) {
      assert( categories.length == amounts.length );

      print( "Unindent " + myIndex.toString() );

      // Account for header.  Categories does not have Top of Tree (header).  Indexes come from UI, which does have header.
      myIndex -= 1;
      assert( myIndex < categories.length );

      // Get major elements here.  Tree/node/leaf should not see index.
      // print( "Categories " + categories.toString() );
      // print( "Finding " + myIndex.toString() + " " + categories[myIndex].toString() );
      EquityTree? target = tree.findNode( categories[myIndex] );
      assert( target != null );

      EquityTree? destPrev = null;
      // print( "Finding " + (myIndex-1).toString() + " " +  categories[myIndex].toString() );
      if( myIndex > 0 ) { destPrev = tree.findNode( categories[myIndex-1] ); }
      
      (tree as EquityNode).unindent( target!, tree!, destPrev );
   }

   // Move between parent and child?  Become a child of index - 1.
   // Move elsewhere?  Become a sibling of index - 1.
   void move( int oldIndex, int newIndex, EquityTree tree ) {
      assert( categories.length == amounts.length );
      assert( oldIndex <= categories.length );

      print( "move from " + oldIndex.toString() + " to " + newIndex.toString() );

      // Account for header.  Categories does not have Top of Tree (header).  Indexes come from UI, which does have header.
      oldIndex -= 1;
      newIndex -= 1;
      assert( newIndex <= categories.length );

      // Get major elements here.  Tree/node/leaf should not see index.
      EquityTree? target = tree.findNode( categories[oldIndex] );
      assert( target != null );

      EquityTree? destParent = null;
      EquityTree? destNext   = null;
      if( newIndex > 0 )                 { destParent = tree.findNode( categories[newIndex-1] ); }
      if( newIndex < categories.length ) { destNext   = tree.findNode( categories[newIndex] ); }

      
      (tree as EquityNode).moveTo( target!, tree!, destParent, destNext );
      
   }

   int getSize() { return categories.length; }

   String toString() {
      String res = "\n" + ceProjectId + " last modified: " + lastMod;
      for( int i = 0; i < categories.length; i++ ) {
         res += "   " + amounts[i].toString() + " " +  categories[i].toString() + " for hostProject: " + hostNames[i] + "\n";
      }
      return res;
   }

}
