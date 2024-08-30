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


String getCatFromTiles( Widget elt ) {
   String retVal = "";
   if( elt is Container && elt.child is GestureDetector ) {
      var catEdit  = elt.child as GestureDetector;
      
      retVal        = getFromMakeTableText( catEdit.child! );
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

   List<String> aRow = [];
   for( final elt in eqs ) {
      String t = getFromMakeTableText( elt );
      if( t != "" ) { aRow.add( t ); }

      t = getCatFromTiles( elt );
      if( t != "" ) { aRow.add( t ); }

      t = getAmtFromTiles( elt );
      if( t != "" ) { aRow.add( t ); }
   }

   return aRow;
}

// XXX utils?
// check gold image matches table
Future<bool> checkEqs( WidgetTester tester, int min, int max ) async {

   print( "\n" );
   for( int i = min; i <= max; i++ ) {

      print( "checking equityTable " + i.toString());  
      final Finder generatedEquityRow = find.byKey( Key( "equityTable " + i.toString() ));  

      List<String> eqs = await getElt( tester, "equityTable " + i.toString() );

      // First elt in eqs is used as key for eqs_gold
      // eqs is from the displayed table in ceFlutter, has short title, then numbers.
      // eqs_gold is const above, is a map to a list<str> with long title, then numbers.
      
      String agKey = eqs[0] + " " + i.toString();                 // offset helps avoid frontal expansions
      print( "Got eqs " + eqs.toString() + " making agKey " + agKey );

      List<String> agVals  = EQS_GOLD[ agKey ] ?? [];
      print( "  checking " + agKey + ": " + agVals.toString() );

      // XXX this is skipping ancestors, indents, etc. bad.    count c's?
      for( var j = 1; j < 2; j++ ) { expect( eqs[j], agVals[j] ); }
   }
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

         await logout( tester );         

         report( 'Equity Mvmt Page' );
      });

}
     
