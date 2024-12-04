import 'dart:math';
import 'package:flutter/material.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/awsUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/Person.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/HostAccount.dart';

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
  void updateProjects( context, container ) async {
     if( screenOpened  && screenArgs["profType"] == "CEProject" ) {
        await Future.wait([
                             
                             fetchCEProjects( context, container ).then( (p) => ceProjects = p ),
                             fetchHostUser( context, container, "GitHub" ).then( (p) => hostUsers = p )
                             ]);
        
        print( "profile for " + ceProjects.toString() );
        print( hostUsers.toString() );
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
          
     Widget card = Card.outlined(
        child: SizedBox(
           width: appState.MIN_PANE_WIDTH - appState.GAP_PAD,
           height: 2.0*appState.CELL_HEIGHT,
           child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.start,
              children: [
                 makeActionableText( appState, cepId, _setTitle, _unsetTitle, textWidth, false, 1 ),
                 makeTitleText( appState, "Organization: " + cep.organization, textWidth, false, 1, fontSize: 14 ),
                 miniSpacer,
                 makeTitleText( appState, cep.ceProjectComponent + ", " + cep.description, textWidth, false, 1, fontSize: 12 ),
                 ]
              )
           ),
        );
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

  Widget _makeProjectBody( context ) {
     final textWidth  = lhsFrameMaxWidth - 2*appState.GAP_PAD - appState.TINY_PAD;
     final spacer     = Container( width: appState.GAP_PAD, height: appState.CELL_HEIGHT * .5 );
     final miniSpacer = Container( width: appState.GAP_PAD, height: appState.CELL_HEIGHT * .15 );

     List<Widget> repoWid = [spacer];
     Widget collabWid     = spacer;
     CEProject cep = new CEProject( ceProjectId: "A", ceProjectComponent: "", description: "", hostPlatform: "", organization: "",
                                    ownerCategory: "", projectMgmtSys: "", repositories: [] );
     String cepName   = cep.ceProjectId;

     print( cep.toString() );
        
     assert( cepName != null && cepName!.length > 0 );
     var profileImage = cepName![0].toLowerCase() + "Grad.png"; 

     if( !screenOpened ) {
        assert( ceProjects != null );
        cep  = ceProjects.firstWhere( (c) => c.ceProjectId == screenArgs["id"] );
        assert( cep != null );
        cepName   = cep.ceProjectId;        
        profileImage = cepName![0].toLowerCase() + "Grad.png";         
        
        // CEProject repos
        for( int i = 0; i < cep.repositories.length; i++ ) {
           if( i == 0 ) { repoWid = [ makeTitleText( appState, cep.repositories[i], textWidth, false, 1 ) ]; }
           else         { repoWid.add( makeTitleText( appState, cep.repositories[i], textWidth, false, 1 )); }
        }

        // CEProject Collabs
        List<Widget> cWid = [];
        for( int i = 0; i < hostUsers.length; i++ ) {
           HostAccount ha = hostUsers[i];
           if( ha.ceProjectIds.contains( cepName ) ) {
              cWid.add( makeTitleText( appState, ha.hostUserName, textWidth, false, 1 ) );
           }
        }
        collabWid = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.start,
        children: cWid
        );
        
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
                 makeTitleText( appState, cep.ceProjectId, textWidth, false, 1, fontSize: 24 ),
                 makeTitleText( appState, cep.ceProjectComponent + " " + cep.description, textWidth, false, 1 ),
                 makeTitleText( appState, "Organization: " + cep.organization, textWidth, false, 1 ),
                 makeTitleText( appState, "Host project management system: " + cep.projectMgmtSys, textWidth, false, 1 ),
                 miniSpacer,
                 makeHDivider( appState, textWidth, 2.0*appState.GAP_PAD, appState.GAP_PAD, tgap: appState.MID_PAD ),
                 makeTitleText( appState, "Host Repositories:", textWidth, false, 1, fontSize: 18 ),
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
     assert( appState.cogUser != null && appState.cogUser!.preferredUserName != null);
     // final textWidth  = min( lhsFrameMaxWidth - 2*appState.GAP_PAD - appState.TINY_PAD, appState.screenWidth * .15 );   // no bigger than fixed LHS pane width
     final textWidth  = lhsFrameMaxWidth - 2*appState.GAP_PAD - appState.TINY_PAD;
     final spacer     = Container( width: appState.GAP_PAD, height: appState.CELL_HEIGHT * .5 );
     final miniSpacer = Container( width: appState.GAP_PAD, height: appState.CELL_HEIGHT * .15 );
     final ceUserName = appState.cogUser!.preferredUserName!;

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
      print( "Screen args: " + screenArgs.toString() );

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
