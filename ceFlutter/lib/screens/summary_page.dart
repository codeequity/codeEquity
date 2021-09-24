import 'package:flutter/material.dart';
import 'dart:math';               
import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';

import 'package:ceFlutter/models/app_state.dart';


import 'package:ceFlutter/models/allocation.dart';
import 'package:ceFlutter/models/PEQ.dart';

import 'package:ceFlutter/components/tree.dart';
import 'package:ceFlutter/components/node.dart';
import 'package:ceFlutter/components/leaf.dart';

import 'package:ceFlutter/screens/detail_page.dart';


class CESummaryPage extends StatefulWidget {
   CESummaryPage({Key key}) : super(key: key);

  @override
  _CESummaryState createState() => _CESummaryState();

}

class _CESummaryState extends State<CESummaryPage> {

   var      container;
   AppState appState;

   static const maxPaneWidth = 800.0;

   @override
   void initState() {
      super.initState();
   }

   @override
   void dispose() {
      super.dispose();
   }

   
   // XXX Wanted to push first, then update - more responsive.  But setState is only rebuilding homepage, not
   //     detail page..?  
   _pactDetail( ghUserLogin, width ) {
      return GestureDetector(
         onTap: () async 
         {
            print( "pactDetail fired for: " + ghUserLogin );
            appState.selectedUser = ghUserLogin;
            appState.userPActUpdate = true;            
            Navigator.push( context, MaterialPageRoute(builder: (context) => CEDetailPage()));
         },
         child: makeTitleText( appState, ghUserLogin, width, false, 1 )
         );
   }
   

   // XXX hmm.. basically making gestureDetector?
   _allocTileExpansionChanged( expansionVal ) {
      setState(() => appState.expansionChanged = expansionVal );
   }
   
   
   // XXX problem 1: setState, but stateless
   // XXX problem 2: buildAlloc uses Node.  Node is constructed OUTSIDE the widget tree - no context, no appState.
   //                could pass to constructor, but that doesn't help problem 1.
   // ... make this stateful again.  construct instance as with Node.  call method on instance.
   
   // XXX this could easily be made iterative
   // Categories: Software Contributions: codeEquity web front end: Planned: unassigned:
   // header      alloc                   sub alloc                 plan
   _buildAllocationTree() {
      print( "Build allocation tree" );
      final width = 290.0;  // XXX
      
      appState.allocTree = Node( "Category", 0, null, width, _allocTileExpansionChanged, isInitiallyExpanded:true, header:true );
      
      if( appState.myPEQSummary == null ) {
         appState.updateAllocTree = false;
         return;
      }
      
      for( var alloc in appState.myPEQSummary.allocations ) {
         
         Tree curNode = appState.allocTree;
         
         // when allocs are created, they are leaves.
         // down the road, they become nodes
         for( int i = 0; i < alloc.category.length; i++ ) {
            
            print( "working on " + alloc.category.toString() + " : " + alloc.category[i] );
            
            bool lastCat = false;
            if( i == alloc.category.length - 1 ) { lastCat = true; }
            Tree childNode = curNode.findNode( alloc.category[i] );
            
            if( childNode is Leaf && !lastCat ) {
               // allocation leaf, convert to a node to accomodate plan/accrue
               print( "... leaf in middle - convert" );
               curNode = (curNode as Node).convertToNode( childNode );
            }
            else if( childNode == null ) {
               if( !lastCat ) {
                  print( "... nothing - add node" );
                  Node tmpNode = Node( alloc.category[i], 0, null, width, _allocTileExpansionChanged );
                  (curNode as Node).addLeaf( tmpNode );
                  curNode = tmpNode;
               }
               else {
                  print( "... nothing found, last cat, add leaf" );
                  // leaf.  amounts stay at leaves
                  
                  int allocAmount  = ( alloc.allocType == PeqType.allocation ? alloc.amount : 0 );
                  int planAmount   = ( alloc.allocType == PeqType.plan       ? alloc.amount : 0 );
                  int pendAmount   = ( alloc.allocType == PeqType.pending    ? alloc.amount : 0 );
                  int accrueAmount = ( alloc.allocType == PeqType.grant      ? alloc.amount : 0 );
                  Widget details = _pactDetail( alloc.category[i], width );
                  Leaf tmpLeaf = Leaf( alloc.category[i], allocAmount, planAmount, pendAmount, accrueAmount, null, width, details ); 
                  (curNode as Node).addLeaf( tmpLeaf );
               }
            }
            else if( childNode is Node ) {
               if( !lastCat ) {
                  print( "... found - move on" );
                  curNode = childNode;
               }
               else {
                  print( "... alloc adding into existing chain" );
                  assert( alloc.allocType == PeqType.allocation );
                  (childNode as Node).addAlloc( alloc.amount );
               }
            }
            else {
               print( "XXXXXXXXXXXXXXXX BAD" );
               print( "XXXXXXXXXXXXXXXX BOOBOO" );
               print( "XXXXXXXXXXXXXXXX BABY" );
            }
         }
      }
      appState.updateAllocTree = false;
      //print( appState.allocTree.toStr() );
   }
   
   
   // XXX consider making peqSummary a list in appState
   List<List<Widget>> _showPAlloc( ) {
      
      List<List<Widget>> allocList = [];
      
      if( appState.updateAllocTree ) { _buildAllocationTree(); }
      
      if( ( appState.peqUpdated || appState.expansionChanged ) && appState.myPEQSummary != null )
      {
         if( appState.myPEQSummary.ghRepo == appState.selectedRepo ) {
            if( appState.myPEQSummary.allocations.length == 0 ) { return []; }
            print( "_showPalloc Update alloc" );
            // allocList.add( appState.allocTree );
            allocList.addAll( appState.allocTree.getCurrent(context) );
         }
      }
      else { return []; }
      
      return allocList;
   }
   
   
   Future<void> _updateConfirmed( ) async {
      appState.peqUpdated = false;
      
      await updatePEQAllocations( appState.selectedRepo, context, container );
      _buildAllocationTree();
      
      // XXX local, or app-wide?  app for now
      setState(() { appState.peqUpdated = true; });
   }
   
   

   Widget getAllocation( ) {
      
      final buttonWidth = 100;
      
      List<List<Widget>> allocs = [];

      // XXX Without this, need to click update?  rebuildProj is off.
      appState.peqUpdated = true;

      var c = Container( width: 1, height: 1 );
      
      allocs.addAll( _showPAlloc( ) );
      allocs.addAll( [[ makeHDivider( maxPaneWidth - 2*appState.TINY_PAD - 4, appState.TINY_PAD, appState.TINY_PAD ), c, c, c, c ]] );  // XXX
      allocs.addAll( [[ makeActionButtonFixed(
                        appState,
                        "Update PEQ summary?",
                        buttonWidth, 
                        () async
                        {
                           _updateConfirmed();
                        }),
                        c, c, c, c ]] );
      

      // https://stackoverflow.com/questions/45137297/implementing-a-bidirectional-listview-in-flutter?noredirect=1&lq=1
      // https://stackoverflow.com/questions/45270900/how-to-implement-nested-listview-in-flutter
      // https://stackoverflow.com/questions/55385170/flutter-list-view-with-multiple-scroll-direction

      var allocCount = min( allocs.length, 30 );
      var allocWidth = allocs[0].length;

      return SingleChildScrollView( 
         scrollDirection: Axis.vertical,
         child: SizedBox(
            width: maxPaneWidth,
            height: appState.screenHeight * .8,
            child: ListView.builder(
               itemCount: min( allocCount, 20 ),
               itemBuilder: (BuildContext context, int i)
               {
                  if( i >= allocCount ) { print( "Oof" ); return Container( height: 100, width: 50 ); }
                  else {
                     return new Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: new List.generate(allocWidth, (int j) {
                              // print( allocCount.toString() + " " + allocs[i].length.toString() + " " +i.toString() + " " + j.toString() );
                              return allocs[i][j];
                           })
                        );
                  }
               })
            ));

      /*
      return SingleChildScrollView( 
         scrollDirection: Axis.horizontal,
         child: SizedBox(
            width: maxPaneWidth,
            child:ConstrainedBox( 
               constraints: new BoxConstraints(
                  minHeight: 20.0,
                  maxHeight: appState.screenHeight * .8
                  ),
               child: ListView(
                  scrollDirection: Axis.vertical,
                  children: allocs[0]
                  ))
            ));
      */
      
      /*
      return Column(
         crossAxisAlignment: CrossAxisAlignment.start,
         mainAxisAlignment: MainAxisAlignment.start,
         children: allocs
         );
      */
   }
   
   
   @override
   Widget build(BuildContext context) {
      
      container   = AppStateContainer.of(context);
      appState    = container.state;

      return getAllocation();
      
 }
 
}
