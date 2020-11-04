import 'dart:convert';  // json encode/decode
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';
import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/components/node.dart';
import 'package:ceFlutter/components/leaf.dart';



class CEDetailPage extends StatefulWidget {
   CEDetailPage({Key key}) : super(key: key);

  @override
  _CEDetailState createState() => _CEDetailState();
}

class _CEDetailState extends State<CEDetailPage> {

   var      container;
   AppState appState;
   
   @override
   void initState() {
      print( "DetailPage INIT" );
      super.initState();
   }

   @override
   void dispose() {
      super.dispose();
   }

   Widget _makePAct( pact ) {
      final textWidth = appState.screenWidth * .6;
      String apact = pact.id + " " + enumToStr( pact.verb ) + " " + enumToStr( pact.action ) + " " + pact.subject.toString() + " " + pact.entryDate;
      return makeTitleText( apact, textWidth, false, 1 );
   }

   Widget _showPActList() {
      List<Widget> pactList = [];
      
      // XXX too much recalc here
      if( appState.userPActUpdated && appState.userPActs != null && appState.userPActs[ appState.selectedUser ] != null ) {
         print( "looking for pacts " + appState.selectedUser );
         for( final pact in appState.userPActs[ appState.selectedUser ] ) {
            pactList.add( _makePAct( pact ) );
         }
         
         appState.userPActUpdated = false;
         
         return ConstrainedBox( 
            constraints: new BoxConstraints(
               minHeight: 20.0,
               minWidth: 20.0,
               maxHeight: appState.screenHeight * .85,
               maxWidth:  appState.screenWidth * .8
               ),
            child: ListView(
               scrollDirection: Axis.vertical,
               children: pactList
               ));
      }
      else { 
         return CircularProgressIndicator();
      }
      
   }
   
   Widget _makeBody() {

      final textWidth = appState.screenWidth * .4;
      
      return Center(
         child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,    // required for listView child
            children: <Widget>[
               SizedBox( height: 5.0),
               _showPActList()
               ]));
   }
   
   
   @override
      Widget build(BuildContext context) {
      
      container   = AppStateContainer.of(context);
      appState    = container.state;

      print( "\nBuild Detail page " + appState.userPActUpdated.toString() );
      
     return Scaffold(
        appBar: makeTopAppBar( context, "Detail" ),
        //bottomNavigationBar: makeBotAppBar( context, "Detail" ),
        body: _makeBody()
        );
   }
}
