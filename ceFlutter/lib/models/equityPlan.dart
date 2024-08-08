import 'dart:math';
import 'package:collection/collection.dart';      // list equals, firstwhereornull

import 'package:ceFlutter/models/equity.dart';

import 'package:ceFlutter/components/equityTree.dart';
import 'package:ceFlutter/components/equityNode.dart';
import 'package:ceFlutter/components/equityLeaf.dart';

Function listEq = const ListEquality().equals;

// ceFlutter use only


// XXX need walkTree to rebuild cat, amounts.  do this in getAll

class EquityPlan {

   final String              ceProjectId;   // Summaries are per ceProject.. this is the pkey
   final List<List<String>>  categories;    // e.g. [[ Software Contributions, Data Security], ... ]
   final List<int>           amounts;       // e.g. [ 1000000, ... ]  
   final String              lastMod;

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

   List<Equity> getAllEquity( EquityTree? tree ) {
      List<Equity> res = [];
      if( tree == null ) { return res; }

      List<EquityTree> treeList = tree.depthFirstWalk( [] );
      // treeList.forEach((t) => res.add( new Equity( category: t.getPath(), amount: t.getAmount() )) );

      for( int i = 0; i < treeList.length; i++ ) {
         List<String> p = [];
         EquityTree t = treeList[i];
         
         if( t is EquityNode )      { p = (t as EquityNode).getPath( t.parent, t.getTitle() ); }
         else if( t is EquityLeaf ) { p = (t as EquityLeaf).getPath( t.parent, t.getTitle() ); }
         
         res.add( new Equity( category: p, amount: treeList[i].getAmount() ));
      }
      
      return res;
   }

   void indent( int myIndex ) {
      print( "Indent." );
   }

   List<int> unindent( int myIndex, int removeCount, {String parent = "", int newHomeIndex = -1} ) {
      print( "Unindent." );
      return [-1,-1];
   }

   List<int> move( int oldIndex, int newIndex, EquityTree tree ) {
      print( "move from " + oldIndex.toString() + " to " + newIndex.toString() );

      // Account for header
      oldIndex -= 1;
      newIndex -= 1;

      EquityTree? target = tree.findNode( categories[oldIndex] ); 
      if( target != null ) {  print( "Found: " + target!.toStr() ); }
      
      return [-1,-1];
   }

   
   /*
   
   final String              ceProjectId;   // Summaries are per ceProject.. this is the pkey
   final List<List<String>>  categories;    // e.g. [[ Software Contributions, Data Security], ... ]
   final List<int>           amounts;       // e.g. [ 1000000, ... ]  
   final String              lastMod;

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

   List<dynamic> _getHeritage( myIndex, {int removeCount = 0} ) {
      List<String> myCat = categories[ myIndex ];
      int ancestorDepth  = myCat.length - 1;

      List<int> kids = [];
      for( int i = myIndex + 1; i < categories.length; i++ ) {
         List<String> kid = categories[i];
         // Kids index is adjusted for the number of items already removed during recursion for the current parent.
         // i.e. multilevel lists keep track of remove count and adjust indices below
         if( listEq( kid.sublist( 0, kid.length - 1 ), myCat ) ) {
            kids.add( i + removeCount );
         }
         else { break; }
      }

      // retval is [int, list<int>]
      return [ ancestorDepth, kids ];
   }
   
   // Indent 1 step.
   // Go backwards up hierarchy to find proper placement.  Bring your kids
   void indent( int myIndex ) {
      assert( myIndex < categories.length );
      if( myIndex == 0 ) { return; }

      List<String> myCat = categories[ myIndex ];
      List<dynamic> h    = this._getHeritage( myIndex );
      int ancestorDepth  = h[0];
      List<int> kids     = new List<int>.from( h[1] );
      
      int newHomeIndex     = myIndex - 1;
      List<String> newHome = categories[ newHomeIndex ];
      // while newHome ancestors are too deep, move up in hierarchy
      while( ( newHome.length - 1 ) > ancestorDepth ) {
         newHomeIndex -= 1;
         if( newHomeIndex < 0 ) {
            print( "Warning.  Need a parent category to indent" );
            return;
         }
         newHome = categories[ newHomeIndex ];
      }

      categories[ myIndex ] = [ ...newHome, myCat.last ];
      print( "Post indent: " + categories[ myIndex ].toString() );

      kids.forEach( (k) {
            print( "Indenting children at " + k.toString() ); 
            this.indent( k );
         });
   }

   // Unindent 1 step.
   // Go backwards up hierarchy to find proper placement.  Bring your kids
   List<int> unindent( int myIndex, int removeCount, {String parent = "", int newHomeIndex = -1} ) {
      assert( myIndex < categories.length );
      if( myIndex == 0 ) { return [-1, -1]; }

      List<String> myCat = categories[ myIndex ];
      if( myCat.length <= 1 ) { return [-1, -1]; }
      
      List<dynamic> h    = this._getHeritage( myIndex, removeCount: removeCount );
      int ancestorDepth  = h[0];
      List<int> kids     = new List<int>.from( h[1] );

      // I'm now a sibling of my former parent.  move below parent.  Need to be ouside of parent's progeny.
      // if move below, can make some positions very hard or impossible to move into.  
      if( parent == "" ) {
         assert( newHomeIndex == -1 );
         // Remove immediate parent.  myCat is at least length 2 here.
         parent = categories[ myIndex ].removeAt( myCat.length - 2 );
         myCat  = categories[ myIndex ];
         print( "Post unindent: " + myCat.toString() + " removed " + parent );
         
         newHomeIndex         = myIndex + 1 < categories.length ? myIndex + 1 : myIndex;
         List<String> newHome = categories[ newHomeIndex ];
         // move down until parent is not in ancestry, or at end of list
         while( newHome.contains( parent ) ) {
            newHomeIndex += 1;
            if( newHomeIndex == categories.length ) { break; }
            newHome = categories[ newHomeIndex ];
         }
      }
      else {
         categories[ myIndex ].remove( parent );
      }

      print( "Unindent move " + myIndex.toString() + " to " + newHomeIndex.toString() );
      this.move( myIndex, newHomeIndex, 0, justMove:true );
      if( myIndex < newHomeIndex ) { removeCount += 1; }
      
      // Kids for unindent need to remove the parent, and follow the move.
      // Parent has already moved down.  So kids are off by 1
      kids.forEach( (k) {
            k = k - removeCount;
            assert( k >= 0 );
            print( "Unindenting children from " + k.toString() + " to " + newHomeIndex.toString() );
            var res = this.unindent( k, removeCount, parent: parent, newHomeIndex: newHomeIndex );
            newHomeIndex = res[0];
            removeCount  = res[1];
         });
      return [ newHomeIndex, removeCount ];
   }
   
   List<int> move( int oldIndex, int newIndex, int removeCount, {bool justMove = false, int parent = -1} ) {
      assert( categories.length == amounts.length );
      assert( oldIndex < categories.length );
      assert( newIndex <= categories.length );

      List<dynamic> h = this._getHeritage( oldIndex, removeCount: removeCount );
      List<int> kids  = new List<int>.from( h[1] );

      print( "Kids for move from " + oldIndex.toString() + " to " + newIndex.toString() + " : "  + kids.toString() + " parent " + parent.toString() );
      var tmpCat = categories.removeAt( oldIndex );
      var tmpAmt = amounts.removeAt( oldIndex );

      // Recover indices after removal
      if( oldIndex < newIndex ) {
         newIndex    -= 1;
         removeCount += 1;
         parent      -= removeCount;
      }


      categories.insert( newIndex, tmpCat );
      amounts.insert( newIndex, tmpAmt );

      // original ancestry is replaced with that of newIndex - 1, treated as a sibling
      if( !justMove ) {
         if( parent >= 0 ) {  // moving kid, move under parent
            print( " ... parent: " + parent.toString() );
            String cat           = categories[newIndex].last;
            categories[newIndex] = categories[parent].sublist(0);   // need new lists here
            categories[newIndex].add( cat );
         }
         else if( newIndex - 1 >= 0 ) {
            // if moving between a parent and a child, cat becomes a child, not a sibling.  +1 since already inserted above
            bool parentChild = false;
            List<String> sibling = categories[newIndex-1];
            if( newIndex+1 < categories.length ) {
               List<String> nextCat = categories[newIndex+1];
               if( listEq( sibling, nextCat.sublist( 0, nextCat.length -1 ) )) {
                  print( "Moving between parent and child - will become child not sibling" );
                  parentChild = true;
               }
            }

            String cat = categories[newIndex].last;
            categories[newIndex] = parentChild ? sibling.sublist(0) : sibling.sublist(0, sibling.length - 1);
            categories[newIndex].add( cat );
         }
         else {
            // No ancestors
            assert( newIndex == 0 );
            categories[newIndex] = [ categories[newIndex].last ];
         }
      
         // Kids need to follow the move
         // If moving up, parent shifted from closer to position 0 to closer to position 0, so no impact on kids
         // If moving down (i.e. old < new ) we remove first so kids move towards position 0.
         int parentIndex = oldIndex < newIndex ? newIndex + 1 : newIndex;   // newIndex was already adjusted, and parent is further adjusted on this recursive call
         kids.forEach( (k) {
               if( oldIndex < newIndex ) { k -= removeCount; }              // this many have moved out of slots between k and 0
               assert( k >= 0 );
               print( "Moving child from " + k.toString() + " to " + (newIndex+1).toString() + " removeCount: " + removeCount.toString() );
               var res = this.move( k, newIndex + 1, removeCount, parent: parentIndex );
               newIndex    = res[0];
               removeCount = res[1];
            });
      }

      return [newIndex,removeCount];
   }
   */

   
   String toString() {
      String res = "\n" + ceProjectId + " last modified: " + lastMod;
      for( int i = 0; i < categories.length; i++ ) {
         res += "   " + amounts[i].toString() + " " +  categories[i].toString() + "\n";
      }
      return res;
   }

}
