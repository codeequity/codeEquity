import 'dart:async';
import 'package:flutter/material.dart';
//import 'package:flutter_cognito_plugin/flutter_cognito_plugin.dart';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/screens/launch_page.dart';
import 'package:ceFlutter/screens/home_page.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/app_state_container.dart';


void main() => runApp(
   new AppStateContainer( child: new CEApp() )
   );


class CEApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
     // note: primarySwatch takes a set of colors (color + shade value), not an individual color.
     return MaterialApp(
        title: 'CodeEquity',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
           primarySwatch: Colors.green,
           appBarTheme: AppBarTheme(
              color: Colors.grey[200],
              // title is deprecated 1.13, but as of 2/20 headline6 has not yet made it to the stable release
              //textTheme: TextTheme( headline6: TextStyle( color: Colors.black )),
              textTheme: TextTheme( title: TextStyle( color: Colors.black )),
              iconTheme: IconThemeData( color: Colors.black ) ),
           bottomAppBarColor: Colors.grey[200] ),
        home:  CESplashPage( title: 'CodeEquity'),
        );
  }
}


class CESplashPage extends StatefulWidget {
   CESplashPage({Key key, this.title}) : super(key: key);

   final String title;
   
  @override
  _CESplashPageState createState() => _CESplashPageState();
}


class _CESplashPageState extends State<CESplashPage> {

   AppState appState;    // Declaration.  Definition is in build, can be used below
   
   @override
   void initState() {
      print( "... Main init state" );
      super.initState();  
      _startTimer( 0 );
   }

  @override
  void dispose() {
     super.dispose();
  }

  void _startTimer( attempts ) {
     int duration = attempts == 0 ? 3 : 1; 
     print( "In timer, attempt " + attempts.toString() + " next duration " + duration.toString() );

     if( attempts > 15 ) {
        showToast( "AWS token initialization is slow.  Is your wifi on?" );
        navigateUser(); 
     } else { 
        Timer(Duration(seconds: duration), () {
              print("after duration, checking cogDone" );
              if( !appState.cogInitDone ) {
                 _startTimer( attempts + 1 );
              } else {
                 navigateUser();
              }
           });
     }
  }

  
  void navigateUser() async{
     print( "Weh do i go?" );
     if( appState.cogUser.confirmed ) {
        MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEHomePage());
        Navigator.pushReplacement(context, newPage );
     } else {
        Navigator.pushReplacement(context, MaterialPageRoute(builder: (context) => CELaunchPage()));
     }
  }

  
  @override
  Widget build(BuildContext context) {

     var container = AppStateContainer.of(context);
     appState = container.state;

     final devWidth  = MediaQuery.of(context).size.width;
     final devHeight = MediaQuery.of(context).size.height;
     appState.screenHeight = devHeight;
     appState.screenWidth = devWidth;

       return Scaffold(
          body: Center(
             child: Stack(
                children: <Widget>[
                   Container( child: Image.asset( 'images/ceFlutter.jpeg', width: devWidth - 50, fit: BoxFit.fitWidth)), 
                   Positioned( bottom: 60 , left: 10, child: Text("CodeEquity", style: new TextStyle( fontFamily: 'Mansalva', fontSize: 54.0))),
                   ]))
          );}
}
