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
   bool closed = false;

   // Clear text first, if available
   final Finder close = find.byIcon( Icons.close );
   try{
      await tester.tap( close );
      await tester.pumpAndSettle();
      await tester.pumpAndSettle();
      closed = true;
   }
   catch( e ) { print( "No close icon available" ); }

   // One of these should be visible.  All will be in the background, so silence warning.
   try{ 
      final Finder out = find.text( "CodeEquity Ventures" );
      await tester.tap( out, warnIfMissed: false );
      closed = true;
   }
   catch( e ) {}
   try{ 
      final Finder out = find.text( "New" );
      await tester.tap( out, warnIfMissed: false );
      closed = true;
   }
   catch( e ) {}
   try{ 
      final Finder out = find.text( CEMD_VENT_NAME );
      await tester.tap( out, warnIfMissed: false );
      closed = true;
   }
   catch( e ) {}

   print( "Managed to close: " + closed.toString() );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
}

Future<bool> validateC( WidgetTester tester, Finder search ) async {
   print( "Start C" );
   await open( tester );
   await tester.enterText( search, "c" );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   /*
     await pumpSettle( tester, 2, verbose: true );    
     await pumpSettle( tester, 2, verbose: true );
     await pumpSettle( tester, 2, verbose: true );
   */
   
   expect( find.text('builderCE'), findsOneWidget );
   expect( find.text('ceServer'), findsOneWidget );
   expect( find.text('connieTester'), findsOneWidget );
   expect( find.text('rmusick2000'), findsOneWidget );
   expect( find.text(BS_VENT_ID), findsOneWidget );
   expect( find.text(CEAL_VENT_ID), findsNWidgets(1) );
   expect( find.text(CEMD_VENT_ID), findsNWidgets(1) );
   expect( find.text(CESE_VENT_ID), findsNWidgets(1) );
   // Don't get here with detail
   // expect( find.text(GB_PROJ_ID), findsOneWidget );
   // expect( find.text(CE_PROJ_ID), findsNWidgets(1) );

   await dismiss( tester );
   return true;
}

Future<bool> appeaseScreenlock( WidgetTester tester, Finder search ) async {
   print( "\nStart appeasement" );

   await open( tester );
   await tester.enterText( search, "ZZZZZ" );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await pumpSettle( tester, 2, verbose: true );
   
   try{ expect( find.text('ceServer'), findsOneWidget ); } catch(e) { print( "yup" ); }

   await dismiss( tester );
   print( "End appeasement\n" );
   return true;
}

Future<bool> validateCO( WidgetTester tester, Finder search ) async {
   print( "Start CO" );
   await open( tester );
   await tester.enterText( search, "co" );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   // sometimes integration test gets 1, sometimes 2.. never 2 on screen
   // if findsatleast 1, then all were found given screen length limits
   expect( find.text('connieTester'), findsAtLeast(1) );  
   expect( find.text(BS_PROJ_ID), findsOneWidget );
   expect( find.text(CEAL_PROJ_ID), findsNWidgets(1) );
   expect( find.text(CEMD_PROJ_ID), findsNWidgets(1) );
   expect( find.text(CESE_PROJ_ID), findsNWidgets(1) );
   expect( find.text(CE_VENT_ID), findsAtLeast(1) );
   expect( find.text(GB_VENT_ID), findsAtLeast(1) );
   // expect( find.text('CT Blast X'), findsAtLeast(1) );

   await dismiss( tester );
   return true;
}

Future<bool> validateCON( WidgetTester tester, Finder search ) async {
   print( "Start CON" );
   await open( tester );
   await tester.enterText( search, "con" );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( find.text('connieTester'), findsAtLeast(1) );
   expect( find.text(CEMD_PROJ_ID), findsAtLeast(1) );
   expect( find.text(GB_PROJ_ID), findsAtLeast(1) );

   await dismiss( tester );
   return true;
}

Future<bool> validateCONT( WidgetTester tester, Finder search ) async {
   print( "Start CONT" );
   await open( tester );
   await tester.enterText( search, "cont" );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( find.text('ceServer'), findsNothing );
   expect( find.text('connieTester'), findsNothing );
   expect( find.text('builderCE'), findsNothing );
   expect( find.text('rmusick2000'), findsNothing );
   expect( find.text(CESE_PROJ_NAME), findsOneWidget );
   expect( find.text(CEAL_PROJ_NAME), findsOneWidget );
   expect( find.text(GB_PROJ_ID), findsNothing );
   expect( find.text(CE_PROJ_NAME), findsNWidgets(3) );
   expect( find.text(CEMD_PROJ_NAME), findsOneWidget );
   expect( find.text(BS_PROJ_ID), findsNothing );
   expect( find.text('AssignTest'), findsNothing );
   expect( find.text('CT Blast X'), findsNothing );

   await dismiss( tester );
   return true;
}


// NOTE: first test here is going upstream to aws.  The rest are cached.  Changes settle time requirements.
Future<bool> validateIncremental( WidgetTester tester ) async {
   print( "Validate incremental mods" );

   final Finder search = find.byKey( Key( "SearchBar" ) );
   expect( search, findsOneWidget );

   // Unfortunately, enter here clears first.  so start over each time
   expect( await appeaseScreenlock( tester, search ),  true );
   expect( await validateC( tester, search ),  true );
   expect( await validateCO( tester, search ), true );
   expect( await validateCON( tester, search ), true );
   // needed to eliminate copy in mem
   expect( await appeaseScreenlock( tester, search ),  true );
   expect( await validateCONT( tester, search ), true );
   
   return true;
}

// Sensitive to item count.. change testing content?  expect this to fail.
Future<bool> validateScroll( WidgetTester tester ) async {
   print( "Validate scrolling" );

   final Finder search = find.byKey( Key( "SearchBar" ) );
   expect( search, findsOneWidget );

   await open( tester );
   await tester.enterText( search, "c" );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( find.text('ceServer'), findsOneWidget );
   expect( find.text('connieTester'), findsOneWidget );
   expect( find.text('builderCE'), findsOneWidget );

   // scroll
   final sb = find.ancestor( of: find.text( "ceServer" ), matching: find.byType( ListView ));
   expect( sb, findsOneWidget );
      
   await tester.drag( sb, Offset(0.0, -1500.0) );
   await tester.drag( sb, Offset(0.0, -1000.0) );
   await tester.drag( sb, Offset(0.0, -1000.0) );
   print( "Done drag down" );
      
   await pumpSettle( tester, 2, verbose: true );

   expect( find.text('LabelTest Dubs'), findsOneWidget );
   expect( find.text('LM Pending'), findsOneWidget );
   expect( find.text('Snow melt'), findsOneWidget );

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

   txt = find.text( CESE_PROJ_NAME );
   expect( txt, findsNWidgets(2) );
   txt = find.text( CEAL_PROJ_NAME );
   expect( txt, findsNWidgets(2) );
   txt = find.text( CE_PROJ_NAME );
   expect( txt, findsAtLeast(3) );
   txt = find.text( GB_PROJ_NAME );
   expect( txt, findsNWidgets(2) );

   // txt = find.text( 'Venture: Connie\'s Creations' );
   txt = find.text( 'Connie\'s Creations' );
   expect( txt, findsOneWidget );

   txt = find.text( 'Code for Equity' );
   expect( txt, findsOneWidget );

   Finder button = find.byKey( Key( 'Logout' ) );
   expect ( button, findsNothing );
   button = find.byKey( Key( 'Edit profile' ) );
   expect ( button, findsNothing );

   final Finder image = find.byKey( Key( "cGradImage" ));
   expect( image, findsOneWidget );
   print( "Exit connie" );

   return true;
}

Future<bool> validateProjGarlic( WidgetTester tester ) async {

   print( "Enter Garlic" );
   Finder txt = find.text( 'Id: GarlicBeer_38fl0hlsjs' );
   expect( txt, findsOneWidget );

   txt = find.text( 'The Home of Garlic Beer' );
   expect( txt, findsOneWidget );
   txt = find.text( 'Venture Equity Plan PEQs:' );
   expect( txt, findsOneWidget );
   txt = find.text( '    Tasked out:' );
   expect( txt, findsOneWidget );
   txt = find.text( '0%' );
   expect( txt, findsNWidgets(3) );

   txt = find.text( 'Host Platform: GitHub' );
   expect( txt, findsOneWidget );
   txt = find.text( '   GH Classic' );
   expect( txt, findsOneWidget );
   txt = find.text( '   connieCE\/GarlicBeer (R_kgDOFusK9Q)' );
   expect( txt, findsOneWidget );

   txt = find.text( 'Collaborators' );
   expect( txt, findsOneWidget );
   txt = find.text( 'Connie Star' );
   expect( txt, findsOneWidget );
   txt = find.text( 'Member of: 5' );
   expect( txt, findsOneWidget );
   txt = find.text( 'Most active in: ' );
   expect( txt, findsOneWidget );
   txt = find.text( CEMD_PROJ_NAME );
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

   expect( await appeaseScreenlock( tester, search ),  true );
   
   await open( tester );
   await tester.enterText( search, "c" );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

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
      await tester.tap( home, warnIfMissed: false );
      await pumpSettle( tester, 2, verbose: true );
      await pumpSettle( tester, 2, verbose: true );    
   }
   catch( e ) { print( "already home" ); }
   // First attempt can miss.  sigh.
   try {
      expect( home, findsOneWidget );
      await tester.tap( home, warnIfMissed: false );
      await pumpSettle( tester, 2, verbose: true );
      await pumpSettle( tester, 2, verbose: true );    
   }
   catch( e ) { print( "already home" ); }
   
   final Finder search = find.byKey( Key( "SearchBar" ) );
   expect( search, findsOneWidget );

   expect( await appeaseScreenlock( tester, search ),  true );         
   
   await open( tester );
   await tester.enterText( search, "gar" );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

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

   expect( await appeaseScreenlock( tester, search ),  true );         
   
   await open( tester );
   await tester.enterText( search, "Ice" );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await pumpSettle( tester, 2, verbose: true );

   await tester.tap( find.text('Ice skating') );
   await pumpSettle( tester, 1, verbose: true );    
   await pumpSettle( tester, 1, verbose: true );
   await validatePEQIce( tester );

   return true;
}


// NOTE: searchAnchor does not play nicely with integration_test.
//       3 modes to satisfy: 1) actual human usage 2) cronjob by hand 3) cronjob during screenlock
//       Without appeaseScreenlock, screenlock cron fails with 2 ceServer widgets showing early.. by hand cron is fine
//       With just finding "c" 2x in a row in appease, screenlock is fine, but by hand cron job fails finding 0
//       could probably get rid of appease by making sure search term is always different..  hmmm... nope...
void main() {

   IntegrationTestWidgetsFlutterBinding.ensureInitialized();

   // This runs once before all tests
   setUpAll(() async {
         // Global setup actions (e.g., initializing a database connection)
         print('Starting integration tests...');
      });
   
   // This runs once after all tests are finished
   tearDownAll(() async {
         // Global cleanup actions (e.g., closing database connections, logging)
         print('All integration tests completed. Performing cleanup...');

         // web app.. no can do
         // Flutter 3.38+ integration testing for web is no longer killing the app.  Force kill.
         // await killall( "search" );
      });


   
   // bool skip = true;
   bool skip = false;

   // override?  Run it.
   var override = const String.fromEnvironment('override');
   if( override == "True" ) { skip = false; }
   
   report( 'Search', group:true );
   
   print( "Search" );
   // testWidgets('Search bar', skip:true, (WidgetTester tester) async {
   testWidgets('Search bar', skip:skip, (WidgetTester tester) async {
         
         // This controls driver window size.  Driven window size is set on command line to flutter driver
         // tester.binding.window.physicalSizeTestValue = const Size(1200, 1050);
         // tester.binding.window.physicalSizeTestValue = const Size(1400, 1050);
         // Hmm.. seems to control window size inside physical window..?
         // tester.binding.window.physicalSizeTestValue = const Size(800, 1050);
         tester.binding.window.physicalSizeTestValue = const Size(1000, 1050);

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
     
