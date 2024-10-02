import 'dart:math';
import 'dart:ui';       // pointerKinds
import 'dart:convert';  // json encode/decode

import 'package:flutter/material.dart';
import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/components/equityTree.dart';
import 'package:ceFlutter/components/equityNode.dart';
import 'package:ceFlutter/components/equityLeaf.dart';

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


class CEEquityFrame extends StatefulWidget {
   final frameHeightUsed;
   var   appContainer;

   CEEquityFrame(
      {Key? key,
            this.appContainer,
            this.frameHeightUsed
            } ) : super(key: key);

  @override
  _CEEquityState createState() => _CEEquityState();

}


// Equity_frame does all indexing translations between equityTree and equityPlan.
// equityFrame: any change in view updates tree, then updates equity plan based on DFSWalk of tree.
// All movement, rearrangement happens in equityTree, simply a matter of moving tree nodes around.  Then dfswalk is used in EP to remake list (i.e. indexes).
//
// equityPlan has body alone, and is aware of epIndexes.  All operations on epIndex are to get destNext and destParent.
// equityTree has tree nodes and TOT, only.  The only indexes it tracks internally are for children of a node.  treeIndex is TOT, body.
//
// equityFrame populates a view, with a viewIndex.  Base index in EF is treeIndex, however:
//    - ReorderableListView interprets drag widget index as a viewIndex (even tho it is constructed within treeIndex world).
//    - ReorderableListView eq line keys are written in terms of treeIndex, to stay compatible with integration testing.
//           TOT, hdiv, nodes, summaries
//    tree:  y           y
//    plan:              y
//    view:  y    y      y      y


class _CEEquityState extends State<CEEquityFrame> {

   late var      container;
   late AppState appState;

   static const maxPaneWidth = 950.0;
   final listHeaders = ["Category", "Associated host project name", "Allocation", "Rearrange"];
   final lhInternal  = ["Category", "Allocation", "Associated host project name" ] ;

   // iphone 5
   static const frameMinWidth  = 320.0;     // XXX appState
   static const frameMinHeight = 300;       // 568.0;

   // Keep size of headers for equity frame view.  This is used to mod indexes on the way in to equityPlan
   late int equityTop; 

   // Common spacers
   late Widget gapPad;
   late Widget fatPad;
   late Widget midPad;
   late Widget empty;
   
   @override
   void initState() {
      super.initState();
   }

   @override
   void dispose() {
      super.dispose();
      if( appState.verbose >= 2 ) { print( "EquityFrame Disposessed!" ); }

      // XXX NOTE This should be cheap.  If not, save state as with allocTree in summary_frame
      // This avoids loss of catList when switch tabs.
      appState.updateEquityView = true;
   }

   Future<void> writeEqPlan() async {
      if( appState.equityPlan != null ) {
         appState.equityPlan!.lastMod = getToday();
         String eplan = json.encode( appState.equityPlan );
         String postData = '{ "Endpoint": "PutEqPlan", "NewPlan": $eplan }';
         updateDynamo( context, container, postData, "PutEqPlan" );
      }
   }
   
   
   void _saveEdit( EquityTree t, titleController, amountController, hpNameController) {
      print( "Save edit " + titleController.text + " " + amountController.text + " " + hpNameController.text );
      if( titleController.text != t.getTitle() || amountController.text != t.getAmount.toString() || t.getHostName() != hpNameController.text )
      {
         print( "Change detected " );
         String title = titleController.text;
         if( title == "" ) { title = "NOT YET NAMED"; }
         t.setTitle( title );
         String amt = amountController.text.replaceAll( ',', "" );
         if( amt == "" ) { amt = "0"; }
         t.setAmount( int.parse( amt ));
         String hpName = hpNameController.text;
         if( hpName == "" ) { hpName = "NO PROJECT ASSOCIATION"; }
         t.setHostName( hpName );
         print( "... se: " + t.getTitle() + " HOI " + t.getHostName() );

         // Tree changed. update viewable list, then update the view
         setState(() => appState.updateEquityView = true );                  
      }

      Navigator.of( context ).pop();
   }
   
   void _cancelEdit() {
      print( "Cancel edit" );
      Navigator.of( context ).pop();
   }

   void _delete( EquityTree t ) {
      print( "Deleting " + t.getTitle() );
      t.delete();

      // Tree changed. update viewable list, then update the view
      setState(() => appState.updateEquityView = true );
      
      Navigator.of( context ).pop();
   }

   void _saveAdd( EquityTree tot, TextEditingController title, TextEditingController amount, TextEditingController hproj) {
      final width = frameMinWidth - 2*appState.FAT_PAD;

      print( "SAVE ADD " + title.text + " " + title.value.toString() );

      String tval = title.text == "" ? "NOT YET NAMED" : title.text;
      String hval = hproj.text == "" ? "---" : hproj.text;
      String amt  = amount.text.replaceAll( ',', "" );
      int amtInt  = amt == "" ? 0 : int.parse( amt );
      
      EquityTree t = EquityLeaf( tval, amtInt, hval, tot, width );
      (tot as EquityNode).addLeaf( t );
      
      setState(() => appState.updateEquityView = true );                  

      Navigator.of( context ).pop();
   }
   
   Future<void> _add( EquityTree tot) async {
      TextEditingController tc = new TextEditingController();
      TextEditingController ac = new TextEditingController();
      TextEditingController hp = new TextEditingController();
      String popupTitle = "Add new entry";      
      await editList( context, appState, popupTitle, lhInternal, [tc, ac, hp], lhInternal, () => _saveAdd( tot, tc, ac, hp ), () => _cancelEdit(), null );
   }

   // Reorderable listener takes an index which much be reset and rebuilt every time a drag occurs.
   List<List<Widget>> _getTiles( context, width ) {
      assert( appState.equityTree != null );
      List<EquityTree> treeList = appState.equityTree!.depthFirstWalk( [] );
      
      List<List<Widget>> nodes = [];
      // Skip TOT - tree does not carry hdivs or summaries - handled in headers below. 
      for( int treeIndex = 1; treeIndex < treeList.length; treeIndex++ ) {
            
         EquityTree t = treeList[treeIndex];

         // indent
         Widget forward = GestureDetector(
            onTap: () async 
            {
               assert( appState.equityPlan != null );
               assert( appState.equityTree != null );
               appState.equityPlan!.indent( treeIndex-1, appState.equityTree! );  // equity plan index is 1 off tree index (TOT)
               
               // Tree changed. update viewable list, then update the view
               setState(() => appState.updateEquityView = true );
            },
            key: Key( 'indent ' + treeIndex.toString()),                          // Keep key name in equityTree land.
            child: Icon( Icons.arrow_right )
            );
         
         // unindent
         Widget back = GestureDetector(
            onTap: () async 
            {
               assert( appState.equityPlan != null );
               assert( appState.equityTree != null );
               appState.equityPlan!.unindent( treeIndex-1, appState.equityTree! );  // equity plan index is 1 off tree index (TOT)
               
               setState(() => appState.updateEquityView = true );
            },
            key: Key( 'unindent ' + treeIndex.toString() ),                         // Keep index in equityTree land.
            child: Icon( Icons.arrow_left )
            );

         int depth = 0;
         if( t is EquityNode )      { depth = (t as EquityNode).getPath( t.getParent(), t.getTitle() ).length + 1; }
         else if( t is EquityLeaf ) { depth = (t as EquityLeaf).getPath( t.getParent(), t.getTitle() ).length + 1; }
         
         final  numWidth = width / 2.5;        // formalize
         final  height   = appState!.CELL_HEIGHT;
         Widget cat      = makeTableText( appState, t.getTitle(), width, height - 15, false, 1, mux: (depth+1) * .5 );
         Widget amountW  = makeTableText( appState, addCommas( t.getAmount() ), numWidth, height, false, 1 );
         
         String hpn = t.getHostName();
         Widget hostProj = Container( width: width, child: makeTableText( appState, hpn, width, height, false, 1 ) );

         // Listener index is interpreted in the view to select draggable item (i.e ReorderableListView).
         int viewIndex = treeIndex - 1 + equityTop; // tree - TOT is body, plus all headers
         Widget drag  = ReorderableDragStartListener( key: Key( "drag " + treeIndex.toString()), index: viewIndex, child: Icon( Icons.drag_handle ));
         
         Widget catEditable = GestureDetector(
            onTap: () async 
            {
               print( "Edit! from " + treeIndex.toString() );
               
               assert( appState.equityPlan != null );
               assert( appState.equityTree != null );

               String title = t.getTitle();
               String amt   = t.getAmount().toString();
               String hproj = t.getHostName();
               TextEditingController tc = new TextEditingController();
               TextEditingController ac = new TextEditingController();
               TextEditingController hp = new TextEditingController();
               String popupTitle = "Edit existing entry";
               editList( context, appState, popupTitle, lhInternal, [tc, ac, hp], [title, amt, hproj], () => _saveEdit( t, tc, ac, hp ), () => _cancelEdit(), () => _delete(t) );
            },
            key: Key( 'catEditable ' + treeIndex.toString() ),
            child: cat
            );

         Widget c        = Container( width: numWidth, height: 1 );
         Widget catCont  = Container( width: width, height: height - 15, child: catEditable );
         Widget amtCont  = Container( width: numWidth, height: height - 15, child: amountW );

         List<Widget> tileKids = [ fatPad, back, drag, forward ];
         List<Widget> none = [ c  ];
         tileKids = treeIndex == 0 ? none : tileKids;
         
         nodes.add( [ catCont, hostProj, amtCont, gapPad, Wrap( spacing: 0, children: tileKids ) ] );
      }
      
      return nodes;
   }
   
   // BuildEquityTree creates the linkages between nodes.  EquityNode controls most of the the view for each element.
   _buildEquityTree() {
      if( appState.verbose >= 1 ) { print( "Build Equity tree" ); }
      final width = frameMinWidth - 2*appState.FAT_PAD;  

      print( "Resetting PageStorageKey stamps" );
      String pageStamp = DateTime.now().millisecondsSinceEpoch.toString();

      // List<Widget> htile  = _getTile( [], "Category", 0, 0, width, pageStamp );
      appState.equityTree = EquityNode( "Category", 0, "", null, width, header: true );
      
      if( appState.equityPlan == null ) {
         appState.updateEquityPlan = false;
         return;
      }

      // Per equity line, walk the current tree (curNode) by stepping through the categories chain to see where this line belongs
      // Can't depend on walk tree here .. no tree yet!
      // In this construction, each eqLine is either a leaf or convertNode.  Can not directly step to a node - every line has at least 1 parent
      for( var eqLine in appState.equityPlan!.initializeEquity( ) ) {
         assert( appState.equityTree != null );
         assert( eqLine["amount"] != null );
         
         EquityTree curNode = appState.equityTree!;
         
         // when eqLines are created, they are leaves. Down the road, they become nodes
         List<String> cat = new List<String>.from( eqLine["category"] );
         print( " ... " + cat.toString() );
         
         EquityTree? childNode   = curNode.findNode( cat );
         EquityTree? childParent = curNode.findNode( cat.sublist(0, cat.length - 1 ) );

         // XXX any need to push this to AWS?
         // This is too harsh.  There can be identical categories, especially during editing, rebuilding, deleting.
         // Rename instead to separate.
         // assert( childNode == null );
         if( childNode != null ) {
            print( "Found identically named child.  Adding random tag to avoid this" );
            cat[ cat.length - 1] = cat[ cat.length - 1] + " " + randAlpha( 10 );
            childNode   = curNode.findNode( cat );
            assert( childNode == null );
         }

         if( childParent is EquityLeaf  ) {
            print( "... leaf upgraded to node" );
            curNode = childParent.convertToNode();
         }
         else if( childParent is EquityNode ) { 
            curNode = childParent;   
         }

         EquityLeaf tmpLeaf = EquityLeaf( cat.last, eqLine["amount"], eqLine["hostName"], curNode, width );
         (curNode as EquityNode).addLeaf( tmpLeaf );

         // print( appState.equityTree!.toStr() );          
      }
      appState.updateEquityPlan = false;

      // if( appState.equityTree != null ) {  print( appState.equityTree!.toStr() ); }
   }
   
   
   List<List<Widget>> _getCategoryWidgets( context ) {
      print( "Getting equity table widgets" );
      final width = frameMinWidth - 2*appState.FAT_PAD;        
      final  numWidth = width / 2.5;
         
      if( appState.equityPlan != null && appState.equityPlan!.ceProjectId != appState.selectedCEProject ) {
         print( "Error.  Equity plan is not for selected project." );
         return [];
      }

      List<List<Widget>> catList = [];

      if( appState.updateEquityPlan ) { _buildEquityTree(); }

      if( appState.updateEquityView ) {
         // These must be kept up to date, and updated before _getTiles.
         equityTop = 3;   // spacer + header + hdiv
         
         catList = [];
         // Header
         Widget spacer    = Container( width: 1, height: appState!.CELL_HEIGHT * .5 );
         Widget headerCat = Container( width: width,    child: makeTableText( appState, listHeaders[0],    width, appState!.CELL_HEIGHT, false, 1 ) );
         Widget headerAmt = Container( width: width,    child: makeTableText( appState, listHeaders[1],    width, appState!.CELL_HEIGHT, false, 1 ) );      
         Widget headerHPN = Container( width: numWidth, child: makeTableText( appState, listHeaders[2],    width, appState!.CELL_HEIGHT, false, 1 ));      
         Widget headerArr = Container( width: numWidth, child: makeTableText( appState, listHeaders[3], numWidth, appState!.CELL_HEIGHT, false, 1 ));
         Widget hd        = makeHDivider( 2*width + 2*numWidth - appState.GAP_PAD, appState.TINY_PAD, appState.TINY_PAD, tgap: appState.TINY_PAD, bgap: appState.TINY_PAD ); 
         Widget hdiv      = Wrap( spacing: 0, children: [fatPad, hd] );
         catList.add( [ spacer, spacer, spacer, spacer, spacer ] );
         catList.add( [ headerCat, headerAmt, headerHPN, gapPad, headerArr ] );
         catList.add( [ hdiv, empty, empty, empty, empty ] );

         // Body
         if( appState.equityPlan != null )
         {
            assert( appState.equityTree != null );
            bool changed = appState.equityPlan!.updateEquity( appState.equityTree );
            if( appState.equityPlan!.categories.length > 0 ) { 
               if( appState.verbose >= 2 ) { print( "_getCategoryWidgets Update equity" ); }
               catList.addAll( _getTiles( context, width ) );
            }
            if( changed ) { writeEqPlan(); }
         }

         // Add
         Widget agd = GestureDetector(
            onTap: () async 
            {
               print( "Add!" );
               assert( appState.equityTree != null );

               // add handles updating the plan, and the view if save is asked for
               await _add( appState.equityTree! );
            },
            key: Key( 'add_icon_equity' ),
            child: Icon( Icons.add_box_outlined )
            );
         
         Widget fullP  = Container( width: width, height: 1 );
         Widget numP   = Container( width: numWidth, height: 1 );
         catList.add( [ fullP, numP, fullP, gapPad, Wrap( spacing:0, children: [ midPad, fatPad, fatPad, agd] ) ] );

         // Summaries
         assert( appState.equityTree != null );
         List<EquityTree> treeList = appState.equityTree!.depthFirstWalk( [] );
         int sumW = 0;
         int sumO = 0;
         // XXX formalize
         for( var t in treeList ) {
            if( t.getHostName() == "---" ) { sumO += t.getAmount(); }
            else                           { sumW += t.getAmount(); }
         }
         catList.add( [ hdiv, empty, empty, empty, empty ] );
         Widget sumTotW = Container( width: width, child: makeTableText( appState, "Total with associated Host Project:", width, appState!.CELL_HEIGHT, false, 1 ) );
         Widget sumValW = Container( width: width, child: makeTableText( appState, addCommas( sumW ), numWidth, appState!.CELL_HEIGHT, false, 1 ) );
         Widget sumTotO = Container( width: width, child: makeTableText( appState, "Total without:", width, appState!.CELL_HEIGHT, false, 1 ) );
         Widget sumValO = Container( width: width, child: makeTableText( appState, addCommas( sumO ), numWidth, appState!.CELL_HEIGHT, false, 1 ) );
         Widget sumTotF = Container( width: width, child: makeTableText( appState, "Overall Total:", width, appState!.CELL_HEIGHT, false, 1 ) );
         Widget sumValF = Container( width: width, child: makeTableText( appState, addCommas( sumW+sumO ), numWidth, appState!.CELL_HEIGHT, false, 1 ) );
         catList.add( [sumTotW, fullP, sumValW, empty, empty ] );
         catList.add( [sumTotO, fullP, sumValO, empty, empty ] );
         catList.add( [sumTotF, fullP, sumValF, empty, empty ] );
         
         // Updates to equity can impact peq summary view.  updateit.
         setState(() => appState.updateAllocTree = true );                           
         appState.updateEquityView = false; 
      }

      return catList;
   }

   // NOTE: onReorder is sending a viewIndex for old, +/- offset for new.
   // sibling to forward, back  .. this is managed by drag handle listener
   void _initiateDrag( treeIndexOld, treeIndexNew ) {
      assert( appState.equityPlan != null );

      // Operations below are in equityPlan indexing, or epIndex
      final epIndexOld = treeIndexOld-equityTop;  // viewIndex -> epIndex
      int   epIndexNew = treeIndexNew-equityTop;  // viewIndex -> epIndex
      final epSize     = appState.equityPlan!.getSize();
      
      if( epIndexNew < 0 ) {
         print( "Can't move above Top of Tree.  No-op." );
         return;
      }
      if( epIndexNew > epSize ) {
         print( "Can't move lower than the bottom.  Setting length to bottom." );
         epIndexNew = epSize;
      }

      print( "Moved from (treeIndex)" + epIndexOld.toString() + " to " + epIndexNew.toString() );
      appState.equityPlan!.move( epIndexOld, epIndexNew, appState.equityTree! );


      // Tree changed. update viewable list, then update the view
      setState(() => appState.updateEquityView = true );
   }
   
   Widget getEquityPlan( context ) {
      if( appState.verbose >= 1 ) { print( "EF: Remake equity plan" ); }
      final buttonWidth = 100;
      
      List<List<Widget>> categories = [];

      categories.addAll( _getCategoryWidgets( context ) );
      
      // print( "getCategories, count: " + categories.length.toString() );
      var categoryCount = min( categories.length, 30 );                  // XXX formalize
      var categoryWidth = categories.length == 0 ? 30 : categories[0].length;  // XXX formalize

      final svHeight = ( appState.screenHeight - widget.frameHeightUsed ) * .9;
      final svWidth  = maxPaneWidth;

      if( appState.screenHeight < frameMinHeight ) {
         return makeTitleText( appState, "Really?  Can't we be a little taller?", frameMinHeight, false, 1, fontSize: 18);
      }
      else {
         var itemCount = max( categoryCount, categories.length );

         final ScrollController controller = ScrollController();

         // Keep key in tree land, to stay compatible with equity test, i.e. viewIndex - headers + TOT
         return ScrollConfiguration(
            behavior: MyCustomScrollBehavior(),
            child: SingleChildScrollView(
               scrollDirection: Axis.horizontal,
               child: SizedBox(
                  height: svHeight,
                  width: svWidth,
                  child: ReorderableListView(
                     buildDefaultDragHandles: false,
                     onReorder: (oldIndex, newIndex) { _initiateDrag(oldIndex, newIndex); ; },
                     // header: Text( "Oi!" ),
                     children: List.generate(
                        itemCount,
                        (indexX) => Row(
                           key: Key( 'equityTable ' + (indexX-equityTop+1).toString() ),
                           mainAxisSize: MainAxisSize.min,
                           children: List.generate( 
                              categoryWidth,
                              (indexY) => categories[indexX][indexY] )))
                        ))));
       }
   }
   
   
   @override
   Widget build(BuildContext context) {

      container = widget.appContainer;   
      appState  = container.state;
      assert( appState != null );

      gapPad    = Container( width: appState.GAP_PAD*2.0, height: 1 );
      fatPad    = Container( width: appState.FAT_PAD, height: 1 );
      midPad    = Container( width: appState.MID_PAD, height: 1 );
      empty = Container( width: 1, height: 1 );
      
      if( appState.verbose >= 2 ) { print( "EQUITY BUILD. " + (appState == Null).toString()); }
      
      return getEquityPlan( context );
      
 }
 
}
