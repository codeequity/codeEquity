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
import 'package:ceFlutter/models/equityPlan.dart';
import 'package:ceFlutter/models/hostAccount.dart';
import 'package:ceFlutter/models/Linkage.dart';

import 'package:ceFlutter/components/node.dart';
import 'package:ceFlutter/components/equityNode.dart';


class AppState {

   // Credentials
   late String accessToken;
   late String idToken;
   late String refreshToken;
   late int    authRetryCount;
   late bool   cogInitDone;      // main: cog init is async.  Timer refires until this is true
   late String cogPoolId;
   late String cogAppClientId;
   late String cogAppClientSecret;
   late String cogRegion;

   CognitoUserPool? cogUserPool;
   UserService?     cogUserService;
   User?            cogUser;

   // Dev aid
   late int verbose;                           // controls how much is printed to terminal. 0 hardly anything. 3 everything.
   
   late bool newUser;                          // signup: newuser creating a login has some special requirements during setup
   
   late String apiBasePath;                    // where to find lambda interface to aws
   late double screenHeight;
   late double screenWidth;

   // App logic   
   late bool loaded;                           // control expensive aspects of state initialization
   late String userId;

   late Map< String, Map<String, String >> idMapHost;       // host userid to CE user id, hostUserName
   
   late List<PEQ>         myPEQs;                // ??? XXX
   late List<PEQAction>   myPEQActions;          // ??? XXX
   late PEQSummary?       myPEQSummary;          // Summary info for the selectedCEProject
   late Linkage?          myHostLinks;           // Current project/column disposition per ceProject
   late EquityPlan?       equityPlan;            // Equity plan for the selectedCEProject
   late bool peqUpdated;
   late String            funny;                 // placeholder in activity zone.

   late List<HostAccount> myHostAccounts;   
   late bool hostUpdated;

   Node? allocTree;
   late bool  updateAllocTree;
   late HashMap<String, bool> allocExpanded;   // hashmap indicating if allocation node is expanded in summary page.

   EquityNode? equityTree;
   late bool   updateEquityPlan;        // updated the tree, with moves, indents, etc
   late bool   updateEquityView;        // updated the viewable list, with dynamo, or newly updated tree

   late String                          selectedCEProject;
   late String                          selectedUser;    // Looking at details for this user, currently
   late Map< String, List<PEQAction> >  userPActs;       // hostUsers : pactions
   late Map< String, List<PEQ> >        userPeqs;        // hostUsers : peqs where user was pact actor
   late bool                            userPActUpdate;  // need to upate pact list
   late String                          hoverChunk;      // For hover highlighting
   // late Map< String, int >              ingestUpdates;   // These peqIds have n pending updates waiting to finish.

   // UI constants
   final double BASE_TXT_HEIGHT = 20.0;     // 14pt font is 19.2 px height
   final double CELL_HEIGHT     = 50.0;
   final int    MAX_SCROLL_DEPTH = 30;

   final double TINY_PAD        =  6.0;     // minimal padding for text
   final double MID_PAD         =  9.0;     // robust padding for text
   final double FAT_PAD         = 15.0;     // Action button padding
   final double GAP_PAD         = 20.0;     // padding between objects
   
   final DIV_BAR_COLOR          = Colors.grey[200];   // XXX use.  expand.
   final BUTTON_COLOR           = Color(0xff01A0C7);  // XXX
   final BACKGROUND             = Colors.grey[50];    // XXX

   final String ALLOC_USER      = "ilkjdiabaer alloc";    // for use in saving allocations for detail pages
   final String UNASSIGN_USER   = "ksd98glkjwa unassign"; // internal use in saving unassigned for detail pages

   // hesitant to use js_interop to connect to ceServer internal vars.  Repeat a small handful here
   // XXX a startup script would resolve this duplication
   final UNCLAIMED = "UnClaimed";             // set this based on ceServer's config.js
   final PEND      = "Pending PEQ Approval";  // set this based on ceServer's config.js
   final ACCRUED   = "Accrued";               // set this based on ceServer's config.js
   final UNASSIGN  = "Unassigned";            // peq assignee not set.  set this based on ceServer's config.js
   
   
   initAppData() {
      loaded = false;

      userId       = "";
      idMapHost    = new Map<String, Map<String, String>>();  // map: {<hostUserId>: {ceUID:, hostUserName:}} i.e. idMapHost["sysdkag"].ceUID
      myPEQs       = [];
      myPEQActions = [];
      myPEQSummary = null;
      peqUpdated   = false;
      funny        = "";
      equityPlan   = null;

      myHostAccounts = [];         // ceUID+hUID: ceProjects, ceProj.repos for current logged in user
      myHostLinks    = null;
      hostUpdated    = false;      // XXX not in use?

      allocTree        = null;
      updateAllocTree  = false;
      allocExpanded    = HashMap<String, bool>();

      equityTree         = null;
      updateEquityPlan   = false;
      updateEquityView   = false;

      selectedCEProject = "";
      selectedUser = "";
      userPActs = new Map<String, List<PEQAction>>();
      userPeqs = new Map<String, List<PEQ>>();
      userPActUpdate = false;
      hoverChunk = "";
      // ingestUpdates = new Map<String, int>();
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
