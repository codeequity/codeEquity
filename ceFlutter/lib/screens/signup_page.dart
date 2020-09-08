import 'dart:convert';  // json encode/decode

import 'package:flutter/material.dart';
import 'package:random_string/random_string.dart';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';
import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/screens/home_page.dart';
import 'package:ceFlutter/cognitoUserService.dart';

class CESignupPage extends StatefulWidget {
  CESignupPage({Key key}) : super(key: key);

  @override
  _CESignupState createState() => _CESignupState();
}


class _CESignupState extends State<CESignupPage> {
   TextStyle style = TextStyle(fontFamily: 'Montserrat', fontSize: 20.0);

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

      
      final container = AppStateContainer.of(context);
      final appState = container.state;
      
      final usernameField = makeInputField( context, "username", false, appState.usernameController );
      final passwordField = makeInputField( context, "password", true, appState.passwordController );
      final emailField    = makeInputField( context, "email address", false, appState.attributeController );
      final confirmationCodeField = makeInputField( context, "confirmation code", false, appState.confirmationCodeController );

      String message = "";  

      // XXX move these exceptions out!
      // XXX onPressWrapper?  nahhh
      final signupButton = makeActionButton( appState, "Send confirmation code", (() async {
               // final email = {'email' : appState.attributeController.text };
               final email = appState.attributeController.text;
               try{
                  // await Cognito.signUp( appState.usernameController.text, appState.passwordController.text, email );
                  await appState.cogUserService.signUp( email, appState.passwordController.text, appState.usernameController.text );
                  showToast( context, "Code sent to your email");
                  print( "Code sent to email" );
                  setState(() { showCC = true; });
               }  on CognitoClientException catch (e) {
                  if (e.code == 'UsernameExistsException' ||
                      e.code == 'InvalidParameterException' ||
                      e.code == 'ResourceNotFoundException') {
                     message = e.message;
                  } else {
                     message = 'Unknown client error occurred';
                  }
               } catch(e) {  // XXX DUPS
                  if( e.toString().contains("\'password\' failed") ) {
                     showToast( context, "Password needs 8 chars, some Caps, and some not in the alphabet." );
                  } else if(e.toString().contains("Invalid email address") ) {
                     showToast( context, "Email address is broken." );
                  } else {
                     showToast( context, e.toString() );
                  }}
               print( message );
            }));

      final confirmSignupButton = makeActionButton( appState, "Confirm signup, and Log in", (() async {
               bool acctConfirmed = false;
               try {
                  acctConfirmed = await appState.cogUserService.confirmAccount( appState.usernameController.text,
                                                                               appState.confirmationCodeController.text );
               } on CognitoClientException catch (e) {
                  if (e.code == 'InvalidParameterException' ||
                      e.code == 'CodeMismatchException' ||
                      e.code == 'NotAuthorizedException' ||
                      e.code == 'UserNotFoundException' ||
                      e.code == 'ResourceNotFoundException') {
                     message = e.message;
                  } else {
                     message = 'Unknown client error occurred';
                  }
               } catch (e) {
                  message =  'Unknown error occurred';
               }
               print( message );

               if( acctConfirmed ) { print( "Account confirmed." ); }
               else {
                  print( "Account confirmation failure.  Bad confirmation code?" );
                  return;
               }

               appState.newUser = true;
               try {
                  appState.cogUser = await appState.cogUserService.login( appState.usernameController.text, appState.passwordController.text );
               } on CognitoClientException catch (e) {
                  if (e.code == 'InvalidParameterException' ||
                      e.code == 'NotAuthorizedException' ||
                      e.code == 'UserNotFoundException' ||
                      e.code == 'ResourceNotFoundException') {
                     message = e.message;
                  } else {
                     message = 'An unknown client error occured';
                  }
               } catch (e) {
                  message = 'An unknown error occurred';
               }
               print(message);
               print( "Login complete." );

               if( !appState.cogUser.confirmed ) {
                  showToast( context, "Signin failed.  Incorrect confirmation code?" );
                  return;
               }
               bool success = await container.finalizeUser( true );

               if( success ) {
                  // XXX do stuff
                  await initMyProjects( context, container );
                  appState.newUser = false;
                  appState.loaded = true;
                  
                  MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEHomePage());
                  Navigator.push( context, newPage );
               }

               // XXX
               // Person and private lib must exist before signin
               /*
               String pid = randomAlpha(10);
               String editLibId = randomAlpha(10);
               appState.userId = pid;

               List<String> meme = new List<String>();
               meme.add( appState.userId );
               Library editLibrary = new Library( id: editLibId, name: "My Books", private: true, members: meme, imagePng: null, image: null,
                                                  prospect: false );

               String newLib = json.encode( editLibrary );
               String lpostData = '{ "Endpoint": "PutLib", "NewLib": "$newLib" }';
               await putLib( context, container, lpostData );

               
               Person user = new Person( id: pid, firstName: "Marion", lastName: "Star", userName: appState.usernameController.text,
                                         email: appState.attributeController.text, locked: false, imagePng: null, image: null );

               String newUser = json.encode( user );
               String ppostData = '{ "Endpoint": "PutPerson", "NewPerson": "$newUser" }';
               await putPerson( context, container, ppostData );

               appState.newUser = false;
               appState.loading = true;
               await initMyLibraries( context, container );
               appState.loading = false;
               appState.loaded = true;
               
               MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEHomePage());
               Navigator.push( context, newPage );
               */
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
                           Visibility( visible: showCC, child: confirmationCodeField ),
                           SizedBox( height: 5.0),
                           Visibility( visible: !showCC, child: signupButton ),
                           SizedBox( height: 5.0),
                           Visibility( visible: showCC, child: confirmSignupButton ),
                           SizedBox( height: 5.0),
                           Text( appState.cogUser.confirmed?.toString() ?? "UserState here", style: TextStyle(fontStyle: FontStyle.italic))
                           ])))
               
               )));
   }
}
