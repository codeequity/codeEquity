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
      
      "Software Contributions 1": ["Category, Software Contributions", "5,500,000", "3,455", "1,354", "6,501", "5,488,294"],
      
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

      "Github Operations Flut 12":  ["Category, Software Contributions, Github Operations Flut", "1,500,000", "2,955", "1,104", "2,501", "1,493,044"],
         "Pending PEQ Approval 13": ["Category, Software Contributions, Github Operations Flut, Pending PEQ Approval", "0", "0", "1,104", "0", "---"],
            "ariCETester 14":       ["Category, Software Contributions, Github Operations Flut, Pending PEQ Approval, ariCETester", "0", "0", "552", "0", "---"],
            "builderCE 15":         ["Category, Software Contributions, Github Operations Flut, Pending PEQ Approval, builderCE", "0", "0", "552", "0", "---"],
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
   expect( find.text('Pending'), findsOneWidget );
   expect( find.text('Surplus'), findsOneWidget );

   // if called with some summaryframes expanded, this could or would fail
   if( !ignoreAccrued ) {
      expect( find.text('Accrued'), findsOneWidget );
      expect( find.text('Planned'), findsOneWidget );
      expect( find.byKey(const Key( 'Update PEQ Summary?' )), findsOneWidget );  // fails if offscreen, i.e. things are expanded
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
   expect( find.text( 'Cross Proj' ),       findsOneWidget );

   expect( find.text( 'Allocation' ), findsOneWidget );
   expect( find.text( 'Planned' ),    findsOneWidget );
   expect( find.text( 'Pending' ),    findsOneWidget );
   expect( find.text( 'Accrued' ),    findsOneWidget );
   expect( find.text( 'Surplus' ),    findsOneWidget );
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
   final bottomFinder = find.text( "Cross Proj" );
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
   for( var i = min+1; i <= 51; i++ ) {
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
   List<String> t = [ "allocsTable 3", "allocsTable 4", "allocsTable 5", "allocsTable 7", "allocsTable 8", "allocsTable 9", "allocsTable 10", "allocsTable 11", "allocsTable 12" ];
   t = t +          [ "allocsTable 2", "allocsTable 3", "allocsTable 1", "allocsTable 2", "allocsTable 4", "allocsTable 3"];
   t = t +          [ "allocsTable 5", "allocsTable 6", "allocsTable 4", "allocsTable 6", "allocsTable 5"];

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


// check gold image matches table
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
      if( agKey.contains( "IR Alloc split" ) ) { agKey = "IR Alloc split " + i.toString(); }
      
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
   await checkAllocs( tester, 41, 51 );

   await pumpSettle( tester, 2 );
   
   
   return true;
}

Map<String, dynamic> getPact( WidgetTester tester, detailName ) {
   String keyName       = "RawPact" + detailName;
   final Finder rawPact = find.byKey( Key( keyName ) );
   if( tester.widgetList<Widget>(rawPact).length > 0 ) {   
      var pactElt          = rawPact.evaluate().single.widget as Container;
      String pact          = getFromMakeBodyText( pactElt );

      final Map<String, dynamic> pmap = json.decode( pact );   
      return pmap;
   }
   else {
      print( "getPact on: " + detailName + " failed." );
      assert( false );
      return {};
   }
}


bool validatePV2Item( pmap ) {
   expect( pmap.containsKey( "projects_v2_item" ),                    true );
   expect( pmap["projects_v2_item"]["content_type"],                 "Issue" );
   expect( pmap["projects_v2_item"].containsKey( "content_node_id" ), true );
   expect( pmap["projects_v2_item"].containsKey( "node_id" ),         true );
   expect( pmap["projects_v2_item"].containsKey( "project_node_id" ), true );
   return true;
}

bool validatePV2Change( pmap ) {
   expect( pmap.containsKey( "changes" ),                        true );
   expect( pmap["changes"].containsKey( "field_value" ),         true );
   expect( pmap["changes"]["field_value"]["field_name"],        "Status" );
   expect( pmap["changes"]["field_value"].containsKey( "from" ), true );
   expect( pmap["changes"]["field_value"].containsKey( "to" ),   true );
   return true;
}


Future<bool> validateAdd( WidgetTester tester, String repo, String issueTitle, String peqLabel, String detailName, {action = "labeled"} ) async {

   // checkNTap returns the key it was able to find.
   detailName = await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( tester, detailName );

   expect( pmap['action'],                   action );
   expect( pmap['repository']['full_name'],  repo );
   expect( pmap['issue']['title'],           issueTitle );
   expect( pmap['label']['name'],            peqLabel );

   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

// confirm delete will either be for an issue or a card.  
Future<bool> validateConfirmDelete( WidgetTester tester, String repo, String issueTitle, String detailName, {issue = false} ) async {

   // checkNTap returns the key it was able to find.
   detailName = await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( tester, detailName );

   expect( pmap['action'],                   "deleted" );
   if( issue ) {
      expect( pmap['repository']['full_name'],  repo );
      expect( pmap['issue']['title'],           issueTitle );
   }
   else {
      validatePV2Item( pmap );
   }
   
   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}



// Some pacts are simply informational
Future<bool> validatePass( WidgetTester tester, String detailName ) async {

   // checkNTap returns the key it was able to find.
   detailName = await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( tester, detailName );

   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

Future<bool> validateCreateCard( WidgetTester tester, String detailName ) async {

   // checkNTap returns the key it was able to find.
   detailName = await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( tester, detailName );

   expect( pmap['action'],                    "created" );
   validatePV2Item( pmap );
   
   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

Future<bool> validateAssign( WidgetTester tester, String repo, String issueTitle, String assignee, String detailName ) async {

   // checkNTap returns the key it was able to find.
   detailName = await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( tester, detailName );

   expect( pmap['action'],                   "assigned" );
   expect( pmap['repository']['full_name'],  repo );
   expect( pmap['issue']['title'],           issueTitle );
   if( assignee != "" ) {
      expect( pmap['assignee']['login'],        assignee );
   }

   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

Future<bool> validateUnAssign( WidgetTester tester, String repo, String issueTitle, String assignee, String detailName ) async {

   // checkNTap returns the key it was able to find.
   detailName = await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( tester, detailName );

   expect( pmap['action'],                  "unassigned" );
   expect( pmap['repository']['full_name'],  repo );
   expect( pmap['issue']['title'],           issueTitle );
   if( assignee != "" ) {
      expect( pmap['assignee']['login'],        assignee );
   }

   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

Future<bool> validateMove( WidgetTester tester, String detailName ) async {

   // checkNTap returns the key it was able to find.
   detailName = await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( tester, detailName );

   expect( pmap['action'],                    "edited" );

   validatePV2Item(   pmap );
   validatePV2Change( pmap );
   
   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

// Two valid paths to propose.
// 1) card created in PEND,                prop accr will be edit:change move to PEND
// 2) card closed then auto-moved to PEND, prop accr will be closed
Future<bool> validateProposeAccrue( WidgetTester tester, String repo, String issueTitle, String detailName, {action = "closed"} ) async {

   // checkNTap returns the key it was able to find.
   detailName = await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( tester, detailName );

   if( action == "closed" ) {
      expect( pmap['action'],                 "closed" );
      expect( pmap['issue']['state'],         "closed" );
      expect( pmap['repository']['full_name'], repo );
      expect( pmap['issue']['title'],          issueTitle );
   }
   else {
      expect( pmap['action'],                                "edited" );
      validatePV2Item(   pmap );
      validatePV2Change( pmap );
      expect( pmap["changes"]["field_value"]["to"]["name"],  "Pending PEQ Approval" );      
   }

   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

Future<bool> validateConfirmAccrue( WidgetTester tester, String repo, String detailName ) async {

   // checkNTap returns the key it was able to find.
   detailName = await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( tester, detailName );

   expect( pmap['action'],                 "edited" );

   validatePV2Item(   pmap );
   validatePV2Change( pmap );
   expect( pmap["changes"]["field_value"]["to"]["name"],  "Accrued" );

   await tester.tap( find.byKey( Key( 'Dismiss' ) ));
   await pumpSettle( tester, 1 );
   
   return true;
}

Future<bool> validateRejectAccrue( WidgetTester tester, String repo, String issueTitle, String detailName ) async {

   // checkNTap returns the key it was able to find.
   detailName = await checkNTap( tester, detailName );
   expect( find.text( "Raw Github Action:" ), findsOneWidget );

   final Map<String, dynamic> pmap = getPact( tester, detailName );

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
   expect( await validateAdd(        tester, repo, issue, "1k PEQ",     "0 0 confirm add" ),      true );
   expect( await validatePass(       tester,                            "1 0 confirm relocate" ), true );
   expect( await validateAssign(     tester, repo, issue, "builderCE",  "2 0 confirm change" ),   true );
   expect( await validateCreateCard( tester,                            "3 0 confirm add" ),      true );

   expect( await backToSummary( tester ), true );
   await toggleTableEntry( tester, 7, "" );
   await toggleTableEntry( tester, 3, "" );
   await toggleTableEntry( tester, 1, "" );
   
   return true;
}

// Starts with initial expansion
// NOTE!  key name is constructed as: peqCount + pactCount + action + verb.    detail_page:_makePAct
Future<bool> validateAri17( WidgetTester tester ) async {
   await expandAllocs( tester, 1, 1 );
   await expandAllocs( tester, 3, 3 );
   await expandAllocs( tester, 5, 5 );
   await checkOffsetAlloc( tester, 6, "ariCETester 17" );

   await expandLeaf( tester, 6, "ariCETester 17" );
   await pumpSettle( tester, 1 );

   String repo   = "codeequity/ceFlutterTester";

   // Need to scroll here
   final bottomFinder = find.byKey( Key( "IR Accrued" ));  
   final listFinder   = find.byType( ListView );
   
   // Most recent first

   String issue = "Situated Accrued iss1st";  // peq 0
   expect( find.byKey( Key( issue ) ),  findsOneWidget );
   expect( await validateAdd(           tester, repo, issue, "1k PEQ",  "0 0 confirm add" ),      true );
   expect( await validatePass(          tester,                         "1 0 confirm relocate" ), true );
   expect( await validateAssign(        tester, repo, issue, "ariCETester", "2 0 confirm change" ),   true );
   expect( await validatePass(          tester,                         "3 0 confirm relocate" ), true );     // XXX order 
   expect( await validateCreateCard(    tester,                         "4 0 confirm add" ),      true );     // XXX order 
   expect( await validateProposeAccrue( tester, repo, issue,            "5 0 propose accrue", action: "edited" ),   true );
   expect( await validateConfirmAccrue( tester, repo,                   "6 0 confirm accrue" ),   true );
   expect( await validateConfirmDelete( tester, repo, issue,            "7 0 confirm delete", issue: true ),   true );

   issue = "Situated Accrued card1st";   // peq 1
   expect( find.byKey( Key( issue ) ),  findsOneWidget );
   expect( await validateAdd(           tester, repo, issue, "1k PEQ",  "0 1 confirm add" ),      true );
   expect( await validatePass(          tester,                         "1 1 confirm relocate" ), true );
   expect( await validateAssign(        tester, repo, issue, "ariCETester", "2 1 confirm change" ),   true );
   expect( await validateCreateCard(    tester,                         "3 1 confirm add" ),      true );
   expect( await validatePass(          tester,                         "4 1 confirm relocate" ), true );
   expect( await validateProposeAccrue( tester, repo, issue,            "5 1 propose accrue", action: "edited" ),   true );
   expect( await validateConfirmAccrue( tester, repo,                   "6 1 confirm accrue" ),   true );
   expect( await validateConfirmDelete( tester, repo, issue,            "7 1 confirm delete" ),   true );

   await tester.dragUntilVisible( bottomFinder, listFinder, Offset(0.0, -50.0) );
   await tester.drag( listFinder, Offset(0.0, -50.0) );
   
   issue = "Close Open test";           // peq 2
   expect( find.byKey( Key( issue ) ),  findsOneWidget );
   expect( await validateAdd(        tester, repo, issue, "1k PEQ",  "0 2 confirm add" ),      true );
   expect( await validatePass(       tester,                         "1 2 confirm relocate" ), true );
   expect( await validateCreateCard( tester,                         "2 2 confirm add" ),      true );
   expect( await validatePass(       tester,                         "3 2 confirm relocate" ), true );
   expect( await validateMove(       tester,                         "4 2 confirm relocate" ), true );
   expect( await validateAssign(     tester, repo, issue, "ariCETester", "5 2 confirm change" ),   true );
   expect( await validateProposeAccrue( tester, repo, issue,         "6 2 propose accrue" ),   true );
   expect( await validateRejectAccrue(  tester, repo, issue,         "7 2 reject accrue" ),    true );
   expect( await validateMove(       tester,                         "8 2 confirm relocate" ), true );
   expect( await validateProposeAccrue( tester, repo, issue,         "9 2 propose accrue" ),   true );
   expect( await validateRejectAccrue(  tester, repo, issue,         "10 2 reject accrue" ),    true );   // 210 is peq 2 + pact 10
   expect( await validateProposeAccrue( tester, repo, issue,         "11 2 propose accrue" ),   true );
   expect( await validateConfirmAccrue( tester, repo,                "12 2 confirm accrue" ),   true );

   await tester.drag( listFinder, Offset(0.0, -100.0) );
   
   issue  = "IR Accrued";              // peq 3
   expect( find.byKey( Key( issue ) ),  findsOneWidget );
   expect( await validateAdd(        tester, repo, issue, "1k PEQ",      "0 3 confirm add" ),      true );
   expect( await validatePass(       tester,                             "1 3 confirm relocate" ), true );
   expect( await validateAssign(     tester, repo, issue, "ariCETester", "2 3 confirm change" ),   true );   
   expect( await validateCreateCard( tester,                             "3 3 confirm add" ),      true );
   expect( await validatePass(       tester,                             "4 3 confirm relocate" ), true );
   expect( await validateMove(       tester,                             "5 3 confirm relocate" ), true );
   expect( await validateProposeAccrue( tester, repo, issue,             "6 3 propose accrue" ),   true );
   expect( await validateConfirmAccrue( tester, repo,                    "7 3 confirm accrue" ),   true );
   
   expect( await backToSummary( tester ), true );
   await toggleTableEntry( tester, 5, "" );
   await toggleTableEntry( tester, 3, "" );
   await toggleTableEntry( tester, 1, "" );

   return true;
}

// Note: assignments, failed moves, etc. are ignored for summary.  SummaryDetails only record valid PEQ-related actions.
Future<bool> validateAlloc29( WidgetTester tester ) async {
   await expandAllocs( tester, 1, 1 );
   await expandAllocs( tester, 3, 3 );
   await expandAllocs( tester, 9, 9 );
   await checkOffsetAlloc( tester, 10, "Component Alloc 29" );

   await expandLeaf( tester, 10, "Component Alloc 29" );
   await pumpSettle( tester, 1 );

   String repo   = "codeequity/ceFlutterTester";

   String issue  = "Component Alloc";
   expect( find.byKey( Key( issue ) ), findsOneWidget );
   expect( await validateAdd(     tester, repo, issue, "1M AllocPEQ",  "0 0 confirm add" ),      true );
   expect( await validatePass(    tester,                              "1 0 confirm relocate" ), true );
   expect( await validateCreateCard( tester,                           "2 0 confirm add" ),      true );
   expect( await validatePass(    tester,                              "3 0 confirm relocate" ), true );
   expect( await validateMove(    tester,                              "4 0 confirm relocate" ), true );  // stars
   expect( await validateMove(    tester,                              "5 0 confirm relocate" ), true );  // stripes
   expect( await validateMove(    tester,                              "6 0 confirm relocate" ), true );  // in prog
   expect( await validateMove(    tester,                              "7 0 confirm relocate" ), true );  // accr
   
   expect( await backToSummary( tester ), true );
   await toggleTableEntry( tester, 9, "" );
   await toggleTableEntry( tester, 3, "" );
   await toggleTableEntry( tester, 1, "" );
   
   return true;
}

Future<bool> validateUnAlloc32( WidgetTester tester ) async {
   await expandAllocs( tester, 1, 1 );
   await checkOffsetAlloc( tester, 4, "Unallocated 32" );

   await expandLeaf( tester, 4, "Unallocated 32" );
   await pumpSettle( tester, 1 );

   String repo   = "codeequity/ceFlutterTester";

   String issue  = "Unallocated";
   expect( find.byKey( Key( issue ) ), findsOneWidget );
   expect( await validateAdd(     tester, repo, issue, "3M AllocPEQ",   "0 0 confirm add" ),   true );
   expect( await validatePass(    tester,                               "1 0 confirm relocate" ), true );
   
   expect( await backToSummary( tester ), true );
   await toggleTableEntry( tester, 1, "" );
   
   return true;
}

Future<bool> validateUnAssign39( WidgetTester tester ) async {
   await expandAllocs( tester, 3, 4 );
   await checkOffsetAlloc( tester, 7, "Unassigned 39" );

   await expandLeaf( tester, 7, "Unassigned 39" );
   await pumpSettle( tester, 1 );

   String repo   = "codeequity/ceFlutterTester";

   String issue  = "Blast 6";
   expect( find.byKey( Key( issue ) ), findsOneWidget );

   expect( await validateAdd(      tester, repo, issue, "604 PEQ",     "0 0 confirm add" ),      true );
   expect( await validatePass(     tester,                             "1 0 confirm relocate"),  true );
   expect( await validateAssign(   tester, repo, issue, "",            "2 0 confirm change" ),   true );   
   expect( await validateAssign(   tester, repo, issue, "",            "3 0 confirm change" ),   true );   
   expect( await validateUnAssign( tester, repo, issue, "",            "4 0 confirm change" ),   true );   
   expect( await validateUnAssign( tester, repo, issue, "",            "5 0 confirm change" ),   true );   
   
   expect( await backToSummary( tester ), true );
   await toggleTableEntry( tester, 4, "" );
   await toggleTableEntry( tester, 3, "" );
   
   return true;
}

Future<bool> ariSummaryContent( WidgetTester tester ) async {
   final listFinder   = find.byType( ListView );
   final topFinder    = find.text( "Category" );
   final bottomFinder = find.text( "Cross Proj" );

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
   await checkOffsetAlloc( tester, 8, "Github Operations Flut 12" );
   await checkOffsetAlloc( tester, 9, "Unallocated 32" );
   await checkOffsetAlloc( tester, 12, "A Pre-Existing Project Flut 41" );
   await checkOffsetAlloc( tester, 13, "Bacon 42" );
   await checkOffsetAlloc( tester, 14, "ariCETester 43");         
   await checkOffsetAlloc( tester, 15, "IR Alloc split 44" );

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
   
   report( 'Project', group:true );

   testWidgets('Project Basics', skip:skip, (WidgetTester tester) async {
// testWidgets('Project Basics', skip:true, (WidgetTester tester) async {

         await restart( tester );
         await login( tester, true );

         final Finder ariLink = find.byKey( Key( repo ));
         await tester.tap( ariLink );
         await pumpSettle( tester, 5, verbose: true ); 
         await pumpSettle( tester, 3, verbose: true ); 

         expect( await verifyOnProjectPage( tester ), true );

         // ceFlutterTester was just cleared, so there are no category summaries yet.
         // expect( await peqSummaryTabFraming( tester ),   true );
         
         expect( await verifyEmptyProjectPage( tester ), true );         
         expect( await approvalsTabFraming( tester ),    true );
         expect( await contributorsTabFraming( tester ), true );
         expect( await equityPlanTabFraming( tester ),   true );
         expect( await agreementsTabFraming( tester ),   true );

         await logout( tester );         

         report( 'Project Basics' );
      });


   // NOTE: testCEFlutter.py always runs 'npm clean' before this if override is set
   //       it is possible to depend on process_run and run from here, but that clutters deps
   // testWidgets('Project contents, ingest', skip:true, (WidgetTester tester) async {
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
         print( 'Waiting 160s');
         await pumpSettle( tester, 160, verbose: true );
         print( 'Done waiting 160s');
         await pumpSettle( tester, 4, verbose: true );
         await pumpSettle( tester, 2, verbose: true );
         
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
         await checkOffsetAlloc( tester, 8, "Github Operations Flut 12" );
         await checkOffsetAlloc( tester, 9, "Unallocated 32" );

         // close group1, verify
         await toggleTableEntry( tester, 1, "" );
         await checkOffsetAlloc( tester, 1, "Software Contributions 1" );
         await checkOffsetAlloc( tester, 2, "Business Operations 33" );
            
         // open group1, verify 
         await toggleTableEntry( tester, 1, "" );
         await checkAllocs( tester, 1, 6 );  // checks all of swCont, first path fully expanded
         await checkOffsetAlloc( tester, 8, "Github Operations Flut 12" );
         await checkOffsetAlloc( tester, 9, "Unallocated 32" );

         
         // EXPAND 2nd group
         await toggleTableEntry( tester, 1, "" );  // close group1
         await expandAllocs( tester, 4, 5 );
         await toggleTableEntry( tester, 9, "" );  
         await checkOffsetAlloc( tester, 4, "A Pre-Existing Project Flut 41" );
         await checkOffsetAlloc( tester, 5, "Bacon 42" );
         await checkOffsetAlloc( tester, 6, "ariCETester 43");         
         await checkOffsetAlloc( tester, 7, "IR Alloc split 44" );
         await checkOffsetAlloc( tester, 8, "Unassigned 45" );
         await checkOffsetAlloc( tester, 9, "Accrued 46");
         await checkOffsetAlloc( tester, 10, "ariCETester 47");
         await checkOffsetAlloc( tester, 11,"Cross Proj 48" );
         
         // close group2, verify
         await toggleTableEntry( tester, 4, "" );
         await checkOffsetAlloc( tester, 1, "Software Contributions 1" );
         await checkOffsetAlloc( tester, 2, "Business Operations 33" );
         await checkOffsetAlloc( tester, 4, "A Pre-Existing Project Flut 41" );
         await checkOffsetAlloc( tester, 5, "Cross Proj 48" );
            
         // OPEN 2nd group
         await toggleTableEntry( tester, 4, "" );  
         await checkOffsetAlloc( tester, 4, "A Pre-Existing Project Flut 41" );
         await checkOffsetAlloc( tester, 5, "Bacon 42" );
         await checkOffsetAlloc( tester, 6, "ariCETester 43");         
         await checkOffsetAlloc( tester, 7, "IR Alloc split 44" );
         await checkOffsetAlloc( tester, 8, "Unassigned 45" );
         await checkOffsetAlloc( tester, 9, "Accrued 46");
         await checkOffsetAlloc( tester, 10, "ariCETester 47");
         await checkOffsetAlloc( tester, 11,"Cross Proj 48" );
         
         // OPEN 1st group
         await toggleTableEntry( tester, 1, "" );
         await _checkHelper( tester );
         
         // cell height is 50
         final listFinder   = find.byType( ListView );         
         await tester.drag( listFinder, Offset(0.0, -300.0) );
         await tester.drag( listFinder, Offset(0.0, -50.0) );
         await tester.pumpAndSettle();
         print( "DOWN" );
         
         await checkOffsetAlloc( tester, 17, "Accrued 46");
         await checkOffsetAlloc( tester, 18, "ariCETester 47");
         await checkOffsetAlloc( tester, 19, "Cross Proj 48" );
         
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

   print( "DETAIL" );
   testWidgets('Project Detail Page', skip:false, (WidgetTester tester) async {
         
         await restart( tester );
         await login( tester, true );

         expect( await verifyAriHome( tester ), true );
         
         final Finder ariLink = find.byKey( Key( repo ));
         await tester.tap( ariLink );
         await pumpSettle( tester, 2, verbose: true ); 
         await pumpSettle( tester, 2, verbose: true ); 

         expect( await peqSummaryTabFraming( tester ),   true );

         expect( await validateBuilder25( tester ), true );
         expect( await validateAri17( tester ), true );
         expect( await validateAlloc29( tester ), true );
         expect( await validateUnAlloc32( tester ), true );
         expect( await validateUnAssign39( tester ), true );
         
         await logout( tester );         

         report( 'Project Detail Page' );
      });


   // Next test: detail pages
}
     
