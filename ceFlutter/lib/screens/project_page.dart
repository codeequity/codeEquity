import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/ingest.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/screens/summary_frame.dart';
import 'package:ceFlutter/screens/detail_page.dart';
import 'package:ceFlutter/screens/equity_frame.dart';
import 'package:ceFlutter/screens/approval_frame.dart';
import 'package:ceFlutter/screens/status_frame.dart';


class CEProjectPage extends StatefulWidget {
   CEProjectPage({Key? key}) : super(key: key);

  @override
  _CEProjectState createState() => _CEProjectState();
}

class _CEProjectState extends State<CEProjectPage> {

   late var      container;
   late AppState appState;

   late Map<String,int> screenArgs;
   var pageStamp = "";

   // iphone 5
   late double frameMinWidth;
   late double frameMinHeight;
   
   @override
   void initState() {
      super.initState();
   }

   @override
   void dispose() {
      super.dispose();
      print( "PP Disposessed!" );
   }


   // start CALLBACKS for tab frames
   // Must define here, since child widget state (like summaryFrame) is disposed of when clicking between frames

   Future<void> _updateCallback( ) async {
      await updatePEQAllocations( context, container );

      // Reset tree state to ensure proper open/close with tree.getCurrent, else appState never set
      if( appState.myPEQSummary != null && appState.myPEQSummary!.ceProjectId == appState.selectedCEProject && appState.allocTree != null )
      {
         appState.allocExpanded.clear();
         appState.allocTree!.reset();
      }

      // Reset storage key, otherwise horDiv and colors don't match expansion state
      // print( "Resetting PageStorageKey stamps" );
      pageStamp = DateTime.now().millisecondsSinceEpoch.toString();

      // Force reload of any peqs we look at, otherwise details may be wrong
      // XXX this is overkill, can do less work by only killing user peqs that actually changed.
      for( final ceUID in appState.cePeople.keys ) {
         print("Forced removal of cached PEQs" );
         appState.userPeqs.remove( ceUID );
      }
      
      // causes buildAllocTree to fire
      setState(() => appState.updateAllocTree = true );
      setState(() => appState.peqAllocsLoading = false );      
   }      

   Future<void> _detailCallback( List<String> category ) async {
      Map<String,dynamic> screenArgs = {};
      screenArgs["cat"] = category;
      MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEDetailPage(), settings: RouteSettings( arguments: screenArgs ));
      confirmedNav( context, container, newPage );
   }
   
   _allocExpansionCallback( expansionVal, path ) {
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
               makeHDivider( appState, appState.screenWidth, 0, 0 ),
               fn()
               ])
         );
   }

   // https://stackoverflow.com/questions/60362159/defaulttabcontroller-without-scaffold
   Widget _makeBody( context ) {
      final w = 100;
      if( appState.loaded ) {

         if( appState.verbose >= 4 ) { print( "PP ReBuild." ); }
         assert( screenArgs["initialPage"] != null );
         int startPage = screenArgs["initialPage"]!;

         // XXX 24?  18?
         double fhu = 24+18+7*appState.MID_PAD + 2*appState.TINY_PAD;
         
         // Rebuild summaryFrame upon peqUpdate, else previous pageStorageKeys don't match new allocs 
         Widget getSummaryFrame() {
            return CESummaryFrame(
               appContainer:           container,
               pageStamp:              pageStamp,
               frameHeightUsed:        fhu,
               updateCallback:         _updateCallback,
               detailCallback:         _detailCallback,
               allocExpansionCallback: _allocExpansionCallback );
         }

         Widget getEquityFrame() {
            return CEEquityFrame(
               appContainer:           container,
               frameHeightUsed:        fhu );
         }

         Widget getApprovalFrame() {
            return CEApprovalFrame(
               appContainer:           container,
               frameHeightUsed:        fhu );
         }
         Widget getAgreementsFrame() {
            return makeTitleText( appState, "ZooBaDoo!", w, false, 1 ); 
         }
         Widget getStatusFrame() {
            return CEStatusFrame(
               appContainer:           container,
               frameHeightUsed:        fhu );
         }

         return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.start,
            children: <Widget>[
               
               Container( height: appState.MID_PAD ),
               
               Expanded(
                  child: DefaultTabController(
                     initialIndex: startPage,
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
                                          Tab( child: makeTitleText( appState, "Equity Plan", w, false, 1 )),
                                          Tab( child: makeTitleText( appState, "Agreements", w, false, 1 )),
                                          Tab( child: makeTitleText( appState, "Status", w, false, 1 )),
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
                                          _makeTab( () => getApprovalFrame() ),
                                          _makeTab( () => getSummaryFrame() ),
                                          _makeTab( () => getEquityFrame() ),
                                          _makeTab( () => getAgreementsFrame() ),
                                          _makeTab( () => getStatusFrame() ),
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
      assert( appState != null );
      screenArgs = ModalRoute.of(context)!.settings.arguments as Map<String,int>;
      
      frameMinWidth  = appState.MIN_PANE_WIDTH;
      frameMinHeight = appState.MIN_PANE_HEIGHT;
      
      appState.screenHeight = MediaQuery.of(context).size.height;
      appState.screenWidth  = MediaQuery.of(context).size.width;

      if( appState.verbose >= 2 ) { print( "build project page" ); }

      return Scaffold(
         appBar: makeTopAppBar( context, "Project" ),
         body: _makeBody( context )
         );
   }
}
