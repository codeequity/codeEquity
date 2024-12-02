import 'package:flutter/material.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/models/app_state.dart';


class CESettingsPage extends StatefulWidget {
  CESettingsPage({Key? key}) : super(key: key);

  @override
  _CESettingsState createState() => _CESettingsState();

}


class _CESettingsState extends State<CESettingsPage> {

   TextStyle style = TextStyle(fontFamily: 'Montserrat', fontSize: 20.0);
   late AppState appState; 

  @override
      void initState() {
      super.initState();
   }


  @override
  void dispose() {
    super.dispose();
  }

  Widget _makeBody() {
     if( appState.loaded ) {
        return  makeTitleText( appState, "Not Yet implemented.", 6*appState.CELL_HEIGHT, false, 1, fontSize: 18);
     }
     else {
        if( appState.verbose >= 0 ) { print( "AppState not ? Loaded" ); }
        return CircularProgressIndicator();
     }
  }
   
         
  @override
  Widget build(BuildContext context) {

      final container = AppStateContainer.of(context);
      appState = container.state;
      assert( appState != null );
      
      print("Settings page");
      
      return Scaffold(
         appBar: makeTopAppBar( context, "Settings" ),
         body: _makeBody()
         );
  }
}
