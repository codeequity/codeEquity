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


class CEEquityFrame extends StatefulWidget {
   final frameHeightUsed;
   var   appContainer;
   final pageStamp;

   CEEquityFrame(
      {Key? key,
            this.appContainer,
            this.pageStamp,
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
   static const frameMinWidth  = 320.0;
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
      appState.updateEquityPlan = true;
   }

   
   List<Widget> _getTile( path, convertedName, amtInt, index, width, depthM1 ) {
      assert( appState != null );

      // indent
      Widget fgd = GestureDetector(
         onTap: () async 
         {
            print( "Forward! Currently at " + index.toString() );

            assert( appState.equityPlan != null );
            appState.equityPlan!.indent( index );
               
            setState(() => appState.updateEquityPlan = true );                  
         },
         child: Icon( Icons.arrow_right )
         );

      // unindent
      Widget bgd = GestureDetector(
         onTap: () async 
         {
            print( "back! from " + index.toString() );

            assert( appState.equityPlan != null );
            appState.equityPlan!.unindent( index, 0 );
               
            setState(() => appState.updateEquityPlan = true );                  
         },
         child: Icon( Icons.arrow_left )
         );

      
      final  numWidth = width / 3.0;      
      final  height   = appState!.CELL_HEIGHT;
      String amount   = addCommas( amtInt );
      Widget amountW  = makeTableText( appState!, amount, numWidth, height, false, 1 );      
      Widget cat      = makeTableText( appState, convertedName, width, height, false, 1, mux: (depthM1+1) * .5 );
      Widget forward  = fgd;
      Widget back     = bgd;
      Widget drag     = ReorderableDragStartListener( index: index, child: Icon( Icons.drag_handle ) ); 

      Widget c        = Container( width: numWidth, height: 1 );
      Widget catCont  = Container( width: width, height: height, child: cat );
      
      Widget tile = Container(
         width: width * 2,
         height: height,
         child: ListTileTheme(
            dense: true,
            child: ListTile(
               trailing:  Wrap(
                  spacing: 0,
                  children: <Widget>[ c, bgd, drag, fgd ],
                  ),
               title: amountW
               )));
      
      return [catCont, tile];

   }
   
   List<List<Widget>> _getCategoryWidgets() {
      final width = frameMinWidth - 2*appState.FAT_PAD;        
      var c = Container( width: 1, height: 1 );

      List<List<Widget>> catList = [];

      if( appState.updateEquityPlan ) {
         
         print( "Getting Widgets!" );
         
         assert( appState.equityPlan != null );
         
         for( int i = 0; i < appState.equityPlan!.categories.length; i++ ) {
            List<String> cat = appState.equityPlan!.categories[i];
            int          amt = appState.equityPlan!.amounts[i];
            catList.add( _getTile( cat.sublist(0, cat.length-1), cat.last, amt, i, width, cat.length ) ); 
         }
         print( appState.equityPlan.toString() );
         appState.updateEquityPlan = false;
      }
      return catList;
   }

   void _updateListItems( oldIndex, newIndex ) {
      assert( appState.equityPlan != null );

      print( "Moved from " + oldIndex.toString() + " to " + newIndex.toString() );
      appState.equityPlan!.move( oldIndex, newIndex, 0 );

      setState(() => appState.updateEquityPlan = true );      
   }
   
   Widget getEquityPlan( context ) {
      if( appState.verbose >= 2 ) { print( "EF: Remake equity plan" ); }
      final buttonWidth = 100;
      
      List<List<Widget>> categories = [];

      categories.addAll( _getCategoryWidgets() );
      
      // categoryCount changes with each expand/contract
      // print( "getCategories, count: " + categories.length.toString() );
      var categoryCount = min( categories.length, 30 );
      var categoryWidth = categories[0].length;

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
