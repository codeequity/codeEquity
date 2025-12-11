import 'dart:ui';       // pointerKinds
import 'dart:convert';  // json encode/decode

import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/CEVenture.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/Person.dart';

// XXX move to WidgetUtils?
// Workaround breaking change 5/2021
// https://flutter.dev/docs/release/breaking-changes/default-scroll-behavior-drag
class MyCustomScrollBehavior extends MaterialScrollBehavior {
  // Override behavior methods and getters like dragDevices
  @override
  Set<PointerDeviceKind> get dragDevices => { 
    PointerDeviceKind.touch,
    PointerDeviceKind.mouse,
  };
}


class CEApprovalFrame extends StatefulWidget {
   final frameHeightUsed;
   var   appContainer;

   // Keep size of headers for approvals frame view.  Use this for key indexing
   late int headerTop; 

   CEApprovalFrame(
      {Key? key,
            this.appContainer,
            this.frameHeightUsed
            } ) : super(key: key);

  @override
  _CEApprovalState createState() => _CEApprovalState();

}


class _CEApprovalState extends State<CEApprovalFrame> {

   late var      container;
   late AppState appState;

   final listHeaders = ["Issue Title", "Host Project", "PEQ", "Assignee(s)", "Action" ];

   late double frameMinWidth;
   late double svWidth;
   late double svHeight;
   static const frameMinHeight = 300;
   
   late bool     peqsLoaded;

   late Widget empty;  // XXX formalize
   late Widget gapPad;
   late Widget fatPad;
   late Widget midPad;
   late Widget hdiv;
   late Widget vSpace; 
   
   @override
   void initState() {
      super.initState();
      peqsLoaded = false;
   }

   @override
   void dispose() {
      super.dispose();
   }

   // XXX
   int getPendingCount() { return 0; }

   List<List<Widget>> _getHeader ( cepName ) {
      final width = ( frameMinWidth - 2*appState.FAT_PAD ) / 2.0;
      final buttonWidth = 100;
      
      List<List<Widget>> header = [];
      
      Widget spacer    = Container( height: 1, width: (svWidth - cepName.length - 2*buttonWidth )/2.0 );
      Widget miniSpace = Container( height: 1, width: 6 * appState.GAP_PAD );
      Widget title     = makeIWTitleText( appState, cepName , false, 1, fontSize: 18 );

      String expl1 = "Click ACCEPT to Accrue the issue, permanently splitting and granting the PEQs to the Assignees.";
      String expl2 = "Click REJECT to indicate there is more to be done on this task, first.";

      Widget e1 = makeIWTitleText( appState, expl1, false, 1 );
      Widget e2 = makeIWTitleText( appState, expl2, false, 1 );
      
      header.add( [ Container( height: appState.MID_PAD ), empty, empty, empty, empty ] );
      header.add( [ spacer, title, empty, empty, empty ] );
      header.add( [ miniSpace, e1, empty, empty, empty ] );
      header.add( [ miniSpace, e2, empty, empty, empty ] );
      // header.add( [ empty, empty, empty, empty, empty ] );
      // header.add( [ hdiv, empty, empty, empty, empty ] );
      
      Widget row0 = Container( width: 1.5*width, child: makeTableText( appState, listHeaders[0], width, appState!.CELL_HEIGHT, false, 1 ) );
      Widget row1 = Container( width: 1.2*width, child: makeTableText( appState, listHeaders[1], width, appState!.CELL_HEIGHT, false, 1 ) );
      Widget row2 = Container( width: 0.6*width, child: makeTableText( appState, listHeaders[2], width, appState!.CELL_HEIGHT, false, 1 ) );
      Widget row3 = Container( width: 1.8*width, child: makeTableText( appState, listHeaders[3], width, appState!.CELL_HEIGHT, false, 1 ) );
      Widget row4 = Container( width: 1.0*width, child: makeTableText( appState, listHeaders[4], width, appState!.CELL_HEIGHT, false, 1 ) );
      
      header.add( [ vSpace, vSpace, vSpace, vSpace, vSpace ] );
      header.add( [ row0, row1, row2, row3, row4 ] );
      header.add( [ hdiv, empty, empty, empty, empty ] );

      widget.headerTop = header.length; 
      return header;
   }

   void _loadPeqs() async {
      // get all CEPS the currently logged-in user is connected to.  
      if( !appState.gotUserPeqs )
      {
         await updateUserPeqs( container, context, getAll: true );
         setState(() => peqsLoaded = true );
      }
      
   }

   void _confirmReject( TextEditingController reason ) {
      print( "confirm reject" );
      Navigator.of( context ).pop();
   }
   
   void _cancelReject( TextEditingController reason ) {
      print( "cancel reject" );
      Navigator.of( context ).pop();
   }
   
   Widget getActions( PEQ p ) {
      Widget lead = makeIWTitleText( appState, "Accept?   ", false, 1 );

      bool canGrant  = getUserAuth( container ).index <= MemberRole.Grantor.index;
      String failMsg = "Can not accept or reject Pending PEQs, insufficient permissions.";

      Widget accept = GestureDetector(
         onTap: () async 
         {
            if( canGrant ) {
               print( "Accepted " + p.hostIssueTitle );
               // XXX Send GH action
               // XXX ingest,
               // XXX update view button no longer grey
            }
            else { showToast( failMsg ); }
         },
         key: Key( 'accept ' + p.id ),
         child: makeToolTip( Icon( Icons.check_circle_outline, color: Colors.green ), "Accrue this issue, evenly splitting PEQ between assignees", wait: true )
         );

      Widget reject = GestureDetector(
         onTap: () async 
         {
            if( canGrant ) {
               print( "Rejected " + p.hostIssueTitle );
               TextEditingController reason = new TextEditingController();
               String popupTitle = "Reject accrual request";
               String hintText   = "Integration tests are failing";
               await editBox( context, appState, svWidth / 2.0, popupTitle, "Reason", reason, hintText, () => _confirmReject( reason ), () => _cancelReject( reason ) );
            }
            else { showToast( failMsg ); }
         },
         key: Key( 'reject ' + p.id ),
         child: makeToolTip( Icon( Icons.cancel_outlined, color: Colors.red ), "Reject, with feedback on what is missing", wait: true )
         );

      Widget more = GestureDetector(
         onTap: () async 
         {
            print( "More detail " + p.hostIssueTitle );
            // XXX need popup from GH
         },
         key: Key( 'more ' + p.id ),
         child: makeToolTip( Icon( Icons.more_horiz ), "Review issue details", wait: true )
         );
      
      return Wrap( spacing: appState.TINY_PAD, children: [ lead, accept, reject, more ] );
   }
   
   List<List<Widget>> _getBody() {

      final width = ( frameMinWidth - 2*appState.FAT_PAD ) / 2.0;  // XXX 2x

      List<List<Widget>> body = [];

      // get all CEPS the currently logged-in user is connected to.  
      if( !peqsLoaded )
      {
         Widget spacer  = Container( height: 1, width: (svWidth - 2.0*appState.BASE_TXT_HEIGHT )/2.0 );
         final spinSize = 1.8*appState.BASE_TXT_HEIGHT;         
         Widget spin = Container( width: spinSize, height: spinSize, child: CircularProgressIndicator());
         
         body.add( [ vSpace, empty, empty, empty, empty ]);
         body.add( [ spacer, empty, spin, empty, empty ] );
         body.add( [ vSpace, empty, empty, empty, empty ]);
      }
      else {
         print( "Get body churning" );
         
         // filter for selected CEP
         Map<String, PEQ> pend = {};
         for( final upeqs in appState.userPeqs.values ) {
            for( final peq in upeqs ) {
               if( pend[ peq.id ] == null && peq.peqType == PeqType.pending ) {
                  pend[ peq.id ] = peq;
               }
            }
         }

         // XXX title should be actionable, same as more detail
         // print( "Pending: " + pend.toString() );
         for( final p in pend.values ) {
            List<String> userNames = p.ceHolderId.map( (ceuid) {
                  assert( appState.cePeople[ceuid] != null );
                  return appState.cePeople[ceuid]!.userName;
               }).toList();

            assert( p.hostProjectSub.length >= 2 );
            Widget title   = Container( width: 1.5*width, child: makeTableText( appState, p.hostIssueTitle, width, appState!.CELL_HEIGHT, false, 1 ));
            Widget hproj   = Container( width: 1.2*width, child: makeTableText( appState, p.hostProjectSub[ p.hostProjectSub.length - 2 ], width, appState!.CELL_HEIGHT, false, 1 ));
            Widget peqVal  = Container( width: 0.6*width, child: makeTableText( appState, p.amount.toString(), width, appState!.CELL_HEIGHT, false, 1 ));
            Widget assign  = Container( width: 1.8*width, child: makeTableText( appState, userNames.toString(), width, appState!.CELL_HEIGHT, false, 1 ));
            Widget actions = getActions( p );
            
            body.add( [ title, hproj, peqVal, assign, actions ] );
         }
      }
      return body;
   }
   
   Widget getPending( context ) {

      CEProject? cep = appState.ceProject[ appState.selectedCEProject ];
      if( cep == null ) { return makeTitleText( appState, "First choose Project from home screen.", 8*appState.CELL_HEIGHT, false, 1, fontSize: 16); }

      _loadPeqs();
      
      List<List<Widget>> pending = [];

      pending.addAll( _getHeader( cep!.name ) );

      pending.addAll( _getBody( ) );

      return ScrollConfiguration(
         behavior: MyCustomScrollBehavior(),
         child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
               height: svHeight,
               width: svWidth,
               child: ListView(
                  children: List.generate(
                     pending.length,
                     (indexX) => Row(
                        key: Key( 'pending ' + ( indexX - widget.headerTop ).toString() ),                           
                        children: List.generate( 
                           pending[0].length,
                           (indexY) => pending[indexX][indexY] ))
                     )))));

   }
   
   @override
   Widget build(BuildContext context) {

      container = widget.appContainer;   
      appState  = container.state;
      assert( appState != null );

      frameMinWidth  = appState.MIN_PANE_WIDTH;
      svHeight       = ( appState.screenHeight - widget.frameHeightUsed ) * .9;
      svWidth        = appState.MAX_PANE_WIDTH; 

      empty     = Container( width: 1, height: 1 );
      gapPad    = Container( width: appState.GAP_PAD*2.0, height: 1 );
      fatPad    = Container( width: appState.FAT_PAD, height: 1 );
      midPad    = Container( width: appState.MID_PAD, height: 1 );
      vSpace    = Container( width: 1, height: appState!.CELL_HEIGHT * .5 );

      Widget hd = makeHDivider( appState, svWidth - 2*appState.GAP_PAD, appState.TINY_PAD, appState.TINY_PAD, tgap: appState.TINY_PAD, bgap: appState.TINY_PAD );
      hdiv      = Wrap( spacing: 0, children: [fatPad, hd] );   


      if( appState.gotUserPeqs )   { peqsLoaded = true; }
      if( appState.verbose >= 2 ) { print( "APPROVAL BUILD. " + peqsLoaded.toString() ); }
      
      return getPending( context );
   }
}
