import 'package:flutter/foundation.dart'; // key

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:ceFlutter/main.dart';
import 'package:ceFlutter/app_state_container.dart';

import 'utils.dart';

void main() {

   IntegrationTestWidgetsFlutterBinding.ensureInitialized();
   
   group('ceFlutter Test Group, unknown user', () {

        testWidgets('Login fail', (WidgetTester tester) async {

              await tester.pumpWidget( AppStateContainer( child: new CEApp() ));
              await tester.pumpAndSettle();

              final splash = find.text( 'CodeEquity' );
              expect(splash, findsOneWidget);

              await tester.pumpAndSettle(Duration(seconds: 5));
              
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
              
           });
  
      });
}
     
