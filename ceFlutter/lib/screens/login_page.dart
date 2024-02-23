import 'dart:async';   // timer
import 'package:amazon_cognito_identity_dart_2/cognito.dart';
//import 'package:flutter_cognito_plugin/flutter_cognito_plugin.dart';
import 'package:flutter/material.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';
import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/cognitoUserService.dart';
import 'package:ceFlutter/screens/home_page.dart';

import 'package:ceFlutter/models/app_state.dart';


class CELoginPage extends StatefulWidget {
  CELoginPage({Key? key}) : super(key: key);

  @override
  _CELoginState createState() => _CELoginState();
}


class _CELoginState extends State<CELoginPage> {

   TextStyle style = TextStyle(fontFamily: 'Montserrat', fontSize: 20.0);
   TextEditingController usernameController;
   TextEditingController passwordController;

   var      container;
   AppState appState;
   
   @override
   void initState() {
      super.initState();
   }
   
  @override
  void dispose() {
    super.dispose();
    if( appState.verbose >= 2 ) { print( "LoginPage Disposessed!" ); }
  }


  void _signin( userName, userPassword, container, appState ) async {
     final wrapper = cognitoSignupWrapper(context, () async {

           Stopwatch stopwatch = new Stopwatch()..start();
           appState.cogUser = await appState.cogUserService.login( userName, userPassword );
           print('Cog Login executed in ${stopwatch.elapsed} for ' + userName );
           stopwatch.reset();
           bool success = await container.finalizeUser( false );
           print('container.finalizeUser executed in ${stopwatch.elapsed}');           
           if( success ) {
              appState.loaded = true;
              MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEHomePage());
              Navigator.push( context, newPage );
           }
        });
     wrapper();
  }

  
  void _logoutLogin( freeName, freePass, attempts, container, appState ) {
     int duration = attempts == 0 ? 1 : 1; 
     // print( "In LL timer, attempt " + attempts.toString() + " next duration " + duration.toString() );
     
     if( attempts > 15 ) {
        showToast( "AWS token initialization is slow.  Is your wifi on?" );
        _signin( freeName, freePass, container, appState );
     }
     else {
        // Wait for Cognito logout callback to finish executing
        Timer(Duration(seconds: duration), () {
              if( passwordController.text != "" ) { _logoutLogin( freeName, freePass, attempts + 1, container, appState ); }
              else                                { _signin( freeName, freePass, container, appState ); }
           });
     }
  }

  // Test runner specifies _1664.  Internal login will differ.
  Future<void> _switchToUnusedTester( container, appState ) async {

     /*
     String userName = appState.usernameController.text;
     String postData = '{ "Endpoint": "GetFree", "UserName": "$userName" }';
     String freeName = await getFree( context, container, postData );
     
     if(freeName == "" ) {
        showToast( "All testers currently in use, please try again later." );
     }
     else
     {
        print( "Switching to tester login " + freeName.toString() );
        postData = '{ "Endpoint": "SetLock", "UserName": "$freeName", "LockVal": "true" }'; 
        await setLock( context, container, postData );
        
        // Catch this before signout kills it
        String freePass = appState.passwordController.text;
        await logoutWait( context, container, appState );
        // Similarly, cognito logout initiates a callback that we need to wait for
        _logoutLogin( freeName, freePass, 0, container, appState );
     }
     */
  }
  
  
  void _loginLogoutLogin( attempts, container, appState ) {
     int duration = attempts == 0 ? 3 : 1; 
     print( "In logInOutIn timer, attempt " + attempts.toString() + " next duration " + duration.toString() );
     
     if( attempts > 15 ) {
        showToast( "AWS token initialization is slow.  Is your wifi on?" );
        _switchToUnusedTester( container, appState );
     }
     else {
        // XXX unneeded now?
        // Wait for Cognito signin callback to finish executing
        Timer(Duration(seconds: duration), () {
              if( !appState.cogInitDone ) { _loginLogoutLogin( attempts + 1, container, appState ); }
              else                        { _switchToUnusedTester( container, appState );     }
           });
     }
  }
  
  
  @override
  Widget build(BuildContext context) {

     container = AppStateContainer.of(context);
     appState  = container.state;

     usernameController = new TextEditingController();
     passwordController = new TextEditingController();

     final usernameField = makeInputField( appState, "username", false, usernameController );
     final passwordField = makeInputField( appState, "password", true,  passwordController );
     final loginButton = makeActionButton( appState, 'Login', (() async {
              String userName = usernameController.text;
              String userPassword = passwordController.text;

              // Enable rotating tester logins
              // have to sign in first, in order to get auth tokens to check locked.
              // _1664 is auth account.  _1664_{0..9} are integration testing accounts.
              if( userName == "_ce_tester_1664" ) {

                 // XXX can simplify now that cognito is not callback-based?
                 // await Cognito.signIn( userName, userPassword );
                 // cognito signin initiates a separate callback not attached to the signin process.
                 // Need to wait for that to finish.  This is ugly - may be able to rewrite app_state_container callback
                 // with completer?
                 _loginLogoutLogin(0, container, appState );
              }
              else {
                 _signin( userName, userPassword, container, appState );
                 
              }
           }));

     if( appState.verbose >= 2 ) { print( "build login page" ); }
     
     return Scaffold(
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
                     usernameField,
                     SizedBox(height: 5.0),
                     passwordField,
                     SizedBox( height: 5.0),
                     loginButton,
                     SizedBox(height: 5.0),
                     Text( appState.cogUser?.confirmed.toString() ?? "UserState here", style: TextStyle(fontStyle: FontStyle.italic)),
                     ])))
         
            )));
   }
}
