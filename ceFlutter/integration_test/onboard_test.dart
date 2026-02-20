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

Future<bool> toggleVnP( tester ) async {
   expect( find.text( 'Ventures & Projects' ), findsOneWidget );

   final Finder tVent = find.byKey( const Key( "toggleRegister" ));
   expect( tVent, findsOneWidget );

   await tester.tap( tVent );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   return true;
}

Future<bool> togglePending( tester ) async {
   expect( find.text( 'Pending tasks' ), findsOneWidget );

   final Finder tPend = find.byKey( const Key( "togglePending" ));
   expect( tPend, findsOneWidget );

   await tester.tap( tPend );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   return true;
}

Future<bool> popRegVenture( tester ) async {
   final Finder reg = find.byKey( const Key( "Register with a Venture" ));
   expect( reg, findsOneWidget );

   await tester.tap( reg );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   return true;
}

Future<bool> save( tester ) async {
   final Finder save  = find.byKey( const Key( "Save" ) );
   expect( save, findsOneWidget );
   await tester.tap( save );
   await pumpSettle( tester, 2 );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   return true;
}

Future<bool> dismiss( tester ) async {
   final Finder dismiss  = find.byKey( const Key( "Dismiss" ) );
   expect( dismiss, findsOneWidget );
   await tester.tap( dismiss );
   await pumpSettle( tester, 1 );
   await tester.pumpAndSettle();
   return true;
}
   
Future<bool> openApplied( tester ) async {
   final Finder app = find.byKey( const Key( "Ari Star has applied to CE_Flut TestGD" ));
   expect( app, findsOneWidget );

   await tester.tap( app );
   await pumpSettle( tester, 1 );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   return true;
}

Future<bool> openProfile( tester ) async {

   final Finder editProf = find.byKey( const Key('Complete profileGD'));
   expect( editProf, findsOneWidget );

   await tester.tap( editProf );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   
   expect( await verifyAriEditProfile( tester ), true );
   return true;
}

Future<bool> editPhone( tester, String phone ) async {
   final Finder editPhone = find.byKey( const Key('editForm Phone'));
   expect( editPhone, findsOneWidget );

   await tester.enterText( editPhone, phone );   

   expect( await save( tester ), true );
   return true;
}

Future<bool> validateAriFillProfile( tester ) async {

   expect( await openProfile( tester ), true );

   // Test is only modding phone
   expect( await editPhone( tester, "1 111-222-3333" ), true );
   
   return true;
}

Future<bool> validateAriAcceptPrivacy( tester ) async {

   final Finder privacy = find.byKey( const Key( "Privacy Notice" ));
   expect( privacy, findsOneWidget );

   await tester.tap( privacy );
   await pumpSettle( tester, 1 );
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

Future<bool> validateAriRejectPrivacy( tester ) async {

   final Finder privacy = find.byKey( const Key( "Privacy Notice" ));
   expect( privacy, findsOneWidget );

   await tester.tap( privacy );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( find.text( "Privacy Statement" ), findsOneWidget );
   expect( find.text( "Accept Statement" ), findsOneWidget );
   expect( find.text( "Dismiss" ), findsOneWidget );

   expect( await dismiss( tester ), true );
   
   return true;
}

Future<bool> verifyPreambleComplete( tester, {founder=true} ) async {
   // Agreement should now be showing
   final Finder doc = find.byKey( const Key( "Equity Agreement" ));
   expect( doc, findsOneWidget );
   expect( find.textContaining( getToday() ),                       findsOneWidget );
   expect( find.textContaining( "rmusick+connieTester@gmail.com" ), findsNWidgets(2) );
   expect( find.textContaining( "Connie Star" ),                    findsNWidgets(2) );
   expect( find.textContaining( CEMD_VENT_NAME ),                   findsAtLeast(2) );
   expect( find.textContaining( "http://www.codeequity.org" ),      findsNWidgets(1) );
   expect( find.textContaining( "Ari Star" ),                       findsAtLeast(2) );
   expect( find.textContaining( "rmusick+ariTester@gmail.com" ),    findsAtLeast(2) );
   if( founder ) {
      expect( find.textContaining( "Contributor of the Venture" ),     findsNothing );
      expect( find.textContaining( "Founder of the Venture" ),         findsOneWidget );
   }
   else {
      expect( find.textContaining( "Contributor of the Venture" ),     findsOneWidget );
      expect( find.textContaining( "Founder of the Venture" ),         findsNothing );
   }
   return true;
}

Future<bool> verifyPreambleEdit( tester ) async {
   expect( find.text("Partner's Title"),   findsOneWidget );
   expect( find.text("Contributor" ),     findsOneWidget );
   expect( find.text("Founder" ),          findsOneWidget );
   expect( find.text("Confirm" ),          findsOneWidget );
   expect( find.text("Cancel" ),           findsOneWidget );

   final Finder collab  = find.byKey( const Key( "Contributor" ) );
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

Future<bool> partnerSig( tester, String psig ) async {
   // Phone is filled already.
   final Finder sig = find.byKey( const Key( "editRow (type your full legal name)" ));
   expect( sig, findsOneWidget );
   await tester.enterText( sig, psig );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   
   expect( await save( tester ), true );

   return true;
}

Future<bool> verifyExecSigEdit( tester ) async {
   expect( find.text("Executive Signature Page"),   findsOneWidget );
   expect( find.textContaining( "verify Partner Title is correct" ), findsOneWidget );
   expect( find.text("ExecutivePhone" ),                             findsOneWidget );
   expect( find.text("ExecutiveSignature" ),                         findsOneWidget );
   expect( find.text("ExecutiveMailingAddress" ),                    findsOneWidget );
   expect( find.text("(type your full legal name)" ),                findsOneWidget );
   expect( find.text("Save" ),                                       findsOneWidget );
   expect( find.text("Cancel" ),                                     findsOneWidget );

   final Finder save  = find.byKey( const Key( "Save" ) );
   final Finder cancel = find.byKey( const Key( "Cancel" ) );
   expect( save, findsOneWidget );
   expect( cancel, findsOneWidget );
   return true;
}

Future<bool> verifyExecSig( tester ) async {
   expect( find.textContaining( "By (signature): Connie Star" ), findsOneWidget );
   return true;
}

Future<bool> verifyPartnerSig( tester ) async {
   expect( find.textContaining( "By (signature): Ari Star" ), findsOneWidget );
   return true;
}

Future<bool> execSig( tester, String esig, {ptitle="Founder"}) async {
   // Phone is filled already.
   final Finder sig = find.byKey( const Key( "editRow (type your full legal name)" ));
   expect( sig, findsOneWidget );
   await tester.enterText( sig, esig );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   
   expect( await save( tester ), true );

   if( esig == "Connie Star" ) {
      expect( await verifyPreambleComplete( tester, founder: ptitle == "Founder" ), true );
      expect( await verifyExecSig( tester ), true );
      expect( await verifyPartnerSig( tester ), true );
   }

   expect( await dismiss( tester ), true );
   
   return true;
}

// NOTE: full doc text is 30k.. if finder were text, wont find a word.. if textContaining, would not scroll..
// only works because edit sections are popups.
Future<bool> findSignatureSection( tester, String finder ) async {

   final scroll = find.byKey( const Key( "scrollDoc" ) );
   expect( scroll, findsOneWidget );

   final Finder sigSection = find.text( finder );

   for( int i = 0; i < 100; i++ ) {
      // Oddly, if don't drag first, can't scroll
      await tester.drag( scroll, Offset(0.0, -200.0) );
      await tester.pumpAndSettle();
      try{
         expect( sigSection, findsOneWidget );
         break;
      }
      catch(e){
         continue;
      }
   }

   /*
   // XXX This will sometimes pop the dialog, hiding the doc, preventing sigSection to be found, triggering another drag, but window is blocked.
   // ..... or .. not
   await tester.dragUntilVisible( sigSection, scroll, Offset(0.0, -200.0) );
   await tester.drag( scroll, Offset(0.0, -100.0) );
   */

   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   return true;
}

Future<bool> registerVenture( tester, String cevName, {editing = false} ) async {
   expect( find.text( 'Ventures & Projects' ), findsOneWidget );

   expect( await( toggleVnP( tester )), true );
   expect( await( popRegVenture( tester )), true );
   
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
   await tester.enterText( choose, cevName );
   
   final Finder select = find.byKey( const Key( "Select" ));
   expect( select, findsOneWidget );

   await tester.tap( select );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   // extra dialog to work with for partner
   if( editing ) {
      expect( find.text( "More Edits?" ), findsOneWidget );
      expect( find.textContaining( "Do you want to edit it?" ), findsOneWidget );
      final Finder cont = find.byKey( const Key( "confirmContinue" ) );
      expect( cont, findsOneWidget );
      await tester.tap( cont ); 
      await tester.pumpAndSettle();
      await tester.pumpAndSettle();
   }

   return true;
}

Future<bool> verifyEquityInit( tester ) async {
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
   return true;
}

Future<bool> chooseTitle( tester, String atitle, {alreadyValid = false } ) async {

   final scroll = find.byKey( const Key( "scrollDoc" ) );
   expect( scroll, findsOneWidget );
   await tester.drag( scroll, Offset(0.0, -100.0) );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( await verifyPreambleEdit( tester ), true );
   final Finder title = find.byKey( Key( atitle ) );
   expect( title, findsOneWidget );
   await tester.tap( title );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   final Finder confirm = find.byKey( const Key( "Confirm" ) );
   expect( confirm, findsOneWidget );
   await tester.tap( confirm );
   await pumpSettle( tester, 2 );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   if( !alreadyValid ) {
      if( atitle == "Founder" ) {
         expect( find.textContaining( "Contributor of the Venture" ),     findsNothing );
         expect( find.textContaining( "Founder of the Venture" ),         findsOneWidget );
      }
      else if( atitle == "Contributor" ) {
         expect( find.textContaining( "Contributor of the Venture" ),     findsOneWidget );
         expect( find.textContaining( "Founder of the Venture" ),         findsNothing );
      }
      else {
         expect( true, false );
      }
      
      // dismiss 2nd preamble popup
      await tester.drag( scroll, Offset(0.0, -100.0) );
      await tester.pumpAndSettle();
      await tester.pumpAndSettle();
      
      final Finder cancel = find.byKey( const Key( "Cancel" ) );
      expect( cancel, findsOneWidget );
      await tester.tap( cancel );
      await pumpSettle( tester, 1 );
      await tester.pumpAndSettle();
   }

   return true;
}

Future<bool> validateAriRegister( tester ) async {

   expect( await registerVenture( tester, CEMD_VENT_NAME ), true );
   expect( await verifyEquityInit( tester ), true );

   // Pick founder
   expect( await chooseTitle( tester, "Founder" ), true );

   expect( await findSignatureSection( tester, "PartnerSignature" ), true );

   expect( await verifyPartnerSigEdit( tester ), true );
   expect( await partnerSig( tester, "Ari Star" ), true );

   expect( await toggleVnP( tester ), true );
   
   // Toast shows here, hard to catch
   
   return true;
}

Future<bool> failAriRegister( tester ) async {

   expect( await registerVenture( tester, CEMD_VENT_NAME ), true );
   expect( await verifyEquityInit( tester ), true );

   // Pick founder
   expect( await chooseTitle( tester, "Founder" ), true );

   expect( await findSignatureSection( tester, "PartnerSignature" ), true );

   expect( await verifyPartnerSigEdit( tester ), true );
   expect( await partnerSig( tester, "Ari str" ), true );

   // Toast shows here, hard to catch

   expect( await dismiss( tester ), true );
   expect( await toggleVnP( tester ), true );
   
   return true;
}

Future<bool> editAriTitle( tester, String title ) async {

   expect( await registerVenture( tester, CEMD_VENT_NAME, editing: true ), true );

   // sets title, and with edit after valid submission, simply re-submits
   expect( await chooseTitle( tester, title, alreadyValid: true ), true );

   expect( await toggleVnP( tester ), true );
   
   return true;
}

Future<bool> validateAriWithdraw( tester ) async {
   expect( find.text( 'Ventures & Projects' ), findsOneWidget );

   expect( await( toggleVnP( tester )), true );

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

Future<bool> validateConCounter( tester, {ptitle = "Founder"} ) async {
   expect( await( verifyConnieHome( tester )), true );

   expect( await( togglePending( tester )), true );
   expect( await( openApplied( tester )), true );
   expect( await( findSignatureSection( tester, "ExecutiveSignature" )), true );

   expect( await verifyExecSigEdit( tester ), true );
   expect( await execSig( tester, "Connie Star", ptitle: ptitle ), true );

   expect( await togglePending( tester ), true );
   
   return true;
}

Future<bool> execReject( tester ) async {
   expect( await( verifyConnieHome( tester )), true );

   expect( await( togglePending( tester )), true );
   expect( await( openApplied( tester )), true );

   final Finder reject  = find.byKey( const Key( "Reject" ) );
   expect( reject, findsOneWidget );
   await tester.tap( reject );
   await pumpSettle( tester, 1 );
   await tester.pumpAndSettle();

   expect( await togglePending( tester ), true );
   
   return true;
}

Future<bool> failConCounter( tester ) async {
   expect( await( verifyConnieHome( tester )), true );

   expect( await( togglePending( tester )), true );
   expect( await( openApplied( tester )), true );
   expect( await( findSignatureSection( tester, "ExecutiveSignature" )), true );

   expect( await verifyExecSigEdit( tester ), true );
   expect( await execSig( tester, "Connie Sa" ), true );

   expect( await togglePending( tester ), true );
   
   return true;
}

// msg contains toast expectation - but so far not tested for (need key)
Future<bool> noDoc( tester, String msg ) async {
   final Finder doc = find.byKey( const Key( "Equity Agreement" ));
   try{ 
      expect( doc, findsOneWidget );
      expect( true, false );
   }
   catch(e) { }
   print( "No doc showing, " + msg );
   return true;
}

Future<bool> docAvailable( tester ) async {
   expect( await registerVenture( tester, CEMD_VENT_NAME ), true );
   
   final Finder doc = find.byKey( const Key( "Equity Agreement" ));
   try{       expect( doc, findsOneWidget ); }
   catch(e) { expect( true, false ); }

   expect( await dismiss( tester ), true );

   expect( await toggleVnP( tester ), true );
   
   return true;
}

Future<bool> verifyAriRegistered( tester ) async {

   expect( await registerVenture( tester, CEMD_VENT_NAME ), true );
   expect( await noDoc( tester, "already registered" ), true );

   return true;
}

Future<bool> verifyRole( tester, String role ) async {
   expect( await goAri( tester ), true );

   final Finder vent = find.byKey( const Key( CEMD_VENT_NAME));
   expect( vent, findsOneWidget );
   await tester.tap( vent );
   await pumpSettle( tester, 2 );
   await pumpSettle( tester, 1 );
   await tester.pumpAndSettle();

   expect( find.text( "Ari Star (Ari)" ), findsOneWidget );
   if( role == "Founder" ) {
      expect( find.byKey( Key( TESTER_ID + "ExecutiveCheck") ), findsOneWidget );  // yes
      expect( find.byKey( Key( TESTER_ID + "GrantorNoCheck") ), findsOneWidget );
      expect( find.byKey( Key( TESTER_ID + "MemberNoCheck") ),  findsOneWidget );
   }
   else if( role == "Contributor" ) {
      expect( find.byKey( Key( TESTER_ID + "ExecutiveNoCheck") ), findsOneWidget );
      expect( find.byKey( Key( TESTER_ID + "GrantorNoCheck") ),   findsOneWidget );
      expect( find.byKey( Key( TESTER_ID + "MemberCheck") ),      findsOneWidget ); // yes
   }
   else {
      expect( find.byKey( Key( TESTER_ID + "ExecutiveNoCheck") ), findsOneWidget );
      expect( find.byKey( Key( TESTER_ID + "GrantorNoCheck") ),   findsOneWidget );
      expect( find.byKey( Key( TESTER_ID + "MemberNoCheck") ),    findsOneWidget );
   }
   
   expect( await goHome( tester ), true );
   return true;
}

Future<bool> partnerDirtySubmission( tester ) async {
   await login( tester, true );

   // make sure start from scratch
   expect( await verifyAriHome( tester ), true );
   expect( await validateAriWithdraw( tester ), true );  // start from scratch
   await login( tester, true );
   expect( await verifyAriHome( tester ), true );
   
   // Accept privacy, profile
   print( "Accept basics" );
   expect( await verifyActivityStart( tester ), true );
   expect( await validateAriFillProfile( tester ), true );
   expect( await verifyActivityStart( tester, profile: "complete" ), true );
   expect( await validateAriAcceptPrivacy( tester ), true );
   expect( await verifyActivityStart( tester, profile: "complete", privacy: "complete" ), true );
   
   // Bad ari sig
   print( "Bad ari sig" );
   expect( await failAriRegister( tester ), true );
   expect( await docAvailable( tester ), true );
   
   // Fix sig, submit
   print( "Fix, submit" );
   expect( await validateAriRegister( tester ), true );
   
   // Change to collab (i.e. has doc)
   print( "Edit mailing addr, submit" );
   expect( await editAriTitle( tester, "Contributor" ), true );
   
   await logout( tester );
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

         // make sure start from scratch
         expect( await verifyAriHome( tester ), true );
         expect( await validateAriWithdraw( tester ), true );  // start from scratch
         await login( tester, true );
         expect( await verifyAriHome( tester ), true );
         expect( await verifyRole( tester, "None" ), true );
         
         expect( await verifyActivityStart( tester ), true );
         expect( await validateAriFillProfile( tester ), true );

         expect( await verifyActivityStart( tester, profile: "complete" ), true );
         expect( await validateAriAcceptPrivacy( tester ), true );

         expect( await verifyActivityStart( tester, profile: "complete", privacy: "complete" ), true );
         expect( await validateAriRegister( tester ), true );
         expect( await verifyRole( tester, "None" ), true );

         expect( await verifyActivityStart( tester, profile: "complete", privacy: "complete" ), true );
         await logout( tester );
         await login( tester, true, tester2: true );
         
         expect( await validateConCounter( tester ), true );

         await logout( tester );
         await login( tester, true );
         expect( await verifyAriHome( tester ), true );
         expect( await verifyRole( tester, "Founder" ), true );         
         expect( await verifyAriRegistered( tester ), true );

         await logout( tester );
         report( 'Onboard basics' );
      });

   // Error cases:

   // reject privacy attempt to register
   print( "Reject privacy" );
   //testWidgets('Reject privacy', skip:true, (WidgetTester tester) async {
   testWidgets('Reject privacy', skip:skip, (WidgetTester tester) async {

         await restart( tester );
         await login( tester, true );
         tester.binding.window.physicalSizeTestValue = const Size(1200, 1065);

         // make sure start from scratch
         expect( await verifyAriHome( tester ), true );
         expect( await validateAriWithdraw( tester ), true );  // start from scratch
         await login( tester, true );
         expect( await verifyAriHome( tester ), true );
         
         expect( await verifyActivityStart( tester ), true );
         expect( await validateAriFillProfile( tester ), true );

         expect( await verifyActivityStart( tester, profile: "complete" ), true );
         expect( await validateAriRejectPrivacy( tester ), true );

         expect( await registerVenture( tester, CEMD_VENT_NAME ), true );
         expect( await noDoc( tester, "must complete privacy agmt" ), true );
         
         await logout( tester );
         report( 'Reject privacy' );
      });

   // incomplete profile, attempt to register
   // Profile can't have empty name or email.  There is no error checking on either, so
   // the only useful test right now is to empty the phone.
   print( "Bad profile" );
   //testWidgets('Bad profile', skip:true, (WidgetTester tester) async {
   testWidgets('Bad profile', skip:skip, (WidgetTester tester) async {

         await restart( tester );
         await login( tester, true );
         tester.binding.window.physicalSizeTestValue = const Size(1200, 1065);

         // make sure start from scratch
         expect( await verifyAriHome( tester ), true );
         expect( await validateAriWithdraw( tester ), true );  // start from scratch
         await login( tester, true );
         expect( await verifyAriHome( tester ), true );

         // Accept privacy
         expect( await verifyActivityStart( tester ), true );
         expect( await validateAriAcceptPrivacy( tester ), true );
         expect( await verifyActivityStart( tester, privacy: "complete" ), true );

         // clear phone
         expect( await openProfile( tester ), true );
         expect( await editPhone( tester, "" ), true );
         
         expect( await registerVenture( tester, CEMD_VENT_NAME ), true );
         expect( await noDoc( tester, "must complete profile" ), true );
         
         await logout( tester );
         report( 'Bad profile' );
      });

   // chain of edits, mistakes
   print( "partner sig mistake, Submit, reopen, edit, register, exec mistake sig, accept" );
   //testWidgets('Mistakes accept', skip:true, (WidgetTester tester) async {
   testWidgets('Mistakes accept', skip:skip, (WidgetTester tester) async {

         await restart( tester );
         tester.binding.window.physicalSizeTestValue = const Size(1200, 1065);

         expect( await partnerDirtySubmission( tester ), true );

         await login( tester, true, tester2: true );

         // exec sig bad
         print( "Bad connie sig" );
         expect( await failConCounter( tester ), true );

         // exec good sig
         expect( await validateConCounter( tester, ptitle: "Contributor" ), true );

         // Verify Ari is good
         await logout( tester );
         await login( tester, true );
         expect( await verifyAriHome( tester ), true );
         expect( await verifyRole( tester, "Contributor" ), true );         
         expect( await verifyAriRegistered( tester ), true );
         await logout( tester );

         report( 'Mistakes accept' );
      });


   // chain of edits, mistakes
   print( "partner sig mistake, Submit, reopen, edit, register, exec mistake sig, reject" );
   //testWidgets('Mistakes reject', skip:true, (WidgetTester tester) async {
   testWidgets('Mistakes reject', skip:skip, (WidgetTester tester) async {

         await restart( tester );
         tester.binding.window.physicalSizeTestValue = const Size(1200, 1065);

         expect( await partnerDirtySubmission( tester ), true );

         // Connie
         await login( tester, true, tester2: true );

         // exec reject
         expect( await execReject( tester ), true );

         // Verify Ari registration is gone
         await logout( tester );
         await login( tester, true );
         expect( await verifyAriHome( tester ), true );
         expect( await docAvailable( tester ), true );
         await logout( tester );

         report( 'Mistakes reject' );
      });

   
   // Choose founder, check role in cev
   // Choose collab, check role in cev
}
     
