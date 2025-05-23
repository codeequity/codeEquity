import 'package:flutter/material.dart';

import 'package:ceFlutter/utils/ceUtils.dart';

// modeled after composition pattern here:
// https://medium.com/flutter-community/flutter-design-patterns-4-composite-23473cccf2b3
abstract class EquityTree with treeUtils {

   EquityTree?      findNode( List<String> target ); 
   List<EquityTree> depthFirstWalk( List<EquityTree> treeList );

   void setTitle( String newT ); 
   void setAmount( int newA ); 
   void setParent( EquityTree newP ); 
   void setHostName( String newHN );
   
   int    getAmount();
   int    getChildrenAmount();
   String getTitle();
   EquityTree? getParent();
   String getHostName();
   bool getIsTOT();
      

   List<EquityTree> getLeaves();
   void insertLeaf( target, int index );
   double getWidth();
   String toStr();
   EquityTree convertToNode();

   void delete();

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
      // Category is used to denote Top of Tree.  This is not user-facing.  Should NOT use getIsTOT here, as we are not checking self.
      if( title != "Category" ) {  res.add( title ); }   
      return res;
   }
     
   String getPathName( parent, title ) {
     List<String> p = this.getPath( parent, title );
     return this.convertFromPath( p ); 
   }

   void indent( self, tot, destPrev ) {
      print( self.getTitle() + " indent" );

      // print( "self " + self.toStr() );
      // print( "prev " + destPrev.toStr() );
      
      // indent 0th leaf of TOT?  No-op.
      // indent when destPrev is already parent?  No-op.
      if( destPrev == tot || self.parent == destPrev ) {
         print( "Can't be a grandkid without a parent.  No-op." );
         return;
      }
      // otherwise the ancestor of destPrev which is the sibling to self becomes the new parent.
      else {
         // siblings share parents.
         assert( destPrev != null );
         EquityTree oldParent = destPrev.getParent();
         EquityTree newParent = destPrev;
         assert( oldParent != null );

         // is destPrev already a sibling, or already a child of top of tree?
         if( oldParent == self.parent || oldParent == tot ) {
            print( "Already found sib." );
            // make sure it's a node
            newParent = newParent.convertToNode();
         }
         // destPrev is lower in the hierarchy.  Check ancestors.
         else { 
            while( oldParent != self.parent && oldParent != tot ) {
               newParent = oldParent;
               oldParent = oldParent.getParent()!;
            }
         }
         assert( newParent != null );
         // print( "newParent " + newParent!.toStr() );
         
         // Remove from old loc
         if( self.parent != null ) { self.parent.leaves.remove( self ); }

         // Add to new loc
         newParent!.insertLeaf( self, newParent.getLeaves().length );
         self.parent = newParent;
      }
   }
      
   void unindent( self, tot, destPrev ) {
      print( self.getTitle() + " unindent" );
      EquityTree? newParent = null;
      int dpIndex           = 0;
      
      // unindent leaf of TOT? No-op.
      if( destPrev == null || destPrev == tot || self.parent == tot) {
         print( "Can't replace top of tree.  No-op." );
         return;
      }
      // if destPrev is parent, destPrev becomes sib
      else if( destPrev == self.parent ) {
         assert( destPrev != null );
         assert( destPrev.parent != null );
         print( "parent becomes sibling" );

         EquityTree newSib = destPrev;
         if( newSib == tot ) { print( "Already at top of tree.  No-op." );  return;}
         newParent = newSib.getParent(); 
         assert( newParent != null );

         // Find insertion point
         dpIndex = newParent!.getLeaves().indexOf( newSib ) + 1; 
      }
      // otherwise find the ancestor of destPrev that is the parent of self.  That will become new sibling
      else {
         assert( destPrev != null );
         assert( destPrev.parent != null );
         EquityTree oldParent = destPrev;
         newParent = destPrev.parent;
         
         while( oldParent != self.parent && newParent != tot ) {
            oldParent = newParent!;
            newParent = newParent!.getParent()!;
         }
         assert( newParent != null );
         
         // Find insertion point.  One after oldParent's position in leaves of newParent.
         var npl = newParent!.getLeaves();
         dpIndex = npl.length;
         for( int i = 0; i < dpIndex; i++ ) {
            if( npl[i].getTitle() == oldParent.getTitle() ) {
               dpIndex = i+1;
               // print( "Found new position at " + dpIndex.toString() );
               break;
            }
         }

         // Rename if new siblings have identically named one.
         for( int i = 0; i < npl.length; i++ ) {
            // print( " .... checking " + npl[i].getTitle() + " " + self.getTitle() );
            if( npl[i].getTitle() == self.getTitle() ) {
               print( "Found identically named child.  Adding random tag to avoid this" );
               npl[i].setTitle( npl[i].getTitle() + " " + randAlpha( 10 ));
               break;
            }
         }
      }

      // Remove from old loc
      if( self.parent != null ) { self.parent.leaves.remove( self ); }

      // sanitize dpIndex.  If bounce out because reach tot above, will already be in leaves, will be removed above.
      dpIndex = dpIndex > newParent!.getLeaves().length ? newParent!.getLeaves().length : dpIndex;
      
      // Add to new loc, right after destPrev
      newParent!.insertLeaf( self, dpIndex );
      self.parent = newParent;
   }
      
   // progeny come along for free
   void moveTo( self, tot, destPrev, destNext ) {
      print( self.getTitle() + " moveTo " );

     int dpIndex = 0;
     EquityTree? newParent = null;
     
     // Move to beginning?  This becomes first leaf of TOT
     if( destPrev == null ) {
        print( "   null parent" );
        newParent = tot;
     }
     // Move to end?  Same as Move as sibling to destPrev.parent
     // Move as sibling?  i.e. destNext is not first child of destPrev?  move as sibling to destPrev.
     else if( destNext == null ||
              destNext.parent != destPrev || destPrev.leaves.length <= 0 || destNext != destPrev.leaves[0] ) {
        
        print( "Move as sibling" );
           
        // Get new parent.  
        if( destNext == null ) {
           if( destPrev.parent == null ) {
              newParent = tot;
              dpIndex = newParent!.getLeaves().indexOf( destPrev ) + 1; 
           }
           else if( destPrev.parent == tot ) {
              // Bottom of the list
              newParent = tot;
              dpIndex = newParent!.getLeaves().length;
           }
           else {
              newParent = destPrev.parent;
              dpIndex = newParent!.getLeaves().indexOf( destPrev ) + 1;
           }
        }
        else {
           newParent = destNext.parent;
           dpIndex = newParent!.getLeaves().indexOf( destNext ); // go before destNext
        }

        // print( "Pre-repair index into children of new parent: " + dpIndex.toString() + destPrev.parent.getTitle() );
        // If moving within same node, dpIndex can exceed leaf length.  repair.
        // also, if was already in front of destNext, index will overshoot by 1
        if( self.parent == newParent ) {
           dpIndex = dpIndex > newParent.getLeaves().length ? dpIndex - 1 : dpIndex;
           int selfIndex = newParent!.getLeaves().indexOf( self );
           if( selfIndex <= dpIndex ) { dpIndex -= 1; }
        }
        
        assert( dpIndex <= newParent.getLeaves().length );
        dpIndex = dpIndex > newParent.getLeaves().length ? dpIndex - 1 : dpIndex;
        
        assert( newParent != null );
     }
     // Move as child?  i.e. destNext is the first child of destPrev
     else {
        print( "Move as child " );
        assert( destNext.parent == destPrev );

        // Can't move into your own progeny... path includes self - remove it
        List<String> path = getPath( destPrev.parent, self.getTitle() );
        if( path.length > 0 ) { path.removeLast(); }
        if( path.contains( self.getTitle() )) {
           print( "Can not become a child of your progeny.  Reincarnation is NYI.  No-op." );
           return;
        }
        
        // Get new parent
        newParent = destPrev;
        assert( newParent != null );

        // Make sure new parent is node, not leaf
        newParent = newParent!.convertToNode();
        assert( newParent != null );
        assert( newParent!.getLeaves().length > 0 );
     }

     dpIndex = dpIndex == -1 ? 0 : dpIndex;
     // print( "New parent " + newParent!.toStr() );
     // print( "New index " + dpIndex.toString() + "\n" );

     if( newParent == self ) {
        print( "Can not become a child of yourself.  Umm.  Unless you try harder.  No-op." );
        return;
     }
     
     // Remove from old loc
     if( self.parent != null ) { self.parent.leaves.remove( self ); }

     // Add to new loc
     newParent!.insertLeaf( self, dpIndex );
     self.parent = newParent;
  }

      
}
