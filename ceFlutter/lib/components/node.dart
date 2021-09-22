import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/utils.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/components/tree.dart';
import 'package:ceFlutter/components/leaf.dart';


// XXX getAmounts walking tree 3x - not necessary
class Node extends StatelessWidget implements Tree {
      
   final String title;
   int allocAmount;
   final IconData icon;
   
   final double width;
   final bool isInitiallyExpanded;
   bool isVisible;

   final bool header;
   final expansion;


   final List<Tree> leaves = List<Tree>();
   
   var      container;
   AppState appState;
   
   Node(this.title, this.allocAmount, this.icon, this.width, this.expansion, {this.isInitiallyExpanded = false, this.header = false} ) {
      this.isVisible = this.isInitiallyExpanded; 
   }
   
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
     Node newNode = Node( child.getTitle(), child.getAllocAmount(), child.icon, child.width, expansion );
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
  int getPendingAmount() {
    var sum = 0;
    leaves.forEach((Tree leaf) => sum += leaf.getPendingAmount());
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
     res += "\n   with pending amount: " + addCommas( getPendingAmount() ) + " PEQ";
     res += "\n   with accrue amount: " + addCommas( getAccrueAmount() ) + " PEQ";

     leaves.forEach((Tree leaf ) => res += leaf.toStr() );

     return res;
  }
  
  // XXX Will context give me click
  // XXX I'm rendering "this" because it is a statelesswidget
  //     I can't set leaves as children because leaves is list<tree> which is abstract class.
  //     does not need to be stateless....  how would that help?
  @override
  List<List<Widget>> getCurrent( BuildContext context ) {
     final numWidth = width / 3.0;
     final height   = 50;

     container   = AppStateContainer.of(context);
     appState    = container.state;

     print( "GET CURRENT  $title mod: " + appState.expansionChanged.toString() + " isVis?: " + isVisible.toString());
     
     List<List<Widget>> nodes = [];

     if( !isVisible ) { return nodes; }

     String alloc   = addCommas( getAllocAmount() );
     String plan    = addCommas( getPlanAmount() );
     String pending = addCommas( getPendingAmount() );
     String accrue  = addCommas( getAccrueAmount() );

     if( header ) {
        alloc   = "Allocation";
        plan    = "Planned";
        pending = "Pending";
        accrue  = "Accrued";
     }

     List<Widget> anode = [];
     anode.add( this );
     anode.add( makeTableText( appState, alloc, numWidth, height, false, 1 ) );
     anode.add( makeTableText( appState, plan, numWidth, height, false, 1 ) );
     anode.add( makeTableText( appState, pending, numWidth, height, false, 1 ) );
     anode.add( makeTableText( appState, accrue, numWidth, height, false, 1 ) );
     nodes.add( anode );

     if( isVisible ) {
        leaves.forEach( ((Tree leaf) {
              nodes.addAll( leaf.getCurrent(context) );
              }));
     }
     
     return nodes;
  }

  // If vis was set true, only me.  Else, myself and all kids are invis
  setVis( visible ) {
     print( "VISIBLE  $title :" + visible.toString() );
     isVisible = visible;
     if( !visible ) {
        leaves.forEach( (child) => child.setVis( visible ) );
     }

  }
  
  @override
  Widget render(BuildContext context) {
     
     final height = 50.0;
     print( "RENDER $title h,w:" + height.toString() + " " + width.toString() );

     // Odd.. Why must this be set again, explicitly?  Render must not be in synch with build in the context tree.
     container   = AppStateContainer.of(context);
     appState    = container.state;

     // XXX consider using font for clickability?
     return Container(
        width: width,
        height: height,
        child: ListTileTheme(
           contentPadding: EdgeInsets.all(0),
           dense: true,
           child: ExpansionTile(
              title: makeTableText( appState, "R $title", width, height, false, 1 ),
              // children: leaves.map((Tree leaf) => leaf.render(context)).toList(),
              //children: leaves.map((Tree leaf) => leaf.render(context)).toList(),
              initiallyExpanded: isInitiallyExpanded,
              onExpansionChanged: ((expanded) {
                    print( "*** " + expanded.toString() );
                    leaves.forEach( (child) => child.setVis( expanded ) );
                    expansion( expanded);
                 })
              )));

  }

  @override
     Widget build(BuildContext context) {

     container   = AppStateContainer.of(context);
     appState    = container.state;

     return render(context);
  }
}
