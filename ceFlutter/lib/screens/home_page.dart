import 'dart:convert';                   // json encode/decode
import 'dart:math';               
import 'package:flutter/services.dart';  // orientation
import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';

import 'package:ceFlutter/models/app_state.dart';


class CEHomePage extends StatefulWidget {
   CEHomePage({Key key}) : super(key: key);

  @override
  _CEHomeState createState() => _CEHomeState();
}

class _CEHomeState extends State<CEHomePage> {

   var      container;
   AppState appState;
   bool     addGHAcct;
   var      ghPersonalAccessToken;
   TextEditingController pat;

   static const lhsPaneMinWidth = 250.0;
   
   @override
   void initState() {
      print( "HOMEPAGE INIT" );
      super.initState();

      addGHAcct = false;
   }

   @override
   void dispose() {
      super.dispose();
   }

   Widget _ghAssociateButton() {
      return makeActionButtonSmall(
         appState,
         "Enable Github access",
         () async
         {
            bool associated = await associateGithub( context, container, pat.text );
            if( associated ) {
               setState(() { addGHAcct = false; });                 
            }
            
         });
   }

   Widget _newCEProjButton() {
      return makeActionButtonFixed(
         appState,
         "New",
         80, 
         () async
         {
            notYetImplemented(context);            
         });
   }

   Widget _addGHAcct() {
      return makeActionButtonFixed(
         appState,
         "Add",
         80,
         () async
         {
            setState(() {addGHAcct = true; });
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
         child: makeActionText( repoName, textWidth, false, 1 )
         );
   }
   
   // XXX Need to add visual cue if repos run out of room, can be hard to tell it's scrollable
   List<Widget> _makeRepos( gha ) {
      final textWidth = appState.screenWidth * .15;
      List<Widget> repoChunks = [];

      Widget _repoBar = Row(
         crossAxisAlignment: CrossAxisAlignment.center,
         mainAxisAlignment: MainAxisAlignment.spaceBetween,
         children: <Widget>[ makeTitleText( "GitHub Repositories", textWidth, false, 1 ),
                             Container( width: 10 ),
                             _addGHAcct(),
                             Container( width: 10 ),
            ]);
         
      repoChunks.add( _repoBar );

      // Do we have any regular GH projects?  Hmm.. no matter.  want this present anyway.
      // if( gha.ceProject.any(( bool p ) => !p )) {}
      for( var i = 0; i < gha.repos.length; i++ ) {
         if( !gha.ceProject[i] ) repoChunks.add( _makeRepoChunk( gha.repos[i] ));
      }
      repoChunks.add( Container( height: 20.0 ));
      repoChunks.add( makeHDivider( textWidth, 20.0, appState.screenWidth * .1 ));      
      repoChunks.add( Container( height: 20.0 ));

      return repoChunks;
   }
   
   // XXX Need to add visual cue if repos run out of room, can be hard to tell it's scrollable
   List<Widget> _makeCEProjs( gha ) {
      final textWidth = appState.screenWidth * .15;
      List<Widget> repoChunks = [];

      Widget _ceProjBar = Row(
         crossAxisAlignment: CrossAxisAlignment.center,
         mainAxisAlignment: MainAxisAlignment.spaceBetween,
         children: <Widget>[ makeTitleText( "Code Equity Projects", textWidth, false, 1 ),
                             Container( width: 10 ),
                             _newCEProjButton(),
                             Container( width: 10 ),
            ]);
         
      repoChunks.add( _ceProjBar );

      // Do we have any ceProjects?  Hmm.. no matter.
      // if( gha.ceProject.any(( bool p ) => p )) {}
      for( var i = 0; i < gha.repos.length; i++ ) {
         if( gha.ceProject[i] ) repoChunks.add( _makeRepoChunk( gha.repos[i] ));
      }
      repoChunks.add( Container( height: 20.0 ));
      repoChunks.add( makeHDivider( textWidth, 20.0, appState.screenWidth * .1 ));      
      repoChunks.add( Container( height: 20.0 ));

      return repoChunks;
   }
   
   // XXX 20, 29, 26.. 14pt font height
   // XXX at wrapPoint, change maxHeight in BoxConstraint to size of acctList plus buffer.
   Widget _showGHAccts( rhsPaneWidth ) {
      List<Widget> acctList = [];

      // Whitespace
      acctList.add( Container( height: 20.0 ) );

      if( appState.myGHAccounts != null || appState.ghUpdated ) {


         for( final gha in appState.myGHAccounts ) {
            acctList.addAll( _makeCEProjs( gha ));
            acctList.addAll( _makeRepos( gha ));
         }
         
         appState.ghUpdated = false;
         final lhsMaxWidth  = max( appState.screenWidth * .3, lhsPaneMinWidth );

         var lhsHeight = appState.screenHeight * .946; // room for top bar
         if( appState.screenWidth < lhsMaxWidth + 5 + rhsPaneWidth ) {
            // wrapped.  Reduce height to make room for rhsPane
            lhsHeight = min( lhsHeight, acctList.length * 29.0 );
         }
                           
         return ConstrainedBox(
            constraints: new BoxConstraints(
               minHeight: 20.0,
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
   

   Widget _makeGHZone( rhsPaneWidth ) {
      final explainWidth = appState.screenWidth * .5;
      String ghExplain = "CodeEquity will authenticate your account with Github one time only.";
      ghExplain       += "  You can undo this association at any time.  Click here to generate PAT.";
      
      if( addGHAcct ) {
         return Center(
            child: Row(
               crossAxisAlignment: CrossAxisAlignment.center,
               mainAxisAlignment: MainAxisAlignment.center,
               children: <Widget>[
                  makeTitleText( ghExplain, explainWidth, true, 3 ),
                  Expanded( 
                     child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: <Widget>[
                           ghPersonalAccessToken,
                           _ghAssociateButton()
                           ])
                     )
                  ])
            );
      }
      else {
         return _showGHAccts( rhsPaneWidth );
      }
      
   }

   // XXX 300.  274, 26.
   Widget _makeBody() {
      if( appState.loaded ) {
         return
            Wrap(
               children: <Widget>[
                  Container(
                     color: Colors.white,
                     child: _makeGHZone(300)
                     ),
                  const VerticalDivider(
                     color: Colors.grey,
                     thickness: 1,
                     indent: 0,
                     endIndent: 0,
                     width: 5,
                     ),
                  
                  Container(
                     color: Colors.grey[50],
                     child: 
                     makeTitleText( "Recent Activity", 274, true, 1 )
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
      
      pat = TextEditingController();
      
      ghPersonalAccessToken = makeInputField( context, "Github Personal Access Token", false, pat );
      
      // ListView horizontal messes with singleChildScroll (to prevent overflow on orientation change). only on this page.
      SystemChrome.setPreferredOrientations([ DeviceOrientation.portraitUp, DeviceOrientation.portraitDown ]);
      appState.screenHeight = MediaQuery.of(context).size.height;
      appState.screenWidth  = MediaQuery.of(context).size.width;
      
      // print( "Build Homepage, scaffold x,y: " + appState.screenWidth.toString() + " " + appState.screenHeight.toString() );
      // print( getToday() );
      
      return Scaffold(
         appBar: makeTopAppBar( context, "Home" ),
         body: _makeBody()
         );
   }
}
