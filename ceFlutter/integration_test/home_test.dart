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





Future<bool> addGHProject( WidgetTester tester ) async {

   expect( await verifyOnHomePage( tester ), true );

   final Finder addGHPButton = find.byKey(const Key( 'New' ));
   await tester.tap( addGHPButton );
   await tester.pumpAndSettle( Duration( seconds:1 ));

   // XXX Not yet implemented
   expect( await verifyOnHomePage( tester ), true );

   return true;
}

Future<bool> addRepo( WidgetTester tester ) async {

   expect( await verifyOnHomePage( tester ), true );

   final Finder addGHRButton = find.byKey(const Key( 'Add' ));
   await tester.tap( addGHRButton );
   await tester.pumpAndSettle( Duration( seconds:1 ));

   expect( await verifyOnAddGHPage( tester ), true );

   // Gibberish entry
   final Finder gpatText     = find.byKey( const Key( 'Github Personal Access Token' ));
   final Finder enableButton = find.byKey( const Key( 'Enable Github access' ));
   await tester.enterText( gpatText, "boogy woogy" );
   await tester.pumpAndSettle( Duration( seconds:1 ));
   await tester.tap( enableButton );
   await tester.pumpAndSettle( Duration( seconds:1 ));
   expect( await verifyOnHomePage( tester ), true );

   // XXX Actual entry
   // XXX testerName should be ariCETester, not rm2k.
   // XXX use ghAriPat  ...  check it in?  probably ok.
   // XXX testing should have actual associate here, then disassociation.
   // XXX Not yet implemented
   
   return true;
}



// Note: Callback environments are established late.  The args to testWidgets are set , but callback definitions are not.
//       So, for example, repeated chunks of descr="x"; testWidget() wherein callback has report(descr)   fails, since descr for report is set to last value.
void main() {

   // final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized() as IntegrationTestWidgetsFlutterBinding;
   IntegrationTestWidgetsFlutterBinding.ensureInitialized();

   bool skip = true;

   // override?  Run it.
   var override = const String.fromEnvironment('override');
   if( override == "True" ) { skip = false; }
   
   report( 'Home', group:true );
   
   testWidgets('Homepage Basics', skip:skip, (WidgetTester tester) async {
         
         await restart( tester );
         
         bool known = true;
         await login( tester, known );

         expect( await addGHProject( tester ), true );
         expect( await addRepo( tester ), true );

         expect( await verifyOnHomePage( tester ), true );
         await logout( tester );         

         report( 'Homepage Basics' );
      });


   // Check that GHAccounts match what should show up for different testers when login/logout/login/relogin
   testWidgets('Homepage GHAccount Consistency', skip:skip, (WidgetTester tester) async {
         
         await restart( tester );
         bool known = true;

         print("XXX LOGIN ARI" );
         await login( tester, known );
         expect( await verifyAriHome( tester ), true );         
         await logout( tester );
         
         print("XXX LOGIN CON" );
         await login( tester, known, tester2:true );
         expect( await verifyConnieHome( tester ), true );         


         print("XXX RESTART" );
         await restart( tester );
         await tester.pumpAndSettle();         
         await tester.pumpAndSettle( Duration( seconds:1 ));

         
         print("XXX VERIFY no login CON" );
         expect( await verifyConnieHome( tester ), true );         
         await logout( tester );

         print("XXX LOGIN ARI" );
         await login( tester, known );
         expect( await verifyAriHome( tester ), true );         

         await logout( tester );         

         report( 'Homepage GHAccount Consistency' );
      });
}
     