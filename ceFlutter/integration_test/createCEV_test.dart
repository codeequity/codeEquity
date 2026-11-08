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

Future<bool> verifyCEVProfile( tester, cev, descr, web, { hasName = false, hasEA = false} ) async {
   if( !hasName ) {
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

   String disable = " disabled";
   if( !hasName ) {
      expect( find.byKey( Key( "Edit profile" )),                        findsOneWidget );   
      expect( find.byKey( Key( "Build Initial Equity Plan" + disable )), findsOneWidget );
      expect( find.byKey( Key( "Dissolve" + disable )),                  findsOneWidget );
      expect( find.byKey( Key( "Equity Agreement" )),                    findsOneWidget );
      expect( find.byKey( Key( "Initialize" + disable )),                findsOneWidget );
   }
   else if( !hasEA ) {
      expect( find.byKey( Key( "Edit profile" )),                        findsOneWidget );   
      expect( find.byKey( Key( "Build Initial Equity Plan" + disable )), findsOneWidget );
      expect( find.byKey( Key( "Dissolve" )),                            findsOneWidget );
      expect( find.byKey( Key( "Equity Agreement" )),                    findsOneWidget );
      expect( find.byKey( Key( "Initialize" )),                          findsOneWidget );
   }
   else {
      expect( find.byKey( Key( "Edit profile" )),                        findsOneWidget );   
      expect( find.byKey( Key( "Build Initial Equity Plan" )),           findsOneWidget );
      expect( find.byKey( Key( "Dissolve" )),                            findsOneWidget );
      expect( find.byKey( Key( "Initialize" )),                          findsOneWidget );
   }
      
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
      expect( await( verifyCEVProfile( tester, "", "", "" )), true );
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

   expect( await verifyCEVProfile( tester, cev, descr, web, hasName: true ), true );

   return true;
}

Future<bool> addEquityPlan( tester, String cev, { useDefault = true } ) async {
   expect( await goCEV( tester, cev ), true );

   Finder bep = find.byKey( Key( "Build Initial Equity Plan" ));
   expect( bep, findsOneWidget );
   await tester.tap( bep );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( find.text( cev ), findsOneWidget );
   expect( find.textContaining( "strawman equity plan" ), findsOneWidget );
   expect( find.text( "Category" ), findsOneWidget );
   expect( find.text( "Associated host project name" ), findsOneWidget );
   expect( find.text( "Allocation" ), findsOneWidget );
   expect( find.text( "Rearrange" ), findsOneWidget );
   expect( find.text( "0" ), findsOneWidget );   

   if( useDefault ) {
      Finder here = find.byKey( Key( "here" ) );
      expect( here, findsOneWidget );
      await tester.tap( here );
      await tester.pumpAndSettle();
      await tester.pumpAndSettle();
      
      expect( find.text("20,000,000"), findsOneWidget );
      expect( find.text("Founders grants"), findsOneWidget );
      expect( find.text("Host platform ops"), findsOneWidget );
      expect( find.text("Cloud platform ops"), findsOneWidget );
   }
   return true;
}

Future<bool> viewEA( tester, String cev, String descr, String web ) async {
   expect( await goCEV( tester, cev ), true );
   
   Finder bep = find.byKey( Key( "Equity Agreement" ));
   expect( bep, findsOneWidget );
   await tester.tap( bep );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( find.text( "View the Equity Agreement" ), findsOneWidget );
   expect( find.textContaining( "must sign the Equity Agreement" ), findsOneWidget );
   
   Finder view = find.byKey( Key( "confirmContinue" ));
   expect( view, findsOneWidget );
   await tester.tap( view );
   await pumpSettle( tester, 2, verbose: true );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( find.textContaining( "Provisional Company" ), findsAtLeast(1) );
   expect( find.textContaining( "Software Contributions" ), findsAtLeast(1) );
   
   Finder dismiss = find.byKey( Key( "Dismiss" ));
   expect( dismiss, findsOneWidget );
   await tester.tap( dismiss );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( await verifyCEVProfile( tester, cev, descr, web, hasName: true, hasEA: true ), true );

   return true;
}

Future<bool> verifyCEPProfile( tester, String cev, {hasName=false} ) async {
   if( !hasName ) {
      expect( find.textContaining( "Welcome to your new Project" ), findsOneWidget );
      expect( find.text( "(No name yet)" ), findsOneWidget );
      expect( find.textContaining( cev ), findsOneWidget );
      expect( find.textContaining( "Adding repositories connects" ), findsOneWidget );
   }

   expect( find.byKey( const Key( "Venture Equity Plan PEQs:" )), findsOneWidget );   
   expect( find.byKey( const Key( "Collaborators" )), findsOneWidget );   
   expect( find.byKey( const Key( "Host Platform: " )), findsOneWidget );   

   String disable = " disabled";
   if( !hasName ) {
      expect( find.byKey( Key( "Edit profile" )),                        findsOneWidget );   
      expect( find.byKey( Key( "Dissolve" + disable )),                  findsOneWidget );
      expect( find.byKey( Key( "Initialize" + disable )),                findsOneWidget );
   }
      
   return true;
}


Future<bool> verifyCEPLinks( tester, String cev, String cep ) async {
   if( cep == "" ) {
      // Home -> proj prof page
      expect( await goHome( tester ), true );
      expect( find.text( cev ), findsOneWidget );
      // Finder hlink = find.text( "<No CodeEquity Project yet>" );
      expect( await tapit( tester, find.text( "(No name yet)" ), 1 ), true );
      expect( await verifyCEPProfile( tester, cev ), true );
      // expect( find.textContaining( "This CodeEquity Project hasn\'t been initialized yet" ), findsOneWidget );

      // ari profile proj -> proj prof page
      expect( await goAri( tester ), true );
      expect( await tapit( tester, find.text( "(No name yet)" ), 1 ), true );
      expect( await verifyCEPProfile( tester, cev ), true );
      expect( await goAri( tester ), true );
      expect( await tapit( tester, find.text( cev ), 1 ), true );
      expect( find.text( "Collaborator Roles within this Venture" ), findsOneWidget );

      // venture profile -> proj prof page
      expect( await tapit( tester, find.text( "(No name yet)" ), 1 ), true );
      expect( await verifyCEPProfile( tester, cev ), true );

      // XXX peq summary 
   }
   return true;
}

Future<bool> createEmptyCEP( tester, String cev ) async {
   expect( await goCEV( tester, cev ), true );

   Finder init = find.byKey( Key( "Initialize" ));
   expect( init, findsOneWidget );
   await tester.tap( init );
   await tester.pumpAndSettle();
   await tester.pumpAndSettle();

   expect( await verifyCEPProfile( tester, cev ), true );
   expect( await verifyCEPLinks( tester, cev, "" ), true );
   return true;
}

Future<bool> createCEP( tester, String cev ) async {
   await createEmptyCEP( tester, cev );
   
   return true;
}

Future<bool> createCEV( tester, String cev, String descr, String web, { newUser = true, defaultEquity = true, initCEP = true } ) async {
   expect( await createEmptyCEV( tester, newUser ), true );
   expect( await editCEVProfile( tester, cev, descr, web ), true );
   expect( await viewEA( tester, cev, descr, web ), true );
   expect( await addEquityPlan( tester, cev ), true );

   expect( await createCEP( tester, cev ), true );
   
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
     
