import 'dart:convert';                   // json encode/decode, b64 coding
import 'package:flutter/material.dart';
import 'dart:typed_data';

// import 'package:docx_viewer/docx_viewer.dart';
// import 'package:docx_file_viewer/docx_file_viewer.dart';
// import 'package:flutter_html/flutter_html.dart';
import 'package:file_saver/file_saver.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/screens/profile_page.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';
import 'package:ceFlutter/utils/awsUtils.dart';

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/CEVenture.dart';
import 'package:ceFlutter/models/EquityPlan.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/HostAccount.dart';
import 'package:ceFlutter/models/Person.dart';
import 'package:ceFlutter/models/UserDoc.dart';
import 'package:ceFlutter/models/Agreement.dart';


class CEActivityPanel extends StatefulWidget {
   final rhsFrameMinWidth;
   final rhsFrameMaxWidth;
   final overlayMaxWidth;
   final updateHomeView; 
   CEActivityPanel({ Key? key, this.updateHomeView, this.rhsFrameMinWidth, this.rhsFrameMaxWidth, this.overlayMaxWidth }) : super( key: key );
      
  @override
  _CEActivityState createState() => _CEActivityState();
}

class _CEActivityState extends State<CEActivityPanel> {

   late var      container;
   late AppState appState;

   late bool toggleRegister;
   late bool togglePending;
   late bool toggleDaily;  
   late bool updateView;

   final ScrollController _scrollController = ScrollController();
   late UserDoc     scrollDoc;
   late Person      applicant;
   late Person      approver;
   late CEVenture   targCEV;
   
   late List<Widget> tasks;

   List<TextEditingController> controllerPool = [];
   
   @override
   void initState() {
      super.initState();

      toggleRegister = true;
      togglePending  = true;   
      toggleDaily    = true;
      updateView     = true;
      tasks          = [];

      _scrollController.addListener(_onScroll);
   }

   @override
   void dispose() {
      _scrollController.removeListener( _onScroll );
      _scrollController.dispose();
      controllerPool.forEach( (c) => c.dispose() );
      super.dispose();
      if( appState.verbose >= 2 ) { print( "HP dispose" ); }
   }



   void _noop() {
      Navigator.of( context ).pop( 'noop' );
   }

   void _cancel() {
      Navigator.of( context ).pop( 'Cancel' );
   }

   void _reject() async {
      assert( targCEV.ceVentureId != "" );
      assert( applicant.id != "" );
      assert( targCEV.hasApplicant( applicant.id ));

      targCEV.applicants.remove( applicant.id );
      applicant.reject( DocType.equity, cev: targCEV );
      
      // update, don't await
      String user = json.encode( applicant );
      String ppostData = '{ "Endpoint": "PutPerson", "NewPerson": $user, "Verify": "false" }';
      updateDynamo( context, container, ppostData, "PutPerson" );

      String cevs = json.encode( targCEV );
      ppostData = '{ "Endpoint": "UpdateCEV", "ceVenture": $cevs }';
      await updateDynamo( context, container, ppostData, "UpdateCEV" );
      
      Navigator.of( context ).pop( 'Reject' );
      appState.hoverChunk = "";      
      setState(() => updateView = true );

      showToast( "Applicant removed from " + targCEV.name);
   }

   void _withdrawChoice( Person cePeep ) async {

      List<String> choices = [ "A specific CodeEquity Venture", "All of CodeEquity" ]; // XXX formalize
      await radioDialog( context, "Withdraw from which?", choices, choices[0], _withdraw, _cancel, execArgs: [ cePeep ] );
   }

   // Note: do not need to await updateDynamo for withdrawAll - user will reload only after logging in, which takes a while.
   void _withdrawCEV( Person cePeep ) async {
      print( "WITHDRAW CE" );
         
      cePeep.withdraw();
      
      // This is insufficient.  In error conditions, a CEV can hold a cePeep while the cePeep does not see the CEV.  Then subsequent onboarding fails.
      // List<CEVenture> cevs = cePeep.getCEVs( appState.ceVenture );
      for( var cev in appState.ceVenture.values ) {
         List<dynamic> res = cev.drop( appState, cePeep );
         bool found            = res[0];
         
         if( found ) {
            print( "WITHDRAW from " + cev.name + " " +cePeep.id );
            String cevs = json.encode( cev );
            String ppostData = '{ "Endpoint": "UpdateCEV", "ceVenture": $cevs }';
            updateDynamo( context, container, ppostData, "UpdateCEV" );
         }
      }
      
      // delete CEHostUser entry - cePeep may have multiple hostAccounts (i.e. have hostUIDs on multiple platforms)
      List<String> huids = [];
      for( var host in appState.myHostAccounts ) {
         print( "Clearing all CEPs, CEVs from host UID: " + host.hostUserId );
         host.hostUser.ceProjectIds = [];
         host.hostUser.futureCEProjects = [];
         String newHostA = json.encode( host.hostUser );
         String postData = '{ "Endpoint": "PutHostA", "NewHostA": $newHostA, "udpate": "true" }';
         updateDynamo( context, container, postData, "PutHostA" );
      }
      
      String user = json.encode( cePeep );
      String ppostData = '{ "Endpoint": "PutPerson", "NewPerson": $user, "Verify": "false" }';
      updateDynamo( context, container, ppostData, "PutPerson" );
      
      // Clear host accounts so initMDState reloads it upon login
      appState.ceHostAccounts.clear();
      logout( context, appState );
   }

   // Note that withdraw follows role removal rules.  For example, if sole founder withdraws, next highest level of collabs are promoted to founder.
   //      if founder is the sole collaborator and withdraws, the CEV will no longer be operable by anyone.  Contact CE staff.
   void _withdrawCEP( Person cePeep, String cevId ) async {
      print( "WITHDRAW Vent " + cevId );

      CEVenture? cev = appState.ceVenture[ cevId ];
      assert( cev != null );
      
      // notify aws so next ingest can clean non-ACCR peqs.  don't wait.
      writeWithdrawPAct( appState, context, container, cePeep, cev );
      
      List<dynamic> res = cev!.drop( appState, cePeep );
      bool found        = res[0];
      
      String cevs = json.encode( cev! );
      String ppostData = '{ "Endpoint": "UpdateCEV", "ceVenture": $cevs }';
      await updateDynamo( context, container, ppostData, "UpdateCEV" );
      
      // remove 1 CEV from CEHostUser
      List<CEProject>   ceps = appState.ceProject.values.where( ( v ) => v.ceVentureId == cev!.ceVentureId ).toList();
      List<HostAccount>? ha  = appState.ceHostAccounts[ cePeep.id ];
      assert( ha != null );
      for( var host in ha! ) {
         bool mod = false;
         ceps.forEach( (p) {
               if( host.ceProjectIds.contains( p.ceProjectId ) ) {
                  mod = true;
                  host.ceProjectIds.remove( p.ceProjectId ); 
               }
            });
         if( mod ) {
            print( "HostUser mods made" );
            String newHostA = json.encode( host.hostUser );
            String postData = '{ "Endpoint": "PutHostA", "NewHostA": $newHostA, "udpate": "true" }';
            await updateDynamo( context, container, postData, "PutHostA" );
         }
      }
      
      // Clear host accounts, reload, then update homepage.
      appState.ceHostAccounts.clear();
      await initMDState( context, container );
      widget.updateHomeView(); 
   }
   
   void _withdraw( Person cePeep, String choice ) async {
      if( choice == "All of CodeEquity" ) { // XXX
         String msg = "This action will end your participation in CodeEquity and any CodeEquity Ventures.\n All Provisional Equity that hasn't vested already will be terminated.\n";
         msg       += "Your login will survive.  Press \'Continue\' to withdraw.";
         String ret = await confirm( context, "Withdraw from CodeEquity?", msg, _noop, _cancel );

         if( ret == "noop" ) { _withdrawCEV( cePeep ); }
      }
      else {
         String cevId = await _chooseVenture( "Select the CodeEquity Venture to withdraw from" );
         if( cevId == "Cancel" ) {
            _cancel();
            return;
         }
         
         String msg = "This action will end your participation in this Venture.\n All Provisional Equity in this Venture that hasn't vested already will be terminated.\n";
         msg       += "If you are the last member of the Venture, the Venture will no longer be accessible.\n";
         msg       += "Press \'Continue\' to withdraw.";
         String ret = await confirm( context, "Withdraw from Venture?", msg, _noop, _cancel );

         if( ret == "Cancel" )    { return; }

         // select screen .. pop early to avoid awaits
         Navigator.of( context ).pop();         
         
         if( ret == "noop" ) { _withdrawCEP( cePeep, cevId ); }
      }
   }

   bool _addCEV( Person cePeep, CEVenture cev ) {
      print( "HostUser mods made" );
      List<CEProject> ceps = appState.ceProject.values.where( ( v ) => v.ceVentureId == cev.ceVentureId ).toList();

      // What are my different host ids, 1 per host platform?
      List<String> huids = appState.idMapHost.keys.where( (k) => appState.idMapHost[k] != null && appState.idMapHost[k]!["ceUID"] == cePeep.id ).toList();
      print( "addCEV hostuids: " + huids.toString() );
      huids.forEach( (huid) {
            // for the CEPs in the CEV cePeep's registering for, find any valid host account that belongs to me and matches the CEP host platform
            List<String> platforms = [];  // only way this is >1 is if huid is same on 2+ host platforms.
            ceps.forEach( (cep) {

                  if( appState.ceHostAccounts[cePeep.id] == null ) {
                     showToast( cePeep.goesBy + " has not registered any host platform " + cep.hostPlatform + " with CodeEquity yet.  Please address this on the home page. ");
                  }
                  else {
                     List<HostAccount> hosts = appState.ceHostAccounts[cePeep.id]!.where( (h) => h.hostUserId == huid && h.hostPlatform == cep.hostPlatform ).toList();
                     // If cePeep doesn't have hostUID for the platform related to this CEP, warn and skip
                     if( hosts.length == 0 ) {
                        showToast( cePeep.goesBy + " has not registered the host platform " + cep.hostPlatform + " with CodeEquity yet.  Please address this on the home page. ");
                     }
                     else {
                        assert( hosts.length == 1 );
                        // if this host account doesn't already have the CEP, add it and the platform
                        if( !hosts[0].ceProjectIds.contains( cep.ceProjectId ) ) {
                           hosts[0].ceProjectIds.add( cep.ceProjectId );
                           if( !platforms.contains( cep.hostPlatform ) ) { platforms.add( cep.hostPlatform ); }
                           print( "Updating " + hosts[0].hostUserName + " " + hosts[0].ceProjectIds.toString() );
                        }
                     }
                  }
               });
            // Update CEHostUser for each platform where CEPs were added
            platforms.forEach( (p) {
                  List<HostAccount> hosts = appState.ceHostAccounts[cePeep.id]!.where( (h) => h.hostUserId == huid && h.hostPlatform == p ).toList();
                  assert( hosts.length == 1 );
                  String newHostA = json.encode( hosts[0].hostUser );
                  String postData = '{ "Endpoint": "PutHostA", "NewHostA": $newHostA, "udpate": "true" }';
                  // Don't wait
                  updateDynamo( context, container, postData, "PutHostA" );
               });
            
         });
      return true;
   }
   
   
   // Accept edits.  Perhaps Accept agreement.  cePeep may either be approver or applicant.  
   Future<void> _accept( Person cePeep, DocType docType, {docId = "", isApplicant = true, controlView = true} ) async {

      print( "Accept for " + cePeep.legalName );
      if( docType != DocType.equity ) {
         assert( docId != "" );
         scrollDoc = new UserDoc( docType: docType, docId: docId, acceptedDate: getToday(), equityVals: {} );
         targCEV   = CEVenture.empty();
      }
      cePeep.accept( docType, scrollDoc, docId, targCEV, isApplicant );

      if( docType == DocType.equity && !isApplicant ) {
         cePeep = applicant;
         String missing = scrollDoc.checkExecuted( approver, applicant, targCEV );
         if( missing == "" ) {
            showToast( "Document is now fully executed." );
            targCEV.addNewCollaborator( applicant, scrollDoc.equityVals["PartnerTitle"]! );
            scrollDoc.setExecutionDate();

            // stores new countersigned acceptedDoc for applicant.  The previous accept did any work needed for the approver.
            applicant.accept( docType, scrollDoc, docId, targCEV, true );

            // Update CEHostUser for applicant
            _addCEV( applicant, targCEV );

            // update todo list
            setState(() => updateView = true );            
         }
         else {
            showToast( "Document needs the following items to be fully executed: " + missing );
         }
      }

      // Store new document edits, only applicant stores these
      String user = json.encode( cePeep );
      String ppostData = '{ "Endpoint": "PutPerson", "NewPerson": $user, "Verify": "false" }';
      await updateDynamo( context, container, ppostData, "PutPerson" );

      // Store new applicant, or new member .. don't wait.  Nothing to update if not type equity.
      if( docType == DocType.equity ) {
         String cevs = json.encode( targCEV );
         ppostData = '{ "Endpoint": "UpdateCEV", "ceVenture": $cevs }';
         updateDynamo( context, container, ppostData, "UpdateCEV" );
      }
      
      if( controlView ) {
         setState(() => updateView = true );
         appState.hoverChunk = "";      
         Navigator.of( context ).pop();
      }
   }

   // Make sure the (or an) exec has filled in their profile, and accepted the privacy doc
   // Make sure the equity plan exists
    _checkThenShow( Person cePeep, DocType docType, cevId, isApplicant ) async {
      assert( docType == DocType.equity );

      CEVenture? tcev = appState.ceVenture[cevId];
      assert( tcev != null );
      targCEV = tcev!;
      
      String msg = "";
      
      // Is there a registered founder yet?
      if( isApplicant ) {
         approver  = Person.empty();
         applicant = cePeep;
         
         bool regexec = false;
         List<Person> execs = targCEV.getExecutives( appState );
         for( final exec in execs ) {
            if( exec.registered ) { regexec = true; break; }
         }
         if( !regexec ) { msg = "The Founder has either not yet accepted the privacy agreement, or completed their profile."; }
      }
      else { 
         assert( appState.ceUserId != "" );
         Person? tmpPeep = appState.cePeople[ appState.ceUserId ];
         assert( tmpPeep != null );
         approver  = tmpPeep!;
         applicant = cePeep; 

         if( !approver.signedPrivacy() ) {
            msg = "You must accept the privacy agreement before countersigning.";
         }
         
         if( !approver.completeProfile() ) {
            if( msg != "" ) { msg = msg + "\n"; }
            msg = msg + "You must complete your profile before countersigning.";
         }
      }

      // is there an equity plan yet?
      // May need to load equity plan.  Set selected is OK here, will be reset if CEV/CEP item is clicked
      appState.selectedCEVenture = targCEV.ceVentureId;
      await reloadCEVentureOnly( context, container );
      EquityPlan? ep = appState.ceEquityPlans[ cevId ];
      if( ep == null || ep!.totalAllocation == 0 ) {
         if( msg != "" ) { msg = msg + "\n"; }
         msg = msg + "There is no Equity Plan in place yet.";
      }

      if( msg != "" ) { showToast( "You can't do that yet.\n"+msg ); }
      else            { _showDoc( applicant, docType, cevId: cevId, cevName: targCEV.name, isApplicant: isApplicant ); }
   }
   
   List<Widget> _makeGetApplications() {
      List<Widget> subTasks = [];
      assert( appState.ceUserId != "" );
      Person? cePeep = appState.cePeople[ appState.ceUserId ];
      assert( cePeep != null );

      // Get all applicants to all CEVs that I'm an executive for.
      appState.ceVenture.entries.forEach( (entry) {
            CEVenture cev = entry.value;
            MemberRole? r = cev.roles[ cePeep!.id ];

            // May be more than 1 application, so can't set class var for applicant here
            if( r != null && r == MemberRole.Executive ) {
               cev.applicants.forEach( (a) {
                     Person? applicant = appState.cePeople[ a ];
                     assert( applicant != null );
                     Widget application = _makeLink( applicant!.legalName + " has applied to " + cev.name, widget.overlayMaxWidth * 0.2,
                                                     () => _checkThenShow( applicant, DocType.equity, cev.ceVentureId, false ));
                     subTasks.add( application );
                  });
            }
                
         });
      
      return subTasks;
   }

   void _addControllerPool( int ith ) {
      assert( controllerPool.length >= ith );
      if( controllerPool.length > ith ) { return; }
      else {
         controllerPool.add( new TextEditingController() );
      }
   }

   Future<String> _chooseVenture( String msg, { Person? cePeep = null, DocType docType = DocType.end }) async {
      String _select( List<TextEditingController> cont ) {
         assert( cont.length == 1 );
         String cev = cont[0].text;
         final cevEntry = appState.ceVenture.entries.where( ( entry ) => entry.value.name == cev ).toList();
         assert( cevEntry.length <= 1 );
         if( cevEntry.length < 1 ) {
            showToast( "Venture not found.  Please re-enter the name of the Venture." );
            return "";
         }
         String cevId = cevEntry[0].key;
         Navigator.of( context ).pop( cevId );
         if( docType == DocType.end )         { return cevId; }              // select venture
         else if( docType == DocType.equity ) {                              // register venture
            assert( cePeep != null );
            _checkThenShow( cePeep!, docType, cevId, true );
            return "";
         }  
         else { assert( false ); }
         return "";
      }
      
      String item = "Venture name";
      String hint = "Type \'Venture name\' in the search bar if you need a hint";
      _addControllerPool( 0 );      
      var retVal = await editList( context, appState, msg, [item], controllerPool.sublist(0, 1), [hint], () => _select( controllerPool.sublist(0, 1) ), _cancel, null, saveName: "Select" );
      return retVal;
   }

   void _createVenture( context, container, CEVenture cev, Person cePeep ) async {
      
      // need profile/privacy first
      if( !cePeep.registered ) {
         showToast( "Please complete your personal profile and accept the privacy notice before creating a new CodeEquity Venture." );
         return;
      }

      // Work from blank
      Map<String,String> screenArgs = {"id": "-1", "profType": "CEVenture", "cePeepId": cePeep.id };
      MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEProfilePage(), settings: RouteSettings( arguments: screenArgs ));
      confirmedNav( context, container, newPage );
   }
   
   // So far, venture equity agreement is the only editable doc
   void _updateDoc( Map<String, String> edits ) async {
      Navigator.of( context ).pop();  // radio
      Navigator.of( context ).pop();  // doc

      bool isApplicant = approver.id != "-1"  ? false : true;
      Person tPeep     = isApplicant          ? applicant : approver;

      print( "Update doc applicant? " + isApplicant.toString() );

      // Problem in signature area?  Untouched is fine
      if( !scrollDoc.validate( tPeep, edits, isApplicant )) { 
         showToast( "You must sign with your full legal name.  You can not sign for someone else." );
      }
      else {
         scrollDoc.modify( edits );
         await _accept( tPeep, DocType.equity, isApplicant: isApplicant, controlView: false );
         if( scrollDoc.validPartnerSig() ) {
            if( isApplicant ) {
               String msg = "Congratulations!  Your Equity Agreement has been submitted for counter-signature.";
               msg += "You will be informed when a Founder has done so.";
               showToast( msg );
               return;
            }
         }
         
      }

      // use current is better than running with cePeep - less repeated questions
      _showDoc( applicant, DocType.equity, useCurrent: true, isApplicant: isApplicant );
   }

   void _updateDocFixed( String item, String choice ) {
      Map<String,String> edits = { item: choice };

      // Has anything changed?  if not, back out to avoid infinite confirm
      if( scrollDoc.equityVals[ item ] != null && scrollDoc.equityVals[ item ]! == choice ) {
         _cancel();
      }
      else {
         _updateDoc( edits );
      }
   }

   // Hints are created from existing editVals.  If user doesn't edit a field directly when having previously
   // done so, that previous value is carried over into new update.
   void _updateDocFree( List<String> item, List<String> hint, List<TextEditingController> cont ) {
      assert( item.length == cont.length );
      Map<String,String> edits = {};
      for( var i = 0; i < cont.length; i++ ) {
         edits[item[i]] = cont[i].text != "" ? cont[i].text : hint[i];

         // controller no longer used.
         // cont[i].dispose();
      }
      _updateDoc( edits );
   }
      
   void _fillInBlanks( final box ) {
      assert( scrollDoc != null );
      assert( scrollDoc.filledIn != null );
      assert( box.validate() );

      if( box.type == "blanks" ) {
         List<String>                item = [];
         List<String>                hint = [];
         int ith = 0;
         for( final entry in box.values.entries ) {
            item.add( entry.key );
            hint.add( entry.value );
            _addControllerPool( ith );
            ith++;
         }
         
         editList( context, appState, box.blankTitle, item, controllerPool.sublist(0, ith), hint,
                   () => _updateDocFree( item, hint, controllerPool.sublist(0, ith) ), _cancel, null, subHeader: box.blankSub, headerWidth: widget.overlayMaxWidth * 0.3 );
      }
      else if( box.type == "radio" ) { 
         radioDialog( context, box.radioTitle!, box.rchoices!.sublist(1), box.rInitChoice, _updateDocFixed, _cancel, execArgs: ["PartnerTitle"] );
      }
   }

   void _onScroll() {
      assert( _scrollController.position.maxScrollExtent > 0 );
      double depth = 100 * ( _scrollController.position.pixels /  _scrollController.position.maxScrollExtent );
      if( scrollDoc.boxes == null ) { return; }
      for( var i = 0; i < scrollDoc.boxes!.length; i++ ) {
         var box = scrollDoc.boxes![i];
         if( !box.triggered && depth >= box.percDepth ) {
            print("Scrolled past " + box.percDepth.toString() + " Event triggered.");
            box.triggered = true; 
            _fillInBlanks( box );
            break;
         }
         if (depth < box.percDepth ) { box.triggered = false; }
      }
   }

   Widget _makeDownload( Agreement agmt, String content ) {
      return new TextButton( 
         key: Key( 'Download' ),
         child: new Text("Download"),
         onPressed: () async {
                         Uint8List fileBytes = utf8.encode(content);
                         try {
                            String savedPath = await FileSaver.instance.saveFile(
                               name: agmt.title,
                               bytes: fileBytes,
                               fileExtension: 'txt',
                               mimeType: MimeType.text, // Ensures correct extension tracking on mobile/web
                               );
                            showToast( "File saved" ); 
                         } catch (e) { print("Error saving file: $e"); }
                      },
         );
   }
   
   // Every time enter showDoc with relevant doc, roles are set.
   // Called after first entry (through checkThenShow, which sets roles), or as part of chain of current edits through onScroll
   void _showDoc( Person cePeep, DocType docType, { cevId = "", cevName = "", useCurrent = false, isApplicant = true } ) async {
      Agreement? agmtN = appState.agreements[ enumToStr( docType ) ];
      assert( agmtN != null );
      Agreement agmt = agmtN!;  // oi.  too many !
      
      if( docType == DocType.privacy ) {
         List<Widget> buttons = [];
         buttons.add( new TextButton( key: Key( 'Accept' ), child: new Text("Accept Statement"), onPressed: () => _accept( cePeep!, agmt.type, docId: agmt.id ) ));
         buttons.add( new TextButton( key: Key( 'Dismiss' ), child: new Text("Dismiss"), onPressed: _cancel ));
         buttons.add( _makeDownload( agmt, agmt.content ));
         
         await showCEDoc( context, agmt, agmt.content, buttons, widget.overlayMaxWidth );         
      }
      else {

         if( isApplicant ) {

            if( !useCurrent ) {
               if( !applicant!.registered ) {
                  showToast( "You must accept the privacy statement, and complete your profile first." );
                  return;
               }
               
               if( applicant.appliedToCEV( targCEV ) ) {
                  String ret = await confirm( context, "More Edits?", "You have already sent a Venture Agreement for " + cevName + " to the Founders.  Do you want to edit it?",
                                              _noop, _cancel );
                  if( ret == 'Cancel' ) { return; }
                  
                  // Need to load, then use values from applicant
                  scrollDoc = applicant.copyStoredEquityVals( targCEV.ceVentureId );
                  useCurrent = true;
               }
               else if( applicant.registeredWithCEV( targCEV ) ) {
                  showToast( "You have already signed the CodeEquity Equity Agreement with " + cevName );
                  return;
               }
               else {
                  scrollDoc = new UserDoc( docType: agmt.type, docId: agmt.id, acceptedDate: getToday(), equityVals: {} );
               }
            }
         }
         else {
            print( "Doc for applicant: " + applicant.legalName + " to be countersigned by " + approver.legalName );

            // load values from applicant
            scrollDoc = applicant.copyStoredEquityVals( targCEV.ceVentureId );
         }
        
         String filledInDoc = scrollDoc.compose( appState, applicant, approver, agmt, cevId, useCurrent: useCurrent, isApplicant: isApplicant );
         
         if( filledInDoc == "-1" ) {
            showToast( "No need to sign agreements with yourself." );
            return;
         }

         print( "filledIn composed " + filledInDoc.length.toString() );
         
         List<Widget> buttons = [];
         buttons.add( new TextButton( key: Key( 'Dismiss' ), child: new Text("Dismiss"), onPressed: _cancel ));
         if( !isApplicant && !applicant.registeredWithCEV( targCEV ) ) {
            buttons.add( new TextButton( key: Key( 'Reject' ), child: new Text("Reject"), onPressed: _reject ));
         }
         buttons.add( _makeDownload( agmt, filledInDoc ));
         
         await showCEDoc( context, agmt, filledInDoc, buttons, widget.overlayMaxWidth, controller: _scrollController );
      }
   }

   List<Widget> makeMe( ) {
      assert( appState.ceUserId != "" );
      Person? cePeep = appState.cePeople[ appState.ceUserId ];
      assert( cePeep != null );

      void updateCallback() { setState(() => updateView = true ); }
      
      List<Widget> subTasks = [];
      
      if( !cePeep!.signedPrivacy() )   { subTasks.add( _makeLink( "Privacy Notice", widget.overlayMaxWidth * 0.2, () => _showDoc( cePeep!, DocType.privacy ))); }

      if( !cePeep!.completeProfile() ) {
         subTasks.add( _makeLink( "Complete profile", widget.overlayMaxWidth * 0.2,
                                  () => editProfile( context, container, cePeep!, updateCallback: () => updateCallback() ), last: true ));
      }
      return subTasks;      
   }
   
   Widget _makeLink( String txt, width, func, { last = false } ) {
      void _unsetLink( PointerEvent event ) {
         updateView = true;         
         setState(() { appState.hoverChunk = ""; });
      }
      
      void _setLink( PointerEvent event ) {
         updateView = true;
         setState(() { appState.hoverChunk = txt; });
      }

      double gap = 1.9 * appState.GAP_PAD;
         
      return GestureDetector(
         onTap: () async
         {
            await func();
         },
         key: Key( txt+"GD" ),
         child: last ?
         makeActionableText( appState, txt, txt, _setLink, _unsetLink, width, false, 1, sub: true, lgap: gap, bgap: gap * 0.25 ) :
         makeActionableText( appState, txt, txt, _setLink, _unsetLink, width, false, 1, sub: true, lgap: gap )
         );
   }
   
   Widget makeExpander( String toggle, bool expand ) {
      void func () async {
         updateView = true;
         switch( toggle ) {
         case "toggleDaily" :
            setState(() => toggleDaily = expand ? false : true );
            break;
         case "toggleRegister" :
            setState(() => toggleRegister = expand ? false : true );
            break;
         case "togglePending" :
            setState(() => togglePending = expand ? false : true );
            break;
         default :
            assert( false );
         }
      }
      
      return Padding(
         padding: EdgeInsets.fromLTRB(0, appState.MID_PAD * 0.4, 0, 0),
         child: GestureDetector(
            onTap: func,
            key: Key( toggle ),
            child: expand ? Icon( Icons.arrow_drop_down ) : Icon( Icons.arrow_drop_down_circle )
            ));
   }

   Widget _makeEntry( String entry, double pad, bool title, { last = false } ) {

      double w2 = widget.rhsFrameMaxWidth - appState.GAP_PAD - appState.TINY_PAD;
      w2 = title ? w2 * 0.4 : w2;
      
      double gap = last  ? ( 1.9 * appState.GAP_PAD ) * .25 : 0.0; // XXX 2x
      
      return Padding(
         padding: EdgeInsets.fromLTRB(pad, 0, 0, 0),
         child: GestureDetector( 
            onTap: () => notYetImplemented( context ),
            child: title ?
            makeTitleText( appState, entry, w2, false, 1, lgap: 1.9 * appState.GAP_PAD, bgap: gap ) :
            makeBodyText( appState, entry, w2, false, 1, bgap: gap )
            ));
   }

   
   List<Widget> makeGettingStarted( ) {
      List<Widget> subTasks = [];

      assert( appState.ceUserId != "" );
      Person? cePeep = appState.cePeople[ appState.ceUserId ];
      assert( cePeep != null );
      
      if(  !cePeep!.registered ) { 
         Widget gettingStarted = makeTitleText( appState, "Getting started", widget.overlayMaxWidth, false, 1, fontSize: 16 );
         subTasks.add( gettingStarted );
         subTasks.addAll( makeMe( ) );
      }
      return subTasks;
   }

   // Can always register with another CEV.
   // Once registered, can update the same agreement, but not remove it.  For example, mailing address or phone might change.
   List<Widget> makeRegister( ) {
      assert( appState.ceUserId != "" );
      Person? cePeep = appState.cePeople[ appState.ceUserId ];
      assert( cePeep != null );
      CEVenture cev = new CEVenture( ceVentureId: "", name: "", roles: {}, applicants: [] );

      Widget expand = makeExpander( "toggleRegister", true );
      Widget shrink = makeExpander( "toggleRegister", false );

      List<Widget> subTasks = [];
      Widget pending = makeTitleText( appState, "Ventures & Projects", widget.overlayMaxWidth * .3, false, 1, fontSize: 16 );
      subTasks.add( Wrap( spacing: 0, children: [ pending, toggleRegister ? expand : shrink ] ));

      if( !toggleRegister ) {
         String msg = "Choose the CodeEquity Venture you wish to register with";
         subTasks.add( _makeLink( "Register with a Venture", widget.overlayMaxWidth * 0.2, () => _chooseVenture( msg, docType: DocType.equity, cePeep: cePeep! )));
         subTasks.add( _makeLink( "Create a Venture", widget.overlayMaxWidth * 0.2, () => _createVenture( context, container, cev, cePeep! )));
         subTasks.add( _makeLink( "Withdraw", widget.overlayMaxWidth * 0.2, () => _withdrawChoice( cePeep! ) ));
      }
      return subTasks;
   }
   
   List<Widget> makePending( ) {
      Widget expand = makeExpander( "togglePending", true );
      Widget shrink = makeExpander( "togglePending", false );

      List<Widget> subTasks = [];
      Widget pending = makeTitleText( appState, "Pending tasks", widget.overlayMaxWidth / 6.0, false, 1, fontSize: 16 );
      subTasks.add( Wrap( spacing: 0, children: [ pending, togglePending ? expand : shrink ] ));

      if( !togglePending ) {
         subTasks.add( _makeEntry( "14 pending approvals", 2.0 * appState.MID_PAD, false ) );
         subTasks.add( _makeEntry( "2 pending invites", 2.0 * appState.MID_PAD, false ) );
         subTasks.addAll( _makeGetApplications() );
      }
      return subTasks;
   }

   List<Widget> makeDaily( ) {

      Widget expand = makeExpander( "toggleDaily", true );
      Widget shrink = makeExpander( "toggleDaily", false );

      List<Widget> subTasks = [];
      Widget daily = makeTitleText( appState, "Today's stats", widget.overlayMaxWidth / 6.0, false, 1, fontSize: 16 );
      subTasks.add( Wrap( spacing: 0, children: [ daily, toggleDaily ? expand : shrink ] ));

      if( !toggleDaily ) {
         subTasks.add( _makeEntry( "13 PEQs added to PLAN -> 98", 2.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "1 PEQ removed from PROG -> 23", 2.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "1 PEQ added to PEND -> 3", 2.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "2 PEQs added to ACCR - 43", 2.0 * appState.MID_PAD, false ));
      }

      return subTasks;
   }

   Widget _makeActivityZone() {
      final w1 = widget.rhsFrameMinWidth - appState.GAP_PAD - appState.TINY_PAD;

      // Turn each getting started off if done
      // Turn pending/daily off if have getting started

      if( updateView ) {
         tasks = [];
         
         // Getting started 
         tasks.addAll( makeGettingStarted() );
         tasks.addAll( makeRegister() );
         tasks.addAll( makePending() );
         tasks.addAll( makeDaily() );
      
         updateView = false;
      }

      Widget allActivity = Column( 
         crossAxisAlignment: CrossAxisAlignment.start,
         mainAxisAlignment: MainAxisAlignment.start,
         children: tasks
         );
         
      return Column( 
         crossAxisAlignment: CrossAxisAlignment.start,
         mainAxisAlignment: MainAxisAlignment.start,
         children: <Widget>[
            Container( width: w1, height: appState.GAP_PAD ),
            Container( color: appState.BACKGROUND, child: makeTitleText( appState, "Activity", w1, true, 1 )),
            Container( width: w1, height: 1.5 * appState.CELL_HEIGHT ),
            allActivity
            ]);
   }

   
   @override
      Widget build(BuildContext context) {

      container   = AppStateContainer.of(context);
      appState    = container.state;
      
      if( appState.verbose >= 3 ) { print( "Build Activitypage, scaffold x,y: " + appState.screenWidth.toString() + " " + appState.screenHeight.toString() ); }

      return _makeActivityZone();
   }
}
