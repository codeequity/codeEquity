import 'package:flutter/material.dart';

import 'package:ceFlutter/screens/login_page.dart';
import 'package:ceFlutter/screens/signup_page.dart';

import 'package:ceFlutter/utils.dart';  
import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/models/app_state.dart';



class CELaunchPage extends StatefulWidget {
   CELaunchPage({Key key}) : super(key: key);

   @override
   _CELaunchPageState createState() => _CELaunchPageState();
}


class _CELaunchPageState extends State<CELaunchPage> {

   var      container;
   AppState appState;

   @override
   void initState() {
      super.initState();
   }

  @override
  void dispose() {
     super.dispose();
     if( appState.verbose >= 2 ) { print( "launch dispose" ); }
  }

    
  
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
  
  
  @override
  Widget build(BuildContext context) {

    container = AppStateContainer.of(context);
    appState  = container.state;

    final devWidth  = MediaQuery.of(context).size.width;
    final devHeight = MediaQuery.of(context).size.height;
    appState.screenHeight = devHeight;
    appState.screenWidth = devWidth;

    // XXX should base 410 off computed height of left hand side.  410 lines bottoms up.
    // XXX should compute 504
    final lhsWidth  = 504;
    final rhsWidth  = devWidth - 504 - devWidth * .06;
    var widthFactor = rhsWidth / 410.0;
    // set rhsWidth back to 1.0 when too small since wrap will move it
    widthFactor     = widthFactor > 1.0 || widthFactor < 0.5 ? 1.0 : rhsWidth / 410.0;

    Widget _guestButton = makeActionButtonFixed( appState, 'Look around as a guest', 200, (() {
             notYetImplemented(context);
          }));
    
    Widget _loginButton = makeActionButtonFixed( appState, 'Login', 200, (() {
             Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => CELoginPage()));
          }));
    
    Widget _signupButton = makeActionButtonFixed( appState, 'Create New Account', 200, (() {
             Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => CESignupPage()));
        }));

    if( appState.verbose >= 2 ) { print( "Build launch page" ); }
    // print( "launch recalc screen size " + devHeight.toString() + " " + devWidth.toString() + " WF: " + widthFactor.toStringAsFixed(2) );
    return Scaffold(
       body: Center(

          child: ConstrainedBox( 
            constraints: new BoxConstraints(
               minHeight: 20.0,
               minWidth: 20.0,
               maxHeight: devHeight,
               maxWidth:  devWidth,
               ),
            child: ListView(
               scrollDirection: Axis.vertical,
               children: <Widget>[
                SizedBox( height: devHeight * .02),
                Center( child: _ceHead ),
                SizedBox( height: devHeight * .08),
                Center(
                   child: Wrap(
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
                               ClipRect(
                                  child: Align(
                                     alignment: Alignment.centerLeft,
                                     widthFactor: widthFactor,
                                     child: Image.asset( 'images/ceFlutter.jpeg',
                                                         width: 410,
                                                         color: Colors.grey.withOpacity(0.05),
                                                         colorBlendMode: BlendMode.darken
                                        ))),
                               SizedBox( height: devHeight * .01 ),                            
                               ClipRect(
                                  child: Align(
                                     alignment: Alignment.centerLeft,
                                     widthFactor: widthFactor,
                                     child: _fairBlurb
                                     ))
                               ]),
                         ])),
                ])
          
            )
          )
       );
  }
}



