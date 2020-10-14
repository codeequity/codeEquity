import 'package:flutter/material.dart';

import 'package:ceFlutter/utils.dart';

import 'package:ceFlutter/components/tree.dart';

class Node extends StatelessWidget implements Tree {
  final String title;
  final IconData icon;
  final bool isInitiallyExpanded;
  final double width;

  final List<Tree> leaves = List<Tree>();

  Node(this.title, this.width, this.icon, [this.isInitiallyExpanded = false] );

  void addLeaf(Tree leaf ) {
    leaves.add( leaf );
  }

  void addLeafAt(Tree leaf, leafIdx ) {
     assert( leaves.length > leafIdx );
     (leaves[leafIdx] as Node).addLeaf( leaf );
  }

  int findNode( String target ) {
     int i = 0;   // XXX
     for( var leaf in leaves ) {
        if( leaf.getTitle() == target ) {
           return i; 
        }
        i++;
     }
     return -1;
  }

  @override
  String getTitle() { return title; }
  
  @override
  int getAmount() {
    var sum = 0;
    leaves.forEach((Tree leaf) => sum += leaf.getAmount());
    return sum;
  }

  @override  // toString overrides diagnostic... blarg
  String toStr() {
     String res = "";
     res += "\nNODE: " + title;
     res += "\n   has " + leaves.length.toString() + " leaves";
     res += "\n   with amount: " + addCommas( getAmount() ) + " PEQ";

     leaves.forEach((Tree leaf ) => res += leaf.toStr() );

     return res;
  }
  
  @override
  Widget render(BuildContext context) {

     /*
     return Theme(
        data: ThemeData(
           accentColor: Colors.black,
           ),
        child: Padding(
           padding: const EdgeInsets.only(left: 15.0),  // XXX
           child: ExpansionTile(
              leading: icon == null ? Container() : Icon(icon),
              title: makeBodyText( "$title (${ addCommas( getAmount() ) })", width, false, 1 ),
              children: leaves.map((Tree leaf) => leaf.render(context)).toList(),
              initiallyExpanded: isInitiallyExpanded,
              ))
        );
     */

     // XXX consider using font for clickability?
     return Padding(
        padding: const EdgeInsets.only(left: 15.0),  // XXX
        child: ExpansionTile(
           // leading: icon == null ? Container() : Icon(icon),
           title: makeBodyText( "$title (${ addCommas( getAmount() ) })", width, false, 1 ),
           children: leaves.map((Tree leaf) => leaf.render(context)).toList(),
           // trailing: Text( addCommas( getAmount() ), style: TextStyle(fontSize: 12) ),
           initiallyExpanded: isInitiallyExpanded,
           ));

  }

  @override
     Widget build(BuildContext context) {
     return render(context);
  }
}
