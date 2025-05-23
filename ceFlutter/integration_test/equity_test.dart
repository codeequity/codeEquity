@Timeout(Duration(minutes: 25))

import 'dart:convert';  // json encode/decode
import 'dart:async';    // timer

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

const TEST = false;

// Gold standard for testing ingest and summary frame for codeequity/ceFlutterTester
const Map<String,List<String>> EQS_GOLD =
{
   "Category 0": ["Category", "Allocation"],
      
      "Business Operations Flut 1":        ["Category, Business Operations Flut", "1,000,000", ""],
      "Software Contributions Flut 2":     ["Category, Software Contributions Flut", "11,000,000", ""],
        "AWS Operations 3":                ["Category, Software Contributions Flut, AWS Operations", "1,000,000", ""],
        "Github Operations Flut 4":        ["Category, Software Contributions Flut, Github Operations Flut", "1,000,000", "Github Operations Flut"],
        "CEServer 5":                      ["Category, Software Contributions Flut, CEServer", "3,000,000", ""],
        "CEFlutter 6":                     ["Category, Software Contributions Flut, CEFlutter", "2,000,000", ""],
        "Data Security Flut 7":            ["Category, Software Contributions Flut, Data Security Flut", "1,000,000", "Data Security Flut"],
        "Test Only 8":                     ["Category, Software Contributions Flut, Test Only", "3,000,000", "No Such Project"],
      "Cross Proj 9":                      ["Category, Cross Proj", "0", "Cross Proj"],
      "A Pre-Existing Project Flut 10":    ["Category, A Pre-Existing Project Flut", "0", "A Pre-Existing Project Flut"],
      "Test Only 11":                      ["Category, Test Only", "3,000,000", "Such A Project"],
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

String getFromMouseRegion( Widget elt ) {
   String retVal = "";

   if( !( elt is MouseRegion ) ) { return retVal; }
   var eltMR = elt as MouseRegion;

   if( !( eltMR.child is Padding ) ) { return retVal; }
   var eltP = eltMR.child as Padding;

   if( !( eltP.child is IntrinsicWidth ) ) { return retVal; }
   var eltIR = eltP.child as IntrinsicWidth;

   if( !( eltIR.child is Text ) ) { return retVal; }
   var contText = eltIR.child as Text;

   retVal = contText.data ?? "";

   return retVal;
}

// Get depth by working out the mux passed in.
// This looks nasty on the face of it, but it is the only way (currently) to ensure visual output is correct, showing hierarchy.
// Actual ancesterage is worked out in checkEqs.
int getDepthFromCat( Widget elt ) {
   int depth = 1;

   GestureDetector eqGD  = getGD( elt );
   if( eqGD.child == null || ( eqGD.child is Container )) { return depth; }
   
   if( eqGD.child is MouseRegion ) {
      final double gappad = 20.0; // app_state.GAP_PAD   XXX pull this in?  hmmm..

      var eltMR = eqGD.child as MouseRegion;

      if( !( eltMR.child is Padding ) ) { return depth; }
      Padding pad = eltMR.child as Padding;
      
      // mux: (depth+1) * .5 )
      var edgeInset = pad.padding as EdgeInsets;
      
      // ratio of 1.5 gives 3, but 2 of that is from depth+1 above
      depth = ( ( edgeInset.left / gappad ) / 0.5 ).round() - 2; 
      // print( "edgeInsetLeft " + edgeInset.left.toString() + " depth " + depth.toString() );
   }
   return depth;
}

String getCatFromTiles( Widget elt ) {
   String retVal = "";
   GestureDetector eqGD  = getGD( elt );
   if( eqGD.child == null || ( eqGD.child is Container )) { return retVal; }
   
   if( eqGD.child is MouseRegion ) { retVal = getFromMouseRegion( eqGD.child as MouseRegion );  }

   return retVal;
}


String getAmtFromTiles( Widget elt ) {
   String retVal = "";
   if( elt is Container && elt.child is Padding ) {
      
      retVal        = getFromMakeTableText( elt.child! );
   }
   return retVal;
}

GestureDetector getGDFromRow( Finder generatedEquityRow ) {
   expect( generatedEquityRow, findsOneWidget );

   var equityRow = generatedEquityRow.evaluate().single.widget as Row;
   var eqs   = equityRow.children as List;
   assert( eqs.length > 0 );

   var elt = eqs[0];
   return getGD( elt ); 
}

   
GestureDetector getGD( Widget elt ) {
   GestureDetector empty = GestureDetector( child: Container( width: 1, height: 1 ) );

   if( !(elt is Container)) { return empty; }
   var eltC = elt as Container;
   if( !( eltC.child is Wrap)) { return empty; }
   Wrap eltW = eltC.child as Wrap;

   // print( "getGD2 " + eltW.toString() );
   assert( eltW.children.length > 0 );
   if( !(eltW.children[0] is GestureDetector )) { return empty; }   // for example, tileKids

   return eltW.children[0] as GestureDetector;
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
      // e.g. amounts without warning
      String t = getFromMakeTableText( elt );
      if( t != "" ) { aRow.add( t ); }

      // e.g. amounts with warning.
      if( elt is Container && elt.child is Wrap ) {
         var kids = (elt.child as Wrap).children;
         if( kids != null && kids!.length > 0 ) {
            t = getFromMakeTableText( kids![0] );
            if( t != "" ) { aRow.add( t ); }
         }
      }
      // Get category and depth
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
Future<bool> checkEqs( WidgetTester tester, int min, int max, {int offset = 0, int newDepth = -1, String newAmt = "-1", int tries = 0} ) async {

   bool retVal = true;
   // print( "enter checkeq " + min.toString() + " " + max.toString() );
   for( int i = min; i <= max; i++ ) {

      // eqs is [leaf, amount, depth]
      // print( "checking equityTable " + i.toString() + " with gold table offset " + offset.toString() + " depth " + newDepth.toString());  
      List<String> eqs = await getElt( tester, "equityTable " + i.toString() );

      // First elt in eqs is used as key for eqs_gold
      // eqs is from the displayed table in ceFlutter, has short title, then numbers.
      // eqs_gold is const above, is a map to a list<str> with long title, then numbers.
      
      String agKey = eqs[0] + " " + (i+offset).toString();                 
      // print( "Got eqs " + eqs.toString() + " making agKey *" + agKey + "*");

      List<String> agVals  = EQS_GOLD[ agKey ] ?? [];

      // Test Only may have rand tag after it.  Check, strip
      if( agVals.length == 0 ) {
         List<String> av = agKey.split(' ');
         if( av.length > 3 && (av[0] + " " + av[1]) == "Test Only" ) {
            agKey = "Test Only " + av[3];
            print( "Rand alphaNum tag detected.  Remade agKey: " + agKey );
            agVals  = EQS_GOLD[ agKey ] ?? [];
         }
      }
      // print( "  Found Gold vals for key " + agKey + ": " + agVals.toString() + " " + agVals.length.toString() );

      // Attempt fix possible race condition
      while( tries < 5 && agVals.length <= 0 ) {
         print( "  ?? No agvals, try again.  Gold vals for key " + agKey + ": " + agVals.toString() + " " + agVals.length.toString() + " " + tries.toString() );
         await pumpSettle( tester, 5 );
         tries += 1;
         retVal = await checkEqs( tester, min, max, offset: offset, newDepth: newDepth, newAmt: newAmt, tries: tries );
         return retVal;
      }
      if( tries >= 5 ) { return false; }
      assert( agVals.length > 0 );
      
      // depth is # commas, i.e. Soft Cont is depth 1 making TOT depth 0
      int goldDepth = newDepth != -1 ? newDepth : ','.allMatches( agVals[0] ).length;
      expect( goldDepth, int.parse( eqs[3] ) );
      // amt
      String amt = newAmt == "-1" ? agVals[1] : newAmt;
      expect( eqs[2], amt );

   }
   // print( "Leaving checkeq "  + min.toString() + " " + max.toString() );
   return retVal;
}

Future<void> deleteEq ( WidgetTester tester ) async {
   // print( "delete Testing, looking for catEditable 1" );
   final Finder cat = find.byKey( Key( 'catEditable 1' ));
   expect( cat, findsOneWidget );
   // await tester.ensureVisible( cat );
   await tester.tap( cat );
   await tester.pumpAndSettle();

   final Finder delButton = find.byKey( Key( 'Delete' ) );
   expect( delButton, findsOneWidget );
   await tester.tap( delButton );
   await tester.pumpAndSettle();
}

Future<void> addEq( WidgetTester tester, k, v ) async {
   assert( v.length == 3 );  // cat, amount, host project name

   print( "Adding " + k );
   
   final Finder addButton = find.byKey( Key( 'add_icon_equity' ));
   expect( addButton, findsOneWidget );
   await tester.tap( addButton );
   await tester.pumpAndSettle();
   
   // Add dialog has popped up.  Find text controllers
   final Finder editCat = find.byKey( Key( 'editRow Category' )); 
   final Finder editAmt = find.byKey( Key( 'editRow Allocation' ));   
   final Finder editHPN = find.byKey( Key( 'editRow Associated host project name' ));   
   expect( editCat, findsOneWidget );
   expect( editAmt, findsOneWidget );
   expect( editHPN, findsOneWidget );

   // Add values
   List<String> cats = v[0].split(', '); // gold table delimits with ', '
   await tester.enterText( editCat, cats[ cats.length - 1 ] );
   await tester.pumpAndSettle();
   await tester.enterText( editAmt, v[1] );
   await tester.pumpAndSettle();
   await tester.enterText( editHPN, v[2] );
   await tester.pumpAndSettle();
   
   final Finder saveButton = find.byKey( Key( 'Save' ) );
   expect( saveButton, findsOneWidget );
   await tester.tap( saveButton );
   await tester.pumpAndSettle();
   
   // Need to indent.. num of indents is length of cats - 2 (everything starts indented to TOT, TOT is part of every cat)
   // keys: contain all we need.. i.e. "CEServer 5"
   List<String> goldKey = k.split(' ');   
   final Finder cat = find.byKey( Key( 'indent ' + goldKey[ goldKey.length - 1 ].toString() )); 
   for( int i = 0; i < cats.length - 2; i++ ) {
      await tester.tap( cat );
      await tester.pumpAndSettle();
   }
}

Future<bool> rebuildEquityTable ( WidgetTester tester ) async {
   // Clear
   print( "\nRebuild Equity Table" );
   Finder generatedEquityRow = find.byKey( Key( "equityTable 1" ));
   while( tester.widgetList<Row>( generatedEquityRow ).length > 0 ) {
      GestureDetector eqGD  = getGDFromRow( generatedEquityRow );
      if( eqGD.child == null || ( eqGD.child is Container )) { break; }
      
      String title = getFromMouseRegion( eqGD.child as MouseRegion );
      print( "Deleting (in test) " + title );
      await deleteEq( tester ); 
   }
   await pumpSettle( tester, 3 );

   // Add
   print( "\nAdd Gold image back" );
   for( final key in EQS_GOLD.keys ) {
      if( key != "Category 0" ) { await addEq( tester, key, EQS_GOLD[key] ); }
   }
   return true;
}

// Undo has a plus 1 - insertion point counts gaps with 0th being above Category, 1 for self if self is above insertion.
// Undo is unmodified if insertion point is above self - no need to remove self from index
// spots is negative to go up (int number of positions), pos to go down 
Future<bool> drag( WidgetTester tester, int index, int spots ) async {
   String keyName         = "drag " + index.toString(); 
   final Finder ceFlutter = find.byKey( Key( keyName ) );


   // Find gap size
   final Finder f1 = find.byKey( Key( "drag 1" ) );
   final Finder f2 = find.byKey( Key( "drag 2" ) );
   RenderBox? box1 = f1.evaluate().single.renderObject! as RenderBox;
   RenderBox? box2 = f2.evaluate().single.renderObject! as RenderBox;
   assert( box1 != null && box2 != null );
   final p1 = box1!.localToGlobal(Offset.zero);
   final p2 = box2!.localToGlobal(Offset.zero);
   final dragGap = p2.dy - p1.dy;
   
   // XXX This depends on size of window being controlled by flutter driver (integration test fwk).
   //     Mysteriously, renderbox does not seem to get offset correctly with different window sizes.  Why is fudge needed???
   double fudge = (index == 6 && spots >= 2) ? dragGap : 0.0;
   double dy = dragGap * spots + fudge;
   print( "Drag " + index.toString() + " " + spots.toString() + " dy: " + dy.toString() + " gap: " + dragGap.toString());
   
   await tester.drag(ceFlutter, Offset(0.0, dy )); 
   await tester.pumpAndSettle();
   // await pumpSettle( tester, 2 );   // give a small chance to see move
   return true;
}



// XXX NOTE When driver window (i.e. not 'this window is controlled by automated software' gets too small,
//     this test fails.  How do we set driver window size??
Future<bool> validateDragAboveTOT( WidgetTester tester, int index, int spots ) async {
   print( "\nDrag above TOT" );
   await drag( tester, index, spots );
      
   // Should be no impact, can not move above TOT
   expect( await checkEqs( tester, 1, 11 ), true );

   return true;
}

// Note: parentage of ceFlutter changes.  Now depth 1.  Gold table has it at depth 2.  
Future<bool> validateDragAboveBusOp( WidgetTester tester, int index, int spots ) async {
   print( "\nDrag above BusOp" );
   await drag( tester, index, spots );
   
   expect( await checkEqs( tester, 1,       1,     offset:  5, newDepth: 1  ), true );  // screen sees ceFlut in position1. add offset to get ceFlut in gold image.
   expect( await checkEqs( tester, 2,       index, offset: -1               ), true );  // 2,6 need to look backwards in gold image
   expect( await checkEqs( tester, index+1, 11                              ), true );  // all after ceFlutter not impacted

   // Undo
   await drag( tester, index + spots, -1 * spots + 1 );
   
   return true;
}

Future<bool> validateDragAboveSoftCont( WidgetTester tester, int index, int spots ) async {
   print( "\nDrag above SoftCont" );
   await drag( tester, index, spots );
   
   expect( await checkEqs( tester, 1,       1 ), true );                              // Bus ops as usual on screen
   expect( await checkEqs( tester, 2,       2, offset: -1*spots, newDepth: 1 ), true );  // new ceFlut pos and depth
   expect( await checkEqs( tester, 3,       index, offset: -1                ), true );  // 3,6 need to look backwards in gold image
   expect( await checkEqs( tester, index+1, 11                               ), true );  // all after ceFlutter not impacted

   // Undo
   await drag( tester, index + spots, -1 * spots + 1 );
   return true;
}

Future<bool> validateDragAboveAWS( WidgetTester tester, int index, int spots ) async {
   print( "\nDrag above AWS" );
   await drag( tester, index, spots );
   
   expect( await checkEqs( tester, 1,       2 ), true );                    // No change
   expect( await checkEqs( tester, 3,       3, offset: -1*spots ), true );  // new ceFlut pos, same depth as gold
   expect( await checkEqs( tester, 4,       index, offset: -1   ), true );  // 4,6 need to look backwards in gold image
   expect( await checkEqs( tester, index+1, 11                  ), true );  // all after ceFlutter not impacted

   // Undo
   await drag( tester, index + spots, -1 * spots + 1 );
   return true;
}

Future<bool> validateDragAboveServer( WidgetTester tester, int index, int spots ) async {
   print( "\nDrag above Server" );
   await drag( tester, index, spots );
   
   expect( await checkEqs( tester, 1,       4 ), true );                    // No change
   expect( await checkEqs( tester, 5,       5, offset: -1*spots ), true );  // new ceFlut pos, same depth as gold
   expect( await checkEqs( tester, 6,       index, offset: -1   ), true );  // need to look backwards in gold image
   expect( await checkEqs( tester, index+1, 11                  ), true );  // all after ceFlutter not impacted

   // Undo
   await drag( tester, index + spots, -1 * spots + 1 );
   return true;
}
Future<bool> validateDragBelowDatSec( WidgetTester tester, int index, int spots ) async {
   print( "\nDrag below Data Sec" );
   await drag( tester, index, spots );
   
   expect( await checkEqs( tester, 1,       5                                 ), true );  // No change
   expect( await checkEqs( tester, index,   6, offset:  1                     ), true );  // need to look forwards in gold image
   expect( await checkEqs( tester, index+spots, index+spots, offset: -1*spots ), true );  // new ceFlut pos, same depth as gold
   expect( await checkEqs( tester, index+spots+1, 11                          ), true );  // all after ceFlutter not impacted

   // Undo
   await drag( tester, index + spots, -1 * spots );
   return true;
}
Future<bool> validateDragAboveCross( WidgetTester tester, int index, int spots ) async {
   print( "\nDrag above Cross" );
   await drag( tester, index, spots );
   
   expect( await checkEqs( tester, 1,       5                                                ), true );  // No change
   expect( await checkEqs( tester, index,       index+spots-1, offset:  1                    ), true );  // need to look forwards in gold image
   expect( await checkEqs( tester, index+spots, index+spots,   offset: -1*spots, newDepth: 1 ), true );  // new ceFlut pos, new depth
   expect( await checkEqs( tester, index+spots+1, 11                                         ), true );  // all after ceFlutter not impacted

   // Undo
   await drag( tester, index + spots, -1 * spots );
   return true;
}
Future<bool> validateDragAbovePre( WidgetTester tester, int index, int spots ) async {
   print( "\nDrag above Pre" );
   await drag( tester, index, spots );
   
   expect( await checkEqs( tester, 1,       5                                                ), true );  // No change
   expect( await checkEqs( tester, index,       index+spots-1, offset:  1                    ), true );  // need to look forwards in gold image
   expect( await checkEqs( tester, index+spots, index+spots,   offset: -1*spots, newDepth: 1 ), true );  // new ceFlut pos, new depth
   expect( await checkEqs( tester, index+spots+1, 11                                         ), true );  // all after ceFlutter not impacted

   // Undo
   await drag( tester, index + spots, -1 * spots );
   return true;
}
Future<bool> validateDragToBottom( WidgetTester tester, int index, int spots ) async {
   print( "\nDrag to Bottom" );
   // XXX Window-size dependent ... need something better
   await drag( tester, index, spots );
   // await drag( tester, index, spots+1 );
   
   expect( await checkEqs( tester, 1,       5                                                ), true );  // No change
   expect( await checkEqs( tester, index,       index+spots-1, offset:  1                    ), true );  // need to look forwards in gold image
   expect( await checkEqs( tester, index+spots, index+spots,   offset: -1*spots, newDepth: 1 ), true );  // new ceFlut pos, new depth

   // Undo
   await drag( tester, index + spots, -1 * spots );
   return true;
}
// XXX very specific to 1 starting index.. 
// start with startIndex, run up to index1, indent, continue til no change
Future<bool> validateDeepIndent( tester, startIndex ) async {
   print( "\nDeep indent" );
   bool changed = true; 
   while( changed ) {
      changed = false;
      for( int i = startIndex; i >= 1; i-- ) {
         List<String> eqs = await getElt( tester, "equityTable " + i.toString() );
         print( "Getting eqs for equityTable " + i.toString() + ".  Got: " + eqs.toString() );

         String oldDepth = eqs[3];
         
         Finder cat = find.byKey( Key( 'indent ' + i.toString() ));
         await tester.tap( cat );
         await tester.pumpAndSettle();

         eqs = await getElt( tester, "equityTable " + i.toString() );
         String newDepth = eqs[3];
         if( oldDepth != newDepth ) { changed = true; }
      }
   }
   if( TEST ) { await pumpSettle( tester, 2 ); } // XXX integration testing framework hiccups 

   expect( await checkEqs( tester, 1, 1,              newAmt: "1,000,000"  ), true );  
   expect( await checkEqs( tester, 2, 2, newDepth: 2, newAmt: "11,000,000" ), true );  
   expect( await checkEqs( tester, 3, 3, newDepth: 3, newAmt: "1,000,000"  ), true );  
   expect( await checkEqs( tester, 4, 4, newDepth: 4, newAmt: "1,000,000"  ), true );  
   expect( await checkEqs( tester, 5, 5, newDepth: 5, newAmt: "3,000,000"  ), true );  
   expect( await checkEqs( tester, 6, 6, newDepth: 6, newAmt: "2,000,000"  ), true );  
   expect( await checkEqs( tester, 7, 7, newDepth: 7, newAmt: "1,000,000"  ), true );  
   expect( await checkEqs( tester, 8, 8, newDepth: 8, newAmt: "3,000,000"  ), true );  
   expect( await checkEqs( tester, 9, 9              ), true );  

   return true;
}
// XXX very specific to 1 target
// unindent target as far as it goes
Future<bool> validateDeepUnindent( tester, target, startDepth ) async {
   print( "\nDeep Unindent" );

   final Finder cat = find.byKey( Key( 'unindent ' + target.toString() ));

   for( int i = startDepth-1; i >= 1; i-- ) {
      await tester.tap( cat );
      await tester.pumpAndSettle();
      if( TEST ) { await pumpSettle( tester, 1 ); } // XXX integration testing framework hiccups 
      expect( await checkEqs( tester, target, target, newDepth: i, newAmt: "3,000,000" ), true );
   }

   // make sure 2nd unallocated was renamed
   await tester.pumpAndSettle();
   List<String> eqs = await getElt( tester, "equityTable 11" );
   expect( eqs[0] != "Test Only", true );

   return true;
}
Future<bool> checkIndented( tester, bool inset ) async {
   int depthOffset = inset ? 1 : 0;
   if( TEST ) { await pumpSettle( tester, 2 );} // XXX integration testing framework hiccups
   
   expect( await checkEqs( tester, 1, 1,              newAmt: "1,000,000"  ), true );  
   expect( await checkEqs( tester, 2, 2, newDepth: 2, newAmt: "11,000,000" ), true );  
   expect( await checkEqs( tester, 3, 3, newDepth: 3, newAmt: "1,000,000"  ), true );
   
   expect( await checkEqs( tester, 4, 4, offset: 4,  newDepth: 1, newAmt: "3,000,000"  ), true );  // now unalloc.. 4 items moved
   expect( await checkEqs( tester, 5, 5, offset: 4,               newAmt: "0"          ), true );  // now cross

   expect( await checkEqs( tester, 6, 6, offset: -2, newDepth: 1 + depthOffset, newAmt: "1,000,000"  ), true );  // now GHO
   expect( await checkEqs( tester, 7, 7, offset: -2, newDepth: 2 + depthOffset, newAmt: "3,000,000"  ), true );  // now server
   expect( await checkEqs( tester, 8, 8, offset: -2, newDepth: 3 + depthOffset, newAmt: "2,000,000"  ), true );  // now flutter
   expect( await checkEqs( tester, 9, 9, offset: -2, newDepth: 4 + depthOffset, newAmt: "1,000,000"  ), true );  // now datsec

   expect( await checkEqs( tester, 10, 10 ), true );  
   expect( await checkEqs( tester, 11, 11 ), true );
   return true;
}

// Needs to be run after deep indent/unindent
Future<bool> validateDragGHOtoCross( tester ) async {
   print( "\nDrag GHO to Cross" );
   // XXX seems that when we move belove cross, need to add 1.  why?  related to XXX fudge.
   // await drag( tester, 4, 5 );
   await drag( tester, 4, 6 );

   await checkIndented( tester, false );
   return true;
}
Future<bool> validateReparentSubtree( tester ) async {
   print( "\nReparent" );
   final Finder forward = find.byKey( Key( 'indent 6' ));
   final Finder back    = find.byKey( Key( 'unindent 6' ));

   // indent once, with effect
   await tester.tap( forward );
   await tester.pumpAndSettle();
   await checkIndented( tester, true );

   // indent again, no change
   await tester.tap( forward );
   await tester.pumpAndSettle();
   await checkIndented( tester, true );

   // indent again, with effect
   await tester.tap( back );
   await tester.pumpAndSettle();
   await checkIndented( tester, false );

   // indent again, no change
   await tester.tap( back );
   await tester.pumpAndSettle();
   await checkIndented( tester, false );

   return true;
}
Future<bool> checkDragBottom( tester ) async {
   
   expect( await checkEqs( tester, 1, 1              ), true );  
   expect( await checkEqs( tester, 2, 2, newDepth: 2 ), true );  
   expect( await checkEqs( tester, 3, 3, newDepth: 3 ), true );

   expect( await checkEqs( tester, 4, 4, offset: 4, newDepth: 1  ), true ); // unalloc
   expect( await checkEqs( tester, 5, 5, offset: 4               ), true ); // cross
   expect( await checkEqs( tester, 6, 6, offset: 4               ), true );  // now pre
   expect( await checkEqs( tester, 7, 7, offset: 4               ), true );  // now unalloc 2

   expect( await checkEqs( tester, 8, 8,   offset: -4, newDepth: 1 ), true );  // now GHO
   expect( await checkEqs( tester, 9, 9,   offset: -4, newDepth: 2 ), true );  // now server
   expect( await checkEqs( tester, 10, 10, offset: -4, newDepth: 3 ), true );  // now flutter
   expect( await checkEqs( tester, 11, 11, offset: -4, newDepth: 4 ), true );  // now datsec
   return true;
}
Future<bool> checkDragTop( tester ) async {
   
   expect( await checkEqs( tester, 1, 1, offset: 3, newDepth: 1 ), true );  // now GHO
   expect( await checkEqs( tester, 2, 2, offset: 3, newDepth: 2 ), true );  // now server
   expect( await checkEqs( tester, 3, 3, offset: 3, newDepth: 3 ), true );  // now flutter
   expect( await checkEqs( tester, 4, 4, offset: 3, newDepth: 4 ), true );  // now datsec

   expect( await checkEqs( tester, 5, 5, offset: -4              ), true );  
   expect( await checkEqs( tester, 6, 6, offset: -4, newDepth: 2 ), true );  
   expect( await checkEqs( tester, 7, 7, offset: -4, newDepth: 3 ), true );

   expect( await checkEqs( tester, 8, 8,    newDepth: 1 ), true ); // unalloc
   expect( await checkEqs( tester, 9, 9,                ), true ); // cross
   expect( await checkEqs( tester, 10, 10,              ), true );  // now pre
   expect( await checkEqs( tester, 11, 11,              ), true );  // now unalloc 2

   return true;
}
Future<bool> checkDragSub( tester ) async {
   expect( await checkEqs( tester, 1, 1              ), true );  
   expect( await checkEqs( tester, 2, 2, newDepth: 2 ), true );  
   expect( await checkEqs( tester, 3, 3, newDepth: 3 ), true );
   
   expect( await checkEqs( tester, 4, 4, newDepth: 1 ), true );  // now GHO
   expect( await checkEqs( tester, 5, 5, newDepth: 2 ), true );  // now server
   expect( await checkEqs( tester, 6, 6, newDepth: 3 ), true );  // now flutter
   expect( await checkEqs( tester, 7, 7, newDepth: 4 ), true );  // now datsec

   expect( await checkEqs( tester, 8, 8, newDepth: 1 ), true );  // now unalloc
   expect( await checkEqs( tester, 9, 9                                    ), true ); // now cross
   expect( await checkEqs( tester, 10, 10                                  ), true );  
   expect( await checkEqs( tester, 11, 11                                  ), true );
   return true;
}
Future<bool> validateDragGHOExtremes( tester ) async {
   print( "\nDrag GHO to Extremes" );
   // Drag to bottom
   await drag( tester, 6, 6 );
   if( TEST ) { await pumpSettle( tester, 2 ); }// XXX integration testing framework hiccups
   await checkDragBottom( tester );
   
   // Drag to top
   await drag( tester, 8, -7 );
   if( TEST ) { await pumpSettle( tester, 2 );} // XXX integration testing framework hiccups
   await checkDragTop( tester );
   
   // Drag to other subtree (aws - shows at depth 1)
   await drag( tester, 1, 7 );
   if( TEST ) { await pumpSettle( tester, 2 );} // XXX integration testing framework hiccups
   await checkDragSub( tester );

   // Drag to within self subtree.. no op
   await drag( tester, 4, 2 );
   if( TEST ) { await pumpSettle( tester, 2 );} // XXX integration testing framework hiccups
   await checkDragSub( tester );
   
   return true;
}

Future<bool> validateEditCancel( tester ) async {
   print( "\nDrag edit cancel" );
   
   expect( await checkEqs( tester, 1, 1  ), true );  // bus ops
         
   // Cancel an edit
   final Finder cat = find.byKey( Key( 'catEditable 1' ));
   expect( cat, findsOneWidget );
   await tester.tap( cat );
   await tester.pumpAndSettle();

   final Finder cancelButton = find.byKey( Key( 'Cancel' ) );
   expect( cancelButton, findsOneWidget );
   await tester.tap( cancelButton );
   await tester.pumpAndSettle();

   // XXX
   // This check fails on driven window, probably because subsequent rebuild is
   // deleting entries.  tried to wait between the two tests, does not seem to help.  Mysterious.
   // The failure in the driven window makes this very hard to debug.  Also, applying a lock
   // here as with what happens in testing with AWS does not make sense.
   expect( await checkEqs( tester, 1, 1 ), true );  // bus ops

   // This time, edit, save
   expect( cat, findsOneWidget );
   await tester.tap( cat );
   await tester.pumpAndSettle();

   // will enter text, not amt
   final Finder editCat = find.byKey( Key( 'editRow Business Operations Flut' )); 
   expect( editCat, findsOneWidget );
   await tester.enterText( editCat, "Goblins" );
   await tester.pumpAndSettle();
   
   final Finder saveButton = find.byKey( Key( 'Save' ) );
   expect( saveButton, findsOneWidget );
   await tester.tap( saveButton );
   await tester.pumpAndSettle();

   List<String> eqs = await getElt( tester, "equityTable 1" );
   expect( eqs[0], "Goblins" );
   expect( eqs[2], "1,000,000" );
   expect( eqs[3], "1" );

   print( "Exit Drag edit cancel" );
   return true;
}



/* 
   This type of test has significant pros and cons.
   Good: test what user sees.  this may be better than good - like critical.
   Bad:  highly dependent on widget construction
   Example: we test equity line drag and etc. with fixed offset drags.
            these drags attempt to replicate what a user sees.
            As currently implemented, if window size breaks, or row spacing changes, the offsets may break as well.
   XXX We could check every drag against expectation, and add/subtract fudge until we land where expected
*/

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

         // This controls driver window size.  Driven window size is set on command line to flutter driver
         tester.binding.window.physicalSizeTestValue = const Size(1200, 1065);

         expect( await verifyAriHome( tester ), true );
         
         final Finder ariLink = find.byKey( Key( CEMD_PROJ_NAME ));
         await tester.tap( ariLink );
         await pumpSettle( tester, 2, verbose: true ); 
         await pumpSettle( tester, 2, verbose: true ); 

         expect( await equityPlanTabFraming( tester ),   true );

         // Start fresh
         expect( await rebuildEquityTable( tester ), true );
         
         // Check initial equity structure
         print( "first rebuild done." );
         expect( await checkEqs( tester, 1, 11 ), true );

         // Add, save fully tested by rebuildEqTable
         // Delete tested by rebuildEqTable

         // Check basic drags for ceFlutter
         await validateDragAboveTOT(      tester, 6, -6 );  // moving item 6 6 spots up
         await validateDragAboveBusOp(    tester, 6, -5 );  // moving item 6 5 spots up
         await validateDragAboveSoftCont( tester, 6, -4 );
         await validateDragAboveAWS(      tester, 6, -3 );
         await validateDragAboveServer(   tester, 6, -1 );
         await validateDragBelowDatSec(   tester, 6,  1 );
         await validateDragAboveCross(    tester, 6,  2 );
         await validateDragAbovePre(      tester, 6,  3 );

         // XXX This test will pass, or fail, depending on window size.
         //     currently windows are always shrinking... this will drag either to the bottom, or 1 up (incorrectly)
         //     turning it off for now - this is a real bug.
         // await validateDragToBottom(      tester, 6,  5 );

         // Check indents, unindents
         await validateDeepIndent( tester, 8 );
         await validateDeepUnindent( tester, 8, 8 );

         // Check drags, indents, unindents with heavy hierarchy
         await validateDragGHOtoCross( tester );
         await validateReparentSubtree( tester );
         await validateDragGHOExtremes( tester );
         
         // Check edit, cancel
         await validateEditCancel( tester );

         // End fresh
         expect( await rebuildEquityTable( tester ), true );
         
         await logout( tester );         

         report( 'Equity Mvmt Page' );
      });

}
     
