// 8/2020
// Based on https://pub.dev/packages/amazon_cognito_identity_dart_2/example

import 'dart:async';
import 'dart:convert';

import 'package:amazon_cognito_identity_dart_2/cognito.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/awsUtils.dart';


// Extend CognitoStorage with Shared Preferences to persist account
// login sessions
class Storage extends CognitoStorage {
   SharedPreferences _prefs;
   Storage(this._prefs);
   
   @override
      Future getItem(String key) async {
      String? item;
      try {
         if( key != null ) {
            item = json.decode( ( _prefs.getString(key)) ?? "" );
            if( item == "" ) { print( "Warning.  item malformed " + key.toString() ); }
         }
         else { item = null; }
      } catch (e) {
         return null;
      }
      return item;
   }
   
   @override
      Future setItem(String key, value) async {
      await _prefs.setString(key, json.encode(value));
      return getItem(key);
   }
   
   @override
      Future removeItem(String key) async {
      final item = getItem(key);
      if (item != null) {
         await _prefs.remove(key);
         return item;
      }
      return null;
   }
   
   @override
      Future<void> clear() async {
      await _prefs.clear();
   }
}

class User {
   String? email;
   String? name;
   String? preferredUserName;
   String? password;
   bool confirmed = false;
   bool hasAccess = false;
   
   User({this.email, this.name});
   
   // Decode user from Cognito User Attributes
   factory User.fromUserAttributes(List<CognitoUserAttribute> attributes) {
      final user = User();
      attributes.forEach((attribute) {
            if (attribute.getName() == 'email') {
               user.email = attribute.getValue();
            } else if (attribute.getName() == 'name') {
               user.name = attribute.getValue();
            } else if (attribute.getName() == 'preferred_username') {
               user.preferredUserName = attribute.getValue();
            }
         });
      // print( "XXX USER Attr " + attributes.toString() );
      return user;
   }
}

class UserService {
   CognitoUserPool?    _userPool;
   CognitoUser?        _cognitoUser;
   CognitoUserSession? _session;
   CognitoCredentials? credentials;
   
   UserService(this._userPool);

   // Initiate user session from local storage if present
   Future<bool> init() async {
      print( "cogUserService: Enter" );
      final prefs = await SharedPreferences.getInstance();
      final storage = Storage(prefs);
      print( "... .. cogUserService got storage" );

      assert( _userPool != null );
      _userPool!.storage = storage;
      
      _cognitoUser = await _userPool!.getCurrentUser();
      print( "... .. cogUserService got currentUser" );
      
      if (_cognitoUser == null) {
         print( "... .. No cognito user... yet" );
         print( "cogUserService: Exit" );
         return false;
      }
      try {
         print( "... .. before cogUserService getSession" );
         _session = await _cognitoUser!.getSession();
         print( "... .. cogUserService got session" );
      } on CognitoClientException catch (e) {
         if( e.code == "NotAuthorizedException" ) {
            print( " XXX Expired refresh token? " + e.toString() );
         }
         rethrow;
      }

      print( (_cognitoUser ?? "").toString() );
      print( (_session ?? "").toString() );
      print( (_userPool ?? "").toString() );
      print( (credentials ?? "").toString() );
      
      assert( _session != null );
      print( "cogUserService: Exit" );
      return _session!.isValid();
   }
   
   // Get existing user from session with his/her attributes
   Future<User?> getCurrentUser() async {
      if( _cognitoUser == null || _session == null || !_session!.isValid() ) {
         return null;
      }

      final attributes = await _cognitoUser!.getUserAttributes();
      if( attributes == null ) {
         return null;
      }
      final user = User.fromUserAttributes(attributes);
      user.hasAccess = true;
      return user;
   }
   
   // Retrieve user credentials -- for use with other AWS services
   Future<String?> getCredentials() async {
      if (_cognitoUser == null || _session == null) {
         print( "Uh oh.. null doodies" );
         return null;
      }

      // identity pool id != user pool id.   maybe good for signing requests?
      // credentials = CognitoCredentials( identityPoolId, _userPool);
      // await credentials.getAwsCredentials(_session.getIdToken().getJwtToken());
      // await _session.getAwsCredentials(_session.getIdToken().getJwtToken());
      return _session!.getIdToken().getJwtToken();
   }
   
   // Login user
   Future<User?> login(String name, String password) async {
      print( "Cog start login" );
      // print( "XXX Cog start login " + name +  " " + password);
      assert( _userPool != null );
      _cognitoUser = CognitoUser(name, _userPool!, storage: _userPool!.storage);

      assert( _cognitoUser != null );

      final authDetails = AuthenticationDetails(
         username: name,
         password: password,
         );
      
      bool isConfirmed;
      try {
         print( "Show toast" );
         showToast( "Authenticating.. can take a few seconds." );

         Stopwatch stopwatch = new Stopwatch()..start();
         _session = await _cognitoUser!.authenticateUser(authDetails);
         print(' ...authenticate executed in ${stopwatch.elapsed}');
         
         isConfirmed = true;
      } on CognitoClientException catch (e) {
         if (e.code == 'UserNotConfirmedException') {
            isConfirmed = false;
         } else {
            rethrow;
         }
      }
      
      if (_session == null || !_session!.isValid()) {
         return null;
      }

      Stopwatch stopwatch = new Stopwatch()..start();      
      final attributes = await _cognitoUser!.getUserAttributes();
      print(' ...getAttribs executed in ${stopwatch.elapsed}');

      assert( attributes != null );
      final user = User.fromUserAttributes(attributes!);
      user.confirmed = isConfirmed;
      user.hasAccess = true;
      
      return user;
   }
   
   // Confirm user's account with confirmation code sent to email
   Future<bool> confirmAccount(String name, String confirmationCode) async {
      bool retVal = false;
      assert( _userPool != null );
      _cognitoUser = CognitoUser(name, _userPool!, storage: _userPool!.storage);

      if( _cognitoUser != null ) {
         retVal = await _cognitoUser!.confirmRegistration(confirmationCode);
      }
      return retVal;
   }
   
   // Resend confirmation code to user's email
   Future<void> resendConfirmationCode(String name) async {
      assert( _userPool != null );
      _cognitoUser = CognitoUser(name, _userPool!, storage: _userPool!.storage);

      if( _cognitoUser != null ) { await _cognitoUser!.resendConfirmationCode(); }
      else { print( "Warning.  CognitoUser not available.  Resend failed." ); }
   }
   
   // Check if user's current session is valid
   Future<bool> checkAuthenticated() async {
      if (_cognitoUser == null || _session == null) {
         return false;
      }
      return _session!.isValid();
   }

   // XXX Note, user not being caught here - wait for confirmation code.  Could remove lower portion
   Future<User> signUp(String email, String password, String name) async {
      CognitoUserPoolData data;
      final userAttributes = [ AttributeArg(name: 'email', value: email ), AttributeArg(name: 'preferred_username', value: name )];

      assert( _userPool != null );
      data = await _userPool!.signUp(name, password, userAttributes: userAttributes);
      
      final user = User();
      user.email = email;
      user.name = name;
      user.confirmed = data.userConfirmed ?? false;
      
      return user;
   }
   
   Future<User> signOut() async {
      if (credentials != null) {   await credentials!.resetAwsCredentials(); }
      if (_cognitoUser != null) {  _cognitoUser!.signOut();  }

      final user = User();
      user.email = "";
      user.name = "";
      user.confirmed = false;
      user.hasAccess = false;
      return user;
   }
}

// XXX Note - several of these need more client-friendly toasts
// XXX App out of date.. sensible here?
cognitoSignupWrapper(context, fn) {
   wrapper() async {
      try {
         await fn();
      } on CognitoClientException catch (e) {
         bool validConfig = await checkValidConfig( context );
         if( !validConfig ) {
            showToast( "Your app is out of date.  Please update CodeEquity and try again." );
         }
         String toasty = "";
         switch( e.code ) {
         case 'UsernameExistsException' :  { toasty = "Username already exists, please choose another."; }
            break;
         case 'InvalidPasswordException': { toasty = "Password needs 8 chars, some Caps, and some not in the alphabet."; }
            break;
         case 'InvalidParameterException':
            {
               toasty = "Invalid parameter.";
               if( e.toString().contains("\'password\' failed") )
               {
                  toasty = "Password needs 8 chars, some Caps, and some not in the alphabet."; 
               }
               else if(e.toString().contains("Invalid email address") )
               {
                  toasty = "Email address is broken.";
               }
               else if( e.toString().contains("User does not exist") )
               {
                  toasty = "Username or password is incorrect";
               }
               else if( e.toString().contains("Member must satisfy") )
               {
                  toasty = "Username needs 1+ chars, no whitespace allowed.";
               }
               else
               {
                  print(e);
               }
            }
            break;
         case 'CodeMismatchException': { toasty = "Code mismatch exception."; }
            break;
         case 'NotAuthorizedException': { toasty = "Username or password is incorrect."; }
            break;
         case 'UserNotFoundException': { toasty = "User not found."; }
            break;
         case 'ResourceNotFoundException': { toasty = "Resource not found."; }
            break;
         default:                          { toasty = "Uh oh, brain fart!"; }
            break;
         }
         showToast( toasty );
         print( e.code.toString() );
         print( e.message );
      } catch(e, stacktrace) {
         bool validConfig = await checkValidConfig( context );
         if( !validConfig ) {
            showToast( "Your app is out of date.  Please update CodeEquity and try again." );
         }
         print(e);
         print(stacktrace);
         print( "Note.  Errors here may indicate runtime error in awsDynamo." );
         showToast( e.toString() );
      }           
      // finally {}
   }
   return wrapper;
}

