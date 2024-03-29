import 'dart:convert';                   // json encode/decode
import 'dart:math';               
import 'package:flutter/services.dart';  // orientation
import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/screens/add_gh_page.dart';
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
   static const lhsPaneMinWidth = 250.0;
   static const lhsPaneMaxWidth = 300.0;
   static const rhsPaneMinWidth = 300.0;
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

   Widget _addGHAcct() {
      return makeActionButtonFixed(
         appState,
         "Add",
         buttonWidth,
         () async
         {
            MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEAddGHPage());
            Navigator.push( context, newPage );
         });
   }

   
   // This GD opens and closes peqSummary.
   Widget _makeRepoChunk( String repoName ) {
      print( "Chunking " + repoName );
      final textWidth = appState.screenWidth * .4;
      return GestureDetector(
         onTap: () async
         {
            appState.selectedRepo = repoName;
            for( final gha in appState.myGHAccounts ) {
               for( final ceProj in gha.ceProjectIds ) {
                  for( final repo in gha.ceProjRepos[ceProj] ?? [] ) {
                     if( repoName == repo ) {
                        appState.selectedCEProject = ceProj;
                        break;
                     }
                  }
               }
            }

            await reloadRepo( context, container );
            
            MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEProjectPage());
            Navigator.push( context, newPage );
         },
         child: makeActionText( appState, repoName, textWidth, false, 1 )
         );
   }
   
   // XXX Need to add visual cue if repos run out of room, can be hard to tell it's scrollable
   List<Widget> _makeRepos( gha ) {
      print( "MakeRepos" );
      final buttonWGaps = buttonWidth + 2*appState.GAP_PAD + appState.TINY_PAD;              // 2*container + button + pad
      final textWidth = min( lhsPaneMaxWidth - buttonWGaps, appState.screenWidth * .15 );   // no bigger than fixed LHS pane width
      List<Widget> repoChunks = [];
      var chunkHeight = 0.0;

      Widget _repoBar = Row(
         crossAxisAlignment: CrossAxisAlignment.center,
         mainAxisAlignment: MainAxisAlignment.spaceBetween,
         children: <Widget>[ makeTitleText( appState, "GitHub Repositories", textWidth, false, 1 ),
                             Container( width: 10 ),
                             _addGHAcct(),
                             Container( width: 10 ),
            ]);
         
      repoChunks.add( _repoBar );
      chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;

      // XXX
      print( "XXX fix makerepo" );
      if( gha != -1 ) {
         // Do we have any regular GH projects?  Hmm.. no matter.  want this present anyway.
         // if( gha.ceProject.any(( bool p ) => !p )) {}
         for( var i = 0; i < gha.futureCEProjects.length; i++ ) {
            //if( !gha.ceProject[i] ) {
            repoChunks.add( _makeRepoChunk( gha.futureCEProjects[i] ));
            chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;
               //}
         }
      }
      repoChunks.add( Container( height: appState.BASE_TXT_HEIGHT ));
      repoChunks.add( makeHDivider( textWidth, appState.GAP_PAD, appState.screenWidth * .15 ));      
      repoChunks.add( Container( height: appState.BASE_TXT_HEIGHT ));
      chunkHeight += 2*appState.BASE_TXT_HEIGHT + 2;

      runningLHSHeight += chunkHeight;
      return repoChunks;
   }

   List<Widget> _makeRefresh() {
      List<Widget> refresh = [];

      final textWidth = min( lhsPaneMaxWidth - (2*appState.FAT_PAD + appState.TINY_PAD), appState.screenWidth * .15 );   // no bigger than fixed LHS pane width
      Widget button = makeActionButtonFixed(
         appState,
         "Refresh Repo List",
         textWidth,
         () async
         {
            await updateProjects( context, container );
            setState(() => appState.ghUpdated = true );            
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
   List<Widget> _makeCEProjs( gha ) {
      print( "MakeCEProj" );
      final buttonWGaps = buttonWidth + 2*appState.GAP_PAD + appState.TINY_PAD;      
      final textWidth = min( lhsPaneMaxWidth - buttonWGaps, appState.screenWidth * .15 );   // no bigger than fixed LHS pane width
      List<Widget> repoChunks = [];
      var chunkHeight = 0.0;

      Widget _ceProjBar = Row(
         crossAxisAlignment: CrossAxisAlignment.center,
         mainAxisAlignment: MainAxisAlignment.spaceBetween,
         children: <Widget>[ makeTitleText( appState, "Code Equity Projects", textWidth, false, 1 ),
                             Container( width: 10 ),
                             _newCEProjButton(),
                             Container( width: 10 ),
            ]);
         
      repoChunks.add( _ceProjBar );
      chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;

      for( var i = 0; i < gha.ceProjectIds.length; i++ ) {
         repoChunks.add( _makeRepoChunk( gha.ceProjectIds[i] ));
         chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;
         var repos = gha.ceProjRepos[ gha.ceProjectIds[i] ];
         for( var j = 0; j < repos.length; j++ ) {
            repoChunks.add( _makeRepoChunk( repos[j] ));
            chunkHeight += appState.BASE_TXT_HEIGHT + appState.MID_PAD;
         }
      }
      repoChunks.add( Container( height: appState.BASE_TXT_HEIGHT ));
      repoChunks.add( makeHDivider( textWidth, appState.GAP_PAD, appState.screenWidth * .15 ));      
      repoChunks.add( Container( height: appState.BASE_TXT_HEIGHT ));
      chunkHeight += 2*appState.BASE_TXT_HEIGHT + 2;

      runningLHSHeight += chunkHeight;
      return repoChunks;
   }

   // Keep LHS panel between 250 and 300px, no matter what.
   Widget _showGHAccts() {
      List<Widget> acctList = [];

      // Whitespace
      acctList.add( Container( height: appState.BASE_TXT_HEIGHT ) );
      runningLHSHeight += appState.BASE_TXT_HEIGHT;
      
      print( "SHOW " + appState.ghUpdated.toString() );
      if( appState.myGHAccounts != null || appState.ghUpdated ) {

         if( appState.myGHAccounts.length <= 0 ) {
            acctList.addAll( _makeRepos( -1 ) );
         }
         else {
            for( final gha in appState.myGHAccounts ) {
               acctList.addAll( _makeCEProjs( gha ));
               acctList.addAll( _makeRepos( gha ));
            }
         }
      }
      
      acctList.addAll( _makeRefresh() );
      
      appState.ghUpdated = false;
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
            minWidth: lhsPaneMinWidth,
            maxHeight: lhsHeight,
            maxWidth:  lhsMaxWidth
            ),
         child: ListView(
            scrollDirection: Axis.vertical,
            children: acctList
            ));
   }
   
   Widget _makeActivityZone() {
      final w = rhsPaneMinWidth - appState.GAP_PAD - appState.TINY_PAD;
      return Column( 
         crossAxisAlignment: CrossAxisAlignment.start,
         mainAxisAlignment: MainAxisAlignment.start,
         children: <Widget>[
            Container( width: w, height: appState.GAP_PAD ),
            makeTitleText( appState, "Activity", w, true, 1 )
            ]);
   }
   
   Widget _makeBody() {
      if( appState.loaded ) {
         return
            Wrap(
               children: <Widget>[
                  Container(
                     color: Colors.white,
                     child: _showGHAccts()
                     ),
                  const VerticalDivider(
                     color: Colors.grey,
                     thickness: 1,
                     indent: 0,
                     endIndent: 0,
                     width: vBarWidth,
                     ),
                  
                  Container(
                     color: appState.BACKGROUND,
                     child: _makeActivityZone()
                     )
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
