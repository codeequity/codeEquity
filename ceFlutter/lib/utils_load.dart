import 'dart:convert';  // json encode/decode
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
// import 'package:flutter_cognito_plugin/flutter_cognito_plugin.dart';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';
import 'package:http/http.dart' as http;

import 'package:ceFlutter/utils.dart';

import 'package:ceFlutter/screens/launch_page.dart';

import 'package:ceFlutter/models/PEQ.dart';

void logout( context, container, appState ) async {
   final wrapper = (() async {
         appState.cogUser = await appState.cogUserService.signOut();
         
         // Rebuilding page below, don't need to setState (which isn't available here). 
         appState.usernameController.clear();
         appState.passwordController.clear();
         appState.attributeController.clear();
         appState.confirmationCodeController.clear();
         Navigator.pushAndRemoveUntil(
            context, 
            MaterialPageRoute(builder: (context) => CELaunchPage()),
            ModalRoute.withName("CESplashPage")
            );
      });
   wrapper();
}      

Future<void> logoutWait( context, container, appState ) async {
   final wrapper = container.onPressWrapper(() async {
         //await Cognito.signOut();
         
         // Rebuilding page below, don't need to setState (which isn't available here). 
         appState.usernameController.clear();
         appState.passwordController.clear();
         appState.attributeController.clear();
         appState.confirmationCodeController.clear();
      });
   wrapper();
}      


bool checkReauth( context, container ) {
   final appState  = container.state;
   print( "" );
   print( "" );
   print( "" );
   print (" !!! !!! !!!" );
   print (" !!! !!!" );
   print (" !!!" );
   print( "Refreshing tokens.." );
   print (" !!!" );
   print (" !!! !!!" );
   print (" !!! !!! !!!" );
   print( "" );
   print( "" );
   print( "" );
   showToast( context, "Cloud tokens expired, reauthorizing.." );
   
   appState.authRetryCount += 1; 
   if( appState.authRetryCount > 100 ) {
      print( "Too many reauthorizations, please sign in again" );
      logout( context, container, appState );
      showToast( context, "Reauthorizing failed - your cloud authorization has expired.  Please re-login." ); 
      return false;
   }
   else { return true; }
}

// XXX Dup now?
Future<bool> checkValidConfig( context ) async {
   print( "Validating configuration" );

   String baseConfigS = await DefaultAssetBundle.of(context).loadString('files/awsconfiguration.json');
   final baseConfig = json.decode( baseConfigS );

   final poolId = baseConfig["CognitoUserPool"]["Default"]["PoolId"];
   final region = baseConfig["CognitoUserPool"]["Default"]["Region"];
   final poolKeys = "https://cognito-idp." + region + ".amazonaws.com/" + poolId + "/.well-known/jwks.json";

   print( "Cog Key location: " + poolKeys );

   var response = await http.get( poolKeys );
   var rbody = json.decode(utf8.decode(response.bodyBytes));
   print( "RESPONSE " + rbody.toString() );

   if( rbody.toString().contains( "does not exist" )) { return false; }
   else{ return true; }
}


Future<http.Response> postIt( String shortName, postData, container ) async {
   print( shortName );
   final appState  = container.state;

   final gatewayURL = appState.apiBasePath + "/find";

   if( appState.idToken == "" ) { print( "Access token appears to be empty!"); }
   
   final response =
      await http.post(
         gatewayURL,
         headers: {HttpHeaders.authorizationHeader: appState.idToken},
         body: postData
         );

   return response;
}


// If failure is authorization, we can reauthorize to fix it, usually
Future<bool> checkFailure( response, shortName, context, container ) async {
   bool retval = false;
   if (response.statusCode == 401 ) {  
      if( checkReauth( context, container ) ) {
         await container.getAuthTokens( true );
         retval = true;
      }
   }
   else {
      print( "RESPONSE: " + response.statusCode.toString() + " " + json.decode(utf8.decode(response.bodyBytes)).toString());
      throw Exception( shortName + ': AWS data failed to load.');
   }

   return retval;
}



// XXX placeholder
// Called on signin
Future<void> initMyProjects( context, container ) async {
   print( "initMyProjects" );
   final appState  = container.state;

   // NOTE personID not yet set
   appState.myPEQs = await fetchPEQs(  context, container, '{ "Endpoint": "GetPEQ" }' );

}

Future<List<PEQ>> fetchPEQs( context, container, postData ) async {
   String shortName = "fetchPEQ";
   final response = await postIt( shortName, postData, container );
   
   if (response.statusCode == 201) {
      Iterable l = json.decode(utf8.decode(response.bodyBytes));
      List<PEQ> peqs = l.map((sketch)=> PEQ.fromJson(sketch)).toList();
      return peqs;
   } else {
      bool didReauth = await checkFailure( response, shortName, context, container );
      if( didReauth ) { return await fetchPEQs( context, container, postData ); }
   }
}
