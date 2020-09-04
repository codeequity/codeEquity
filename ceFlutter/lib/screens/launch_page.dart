import 'package:flutter/material.dart';

import 'package:ceFlutter/screens/login_page.dart';
import 'package:ceFlutter/screens/signup_page.dart';

import 'package:ceFlutter/utils.dart';  
import 'package:ceFlutter/app_state_container.dart';



class CELaunchPage extends StatefulWidget {
   CELaunchPage({Key key}) : super(key: key);

   @override
   _CELaunchPageState createState() => _CELaunchPageState();
}


class _CELaunchPageState extends State<CELaunchPage> {

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

    final container = AppStateContainer.of(context);
    final appState = container.state;

    print( "start launch page builder" );
    
    Widget _loginButton = makeActionButton( appState, 'Login', (() {
             Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => CELoginPage()));
          }));
       
    Widget _signupButton = makeActionButton( appState, 'Create New Account', (() {
             Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => CESignupPage()));
          }));

    Widget _nurb = Container(
       padding: const EdgeInsets.all(4),
       child: Text(
         'CodeEquity Code Equity CE codeEquity\n'
         'code code code equity equity equity equity!',
         softWrap: true,
         style: new TextStyle( fontFamily: 'Montserrat', fontSize: 15.0, fontWeight: FontWeight.bold, color: Colors.pink[300] )
          ));

    final devWidth = MediaQuery.of(context).size.width;
    final devHeight = MediaQuery.of(context).size.height;

    return Scaffold(
       
       body: Center(
          
          child: Column(
             mainAxisAlignment: MainAxisAlignment.start,
             children: <Widget>[
                SizedBox( height: devHeight / 8.0),
                Stack(
                   children: <Widget>[
                      Container( child: Image.asset( 'images/ceFlutter.jpeg', width: devWidth - 50, fit: BoxFit.fitWidth)), 
                      Positioned( bottom: 60 , left: 10, child: Text("CodeEquity", style: new TextStyle( fontFamily: 'Mansalva', fontSize: 54.0))),
                      Positioned( bottom: 20, left: 10, child: _nurb )
                      ]),
                SizedBox( height: devHeight / 10.0 ),
                _signupButton,
                SizedBox( height: 20.0),
                _loginButton,
                ]),
          
          )
       );
  }
}



