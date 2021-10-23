import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/screens/summary_page.dart';


class CEProjectPage extends StatefulWidget {
   CEProjectPage({Key key}) : super(key: key);

  @override
  _CEProjectState createState() => _CEProjectState();
}

class _CEProjectState extends State<CEProjectPage> {

   var      container;
   AppState appState;
   
   @override
   void initState() {
      super.initState();
   }

   @override
   void dispose() {
      super.dispose();
   }


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

         Widget summaryPageWidget = CESummaryPage( appContainer: container );
            
         return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.start,
            children: <Widget>[
               
               makeTitleText( appState, appState.selectedRepo, w*6, false, 1, fontSize: 18),
               Container( height: 10 ),
               
               Expanded(
                  child: DefaultTabController(
                     initialIndex: 1,
                     length: 5,
                     child: Padding(
                        padding: EdgeInsets.fromLTRB(appState.GAP_PAD, appState.MID_PAD, appState.TINY_PAD, 0),
                        child: Container(
                           padding: EdgeInsets.all(5.0),
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
                                          borderRadius: BorderRadius.circular(10),
                                          color: Colors.white,
                                          ))),
                                 Expanded(
                                    child: TabBarView(
                                       children: <Widget>[
                                          _makeTab( () => makeTitleText( appState, "ZooBaDoo!", w, false, 1 ) ),
                                          _makeTab( () => summaryPageWidget ),
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
      
      return Scaffold(
         appBar: makeTopAppBar( context, "Home" ),
         body: _makeBody( context )
         );
   }
}
