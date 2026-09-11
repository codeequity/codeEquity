import 'dart:convert';                   // json encode/decode, b64 coding
import 'package:flutter/material.dart';
import 'dart:math';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ghUtils.dart';      // associateGH
import 'package:ceFlutter/utils/ceUtils.dart';
import 'package:ceFlutter/utils/awsUtils.dart';

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/HostAccount.dart';

import 'package:ceFlutter/screens/home_page.dart';


void initRepos( context, container, CEProject cep ) async {
   final appState = container.state;
   assert( cep.hostPlatform == HostPlatforms.GitHub );
   final textWidth = appState.MIN_PANE_WIDTH * 0.6;
   
   void _cancel() {
      Navigator.of( context ).pop( 'cancel');
   }

   print( "We have ce person " + appState.ceUserId );
   HostAccount? myAcct = null;
   
   List<HostAccount>? has = appState.ceHostAccounts[ appState.ceUserId ];
   if( has != null ) {
      for( HostAccount ha in has! ) {
         if( ha.hostUser.hostPlatform == cep.hostPlatform ) {
            myAcct = ha;
         }
      }
   }

   void _save( List<bool> on ) {
      print( "ON " + on.toString() );
   }

   void _cancelPop( context ) {
      print( "Cancel repo" );
      Navigator.of( context ).pop();
   }
   
   // XXX verify organization
   if( myAcct != null ) {
      print( "Already have Host Account.  " + myAcct.toString() );

      // refresh - this will update futureCERepos - i.e. those not already part of a CEP
      await updateGHRepos( context, container );
      myAcct.hostUser.ceProjectIds.add( cep.ceProjectId );
      
      List<String> candidate = [];
      
      for( String repo in myAcct.hostUser.futureCEProjects ) {
         // makeToolTip "Repositories can only belong to one project.  Click to add it."
         candidate.add( repo );
      }
      
      if( candidate.length == 0 ) {
         String msg = "No candidate repositories were found.  Candidates must be in the " + cep.hostOrganization + " organization, ";
         msg       += "and you must be a member of that organization with access to the candidate repository.";
         Widget body = makeBodyText( appState, msg, textWidth * 3, true, 2 );
         confirm( context, "No candidates found", msg, _cancel, _cancel, body: body );
      }
      else {
         await showDialog(
            context: context,
            builder: (BuildContext context) => CheckboxDialog( appState: appState, header: "Repos", choices: ["Aaaaa", "Bbbbbb"], saveFunc: _save, cancelFunc: _cancelPop ));
      }
      
      // XXX update aws hostUser, ceProject .. note that some of these have already happened
   }
   else {
      print( "No host account yet.  add it" ); 
   }
   
}

void initProject( context, container, CEProject cep ) async {
   void _cancel() {
      Navigator.of( context ).pop();
   }

   // XXX This is leaking.  
   List<TextEditingController?> controllers = [ null, null, null, new TextEditingController()];

   void _save( List<String> saveData ) async {
      assert( controllers.length == 4 && controllers[3] != null );
      print( "HO! " + saveData.toString() + " " + controllers[3]!.text );

      // NOTE hostUser does not necessarily exist yet
      cep.hostPlatform     = enumFromStr<HostPlatforms>( saveData[0], HostPlatforms.values );
      cep.ownerCategory    = saveData[1];
      cep.projectMgmtSys   = saveData[2];
      cep.hostOrganization = controllers[3]!.text;

      String cepS = json.encode( cep );
      String postData = '{ "Endpoint": "UpdateCEP", "ceProject": $cepS }';
      await updateDynamo( context, container, postData, "UpdateCEP" );
      
      Navigator.of( context ).pop();
   }
   
   assert( cep.ceProjectId != "" );
   assert( cep.ceVentureId != "" );
   final appState = container.state;

   // Note ghOptions plus controllers means every header will either be paired with a list of options, or a textEditingController
   String       popupTitle       = "Describe where and how your code is hosted:";
   List<String> header           = ["Host platform", "Owner category", "Host project management version", "Organization name on host"];
   List<bool>   dropDown         = [ true,           true,             true,                              false ];
   List<List<String>> ghOptions  = [["GitHub"],
                                    ["Organization", "Individual"],
                                    ["GH Version 2", "GH Classic" ],
                                    []   ];
   List<String> curVals          = ["", "", "", "<Elgoog Inc>"];
   List<String> ghToolTips       = ["CodeEquity is working to expand to other hosting platforms",
                                    "Individual owners are no longer fully supported on GitHub, nor on CodeEquity",
                                    "GH Classic is legacy on GitHub, no longer supported on CodeEquity",
                                    "Enter the name of the host organization that owns your code repositories" ];

   
   await showDropdownDialog( context, container, popupTitle, header, dropDown, ghOptions, curVals, ghToolTips, controllers, _save, _cancel );
}

      

class CEAddHostPage extends StatefulWidget {
   CEAddHostPage({Key? key}) : super(key: key);

  @override
  _CEAddHostState createState() => _CEAddHostState();
}

class _CEAddHostState extends State<CEAddHostPage> {

   late Map<String, HostPlatforms> platMap;
   
   late var      container;
   late AppState appState;
   late bool     addHostAcct;

   late TextEditingController pat;

   static const maxPaneWidth = 700.0;
   
   @override
   void initState() {
      super.initState();

      addHostAcct = false;
   }

   @override
   void dispose() {
      pat.dispose();
      super.dispose();
   }

   // XXX Deactivate this until PAT is in controller.
   // material button has no maxwidth, adopts parent box. Not co-operative with Container, BoxConstraints.
   // XXX update materialbutton, remove w. (??)
   Widget _ghAssociateButton() {
      final bwidth = 180;
      final w = min( appState.screenWidth - bwidth, maxPaneWidth - bwidth );
      return Row(
         crossAxisAlignment: CrossAxisAlignment.center,
         mainAxisAlignment: MainAxisAlignment.center,
         children: <Widget>[ 
            makeActionButtonFixed(
               appState,
               "Enable Github access",
               bwidth,
               () async
               {
                  bool associated = await associateGithub( context, container, pat.text );
                  MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEHomePage());
                  confirmedNav( context, container, newPage );
               }),
            Container( width: w ),
            ]);
   }

   Widget _makePersonalAccessTokenGH() {
      return Container( width: maxPaneWidth,
                        child: makeInputField( appState, "Github Personal Access Token", false, pat )
         );
   }
   
   
   Widget _makeAssociateGH() {
      // XXX This is not clearly true.  Need PAT each time refresh Host repos, since have to use listRepositories.
      // XXX <Profile> (below in ghexplain) should be clickable, take you to profile. 
      String ghExplain   = "CodeEquity will authenticate your account with Github one time only.  ";
      ghExplain         += "You can undo this association at any time under <Profile>.  ";
      ghExplain         += "Your Personal Access Token allows CodeEquity to make a secure connection to GitHub.";

      // XXX <here> should be clickable, take you to Host page.
      String patExplain  = "To create a Personal Access Token in GitHub, for CodeEquity, follow the instructions <here>.";
         
      return Center(
         child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.start,
            children: <Widget>[
               Container( height: 2*appState.GAP_PAD ),
               makeTitleText( appState, "Link CodeEquity to GitHub", maxPaneWidth, true, 1, fontSize: 24 ),               
               makeBodyText( appState, ghExplain, maxPaneWidth, true, 4 ),

               Container( height: appState.FAT_PAD ),
               makeHDivider( appState, maxPaneWidth, appState.GAP_PAD, appState.GAP_PAD ),
               Container( height: appState.GAP_PAD ),

               Container( height: appState.GAP_PAD ),
               _makePersonalAccessTokenGH(),
               makeBodyText( appState, patExplain, maxPaneWidth, true, 2 ),

               Container( height: appState.MID_PAD ),
               makeHDivider( appState, maxPaneWidth, appState.GAP_PAD, appState.GAP_PAD ),
               Container( height: appState.MID_PAD ),
               
               _ghAssociateButton(),
               ])
         );
   }
   
   Widget _makeBody() {
      if( appState.loaded ) {
         if( platMap["hostPlat"] == HostPlatforms.GitHub ) { return _makeAssociateGH(); }
         else                                              { print( "Host organization not recognized." ); return Container( width: 10 ); }
      }
      else {
         if( appState.verbose >= 1 ) { print( "AppState not ? Loaded" ); }
         return CircularProgressIndicator();
      }
   }
   
   @override
      Widget build(BuildContext context) {

      container   = AppStateContainer.of(context);
      appState    = container.state;
      assert( appState != null );
      platMap = ModalRoute.of(context)!.settings.arguments as Map<String, HostPlatforms>;
      
      pat = TextEditingController();
      
      appState.screenHeight = MediaQuery.of(context).size.height;
      appState.screenWidth  = MediaQuery.of(context).size.width;
      
      return Scaffold(
         appBar: makeTopAppBar( context, "Home" ),
         body: _makeBody()
         );
   }
}
