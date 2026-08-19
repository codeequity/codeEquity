import 'dart:ui';       // pointerKinds

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

class CECollabFrame extends StatefulWidget {
   final frameHeightUsed;
   var   appContainer;

   // Keep size of headers for frame view.  Use this for key indexing
   late int headerTop; 

   CECollabFrame(
      {Key? key,
            this.appContainer,
            this.frameHeightUsed
            } ) : super(key: key);

  @override
  _CECollabState createState() => _CECollabState();

}


class _CECollabState extends State<CECollabFrame> {

   late var      container;
   late AppState appState;

   late bool     peqsLoaded;

   final listHeaders = ["User name", "Role", "Issue count", "PEQ: Planned", "PEQ: Pending", "PEQ: Granted", "PEQ: Vested" ];
   final headerTips  = ["", "Role in Venture", "Total current non-granted PEQ issue count", "", "", "", "" ];

   late double frameMinWidth;
   late double svWidth;
   late double svHeight;
   static const frameMinHeight = 300;

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

   /* XXX from profile page.. if used, move to utils
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
   */

   // XXX XXX copy
   void _loadPeqs() async {
      // get all CEPS the currently logged-in user is connected to.  
      if( !appState.gotUserPeqs )
      {
         await updateUserPeqs( container, context, getAll: true );
         setState(() => peqsLoaded = true );
      }
      
   }
   
   List<Widget> _makeRow( List<String> args, {toolTips = const []} ) {
      final width = ( frameMinWidth - 2*appState.FAT_PAD ) / 2.0;
      assert( listHeaders.length == 7 );
      assert( args.length == listHeaders.length );
      
      List<Widget> children = [];
      for( int i = 0; i < args.length; i++ ) {
         Widget child = makeTableText( appState, args[i], width, appState!.CELL_HEIGHT, false, 1 );
         if( toolTips.length != 0 ) {
            assert( toolTips.length == args.length );
            child = makeToolTip( child, toolTips[i] );
         }
         children.add( child );
      }
      
      Widget row0 = Container( width: 1.0*width, child: children[0] );  // uname
      Widget row1 = Container( width: 0.8*width, child: children[1] );  // role
      Widget row2 = Container( width: .9*width,  child: children[2] );  // total issues
      Widget row3 = Container( width: .9*width,  child: children[3] );  // plan
      Widget row4 = Container( width: .9*width,  child: children[4] );  // pend
      Widget row5 = Container( width: .9*width,  child: children[5] );  // grant
      Widget row6 = Container( width: .9*width,  child: children[6] );  // vest
      return [ row0, row1, row2, row3, row4, row5, row6 ];
   }
   
   List<List<Widget>> _getHeader ( CEVenture cev ) {
      final buttonWidth = 100;
      
      List<List<Widget>> header = [];

      String titletx   = "Collaborators for Venture: " + cev.name;
      Widget spacer    = Container( height: 1, width: (svWidth - titletx.length - 3*buttonWidth )/2.0 );
      Widget miniSpace = Container( height: 1, width: 6 * appState.GAP_PAD );
      Widget title     = makeIWTitleText( appState, titletx, false, 1, fontSize: 18 );

      // XXX Doc links
      String expl1 = "Member statistics for this Venture.  Every collaborator below has signed the following agreements: ";
      String expl2 = "Privacy Agreement" + ", " + "Equity Agreement";
 
      Widget e1 = makeIWTitleText( appState, expl1, false, 1 );
      Widget e2 = makeIWTitleText( appState, expl2, false, 1 );
      
      header.add( [ Container( height: appState.MID_PAD ), empty, empty, empty, empty, empty, empty ] );
      header.add( [ spacer, title, empty, empty, empty, empty, empty ] );
      header.add( [ miniSpace, e1, empty, empty, empty, empty, empty ] );
      header.add( [ miniSpace, e2, empty, empty, empty, empty, empty ] );
      
      header.add( [ vSpace, vSpace, vSpace, vSpace, vSpace, vSpace, vSpace ] );
      header.add( _makeRow( listHeaders, toolTips: headerTips ) );
      header.add( [ hdiv, empty, empty, empty, empty, empty, empty ] );

      widget.headerTop = header.length; 
      return header;
   }
   
   List<List<Widget>> _getCollabs ( CEVenture cev ) {
      final width = ( frameMinWidth - 2*appState.FAT_PAD ) / 2.0;
      final buttonWidth = 100;
      List<List<Widget>> collabs = [];

      // get all CEPS the currently logged-in user is connected to.  
      if( !peqsLoaded )
      {
         Widget spacer  = Container( height: 1, width: (svWidth - 2.0*appState.BASE_TXT_HEIGHT )/2.0 );
         final spinSize = 1.8*appState.BASE_TXT_HEIGHT;         
         Widget spin = Container( width: spinSize, height: spinSize, child: CircularProgressIndicator());
         
         collabs.add( [ vSpace, empty, empty, empty, empty, empty, empty ]);
         collabs.add( [ spacer, empty, empty, empty, spin, empty, empty ] );
         collabs.add( [ vSpace, empty, empty, empty, empty, empty, empty ]);
      }
      else {
      
         for( var ceuid in cev.roles.keys ) {
            List<String> collab = [];
            // name
            Person? cePeep = appState.cePeople[ ceuid ];
            assert( cePeep != null );
            collab.add( cePeep!.userName );
            
            // role
            collab.add( enumToStr( cev.roles[ ceuid ] ?? MemberRole.end ));


            int count = 0;
            int plan = 0;
            int pend = 0;
            int grant = 0;
            for( final peq in appState.userPeqs[ ceuid ] ?? [] ) {
               count += 1;
               if( peq.peqType == PeqType.plan )    { plan  = (plan  + peq.amount).toInt(); }  // ouch!  waat?
               if( peq.peqType == PeqType.pending ) { pend  = (pend  + peq.amount).toInt(); }
               if( peq.peqType == PeqType.grant )   { grant = (grant + peq.amount).toInt(); }
            }            
            
            collab.add( addCommas( count ));
            collab.add( addCommas( plan ));
            collab.add( addCommas( pend ));
            collab.add( addCommas( grant ));
            collab.add( "0" );
            
            collabs.add( _makeRow( collab ) );
         }
      }
      
      return collabs;
   }   
   
   Widget _getBody() {
      CEVenture? cev = appState.ceVenture[ appState.selectedCEVenture ];
      if( cev == null ) { return makeTitleText( appState, "First choose Project or Venture from home screen.", 8*appState.CELL_HEIGHT, false, 1, fontSize: 16); }

      _loadPeqs();
      
      List<List<Widget>> collabs = [];

      collabs.addAll( _getHeader( cev! ));

      collabs.addAll( _getCollabs( cev! ));

      return ScrollConfiguration(
         behavior: MyCustomScrollBehavior(),
         child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
               height: svHeight,
               width: svWidth,
               child: ListView(
                  children: List.generate(
                     collabs.length,
                     (indexX) => Row(
                        key: Key( 'collabs ' + ( indexX - widget.headerTop ).toString() ),                           
                        children: List.generate( 
                           collabs[0].length,
                           (indexY) => collabs[indexX][indexY] ))
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

      if( appState.verbose >= 2 ) { print( "COLLAB BUILD. " ); }
      
      if( appState.gotUserPeqs )   { peqsLoaded = true; }
      return _getBody();
   }
}
