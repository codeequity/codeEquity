import 'dart:async';   // timer  XXXXXXXXXXXXXXXX
import 'dart:convert';  // json encode/decode

import 'package:flutter/material.dart';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';
import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/cognitoUserService.dart';

import 'package:ceFlutter/screens/home_page.dart';

import 'package:ceFlutter/models/person.dart';

class CESignupPage extends StatefulWidget {
  CESignupPage({Key key}) : super(key: key);

  @override
  _CESignupState createState() => _CESignupState();
}


class _CESignupState extends State<CESignupPage> {
   TextStyle style = TextStyle(fontFamily: 'Montserrat', fontSize: 20.0);
   TextEditingController usernameController;
   TextEditingController passwordController;
   TextEditingController attributeController;
   TextEditingController confirmationCodeController;

   // Always create with false.  When logout, all stacks pop, recreate is with false.
   bool showCC = false;
   
   @override
   void initState() {
      super.initState();
      showCC = false;
   }

   @override
   void dispose() {
      super.dispose();
   }
   
   @override
   Widget build(BuildContext context) {


      print( "REBUILD SIGNUP" );

      final container = AppStateContainer.of(context);
      final appState = container.state;

      usernameController = new TextEditingController();
      passwordController = new TextEditingController();
      attributeController = new TextEditingController();
      confirmationCodeController = new TextEditingController();
      
      final usernameField = makeInputField( appState, "username", false, usernameController );
      final passwordField = makeInputField( appState, "password", true, passwordController );
      final emailField    = makeInputField( appState, "email address", false, attributeController );
      final confirmationCodeField = makeInputField( appState, "confirmation code", false, confirmationCodeController );

      String message = "";  

      // This is a tricky thing to get right in all cases.
      // For example, allow xyz+tester@gmail.com, don't allow %2@gmail.com
      // Could go wild and follow RFC2822, buuut.. just do most basic and rely on user to resolve.
      bool malformedEmail( email ) {
         bool retVal = true;

         // a@b.c
         retVal = retVal && ( '@'.allMatches( email ).length == 1 ? true : false );
         retVal = retVal && ( email.length >= 5 ? true : false );
         
         return !retVal;
      }

      final signupButton = makeActionButton( appState, "Send confirmation code", cognitoSignupWrapper(context, () async {
               final email = attributeController.text;
               if( malformedEmail( email )) {
                  showToast( "Email address is empty or malformed." );
               }
               else {
                  await appState.cogUserService.signUp( email, passwordController.text, usernameController.text );
                  showToast( "Code sent to your email");
                  print( "Code sent to email" );
                  setState(() { showCC = true; });
               }
               
            }));

      final confirmSignupButton = makeActionButton( appState, "Confirm signup, and Log in", cognitoSignupWrapper(context, () async {
               bool acctConfirmed = false;
               acctConfirmed = await appState.cogUserService.confirmAccount( usernameController.text,
                                                                               confirmationCodeController.text );
               if( acctConfirmed ) { print( "Account confirmed." ); }
               else {
                  print( "Account confirmation failure.  Bad confirmation code?" );
                  return;
               }

               appState.newUser = true;
               appState.cogUser = await appState.cogUserService.login( usernameController.text, passwordController.text );
               print( "Login complete." );

               if( !appState.cogUser.confirmed ) {
                  showToast( "Signin failed.  Incorrect confirmation code?" );
                  return;
               }
               bool success = await container.finalizeUser( true );

               if( success ) {

                  String pid = randAlpha(10);
                  appState.userId = pid;
                  
                  Person user = new Person( id: pid, firstName: "Marion", lastName: "Star", userName: usernameController.text,
                                            email: attributeController.text, locked: false, imagePng: null, image: null );
                  
                  String newUser = json.encode( user );
                  String ppostData = '{ "Endpoint": "PutPerson", "NewPerson": $newUser }';
                  await updateDynamo( context, container, ppostData, "PutPerson" );
                  
                  appState.newUser = false;
                  await reloadMyProjects( context, container );
                  appState.updateAllocTree = true; // forces buildAllocationTree
                  appState.loaded = true;
                  
                  MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEHomePage());
                  Navigator.push( context, newPage );
               }

            }));      

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
                           emailField,
                           SizedBox( height: 5.0),
                           Visibility( key: Key("confirmation code visNode") , visible: showCC, child: confirmationCodeField ),
                           SizedBox( height: 5.0),
                           Visibility( visible: !showCC, child: signupButton ),
                           SizedBox( height: 5.0),
                           Visibility( key: Key("confirm signup button visNode"), visible: showCC, child: confirmSignupButton ),
                           SizedBox( height: 5.0),
                           Text( appState.cogUser.confirmed?.toString() ?? "UserState here", style: TextStyle(fontStyle: FontStyle.italic))
                           ])))
               
               )));
   }
}
