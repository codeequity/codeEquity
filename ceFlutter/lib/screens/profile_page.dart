import 'dart:math';
import 'package:flutter/material.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/awsUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/Person.dart';
import 'package:ceFlutter/models/HostAccount.dart';

import 'package:ceFlutter/customLetters.dart';

class CEProfilePage extends StatefulWidget {
  CEProfilePage({Key? key}) : super(key: key);

  @override
  _CEProfileState createState() => _CEProfileState();

}


class _CEProfileState extends State<CEProfilePage> {

   TextStyle style = TextStyle(fontFamily: 'Montserrat', fontSize: 20.0);
   late var      container;
   late AppState appState; 
   
   late double lhsFrameMinWidth;
   late double lhsFrameMaxWidth;
   late double rhsFrameMinWidth;
   late Widget spacer;

     
   late Person? myself; 
   
  @override
      void initState() {
      super.initState();
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

  void updatePerson( context, container ) async {
     if( appState.loadPerson ) {
        myself = await fetchSignedInPerson( context, container );
        assert( myself != null );
        assert( appState.cogUser != null );
        if( myself!.userName != appState.cogUser!.preferredUserName ) { print( "NOTE!  Profile is not for " + myself!.userName ); }
        setState(() => appState.loadPerson = false );
     }
  }


  Widget _makeProjCard( context, String cep, textWidth ) {
     void _setTitle( PointerEvent event ) {
        setState(() => appState.hoverChunk = cep );
     }
     void _unsetTitle( PointerEvent event ) {
        setState(() => appState.hoverChunk = "" );
     }
     
     Widget card = Card.outlined(
        child: SizedBox(
           width: appState.MIN_PANE_WIDTH - appState.GAP_PAD,
           height: 2.0*appState.CELL_HEIGHT,
           child: makeActionableText( appState, cep, _setTitle, _unsetTitle, textWidth, false, 1 ),
           ),
        );
     return card;
  }
  
  Widget _makeCEPs( context, HostAccount ha, textWidth ) {
     List<Widget> ceps = [];
     
     print( "Making " + ha.ceProjectIds.toString() );
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

  
  // XXX appState.selectedUser for this page needs to be set (without triggering pactDetail)
  //     if selectedUser == cogUser, can see privates.  like ... ... ?
  // XXX when signin, or click on user GD, load gets set to true.  when you click out, set again back to ceUser
  Widget _makeBody( context ) {
     assert( appState.cogUser != null && appState.cogUser!.preferredUserName != null);
     // final textWidth  = min( lhsFrameMaxWidth - 2*appState.GAP_PAD - appState.TINY_PAD, appState.screenWidth * .15 );   // no bigger than fixed LHS pane width
     final textWidth  = lhsFrameMaxWidth - 2*appState.GAP_PAD - appState.TINY_PAD;
     final spacer     = Container( width: appState.GAP_PAD, height: appState.CELL_HEIGHT * .5 );
     final miniSpacer = Container( width: appState.GAP_PAD, height: appState.CELL_HEIGHT * .15 );
     final ceUserName = appState.cogUser!.preferredUserName!;

     assert( ceUserName != null && ceUserName!.length > 0 );
     final profileImage = ceUserName![0] + "Grad.png"; 

     Person              cePeep     = new Person( id: "", firstName: "", lastName: "", userName: "", email: "", locked: false, imagePng: null, image: null );
     Map<String, String> hostPeep   = {"userName": "", "id": ""};
     Widget              ceProjects = spacer;
     
     if( !appState.loadPerson ) {
        assert( myself != null );
        cePeep = myself!;
        // print( myself!.toString() );
        
        // CE Host User
        for( var ha in appState.myHostAccounts ) {
           if( ha.hostPlatform == "GitHub" ) {      // XXX formalize
              if( ha.ceUserId == cePeep.id ) {
                 hostPeep["userName"] = ha.hostUserName;
                 hostPeep["id"]       = ha.hostUserId;
                 ceProjects           = _makeCEPs( context, ha, textWidth ); 
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
                                   makeActionButtonFixed( appState, "Edit profile", lhsFrameMaxWidth, () async { notYetImplemented(context); }),
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
                 ceProjects,
                 spacer,
                 makeActionButtonSmall( appState, 'Signout', _logout( context, appState) )                 
                 ]),
           ]
        );
  }


  @override
  Widget build(BuildContext context) {

      container = AppStateContainer.of(context);
      appState  = container.state;
      assert( appState != null );

      lhsFrameMaxWidth = appState.MIN_PANE_WIDTH - appState.GAP_PAD;
      lhsFrameMinWidth = appState.MIN_PANE_WIDTH - 3*appState.GAP_PAD;
      rhsFrameMinWidth = appState.MIN_PANE_WIDTH - 3*appState.GAP_PAD;
      spacer           = Container( width: appState.GAP_PAD, height: appState.CELL_HEIGHT * .5 );
      
      // print("Profile page");
      updatePerson( context, container );
      
      return Scaffold(
         appBar: makeTopAppBar( context, "Profile" ),
         body: _makeBody( context )
         );
  }
}
