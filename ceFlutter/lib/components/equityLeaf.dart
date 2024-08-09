import 'package:flutter/material.dart';
import 'dart:math';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/components/equityTree.dart';

// Leave room for icons for later - may help to clarify equity tables
class EquityLeaf extends StatelessWidget with treeUtils implements EquityTree {
   final String title;
   final int    amount;
   EquityTree parent;
      
   final double width;

   AppState? appState;
   
   EquityLeaf(this.title, this.amount, this.parent, this.width){}
     
   @override
   String getTitle() { return title; }
   
   @override
   int getAmount()  { return amount; }

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
      return res;
   }

      /*
   @override
     List<List<Widget>> getCurrent( container, fgd, bgd, {index = 0, first: false } ) {
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
                 children: <Widget>[ c, bgd, drag, fgd, index) ],
                 ),
              title: amountW
              )));
     

     print( "Get currentNode adding " + getTitle() );

     List<List<Widget>> nodes = [];
     nodes.add( [ catCont, tile ] );
     return nodes;
  }
      */
  
  @override
  Widget build(BuildContext context) {

     return Container( width: 1, height: 1 );

     /*
       return Container(
        child: Row( children: getTile() )
        );
     */

  }
}
