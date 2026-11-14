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
const UNAFFIL1 = "codeequity/unaffiliated";
const UNAFFIL2 = "codeequity/unaffiliated2";

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

   expect( await tapit( tester, find.byKey( Key( "Edit profile" ) ), 0), true );
   
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

Future<bool> editCEPProfile( tester, String cev, String cep ) async {
   expect( await goCEV( tester, cev ), true );
   expect( await tapit( tester, find.text( "(No name yet)" ), 1 ), true );
   expect( await verifyCEPProfile( tester, cev ), true );
   expect( await tapit( tester, find.byKey( Key( "Edit profile" ) ), 0), true );

   expect( find.text( "Update Project Profile" ), findsOneWidget );
   expect( find.textContaining( "Name" ), findsOneWidget );
   expect( find.text( "Description" ), findsOneWidget );
   expect( find.text( "(No name yet)" ), findsAtLeast(2) );
   expect( find.textContaining( "Welcome to your new Project" ), findsAtLeast(2) );

   final Finder name = find.byKey( Key( "input0" ));
   expect( name, findsOneWidget );
   await tester.enterText( name, cep );

   final Finder desc = find.byKey( Key( "input1" ));
   expect( desc, findsOneWidget );
   await tester.enterText( desc, "a proj desc" );

   expect( await tapit( tester, find.byKey( Key( "Save" )), 2 ), true );
   expect( await verifyCEPProfile( tester, cev, hasName: true ), true );
   
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

Future<bool> verifyCEPProfile( tester, String cev, { hasName = false, cep = "", hasOrg = false, fresh = true } ) async {
   expect( find.textContaining( cev ), findsOneWidget );
   if( fresh ) { expect( find.textContaining( "Adding repositories connects" ), findsOneWidget ); }
   else        { expect( find.textContaining( "CE MD App Testing" ), findsOneWidget ); }
      
   if( hasName ) {
      expect( find.text( cep ), findsOneWidget );
      expect( find.textContaining( "a proj desc" ), findsOneWidget );
   }
   else {
      expect( find.text( "(No name yet)" ), findsOneWidget );
      expect( find.textContaining( "Welcome to your new Project" ), findsOneWidget );
   }

   expect( find.byKey( const Key( "Venture Equity Plan PEQs:" )), findsOneWidget );   
   expect( find.byKey( const Key( "Collaborators" )), findsOneWidget );

   if( !hasOrg ) {
      expect( find.byKey( const Key( "Host Platform: " )), findsOneWidget );   
      
      String disable = hasName ? "" : " disabled";
      expect( find.byKey( Key( "Edit profile" )),                        findsOneWidget );   
      expect( find.byKey( Key( "Dissolve" + disable )),                  findsOneWidget );
      expect( find.byKey( Key( "Initialize" + disable )),                findsOneWidget );
   }
   else {
      expect( find.byKey( const Key( "Host Platform: GitHub" )), findsOneWidget );   
      expect( find.byKey( Key( "Edit profile" )),                findsOneWidget );   
      expect( find.byKey( Key( "Dissolve" )),                    findsOneWidget );
      expect( find.byKey( Key( "Add Code Repos" )),              findsOneWidget );

      if( fresh ) { expect( find.text( "Organization: TeaHolics" ), findsOneWidget ); }
      else        { expect( find.text( "Organization: codeequity" ), findsOneWidget ); }
      expect( find.text( "Project management system:" ), findsOneWidget ); 
      expect( find.textContaining( "GH Version 2" ), findsOneWidget ); 
      expect( find.text( "Repositories:" ), findsOneWidget ); 
   }

   return true;
}


Future<bool> verifyCEPLinks( tester, String cev, String cep ) async {
   if( cep == "" ) {
      // Home -> proj prof page
      print( "home cep to proj prof page" );
      expect( await goHome( tester ), true );
      expect( find.text( cev ), findsOneWidget );
      expect( await tapit( tester, find.text( "(No name yet)" ), 1 ), true );
      expect( await verifyCEPProfile( tester, cev ), true );

      // ari profile proj -> proj prof page
      print( "ari prof cep to proj prof page" );
      expect( await goAri( tester ), true );
      expect( await tapit( tester, find.text( "(No name yet)" ), 1 ), true );
      expect( await verifyCEPProfile( tester, cev ), true );

      // ari profile -> venture -> proj prof
      print( "ari prof to venture prof" );
      expect( await goAri( tester ), true );
      expect( await tapit( tester, find.text( cev ), 1 ), true );
      expect( find.text( "Collaborator Roles within this Venture" ), findsOneWidget );
      print( "venture prof cep to proj prof page" );
      expect( await tapit( tester, find.text( "(No name yet)" ), 1 ), true );
      expect( await verifyCEPProfile( tester, cev ), true );

      // peq summary
      print( "peq summary sez uninit" );
      expect( await goHome( tester ), true );      
      expect( await tapit( tester, find.text( cev ), 1 ), true );
      expect( await tapit( tester, find.byKey( const Key('PEQ Summary' )), 0), true );
      expect( find.textContaining( "This CodeEquity Project hasn't been initialized yet" ), findsOneWidget );
      
   }
   return true;
}

Future<bool> createEmptyCEP( tester, String cev ) async {
   print( "create empty cep" );
   expect( await goCEV( tester, cev ), true );
   expect( await tapit( tester, find.byKey( Key( "Initialize" )), 0 ), true );

   expect( await verifyCEPProfile( tester, cev ), true );
   expect( await verifyCEPLinks( tester, cev, "" ), true );
   return true;
}

bool countDD( tester, String key, expectedCount ) {

   Finder dd = find.byKey( Key( key ) );
   expect( dd, findsOneWidget );
   final dropdownWidget = tester.widget<DropdownMenu<String>>(dd);
   final int itemCount = dropdownWidget.dropdownMenuEntries.length;
   expect(itemCount, equals(expectedCount));
   print( "Counting " + key + " " + itemCount.toString() + " " + expectedCount.toString() );
   
   return true;
}

Future<bool> addGitHub( tester, String cev, String cep ) async {
   expect( await goCEP( tester, cep ), true );
   expect( await tapit( tester, find.byKey( Key( "Initialize" )), 0 ), true );

   // radio 1
   expect( find.textContaining( "Choose which Host platform" ), findsOneWidget );
   expect( find.text( "GitHub" ), findsOneWidget );
   expect( find.byKey( Key("Cancel") ), findsOneWidget );
   expect( await tapit( tester, find.byKey( Key("Confirm")), 0), true );

   // New box
   expect( find.textContaining( "Describe where and how" ), findsOneWidget );
   expect( find.text( "Host platform" ), findsOneWidget );
   expect( find.text( "Owner category" ), findsOneWidget );
   expect( find.text( "Host project management version" ), findsOneWidget );
   expect( find.text( "Organization name on host" ), findsAtLeast(1) );

   // dropdown 0
   expect( await tapit( tester, find.byKey( Key( "dropdown0" )), 0 ), true );
   expect( find.text( "GitHub" ), findsAtLeast(2) );
   expect( countDD( tester, "dropdown0", 1 ), true );
   expect( find.text( "GitHub").last, findsOneWidget );
   expect( await tapit( tester, find.text( "GitHub").last, 0 ), true );

   // dropdown 1
   expect( await tapit( tester, find.byKey( Key( "dropdown1" )), 0 ), true );
   expect( find.text( "Organization" ), findsAtLeast(2) );
   expect( find.text( "Individual" ), findsAtLeast(1) );
   expect( countDD( tester, "dropdown1", 2 ), true );
   expect( await tapit( tester, find.text( "Organization").last, 0 ), true );

   // dropdown 2
   expect( await tapit( tester, find.byKey( Key( "dropdown2" )), 0 ), true );
   expect( find.text( "GH Version 2" ), findsAtLeast(2) );
   expect( find.text( "GH Classic" ), findsAtLeast(1) );
   expect( countDD( tester, "dropdown2", 2 ), true );
   expect( await tapit( tester, find.text( "GH Version 2").last, 0 ), true );

   // input 3
   final Finder org = find.byKey( Key( "input3" ));
   expect( org, findsOneWidget );
   await tester.enterText( org, "TeaHolics" );

   // Check profile
   expect( find.byKey( Key( "Cancel" )), findsOneWidget );
   expect( await tapit( tester, find.byKey( Key( "Save" )), 2 ), true );
   expect( await verifyCEPProfile( tester, cev, cep: cep, hasName: true, hasOrg: true ), true );

   // Skim check edit expansion
   expect( await tapit( tester, find.byKey( Key( "Edit profile" )), 0 ), true );
   expect( find.text( cep ), findsAtLeast(2) );
   expect( find.text( "a proj desc" ), findsAtLeast(2) );
   expect( find.textContaining( "GH Version 2" ), findsAtLeast(2) );
   expect( find.byKey( Key( "input0"  )), findsOneWidget );
   expect( find.byKey( Key( "input1"  )), findsOneWidget );
   expect( find.byKey( Key( "dropdown2"  )), findsOneWidget );
   expect( find.byKey( Key( "dropdown4"  )), findsOneWidget );
   expect( find.byKey( Key( "input5"  )), findsOneWidget );
   expect( await tapit( tester, find.byKey( Key( "Cancel" )), 0 ), true );
   
   return true;
}

Future<bool> setOrg( tester, String cep, String org ) async {
   expect( await goCEP( tester, cep ), true );
   expect( await tapit( tester, find.byKey( Key( "Edit profile" )), 0 ), true );

   final Finder o = find.byKey( Key( "input5" ));
   expect( o, findsOneWidget );
   await tester.enterText( o, org );
   expect( await tapit( tester, find.byKey( Key( "Save" )), 2 ), true );
   return true;
}

// Just added the first repo, expect to be shot to equity plan
Future<bool> verifyFirstRepo( tester, String cep, bool both ) async {
   
   // Expect to be in the equity plan
   expect( find.text( "Connect the Equity Table and your Host Repository" ), findsOneWidget );
   expect( find.textContaining( "PEQs arrive with a host" ), findsOneWidget );
   expect( await tapit( tester, find.byKey( Key( "confirmContinue" )), 0 ), true );
   expect( find.text( "Associated host project name" ), findsOneWidget );
   expect( find.text( "20,000,000" ), findsOneWidget );

   // Check for repo and collab
   expect( await goCEP( tester, cep ), true );
   expect( find.textContaining( UNAFFIL1 + " (R_kgDOUXcgww)" ), findsOneWidget );
   if( both ) { expect( find.textContaining( UNAFFIL2 ), findsOneWidget ); }
   expect( find.text( "Ari Star (Ari)" ), findsOneWidget );
   expect( find.textContaining( "CE MD App Testing" ), findsOneWidget );
   
   return true;
}

Future<bool> addRepo( tester, String cev, String cep ) async {
   expect( await goCEP( tester, cep ), true );
   expect( await tapit( tester, find.byKey( Key( "Add Code Repos" )), 4 ), true );

   // Failure, no repos in TeaHolics org
   expect( find.text( "No candidates found" ), findsOneWidget );
   expect( find.textContaining( "Candidates must be in the" ), findsOneWidget );
   expect( await tapit( tester, find.byKey( Key( "cancelContinue" )), 0 ), true );

   // update org and try again
   expect( await setOrg( tester, cep, "codeequity" ), true );
   expect( find.textContaining( "codeequity"), findsOneWidget );
   expect( await tapit( tester, find.byKey( Key( "Add Code Repos" )), 4 ), true );

   // Success.
   expect( find.text( "Check the repos to add" ), findsOneWidget );
   expect( find.text( UNAFFIL1 ), findsOneWidget );
   expect( find.text( UNAFFIL2 ), findsOneWidget );
   expect( await tapit( tester, find.text( UNAFFIL1 ), 0 ), true );
   expect( await tapit( tester, find.byKey( Key( "Save" )), 0 ), true );

   expect( await verifyFirstRepo( tester, cep, false ), true );
   
   return true;
}

Future<bool> createCEP( tester, String cev, String cep ) async {
   expect( await createEmptyCEP( tester, cev ), true );
   expect( await editCEPProfile( tester, cev, cep ), true );
   expect( await addGitHub( tester, cev, cep ), true );
   expect( await addRepo( tester, cev, cep ), true );
   return true;
}

Future<bool> createCEV( tester, String cev, String descr, String web, { newUser = true, defaultEquity = true, initCEP = true } ) async {
   expect( await createEmptyCEV( tester, newUser ), true );
   expect( await editCEVProfile( tester, cev, descr, web ), true );
   expect( await viewEA( tester, cev, descr, web ), true );
   expect( await addEquityPlan( tester, cev ), true );
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

      expect( await tapit( tester, find.text( cev ), 2 ), true );
      expect( find.text( cev ), findsOneWidget );
      expect( find.text( "Collaborator Roles within this Venture" ), findsOneWidget );
   }
   
   return true;
   
}

Future<bool> goCEP( tester, String cep ) async {

   try{
      expect( find.text( cep ), findsOneWidget );
      expect( find.text( "Collaborators" ), findsOneWidget );
   }
   catch (e) {
      expect( await goAri( tester ), true );
      
      expect( await tapit( tester, find.byKey( Key( "ProjCard" + cep )), 2 ), true );
      expect( find.text( cep ), findsOneWidget );
      expect( find.text( "Collaborators" ), findsOneWidget );
   }
   
   return true;
}

Future<bool> mungeRepos( tester, String cev, String cep ) async {
   expect( await goCEP( tester, cep ), true );

   // Remove 1
   expect( await tapit( tester, find.byKey( Key( "Dissolve" )), 0 ), true );
   expect( find.textContaining( "Are you removing a repo" ), findsOneWidget );
   expect( find.text( "Remove a repo" ), findsOneWidget );
   expect( find.text( "Delete this project" ), findsOneWidget );

   expect( await tapit( tester, find.text( "Remove a repo" ), 0 ), true );
   expect( await tapit( tester, find.byKey( Key( "Confirm" )), 0 ), true );
   expect( find.textContaining( "Are you sure you want to remove" ), findsOneWidget );
   expect( find.textContaining( "All PEQ issues connected to the host" ), findsOneWidget );

   expect( await tapit( tester, find.byKey( Key( "confirmContinue" )), 0 ), true );
   expect( find.text( "Check the repos to remove" ), findsOneWidget );
   expect( find.text( UNAFFIL1 ), findsOneWidget );

   expect( await tapit( tester, find.text( UNAFFIL1 ), 0 ), true );
   expect( await tapit( tester, find.byKey( Key( "Save" )), 0 ), true );   
   expect( await verifyCEPProfile( tester, cev, cep: cep, hasName: true, hasOrg: true, fresh: false ), true );

   // Add both
   expect( await tapit( tester, find.byKey( Key( "Add Code Repos" )), 4 ), true );
   expect( find.text( "Check the repos to add" ), findsOneWidget );
   expect( find.text( UNAFFIL1 ), findsOneWidget );
   expect( find.text( UNAFFIL2 ), findsOneWidget );
   expect( await tapit( tester, find.text( UNAFFIL1 ), 0 ), true );
   expect( await tapit( tester, find.text( UNAFFIL2 ), 0 ), true );
   expect( await tapit( tester, find.byKey( Key( "Save" )), 0 ), true );
   expect( await verifyFirstRepo( tester, cep, true ), true );


   return true;
}

Future<bool> dissolveCEV( tester, String cev, String cep ) async {
   expect( await goCEV( tester, cev ), true );

   expect( await tapit( tester, find.byKey( const Key( "Dissolve" )), 2 ), true );
   expect( find.text( "Delete Venture" ), findsOneWidget );
   expect( find.textContaining( "There is no going back" ), findsOneWidget );

   expect( await tapit( tester, find.byKey( Key( "confirmContinue" )), 2 ), true );
   expect( await verifyActivityStart( tester, profile: "complete", privacy: "complete" ), true );
   expect( find.text( cev ), findsNothing );
   expect( find.text( cep ), findsNothing );
   return true;
}

Future<bool> dissolveCEP( tester, String cev, String cep ) async {
   expect( await goCEP( tester, cep ), true );

   expect( await tapit( tester, find.byKey( const Key( "Dissolve" )), 2 ), true );
   expect( find.textContaining( "Are you removing a repo" ), findsOneWidget );
   expect( find.text( "Remove a repo" ), findsOneWidget );
   expect( find.text( "Delete this project" ), findsOneWidget );

   expect( await tapit( tester, find.text( "Delete this project" ), 0 ), true );
   expect( await tapit( tester, find.byKey( Key( "Confirm" )), 0 ), true );
   expect( find.textContaining( "Are you sure you want to remove" ), findsOneWidget );
   expect( find.textContaining( "Any granted PEQ" ), findsOneWidget );

   expect( await tapit( tester, find.byKey( Key( "confirmContinue" )), 2 ), true );

   expect( await verifyActivityStart( tester, profile: "complete", privacy: "complete" ), true );
   expect( find.text( cev ), findsOneWidget );
   expect( find.text( cep ), findsNothing );
   expect( find.text( "(No name yet)" ), findsOneWidget );
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
         expect( await createCEP( tester, cev, cep ), true );

         await logout( tester );
         report( 'Basic flow' );
      });


   print( "Repos" );
   // NOTE this test depends on having completed basic flow above
   // testWidgets('Repos', skip:true, (WidgetTester tester) async {
   testWidgets('Repos', skip:skip, (WidgetTester tester) async {

         await restart( tester );
         await login( tester, true );
         tester.binding.window.physicalSizeTestValue = const Size(1200, 1065);

         expect( await verifyAriHome( tester ), true );
         
         expect( await mungeRepos( tester, cev, cep ), true );
         
         await logout( tester );
         report( 'Repos' );
      });


   print( "Dissolve" );
   // testWidgets('Dissolve', skip:true, (WidgetTester tester) async {
   testWidgets('Dissolve', skip:skip, (WidgetTester tester) async {

         await restart( tester );
         await login( tester, true );
         tester.binding.window.physicalSizeTestValue = const Size(1200, 1065);

         expect( await verifyAriHome( tester ), true );

         expect( await dissolveCEP( tester, cev, cep), true );
         expect( await dissolveCEV( tester, cev, cep), true );

         await logout( tester );
         report( 'Dissolve' );
      });
}
     
