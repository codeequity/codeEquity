import 'dart:typed_data';                   // ByteData
import 'package:flutter/material.dart';

// Note - this requires state here: android/app/src/main/res/raw/awsconfiguration.json
//import 'package:flutter_cognito_plugin/flutter_cognito_plugin.dart';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';
import 'package:ceFlutter/cognitoUserService.dart';

import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/PEQAction.dart';
import 'package:ceFlutter/models/PEQSummary.dart';
import 'package:ceFlutter/models/ghAccount.dart';

import 'package:ceFlutter/components/node.dart';


class AppState {

   // Credentials
   String accessToken;
   String idToken;
   String refreshToken;
   int authRetryCount;
   bool cogInitDone;      // main: cog init is async.  Timer refires until this is true
   String cogPoolId;
   String cogAppClientId;
   String cogAppClientSecret;
   String cogRegion;

   CognitoUserPool cogUserPool;
   UserService cogUserService;
   User cogUser;

   bool newUser;          // signup: newuser creating a login has some special requirements during setup
   
   String apiBasePath;                         // where to find lambda interface to aws
   TextEditingController usernameController;   
   TextEditingController passwordController;
   TextEditingController attributeController; 
   TextEditingController confirmationCodeController;
   double screenHeight;
   double screenWidth;

   // App logic   
   bool loaded;                              // control expensive aspects of state initialization
   String userId;

   List<PEQ>       myPEQs;                // ??? 
   List<PEQAction> myPEQActions;          // ???
   PEQSummary myPEQSummary;               // XXX need 1 proj, one my per repo
   bool peqUpdated;

   List<GHAccount> myGHAccounts;   
   bool ghUpdated;

   Node allocTree;
   bool updateAllocTree;

   String                          selectedRepo;
   String                          selectedUser;    // Looking at details for this user, currently
   Map< String, List<PEQAction> >  userPActs;       // ghUsers : pactions
   Map< String, List<PEQ> >        userPeqs;        // ghUsers : peqs where user was pact actor
   bool                            userPActUpdate;  // need to upate pact list

   initAppData() {
      loaded = false;

      userId = "";
      myPEQs = [];
      myPEQActions = [];
      myPEQSummary = null;
      peqUpdated = false;

      myGHAccounts = [];
      ghUpdated = false;

      allocTree = null;
      updateAllocTree = false;

      selectedRepo = "";
      selectedUser = "";
      userPActs = new Map<String, List<PEQAction>>();
      userPeqs = new Map<String, List<PEQ>>();
      userPActUpdate = false;
   }

   init() {
      screenHeight = -1;
      screenWidth = -1;
      
      // Cognito values
      authRetryCount = 0;
      accessToken = "";
      idToken = "";
      refreshToken = "";
      cogInitDone = false;
      cogPoolId = "";
      cogAppClientId = "";
      cogAppClientSecret = "";
      cogRegion = "";
      cogUserPool = null;
      cogUserService = null;
      cogUser = null;
      newUser = false;
      
      apiBasePath = "";
      usernameController = TextEditingController();
      passwordController = TextEditingController();
      attributeController = TextEditingController();
      confirmationCodeController = TextEditingController();

      initAppData();
   }

   
   AppState() {
      init();
   }
   
   // A constructor for when the app is loading.
   factory AppState.loading() => new AppState();

  @override
  String toString() {
     return 'AppState';
  }
}
