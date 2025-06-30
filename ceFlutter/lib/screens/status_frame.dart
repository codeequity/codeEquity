import 'dart:ui';       // pointerKinds
import 'dart:convert';  // json encode/decode

import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/PEQ.dart';


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


class CEStatusFrame extends StatefulWidget {
   final frameHeightUsed;
   var   appContainer;

   // Keep size of headers for statuss frame view.  Use this for key indexing
   late int headerTop; 

   CEStatusFrame(
      {Key? key,
            this.appContainer,
            this.frameHeightUsed
            } ) : super(key: key);

  @override
  _CEStatusState createState() => _CEStatusState();

}


class _CEStatusState extends State<CEStatusFrame> {

   late var      container;
   late AppState appState;

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
   }

   @override
   void dispose() {
      super.dispose();
   }

   List<List<Widget>> _getHeader( cep ) {
      List<List<Widget>> header = [];

      final width = ( frameMinWidth - 2*appState.FAT_PAD ) / 2.0;
      final buttonWidth = 100;
      
      Widget spacer    = Container( height: 1, width: (svWidth - cep.name.length - 2*buttonWidth )/2.0 );
      Widget toEdge    = Container( height: 1, width: (svWidth + cep.name.length - 4*buttonWidth )/2.0 );
      Widget miniSpace = Container( height: 1, width: 6 * appState.GAP_PAD );
      Widget title     = makeIWTitleText( appState, cep.name , false, 1, fontSize: 18 );

      Widget status = Wrap( spacing: appState.TINY_PAD,
                            children: [
                               makeIWTitleText( appState, "Status:" , false, 1, fontSize: 18 ),
                               Padding( padding: EdgeInsets.fromLTRB(0, appState.TINY_PAD, 0, 0 ),
                                        child: Icon( Icons.thumb_up, color: Colors.green ))
                               ]);
      
      header.add( [ Container( height: appState.MID_PAD ), empty, empty, empty, empty ] );
      header.add( [ spacer, title, empty, toEdge, status ] );
      header.add( [ Container( height: appState.MID_PAD ), empty, empty, empty, empty ] );

      List<PEQ> peqs      = [];         
      List<PEQ> planPeqs  = [];         
      List<PEQ> pendPeqs  = [];         
      List<PEQ> accrPeqs  = [];         
      List<PEQ> hPeqs     = [];
      List<PEQ> planHPeqs = [];
      List<PEQ> pendHPeqs = [];
      List<PEQ> accrHPeqs = [];
      String cePeqDetail  = planPeqs.length.toString() + " planned, " + pendPeqs.length.toString() + " pending, " + accrPeqs.length.toString() + " accrued.";
      String cePeqs       = peqs.length.toString() + " PEQs: " + cePeqDetail;
      String ceStorage    = "CodeEquity Data (AWS)";
      
      String hostStorage   = "Host Data: (" + cep.hostPlatform + ")";
      String hostPeqDetail = planHPeqs.length.toString() + " planned, " + pendHPeqs.length.toString() + " pending, " + accrHPeqs.length.toString() + " accrued.";
      String hostPeqs      = hPeqs.length.toString() + " PEQs: " + hostPeqDetail; 

      int stepWidth = (svWidth / 3).toInt();
      Widget t1 = makeIWTitleText( appState, ceStorage, false, 1, fontSize: 16, sw: stepWidth );

      // Add latency?  Need different spacing strategy
      /*
      Widget t1 = Wrap( spacing: 0,
                        children: [
                           makeIWTitleText( appState, ceStorage, false, 1, fontSize: 16 ),
                           makeIWTitleText( appState, "(43)" , false, 1, fontSize: 12, sw: stepWidth ),
                           ]);
      */

      Widget t2 = makeIWTitleText( appState, hostStorage, false, 1, fontSize: 16, sw: stepWidth );
      
      
      header.add( [ Container( height: appState.MID_PAD ), empty, empty, empty, empty ] );
      header.add( [ miniSpace, t1,   miniSpace, t2,   empty ] );
      header.add( [ miniSpace, makeIWTitleText( appState, cePeqs, false, 1, sw: stepWidth ), miniSpace, makeIWTitleText( appState, hostPeqs, false, 1, sw: stepWidth ), empty ] );
      
      
      widget.headerTop = header.length;
      return header;
   }

   List<List<Widget>> _getBody() {
      return [[empty, empty, empty, empty, empty]];
   }
   
   Widget getStatus( context ) {

      CEProject? cep = appState.ceProject[ appState.selectedCEProject ];
      if( cep == null ) { return makeTitleText( appState, "First choose Project from home screen.", 8*appState.CELL_HEIGHT, false, 1, fontSize: 16); }

      List<List<Widget>> pending = [];
      
      pending.addAll( _getHeader( cep! ) );

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

      if( appState.verbose >= 2 ) { print( "STATUS BUILD. " ); }
      
      return getStatus( context );
   }
}
