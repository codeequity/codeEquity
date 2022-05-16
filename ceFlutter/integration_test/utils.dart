import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart'; // key

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
//import 'package:test/test.dart';


import 'package:ceFlutter/customIcons.dart';

import 'package:ceFlutter/main.dart';
import 'package:ceFlutter/app_state_container.dart';


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


Future<bool> restart( WidgetTester tester ) async {

   await tester.pumpWidget( AppStateContainer( child: new CEApp() ));
   await tester.pumpAndSettle();
   
   final splash = find.text( 'CodeEquity' );
   expect(splash, findsOneWidget);
   
   await pumpSettle(tester, 5);
   return true;
}

// pumpAndSettle interacts poorly with drag (and maybe others?) as of 5/2022.
// When a duration is included, the test exits early.
Future<bool> pumpSettle( WidgetTester tester, int delaySecs ) async {

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
   expect( find.byIcon( customIcons.loan ),      findsOneWidget );
   expect( find.byIcon( customIcons.profile ),   findsOneWidget );
   expect( find.byWidgetPredicate((widget) => widget is AppBar && widget.title is Text && ((widget.title as Text).data?.contains( "CodeEquity" ) ?? false )), findsOneWidget );

   // framing
   expect( find.text( 'Activity' ),             findsOneWidget );
   expect( find.text( 'Code Equity Projects' ), findsOneWidget );
   expect( find.text( 'GitHub Repositories' ),  findsOneWidget );
   expect( find.byKey(const Key( 'New' )),      findsOneWidget );
   expect( find.byKey(const Key( 'Add' )),      findsOneWidget );

   // testing ceproject - no.
   
   return true;
}

Future<bool> verifyAriHome( WidgetTester tester ) async {
   expect( await verifyOnHomePage( tester ), true );   

   //  Three CE Projects
   expect( find.byKey( const Key('ariCETester/CodeEquityTester' )), findsOneWidget );
   expect( find.byKey( const Key('ariCETester/ceTesterAlt' )), findsOneWidget );
   expect( find.byKey( const Key('connieCE/CodeEquityTester' )),    findsOneWidget );   
   
   return true;
}

Future<bool> verifyConnieHome( WidgetTester tester ) async {

   expect( await verifyOnHomePage( tester ), true );   

   // Four CE Projects
   expect( find.byKey( const Key('connieCE/CodeEquityTester' )),    findsOneWidget );
   expect( find.byKey( const Key('connieCE/GarlicBeer' )),          findsOneWidget );
   expect( find.byKey( const Key('ariCETester/ceTesterAlt' )),      findsOneWidget );
   expect( find.byKey( const Key('ariCETester/CodeEquityTester' )), findsOneWidget );
   
   return true;
}


Future<bool> verifyOnProfilePage( WidgetTester tester ) async {
   // Top bar
   expect( find.byIcon( customIcons.home ),         findsOneWidget );
   expect( find.byIcon( customIcons.loan ),         findsOneWidget );
   expect( find.byIcon( customIcons.profile_here ), findsOneWidget );
   expect( find.byWidgetPredicate((widget) => widget is AppBar && widget.title is Text && ((widget.title as Text).data?.contains( "CodeEquity" ) ?? false )), findsOneWidget );

   // framing
   expect( find.byKey(const Key( 'Logout' )),      findsOneWidget );

   return true;
}

Future<bool> verifyOnAddGHPage( WidgetTester tester ) async {
   // Top bar
   expect( find.byIcon( customIcons.home_here ), findsOneWidget );
   expect( find.byIcon( customIcons.loan ),      findsOneWidget );   // XXX rename these icons!
   expect( find.byIcon( customIcons.profile ),   findsOneWidget );
   expect( find.byWidgetPredicate((widget) => widget is AppBar && widget.title is Text && ((widget.title as Text).data?.contains( "CodeEquity" ) ?? false )), findsOneWidget );

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
   expect( find.byIcon( customIcons.home_here ), findsOneWidget );
   expect( find.byIcon( customIcons.loan ),      findsOneWidget );   // XXX rename these icons!
   expect( find.byIcon( customIcons.profile ),   findsOneWidget );
   expect( find.byWidgetPredicate((widget) => widget is AppBar && widget.title is Text && ((widget.title as Text).data?.contains( "CodeEquity" ) ?? false )), findsOneWidget );

   // framing
   expect( find.text( 'ariCETester/CodeEquityTester' ),    findsOneWidget );  
   expect( find.text( 'Approvals' ),                       findsOneWidget );  
   expect( find.text( 'PEQ Summary' ),                     findsOneWidget );  
   expect( find.text( 'Contributors' ),                    findsOneWidget );  
   expect( find.text( 'Equity Plan' ),                     findsOneWidget );  
   expect( find.text( 'Agreements' ),                      findsOneWidget );  
   
   return true;
}

void report( descr, {group = false} ) {
   final pre  = group ? "ceFlutter Test Group: " : "   Subtest: ";
   final post = group ? "" : " completed.";
   print( pre + descr + post + "\n" );
}


Future<bool> login( WidgetTester tester, known, {tester2 = false} ) async {

   await pumpSettle(tester, 2);
   expect( await verifyOnLaunchPage( tester ), true );

   final Finder loginButton = find.byKey(const Key( 'Login' ));
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
   await tester.pumpAndSettle();

   expect( await verifyOnProfilePage( tester ), true );

   final Finder logoutButton = find.byKey( const Key('Logout'));
   expect( logoutButton, findsOneWidget );
   await tester.tap( logoutButton );
   await tester.pumpAndSettle();
   
   // Verify signin page
   expect( await verifyOnLaunchPage( tester ), true );

   return true;
}


