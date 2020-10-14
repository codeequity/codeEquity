import 'package:flutter/material.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/components/tree.dart';

// Leave room for icons for later - may help to clarify equity tables
class Leaf extends StatelessWidget implements Tree {
  final String title;
  final int amount;
  final double width; 
  final IconData icon;

  const Leaf(this.title, this.amount, this.width, this.icon);

  @override
  String getTitle() { return title; }

  @override
  int getAmount() { return amount; }

  @override
  Tree findNode( String target ) {
     return null;   
  }

  @override
  String toStr() {
     String res = "";
     res += "\n   LEAF: " + title;
     res += "\n   with amount: " + addCommas( amount ) + " PEQ";
     return res;
  }
  
  @override
  Widget render(BuildContext context) {
     return Padding(
       padding: const EdgeInsets.only(left: 15.0),  // XXX
       child: ListTile(
          //leading: icon == null ? Container() : Icon(icon),
          title: makeBodyText( title, width, false, 1 ),
          trailing: Text( addCommas( amount ), style: TextStyle(fontSize: 12) ),
          dense: true
          ));
  }

  @override
  Widget build(BuildContext context) {
    return render(context);
  }
}
