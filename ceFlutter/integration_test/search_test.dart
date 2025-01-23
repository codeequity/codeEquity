@Timeout(Duration(minutes: 25))

import 'dart:convert';  // json encode/decode
import 'dart:async';    // timer

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart'; // key
import 'package:fluttertoast/fluttertoast.dart';

import 'package:ceFlutter/customIcons.dart';

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

Future<void> open( WidgetTester tester ) async {
   final Finder searchLink = find.byKey( Key( "SearchBar" ));

   // Dismiss is finicky.  Depending on 'dismiss' success, tap on search link can warn that window
   // is not in forefront (basically).  Either dismiss twice, or ignore warning.
   await tester.tap( searchLink, warnIfMissed: false );
   await tester.pumpAndSettle();
}

Future<void> dismiss( WidgetTester tester ) async {
   // final Offset tapPosition = Offset(100, 100);
   // await tester.tapAt( tapPosition );

   final Finder out = find.text( "CodeEquity Projects" );

   // This is not in the forefront, so integration driver complains without the silencer
   await tester.tap( out, warnIfMissed: false );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
}

Future<bool> validateC( WidgetTester tester, Finder search ) async {
   print( "Start C" );
   await open( tester );
   await tester.enterText( search, "c" );
   await pumpSettle( tester, 3, verbose: true );    
   await pumpSettle( tester, 3, verbose: true );
   await pumpSettle( tester, 2, verbose: true );
   
   expect( find.text('ceServer'), findsOneWidget );
   expect( find.text('connieTester'), findsOneWidget );
   expect( find.text('builderCE'), findsOneWidget );
   expect( find.text('rmusick2000'), findsOneWidget );
   expect( find.text('CE_ServTest_usda23k425'), findsNWidgets(2) );
   expect( find.text('CE_AltTest_hakeld80a2'), findsNWidgets(2) );
   expect( find.text('GarlicBeer_38fl0hlsjs'), findsOneWidget );
   expect( find.text('CodeEquity_ycje7dk23f'), findsNWidgets(2) );
   expect( find.text('CE_FlutTest_ks8asdlg42'), findsNWidgets(2) );
   expect( find.text('BookShare_kd8fb.fl9s'), findsOneWidget );
   expect( find.text('AssignTest'), findsOneWidget );

   await dismiss( tester );
   return true;
}
Future<bool> validateCO( WidgetTester tester, Finder search ) async {
   print( "Start CO" );
   await open( tester );
   await tester.enterText( search, "co" );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await pumpSettle( tester, 2, verbose: true );

   expect( find.text('connieTester'), findsOneWidget );
   expect( find.text('CE_ServTest_usda23k425'), findsNWidgets(2) );
   expect( find.text('CE_AltTest_hakeld80a2'), findsNWidgets(2) );
   expect( find.text('GarlicBeer_38fl0hlsjs'), findsOneWidget );
   expect( find.text('CodeEquity_ycje7dk23f'), findsNWidgets(2) );
   expect( find.text('CE_FlutTest_ks8asdlg42'), findsNWidgets(2) );
   expect( find.text('CT Blast X'), findsOneWidget );

   await dismiss( tester );
   return true;
}

Future<bool> validateCON( WidgetTester tester, Finder search ) async {
   print( "Start CON" );
   await open( tester );
   await tester.enterText( search, "con" );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await pumpSettle( tester, 2, verbose: true );

   expect( find.text('connieTester'), findsOneWidget );
   expect( find.text('CE_ServTest_usda23k425'), findsNWidgets(2) );
   expect( find.text('GarlicBeer_38fl0hlsjs'), findsOneWidget );

   await dismiss( tester );
   return true;
}

Future<bool> validateCONT( WidgetTester tester, Finder search ) async {
   print( "Start CONT" );
   await open( tester );
   await tester.enterText( search, "cont" );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await pumpSettle( tester, 2, verbose: true );

   expect( find.text('ceServer'), findsNothing );
   expect( find.text('connieTester'), findsNothing );
   expect( find.text('builderCE'), findsNothing );
   expect( find.text('rmusick2000'), findsNothing );
   expect( find.text('CE_ServTest_usda23k425'), findsOneWidget );
   expect( find.text('CE_AltTest_hakeld80a2'), findsOneWidget );
   expect( find.text('GarlicBeer_38fl0hlsjs'), findsNothing );
   expect( find.text('CodeEquity_ycje7dk23f'), findsOneWidget );
   expect( find.text('CE_FlutTest_ks8asdlg42'), findsOneWidget );
   expect( find.text('BookShare_kd8fb.fl9s'), findsNothing );
   expect( find.text('AssignTest'), findsNothing );
   expect( find.text('CT Blast X'), findsNothing );

   await dismiss( tester );
   return true;
}


Future<bool> validateIncremental( WidgetTester tester ) async {
   print( "Validate incremental mods" );

   final Finder search = find.byKey( Key( "SearchBar" ) );
   expect( search, findsOneWidget );

   // Unfortunately, enter here clears first.  so start over each time
   expect( await validateC( tester, search ),  true );
   expect( await validateCO( tester, search ), true );
   expect( await validateCON( tester, search ), true );
   expect( await validateCONT( tester, search ), true );
   
   return true;
}

Future<bool> validateScroll( WidgetTester tester ) async {
   print( "Validate scrolling" );

   final Finder search = find.byKey( Key( "SearchBar" ) );
   expect( search, findsOneWidget );

   await open( tester );
   await tester.enterText( search, "c" );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await pumpSettle( tester, 2, verbose: true );

   expect( find.text('ceServer'), findsOneWidget );
   expect( find.text('connieTester'), findsOneWidget );
   expect( find.text('builderCE'), findsOneWidget );

   // scroll
   final sb = find.ancestor( of: find.text( "ceServer" ), matching: find.byType( ListView ));
   expect( sb, findsOneWidget );
      
   await tester.drag( sb, Offset(0.0, -1500.0) );
   print( "Done drag down" );
      
   await pumpSettle( tester, 2, verbose: true );
   
   expect( find.text('Blast 4'), findsOneWidget );
   expect( find.text('LabelTest'), findsOneWidget );
   expect( find.text('Ice skating'), findsOneWidget );

   // Not sure why, but needs two here.
   await dismiss( tester );
   await dismiss( tester );
   return true;
}


Future<bool> validateCollabConnie( WidgetTester tester ) async {

   print( "Enter connie" );
   Finder txt = find.text( 'Connie Star' );
   expect( txt, findsOneWidget );
   
   txt = find.text( 'connieTester (AHLjVaSIlH)' );
   expect( txt, findsOneWidget );
   txt = find.text( 'rmusick+connieTester@gmail.com' );
   expect( txt, findsOneWidget );
   txt = find.text( '   Agreements' );
   expect( txt, findsOneWidget );
   txt = find.text( 'Connie\'s CodeEquity Projects' );
   expect( txt, findsOneWidget );
   txt = find.text( 'connieCE (U_kgDOBLisTg)' );
   expect( txt, findsOneWidget );

   txt = find.text( 'CE_ServTest_usda23k425' );
   expect( txt, findsNWidgets(2) );
   txt = find.text( 'CE_AltTest_hakeld80a2' );
   expect( txt, findsNWidgets(2) );
   txt = find.text( 'CodeEquity_ycje7dk23f' );
   expect( txt, findsNWidgets(2) );
   txt = find.text( 'GarlicBeer_38fl0hlsjs' );
   expect( txt, findsNWidgets(2) );

   txt = find.text( 'Organization: Connie\'s Creations' );
   expect( txt, findsOneWidget );

   txt = find.text( 'CodeEquity Actual, The Real Deal' );
   expect( txt, findsOneWidget );

   Finder button = find.byKey( Key( 'Logout' ) );
   expect ( button, findsOneWidget );
   button = find.byKey( Key( 'Edit profile' ) );
   expect ( button, findsOneWidget );

   final Finder image = find.byKey( Key( "cGradImage" ));
   expect( image, findsOneWidget );
   print( "Exit connie" );

   return true;
}

Future<bool> validateProjGarlic( WidgetTester tester ) async {

   print( "Enter Garlic" );
   Finder txt = find.text( 'GarlicBeer_38fl0hlsjs' );
   expect( txt, findsOneWidget );

   txt = find.text( 'GarlicBeer Actual' );
   expect( txt, findsOneWidget );
   txt = find.text( 'The Real Deal' );
   expect( txt, findsOneWidget );
   txt = find.text( 'PEQs:' );
   expect( txt, findsOneWidget );
   txt = find.text( '    Tasked out:' );
   expect( txt, findsOneWidget );
   txt = find.text( '0%' );
   expect( txt, findsNWidgets(3) );

   txt = find.text( 'Host Platform: GitHub' );
   expect( txt, findsOneWidget );
   txt = find.text( '   GH Classic' );
   expect( txt, findsOneWidget );
   txt = find.text( '   connieCE\/GarlicBeer' );
   expect( txt, findsOneWidget );

   txt = find.text( 'Collaborators' );
   expect( txt, findsOneWidget );
   txt = find.text( 'Connie Star' );
   expect( txt, findsOneWidget );
   txt = find.text( 'Member of: 5' );
   expect( txt, findsOneWidget );
   txt = find.text( 'Most active in: ' );
   expect( txt, findsOneWidget );
   txt = find.text( 'CE_FlutTest_ks8asdlg42' );
   expect( txt, findsOneWidget );

   final Finder image = find.byKey( Key( "gGradImage" ));
   expect( image, findsOneWidget );
   print( "Exit Garlic" );

   return true;
}

Future<bool> validatePEQIce( WidgetTester tester ) async {

   print( "Enter Ice skate" );

   expect( find.byKey( Key( 'Ice skating' ) ), findsOneWidget );
   expect( find.byKey( Key( 'Snow melt' ) ),   findsOneWidget );

   print( "Exit Ice skate" );
   return true;
}

Future<bool> validateCollab( WidgetTester tester ) async {
   print( "Validate Collab" );

   final Finder search = find.byKey( Key( "SearchBar" ) );
   expect( search, findsOneWidget );

   await open( tester );
   await tester.enterText( search, "c" );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await pumpSettle( tester, 2, verbose: true );

   expect( find.text('ceServer'), findsOneWidget );
   expect( find.text('connieTester'), findsOneWidget );
   expect( find.text('builderCE'), findsOneWidget );

   await tester.tap( find.text('connieTester') );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await validateCollabConnie( tester );

   return true;
}

Future<bool> validateCEP( WidgetTester tester ) async {
   print( "Validate CEP" );

   // Start from home, otherwise multiple garlic beers
   Finder home = find.byIcon( customIcons.home );
   try {
      expect( home, findsOneWidget );
      await tester.tap( home );
      await pumpSettle( tester, 2, verbose: true );
      await pumpSettle( tester, 2, verbose: true );    
   }
   catch( e ) { print( "already home" ); }
   
   final Finder search = find.byKey( Key( "SearchBar" ) );
   expect( search, findsOneWidget );

   await open( tester );
   await tester.enterText( search, "c" );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await pumpSettle( tester, 2, verbose: true );

   expect( find.text('ceServer'), findsOneWidget );
   expect( find.text('connieTester'), findsOneWidget );
   expect( find.text('builderCE'), findsOneWidget );

   await tester.tap( find.text('GarlicBeer_38fl0hlsjs') );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await validateProjGarlic( tester );

   return true;
}

Future<bool> validatePEQ( WidgetTester tester ) async {
   print( "Validate PEQ" );

   final Finder search = find.byKey( Key( "SearchBar" ) );
   expect( search, findsOneWidget );

   await open( tester );
   await tester.enterText( search, "c" );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await pumpSettle( tester, 2, verbose: true );

   expect( find.text('ceServer'), findsOneWidget );
   expect( find.text('connieTester'), findsOneWidget );
   expect( find.text('builderCE'), findsOneWidget );

   final sb = find.ancestor( of: find.text( "ceServer" ), matching: find.byType( ListView ));
   expect( sb, findsOneWidget );
   await tester.drag( sb, Offset(0.0, -1500.0) );
   await pumpSettle( tester, 2, verbose: true );
   print( "Done drag down" );
   
   await tester.tap( find.text('Ice skating') );
   await pumpSettle( tester, 1, verbose: true );    
   await pumpSettle( tester, 1, verbose: true );
   await validatePEQIce( tester );

   return true;
}


void main() {

   IntegrationTestWidgetsFlutterBinding.ensureInitialized();

   // bool skip = true;
   bool skip = false;

   // override?  Run it.
   var override = const String.fromEnvironment('override');
   if( override == "True" ) { skip = false; }
   
   report( 'Search', group:true );

   print( "Search" );
   // testWidgets('Search bar', skip:true, (WidgetTester tester) async {
   testWidgets('Search bar', skip:skip, (WidgetTester tester) async {
         
         await restart( tester );
         await login( tester, true );

         expect( await verifyAriHome( tester ), true );
         expect( find.byIcon( Icons.search ),  findsOneWidget );  // XXX move if works

         await open( tester );
         await dismiss( tester );

         await validateIncremental( tester );
         await validateScroll( tester );
         await validateCollab( tester );
         await validateCEP( tester );
         await validatePEQ( tester );

         await logout( tester );         

         report( 'Search bar' );
      });

}
     
