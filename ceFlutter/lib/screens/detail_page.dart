import 'dart:convert';  // json encode/decode
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';
import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/PEQAction.dart';

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

   Map<String, List<PEQAction>> peqPAct;
   
   @override
   void initState() {
      print( "DetailPage INIT" );
      peqPAct = new Map<String, List<PEQAction>>();      
      super.initState();
   }

   @override
   void dispose() {
      super.dispose();
   }

   Widget _makePeq( peq ) {
      final textWidth = appState.screenWidth * .6;
      String apeq =  peq.ghIssueTitle + " " + enumToStr( peq.peqType ) + " " + peq.amount.toString();
      return makeTitleText( apeq, textWidth, false, 1 );
   }

   Widget _makePAct( pact ) {
      final textWidth = appState.screenWidth * .6;
      String apact = enumToStr( pact.verb ) + " " + enumToStr( pact.action ) + " " + pact.entryDate;
      return makeBodyText( apact, textWidth, false, 1 );
   }

   // XXX pactDetail GD can set bit, nav push, there here check bit & update in builder, setstate.
   Widget _showPActList() {
      List<Widget> pactList = [];
      
      // XXX too much recalc here
      if( appState.userPActUpdated && appState.userPActs != null && appState.userPActs[ appState.selectedUser ] != null ) {
         print( "looking for pacts " + appState.selectedUser );


         // XXX save anything here?  
         for( final peq in  appState.userPeqs[ appState.selectedUser ] ) {
            pactList.add( _makePeq( peq ) );

            for( final pact in peqPAct[peq.id] ) {
               pactList.add( _makePAct( pact ) );
            }

            pactList.add( makeHDivider( appState.screenWidth * .8, 0.0, appState.screenWidth * .1 ));            
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

   void rebuildPActions( container, context ) async {
      print( "rebuiding userPactions for selected user. " );
      await updateUserPActions( container, context );

      // get unique PEQ ids, sort reverse config order.  Add pact.   sort most recent first within each bucket.
      Set<String> peqs = new Set<String> ();
      for( var pact in appState.userPActs[ appState.selectedUser ] ) {
         assert( pact.subject.length > 0 );
         String peqId = pact.subject[0]; 
         peqs.add( peqId );

         // populate peqPAct to avoid multiple trips through pacts
         if( peqPAct[peqId] == null ) { peqPAct[peqId] = [ pact ]; }
         else                         { peqPAct[peqId].add( pact ); }
         
      }
      await updateUserPeqs( peqs, container, context );
      
      setState(() => appState.userPActUpdated = true );
   }
   
   @override
      Widget build(BuildContext context) {
      
      container   = AppStateContainer.of(context);
      appState    = container.state;

      print( "\nBuild Detail page " + appState.userPActUpdated.toString() );

      // XXX skip rebuild unless list has changed ... this list is not updating
      if( appState.userPActs == null || appState.userPActs[ appState.selectedUser ] == null ) {
         rebuildPActions( container, context );
      }
      
      return Scaffold(
         appBar: makeTopAppBar( context, "Detail" ),
         //bottomNavigationBar: makeBotAppBar( context, "Detail" ),
         body: _makeBody()
         );
   }
}
