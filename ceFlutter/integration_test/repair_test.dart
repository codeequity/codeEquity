@Timeout(Duration(minutes: 25))

import 'dart:convert';  // json encode/decode
import 'dart:async';    // timer

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart'; // key
import 'package:fluttertoast/fluttertoast.dart';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:ceFlutter/customIcons.dart';
import 'utils.dart';


const GH_FLUT_TEST_REPO = "R_kgDOLlZyUw";


Future<bool> goodDetailFraming( WidgetTester tester ) async {

   final Finder cancel = find.byKey( const Key( 'Cancel' ));

   expect( find.text( 'CodeEquity vs Host PEQ Data' ),  findsOneWidget );
   expect( find.byKey( const Key( 'CodeEquity Data' )), findsOneWidget );
   expect( find.byKey( const Key( 'Host Data' )),       findsOneWidget );
   expect( find.byIcon( Icons.check_circle_outline ),   findsNWidgets(8) );
   expect( find.byKey( const Key( 'Title:' )),          findsOneWidget );
   expect( find.byKey( const Key( 'Peq Type:' )),       findsOneWidget );
   expect( find.byKey( const Key( 'CE Project Id:' )),  findsOneWidget );
   expect( find.byKey( const Key( 'PEQ Amount:' )),     findsOneWidget );
   expect( find.byKey( const Key( 'Host Repo Id:' )),   findsOneWidget );
   expect( find.byKey( const Key( 'Host Issue Id:' )),  findsOneWidget );
   expect( find.byKey( const Key( 'Host Assignees:' )), findsOneWidget );
   expect( find.byKey( const Key( 'Host Location:' )),  findsOneWidget );
   
   expect( cancel,                                      findsOneWidget );
   expect( find.byKey( const Key( 'Choose CE Peq' )),   findsNothing );
   expect( find.byKey( const Key( 'Choose Host Peq' )), findsNothing );
   expect( find.byKey( const Key( 'Delete CE Peq' )),   findsNothing );
   expect( find.byKey( const Key( 'Delete Host Peq' )), findsNothing );
   
   return true;
}

Future<bool> verifyAssignTest( WidgetTester tester ) async {

   final Finder title = find.byKey( const Key( 'AssignTest' ));
   
   expect( title,                                          findsOneWidget );
   expect( find.byKey( const Key( 'Data Security Flut' )), findsAtLeast(1) );
   expect( find.byKey( const Key( '1000' )),               findsAtLeast(1) );
   expect( find.byKey( const Key( 'grant' )),              findsAtLeast(1) );
   expect( find.byKey( const Key( '[ariTester]' )),        findsAtLeast(1) );

   await tester.tap( title );
   await tester.pumpAndSettle();
   await pumpSettle( tester, 2 );
   expect( await goodDetailFraming( tester ), true );

   // peq agreement means 2 of each type, but we are seeing through to peqs in the background.
   // issue id changes every time, don't bother trying to check
   expect( find.byKey( const Key( 'AssignTest' )),                    findsAtLeast(2) );
   expect( find.byKey( const Key( 'grant' )),                         findsAtLeast(2) );
   expect( find.byKey( const Key( CEMD_PROJ_ID )),                    findsNWidgets(2) );
   expect( find.byKey( const Key( '1000' )),                          findsAtLeast(2) );
   expect( find.byKey( const Key( GH_FLUT_TEST_REPO )),               findsNWidgets(2) );
   expect( find.byKey( const Key( '[U_kgDOBP2eEw]' )),                findsNWidgets(2) );
   expect( find.byKey( const Key( '[Data Security Flut, Accrued]' )), findsNWidgets(2) );
   
   final Finder cancel = find.byKey( const Key( 'Cancel' ));
   await tester.tap( cancel );
   await tester.pumpAndSettle();
   
   return true;
}

Future<bool> verifyBlast1( WidgetTester tester ) async {

   final Finder title = find.byKey( const Key( 'Blast 1' ));
   
   expect( title,                                   findsOneWidget );
   expect( find.byKey( const Key( 'UnClaimed' )),   findsAtLeast(1) );
   expect( find.byKey( const Key( '604' )),         findsAtLeast(1) );
   expect( find.byKey( const Key( 'plan' )),        findsAtLeast(1) );
   expect( find.byKey( const Key( '[ariTester]' )), findsAtLeast(1) );

   await tester.tap( title );
   await tester.pumpAndSettle();
   await pumpSettle( tester, 2 );
   expect( await goodDetailFraming( tester ), true );

   // peq agreement means 2 of each type, but we are seeing through to peqs in the background.
   // issue id changes every time, don't bother trying to check
   expect( find.byKey( const Key( 'Blast 1' )),                 findsAtLeast(2) );
   expect( find.byKey( const Key( 'plan' )),                    findsAtLeast(2) );
   expect( find.byKey( const Key( CEMD_PROJ_ID )),              findsNWidgets(2) );
   expect( find.byKey( const Key( '604' )),                     findsAtLeast(2) );
   expect( find.byKey( const Key( GH_FLUT_TEST_REPO )),         findsNWidgets(2) );
   expect( find.byKey( const Key( '[U_kgDOBP2eEw]' )),          findsNWidgets(2) );
   expect( find.byKey( const Key( '[UnClaimed, UnClaimed]' )),  findsNWidgets(2) );
   
   final Finder cancel = find.byKey( const Key( 'Cancel' ));
   await tester.tap( cancel );
   await tester.pumpAndSettle();
   
   return true;
}


Future<bool> verifyBlast2( WidgetTester tester ) async {

   final Finder title = find.byKey( const Key( 'Blast 2' ));
   
   expect( title,                                   findsOneWidget );
   expect( find.byKey( const Key( 'UnClaimed' )),   findsAtLeast(1) );
   expect( find.byKey( const Key( '604' )),         findsAtLeast(1) );
   expect( find.byKey( const Key( 'plan' )),        findsAtLeast(1) );
   expect( find.byKey( const Key( '[ariTester]' )), findsAtLeast(1) );

   await tester.tap( title );
   await tester.pumpAndSettle();
   await pumpSettle( tester, 2 );
   expect( await goodDetailFraming( tester ), true );

   // peq agreement means 2 of each type, but we are seeing through to peqs in the background.
   // issue id changes every time, don't bother trying to check
   expect( find.byKey( const Key( 'Blast 2' )),                 findsAtLeast(2) );
   expect( find.byKey( const Key( 'plan' )),                    findsAtLeast(2) );
   expect( find.byKey( const Key( CEMD_PROJ_ID )),              findsNWidgets(2) );
   expect( find.byKey( const Key( '604' )),                     findsAtLeast(2) );
   expect( find.byKey( const Key( GH_FLUT_TEST_REPO )),         findsNWidgets(2) );
   expect( find.byKey( const Key( '[U_kgDOBP2eEw, U_kgDOBqJgmQ]' )), findsNWidgets(2) );
   expect( find.byKey( const Key( '[UnClaimed, UnClaimed]' )),  findsNWidgets(2) );
   
   final Finder cancel = find.byKey( const Key( 'Cancel' ));
   await tester.tap( cancel );
   await tester.pumpAndSettle();
   
   return true;
}

Future<bool> verifySnowMelt( WidgetTester tester ) async {

   final Finder title = find.byKey( const Key( 'Snow melt' ));
   
   expect( title,                                              findsOneWidget );
   expect( find.byKey( const Key( 'Data Security Flut' )),     findsAtLeast(1) );
   expect( find.byKey( const Key( '1000' )),                   findsAtLeast(1) );
   expect( find.byKey( const Key( 'grant' )),                  findsAtLeast(1) );
   expect( find.byKey( const Key( '[ariTester, builderCE]' )), findsAtLeast(1) );

   await tester.tap( title );
   await tester.pumpAndSettle();
   await pumpSettle( tester, 2 );
   expect( await goodDetailFraming( tester ), true );

   // peq agreement means 2 of each type, but we are seeing through to peqs in the background.
   // issue id changes every time, don't bother trying to check
   expect( find.byKey( const Key( 'Snow melt' )),                     findsAtLeast(2) );
   expect( find.byKey( const Key( 'grant' )),                         findsAtLeast(2) );
   expect( find.byKey( const Key( CEMD_PROJ_ID )),                    findsNWidgets(2) );
   expect( find.byKey( const Key( '1000' )),                          findsAtLeast(2) );
   expect( find.byKey( const Key( GH_FLUT_TEST_REPO )),               findsNWidgets(2) );
   expect( find.byKey( const Key( '[U_kgDOBP2eEw, U_kgDOBqJgmQ]' )),  findsNWidgets(2) );
   expect( find.byKey( const Key( '[Data Security Flut, Accrued]' )), findsNWidgets(2) );

   final Finder cancel = find.byKey( const Key( 'Cancel' ));
   await tester.tap( cancel );
   await tester.pumpAndSettle();
   
   return true;
}

Future<bool> verifySituatedAccr( WidgetTester tester ) async {

   final Finder title = find.byKey( const Key( 'Situated Accrued' ));
   
   expect( title,                                              findsOneWidget );
   expect( find.byKey( const Key( 'Github Operations Flut' )), findsAtLeast(1) );
   expect( find.byKey( const Key( '1000' )),                   findsAtLeast(1) );
   expect( find.byKey( const Key( 'plan' )),                   findsAtLeast(1) );
   expect( find.byKey( const Key( '[]' )),                     findsAtLeast(1) );

   await tester.tap( title );
   await tester.pumpAndSettle();
   await pumpSettle( tester, 2 );
   expect( await goodDetailFraming( tester ), true );

   // peq agreement means 2 of each type, but we are seeing through to peqs in the background.
   // issue id changes every time, don't bother trying to check
   expect( find.byKey( const Key( 'Situated Accrued' )),                  findsAtLeast(2) );
   expect( find.byKey( const Key( 'plan' )),                              findsAtLeast(2) );
   expect( find.byKey( const Key( CEMD_PROJ_ID )),                        findsNWidgets(2) );
   expect( find.byKey( const Key( '1000' )),                              findsAtLeast(2) );
   expect( find.byKey( const Key( GH_FLUT_TEST_REPO )),                   findsNWidgets(2) );
   expect( find.byKey( const Key( '[]' )),                                findsAtLeast(2) );
   expect( find.byKey( const Key( '[Github Operations Flut, Planned]' )), findsNWidgets(2) );

   final Finder cancel = find.byKey( const Key( 'Cancel' ));
   await tester.tap( cancel );
   await tester.pumpAndSettle();
   
   return true;
}

Future<bool> verifyLabelDubs( WidgetTester tester ) async {

   final Finder title = find.byKey( const Key( 'LabelTest Dubs' ));
   
   expect( title,                                              findsOneWidget );
   expect( find.byKey( const Key( 'A Pre-Existing Project Flut' )), findsAtLeast(1) );
   expect( find.byKey( const Key( '500' )),                    findsAtLeast(1) );
   expect( find.byKey( const Key( 'grant' )),                  findsAtLeast(1) );
   expect( find.byKey( const Key( '[ariTester]' )),            findsAtLeast(1) );
   
   await tester.tap( title );
   await tester.pumpAndSettle();
   await pumpSettle( tester, 2 );
   expect( await goodDetailFraming( tester ), true );
   
   // peq agreement means 2 of each type, but we are seeing through to peqs in the background.
   // issue id changes every time, don't bother trying to check
   expect( title,                                                         findsAtLeast(2) );
   expect( find.byKey( const Key( 'grant' )),                             findsAtLeast(2) );
   expect( find.byKey( const Key( CEMD_PROJ_ID )),                        findsNWidgets(2) );
   expect( find.byKey( const Key( '500' )),                               findsAtLeast(2) );
   expect( find.byKey( const Key( GH_FLUT_TEST_REPO )),                   findsNWidgets(2) );
   expect( find.byKey( const Key( '[U_kgDOBP2eEw]' )),                    findsNWidgets(2) );
   expect( find.byKey( const Key( '[A Pre-Existing Project Flut, Accrued]' )), findsNWidgets(2) );

   final Finder cancel = find.byKey( const Key( 'Cancel' ));
   await tester.tap( cancel );
   await tester.pumpAndSettle();
   
   return true;
}


Future<bool> statusPostTesting( WidgetTester tester ) async {
   expect( find.byIcon( Icons.arrow_drop_down ),        findsNWidgets(3) );
   expect( find.byIcon( Icons.arrow_drop_down_circle ), findsNothing );

   // Expand all
   final Finder gone = find.byKey( const Key('hideGone' ));
   await tester.tap( gone );
   await tester.pumpAndSettle(); 
   expect( find.byIcon( Icons.arrow_drop_down ),        findsNWidgets(2) );
   expect( find.byIcon( Icons.arrow_drop_down_circle ), findsOneWidget );

   final Finder bad = find.byKey( const Key('hideBad' ));
   await tester.tap( bad );
   await tester.pumpAndSettle(); 
   expect( find.byIcon( Icons.arrow_drop_down ),        findsOneWidget );
   expect( find.byIcon( Icons.arrow_drop_down_circle ), findsNWidgets(2) );

   final Finder good = find.byKey( const Key('hideGood' ));
   await tester.tap( good );
   await tester.pumpAndSettle(); 
   expect( find.byIcon( Icons.arrow_drop_down ),        findsNothing );
   expect( find.byIcon( Icons.arrow_drop_down_circle ), findsNWidgets(3) );

   // Close all but good
   await tester.tap( gone );
   await tester.pumpAndSettle(); 
   await tester.tap( bad );
   await tester.pumpAndSettle(); 

   // Check sorting on good, ascend
   final Finder title = find.byKey( const Key( 'Issue Title' ));
   await tester.tap( title );
   await tester.pumpAndSettle();
   expect( find.byIcon( Icons.arrow_drop_up ),    findsOneWidget );
   expect( await verifyAssignTest( tester ),      true );
   expect( await verifyBlast1( tester ),          true );
   expect( await verifyBlast2( tester ),          true );
   expect( find.byKey( const Key( 'Snow melt' )), findsNothing );

   // Check sorting on good, descend
   await tester.tap( title );
   await tester.pumpAndSettle();
   expect( find.byIcon( Icons.arrow_drop_down ),   findsNWidgets(3) );  // sort, gone, bad
   expect( await verifySnowMelt( tester ),         true );
   expect( await verifySituatedAccr( tester ),     true );
   expect( await verifyLabelDubs( tester ),        true );
   expect( find.byKey( const Key( 'AssignTest' )), findsNothing );

   // sorts Host Project, just check title.  ascend
   final Finder hp = find.byKey( const Key( 'Host Project' ));
   await tester.tap( hp );
   await tester.pumpAndSettle();
   expect( find.byIcon( Icons.arrow_drop_up ),                      findsOneWidget );
   expect( find.byKey( const Key( 'A Pre-Existing Project Flut' )), findsNWidgets( 4 ));
   expect( find.byKey( const Key( 'Cross Proj' )),                  findsOneWidget );
   expect( find.byKey( const Key( 'Data Security Flut' )),          findsNWidgets(6) );
   expect( find.byKey( const Key( 'UnClaimed' )),                   findsNothing );

   // sorts Host Project, just check title.  descend
   await tester.tap( hp );
   await tester.pumpAndSettle();
   expect( find.byIcon( Icons.arrow_drop_up ),                      findsNothing );
   expect( find.byKey( const Key( 'A Pre-Existing Project Flut' )), findsNothing);
   expect( find.byKey( const Key( 'Cross Proj' )),                  findsNothing );
   expect( find.byKey( const Key( 'Data Security Flut' )),          findsNothing );
   expect( find.byKey( const Key( 'UnClaimed' )),                   findsAtLeast(8) );
   
   // sorts PEQ, just check title.  ascend
   final Finder peq = find.byKey( const Key( 'PEQ' ));
   await tester.tap( peq );
   await tester.pumpAndSettle();
   expect( find.byIcon( Icons.arrow_drop_up ), findsOneWidget );
   expect( find.byKey( const Key( '105' )),    findsOneWidget);
   expect( find.byKey( const Key( '250' )),    findsNWidgets(2) );
   expect( find.byKey( const Key( '500' )),    findsNWidgets(4) );
   expect( find.byKey( const Key( '1000' )),   findsNothing );

   // sorts Host Peq, descend
   await tester.tap( peq );
   await tester.pumpAndSettle();
   expect( find.byIcon( Icons.arrow_drop_up ), findsNothing );
   expect( find.byKey( const Key( '105' )),    findsNothing);
   expect( find.byKey( const Key( '250' )),    findsNothing );
   expect( find.byKey( const Key( '500' )),    findsNothing );
   expect( find.byKey( const Key( '1000' )),   findsAtLeast(8) );

   // sorts Type.  ascend
   final Finder type = find.byKey( const Key( 'Type' ));
   await tester.tap( type );
   await tester.pumpAndSettle();
   expect( find.byIcon( Icons.arrow_drop_up ),  findsOneWidget );
   expect( find.byKey( const Key( 'grant' )),   findsAtLeast(8) );
   expect( find.byKey( const Key( 'pending' )), findsAtLeast(1) );

   // descend
   await tester.tap( type );
   await tester.pumpAndSettle();
   expect( find.byIcon( Icons.arrow_drop_up ),  findsNothing );
   expect( find.byKey( const Key( 'grant' )),   findsNothing );
   expect( find.byKey( const Key( 'pending' )), findsNothing );
   expect( find.byKey( const Key( 'plan' )),    findsAtLeast(8) );

   // sorts Assignees.  ascend
   final Finder assn = find.byKey( const Key( 'Assignee(s)' ));
   await tester.tap( assn );
   await tester.pumpAndSettle();
   expect( find.byIcon( Icons.arrow_drop_up ),                    findsOneWidget );
   expect( find.byKey( const Key( '[]' )),                        findsNWidgets(4) );
   expect( find.byKey( const Key( '[ariTester, builderCE]' )),    findsNWidgets(7) );
   expect( find.byKey( const Key( '[connieTester, builderCE]' )), findsNothing );

   // descend
   await tester.tap( assn );
   await tester.pumpAndSettle();
   expect( find.byIcon( Icons.arrow_drop_up ),                    findsNothing );
   expect( find.byKey( const Key( '[]' )),                        findsNothing );
   expect( find.byKey( const Key( '[ariTester, builderCE]' )),    findsNothing );
   expect( find.byKey( const Key( '[connieTester, builderCE]' )), findsOneWidget );

   return true;
}


void main() {

   IntegrationTestWidgetsFlutterBinding.ensureInitialized();

   // bool skip = true;
   bool skip = false;

   // override?  Run it.
   var override = const String.fromEnvironment('override');
   if( override == "True" ) { skip = false; }
   
   report( 'Repair', group:true );

   print( "Repair" );
   // testWidgets('Repair', skip:true, (WidgetTester tester) async {
   testWidgets('Repair', skip:skip, (WidgetTester tester) async {
         
         tester.binding.window.physicalSizeTestValue = const Size(1000, 1050);

         await restart( tester );
         await login( tester, true );

         expect( await verifyAriHome( tester ), true );

         final Finder ariLink = find.byKey( Key( CEMD_PROJ_NAME ));
         await tester.tap( ariLink );
         await pumpSettle( tester, 4, verbose: true ); 
         await pumpSettle( tester, 2, verbose: true ); 

         expect( await verifyOnProjectPage( tester ), true );

         // Head to status page
         await statusTabFraming( tester );

         await statusPostTesting( tester );

         // test statusUnavailable
         // make 1 aws peq, make separate gh peq (make normal, then rem aws part?  or just remove aws part?)
         // test overwrite 1, all on both ends.  Can 'make' by destroying a bit..
         // make error with existing both, aws-only, host-only
         // test each missing notification case + repair.  oi.
         
         await logout( tester );         

         report( 'Repair' );
      });

}
     
