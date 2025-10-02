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


Future<bool> statusPostTesting( WidgetTester tester ) async {
   
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
         await pumpSettle( tester, 5, verbose: true ); 
         await pumpSettle( tester, 3, verbose: true ); 

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
     
