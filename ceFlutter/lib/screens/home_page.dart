import 'dart:convert';                   // json encode/decode, b64 coding
import 'dart:math';               
import 'package:flutter/services.dart';  // orientation
import 'package:flutter/material.dart';

// import 'package:docx_viewer/docx_viewer.dart';
// import 'package:docx_file_viewer/docx_file_viewer.dart';
import 'package:flutter_html/flutter_html.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ghUtils.dart';     // updateGHRepos
import 'package:ceFlutter/utils/ceUtils.dart';
import 'package:ceFlutter/utils/awsUtils.dart';

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/CEVenture.dart';
import 'package:ceFlutter/models/EquityPlan.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/Person.dart';
import 'package:ceFlutter/models/AcceptedDoc.dart';
import 'package:ceFlutter/models/Agreement.dart';

import 'package:ceFlutter/screens/add_host_page.dart';
import 'package:ceFlutter/screens/project_page.dart';

class CEHomePage extends StatefulWidget {
   CEHomePage({Key? key}) : super(key: key);

  @override
  _CEHomeState createState() => _CEHomeState();
}

class _CEHomeState extends State<CEHomePage> {

   late var      container;
   late AppState appState;
   late bool     ceProjectLoading;

   var      runningLHSHeight;

   // Frames are screen-specific, fit inside Panes which are app-level.
   static const lhsFrameMinWidth = 250.0;
   static const lhsFrameMaxWidth = 300.0;
   static const rhsFrameMinWidth = 300.0;
   static const buttonWidth     =  80.0;
   static const vBarWidth       =   5.0;
   late double  rhsFrameMaxWidth;
   late double  overlayMaxWidth;

   // Activity panel
   late bool toggleRegister;
   late bool toggleVenture; 
   late bool toggleProject;
   late bool togglePending;
   late bool toggleDaily;  
   late bool updateView;

   final ScrollController _scrollController = ScrollController();
   late AcceptedDoc scrollDoc;
   late Person      applicant;
   late Person      approver;
   late CEVenture   targCEV;
   
   late List<Widget> tasks;
   
   
   @override
   void initState() {
      super.initState();
      ceProjectLoading = false;

      toggleRegister = true;
      toggleVenture  = true;   
      toggleProject  = true;   
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
      super.dispose();
      if( appState.verbose >= 2 ) { print( "HP dispose" ); }
   }

   Widget _newCEProjButton() {
      return makeActionButtonFixed(
         appState,
         "New",
         buttonWidth, 
         () async
         {
            notYetImplemented(context);            
         });
   }

   Widget _addHostAcct( HostPlatforms hostPlat ) {
      return makeActionButtonFixed(
         appState,
         "Go",
         buttonWidth,
         () async
         {
            MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEAddHostPage(), settings: RouteSettings( arguments: { "hostPlat": hostPlat } ));
            confirmedNav( context, container, newPage );
         });
   }


   // If user clicks ceProject, we know ceVenture.
   // If user clicks ceVenture, we may know ceProject .. depends on if there are multiple.
   Widget _makeChunk( String itemName, String itemId, String partner, { ceVent = false } ) {
      final textWidth = appState.screenWidth * .4;

      void _setTitle( PointerEvent event )   { setState(() => appState.hoverChunk = ceVent ? "vent " + itemName : itemName ); }
      void _unsetTitle( PointerEvent event ) { setState(() => appState.hoverChunk = "" );       }

      Widget itemTxt = ceVent ?
                       Wrap( spacing: 10, children: [ makeActionableText( appState, itemName, "vent " + itemName, _setTitle, _unsetTitle, textWidth, false, 1 ),
                                                      Container( width: buttonWidth, height: 1 ) ] )
                       : 
                       Wrap( spacing: 10, children: [ makeActionableText( appState, itemName, itemName, _setTitle, _unsetTitle, textWidth, false, 1,
                                                                          sub: true, lgap: 2.0 * appState.GAP_PAD, tgap: appState.TINY_PAD ),
                                                      Container( width: buttonWidth, height: 1 ) ] );

      return GestureDetector(
         onTap: () async
         {
            Map<String,int> screenArgs = {"initialPage": 0 };            
            if( ceVent ) {
               appState.selectedCEVenture = itemId;
               setState(() => ceProjectLoading = true );

               if( partner != "" ) {
                  appState.selectedCEProject = partner;
                  await reloadCEProject( context, container );
               }
               else {
                  await reloadCEVentureOnly( context, container );
               }
               ceProjectLoading = false;
               
               screenArgs["initialPage"] = 3;
            }
            else {

               appState.selectedCEProject = itemId;
               assert( partner != "" ); 
               appState.selectedCEVenture = partner;

               setState(() => ceProjectLoading = true );
               await reloadCEProject( context, container );
               ceProjectLoading = false;
               screenArgs["initialPage"] = 1;
            }
            MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEProjectPage(), settings: RouteSettings( arguments: screenArgs ));
            confirmedNav( context, container, newPage );
         },
         child: itemTxt
         );
   }


   // XXX Need to add visual cue if repos run out of room, can be hard to tell it's scrollable
   List<Widget> _makeRepos( hosta ) {
      // print( "MakeRepos" );
      final buttonWGaps = buttonWidth + 2*appState.GAP_PAD + appState.TINY_PAD;              // 2*container + button + pad
      final textWidth = min( lhsFrameMaxWidth - buttonWGaps, appState.screenWidth * .15 );   // no bigger than fixed LHS pane width
      List<Widget> repoChunks = [];
      var chunkHeight = 0.0;

      List<Widget> _connectBar = [];
      for( var hostPlat in HostPlatforms.values ) {
         Widget connect = Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[ makeTitleText( appState, "Connect to " + enumToStr( hostPlat ), textWidth, false, 1 ),
                                Container( width: 10 ),
                                _addHostAcct( hostPlat ),
                                Container( width: 10 ),
               ]);
         _connectBar.add( connect );
      }
      
      bool addedMore = false;
      if( hosta == -1 ) {
         for( var i = 0; i < _connectBar.length; i++ ) {
            repoChunks.add( _connectBar[i] );
            chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;
            addedMore = true;
         }
      }
      else {
         if( hosta.futureCEProjects.length > 0 ) {
            repoChunks.add( makeTitleText( appState, "Future CodeEquity Projects", textWidth, false, 1 ) );
            chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;
            addedMore = true;
         }
         for( var i = 0; i < hosta.futureCEProjects.length; i++ ) {
            repoChunks.add( _makeChunk( hosta.futureCEProjects[i], "", "" ));
            chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;
            addedMore = true;
         }
      }
      if( addedMore ) {
         repoChunks.add( Container( height: appState.BASE_TXT_HEIGHT ));
         repoChunks.add( makeHDivider( appState, textWidth, appState.GAP_PAD, appState.screenWidth * .15 ));      
         repoChunks.add( Container( height: appState.BASE_TXT_HEIGHT ));
      }
      chunkHeight += 2*appState.BASE_TXT_HEIGHT + 2;

      runningLHSHeight += chunkHeight;
      return repoChunks;
   }

   
   List<Widget> _makeRefresh() {
      List<Widget> refresh = [];

      final textWidth = min( lhsFrameMaxWidth - (2*appState.FAT_PAD + appState.TINY_PAD), appState.screenWidth * .15 );   // no bigger than fixed LHS pane width
      Widget button = makeActionButtonFixed(
         appState,
         "Refresh Projects",
         textWidth,
         () async
         {
            await updateGHRepos( context, container );
            setState(() => appState.hostUpdated = true );            
         }); 
      
      Widget buttonRow = Row(
         crossAxisAlignment: CrossAxisAlignment.center,
         mainAxisAlignment: MainAxisAlignment.spaceBetween,
         children: <Widget>[ Container( width: appState.FAT_PAD),
                             button,
                             Container( width: appState.FAT_PAD),
            ]);
      
      refresh.add( buttonRow );
      refresh.add( Container( height: appState.BASE_TXT_HEIGHT ));

      runningLHSHeight += 2*appState.BASE_TXT_HEIGHT;
      return refresh;
   }
   
   // XXX Need to add visual cue for scroll when relevant - hard to tell.
   List<Widget> _makeCEVs( hosta ) {
      final buttonWGaps = buttonWidth + 2*appState.GAP_PAD + appState.TINY_PAD;      
      final textWidth = min( lhsFrameMaxWidth - buttonWGaps, appState.screenWidth * .15 );   // no bigger than fixed LHS pane width
      List<Widget> chunks = [];
      var chunkHeight = 0.0;

      Widget _ceVentBar = Row(
         crossAxisAlignment: CrossAxisAlignment.center,
         mainAxisAlignment: MainAxisAlignment.spaceBetween,
         children: <Widget>[ makeTitleText( appState, "CodeEquity Ventures", textWidth, false, 1 ),
                             Container( width: 10 ),
                             _newCEProjButton(),
                             Container( width: 10 ),
            ]);
         
      chunks.add( _ceVentBar );
      chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;

      for( final vent in hosta.getVentures( appState) ) {
         List<CEProject> projs = hosta.getCEPsPerVenture( appState, vent.ceVentureId );
         String pname = projs.length == 1 ? projs[0].ceProjectId : "";
         chunks.add( _makeChunk( vent.name, vent.ceVentureId, pname, ceVent:true, ));
         chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;
         for( final cep in projs ) {
            chunks.add( _makeChunk( cep.name, cep.ceProjectId, vent.ceVentureId ));
            chunkHeight += appState.BASE_TXT_HEIGHT + appState.TINY_PAD;
         }
      }
      chunks.add( Container( height: appState.BASE_TXT_HEIGHT ));
      chunks.add( makeHDivider( appState, textWidth, appState.GAP_PAD, appState.screenWidth * .15 ));      
      chunks.add( Container( height: appState.BASE_TXT_HEIGHT ));
      chunkHeight += 2*appState.BASE_TXT_HEIGHT + 2;

      runningLHSHeight += chunkHeight;
      return chunks;
   }

   // Keep LHS panel between 250 and 300px, no matter what.
   Widget _showHostAccts() {
      List<Widget> acctList = [];

      // Whitespace
      acctList.add( Container( height: appState.BASE_TXT_HEIGHT ) );
      runningLHSHeight += appState.BASE_TXT_HEIGHT;
      
      // print( "SHOW " + appState.hostUpdated.toString() );
      if( appState.myHostAccounts != null || appState.hostUpdated ) {

         if( appState.myHostAccounts.length <= 0 ) {
            acctList.addAll( _makeRepos( -1 ) );
         }
         else {
            for( final hosta in appState.myHostAccounts ) {
               acctList.addAll( _makeCEVs( hosta ));
               // acctList.addAll( _makeCEProjs( hosta ));
               acctList.addAll( _makeRepos( hosta ));
               acctList.addAll( _makeRefresh() );
            }
         }
      }


      appState.hostUpdated = false;
      final lhsMaxWidth  = min( max( appState.screenWidth * .3, lhsFrameMinWidth), lhsFrameMaxWidth );  // i.e. vary between min and max.
      final wrapPoint = lhsMaxWidth + vBarWidth + rhsFrameMinWidth;
      
      // Wrapped?  Reduce height to make room for rhsFrame
      var lhsHeight = appState.screenHeight * .946; // room for top bar
      if( appState.screenWidth < wrapPoint ) {
         lhsHeight = min( lhsHeight, runningLHSHeight );
      }
      
      return ConstrainedBox(
         constraints: new BoxConstraints(
            minHeight: appState.BASE_TXT_HEIGHT,
            minWidth:  lhsFrameMinWidth,
            maxHeight: lhsHeight,
            maxWidth:  lhsMaxWidth
            ),
         child: ListView(
            scrollDirection: Axis.vertical,
            children: acctList
            ));
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
         case "toggleVenture" :
            setState(() => toggleVenture = expand ? false : true );
            break;
         case "toggleProject" :
            setState(() => toggleProject = expand ? false : true );
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

      double w2 = rhsFrameMaxWidth - appState.GAP_PAD - appState.TINY_PAD;
      w2 = title ? w2 * 0.4 : w2;
      
      double gap = last  ? ( 1.9 * appState.GAP_PAD ) * .25 : 0.0; // XXX 2x
      
      return Padding(
         padding: EdgeInsets.fromLTRB(pad, 0, 0, 0),
         child: title ?
         makeTitleText( appState, entry, w2, false, 1, lgap: 1.9 * appState.GAP_PAD, bgap: gap ) :
         makeBodyText( appState, entry, w2, false, 1, bgap: gap )
         );
   }


   List<Widget> makeVenture() {
      Widget expand = makeExpander( "toggleVenture", true );
      Widget shrink = makeExpander( "toggleVenture", false );

      List<Widget> subTasks = [];
      Widget venture = _makeEntry( "Create CodeEquity Venture", 0, true );
      subTasks.add( Wrap( spacing: 0, children: [ venture, toggleVenture ? expand : shrink ] ));

      if( !toggleVenture ) {
         subTasks.add( _makeEntry( "Complete Venture Profile", 3.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "Build an Equity Plan", 3.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "Invite collaborators", 3.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "Check collaborator roles", 3.0 * appState.MID_PAD, false ));
      }
      return subTasks;
   }

   List<Widget> makeProject() {
      Widget expand = makeExpander( "toggleProject", true );
      Widget shrink = makeExpander( "toggleProject", false );

      List<Widget> subTasks = [];
      // Widget project     = _makeEntry( "Create CodeEquity Project", 0, true, last: toggleProject );
      Widget project     = _makeEntry( "Create CodeEquity Project", 0, true);
      subTasks.add( Wrap( spacing: 0, children: [ project, toggleProject ? expand : shrink ] ));

      if( !toggleProject ) {
         subTasks.add( _makeEntry( "Complete Project Profile", 3.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "Associate with a Host", 3.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "Associate Host projects with Equity Plan", 3.0 * appState.MID_PAD, false ));
         // subTasks.add( _makeEntry( "Associate Host projects with Equity Plan", 3.0 * appState.MID_PAD, false, last: true ));
      }
      return subTasks;
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

   void _withdraw( Person cePeep ) async {
      String msg = "This action will end your participation in CodeEquity and any CodeEquity Ventures.\n All Provisional Equity that hasn't vested already will be terminated.\n";
      msg       += "Press \'Continue\' to withdraw.";
      String ret = await confirm( context, "Withdraw from CodeEquity?", msg, _noop, _cancel );

      if( ret == "noop" ) {

         List<CEVenture> cevs = cePeep.getCEVs( appState.ceVenture );
         cePeep.withdraw();
         logout( context, appState );

         for( CEVenture cev in cevs ) {
            cev.drop( cePeep );

            // Don't wait
            String cevs = json.encode( cev );
            String ppostData = '{ "Endpoint": "UpdateCEV", "ceVenture": $cevs }';
            updateDynamo( context, container, ppostData, "UpdateCEV" );
         }
            
         // don't await
         String user = json.encode( cePeep );
         String ppostData = '{ "Endpoint": "PutPerson", "NewPerson": $user, "Verify": "false" }';
         updateDynamo( context, container, ppostData, "PutPerson" );
      }
   }
   
   // Accept edits.  Perhaps Accept agreement.  cePeep may either be approver or applicant.  
   Future<void> _accept( Person cePeep, DocType docType, {docId = "", isApplicant = true, controlView = true} ) async {

      print( "Accept for " + cePeep.legalName );
      if( docType != DocType.equity ) {
         assert( docId != "" );
         scrollDoc = new AcceptedDoc( docType: docType, docId: docId, acceptedDate: getToday(), equityVals: {} );
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
   void _checkThenShow( Person cePeep, DocType docType, cevId, isApplicant ) async {
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
                     Widget application = _makeLink( applicant!.legalName + " has applied to " + cev.name, overlayMaxWidth * 0.2,
                                                     () => _checkThenShow( applicant, DocType.equity, cev.ceVentureId, false ));
                     subTasks.add( application );
                  });
            }
                
         });
      
      return subTasks;
   }

   void _registerVenture( Person cePeep, DocType docType ) async {
      void _select( TextEditingController cont ) {
         String cev = cont.text;
         final cevEntry = appState.ceVenture.entries.where( ( entry ) => entry.value.name == cev ).toList();
         assert( cevEntry.length <= 1 );
         if( cevEntry.length < 1 ) {
            showToast( "Venture not found.  Please re-enter the name of the Venture." );
            return;
         }
         String cevId = cevEntry[0].key;
         Navigator.of( context ).pop();
         _checkThenShow( cePeep!, DocType.equity, cevId, true );
      }

      String choose = "Choose the CodeEquity Venture you wish to register with";
      String item   = "Venture name";
      TextEditingController cont = new TextEditingController();
      String hint   = "Search is available if you need a hint";
      editList( context, appState, choose, [item], [cont], [hint], () => _select( cont ), _cancel, null, saveName: "Select" );
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
      _updateDoc( edits );
   }

   // Hints are created from existing editVals.  If user doesn't edit a field directly when having previously
   // done so, that previous value is carried over into new update.
   void _updateDocFree( List<String> item, List<String> hint, List<TextEditingController> cont ) {
      assert( item.length == cont.length );
      Map<String,String> edits = {};
      for( var i = 0; i < cont.length; i++ ) {
         edits[item[i]] = cont[i].text != "" ? cont[i].text : hint[i];
      }
      _updateDoc( edits );
   }
      
   void _fillInBlanks( final box ) {
      assert( scrollDoc != null );
      assert( scrollDoc.filledIn != null );
      assert( box.validate() );

      if( box.type == "blanks" ) {
         List<String>                item = [];
         List<TextEditingController> cont = [];
         List<String>                hint = [];
         for( final entry in box.values.entries ) {
            item.add( entry.key );
            hint.add( entry.value );
            cont.add( new TextEditingController() );
         }
         
         editList( context, appState, box.blankTitle, item, cont, hint,
                   () => _updateDocFree( item, hint, cont ), _cancel, null, subHeader: box.blankSub, headerWidth: overlayMaxWidth * 0.3 );
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

   // Every time enter showDoc with relevant doc, roles are set.
   // Called after first entry (through checkThenShow, which sets roles), or as part of chain of current edits through onScroll
   void _showDoc( Person cePeep, DocType docType, { cevId = "", cevName = "", useCurrent = false, isApplicant = true } ) async {
      Agreement agmt = await fetchAgreement( context, container, enumToStr( docType ) );
      
      if( docType == DocType.privacy ) {
         List<Widget> buttons = [];
         buttons.add( new TextButton( key: Key( 'Accept' ), child: new Text("Accept Statement"), onPressed: () => _accept( cePeep!, agmt.type, docId: agmt.id ) ));
         buttons.add( new TextButton( key: Key( 'Cancel' ), child: new Text("Dismiss"), onPressed: _cancel ));
         await showDialog(
            context: context,
            builder: (BuildContext context) {
                             return AlertDialog(
                                scrollable: true,
                                title: new Text( agmt.title ),
                                content: Container( width: 0.6 * overlayMaxWidth, child: new Text( agmt.content )),
                                actions: buttons);
                          });
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
                  scrollDoc = new AcceptedDoc( docType: agmt.type, docId: agmt.id, acceptedDate: getToday(), equityVals: {} );
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
         
         await showDialog(
            context: context,
            builder: (BuildContext context) {
                             return AlertDialog(
                                // title: new Text( agmt.title ),
                                key: Key( agmt.title ),
                                content: SizedBox(
                                   height: 8000,
                                   child: SingleChildScrollView( 
                                      scrollDirection: Axis.vertical,
                                      key: Key( "scrollDoc" ),
                                      controller: _scrollController, 
                                      child: Html( data: filledInDoc,
                                               // seems to require flex display, which pushes all list items into 1 paragraph
                                               style: Style.fromCss('''         
                                                                    ul {
                                                                       list-style-type: none;
                                                                       padding-left: 0;
                                                                    },
                                                                    ul li {
                                                                    display: block;
                                                                       column-gap: 0px;
                                                                       align-items: center;
                                                                       margin-bottom: 0px;
                                                                    }
                                                                    ''',
                                                                    (css, errors) => errors.toString())
                                         ))),
                                actions: buttons);
                          });
      }
   }

   List<Widget> makeMe( ) {
      assert( appState.ceUserId != "" );
      Person? cePeep = appState.cePeople[ appState.ceUserId ];
      assert( cePeep != null );

      void updateCallback() { setState(() => updateView = true ); }
      
      List<Widget> subTasks = [];
      
      if( !cePeep!.signedPrivacy() )   { subTasks.add( _makeLink( "Privacy Notice", overlayMaxWidth * 0.2, () => _showDoc( cePeep!, DocType.privacy ))); }
      if( !cePeep!.completeProfile() ) {
         subTasks.add( _makeLink( "Complete profile", overlayMaxWidth * 0.2,
                                  () => editProfile( context, container, cePeep!, overlayMaxWidth, updateCallback: () => updateCallback() ), last: true ));
      }

      return subTasks;      
   }
   
   List<Widget> makeGettingStarted( ) {
      List<Widget> subTasks = [];

      assert( appState.ceUserId != "" );
      Person? cePeep = appState.cePeople[ appState.ceUserId ];
      assert( cePeep != null );
      
      if(  !cePeep!.registered ) { 
         Widget gettingStarted = makeTitleText( appState, "Getting started", overlayMaxWidth, false, 1, fontSize: 16 );
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

      Widget expand = makeExpander( "toggleRegister", true );
      Widget shrink = makeExpander( "toggleRegister", false );

      List<Widget> subTasks = [];
      Widget pending = makeTitleText( appState, "Ventures & Projects", overlayMaxWidth * .3, false, 1, fontSize: 16 );
      subTasks.add( Wrap( spacing: 0, children: [ pending, toggleRegister ? expand : shrink ] ));

      if( !toggleRegister ) {
         subTasks.add( _makeLink( "Register with a Venture", overlayMaxWidth * 0.2, () => _registerVenture( cePeep!, DocType.equity )));
         subTasks.addAll( makeVenture() );
         subTasks.addAll( makeProject() );
         subTasks.add( _makeLink( "Withdraw", overlayMaxWidth * 0.2, () => _withdraw( cePeep! ) ));
      }
      return subTasks;
   }
   
   List<Widget> makePending( ) {
      Widget expand = makeExpander( "togglePending", true );
      Widget shrink = makeExpander( "togglePending", false );

      List<Widget> subTasks = [];
      Widget pending = makeTitleText( appState, "Pending tasks", overlayMaxWidth / 6.0, false, 1, fontSize: 16 );
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
      Widget daily = makeTitleText( appState, "Today's stats", overlayMaxWidth / 6.0, false, 1, fontSize: 16 );
      subTasks.add( Wrap( spacing: 0, children: [ daily, toggleDaily ? expand : shrink ] ));

      if( !toggleDaily ) {
         subTasks.add( _makeEntry( "13 PEQs added to PLAN -> 98", 2.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "1 PEQ removed from PROG -> 23", 2.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "1 PEQ added to PEND -> 3", 2.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "2 PEQs added to ACCR - 43", 2.0 * appState.MID_PAD, false ));
      }

      return subTasks;
   }
   
   Widget _makeActivityZone( ) {
      final w1 = rhsFrameMinWidth - appState.GAP_PAD - appState.TINY_PAD;

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
            ceProjectLoading ?
            Wrap( spacing: 0, children: [ Container( width: w1, height: 2.0 * appState.CELL_HEIGHT ), CircularProgressIndicator() ] ) : 
            allActivity
            ]);
   }
   
   Widget _makeBody( ) {
      if( appState.loaded ) {
         return
            Wrap(
               children: <Widget>[
                  Container(
                     color: Colors.white,
                     child: _showHostAccts()
                     ),
                  const VerticalDivider(
                     color: Colors.grey,
                     thickness: 1,
                     indent: 0,
                     endIndent: 0,
                     width: vBarWidth,
                     ),
                  _makeActivityZone( )
                  ]);
      }
      else {
         if( appState.verbose >= 0 ) { print( "AppState not ? Loaded" ); }
         return CircularProgressIndicator();
      }
   }

   @override
      Widget build(BuildContext context) {

      container   = AppStateContainer.of(context);
      appState    = container.state;

      rhsFrameMaxWidth = appState.MAX_PANE_WIDTH - lhsFrameMaxWidth;
      overlayMaxWidth  = rhsFrameMaxWidth - appState.GAP_PAD - appState.TINY_PAD;
      
      assert( appState != null );
      
      // ListView horizontal messes with singleChildScroll (to prevent overflow on orientation change). only on this page.
      SystemChrome.setPreferredOrientations([ DeviceOrientation.portraitUp, DeviceOrientation.portraitDown ]);
      appState.screenHeight = MediaQuery.of(context).size.height;
      appState.screenWidth  = MediaQuery.of(context).size.width;
      runningLHSHeight = 0;
      
      if( appState.verbose >= 3 ) { print( "Build Homepage, scaffold x,y: " + appState.screenWidth.toString() + " " + appState.screenHeight.toString() ); }
      if( appState.verbose >= 3 ) { print( getToday() ); }

      return Scaffold(
         appBar: makeTopAppBar( context, "Home" ),
         body: _makeBody( )
         );
   }
}
