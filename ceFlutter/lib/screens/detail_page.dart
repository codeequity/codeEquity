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
   CEDetailPage({Key? key}) : super(key: key);

  @override
  _CEDetailState createState() => _CEDetailState();
}

class _CEDetailState extends State<CEDetailPage> {

   late List<String> category;  // pass by navigator in projectpage callback
   late var          container;
   late AppState     appState;

   late bool                         userPActUpdated;
   late Map<String, List<PEQAction>> peqPAct;
   late List<PEQ>                    selectedPeqs;
   late List<Widget>                 pactList;
   
   @override
   void initState() {
      peqPAct = new Map<String, List<PEQAction>>();
      userPActUpdated = false;
      // selectedPeqs = new List<PEQ>();
      // pactList = new List<Widget>();
      selectedPeqs = [];
      pactList     = [];
      
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
      return makeTitleText( appState, apeq, textWidth, false, 1, keyTxt: peq.ghIssueTitle );
   }

   // XXX rawbody -> prettier list of string
   Widget _makePAct( pact, peqCount, pactCount ) {
      final textWidth = appState.screenWidth * .6;
      String apact = enumToStr( pact.verb ) + " " + enumToStr( pact.action ) + " " + pact.subject.toString() + " " + pact.note + " " + pact.entryDate;
      // return makeBodyText( appState, apact, textWidth, false, 1 );
      if( appState.verbose >= 2 ) { print( ".. GD for " + pact.id ); }
      String keyName = peqCount.toString() + pactCount.toString() + " " + enumToStr( pact.verb ) + " " + enumToStr( pact.action );
      return GestureDetector(
         onTap: () async
         {
            var postData = {};
            postData['PEQRawId'] = pact.id;
            var pd = { "Endpoint": "GetEntry", "tableName": "CEPEQRaw", "query": postData }; 
            PEQRaw? pr = await fetchPEQRaw( context, container, json.encode( pd ));
            assert( pr != null );
            var encoder = new JsonEncoder.withIndent("  ");
            var prj = json.decode( pr!.rawReqBody );
            String prettyRaw = encoder.convert(prj);

            // Let makeBody handle the json
            Widget prw = makeBodyText( appState, prettyRaw, textWidth, true, 1000, keyTxt: "RawPact"+keyName);
            popScroll( context, "Raw Github Action:", prw, () => _closeRaw() );            
         },
         child: makeBodyText( appState, apact, textWidth, false, 1, keyTxt: keyName )
         );

      
   }

   // XXX peqPAct is new for each detailPage, i.e. for each selection.
   //     information overlaps with selectedPeqs.. resolve
   // XXX don't circle if empty.  buuuut, for now, OK.
   Widget _showPActList() {

      if( userPActUpdated && appState.userPActs != null && appState.userPActs[ appState.selectedUser ] != null ) {
         print( "looking for pacts " + appState.selectedUser );

         pactList.clear();
         var peqCount = 0;
         // XXX save anything here?  
         for( final peq in selectedPeqs ) {
            pactList.add( _makePeq( peq ) );

            var pactCount = 0;
            for( final pact in peqPAct[peq.id] ?? [] ) {
               print( "PL added " + pact.id );
               pactList.add( _makePAct( pact, peqCount, pactCount ) );
               pactCount++;
            }
            peqCount++;
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
      // NOTE: allocations, unclaimed are not accessed by user.  appState.selectedUser is bogus in these cases.  XXX
      await updateUserPeqs( container, context );

      // XXX update for unassign
      // If ingest is not up to date, this filter breaks
      // if alloc, alloc name is made part of the category list, and is needed to distinguish allocs
      if( appState.selectedUser == appState.ALLOC_USER ) {
         selectedPeqs = (appState.userPeqs[ appState.selectedUser ] ?? []).where( (p) => eq( p.ghProjectSub + [p.ghIssueTitle], category )).toList();
      }
      else {
         List<String> cat = category.sublist(0, category.length - 1 );
         selectedPeqs = (appState.userPeqs[ appState.selectedUser ] ?? []).where( (p) => eq( p.ghProjectSub, cat )).toList();
      }
      List<String> peqs = selectedPeqs.map((peq) => peq.id ).toList();
      
      await updateUserPActions( peqs, container, context );      

      // populate peqPAct to avoid multiple trips through pacts
      for( var pact in appState.userPActs[ appState.selectedUser ] ?? [] ) {
         assert( pact.subject.length > 0 );
         String peqId = pact.subject[0]; 
         if( peqPAct[peqId] == null ) { peqPAct[peqId] = [ pact ]; }
         else                         { peqPAct[peqId]!.add( pact ); }
      }

      // Sort PAct list oldest first. Sort Peq list newest first.
      for( final peq in peqs ) {
         (peqPAct[peq] ?? []).sort((a,b) => a.timeStamp.compareTo( b.timeStamp ));
      }
      selectedPeqs.sort((a,b) => (peqPAct[b.id] ?? []).last.timeStamp.compareTo( (peqPAct[a.id] ?? []).last.timeStamp ));
      
      appState.userPActUpdate = false;
      setState(() => userPActUpdated = true );
   }
   
   @override
      Widget build(BuildContext context) {

      assert( ModalRoute.of(context) != null );
      category    = ModalRoute.of(context)!.settings.arguments as List<String>;
      container   = AppStateContainer.of(context);
      appState    = container.state;
      assert( appState != null );
      assert( category != null );
      
      print( "XXX Attempted to build category from routes: " + category.toString() );

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
