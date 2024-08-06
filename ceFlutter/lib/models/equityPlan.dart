import 'dart:math';
import 'package:collection/collection.dart';      // list equals, firstwhereornull

Function listEq = const ListEquality().equals;

// ceFlutter use only

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

   List<dynamic> _getHeritage( myIndex ) {
      List<String> myCat = categories[ myIndex ];
      int ancestorDepth  = myCat.length - 1;

      List<int> kids = [];
      for( int i = myIndex + 1; i < categories.length; i++ ) {
         List<String> kid = categories[i];
         if( listEq( kid.sublist( 0, kid.length - 1 ), myCat ) ) { kids.add( i ); }
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
   //
   // currently, grandkids are left behind.  Needs to be recursive, so need both newHomeIndex and parent.  parent is easy...  return newHomeIndex?
   int unindent( int myIndex, {String parent = "", int newHomeIndex = -1} ) {
      assert( myIndex < categories.length );
      if( myIndex == 0 ) { return -1; }

      List<String> myCat = categories[ myIndex ];
      if( myCat.length <= 1 ) { return -1; }
      
      List<dynamic> h    = this._getHeritage( myIndex );
      int ancestorDepth  = h[0];
      List<int> kids     = new List<int>.from( h[1] );

      // I'm now a sibling of my former parent.  move above parent.  Need to be above parent's other progeny
      if( parent == "" ) {
         assert( newHomeIndex == -1 );
         // Remove immediate parent.  myCat is at least length 2 here.
         parent = categories[ myIndex ].removeAt( myCat.length - 2 );
         myCat  = categories[ myIndex ];
         print( "Post unindent: " + myCat.toString() + " removed " + parent );
         
         newHomeIndex         = myIndex - 1;
         List<String> newHome = categories[ newHomeIndex ];
         // while newHome not my parent, move up. 
         while( newHome.contains( parent ) ) {
            newHomeIndex -= 1;
            if( newHomeIndex == -1 ) { break; }
            newHome = categories[ newHomeIndex ];
         }
      }
      else {
         categories[ myIndex ].remove( parent );
      }
      
      // right after first category that did not include parent
      newHomeIndex += 1;  
      this.move( myIndex, newHomeIndex, simple:true );

      // Kids for unindent need to remove the parent, and follow the move.
      kids.forEach( (k) {
            print( "Unindenting children from " + k.toString() + " to " + newHomeIndex.toString() );
            newHomeIndex = this.unindent( k, parent: parent, newHomeIndex: newHomeIndex );
         });
      return newHomeIndex;
   }
   
   int move( int oldIndex, int newIndex, {bool simple = false} ) {
      assert( categories.length == amounts.length );
      assert( oldIndex < categories.length );
      assert( newIndex <= categories.length );

      List<dynamic> h = this._getHeritage( oldIndex );
      List<int> kids  = new List<int>.from( h[1] );
      
      var tmpCat = categories.removeAt( oldIndex );
      var tmpAmt = amounts.removeAt( oldIndex );

      if( oldIndex < newIndex ) { newIndex -= 1; }
      
      categories.insert( newIndex, tmpCat );
      amounts.insert( newIndex, tmpAmt );

      // original ancestry is replaced with that of newIndex - 1, treated as a sibling
      // unindent will handle ancestry itself.
      if( !simple ) {
         if( newIndex - 1 >= 0 ) {
            List<String> sibling = categories[newIndex-1];
            String cat = categories[newIndex].last;
            categories[newIndex] = sibling.sublist(0, sibling.length - 1);
            categories[newIndex].add( cat );
         }
      
         // Kids need to follow the move
         kids.forEach( (k) {
               // If moving up, parent shifted from closer to position 0 to closer to position 0, so no impact on kids
               // If moving down (i.e. old < new ) we remove first so kids and newHome all move towards position 0
               if( oldIndex < newIndex ) {
                  k -= 1;
                  newIndex -= 1;
               }
               print( "Moving child from " + k.toString() + " to " + newIndex.toString() );
               newIndex = this.move( k, newIndex + 1 );
            });
      }

      return newIndex;
   }
   
   String toString() {
      String res = "\n" + ceProjectId + " last modified: " + lastMod;
      for( int i = 0; i < categories.length; i++ ) {
         res += "   " + amounts[i].toString() + " " +  categories[i].toString();
      }
      return res;
   }

}
