// 8/2020
// Based on https://pub.dev/packages/amazon_cognito_identity_dart_2/example

import 'dart:async';
import 'dart:convert';

import 'package:amazon_cognito_identity_dart_2/cognito.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';


/// Extend CognitoStorage with Shared Preferences to persist account
/// login sessions
class Storage extends CognitoStorage {
  SharedPreferences _prefs;
  Storage(this._prefs);

  @override
  Future getItem(String key) async {
    String item;
    try {
      item = json.decode(_prefs.getString(key));
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
  String email;
  String name;
  String password;
  bool confirmed = false;
  bool hasAccess = false;

  User({this.email, this.name});

  /// Decode user from Cognito User Attributes
  factory User.fromUserAttributes(List<CognitoUserAttribute> attributes) {
    final user = User();
    attributes.forEach((attribute) {
      if (attribute.getName() == 'email') {
        user.email = attribute.getValue();
      } else if (attribute.getName() == 'name') {
        user.name = attribute.getValue();
      }
    });
    return user;
  }
}

class UserService {
  CognitoUserPool _userPool;
  CognitoUser _cognitoUser;
  CognitoUserSession _session;
  UserService(this._userPool);
  CognitoCredentials credentials;

  /// Initiate user session from local storage if present
  Future<bool> init() async {
    final prefs = await SharedPreferences.getInstance();
    final storage = Storage(prefs);
    _userPool.storage = storage;

    _cognitoUser = await _userPool.getCurrentUser();
    if (_cognitoUser == null) {
      return false;
    }
    _session = await _cognitoUser.getSession();
    return _session.isValid();
  }

  /// Get existing user from session with his/her attributes
  Future<User> getCurrentUser() async {
    if (_cognitoUser == null || _session == null) {
      return null;
    }
    if (!_session.isValid()) {
      return null;
    }
    final attributes = await _cognitoUser.getUserAttributes();
    if (attributes == null) {
      return null;
    }
    final user = User.fromUserAttributes(attributes);
    user.hasAccess = true;
    return user;
  }

   /*
     // identity pool id != user pool id.   maybe good for signing requests?
  /// Retrieve user credentials -- for use with other AWS services
  Future<CognitoCredentials> getCredentials( identityPoolId ) async {
    if (_cognitoUser == null || _session == null) {
      return null;
    }
    print( "Cog User Service, getCreds" );
    credentials = CognitoCredentials( identityPoolId, _userPool);
    await credentials.getAwsCredentials(_session.getIdToken().getJwtToken());
    return credentials;
  }
   */

   /// Retrieve user credentials -- for use with other AWS services
   Future<String> getCredentials() async {
      if (_cognitoUser == null || _session == null) {
         print( "Uh oh.. null doodies" );
         return null;
      }
      print( "Cog User Service, getCreds.  Session next: XXXXX" );
      print( _session.toString() );
      
      // getAccessToken().getJwtToken())
      // await _session.getAwsCredentials(_session.getIdToken().getJwtToken());
      return _session.getIdToken().getJwtToken();
   }

   // XXX
  /// Login user
  Future<User> login(String name, String password) async {
    _cognitoUser = CognitoUser(name, _userPool, storage: _userPool.storage);

    final authDetails = AuthenticationDetails(
      username: name,
      password: password,
    );

    bool isConfirmed;
    try {
      _session = await _cognitoUser.authenticateUser(authDetails);
      isConfirmed = true;
    } on CognitoClientException catch (e) {
      if (e.code == 'UserNotConfirmedException') {
        isConfirmed = false;
      } else {
        rethrow;
      }
    }

    if (!_session.isValid()) {
      return null;
    }

    final attributes = await _cognitoUser.getUserAttributes();
    final user = User.fromUserAttributes(attributes);
    user.confirmed = isConfirmed;
    user.hasAccess = true;

    return user;
  }

  /// Confirm user's account with confirmation code sent to email
  Future<bool> confirmAccount(String name, String confirmationCode) async {
    _cognitoUser = CognitoUser(name, _userPool, storage: _userPool.storage);

    return await _cognitoUser.confirmRegistration(confirmationCode);
  }

  /// Resend confirmation code to user's email
  Future<void> resendConfirmationCode(String name) async {
    _cognitoUser = CognitoUser(name, _userPool, storage: _userPool.storage);
    await _cognitoUser.resendConfirmationCode();
  }

  /// Check if user's current session is valid
  Future<bool> checkAuthenticated() async {
    if (_cognitoUser == null || _session == null) {
      return false;
    }
    return _session.isValid();
  }

   // XXX NOTE this original code decided email was username... bah.
   // Sign upuser
   Future<User> signUp(String email, String password, String name) async {
      CognitoUserPoolData data;
      // final userAttributes = [ AttributeArg(name: 'name', value: name) ];
      // data = await _userPool.signUp(email, password, userAttributes: userAttributes);
      final userAttributes = [ AttributeArg(name: 'email', value: email )];
      data = await _userPool.signUp(name, password, userAttributes: userAttributes);
      
      final user = User();
      user.email = email;
      user.name = name;
      user.confirmed = data.userConfirmed;
      
      return user;
   }

  Future<void> signOut() async {
    if (credentials != null) {
      await credentials.resetAwsCredentials();
    }
    if (_cognitoUser != null) {
      return _cognitoUser.signOut();
    }
  }
}
