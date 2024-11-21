import 'package:flutter/material.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/customLetters.dart';

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
         return makeActionButton( appState, 'Signout', _logout( context, appState) );
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
                          Row(
                             children: [
                                Container(width: 15.0),
                                Image.asset( 'images/aGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/bGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/cGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/dGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/eGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                ]),
                          SizedBox(height: 15.0),
                          Row(
                             children: [
                                Container(width: 15.0),
                                Image.asset( 'images/fGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/gGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/hGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/iGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/jGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                ]),
                          SizedBox(height: 15.0),
                          Row(
                             children: [
                                Container(width: 15.0),
                                Image.asset( 'images/kGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/lGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/mGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/nGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/oGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                ]),
                          SizedBox(height: 15.0),
                          Row(
                             children: [
                                Container(width: 15.0),
                                Image.asset( 'images/pGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/qGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),

                                Container(width: 15.0),
                                Image.asset( 'images/rGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/sGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/tGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                ]),
                          SizedBox(height: 15.0),
                          Row(
                             children: [
                                Container(width: 15.0),
                                Image.asset( 'images/uGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/vGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/wGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/xGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                Image.asset( 'images/yGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                ]),
                          SizedBox(height: 15.0),
                          Row(
                             children: [
                                Container(width: 15.0),
                                Image.asset( 'images/zGrad.png',
                                             width: 180,
                                             color: Colors.grey.withOpacity(0.05),
                                             colorBlendMode: BlendMode.darken ),
                                Container(width: 15.0),
                                ]),
                          makeLogoutButton()
                          ]))))));
   }
}
/*
                         children: <Widget>[
                          SizedBox(height: 15.0),
                          Image.asset( 'images/bOrig.png',
                                       width: 200,
                                       color: Colors.grey.withOpacity(0.05),
                                       colorBlendMode: BlendMode.darken ),
                          SizedBox(height: 20.0),
                          Image.asset( 'images/b.png',
                                       width: 200,
                                       color: Colors.grey.withOpacity(0.05),
                                       colorBlendMode: BlendMode.darken ),
                          SizedBox(height: 20.0),
*/
