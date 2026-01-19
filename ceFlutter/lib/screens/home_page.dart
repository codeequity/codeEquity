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

   late bool toggleRegister;
   late bool toggleVenture; 
   late bool toggleProject;
   late bool togglePending;
   late bool toggleDaily;  
   late bool updateView;

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
   }

   @override
   void dispose() {
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
         key: Key( txt ),
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
      Widget project     = _makeEntry( "Create CodeEquity Project", 0, true, last: toggleProject );
      subTasks.add( Wrap( spacing: 0, children: [ project, toggleProject ? expand : shrink ] ));

      if( !toggleProject ) {
         subTasks.add( _makeEntry( "Complete Project Profile", 3.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "Associate with a Host", 3.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "Associate Host projects with Equity Plan", 3.0 * appState.MID_PAD, false, last: true ));
      }
      return subTasks;
   }

   void _cancel() {
      print( "Agreement not agreed" );
      Navigator.of( context ).pop();
   }

   void _accept( Person cePeep, Agreement agmt ) async {
      print( "Agreement agreed" );
      cePeep.accept( agmt );
      String user = json.encode( cePeep );
      String ppostData = '{ "Endpoint": "PutPerson", "NewPerson": $user, "Verify": "false" }';
      await updateDynamo( context, container, ppostData, "PutPerson" );

      setState(() => updateView = true );
      appState.hoverChunk = "";      
      Navigator.of( context ).pop();      
   }
   
   void _showDoc( Person cePeep, DocType docType, double width ) async {
      assert( !cePeep!.registered );
      Agreement agmt = await fetchAgreement( context, container, enumToStr( docType ) );
      List<Widget> buttons = [];
      buttons.add( new TextButton( key: Key( 'Accept' ), child: new Text("Accept Statement"), onPressed: () => _accept( cePeep!, agmt ) ));
      buttons.add( new TextButton( key: Key( 'Cancel' ), child: new Text("Reject"), onPressed: _cancel ));
      
      if( docType == DocType.privacy ) {
         await showDialog(
            context: context,
            builder: (BuildContext context) {
                             return AlertDialog(
                                scrollable: true,
                                title: new Text( agmt.title ),
                                content: Container( width: 0.6 * width, child: new Text( agmt.content )),
                                actions: buttons);
                          });
      }
      else {
         String? doc = agmt.compose( cePeep! );
         
         print( "decoded " + doc.length.toString() );
         await showDialog(
            context: context,
            builder: (BuildContext context) {
                             return AlertDialog(
                                scrollable: true,
                                title: new Text( agmt.title ),
                                content: Html( data: doc,
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
                                   ),
                                actions: buttons);
                          });
      }
   }

   void _cancelEdit() {
      print( "Cancel update profile" );
      Navigator.of( context ).pop();
   }

   void _saveProfile( Person cePeep, List<TextEditingController> controllers) {
      
      // Note: userName assigned during signup, can not change.
      // Note: email assigned during signup, this can change.
      assert( controllers.length == 5 );
      String na = controllers[0].text;
      String gb = controllers[1].text;
      String em = controllers[2].text;
      String ph = controllers[3].text;
      String pa = controllers[4].text;

      cePeep.legalName      = na != "" ? na : cePeep.legalName;
      cePeep.email          = em != "" ? em : cePeep.email;
      cePeep.phone          = ph != "" ? ph : cePeep.phone;
      cePeep.mailingAddress = pa != "" ? pa : cePeep.mailingAddress;
      
      if( gb != "" )                                           { cePeep.goesBy = gb; }
      else if( cePeep.goesBy == "" && cePeep.legalName != "" ) { cePeep.goesBy = cePeep.legalName.split(" ")[0]; }

      cePeep.completeProfile();
      writeCEPerson( appState, context, container, cePeep );
      setState(() => updateView = true );
      
      Navigator.of( context ).pop();
   }

   void _editProfile( Person cePeep, double width ) async {
      TextEditingController na = new TextEditingController();
      TextEditingController gb = new TextEditingController();
      TextEditingController em = new TextEditingController();
      TextEditingController ph = new TextEditingController();
      TextEditingController pa = new TextEditingController();

      List<TextEditingController> controllers = [na, gb, em, ph, pa];
      List<String>                header      = ["Legal name", "Goes by", "Email", "Phone", "Mailing Address"];
      List<String>                curVals     = [];
      List<bool>                  required    = [true, false, true, true, false ];

      String tipR = "Required to participate in CodeEquity as a contributor that can earn equity. ";
      String tipO = "Your Equity Agreement requires a mailing address for written correspondance.  While not required, it is strongly recommended.";
      List<String> toolTip = [ tipR, tipO, tipR, tipR, tipO ];
      
      curVals.add( cePeep.legalName );
      curVals.add( cePeep.goesBy );
      curVals.add( cePeep.email );
      curVals.add( cePeep.phone );
      curVals.add( cePeep.mailingAddress );

      assert( cePeep.userName != "" );
      String popupTitle = "Edit " + cePeep.userName + "'s Profile";      
      await editForm( context, appState, popupTitle, header, controllers, curVals, required, toolTip, () => _saveProfile( cePeep, controllers ), () => _cancelEdit() );
   }
   
   List<Widget> makeMe( context, container, double width ) {
      assert( appState.ceUserId != "" );
      Person? cePeep = appState.cePeople[ appState.ceUserId ];
      assert( cePeep != null );
      
      List<Widget> subTasks = [];
      
      if( !cePeep!.signedPrivacy() )   { subTasks.add( _makeLink( "Privacy Notice", width * 0.2, () => _showDoc( cePeep!, DocType.privacy, width ))); }
      if( !cePeep!.completeProfile() ) { subTasks.add( _makeLink( "Complete profile", width * 0.2, () => _editProfile( cePeep!, width ), last: true )); }

      return subTasks;      
   }
   
   List<Widget> makeGettingStarted( context, container, double width ) {
      List<Widget> subTasks = [];

      assert( appState.ceUserId != "" );
      Person? cePeep = appState.cePeople[ appState.ceUserId ];
      assert( cePeep != null );

      if( !cePeep!.registered ) { 
         Widget gettingStarted = makeTitleText( appState, "Getting started", width, false, 1, fontSize: 16 );
         subTasks.add( gettingStarted );
         subTasks.addAll( makeMe( context, container, width ) );
      }
      return subTasks;
   }

   List<Widget> makeRegister( double width ) {
      assert( appState.ceUserId != "" );
      Person? cePeep = appState.cePeople[ appState.ceUserId ];
      assert( cePeep != null );

      Widget expand = makeExpander( "toggleRegister", true );
      Widget shrink = makeExpander( "toggleRegister", false );

      List<Widget> subTasks = [];
      Widget pending = makeTitleText( appState, "New Ventures & Projects", width * .3, false, 1, fontSize: 16 );
      subTasks.add( Wrap( spacing: 0, children: [ pending, toggleRegister ? expand : shrink ] ));

      if( !toggleRegister ) {
         if( !cePeep!.signedEquity() )   { subTasks.add( _makeLink( "Register with a Venture", width * 0.2, () => _showDoc( cePeep!, DocType.equity, width ))); }
         subTasks.addAll( makeVenture() );
         subTasks.addAll( makeProject() );
      }
      return subTasks;
   }

   List<Widget> makePending( double width ) {
      Widget expand = makeExpander( "togglePending", true );
      Widget shrink = makeExpander( "togglePending", false );

      List<Widget> subTasks = [];
      Widget pending = makeTitleText( appState, "Pending tasks", width / 6.0, false, 1, fontSize: 16 );
      subTasks.add( Wrap( spacing: 0, children: [ pending, togglePending ? expand : shrink ] ));

      if( !togglePending ) {
         subTasks.add( _makeEntry( "14 pending approvals", 2.0 * appState.MID_PAD, false ) );
         subTasks.add( _makeEntry( "2 pending invites", 2.0 * appState.MID_PAD, false ) );
         subTasks.add( _makeEntry( "1 pending request", 2.0 * appState.MID_PAD, false, last: true ) );
      }
      return subTasks;
   }

   List<Widget> makeDaily( double width ) {

      Widget expand = makeExpander( "toggleDaily", true );
      Widget shrink = makeExpander( "toggleDaily", false );

      List<Widget> subTasks = [];
      Widget daily = makeTitleText( appState, "Today's stats", width / 6.0, false, 1, fontSize: 16 );
      subTasks.add( Wrap( spacing: 0, children: [ daily, toggleDaily ? expand : shrink ] ));

      if( !toggleDaily ) {
         subTasks.add( _makeEntry( "13 PEQs added to PLAN -> 98", 2.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "1 PEQ removed from PROG -> 23", 2.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "1 PEQ added to PEND -> 3", 2.0 * appState.MID_PAD, false ));
         subTasks.add( _makeEntry( "2 PEQs added to ACCR - 43", 2.0 * appState.MID_PAD, false ));
      }

      return subTasks;
   }
   
   Widget _makeActivityZone( context, container ) {
      final w1 = rhsFrameMinWidth - appState.GAP_PAD - appState.TINY_PAD;
      final w2 = rhsFrameMaxWidth - appState.GAP_PAD - appState.TINY_PAD;

      // Turn each getting started off if done
      // Turn pending/daily off if have getting started

      if( updateView ) {
         tasks = [];
         
         // Getting started 
         tasks.addAll( makeGettingStarted( context, container, w2 ) );
         tasks.addAll( makeRegister( w2 ) );
         tasks.addAll( makePending( w2 ) );
         tasks.addAll( makeDaily( w2 ) );
      
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
   
   Widget _makeBody( context, container ) {
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
                  _makeActivityZone( context, container )
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
         body: _makeBody( context, container )
         );
   }
}
