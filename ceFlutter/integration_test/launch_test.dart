import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:fluttertoast/fluttertoast.dart';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart'; // key

import 'utils.dart';

// create account
// do 'lots of stuff'.
// logout
// login
// login( driver );
// do same 'lots of stuff'
// logout
// kill account

/*
https://api.flutter.dev/flutter/flutter_test/CommonFinders/byKey.html
https://docs.flutter.dev/testing/integration-tests
https://medium.flutterdevs.com/integration-testing-with-flutter-7381bb8b5d28
https://docs.flutter.dev/testing/integration-tests/migration
https://github.com/flutter/flutter/wiki/Running-Flutter-Driver-tests-with-Web
*/



Future<bool> signupInputTesting( WidgetTester tester ) async {
   bool retVal = true;
   final String uname = "ceTester integration";
   final String pword = "passWD123";
   final String email = "ari@codeequity.net";

   final String badPword = "passwd123";
   final String badEmail = "ari.codeequity.net";

   final Finder unameField =    find.byKey( const Key( 'username' ));
   final Finder pwordField =    find.byKey( const Key( 'password'));
   final Finder emailField =    find.byKey( const Key( 'email address'));
   final Finder confirmButton = find.byWidgetPredicate((widget) =>
                                                       widget is MaterialButton && widget.child is Text && ( (widget.child as Text).data?.contains( "Send confirmation code" )
                                                                                                             ?? false ));
   // Can count how many of these show up
   int wat = tester.widgetList<TextField>( unameField ).length;
   expect( wat, 1 );

   expect( unameField,    findsOneWidget );
   expect( pwordField,    findsOneWidget );
   expect( emailField,    findsOneWidget );
   expect( confirmButton, findsOneWidget);

   // Missing uname
   await tester.enterText( unameField, "" );
   await tester.enterText( pwordField, pword );
   await tester.enterText( emailField, email );
   await tester.pumpAndSettle();
   await tester.tap( confirmButton );
   await tester.pumpAndSettle();

   // XXX toast check
   // Did not move on
   print( "  .. check missing uname" );
   expect( await verifyOnSignupPage( tester ), true );

   // Missing pword
   await tester.enterText( unameField, uname );
   await tester.enterText( pwordField, ""    );
   await tester.enterText( emailField, email );
   await tester.pumpAndSettle();
   await tester.tap( confirmButton );
   await tester.pumpAndSettle();
   print( "  .. check missing pword" );
   expect( await verifyOnSignupPage( tester ), true );

   // Bad pword
   await tester.enterText( unameField, uname );
   await tester.enterText( pwordField, badPword );
   await tester.enterText( emailField, email );
   await tester.pumpAndSettle();
   await tester.tap( confirmButton );
   await tester.pumpAndSettle();
   print( "  .. check bad pword" );
   expect( await verifyOnSignupPage( tester ), true );


   // Missing email
   await tester.enterText( unameField, uname );
   await tester.enterText( pwordField, pword );
   await tester.enterText( emailField, "" );
   await tester.pumpAndSettle();
   await tester.tap( confirmButton );
   await tester.pumpAndSettle();
   print( "  .. check missing email" );
   expect( await verifyOnSignupPage( tester ), true );

   // Bad email
   await tester.enterText( unameField, uname );
   await tester.enterText( pwordField, pword );
   await tester.enterText( emailField, badEmail );
   await tester.pumpAndSettle();
   await tester.tap( confirmButton );
   await tester.pumpAndSettle();
   print( "  .. check bad email" );
   expect( await verifyOnSignupPage( tester ), true );

   // All good.
   await tester.enterText( unameField, uname );
   await tester.enterText( pwordField, pword );
   await tester.enterText( emailField, badEmail );
   await tester.pumpAndSettle();
   await tester.tap( confirmButton );
   await tester.pumpAndSettle();
   print( "  .. check all good" );
   expect( await verifyOnSignupConfirmPage( tester ), true );
   
   return retVal;
}


// flutter driver allowed for more natural grouping of tests.
// As of 3/2022, integration_test requires re-pumping the app with each testWidgets.
// So no saving state - notably need to keep logging in, which gets really slow due to debug authenticateUser 18s wait.
// At least, no need to recompile/reconnect within same group.
// Summaries are hamstrung as well, since 1 fail within a group kills reporting for the whole group.

// check app_state.. that'd be good..
// https://blog.gskinner.com/archives/2021/06/flutter-a-deep-dive-into-integration_test-library.html

// Note: testWidgets callbacks are async.  The args to testWidgets are set immediately, but callback definitions are not.
//       So, for example, repeated chunks of descr="x"; testWidget() wherein callback has report(descr)   fails, since descr for report is set to last value.
void main() {

   IntegrationTestWidgetsFlutterBinding.ensureInitialized();

   final bool skipLogin = true;
   
   group('ceFlutter - Launch', () {
         report( 'Launch', group:true );

         testWidgets('Login known', skip:skipLogin, (WidgetTester tester) async {
               
               await restart( tester );
               
               bool known = true;
               await login( tester, known );

               report( 'Login known' );
            });

         testWidgets('Login again on restart without logout', skip:skipLogin, (WidgetTester tester) async {
               
               await restart( tester );

               // Did not logout of previous session.  Should load directly to homepage after splash.
               expect( await verifyOnHomePage( tester ), true );
               await logout( tester );
               
               report( 'Login again on restart without logout' );
            });
         
         testWidgets( 'Login unknown', skip:skipLogin, (WidgetTester tester) async {
               
               await restart( tester );

               bool known = false;
               await login( tester, known );
               
               // Reset u/p
               final Finder userName     = find.byKey(const Key('username'));
               final Finder password     = find.byKey(const Key('password'));
               
               expect( userName,     findsOneWidget );
               expect( password,     findsOneWidget );
               
               await tester.enterText( userName, "" );
               await tester.pumpAndSettle();
               await tester.enterText( password, "" );
               await tester.pumpAndSettle(); // want to see the masked entry in passwd
               
               report( 'Login unknown' );
            });

         // XXX continue as guest

         testWidgets('Signup framing', skip:skipLogin, (WidgetTester tester) async {

               await restart( tester );
               
               final Finder cnaButton = find.byKey( const Key( 'Create New Account'));
               expect( cnaButton, findsOneWidget );

               await tester.tap( cnaButton );
               await tester.pumpAndSettle();

               expect( await verifyOnSignupPage( tester ), true );
               
               
               report( 'Signup framing' );
            });

         testWidgets('Signup parameter checks', (WidgetTester tester) async {

               await restart( tester );
               
               final Finder cnaButton = find.byKey( const Key( 'Create New Account'));
               expect( cnaButton, findsOneWidget );

               await tester.tap( cnaButton );
               await tester.pumpAndSettle();

               expect( await verifyOnSignupPage( tester ), true );

               expect( await signupInputTesting( tester ), true );
               
               report( 'Signup parameter checks' );
            });
         
      });

}
     
