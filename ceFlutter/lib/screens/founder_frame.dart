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

class CEFounderFrame extends StatefulWidget {
   final frameHeightUsed;
   var   appContainer;

   // Keep size of headers for approvals frame view.  Use this for key indexing
   late int headerTop; 

   CEFounderFrame(
      {Key? key,
            this.appContainer,
            this.frameHeightUsed
            } ) : super(key: key);

  @override
  _CEFounderState createState() => _CEFounderState();

}


class _CEFounderState extends State<CEFounderFrame> {

   late var      container;
   late AppState appState;

   late double frameMinWidth;
   late double svWidth;
   late double svHeight;
   static const frameMinHeight = 300;
   
   @override
   void initState() {
      super.initState();
   }

   @override
   void dispose() {
      super.dispose();
   }

   @override
   Widget build(BuildContext context) {

      container = widget.appContainer;   
      appState  = container.state;
      assert( appState != null );

      frameMinWidth  = appState.MIN_PANE_WIDTH;
      svHeight       = ( appState.screenHeight - widget.frameHeightUsed ) * .9;
      svWidth        = appState.MAX_PANE_WIDTH; 

      if( appState.verbose >= 1 ) { print( "Founder Grants BUILD. " ); }
      
      return Container( width: 1 );
   }
}
