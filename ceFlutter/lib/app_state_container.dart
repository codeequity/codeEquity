import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'dart:convert';  // json encode/decode

// mobile..
// Note - this requires state here: android/app/src/main/res/raw/awsconfiguration.json
// import 'package:flutter_cognito_plugin/flutter_cognito_plugin.dart';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/utils_load.dart';
import 'package:ceFlutter/cognitoUserService.dart';


class AppStateContainer extends StatefulWidget {
   
  final AppState state;   // codeequity state
  final Widget child;     // This widget is simply the root of the tree, child will be CEApp

  AppStateContainer({ @required this.child, this.state });

  // Return container state with AppState, as the 'of' method which provides state to all children
  static _AppStateContainerState of(BuildContext context) {
     return (context.dependOnInheritedWidgetOfExactType<_InheritedStateContainer>() as _InheritedStateContainer).data;
  }

  
  @override
  _AppStateContainerState createState() => new _AppStateContainerState();
}


class _AppStateContainerState extends State<AppStateContainer> {
  AppState state;  

  // init Cognito
  Future<void> doCogInit() async {
     print( "... Cognito doload in init state" );
     try {
        await getCognitoPoolDetails();
        state.cogUserPool = CognitoUserPool( state.cogPoolId, state.cogAppClientId);
        print("... ... have user pool" );

        state.cogUserService = UserService( state.cogUserPool );
        state.cogUser = User();
        print("... ... have cog user service" );

        await state.cogUserService.init();
        print("... user service init done." );

        // XXX When is the rest of this successfull?  never?
        bool isAuthenticated = await state.cogUserService.checkAuthenticated();
        print( "... auth done." + isAuthenticated.toString() );
        if( isAuthenticated ) {
           state.cogUser = await state.cogUserService.getCurrentUser();
           print( "Got User." );
        }

        // XXX When is the rest of this successfull?  never?
        // XXX old callback
        // XXX flutter_cognito callback mechanism caused a lot of headaches with multiple uncontrolled calls - 
        //     lots of state.loading etc to control for it.  May be able to get rid of most of all of that state.
        // always false at state, until signup
        if( ! state.newUser ) {
           bool success = await finalizeUser( state.newUser );
           if( success ) {
              state.loading = false;
              print ("CALLBACK, loaded TRUE" );
           }
        }

        setState(() {
              state.loaded = ! state.loading;   // XXX should now be able to pare down to 1
              state.authRetryCount += 1;
              if( state.loading ) {
                 state.idToken = null;
                 state.initAppData();
              }
              print( "container callback setstate done, retries " + state.authRetryCount.toString() );
           });
        
     } catch (e, trace) {
        print(e);
        print(trace);
        
        if (!mounted) return;
        setState(() {
              state.returnValue = e;
           });
        
        return;
     }

     if (!mounted) return;
     // Note: main:timer fires with a delay until cogInit is done.
     print( "... Cognito init returning mounted." );
     setState(() {
           state.cogInitDone = true;
        });
  }

  // XXX gatOverride depended on callback.  may need to setstate on override
  // XXX may be able to kill gatOverride in state
  Future<void> getAuthTokens( override ) async {
     print( "GAT, with " + state.idToken );
     state.gatOverride = override;
     if( state.accessToken == "" || state.idToken == "" || override == true) {

        // May not need accessToken, or refreshToken
        String credentials = await state.cogUserService.getCredentials( );
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
     assert( state.newUser == newUser );
     
     if( state.cogUser.confirmed ) {
        print( "Finalizing user token and project setup" );
        await getAPIBasePath();
        await getAuthTokens( false );
        if( !newUser ) {
           await initMyProjects( context, this );        
        }
        return true;
     }
     else {
        print( "User is not confirmed - can not finalize cognito and project setup." );
        return false;
     }
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
     state.usernameController.dispose();
     state.passwordController.dispose();
     state.attributeController.dispose();
     state.confirmationCodeController.dispose();
     super.dispose();
  }

  // XXX Cog errors will look like this
  // Cognito button-press wrapper
  onPressWrapper(fn) {
     wrapper() async {
        String value;
        try {
           value = (await fn()).toString();
        } catch (e, stacktrace) {
           print(e);
           print(stacktrace);
           setState(() => value = e.toString());
        }
        // finally { }
        
        setState(() => state.returnValue = value);
     }
     
     return wrapper;
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
    Key key,
    @required this.data,
    @required Widget child,
  }) : super(key: key, child: child);
  
  // Flutter automatically calls this method when any data in this widget is changed. 
  // can make sure that flutter actually should repaint the tree, or do nothing.
  // It helps with performance.
  @override
  bool updateShouldNotify(_InheritedStateContainer old) => true;
}



