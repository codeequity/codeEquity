import 'package:flutter/material.dart';
import 'dart:math';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/components/equityTree.dart';

// Leave room for icons for later - may help to clarify equity tables
class EquityLeaf extends StatelessWidget with paths implements EquityTree {
   final String title;
   final int    amount;
   final List<Widget> tile ;
   final EquityTree parent;
      
   final double width;

   AppState? appState;
   
   EquityLeaf(this.title, this.amount, this.tile, this.parent, this.width){}

   @override
   String getTitle() { return title; }
   
   @override
   int getAmount()  { return amount; }


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

   @override
   List<List<Widget>> getCurrent( container, {treeDepth = 0, ancestors = ""} ) {
      appState     = container.state;
      assert( appState != null );
     
      final numWidth = width / 3.0;
      final height   = appState!.CELL_HEIGHT;

      List<List<Widget>> nodes = [];

      // Erm..
      int amountInt = getAmount();
      String amt   = addCommas( amountInt );
      
      List<Widget> anode = [];
      anode.addAll( getTile() );
      nodes.add( anode );

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
