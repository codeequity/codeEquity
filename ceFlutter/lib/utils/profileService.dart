import 'dart:convert';                              // json encode/decode
import 'package:flutter/material.dart';             // nav
import 'package:flutter/services.dart';             // byte data

import 'package:ceFlutter/utils/awsUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';
import 'package:ceFlutter/utils/widgetUtils.dart';

import 'package:ceFlutter/utils/ghUtils.dart';      // host-specific Utils

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/CEVenture.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/HostUser.dart';
import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/Person.dart';


void dissolve( context, container, dynamic prime, Map<String, String> screenArgs ) async {
   final appState  = container.state;
   
   bool         choseRepo = true;
   List<PEQ>         peqs = [];
   List<CEProject>   ceps = [];
   List<String> candidate = [];
   
   _deletePeqs( List<String> peqIds ) async {
      print( "Deleting peqs " + peqIds.toString() );
      String shortName = "RemoveEntries";
      String pids = json.encode( [ peqIds ] );  // list of lists in case pkey is not singular
      String postData = '{ "Endpoint": "$shortName", "tableName": "CEPEQs", "ids": $pids }';
      bool res = await updateDynamo( context, container, postData, shortName );
   }

   _cleanDynamo( String id, String isProject, List<String> cepIds ) async {
      // remove cep, peqSummary, image, linkage, remove cepId from any hostUser.   if venture, will remove equity plan
      String shortName  = "KillVenture";
      String postData = '{ "Endpoint": "$shortName", "id": "$id", "isProject": "$isProject" }';
      bool res = await updateDynamo( context, container, postData, shortName );
      
      // tell ingest
      String cepId = isProject == "true" ? id                 : "-1";
      String note  = isProject == "true" ? "Remove CEProject" : "Remove CEVenture";
      sendPAct( context, container, cepId, [id], HostPlatforms.GitHub, note );  // XXX platform

      // if cepIds, removing venture, send pacts to remove ceps as well
      for( String c in cepIds ) {
         sendPAct( context, container, c, [c], HostPlatforms.GitHub, "Remove CEProject" );
      }

      // reload's Cancel briefly pops back to prof page before navigating. 
      screenArgs["profType"] = "---";
      pop( context );
      reload( context, container );
   }
   
   void _removeRepo( List<bool> on ) {
      assert( on.length == candidate.length );
      for( int i = 0; i < on.length; i++ ) {
         if( on[i] ) {
            // do not add this back to hostUser futureCEProject page - homepage refresh button does the trick
            String repoId = prime.removeRepo( candidate[i] );
            writeCEProject( appState, context, container, prime );  // don't wait
            
            // send pact.  This is a no-op for ingest
            writeRemoveRepoPAct( context, container, prime, repoId );
            
            // have dynamo remove hostRepoId for all hostRepoId/cepId peqs..  don't wait.
            // This is carried out here instead of during ingest since it does not impact peqSummary, allocs, or anything else. 
            String cepId = prime.ceProjectId;
            String shortName = "RemoveRepo";
            String postData = '{ "Endpoint": "$shortName", "cepId": "$cepId", "repoId": "$repoId" }';
            updateDynamo( context, container, postData, shortName );
         }
      }
      pop( context );
   }

   void _removeProject() async {
      // remove CEP from all hostusers
      // remove all non-ACCR peqs with cepId (delVen already does .. most of this?)
      
      // Make sure peqs are updated first, then delete all non-ACCR
      await updateCEPeqs( container, context, cepId: prime.ceProjectId );
      peqs.addAll( appState.cePeqs[ prime.ceProjectId ] ?? [] );        
      if( peqs.length > 0 ) {
         List<String> peqIds = peqs
                               .where( (p) => p.peqType != PeqType.grant )
                               .map( (p) => p.id )
                               .toList();
         _deletePeqs( peqIds );
      }

      _cleanDynamo( prime.ceProjectId, "true", [] );
   }
   
   _removeVenture() async {
      if( peqs.length > 0 ) {
         List<String> peqIds = peqs.map( (p) => p.id ).toList();
         _deletePeqs( peqIds );
      }

      List<String> cepIds = ceps.map( (p) => p.ceProjectId ).toList();

      _cleanDynamo( prime.ceVentureId, "false", cepIds );
   }
   
   _setRepoOrProj( String choice ) {
      if( choice == "Delete this project" ) { choseRepo = false; }
      else if( choice == "Remove a repo" )  { choseRepo = true; }
      else { assert( false ); }
      pop( context ); // radio
   }

   _doubleConfirm() {
      confirm( context, "Delete Venture", "There is no going back.  Are you certain you wish to delete this Venture?", _removeVenture, () => pop( context ) );
   }

   
   // are you exec? 
   assert( appState.ceVenture[ prime.ceVentureId ] != null );
   CEVenture cev = appState.ceVenture[ prime.ceVentureId ]!;
   if( cev.roles[ appState.ceUserId ] != MemberRole.Executive ) {
      String msg = "Only an Executive can carry out this operation.";
      showToast( msg );
      return;
   }
   
   if( prime is CEProject ) {
      List<String> choices = [ "Remove a repo", "Delete this project" ]; // XXX formalize

      String res = await radioDialog( context, "Are you removing a repo, or deleting this project?", choices, choices[0], _setRepoOrProj, () => pop( context ) );
      if( res == "Cancel" ) { return; }

      bool proceed = false;
      
      void _proceed() {
         pop( context );
         proceed = true;
      }
   
      if( choseRepo ) {
         
         String msg = "All PEQ issues connected to the host repo will still be valid and will persist in CodeEquity, but will lose their grounding in the host.  ";
         msg       += "With no host repository, CodeEquity background sanity checks and status repairs will fail.  This may be OK if work on these ";
         msg       += "issues is complete.  Be sure you know what you are doing, this action can not be undone.  Would you like to continue?";
         Widget body = makeBodyText( appState, msg, appState.MIN_PANE_WIDTH * 1.6, true, 5 );
         await confirm( context, "Are you sure you want to remove repos?", msg, _proceed, () => pop( context ), body: body );
         if( proceed ) {
            String header = "Check the repos to remove";
            candidate = prime.repositories;
            await showDialog(
               context: context,
               builder: (BuildContext context) => CheckboxDialog( appState: appState, header: header, choices: candidate, saveFunc: _removeRepo, cancelFunc: () => pop( context ) ));
         }
         
      }
      else { // chose project
         
         String msg = "Any granted PEQ issues connected to this CodeEquity Project will remain unchanged in the Venture.  All other PEQ issues will be removed ";
         msg       += "from the Venture including those that have already had work carried out on them.  There is no going back.  ";
         msg       += "Are you certain you wish to delete " + prime.name + "?" ;
         Widget body = makeBodyText( appState, msg, appState.MIN_PANE_WIDTH * 1.6, true, 5 );
         await confirm( context, "Are you sure you want to remove " + prime.name + "?", msg, _removeProject, () => pop( context ), body: body );
      }

   }
   else { // remove Venture
      // remove peqs for all ceps in cev (usually 1)
      for( CEProject cep in appState.ceProject.values ) {
         if( cep.ceVentureId == cev.ceVentureId ) { ceps.add( cep ); }
         await updateCEPeqs( container, context, cepId: cep.ceProjectId );
      }
      for( CEProject cep in ceps ) {
         peqs.addAll( appState.cePeqs[ cep.ceProjectId ] ?? [] );
      }

      print( "Attempting to delete Venture.  It has " + ceps.length.toString() + " CEProjects with a total of " + peqs.length.toString() + " PEQs." );
      int accr = 0;
      int accrPeqs = 0;
      int pend = 0;
      int plan = 0;
      for( PEQ peq in peqs ) {
         if( peq.peqType == PeqType.grant )   { accr += 1; accrPeqs += peq.amount;}
         if( peq.peqType == PeqType.pending ) { pend += 1; }
         if( peq.peqType == PeqType.plan )    { plan += 1; }
      }
      
      // are there granted peqs?
      if( accr > 0 ) {
         String msg = "CodeEquity guantees that once a PEQ has been granted, it can no longer be modified.  Your Venture\n";
         msg       += " has " + accr.toString() + " individual PEQ grants for total of " + accrPeqs.toString() + " options.\n";
         msg       += " This Venture can not be deleted.";
         showToast( msg );
         return;
      }
      // are you sure?
      else if( pend > 0 ) {
         String msg = "There are " + pend.toString() + " pending PEQs, which means work has already been carried out on this Venture.\n";
         msg       += " If you delete the Venture, these pending PEQs will be removed as well, and will no longer be valid.\n";
         msg       += " Are you sure you want to delete this Venture?  There is no going back.";
         confirm( context, "Delete Venture", msg, _doubleConfirm, () => pop( context ) );
      }
      // never got past planning stage
      else if( plan > 0 ) {
         String msg = "There are " + plan.toString() + " planned PEQs already.\n";
         msg       += " If you delete the Venture, these PEQs will be removed as well.\n";
         msg       += " Are you sure you want to delete this Venture?  There is no going back.";
         confirm( context, "Delete Venture", msg, _doubleConfirm, () => pop( context ) );
      }
      // Empty venture
      else {
         _doubleConfirm();
      }
   }
}

Future<void> updatePersonData( context, container, String profId ) async {
   final appState  = container.state;
   final lhsFrameMaxWidth = appState.MIN_PANE_WIDTH - appState.GAP_PAD;  // XXX appstate?
   Person? myself = null;
   
   // print( "Getting stuff (maybe) for " + profId );
   String query = '{ "Endpoint": "GetHostA", "CEUserId": "$profId" }';
   String pdpi = '{ "Endpoint": "GetEntry", "tableName": "CEProfileImage", "query": {"CEProfileId": "$profId" }}';
   
   Map<String,dynamic> rawPITable = {};
   var futs = await Future.wait([
                                   (appState.cePeople[profId] == null ? 
                                    fetchAPerson( context, container, profId ).then( (p) => p != null ? appState.cePeople[profId] = p : true ) :
                                    new Future<bool>.value(true) ),
                                   
                                   (appState.ceHostAccounts[profId] == null ? 
                                    fetchHostUsers( context, container, query ).then( (p) => appState.ceHostAccounts[profId] = p ) :
                                    new Future<bool>.value(true) ),
                                   
                                   (appState.ceImages[profId] == null ? 
                                    fetchProfileImage( context, container, pdpi ).then(            (p) => rawPITable = p ) :
                                    new Future<bool>.value(true) ),
                                   
                                   ]);
   
   myself = appState.cePeople[profId]!;
   assert( myself != null );
   
   assert( appState.ceHostAccounts[profId] != null );
   
   assert( appState.cogUser != null );
   if( myself!.userName != appState.cogUser!.preferredUserName ) { print( "Checking out a different profile: " + myself!.userName ); }
   
   if( rawPITable.keys.length > 0 ) {
      print( rawPITable["CEProfileId"] + " " + rawPITable["ByteData"].length.toString() );
      Uint8List bytes = new Uint8List.fromList( List<int>.from( rawPITable["ByteData"] ) );
      appState.ceImages[profId] = Image.memory( bytes, key: Key( profId + "Image" ), width: lhsFrameMaxWidth );
      assert( appState.ceImages[profId] != null );
   }
}

// XXX there is no need to get all this data - can reduce amount xferred
Future<void> updateProjectData( context, container, String vid, String pid, String primeId, HostPlatforms hostPlat ) async {
   final appState  = container.state;
   final lhsFrameMaxWidth = appState.MIN_PANE_WIDTH - appState.GAP_PAD;  // XXX appstate?

   var postDataPS = {};
   postDataPS['EquityPlanId'] = vid;
   final pd = { "Endpoint": "GetEntry", "tableName": "CEEquityPlan", "query": postDataPS };
   
   postDataPS = {};
   postDataPS['PEQSummaryId'] = pid;
   final pdps = { "Endpoint": "GetEntry", "tableName": "CEPEQSummary", "query": postDataPS };
   
   final pdpi = '{ "Endpoint": "GetEntry", "tableName": "CEProfileImage", "query": {"CEProfileId": "$primeId" }}';
   
   final hostName = enumToStr( hostPlat );
   final pdpa = '{ "Endpoint": "GetHostA", "HostPlatform": "$hostName" }'; 
   
   Map<String,dynamic> rawPITable = {};
   List<HostUser>      haccts     = [];
   
   await Future.wait([
                        (!appState.hostPlatformsLoaded.contains( hostPlat ) ? 
                         fetchHostUsers( context, container, pdpa ).then(                 (p) => haccts = p ) : 
                         new Future<bool>.value(true) ),
                        
                        (appState.cePEQSummaries[pid] == null ?
                         fetchPEQSummary( context, container, json.encode( pdps )).then((p) => appState.cePEQSummaries[pid] = p ) :
                         new Future<bool>.value(true) ),
                        
                        (appState.ceEquityPlans[vid] == null ? 
                         fetchEquityPlan( context, container, json.encode( pd ) ).then( (p) => appState.ceEquityPlans[vid] = p ) :
                         new Future<bool>.value(true) ),
                        
                        (appState.ceImages[pid] == null ? 
                         fetchProfileImage( context, container, pdpi ).then(            (p) => rawPITable = p ) :
                         new Future<bool>.value(true) ),
                        
                        ]);
   
   if( !appState.hostPlatformsLoaded.contains( hostPlat ) ) { appState.hostPlatformsLoaded.add( hostPlat ); }
   // One ha per platform, list length is 1
   for( HostUser ha in haccts ) { appState.ceHostAccounts[ha.ceUserId] = [ha]; }
   
   if( rawPITable.keys.length > 0 ) {
      print( rawPITable.keys.toString() );
      print( rawPITable["CEProfileId"]);
      print( rawPITable["ByteData"].length.toString());
      // final ByteData assetImageByteData = await rootBundle.load( rawPITable["ByteData"] );
      // final x = assetImageByteData.buffer.asUint8List();
      Uint8List bytes = new Uint8List.fromList( List<int>.from( rawPITable["ByteData"] ) );
      appState.ceImages[primeId] = Image.memory( bytes, key: Key( primeId + "Image" ), width: lhsFrameMaxWidth );
      assert( appState.ceImages[primeId] != null );
   }
   
}

void dissolveHost( context, container ) async {
   final appState  = container.state;

   HostPlatforms hplat = HostPlatforms.end;

   void _setHPlat( String choice ) {
      hplat = enumFromStr<HostPlatforms>( choice, HostPlatforms.values );
      pop( context ); // choose which host
   }

   // Removing a host may cut across multiple CEVs.
   _removeHost() async {
      assert( hplat != HostPlatforms.end );
      print( "Removing " + enumToStr( hplat ) );

      // get the huser account for hplat
      List<HostUser> hus = appState.myHostAccounts;
      for( HostUser hu in hus ) {
         if( hu.hostPlatform == hplat ) {
            
            // an huser withdrawing from a cep means sending pacts.  dont wait
            for( String cepId in hu.ceProjectIds ) {
               print( hu.hostUserName + " is withdrawing from " + cepId );
               writeWithdrawProjPAct( appState, context, container, appState.ceUserId, hu, cepId );
            }
            
            // remove huser (removes pat as well)
            await removeHostUser( context, container, hu );
            
            // update cemd
            reload( context, container );
            
            break;
         }
      }
   }

   Future<String> _chooseHost( ) async {
      List<String> choices = [];
      HostPlatforms.values.forEach( (h) {
            if( h != HostPlatforms.end ) { choices.add( enumToStr( h ) ); }
         });
         
      pop( context ); // Delete host linkage
      String res = await radioDialog( context, "Choose which Host platform to withdraw from", choices, choices[0], _setHPlat, () => pop( context ) );
      if( res != "Cancel" ) { await _removeHost(); }

      return "";
   }

   
   String msg = "Would you like to remove a host linkage?  Doing so will delete data in CodeEquity connecting your CodeEquity account with that host, including ";
   msg       += "any private access tokens and that host's user account on CodeEquity. This action impacts every CodeEquity Venture your host account touches.  ";
   msg       += "Your PEQs in those Ventures will continue to exist, however, all further host activity you carry out related to those PEQs on the host will be ";
   msg       += "invisible to CodeEquity. ";
   await confirm( context, "Delete Host Linkage", msg, _chooseHost, () => pop( context ) );
}

void editProfile( context, container, Person cePeep, {void Function()? updateCallback} ) async {

   void _cancelEdit( context ) {
      print( "Cancel update profile" );
      pop( context );
   }
   
   void _saveProfile( List<TextEditingController> controller ) {
      final appState  = container.state;      
      // Note: userName assigned during signup, can not change.
      // Note: email assigned during signup, this can change.
      assert( controller.length == 5 );
      String na = controller[0].text;
      String gb = controller[1].text;
      String em = controller[2].text;
      String ph = controller[3].text;
      String pa = controller[4].text;
      
      cePeep.legalName      = na != "" ? na : cePeep.legalName;
      cePeep.email          = em != "" ? em : cePeep.email;
      cePeep.phone          = ph != "" ? ph : cePeep.phone;
      cePeep.mailingAddress = pa != "" ? pa : cePeep.mailingAddress;
      
      if( gb != "" )                                           { cePeep.goesBy = gb; }
      else if( cePeep.goesBy == "" && cePeep.legalName != "" ) { cePeep.goesBy = cePeep.legalName.split(" ")[0]; }

      cePeep.completeProfile();
      writeCEPerson( appState, context, container, cePeep );
      updateCallback?.call();
      
      pop( context );
   }

   assert( cePeep.userName != "" );

   List<String> header                    = cePeep.getEditable();
   List<bool>   required                  = cePeep.getRequired();
   List<String> curVal                    = cePeep.getCurVal();
   List<String> toolTip                   = cePeep.getToolTip();

   assert( header.length == required.length );
   assert( header.length == curVal.length );
   assert( header.length == toolTip.length );
   
   final appState = container.state;
   String popupTitle = "Edit " + cePeep.userName + "'s Profile";

   // This construction allows editForm to return a widget that we apply here.
   await showDialog(
      context: context,
      builder: (BuildContext context) => EditForm( appState: appState, scrollHeader: popupTitle, header: header, curVal: curVal,
                                                   required: required, toolTip: toolTip, saveFunc: _saveProfile, cancelFunc: _cancelEdit ));
}


// XXX look at removeHost.. dup
Future<HostPlatforms> chooseHost( context ) async {
   List<String> choices = [];
   HostPlatforms.values.forEach( (h) {
         if( h != HostPlatforms.end ) { choices.add( enumToStr( h ) ); }
      });

   HostPlatforms plat = HostPlatforms.end;

   void _setPlat( String choice ) {
      plat = enumFromStr<HostPlatforms>( choice, HostPlatforms.values );
      pop( context );
   }   
   
   String res = await radioDialog( context, "Choose which Host platform to work with:", choices, choices[0], _setPlat, () => pop( context ) );
   
   return plat;
}



// handles all the wiring between host, aws, internal state
Future<void> updateRepos( context, container, HostPlatforms hplat ) async {
   if( hplat == HostPlatforms.GitHub ) {
      await updateGHRepos( context, container );
   }
   else{
      print( "Error.  Platform: " + enumToStr( hplat ) + " is not recognized." );
      assert( false );
   }
}

// relies on updateRepos, handles connection between CEP and repos
Future<void> initCEPRepos( context, container, CEProject cep, { reposLoadedCallback = null } ) async {
   if( cep.hostPlatform == HostPlatforms.GitHub ) {
      await initGHRepos( context, container, cep, reposLoadedCallback );
   }
   else{
      print( "Error.  Platform: " + enumToStr( cep.hostPlatform ) + " is not recognized." );
      assert( false );
   }
}

void initProject( context, container, CEProject cep, List<TextEditingController> cont ) async {
   if( cep.hostPlatform == HostPlatforms.end ) {
      cep.hostPlatform = await chooseHost( context );
   }
   
   if( cep.hostPlatform == HostPlatforms.GitHub ) {
      assert( cont.length == 1 );
      String res = await initGHProject( context, container, cep, cont[0] );

      // if the above failed, don't report partial hint values
      if( res == "Cancel" ) { cep.hostPlatform = HostPlatforms.end; }
   }
   else if( cep.hostPlatform != HostPlatforms.end ) {
      print( "Error.  Platform: " + enumToStr( cep.hostPlatform ) + " is not recognized." );
      assert( false );
   }

}

