import 'package:flutter/material.dart';
import 'dart:math';
import 'dart:ui';    // pointerKinds
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

// Workaround breaking change 5/2021
// https://flutter.dev/docs/release/breaking-changes/default-scroll-behavior-drag
class MyCustomScrollBehavior extends MaterialScrollBehavior {
  // Override behavior methods and getters like dragDevices
  @override
  Set<PointerDeviceKind> get dragDevices => { 
    PointerDeviceKind.touch,
    PointerDeviceKind.mouse,
  };
}


class CESummaryFrame extends StatefulWidget {
   final frameHeightUsed;
   var   appContainer;
   final pageStamp;
   final updateCallback;
   final updateCompleteCallback;
   final allocExpansionCallback;

   CESummaryFrame(
      {Key key, this.appContainer, this.pageStamp, this.frameHeightUsed, this.updateCallback, this.updateCompleteCallback, this.allocExpansionCallback} ) : super(key: key);

  @override
  _CESummaryState createState() => _CESummaryState();

}

class _CESummaryState extends State<CESummaryFrame> {

   var      container;
   AppState appState;

   static const maxPaneWidth = 800.0;

   // iphone 5
   static const frameMinWidth  = 320.0;
   static const frameMinHeight = 300;       // 568.0;
   
   @override
   void initState() {
      super.initState();
   }

   @override
   void dispose() {
      super.dispose();
      print( "XXXX SF Disposessed!" );
   }

   // XXX ghUserLogin could be 'unallocated' or 'unassigned', which makes onTap bad
   // XXX Wanted to push first, then update - more responsive.  But setState is only rebuilding homepage, not
   //     detail page..?  
   _pactDetail( ghUserLogin, width, depth ) {
      final height = appState.CELL_HEIGHT;
      return GestureDetector(
         onTap: () async 
         {
            print( "pactDetail fired for: " + ghUserLogin );
            appState.selectedUser = ghUserLogin;
            appState.userPActUpdate = true;            
            Navigator.push( context, MaterialPageRoute(builder: (context) => CEDetailPage()));
         },
         child: makeTableText( appState, ghUserLogin, width, height, false, 1, mux: depth * .5 )
         );
   }
   
   // XXX this could easily be made iterative
   // Categories: Software Contributions: codeEquity web front end: Planned: unassigned:
   // header      alloc                   sub alloc                 plan
   _buildAllocationTree( { notify = true } ) {
      print( "Build allocation tree" );
      final width = frameMinWidth - 2*appState.FAT_PAD;  
      
      appState.allocTree = Node( "Category", 0, null, width, widget.pageStamp, widget.allocExpansionCallback, isInitiallyExpanded:true, header: true );
      
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
               curNode = (curNode as Node).convertToNode( childNode, widget.pageStamp );
            }
            else if( childNode == null ) {
               if( !lastCat ) {
                  print( "... nothing - add node" );
                  Node tmpNode = Node( alloc.category[i], 0, null, width, widget.pageStamp, widget.allocExpansionCallback );
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
                  Widget details = _pactDetail( alloc.category[i], width, i+1 );
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

      // during build, calling setState is an error.
      print( "XXXX  BAT notify? $notify" );
      
      if( notify ) { widget.updateCompleteCallback(); }
      // print( appState.allocTree.toStr() );
   }
   

   // XXX consider making peqSummary a list in appState
   // re-build alloc tree if updatePeq button triggers, with notification
   List<List<Widget>> _showPAlloc( { fromGA = false } ) {
      print( "XXXX  SPA fromGA? $fromGA" );
      List<List<Widget>> allocList = [];
      
      if( appState.updateAllocTree ) { _buildAllocationTree( notify: !fromGA ); } // XXX cant notify always
      
      if( ( appState.expansionChanged || fromGA ) && appState.myPEQSummary != null )
      {
         if( appState.myPEQSummary.ghRepo == appState.selectedRepo ) {
            if( appState.myPEQSummary.allocations.length == 0 ) { return []; }
            print( "_showPalloc Update alloc" );
            allocList.addAll( appState.allocTree.getCurrent( container ) );
         }
      }
      else { return []; }
      
      return allocList;
   }
   

   Widget getAllocation( context ) {
      
      final buttonWidth = 100;
      
      List<List<Widget>> allocs = [];

      final fromGA = true;

      var c = Container( width: 1, height: 1 );
      
      allocs.addAll( _showPAlloc( fromGA: fromGA ) );
      allocs.addAll( [[ makeHDivider( maxPaneWidth - 2*appState.TINY_PAD - 4, appState.TINY_PAD, appState.TINY_PAD ), c, c, c, c ]] );  // XXX
      allocs.addAll( [[ makeActionButtonFixed(
                        appState,
                        "Update PEQ summary?",
                        buttonWidth, 
                        () async
                        {
                           widget.updateCallback();
                        }),
                        c, c, c, c ]] );
      

      var allocCount = min( allocs.length, 30 );
      var allocWidth = allocs[0].length;

      final svHeight = ( appState.screenHeight - widget.frameHeightUsed ) * .9;
      //final svWidth  = min( maxPaneWidth, appState.screenWidth );
      final svWidth  = maxPaneWidth;

      if( appState.screenHeight < frameMinHeight ) {
         return makeTitleText( appState, "Really?  Can't we be a little taller?", frameMinHeight, false, 1, fontSize: 18);
      }
      else {
         var itemCount = min( allocCount, 20 );

         final ScrollController controller = ScrollController();

         return ScrollConfiguration(
            behavior: MyCustomScrollBehavior(),
            child: SingleChildScrollView(
               scrollDirection: Axis.horizontal,
               child: SizedBox(
                  height: svHeight,
                  width: svWidth,
                  child: ListView(
                     children: List.generate( 
                        itemCount,
                        (indexX) => Row(
                           children: List.generate( 
                              allocWidth,
                              (indexY) => allocs[indexX][indexY] ))
                        )))));
         
      }
   }
   
   
   @override
   Widget build(BuildContext context) {

      // XXX appContainer still needed?
      container   = widget.appContainer;   // Neat.  Access parameter in super.
      appState    = container.state;

      print( "SUMMARY BUILD. " + (appState == Null).toString());

      return getAllocation( context );
      
 }
 
}
