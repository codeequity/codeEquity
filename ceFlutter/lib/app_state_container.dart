import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'dart:convert';  // json encode/decode

import 'package:localstore/localstore.dart';

// mobile..
// Note - this requires state here: android/app/src/main/res/raw/awsconfiguration.json
// import 'package:flutter_cognito_plugin/flutter_cognito_plugin.dart';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';

import 'package:ceFlutter/cognitoUserService.dart';

import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/app_state.dart';

class AppStateContainer extends StatefulWidget {
   
  final AppState state;   // codeequity state
  final Widget child;     // This widget is simply the root of the tree, child will be CEApp

  AppStateContainer({ required this.child, required this.state });

  // Return container state with AppState, as the 'of' method which provides state to all children
  static _AppStateContainerState of(BuildContext context) {
     return (context.dependOnInheritedWidgetOfExactType<_InheritedStateContainer>() as _InheritedStateContainer).data;
  }

  
  @override
  _AppStateContainerState createState() => new _AppStateContainerState();
}


class _AppStateContainerState extends State<AppStateContainer> {
  late AppState state;

  // Create localstore instance
  // XXX remove this once cookies are in place from webServer
  final _db = Localstore.instance;

  // init Cognito
  Future<void> doCogInit() async {
     print( "... Cognito doload in init state" );
     try {
        bool loaded = false;
        await getCognitoPoolDetails();
        state.cogUserPool = CognitoUserPool( state.cogPoolId, state.cogAppClientId);
        print("... ... have user pool" );

        state.cogUserService = await UserService( state.cogUserPool );
        assert( state.cogUserService != null ); 

        state.cogUser = User();
        print("... ... have cog user service and user" );

        await state.cogUserService!.init();
        print("... user service init done." );
        
        // XXX Inactive.  Useful for cookies?
        bool isAuthenticated = state.cogUserService!.checkAuthenticated();
        print( "... auth done: " + isAuthenticated.toString() );
        if( isAuthenticated ) {
           state.cogUser = await state.cogUserService!.getCurrentUser();
           print( "Got User: " );
        }

        // XXX Inactive.  Useful for cookies?
        // always false at state, until signup
        if( ! state.newUser ) {
           loaded = await finalizeUser( state.newUser );
        }

        setState(() {
              state.loaded = loaded;
              state.authRetryCount += 1;
              print( "container callback setstate done, retries " + state.authRetryCount.toString() );
           });
        
     } catch (e, trace) {
        print(e);
        print(trace);
        
        if (!mounted) return;
        
        return;
     }

     if (!mounted) return;
     // Note: main:timer fires with a delay until cogInit is done.
     print( "... Cognito init returning mounted." );
     setState(() {
           state.cogInitDone = true;
        });
  }

  Future<void> getAuthTokens( override ) async {
     // print( "GAT, with " + state.idToken );
     if( state.accessToken == "" || state.idToken == "" || override ) {

        // May not need accessToken, or refreshToken
        assert( state.cogUserService != null );         
        String credentials = "";

        if( override ) {
           print( "REFRESHING" );
           await state.cogUserService!.refresh();
           state.authRetryCount = 0;
        }

        credentials = ( await state.cogUserService!.getCredentials() ) ?? "";
        if( credentials == "" ) { print( "Warning.  Empty credentials." ); }

        assert( state.cogUser != null );
        // print( "GAT, new " + credentials );
        print( "GAT set: " + (state.cogUser!.email ?? ""));
        _db.collection('userNames').doc('userName').set({
           'uname': state.cogUser!.email,
                 'credentials': credentials
                 });
        
        setState(() {
              // state.accessToken = accessToken;   
              // state.refreshToken = refreshToken;
              state.idToken = credentials;
           });
     }
  }


  Future<void> getCognitoPoolDetails() async {
     if( state.cogPoolId == "" ) {
        
        String cogData = await DefaultAssetBundle.of(context).loadString('files/awsconfiguration.json');
        final cogJson = json.decode( cogData );
        print( cogJson );
        setState(() {
              state.cogPoolId          = cogJson['CognitoUserPool']['Default']['PoolId'];
              state.cogAppClientId     = cogJson['CognitoUserPool']['Default']['AppClientId'];
              state.cogAppClientSecret = cogJson['CognitoUserPool']['Default']['AppClientSecret'];
              state.cogRegion          = cogJson['CognitoUserPool']['Default']['Region'];
           });
        print( "Cog pool details loaded, id: " + state.cogPoolId );
     }
  }

  Future<void> getAPIBasePath() async {
     if( state.apiBasePath == "" ) {
        String basePath = await DefaultAssetBundle.of(context).loadString('files/api_base_path.txt');
        setState(() {
              state.apiBasePath = basePath.trim();
           });
     }
  }

  Future<bool> finalizeUser( newUser ) async {
     assert( state.newUser  == newUser );
     assert( state.cogUser != null );
     
     String name  = state.cogUser!.name ?? "";
     String email = state.cogUser!.email ?? "";
     print( "Finalize User " + name + " " + email );
     
     // XXX ooh temp workaround only
     final cookie = await _db.collection('userNames').doc('userName').get();
     // print( "XXX erm... " + cookie.toString() );
     
     if( state.cogUser!.confirmed ) {
        await getAuthTokens( false );
     }
     else if( cookie != null && cookie['uname'] == email ) {
        print( "setting credentials.  no setstate, triggers newUser" );
        state.idToken = cookie['credentials'];
        state.cogUser!.confirmed = true;
        state.cogUser!.hasAccess = true;
     }
     else {
        print( "User is not confirmed - can not finalize cognito and project setup." );
        return false;
     }

     print( "Finalizing user token and project setup" );
     await getAPIBasePath();
     if( !newUser ) {
        await initMDState( context, this );
        state.updateAllocTree = true;                 // forces buildAllocationTree upon loading page first time
        state.updateEquityPlan = true;                
        state.updateEquityView = true;                
     }
     return true;
  }

  @override
  void initState() {
     super.initState();

     print("Container init" );
        
     if (widget.state != null) {
        state = widget.state;
        print( "AppState: already initialized." );
     } else {
        state = new AppState.loading();
     }

     // No async here.  Timer in main waits for state.loaded
     doCogInit();

     print( "Container init over" );
  }
  
  @override
  void dispose() {
     super.dispose();
     print( "Container dispose" );
  }

  
  // WidgetTree is: AppStateContainer --> InheritedStateContainer --> The rest of your app. 
  @override
  Widget build(BuildContext context) {
     return new _InheritedStateContainer( data: this, child: widget.child );
  }
}



class _InheritedStateContainer extends InheritedWidget {

   final _AppStateContainerState data;     // The data is whatever this widget is passing down.

  // InheritedWidgets are always just wrappers.
  // Flutter knows to build the Widget thats passed to it, so no build method
  _InheritedStateContainer({
    Key? key,
    required this.data,
    required Widget child,
  }) : super(key: key, child: child);
  
  // Flutter automatically calls this method when any data in this widget is changed. 
  // can make sure that flutter actually should repaint the tree, or do nothing.
  // It helps with performance.
  @override
  bool updateShouldNotify(_InheritedStateContainer old) => true;
}



