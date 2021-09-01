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
    
    Widget _guestButton = makeActionButtonSmall( appState, 'Look around as a guest', (() {
             notYetImplemented(context);
          }));
       
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


    Widget _fairBlurb = Container(
       padding: const EdgeInsets.all(0),
       child: Text(
         'If you help create something\n'
         'You should be among those that benefit from it',
         softWrap: true,
         style: new TextStyle( fontFamily: 'Montserrat', fontSize: 18.0, fontWeight: FontWeight.bold, color: Colors.pink[300] )
          ));

    Widget _simpleBlurb = Container(
       padding: const EdgeInsets.all(0),
       child: Text(
          'Simple Idea: New ventures share equity with contributors',
          softWrap: true,
          style: new TextStyle( fontFamily: 'Mansalva', fontSize: 20, fontWeight: FontWeight.bold, fontStyle: FontStyle.italic)
          ));

    Widget _ceIsBlurb = Container(
       padding: const EdgeInsets.all(0),
       child: Text(
          'CodeEquity makes this simple idea easy to put into practice,\n'
          'and iron-clad should the venture become successful.',
          softWrap: true,
          style: new TextStyle( fontFamily: 'Montserrat', fontSize: 18.0, fontWeight: FontWeight.bold, color: Colors.pink[300] )
          ));
    
    Widget _contribBlurb = Container(
       padding: const EdgeInsets.all(0),
       child: Text(
          'All else being equal, why not contribute to the project that offers equity?',
          softWrap: true,
          style: new TextStyle( fontFamily: 'Montserrat', fontSize: 18.0, fontWeight: FontWeight.bold, color: Colors.pink[300] )
          ));

    Widget _founderBlurb = Container(
       padding: const EdgeInsets.all(0),
       child: Text(
         'Is there a more powerful way to attract skilled help?',
         softWrap: true,
         style: new TextStyle( fontFamily: 'Montserrat', fontSize: 18.0, fontWeight: FontWeight.bold, color: Colors.pink[300] )
          ));

    final devWidth = MediaQuery.of(context).size.width;
    final devHeight = MediaQuery.of(context).size.height;

    return Scaffold(
       
       body: Center(
          
          child: Column(
             mainAxisAlignment: MainAxisAlignment.start,
             children: <Widget>[
                SizedBox( height: devHeight * .08),
                Stack(
                   children: <Widget>[
                      Container( child: Image.asset( 'images/ceFlutter.jpeg',
                                                     height: devHeight * .6,
                                                     fit: BoxFit.fitHeight,
                                                     color: Colors.grey.withOpacity(0.3),
                                                     colorBlendMode: BlendMode.dstATop
                                    )), 
                      Positioned( top:  30, left:  0, child: Text("CodeEquity", style: new TextStyle( fontFamily: 'Mansalva', fontSize: 54.0))),
                      Positioned( top:  90, left: 30, child: _fairBlurb ),
                      Positioned( top: 150, left: 10, child: _simpleBlurb ),
                      Positioned( top: 175, left: 30, child: _ceIsBlurb ),
                      Positioned( top: 300, left: 10, child: Text("For the Contributor", style: new TextStyle( fontFamily: 'Mansalva', fontSize: 18.0))),
                      Positioned( top: 325, left: 30, child: _contribBlurb ),
                      Positioned( top: 375, left: 10, child: Text("For the Founder", style: new TextStyle( fontFamily: 'Mansalva', fontSize: 18.0))),
                      Positioned( top: 400, left: 30, child: _founderBlurb )
                      ]),
                SizedBox( height: devHeight * .066 ),
                _signupButton,
                SizedBox( height: devHeight * .02 ),
                _loginButton,
                SizedBox( height:  devHeight * .02 ),
                Text("-- Or --", style: new TextStyle( fontFamily: 'Montserrat', fontSize: 14.0)),
                SizedBox( height: devHeight * .02 ),
                _guestButton,
                ]),
          
          )
       );
  }
}



