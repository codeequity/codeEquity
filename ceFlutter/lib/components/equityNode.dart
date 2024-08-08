import 'package:flutter/material.dart';
import 'dart:math';

import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/utils.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/components/equityTree.dart';
import 'package:ceFlutter/components/equityLeaf.dart';


class EquityNode extends StatelessWidget with paths implements EquityTree {
      
   final String title;
   int amount;

   final List<Widget> tile;
   final double width;
   final bool header;
   int  currentDepth;   // for indentation
 
   final stamp; 
   late String path;

   final List<EquityTree> leaves = [];
   final EquityTree? parent; 
   
   AppState? appState;
   
   EquityNode(this.title, this.amount, this.tile, this.parent, this.width, this.stamp, {this.header = false, this.currentDepth = 0} ) {
      path = "";
  }
   
  void addLeaf(EquityTree leaf ) {
    leaves.add( leaf );
  }


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
     print( "DFSWalk " + getTitle() + " " + treeList.length.toString() );
     for( var leaf in leaves ) {
        print( "  dfs leaf walk " + leaf.getTitle() );
        treeList = leaf.depthFirstWalk( treeList ); 
     }
        
     return treeList;
  }

     
  EquityTree convertToNode( EquityLeaf child, stamp ) {
     EquityNode newNode = EquityNode( child.getTitle(), child.getAmount(), child.getTile(), child.parent, child.width, stamp );
     bool converted = false;
     
     // find and replace in list
     for( int i = 0; i < leaves.length; i++ )
     {
        if( leaves[i].getTitle() == child.getTitle() ) {
           leaves[i] = newNode;
           converted = true;
           break;
        }
     }
     assert( converted );
     return newNode;
  }

  @override
  String getTitle() { return title; }

  @override
  int getAmount() {
     // Unlike the other amounts, which are independently summed, allocations are dependent in a top-down hierarchy.
     // For example, if githubOps is allocated 2m, and a child card (say, testing) is allocated 500k, the top level allocation is 2m.
     //              This is because the child card allocation is meant to be a part of the overall alloc for githubOps.
    var psum = amount;
    var csum = 0;
    leaves.forEach((EquityTree leaf) => csum += leaf.getAmount());
    return max( psum, csum );
  }

  @override  // toString overrides diagnostic... blarg
  String toStr() {
     String res = "";
     res += "\nNODE: " + title;
     res += "\n   has " + leaves.length.toString() + " leaves";
     res += "\n   with amount: " + addCommas( getAmount() ) ;

     leaves.forEach((EquityTree leaf ) => res += leaf.toStr() );

     return res;
  }
  
  @override
  List<List<Widget>> getCurrent( container, {treeDepth = 0, ancestors = ""} ) {
     appState    = container.state;
     assert( appState != null );

     final numWidth = width / 3.0;
     final height   = appState!.CELL_HEIGHT;
     
     currentDepth = treeDepth;
     path         = ancestors + "/" + title;

     List<List<Widget>> nodes = [];

     int amountInt  = getAmount();
     String amt     = addCommas( amountInt );
        
     if( header ) {
        amt   = "Amount";
     }

     List<Widget> anode = [];
     anode.addAll( getTile( ) );
     nodes.add( anode );

     leaves.forEach( ((EquityTree child) {
              nodes.addAll( child.getCurrent(container, treeDepth: treeDepth + 1, ancestors: path ));
           }));

     return nodes;
  }

  @override
  List<Widget> getTile() {
     return tile;
  }
  
  @override
  Widget build(BuildContext context) {

     return Container(
        child: Row( children: getTile() )
        );
  }
}
