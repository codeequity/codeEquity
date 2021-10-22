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
   final bool header;
   int  currentDepth;   // for indentation

   final bool isInitiallyExpanded; 
   bool isVisible;   // controls what tiles get added to display list
   bool firstPass;   // use this to setVis based on isInitiallyExpanded, one time only.


   final expansion;     // setState callback in screens:summary
   bool _tileExpanded;
   String path;


   final List<Tree> leaves = List<Tree>();
   
   var      container;
   AppState appState;
   
   Node(this.title, this.allocAmount, this.icon, this.width, this.expansion, {this.isInitiallyExpanded = false, this.header = false, this.currentDepth = 0} ) {
      isVisible = this.isInitiallyExpanded;
      _tileExpanded = this.isInitiallyExpanded;
      firstPass = true;
      path = "";
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


  // XXX child expansion carrot bad after hide/expand parent (if was initially expanded)
  
  // XXX Will context give me click
  // XXX I'm rendering "this" because it is a statelesswidget
  //     I can't set leaves as children because leaves is list<tree> which is abstract class.
  //     does not need to be stateless....  how would that help?
  @override
     List<List<Widget>> getCurrent( BuildContext context, {treeDepth = 0, ancestors = ""} ) {
     final numWidth = width / 3.0;
     final height   = 50;

     currentDepth = treeDepth;
     container    = AppStateContainer.of(context);
     appState     = container.state;
     path         = ancestors + "/" + title;

     if( isVisible ) {  print( "visible node GET CURRENT  $title "); }
     
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

     final priorExpansionState = _tileExpanded;
     
     List<Widget> anode = [];
     // anode.add( this );
     anode.add( getTile() );
     
     anode.add( makeTableText( appState, alloc, numWidth, height, false, 1 ) );
     anode.add( makeTableText( appState, plan, numWidth, height, false, 1 ) );
     anode.add( makeTableText( appState, pending, numWidth, height, false, 1 ) );
     anode.add( makeTableText( appState, accrue, numWidth, height, false, 1 ) );
     nodes.add( anode );

     if( firstPass & isInitiallyExpanded ) {
        firstPass = false;
        leaves.forEach((Tree child) => child.setVis( true ));
     }

     // setVis on all kids that are allocExpanded to true.
     // no need to check allocExpanded.. if kids not yet opened, very little extra work is done
     if( priorExpansionState != _tileExpanded && _tileExpanded ) {
        print( "!!! !!! $title just opened." );
        reopenKids();
     }

     print( "" );
     
     leaves.forEach( ((Tree child) {
              nodes.addAll( child.getCurrent(context, treeDepth: treeDepth + 1, ancestors: path ));
           }));

     if( leaves.length == 0 ) { print( "bottom" ); }
     
     return nodes;
  }

  // If this just opened, re-vis any kid that was opened before - can save open/close state this way
  @override
  reopenKids() {
     print( "Reopening previously expanded $title kids" );
     isVisible = true;
     if( appState.allocExpanded.containsKey(path) && appState.allocExpanded[path] ) {
        // Should only get here for nodes, given allocExpanded above... oops.. ok.  tree
        leaves.forEach( (child) => child..reopenKids() );
     }
  }


  // If vis was set true, only me.  Else, myself and all kids are invis
  @override
  setVis( visible ) {
     print( "VISIBLE  $title :" + visible.toString() );
     isVisible = visible;
     if( !visible ) {
        leaves.forEach( (child) => child.setVis( visible ) );
     }

  }

  @override
  Widget getTile() {
     final height = 50.0;  // XXX

     print( "NRENDER $title $path tileExp: $_tileExpanded init: $isInitiallyExpanded" );
     print( "contains " + appState.allocExpanded.containsKey(path).toString() );
     if( appState.allocExpanded.containsKey(path) ) { print( "value " + appState.allocExpanded[path].toString() ); }

     if( appState.allocExpanded.containsKey(path) && appState.allocExpanded[path] != _tileExpanded ) {
        _tileExpanded = !_tileExpanded;
        print( "NRENDER $title tileExpanded CHANGES(!!) to: $_tileExpanded" );
     }
     else { print( "NRENDER $title tileExpanded is: $_tileExpanded" ); }

     var newTitle = _tileExpanded ? title + " open" : title + " close";
     
     
     // XXX consider using font for clickability?
     return Container(
        width: width,
        height: height,
        child: ListTileTheme(
           dense: true,
           child: ExpansionTile(
              // children: leaves.map((Tree leaf) => leaf.render(context)).toList(),
              trailing: Icon( _tileExpanded ? Icons.arrow_drop_down_circle : Icons.arrow_drop_down ),
              // title: makeTableText( appState, "$title", width, height, false, 1, mux: currentDepth * .5 ),
              key: new PageStorageKey(path),
              title: makeTableText( appState, "$newTitle", width, height, false, 1, mux: currentDepth * .5 ),
              initiallyExpanded: isInitiallyExpanded,
              onExpansionChanged: ((expanded) {
                    print( "*** $title expanded? $expanded" );
                    leaves.forEach( (child) => child.setVis( expanded ) );
                    expansion( expanded, path );
                 })
              )));

  }
  /*
  @override
  Widget render(BuildContext context) {
     
     final height = 50.0;
     // print( "NRENDER $title h,w:" + height.toString() + " " + width.toString() );
     print( "NRENDER $title tileExpanded? $_tileExpanded $isInitiallyExpanded"  );

     // Odd.. Why must this be set again, explicitly?  Render must not be in synch with build in the context tree.
     container   = AppStateContainer.of(context);
     appState    = container.state;

     // XXX darg
     var newTitle = title;
     if( appState.ghoChanged && _tileExpanded ) {
        newTitle = title + " EXP";
        print( "GHO CHANGED, in render, $newTitle" );
        appState.ghoChanged = false;
     }
     
     // XXX consider using font for clickability?
     return Container(
        width: width,
        height: height,
        child: ListTileTheme(
           // Not rendering the tree any longer from here, so padding does nothing.
           //contentPadding: EdgeInsets.fromLTRB(appState.MID_PAD, 0, 0, 0),
           dense: true,
           child: ExpansionTile(
              // children: leaves.map((Tree leaf) => leaf.render(context)).toList(),
              // maintainState: true,
              trailing: Icon( _tileExpanded ? Icons.arrow_drop_down_circle : Icons.arrow_drop_down ),
              // title: makeTableText( appState, "$title", width, height, false, 1, mux: currentDepth * .5 ),
              title: makeTableText( appState, "$newTitle", width, height, false, 1, mux: currentDepth * .5 ),
              initiallyExpanded: isInitiallyExpanded,
              onExpansionChanged: ((expanded) {
                    print( "*** $title expanded? $expanded" );
                    _tileExpanded = expanded;
                    leaves.forEach( (child) => child.setVis( expanded ) );
                    expansion( expanded, title );
                 })
              )));
  }
  */

  
  @override
     Widget build(BuildContext context) {

     container   = AppStateContainer.of(context);
     appState    = container.state;

     //return render(context);
     return getTile();
  }
}
