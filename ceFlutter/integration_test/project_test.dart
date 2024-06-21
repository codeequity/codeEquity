import 'dart:convert';  // json encode/decode
import 'dart:async';   // timer
// import 'dart:html' as html;    // refresh button?

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
// check app_state.. that'd be good..
// https://blog.gskinner.com/archives/2021/06/flutter-a-deep-dive-into-integration_test-library.html
// https://github.com/flutter/flutter/tree/master/packages/flutter/test/material

// Gold standard for testing ingest and summary frame for codeequity/ceFlutterTester
// XXX Category should show ["7,000,000", "12,840", "2,500", "11,001"] in ceFlutter
// XXX Test for presence in gold not replicated in ceFlutter
// XXX Discrepencies:
//     - "Category, Software Contributions, Data Security Flut, Pending PEQ Approval, Unassigned": ["0", "250", "0", "0"],   ir plan split is assigned
//     - "Category, UnClaimed, Accrued, ariCETester": ["0", "0", "0", "2,000"] does not exist (possibly one of the intentional deletes)
//     - "Category, UnClaimed, UnClaimed, Unassigned": ["0", "1,709", "0", "0"] github shows 709
//     - Entry 38, 'split' would actually have a random tag after the name, but that is hard to match in checkAllocs
const Map<String,List<String>> ALLOCS_GOLD =
{
   "Category 0": ["Category", "Allocation", "Planned", "Pending", "Accrued", "Surplus"],
      
      "Software Contributions 1": ["Category, Software Contributions", "5,500,000", "3,455", "1,750", "6,501", "5,488,294"],
      
      "Data Security Flut 2":      ["Category, Software Contributions, Data Security Flut", "1,000,000", "500", "250", "4,000", "995,250"],
         "Accrued 3":              ["Category, Software Contributions, Data Security Flut, Accrued", "0", "0", "0", "4,000", "---"],
            "builderCE 4":         ["Category, Software Contributions, Data Security Flut, Accrued, builderCE", "0", "0", "0", "1,000", "---"],
            "ariCETester 5":       ["Category, Software Contributions, Data Security Flut, Accrued, ariCETester", "0", "0", "0", "3,000", "---"],
         "Pending PEQ Approval 6": ["Category, Software Contributions, Data Security Flut, Pending PEQ Approval", "0", "0", "250", "0", "---"],
            "ariCETester 7":       ["Category, Software Contributions, Data Security Flut, Pending PEQ Approval, ariCETester", "0", "0", "250", "0", "---"],
         "Planned 8":              ["Category, Software Contributions, Data Security Flut, Planned", "750,000", "500", "0", "0", "---"],
            "builderCE 9":         ["Category, Software Contributions, Data Security Flut, Planned, builderCE", "0", "500", "0", "0", "---"],
            "IR Alloc split 10":   ["Category, Software Contributions, Data Security Flut, Planned, IR Alloc split", "500,000", "0", "0", "0", "500,000"],
            "IR Alloc split 11":   ["Category, Software Contributions, Data Security Flut, Planned, IR Alloc split", "250,000", "0", "0", "0", "250,000"],

      "Github Operations Flut 12":  ["Category, Software Contributions, Github Operations Flut", "1,500,000", "2,955", "1,500", "2,501", "1,493,044"],
         "Pending PEQ Approval 13": ["Category, Software Contributions, Github Operations Flut, Pending PEQ Approval", "0", "0", "1,500", "0", "---"],
            "ariCETester 14":       ["Category, Software Contributions, Github Operations Flut, Pending PEQ Approval, ariCETester", "0", "0", "750", "0", "---"],
            "builderCE 15":         ["Category, Software Contributions, Github Operations Flut, Pending PEQ Approval, builderCE", "0", "0", "750", "0", "---"],
         "Accrued 16":              ["Category, Software Contributions, Github Operations Flut, Accrued", "0", "0", "0", "2,501", "---"],
            "ariCETester 17":       ["Category, Software Contributions, Github Operations Flut, Accrued, ariCETester", "0", "0", "0", "2,000", "---"],
            "builderCE 18":         ["Category, Software Contributions, Github Operations Flut, Accrued, builderCE", "0", "0", "0", "501", "---"],
         "Planned 19":              ["Category, Software Contributions, Github Operations Flut, Planned", "2,000,000", "1,751", "0", "0", "---"],
            "ariCETester 20":       ["Category, Software Contributions, Github Operations Flut, Planned, ariCETester", "0", "250", "0", "0", "---"],
            "Alloc prog 21":        ["Category, Software Contributions, Github Operations Flut, Planned, Alloc prog", "1,000,000", "0", "0", "0", "1,000,000"],
            "Alloc accr 22":        ["Category, Software Contributions, Github Operations Flut, Planned, Alloc accr", "1,000,000", "0", "0", "0", "1,000,000"],
            "Unassigned 23":        ["Category, Software Contributions, Github Operations Flut, Planned, Unassigned", "0", "1,501", "0", "0", "---"],
         "In Progress 24":          ["Category, Software Contributions, Github Operations Flut, In Progress", "0", "500", "0", "0", "---"],
            "builderCE 25":         ["Category, Software Contributions, Github Operations Flut, In Progress, builderCE", "0", "500", "0", "0", "---"],
         "Stars 26":                ["Category, Software Contributions, Github Operations Flut, Stars", "125,000", "0", "0", "0", "---"],
            "IR Alloc 27":          ["Category, Software Contributions, Github Operations Flut, Stars, IR Alloc", "125,000", "0", "0", "0", "125,000"],
         "Stripes 28":              ["Category, Software Contributions, Github Operations Flut, Stripes", "1,000,000", "704", "0", "0", "---"],
            "Component Alloc 29":   ["Category, Software Contributions, Github Operations Flut, Stripes, Component Alloc", "1,000,000", "0", "0", "0", "1,000,000"],
            "ariCETester 30":       ["Category, Software Contributions, Github Operations Flut, Stripes, ariCETester", "0", "352", "0", "0", "---"],
            "builderCE 31":         ["Category, Software Contributions, Github Operations Flut, Stripes, builderCE", "0", "352", "0", "0", "---"],

      "Unallocated 32":             ["Category, Software Contributions, Unallocated", "3,000,000", "0", "0", "0", "3,000,000"],

      "Business Operations 33":     ["Category, Business Operations", "1,000,000", "0", "0", "0", "1,000,000"],
         "Unallocated 34":          ["Category, Business Operations, Unallocated", "1,000,000", "0", "0", "0", "1,000,000"],

      "UnClaimed 35":                    ["Category, UnClaimed", "0", "7,234", "0", "0", "---"],
         "UnClaimed 36":                 ["Category, UnClaimed, UnClaimed", "0", "7,234", "0", "0", "---"],
            "ariCETester 37":            ["Category, UnClaimed, UnClaimed, ariCETester", "0", "3,467", "0", "0", "---"],
            "builderCE 38":              ["Category, UnClaimed, UnClaimed, builderCE", "0", "2,411", "0", "0", "---"],
            "Unassigned 39":             ["Category, UnClaimed, UnClaimed, Unassigned", "0", "604", "0", "0", "---"],
            "connieCE 40":               ["Category, UnClaimed, UnClaimed, connieCE", "0", "752", "0", "0", "---"],

      "A Pre-Existing Project Flut 41":  ["Category, A Pre-Existing Project Flut", "125,000", "1,500", "0", "1,500", "122,000"],
         "Bacon 42":                     ["Category, A Pre-Existing Project Flut, Bacon", "125,000", "1,500", "0", "0", "123,500"],
            "ariCETester 43":            ["Category, A Pre-Existing Project Flut, Bacon, ariCETester", "0", "500", "0", "0", "---"],
            "IR Alloc split 44":         ["Category, A Pre-Existing Project Flut, Bacon, IR Alloc split", "125,000", "0", "0", "0", "125,000"],
            "Unassigned 45":             ["Category, A Pre-Existing Project Flut, Bacon, Unassigned", "0", "1,000", "0", "0", "---"],
         "Accrued 46":                   ["Category, A Pre-Existing Project Flut, Accrued", "0", "0", "0", "1,500", "---"],
            "ariCETester 47":            ["Category, A Pre-Existing Project Flut, Accrued, ariCETester", "0", "0", "0", "1,500", "---"],

      "Cross Proj 48":           ["Category, Cross Proj", "0", "704", "0", "0", "---"],
         "Cross Col 49":         ["Category, Cross Proj, Cross Col", "0", "704", "0", "0", "---"],
            "ariCETester 50":    ["Category, Cross Proj, Cross Col, ariCETester", "0", "352", "0", "0", "---"],
            "builderCE 51":      ["Category, Cross Proj, Cross Col, builderCE", "0", "352", "0", "0", "---"],

};
/*
const Map<String,List<String>> ALLOCS_GOLD =
{
   "Category 0": ["Category", "7,000,000", "12,840", "2,500", "11,001"],
      
      "Software Contributions 1": ["Category, Software Contributions", "5,500,000", "2,001", "1,500", "6,501"],
      
      "Data Security Flut 2":    ["Category, Software Contributions, Data Security Flut", "1,000,000", "250", "0", "4,000"],
      "Accrued 3":               ["Category, Software Contributions, Data Security Flut, Accrued", "0", "0", "0", "4,000"],
      
      "builderCE 4":            ["Category, Software Contributions, Data Security Flut, Accrued, builderCE", "0", "0", "0", "1,000"],
      "ariCETester 5":          ["Category, Software Contributions, Data Security Flut, Accrued, ariCETester", "0", "0", "0", "3,000"],
      "Pending PEQ Approval 6": ["Category, Software Contributions, Data Security Flut, Pending PEQ Approval", "0", "250", "0", "0"],
      "Unassigned 7":           ["Category, Software Contributions, Data Security Flut, Pending PEQ Approval, Unassigned", "0", "250", "0", "0"],

      "Github Operations Flut 8":     ["Category, Software Contributions, Github Operations Flut", "1,500,000", "1,751", "1,500", "2,501"],
      "In Progress 9":           ["Category, Software Contributions, Github Operations Flut, In Progress", "0", "1,000", "0", "0"],
      "builderCE 10":            ["Category, Software Contributions, Github Operations Flut, In Progress, builderCE", "0", "1,000", "0", "0"],
      "Pending PEQ Approval 11": ["Category, Software Contributions, Github Operations Flut, Pending PEQ Approval", "0", "0", "1,500", "0"],
      "ariCETester 12":          ["Category, Software Contributions, Github Operations Flut, Pending PEQ Approval, ariCETester", "0", "0", "750", "0"],
      "builderCE 13":            ["Category, Software Contributions, Github Operations Flut, Pending PEQ Approval, builderCE", "0", "0", "750", "0"],
      "Accrued 14":              ["Category, Software Contributions, Github Operations Flut, Accrued", "0", "0", "0", "2,501"],
      "ariCETester 15":          ["Category, Software Contributions, Github Operations Flut, Accrued, ariCETester", "0", "0", "0", "2,000"],
      "builderCE 16":            ["Category, Software Contributions, Github Operations Flut, Accrued, builderCE", "0", "0", "0", "501"],
      "Planned 17":              ["Category, Software Contributions, Github Operations Flut, Planned", "0", "751", "0", "0"],
      "ariCETester 18":          ["Category, Software Contributions, Github Operations Flut, Planned, ariCETester", "0", "250", "0", "0"],
      "Unassigned 19":           ["Category, Software Contributions, Github Operations Flut, Planned, Unassigned", "0", "501", "0", "0"],
      "Stars 20":                ["Category, Software Contributions, Github Operations Flut, Stars", "500,000", "0", "0", "0"],
      "IR Alloc 21":             ["Category, Software Contributions, Github Operations Flut, Stars, IR Alloc", "500,000", "0", "0", "0"],
      "Stripes 22":              ["Category, Software Contributions, Github Operations Flut, Stripes", "1,000,000", "0", "0", "0"],
      "Component Alloc 23":      ["Category, Software Contributions, Github Operations Flut, Stripes, Component Alloc", "1,000,000", "0", "0", "0"],

      "Unallocated 24":         ["Category, Software Contributions, Unallocated", "3,000,000", "0", "0", "0"],

      "Business Operations 25": ["Category, Business Operations", "1,000,000", "0", "0", "0"],
      "Unallocated 26":         ["Category, Business Operations, Unallocated", "1,000,000", "0", "0", "0"],

      "UnClaimed 27":           ["Category, UnClaimed", "0", "8,339", "0", "2,000"],
      "UnClaimed 28":           ["Category, UnClaimed, UnClaimed", "0", "8,339", "0", "0"],
      "ariCETester 29":         ["Category, UnClaimed, UnClaimed, ariCETester", "0", "3,467", "0", "0"],
      "builderCE 30":           ["Category, UnClaimed, UnClaimed, builderCE", "0", "2,411", "0", "0"],
      "Unassigned 31":          ["Category, UnClaimed, UnClaimed, Unassigned", "0", "1,709", "0", "0"],
      "connieCE 32":            ["Category, UnClaimed, UnClaimed, connieCE", "0", "752", "0", "0"],
      "Accrued 33":             ["Category, UnClaimed, Accrued", "0", "0", "0", "2,000"],
      "ariCETester 34":         ["Category, UnClaimed, Accrued, ariCETester", "0", "0", "0", "2,000"],

      "A Pre-Existing Project Flut 35":   ["Category, A Pre-Existing Project Flut", "500,000", "1,500", "0", "1,500"],
      "Bacon 36":                    ["Category, A Pre-Existing Project Flut, Bacon", "500,000", "1,500", "0", "0"],
      "Unassigned 37":               ["Category, A Pre-Existing Project Flut, Bacon, Unassigned", "0", "1,500", "0", "0"],
      "IR Alloc split 38":           ["Category, A Pre-Existing Project Flut, Bacon, IR Alloc split", "500,000", "0", "0", "0"],
      "Accrued 39":                  ["Category, A Pre-Existing Project Flut, Accrued", "0", "0", "0", "1,500"],
      "ariCETester 40":              ["Category, A Pre-Existing Project Flut, Accrued, ariCETester", "0", "0", "0", "1,500"],

      "New ProjCol Proj 41":     ["Category, New ProjCol Proj", "0", "1,000", "1,000", "1,000"],
      "New plan name 42":        ["Category, New ProjCol Proj, New plan name", "0", "1,000", "0", "0"],
      "Unassigned 43":           ["Category, New ProjCol Proj, New plan name, Unassigned", "0", "1,000", "0", "0"],
      "Pending PEQ Approval 44": ["Category, New ProjCol Proj, Pending PEQ Approval", "0", "0", "1,000", "0"],
      "builderCE 45":            ["Category, New ProjCol Proj, Pending PEQ Approval, builderCE", "0", "0", "1,000", "0"],
      "Accrued 46":              ["Category, New ProjCol Proj, Accrued", "0", "0", "0", "1,000"],
      "ariCETester 47":          ["Category, New ProjCol Proj, Accrued, ariCETester", "0", "0", "0", "1,000"],
};
*/

Future<bool> peqSummaryTabFraming( WidgetTester tester, { ignoreAccrued = false } ) async {
   expect( await verifyOnProjectPage( tester ), true );
   final Finder tab = find.byKey( const Key('PEQ Summary' ));
   await tester.tap( tab );
   await pumpSettle( tester, 1 );

   expect( find.text('Category'), findsOneWidget );
   expect( find.text('Allocation'), findsOneWidget );
   expect( find.text('Planned'), findsOneWidget );
   expect( find.text('Pending'), findsOneWidget );
   expect( find.text('Surplus'), findsOneWidget );

   // if called with some summaryframes expanded, this could or would fail
   if( !ignoreAccrued ) {
      expect( find.text('Accrued'), findsOneWidget );
      expect( find.byKey(const Key( 'Update PEQ Summary?' )), findsOneWidget );
   }

   return true;
}


Future<bool> approvalsTabFraming( WidgetTester tester ) async {
   expect( await verifyOnProjectPage( tester ), true );
   final Finder tab = find.byKey( const Key('Approvals' ));
   await tester.tap( tab );
   await tester.pumpAndSettle();  // First pump is the swipe off to right transition step
   await tester.pumpAndSettle();

   expect( find.text( 'ZooBaDoo!' ), findsOneWidget );
   return true;
}

Future<bool> contributorsTabFraming( WidgetTester tester ) async {
   expect( await verifyOnProjectPage( tester ), true );
   final Finder tab = find.byKey( const Key('Contributors' ));
   await tester.tap( tab );
   await tester.pumpAndSettle();  // First pump is the swipe off to right transition step
   await tester.pumpAndSettle();

   expect( find.text( 'ZooBaDoo!' ), findsOneWidget );
   return true;
}

Future<bool> equityPlanTabFraming( WidgetTester tester ) async {
   expect( await verifyOnProjectPage( tester ), true );
   final Finder tab = find.byKey( const Key('Equity Plan' ));
   await tester.tap( tab );
   await tester.pumpAndSettle();  // First pump is the swipe off to right transition step
   await tester.pumpAndSettle();

   expect( find.text( 'ZooBaDoo!' ), findsOneWidget );
   return true;
}

Future<bool> agreementsTabFraming( WidgetTester tester ) async {
   expect( await verifyOnProjectPage( tester ), true );
   final Finder tab = find.byKey( const Key('Agreements' ));
   await tester.tap( tab );
   await tester.pumpAndSettle();  // First pump is the swipe off to right transition step
   await tester.pumpAndSettle();

   expect( find.text( 'ZooBaDoo!' ), findsOneWidget );
   return true;
}

Future<bool> ariSummaryFraming( WidgetTester tester ) async {
   expect( find.text( 'Category' ),               findsOneWidget );
   expect( find.text( 'Software Contributions' ), findsOneWidget );
   expect( find.text( 'Business Operations' ),    findsOneWidget );
   expect( find.text( 'UnClaimed' ),              findsOneWidget );
   expect( find.text( 'A Pre-Existing Project Flut' ), findsOneWidget );
   expect( find.text( 'New ProjCol Proj' ),       findsOneWidget );

   expect( find.text( 'Allocation' ), findsOneWidget );
   expect( find.text( 'Planned' ),    findsOneWidget );
   expect( find.text( 'Pending' ),    findsOneWidget );
   expect( find.text( 'Accrued' ),    findsOneWidget );
   expect( find.text( 'Surplus' ),  findsOneWidget );
   return true;
}

String getFromMakeBodyText( Widget elt ) {
   String retVal = "";
   if( elt is Container ) {
      var contText  = elt.child as Text; 
      retVal        = contText.data ?? "";
   }
   return retVal;
}

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

// from Node.  Walk down node and leaf tiles in alloc table.  
String getFromNode( Widget elt ) {
   String retVal = "";
   if( elt is Container && elt.child is ListTileTheme ) {
      var listTile  = elt.child as ListTileTheme;
      var expansion = listTile.child as ExpansionTile;

      retVal        = getFromMakeTableText( expansion.title );
   }
   return retVal;
}

// from Node, then _pactDetail
String getFromLeaf( Widget elt ) {
   String retVal = "";
   if( elt is Container && elt.child is ListTile ) {
      var listTile  = elt.child as ListTile;
      var gd        = listTile.title as GestureDetector;

      retVal        = getFromMakeTableText( gd.child ?? gd );
   }
   return retVal;
}

// from Node, then _pactDetail
Finder getGDFromLeaf( Widget elt ) {
   Finder retVal = find.byKey( Key( "ThisWillNeverBeFoundDuuuuude" ));
   if( elt is Container && elt.child is ListTile ) {
      var listTile       = elt.child as ListTile;
      GestureDetector gd = listTile.title as GestureDetector;
      retVal             = find.byWidget( gd );
   }
   return retVal;
}

Finder findArrow( Widget elt ) {
   // Finder is nonnullable
   Finder retVal = find.byKey( Key( "ThisWillNeverBeFoundDuuuuude" ));
   // If elt.child is listTile instead, currently looking at a leaf
   if( elt is Container && elt.child is ListTileTheme ) {
      var listTile  = elt.child as ListTileTheme;
      var expansion = listTile.child as ExpansionTile;
      var arrow     = expansion.trailing as Icon;
      retVal        = find.byWidget( arrow );
   }
   return retVal;
}


Future<List<String>> getElt( WidgetTester tester, String keyName ) async {
   final Finder generatedAllocRow = find.byKey( Key( keyName ));
   expect( generatedAllocRow, findsOneWidget );

   var allocRow = generatedAllocRow.evaluate().single.widget as Row;
   var allocs   = allocRow.children as List;

   List<String> aRow = [];
   for( final elt in allocs ) {
      String t = getFromMakeTableText( elt );
      if( t != "" ) { aRow.add( t ); }

      t = getFromNode( elt );
      if( t != "" ) { aRow.add( t ); }

      t = getFromLeaf( elt );
      if( t != "" ) { aRow.add( t ); }
   }

   return aRow;
}

Future<bool> expandLeaf( WidgetTester tester, int flutterPos, String agKey ) async {
   expect( await checkOffsetAlloc( tester, flutterPos, agKey ), true );

   final Finder generatedAllocRow = find.byKey( Key( "allocsTable " + flutterPos.toString() ));
   expect( generatedAllocRow, findsOneWidget );

   var allocRow = generatedAllocRow.evaluate().single.widget as Row;
   var allocs   = allocRow.children as List;

   final Finder gd = getGDFromLeaf( allocs[0] );
   await tester.tap( gd );
   await tester.pumpAndSettle();
   
   return true;
}

Future<bool> expandAllocs( WidgetTester tester, int min, int max ) async {

   // Note: key is generated exactly once each time you expand or shrink a node.  
   //       So, for example, row 2 is generated for first render.  Then, if scroll it offscreen, finder can no longer find it (say, to tap it).
   //       So, for example, rows: a, b, c.  expand #3 c: a b c d, d is #4.  shrink b: a c d, d is #3.
   for( var i = min; i <= max; i++ ) {

      final Finder generatedAllocRow = find.byKey( Key( "allocsTable " + i.toString() ));
      // Darg.  Uggggly
      // expect( generatedAllocRow, findsOneWidget );
      if( tester.widgetList<Row>( generatedAllocRow ).length > 0 ) {
            var allocRow = generatedAllocRow.evaluate().single.widget as Row;
            var allocs   = allocRow.children as List;
            
            var count = 0;
            for( final elt in allocs ) {
               count++;
               if( count != 1 ) { continue; }
               // print( "Tap i: " + i.toString() + "  count: " + count.toString() );
               final Finder arrow = findArrow( elt );
               if( tester.widgetList<Icon>( arrow ).length > 0 ) {
                  // print( "Tap i: " + i.toString() + "  count: " + count.toString() );
                  await tester.tap( arrow );
                  await tester.pumpAndSettle();
               }
            }
      }
      else { print( "Could not find allocTable row " + i.toString() ); }
   }
   return true;
}


// As we continue expanding, the distance between the last entry and the last fully expanded entry shrinks. 
Future<bool> expandAll( WidgetTester tester ) async {

   final topFinder    = find.text( "Category" );
   final bottomFinder = find.text( "A Pre-Existing Project Flut" );
   final listFinder   = find.byType( ListView );
   
   // Scroll until the item to be found appears.  
   // ScrollUntilVis would be great, but wow. https://github.com/flutter/flutter/issues/88762
   // Maybe next year.  use drag for now - it can stop if 1 pixel of the widget is showing, so add a little extra afterwards
   // await tester.scrollUntilVisible( bottomFinder, 500.0, scrollable:listFinder );

   await expandAllocs( tester, 1, 10 );
   await tester.dragUntilVisible( bottomFinder, listFinder, Offset(0.0, -50.0) );
   await tester.drag( listFinder, Offset(0.0, -50.0) );

   await expandAllocs( tester, 11, 18 );   
   await tester.dragUntilVisible( bottomFinder, listFinder, Offset(0.0, -50.0) );
   await tester.drag( listFinder, Offset(0.0, -50.0) );
   await pumpSettle( tester, 2 );

   // now expand 2 at a time 
   var min = 19;
   for( var i = 20; i <= 30; i = i+2 ) {
      await expandAllocs( tester, min, i );
      min = i+1;
      await tester.dragUntilVisible( bottomFinder, listFinder, Offset(0.0, -50.0) );
      await tester.drag( listFinder, Offset(0.0, -50.0) );
      await tester.pumpAndSettle();
   }
   await pumpSettle( tester, 2 );

   // finally just 1
   for( var i = min+1; i <= 47; i++ ) {
      await expandAllocs( tester, i, i );
      await tester.dragUntilVisible( bottomFinder, listFinder, Offset(0.0, -50.0) );
      await tester.drag( listFinder, Offset(0.0, -50.0) );
      await tester.pumpAndSettle();
   }
   await pumpSettle( tester, 2 );
   
   
   return true;
}

// What is actually visible from the table??
Future<bool> showVisible( WidgetTester tester ) async {
   
   for( var i = 0; i < 50; i++ ) {
      final Finder generatedAllocRow = find.byKey( Key( "allocsTable " + i.toString() ));
      if( tester.widgetList<Row>( generatedAllocRow ).length > 0 ) {
         var row = await getElt( tester, "allocsTable " + i.toString() ); 
         print( "allocsTable " + i.toString() + " is visible as " + row[0] );
      }
   }
   return true;
   
}

Future<bool> toggleTableEntry( WidgetTester tester, int flutterPos, String agKey ) async {

   String elt = flutterPos == -1 ? agKey: "allocsTable " + flutterPos.toString();
   print( "Toggle " + elt );
   final Finder generatedAllocRow = find.byKey( Key( elt ) );
   expect( generatedAllocRow, findsOneWidget );
   
   var allocRow = generatedAllocRow.evaluate().single.widget as Row;
   var allocs   = allocRow.children as List;

   final Finder arrow = findArrow( allocs[0] );
   expect( arrow, findsOneWidget ); 

   await tester.tap( arrow );
   await pumpSettle( tester, 1 );

   return true;
}


// All generatedRows are, well, generated.  Just not all are visible.
Future<bool> closeAll( WidgetTester tester ) async {

   // Magic sequence
   List<String> t = [ "allocsTable 3", "allocsTable 4", "allocsTable 6", "allocsTable 7", "allocsTable 8", "allocsTable 9", "allocsTable 10", "allocsTable 11" ];
   t = t +          [ "allocsTable 2", "allocsTable 3", "allocsTable 1", "allocsTable 2", "allocsTable 4", "allocsTable 5"];
   t = t +          [ "allocsTable 3", "allocsTable 5", "allocsTable 6", "allocsTable 4", "allocsTable 6", "allocsTable 7", "allocsTable 8", "allocsTable 5"];

   // Start from the top
   final listFinder   = find.byType( ListView );
   final topFinder    = find.text( "Category" );
   await tester.dragUntilVisible( topFinder, listFinder, Offset(0.0, 200.0) );
   await tester.drag( listFinder, Offset(0.0, 50.0) );

   // await showVisible( tester );
   
   for( var elt in t ) {
      print( "   ... working " + elt );
      await toggleTableEntry( tester, -1, elt );
   }

   return true;
}

Future<bool> checkOffsetAlloc( WidgetTester tester, int flutterPos, String agKey ) async {

   // final Finder generatedAllocRow = find.byKey( Key( "allocsTable " + flutterPos.toString() ));  
   // expect( generatedAllocRow, findsOneWidget );
   
   List<String> allocs = await getElt( tester, "allocsTable " + flutterPos.toString() );
   
   // First elt in allocs is used as key for allocs_gold
   // allocs is from ceFlutter, has short title, then numbers.
   // allocs_gold is const above, is a map to a list<str> with long title, then numbers.
   
   List<String> agVals  = ALLOCS_GOLD[ agKey ] ?? [];
   if( agVals.length < 5 ) {
      print( "CheckOffsetAlloc failed to get agVals. " + agKey + " " + flutterPos.toString() );
   }
   for( var j = 1; j < 5; j++ ) {
      if( allocs.length < j || agVals.length < j || allocs[j] != agVals[j] ) { print( allocs.toString() + "   " + agVals.toString() ); }
      expect( allocs[j], agVals[j] );
   }
   
   return true;
}


// This is gritty.  Could check parentage to disambiguate into ALLOCS_GOLD.
// Instead, disambiguate based on fully expanded index.
Future<bool> checkAllocs( WidgetTester tester, int min, int max ) async {

   print( "\n" );
   for( var i = min; i <= max; i++ ) {

      print( "checking allocsTable " + i.toString());  
      final Finder generatedAllocRow = find.byKey( Key( "allocsTable " + i.toString() ));  
      expect( generatedAllocRow, findsOneWidget );
      
      List<String> allocs = await getElt( tester, "allocsTable " + i.toString() );

      // First elt in allocs is used as key for allocs_gold
      // allocs is from the displayed table in ceFlutter, has short title, then numbers.
      // allocs_gold is const above, is a map to a list<str> with long title, then numbers.
      
      String agKey         = allocs[0] + " " + i.toString();

      // Special case, this is a 'split' entry, which has a random tag.  remove the random tag before checking.
      if( i == 38 && agKey.contains( "IR Alloc split" ) ) { agKey = "IR Alloc split " + i.toString(); }
      
      List<String> agVals  = ALLOCS_GOLD[ agKey ] ?? [];
      print( "  checking " + agKey + ": " + agVals.sublist(1,5).toString() );
      
      for( var j = 1; j < 5; j++ ) { expect( allocs[j], agVals[j] ); }

      // Check remaining val once or twice
      if( i == 0 ) {
         int tot = int.parse( agVals[1] );
         int rem = int.parse( allocs[5] ); // note: agVals does not have [5]th val
         int plan = 0;
         for( var j = 2; j < 5; j++ ) { plan += int.parse( agVals[j] ); }
         expect( tot - plan, rem );
      }
   }
   return true;
}


Future<bool> checkAll( WidgetTester tester ) async {

   final listFinder   = find.byType( ListView );
   final topFinder    = find.text( "Category" );

   // Move to top
   await tester.dragUntilVisible( topFinder, listFinder, Offset(0.0, 100.0) );
   await tester.drag( listFinder, Offset(0.0, 50.0) );
   await tester.pumpAndSettle();
   await checkAllocs( tester, 1, 10 );

   // cell height is 50
   await tester.drag( listFinder, Offset(0.0, -500.0) );
   await tester.pumpAndSettle();
   await checkAllocs( tester, 11, 20 );

   await tester.drag( listFinder, Offset(0.0, -500.0) );
   await tester.pumpAndSettle();
   await checkAllocs( tester, 21, 30 );

   await tester.drag( listFinder, Offset(0.0, -500.0) );
   await tester.pumpAndSettle();
   await checkAllocs( tester, 31, 40 );

   await tester.drag( listFinder, Offset(0.0, -500.0) );
   await tester.pumpAndSettle();
   await checkAllocs( tester, 41, 47 );

   await pumpSettle( tester, 2 );
   
   
   return true;
}

Map<String, dynamic> getPact( detailName ) {
   String keyName       = "RawPact" + detailName;
   final Finder rawPact = find.byKey( Key( keyName ) );
   var pactElt          = rawPact.evaluate().single.widget as Container;
   String pact          = getFromMakeBodyText( pactElt );

   final Map<String, dynamic> pmap = json.decode( pact );   
   return pmap;
}


Future<bool> validateAdd( WidgetTester tester, String repo, String issueTitle, String peqLabel, String detailName, {action = "labeled"} ) async {

   await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( detailName );

   expect( pmap['action'],                   action );
   expect( pmap['repository']['full_name'],  repo );
   expect( pmap['issue']['title'],           issueTitle );
   expect( pmap['label']['name'],            peqLabel );

   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

Future<bool> validateConfirmDelete( WidgetTester tester, String repo, String issueTitle, String peqLabel, String detailName ) async {

   await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( detailName );

   expect( pmap['action'],                   "deleted" );
   expect( pmap['repository']['full_name'],  repo );
   expect( pmap['issue']['title'],           issueTitle );

   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}


// Allocs created from makeAllocCard, i.e. create card with peq note.  Raw request body is for cards, CE Server then converts to peq issue.
// request body is not yet situated
Future<bool> validateAddCard( WidgetTester tester, String repo, String issueTitle, String peqLabel, String detailName, {action = "labeled"} ) async {

   await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( detailName );

   expect( pmap['action'],                   action );
   expect( pmap['repository']['full_name'],  repo );

   expect( pmap.containsKey( "project_card" ), true );
   expect( pmap["project_card"].containsKey( "content_url" ),        false );
   expect( pmap["project_card"].containsKey( "note" ),               true );
   expect( pmap["project_card"]["note"].contains( peqLabel ),        true );

   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

// Some pacts are simply informational
Future<bool> validatePass( WidgetTester tester, String detailName ) async {

   await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( detailName );

   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

Future<bool> validateCreateCard( WidgetTester tester, String detailName ) async {

   await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( detailName );

   expect( pmap['action'],                    "created" );

   expect( pmap.containsKey( "projects_v2_item" ),                    true );
   expect( pmap["projects_v2_item"]["content_type"], "Issue" );
   expect( pmap["projects_v2_item"].containsKey( "content_node_id" ), true );
   expect( pmap["projects_v2_item"].containsKey( "node_id" ),         true );
   expect( pmap["projects_v2_item"].containsKey( "project_node_id" ), true );

   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

Future<bool> validateAssign( WidgetTester tester, String repo, String issueTitle, String assignee, String detailName ) async {

   await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( detailName );

   expect( pmap['action'],                   "assigned" );
   expect( pmap['repository']['full_name'],  repo );
   expect( pmap['issue']['title'],           issueTitle );
   expect( pmap['assignee']['login'],        assignee );

   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

Future<bool> validateMove( WidgetTester tester, String repo, String detailName ) async {

   await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( detailName );

   expect( pmap['action'],                    "edited" );

   expect( pmap.containsKey( "projects_v2_item" ),                    true );
   expect( pmap["projects_v2_item"]["content_type"],                 "Issue" );
   expect( pmap["projects_v2_item"].containsKey( "content_node_id" ), true );
   expect( pmap["projects_v2_item"].containsKey( "node_id" ),         true );
   expect( pmap["projects_v2_item"].containsKey( "project_node_id" ), true );

   expect( pmap.containsKey( "changes" ),                        true );
   expect( pmap["changes"].containsKey( "field_value" ),         true );
   expect( pmap["changes"]["field_value"]["field_name"],        "Status" );
   expect( pmap["changes"]["field_value"].containsKey( "from" ), true );
   expect( pmap["changes"]["field_value"].containsKey( "to" ),   true );

   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

Future<bool> validateProposeAccrue( WidgetTester tester, String repo, String issueTitle, String detailName ) async {

   await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( detailName );

   expect( pmap['action'],                 "closed" );
   expect( pmap['issue']['state'],         "closed" );
   expect( pmap['repository']['full_name'], repo );
   expect( pmap['issue']['title'],          issueTitle );   

   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

Future<bool> validateConfirmAccrue( WidgetTester tester, String repo, String detailName ) async {

   await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( detailName );

   expect( pmap['action'],                 "edited" );

   expect( pmap.containsKey( "projects_v2_item" ),                    true );
   expect( pmap["projects_v2_item"]["content_type"], "Issue" );
   expect( pmap["projects_v2_item"].containsKey( "content_node_id" ), true );
   expect( pmap["projects_v2_item"].containsKey( "node_id" ),         true );
   expect( pmap["projects_v2_item"].containsKey( "project_node_id" ), true );

   expect( pmap.containsKey( "changes" ),                        true );
   expect( pmap["changes"].containsKey( "field_value" ),         true );
   expect( pmap["changes"]["field_value"]["field_name"],        "Status" );
   expect( pmap["changes"]["field_value"].containsKey( "from" ), true );
   expect( pmap["changes"]["field_value"].containsKey( "to" ),   true );
   expect( pmap["changes"]["field_value"]["to"]["name"],        "Accrued" );

   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

Future<bool> validateRejectAccrue( WidgetTester tester, String repo, String issueTitle, String detailName ) async {

   await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( detailName );

   expect( pmap['action'],                 "reopened" );
   expect( pmap['repository']['full_name'], repo );
   expect( pmap['issue']['state'],         "open" );
   expect( pmap['issue']['title'],          issueTitle );   
   
   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}


// Starts with initial expansion
Future<bool> validateBuilder25( WidgetTester tester ) async {
   await expandAllocs( tester, 1, 1 );  // soft cont
   await expandAllocs( tester, 3, 3 );  // gho
   await expandAllocs( tester, 7, 7 );  // prog
   await checkOffsetAlloc( tester, 8, "builderCE 25" );

   await expandLeaf( tester, 8, "builderCE 25" );
   await pumpSettle( tester, 1 );

   String repo   = "codeequity/ceFlutterTester";

   String issue  = "IR Prog";
   expect( find.byKey( Key( issue ) ), findsOneWidget );
   expect( await validateAdd(        tester, repo, issue, "1k PEQ",     "00 confirm add" ),      true );
   expect( await validatePass(       tester,                            "01 confirm relocate" ), true );
   expect( await validateAssign(     tester, repo, issue, "builderCE",  "02 confirm change" ),   true );
   expect( await validateCreateCard( tester,                            "03 confirm add" ),      true );

   expect( await backToSummary( tester ), true );
   await toggleTableEntry( tester, 7, "" );
   await toggleTableEntry( tester, 3, "" );
   await toggleTableEntry( tester, 1, "" );
   
   return true;
}

// Starts with initial expansion
Future<bool> validateAri17( WidgetTester tester ) async {
   await expandAllocs( tester, 1, 1 );
   await expandAllocs( tester, 3, 3 );
   await expandAllocs( tester, 5, 5 );
   await checkOffsetAlloc( tester, 6, "ariCETester 17" );

   await expandLeaf( tester, 6, "ariCETester 17" );
   await pumpSettle( tester, 1 );

   String repo   = "codeequity/ceFlutterTester";

   // Most recent first

   String issue = "Situated Accrued iss1st";
   expect( find.byKey( Key( issue ) ),  findsOneWidget );
   expect( await validateAdd(           tester, repo, issue, "1k PEQ",  "00 confirm add" ),      true );
   expect( await validatePass(          tester,                         "01 confirm relocate" ), true );
   expect( await validateAssign(        tester, repo, issue, "ariCETester", "02 confirm change" ),   true );
   expect( await validateCreateCard(    tester,                         "03 confirm add" ),      true );
   expect( await validatePass(          tester,                         "04 confirm relocate" ), true );
   expect( await validateProposeAccrue( tester, repo, issue,            "05 propose accrue" ),   true );
   expect( await validateConfirmAccrue( tester, repo,                   "06 confirm accrue" ),   true );
   expect( await validateConfirmDelete( tester, repo,                   "07 confirm delete" ),   true );

   issue = "Situated Accrued Card1st";
   expect( find.byKey( Key( issue ) ),  findsOneWidget );
   expect( await validateAdd(           tester, repo, issue, "1k PEQ",  "08 confirm add" ),      true );
   expect( await validatePass(          tester,                         "09 confirm relocate" ), true );
   expect( await validateAssign(        tester, repo, issue, "ariCETester", "10 confirm change" ),   true );
   expect( await validateCreateCard(    tester,                         "11 confirm add" ),      true );
   expect( await validatePass(          tester,                         "12 confirm relocate" ), true );
   expect( await validateProposeAccrue( tester, repo, issue,            "13 propose accrue" ),   true );
   expect( await validateConfirmAccrue( tester, repo,                   "14 confirm accrue" ),   true );
   expect( await validateConfirmDelete( tester, repo,                   "15 confirm delete" ),   true );
   
   issue = "Close Open test"; 
   expect( find.byKey( Key( issue ) ),  findsOneWidget );
   expect( await validateAdd(        tester, repo, issue, "1k PEQ",  "16 confirm add" ),      true );
   expect( await validatePass(       tester,                         "17 confirm relocate" ), true );
   expect( await validateCreateCard( tester,                         "18 confirm add" ),      true );
   expect( await validatePass(       tester,                         "19 confirm relocate" ), true );
   expect( await validateMove(       tester,                         "20 confirm relocate" ), true );
   expect( await validateAssign(     tester, repo, issue, "ariCETester", "21 confirm change" ),   true );
   expect( await validateProposeAccrue( tester, repo, issue,         "22 propose accrue" ),   true );
   expect( await validateRejectAccrue(  tester, repo, issue,         "23 reject accrue" ),    true );
   expect( await validateMove(       tester, repo,                   "24 confirm relocate" ), true );
   expect( await validateProposeAccrue( tester, repo, issue,         "25 propose accrue" ),   true );
   expect( await validateRejectAccrue(  tester, repo, issue,         "26 reject accrue" ),    true );   
   expect( await validateProposeAccrue( tester, repo, issue,         "27 propose accrue" ),   true );
   expect( await validateConfirmAccrue( tester, repo,                "28 confirm accrue" ),   true );

   issue  = "IR Accrued";
   expect( find.byKey( Key( issue ) ),  findsOneWidget );
   expect( await validateAdd(        tester, repo, issue, "1k PEQ",      "29 confirm add" ),      true );
   expect( await validatePass(       tester, repo,                       "30 confirm relocate" ), true );
   expect( await validateAssign(     tester, repo, issue, "ariCETester", "31 confirm change" ),   true );   
   expect( await validateCreateCard( tester,                             "32 confirm add" ),      true );
   expect( await validatePass(       tester, repo,                       "33 confirm relocate" ), true );
   expect( await validateMove(       tester,                             "34 confirm relocate" ), true );
   expect( await validateProposeAccrue( tester, repo, issue,             "35 propose accrue" ),   true );
   expect( await validateConfirmAccrue( tester, repo,                    "36 confirm accrue" ),   true );
   
   expect( await backToSummary( tester ), true );
   await toggleTableEntry( tester, 5, "" );
   await toggleTableEntry( tester, 3, "" );
   await toggleTableEntry( tester, 1, "" );

   return true;
}

// Note: assignments, failed moves, etc. are ignored for summary.  SummaryDetails only record valid PEQ-related actions.
Future<bool> validateAlloc23( WidgetTester tester ) async {
   await expandAllocs( tester, 1, 1 );
   await expandAllocs( tester, 3, 3 );
   await expandAllocs( tester, 9, 9 );
   await checkOffsetAlloc( tester, 10, "Component Alloc 23" );

   await expandLeaf( tester, 10, "Component Alloc 23" );
   await pumpSettle( tester, 1 );

   String repo   = "codeequity/ceFlutterTester";

   String issue  = "Component Alloc";
   expect( find.byKey( Key( issue ) ), findsOneWidget );
   expect( await validateAdd(     tester, repo, issue, "1000000 AllocPEQ",  "00 confirm add" ),      true );
   expect( await validateRelo( tester, repo,                             "01 confirm relocate" ), true );
   expect( await validateMove(    tester, repo,                             "02 confirm relocate" ), true );
   
   expect( await backToSummary( tester ), true );
   await toggleTableEntry( tester, 9, "" );
   await toggleTableEntry( tester, 3, "" );
   await toggleTableEntry( tester, 1, "" );
   
   return true;
}

Future<bool> validateUnAlloc24( WidgetTester tester ) async {
   await expandAllocs( tester, 1, 1 );
   await checkOffsetAlloc( tester, 4, "Unallocated 24" );

   await expandLeaf( tester, 4, "Unallocated 24" );
   await pumpSettle( tester, 1 );

   String repo   = "codeequity/ceFlutterTester";

   String issue  = "Unallocated";
   expect( find.byKey( Key( issue ) ), findsOneWidget );
   expect( await validateAddCard( tester, repo, issue, "<allocation, PEQ: 3,000,000>",  "00 confirm add", action:"created" ), true );
   
   expect( await backToSummary( tester ), true );
   await toggleTableEntry( tester, 1, "" );
   
   return true;
}

Future<bool> validateUnAssign31( WidgetTester tester ) async {
   await expandAllocs( tester, 3, 4 );
   await checkOffsetAlloc( tester, 7, "Unassigned 31" );

   await expandLeaf( tester, 7, "Unassigned 31" );
   await pumpSettle( tester, 1 );

   String repo   = "codeequity/ceFlutterTester";

   // String issue  = "Unallocated";
   // expect( find.byKey( Key( issue ) ), findsOneWidget );
   // expect( await validateAdd( tester, repo, issue, "3000000 AllocPEQ",  "00 confirm add", action:"created" ), true );
   
   expect( await backToSummary( tester ), true );
   await toggleTableEntry( tester, 4, "" );
   await toggleTableEntry( tester, 3, "" );
   
   return true;
}

Future<bool> ariSummaryContent( WidgetTester tester ) async {
   final listFinder   = find.byType( ListView );
   final topFinder    = find.text( "Category" );
   final bottomFinder = find.text( "A Pre-Existing Project Flut" );

   // await getElt( tester, 'allocsTable 0' );

   // First, expand.  Then test drag down.  Then start checking.
   await expandAll( tester );
   await checkAll( tester ); 

   await closeAll( tester );
   await pumpSettle( tester, 2 );
   
   print( "Done!" );
   
   return true;
}

Future<bool> _checkHelper( tester ) async {
   await checkAllocs( tester, 1, 6 );  
   await checkOffsetAlloc( tester, 7, "Github Operations Flut 8" );
   await checkOffsetAlloc( tester, 8, "Unallocated 24" );
   await checkOffsetAlloc( tester, 11, "A Pre-Existing Project Flut 35" );
   await checkOffsetAlloc( tester, 12, "Bacon 36" );
   await checkOffsetAlloc( tester, 13, "Unassigned 37" );
   await checkOffsetAlloc( tester, 14, "IR Alloc split 38" );
   return true;
}

void main() {

   String repo = "codeequity/ceFlutterTester";
   
   // final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized() as IntegrationTestWidgetsFlutterBinding;
   IntegrationTestWidgetsFlutterBinding.ensureInitialized();

   bool skip = true;
   // bool skip = false;

   // override?  Run it.
   var override = const String.fromEnvironment('override');
   if( override == "True" ) { skip = false; }
   
   report( 'Project', group:true );

   testWidgets('Project Basics', skip:skip, (WidgetTester tester) async {
         
         await restart( tester );
         await login( tester, true );

         final Finder ariLink = find.byKey( Key( repo ));
         await tester.tap( ariLink );
         await pumpSettle( tester, 5, verbose: true ); 
         await pumpSettle( tester, 3, verbose: true ); 

         expect( await verifyOnProjectPage( tester ), true );

         // ceFlutterTester was just cleared.  This will not yet exist.
         // expect( await peqSummaryTabFraming( tester ),   true );
         expect( await verifyEmptyProjectPage( tester ), true );         

         expect( await approvalsTabFraming( tester ),    true );
         expect( await contributorsTabFraming( tester ), true );
         expect( await equityPlanTabFraming( tester ),   true );
         expect( await agreementsTabFraming( tester ),   true );

         await logout( tester );         

         report( 'Project Basics' );
      });


   // NOTE: testCEFlutter.py always runs 'npm clean' before this
   //       it is possible to depend on process_run and run from here, but that clutters deps
   testWidgets('Project contents, ingest', skip:skip, (WidgetTester tester) async {

         await restart( tester );
         await login( tester, true );

         // Login checks for homepage, but verify this is Ari before testing contents
         expect( await verifyAriHome( tester ), true );         

         final Finder ariLink = find.byKey( Key( repo ));
         await tester.tap( ariLink );
         await pumpSettle( tester, 5, verbose: true ); 
         await pumpSettle( tester, 3, verbose: true ); 

         expect( await verifyEmptyProjectPage( tester ), true );
         
         final Finder updateButton = find.byKey( const Key( 'Update PEQ Summary?' ));
         expect( updateButton, findsOneWidget );
         await tester.tap( updateButton );
         await pumpSettle( tester, 85, verbose: true );
         await pumpSettle( tester, 4, verbose: true );
         
         // Make sure it all shows up
         expect( await peqSummaryTabFraming( tester ),   true );
         expect( await ariSummaryFraming( tester ), true );
         expect( await ariSummaryContent( tester ), true );

         await logout( tester );         

         report( 'Project contents, ingest' );
      });

   testWidgets('Project frame coherence', skip:skip, (WidgetTester tester) async {

         await restart( tester );
         await login( tester, true );

         // Login checks for homepage, but verify this is Ari before testing contents
         expect( await verifyAriHome( tester ), true );         

         final Finder ariLink = find.byKey( Key( repo ));
         await tester.tap( ariLink );
         await pumpSettle( tester, 5, verbose: true ); 
         await pumpSettle( tester, 3, verbose: true ); 

         expect( await verifyOnProjectPage( tester ), true );

         // This leaves us in summary frame

         // EXPAND 1st group
         // expand depth-first to depth 4.  verify kids.  
         await expandAllocs( tester, 1, 3 );
         await checkAllocs( tester, 1, 6 );  // checks all of swCont, first path fully expanded
         await checkOffsetAlloc( tester, 7, "Github Operations Flut 8" );
         await checkOffsetAlloc( tester, 8, "Unallocated 24" );

         // close group1, verify
         await toggleTableEntry( tester, 1, "" );
         await checkOffsetAlloc( tester, 1, "Software Contributions 1" );
         await checkOffsetAlloc( tester, 2, "Business Operations 25" );
            
         // open group1, verify 
         await toggleTableEntry( tester, 1, "" );
         await checkAllocs( tester, 1, 6 );  // checks all of swCont, first path fully expanded
         await checkOffsetAlloc( tester, 7, "Github Operations Flut 8" );
         await checkOffsetAlloc( tester, 8, "Unallocated 24" );

         
         // EXPAND 2nd group
         await toggleTableEntry( tester, 1, "" );  // close group1
         await expandAllocs( tester, 4, 5 );
         await toggleTableEntry( tester, 8, "" );  
         await checkOffsetAlloc( tester, 4, "A Pre-Existing Project Flut 35" );
         await checkOffsetAlloc( tester, 5, "Bacon 36" );
         await checkOffsetAlloc( tester, 6, "Unassigned 37" );
         await checkOffsetAlloc( tester, 7, "IR Alloc split 38" );
         await checkOffsetAlloc( tester, 8, "Accrued 39");
         await checkOffsetAlloc( tester, 9, "ariCETester 40");
         await checkOffsetAlloc( tester, 10,"New ProjCol Proj 41" );
         
         // close group2, verify
         await toggleTableEntry( tester, 4, "" );
         await checkOffsetAlloc( tester, 1, "Software Contributions 1" );
         await checkOffsetAlloc( tester, 2, "Business Operations 25" );
         await checkOffsetAlloc( tester, 4, "A Pre-Existing Project Flut 35" );
         await checkOffsetAlloc( tester, 5, "New ProjCol Proj 41" );
            
         // OPEN 2nd group
         await toggleTableEntry( tester, 4, "" );  
         await checkOffsetAlloc( tester, 4, "A Pre-Existing Project Flut 35" );
         await checkOffsetAlloc( tester, 5, "Bacon 36" );
         await checkOffsetAlloc( tester, 6, "Unassigned 37" );
         await checkOffsetAlloc( tester, 7, "IR Alloc split 38" );
         await checkOffsetAlloc( tester, 8, "Accrued 39");
         await checkOffsetAlloc( tester, 9, "ariCETester 40");
         await checkOffsetAlloc( tester, 10,"New ProjCol Proj 41" );

         // OPEN 1st group
         await toggleTableEntry( tester, 1, "" );
         await _checkHelper( tester );
         
         // cell height is 50
         final listFinder   = find.byType( ListView );         
         await tester.drag( listFinder, Offset(0.0, -300.0) );
         await tester.drag( listFinder, Offset(0.0, -50.0) );
         await tester.pumpAndSettle();
         print( "DOWN" );
         
         await checkOffsetAlloc( tester, 15, "Accrued 39");
         await checkOffsetAlloc( tester, 16, "ariCETester 40");
         await checkOffsetAlloc( tester, 17, "New ProjCol Proj 41" );
         
         // scroll up down up, check
         print( "UPUP" );
         await tester.drag( listFinder, Offset(0.0, 300.0) );
         await tester.pumpAndSettle();
         await _checkHelper( tester );

         // tab out, back in
         await contributorsTabFraming( tester );
         await peqSummaryTabFraming( tester, ignoreAccrued: true );
         await _checkHelper( tester );         
         
         await logout( tester );         

         report( 'Project frame coherence' );
      });

   testWidgets('Project Detail Page', skip:false, (WidgetTester tester) async {
         
         await restart( tester );
         await login( tester, true );

         expect( await verifyAriHome( tester ), true );
         
         final Finder ariLink = find.byKey( Key( repo ));
         await tester.tap( ariLink );
         await pumpSettle( tester, 2, verbose: true ); 
         await pumpSettle( tester, 2, verbose: true ); 

         expect( await peqSummaryTabFraming( tester ),   true );

         // expect( await validateBuilder25( tester ), true );
         expect( await validateAri17( tester ), true );
         expect( await validateAlloc23( tester ), true );
         expect( await validateUnAlloc24( tester ), true );
         expect( await validateUnAssign31( tester ), true );
         
         // unclaimed:unclaimed:unassigned
         // unclaimed:accr:ari
         // newprojcol:newplanname:unassigned
         // newprojcol:accr?ari
         
         await logout( tester );         

         report( 'Project Detail Page' );
      });


   // Next test: detail pages
}
     
