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
import 'package:ceFlutter/models/EquityPlan.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/Person.dart';
import 'package:ceFlutter/models/HostAccount.dart';
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
   late String userId;                         // ceuid

   late String                          selectedCEProject;
   late String                          selectedUser;    // Looking at details for this user, currently

   late Map< String, Map<String, String >> idMapHost;       // host userid to CE user id, ceUserName, hostUserName


   // Core data, fetched as needed
   late List<CEProject>                  ceProjects;      // all ceProjects
   late List<Person>                     cePeople;        // all cePeople
   late Map< String, List<PEQAction> >   userPActs;       // hostUser  : pactions                          
   late Map< String, List<PEQ> >         userPeqs;        // hostUser  : peqs where user was pact actor
   late Map< String, List<HostAccount> > ceHostAccounts;  // hostUser  : HostAccount
   late Map< String, List<PEQSummary> >  cePeqSummaries;  // ceProject : PEQSummary
   late Map< String, List<Linkage> >     ceHostLinks;     // ceProject : Linkage
   late Map< String, List<EquityPlan> >  ceEquityPlans;   // ceProject : EquityPlan
   
   // Pointers into Core data
   late PEQSummary?       myPEQSummary;          // Summary info for the selectedCEProject
   late Linkage?          myHostLinks;           // Current project/column disposition for the selectedCEProject
   late EquityPlan?       myEquityPlan;          // Equity plan for the selectedCEProject
   late List<HostAccount> myHostAccounts;        // all host accounts for current ceUser.
   
   late bool hostUpdated;

   late String funny;                 // placeholder in activity zone.
   Node?       allocTree;
   EquityNode? equityTree;

   late HashMap<String, bool> allocExpanded;   // hashmap indicating if allocation node is expanded in summary page.

   late bool   updateAllocTree;
   late bool   updateEquityPlan;        // updated the tree, with moves, indents, etc
   late bool   updateEquityView;        // updated the viewable list, with dynamo, or newly updated tree

   late bool   ceProjectLoading;        // allows spin while ceProject is being constructed from aws
   late bool   peqAllocsLoading;        // allows spin while summary frame peq allocations are being constructed

   late bool   userPActUpdate;  // need to upate pact list
   late String hoverChunk;      // For hover highlighting

   
   // UI constants
   final double MAX_PANE_WIDTH   = 950.0;
   final double MIN_PANE_WIDTH   = 320.0; // iphone5, pixels
   final double MIN_PANE_HEIGHT  = 568.0; // iphone5     

   final double BASE_TXT_HEIGHT  = 20.0;     // 14pt font is 19.2 px height
   final double CELL_HEIGHT      = 50.0;
   final int    MAX_SCROLL_DEPTH = 30;

   final double TINY_PAD        =  6.0;     // minimal padding for text
   final double MID_PAD         =  9.0;     // robust padding for text
   final double FAT_PAD         = 15.0;     // Action button padding
   final double GAP_PAD         = 20.0;     // padding between objects
   
   final DIV_BAR_COLOR          = Colors.grey[200];
   final BUTTON_COLOR           = Color(0xff01A0C7);
   final BACKGROUND             = Colors.grey[50];

   final String EMPTY           = "---";
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
      idMapHost    = new Map<String, Map<String, String>>();  // map: {<hostUserId>: {ceUID:, ceUserName, hostUserName:}} i.e. idMapHost["sysdkag"].ceUID
      funny        = "";

      ceProjects   = [];
      cePeople     = [];
      
      hostUpdated    = false;

      allocTree        = null;
      updateAllocTree  = false;
      allocExpanded    = HashMap<String, bool>();

      equityTree         = null;
      updateEquityPlan   = false;
      updateEquityView   = false;
      ceProjectLoading   = false;
      peqAllocsLoading   = false;

      selectedCEProject = "";
      selectedUser = "";
      
      userPActs      = new Map<String, List<PEQAction>>();
      userPeqs       = new Map<String, List<PEQ>>();
      ceHostAccounts = new Map<String, List<HostAccount>>();
      cePeqSummaries = new Map<String, List<PEQSummary>>();
      ceHostLinks    = new Map<String, List<Linkage>>();
      ceEquityPlans  = new Map<String, List<EquityPlan>>();

      myPEQSummary   = null;
      myEquityPlan   = null;
      myHostAccounts = [];         // ceUID+hUID: ceProjects, ceProj.repos for current logged in user
      myHostLinks    = null;

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
