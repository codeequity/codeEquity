import 'dart:math';
import 'dart:ui';    // pointerKinds
import 'dart:convert';  // json encode/decode

import 'package:flutter/material.dart';
import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/models/equity.dart';

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
            this.frameHeightUsed,
            } ) : super(key: key);

  @override
  _CEEquityState createState() => _CEEquityState();

}

class _CEEquityState extends State<CEEquityFrame> {

   late var      container;
   late AppState appState;

   static const maxPaneWidth = 950.0;

   // iphone 5
   static const frameMinWidth  = 320.0;     // XXX appState
   static const frameMinHeight = 300;       // 568.0;
   
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
   
   
   void _saveEdit( EquityTree t, titleController, amountController) {
      print( "Save edit " + titleController.text + " " + amountController.text );
      if( titleController.text != t.getTitle() || amountController.text != t.getAmount.toString() )
      {
         print( "Change detected" );
         t.setTitle( titleController.text );
         t.setAmount( int.parse( amountController.text ));

         // Tree changed. update viewable list, then update the view
         // appState.equityPlan!.updateEquity( appState.equityTree );
         setState(() => appState.updateEquityView = true );                  
      }

      writeEqPlan();
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
      // appState.equityPlan!.updateEquity( appState.equityTree );
      setState(() => appState.updateEquityView = true );
      
      writeEqPlan();
      Navigator.of( context ).pop();
   }

   void _saveAdd( EquityTree tot, titleController, amountController) {
      final width = frameMinWidth - 2*appState.FAT_PAD;
      EquityTree t = EquityLeaf( titleController.text, int.parse( amountController.text ), tot, width );
      (tot as EquityNode).addLeaf( t );
      
      // appState.equityPlan!.updateEquity( appState.equityTree );
      // Tree changed.  Update the view
      setState(() => appState.updateEquityView = true );                  

      writeEqPlan();
      Navigator.of( context ).pop();
   }
   
   Future<void> _add( EquityTree tot) async {
      print( "Add category " );
      TextEditingController title = new TextEditingController( text: "new category" );
      TextEditingController amt   = new TextEditingController( text: "0" );
      await editRow( context, appState, "Add new Category, Amount (without commas)", [title, amt], () => _saveAdd( tot, title, amt ), () => _cancelEdit(), null );
   }

   // Reorderable listener takes an index which much be reset and rebuilt every time a drag occurs.
   List<List<Widget>> _getTiles( context, width ) {
      assert( appState.equityTree != null );
      List<EquityTree> treeList = appState.equityTree!.depthFirstWalk( [] );
      
      List<List<Widget>> nodes = [];
      Widget empty = Container( width: 1, height: 1 );
      // Skip TOT.. handled in headers below
      for( int index = 1; index < treeList.length; index++ ) {
            
         // indent
         Widget fgd = GestureDetector(
            onTap: () async 
            {
               print( "Forward! Currently at " + index.toString() );
               
               assert( appState.equityPlan != null );
               assert( appState.equityTree != null );
               appState.equityPlan!.indent( index, appState.equityTree! );
               
               // Tree changed. update viewable list, then update the view
               // appState.equityPlan!.updateEquity( appState.equityTree );
               setState(() => appState.updateEquityView = true );                  
            },
            child: Icon( Icons.arrow_right )
            );
         
         // unindent
         Widget bgd = GestureDetector(
            onTap: () async 
            {
               print( "back! from " + index.toString() );
               
               assert( appState.equityPlan != null );
               assert( appState.equityTree != null );
               appState.equityPlan!.unindent( index, appState.equityTree! );
               
               // Tree changed. update viewable list, then update the view
               // appState.equityPlan!.updateEquity( appState.equityTree );
               setState(() => appState.updateEquityView = true );                  
            },
            child: Icon( Icons.arrow_left )
            );

         EquityTree t = treeList[index];

         int depth = 0;
         if( t is EquityNode )      { depth = (t as EquityNode).getPath( t.getParent(), t.getTitle() ).length + 1; }
         else if( t is EquityLeaf ) { depth = (t as EquityLeaf).getPath( t.getParent(), t.getTitle() ).length + 1; }
         
         final  numWidth = width / 3.0;      
         final  height   = appState!.CELL_HEIGHT;
         Widget amountW  = makeTableText( appState!, addCommas( t.getAmount() ), numWidth, height, false, 1 );
         // XXX YYY
         // Widget cat      = makeTableText( appState, t.getTitle(), width, height, false, 1, mux: (depth+1) * .5 );
         Widget cat      = makeTableText( appState, t.getTitle(), width, height - 20, false, 1, mux: (depth+1) * .5 );
         Widget forward  = fgd;
         Widget back     = bgd;
         Widget drag     = ReorderableDragStartListener( index: index, child: Icon( Icons.drag_handle ));

         Widget catEditable = GestureDetector(
            onTap: () async 
            {
               print( "Edit! from " + index.toString() );
               
               assert( appState.equityPlan != null );
               assert( appState.equityTree != null );

               TextEditingController title = new TextEditingController( text: t.getTitle() );
               TextEditingController amt   = new TextEditingController( text: t.getAmount().toString() );
               editRow( context, appState, "Edit Category, Amount (without commas)", [title, amt], () => _saveEdit( t, title, amt ), () => _cancelEdit(), () => _delete(t) );
            },
            child: cat
            );

         // XXX YYY XZZZ 20?
         Widget c        = Container( width: numWidth, height: 1 );
         // Widget catCont  = Container( width: width, height: height, child: catEditable );
         Widget catCont  = Container( width: width, height: height - 20, child: catEditable );

         List<Widget> tileKids = [ c, bgd, drag, fgd ];
         List<Widget> none = [ c  ];
         tileKids = index == 0 ? none : tileKids;

         // This is ugly.  It can work, but is not working well as is.  Probably nixable
         /*
         List<Widget> top =  [ c,  drag, fgd ];
         List<Widget> bot =  [ c, bgd, drag ];
         tileKids = t.getParent() == appState.equityTree ? top : tileKids;
         if( index > 0 && t.getParent() == treeList[index - 1] ) { tileKids = bot; }
         */
         
         Widget tile = Container(
            width: width * 2,
            // XXX YYY
            // height: height,
            height: height - 20,
            child: ListTileTheme(
               dense: true,
               child: ListTile(
                  trailing:  Wrap(
                     spacing: 0,
                     // key: new PageStorageKey(getPathName() + getTitle() + stamp),
                     children: tileKids,
                     ),
                  title: amountW
                  )));
         
         print( "Get currentNode adding " + t.getTitle() );
         
         nodes.add( [ catCont, tile ] );
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
      appState.equityTree = EquityNode( "Category", 0, null, width, header: true );
      
      if( appState.equityPlan == null ) {
         appState.updateEquityPlan = false;
         return;
      }

      // Per equity line, walk the current tree (curNode) by stepping through the categories chain to see where this line belongs
      // Can't depend on walk tree here .. no tree yet!
      // In this construction, each eqLine is either a leaf or convertNode.  Can not directly step to a node - every line has at least 1 parent
      int ithLine = 0;
      for( Equity eqLine in appState.equityPlan!.initializeEquity( ) ) {
         ithLine += 1;
         assert( appState.equityTree != null );
         assert( eqLine.amount != null );
         
         EquityTree curNode = appState.equityTree!;
         print( "Making " + eqLine.toString() );
         
         // when eqLines are created, they are leaves. Down the road, they become nodes
         List<String> cat = eqLine.category;
         // List<Widget> tile  = _getTile( cat.sublist(0, cat.length-1), cat.last, eqLine.amount, ithLine, width, pageStamp );
            
         EquityTree? childNode   = curNode.findNode( eqLine.category );
         EquityTree? childParent = curNode.findNode( eqLine.category.sublist(0, eqLine.category.length - 1 ) );
         assert( childNode == null );

         if( childParent is EquityLeaf  ) {
            print( "... leaf upgraded to node" );
            curNode = childParent.convertToNode();
         }
         else if( childParent is EquityNode ) { 
            curNode = childParent;   
         }

         EquityLeaf tmpLeaf = EquityLeaf( eqLine.category.last, eqLine.amount, curNode, width ); 
         (curNode as EquityNode).addLeaf( tmpLeaf );

         // print( appState.equityTree!.toStr() );          
      }
      appState.updateEquityPlan = false;

      if( appState.equityTree != null ) {  print( appState.equityTree!.toStr() ); }
   }
   
   
   List<List<Widget>> _getCategoryWidgets( context ) {
      final width = frameMinWidth - 2*appState.FAT_PAD;        
      var empty = Container( width: 1, height: 1 );

      if( appState.equityPlan != null && appState.equityPlan!.ceProjectId != appState.selectedCEProject ) {
         print( "Error.  Equity plan is not for selected project." );
         return [];
      }

      List<List<Widget>> catList = [];

      if( appState.updateEquityPlan ) { _buildEquityTree(); }

      if( appState.updateEquityView ) {
         catList = [];
         Widget headerC = makeTableText( appState, "Category", width, appState!.CELL_HEIGHT, false, 1 );
         Widget headerA = makeTableText( appState, "Amount",   width, appState!.CELL_HEIGHT, false, 1 );      
         catList.add( [ headerC, headerA ] );
         print( "Added headers" );
         
         if( appState.equityPlan != null )
         {
            assert( appState.equityTree != null );
            appState.equityPlan!.updateEquity( appState.equityTree );
            if( appState.equityPlan!.categories.length > 0 ) { 
               if( appState.verbose >= 2 ) { print( "_getCategoryWidgets Update equity" ); }
               catList.addAll( _getTiles( context, width ) );
            }
         }

         // add
         Widget agd = GestureDetector(
            onTap: () async 
            {
               print( "Add!" );
               assert( appState.equityTree != null );

               // add handles updating the plan, and the view if save is asked for
               await _add( appState.equityTree! );
            },
            child: Icon( Icons.add_box_outlined )
            );
         
         catList.add( [agd, empty] );
         print( "Added Footers" );

         appState.updateEquityView = false; 
      }

      return catList;
   }

   // sibling to fgd, bgd  .. this is managed by drag handle listener
   void _updateListItems( oldIndex, newIndex ) {
      assert( appState.equityPlan != null );

      print( "Moved from " + oldIndex.toString() + " to " + newIndex.toString() );
      appState.equityPlan!.move( oldIndex, newIndex, appState.equityTree! );


      // Tree changed. update viewable list, then update the view
      // appState.equityPlan!.updateEquity( appState.equityTree );
      setState(() => appState.updateEquityView = true );
   }
   
   Widget getEquityPlan( context ) {
      if( appState.verbose >= 1 ) { print( "EF: Remake equity plan" ); }
      final buttonWidth = 100;
      
      List<List<Widget>> categories = [];

      categories.addAll( _getCategoryWidgets( context ) );
      
      // categoryCount changes with each expand/contract
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


         return ScrollConfiguration(
            behavior: MyCustomScrollBehavior(),
            child: SingleChildScrollView(
               scrollDirection: Axis.horizontal,
               child: SizedBox(
                  height: svHeight,
                  width: svWidth,
                  child: ReorderableListView(
                     buildDefaultDragHandles: false,
                     onReorder: (oldIndex, newIndex) { _updateListItems(oldIndex, newIndex); ; },
                     header: Text( "Oi!" ),
                     children: List.generate(
                        itemCount,
                        (indexX) => Row(
                           key: Key( 'equityTable ' + indexX.toString() ),
                           mainAxisSize: MainAxisSize.min,
                           children: List.generate( 
                              categoryWidth,
                              (indexY) => categories[indexX][indexY] )))
                        ))));
      }
   }
   
   
   @override
   Widget build(BuildContext context) {

      container   = widget.appContainer;   
      appState    = container.state;
      assert( appState != null );
     
      if( appState.verbose >= 2 ) { print( "EQUITY BUILD. " + (appState == Null).toString()); }

      return getEquityPlan( context );
      
 }
 
}
