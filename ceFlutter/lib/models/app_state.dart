import 'dart:typed_data';                   // ByteData
import 'dart:collection';                   // hashmap
import 'package:flutter/material.dart';

// Note - this requires state here: android/app/src/main/res/raw/awsconfiguration.json
//import 'package:flutter_cognito_plugin/flutter_cognito_plugin.dart';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';
import 'package:ceFlutter/cognitoUserService.dart';

import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/PEQAction.dart';
import 'package:ceFlutter/models/PEQSummary.dart';
import 'package:ceFlutter/models/ghAccount.dart';
import 'package:ceFlutter/models/Linkage.dart';

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

   // Dev aid
   int verbose;           // controls how much is printed to terminal. 0 hardly anything. 3 everything.
   
   bool newUser;          // signup: newuser creating a login has some special requirements during setup
   
   String apiBasePath;                         // where to find lambda interface to aws
   double screenHeight;
   double screenWidth;

   // App logic   
   bool loaded;                              // control expensive aspects of state initialization
   String userId;

   Map< String, String > idMapGH;         // github userid to CE user id
   
   List<PEQ>       myPEQs;                // ??? 
   List<PEQAction> myPEQActions;          // ???
   PEQSummary      myPEQSummary;          // XXX need 1 proj, one my per repo
   Linkage         myGHLinks;             // Current project/column disposition for current repo in github
   bool peqUpdated;

   List<GHAccount> myGHAccounts;   
   bool ghUpdated;

   Node allocTree;
   bool updateAllocTree;
   bool expansionChanged;

   HashMap<String, bool> allocExpanded;   // hashmap indicating if allocation node is expanded in summary page.
   

   String                          selectedRepo;
   String                          selectedUser;    // Looking at details for this user, currently
   Map< String, List<PEQAction> >  userPActs;       // ghUsers : pactions
   Map< String, List<PEQ> >        userPeqs;        // ghUsers : peqs where user was pact actor
   bool                            userPActUpdate;  // need to upate pact list
   Map< String, int >              ingestUpdates;   // These peqIds have n pending updates waiting to finish.

   // UI constants
   final double BASE_TXT_HEIGHT = 20.0;     // 14pt font is 19.2 px height
   final double CELL_HEIGHT     = 50.0;

   final double TINY_PAD        =  6.0;     // minimal padding for text
   final double MID_PAD         =  9.0;     // robust padding for text
   final double FAT_PAD         = 15.0;     // Action button padding
   final double GAP_PAD         = 20.0;     // padding between objects
   
   final DIV_BAR_COLOR          = Colors.grey[200];   // XXX use.  expand.
   final BUTTON_COLOR           = Color(0xff01A0C7);  // XXX
   final BACKGROUND             = Colors.grey[50];    // XXX

   final String ALLOC_USER      = "ilkjdiabaer alloc";    // for use in saving allocations for detail pages
   final String UNASSIGN_USER   = "ksd98glkjwa unassign"; // for use in saving unassigned for detail pages
   
   initAppData() {
      loaded = false;

      userId       = "";
      idMapGH      = new Map<String, String>();
      myPEQs       = [];
      myPEQActions = [];
      myPEQSummary = null;
      peqUpdated   = false;

      myGHAccounts = [];
      myGHLinks    = null;
      ghUpdated    = false;      // XXX not in use?

      allocTree = null;
      updateAllocTree = false;
      expansionChanged = false;

      allocExpanded = HashMap<String, bool>();

      selectedRepo = "";
      selectedUser = "";
      userPActs = new Map<String, List<PEQAction>>();
      userPeqs = new Map<String, List<PEQ>>();
      userPActUpdate = false;
      ingestUpdates = new Map<String, int>();
   }

   init() {
      screenHeight = -1;
      screenWidth  = -1;
      verbose      = 1;
      
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
