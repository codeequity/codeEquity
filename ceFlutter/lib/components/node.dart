import 'package:flutter/material.dart';

import 'package:ceFlutter/utils.dart';

import 'package:ceFlutter/components/tree.dart';
import 'package:ceFlutter/components/leaf.dart';


// XXX getAmounts walking tree 3x - not necessary
class Node extends StatelessWidget implements Tree {
  final String title;
  int allocAmount;
  final IconData icon;
  
  final double width;
  final bool isInitiallyExpanded;

  final List<Tree> leaves = List<Tree>();

  Node(this.title, this.allocAmount, this.icon, this.width, [this.isInitiallyExpanded = false] );

  void addLeaf(Tree leaf ) {
    leaves.add( leaf );
  }

  @override
  Tree findNode( String target ) {
     print( "   in findNode" );
     for( var leaf in leaves ) {
        if( leaf.getTitle() == target ) {
           print( "   ... returning " + leaf.getTitle() );
           return leaf;
        }
     }
     return null;
  }

  Tree convertToNode( Leaf child ) {
     assert( child.getPlanAmount() == 0 && child.getAccrueAmount() == 0 );
     Node newNode = Node( child.getTitle(), child.getAllocAmount(), child.icon, child.width );
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

  void addAlloc( int moreAlloc ) { allocAmount += moreAlloc; }
  
  @override
  String getTitle() { return title; }
  
  @override
  int getAllocAmount() {
    var sum = allocAmount;
    leaves.forEach((Tree leaf) => sum += leaf.getAllocAmount());
    return sum;
  }
  @override
  int getPlanAmount() {
    var sum = 0;
    leaves.forEach((Tree leaf) => sum += leaf.getPlanAmount());
    return sum;
  }
  @override
  int getAccrueAmount() {
    var sum = 0;
    leaves.forEach((Tree leaf) => sum += leaf.getAccrueAmount());
    return sum;
  }

  @override  // toString overrides diagnostic... blarg
  String toStr() {
     String res = "";
     res += "\nNODE: " + title;
     res += "\n   has " + leaves.length.toString() + " leaves";
     res += "\n   with alloc amount: " + addCommas( getAllocAmount() ) + " PEQ";
     res += "\n   with plan amount: " + addCommas( getPlanAmount() ) + " PEQ";
     res += "\n   with accrue amount: " + addCommas( getAccrueAmount() ) + " PEQ";

     leaves.forEach((Tree leaf ) => res += leaf.toStr() );

     return res;
  }
  
  @override
  Widget render(BuildContext context) {

     String alloc  = addCommas( getAllocAmount() );
     String plan   = addCommas( getPlanAmount() );
     String accrue = addCommas( getAccrueAmount() );

     // XXX consider using font for clickability?
     return Padding(
        padding: const EdgeInsets.only(left: 15.0),  // XXX
        child: ExpansionTile(
           // leading: icon == null ? Container() : Icon(icon),
           title: makeBodyText( "$title (${ alloc + " " + plan + " " + accrue })", width, false, 1 ),
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
