import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/screens/summary_frame.dart';


class CEProjectPage extends StatefulWidget {
   CEProjectPage({Key key}) : super(key: key);

  @override
  _CEProjectState createState() => _CEProjectState();
}

class _CEProjectState extends State<CEProjectPage> {

   var      container;
   AppState appState;

   // XXX appState
   // iphone 5
   static const frameMinWidth  = 320.0;
   static const frameMinHeight = 568.0;
   
   @override
   void initState() {
      super.initState();
   }

   @override
   void dispose() {
      super.dispose();
   }


   // start CALLBACKS for tab frames
   // define here .. child widget state (like summaryFrame) is disposed of when clicking between frames

   Future<void> _updateCallback( ) async {
      appState.peqUpdated = false;
      await updatePEQAllocations( appState.selectedRepo, context, container );

      // causes buildAllocTree to fire
      setState(() => appState.updateAllocTree = true );
   }      

   _updateCompleteCallback() {
      // causes summary_frame to update list of allocs in showPalloc
      print( "UCC setstate" );
      setState(() => appState.peqUpdated = true );  
   }

   // XXX combine expansionChanged and expanded[path]?
   _allocExpansionCallback( expansionVal, path ) {
      print( ".. summary SetState expansionChanged" );
      // Causes summary nodes to setvis or unsetvis on children
      setState(() => appState.expansionChanged = expansionVal );

      print( ".. summary change allocExpanded $path $expansionVal" );
      // causes node to update internal tile expansion state, which updates trailing icons
      setState(() => appState.allocExpanded[path] = expansionVal );
   }

   // end CALLBACKS for tab frames


   Widget _makeTab( fn ) {
      return Container(
         color: Colors.white,
         child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.start,
            children: <Widget>[
               makeHDivider( appState.screenWidth, 0, 0 ),
               fn()
               ])
         );
   }

   // https://stackoverflow.com/questions/60362159/defaulttabcontroller-without-scaffold
   Widget _makeBody( context ) {
      final w = 100;
      if( appState.loaded ) {

         // XXX container still useful?
         // XXX move standard pixel sizes to appstate, out of utils and elsewhere.  
         Widget summaryFrameWidget = CESummaryFrame(
            appContainer: container,
            frameHeightUsed: 24+18+7*appState.MID_PAD + 2*appState.TINY_PAD,
            updateCallback:         _updateCallback,
            updateCompleteCallback: _updateCompleteCallback,
            allocExpansionCallback: _allocExpansionCallback );
            
         return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.start,
            children: <Widget>[
               
               makeTitleText( appState, appState.selectedRepo, w*6, false, 1, fontSize: 18),
               Container( height: appState.MID_PAD ),
               
               Expanded(
                  child: DefaultTabController(
                     initialIndex: 1,
                     length: 5,
                     child: Padding(
                        padding: EdgeInsets.fromLTRB(appState.GAP_PAD, appState.MID_PAD, appState.TINY_PAD, 0),
                        child: Container(
                           padding: EdgeInsets.all( appState.TINY_PAD ),
                           decoration: BoxDecoration(
                              color: appState.BACKGROUND,
                              borderRadius: BorderRadius.all(
                                 Radius.circular(5),
                                 )),
                           child: Column( 
                              children: <Widget> [
                                 Align(
                                    alignment: Alignment.centerLeft,
                                    child: TabBar(
                                       tabs: <Widget>[
                                          Tab( child: makeTitleText( appState, "Approvals", w, false, 1 )),
                                          Tab( child: makeTitleText( appState, "PEQ Summary", w, false, 1 )),
                                          Tab( child: makeTitleText( appState, "Contributors", w, false, 1 )),
                                          Tab( child: makeTitleText( appState, "Equity Plan", w, false, 1 )),
                                          Tab( child: makeTitleText( appState, "Agreements", w, false, 1 )),
                                          ],
                                       
                                       unselectedLabelColor: Colors.black54,
                                       labelColor: Colors.black,
                                       isScrollable: true,
                                       indicatorSize: TabBarIndicatorSize.tab,
                                       indicator: BoxDecoration(
                                          shape: BoxShape.rectangle,
                                          borderRadius: BorderRadius.circular( appState.MID_PAD ),
                                          color: Colors.white,
                                          ))),
                                 Expanded(
                                    child: TabBarView(
                                       children: <Widget>[
                                          _makeTab( () => makeTitleText( appState, "ZooBaDoo!", w, false, 1 ) ),
                                          _makeTab( () => summaryFrameWidget ),
                                          _makeTab( () => makeTitleText( appState, "ZooBaDoo!", w, false, 1 ) ),
                                          _makeTab( () => makeTitleText( appState, "ZooBaDoo!", w, false, 1 ) ),
                                          _makeTab( () => makeTitleText( appState, "ZooBaDoo!", w, false, 1 ) ),
                                          ]))
                                 ])))
                     ))
               ]);
         
      } else {
         print( "AppState not ? Loaded" );
         return CircularProgressIndicator();
      }
   }
   
   
   @override
      Widget build(BuildContext context) {
      
      container   = AppStateContainer.of(context);
      appState    = container.state;
      
      appState.screenHeight = MediaQuery.of(context).size.height;
      appState.screenWidth  = MediaQuery.of(context).size.width;

      return Scaffold(
         appBar: makeTopAppBar( context, "Home" ),
         body: _makeBody( context )
         );
   }
}
