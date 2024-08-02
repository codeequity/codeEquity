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
   }

   
   List<Widget> _getTile( path, convertedName, amtInt, width, depthM1 ) {
      assert( appState != null );
      
      final  numWidth = width / 3.0;      
      final  height   = appState!.CELL_HEIGHT;
      String amount   = addCommas( amtInt );
      Widget amountW  = makeTableText( appState!, amount, numWidth, height, false, 1 );      
      Widget cat      = makeTableText( appState, convertedName, width, height, false, 1, mux: (depthM1+1) * .5 );
      
      return [cat, amountW];
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
            catList.add( _getTile( cat.sublist(0, cat.length-1), cat.last, amt, width, cat.length ) ); 
         }
         appState.updateEquityPlan = false;
      }
      return catList;
   }

   void _updateListItems( oldIndex, newIndex ) {
      assert( appState.equityPlan != null );

      // When moving an item up (i.e. oldIndex > newIndex), all is as expected.
      // When moving an item down, then newIndex is +1.
      // For example, 3 items.  move middle to 0th position gives (1 -> 0)
      //                        move middle to last position gives (1 -> 3)

      if( oldIndex < newIndex ) { newIndex = newIndex - 1; }
      print( "Moved from " + oldIndex.toString() + " to " + newIndex.toString() );
      appState.equityPlan!.move( oldIndex, newIndex );

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
                     onReorder: (oldIndex, newIndex) { _updateListItems(oldIndex, newIndex); ; },
                     header: Text( "Oi!" ),
                     children: List.generate(
                        itemCount,
                        (indexX) => Row(
                           key: Key( 'equityTable ' + indexX.toString() ),                           
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
