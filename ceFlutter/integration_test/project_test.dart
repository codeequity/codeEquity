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



Future<bool> peqSummaryTabFraming( WidgetTester tester ) async {
   expect( await verifyOnProjectPage( tester ), true );
   final Finder tab = find.byKey( const Key('PEQ Summary' ));
   await tester.tap( tab );
   await tester.pumpAndSettle( Duration( seconds:1 ));

   expect( find.text('Category'), findsOneWidget );
   expect( find.text('Allocation'), findsOneWidget );
   expect( find.text('Planned'), findsOneWidget );
   expect( find.text('Pending'), findsOneWidget );
   expect( find.text('Accrued'), findsOneWidget );
   expect( find.text('Remaining'), findsOneWidget );

   expect( find.byKey(const Key( 'Update PEQ Summary?' )), findsOneWidget );

   return true;
}

Future<bool> approvalsTabFraming( WidgetTester tester ) async {
   expect( await verifyOnProjectPage( tester ), true );
   final Finder tab = find.byKey( const Key('Approvals' ));
   await tester.tap( tab );
   await tester.pumpAndSettle();  // First pump is the swipe off to right transition step
   await tester.pumpAndSettle();

   expect( find.text( 'ZooBaDoo!' ), findsOneWidget );
   return true;
}

Future<bool> contributorsTabFraming( WidgetTester tester ) async {
   expect( await verifyOnProjectPage( tester ), true );
   final Finder tab = find.byKey( const Key('Contributors' ));
   await tester.tap( tab );
   await tester.pumpAndSettle();  // First pump is the swipe off to right transition step
   await tester.pumpAndSettle();

   expect( find.text( 'ZooBaDoo!' ), findsOneWidget );
   return true;
}

Future<bool> equityPlanTabFraming( WidgetTester tester ) async {
   expect( await verifyOnProjectPage( tester ), true );
   final Finder tab = find.byKey( const Key('Equity Plan' ));
   await tester.tap( tab );
   await tester.pumpAndSettle();  // First pump is the swipe off to right transition step
   await tester.pumpAndSettle();

   expect( find.text( 'ZooBaDoo!' ), findsOneWidget );
   return true;
}

Future<bool> agreementsTabFraming( WidgetTester tester ) async {
   expect( await verifyOnProjectPage( tester ), true );
   final Finder tab = find.byKey( const Key('Agreements' ));
   await tester.tap( tab );
   await tester.pumpAndSettle();  // First pump is the swipe off to right transition step
   await tester.pumpAndSettle();

   expect( find.text( 'ZooBaDoo!' ), findsOneWidget );
   return true;
}


void main() {

   // final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized() as IntegrationTestWidgetsFlutterBinding;
   IntegrationTestWidgetsFlutterBinding.ensureInitialized();

   final bool skip = false;
   
   report( 'Project', group:true );
   
   testWidgets('Project Basics', skip:skip, (WidgetTester tester) async {
         
         await restart( tester );
         await login( tester, true );

         final Finder ariLink = find.byKey( const Key('ariCETester/CodeEquityTester' ));
         await tester.tap( ariLink );
         print( "pumping" );
         await tester.pumpAndSettle( Duration( seconds: 5 ));
         print( "pumping" );
         await tester.pumpAndSettle( Duration( seconds: 3 ));

         expect( await verifyOnProjectPage( tester ), true );

         expect( await peqSummaryTabFraming( tester ),   true );
         expect( await approvalsTabFraming( tester ),    true );
         expect( await contributorsTabFraming( tester ), true );
         expect( await equityPlanTabFraming( tester ),   true );
         expect( await agreementsTabFraming( tester ),   true );

         await logout( tester );         

         report( 'Project Basics' );
      });

   testWidgets('Project contents', skip:skip, (WidgetTester tester) async {

         // XXX resolve ari vs rm2k first
         // peq summary
         // update peq summary
         report( 'Project contents' );
      });

}
     
