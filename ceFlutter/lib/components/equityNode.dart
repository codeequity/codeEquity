import 'package:flutter/material.dart';
import 'dart:math';

import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/components/equityTree.dart';
import 'package:ceFlutter/components/equityLeaf.dart';


class EquityNode extends StatelessWidget with treeUtils implements EquityTree {
      
   String title;
   int amount;
   String hostName;

   final bool TOT; 
   final double width;
   final bool header;
   int  currentDepth;   // for indentation
 
   late String path;

   List<EquityTree> leaves = [];
   EquityTree? parent; 
   
   AppState? appState;
   
   EquityNode(this.title, this.amount, this.hostName, this.parent, this.width, {this.header = false, this.currentDepth = 0, this.TOT = false} ) {
   path = "";
   }
   
  void addLeaf(EquityTree leaf ) {
    leaves.add( leaf );
  }

  @override
  void setTitle( String newT ) { title = newT; }
  @override
  void setAmount( int newA ) { amount = newA; }
  @override
  void setParent( EquityTree newP ) { parent = newP; }
  @override
  void setHostName( String newHN ) { hostName = newHN; }

  @override
  bool getIsTOT() { return TOT; }
  @override
  EquityTree? getParent() { return parent; }
  @override
  double getWidth() { return width; }
  @override
  List<EquityTree> getLeaves() { return leaves; }
  @override
  void insertLeaf( target, int index ) { leaves.insert( index, target );  }
     
  @override
  EquityTree? findNode( List<String> target ) {
     EquityTree? res = null;
     if( getPathName( parent, getTitle() ) == convertFromPath(target) ) { res = this; }
     // print( "   checking " + getPathName( parent, getTitle()) + " for " + convertFromPath(target) );

     if( res == null ) {
        for( var leaf in leaves ) {
           res = leaf.findNode( target );
           if( res != null ) { break; }
        }
     }
     return res;
  }

  @override
  List<EquityTree> depthFirstWalk( List<EquityTree> treeList ) {
     treeList.add( this );
     // print( "DFSWalk " + getTitle() + " " + treeList.length.toString() );
     for( var leaf in leaves ) {
        // print( "  dfs leaf walk " + leaf.getTitle() );
        treeList = leaf.depthFirstWalk( treeList ); 
     }
        
     return treeList;
  }

  // Already a node.
  @override
  EquityTree convertToNode() {
     return this;
  }
     
  @override
  String getTitle() { return title; }
  @override
  String getHostName() { return hostName; }

  @override
  int getAmount() {
     // Unlike the other amounts, which are independently summed, allocations are dependent in a top-down hierarchy.
     // For example, if githubOps is allocated 2m, and a child card (say, testing) is allocated 500k, the top level allocation is 2m.
     //              This is because the child card allocation is meant to be a part of the overall alloc for githubOps.
    var psum = amount;

    return psum;
  }
     
  @override
  int getChildrenAmount() {
     // Does not collect grandkids.. they will be checked when get amounts of kids separately.
     var csum = 0;
     leaves.forEach((EquityTree leaf) => csum += leaf.getAmount());
     return csum;
  }

  @override  // toString overrides diagnostic... blarg
  String toStr() {
     String res = "";
     res += "\nNODE: " + title;
     res += "\n   has " + leaves.length.toString() + " leaves";
     res += "\n   with amount: " + addCommas( getAmount() ) ;
     res += "\n   parent: " + ( parent == null ? "??" : parent!.getTitle() );

     res += "\n   leaves:";
     leaves.forEach( (l) => res += l.getTitle() + " " );
     
     // leaves.forEach((EquityTree leaf ) => res += leaf.toStr() );

     return res;
  }

  @override
  void delete() {

     // Should not see this.
     if( parent == null ) {
        print( "Can not delete top of tree.  No-op." );
        return;
     }

     int index = parent!.getLeaves().indexOf( this );
     assert( index > -1 );
     
     // remove self from parent's leaves
     parent!.getLeaves().remove( this );
     
     // reparent children
     leaves.forEach( (l) {
           parent!.insertLeaf( l, index );
           index += 1;
           l.setParent( parent! );            
        });
  }

     
  @override
  Widget build(BuildContext context) {

     return Container( width: 1, height: 1 );
  }
}
