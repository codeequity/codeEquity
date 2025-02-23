import 'dart:ui';       // pointerKinds
import 'dart:convert';  // json encode/decode

import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/CEProject.dart';

// XXX move to WU
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

   late double frameMinWidth;
   static const frameMinHeight = 300;

   late bool     peqsLoading;

   late Widget empty;  // XXX formalize
   late Widget gapPad;
   late Widget fatPad;
   late Widget midPad;
   
   @override
   void initState() {
      super.initState();
      peqsLoading = false;
   }

   @override
   void dispose() {
      super.dispose();
   }

   // XXX
   int getPendingCount() { return 0; }

   // XXX args.. consts like svWidth
   // XXX change header so buttons are grey if no pending.... sheesh.  remove buttons.  within project scope!!
   // XXX change header so final button doesn't show if have platforms
   List<List<Widget>> getHeader ( cepName, svWidth ) {
      widget.headerTop = 5;   // spacer + title + ...
      final width = frameMinWidth - 2*appState.FAT_PAD;
      final buttonWidth = 100;
      
      List<List<Widget>> header = [];
      
      Widget spacer    = Container( height: 1, width: (svWidth - cepName.length - 2*buttonWidth )/4.0 );
      Widget hd        = makeHDivider( appState, 2*width - appState.GAP_PAD, appState.TINY_PAD, appState.TINY_PAD, tgap: appState.TINY_PAD, bgap: appState.TINY_PAD ); 
      Widget hdiv      = Wrap( spacing: 0, children: [fatPad, hd] );
      Widget title     = Wrap(
         spacing: appState.TINY_PAD,
         children: [
            makeIWTitleText( appState, cepName , false, 1, fontSize: 18 ),
            makeActionButtonFixed(
               appState,
               "GitHub " + getPendingCount().toString(),
               buttonWidth, 
               () async { setState(() => peqsLoading = true ); }),
            makeGreyButtonFixed(
               appState,
               "Host Platform 2 " + getPendingCount().toString(),
               buttonWidth )
            ]);

      
      header.add( [ Container( height: appState.MID_PAD ), empty, empty, empty, empty ] );
      header.add( [ spacer, title, empty, empty, empty ] );
      header.add( [ empty, empty, empty, empty, empty ] );
      header.add( [ hdiv, empty, empty, empty, empty ] );
      
      return header;
   }


   Widget getPending( context ) {

      CEProject? cep = appState.ceProject[ appState.selectedCEProject ];
      if( cep == null ) { return makeTitleText( appState, "First choose Project from home screen.", 8*appState.CELL_HEIGHT, false, 1, fontSize: 16); }

      final svHeight = ( appState.screenHeight - widget.frameHeightUsed ) * .9;
      final svWidth  = appState.MAX_PANE_WIDTH; 
      final c        = Container( width: 1, height: 1 );
      
      List<List<Widget>> pending = [];

      pending.addAll( getHeader( cep!.name, svWidth ) );

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
                        key: Key( 'pending ' + ( indexX - 1).toString() ),                           
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

      frameMinWidth = appState.MIN_PANE_WIDTH;

      empty     = Container( width: 1, height: 1 );
      gapPad    = Container( width: appState.GAP_PAD*2.0, height: 1 );
      fatPad    = Container( width: appState.FAT_PAD, height: 1 );
      midPad    = Container( width: appState.MID_PAD, height: 1 );
      
      if( appState.verbose >= 2 ) { print( "APPROVAL BUILD. " + (appState == Null).toString()); }
      
      return getPending( context );
   }
}
