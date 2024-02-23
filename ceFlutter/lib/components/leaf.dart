import 'package:flutter/material.dart';
import 'dart:math';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/components/tree.dart';

// Leave room for icons for later - may help to clarify equity tables
class Leaf extends StatelessWidget implements Tree {
   final String title;
   final int    allocAmount;
   final int    planAmount;
   final int    pendingAmount;
   final int    accrueAmount;
   
   final IconData icon;
   final double width;
   final Widget details;
   bool isVisible;

   AppState appState;
   
   Leaf(this.title, this.allocAmount, this.planAmount, this.pendingAmount, this.accrueAmount, this.icon, this.width, this.details) {
      isVisible = false;
   }

   @override
   String getTitle() { return title; }
   
   @override
   int getAllocAmount()  { return allocAmount; }
   @override
   int getPlanAmount()   { return planAmount; }
   @override
   int getPendingAmount() { return pendingAmount; }
   @override
   int getAccrueAmount() { return accrueAmount; }
   
   @override
   Tree? findNode( String target ) { return null; }
   
   
   @override
   String toStr() {
      String res = "";
      res += "\n   LEAF: " + title;
      res += "\n   with alloc amount: " + addCommas( allocAmount ) + " PEQ";
      res += "\n   with plan amount: " + addCommas( planAmount ) + " PEQ";
      res += "\n   with pending amount: " + addCommas( pendingAmount ) + " PEQ";
      res += "\n   with accrue amount: " + addCommas( accrueAmount ) + " PEQ";
      return res;
   }

   @override
   List<List<Widget>> getCurrent( container, {treeDepth = 0, ancestors = ""} ) {
      appState     = container.state;

      final numWidth = width / 3.0;
      final height   = appState.CELL_HEIGHT;

      List<List<Widget>> nodes = [];
      if( !isVisible ) { return nodes; }

      // if( isVisible ) { print( "leaf GET CURRENT  $title mod: " + appState.expansionChanged.toString() ); }

      int allocInt = getAllocAmount();
      int planInt  = getPlanAmount();
      int pendInt  = getPendingAmount();
      int accrInt  = getAccrueAmount();
      int unallocInt = max( 0, allocInt - planInt - pendInt - accrInt );
      
      String alloc   = addCommas( allocInt );
      String plan    = addCommas( planInt );
      String pending = addCommas( pendInt );
      String accrue  = addCommas( accrInt );
      String unalloc = unallocInt == 0 ? "" : addCommas( unallocInt );
      
      List<Widget> anode = [];
      // anode.add( this );
      anode.add( getTile() );
      anode.add( makeTableText( appState, alloc,   numWidth, height, false, 1 ) );
      anode.add( makeTableText( appState, plan,    numWidth, height, false, 1 ) );
      anode.add( makeTableText( appState, pending, numWidth, height, false, 1 ) );
      anode.add( makeTableText( appState, accrue,  numWidth, height, false, 1 ) );
      anode.add( makeTableText( appState, unalloc, numWidth, height, false, 1 ) );      
      nodes.add( anode );

      return nodes;
   }

  @override
  setVis( visible ) {
     if( appState != null && appState.verbose >= 2 ) { print( "Leaf vis? $visible" ); }
     isVisible = visible;
  }

  // If this just opened, re-vis any kid that was opened before - can save open/close state this way
  @override
  reopenKids() {
     print( "Reopening previously expanded $title (leaf)" );
     isVisible = true;
  }

  
  @override
  Widget getTile() {
     // String amounts = addCommas( allocAmount ) + " " + addCommas( planAmount ) + " " + addCommas( pendingAmount ) + " " + addCommas( accrueAmount );
     final height = appState.CELL_HEIGHT;

     return Container(
        width: width,
        height: height,
        //child: details
        child: ListTile(
           title: details,
           // trailing: Text( amounts, style: TextStyle(fontSize: 12) ),
           dense: true
           )
        );
  }

  
  @override
  Widget build(BuildContext context) {
     return getTile();
  }
}
