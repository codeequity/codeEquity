import 'dart:convert';     // json encode/decode

import 'package:collection/collection.dart'; // list eq
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';
import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/PEQAction.dart';
import 'package:ceFlutter/models/PEQRaw.dart';

import 'package:ceFlutter/components/node.dart';
import 'package:ceFlutter/components/leaf.dart';

Function eq = const ListEquality().equals;

class CEDetailPage extends StatefulWidget {
   CEDetailPage({Key key}) : super(key: key);

  @override
  _CEDetailState createState() => _CEDetailState();
}

class _CEDetailState extends State<CEDetailPage> {

   List<String> category;  // pass by navigator in projectpage callback
   var      container;
   AppState appState;

   bool                         userPActUpdated;
   Map<String, List<PEQAction>> peqPAct;
   List<PEQ>                    selectedPeqs;
   List<Widget>                 pactList;
   
   @override
   void initState() {
      peqPAct = new Map<String, List<PEQAction>>();
      selectedPeqs = new List<PEQ>();
      userPActUpdated = false;
      pactList = new List<Widget>();
      
      super.initState();
   }

   @override
   void dispose() {
      super.dispose();
   }


   void _closeRaw() {
      if( appState.verbose >= 2 ) { print( "closeRaw" ); }
      Navigator.of( context ).pop(); 
   }
   
   Widget _makePeq( peq ) {
      final textWidth = appState.screenWidth * .6;
      String proj = "";
      for( var p in peq.ghProjectSub ) {
         if( p == "Software Contributions" ) { p = "Software"; }  // XXX TEMP
         proj += p + "::";
      }
      if( proj.length > 2 ) { proj = proj.substring( 0,proj.length - 2 ); }
      
      String apeq =  peq.ghIssueTitle + " (" + proj + ") status: " + enumToStr( peq.peqType ) + " " + peq.amount.toString() + " PEQs";
      if( peq.ghHolderId.length > 0 ) { apeq += "  Holder(s): " + peq.ghHolderId.toString(); }
      if( peq.ceGrantorId != EMPTY ) { apeq += "  Grantor: " + peq.ceGrantorId; }
      return makeTitleText( appState, apeq, textWidth, false, 1 );
   }

   // XXX rawbody -> prettier list of string
   Widget _makePAct( pact ) {
      final textWidth = appState.screenWidth * .6;
      String apact = enumToStr( pact.verb ) + " " + enumToStr( pact.action ) + " " + pact.subject.toString() + " " + pact.note + " " + pact.entryDate;
      // return makeBodyText( appState, apact, textWidth, false, 1 );
      if( appState.verbose >= 2 ) { print( ".. GD for " + pact.id ); }
      return GestureDetector(
         onTap: () async
         {
            var postData = {};
            postData['PEQRawId'] = pact.id;
            var pd = { "Endpoint": "GetEntry", "tableName": "CEPEQRaw", "query": postData }; 
            PEQRaw pr = await fetchPEQRaw( context, container, json.encode( pd ));
            var encoder = new JsonEncoder.withIndent("  ");
            var prj = json.decode( pr.rawReqBody );
            String prettyRaw = encoder.convert(prj);

            // Let makeBody handle the json
            Widget prw = makeBodyText( appState, prettyRaw, textWidth, true, 1000);
            popScroll( context, "Raw Github Action:", prw, () => _closeRaw() );            
         },
         child: makeBodyText( appState, apact, textWidth, false, 1 )
         );

      
   }

   // XXX peqPAct is new for each detailPage, i.e. for each selection.
   //     information overlaps with selectedPeqs.. resolve
   // XXX don't circle if empty.  buuuut, for now, OK.
   Widget _showPActList() {

      if( userPActUpdated && appState.userPActs != null && appState.userPActs[ appState.selectedUser ] != null ) {
         print( "looking for pacts " + appState.selectedUser );

         pactList.clear();
         // XXX save anything here?  
         for( final peq in selectedPeqs ) {
            pactList.add( _makePeq( peq ) );

            peqPAct[peq.id].sort((a,b) => a.timeStamp.compareTo( b.timeStamp ));
               
            for( final pact in peqPAct[peq.id] ) {
               print( "PL added " + pact.id );
               pactList.add( _makePAct( pact ) );
            }
            
            pactList.add( makeHDivider( appState.screenWidth * .8, 0.0, appState.screenWidth * .1 ));            
         }

         userPActUpdated = false;
      }

      if( pactList.length > 0 ) {
         
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

   // Find peqs held by user, then all pacts for those peqs.
   // Active only, for now.
   void rebuildPActions( container, context ) async {

      print( "Rebuild PActions" );

      // Get all peqs for user.  Then, pare the list down to match selection
      await updateUserPeqs( container, context );

      // If ingest is not up to date, this filter breaks
      List<String> cat  = category.sublist(0, category.length - 1 );
      selectedPeqs      = appState.userPeqs[ appState.selectedUser ].where( (p) => eq( p.ghProjectSub, cat )).toList();
      List<String> peqs = selectedPeqs.map((peq) => peq.id ).toList();
      
      await updateUserPActions( peqs, container, context );      

      // populate peqPAct to avoid multiple trips through pacts
      for( var pact in appState.userPActs[ appState.selectedUser ] ) {
         assert( pact.subject.length > 0 );
         String peqId = pact.subject[0]; 
         if( peqPAct[peqId] == null ) { peqPAct[peqId] = [ pact ]; }
         else                         { peqPAct[peqId].add( pact ); }
      }
      
      appState.userPActUpdate = false;
      setState(() => userPActUpdated = true );
   }
   
   @override
      Widget build(BuildContext context) {

      category    = ModalRoute.of(context).settings.arguments;
      container   = AppStateContainer.of(context);
      appState    = container.state;

      if( appState.verbose >= 3 ) { print( "BUILD DETAIL" ); }
      if( appState.verbose >= 3 ) { print( "is context null ? " + (context == null).toString() ); }
      if( appState.verbose >= 3 ) { print( "\nBuild Detail page " + appState.userPActUpdate.toString() ); }

      if( appState.userPActUpdate ) { rebuildPActions( container, context );  }
      
      return Scaffold(
         appBar: makeTopAppBar( context, "Detail" ),
         //bottomNavigationBar: makeBotAppBar( context, "Detail" ),
         body: _makeBody()
         );
   }
}
