import 'package:flutter/material.dart';
import 'dart:math';

import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/utils.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/components/equityTree.dart';
import 'package:ceFlutter/components/equityLeaf.dart';


class EquityNode extends StatelessWidget with treeUtils implements EquityTree {
      
   final String title;
   int amount;

   final double width;
   final bool header;
   int  currentDepth;   // for indentation
 
   late String path;

   List<EquityTree> leaves = [];
   EquityTree? parent; 
   
   AppState? appState;
   
   EquityNode(this.title, this.amount, this.parent, this.width, {this.header = false, this.currentDepth = 0} ) {
      path = "";
   }
   
  void addLeaf(EquityTree leaf ) {
    leaves.add( leaf );
  }

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
     print( "DFSWalk " + getTitle() + " " + treeList.length.toString() );
     for( var leaf in leaves ) {
        print( "  dfs leaf walk " + leaf.getTitle() );
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
     res += "\n   parent: " + ( parent == null ? "??" : parent!.getTitle() );

     res += "\n   leaves:";
     leaves.forEach( (l) => res += l.getTitle() + " " );
     
     // leaves.forEach((EquityTree leaf ) => res += leaf.toStr() );

     return res;
  }

     /*
  @override
  // Ignore category
  List<List<Widget>> getCurrent( container, fgd, bgd, {index = 0, first = true} ) {
     appState    = container.state;
     assert( appState != null );

     int depth = getPath( parent, getTitle() ).length + 1;
     
     final  numWidth = width / 3.0;      
     final  height   = appState!.CELL_HEIGHT;
     Widget amountW  = makeTableText( appState!, addCommas( amount ), numWidth, height, false, 1 );      
     Widget cat      = makeTableText( appState, getTitle(), width, height, false, 1, mux: (depth+1) * .5 );
     Widget forward  = fgd;
     Widget back     = bgd;
     Widget drag     = ReorderableDragStartListener( index: index, child: Icon( Icons.drag_handle ) ); 
     
     Widget c        = Container( width: numWidth, height: 1 );
     Widget catCont  = Container( width: width, height: height, child: cat );
     
     Widget tile = Container(
        width: width * 2,
        height: height,
        child: ListTileTheme(
           dense: true,
           child: ListTile(
              trailing:  Wrap(
                 spacing: 0,
                 // key: new PageStorageKey(getPathName() + getTitle() + stamp),
                 children: <Widget>[ c, bgd, drag, fgd ],
                 ),
              title: amountW
              )));
     

     print( "Get currentNode adding " + getTitle() );

     List<List<Widget>> nodes = [];
     nodes.add( [ catCont, tile ] );

     if( first ) {
        // One place to walk the tree
        List<EquityTree> treeList = depthFirstWalk( [] );
        
        treeList.forEach( ((EquityTree child) {
                 index += 1;
                 nodes.addAll( child.getCurrent(container, fgd, bgd, index: index, first: false ));
              }));
     }

     return nodes;
  }
     */
  
  @override
  Widget build(BuildContext context) {

     return Container( width: 1, height: 1 );

     /*
     return Container( 
        child: Row( children: getCurrent() )
        );
     */
  }
}
