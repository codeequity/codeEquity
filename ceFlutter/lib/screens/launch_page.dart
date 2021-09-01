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

    final devWidth  = MediaQuery.of(context).size.width;
    final devHeight = MediaQuery.of(context).size.height;
    appState.screenHeight = devHeight;
    appState.screenWidth = devWidth;
    print( "launch recalc screen size " + devWidth.toString() );
    
    Widget _guestButton = makeActionButtonFixed( appState, 'Look around as a guest', (() {
             notYetImplemented(context);
          }));
       
    Widget _loginButton = makeActionButtonFixed( appState, 'Login', (() {
             Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => CELoginPage()));
          }));
       
    Widget _signupButton = makeActionButtonFixed( appState, 'Create New Account', (() {
             Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => CESignupPage()));
          }));


    Widget _ceHead = paddedLTRB( 
       Text(
          'CodeEquity',
          softWrap: true,
          style: new TextStyle( fontFamily: 'Mansalva', fontSize: 88.0 ),
          ),
       0, 0, 0, 0);
    
    Widget _simpleHead = paddedLTRB(
       Text(
          'Simple Idea',
          softWrap: true,
          style: new TextStyle( fontFamily: 'Montserrat', fontSize: 20, fontWeight: FontWeight.bold)
          ),
       10,0,0,10);

    Widget _contribHead = paddedLTRB(
       Text(
          'For the GitHub Contributor',
          softWrap: true,
          style: new TextStyle( fontFamily: 'Montserrat', fontSize: 20, fontWeight: FontWeight.bold)
          ),
       10,0,0,0);

    Widget _founderHead = paddedLTRB(
       Text(
          'For the GitHub Founder',
          softWrap: true,
          style: new TextStyle( fontFamily: 'Montserrat', fontSize: 20, fontWeight: FontWeight.bold)
          ),
       10,0,0,0);

    Widget _fairBlurb = paddedLTRB(
       Text(
         'If you help create something\n'
         'You should be among those that benefit from it',
         softWrap: true,
         style: new TextStyle( fontFamily: 'Montserrat', fontSize: 18.0, fontWeight: FontWeight.bold, color: Colors.pink[300] )
          ),
       30,0,0,0);

    Widget _simpleBlurb = paddedLTRB(
       Text(
          'New ventures share equity with contributors',
          softWrap: true,
          style: new TextStyle( fontFamily: 'Montserrat', fontSize: 20, fontWeight: FontWeight.bold, color: Colors.pink[300] )
          ),
       30,0,0,10);

    Widget _ceIsBlurb = paddedLTRB(
       Text(
          'CodeEquity makes it easy to put this idea into practice,\n'
          'and iron-clad should the venture become successful.',
          softWrap: true,
          style: new TextStyle( fontFamily: 'Montserrat', fontSize: 18.0, fontWeight: FontWeight.bold )
          ),
       30,0,0,0);
    
    Widget _contribBlurb = paddedLTRB(
       Text(
          'All else being equal,\n'
          'why not contribute to the project that offers equity?',
          softWrap: true,
          style: new TextStyle( fontFamily: 'Montserrat', fontSize: 18.0, fontWeight: FontWeight.bold )
          ),
       30,0,0,0);

    Widget _founderBlurb = paddedLTRB(
       Text(
         'Is there a more powerful way to attract skilled help?',
         softWrap: true,
         style: new TextStyle( fontFamily: 'Montserrat', fontSize: 18.0, fontWeight: FontWeight.bold )
          ),
       30,0,0,0);

    // XXX should not yellowbox.   Bottom yellow can be eliminated with ListView
    return Scaffold(
       
       body: Center(

          // XXX why does <Widget> in front of list throw x-axis alignment??
          child: Column(
             crossAxisAlignment: CrossAxisAlignment.center,
             mainAxisAlignment: MainAxisAlignment.start,
             children: [
                SizedBox( height: devHeight * .02),
                _ceHead,
                SizedBox( height: devHeight * .08),
                Wrap(
                   children: [
                      Column(
                         crossAxisAlignment: CrossAxisAlignment.start,
                         mainAxisAlignment: MainAxisAlignment.start,
                         children: [
                            _simpleHead,
                            _simpleBlurb,
                            _ceIsBlurb,
                            SizedBox( height: devHeight * .07 ),
                            _contribHead,
                            _contribBlurb,
                            SizedBox( height: devHeight * .02 ),
                            _founderHead,
                            _founderBlurb,
                            SizedBox( height: devHeight * .08 ),
                            Wrap(
                               children: [
                                  Column(
                                     crossAxisAlignment: CrossAxisAlignment.center,
                                     mainAxisAlignment: MainAxisAlignment.start,
                                     children: [
                                        paddedLTRB( _signupButton, 0, 0, 0, 0 ),
                                        SizedBox( height: devHeight * .02 ),
                                        paddedLTRB( _loginButton, 0, 0, 0, 0 ),
                                        ]),
                                  paddedLTRB( Text("-- Or --", style: new TextStyle( fontFamily: 'Montserrat', fontSize: 14.0)), 20, devHeight*.032, 20, 0 ),
                                  paddedLTRB( _guestButton, 0, devHeight*.025, 0, 0 ),
                                  ])
                            ]),
                      SizedBox( width: devWidth * .06 ),
                      Column(
                         crossAxisAlignment: CrossAxisAlignment.start,
                         mainAxisAlignment: MainAxisAlignment.start,
                         children: [
                            SizedBox( width: 410, //devWidth * .4,
                                      child: Image.asset( 'images/ceFlutter.jpeg',
                                                          fit: BoxFit.fitWidth,
                                                          color: Colors.grey.withOpacity(0.05),
                                                          colorBlendMode: BlendMode.darken
                                         )),
                            SizedBox( height: devHeight * .01 ),                            
                            _fairBlurb,
                            ]),
                      ]),
                ])
          
          )
       );
  }
}



