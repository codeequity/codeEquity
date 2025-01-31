import 'dart:convert';     // json encode/decode

import 'package:collection/collection.dart'; // list eq
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';
import 'package:ceFlutter/utils/awsUtils.dart';

import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/PEQAction.dart';
import 'package:ceFlutter/models/PEQRaw.dart';

import 'package:ceFlutter/components/node.dart';
import 'package:ceFlutter/components/leaf.dart';

Function eq = const ListEquality().equals;


// possibily used by search as well (later)
Future<void> _makePRawScroll( appState, context, container, pactId, textWidth, keyName ) async {
   var postData = {};
   postData['PEQRawId'] = pactId;
   var pd = { "Endpoint": "GetEntry", "tableName": "CEPEQRaw", "query": postData }; 
   PEQRaw? pr = await fetchPEQRaw( context, container, json.encode( pd ));
   assert( pr != null );
   var encoder = new JsonEncoder.withIndent("  ");
   var prj = json.decode( pr!.rawReqBody );
   String prettyRaw = encoder.convert(prj);
   
   // Let makeBody handle the json
   Widget prw = makeBodyText( appState, prettyRaw, textWidth, true, 1000, keyTxt: "RawPact"+keyName);
   popScroll( context, "Raw Host Action:", prw, () => Navigator.of( context ).pop() );
}


class CEDetailPage extends StatefulWidget {
   CEDetailPage({Key? key}) : super(key: key);

  @override
  _CEDetailState createState() => _CEDetailState();
}

class _CEDetailState extends State<CEDetailPage> {

   late Map<String,dynamic> screenArgs;   // pass by navigator in projectpage callback

   late List<String> category;  
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
      selectedPeqs = [];
      pactList     = [];
      
      super.initState();
   }

   @override
   void dispose() {
      super.dispose();
   }

   Widget _makePeq( peq ) {
      final textWidth = appState.screenWidth * .6;
      String proj = "";
      for( var p in peq.hostProjectSub ) {
         if( p == "Software Contributions" ) { p = "Software"; }  // XXX TEMP   allow two lines in this bolded title.
         proj += p + "::";
      }
      if( proj.length > 2 ) { proj = proj.substring( 0,proj.length - 2 ); }

      String apeq =  peq.hostIssueTitle + " (" + proj + ") status: " + enumToStr( peq.peqType ) + " " + peq.amount.toString() + " PEQs";
      if( peq.hostHolderId.length > 0 ) { apeq += "  Holder(s): " + peq.hostHolderId.toString(); }
      if( peq.ceGrantorId != appState.EMPTY ) { apeq += "  Grantor: " + peq.ceGrantorId; }
      return makeTitleText( appState, apeq, textWidth, false, 1, keyTxt: peq.hostIssueTitle );
   }

   // NOTE: No way to ask for uningested pact - will not be available in summary frame.  This is a good thing, or at least not a harmful thing.
   // XXX rawbody -> prettier list of string
   Widget _makePAct( pact, peqCount, pactCount ) {
      final textWidth = appState.screenWidth * .6;
      String apact = enumToStr( pact.verb ) + " " + enumToStr( pact.action ) + " " + pact.subject.toString() + " " + pact.note + " " + pact.entryDate;
      // return makeBodyText( appState, apact, textWidth, false, 1 );
      if( appState.verbose >= 4 ) { print( ".. GD for " + pact.id ); }

      // keyName can't be based on pactCount - pacts arrive in somewhat random order.  Can't check ordering constraint - never had it in the first place.
      // Buut it needs to be unique within the peq group.  So integration-time testing needs to allow for reordering.
      // String keyName = peqCount.toString() + pactCount.toString() + " " + enumToStr( pact.verb ) + " " + enumToStr( pact.action );
      String keyName = pactCount.toString() + " " + peqCount.toString() + " " + enumToStr( pact.verb ) + " " + enumToStr( pact.action );
      // String keyName = peqId + " " + enumToStr( pact.verb ) + " " + enumToStr( pact.action );
      return GestureDetector(
         onTap: () async
         {
            await _makePRawScroll( appState, context, container, pact.id, textWidth, keyName );
         },
         child: makeBodyText( appState, apact, textWidth, false, 1, keyTxt: keyName )
         );

      
   }

   Widget _showPActList() {
      bool toggled = false;
      
      final textWidth = appState.screenWidth * .4;
      String ceUID = ceUIDFromHost( appState, appState.selectedHostUID );      
      if( userPActUpdated && appState.userPActs != null && appState.userPActs[ ceUID ] != null ) {
         print( "looking for pacts " + ceUID + " (" +appState.selectedHostUID +")" );
         toggled = true;
         pactList.clear();
         var peqCount = 0;
         for( final peq in selectedPeqs ) {
            // print( "pact list peq: " + peq.hostIssueTitle + " " + peq.id);
            pactList.add( _makePeq( peq ) );

            var pactCount = 0;
            for( final pact in peqPAct[peq.id] ?? [] ) {
               // print( "PL added " + pact.id );
               pactList.add( _makePAct( pact, peqCount, pactCount ) );
               pactCount++;
            }
            peqCount++;
            pactList.add( makeHDivider( appState, appState.screenWidth * .8, 0.0, appState.screenWidth * .1 ));            
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
      else if( !toggled ) { 
         return CircularProgressIndicator();
      }
      else {
         print( "Error.  PAct is recorded in summary frame, but no raw pactions were found." );
         return makeTitleText( appState, "No PEQ Actions were found.", textWidth, false, 1 );
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
   // Need both Active and Inactive (for accrued, only)
   void rebuildPActions( container, context ) async {

      print( "Rebuild PActions" + category.toString() );

      // Note: idMapHost does not contain the UNASSIGN_USER.  selectedHostUID can be unassign, then the userPeqs will be all those with no assignees .. i.e.
      //       not yet ingested.
      String ceUID = ceUIDFromHost( appState, appState.selectedHostUID );

      // Get all peqs for user.  Then, pare the list down to match selection
      // NOTE: Detail page has selectedHostUID, selectedCEP by now.  Search may not, but seach will already have peqs.
      if( appState.userPeqs[ceUID] == null ) {
         await updateUserPeqs( container, context );
      }

      // If ingest is not up to date, this filter breaks
      // if alloc, alloc name is made part of the category list, and is needed to distinguish allocs
      if( ceUID == appState.UNASSIGN_USER ) { 
         selectedPeqs = (appState.userPeqs[ ceUID ] ?? []).where( (p) => eq( p.hostProjectSub + [appState.UNASSIGN], category )).toList();
      }
      else {
         List<String> cat = category.sublist(0, category.length - 1 );
         selectedPeqs = (appState.userPeqs[ ceUID ] ?? []).where( (p) => eq( p.hostProjectSub, cat )).toList();
      }

      List<String> peqs = selectedPeqs.map((peq) => peq.id ).toList();

      // Detail page called from project page or search.  Search will set id, project page will set selectedCEP
      String cepId = screenArgs["id"] == null ? appState.selectedCEProject : screenArgs["id"];
      await updateUserPActions( peqs, container, context, cepId );      

      // populate peqPAct to avoid multiple trips through pacts
      for( var pact in appState.userPActs[ ceUID ] ?? [] ) {
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

      print( "Detail page" + ModalRoute.of(context)!.settings.arguments.toString() );
      
      assert( ModalRoute.of(context) != null );
      screenArgs  = ModalRoute.of(context)!.settings.arguments as Map<String,dynamic>;
      category    = new List<String>.from( screenArgs["cat"] );
      container   = AppStateContainer.of(context);
      appState    = container.state;
      assert( appState != null );
      assert( category != null );
      
      // print( "Attempted to build category from routes: " + category.toString() );

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
