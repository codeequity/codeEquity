import 'dart:convert';                   // json encode/decode
import 'dart:math';               
import 'package:flutter/services.dart';  // orientation
import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ghUtils.dart';     // updateGHRepos
import 'package:ceFlutter/utils/ceUtils.dart';
import 'package:ceFlutter/utils/awsUtils.dart';

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/CEVenture.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/PlaceHolder.dart';

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

   @override
   void initState() {
      super.initState();
      ceProjectLoading = false;
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

   Widget _addHostAcct() {
      return makeActionButtonFixed(
         appState,
         "Go",
         buttonWidth,
         () async
         {
            MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEAddHostPage());
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
                       Wrap( spacing: 10, children: [ makeActionableText( appState, itemName, itemName, _setTitle, _unsetTitle, textWidth, false, 1, sub: true, lgap: 2.0 * appState.GAP_PAD ),
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


   // XXX host-specific
   // XXX Need to add visual cue if repos run out of room, can be hard to tell it's scrollable
   List<Widget> _makeRepos( hosta ) {
      // print( "MakeRepos" );
      final buttonWGaps = buttonWidth + 2*appState.GAP_PAD + appState.TINY_PAD;              // 2*container + button + pad
      final textWidth = min( lhsFrameMaxWidth - buttonWGaps, appState.screenWidth * .15 );   // no bigger than fixed LHS pane width
      List<Widget> repoChunks = [];
      var chunkHeight = 0.0;

      Widget _connectBar = Row(
         crossAxisAlignment: CrossAxisAlignment.center,
         mainAxisAlignment: MainAxisAlignment.spaceBetween,
         children: <Widget>[ makeTitleText( appState, "Connect to GitHub", textWidth, false, 1 ),
                             Container( width: 10 ),
                             _addHostAcct(),
                             Container( width: 10 ),
            ]);

      bool addedMore = false;
      if( hosta == -1 ) {
         repoChunks.add( _connectBar );
         chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;
         addedMore = true;
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
            chunks.add( _makeChunk( cep.ceProjectId, cep.ceProjectId, vent.ceVentureId ));
            chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;
         }
      }
      chunks.add( Container( height: appState.BASE_TXT_HEIGHT ));
      chunks.add( makeHDivider( appState, textWidth, appState.GAP_PAD, appState.screenWidth * .15 ));      
      chunks.add( Container( height: appState.BASE_TXT_HEIGHT ));
      chunkHeight += 2*appState.BASE_TXT_HEIGHT + 2;

      runningLHSHeight += chunkHeight;
      return chunks;
   }

   /*
   // XXX Need to add visual cue if repos run out of room, can be hard to tell it's scrollable
   List<Widget> _makeCEProjs( hosta ) {
      // print( "MakeCEProj" );
      final buttonWGaps = buttonWidth + 2*appState.GAP_PAD + appState.TINY_PAD;      
      final textWidth = min( lhsFrameMaxWidth - buttonWGaps, appState.screenWidth * .15 );   // no bigger than fixed LHS pane width
      List<Widget> chunks = [];
      var chunkHeight = 0.0;

      Widget _ceProjBar = Row(
         crossAxisAlignment: CrossAxisAlignment.center,
         mainAxisAlignment: MainAxisAlignment.spaceBetween,
         children: <Widget>[ makeTitleText( appState, "CodeEquity Projects", textWidth, false, 1 ),
                             Container( width: 10 ),
                             _newCEProjButton(),
                             Container( width: 10 ),
            ]);
         
      chunks.add( _ceProjBar );
      chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;

      for( var i = 0; i < hosta.ceProjectIds.length; i++ ) {
         chunks.add( _makeChunk( hosta.ceProjectIds[i], ceProj:true ));
         chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;
         var repos = hosta.ceProjRepos[ hosta.ceProjectIds[i] ] ?? [];
         for( var j = 0; j < repos.length; j++ ) {
            chunks.add( _makeChunk( repos[j] ));
            chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;
         }
      }
      chunks.add( Container( height: appState.BASE_TXT_HEIGHT ));
      chunks.add( makeHDivider( appState, textWidth, appState.GAP_PAD, appState.screenWidth * .15 ));      
      chunks.add( Container( height: appState.BASE_TXT_HEIGHT ));
      chunkHeight += 2*appState.BASE_TXT_HEIGHT + 2;

      runningLHSHeight += chunkHeight;
      return chunks;
   }
   */
   
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
   
   Widget _makeActivityZone() {
      final w1 = rhsFrameMinWidth - appState.GAP_PAD - appState.TINY_PAD;
      final w2 = rhsFrameMaxWidth - appState.GAP_PAD - appState.TINY_PAD;

      // XXX Placeholder.
      if( appState.funny == "" ) {
         Funnies fun    = new Funnies();
         appState.funny = fun.getOne();
      }

      return Column( 
         crossAxisAlignment: CrossAxisAlignment.start,
         mainAxisAlignment: MainAxisAlignment.start,
         children: <Widget>[
            Container( width: w1, height: appState.GAP_PAD ),
            Container( color: appState.BACKGROUND, child: makeTitleText( appState, "Activity", w1, true, 1 )),
            Container( width: w1, height: 1.5 * appState.CELL_HEIGHT ),
            ceProjectLoading ?
               Wrap( spacing: 0, children: [ Container( width: w1, height: 2.0 * appState.CELL_HEIGHT ), CircularProgressIndicator() ] ) : 
               Container( color: Colors.white, child: makeBodyText( appState, appState.funny, w2, true, 1 ))
            ]);
   }
   
   Widget _makeBody() {
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
                  _makeActivityZone()
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
         body: _makeBody()
         );
   }
}
