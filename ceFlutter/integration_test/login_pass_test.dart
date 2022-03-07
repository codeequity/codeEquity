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

        testWidgets('Login pass', (WidgetTester tester) async {

              await tester.pumpWidget( AppStateContainer( child: new CEApp() ));
              await tester.pumpAndSettle();

              final splash = find.text( 'CodeEquity' );
              expect(splash, findsOneWidget);

              await tester.pumpAndSettle(Duration(seconds: 5));
              
              bool known = true;
              await login( tester, known );
              await logout( tester );

              await login( tester, known );
              await logout( tester );

           });
  
      });
}
     
