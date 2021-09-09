import 'dart:convert';                   // json encode/decode
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


   
   // This GD opens and closes peqSummary.
   Widget _makeRepoChunk( String repoName ) {
      final textWidth = appState.screenWidth * .4;
      return GestureDetector(
         onTap: ()
         {
            appState.selectedRepo = repoName;
            notYetImplemented(context);            
         },
         child: makeTitleText( repoName, textWidth, false, 1 )
         );
   }
   
   // XXX Need to add visual cue if repos run out of room, can be hard to tell it's scrollable
   List<Widget> _makeRepos( gha ) {
      final textWidth = appState.screenWidth * .2;
      List<Widget> repoChunks = [];
      repoChunks.add( makeTitleText( gha.ghUserName, textWidth, false, 1 ) );
      gha.repos.forEach((repo) {
            repoChunks.add( _makeRepoChunk( repo ));
         });
      return repoChunks;
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
   
   Widget _addGHAcct() {
      return makeActionButtonSmall(
         appState,
         "Add Github account",
         () async
         {
            setState(() {addGHAcct = true; });
         });
   }

   // XXX 20, 250
   Widget _showGHAccts() {
      List<Widget> acctList = [];
      
      if( appState.myGHAccounts != null || appState.ghUpdated ) {
         for( final gha in appState.myGHAccounts ) {
            acctList.addAll( _makeRepos( gha ));
            acctList.add( makeHDivider( appState.screenWidth * .3, 0.0, appState.screenWidth * .1 ));
         }
         
         appState.ghUpdated = false;
         final mWidth = 250.0 > appState.screenWidth * .3 ? 250.0 : appState.screenWidth * .3;
         
         return ConstrainedBox(
            constraints: new BoxConstraints(
               minHeight: 20.0,
               minWidth: 250.0,
               maxHeight: appState.screenHeight * .946,  // make room for topbar
               maxWidth:  mWidth
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
   

   Widget _makeGHZone( ) {
      final textWidth = appState.screenWidth * .5;
      String ghExplain = "CodeEquity will authenticate your account with Github one time only.";
      ghExplain       += "  You can undo this association at any time.  Click here to generate PAT.";
      
      if( addGHAcct ) {
         return Center(
            child: Row(
               crossAxisAlignment: CrossAxisAlignment.center,
               mainAxisAlignment: MainAxisAlignment.center,
               children: <Widget>[
                  makeTitleText( ghExplain, textWidth, true, 3 ),
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
         return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,    // required for listView child
            children: <Widget>[ _showGHAccts() ]);
      }
      
   }


   
   // XXX need listview.  try wrap.
   Widget _makeBody() {
      if( appState.loaded ) {
         
         return
            Row(
               crossAxisAlignment: CrossAxisAlignment.start,
               mainAxisAlignment: MainAxisAlignment.start,
               children: <Widget>[
                  Container(
                     color: Colors.white,
                     child: 
                     Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,    // required for listView child
                        children: <Widget>[
                           _makeGHZone()
                           ]),
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
                     makeTitleText( "Recent Activity", 200, true, 1 )
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
      
      print( "Build Homepage, scaffold x,y: " + appState.screenWidth.toString() + " " + appState.screenHeight.toString() );
      print( getToday() );
      
      return Scaffold(
         appBar: makeTopAppBar( context, "Home" ),
         body: _makeBody()
         );
   }
}
