import 'package:flutter/material.dart';
import 'dart:math';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/components/tree.dart';
import 'package:ceFlutter/components/leaf.dart';


// XXX getAmounts walking tree 3x - not necessary
class Node extends StatelessWidget implements Tree {
      
   final String title;
   int allocAmount;
   final IconData? icon;
   
   final double width;
   final bool header;
   int  currentDepth;   // for indentation
 
   bool isInitiallyExpanded;   // Not final, to help deal with reloading an active page
   late bool isVisible;   // controls what tiles get added to display list
   late bool firstPass;   // use this to setVis based on isInitiallyExpanded, one time only.

   final stamp; 
   final expansion;     // setState callback in screens:summary
   late bool _tileExpanded;
   late String path;


   final List<Tree> leaves = [];
   
   AppState? appState;
   
   Node(this.title, this.allocAmount, this.icon, this.width, this.stamp, this.expansion, {this.isInitiallyExpanded = false, this.header = false, this.currentDepth = 0} ) {
      isVisible = this.isInitiallyExpanded;

      // A new node is created each time the summary page is regenerated.  There is an open/close state to work with, but can't access it until the visible path is known.
      _tileExpanded = this.isInitiallyExpanded;
      
      firstPass = true;
      path = "";
   }
   
  void addLeaf(Tree leaf ) {
    leaves.add( leaf );
  }

  @override
  Tree? findNode( String target ) {
     //print( "   in findNode" );
     for( var leaf in leaves ) {
        if( leaf.getTitle() == target ) {
           //print( "   ... returning " + leaf.getTitle() );
           return leaf;
        }
     }
     return null;
  }

  Tree convertToNode( Leaf child, stamp ) {
     assert( child.getPlanAmount() == 0 && child.getAccrueAmount() == 0 );
     Node newNode = Node( child.getTitle(), child.getAllocAmount(), child.icon, child.width, stamp, expansion );
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
     /*
     // Unlike the other amounts, which are independently summed, allocations are dependent in a top-down hierarchy.
     // For example, if githubOps is allocated 2m, and a child card (say, testing) is allocated 500k, the top level allocation is 2m.
     //              This is because the child card allocation is meant to be a part of the overall alloc for githubOps.
    var psum = allocAmount;
    var csum = 0;
    leaves.forEach((Tree leaf) => csum += leaf.getAllocAmount());
    return max( psum, csum );
     */
     // Now, allocations are declared directly in equity plan.
     // Allocs within a project are ignored, completely. 
     return allocAmount;
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
  @override
  int getChildSurplusAmount() {
    var sum = 0;
    leaves.forEach((Tree leaf) => sum += leaf.getChildSurplusAmount());
    return sum;
  }

  @override
  // get depth of deepest child
  int getChildDepth( int relDepth ) {
     var depth = relDepth;
     List<int> childDepth = []; 
     leaves.forEach((Tree leaf) => childDepth.add( leaf.getChildDepth( relDepth + 1 )) );
     int cd = 0;
     if( childDepth.length > 0 ) { cd = childDepth.reduce(max); }
     return depth + cd;
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

  // After updating allocs, need to reset initial expansion and vis state of all nodes
  void reset() {
     // print( "Reset alloc tree for $title" );
      isVisible     = this.isInitiallyExpanded;
      _tileExpanded = this.isInitiallyExpanded;
      firstPass     = true;

      if( firstPass & isInitiallyExpanded ) {
        firstPass = false;
        leaves.forEach((Tree child) => child.setVis( true ));
      }

      leaves.forEach(( (child) { if( child is Node ) { child.reset(); }} ));      
  }
  
  @override
  List<List<Widget>> getCurrent( container, {treeDepth = 0, ancestors = ""} ) {
     appState    = container.state;
     assert( appState != null );

     final numWidth = width / 3.0;
     final height   = appState!.CELL_HEIGHT;
     
     currentDepth = treeDepth;
     path         = ancestors + "/" + title;

     // if( isVisible ) {  print( "visible node GET CURRENT  $title "); }
     // print( "Is appstate null for $title? "+ (appState == null).toString() );
     
     List<List<Widget>> nodes = [];

     if( !isVisible ) { return nodes; }

     int allocInt        = getAllocAmount();
     int planInt         = getPlanAmount();
     int pendInt         = getPendingAmount();
     int accrInt         = getAccrueAmount();
     int childSurplusInt = getChildSurplusAmount();
     // Allow this to go negative.  Only show if child depth is at least 2.. i.e. only projects show surplus, not cols or assignees
     // int surplusInt = max( 0, allocInt - planInt - pendInt - accrInt );
     int surplusInt = allocInt - planInt - pendInt - accrInt;
     if( allocInt == -1 )          { surplusInt += 1; }  // -1 indicates a hostproject with a peq, but proj is not in equity.  it is not a numeric value.
     if( getChildDepth( 0 ) <= 2 ) { surplusInt = 0; }   // do not show surplus for columns or assignees

     String alloc   = addCommas( allocInt );
     String plan    = addCommas( planInt );
     String pending = addCommas( pendInt );
     String accrue  = addCommas( accrInt );
     // String surplus = surplusInt == 0 || currentDepth > 2 ? "" : addCommas( surplusInt );
     String surplus = surplusInt == 0  ? "" : addCommas( surplusInt );
        
     if( header ) {
        alloc   = "Allocation";
        plan    = "Planned";    // XXX Tie these to app state, but be ready to chop to size
        pending = "Pending";
        accrue  = "Accrued";
        surplus = "Surplus";
        Widget spacer    = Container( width: 1, height: appState!.CELL_HEIGHT * .5 );
        nodes.add( [spacer, spacer, spacer, spacer, spacer, spacer] );  
     }

     // Path is known here.  Make _tileExpanded consistent with path state, in case we have paged back into an active summary page
     if( appState!.allocExpanded.containsKey(path) && firstPass ) {
        _tileExpanded       = appState!.allocExpanded[path] ?? false;
        isInitiallyExpanded = _tileExpanded;
     }

     final priorExpansionState = _tileExpanded;

     if( appState!.verbose >= 2 ) { print( "Before GT expanded? " + _tileExpanded.toString() ); }
     List<Widget> anode = [];
     // anode.add( this );
     anode.add( getTile( ) );
     
     anode.add( makeTableText( appState!, alloc, numWidth, height, false, 1 ) );
     anode.add( makeTableText( appState!, plan, numWidth, height, false, 1 ) );
     anode.add( makeTableText( appState!, pending, numWidth, height, false, 1 ) );
     anode.add( makeTableText( appState!, accrue, numWidth, height, false, 1 ) );
     anode.add( makeTableText( appState!, surplus, numWidth, height, false, 1 ) );
     nodes.add( anode );

     if( firstPass & isInitiallyExpanded ) {
        firstPass = false;
        leaves.forEach((Tree child) => child.setVis( true ));
     }

     // setVis on all kids that are allocExpanded to true.
     // no need to check allocExpanded.. if kids not yet opened, very little extra work is done
     if( priorExpansionState != _tileExpanded && _tileExpanded ) {
        if( appState!.verbose >= 2 ) { print( "!!! !!! $title just opened." ); }
        reopenKids();
     }

     leaves.forEach( ((Tree child) {
              nodes.addAll( child.getCurrent(container, treeDepth: treeDepth + 1, ancestors: path ));
           }));

     return nodes;
  }

  // If this just opened, re-vis any kid that was opened before - can save open/close state this way
  @override
  reopenKids() {
     if( appState != null && appState!.verbose >= 2 ) { print( "Reopening previously expanded $title, and their kids" ); }
     isVisible = true;
     // Note: appState is null if reopen was called for a child below that has not yet been seen (generated).
     if( appState != null && appState!.allocExpanded.containsKey(path) && ( appState!.allocExpanded[path] ?? false ) ) {
        // Should only get here for nodes, given allocExpanded above... oops.. ok.  tree
        leaves.forEach( (child) => child.reopenKids() );
     }
  }


  // If vis was set true, only me.  Else, myself and all kids are invis
  @override
  setVis( visible ) {
     if( appState != null && appState!.verbose >= 2 ) { print( "VISIBLE  $title :" + visible.toString() ); }
     isVisible = visible;
     if( !visible ) {
        leaves.forEach( (child) => child.setVis( visible ) );
     }

  }

  @override
  Widget getTile() {
     assert( appState != null );
     final height = appState!.CELL_HEIGHT;

     if( appState!.allocExpanded.containsKey(path) && appState!.allocExpanded[path] != _tileExpanded ) {
        _tileExpanded = !_tileExpanded;
        if( appState!.verbose >= 3 ) { print( "NRENDER $title tileExpanded CHANGES(!!) to: $_tileExpanded" ); }
     }

     if( appState!.verbose >= 2 ) { print( "GT $title " + _tileExpanded.toString() ); }
     
     return Container(
        width: width,
        height: height,
        child: ListTileTheme(
           dense: true,
           child: ExpansionTile(
              // children: leaves.map((Tree leaf) => leaf.render(context)).toList(),
              trailing: Icon( _tileExpanded ? Icons.arrow_drop_down_circle : Icons.arrow_drop_down ),
              title: makeTableText( appState!, "$title", width, height, false, 1, mux: currentDepth * .5 ),
              key: new PageStorageKey(path + stamp),
              initiallyExpanded: isInitiallyExpanded,
              onExpansionChanged: ((expanded) {
                    if( appState!.verbose >= 2 ) { print( "*** $title expanded? $expanded" ); }
                    leaves.forEach( (child) => child.setVis( expanded ) );
                    expansion( expanded, path );
                 })
              )));

  }
  
  @override
     Widget build(BuildContext context) {

     return getTile( );
  }
}
