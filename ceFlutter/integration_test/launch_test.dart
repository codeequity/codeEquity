import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

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
   
   group('ceFlutter Test Group - Launch', () {

         testWidgets('Login known', (WidgetTester tester) async {
               
               await restart( tester );
               
               bool known = true;
               await login( tester, known );

               report( 'Login known' );
            });

         testWidgets('Login again on restart without logout', (WidgetTester tester) async {
               
               await restart( tester );

               // Did not logout of previous session.  Should load directly to homepage after splash.
               expect( await verifyOnHomePage( tester ), true );
               await logout( tester );
               
               report( 'Login again on restart without logout' );
            });
         
         testWidgets( 'Login unknown', (WidgetTester tester) async {
               
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

         testWidgets('Signup framing', (WidgetTester tester) async {

               await restart( tester );
               
               final Finder cnaButton = find.byKey( const Key( 'Create New Account'));
               expect( cnaButton, findsOneWidget );

               await tester.tap( cnaButton );
               await tester.pumpAndSettle();

               expect( await verifyOnSignupPage( tester ), true );
               
               report( 'Signup framing' );
            });

      });

}
     
