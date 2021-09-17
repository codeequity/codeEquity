import 'dart:convert';                   // json encode/decode
import 'dart:math';               
import 'package:flutter/services.dart';  // orientation
import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/screens/add_gh_page.dart';


class CEHomePage extends StatefulWidget {
   CEHomePage({Key key}) : super(key: key);

  @override
  _CEHomeState createState() => _CEHomeState();
}

class _CEHomeState extends State<CEHomePage> {

   var      container;
   AppState appState;

   var      runningLHSHeight;

   // iphone 5: 320px
   static const lhsPaneMinWidth = 250.0;
   static const lhsPaneMaxWidth = 300.0;
   static const rhsPaneMinWidth = 300.0;
   static const buttonWidth     =  80.0;
   static const vBarWidth       =   5.0;
   
   @override
   void initState() {
      print( "HOMEPAGE INIT" );
      super.initState();
   }

   @override
   void dispose() {
      super.dispose();
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
      final textWidth = appState.screenWidth * .4;
      return GestureDetector(
         onTap: ()
         {
            appState.selectedRepo = repoName;
            notYetImplemented(context);            
         },
         child: makeActionText( appState, repoName, textWidth, false, 1 )
         );
   }
   
   // XXX Need to add visual cue if repos run out of room, can be hard to tell it's scrollable
   List<Widget> _makeRepos( gha ) {
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

      // Do we have any regular GH projects?  Hmm.. no matter.  want this present anyway.
      // if( gha.ceProject.any(( bool p ) => !p )) {}
      for( var i = 0; i < gha.repos.length; i++ ) {
         if( !gha.ceProject[i] ) {
            repoChunks.add( _makeRepoChunk( gha.repos[i] ));
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
   
   // XXX Need to add visual cue if repos run out of room, can be hard to tell it's scrollable
   List<Widget> _makeCEProjs( gha ) {
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

      // Do we have any ceProjects?  Hmm.. no matter.
      // if( gha.ceProject.any(( bool p ) => p )) {}
      for( var i = 0; i < gha.repos.length; i++ ) {
         if( gha.ceProject[i] ) {
            repoChunks.add( _makeRepoChunk( gha.repos[i] ));
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

      if( appState.myGHAccounts != null || appState.ghUpdated ) {

         for( final gha in appState.myGHAccounts ) {
            acctList.addAll( _makeCEProjs( gha ));
            acctList.addAll( _makeRepos( gha ));
         }
         
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
      else { 
         return CircularProgressIndicator();
      }
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
         print( "AppState not ? Loaded" );
         return CircularProgressIndicator();
      }
   }
   
   @override
      Widget build(BuildContext context) {

      container   = AppStateContainer.of(context);
      appState    = container.state;

      // ListView horizontal messes with singleChildScroll (to prevent overflow on orientation change). only on this page.
      SystemChrome.setPreferredOrientations([ DeviceOrientation.portraitUp, DeviceOrientation.portraitDown ]);
      appState.screenHeight = MediaQuery.of(context).size.height;
      appState.screenWidth  = MediaQuery.of(context).size.width;
      runningLHSHeight = 0;
      
      // print( "Build Homepage, scaffold x,y: " + appState.screenWidth.toString() + " " + appState.screenHeight.toString() );
      // print( getToday() );
      
      return Scaffold(
         appBar: makeTopAppBar( context, "Home" ),
         body: _makeBody()
         );
   }
}
