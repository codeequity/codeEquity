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
// check app_state.. that'd be good..
// https://blog.gskinner.com/archives/2021/06/flutter-a-deep-dive-into-integration_test-library.html

// Gold standard for testing ingest and summary frame for ariCETester/CodeEquityTester
// XXX Category should show ["7,000,000", "12,840", "2,500", "11,001"] in ceFlutter
// XXX Test for presence in gold not replicated in ceFlutter
// XXX Discrepencies:
//     - "Category, Software Contributions, Data Security, Pending PEQ Approval, Unassigned": ["0", "250", "0", "0"],   ir plan split is assigned
//     - "Category, UnClaimed, Accrued, ariCETester": ["0", "0", "0", "2,000"] does not exist (possibly one of the intentional deletes)
//     - "Category, UnClaimed, UnClaimed, Unassigned": ["0", "1,709", "0", "0"] github shows 709
const Map<String,List<String>> ALLOCS_GOLD =
{
"Category": ["7,000,000", "12,840", "2,500", "11,001"],

"Category, Software Contributions": ["5,500,000", "2,001", "1,500", "6,501"],

"Category, Software Contributions, Data Security": ["1,000,000", "250", "0", "4,000"],
"Category, Software Contributions, Data Security, Accrued": ["0", "0", "0", "4,000"],
"Category, Software Contributions, Data Security, Accrued, codeequity": ["0", "0", "0", "1,000"],
"Category, Software Contributions, Data Security, Accrued, ariCETester": ["0", "0", "0", "3,000"],
"Category, Software Contributions, Data Security, Pending PEQ Approval": ["0", "250", "0", "0"],
"Category, Software Contributions, Data Security, Pending PEQ Approval, Unassigned": ["0", "250", "0", "0"],

"Category, Software Contributions, Github Operations": ["1,500,000", "1,751", "1,500", "2,501"],
"Category, Software Contributions, Github Operations, In Progress": ["0", "1,000", "0", "0"],
"Category, Software Contributions, Github Operations, In Progress, codeequity": ["0", "1,000", "0", "0"],
"Category, Software Contributions, Github Operations, Pending PEQ Approval": ["0", "0", "1,500", "0"],
"Category, Software Contributions, Github Operations, Pending PEQ Approval, ariCETester": ["0", "0", "750", "0"],
"Category, Software Contributions, Github Operations, Pending PEQ Approval, codeequity": ["0", "0", "750", "0"],
"Category, Software Contributions, Github Operations, Accrued": ["0", "0", "0", "2,501"],
"Category, Software Contributions, Github Operations, Accrued, ariCETester": ["0", "0", "0", "2,000"],
"Category, Software Contributions, Github Operations, Accrued, codeequity": ["0", "0", "0", "501"],
"Category, Software Contributions, Github Operations, Planned": ["0", "751", "0", "0"],
"Category, Software Contributions, Github Operations, Planned, ariCETester": ["0", "250", "0", "0"],
"Category, Software Contributions, Github Operations, Planned, Unassigned": ["0", "501", "0", "0"],
"Category, Software Contributions, Github Operations, Stars": ["500,000", "0", "0", "0"],
"Category, Software Contributions, Github Operations, Stars, IR Alloc": ["500,000", "0", "0", "0"],
"Category, Software Contributions, Github Operations, Stripes": ["1,000,000", "0", "0", "0"],
"Category, Software Contributions, Github Operations, Stripes, Component Alloc": ["1,000,000", "0", "0", "0"],

"Category, Software Contributions, Unallocated": ["3,000,000", "0", "0", "0"],

"Category, Business Operations": ["1,000,000", "0", "0", "0"],
"Category, Business Operations, Unallocated": ["1,000,000", "0", "0", "0"],

"Category, UnClaimed": ["0", "8,339", "0", "2,000"],
"Category, UnClaimed, UnClaimed": ["0", "8,339", "0", "0"],
"Category, UnClaimed, UnClaimed, ariCETester": ["0", "3,467", "0", "0"],
"Category, UnClaimed, UnClaimed, codeequity": ["0", "2,411", "0", "0"],
"Category, UnClaimed, UnClaimed, Unassigned": ["0", "1,709", "0", "0"],
"Category, UnClaimed, UnClaimed, connieCE": ["0", "752", "0", "0"],
"Category, UnClaimed, Accrued": ["0", "0", "0", "2,000"],
"Category, UnClaimed, Accrued, ariCETester": ["0", "0", "0", "2,000"],

"Category, A Pre-Existing Project": ["500,000", "1,500", "0", "1,500"],
"Category, A Pre-Existing Project, Bacon": ["500,000", "1,500", "0", "0"],
"Category, A Pre-Existing Project, Bacon, Unassigned": ["0", "1,500", "0", "0"],
"Category, A Pre-Existing Project, Bacon, IR Alloc split: IwBRvVYU": ["500,000", "0", "0", "0"],
"Category, A Pre-Existing Project, Accrued": ["0", "0", "0", "1,500"],
"Category, A Pre-Existing Project, Accrued, ariCETester": ["0", "0", "0", "1,500"],

"Category, New ProjCol Proj": ["0", "1,000", "1,000", "1,000"],
"Category, New ProjCol Proj, New plan name": ["0", "1,000", "0", "0"],
"Category, New ProjCol Proj, New plan name, Unassigned": ["0", "1,000", "0", "0"],
"Category, New ProjCol Proj, Pending PEQ Approval": ["0", "0", "1,000", "0"],
"Category, New ProjCol Proj, Pending PEQ Approval, codeequity": ["0", "0", "1,000", "0"],
"Category, New ProjCol Proj, Accrued": ["0", "0", "0", "1,000"],
"Category, New ProjCol Proj, Accrued, ariCETester": ["0", "0", "0", "1,000"],
};


Future<bool> peqSummaryTabFraming( WidgetTester tester ) async {
   expect( await verifyOnProjectPage( tester ), true );
   final Finder tab = find.byKey( const Key('PEQ Summary' ));
   await tester.tap( tab );
   await tester.pumpAndSettle( Duration( seconds:1 ));

   expect( find.text('Category'), findsOneWidget );
   expect( find.text('Allocation'), findsOneWidget );
   expect( find.text('Planned'), findsOneWidget );
   expect( find.text('Pending'), findsOneWidget );
   expect( find.text('Accrued'), findsOneWidget );
   expect( find.text('Remaining'), findsOneWidget );

   expect( find.byKey(const Key( 'Update PEQ Summary?' )), findsOneWidget );

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
   expect( find.text( 'A Pre-Existing Project' ), findsOneWidget );
   expect( find.text( 'New ProjCol Proj' ),       findsOneWidget );

   expect( find.text( 'Allocation' ), findsOneWidget );
   expect( find.text( 'Planned' ),    findsOneWidget );
   expect( find.text( 'Pending' ),    findsOneWidget );
   expect( find.text( 'Accrued' ),    findsOneWidget );
   expect( find.text( 'Remaining' ),  findsOneWidget );
   return true;
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

// XXX ? move these accessors next to original functions?
// from Node.  Walk down node and leaf tiles in alloc table.  
String getFromNode( Widget elt ) {
   String retVal = "";
   if( elt is Container ) {
      var listTile  = elt.child as ListTileTheme;
      var expansion = listTile.child as ExpansionTile;
      var pad       = expansion.title as Padding;
      var container = pad.child as Container;
      var nodeText  = container.child as Text; 
      retVal        = nodeText.data ?? "";
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


Future<bool> printElt( WidgetTester tester, String keyName ) async {
   final Finder generatedAllocRow = find.byKey( Key( keyName ));
   expect( generatedAllocRow, findsOneWidget );

   var allocRow = generatedAllocRow.evaluate().single.widget as Row;
   var allocs   = allocRow.children as List;

   String aRow = "";
   for( final elt in allocs ) {
      String t = getFromMakeTableText( elt );
      aRow += t == "" ? t : t + " || ";

      t = getFromNode( elt );
      aRow += t == "" ? t : t + " || ";

      if( keyName == "allocsTable 3" ) {
         final Finder arrow = findArrow( elt );
         if( tester.widgetList<Icon>( arrow ).length > 0 ) {
            print( "T   A   P  " );
            await tester.tap( arrow );
            await tester.pumpAndSettle( Duration( seconds: 2 ));
         }
      }
   }
   print( aRow );
   return true;
}

Future<bool> expandAllocs( WidgetTester tester, int num ) async {

   // Note: key is generated exactly once.
   //       So, for example, row 2 is generated for first render.  Then, if scroll it offscreen, finder can no longer find it (say, to tap it).
   for( var i = 1; i < num; i++ ) {

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
               print( "Tap i: " + i.toString() + "  count: " + count.toString() );
               final Finder arrow = findArrow( elt );
               if( tester.widgetList<Icon>( arrow ).length > 0 ) {
                  // print( "Tap i: " + i.toString() + "  count: " + count.toString() );
                  await tester.tap( arrow );
                  await tester.pumpAndSettle( Duration( seconds: 1 ));
               }
            }
      }
      else { print( "Could not find allocTable row" ); }
   }
   return true;
}

// https://stackoverflow.com/questions/48081917/flutter-listview-not-scrollable-not-bouncing
Future<bool> ariSummaryContent( WidgetTester tester ) async {

   // await printElt( tester, 'allocsTable 0' );
   // await printElt( tester, 'allocsTable 1' );
   // await printElt( tester, 'allocsTable 2' );
   // await printElt( tester, 'allocsTable 3' );

   // First, expand.  Then test drag down.  Then start checking.
   await expandAllocs( tester, 10 );

   // final listFinder   = find.byKey( const Key( 'verticalSummaryScroll' ));
   final listFinder   = find.byType( ListView );
   final topFinder    = find.text( "Category" );
   final bottomFinder = find.text( "A Pre-Existing Project" );

   // Scroll until the item to be found appears.  
   // ScrollUntilVis would be great, but wow. https://github.com/flutter/flutter/issues/88762
   // Maybe next year.  use drag for now - it can stop if 1 pixel of the widget is showing, so add a little extra afterwards
   // await tester.scrollUntilVisible( bottomFinder, 500.0, scrollable:listFinder );

   // XXX pumpAndSettle with duration after drag causes method to exit prematurely (!!)
   print( "Down!" );
   await tester.dragUntilVisible( bottomFinder, listFinder, Offset(0.0, -50.0) );
   await tester.drag( listFinder, Offset(0.0, -50.0) );
   await tester.pumpAndSettle( Duration( seconds: 2 ));

   print( "Up!" );
   await tester.dragUntilVisible( topFinder, listFinder, Offset(0.0, 50.0) );
   await tester.drag( listFinder, Offset(0.0, 50.0) );
   // await tester.pumpAndSettle( Duration( seconds: 2 ));
   // await tester.pumpAndSettle( Duration( seconds: 1 ));
   await tester.pumpAndSettle();

   // Which is it?
   print( "Down!" );
   await tester.dragUntilVisible( bottomFinder, listFinder, Offset(0.0, -50.0) );
   await tester.drag( listFinder, Offset(0.0, -50.0) );
   // await tester.pumpAndSettle( Duration( seconds: 2 ));
   await tester.pumpAndSettle();
   print( "Expand!" );
   await expandAllocs( tester, 2 );
   await pumpSettle(tester, 2);

   // await tester.pumpAndSettle();
   // await Future.delayed(Duration(seconds: 2));
   // await tester.pumpAndSettle();

   print( "Up!" );
   await tester.dragUntilVisible( topFinder, listFinder, Offset(0.0, 50.0) );
   await tester.drag( listFinder, Offset(0.0, 50.0) );
   // await tester.pumpAndSettle( Duration( seconds: 2 ));
   // await tester.pumpAndSettle( Duration( seconds: 1 ));
   await tester.pumpAndSettle();

   print( "Anything closed?" );
   await tester.pumpAndSettle( Duration( seconds: 5 ));

   print( "Expand!" );
   await expandAllocs( tester, 2 );
   await pumpSettle(tester, 2);

   print( "Anything closed?" );
   await tester.pumpAndSettle( Duration( seconds: 5 ));
   
   print( "Done!" );
   
   return true;
}


void main() {

   // final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized() as IntegrationTestWidgetsFlutterBinding;
   IntegrationTestWidgetsFlutterBinding.ensureInitialized();

   final bool skip = true;
   
   report( 'Project', group:true );
   
   testWidgets('Project Basics', skip:skip, (WidgetTester tester) async {
         
         await restart( tester );
         await login( tester, true );

         final Finder ariLink = find.byKey( const Key('ariCETester/CodeEquityTester' ));
         await tester.tap( ariLink );
         print( "pumping" );
         await tester.pumpAndSettle( Duration( seconds: 5 ));
         print( "pumping" );
         await tester.pumpAndSettle( Duration( seconds: 3 ));

         expect( await verifyOnProjectPage( tester ), true );

         expect( await peqSummaryTabFraming( tester ),   true );
         expect( await approvalsTabFraming( tester ),    true );
         expect( await contributorsTabFraming( tester ), true );
         expect( await equityPlanTabFraming( tester ),   true );
         expect( await agreementsTabFraming( tester ),   true );

         await logout( tester );         

         report( 'Project Basics' );
      });


   testWidgets('Project contents', skip:false, (WidgetTester tester) async {

         await restart( tester );
         await login( tester, true );

         // Login checks for homepage, but verify this is Ari before testing contents
         expect( await verifyAriHome( tester ), true );         

         final Finder ariLink = find.byKey( const Key('ariCETester/CodeEquityTester' ));
         await tester.tap( ariLink );
         print( "pumping" );
         await tester.pumpAndSettle( Duration( seconds: 5 ));
         print( "pumping" );
         await tester.pumpAndSettle( Duration( seconds: 3 ));

         expect( await verifyOnProjectPage( tester ), true );

         // This leaves us in summary frame
         expect( await peqSummaryTabFraming( tester ),   true );

         
         // final scrollableFinder = find.descendant( of: find.byType(ListView), matching: find.byType(Scrollable), );
         // final scrollableFinder = find.ancestor( of: find.byType(ListView), matching: find.byType(Scrollable), );

         expect( await ariSummaryFraming( tester ), true );
         expect( await ariSummaryContent( tester ), true );

         await logout( tester );         

         report( 'Project contents' );
      });

}
     
