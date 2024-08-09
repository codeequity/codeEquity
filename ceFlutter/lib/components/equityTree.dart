import 'package:flutter/material.dart';

// modeled after composition pattern here:
// https://medium.com/flutter-community/flutter-design-patterns-4-composite-23473cccf2b3
abstract class EquityTree {

   EquityTree?      findNode( List<String> target ); 
   List<EquityTree> depthFirstWalk( List<EquityTree> treeList );

   int    getAmount();
   String getTitle();
   EquityTree? getParent();
   List<EquityTree> getLeaves();
   void insertLeaf( target, int index );
   double getWidth();
   String toStr();

   // List<List<Widget>> getCurrent( container, fgd, bgd, {index=0, first:true} );

}

mixin treeUtils {

   String convertFromPath( List<String> target ) {
      String res = ""; 
      target.forEach( (s) => res = res + "/" + s );
      return res.length > 0 ? res.substring( 1 ) : res;
   }
      
   List<String> getPath( parent, title ) {
      List<String> res = [];
      if( parent != null ) {
         res = parent!.getPath( parent.parent, parent.getTitle() ); 
      }
      if( title != "Category" ) {  res.add( title ); }   // XXX formalize
      return res;
   }
     
   String getPathName( parent, title ) {
     List<String> p = this.getPath( parent, title );
     return this.convertFromPath( p ); 
  }

  // progeny come along for free
   void moveTo( self, tot, destParent, destNext ) {
      print( self.getTitle() + " moveTo " + self.parent.getTitle() );

     int dpIndex = 0;
     EquityTree? newParent = null;
     
     // Move to beginning?  This becomes first leaf of TOT
     if( destParent == null ) {
        print( "   null parent" );
        newParent = tot;
     }
     // Move to end?  Same as Move as sibling to destParent
     // Move as sibling?  i.e. destNext is not first child of destParent
     else if( destNext == null ||
         destNext.parent != destParent || destParent.leaves.length <= 0 || destNext != destParent.leaves[0] ) {

        print( "Move as sibling" );
           
        // Get new parent.  
        if( destNext == null ) {
           if( destParent.parent == null ) { newParent = tot; }   // should not occur?
           else                            { newParent = destParent.parent; }
        }
        else { newParent = destNext.parent; }
        assert( newParent != null );

        // Make sure new parent is node, not leaf
        { newParent = tot.convertToNode( newParent ); }

        // Get new loc
        dpIndex = newParent!.getLeaves().length > 0 ? newParent!.getLeaves().indexOf( destParent ) : 0;
     }
     // Move as child?  i.e. destNext is the first child of destParent
     else {
        print( "Move as child" );
        // Get new parent
        EquityTree? newParent = destNext.parent;
        assert( newParent != null );
        assert( newParent!.getLeaves().length > 0 );
     }
     
     // Remove from old loc
     if( self.parent != null ) { self.parent.leaves.remove( self ); }

     // Add to new loc
     newParent!.insertLeaf( self, dpIndex );
     self.parent = newParent;
  }

      
}
