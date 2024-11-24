import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart'; // key

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
//import 'package:test/test.dart';


import 'package:ceFlutter/customIcons.dart';

import 'package:ceFlutter/main.dart';
import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/app_state_container.dart';

// import 'package:http/http.dart' as http;  // XXX makeNote   

const TESTER_NAME   = "ariCETester";
const TESTER2_NAME  = "connieCE";     // READ ONLY account for these tests
const TESTER_PASSWD = "passWD123";


// https://medium.com/flutter-community/testing-flutter-ui-with-flutter-driver-c1583681e337

// https://docs.flutter.dev/cookbook/testing/widget/introduction
// https://api.flutter.dev/flutter/flutter_test/CommonFinders-class.html

// Note: null safety
//       final Finder loginButton = find.byWidgetPredicate((widget) => widget is MaterialButton && widget.child is Text && ( (widget.child as Text).data?.contains( "Login" ) ?? false ));
//       ? indicates text could be null (otherwise contains compile-fails).
//      ?? gives a default value if contains is null (else boolean compile-fails).





/*
// XXX XXX DANGER
// Integration tests are cool.  As of 11/24:
// if you drive them with: -d web-server --browser-name chrome
//    while you do get a single window (which could mean no locking, 1/2 the hits to GH and AWS), this mode does not provide
//    a stderr/stdout connection of any sort to home base.  This makes debugging, or even simple verification very challenging.
// if you drive them with: -d chrome
//    at least the driver window has i/o, so you can see most problems.
// However, in some cases, the driven window is having issues.  You only get a tiny part of the stack, errors can be async, and there is no i/o.
// Nightmare to debug.
// This function is a desperation bid, uses aws as the 'debug console'.  Use as last resort, only in function in question.
// NOTE, currently this overwrites constantly.  check log.
Future<void> makeNote( String msg ) async {
   var note = {};
   note["ceProjectId"] = "DEBUGGING";
   note["targetType"]  = "DEBUGGING";
   note["targetId"]    = msg;
   note["lastMod"]     = DateTime.now();
   note["allocations"] = [];
   String postData  = '{ "Endpoint": "PutPSum", "NewPSum": $note }';
   await updateDynamoMN( postData, "PutPSum" );
}

// XXX XXX DANGER
// Temporary support for integration testing.  No access to context/container, so required values hard-coded here.
// XXX SHOULD NOT CHECK IN with hard-coded vals present.  Check GAT.
// XXX Untested.
Future<http.Response> updateDynamoMN( postData, shortName ) async {

   final apiBasePath = "";
   final idToken     = "";
   
   final gatewayURL = Uri.parse( apiBasePath + "/find" );

   final response =
      await http.post(
         gatewayURL,
         headers: {HttpHeaders.authorizationHeader: idToken},
         body: postData
         );
   
   // No reauth.  
   if( response.statusCode != 201 ) { assert( false ); }
   
   return response;
}
*/


Future<bool> restart( WidgetTester tester ) async {

   await tester.pumpWidget( AppStateContainer( child: new CEApp(), state: new AppState() ));
   await tester.pumpAndSettle();
   
   final splash = find.text( 'CodeEquity' );
   expect(splash, findsOneWidget);
   
   await pumpSettle(tester, 5);
   return true;
}

// pumpAndSettle interacts poorly with drag (and maybe others?) as of 5/2022.
// When a duration is included, the test exits early.
Future<bool> pumpSettle( WidgetTester tester, int delaySecs, {bool verbose = false} ) async {

   if( verbose ) { print( "pumping, delay: " + delaySecs.toString() ); }
   await tester.pumpAndSettle();
   await Future.delayed(Duration(seconds: delaySecs));   
   await tester.pumpAndSettle();
   return true;
}

// The keyName is the name of the visibility node key
Future<bool> checkVisNode( WidgetTester tester, String keyName, bool visVal ) async {

   final Finder vn = find.byKey( Key( keyName ));
   expect( vn, findsOneWidget );

   final Visibility visNode = tester.widget(vn);

   expect(visNode.visible , visVal);

   return true;
}

Future<bool> verifyOnLaunchPage( WidgetTester tester ) async {
   expect( find.byKey( const Key( 'Login' )),                 findsOneWidget );
   expect( find.byKey( const Key( 'Create New Account')),     findsOneWidget );
   expect( find.byKey( const Key( 'Look around as a guest')), findsOneWidget );
   expect( find.byKey( const Key( 'Boogers' )),               findsNothing );

   final Finder loginButton = find.byWidgetPredicate((widget) => widget is MaterialButton && widget.child is Text && ( (widget.child as Text).data?.contains( "Login" ) ?? false ));
   expect( loginButton, findsOneWidget);

   // framing
   expect( find.text( 'CodeEquity' ),                findsOneWidget );
   expect( find.text( 'Simple Idea' ),               findsOneWidget );
   expect( find.textContaining('GitHub Founder' ),   findsOneWidget );
   expect( find.textContaining('create something' ), findsOneWidget );
   expect( find.byType( Image ),                     findsOneWidget );   
 
   return true;
}

Future<bool> verifyOnSignupPage( WidgetTester tester ) async {
   expect( find.byKey( const Key( 'username' )),     findsOneWidget );
   expect( find.byKey( const Key( 'password')),      findsOneWidget );
   expect( find.byKey( const Key( 'email address')), findsOneWidget );

   final Finder confirmButton = find.byWidgetPredicate((widget) =>
                                                       widget is MaterialButton && widget.child is Text && ( (widget.child as Text).data?.contains( "Send confirmation code" )
                                                                                                             ?? false ));
   expect( confirmButton, findsOneWidget);

   await checkVisNode( tester, "confirmation code visNode", false );
   await checkVisNode( tester, "confirm signup button visNode", false );
   
   return true;
}

Future<bool> verifyOnSignupConfirmPage( WidgetTester tester ) async {
   expect( find.byKey( const Key( 'username' )),     findsOneWidget );
   expect( find.byKey( const Key( 'password')),      findsOneWidget );
   expect( find.byKey( const Key( 'email address')), findsOneWidget );

   // XXX https://github.com/flutter/flutter/issues/48490   oof
   await checkVisNode( tester, "confirmation code visNode", true );
   await checkVisNode( tester, "confirm signup button visNode", true );
   
   return true;
}


Future<bool> verifyOnHomePage( WidgetTester tester ) async {
   // Top bar
   await pumpSettle( tester, 1 );
   expect( find.byIcon( customIcons.home_here ), findsOneWidget );
   expect( find.byIcon( customIcons.settings ),  findsOneWidget );
   expect( find.byIcon( customIcons.project ),   findsOneWidget );
   expect( find.byIcon( customIcons.profile ),   findsOneWidget );
   expect( find.byKey( const Key( 'CodeEquityTitle' )), findsOneWidget );

   // framing
   expect( find.text( 'Activity' ),             findsOneWidget );
   expect( find.text( 'CodeEquity Projects' ), findsOneWidget );
   // expect( find.text( 'GitHub Repositories' ),  findsOneWidget );
   expect( find.byKey(const Key( 'New' )),      findsOneWidget );
   expect( find.byKey(const Key( 'Refresh Projects' )),      findsOneWidget );

   // testing ceproject - no.
   
   return true;
}

Future<bool> verifyAriHome( WidgetTester tester ) async {
   expect( await verifyOnHomePage( tester ), true );   

   //  Four CE Projects
   expect( find.byKey( const Key('CE_FlutTest_ks8asdlg42' )), findsOneWidget );
   expect( find.byKey( const Key('CE_AltTest_hakeld80a2' )),  findsOneWidget );
   expect( find.byKey( const Key('CE_ServTest_usda23k425' )), findsOneWidget );
   expect( find.byKey( const Key('CodeEquity_ycje7dk23f' )),  findsOneWidget );   
   
   //  Five GH Repositories
   expect( find.byKey( const Key('CE_FlutTest_ks8asdlg42' )), findsOneWidget );
   expect( find.byKey( const Key('codeequity/ceTesterAri' )),      findsOneWidget );
   expect( find.byKey( const Key('codeequity/ceTesterConnie' )),   findsOneWidget );
   expect( find.byKey( const Key('codeequity/ceTesterAriAlt' )),   findsOneWidget );   
   expect( find.byKey( const Key('codeequity/codeEquity' )),       findsOneWidget );   

   return true;
}

Future<bool> verifyConnieHome( WidgetTester tester ) async {

   expect( await verifyOnHomePage( tester ), true );   

   // check four CE or future CE Projects
   expect( find.byKey( const Key('connieCE/ceTesterConnie' )),    findsOneWidget );
   expect( find.byKey( const Key('connieCE/GarlicBeer' )),        findsOneWidget );
   expect( find.byKey( const Key('codeequity/ceTesterAriAlt' )),  findsOneWidget );
   expect( find.byKey( const Key('codeequity/ceTesterAri' )),     findsOneWidget );
   
   return true;
}


Future<bool> verifyOnProfilePage( WidgetTester tester ) async {
   // Top bar
   expect( find.byIcon( customIcons.home ),         findsOneWidget );
   expect( find.byIcon( customIcons.settings ),      findsOneWidget );
   expect( find.byIcon( customIcons.project ),      findsOneWidget );
   expect( find.byIcon( customIcons.profile_here ), findsOneWidget );
   expect( find.byKey( const Key( 'CodeEquityTitle' )), findsOneWidget );

   // framing
   expect( find.byKey(const Key( 'Signout' )),      findsOneWidget );

   return true;
}

Future<bool> verifyOnAddGHPage( WidgetTester tester ) async {
   // Top bar
   expect( find.byIcon( customIcons.home_here ), findsOneWidget );
   expect( find.byIcon( customIcons.settings ),  findsOneWidget );
   expect( find.byIcon( customIcons.project ),   findsOneWidget );
   expect( find.byIcon( customIcons.profile ),   findsOneWidget );
   expect( find.byKey( const Key( 'CodeEquityTitle' )), findsOneWidget );

   // framing
   expect( find.text( 'Link CodeEquity to GitHub' ),                   findsOneWidget );  // XXX one name for Github GitHub GH
   expect( find.textContaining( 'CodeEquity will authenticate' ),      findsOneWidget );
   expect( find.byKey( const Key( 'Github Personal Access Token' )),   findsOneWidget );
   expect( find.textContaining( 'To create a Personal Access Token' ), findsOneWidget );   
   expect( find.byKey(const Key( 'Enable Github access' )),            findsOneWidget );
   
   return true;
}

Future<bool> verifyOnProjectPage( WidgetTester tester ) async {
   // Top bar
   expect( find.byIcon( customIcons.home ),      findsOneWidget );
   expect( find.byIcon( customIcons.project_here ), findsOneWidget );
   expect( find.byIcon( customIcons.settings ),  findsOneWidget );
   expect( find.byIcon( customIcons.profile ),   findsOneWidget );
   expect( find.byKey( const Key( 'CodeEquityTitle' )), findsOneWidget );

   // framing
   expect( find.text( 'CE_FlutTest_ks8asdlg42' ),          findsOneWidget );  
   expect( find.text( 'Approvals' ),                       findsOneWidget );  
   expect( find.text( 'PEQ Summary' ),                     findsOneWidget );  
   expect( find.text( 'Contributors' ),                    findsOneWidget );  
   expect( find.text( 'Equity Plan' ),                     findsOneWidget );  
   expect( find.text( 'Agreements' ),                      findsOneWidget );  
   
   return true;
}

Future<bool> verifyEmptyProjectPage( WidgetTester tester ) async {
   expect( await verifyOnProjectPage( tester ), true );

   expect( find.byKey( const Key( 'Update PEQ Summary?' )), findsOneWidget );
   
   expect( find.text( 'Category' ),               findsNothing );
   expect( find.text( 'Software Contributions' ), findsNothing );
   expect( find.text( 'Business Operations' ),    findsNothing );
   expect( find.text( 'UnClaimed' ),              findsNothing );
   expect( find.text( 'A Pre-Existing Project' ), findsNothing );
   expect( find.text( 'New ProjCol Proj' ),       findsNothing );

   expect( find.text( 'Allocation' ), findsNothing );
   expect( find.text( 'Planned' ),    findsNothing );
   expect( find.text( 'Pending' ),    findsNothing );
   expect( find.text( 'Accrued' ),    findsNothing );
   expect( find.text( 'Surplus' ),    findsNothing );
   
   return true;
}

Future<bool> equityPlanTabFraming( WidgetTester tester ) async {
   expect( await verifyOnProjectPage( tester ), true );
   final Finder tab = find.byKey( const Key('Equity Plan' ));
   await tester.tap( tab );
   await tester.pumpAndSettle();  // First pump is the swipe off to right transition step
   await tester.pumpAndSettle();

   expect( find.text( 'Category' ), findsOneWidget );
   expect( find.text( 'Allocation' ), findsOneWidget );
   expect( find.byKey( const Key( 'add_icon_equity' )), findsOneWidget );   

   return true;
}

bool isPresent( Finder f ) {
   try {
      expect( f, findsOneWidget );
      return true;
   }
   catch(e) {
      return false;
   }
}

// Account for pact reordering.  Return the key that was found.
// XXX This will end up double-counting a pact here and there.
//     For example, if should be: confirm add,    confirm relo, confirm change, confirm change
//                        but is: confirm change, confirm add,  confirm relo,   confirm change
//     check for add looks in pos 0, 1 (good), check for relo looks in 1,2 (good), check for first change looks in 2,3 (found wrong one), check change2 looks in 3 (same one)
Future<String> checkNTap( WidgetTester tester, String keyName, {callCount = 0} ) async {
   print( "CheckNTap " + keyName + " " + callCount.toString() );
   final Finder tapper = find.byKey( Key( keyName ));

   if( tester.widgetList<Widget>(tapper).length > 0 ) {
      expect( tapper, findsOneWidget );
      await tester.tap( tapper );
      await pumpSettle( tester, 4 );
      await pumpSettle( tester, 1 );
      return keyName;
   }
   else {
      // parse key, call checkNTap
      List<String> keyParts = keyName.split(' ');
      int pactCount = int.parse( keyParts[0] );
      assert( pactCount >= 0 );
      
      callCount++;
      if     ( callCount == 1 ) { pactCount = pactCount + 1; }
      else if( callCount == 2 ) { pactCount = pactCount - 2; }
      else                      { print( "CheckNTap " + keyName + " " + callCount.toString() ); assert( false ); }

      keyParts[0] = pactCount.toString();
      keyName = keyParts.join( ' ' );
      return await checkNTap( tester, keyName, callCount: callCount );
   }
}

// XXX out of date reason
// Currently flutter integration_test for web can not make use of browser back button, or refresh button.
// Implement this with nav bar, for now.  If used popScope instead, would not help forward button.
// XXX If more than, say, 3 of these bandages are needed, go to popScope.
Future<bool> backToSummary( WidgetTester tester ) async {

   String ceProj = "CE_FlutTest_ks8asdlg42";

   final Finder homeButton     = find.byKey( const Key( 'homeIcon' ) );
   if( isPresent( homeButton )) {
      await tester.tap( homeButton );
      await pumpSettle( tester, 1 );
   }

   // XXX Does this belong here?
   expect( await verifyAriHome( tester ), true );
   final Finder ariLink = find.byKey( Key( ceProj ));   

   await tester.tap( ariLink );
   await pumpSettle( tester, 2 );

   return true;
}


void report( descr, {group = false} ) {
   final pre  = group ? "ceFlutter Test Group: " : "   Subtest: ";
   final post = group ? "" : " completed.";
   print( pre + descr + post + "\n" );
}


Future<bool> login( WidgetTester tester, known, {tester2 = false} ) async {

   print( "IN LOGIN" );
   await pumpSettle(tester, 2);
   print( "AFTER PUMP" );
   expect( await verifyOnLaunchPage( tester ), true );

   final Finder loginButton = find.byKey(const Key( 'Login' ));

   // Wait for a bit, slow sometimes
   // if( tester.widgetList<Row>( generatedAllocRow ).length > 0 ) {
   await pumpSettle(tester, 1);
   
   expect( loginButton, findsOneWidget);

   // Jump to login page
   await tester.tap( loginButton );
   await tester.pumpAndSettle();

   final Finder userName     = find.byKey(const Key('username'));
   final Finder password     = find.byKey(const Key('password'));
   final Finder login2Button = find.byKey(const Key('Login' ));

   expect( userName,     findsOneWidget );
   expect( password,     findsOneWidget );
   expect( login2Button, findsOneWidget );
   
   // Enter u/p and attempt to login
   String tname = tester2 ? TESTER2_NAME : TESTER_NAME;
   tname += known ? "" : "1234321";
   await tester.enterText( userName, tname );
   await tester.pumpAndSettle();
   await tester.enterText( password, TESTER_PASSWD );
   await tester.pumpAndSettle(); // want to see the masked entry in passwd
   
   // Login, jump to homepage
   await tester.tap( login2Button );
   print( "first pump" );
   await tester.pumpAndSettle(); // for auth
   print( "second pump" );
   await tester.pumpAndSettle(); // for .. toast?
   print( "third pump" );
   await pumpSettle(tester, 5); // for aws
   await pumpSettle(tester, 2);
   await pumpSettle(tester, 1); // Ugggg debug cognito is soooooo slow

   // XXX Verify toast 'user not found' ?  Shows up faster.. but toasting is probably changing.
   // verify topbar icons
   if( known ) { expect( await verifyOnHomePage( tester ), true );  }
   else {
      expect( find.byIcon( customIcons.home_here ), findsNothing );
      
      expect( userName,     findsOneWidget );
      expect( password,     findsOneWidget );
      expect( login2Button, findsOneWidget );
   }

   
   return true;
}

Future<bool> logout( WidgetTester tester ) async {

   // Go to profile page
   final Finder profilePage = find.byIcon( customIcons.profile );
   expect( profilePage,   findsOneWidget );
   await tester.tap( profilePage );
   await pumpSettle( tester, 2 );

   expect( await verifyOnProfilePage( tester ), true );

   final Finder logoutButton = find.byKey( const Key('Signout'));
   expect( logoutButton, findsOneWidget );
   await tester.tap( logoutButton );
   await tester.pumpAndSettle();
   
   // Verify signin page
   expect( await verifyOnLaunchPage( tester ), true );

   return true;
}


