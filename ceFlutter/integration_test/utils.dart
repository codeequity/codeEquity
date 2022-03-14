import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart'; // key

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
//import 'package:test/test.dart';


import 'package:ceFlutter/customIcons.dart';

import 'package:ceFlutter/main.dart';
import 'package:ceFlutter/app_state_container.dart';



const TESTER_NAME   = "rmusick2000";
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
   
   await tester.pumpAndSettle(Duration(seconds: 5));
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

   return true;
}

Future<bool> verifyOnSignupConfirmPage( WidgetTester tester ) async {
   expect( find.byKey( const Key( 'username' )),     findsOneWidget );
   expect( find.byKey( const Key( 'password')),      findsOneWidget );
   expect( find.byKey( const Key( 'email address')), findsOneWidget );
   expect( find.byKey( const Key( 'confirmation code')), findsOneWidget );

   final Finder confirmButton = find.byWidgetPredicate((widget) =>
                                                       widget is MaterialButton && widget.child is Text && ( (widget.child as Text).data?.contains( "Confirm signup, and Log in" )
                                                                                                             ?? false ));
   expect( confirmButton, findsOneWidget);

   return true;
}


Future<bool> verifyOnHomePage( WidgetTester tester ) async {
   // Top bar
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

   // testing ceproject
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

void report( descr, {group = false} ) {
   final pre  = group ? "ceFlutter Test Group: " : "Subtest: ";
   final post = group ? "" : " completed.";
   print( pre + descr + post + "\n" );
}


Future<bool> login( WidgetTester tester, known ) async {

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
   String tname = TESTER_NAME;
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
   await tester.pumpAndSettle(Duration(seconds: 2)); // for aws
   await tester.pumpAndSettle(Duration(seconds: 2));

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


/*

// darg... fluuuuuttterrrrrrr
Future<bool> isPresent( FlutterDriver driver, SerializableFinder finder, [int timeout = 900]  ) async {
   try {
      // NOTE 200 was overly eager.  500 OK?
      await driver.waitFor(finder, timeout: Duration( milliseconds: timeout ) );
      return true;
   } catch (e) {
      return false;
   }
}

/*
Future<bool> enterText( FlutterDriver driver, SerializableFinder txtField, String data ) async {
   // verify text not already in UI.. note this is overly aggressive, as it fails if data shows up in another widget.
   if( data != "" ) { expect( await isPresent( driver, find.text( data ) ), false ); }

   // acquire focus
   await driver.tap( txtField );
   // enter text
   await driver.enterText( data );
   // verify in ui
   expect( await isPresent( driver, find.text( data )), true );

   return true;
}
*/


Future<bool> verifyEditLib( FlutterDriver driver, String libName, [String newName = ""] ) async {
   expect( await isPresent( driver, find.byValueKey( 'Selected: ' + libName ), 2000), true );
   expect( await isPresent( driver, find.text( 'Editing ' + libName + ' Library' )), true );
   expect( await isPresent( driver, find.text( 'Library name: ' )), true );
   expect( await isPresent( driver, find.text( 'Description:' )), true );

   if( newName == "" ) { expect( await isPresent( driver, find.text( libName )), true ); }
   else                { expect( await isPresent( driver, find.text( newName )), true ); }
   
   expect( await isPresent( driver, find.byValueKey( 'Choose Image' )), true );
   expect( await isPresent( driver, find.byValueKey( 'Accept' )), true );
   expect( await isPresent( driver, find.byValueKey( 'Delete' )), true );
   expect( await isPresent( driver, find.byValueKey( 'Cancel' )), true );
   
   return true;
}


Future<bool> wait( FlutterDriver driver, int ms ) async {
   expect( await isPresent( driver, find.text( 'Forcing a timeout here' ), ms ), false );
   return true;
}


// Note - byValueKey requires the full title, no partials.
// ScrollUntilVisible sometimes stops when just an edge of the book is in view.
// Then when we try to tap the center, it fails.
// Alignment for SUV didn't work, so instead add a final scrollIntoView step.
Future<bool> findBook( FlutterDriver driver, SerializableFinder theList, theChoice, [dy = false] ) async {
   // go to start
   if( dy ) { await driver.scroll( theList, 0.0, 2000.0, Duration( milliseconds: 500 )); }
   else     { await driver.scroll( theList, 2000.0, 0.0, Duration( milliseconds: 500 )); }

   SerializableFinder choice;
   if( theChoice is String ) { choice = find.byValueKey( theChoice ); }
   else                      { choice = theChoice; }
   
   // Scrolls before checks visible, so help it
   bool alreadyHere = await isPresent( driver, choice );
   //print( "Finding book.. already here?: " + alreadyHere.toString() );
   if( !alreadyHere ) {
      if( dy ) { await driver.scrollUntilVisible( theList, choice, dyScroll: -200.0 ); }
      else     { await driver.scrollUntilVisible( theList, choice, dxScroll: -200.0 ); }
   }
   await driver.scrollIntoView( choice );
   
   return true;
}

Future<bool> deleteFirstBook( FlutterDriver driver, SerializableFinder theList, SerializableFinder theLib ) async {
   SerializableFinder theChoice = find.byValueKey('bookChunk0');
   expect( await deleteBook( driver, theList, theLib, theChoice ), true );
   return true;
}


Future<bool> deleteBook( FlutterDriver driver, SerializableFinder theList, SerializableFinder theLib, theChoice, [bool cancel = false] ) async {
   SerializableFinder detailList = find.byValueKey('bookDetail');
   SerializableFinder delete  = find.byValueKey('Delete');

   SerializableFinder choice;
   if( theChoice is String ) { print( "deleting " + theChoice ); choice = find.byValueKey( theChoice ); }
   else                      { print( "deleting book"); choice = theChoice; }

   expect( await isPresent( driver, theLib, 2000 ), true );
   await driver.tap( theLib );

   expect( await findBook( driver, theList, choice ), true );
   expect( await isPresent( driver, choice, 2000 ), true );
   await driver.tap( choice );
   await driver.scrollUntilVisible( detailList, delete, dyScroll: -1000.0 );

   await driver.tap( delete );
   expect( await isPresent( driver, find.byValueKey( 'confirmDelete' )), true );
   expect( await isPresent( driver, find.byValueKey( 'cancelDelete' )), true );

   if( cancel == true ) {
      await driver.tap( find.byValueKey( 'cancelDelete' ));
      await driver.tap( find.byValueKey( 'Back' ));
   }
   else {
      await driver.tap( find.byValueKey( 'confirmDelete' ));
   }
   
   expect( await verifyOnHomePage( driver ), true );
   return true;
}


Future<bool> gotoAddBook( FlutterDriver driver ) async {
   SerializableFinder addBookIcon = find.byValueKey( 'addBookIcon' );
   SerializableFinder addBookHereIcon = find.byValueKey( 'addBookHereIcon' );

   // no async ifs..
   expect( await isPresent( driver, addBookHereIcon ), false );
   expect( await isPresent( driver, addBookIcon ), true );
   await driver.tap( addBookIcon );

   expect( await isPresent( driver, addBookIcon, 2000 ), false );
   expect( await isPresent( driver, addBookHereIcon ), true );
   return true;
}

Future<bool> gotoHome( FlutterDriver driver ) async {
   SerializableFinder homeIcon = find.byValueKey( 'homeIcon' );
   SerializableFinder homeHereIcon = find.byValueKey( 'homeHereIcon' );

   expect( await isPresent( driver, homeIcon, 4000 ), true );
   expect( await isPresent( driver, homeHereIcon, 4000 ), false );

   await driver.tap( homeIcon );

   expect( await isPresent( driver, homeIcon, 4000 ), false );
   expect( await isPresent( driver, homeHereIcon ), true );

   return true;
}

// Enter this for multiple subs, so check first I'm not already here.
Future<bool> gotoMyLib( FlutterDriver driver, String sub ) async {
   SerializableFinder myLibraryIcon = find.byValueKey( 'myLibraryIcon' );
   SerializableFinder myLibraryHereIcon = find.byValueKey( 'myLibraryHereIcon' );
   SerializableFinder gridIcon  = find.byValueKey( 'gridIcon' );
   SerializableFinder listIcon  = find.byValueKey( 'listIcon' );
   SerializableFinder shareIcon = find.byValueKey( 'shareIcon' );
   SerializableFinder editIcon  = find.byValueKey( 'editIcon' );

   bool inLib = await isPresent( driver, myLibraryHereIcon, 2000 );
   if( !inLib ) {
         expect( await isPresent( driver, myLibraryIcon ), true );
         expect( await isPresent( driver, myLibraryHereIcon ), false );
         await driver.tap( myLibraryIcon );
   }

   expect( await isPresent( driver, myLibraryIcon ), false );
   expect( await isPresent( driver, myLibraryHereIcon, 4000 ), true );

   if( sub == "grid" ) {
      expect( await isPresent( driver, gridIcon ), true );
      await driver.tap( gridIcon );
   }
   else if( sub == "list" ) {
      expect( await isPresent( driver, listIcon ), true );
      await driver.tap( listIcon );
   }
   else if( sub == "share" ) {
      expect( await isPresent( driver, shareIcon ), true );
      await driver.tap( shareIcon );
   }
   else if( sub == "edit" ) {
      expect( await isPresent( driver, editIcon ), true );
      await driver.tap( editIcon );
   }
   else { return false; }
      
   return true;
}


Future<bool> refineAdd( FlutterDriver driver, titleKey, authorKey, bookChoice, closeOut, [bool checkScan = true] ) async {
   SerializableFinder refineSearch = find.byValueKey( 'Refine search' );

   print( "RefineAdd: T:" + titleKey + " A:" + authorKey );
   
   // If got here from hitting refine search in a list of books, scan button is not present.
   // Hmmmm.... same with home...
   if( checkScan ) {
      expect( await isPresent( driver, find.text( 'Scan' ), 5000 ), true );  // if coming from addbook, this can take a while.
      expect( await isPresent( driver, refineSearch ), true );
      await driver.tap( refineSearch );
   }

   // verify
   SerializableFinder title  = find.byValueKey( 'Keyword from title' );   
   SerializableFinder author = find.byValueKey( 'Author\'s last name' );
   expect( await isPresent( driver, title, 3000 ), true );
   expect( await isPresent( driver, author ), true );

   // search 
   if( titleKey != "" ) { await enterText( driver, title, titleKey );    }
   if( authorKey != "") { await enterText( driver, author, authorKey );  }
   SerializableFinder search  = find.byValueKey( 'Search' );
   expect( await isPresent( driver, search ), true );
   await driver.tap( search );

   // choose a result
   SerializableFinder theList   = find.byValueKey('searchedBooks');
   SerializableFinder theChoice = find.byValueKey('bookChunk$bookChoice');
   await findBook( driver, theList, theChoice );
   expect( await isPresent( driver, theChoice, 2000 ), true );   
   await driver.tap( theChoice );

   // Add it and go...
   SerializableFinder scanMore = find.byValueKey('Add this,\n scan more');      
   SerializableFinder goHome   = find.byValueKey('Add this,\n go to MyLib');      
   expect( await isPresent( driver, scanMore, 2000 ), true );      
   expect( await isPresent( driver, goHome ), true );      
   expect( await isPresent( driver, refineSearch ), true );      
   if( closeOut == "more" )        { await driver.tap( scanMore ); }
   else if( closeOut == "home" )   {
      await driver.tap( goHome );
      await isPresent( driver, find.byValueKey( 'homeHereIcon' ), 5000 );  // can take some time
   }
   else if( closeOut == "refine" ) { await driver.tap( refineSearch ); }
   else { return false; }

   return true;
}
*/
