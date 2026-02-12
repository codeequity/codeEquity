@Timeout(Duration(minutes: 25))

import 'dart:convert';  // json encode/decode
import 'dart:async';    // timer

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart'; // key
import 'package:fluttertoast/fluttertoast.dart';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:ceFlutter/utils/ceUtils.dart' hide logout; // ONLY getToday
import 'utils.dart';

const TEST = false;


/* 
   This type of test has significant pros and cons.
   Good: test what user sees.  this may be better than good - like critical.
   Bad:  highly dependent on widget construction
   Example: we test equity line drag and etc. with fixed offset drags.
            these drags attempt to replicate what a user sees.
            As currently implemented, if window size breaks, or row spacing changes, the offsets may break as well.
*/


Future<bool> validateAriFillProfile( tester ) async {

   final Finder editProf = find.byKey( const Key('Complete profileGD'));
   expect( editProf, findsOneWidget );

   await tester.tap( editProf );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   
   expect( await verifyAriEditProfile( tester ), true );

   // Test is only modding phone
   final Finder editPhone = find.byKey( const Key('editForm Phone'));
   expect( editPhone, findsOneWidget );

   await tester.enterText( editPhone, "1 111-222-3333" );   

   final Finder saveProf = find.byKey( const Key('Save'));
   expect( saveProf, findsOneWidget );

   await tester.tap( saveProf );
   await pumpSettle( tester, 2 );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   
   return true;
}

Future<bool> validateAriAcceptPrivacy( tester ) async {

   final Finder privacy = find.byKey( const Key( "Privacy Notice" ));
   expect( privacy, findsOneWidget );

   await tester.tap( privacy );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( find.text( "Privacy Statement" ), findsOneWidget );
   expect( find.text( "Accept Statement" ), findsOneWidget );
   expect( find.text( "Dismiss" ), findsOneWidget );

   final Finder accept = find.byKey( const Key( 'Accept' ));
   expect( accept, findsOneWidget );
   
   await tester.tap( accept );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   
   return true;
}

Future<bool> verifyPreambleEdit( tester ) async {
   expect( find.text("Partner's Title"),   findsOneWidget );
   expect( find.text("Collaborator" ),     findsOneWidget );
   expect( find.text("Founder" ),          findsOneWidget );
   expect( find.text("Confirm" ),          findsOneWidget );
   expect( find.text("Cancel" ),           findsOneWidget );

   final Finder collab  = find.byKey( const Key( "Collaborator" ) );
   final Finder founder = find.byKey( const Key( "Founder" ) );
   expect( collab, findsOneWidget );
   expect( founder, findsOneWidget );
   return true;
}

Future<bool> verifyPartnerSigEdit( tester ) async {
   expect( find.text("Partner Signature Page"),   findsOneWidget );
   expect( find.textContaining( "review and counter-signature" ), findsOneWidget );
   expect( find.text("PartnerPhone" ),     findsOneWidget );
   expect( find.text("PartnerSignature" ),          findsOneWidget );
   expect( find.text("PartnerMailingAddress" ),          findsOneWidget );
   expect( find.text("1 111-222-3333" ),          findsOneWidget );
   expect( find.text("(type your full legal name)" ),          findsOneWidget );
   expect( find.text("Save" ),          findsOneWidget );
   expect( find.text("Cancel" ),           findsOneWidget );

   final Finder save  = find.byKey( const Key( "Save" ) );
   final Finder cancel = find.byKey( const Key( "Cancel" ) );
   expect( save, findsOneWidget );
   expect( cancel, findsOneWidget );
   return true;
}

Future<bool> validatePartnerSig( tester ) async {
   // Phone is filled already.
   final Finder sig = find.byKey( const Key( "editRow (type your full legal name)" ));
   expect( sig, findsOneWidget );
   tester.enterText( sig, "Ari Star" );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   
   final Finder save  = find.byKey( const Key( "Save" ) );
   expect( save, findsOneWidget );
   await tester.tap( save );
   await pumpSettle( tester, 2 );
   await tester.pumpAndSettle();

   return true;
}

Future<bool> validateAriRegister( tester ) async {
   expect( find.text( 'Ventures & Projects' ), findsOneWidget );

   final Finder tVent = find.byKey( const Key( "toggleRegister" ));
   expect( tVent, findsOneWidget );

   await tester.tap( tVent );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   final Finder reg = find.byKey( const Key( "Register with a Venture" ));
   expect( reg, findsOneWidget );

   await tester.tap( reg );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   String hint    = "Search is available if you need a hint";
   final String keyName = "editRow " + hint;
   expect( find.text( "Choose the CodeEquity Venture you wish to register with" ), findsOneWidget );
   expect( find.text( "Venture name" ), findsOneWidget );
   expect( find.text( hint ),     findsOneWidget );
   expect( find.text( "Select" ), findsOneWidget );
   expect( find.text( "Cancel" ), findsOneWidget );
   
   // bad key name
   final Finder choose = find.byKey( Key( keyName ));
   expect( choose, findsOneWidget );
   await tester.enterText( choose, CEMD_VENT_NAME );      
   
   final Finder select = find.byKey( const Key( "Select" ));
   expect( select, findsOneWidget );

   await tester.tap( select );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   // Agreement should now be showing.  No connie, most ari
   final Finder doc = find.byKey( const Key( "Equity Agreement" ));
   expect( doc, findsOneWidget );
   expect( find.textContaining( getToday() ),                       findsNothing );
   expect( find.textContaining( "rmusick+connieTester@gmail.com" ), findsNothing );
   expect( find.textContaining( "Connie Star" ),                    findsNothing );
   expect( find.textContaining( CEMD_VENT_NAME ),                   findsNWidgets(2) );
   expect( find.textContaining( "http://www.codeequity.org" ),      findsNWidgets(1) );
   expect( find.textContaining( "Ari Star" ),                       findsNWidgets(2) );  // 2 locations
   expect( find.textContaining( "rmusick+ariTester@gmail.com" ),    findsNWidgets(2) );
   expect( find.textContaining( "Contributor of the Venture" ),     findsOneWidget );
   expect( find.textContaining( "Founder of the Venture" ),         findsNothing );


   final scroll = find.byKey( const Key( "scrollDoc" ) );
   expect( scroll, findsOneWidget );
   await tester.drag( scroll, Offset(0.0, -100.0) );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( await verifyPreambleEdit( tester ), true );
   final Finder founder = find.byKey( const Key( "Founder" ) );
   expect( founder, findsOneWidget );
   await tester.tap( founder );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   final Finder confirm = find.byKey( const Key( "Confirm" ) );
   expect( confirm, findsOneWidget );
   await tester.tap( confirm );
   await pumpSettle( tester, 2 );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( find.textContaining( "Contributor of the Venture" ),     findsNothing );
   expect( find.textContaining( "Founder of the Venture" ),         findsOneWidget );

   // dismiss 2nd preamble popup
   await tester.drag( scroll, Offset(0.0, -100.0) );
   final Finder cancel = find.byKey( const Key( "Cancel" ) );
   expect( cancel, findsOneWidget );
   await tester.tap( cancel );
   await pumpSettle( tester, 1 );
   await tester.pumpAndSettle();
   
   await tester.drag( scroll, Offset(0.0, -2000.0) );
   await tester.drag( scroll, Offset(0.0, -2000.0) );
   await tester.drag( scroll, Offset(0.0, -2000.0) );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( await verifyPartnerSigEdit( tester ), true );
   expect( await validatePartnerSig( tester ), true );

   expect( find.textContaining( "submitted for counter" ), findsOneWidget );
   
   return true;
}

Future<bool> validateAriWithdraw( tester ) async {
   expect( find.text( 'Ventures & Projects' ), findsOneWidget );

   final Finder tVent = find.byKey( const Key( "toggleRegister" ));
   expect( tVent, findsOneWidget );

   await tester.tap( tVent );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   final Finder withdraw = find.byKey( const Key( "Withdraw" ));
   expect( withdraw, findsOneWidget );

   await tester.tap( withdraw );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   
   expect( find.text( "Withdraw from CodeEquity?" ), findsOneWidget );
   final Finder cont = find.byKey( const Key( "confirmContinue" ));
   final Finder dism = find.byKey( const Key( "cancelContinue" ));
   expect( cont, findsOneWidget );
   expect( dism, findsOneWidget );
   
   await tester.tap( cont );
   await pumpSettle( tester, 3 );
   await tester.pumpAndSettle();

   return true;
}

void main() {

   String repo = "codeequity/ceFlutterTester";
   
   // final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized() as IntegrationTestWidgetsFlutterBinding;
   IntegrationTestWidgetsFlutterBinding.ensureInitialized();

   // bool skip = true;
   bool skip = false;

   // override?  Run it.
   var override = const String.fromEnvironment('override');
   if( override == "True" ) { skip = false; }
   
   report( 'Onboard', group:true );

   print( "Basics" );
   // testWidgets('Onboard basics', skip:true, (WidgetTester tester) async {
   testWidgets('Onboard basics', skip:skip, (WidgetTester tester) async {

         await restart( tester );
         await login( tester, true );

         // This controls driver window size.  Driven window size is set on command line to flutter driver
         tester.binding.window.physicalSizeTestValue = const Size(1200, 1065);

         expect( await verifyAriHome( tester ), true );

         expect( await validateAriWithdraw( tester ), true );  // start from scratch
         await login( tester, true );
         expect( await verifyAriHome( tester ), true );
         
         expect( await verifyActivityStart( tester ), true );
         expect( await validateAriFillProfile( tester ), true );

         expect( await verifyActivityStart( tester, profile: "complete" ), true );
         expect( await validateAriAcceptPrivacy( tester ), true );

         expect( await verifyActivityStart( tester, profile: "complete", privacy: "complete" ), true );
         expect( await validateAriRegister( tester ), true );

         expect( await verifyActivityStart( tester, profile: "complete", privacy: "complete" ), true );





         expect( await validateAriWithdraw( tester ), true );

         await login( tester, true );
         expect( await verifyActivityStart( tester ), true );
         
         await logout( tester );         

         report( 'Onboard basics' );
      });

}
     
