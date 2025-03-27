@Timeout(Duration(minutes: 25))

import 'dart:convert';  // json encode/decode
import 'dart:async';    // timer

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart'; // key
import 'package:fluttertoast/fluttertoast.dart';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:ceFlutter/customIcons.dart';
import 'utils.dart';


Future<bool> goHome(  WidgetTester tester ) async {

   final Finder home = find.byIcon( customIcons.home_here );
   try { expect( home, findsOneWidget ); }
   catch (e) {
      final Finder goHome = find.byIcon( customIcons.home );
      expect( goHome, findsOneWidget );
      await tester.tap( goHome );
      await pumpSettle( tester, 2, verbose: true );
      await pumpSettle( tester, 2, verbose: true );    
   }
   return true;
}

// go home first, might be in proj profile
Future<bool> goAri(  WidgetTester tester ) async {
   await goHome( tester );

   expect( find.byIcon( customIcons.profile ),  findsOneWidget );
   await tester.tap( find.byIcon( customIcons.profile ));
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await pumpSettle( tester, 2, verbose: true );
   
   Finder txt = find.text( 'Ari Star' );
   expect( txt, findsOneWidget );
   return true;
}



Future<bool> validateAriPeqs(  WidgetTester tester ) async {
   print( "Enter ariPeqs" );

   // Flut Peqs
   final Finder flutPeqs = find.byKey( Key( "ppCEP"+CEMD_PROJ_NAME ));

   expect( flutPeqs, findsOneWidget );
   await tester.tap( flutPeqs );
   await pumpSettle( tester, 1, verbose: true );
   await pumpSettle( tester, 1, verbose: true );
   expect( find.text( 'CE Project' ), findsOneWidget );
   expect( find.text( '6,124' ), findsOneWidget );
   expect( find.text( '802' ), findsOneWidget );
   expect( find.text( '6,500' ), findsOneWidget );
   expect( find.text( '0' ), findsOneWidget );

   expect( find.byKey( Key( 'Clear' )), findsOneWidget );

   // 2nd press no matter
   await tester.tap( flutPeqs );
   await pumpSettle( tester, 1, verbose: true );
   await pumpSettle( tester, 1, verbose: true );
   expect( find.text( '6,124' ), findsOneWidget );

   // Clear matters
   await tester.tap( find.byKey( Key( 'Clear' ))); 
   await pumpSettle( tester, 1, verbose: true );
   await pumpSettle( tester, 1, verbose: true );
   expect( find.text( '6,124' ), findsNothing );

   // Add serveTest
   await tester.tap( find.byKey( Key( "ppCEP"+CESE_PROJ_NAME )) );
   await pumpSettle( tester, 1, verbose: true );
   await pumpSettle( tester, 1, verbose: true );
   expect( find.text( '0' ), findsNWidgets(4) );

   // Add altTest
   await tester.tap( find.byKey( Key( "ppCEP"+CEAL_PROJ_NAME)) );
   await pumpSettle( tester, 1, verbose: true );
   await pumpSettle( tester, 1, verbose: true );
   expect( find.text( '0' ), findsNWidgets(8) );

   await tester.tap( flutPeqs );
   await pumpSettle( tester, 1, verbose: true );
   await pumpSettle( tester, 1, verbose: true );
   expect( find.text( '6,124' ), findsOneWidget );
   expect( find.text( '0' ), findsNWidgets(9) );
   
   await tester.tap( find.byKey( Key( 'Clear' ))); 
   await pumpSettle( tester, 1, verbose: true );
   await pumpSettle( tester, 1, verbose: true );
   print( "Exit ariPeqs" );

   return true;
}

Future<bool> validateAriProfile( WidgetTester tester ) async {

   await goAri( tester );
   
   expect( find.text( 'ariTester (eaeIqcqqdp)' ),           findsOneWidget );
   expect( find.text( 'rmusick+ariTester@gmail.com' ),      findsOneWidget );
   expect( find.text( '   Agreements' ),                    findsOneWidget );
   expect( find.text( 'Ari\'s CodeEquity Projects' ),       findsOneWidget );
   expect( find.text( 'ariCETester (U_kgDOBP2eEw)' ),       findsOneWidget );
   expect( find.text( 'Code for Equity' ),                  findsOneWidget );
   expect( find.text( 'PEQ summary per project:' ),         findsOneWidget );
   
   expect( find.text( CEMD_PROJ_NAME ), findsNWidgets(2) );
   expect( find.text( CEAL_PROJ_NAME ), findsNWidgets(2) );
   expect( find.text( CESE_PROJ_NAME ),  findsNWidgets(2) );
   expect( find.text( CE_PROJ_NAME ),  findsAtLeast(2) );

   expect( find.text( "Venture: " + CEMD_VENT_NAME ), findsNWidgets(1) );
   expect( find.text( "Venture: " + CEAL_VENT_NAME ), findsNWidgets(1) );
   expect( find.text( "Venture: " + CESE_VENT_NAME ),  findsNWidgets(1) );
   expect( find.text( "Venture: " + CE_VENT_NAME ),  findsNWidgets(1) );

   expect( find.text( "Internal testing: Front end" ), findsOneWidget );
   expect( find.text( "Internal testing: server" ), findsNWidgets(2) );
   expect( find.text( "Code for Equity" ), findsOneWidget );
   
   expect( find.byKey( Key( 'Logout' )),          findsOneWidget );
   expect( find.byKey( Key( 'Edit profile' )),    findsOneWidget );
   expect( find.byKey( Key( "eaeIqcqqdpImage" )), findsOneWidget );

   expect( await validateAriPeqs( tester ), true );
   print( "Exit ari" );

   return true;
}


Future<bool> validateFlutProfile( WidgetTester tester ) async {
   print( "Enter Flut" );

   await goAri( tester );
   
   // go Flut
   expect( find.byKey( Key( CEMD_PROJ_NAME )), findsOneWidget );
   await tester.tap( find.byKey( Key( CEMD_PROJ_NAME )) );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await pumpSettle( tester, 2, verbose: true );

   expect( find.text( 'Collaborators' ),             findsOneWidget );
   expect( find.text( 'Ari Star' ),                  findsOneWidget );
   expect( find.text( 'Connie Star' ),               findsOneWidget );
   expect( find.text( 'connieTester (AHLjVaSIlH)' ), findsOneWidget );
   expect( find.text( 'Member of: 4' ),              findsOneWidget );
   expect( find.text( 'Most active in: ' ),          findsNWidgets(2) );
   expect( find.text( CEMD_PROJ_NAME ),              findsNWidgets(3) );

   expect( find.text( 'Internal testing: Front end' ), findsOneWidget );

   expect( find.text( 'Venture: ' + CEMD_VENT_NAME), findsOneWidget );
   expect( find.text( 'Venture Equity Plan PEQs:' ), findsOneWidget );
   expect( find.text( '    Accrued:' ),             findsOneWidget );
   expect( find.text( '0.05%' ),                    findsOneWidget );
   expect( find.text( '0.12%' ),                    findsOneWidget );
   expect( find.text( '99.83%' ),                   findsOneWidget );
   expect( find.text( '15,000,000' ),               findsOneWidget );

   expect( find.text( 'Host Platform: GitHub' ),          findsOneWidget );
   expect( find.text( '   GH Version 2' ),                findsOneWidget );
   expect( find.text( '   codeequity\/ceFlutterTester' ), findsOneWidget );

   // edit profile
   expect( find.byKey( Key( 'Edit profile' )),    findsOneWidget );
   await tester.tap(  find.byKey( Key( 'Edit profile' )) );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   expect( find.text( "Select new profile image" ), findsOneWidget );
   expect( find.byKey( Key( 'Dismiss' )), findsOneWidget );
   expect( find.byKey( Key( 'thumb'+'images\/bGrad.jpg' )), findsOneWidget );
   expect( find.byKey( Key( 'thumb'+'images\/kGrad.jpg' )), findsOneWidget );
   expect( find.byKey( Key( 'Update Profile' )), findsNothing );

   // pick one, but dismiss
   await tester.tap( find.byKey( Key('thumb'+'images\/kGrad.jpg')) ); 
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   expect( find.byKey( Key( 'Dismiss' )),        findsOneWidget );
   expect( find.byKey( Key( 'Update Profile' )), findsOneWidget );
   expect( find.byIcon( Icons.check ),           findsOneWidget );

   await tester.tap( find.byKey( Key( 'Dismiss' )) );
   await pumpSettle( tester, 1, verbose: true );    
   await pumpSettle( tester, 1, verbose: true );
   expect( find.text( 'Internal testing: Front end' ), findsOneWidget );
   
   print( "Exit flut" );
   return true;
}

Future<bool> validateCardSwap( WidgetTester tester ) async {
   print( "Enter cardSwap" );

   await goAri( tester );

   // goFlut, validate minors
   expect( find.byKey( Key( CEMD_PROJ_NAME )), findsOneWidget );
   await tester.tap( find.byKey( Key( CEMD_PROJ_NAME )) );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await pumpSettle( tester, 2, verbose: true );
   expect( find.text( 'Collaborators' ),             findsOneWidget );
   expect( find.text( 'Ari Star' ),                  findsOneWidget );
   expect( find.text( 'Connie Star' ),               findsOneWidget );

   // goAri, validate minors
   expect( find.byKey( Key( 'Ari Star' )), findsOneWidget );
   await tester.tap( find.byKey( Key( 'Ari Star' )) );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await pumpSettle( tester, 2, verbose: true );
   expect( find.text( 'ariTester (eaeIqcqqdp)' ),           findsOneWidget );
   expect( find.text( 'rmusick+ariTester@gmail.com' ),      findsOneWidget );

   // goServ, val
   expect( find.byKey( Key( CESE_PROJ_NAME )), findsOneWidget );
   await tester.tap( find.byKey( Key( CESE_PROJ_NAME )) );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await pumpSettle( tester, 2, verbose: true );
   expect( find.text( 'Ari Star' ),                  findsOneWidget );
   expect( find.text( 'Marion Star' ),               findsOneWidget );

   // goConnie, val
   expect( find.byKey( Key( 'Connie Star' )), findsOneWidget );
   await tester.tap( find.byKey( Key( 'Connie Star' )) );
   await pumpSettle( tester, 2, verbose: true );    
   await pumpSettle( tester, 2, verbose: true );
   await pumpSettle( tester, 2, verbose: true );
   expect( find.byKey( Key( GB_PROJ_NAME )), findsOneWidget );
   
   print( "Exit cardSwap" );
   return true;
}


void main() {

   IntegrationTestWidgetsFlutterBinding.ensureInitialized();

   // bool skip = true;
   bool skip = false;

   // override?  Run it.
   var override = const String.fromEnvironment('override');
   if( override == "True" ) { skip = false; }
   
   report( 'Profile', group:true );

   print( "Profile" );
   // testWidgets('Profile', skip:true, (WidgetTester tester) async {
   testWidgets('Profile', skip:skip, (WidgetTester tester) async {
         
         tester.binding.window.physicalSizeTestValue = const Size(1000, 1050);

         await restart( tester );
         await login( tester, true );

         expect( await verifyAriHome( tester ), true );
         expect( find.byIcon( customIcons.profile ),  findsOneWidget );
         
         await validateAriProfile( tester );
         await validateFlutProfile( tester );
         await validateCardSwap( tester );
         
         await logout( tester );         

         report( 'Profile' );
      });

}
     
