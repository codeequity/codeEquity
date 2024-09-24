import 'package:flutter/material.dart';
import 'dart:math';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/components/equityTree.dart';
import 'package:ceFlutter/components/equityNode.dart';

// Leave room for icons for later - may help to clarify equity tables
class EquityLeaf extends StatelessWidget with treeUtils implements EquityTree {
   String title;
   int    amount;
   String hostName;
      
   EquityTree parent;
      
   final double width;

   AppState? appState;
   
   EquityLeaf(this.title, this.amount, this.hostName, this.parent, this.width){}
     
   @override
   String getTitle() { return title; }
   @override
   String getHostName() { return hostName; }
   
   @override
   int getAmount()  { return amount; }

   @override
   void setTitle( String newT ) { title = newT; }
   @override
   void setAmount( int newA ) { amount = newA; }
   @override
   void setParent( EquityTree newP ) { parent = newP; }
   @override
   void setHostName( String newHN ) { hostName = newHN; }

   @override
   EquityTree? getParent() { return parent; }
   @override
   double getWidth() { return width; }
   @override
   List<EquityTree> getLeaves() { assert(false); return [];}
   @override
   void insertLeaf( target, index ) { assert(false);  }

   @override
   EquityTree? findNode( List<String> target ) {
      // print( "   LEAF checking " + getPathName( parent, getTitle()) + " for " + convertFromPath(target) );
      return getPathName( parent, getTitle() ) == convertFromPath(target)  ? this : null; 
   }

   @override
   List<EquityTree> depthFirstWalk( List<EquityTree> treeList ) {
      treeList.add( this );
      return treeList;
   }

      
   @override
   String toStr() {
      String res = "";
      res += "\n   LEAF: " + title + " with amount: " + addCommas( amount );
      res += "\n   parent: " + parent.getTitle();
      return res;
   }

   @override
   EquityTree convertToNode() {
     
     EquityNode newNode = EquityNode( title, amount, hostName, parent, width );

     bool converted = false;
     
     // find and replace in list
     for( int i = 0; i < parent.getLeaves().length; i++ )
     {
        if( parent.getLeaves()[i].getTitle() == title ) {
           (parent as EquityNode).leaves[i] = newNode;
           converted = true;
           break;
        }
     }
     assert( converted );
     return newNode;
  }

  @override
  void delete() {

     // Should not see this.
     if( parent == null ) {
        print( "Can not delete top of tree.  No-op." );
        return;
     }

     // remove self from parent's leaves
     parent!.getLeaves().remove( this );
  }

  
  @override
  Widget build(BuildContext context) {

     return Container( width: 1, height: 1 );

  }
}
