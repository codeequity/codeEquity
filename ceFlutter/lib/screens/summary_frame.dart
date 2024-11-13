import 'package:flutter/material.dart';
import 'dart:math';
import 'dart:ui';    // pointerKinds
import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/awsUtils.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/models/Allocation.dart';
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
   final detailCallback;
   final allocExpansionCallback;

   CESummaryFrame(
      {Key? key,
            this.appContainer,
            this.pageStamp,
            this.frameHeightUsed,
            this.updateCallback,
            this.detailCallback,
            this.allocExpansionCallback} ) : super(key: key);

  @override
  _CESummaryState createState() => _CESummaryState();

}

class _CESummaryState extends State<CESummaryFrame> {

   late var      container;
   late AppState appState;

   static const maxPaneWidth = 950.0;
   // static const maxPaneWidth = 800.0;

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
      if( appState.verbose >= 2 ) { print( "SummaryFrame Disposessed!" ); }
   }

   // XXX hostUserLogin could be 'unallocated' or 'unassigned', which makes onTap bad
   // XXX Wanted to push first, then update - more responsive.  But setState is only rebuilding homepage, not
   //     detail page..?
   _pactDetail( path, convertedName, width, depthM1 ) {
      // print( "Pact Detail looking for user " + path.toString() + " " + depthM1.toString() );
      final height = appState.CELL_HEIGHT;
      return GestureDetector(
         onTap: () async 
         {
            String hostUserLogin = path[ depthM1 ];
            if( hostUserLogin == appState.UNASSIGN ) { appState.selectedUser = appState.UNASSIGN_USER; }
            else                                     { appState.selectedUser = hostUserLogin; }
            appState.userPActUpdate = true;
            if( appState.verbose >= 1 ) { print( "pactDetail fired for: " + path.toString() ); }
            widget.detailCallback( path );
         },
         child: makeTableText( appState, convertedName, width, height, false, 1, mux: (depthM1+1) * .5 )
         );
   }
   
   // XXX this could easily be made iterative
   // BuildAllocTree creates the linkages between nodes.  Node actually controls most the the view for each element.
   // Categories: Software Contributions: codeEquity web front end: Planned: unassigned:
   // header      alloc                   sub alloc                 plan
   _buildAllocationTree() {
      if( appState.verbose >= 1 ) { print( "Build allocation tree" ); }
      final width = frameMinWidth - 2*appState.FAT_PAD;  
      
      appState.allocTree = Node( "Category", 0, null, width, widget.pageStamp, widget.allocExpansionCallback, isInitiallyExpanded:true, header: true );
      
      if( appState.myPEQSummary == null ) {
         appState.updateAllocTree = false;
         return;
      }

      // These were built during ingest
      // Per allocation, walk the current tree (curNode) by stepping through the alloc.category chain to see where this alloc belongs
      for( var alloc in appState.myPEQSummary!.getAllAllocs() ) {

         assert( appState.allocTree != null );

         // Re-site each alloc into it's new home.
         // XXX get and use ep.allocation here.
         List<dynamic> epRet = appState.equityPlan!.site( alloc.category );
         List<String> sitedCat   = new List<String>.from( epRet[0] );
         
         Tree curNode = appState.allocTree!;
         
         // when allocs are created, they are leaves.
         // down the road, they become nodes
         for( int i = 0; i < sitedCat.length; i++ ) {
            
            if( appState.verbose >= 2 ) { print( "working on " + sitedCat.toString() + " : " + sitedCat[i] ); }

            // Overly aggressive assert?
            assert( alloc.amount != null );
            
            bool lastCat = false;
            if( i == sitedCat.length - 1 ) { lastCat = true; }
            Tree? childNode = curNode.findNode( sitedCat[i] );
            
            if( childNode is Leaf && !lastCat ) {
               // allocation leaf, convert to a node to accomodate plan/accrue
               print( "... leaf in middle - convert" );
               curNode = (curNode as Node).convertToNode( childNode, widget.pageStamp );
            }
            else if( childNode == null ) {
               if( !lastCat ) {
                  int hAlloc = 0;

                  // alloc: [hier ... hier  project column assignee]
                  // alloc  |-may have ---| |-will have -----------|    equity plan has no info on last two.
                  if( i < sitedCat.length - 2 ) {
                     if( appState.verbose >= 2 ) { print( "... hierarchy - resite " + sitedCat[i] ); }
                     List<dynamic> hier = appState.equityPlan!.site( [ sitedCat[i] ] );
                     hAlloc = hier[1];
                  }

                  Node tmpNode = Node( sitedCat[i], hAlloc, null, width, widget.pageStamp, widget.allocExpansionCallback );
                  (curNode as Node).addLeaf( tmpNode );
                  curNode = tmpNode;
               }
               else {
                  if( appState.verbose >= 2 ) { print( "... nothing found, last cat, add leaf" ); }
                  // leaf.  amounts stay at leaves

                  // Hierarchy adds alloc amounts from equity plan in the case above.
                  // Pure leaves should be alloc 0, as they will be assignees.
                  // Projects and hierarchical elements can never be allocations on their own, will always show up in case above first.
                  int allocAmount = 0;
                  // int allocAmount  = sitedAlloc;
                  // if( allocAmount < 0 ) { allocAmount = ( alloc.allocType == PeqType.allocation ? alloc.amount! : 0 ); }
                  
                  int planAmount   = ( alloc.allocType == PeqType.plan       ? alloc.amount! : 0 );
                  int pendAmount   = ( alloc.allocType == PeqType.pending    ? alloc.amount! : 0 );
                  int accrueAmount = ( alloc.allocType == PeqType.grant      ? alloc.amount! : 0 );

                  // Everything starts as a leaf, so will often not have a mapping.  But if we do, use it, will be hostUserName instead of id
                  String rowName = sitedCat[i];
                  Map<String,String>? mapping = appState.idMapHost[ rowName ];
                  if( mapping != null ) { rowName = mapping!['hostUserName'] ?? rowName; }

                  // Pact details sit at the assignee level.  SitedCat can be any length, but assignee is always the last element.
                  // We filter pacts by project subs in the PEQ model. Project subs are unsited.
                  int assigneeLoc = alloc.category.length - 1;
                  Widget details = _pactDetail( alloc.category, rowName, width, assigneeLoc );
                  Leaf tmpLeaf   = Leaf( rowName, allocAmount, planAmount, pendAmount, accrueAmount, null, width, details ); 
                  (curNode as Node).addLeaf( tmpLeaf );
               }
            }
            else if( childNode is Node ) {
               if( !lastCat ) {
                  if( appState.verbose >= 2 ) { print( "... found - move on" ); }
                  curNode = childNode;
               }
               else {
                  print( "... alloc adding into existing chain" );
                  assert( alloc.allocType == PeqType.allocation );
                  (childNode as Node).addAlloc( alloc.amount! );
               }
            }
            else { assert( false ); }
         }
      }
      appState.updateAllocTree = false;
      
      // print( appState.allocTree.toStr() );
   }
   

   // XXX consider making peqSummary a list in appState
   // re-build alloc tree if updatePeq button triggers
   List<List<Widget>> _showPAlloc() {
      List<List<Widget>> allocList = [];
      
      if( appState.updateAllocTree ) { _buildAllocationTree(); }
      
      // When node expansion changes, callback sets state on allocExpanded, which changes node, which changes here, which causes project_page rebuild
      if( appState.myPEQSummary != null )
      {
         if( appState.myPEQSummary!.ceProjectId == appState.selectedCEProject ) {
            assert( appState.allocTree != null );
            if( appState.myPEQSummary!.getAllAllocs().length == 0 ) { return []; }
            if( appState.verbose >= 2 ) { print( "_showPalloc Update alloc" ); }
            allocList.addAll( appState.allocTree!.getCurrent( container ) );

            //print( appState.allocTree.toStr() );
         }
      }
      else { return []; }
      
      return allocList;
   }
   

   Widget getAllocation( context ) {
      final w1 = 4 * appState.CELL_HEIGHT;
      final spinSize = 1.8*appState.BASE_TXT_HEIGHT;
      if( appState.verbose >= 2 ) { print( "SF: Remake allocs" ); }
      final buttonWidth = 100;
      
      List<List<Widget>> allocs = [];

      var c = Container( width: 1, height: 1 );

      // Spinny
      if( appState.peqAllocsLoading ) {
         Widget cpi = Wrap( spacing: 0, children: [
                               Container( width: w1, height: spinSize ),
                               Container( width: spinSize, height: spinSize, child: CircularProgressIndicator() ),
                               makeTitleText( appState, "This can take a few minutes..", 6*appState.CELL_HEIGHT, false, 1, fontSize: 16)
                               ]);
         
         // XXX Change number of cells?  change padding container 'c', and subtraction from tinypad.
         allocs.addAll( [[ Container( width: appState.CELL_HEIGHT, height: appState.CELL_HEIGHT ) ]] );
         allocs.addAll( [[ cpi ]] );
         allocs.addAll( [[ Container( width: appState.CELL_HEIGHT, height: appState.CELL_HEIGHT ) ]] );
      }
      else {
         allocs.addAll( _showPAlloc() );
      }

      allocs.addAll( [[ makeHDivider( appState, maxPaneWidth - 2*appState.TINY_PAD - 5, appState.TINY_PAD, appState.TINY_PAD ), c, c, c, c, c ]] );  // XXX
      allocs.addAll( [[ makeActionButtonFixed(
                        appState,
                        "Update PEQ Summary?",
                        buttonWidth, 
                        () async
                        {
                           // Not waiting here.. 
                           setState(() => appState.peqAllocsLoading = true );
                           widget.updateCallback();
                        }),
                        c, c, c, c, c ]] );
      
      // allocCount changes with each expand/contract
      // print( "getAllocs, count: " + allocs.length.toString() );
      var allocCount = min( allocs.length, 30 );
      var allocWidth = allocs[0].length;

      final svHeight = ( appState.screenHeight - widget.frameHeightUsed ) * .9;
      //final svWidth  = min( maxPaneWidth, appState.screenWidth );
      final svWidth  = maxPaneWidth;

      if( appState.screenHeight < frameMinHeight ) {
         return makeTitleText( appState, "Really?  Can't we be a little taller?", frameMinHeight, false, 1, fontSize: 18);
      }
      else {
         // No.  generate all, otherwise when scroll, bottom rows may not exist.
         // var itemCount = min( allocCount, 50 );
         var itemCount = max( allocCount, allocs.length );

         final ScrollController controller = ScrollController();

         // Key removes spacer index for compatibility with integration testing
         return ScrollConfiguration(
            behavior: MyCustomScrollBehavior(),
            child: SingleChildScrollView(
               scrollDirection: Axis.horizontal,
               child: SizedBox(
                  height: svHeight,
                  width: svWidth,
                  child: ListView(
                     // key: Key( 'verticalSummaryScroll' ), 
                     children: List.generate(
                        itemCount,
                        (indexX) => Row(
                           key: Key( 'allocsTable ' + ( indexX - 1).toString() ),                           
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
      assert( appState != null );
     
      if( appState.verbose >= 2 ) { print( "SUMMARY BUILD. " + (appState == Null).toString()); }

      return getAllocation( context );
      
 }
 
}
