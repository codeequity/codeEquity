import 'dart:math';
import 'package:collection/collection.dart';      // list equals, firstwhereornull

import 'package:ceFlutter/models/equity.dart';

import 'package:ceFlutter/components/equityTree.dart';
import 'package:ceFlutter/components/equityNode.dart';
import 'package:ceFlutter/components/equityLeaf.dart';

Function listEq = const ListEquality().equals;

class EquityPlan {

   final String        ceProjectId;   // Summaries are per ceProject.. this is the pkey
   List<List<String>>  categories;    // e.g. [[ Software Contributions, Data Security], ... ]
   List<int>           amounts;       // e.g. [ 1000000, ... ]  
   String              lastMod;       // XXX unused.

   EquityPlan({ required this.ceProjectId, required this.categories, required this.amounts, required this.lastMod }) {
      assert( categories.length == amounts.length );
   }

   dynamic toJson() => { 'ceProjectId': ceProjectId, 'categories': categories, 'amounts': amounts, 'lastMod': lastMod };
   
   factory EquityPlan.fromJson(Map<String, dynamic> json) {

      return EquityPlan(
         ceProjectId:   json['CEProjectId'],
         categories:    json['Categories'],
         amounts:       json['Amounts'],
         lastMod:       json['LastMod'],
         );
   }

   // Meant for use ONLY when first building tree
   List<Equity> initializeEquity( ) {

      List<Equity> res = [];
      for( int i = 0; i < categories.length; i++ ) {
         Equity eq = new Equity( category: categories[i], amount: amounts[i] );
         res.add( eq );
      }
      return res;

   }

   // rebuild categories based on dfs walk of tree.
   void updateEquity( EquityTree? tree ) {
      if( tree == null ) { return; }

      List<EquityTree> treeList = tree.depthFirstWalk( [] );

      categories = [];
      amounts = [];

      for( int i = 0; i < treeList.length; i++ ) {
         EquityTree t = treeList[i];
         if( t.getTitle() != "Category" ) { // XXX formalize
            if( t is EquityNode)      { categories.add( t.getPath( t.parent, t.getTitle() ) ); }
            else if( t is EquityLeaf) { categories.add( t.getPath( t.parent, t.getTitle() ) ); }
            
            amounts.add( t.getAmount() );
         }
      }

      print( "updateEquity done" + categories.toString() );
      
   }

   // XXX indent, unindent, move are nearly identical.  Fix.
   void indent( int myIndex, EquityTree tree ) {
      print( "Indent." );
      assert( categories.length == amounts.length );

      print( "Indent " + myIndex.toString() );

      // Account for header.  Categories does not have Top of Tree (header).  Indexes come from UI, which does have header.
      myIndex -= 1;
      assert( myIndex < categories.length );

      // Get major elements here.  Tree/node/leaf should not see index.
      EquityTree? target = tree.findNode( categories[myIndex] );
      assert( target != null );

      EquityTree? destPrev = null;
      if( myIndex > 0 ) { destPrev = tree.findNode( categories[myIndex-1] ); }
      
      (tree as EquityNode).indent( target!, tree!, destPrev );
   }

   void unindent( int myIndex, EquityTree tree ) {
      print( "Unindent." );
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

   
   String toString() {
      String res = "\n" + ceProjectId + " last modified: " + lastMod;
      for( int i = 0; i < categories.length; i++ ) {
         res += "   " + amounts[i].toString() + " " +  categories[i].toString() + "\n";
      }
      return res;
   }

}
