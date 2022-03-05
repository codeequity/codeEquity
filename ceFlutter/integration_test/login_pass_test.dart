import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
//import 'package:test/test.dart';


import 'package:ceFlutter/main.dart';
import 'package:ceFlutter/app_state_container.dart';

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

void main() {

   IntegrationTestWidgetsFlutterBinding.ensureInitialized();
   
   group('ceFlutter Test Group, good user', () {

        testWidgets('Xoog', (WidgetTester tester) async {

              // runApp( AppStateContainer( child: new CEApp() ));
              print( "Pre-app" );
              await tester.pumpWidget( AppStateContainer( child: new CEApp() ));

              print( "Splash" );
              await tester.pumpAndSettle();
              final splash = find.text( 'CodeEquity' );
              expect(splash, findsOneWidget);

              /*
    expect(
        find.byWidgetPredicate((widget) =>
            widget is AppBar &&
            widget.title is Text &&
            (widget.title as Text).data.startsWith("ToDoApp")),
        findsOneWidget);

 expect(
      find.byWidgetPredicate((widget) =>
      widget is Text &&
          widget.data.contains("Enter an email")  ),
      findsOneWidget);

              */
              
 
              
              print( "Login page" );
              await tester.pumpAndSettle(Duration(seconds: 5));
              
              bool known = true;
              await login( tester, known );


              await Future.delayed(const Duration(seconds: 5), (){});
              
              /*
              test('Signin for known user', () async {
                    bool known = true;
                    await login( tester, known );
                 });
              
              test('Logout.', () async {
                    await logout( tester );
                 });
              
              test('Login.', () async {
                    bool known = true;
                    await login( tester, known );
                 });
              
              test('Logout.', () async {
                    await logout( tester );
                 });
              */
           });
  
      });
}
     
