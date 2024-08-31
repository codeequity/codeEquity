@Timeout(Duration(minutes: 25))

import 'dart:convert';  // json encode/decode
import 'dart:async';   // timer

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart'; // key
import 'package:fluttertoast/fluttertoast.dart';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'utils.dart';

/*
https://api.flutter.dev/flutter/flutter_test/CommonFinders/byKey.html
https://docs.flutter.dev/testing/integration-tests
https://medium.flutterdevs.com/integration-testing-with-flutter-7381bb8b5d28
https://docs.flutter.dev/testing/integration-tests/migration
https://github.com/flutter/flutter/wiki/Running-Flutter-Driver-tests-with-Web
*/

// Gold standard for testing ingest and summary frame for codeequity/ceFlutterTester
const Map<String,List<String>> EQS_GOLD =
{
   "Category 0": ["Category", "Amount"],
      
      "Business Operations Flut 1":        ["Category, Business Operations Flut", "1,000,000"],
      "Software Contributions Flut 2":     ["Category, Software Contributions Flut", "11,000,000"],
        "AWS Operations 3":                ["Category, Software Contributions Flut, AWS Operations", "1,000,000"],
        "Github Operations Flut 4":        ["Category, Software Contributions Flut, Github Operations", "1,000,000"],
        "CEServer 5":                      ["Category, Software Contributions Flut, CEServer", "3,000,000"],
        "CEFlutter 6":                     ["Category, Software Contributions Flut, CEFlutter", "2,000,000"],
        "Data Security Flut 7":            ["Category, Software Contributions Flut, Data Security Flut", "1,000,000"],
        "Unallocated 8":                   ["Category, Software Contributions Flut, Unallocated", "3,000,000"],
      "Cross Proj 9":                      ["Category, Cross Proj", "0"],
      "A Pre-Existing Project Flut 10":    ["Category, A Pre-Existing Project Flut", "0"],
      "Unallocated 11":                    ["Category, Unallocated", "3,000,000"],
};


// XXX utils?
// XXX ? move these accessors next to original functions?
// from utils
String getFromMakeTableText( Widget elt ) {
   String retVal = "";
   if( elt is Padding ) {
      var container = elt.child as Container;
      var contText  = container.child as Text; 
      retVal        = contText.data ?? "";
   }
   return retVal;
}

// Get depth by working out the mux passed in.
// This looks nasty on the face of it, but it is the only way (currently) to ensure visual output is correct, showing hierarchy.
// Actual ancesterage is worked out in checkEqs.
int getDepthFromCat( Widget elt ) {
   int depth = 1;
   if( elt is Container && elt.child is GestureDetector ) {
      var catEdit  = elt.child as GestureDetector;
      final double gappad = 20.0; // app_state.GAP_PAD   XXX pull this in?  hmmm..

      // mux: (depth+1) * .5 )
      if( catEdit.child! is Padding ) {
         var mtt       = catEdit.child as Padding;
         var edgeInset = mtt.padding as EdgeInsets;

         // ratio of 1.5 gives 3, but 2 of that is from depth+1 above
         depth = ( ( edgeInset.left / gappad ) / 0.5 ).round() - 2; 
         // print( "edgeInsetLeft " + edgeInset.left.toString() + " depth " + depth.toString() );
      }

   }
   return depth;
}

String getCatFromTiles( Widget elt ) {
   String retVal = "";
   if( elt is Container && elt.child is GestureDetector ) {
      var catEdit  = elt.child as GestureDetector;
      retVal       = getFromMakeTableText( catEdit.child! );
   }
   return retVal;
}


String getAmtFromTiles( Widget elt ) {
   String retVal = "";
   if( elt is Container && elt.child is ListTileTheme ) {
      var listTile  = elt.child as ListTileTheme;
      var tile      = listTile.child as ListTile;
      
      retVal        = getFromMakeTableText( tile.title! );
   }
   return retVal;
}


// XXX utils?
Future<List<String>> getElt( WidgetTester tester, String keyName ) async {
   final Finder generatedEquityRow = find.byKey( Key( keyName ));
   expect( generatedEquityRow, findsOneWidget );

   var equityRow = generatedEquityRow.evaluate().single.widget as Row;
   var eqs   = equityRow.children as List;
   int depth = 0;
   
   List<String> aRow = [];
   for( final elt in eqs ) {
      String t = getFromMakeTableText( elt );
      if( t != "" ) { aRow.add( t ); }

      t = getCatFromTiles( elt );
      if( t != "" ) {
         aRow.add( t );
         depth = getDepthFromCat( elt );
         // print( "Got Cat, depth " + t + " " + depth.toString() );
      }

      t = getAmtFromTiles( elt );
      if( t != "" ) { aRow.add( t ); }

   }

   aRow.add( depth.toString() );
   return aRow;
}

// XXX utils?
// check gold image matches table.  min, max are onscreen order
Future<bool> checkEqs( WidgetTester tester, int min, int max, {int offset = 0, int newDepth = -1} ) async {

   for( int i = min; i <= max; i++ ) {

      // print( "checking equityTable " + i.toString() + " with gold table offset " + offset.toString() );  
      final Finder generatedEquityRow = find.byKey( Key( "equityTable " + i.toString() ));  

      // eqs is [leaf, amount, depth]
      List<String> eqs = await getElt( tester, "equityTable " + i.toString() );

      // First elt in eqs is used as key for eqs_gold
      // eqs is from the displayed table in ceFlutter, has short title, then numbers.
      // eqs_gold is const above, is a map to a list<str> with long title, then numbers.
      
      String agKey = eqs[0] + " " + (i+offset).toString();                 
      print( "Got eqs " + eqs.toString() + " making agKey " + agKey );

      List<String> agVals  = EQS_GOLD[ agKey ] ?? [];
      // print( "  checking " + agKey + ": " + agVals.toString() );

      // depth is # commas, i.e. Soft Cont is depth 1 making TOT depth 0
      int goldDepth = newDepth != -1 ? newDepth : ','.allMatches( agVals[0] ).length;
      expect( goldDepth, int.parse( eqs[2] ) );
      for( var j = 1; j < 2; j++ ) { expect( eqs[j], agVals[j] ); }
   }
   return true;
}

Future<bool> validateDragAboveTOT( WidgetTester tester, int index, int spots ) async {
   print( "\nDrag above TOT" );
   String keyName         = "drag " + index.toString(); 
   final Finder ceFlutter = find.byKey( Key( keyName ) );

   await tester.drag(ceFlutter, Offset(0.0, 30.0 * spots ));
   await tester.pumpAndSettle();
   await pumpSettle( tester, 1 );   // give a small chance to see move

   // Should be no impact, can not move above TOT
   expect( await checkEqs( tester, 1, 11 ), true );

   return true;
}

// XXX parentage of ceFlutter changed.  Now depth 1.  Gold table has it at depth 2.  
Future<bool> validateDragAboveBusOp( WidgetTester tester, int index, int spots ) async {
   print( "\nDrag above BusOp" );
   String keyName         = "drag " + index.toString(); 
   final Finder ceFlutter = find.byKey( Key( keyName ) );

   await tester.drag(ceFlutter, Offset(0.0, 30.0 * spots ));
   await tester.pumpAndSettle();
   await pumpSettle( tester, 1 );   // give a small chance to see move

   expect( await checkEqs( tester, 1,       1,     offset:  5, newDepth: 1  ), true );  // screen sees ceFlut in position1. add offset to get ceFlut in gold image.
   expect( await checkEqs( tester, 2,       index, offset: -1               ), true );  // 2,6 need to look backwards in gold image
   expect( await checkEqs( tester, index+1, 11                              ), true );  // all after ceFlutter not impacted

   // Undo
   keyName                   = "drag " + (index + spots).toString();   // new location
   final Finder ceFlutterNew = find.byKey( Key( keyName ) );
   await tester.drag(ceFlutterNew, Offset(0.0, 30.0 * (-1.0 * spots )));
   await tester.pumpAndSettle();
   await pumpSettle( tester, 1 );   // give a small chance to see move
   
   return true;
}

void main() {

   String repo = "codeequity/ceFlutterTester";
   
   // final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized() as IntegrationTestWidgetsFlutterBinding;
   IntegrationTestWidgetsFlutterBinding.ensureInitialized();

   // bool skip = true;
   bool skip = false;

   // override?  Run it.
   var override = const String.fromEnvironment('override');
   if( override == "True" ) { skip = false; }
   
   report( 'Equity', group:true );

   print( "Mvmt" );
   // testWidgets('Equity Mvmt Page', skip:true, (WidgetTester tester) async {
   testWidgets('Equity Mvmt Page', skip:skip, (WidgetTester tester) async {
         
         await restart( tester );
         await login( tester, true );

         expect( await verifyAriHome( tester ), true );
         
         final Finder ariLink = find.byKey( Key( repo ));
         await tester.tap( ariLink );
         await pumpSettle( tester, 2, verbose: true ); 
         await pumpSettle( tester, 2, verbose: true ); 

         expect( await equityPlanTabFraming( tester ),   true );

         // Check initial equity structure
         expect( await checkEqs( tester, 1, 11 ), true );

         // Check basic drags for ceFlutter
         await validateDragAboveTOT(   tester, 6, -6 );  // moving 6 spots up
         await validateDragAboveBusOp( tester, 6, -5 );
         /*
         validateDragAboveSoftCont( tester );
         validateDragAboveDataSec( tester );   // original home
         validateDragToBottom( tester );
         validateDragAboveDataSec( tester );   // original home
         */
         
         // Check indents, unindents
         // Check drags with heavy hierarchy
         // Check Save, add, delete, cancel
         
         await logout( tester );         

         report( 'Equity Mvmt Page' );
      });

}
     
