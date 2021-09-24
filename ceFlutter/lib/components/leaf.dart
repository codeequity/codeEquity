import 'package:flutter/material.dart';

import 'package:ceFlutter/utils.dart';
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
   Tree findNode( String target ) { return null; }
   
   
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
   List<List<Widget>> getCurrent( BuildContext context ) {

      List<List<Widget>> nodes = [];
      if( !isVisible ) { return nodes; }

      String alloc  = addCommas( getAllocAmount() );
      String plan   = addCommas( getPlanAmount() );
      String pending = addCommas( getPendingAmount() );
      String accrue = addCommas( getAccrueAmount() );
      
      List<Widget> anode = [];
      anode.add( this );
      anode.add( Text( alloc, maxLines: 1, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)));
      anode.add( Text( plan, maxLines: 1, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)));
      anode.add( Text( pending, maxLines: 1, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)));
      anode.add( Text( accrue,maxLines: 1, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)));
      
      nodes.add( anode );

      return nodes;
   }

  @override
  setVis( visible ) {
     print( "Leaf vis" );
     isVisible = visible;
  }
  
  @override
  Widget render(BuildContext context) {
     String amounts = addCommas( allocAmount ) + " " + addCommas( planAmount ) + " " + addCommas( pendingAmount ) + " " + addCommas( accrueAmount );
     final height = 50.0;

     return Container(
        width: width,
        height: height,
        child: ListTile(
           title: details,
           trailing: Text( amounts, style: TextStyle(fontSize: 12) ),
           dense: true
           ));
  }

  @override
  Widget build(BuildContext context) {
    return render(context);
  }
}
