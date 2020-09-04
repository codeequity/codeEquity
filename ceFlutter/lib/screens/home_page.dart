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
   
   @override
   void initState() {
      print( "HOMEPAGE INIT" );
      super.initState();
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

      // ListView horizontal messes with singleChildScroll (to prevent overflow on orientation change). only on this page.
      SystemChrome.setPreferredOrientations([ DeviceOrientation.portraitUp, DeviceOrientation.portraitDown ]);



      Widget _makeStuffList( stuff ) {
         final textWidth = appState.screenWidth * .2;
         
         return Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: <Widget>[
               makeTitleText( stuff.title, textWidth, false, 1 ),
               makeTitleText( stuff.amount, textWidth, false, 1 ),
               makeTitleText( stuff.userId, textWidth, false, 1 ),
               ]);
      }
      
      Widget _listView( ) {
         List<Widget> peqList = [];

         if( appState.myPEQs != null || appState.peqUpdated ) {
            for( final stuff in appState.myPEQs ) {
               peqList.add( _makeStuffList( stuff ));
               peqList.add( _makeHDivider( appState.screenWidth * .8, 0.0, appState.screenWidth * .1 ));
            }

            appState.peqUpdated = false;
            
            return ConstrainedBox( 
               constraints: new BoxConstraints(
                  minHeight: 20.0,
                  maxHeight: appState.screenHeight * .85
                  ),
               child: ListView(
                  scrollDirection: Axis.vertical,
                  children: peqList
                  ));
         }
         else {
            return CircularProgressIndicator();
         }
      }
      

      final getStuffButton = makeActionButton( appState, "Get Stuff", (() async {
               print( "Git some!" );
               await initMyProjects( context, container );
               setState(() {
                     appState.peqUpdated = true;
                  });
               
            }));


      Widget _makeBody() {
         if( appState.loaded ) {
            
            return Center(
               child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,    // required for listView child
                  children: <Widget>[
                     SizedBox( height: 5.0),
                     getStuffButton,
                     SizedBox( height: 5.0),
                     _listView()
                     ]));
         } else {
            print( "AppState not ? Loaded" );
            return CircularProgressIndicator();
         }
      }

      print( "Build Homepage, scaffold x,y: " + appState.screenWidth.toString() + " " + appState.screenHeight.toString() );
      
      return Scaffold(
         appBar: makeTopAppBar( context, "Home" ),
         bottomNavigationBar: makeBotAppBar( context, "Home" ),
         body: _makeBody()
         );
   }
}
