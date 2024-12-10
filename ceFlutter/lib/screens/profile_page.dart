import 'dart:math';
import 'dart:convert';  // json encode/decode
import 'package:flutter/material.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/awsUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/Person.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/HostAccount.dart';
import 'package:ceFlutter/models/EquityPlan.dart';
import 'package:ceFlutter/models/PEQSummary.dart';

import 'package:ceFlutter/customLetters.dart';

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
   late Widget spacer;
     
   late Person?           myself;
   late List<CEProject>   ceProjects;
   late List<HostAccount> hostAccounts;  // specific to 1 user
   late List<HostAccount> hostUsers;     // specific to 1 platform
   late List<Person>      cePeople;  
   late EquityPlan?       equityPlan;
   late PEQSummary?       peqSummary;
   
   late bool screenOpened;
   
  @override
  void initState() {
      super.initState();
      screenOpened = true;
      print( "Screen Opened" );
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


  // Need projects for full profile.
  // NOTE: userName is displayed, but selected value is the id.
  void updatePerson( context, container ) async {
     if( screenOpened && screenArgs["profType"] == "Person" ) {
        assert( screenArgs["id"] != null );
        String profId = screenArgs["id"]!;
        print( "selected profile is signed in? " + ( profId == "" ).toString() );
        String query = '{ "Endpoint": "GetHostA", "CEUserId": "$profId" }';
        var futs = await Future.wait([
                                        profId == "" ? fetchSignedInPerson( context, container ) : fetchAPerson( context, container, profId ),
                                        fetchCEProjects( context, container ).then( (p) => ceProjects = p ),
                                        fetchHostAcct( context, container, query ).then( (p) => hostAccounts = p )
                                        ]);
        print( "Done fetching" );
        assert( futs.length == 3 );
        myself = new Person.from( futs[0] );
        
        assert( myself != null );
        assert( appState.cogUser != null );
        if( myself!.userName != appState.cogUser!.preferredUserName ) { print( "NOTE!  Profile is not for " + myself!.userName ); }
         // need setState to trigger makeBody else blank info
         setState(() => screenOpened = false );
     }
  }

  // XXX Platform GitHub
  // XXX there is no need to get all this data - can reduce amount xferred
  void updateProjects( context, container ) async {
     
     if( screenOpened  && screenArgs["profType"] == "CEProject" ) {
        assert( screenArgs["id"] != null );

        var postDataPS = {};
        postDataPS['EquityPlanId'] = screenArgs["id"];
        final pd = { "Endpoint": "GetEntry", "tableName": "CEEquityPlan", "query": postDataPS };

        postDataPS = {};
        postDataPS['PEQSummaryId'] = screenArgs["id"];
        final pdps = { "Endpoint": "GetEntry", "tableName": "CEPEQSummary", "query": postDataPS };
        
        await Future.wait([
                             fetchCEProjects( context, container ).then(                    (p) => ceProjects = p ),
                             fetchHostUser( context, container, "GitHub" ).then(            (p) => hostUsers = p ),
                             fetchCEPeople( context, container ).then(                      (p) => cePeople = p ),
                             fetchEquityPlan( context, container, json.encode( pd ) ).then( (p) => equityPlan = p ),
                             fetchPEQSummary( context, container, json.encode( pdps )).then((p) => peqSummary = p ),
                             ]);
        
        // need setState to trigger makeBody else blank info
        setState(() => screenOpened = false );
     }
  }

  Widget _makeProjCard( context, String cepId, textWidth ) {
     void _setTitle( PointerEvent event ) {
        setState(() => appState.hoverChunk = cepId );
     }
     void _unsetTitle( PointerEvent event ) {
        setState(() => appState.hoverChunk = "" );
     }

     CEProject cep = ceProjects.firstWhere( (c) => c.ceProjectId == cepId );
     final miniSpacer = Container( width: appState.GAP_PAD, height: appState.CELL_HEIGHT * .15 );

     Widget cepLink = GestureDetector(
        onTap: () async
        {
           Map<String,String> screenArgs = {"id": cepId, "profType": "CEProject" };
           MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEProfilePage(), settings: RouteSettings( arguments: screenArgs ));
           Navigator.push( context, newPage );
        },
        child: makeActionableText( appState, cepId, cepId, _setTitle, _unsetTitle, textWidth, false, 1 ),
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
                 makeTitleText( appState, "Organization: " + cep.organization, textWidth, false, 1, fontSize: 14 ),
                 miniSpacer,
                 makeTitleText( appState, cep.ceProjectComponent + ", " + cep.description, textWidth, false, 1, fontSize: 12 ),
                 ]
              )
           ),
        );
     return card;
  }

  Widget _makeCollabCard( context, HostAccount ha, textWidth, maxProjCount ) {
     String ceUserId = ha.ceUserId;
     // print( ceUserId + " " + cePeople.toString() );
     Person cePeep   = cePeople.firstWhere( (p) => p.id == ceUserId );
     assert( cePeep != null );

     String ceName = cePeep.firstName + " " + cePeep.lastName;
     // Person
     void _setTitle( PointerEvent event ) {
        setState(() => appState.hoverChunk = ceUserId );
     }
     void _unsetTitle( PointerEvent event ) {
        setState(() => appState.hoverChunk = "" );
     }

     Widget collabLink = GestureDetector(
        onTap: () async
        {
           Map<String,String> screenArgs = {"id": ceUserId, "profType": "Person" };
           MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEProfilePage(), settings: RouteSettings( arguments: screenArgs ));
           Navigator.push( context, newPage );
        },
        // If just use ceName, all same name collabs are highlighted.
        child: makeActionableText( appState, ceName, ceUserId, _setTitle, _unsetTitle, textWidth, false, 1 ),
        );

     Widget makeCEPLink( cepId ){
        // Project
        void _set( PointerEvent event ) {
           setState(() => appState.hoverChunk = cepId+ceUserId );
        }
        void _unset( PointerEvent event ) {
           setState(() => appState.hoverChunk = "" );
        }
        
        return GestureDetector( 
        onTap: () async
        {
           Map<String,String> screenArgs = {"id": cepId, "profType": "CEProject" };
           MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEProfilePage(), settings: RouteSettings( arguments: screenArgs ));
           Navigator.push( context, newPage );
        },
        child: makeActionableText( appState, "   " + cepId, cepId+ceUserId, _set, _unset, textWidth, false, 1 ),
        );
     }

     Widget ceProjs = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.start,
        children: ha.ceProjectIds.map( (cepId) => makeCEPLink( cepId ) ).toList()
        );

     Widget card = Card.outlined(
        child: ConstrainedBox(
           constraints: BoxConstraints( minHeight: 2.5*appState.CELL_HEIGHT, maxHeight: 3.2*appState.CELL_HEIGHT, maxWidth: appState.MIN_PANE_WIDTH - appState.GAP_PAD ),
           child: ListView(
              scrollDirection: Axis.vertical,
              children: [
                 collabLink,
                 makeTitleText( appState, cePeep.userName + " (" + ceUserId + ")", textWidth, false, 1 ),
                 makeTitleText( appState, "CE Project member: " , textWidth, false, 1 ),
                 ceProjs,
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


  // accrued, tasked out, untasked,total allocated
  Widget _makeProjectBody( context ) {
     final textWidth  = lhsFrameMaxWidth - 1.0*appState.GAP_PAD - appState.TINY_PAD;
     final spacer     = Container( width: appState.GAP_PAD, height: appState.CELL_HEIGHT * .5 );
     final miniSpacer = Container( width: appState.GAP_PAD, height: appState.CELL_HEIGHT * .15 );

     List<Widget> repoWid = [spacer];
     Widget collabWid     = spacer;
     CEProject cep        = new CEProject( ceProjectId: "A", ceProjectComponent: "", description: "", hostPlatform: "", organization: "",
                                           ownerCategory: "", projectMgmtSys: "", repositories: [] );
     String cepName       = cep.ceProjectId;
     EquityPlan ep        = new EquityPlan( ceProjectId: screenArgs["id"]!, categories: [], amounts: [], hostNames: [], totalAllocation: 0, lastMod: "" );
     PEQSummary psum      = new PEQSummary( ceProjectId: screenArgs["id"]!, targetType: "", targetId: "", lastMod: "",  accruedTot: 0, taskedTot: 0, allocations: {}, jsonAllocs: [] );
        
     assert( cepName != null && cepName!.length > 0 );
     var profileImage = cepName![0].toLowerCase() + "Grad.png"; 

     if( !screenOpened ) {
        assert( ceProjects != null );
        cep = ceProjects.firstWhere( (c) => c.ceProjectId == screenArgs["id"] );
        assert( cep != null );
        cepName   = cep.ceProjectId;        
        profileImage = cepName![0].toLowerCase() + "Grad.png";         
        
        if( equityPlan != null ) { ep = equityPlan!; }
        if( peqSummary != null ) { psum = peqSummary!; }

        // CEProject repos
        for( int i = 0; i < cep.repositories.length; i++ ) {
           if( i == 0 ) { repoWid = [ makeTitleText( appState, "   " + cep.repositories[i], textWidth, false, 1 ) ]; }
           else         { repoWid.add( makeTitleText( appState, "   " + cep.repositories[i], textWidth, false, 1 )); }
        }

        // CEProject Collabs
        List<HostAccount> collabs = [];
        for( int i = 0; i < hostUsers.length; i++ ) {
           HostAccount ha = hostUsers[i];
           if( ha.ceProjectIds.contains( cepName ) ) {
              collabs.add( ha );
           }
        }
        collabWid = _makeCollabs( context, collabs, textWidth );

     }

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
                 Image.asset( "images/"+profileImage,
                              width: lhsFrameMaxWidth,
                              color: Colors.grey.withOpacity(0.05),
                              colorBlendMode: BlendMode.darken ),
                 makeTitleText( appState, cep.ceProjectId, textWidth * 1.1, false, 1, fontSize: 24 ),
                 makeTitleText( appState, cep.ceProjectComponent, textWidth, false, 1 ),
                 makeTitleText( appState, cep.description, textWidth, false, 1 ),
                 makeTitleText( appState, "Organization: " + cep.organization, textWidth, false, 1, fontSize: 14 ),
                 miniSpacer,
                 Wrap( children: [ Container( width: appState.GAP_PAD ), 
                                   makeActionButtonFixed( appState, "Edit profile", lhsFrameMaxWidth / 2.0, () async { notYetImplemented(context); }),
                                   Container( width: lhsFrameMaxWidth / 2.0 ), 
                          ]),
                 makeHDivider( appState, textWidth, 1.0*appState.GAP_PAD, appState.GAP_PAD, tgap: appState.MID_PAD ),
                 makeToolTip( makeTitleText( appState, "PEQs:", textWidth, false, 1, fontSize: 14 ),"Provisional EQuity, see https://github.com/codeequity/codeEquity", wait: true ),
                 Table(
                    defaultColumnWidth: FixedColumnWidth( 2.0 * textWidth / 3.0 ),
                    defaultVerticalAlignment: TableCellVerticalAlignment.middle,
                    children: <TableRow>[
                       TableRow(
                          children: <Widget>[
                             makeTitleText( appState, "    Accrued: ", textWidth, false, 1, fontSize: 14 ),
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
                 makeHDivider( appState, textWidth, 1.0*appState.GAP_PAD, appState.GAP_PAD, tgap: appState.MID_PAD ),
                 makeTitleText( appState, "Host Platform: " + cep.hostPlatform, textWidth, false, 1, fontSize: 18 ),
                 makeTitleText( appState, "Project management system:" , textWidth, false, 1 ),
                 makeTitleText( appState, "  " + cep.projectMgmtSys , textWidth, false, 1 ),
                 makeTitleText( appState, "Repositories:", textWidth, false, 1 ),
                 Column( 
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.start,
                    children: repoWid ),
                 ]),
           spacer,            
           Column( 
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.start,
              children: <Widget>[
                 spacer,
                 makeTitleText( appState, "Collaborators", textWidth, false, 1, fontSize: 18 ),
                 spacer,
                 collabWid
                 ]),
           ]
        );
  }
     
  Widget _makePersonBody( context ) {
     assert( appState.cogUser != null );

     // aggressive, and without locking, failure for integration testing.
     // assert( appState.cogUser!.preferredUserName != null);

     // final textWidth  = min( lhsFrameMaxWidth - 2*appState.GAP_PAD - appState.TINY_PAD, appState.screenWidth * .15 );   // no bigger than fixed LHS pane width
     final textWidth  = lhsFrameMaxWidth - 2*appState.GAP_PAD - appState.TINY_PAD;
     final spacer     = Container( width: appState.GAP_PAD, height: appState.CELL_HEIGHT * .5 );
     final miniSpacer = Container( width: appState.GAP_PAD, height: appState.CELL_HEIGHT * .15 );
     final ceUserName = appState.cogUser!.preferredUserName == null ? "z" : appState.cogUser!.preferredUserName!;

     assert( ceUserName != null && ceUserName!.length > 0 );
     var profileImage = ceUserName![0] + "Grad.png"; 

     Person              cePeep     = new Person( id: "", firstName: "", lastName: "", userName: "", email: "", locked: false, imagePng: null, image: null );
     Map<String, String> hostPeep   = {"userName": "", "id": ""};
     List<HostAccount>   hostAccs   = [];
     Widget              cepWid     = spacer;
     
     if( !screenOpened ) {
        assert( myself != null );
        cePeep = myself!;
        profileImage = cePeep.userName[0].toLowerCase() + "Grad.png";         
        hostAccs = screenArgs["id"] == "" ? appState.myHostAccounts : hostAccounts;
        
        // CE Host User
        for( var ha in hostAccs ) {
           if( ha.hostPlatform == "GitHub" ) {      // XXX formalize
              if( ha.ceUserId == cePeep.id ) {
                 hostPeep["userName"] = ha.hostUserName;
                 hostPeep["id"]       = ha.hostUserId;
                 cepWid               = _makeCEPs( context, ha, textWidth ); 
              }
           }
        }
     }
     
     return Wrap(
        children: [
           spacer, 
           Column( 
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.start,
              children: <Widget>[
                 spacer, 
                 Image.asset( "images/"+profileImage,
                              width: lhsFrameMaxWidth,
                              color: Colors.grey.withOpacity(0.05),
                              colorBlendMode: BlendMode.darken ),
                 makeTitleText( appState, cePeep.firstName + " " + cePeep.lastName, textWidth, false, 1, fontSize: 24 ),
                 makeTitleText( appState, cePeep.userName + " (" + cePeep.id + ")", textWidth, false, 1 ),
                 makeTitleText( appState, cePeep.email, textWidth, false, 1 ),
                 miniSpacer,
                 Wrap( children: [ Container( width: appState.GAP_PAD ), 
                                   makeActionButtonFixed( appState, "Edit profile", lhsFrameMaxWidth / 2.0, () async { notYetImplemented(context); }),
                                   makeActionButtonFixed( appState, 'Logout', lhsFrameMaxWidth / 2.0, _logout( context, appState) )                                                    
                          ]),
                 makeHDivider( appState, textWidth, 2.0*appState.GAP_PAD, appState.GAP_PAD, tgap: appState.MID_PAD ),
                 makeTitleText( appState, "GitHub ID", textWidth, false, 1, fontSize: 18 ),
                 makeTitleText( appState, hostPeep["userName"]! + " (" + hostPeep["id"]! + ")", textWidth, false, 1 ),
                 ]),
           spacer,            
           Column( 
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.start,
              children: <Widget>[
                 spacer,
                 makeTitleText( appState, cePeep.firstName + "'s CodeEquity Projects", textWidth, false, 1, fontSize: 18 ),
                 spacer,
                 cepWid,
                 spacer,
                 // makeActionButtonSmall( appState, 'Logout', _logout( context, appState) )                 
                 ]),
           ]
        );
  }


  @override
  Widget build(BuildContext context) {

      container = AppStateContainer.of(context);
      appState  = container.state;
      assert( appState != null );
      screenArgs = ModalRoute.of(context)!.settings.arguments as Map<String,String>;

      lhsFrameMaxWidth = appState.MIN_PANE_WIDTH - appState.GAP_PAD;
      lhsFrameMinWidth = appState.MIN_PANE_WIDTH - 3*appState.GAP_PAD;
      rhsFrameMinWidth = appState.MIN_PANE_WIDTH - 3*appState.GAP_PAD;
      spacer           = Container( width: appState.GAP_PAD, height: appState.CELL_HEIGHT * .5 );
      
      updatePerson( context, container );
      updateProjects( context, container );
      
      return Scaffold(
         appBar: makeTopAppBar( context, "Profile" ),
         body: screenArgs["profType"] == "Person" ? _makePersonBody( context ) : _makeProjectBody( context )
         );
  }
}
