@Timeout(Duration(minutes: 25))

import 'dart:convert';  // json encode/decode
import 'dart:async';    // timer

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart'; // key
import 'package:fluttertoast/fluttertoast.dart';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:ceFlutter/utils/ceUtils.dart' hide logout;   // access to ceServer
import 'package:ceFlutter/utils/awsUtils.dart';
import 'package:ceFlutter/models/PEQ.dart';

import 'package:ceFlutter/customIcons.dart';
import 'utils.dart';


const GH_FLUT_TEST_REPO = "R_kgDOLlZyUw";

class fakeState {
   final String CESERVER_ENDPOINT;
   fakeState( this.CESERVER_ENDPOINT );
}

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
   expect( find.byKey( const Key( 'Use CodeEquity PEQ' )), findsNothing );
   expect( find.byKey( const Key( 'Use Host PEQ' )),       findsNothing );
   expect( find.byKey( const Key( 'Delete CodeEquity PEQ' )), findsNothing );
   expect( find.byKey( const Key( 'Delete Host PEQ' )),    findsNothing );
   
   return true;
}

Future<bool> badDetailFraming( WidgetTester tester ) async {

   final Finder cancel = find.byKey( const Key( 'Cancel' ));

   expect( find.text( 'CodeEquity vs Host PEQ Data' ),  findsOneWidget );
   expect( find.byKey( const Key( 'CodeEquity Data' )), findsOneWidget );
   expect( find.byKey( const Key( 'Host Data' )),       findsOneWidget );
   expect( find.byIcon( Icons.check_circle_outline ),   findsNWidgets(7) );
   expect( find.byIcon( Icons.cancel_outlined ),        findsOneWidget );
   expect( find.byKey( const Key( 'Title:' )),          findsOneWidget );
   expect( find.byKey( const Key( 'Peq Type:' )),       findsOneWidget );
   expect( find.byKey( const Key( 'CE Project Id:' )),  findsOneWidget );
   expect( find.byKey( const Key( 'PEQ Amount:' )),     findsOneWidget );
   expect( find.byKey( const Key( 'Host Repo Id:' )),   findsOneWidget );
   expect( find.byKey( const Key( 'Host Issue Id:' )),  findsOneWidget );
   expect( find.byKey( const Key( 'Host Assignees:' )), findsOneWidget );
   expect( find.byKey( const Key( 'Host Location:' )),  findsOneWidget );
   
   expect( cancel,                                      findsOneWidget );
   expect( find.byKey( const Key( 'Use CodeEquity PEQ' )), findsOneWidget );
   expect( find.byKey( const Key( 'Use Host PEQ' )),       findsOneWidget );
   expect( find.byKey( const Key( 'Delete CodeEquity PEQ' )), findsOneWidget );
   expect( find.byKey( const Key( 'Delete Host PEQ' )),    findsOneWidget );
   
   return true;
}

Future<bool> deletedFraming( WidgetTester tester, deleted ) async {

   expect( find.text( 'CodeEquity vs Host PEQ Data' ),  findsOneWidget );
   expect( find.byKey( const Key( 'CodeEquity Data' )), findsOneWidget );
   expect( find.byKey( const Key( 'Host Data' )),       findsOneWidget );
   expect( find.byIcon( Icons.check_circle_outline ),   findsNothing );
   expect( find.byIcon( Icons.cancel_outlined ),        findsNWidgets(8) );
   expect( find.byKey( const Key( 'Title:' )),          findsOneWidget );
   expect( find.byKey( const Key( 'Peq Type:' )),       findsOneWidget );
   expect( find.byKey( const Key( 'CE Project Id:' )),  findsOneWidget );
   expect( find.byKey( const Key( 'PEQ Amount:' )),     findsOneWidget );
   expect( find.byKey( const Key( 'Host Repo Id:' )),   findsOneWidget );
   expect( find.byKey( const Key( 'Host Issue Id:' )),  findsOneWidget );
   expect( find.byKey( const Key( 'Host Assignees:' )), findsOneWidget );
   expect( find.byKey( const Key( 'Host Location:' )),  findsOneWidget );
   expect( find.byKey( const Key( 'Cancel' )),          findsOneWidget );

   if( deleted == "host" ) {
      expect( find.text( 'NOTE: Host Peq is not available.' ),   findsOneWidget );
      expect( find.byKey( const Key( 'Use CodeEquity PEQ' )),    findsOneWidget );
      expect( find.byKey( const Key( 'Delete CodeEquity PEQ' )), findsOneWidget );
      expect( find.byKey( const Key( 'Use Host PEQ' )),          findsNothing );
      expect( find.byKey( const Key( 'Delete Host PEQ' )),       findsNothing );
   }
   else {
      expect( find.text( 'NOTE: CodeEquity Peq is not available.' ), findsOneWidget );
      expect( find.byKey( const Key( 'Use CodeEquity PEQ' )),        findsNothing );
      expect( find.byKey( const Key( 'Delete CodeEquity PEQ' )),     findsNothing );
      expect( find.byKey( const Key( 'Use Host PEQ' )),              findsOneWidget );
      expect( find.byKey( const Key( 'Delete Host PEQ' )),           findsOneWidget );
   }

   return true;
}

Future<bool> verifyAssignTest( WidgetTester tester, { col = "Issue Title", ascending = true } ) async {

   // Category is 'good' by definition.  open.
   final Finder good = find.byKey( const Key('toggleGood' ));
   await tester.tap( good );
   await tester.pumpAndSettle(); 

   // sort
   final Finder column = find.byKey( Key( col ));
   if( ascending ) { expect( await sortAsc(  tester, column ), true ); }
   else            { expect( await sortDesc( tester, column ), true ); }
      
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

   // close
   await tester.tap( good );
   await tester.pumpAndSettle(); 

   return true;
}

Future<bool> verifyBlast1( WidgetTester tester, { amount = "604", cat = "toggleGood", col = "Issue Title", ascending = true } ) async {

   // open category
   final Finder category = find.byKey( Key( cat ));
   await tester.tap( category );
   await tester.pumpAndSettle(); 

   // sort
   final Finder column = find.byKey( Key( col ));
   if( ascending ) { expect( await sortAsc(  tester, column ), true ); }
   else            { expect( await sortDesc( tester, column ), true ); }

   final Finder title = find.byKey( const Key( 'Blast 1' ));
   
   expect( title,                                   findsOneWidget );
   expect( find.byKey( const Key( 'UnClaimed' )),   findsAtLeast(1) );
   expect( find.byKey(       Key(  amount )),       findsAtLeast(1) );
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
   expect( find.byKey(       Key( amount )),                    findsAtLeast(2) );
   expect( find.byKey( const Key( GH_FLUT_TEST_REPO )),         findsNWidgets(2) );
   expect( find.byKey( const Key( '[U_kgDOBP2eEw]' )),          findsNWidgets(2) );
   expect( find.byKey( const Key( '[UnClaimed, UnClaimed]' )),  findsNWidgets(2) );
   
   final Finder cancel = find.byKey( const Key( 'Cancel' ));
   await tester.tap( cancel );
   await tester.pumpAndSettle();

   // close
   await tester.tap( category );
   await tester.pumpAndSettle(); 
   
   return true;
}

Future<bool> verifyBlast1BadAmount( WidgetTester tester, { ascending = true } ) async {

   // open category
   final Finder category = find.byKey( Key( 'toggleBad' ));
   await tester.tap( category );
   await tester.pumpAndSettle(); 

   // sort
   final Finder column = find.byKey( const Key( "Issue Title" ));
   if( ascending ) { expect( await sortAsc(  tester, column ), true ); }
   else            { expect( await sortDesc( tester, column ), true ); }

   final Finder title = find.byKey( const Key( 'Blast 1' ));
   
   expect( title,                                   findsOneWidget );
   expect( find.byKey( const Key( 'UnClaimed' )),   findsAtLeast(1) );
   expect( find.byKey( const Key( '606' )),         findsAtLeast(1) );
   expect( find.byKey( const Key( 'plan' )),        findsAtLeast(1) );
   expect( find.byKey( const Key( '[ariTester]' )), findsAtLeast(1) );

   await tester.tap( title );
   await tester.pumpAndSettle();
   await pumpSettle( tester, 2 );
   expect( await badDetailFraming( tester ), true );

   // peq agreement means 2 of each type, but we are seeing through to peqs in the background.
   // issue id changes every time, don't bother trying to check
   expect( find.byKey( const Key( 'Blast 1' )),                 findsAtLeast(2) );
   expect( find.byKey( const Key( 'plan' )),                    findsAtLeast(2) );
   expect( find.byKey( const Key( CEMD_PROJ_ID )),              findsNWidgets(2) );
   expect( find.byKey( const Key( '604' )),                     findsAtLeast(1) );
   expect( find.byKey( const Key( '606' )),                     findsAtLeast(1) );
   expect( find.byKey( const Key( GH_FLUT_TEST_REPO )),         findsNWidgets(2) );
   expect( find.byKey( const Key( '[U_kgDOBP2eEw]' )),          findsNWidgets(2) );
   expect( find.byKey( const Key( '[UnClaimed, UnClaimed]' )),  findsNWidgets(2) );
   
   final Finder cancel = find.byKey( const Key( 'Cancel' ));
   await tester.tap( cancel );
   await tester.pumpAndSettle();

   await tester.tap( category );
   await tester.pumpAndSettle(); 
   
   return true;
}

Future<bool> verifyBlast1Deleted( WidgetTester tester, { deleted = "host" } ) async {

   // open category
   final Finder category = find.byKey( Key( 'toggleBad' ));
   await tester.tap( category );
   await tester.pumpAndSettle(); 

   // sort
   final Finder column = find.byKey( const Key( "Issue Title" ));
   expect( await sortAsc(  tester, column ), true );

   final Finder title = find.byKey( const Key( 'Blast 1' ));
   
   expect( title,                                   findsOneWidget );
   expect( find.byKey( const Key( 'UnClaimed' )),   findsAtLeast(1) );
   expect( find.byKey( const Key( 'plan' )),        findsAtLeast(1) );
   expect( find.byKey( const Key( '[ariTester]' )), findsAtLeast(1) );

   if( deleted == 'host' )     { expect( find.byKey( const Key( '606' )), findsAtLeast(1) ); }
   else if( deleted == 'aws' ) { expect( find.byKey( const Key( '604' )), findsAtLeast(1) ); }
   
   await tester.tap( title );
   await tester.pumpAndSettle();
   await pumpSettle( tester, 2 );
   expect( await deletedFraming( tester, deleted ), true );

   // issue id changes every time, don't bother trying to check
   expect( find.byKey( const Key( 'Blast 1' )),                 findsAtLeast(1) );
   expect( find.byKey( const Key( 'plan' )),                    findsAtLeast(1) );
   expect( find.byKey( const Key( CEMD_PROJ_ID )),              findsNWidgets(1) );
   expect( find.byKey( const Key( '[U_kgDOBP2eEw]' )),          findsNWidgets(1) );
   expect( find.byKey( const Key( '[UnClaimed, UnClaimed]' )),  findsNWidgets(1) );
   expect( find.byKey( const Key( GH_FLUT_TEST_REPO )),         findsNWidgets(1) );

   if( deleted == 'host' ) {
      expect( find.byKey( const Key( '604' )),                  findsNothing );
      expect( find.byKey( const Key( '606' )),                  findsAtLeast(1) );
   }
   else if( deleted == 'aws' ) {
      expect( find.byKey( const Key( '604' )),                  findsAtLeast(1) );
      expect( find.byKey( const Key( '606' )),                  findsNothing );
   }
   
   final Finder cancel = find.byKey( const Key( 'Cancel' ));
   await tester.tap( cancel );
   await tester.pumpAndSettle();

   await tester.tap( category );
   await tester.pumpAndSettle(); 
   
   return true;
}


Future<bool> verifyBlast2( WidgetTester tester ) async {

   // open category
   final Finder category = find.byKey( Key( 'toggleGood' ));
   await tester.tap( category );
   await tester.pumpAndSettle(); 

   // sort
   final Finder column = find.byKey( const Key( "Issue Title" ));
   expect( await sortAsc(  tester, column ), true );
   
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

   await tester.tap( category );
   await tester.pumpAndSettle(); 
   
   return true;
}

Future<bool> verifySnowMelt( WidgetTester tester ) async {

   // open category
   final Finder category = find.byKey( Key( 'toggleGood' ));
   await tester.tap( category );
   await tester.pumpAndSettle(); 

   // sort
   final Finder column = find.byKey( const Key( "Issue Title" ));
   expect( await sortDesc(  tester, column ), true );

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

   await tester.tap( category );
   await tester.pumpAndSettle(); 
   
   return true;
}

Future<bool> verifySnowMeltBadAmount( WidgetTester tester ) async {

   // open category
   final Finder category = find.byKey( Key( 'toggleBad' ));
   await tester.tap( category );
   await tester.pumpAndSettle(); 

   // sort
   final Finder column = find.byKey( const Key( "Issue Title" ));
   expect( await sortDesc(  tester, column ), true );

   final Finder title = find.byKey( const Key( 'Snow melt' ));
   
   expect( title,                                              findsOneWidget );
   expect( find.byKey( const Key( 'Data Security Flut' )),     findsAtLeast(1) );
   expect( find.byKey( const Key( '1001' )),                   findsAtLeast(1) );
   expect( find.byKey( const Key( 'grant' )),                  findsAtLeast(1) );
   expect( find.byKey( const Key( '[ariTester, builderCE]' )), findsAtLeast(1) );

   await tester.tap( title );
   await tester.pumpAndSettle();
   await pumpSettle( tester, 2 );
   expect( await badDetailFraming( tester ), true );

   // peq agreement means 2 of each type, but we are seeing through to peqs in the background.
   // issue id changes every time, don't bother trying to check
   expect( find.byKey( const Key( 'Snow melt' )),                     findsAtLeast(2) );
   expect( find.byKey( const Key( 'grant' )),                         findsAtLeast(2) );
   expect( find.byKey( const Key( CEMD_PROJ_ID )),                    findsNWidgets(2) );
   expect( find.byKey( const Key( '1000' )),                          findsAtLeast(1) ); // overlay, underlay
   expect( find.byKey( const Key( '1001' )),                          findsAtLeast(1) );
   expect( find.byKey( const Key( GH_FLUT_TEST_REPO )),               findsNWidgets(2) );
   expect( find.byKey( const Key( '[U_kgDOBP2eEw, U_kgDOBqJgmQ]' )),  findsNWidgets(2) );
   expect( find.byKey( const Key( '[Data Security Flut, Accrued]' )), findsNWidgets(2) );

   final Finder cancel = find.byKey( const Key( 'Cancel' ));
   await tester.tap( cancel );
   await tester.pumpAndSettle();

   await tester.tap( category );
   await tester.pumpAndSettle(); 

   return true;
}

Future<bool> verifySituatedAccr( WidgetTester tester ) async {

   // open category
   final Finder category = find.byKey( Key( 'toggleGood' ));
   await tester.tap( category );
   await tester.pumpAndSettle(); 

   // sort
   final Finder column = find.byKey( const Key( "Issue Title" ));
   expect( await sortDesc(  tester, column ), true );

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

   await tester.tap( category );
   await tester.pumpAndSettle(); 
   
   return true;
}

Future<bool> verifyLabelDubs( WidgetTester tester ) async {

   // open category
   final Finder category = find.byKey( Key( 'toggleGood' ));
   await tester.tap( category );
   await tester.pumpAndSettle(); 

   // sort
   final Finder column = find.byKey( const Key( "Issue Title" ));
   expect( await sortDesc(  tester, column ), true );

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

   await tester.tap( category );
   await tester.pumpAndSettle(); 
   
   return true;
}


String getFromToolTipTableText( Widget elt ) {
   String retVal = "";
   if( elt is Tooltip ) {
      var container  = elt.child        as Container;
      var contTable  = container.child  as Padding;
      var container2 = contTable.child  as Container;
      var contText   = container2.child as Text;
      retVal         = contText.data ?? "";
   }
   return retVal;
}


Future<String> getHostIssueId( WidgetTester tester, Finder wrap ) async {
   var w    = wrap.evaluate().single.widget as Wrap;
   var kids = w.children as List;

   assert( kids.length == 4 );
   var hid  = getFromToolTipTableText( kids[1] );
   return hid;
}


Future<bool> sortDesc( WidgetTester tester, Finder col ) async {
   // Make sure column is descending
   expect( col, findsOneWidget );
   await tester.tap( col );
   await tester.pumpAndSettle();
   try{
      expect( find.byIcon( Icons.arrow_drop_down ),   findsNWidgets(3) );  // sort, gone, bad
   }
   catch( e ) {
      await tester.tap( col );
      await tester.pumpAndSettle();
      expect( find.byIcon( Icons.arrow_drop_down ),   findsNWidgets(3) );  // sort, gone, bad
   }
   return true;
}

Future<bool> sortAsc( WidgetTester tester, Finder col ) async {
   // Make sure column is descending
   expect( col, findsOneWidget );
   await tester.tap( col );
   await tester.pumpAndSettle();
   try{
      expect( find.byIcon( Icons.arrow_drop_up ),   findsNWidgets(1) ); // sort,
      expect( find.byIcon( Icons.arrow_drop_down ), findsNWidgets(2) ); // gone, bad
   }
   catch( e ) {
      await tester.tap( col );
      await tester.pumpAndSettle();
      expect( find.byIcon( Icons.arrow_drop_up ),   findsNWidgets(1) ); // sort,
      expect( find.byIcon( Icons.arrow_drop_down ), findsNWidgets(2) ); // gone, bad
   }
   return true;
}

// preCondition: detail screen for peq of interest must be open, implying a good/bad/gone is open as well
// postCondition: close detail scr and underlying category
Future<Map<String, dynamic>> getPeqFromDetail( WidgetTester tester, fakeState state, String cat ) async {
   // deconstruct wrap .. check getElt in project_test
   final Finder wrap = find.byKey( const Key( "WrapHost Issue Id:" ));
   expect( wrap, findsOneWidget );
   String hid = await getHostIssueId( tester, wrap );
   print( "\nFOUND Host issue id: " + hid );
   
   // remove detail screen
   final Finder cancel = find.byKey( const Key( 'Cancel' ));
   await tester.tap( cancel );
   await tester.pumpAndSettle();

   // close category list
   final Finder category = find.byKey( Key( cat ));
   await tester.tap( category );
   await tester.pumpAndSettle();

   // Get full PEQ from aws
   var postData = '{"Endpoint": "ceMD", "Request": "getAWSPeq", "ceProjId": "$CEMD_PROJ_ID", "hostIssueId": "$hid" }';
   var response = await postCE( state, postData );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      assert( false );
   }
   var peq = json.decode( utf8.decode( response.bodyBytes ));
   print( "Got PEQ: " + peq.toString() );
   assert( peq != "-1" && peq[ 'PEQId' ] != null );
   return peq;
}

Future<bool> writePeq( WidgetTester tester, fakeState state, Map<String, dynamic> peq ) async {
   String pmod     = json.encode( peq );
   var postData    = '{ "Endpoint": "ceMD", "Request": "putAWSPeq", "peq": $pmod }';
   var response    = await postCE( state, postData );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      assert( false );
   }
   var resBod = json.decode( utf8.decode( response.bodyBytes ));
   expect( resBod, peq[ 'PEQId' ] );
   return true;
}

Future<bool> deleteOneFromHost( WidgetTester tester, String cat ) async {
   await pumpSettle( tester, 1 );
   final Finder useHost = find.byKey( const Key( 'Delete Host PEQ' ) );
   expect( useHost, findsOneWidget );
   await tester.tap( useHost );
   await tester.pumpAndSettle(); 
   await pumpSettle( tester, 2 ); 
   
   expect( find.text( 'Host PEQ:' ),                   findsAtLeast(1));
   final Finder deleteOne = find.byKey( const Key( 'Delete one host' ));
   expect( deleteOne,                                   findsOneWidget );
   expect( find.byKey( const Key( 'Delete all host' )), findsOneWidget );
   expect( find.byKey( const Key( 'Dismiss' )),        findsOneWidget );
   await tester.tap( deleteOne );
   await tester.pumpAndSettle(); 
   await pumpSettle( tester, 4 );

   // close category list
   final Finder category = find.byKey( Key( cat ) );
   await tester.tap( category );
   await tester.pumpAndSettle();
   
   expect( await updateStatus( tester ), true );
   return true;
}

Future<bool> deleteOneFromAWS( WidgetTester tester, String cat ) async {
   await pumpSettle( tester, 1 );
   final Finder useHost = find.byKey( const Key( 'Delete CodeEquity PEQ' ) );
   expect( useHost, findsOneWidget );
   await tester.tap( useHost );
   await tester.pumpAndSettle(); 
   await pumpSettle( tester, 2 ); 
   
   expect( find.text( 'CodeEquity PEQ:' ),              findsAtLeast(1));
   final Finder deleteOne = find.byKey( const Key( 'Delete one CE' ));
   expect( deleteOne,                                   findsOneWidget );
   expect( find.byKey( const Key( 'Delete all CE' )),   findsOneWidget );
   expect( find.byKey( const Key( 'Dismiss' )),         findsOneWidget );
   await tester.tap( deleteOne );
   await tester.pumpAndSettle(); 
   await pumpSettle( tester, 4 );

   // close category list
   final Finder category = find.byKey( Key( cat ) );
   await tester.tap( category );
   await tester.pumpAndSettle();
   
   expect( await updateStatus( tester ), true );
   return true;
}

Future<bool> writeOneFromHost( WidgetTester tester, String cat ) async {
   await pumpSettle( tester, 1 );
   final Finder useHost = find.byKey( const Key( 'Use Host PEQ' ) );
   expect( useHost, findsOneWidget );
   await tester.tap( useHost );
   await tester.pumpAndSettle(); 
   await pumpSettle( tester, 2 ); 

   expect( find.text( 'Host PEQ:' ),                   findsOneWidget );
   final Finder writeOne = find.byKey( const Key( 'Write one host' ));
   expect( writeOne,                                   findsOneWidget );
   expect( find.byKey( const Key( 'Write all host' )), findsOneWidget );
   expect( find.byKey( const Key( 'Dismiss' )),        findsOneWidget );
   await tester.tap( writeOne );
   await tester.pumpAndSettle(); 
   await pumpSettle( tester, 4 );

   // close category list
   final Finder category = find.byKey( Key( cat ) );
   await tester.tap( category );
   await tester.pumpAndSettle();
   
   expect( await updateStatus( tester ), true );
   return true;
}

// XXX writes, verifies all need to set required state internally.
//     dealing with this outside the method is clumsy, sloppy
Future<bool> writeOneFromAWS( WidgetTester tester, String cat ) async {
   await pumpSettle( tester, 1 );
   final Finder useCE = find.byKey( const Key( 'Use CodeEquity PEQ' ) );
   expect( useCE, findsOneWidget );
   await tester.tap( useCE );
   await tester.pumpAndSettle(); 
   await pumpSettle( tester, 2 ); 

   expect( find.text( 'CodeEquity PEQ:' ),             findsOneWidget );
   final Finder writeOne = find.byKey( const Key( 'Write one CE' ));
   expect( writeOne,                                   findsOneWidget );
   expect( find.byKey( const Key( 'Write all CE' )), findsOneWidget );
   expect( find.byKey( const Key( 'Dismiss' )),        findsOneWidget );
   await tester.tap( writeOne );
   await tester.pumpAndSettle(); 
   await pumpSettle( tester, 9 );

   // close category list
   final Finder category = find.byKey( Key( cat ) );
   await tester.tap( category );
   await tester.pumpAndSettle();
   
   // If list is too long, need to close to find update
   expect( await updateStatus( tester ), true );
   
   return true;
}

Future<bool> updateStatus( WidgetTester tester ) async {
   final Finder update = find.byKey( const Key('Update Status?' ));
   await tester.tap( update );
   await pumpSettle( tester, 5 ); // Need time to get peq data from host
   await tester.pumpAndSettle();
   return true;
}

Future<bool> setTestLock( WidgetTester tester, fakeState state, val ) async {
   print( "Attempting to lock ceLinkages" );
   var postData = '{"Endpoint": "ceMD", "Request": "setTestLock", "ceProjId": "$CEMD_PROJ_ID", "val": "$val" }'; 
   var response = await postCE( state, postData );
   if( response.statusCode == 401 ) {
      print( "WARNING.  Could not reach ceServer." );
      assert( false );
   }
   bool res = json.decode( utf8.decode( response.bodyBytes ));
   return res;
}

Future<bool> showDetail( WidgetTester tester, { cat = 'toggleGood', ascending = true, col = 'Issue Title', name = 'Snow melt' } ) async {

   print( "Show for " + name + " which is in " + cat + " under " + col + " sorted ascending? " + ascending.toString() );
   
   // open correct status category
   final Finder category = find.byKey( Key( cat ));
   await tester.tap( category );
   await tester.pumpAndSettle();

   // sort
   final Finder column = find.byKey( Key( col ));
   if( ascending ) { expect( await sortAsc(  tester, column ), true ); }
   else            { expect( await sortDesc( tester, column ), true ); }

   // open detail popup
   final Finder peq = find.byKey( Key( name ));
   expect( peq, findsOneWidget );
   await tester.tap( peq );
   await tester.pumpAndSettle();
   await pumpSettle( tester, 2 );

   return true;
}

Future<bool> statusPreRepair( WidgetTester tester ) async {

   print( "\nChecking status pre-repair testing." );
   expect( find.byIcon( Icons.arrow_drop_down ),        findsNWidgets(3) );
   expect( find.byIcon( Icons.arrow_drop_down_circle ), findsNothing );

   // Expand all
   final Finder gone = find.byKey( const Key('toggleGone' ));
   await tester.tap( gone ); // open
   await tester.pumpAndSettle(); 
   expect( find.byIcon( Icons.arrow_drop_down ),        findsNWidgets(2) );
   expect( find.byIcon( Icons.arrow_drop_down_circle ), findsOneWidget );

   final Finder bad = find.byKey( const Key('toggleBad' ));
   await tester.tap( bad ); // open
   await tester.pumpAndSettle(); 
   expect( find.byIcon( Icons.arrow_drop_down ),        findsOneWidget );
   expect( find.byIcon( Icons.arrow_drop_down_circle ), findsNWidgets(2) );

   final Finder good = find.byKey( const Key('toggleGood' ));
   await tester.tap( good ); // open
   await tester.pumpAndSettle(); 
   expect( find.byIcon( Icons.arrow_drop_down ),        findsNothing );
   expect( find.byIcon( Icons.arrow_drop_down_circle ), findsNWidgets(3) );

   // Close all but good
   await tester.tap( gone );      // close
   await tester.pumpAndSettle(); 
   await tester.tap( bad );       // close
   await tester.pumpAndSettle(); 

   // Check sorting on good, ascend.  close.
   final Finder title = find.byKey( const Key( 'Issue Title' ));
   expect( await sortAsc(  tester, title ), true );
   expect( find.byIcon( Icons.arrow_drop_up ),    findsOneWidget );
   await tester.tap( good );       // close
   await tester.pumpAndSettle(); 
   expect( await verifyAssignTest( tester ),      true );
   expect( await verifyBlast1( tester ),          true );
   expect( await verifyBlast2( tester ),          true );
   expect( find.byKey( const Key( 'Snow melt' )), findsNothing );

   // Check sorting on good, descend
   await tester.tap( good );       // open
   await tester.pumpAndSettle(); 
   expect( await sortDesc(  tester, title ), true );
   expect( find.byIcon( Icons.arrow_drop_down ),   findsNWidgets(3) );  // sort, gone, bad
   await tester.tap( good );       // close
   await tester.pumpAndSettle(); 
   expect( await verifySnowMelt( tester ),         true );
   expect( await verifySituatedAccr( tester ),     true );
   expect( await verifyLabelDubs( tester ),        true );
   expect( find.byKey( const Key( 'AssignTest' )), findsNothing );

   // sorts Host Project, just check title.  ascend
   await tester.tap( good );       // open
   await tester.pumpAndSettle();
   final Finder hp = find.byKey( const Key( 'Host Project' ));
   expect( await sortAsc(  tester, hp ), true );
   expect( find.byIcon( Icons.arrow_drop_up ),                      findsOneWidget );
   expect( find.byKey( const Key( 'A Pre-Existing Project Flut' )), findsNWidgets( 4 ));
   expect( find.byKey( const Key( 'Cross Proj' )),                  findsOneWidget );
   expect( find.byKey( const Key( 'Data Security Flut' )),          findsNWidgets(6) );
   expect( find.byKey( const Key( 'UnClaimed' )),                   findsNothing );

   // sorts Host Project, just check title.  descend
   expect( await sortDesc(  tester, hp ), true );
   expect( find.byIcon( Icons.arrow_drop_up ),                      findsNothing );
   expect( find.byKey( const Key( 'A Pre-Existing Project Flut' )), findsNothing);
   expect( find.byKey( const Key( 'Cross Proj' )),                  findsNothing );
   expect( find.byKey( const Key( 'Data Security Flut' )),          findsNothing );
   expect( find.byKey( const Key( 'UnClaimed' )),                   findsAtLeast(8) );
   
   // sorts PEQ, just check title.  ascend
   final Finder peq = find.byKey( const Key( 'PEQ' ));
   expect( await sortAsc(  tester, peq ), true );
   expect( find.byIcon( Icons.arrow_drop_up ), findsOneWidget );
   expect( find.byKey( const Key( '105' )),    findsOneWidget);
   expect( find.byKey( const Key( '250' )),    findsNWidgets(2) );
   expect( find.byKey( const Key( '500' )),    findsNWidgets(4) );
   expect( find.byKey( const Key( '1000' )),   findsNothing );

   // sorts Host Peq, descend
   expect( await sortDesc(  tester, peq ), true );
   expect( find.byIcon( Icons.arrow_drop_up ), findsNothing );
   expect( find.byKey( const Key( '105' )),    findsNothing);
   expect( find.byKey( const Key( '250' )),    findsNothing );
   expect( find.byKey( const Key( '500' )),    findsNothing );
   expect( find.byKey( const Key( '1000' )),   findsAtLeast(8) );

   // sorts Type.  ascend
   final Finder type = find.byKey( const Key( 'Type' ));
   expect( await sortAsc(  tester, type ), true );
   expect( find.byIcon( Icons.arrow_drop_up ),  findsOneWidget );
   expect( find.byKey( const Key( 'grant' )),   findsAtLeast(8) );
   expect( find.byKey( const Key( 'pending' )), findsAtLeast(1) );

   // descend
   expect( await sortDesc(  tester, type ), true );
   expect( find.byIcon( Icons.arrow_drop_up ),  findsNothing );
   expect( find.byKey( const Key( 'grant' )),   findsNothing );
   expect( find.byKey( const Key( 'pending' )), findsNothing );
   expect( find.byKey( const Key( 'plan' )),    findsAtLeast(8) );

   // sorts Assignees.  ascend
   final Finder assn = find.byKey( const Key( 'Assignee(s)' ));
   expect( await sortAsc(  tester, assn ), true );
   expect( find.byIcon( Icons.arrow_drop_up ),                                findsOneWidget );
   expect( find.byKey( const Key( '[]' )),                                    findsNWidgets(4) );
   expect( find.byKey( const Key( '[ariTester, builderCE, connieTester]' )),  findsNWidgets(2) );
   expect( find.byKey( const Key( '[ariTester, builderCE]' )),                findsAtLeast(6) );
   expect( find.byKey( const Key( '[builderCE, connieTester]' )),             findsNothing );

   // descend
   expect( await sortDesc(  tester, assn ), true );
   expect( find.byIcon( Icons.arrow_drop_up ),                    findsNothing );
   expect( find.byKey( const Key( '[]' )),                        findsNothing );
   expect( find.byKey( const Key( '[builderCE]' )),               findsNWidgets(3) );
   expect( find.byKey( const Key( '[builderCE, connieTester]' )), findsNWidgets(2) );

   // Close good.  Can't undo back to original unsorted state
   await tester.tap( good );
   await tester.pumpAndSettle(); 

   return true;
}

// XXX context not used for awsUtils.. kill it.
//  modify accr peq in aws directly, test attempt to rewrite using host - fail.     recover.
Future<bool> statusModAWSAccr( WidgetTester tester ) async {

   print( "\nModify ACCR peq in aws, writeFromHost.  Fail." );
   var state = fakeState( CESERVER_ENDPOINT );

   // Get peq, change it, write it.
   expect( await showDetail( tester, cat: 'toggleGood', col: 'Issue Title', ascending: false, name: 'Snow melt' ), true );
   var peq   = await getPeqFromDetail( tester, state, 'toggleGood' );
   peq[ 'Amount' ] = 1001;
   expect( await writePeq( tester, state, peq ), true );

   // update status, validate
   expect( await updateStatus( tester ), true );
   expect( await statusTabNeedsRepair( tester ), true );   
   expect( await verifySnowMeltBadAmount( tester ), true );

   // Write from host.  Will fail.. accrued.
   expect( await showDetail( tester, cat: 'toggleBad', col: 'Issue Title', ascending: false, name: 'Snow melt' ), true );
   expect( await writeOneFromHost( tester, 'toggleBad' ), true );
   expect( await verifySnowMeltBadAmount( tester ), true );
   
   // Fix accrued snow
   peq[ 'Amount' ] = 1000;
   expect( await writePeq( tester, state, peq ), true );

   // update, verify
   expect( await updateStatus( tester ), true );
   expect( await verifySnowMelt( tester ), true );

   return true;
}

// modify plan peq in aws directly, test attempt to rewrite using host - succeed.  recover.
Future<bool> statusModAWSPlan( WidgetTester tester ) async {
   
   print( "\nModify PLAN peq in aws, writeFromHost." );
   var state = fakeState( CESERVER_ENDPOINT );

   // Get peq, update it, write it.
   expect( await showDetail( tester, cat: 'toggleGood', col: 'Issue Title', ascending: true, name: 'Blast 1' ), true );
   var peq = await getPeqFromDetail( tester, state, 'toggleGood' );
   peq[ 'Amount' ] = 606;
   expect( await writePeq( tester, state, peq ), true );

   // update status, validate
   expect( await updateStatus( tester ), true );
   expect( await statusTabNeedsRepair( tester ), true );   
   expect( await verifyBlast1BadAmount( tester ), true );

   // Write from host.  Will succeed.
   expect( await showDetail( tester, cat: 'toggleBad', col: 'Issue Title', ascending: true, name: 'Blast 1' ), true );
   expect( await writeOneFromHost( tester, 'toggleBad' ), true );
   expect( await verifyBlast1( tester ), true );

   return true;
}

// modify plan peq in aws directly, test attempt to rewrite using aws - succeed.  recover.
// NOTE: when aws rewrites, a new hostIssueId needs to be created, by definition.
//       integration testing has 2 windows running this operation nearly simultaneously.
//       when both run, several ids can be created and mixed up with eachother.
//       No point to untangle - set lock to allow 1 window to operate, only.
Future<bool> statusModHostPlan( WidgetTester tester ) async {

   var state = fakeState( CESERVER_ENDPOINT );

   print( "\nModify PLAN peq on host, writeFromAWS." );
   bool imIt = await setTestLock( tester, state, "true" );
   if( !imIt ) {
      print( "Lock already set, skipping" );
      await pumpSettle( tester, 100 );
      return true;
   }
               
   // Get peq, update it, write it.
   expect( await showDetail( tester, cat: 'toggleGood', col: 'Issue Title', ascending: true, name: 'Blast 1' ), true );
   var peq   = await getPeqFromDetail( tester, state, 'toggleGood' );
   peq[ 'Amount' ] = 606;
   expect( await writePeq( tester, state, peq ), true );

   // update status, validate
   expect( await updateStatus( tester ), true );
   expect( await statusTabNeedsRepair( tester ), true );   
   expect( await verifyBlast1BadAmount( tester ), true );

   // Write from AWS.  Will succeed.
   print( "Updating new value from aws" );
   expect( await showDetail( tester, cat: 'toggleBad', col: 'Issue Title', ascending: true, name: 'Blast 1' ), true );
   expect( await writeOneFromAWS( tester, 'toggleBad' ), true );
   expect( await verifyBlast1( tester, amount: "606" ), true );

   // Recover original state for Blast 1
   print( "Recovering original state" );
   expect( await showDetail( tester, cat: 'toggleGood', col: 'Issue Title', ascending: true, name: 'Blast 1' ), true );
   peq   = await getPeqFromDetail( tester, state, 'toggleGood' );   // NOTE the hostIssueId is now differet.  Get the new data.
   peq[ 'Amount' ] = 604;
   expect( await writePeq( tester, state, peq ), true );

   // ... update, verify
   expect( await updateStatus( tester ), true );
   expect( await statusTabNeedsRepair( tester ), true );

   // ... write from AWS.  Will succeed.
   expect( await showDetail( tester, cat: 'toggleBad', col: 'Issue Title', ascending: true, name: 'Blast 1' ), true );   
   expect( await writeOneFromAWS( tester, 'toggleBad' ), true );
   expect( await verifyBlast1( tester ), true );

   imIt = await setTestLock( tester, state, "false" );
   return imIt;
}


// modify blast1 on ce, delete host.  write back from aws.  then
// modify blast1 on ce, delete ce.  write back from host.  
// NOTE: again, 1 testing window operation, only.  see comments above.
Future<bool> statusModDelete( WidgetTester tester ) async {

   var state = fakeState( CESERVER_ENDPOINT );

   print( "\nModify on CE, delete host, writeFromAWS." );
   bool imIt = await setTestLock( tester, state, "true" );
   if( !imIt ) {
      print( "Lock already set, skipping" );
      await pumpSettle( tester, 190 );
      return true;
   }
               
   // Get peq, update it, write it.
   expect( await showDetail( tester, cat: 'toggleGood', col: 'Issue Title', ascending: true, name: 'Blast 1' ), true );
   var peq   = await getPeqFromDetail( tester, state, 'toggleGood' );
   peq[ 'Amount' ] = 606;
   expect( await writePeq( tester, state, peq ), true );

   // update status, validate
   expect( await updateStatus( tester ), true );
   expect( await statusTabNeedsRepair( tester ), true );   
   expect( await verifyBlast1BadAmount( tester ), true );

   // Delete from host, verify
   expect( await showDetail( tester, cat: 'toggleBad', col: 'Issue Title', ascending: true, name: 'Blast 1' ), true );
   expect( await deleteOneFromHost( tester, 'toggleBad' ), true );
   expect( await statusTabNeedsRepair( tester, deleted: 'host' ), true );   
   expect( await verifyBlast1Deleted( tester, deleted: 'host' ), true );
   
   // Write from AWS.  host & aws consistent, but wrong peq value.
   print( "Recreate from aws" );
   expect( await showDetail( tester, cat: 'toggleBad', col: 'Issue Title', ascending: true, name: 'Blast 1' ), true );
   expect( await writeOneFromAWS( tester, 'toggleBad' ), true );
   expect( await verifyBlast1( tester, amount: "606" ), true );
   
   
   
   // Modify on CE back to good.  writeFromAws. delete aws. writeFromhost.
   print( "\nNext delete from aws, and recover.  First, fix host." );
   
   // Recover original state for Blast 1
   print( "Recovering original state to fix host" );
   expect( await showDetail( tester, cat: 'toggleGood', col: 'Issue Title', ascending: true, name: 'Blast 1' ), true );
   peq   = await getPeqFromDetail( tester, state, 'toggleGood' );   // NOTE the hostIssueId is now differet.  Get the new data.
   peq[ 'Amount' ] = 604;
   expect( await writePeq( tester, state, peq ), true );

   // ... update, verify
   expect( await updateStatus( tester ), true );
   expect( await statusTabNeedsRepair( tester ), true );
   
   // ... write from AWS.  All consistent, and original values.
   expect( await showDetail( tester, cat: 'toggleBad', col: 'Issue Title', ascending: true, name: 'Blast 1' ), true );   
   expect( await writeOneFromAWS( tester, 'toggleBad' ), true );
   expect( await verifyBlast1( tester ), true );

   
   // update aws to bad value, Delete from aws, verify
   print( "break aws" );
   expect( await showDetail( tester, cat: 'toggleGood', col: 'Issue Title', ascending: true, name: 'Blast 1' ), true );
   peq   = await getPeqFromDetail( tester, state, 'toggleGood' );   // NOTE the hostIssueId is now differet.  Get the new data.
   peq[ 'Amount' ] = 606;
   expect( await writePeq( tester, state, peq ), true );
   
   // ... update, verify
   expect( await updateStatus( tester ), true );
   expect( await statusTabNeedsRepair( tester ), true );

   expect( await showDetail( tester, cat: 'toggleBad', col: 'Issue Title', ascending: true, name: 'Blast 1' ), true );
   expect( await deleteOneFromAWS( tester, 'toggleBad' ), true );
   expect( await statusTabNeedsRepair( tester, deleted: 'aws' ), true );   
   expect( await verifyBlast1Deleted( tester, deleted: 'aws' ), true );

   // write good value from host
   print( "Recreate from host" );
   expect( await showDetail( tester, cat: 'toggleBad', col: 'Issue Title', ascending: true, name: 'Blast 1' ), true );
   expect( await writeOneFromHost( tester, 'toggleBad' ), true );
   expect( await verifyBlast1( tester, amount: "604" ), true );
   
   imIt = await setTestLock( tester, state, "false" );
   return imIt;
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
         expect( await statusTabFraming( tester ), true );

         expect( await statusPreRepair( tester ), true );

         // Snow Melt, from host
         expect( await statusModAWSAccr( tester ), true );

         // Blast 1, from host
         expect( await statusModAWSPlan( tester ), true );

         // Blast 1, from aws
         expect( await statusModHostPlan( tester ), true );

         // Delete testing, host and aws
         expect( await statusModDelete( tester ), true );
         
         // test statusUnavailable
         // make 1 aws peq, make separate gh peq (make normal, then rem aws part?  or just remove aws part?)
         // test overwrite 1, all on both ends.  Can 'make' by destroying a bit..
         // make error with existing both, aws-only, host-only
         // test each missing notification case + repair.  oi.
         
         await logout( tester );         

         report( 'Repair' );
      });

}
     
