import 'dart:convert';  // json encode/decode
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';
import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/models/app_state.dart';



class CEHomePage extends StatefulWidget {
   CEHomePage({Key key}) : super(key: key);

  @override
  _CEHomeState createState() => _CEHomeState();
}

class _CEHomeState extends State<CEHomePage> {

   var container;
   AppState appState;
   bool addGHAcct;
   
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

  
   // No border padding
   Widget _makeHDivider( width, lgap, rgap) {
      return Padding(
         padding: EdgeInsets.fromLTRB(lgap, 0, rgap, 0),
         child: Container( width: width, height: 2, color: Colors.grey[200] ));
   }
      

   @override
   Widget build(BuildContext context) {

      container   = AppStateContainer.of(context);
      appState    = container.state;

      TextEditingController pat = TextEditingController();

      final ghPersonalAccessToken = makeInputField( context, "Github Personal Access Token", false, pat );

      // ListView horizontal messes with singleChildScroll (to prevent overflow on orientation change). only on this page.
      SystemChrome.setPreferredOrientations([ DeviceOrientation.portraitUp, DeviceOrientation.portraitDown ]);



      _showPeq( String repoName ) {
         showToast( "Activate wondertwin powers!" );
      }

      Widget _makeRepoName( String repoName ) {
         final textWidth = appState.screenWidth * .4;         
         return Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: <Widget>[
               makeTitleText( repoName, textWidth, false, 1 ),
               ]);
      }
      
      Widget _makeRepoChunk( String repoName ) {
         return GestureDetector(
            onTap: () => _showPeq( repoName ),
            child: _makeRepoName( repoName )
            );
      }
      

      // XXX Need to add visual cue if repos run out of room, can be hard to tell it's scrollable
      // Having a second listview allows limits on num repos per acct.
      Widget _makeRepos( gha ) {
         final textWidth = appState.screenWidth * .2;
         List<Widget> repoChunks = [];
         gha.repos.forEach((repo) => repoChunks.add( _makeRepoChunk( repo ) ) );
         
         return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.start,
            children: <Widget>[
               makeTitleText( gha.ghUserName, textWidth, false, 1 ),
               ConstrainedBox( 
                  constraints: new BoxConstraints(
                     minWidth: 20.0,
                     minHeight: 20.0,
                     maxHeight: appState.screenHeight * .3,
                     maxWidth:  appState.screenWidth * .8
                     ),
                  child: ListView(
                     scrollDirection: Axis.vertical,
                     children: repoChunks
                     ))               
               ]);
      }
      
      Widget _showGHAccts( ) {
         List<Widget> acctList = [];

         if( appState.myGHAccounts != null || appState.ghUpdated ) {
            for( final gha in appState.myGHAccounts ) {
               acctList.add( _makeRepos( gha ));
               acctList.add( _makeHDivider( appState.screenWidth * .8, 0.0, appState.screenWidth * .1 ));
            }

            appState.ghUpdated = false;
            
            return ConstrainedBox( 
               constraints: new BoxConstraints(
                  minHeight: 20.0,
                  minWidth: 20.0,
                  maxHeight: appState.screenHeight * .85,
                  maxWidth:  appState.screenWidth * .8
                  ),
               child: ListView(
                  scrollDirection: Axis.vertical,
                  children: acctList
                  ));
         }
         else { // XXX just a container
            return CircularProgressIndicator();
         }
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

     Widget _makeGHZone() {
        final textWidth = appState.screenWidth * .6;
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
           return Center(
              child: Column(
                 crossAxisAlignment: CrossAxisAlignment.start,
                 mainAxisAlignment: MainAxisAlignment.start,
                 mainAxisSize: MainAxisSize.min,    // required for listView child
                 children: <Widget>[
                    _showGHAccts(),
                    Row(
                       crossAxisAlignment: CrossAxisAlignment.start,
                       mainAxisAlignment: MainAxisAlignment.start,
                       mainAxisSize: MainAxisSize.min, 
                       children: <Widget>[
                          makeTitleText( "Add your githubness here", textWidth, false, 1 ),
                          _addGHAcct()
                          ])
                    ])
              );
        }

     }
     

     Widget _makeBody() {
        if( appState.loaded ) {
           
           return Center(
              child: Column(
                 crossAxisAlignment: CrossAxisAlignment.start,
                 mainAxisAlignment: MainAxisAlignment.start,
                 mainAxisSize: MainAxisSize.min,    // required for listView child
                 children: <Widget>[
                    SizedBox( height: 5.0),
                    _makeGHZone()
                    ]));
        } else {
           print( "AppState not ? Loaded" );
           return CircularProgressIndicator();
        }
     }
     
     print( "Build Homepage, scaffold x,y: " + appState.screenWidth.toString() + " " + appState.screenHeight.toString() );
     
     return Scaffold(
        appBar: makeTopAppBar( context, "Home" ),
        //bottomNavigationBar: makeBotAppBar( context, "Home" ),
        body: _makeBody()
        );
   }
}
