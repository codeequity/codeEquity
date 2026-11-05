@Timeout(Duration(minutes: 25))

import 'dart:convert';  // json encode/decode
import 'dart:async';    // timer

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart'; // key
import 'package:fluttertoast/fluttertoast.dart';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'utils.dart';

const TEST = false;


/* 
   This type of test has significant pros and cons.
   Good: test what user sees.  this may be better than good - like critical.
   Bad:  highly dependent on widget construction
*/


Future<bool> popCreateVenture( tester ) async {
   print( "Pop create venture" );
   final Finder reg = find.byKey( const Key( "Create a Venture" ));
   expect( reg, findsOneWidget );

   await tester.tap( reg );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   return true;
}


// Stay on activity page start - no profile or privacy.
Future<bool> failCreateCEV( tester, String cev ) async {
   expect( await verifyActivityStart( tester ), true );
   expect( await( toggleVnP( tester )), true );
   expect( await( popCreateVenture( tester )), true );
   expect( await( toggleVnP( tester )), true );
   expect( await verifyActivityStart( tester ), true );
   
   return true;
}

bool verifyRoleVP( tester, String role, String cev ) {
   if( cev != "" ) {
      final Finder vent = find.byKey( Key( cev ));
      expect( vent, findsOneWidget );
   }

   expect( find.text( "Ari Star (Ari)" ), findsOneWidget );
   if( role == "Founder" ) {
      expect( find.byKey( Key( TESTER_ID + "ExecutiveCheck") ), findsOneWidget );
      expect( find.byKey( Key( TESTER_ID + "GrantorNoCheck") ), findsOneWidget );
      expect( find.byKey( Key( TESTER_ID + "MemberNoCheck") ),  findsOneWidget );
   }
   else { return false; }
   return true;
}

Future<bool> verifyCEVProfile( tester, cev, descr, web, {empty = false} ) async {
   if( empty ) {
      expect( find.textContaining( "Welcome to your new Venture" ), findsOneWidget );
      expect( find.textContaining( "to start adding details" ), findsOneWidget );
      expect( find.text( "(No name yet)" ), findsOneWidget );
      expect( find.textContaining( "to add a website" ), findsOneWidget );
   }
   else { 
      expect( find.text( descr ), findsOneWidget );
      expect( find.text( cev ), findsOneWidget );
      expect( find.text( web ), findsOneWidget );
   }

   expect( verifyRoleVP( tester, "Founder", "" ), true );

   expect( find.byKey( const Key( "Venture Equity Plan PEQs:" )), findsOneWidget );   
   expect( find.byKey( const Key( "CEProjects:" )), findsOneWidget );   

   expect( find.byKey( Key( "Edit profile" )),              findsOneWidget );   
   expect( find.byKey( Key( "Build Initial Equity Plan" )), findsOneWidget );

   String disable = empty ? " disabled" : "" ;
   expect( find.byKey( Key( "Dissolve" + disable )),          findsOneWidget );
   expect( find.byKey( Key( "Equity Agreement" + disable )),  findsOneWidget );
   expect( find.byKey( Key( "Initialize" + disable )),        findsOneWidget );
   
   return true;
}


Future<bool> createEmptyCEV( tester, bool newUser ) async {
   if( newUser ) {
      expect( await verifyActivityStart( tester ), true );
      expect( await validateAriFillProfile( tester ), true );
      expect( await verifyActivityStart( tester, profile: "complete" ), true );
      expect( await validateAriAcceptPrivacy( tester ), true );

      expect( await( toggleVnP( tester )), true );
      expect( await( popCreateVenture( tester )), true );
      expect( await( verifyCEVProfile( tester, "", "", "", empty: true )), true );
   }
   else {
      assert( false );
   }
   
   return true;
}

Future<bool> editCEVProfile( tester, String cev, String descr, String web ) async {
   Finder ep = find.byKey( Key( "Edit profile" ));
   expect( ep, findsOneWidget );
   
   await tester.tap( ep );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();
   
   expect( find.text( "Update Venture Profile" ), findsOneWidget );
   expect( find.textContaining( "Name" ), findsOneWidget );   
   expect( find.text( "Description" ), findsOneWidget );   
   expect( find.text( "Website" ), findsOneWidget );   
   expect( find.text( "Save" ), findsOneWidget );   
   expect( find.text( "Cancel" ), findsOneWidget );   
   expect( find.textContaining( "(No name yet)" ), findsAtLeast(2) );
   expect( find.textContaining( "Welcome to your" ), findsAtLeast(2) );
   expect( find.textContaining( "yourVenture" ), findsAtLeast(2) );

   final Finder name = find.byKey( Key( "editRow0" ));
   expect( name, findsOneWidget );
   await tester.enterText( name, cev );
   
   final Finder vdesc = find.byKey( Key( "editRow1" ));
   expect( vdesc, findsOneWidget );
   await tester.enterText( vdesc, descr );
   
   final Finder vweb = find.byKey( Key( "editRow2" ));
   expect( vweb, findsOneWidget );
   await tester.enterText( vweb, web );
   
   final Finder save = find.byKey( Key( "Save" ));
   expect( save, findsOneWidget );
   await tester.tap( save );
   await pumpSettle( tester, 2, verbose: true );    
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( await verifyCEVProfile( tester, cev, descr, web ), true );

   return true;
}

Future<bool> addEquityPlan( tester, String cev, { useDefault = true } ) async {
   expect( await goCEV( tester, cev ), true );

   Finder bep = find.byKey( Key( "Build Initial Equity Plan" ));
   expect( bep, findsOneWidget );
   await tester.tap( bep );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   // look for stuff
   // accept if default or add
   
}

Future<bool> createCEV( tester, String cev, String descr, String web, { newUser = true, defaultEquity = true, initCEP = true } ) async {
   expect( await createEmptyCEV( tester, newUser ), true );
   expect( await editCEVProfile( tester, cev, descr, web ), true );
   // expect( await addEquityPlan( tester, cev ); 
   
   return true;
}


Future<bool> goCEV( tester, String cev ) async {

   try{
      Finder txt = find.text( cev );
      expect( txt, findsOneWidget );
      expect( find.text( "Collaborator Roles within this Venture" ), findsOneWidget );
   }
   catch (e) {
      expect( await goAri( tester ), true );

      Finder cLink = find.text( cev );
      expect( cLink, findsOneWidget );
      await tester.tap( cLink );
      await pumpSettle( tester, 1, verbose: true );
      await pumpSettle( tester, 1, verbose: true );
      await pumpSettle( tester, 1, verbose: true );
      Finder txt = find.text( cev );
      expect( txt, findsOneWidget );
      expect( find.text( "Collaborator Roles within this Venture" ), findsOneWidget );
   }
   
   return true;
   
}


Future<bool> dissolveCEV( tester, String cev ) async {
   expect( await goCEV( tester, cev ), true );

   Finder dissolve = find.byKey( const Key( "Dissolve" ));
   expect( dissolve, findsOneWidget );
   await tester.tap( dissolve );
   await pumpSettle( tester, 2, verbose: true );    
   await tester.pumpAndSettle();

   expect( find.text( "Delete Venture" ), findsOneWidget );
   expect( find.textContaining( "There is no going back" ), findsOneWidget );

   expect( find.byKey( Key( "cancelContinue" )), findsOneWidget );
   Finder cont = find.byKey( Key( "confirmContinue" ));
   expect( cont, findsOneWidget );
   await tester.tap( cont );
   await pumpSettle( tester, 2, verbose: true );    
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( await verifyActivityStart( tester, profile: "complete", privacy: "complete" ), true );
   return true;
}

void main() {

   final cev = "Green tea";
   final cep = "hota wata";
   
   // final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized() as IntegrationTestWidgetsFlutterBinding;
   IntegrationTestWidgetsFlutterBinding.ensureInitialized();

   // bool skip = true;
   bool skip = false;

   // override?  Run it.
   var override = const String.fromEnvironment('override');
   if( override == "True" ) { skip = false; }
   
   report( 'Create CEV/CEP', group:true );

   // Basic flow, create cev.  edit.  create cep.  edit.     SSLL: swap, swap, swap, verify.  logout login verify.    Dissolve.
   //    ari after withdraw
   //    ari already in place
   // Dissolve.
   //    cep first empty
   //    cev first empty
   //    cev with peq  (LATER, AFTER resolve cev w/no cep)
   // partial cev.  SSLL
   //    name, web
   //    equity self
   //    equity default
   // partial cev, partial cep.  SSLL
   //    w/wout equity
   //    name no host
   // partial cev, full cep. SSLL
   //     no equity, full cep.
   
   print( "Basic flow" );
   // testWidgets('Basic flow', skip:true, (WidgetTester tester) async {
   testWidgets('Basic flow', skip:skip, (WidgetTester tester) async {

         await restart( tester );
         await login( tester, true );
         tester.binding.window.physicalSizeTestValue = const Size(1200, 1065);

         // As new user
         expect( await verifyAriHome( tester ), true );
         expect( await validateAriWithdraw( tester ), true );  // start from scratch
         await login( tester, true );
         expect( await verifyAriHome( tester, subset: [] ), true );

         expect( await failCreateCEV( tester, cev ), true );
         expect( await createCEV( tester, cev, "a descr", "a website" ), true );

         // XXX do stuff

         expect( await dissolveCEV( tester, cev), true );

         await logout( tester );
         report( 'Basic flow' );
      });



   /*
   print( "XXX" );
   // testWidgets('XXX', skip:true, (WidgetTester tester) async {
   testWidgets('XXX', skip:skip, (WidgetTester tester) async {

         await restart( tester );
         await login( tester, true );
         tester.binding.window.physicalSizeTestValue = const Size(1200, 1065);

         expect( await verifyAriHome( tester ), true );



         await logout( tester );
         report( 'XXX' );
      });
   */
}
     
