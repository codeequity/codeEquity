import 'dart:convert';                   // json encode/decode
import 'dart:math';               
import 'package:flutter/services.dart';  // orientation
import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/placeHolder.dart';

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

   var      runningLHSHeight;

   // iphone 5: 320px X 568
   static const maxPaneWidth    = 950.0;
   static const lhsPaneMinWidth = 250.0;
   static const lhsPaneMaxWidth = 300.0;
   static const rhsPaneMinWidth = 300.0;
   static const rhsPaneMaxWidth = maxPaneWidth - lhsPaneMaxWidth;
   static const buttonWidth     =  80.0;
   static const vBarWidth       =   5.0;

   @override
   void initState() {
      super.initState();
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
            Navigator.push( context, newPage );
         });
   }


   // This GD opens and closes peqSummary.
   Widget _makeChunk( String itemName, { ceProj = false } ) {
      final textWidth = appState.screenWidth * .4;
      Widget itemTxt = Container( width: 1, height: 1 );

      void _setTitle( PointerEvent event ) {
         setState(() => appState.hoverChunk = itemName );
      }
      void _unsetTitle( PointerEvent event ) {
         setState(() => appState.hoverChunk = "" );
      }


      if( ceProj ) {
         // print( "Chunking ceProj " + itemName );
         itemTxt = Wrap( spacing: 10, children: [ makeActionableText( appState, itemName, _setTitle, _unsetTitle, textWidth, false, 1 ),
                                                  Container( width: buttonWidth, height: 1 ) ] );
         return GestureDetector(
            onTap: () async
            {
               appState.selectedCEProject = itemName;
               await reloadRepo( context, container );
               
               MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEProjectPage());
               Navigator.push( context, newPage );
            },
            child: itemTxt
            );
         
      }
      else {
         // print( "Chunking repo " + itemName );
         itemTxt = Wrap( spacing: 10, children: [ makeIndentedText( appState, itemName, textWidth, false, 1 ),
                                                  Container( width: buttonWidth, height: 1 ) ] );
         return itemTxt;
      }
      
   }

   // XXX host-specific
   // XXX Need to add visual cue if repos run out of room, can be hard to tell it's scrollable
   List<Widget> _makeRepos( hosta ) {
      // print( "MakeRepos" );
      final buttonWGaps = buttonWidth + 2*appState.GAP_PAD + appState.TINY_PAD;              // 2*container + button + pad
      final textWidth = min( lhsPaneMaxWidth - buttonWGaps, appState.screenWidth * .15 );   // no bigger than fixed LHS pane width
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
            repoChunks.add( _makeChunk( hosta.futureCEProjects[i] ));
            chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;
            addedMore = true;
         }
      }
      if( addedMore ) {
         repoChunks.add( Container( height: appState.BASE_TXT_HEIGHT ));
         repoChunks.add( makeHDivider( textWidth, appState.GAP_PAD, appState.screenWidth * .15 ));      
         repoChunks.add( Container( height: appState.BASE_TXT_HEIGHT ));
      }
      chunkHeight += 2*appState.BASE_TXT_HEIGHT + 2;

      runningLHSHeight += chunkHeight;
      return repoChunks;
   }

   List<Widget> _makeRefresh() {
      List<Widget> refresh = [];

      final textWidth = min( lhsPaneMaxWidth - (2*appState.FAT_PAD + appState.TINY_PAD), appState.screenWidth * .15 );   // no bigger than fixed LHS pane width
      Widget button = makeActionButtonFixed(
         appState,
         "Refresh Projects",
         textWidth,
         () async
         {
            await updateProjects( context, container );
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
   
   // XXX Need to add visual cue if repos run out of room, can be hard to tell it's scrollable
   List<Widget> _makeCEProjs( hosta ) {
      // print( "MakeCEProj" );
      final buttonWGaps = buttonWidth + 2*appState.GAP_PAD + appState.TINY_PAD;      
      final textWidth = min( lhsPaneMaxWidth - buttonWGaps, appState.screenWidth * .15 );   // no bigger than fixed LHS pane width
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
      chunks.add( makeHDivider( textWidth, appState.GAP_PAD, appState.screenWidth * .15 ));      
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
               acctList.addAll( _makeCEProjs( hosta ));
               acctList.addAll( _makeRepos( hosta ));
               acctList.addAll( _makeRefresh() );
            }
         }
      }


      appState.hostUpdated = false;
      final lhsMaxWidth  = min( max( appState.screenWidth * .3, lhsPaneMinWidth), lhsPaneMaxWidth );  // i.e. vary between min and max.
      final wrapPoint = lhsMaxWidth + vBarWidth + rhsPaneMinWidth;
      
      // Wrapped?  Reduce height to make room for rhsPane
      var lhsHeight = appState.screenHeight * .946; // room for top bar
      if( appState.screenWidth < wrapPoint ) {
         lhsHeight = min( lhsHeight, runningLHSHeight );
      }
      
      return ConstrainedBox(
         constraints: new BoxConstraints(
            minHeight: appState.BASE_TXT_HEIGHT,
            minWidth:  lhsPaneMinWidth,
            maxHeight: lhsHeight,
            maxWidth:  lhsMaxWidth
            ),
         child: ListView(
            scrollDirection: Axis.vertical,
            children: acctList
            ));
   }
   
   Widget _makeActivityZone() {
      final w1 = rhsPaneMinWidth - appState.GAP_PAD - appState.TINY_PAD;
      final w2 = rhsPaneMaxWidth - appState.GAP_PAD - appState.TINY_PAD;

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
