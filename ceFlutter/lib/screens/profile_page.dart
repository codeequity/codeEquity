import 'package:flutter/material.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/models/app_state.dart';


class CEProfilePage extends StatefulWidget {
  CEProfilePage({Key? key}) : super(key: key);

  @override
  _CEProfileState createState() => _CEProfileState();

}


class _CEProfileState extends State<CEProfilePage> {

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

  
  Function _logout( context, appState) {
     wrapper() async {
        logout( context, appState );
     }
     return wrapper;
  }
         
  @override
  Widget build(BuildContext context) {

      final container = AppStateContainer.of(context);
      appState = container.state;
      assert( appState != null );

      print("Profile page");
      makeLogoutButton() {
         return makeActionButton( appState, 'Logout', _logout( context, appState) );
      }

      
   return Scaffold(
        appBar: makeTopAppBar( context, "Profile" ),
        // bottomNavigationBar: makeBotAppBar( context, "Profile" ),
        body: Center(
           child: SingleChildScrollView( 
              child: Container(
                 color: Colors.white,
                 child: Padding(
                    padding: const EdgeInsets.all(36.0),
                    child: Column(
                       crossAxisAlignment: CrossAxisAlignment.center,
                       mainAxisAlignment: MainAxisAlignment.center,
                       children: <Widget>[
                          SizedBox(height: 5.0),
                          makeLogoutButton(),
                          SizedBox(height: 5.0),
                          Text( appState.cogUser?.confirmed.toString() ?? "UserState here", style: TextStyle(fontStyle: FontStyle.italic))
                          ])))
              
              )));
   }
}
