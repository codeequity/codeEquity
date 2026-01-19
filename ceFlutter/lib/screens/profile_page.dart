import 'dart:ui';       // pointerKinds
import 'dart:math';
import 'dart:convert';  // json encode/decode
import 'package:flutter/material.dart';

import 'package:flutter/services.dart';                 // byte data

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/awsUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/screens/edit_page.dart';

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/Person.dart';
import 'package:ceFlutter/models/CEVenture.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/HostAccount.dart';
import 'package:ceFlutter/models/EquityPlan.dart';
import 'package:ceFlutter/models/PEQSummary.dart';
import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/Allocation.dart';

import 'package:ceFlutter/customLetters.dart';



// XXX copy!
// XXX move to WidgetUtils?
// Workaround breaking change 5/2021
// https://flutter.dev/docs/release/breaking-changes/default-scroll-behavior-drag
class MyCustomScrollBehavior2 extends MaterialScrollBehavior {
  // Override behavior methods and getters like dragDevices
  @override
  Set<PointerDeviceKind> get dragDevices => { 
    PointerDeviceKind.touch,
    PointerDeviceKind.mouse,
  };
}


class CEProfilePage extends StatefulWidget {
  CEProfilePage({Key? key}) : super(key: key);

  @override
  _CEProfileState createState() => _CEProfileState();

}


class _CEProfileState extends State<CEProfilePage> {

   TextStyle style = TextStyle(fontFamily: 'Montserrat', fontSize: 20.0);
   late Map<String,String> screenArgs;
   
   late var      container;
   late AppState appState; 
   
   late double lhsFrameMinWidth;
   late double lhsFrameMaxWidth;
   late double rhsFrameMinWidth;
   late double rhsFrameMaxWidth;
   
   // Keep size of headers for roles frame view.  Use this for key indexing
   late int roleHeaderTop; 
   
   late Widget vSpace;
   late Widget spacer;
   late Widget miniSpacer;
   late Widget empty;       // XXX formalize
   
   late List<Widget> collabPeqTable;
   late List<String> displayedPeqTable;
     
   late Person?           myself;
   late EquityPlan?       equityPlan;
   late PEQSummary?       peqSummary;
   late Image?            profileImage;
   
   late bool screenOpened;
   late bool updatedPeqTable;
   
  @override
  void initState() {
      super.initState();
      collabPeqTable    = [];
      displayedPeqTable = [];
      screenOpened      = true;
      updatedPeqTable   = false;
  }


  @override
  void dispose() {
    super.dispose();
    print( "profile disposed.  reset loading?" );
  }

  
  Function _logout( context, appState) {
     wrapper() async {
        logout( context, appState );
     }
     return wrapper;
  }


  // if show/alert dialog needs dynamic updates, need to use statefulbuilder or statefulWidget
  void popMRScroll( BuildContext context, scrollHeader, ceUserId, ceps, cepIds, dismissFunc, textWidth ) {
     assert( ceps.length == cepIds.length );
     showDialog(
        context: context,
        builder: (BuildContext context)
        {
           return StatefulBuilder( 
              builder: ( context, setState )
              {
                 // Need to convert ceps (names) to dds.
                 List<Widget> cepLinks = [];
                 for( int i = 0; i < ceps.length; i++ ) {
                    // setState must be defined within statefulBuilder:builder, else operates in wrong context
                    void _set( PointerEvent event )   { setState(() => appState.hoverChunk = cepIds[i]+ceUserId ); }
                    void _unset( PointerEvent event ) { setState(() => appState.hoverChunk = "" ); }
                    cepLinks.add( _makeCEPLink( ceps[i], cepIds[i], set: _set, unset: _unset, trigger: cepIds[i] + ceUserId, namePreface: "   " ));
                 }
                 
                 Widget ceProjDetail = Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.start,
                    children: cepLinks
                    );
                 
                 return
                    AlertDialog(
                       scrollable: true,
                       title: new Text( scrollHeader ),
                       content: ceProjDetail,
                       actions: <Widget>[
                          new TextButton(
                             key: Key( 'Dismiss' ),
                             child: new Text("Dismiss"),
                             onPressed: dismissFunc )
                          ]);
              });
        });
  }
  
  
  // Need projects for full profile.
  // NOTE: userName is displayed, but selected value is the id.
  void updatePerson( context, container ) async {
     if( screenOpened && screenArgs["profType"] == "Person" ) {
        assert( screenArgs["id"] != null );
        String profId = screenArgs["id"]!;
        // Signed in user?  
        if( profId == "" ) { profId = appState.ceUserId; }
        // print( "Getting stuff (maybe) for " + profId );
        String query = '{ "Endpoint": "GetHostA", "CEUserId": "$profId" }';
        String pdpi = '{ "Endpoint": "GetEntry", "tableName": "CEProfileImage", "query": {"CEProfileId": "$profId" }}';
        
        Map<String,dynamic> rawPITable = {};
        var futs = await Future.wait([
                                        (appState.cePeople[profId] == null ? 
                                         fetchAPerson( context, container, profId ).then( (p) => p != null ? appState.cePeople[profId] = p : true ) :
                                         new Future<bool>.value(true) ),
                                        
                                        (appState.ceHostAccounts[profId] == null ? 
                                         fetchHostAcct( context, container, query ).then( (p) => appState.ceHostAccounts[profId] = p ) :
                                         new Future<bool>.value(true) ),

                                        (appState.ceImages[profId] == null ? 
                                         fetchProfileImage( context, container, pdpi ).then(            (p) => rawPITable = p ) :
                                         new Future<bool>.value(true) ),
                                        
                                        ]);

        myself = appState.cePeople[profId]!;
        assert( myself != null );

        assert( appState.ceHostAccounts[profId] != null );
        
        assert( appState.cogUser != null );
        if( myself!.userName != appState.cogUser!.preferredUserName ) { print( "Checking out a different profile: " + myself!.userName ); }
        
        if( rawPITable.keys.length > 0 ) {
           print( rawPITable["CEProfileId"] + " " + rawPITable["ByteData"].length.toString() );
           Uint8List bytes = new Uint8List.fromList( List<int>.from( rawPITable["ByteData"] ) );
           appState.ceImages[profId] = Image.memory( bytes, key: Key( profId + "Image" ), width: lhsFrameMaxWidth );
           assert( appState.ceImages[profId] != null );
        }
        profileImage = appState.ceImages[profId];

        setState(() => screenOpened = false );
     }
  }

  // Updates for CEProject, and CEVenture
  // XXX there is no need to get all this data - can reduce amount xferred
  void updateProjects( context, container, HostPlatforms hostPlat ) async {
     
     if( screenOpened  && ( screenArgs["profType"] == "CEProject" || screenArgs["profType"] == "CEVenture" )) {
        assert( screenArgs["id"] != null );

        String pid = "";
        String vid = "";
        String primeId = "";
        
        if( screenArgs["profType"] == "CEProject" ) {
           pid = screenArgs["id"]!;
           CEProject myCEP = appState.ceProject[ pid ] ?? CEProject.empty();
           vid = myCEP.ceVentureId;
           primeId = pid;
        }
        else {
           vid   = screenArgs["id"]!;
           List<String> cepIds = _getCEProjects( vid );
           pid = cepIds.length > 0 ? cepIds[0] : "";
           primeId = vid;
        }
        
        var postDataPS = {};
        postDataPS['EquityPlanId'] = vid;
        final pd = { "Endpoint": "GetEntry", "tableName": "CEEquityPlan", "query": postDataPS };

        postDataPS = {};
        postDataPS['PEQSummaryId'] = pid;
        final pdps = { "Endpoint": "GetEntry", "tableName": "CEPEQSummary", "query": postDataPS };

        final pdpi = '{ "Endpoint": "GetEntry", "tableName": "CEProfileImage", "query": {"CEProfileId": "$primeId" }}';

        final hostName = enumToStr( hostPlat );
        final pdpa = '{ "Endpoint": "GetHostA", "HostPlatform": "$hostName" }'; 
        
        Map<String,dynamic> rawPITable = {};
        List<HostAccount>   haccts     = [];

        await Future.wait([
                             (!appState.hostPlatformsLoaded.contains( enumToStr( hostPlat ) ) ? 
                              fetchHostAcct( context, container, pdpa ).then(                 (p) => haccts = p ) : 
                              new Future<bool>.value(true) ),
                             
                             (appState.cePEQSummaries[pid] == null ?
                              fetchPEQSummary( context, container, json.encode( pdps )).then((p) => appState.cePEQSummaries[pid] = p ) :
                              new Future<bool>.value(true) ),

                             (appState.ceEquityPlans[vid] == null ? 
                              fetchEquityPlan( context, container, json.encode( pd ) ).then( (p) => appState.ceEquityPlans[vid] = p ) :
                              new Future<bool>.value(true) ),
                             
                             (appState.ceImages[pid] == null ? 
                              fetchProfileImage( context, container, pdpi ).then(            (p) => rawPITable = p ) :
                              new Future<bool>.value(true) ),
                             
                             ]);
        peqSummary = appState.cePEQSummaries[pid];
        equityPlan = appState.ceEquityPlans[vid];

        if( !appState.hostPlatformsLoaded.contains(  enumToStr( hostPlat ) ) ) { appState.hostPlatformsLoaded.add(  enumToStr( hostPlat ) ); }
        // One ha per platform, list length is 1
        for( HostAccount ha in haccts ) { appState.ceHostAccounts[ha.ceUserId] = [ha]; }
           
        if( rawPITable.keys.length > 0 ) {
           print( rawPITable.keys.toString() );
           print( rawPITable["CEProfileId"]);
           print( rawPITable["ByteData"].length.toString());
           // final ByteData assetImageByteData = await rootBundle.load( rawPITable["ByteData"] );
           // final x = assetImageByteData.buffer.asUint8List();
           Uint8List bytes = new Uint8List.fromList( List<int>.from( rawPITable["ByteData"] ) );
           appState.ceImages[primeId] = Image.memory( bytes, key: Key( primeId + "Image" ), width: lhsFrameMaxWidth );
           assert( appState.ceImages[primeId] != null );
        }
        profileImage = appState.ceImages[primeId];
        
        // need setState to trigger makeBody else blank info
        setState(() => screenOpened = false );
     }
  }
  
  Widget _makeProjCard( context, String cepId, textWidth ) {
     void _setTitle( PointerEvent event )   { setState(() => appState.hoverChunk = cepId ); }
     void _unsetTitle( PointerEvent event ) { setState(() => appState.hoverChunk = "" );    }

     CEProject cep = appState.ceProject[ cepId ] ?? CEProject.empty();
     CEVenture cev = appState.ceVenture[ cep.ceVentureId ] ?? CEVenture.empty();
     final cepIds  = _getCEProjects( cev.ceVentureId );
 
     Widget cepLink = GestureDetector(
        onTap: () async
        {
           Map<String,String> screenArgs = {"id": cepId, "profType": "CEProject" };
           MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEProfilePage(), settings: RouteSettings( arguments: screenArgs ));
           confirmedNav( context, container, newPage );
        },
        child: makeActionableText( appState, cep.name, cepId, _setTitle, _unsetTitle, textWidth, false, 1 ),
        );

     
     Widget card = Card.outlined(
        child: SizedBox(
           width: appState.MIN_PANE_WIDTH - appState.GAP_PAD,
           height: 2.0*appState.CELL_HEIGHT,
           child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.start,
              children: [
                 cepLink,
                 miniSpacer,
                 makeTitleText( appState, cep.description, textWidth, false, 1, fontSize: 14 ),
                 // makeTitleText( appState, "Venture: " + cev.name, textWidth, false, 1, fontSize: 14 ),
                 _makeCEVLink( cev.name, cev.ceVentureId, cepIds, textWidth ),
                 ]
              )
           ),
        );
     return card;
  }

  Widget _makeCollabLink( String ceUserId, String ceUserName, double textWidth, { intrinsicWidth = true } ) {
     // Person
     void _setTitle( PointerEvent event )   { setState(() => appState.hoverChunk = ceUserId );  }
     void _unsetTitle( PointerEvent event ) { setState(() => appState.hoverChunk = "" );        }
     
     return GestureDetector(
        onTap: () async
        {
           Map<String,String> screenArgs = {"id": ceUserId, "profType": "Person" };
           MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEProfilePage(), settings: RouteSettings( arguments: screenArgs ));
           confirmedNav( context, container, newPage );
        },
        // If just use ceName, all same name collabs are highlighted.
        child: intrinsicWidth ?
        makeActionableText( appState, ceUserName, ceUserId, _setTitle, _unsetTitle, textWidth, false, 1 ) :
        Container( width: textWidth, child: makeActionableText( appState, ceUserName, ceUserId, _setTitle, _unsetTitle, textWidth, false, 1 ))
        );
  }

  
  Widget _makeCollabCard( context, HostAccount ha, textWidth, maxProjCount ) {
     String ceUserId = ha.ceUserId;
     // print( ceUserId + " " + appState.cePeople.toString() );
     assert( appState.cePeople[ ceUserId ] != null );
     Person cePeep = appState.cePeople[ ceUserId ]!;

     Widget _makeProjLink( ceps, cepIds ){
        // Project
        void _set( PointerEvent event )   { setState(() => appState.hoverChunk = "projects" + ceUserId );  }
        void _unset( PointerEvent event ) { setState(() => appState.hoverChunk = "" );   }
        
        return GestureDetector( 
        onTap: () async
        {
           popMRScroll( context, "CE Projects", ceUserId, ceps, cepIds, () => Navigator.of( context ).pop(), textWidth );
        },
        child: makeActionableText( appState, "projects", "projects"+ceUserId, _set, _unset, textWidth, false, 1, tgap: appState.TINY_PAD, lgap: 0.0 ),
        );
     }

     List<String> ceProjs = ha.ceProjectIds.map( (pid) => (appState.ceProject[pid] ?? CEProject.empty()).name ).toList();
     // XXX Compute this
     Map<String,String> mostActive = ceProjs.length > 0 ? {"name": ceProjs[0], "id": ha.ceProjectIds[0] } : {"name": "", "id": "" };
     
     Widget card = Card.outlined(
        child: ConstrainedBox(
           constraints: BoxConstraints( minHeight: 2.2*appState.CELL_HEIGHT, maxHeight: 2.4*appState.CELL_HEIGHT, maxWidth: appState.MIN_PANE_WIDTH - appState.GAP_PAD ),
           child: ListView(
              scrollDirection: Axis.vertical,
              children: [
                 _makeCollabLink( ceUserId, cePeep.getFullName(), textWidth ),
                 makeTitleText( appState, cePeep.userName + " (" + ceUserId + ")", textWidth, false, 1 ),
                 Row(
                    mainAxisAlignment: MainAxisAlignment.start,
                    crossAxisAlignment: CrossAxisAlignment.start,                    
                    children: [
                       Padding(
                          padding: EdgeInsets.fromLTRB(appState.GAP_PAD, appState.TINY_PAD, appState.TINY_PAD, 0),
                          child: IntrinsicWidth( child: Text( "Member of: " + ceProjs.length.toString(), style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)))
                          ),
                       _makeProjLink( ceProjs, ha.ceProjectIds ),
                       ]),
                 Row(
                    mainAxisAlignment: MainAxisAlignment.start,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                       Padding(
                          padding: EdgeInsets.fromLTRB(appState.GAP_PAD, appState.TINY_PAD, appState.TINY_PAD, 0),
                          child: IntrinsicWidth( child: Text( ceProjs.length == 0 ? "" : "Most active in: ", style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)))
                          ),
                       _makeCEPLink( mostActive["name"], mostActive["id"], trigger: mostActive["id"]! + ceUserId, realign: true )
                       ]),
                 ])
           ));
     
     return card;
  }
  
  Widget _makeCEPs( context, HostAccount ha, textWidth ) {
     List<Widget> ceps = [];
     
     // print( "Making " + ha.ceProjectIds.toString() );
     for( int i = 0; i < ha.ceProjectIds.length; i += 2 ) {
        List<Widget> row = [];
        row.add( _makeProjCard( context, ha.ceProjectIds[i], textWidth ) );
        if( ha.ceProjectIds.length > i+1 ) { row.add( _makeProjCard( context, ha.ceProjectIds[i+1], textWidth )); }
        ceps.add( Wrap( spacing: appState.MID_PAD, children: row ) );
        ceps.add( spacer );
     }
     Widget frame = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.start,
        children: ceps
        );
     
     return frame;
  }

  Future< Map<String,String>> _getCollabPeqVals( context, container, cepId ) async {
     Map<String,String> retVal = { "Planned": "0", "Pending": "0", "Accrued": "0", "Vested": "0" };
     int plan = 0;
     int pend = 0;
     int accr = 0;
     int vest = 0;
     assert( screenArgs["id"] != null );
     String me = screenArgs["id"]! == "" ? appState.ceUserId : screenArgs["id"]!;

     // print( "GetCollab psum? " + ( appState.cePEQSummaries[cepId] == null ).toString() );
     if( appState.cePEQSummaries[cepId] == null ) {
           var postDataPS = {};
           postDataPS['PEQSummaryId'] = cepId;
           final pdps = { "Endpoint": "GetEntry", "tableName": "CEPEQSummary", "query": postDataPS };
           await fetchPEQSummary( context, container, json.encode( pdps )).then((p) => appState.cePEQSummaries[cepId] = p );
        }

     // May not exist
     if( appState.cePEQSummaries[cepId] != null ) {
        Map<String, Allocation> allocs = appState.cePEQSummaries[cepId]!.allocations;
        allocs.forEach( (k,v) {
              // print( "  .. checking " + v.ceUID! + " " + v.hostUserId + " " + v.hostUserName! + " " + v.sourcePeq!.toString());
              if( v.ceUID == me ) {
                 // print( v.toString() );
                 switch( v.allocType ) {
                 case PeqType.plan:    plan  += ( v.amount ?? 0 ) ; break;
                 case PeqType.pending: pend  += ( v.amount ?? 0 ) ; break;
                 case PeqType.grant:   accr  += ( v.amount ?? 0 ) ; break;
                 default: print( "WARNING. Peq Type " + v.allocType.toString() + " was not processed."  ); assert( false );
                 }
              }
           });
        retVal["Planned"] = addCommas( plan );
        retVal["Pending"] = addCommas( pend );
        retVal["Accrued"] = addCommas( accr );
     }
     
     return retVal;
  }
  
  Widget _makePEQSummary( context, cepId, textWidth ) {
     double height = appState.CELL_HEIGHT;
     double width  = textWidth / 4;
     void _set( PointerEvent event )   { setState(() => appState.hoverChunk = "ppCEP"+cepId); }
     void _unset( PointerEvent event ) { setState(() => appState.hoverChunk = "" ); }

     CEProject cep = appState.ceProject[ cepId ] ?? CEProject.empty();

     return GestureDetector( 
        onTap: () async
        {
           // header
           if( collabPeqTable.length < 1 ) {
              collabPeqTable.add(
                 Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.start,
                    children: [ makeTitleText( appState, "CE Project", width * 3.0, false, 1 ),
                                makeTitleText( appState, "Planned", width, false, 1 ),
                                makeTitleText( appState, "Pending", width, false, 1 ),
                                makeTitleText( appState, "Accrued", width, false, 1 ),
                                makeTitleText( appState, "Vested", width,  false, 1 ),
                       ]) );
              collabPeqTable.add( Wrap( spacing: 0, children: [
                                           Container( width: appState.GAP_PAD ),
                                           makeActionButtonFixed( appState, 'Clear', width, ( () {
                                                    collabPeqTable    = [];
                                                    displayedPeqTable = [];
                                                    setState( () => updatedPeqTable = true );                          
                                                 })
                                              ),
                                           ]));       
           }

           if( !displayedPeqTable.contains( cepId ) ) {
              assert( displayedPeqTable.length == collabPeqTable.length - 2 ); // header, clear button

              Map<String,String> pv = await _getCollabPeqVals( context, container, cepId );
              displayedPeqTable.add( cepId );
              int idx = collabPeqTable.length - 1;
              
              collabPeqTable.insert( idx, 
                 Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.start,
                    children: [            
                       makeTableText( appState, cep.name, width * 3.0, height, false, 1 ),
                       makeTableText( appState, pv["Planned"], width, height, false, 1 ),
                       makeTableText( appState, pv["Pending"], width, height, false, 1 ),
                       makeTableText( appState, pv["Accrued"], width, height, false, 1 ),
                       makeTableText( appState, pv["Vested"],  width, height, false, 1 ),
                       ]
                    ));
              
              setState( () => updatedPeqTable = true );
           }
        },
        child: makeActionableText( appState, "   "+cep.name, "ppCEP"+cepId, _set, _unset, textWidth, false, 1, keyPreface: "ppCEP" ),
        );
  }
  
  Widget _makePperCEP( context, ha, textWidth ) {
     List<Widget> ppCEP = [];
                   
     for( int i = 0; i < ha.ceProjectIds.length; i++ ) {
        ppCEP.add( _makePEQSummary( context, ha.ceProjectIds[i], textWidth ));
     }
     Widget frame = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.start,
        children: ppCEP
        );
     
     return frame;
  }

  // Roles: Executive, grantor, member.
  //        shared across every CEP in CEV
  // NOTE: there must be at least 1 executive per CEV, minimum.  So, by default, project creator is the executive.
  // Every role can remove/add peer, and below.   
  Widget _makeCollabs( context, List<HostAccount> hostAccs, textWidth ) {
     List<Widget> ceps = [];

     int maxProjCount = hostAccs.fold( 0, ( res, elt ) => max( res, elt.ceProjectIds.length ) );
     for( int i = 0; i < hostAccs.length; i += 2 ) {
        List<Widget> row = [];
        row.add( _makeCollabCard( context, hostAccs[i], textWidth, maxProjCount ) );
        if( hostAccs.length > i+1 ) { row.add( _makeCollabCard( context, hostAccs[i+1], textWidth, maxProjCount )); }
        ceps.add( Wrap( spacing: appState.MID_PAD, children: row ) );
        ceps.add( spacer );
     }
     Widget frame = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.start,
        children: ceps
        );
     
     return frame;
  }

  List<List<Widget>> _getRoleHeader( ) {
     final width = ( rhsFrameMaxWidth - 2*appState.FAT_PAD ) / 4.0;
     
     List<List<Widget>> header = [];
     Widget hdiv               = makeHDivider( appState, 3.0 * width, appState.GAP_PAD, appState.GAP_PAD, tgap: appState.MID_PAD );
                    
     Widget row0 = Container( width: 1.0*width, child: makeTableText( appState, "CodeEquity User", width, appState!.CELL_HEIGHT, false, 1 ) );
     Widget row1 = makeToolTip( Container( width: 0.7*width, child: makeTableText( appState, enumToStr( MemberRole.Executive ), width, appState!.CELL_HEIGHT, false, 1 )),
                                "An Executive role can perform any action in the venture, including creating and modifying the Equity Plan." );
     Widget row2 = makeToolTip( Container( width: 0.7*width, child: makeTableText( appState, enumToStr( MemberRole.Grantor ), width, appState!.CELL_HEIGHT, false, 1 )),
                                "A Grantor can do anything a Member can, and additionally can approve PEQs to be accrued on the approvals page." );
     Widget row3 = makeToolTip( Container( width: 0.7*width, child: makeTableText( appState, enumToStr( MemberRole.Member ), width, appState!.CELL_HEIGHT, false, 1 )),
                                "A Member can do and view anything within CodeEquity with the exception of approving PEQs or modifying the Equity Plan." );
     
     header.add([ vSpace, vSpace, vSpace, vSpace ]);
     header.add([ row0,   row1,   row2,   row3   ]);
     header.add([ hdiv,   empty,  empty,  empty  ]);
     
     roleHeaderTop = header.length; 
     return header;
  }

  List<List<Widget>> _getRoleBody( context, container, List<HostAccount> hostAccs, CEVenture cev ) {
     List<List<Widget>> roleBody = [];
     final width = ( rhsFrameMaxWidth - appState.FAT_PAD ) / 4.0;
     final lspace = Container( width: 0.1 * width );
     final rspace = Container( width: 0.5 * width );

     final loggedInUserName = appState.cogUser!.preferredUserName == null ? "z" : appState.cogUser!.preferredUserName!;
     final loggedInUserId   = appState.ceUserId;
     
     Widget _makeSetRole( CEVenture cev, String ceUserId, String loggedInUserId, MemberRole role ) {
        assert( cev.roles[ceUserId] != null );

        // Does logged in user does have permission to set role?
        bool canSet = false;
        MemberRole loggedInRole = MemberRole.end;
        if( cev.roles[loggedInUserId] != null ) { loggedInRole = cev.roles[loggedInUserId]!; }

        // print( "Logged in user: " + loggedInUserName + " id: " + loggedInUserId + " role " + enumToStr( loggedInRole ) );
        // print( "Modified user: " + ceUserId );
        String failMsg = "";
        if( loggedInRole.index <= role.index ) { canSet = true; }
        else                                   { failMsg = loggedInUserName + " does not have adequate permissions for this operation"; }

        if( role != MemberRole.Executive ) {
           bool foundExec = false;
           for( final entry in cev.roles.entries ) {
              if( entry.key != ceUserId && entry.value == MemberRole.Executive ) {
                 foundExec = true;
                 break;
              }
           }
           if( canSet && !foundExec ) {
              canSet = false;
              failMsg = "Every CodeEquity Venture must have at least one Exective.  Operation failed.";
           }
        }

        return GestureDetector (
           onTap: () async
           {
              if( canSet ) {
                 setState( () => cev.roles[ceUserId] = role );
                 // Don't wait
                 writeCEVenture( appState, context, container, cev );
              }
              else         { showToast( failMsg ); }
           },
           child: cev.roles[ceUserId] == role ?
           Container( width: 0.7 * width, child: Wrap( spacing: 0, children: [ lspace, Icon( Icons.check_circle_outline, color: Colors.green ), rspace ] )) : 
           Container( width: 0.7 * width, child: Wrap( spacing: 0, children: [ lspace, Icon( Icons.circle_outlined, color: Colors.black ), rspace ] ))
           );
     }
     
     for( int i = 0; i < hostAccs.length; i++ ) {
        String ceUserId         = hostAccs[i].ceUserId;
        assert( appState.cePeople[ ceUserId ] != null );
        Person cePeep = appState.cePeople[ ceUserId ]!;
            
        Widget row0 = _makeCollabLink( ceUserId, cePeep.getFullName(), 1.0*width, intrinsicWidth: false );
        Widget row1 = _makeSetRole( cev, ceUserId, loggedInUserId, MemberRole.Executive );
        Widget row2 = _makeSetRole( cev, ceUserId, loggedInUserId, MemberRole.Grantor );
        Widget row3 = _makeSetRole( cev, ceUserId, loggedInUserId, MemberRole.Member );

        roleBody.add([ row0, row1, row2, row3 ]);
     }
     return roleBody;
  }

  Widget _makeRoles( context, container, List<HostAccount> hostAccs, CEVenture cev ) {
     List<List<Widget>> roles = [];
     roles.addAll( _getRoleHeader() );
     roles.addAll( _getRoleBody( context, container, hostAccs, cev ));
     
     final svHeight = ( appState.screenHeight ) * .4;
     final svWidth  = rhsFrameMinWidth * 2.0;             // XXX oi
     
     return ScrollConfiguration(
        behavior: MyCustomScrollBehavior2(),
        child: SingleChildScrollView(
           scrollDirection: Axis.horizontal,
           child: SizedBox(
              height: svHeight,
              width: svWidth,
              child: ListView(
                 children: List.generate(
                    roles.length,
                    (indexX) => Row(
                       key: Key( 'role ' + ( indexX - roleHeaderTop ).toString() ),                           
                       children: List.generate( 
                          roles[0].length,
                          (indexY) => roles[indexX][indexY] ))
                    )))));
  }

  Widget _getProfImage( name, nameAlt ) {
     Widget pi;
     if( name == "" || name == "-1" ) {
        double gap = lhsFrameMaxWidth / 3.0;
        pi = Padding(
           padding: EdgeInsets.fromLTRB(gap, gap/2.0, gap, gap/2.0),
           child: Container( width: gap, height: gap, child: CircularProgressIndicator() )
           );
     }
     else {
        String iname = name.length > 0 ? name : nameAlt;
        pi = Image.asset( "images/"+iname[0].toLowerCase() + "Grad.jpg",
                          key: Key( iname[0].toLowerCase() + "GradImage" ),
                          width: lhsFrameMaxWidth,
                          color: Colors.grey.withOpacity(0.05),
                          colorBlendMode: BlendMode.darken );
     }
     return pi;
  }

  Widget _makeCEBody( context, Widget botLeft, Widget rhs, List<String> cepIds ) {
     final textWidth      = lhsFrameMaxWidth - 1.0*appState.GAP_PAD - appState.TINY_PAD;
     Widget? pi           = null;
     CEVenture cev        = CEVenture.empty();
     CEProject cep        = CEProject.empty();
     String cepId         = cep.ceProjectId;
     String cevId         = cev.ceVentureId;
     EquityPlan ep        = EquityPlan.empty( screenArgs["id"]! );
     PEQSummary psum      = PEQSummary.empty( screenArgs["id"]! );
     
     if( !screenOpened ) {
        assert( appState.ceProject != {} );
        assert( appState.ceVenture != {} );

        if( screenArgs["profType"] == "CEProject" ) {
           cep = appState.ceProject[ screenArgs["id"] ] ?? cep;
           cepId   = cep.ceProjectId;
           cev = appState.ceVenture[ cep.ceVentureId ] ?? cev;
           cevId = cev.ceVentureId;
           assert( cevId != "-1" );
           assert( cepId != "-1" );
        }
        // XXX Currently build for 1:1 cev:cep
        else if( screenArgs["profType"] == "CEVenture" ) {
           assert( cepIds.length >= 1 );
           cev   = appState.ceVenture[ screenArgs["id"] ] ?? cev;
           cevId = cev.ceVentureId;
           cepId = cepIds[0];
           cep   = appState.ceProject[ screenArgs["id"] ] ?? cep;
           assert( cevId != "-1" );
           assert( cepId != "-1" );
        }
        
        if( profileImage != null ) { pi   = profileImage!; }
        if( equityPlan   != null ) { ep   = equityPlan!; }
        if( peqSummary   != null ) { psum = peqSummary!; }

     }
     dynamic prime   = screenArgs["profType"] == "CEProject" ? cep   : cev;
     dynamic primeId = screenArgs["profType"] == "CEProject" ? cepId : cevId;
     dynamic minor   = screenArgs["profType"] == "CEProject" ? cev   : cep;
     String  desc    = screenArgs["profType"] == "CEProject" ? prime.description : prime.web;
     
     if( pi == null ) { pi = _getProfImage( primeId, "a" ); }
     
     double accr     = ep.totalAllocation > 0 ? ( 1.0 * psum.accruedTot ) / ep.totalAllocation : 0.0;
     double tasked   = ep.totalAllocation > 0 ? ( 1.0 * psum.taskedTot  ) / ep.totalAllocation : 0.0;
     double unTasked = ep.totalAllocation > 0 ? ( 1.0 - accr - tasked ) : 0.0;

     return Wrap(
        children: [
           spacer, 
           Column( 
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.start,
              children: <Widget>[
                 spacer, 
                 pi,
                 makeTitleText( appState, prime.name, textWidth * 1.1, false, 1, fontSize: 24 ),
                 // project,
                 makeTitleText( appState, "Id: " + primeId, textWidth, false, 1 ),
                 makeTitleText( appState, desc, textWidth, false, 1 ),
                 screenArgs["profType"] == "CEProject" ? _makeCEVLink( cev.name, cev.ceVentureId, cepIds, textWidth ) : miniSpacer,
                 miniSpacer,
                 Wrap( children: [ Container( width: appState.GAP_PAD ), 
                                   makeActionButtonFixed( appState, "Edit profile", lhsFrameMaxWidth / 2.0, () async {
                                         MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEEditPage(), settings: RouteSettings( arguments: screenArgs ));
                                         confirmedNav( context, container, newPage );
                                      }),
                                   Container( width: lhsFrameMaxWidth / 2.0 ), 
                          ]),
                 makeHDivider( appState, textWidth, 1.0*appState.GAP_PAD, appState.GAP_PAD, tgap: appState.MID_PAD ),
                 makeToolTip( makeTitleText( appState, "Venture Equity Plan PEQs:", textWidth, false, 1, fontSize: 14 ),"Provisional EQuity, see https://github.com/codeequity/codeEquity", wait: true ),
                 Table(
                    defaultColumnWidth: FixedColumnWidth( 2.0 * textWidth / 3.0 ),
                    defaultVerticalAlignment: TableCellVerticalAlignment.middle,
                    children: <TableRow>[
                       TableRow(
                          children: <Widget>[
                             makeTitleText( appState, "    Accrued:", textWidth, false, 1, fontSize: 14 ),
                             makeTitleText( appState, makePercent( accr ), textWidth, false, 1, fontSize: 14 ),
                             ]),
                       TableRow(
                          children: <Widget>[
                             makeTitleText( appState, "    Tasked out:", textWidth, false, 1, fontSize: 14 ),
                             makeTitleText( appState, makePercent( tasked ), textWidth, false, 1, fontSize: 14 ),
                             ]),                       
                       TableRow(
                          children: <Widget>[
                             makeTitleText( appState, "    Untasked:", textWidth, false, 1, fontSize: 14 ),
                             makeTitleText( appState, makePercent( unTasked ), textWidth, false, 1, fontSize: 14 ),
                             ]),                       
                       TableRow(
                          children: <Widget>[
                             makeTitleText( appState, "    Total Allocated:", textWidth, false, 1, fontSize: 14 ),
                             makeTitleText( appState, addCommas( ep.totalAllocation ), textWidth, false, 1, fontSize: 14 ),
                             ]),                       
                       ]),
                 miniSpacer,
                 botLeft,
                 ]),
           spacer,
           rhs
           ]);
       
  }

  Widget _makeProjectBody( context ) {
     final textWidth      = lhsFrameMaxWidth - 1.0*appState.GAP_PAD - appState.TINY_PAD;  // XXX base this on rhswidth
     Widget collabWid     = spacer;
     CEProject cep        = CEProject.empty();
     String cepId         = cep.ceProjectId;
     List<Widget> repoWid = [spacer];
     
     if( !screenOpened ) {
        assert( appState.ceProject != {} );
        cep = appState.ceProject[ screenArgs["id"] ] ?? CEProject.empty();
        cepId   = cep.ceProjectId;
        assert( cepId != "-1" );

        // CEProject repos
        for( int i = 0; i < cep.repositories.length; i++ ) {
           if( i == 0 ) { repoWid = [ makeTitleText( appState, "   " + cep.repositories[i]  + " (" + cep.hostRepoId[i] + ")", textWidth*1.2, false, 1 ) ]; }
           else         { repoWid.add( makeTitleText( appState, "   " + cep.repositories[i] + " (" + cep.hostRepoId[i] + ")", textWidth*1.2, false, 1 )); }
        }

        // CEProject Collabs
        List<HostAccount> collabs = [];
        for( String ceuid in appState.ceHostAccounts.keys ) {
           assert( appState.ceHostAccounts[ceuid] != null );
           List<HostAccount> has = appState.ceHostAccounts[ceuid]!;
           for( HostAccount ha in has ) {
              if( ha.hostPlatform == cep.hostPlatform && ha.ceProjectIds.contains( cepId ) ) {
                 collabs.add( ha );
              }
           }
        }
        collabWid = _makeCollabs( context, collabs, textWidth );
     }

     Widget hplat = 
        Column( 
           crossAxisAlignment: CrossAxisAlignment.start,
           mainAxisAlignment: MainAxisAlignment.start,
           children: <Widget>[
              makeHDivider( appState, textWidth, 1.0*appState.GAP_PAD, appState.GAP_PAD, tgap: appState.MID_PAD ),
              makeTitleText( appState, "Host Platform: " + cep.hostPlatform, textWidth, false, 1, fontSize: 18 ),
              makeTitleText( appState, "Project management system:" , textWidth, false, 1 ),
              makeTitleText( appState, "   " + cep.projectMgmtSys , textWidth, false, 1 ),
              makeTitleText( appState, "Repositories:", textWidth, false, 1 ),
              Column( 
                 crossAxisAlignment: CrossAxisAlignment.start,
                 mainAxisAlignment: MainAxisAlignment.start,
                 children: repoWid ),
              ]);
     
     Widget collabs =
        Column( 
           crossAxisAlignment: CrossAxisAlignment.start,
           mainAxisAlignment: MainAxisAlignment.start,
           children: <Widget>[
              spacer,
              makeTitleText( appState, "Collaborators", textWidth, false, 1, fontSize: 18 ),
              spacer,
              collabWid,
              ]);

     return _makeCEBody( context, hplat, collabs, [] ); 
     
  }

  List<String> _getCEProjects( String cevId ) {
     List<String> cepIds  = [];     
     for( String cepKey in appState.ceProject.keys ) {
        CEProject cep = appState.ceProject[ cepKey ]!;
        if( cep.ceVentureId == cevId ) {
           cepIds.add( cep.ceProjectId );
        }
     }
     return cepIds;
  }

  Widget _makeCEPLink( cepName, cepId, {set = null, unset = null, trigger = "", namePreface = "", realign = false} ) {
     trigger = trigger == "" ? cepName+cepId : trigger;
     final textWidth      = lhsFrameMaxWidth - 1.0*appState.GAP_PAD - appState.TINY_PAD;
     if( set == null ) {
        void _set( PointerEvent event )   { setState(() => appState.hoverChunk = trigger ); }
        void _unset( PointerEvent event ) { setState(() => appState.hoverChunk = "" ); }
        set = _set;
        unset = _unset;
     }

     return GestureDetector( 
        onTap: () async
        {
           Map<String,String> screenArgs = {"id": cepId, "profType": "CEProject" };
           MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEProfilePage(), settings: RouteSettings( arguments: screenArgs ));
           confirmedNav( context, container, newPage );
        },
        child: realign ?
        makeActionableText( appState, namePreface + cepName, trigger, set, unset, textWidth, false, 1, tgap: appState.TINY_PAD, lgap: 0.0 ) : 
        makeActionableText( appState, namePreface + cepName, trigger, set, unset, textWidth, false, 1 ),
        );
  }

  Widget _makeCEVLink( cevName, cevId, List<String> cepIds, textWidth ){
     void _set( PointerEvent event )   { setState(() => appState.hoverChunk = cevId+cevName ); }
     void _unset( PointerEvent event ) { setState(() => appState.hoverChunk = "" ); }

     return Wrap( children: [
                     Padding(
                          padding: EdgeInsets.fromLTRB(appState.GAP_PAD, appState.TINY_PAD, appState.TINY_PAD, 0),
                          child: IntrinsicWidth( child: Text( "Venture:", style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)))
                          ),
                     GestureDetector( 
                        onTap: () async
                        {
                           Map<String,String> screenArgs = {"id": cevId, "profType": "CEVenture" };
                           MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEProfilePage(), settings: RouteSettings( arguments: screenArgs ));
                           confirmedNav( context, container, newPage );
                        },
                        child: makeActionableText( appState, cevName, cevId+cevName, _set, _unset, textWidth, false, 1, tgap: appState.TINY_PAD, lgap: 0.0 ),
                        )
                     ]);
  }
  
  Widget _makeVentureBody( context, container ) {
     final textWidth      = lhsFrameMaxWidth - 1.0*appState.GAP_PAD - appState.TINY_PAD;
     CEVenture cev        = CEVenture.empty();
     String cevId         = cev.ceVentureId;
     List<Widget> cepWid  = [spacer];
     List<String> cepIds  = [];
     Widget rolesWid      = spacer;

     if( !screenOpened ) {
        assert( appState.ceVenture != {} );
        cev = appState.ceVenture[ screenArgs["id"] ] ?? CEVenture.empty();
        cevId   = cev.ceVentureId;
        assert( cevId != "-1" );

        // CEProjects
        cepIds = _getCEProjects( cevId );
        for( String cepId in cepIds ) {
           bool first = true;
           CEProject cep = appState.ceProject[ cepId ]!;
           assert( cep.ceVentureId == cevId );
           if( first ) { cepWid = [ _makeCEPLink( cep.name, cep.ceProjectId, namePreface: "   " )]; }
           else        { cepWid.add( _makeCEPLink( cep.name, cep.ceProjectId, namePreface: "   " )); }
           first = false;
        }

        // XXX can get from CEV now
        // CEProject Collabs
        List<HostAccount> collabs = [];
        for( String ceuid in appState.ceHostAccounts.keys ) {
           assert( appState.ceHostAccounts[ceuid] != null );
           List<HostAccount> has = appState.ceHostAccounts[ceuid]!;
           for( String cepId in cepIds ) {
              for( HostAccount ha in has ) {
                 if( ha.hostPlatform == appState.ceProject[cepId]!.hostPlatform && ha.ceProjectIds.contains( cepId ) ) {
                    // XXX can double-add.. fix
                    collabs.add( ha );
                 }
              }
           }
        }
        rolesWid = _makeRoles( context, container, collabs, cev );
     }

     Widget ceProjects = 
        Column( 
           crossAxisAlignment: CrossAxisAlignment.start,
           mainAxisAlignment: MainAxisAlignment.start,
           children: <Widget>[
              makeHDivider( appState, textWidth, 1.0*appState.GAP_PAD, appState.GAP_PAD, tgap: appState.MID_PAD ),
              makeTitleText( appState, "CEProjects:", textWidth, false, 1, fontSize: 18 ),
              // makeTitleText( appState, "Current:", textWidth, false, 1 ),
              Column( 
                 crossAxisAlignment: CrossAxisAlignment.start,
                 mainAxisAlignment: MainAxisAlignment.start,
                 children: cepWid ),
              ]);
     
     Widget roles =
        Column( 
           crossAxisAlignment: CrossAxisAlignment.start,
           mainAxisAlignment: MainAxisAlignment.start,
           children: <Widget>[
              spacer,
              makeTitleText( appState, "Collaborator Roles within this Venture", 1.3*textWidth, false, 1, fontSize: 18 ),
              spacer,
              rolesWid,
              ]);

     return _makeCEBody( context, ceProjects, roles, cepIds ); 
     
  }
  
  
  Widget _makePersonBody( context, HostPlatforms hostPlat ) {
     assert( appState.cogUser != null );

     // aggressive, and without locking, failure for integration testing.
     // assert( appState.cogUser!.preferredUserName != null);

     final itsMe      = screenArgs["id"] == "";   // Is this profile for the logged in user?
     final textWidth  = lhsFrameMaxWidth - 2*appState.GAP_PAD - appState.TINY_PAD;
     final ceUserName = appState.cogUser!.preferredUserName == null ? "z" : appState.cogUser!.preferredUserName!;
     Widget? pi        = null;

     assert( ceUserName != null && ceUserName!.length > 0 );

     Person              cePeep     = Person.empty();
     Map<String, String> hostPeep   = {"userName": "", "id": ""};
     List<HostAccount>   hostAccs   = [];
     Widget              cepWid     = spacer;
     Widget              ppWid      = spacer;
     Widget              peqTable   = spacer;
     
     if( !screenOpened ) {
        assert( myself != null );
        cePeep = myself!;

        if( profileImage != null ) { pi   = profileImage!; }        
        hostAccs = itsMe ? appState.myHostAccounts : ( appState.ceHostAccounts[ screenArgs["id"] ] ?? [] );
        
        // CE Host User
        for( var ha in hostAccs ) {
           if( ha.hostPlatform == enumToStr( HostPlatforms.GitHub ) ) {
              if( ha.ceUserId == cePeep.id ) {
                 hostPeep["userName"] = ha.hostUserName;
                 hostPeep["id"]       = ha.hostUserId;
                 cepWid               = _makeCEPs( context, ha, textWidth );
                 ppWid                = _makePperCEP( context, ha, textWidth );
              }
           }
           else { print( "Host organization not recognized." ); }
        }
     }

     if( updatedPeqTable || collabPeqTable.length > 0) {
        peqTable = SizedBox(
           width: 2 * appState.MIN_PANE_WIDTH - appState.GAP_PAD ,
           child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.start,
              children: collabPeqTable ));

        updatedPeqTable = false;
     }

     if( pi == null ) { pi = _getProfImage( cePeep.userName, ceUserName ); }

     String hname = hostPeep["userName"] == "" ? "" : hostPeep["userName"]! + " (" + hostPeep["id"]! + ")";
     String cname = cePeep.userName == "" ? "" : cePeep.userName + " (" + cePeep.id + ")";
     return Wrap(
        children: [
           spacer, 
           Column( 
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.start,
              children: <Widget>[
                 spacer, 
                 pi,
                 makeTitleText( appState, cePeep.getFullName(), textWidth, false, 1, fontSize: 24 ),
                 makeTitleText( appState, cname, textWidth, false, 1 ),
                 makeTitleText( appState, cePeep.email, textWidth, false, 1 ),
                 miniSpacer,

                 itsMe ? 
                 Wrap( children: [ Container( width: appState.GAP_PAD ), 
                                   makeActionButtonFixed( appState, "Edit profile", lhsFrameMaxWidth / 2.0, () async {
                                         MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEEditPage(), settings: RouteSettings( arguments: screenArgs ));
                                         confirmedNav( context, container, newPage );
                                      }),
                                   makeActionButtonFixed( appState, 'Logout', lhsFrameMaxWidth / 2.0, _logout( context, appState) )                                                    
                          ])
                 :
                 Container( width: 1.0 ),
                 
                 makeHDivider( appState, textWidth, 2.0*appState.GAP_PAD, appState.GAP_PAD, tgap: appState.MID_PAD ),
                 makeTitleText( appState, "Open tasks:", textWidth, false, 1, fontSize: 18 ),
                 makeTitleText( appState, "   Agreements", textWidth, false, 1 ),
                 makeTitleText( appState, "   Approvals", textWidth, false, 1 ),
                 makeTitleText( appState, "PEQ summary per project:", textWidth, false, 1, fontSize: 18 ),
                 ppWid,
                 makeHDivider( appState, textWidth, 2.0*appState.GAP_PAD, appState.GAP_PAD, tgap: appState.MID_PAD ),
                 makeTitleText( appState,  enumToStr( hostPlat ) + " ID", textWidth, false, 1, fontSize: 18 ),
                 makeTitleText( appState, hname, textWidth, false, 1 ),
                 ]),
           spacer,            
           Column( 
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.start,
              children: <Widget>[
                 spacer,
                 makeTitleText( appState, cePeep.goesBy + (cePeep.goesBy == "" ? " " : "'s ") + "CodeEquity Projects", textWidth, false, 1, fontSize: 18 ),
                 spacer,
                 cepWid,
                 makeHDivider( appState, textWidth * 2.0, appState.GAP_PAD, appState.GAP_PAD, tgap: appState.MID_PAD ),
                 spacer,
                 peqTable,
                 ])
           ]);
  }

  Widget chooseProfile( BuildContext context, container, String? profType, HostPlatforms platform ) {
     if(      profType == "Person"    ) { return _makePersonBody( context, HostPlatforms.GitHub ); }
     else if( profType == "CEProject" ) { return _makeProjectBody( context ); }
     else if( profType == "CEVenture" ) { return _makeVentureBody( context, container ); }
     else                               { return spacer; }
  }

  @override
  Widget build(BuildContext context) {

      container = AppStateContainer.of(context);
      appState  = container.state;
      assert( appState != null );
      screenArgs = ModalRoute.of(context)!.settings.arguments as Map<String,String>;

      // print( "XXX " + screenArgs.toString() );
      
      lhsFrameMaxWidth = appState.MIN_PANE_WIDTH - appState.GAP_PAD;
      lhsFrameMinWidth = appState.MIN_PANE_WIDTH - 3*appState.GAP_PAD;
      rhsFrameMinWidth = appState.MIN_PANE_WIDTH - 3*appState.GAP_PAD;
      rhsFrameMaxWidth = appState.MAX_PANE_WIDTH - lhsFrameMaxWidth;      
      spacer           = Container( width: appState.GAP_PAD, height: appState.CELL_HEIGHT * .5 );
      miniSpacer       = Container( width: appState.GAP_PAD, height: appState.CELL_HEIGHT * .15 );
      vSpace           = Container( width: 1, height: appState!.CELL_HEIGHT * .5 );
      empty            = Container( width: 1, height: 1 );

      updatePerson( context, container );
      updateProjects( context, container, HostPlatforms.GitHub );
      
      return Scaffold(
         appBar: makeTopAppBar( context, "Profile" ),
         body: chooseProfile( context, container, screenArgs["profType"], HostPlatforms.GitHub )
         );
  }
}
