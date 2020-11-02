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

  const Leaf(this.title, this.allocAmount, this.planAmount, this.pendingAmount, this.accrueAmount, this.icon, this.width);

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
  Widget render(BuildContext context) {
     String amounts = addCommas( allocAmount ) + " " + addCommas( planAmount ) + " " + addCommas( pendingAmount ) + " " + addCommas( accrueAmount );
     return Padding(
       padding: const EdgeInsets.only(left: 15.0),  // XXX
       child: ListTile(
          //leading: icon == null ? Container() : Icon(icon),
          title: makeBodyText( title, width, false, 1 ),
          trailing: Text( amounts, style: TextStyle(fontSize: 12) ),
          dense: true
          ));
  }

  @override
  Widget build(BuildContext context) {
    return render(context);
  }
}
