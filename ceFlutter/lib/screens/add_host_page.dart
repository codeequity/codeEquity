import 'package:flutter/material.dart';
import 'dart:math';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ghUtils.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/screens/home_page.dart';

class CEAddHostPage extends StatefulWidget {
   CEAddHostPage({Key? key}) : super(key: key);

  @override
  _CEAddHostState createState() => _CEAddHostState();
}

class _CEAddHostState extends State<CEAddHostPage> {

   late var      container;
   late AppState appState;
   late bool     addHostAcct;

   late TextEditingController pat;

   static const maxPaneWidth = 700.0;
   
   @override
   void initState() {
      super.initState();

      addHostAcct = false;
   }

   @override
   void dispose() {
      super.dispose();
   }

   // XXX Deactivate this until PAT is in controller.
   // material button has no maxwidth, adopts parent box. Not co-operative with Container, BoxConstraints.
   // XXX update materialbutton, remove w.
   Widget _ghAssociateButton() {
      final bwidth = 180;
      final w = min( appState.screenWidth - bwidth, maxPaneWidth - bwidth );
      return Row(
         crossAxisAlignment: CrossAxisAlignment.center,
         mainAxisAlignment: MainAxisAlignment.center,
         children: <Widget>[ 
            makeActionButtonFixed(
               appState,
               "Enable Github access",
               bwidth,
               () async
               {
                  bool associated = await associateGithub( context, container, pat.text );
                  MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEHomePage());
                  Navigator.push( context, newPage );
                  
               }),
            Container( width: w ),
            ]);
   }

   Widget _makePersonalAccessToken() {
      return Container( width: maxPaneWidth,
                        child: makeInputField( appState, "Github Personal Access Token", false, pat )
         );
   }
      

   // NOTE:
   // Down the road should split *GH* out, and connect alternate code host repositories
   Widget _makeAssociateGH() {

      // XXX This is not clearly true.  Need PAT each time refresh Host repos, since have to use listRepositories.
      // XXX <Profile> should be clickable, take you to profile.
      String ghExplain   = "CodeEquity will authenticate your account with Github one time only.  ";
      ghExplain         += "You can undo this association at any time under <Profile>.  ";
      ghExplain         += "Your Personal Access Token allows CodeEquity to make a secure connection to GitHub.";

      // XXX <here> should be clickable, take you to Host page.
      String patExplain  = "To create a Personal Access Token in GitHub, for CodeEquity, follow the instructions <here>.";
         
      return Center(
         child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.start,
            children: <Widget>[
               Container( height: 2*appState.GAP_PAD ),
               makeTitleText( appState, "Link CodeEquity to GitHub", maxPaneWidth, true, 1, fontSize: 24 ),               
               makeBodyText( appState, ghExplain, maxPaneWidth, true, 4 ),

               Container( height: appState.FAT_PAD ),
               makeHDivider( maxPaneWidth, appState.GAP_PAD, appState.GAP_PAD ),
               Container( height: appState.GAP_PAD ),

               Container( height: appState.GAP_PAD ),
               _makePersonalAccessToken(),
               makeBodyText( appState, patExplain, maxPaneWidth, true, 2 ),

               Container( height: appState.MID_PAD ),
               makeHDivider( maxPaneWidth, appState.GAP_PAD, appState.GAP_PAD ),
               Container( height: appState.MID_PAD ),
               
               _ghAssociateButton(),
               ])
         );
   }
   
   Widget _makeBody() {
      if( appState.loaded ) {
         return _makeAssociateGH();
      }
      else {
         if( appState.verbose >= 1 ) { print( "AppState not ? Loaded" ); }
         return CircularProgressIndicator();
      }
   }
   
   @override
      Widget build(BuildContext context) {

      container   = AppStateContainer.of(context);
      appState    = container.state;
      assert( appState != null );
      
      pat = TextEditingController();
      
      appState.screenHeight = MediaQuery.of(context).size.height;
      appState.screenWidth  = MediaQuery.of(context).size.width;
      
      return Scaffold(
         appBar: makeTopAppBar( context, "Home" ),
         body: _makeBody()
         );
   }
}
