import 'dart:ui';       // pointerKinds
import 'dart:convert';  // json encode/decode

import 'package:collection/collection.dart'; // list eq.
import 'package:flutter/foundation.dart';    // setEquals  
import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';
import 'package:ceFlutter/utils/awsUtils.dart';
import 'package:ceFlutter/utils/ghUtils.dart'; 

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/HostLoc.dart';

Function eq    = const ListEquality().equals;


// XXX move to WidgetUtils?
// Workaround breaking change 5/2021
// https://flutter.dev/docs/release/breaking-changes/default-scroll-behavior-drag
class MyCustomScrollBehavior extends MaterialScrollBehavior {
  // Override behavior methods and getters like dragDevices
  @override
  Set<PointerDeviceKind> get dragDevices => { 
    PointerDeviceKind.touch,
    PointerDeviceKind.mouse,
  };
}


class CEStatusFrame extends StatefulWidget {
   final frameHeightUsed;
   var   appContainer;

   // Keep size of headers for statuss frame view.  Use this for key indexing
   late int headerTop; 

   CEStatusFrame(
      {Key? key,
            this.appContainer,
            this.frameHeightUsed
            } ) : super(key: key);

  @override
  _CEStatusState createState() => _CEStatusState();

}

enum _SortType  { titleAsc, titleDsc, hprojAsc, hprojDsc, pvalAsc, pvalDsc, ptypeAsc, ptypeDsc, assignAsc, assignDsc, end }

class _CEStatusState extends State<CEStatusFrame> {

   late var      container;
   late AppState appState;

   late double svWidth;
   late double svHeight;
   late double baseWidth;
   
   late Widget empty;  // XXX formalize
   late Widget fatPad;
   late Widget hdiv;
   late Widget vSpace;

   late Map<String, PEQ> cPeqs;     // codeEquity (as per aws) peqs
   late Map<String, PEQ> hPeqs;     // host peqs
   late List<String>     badPeqs;   // hostIssueIds of peqs that don't match                        

   late List<List<dynamic>> goneParts;  // computed model parts, unsorted and unhighlighted
   late List<List<dynamic>> goodParts;
   late List<List<dynamic>> badParts;

   late List<List<Widget>> body;    // view holder
   
   late bool peqsLoaded;
   late bool goodStatus;     
   late bool toggleGone; 
   late bool toggleBad; 
   late bool toggleGood;
   late bool ingestNoticeDisplayed;

   late bool updateView;           
   late bool updateModel; 
   
   late List<List<Widget>> peqHeader;

   final listHeaders = ["Issue Title", "Host Project", "PEQ", "Type", "Assignee(s)" ];
   late List<double> headerDims;

   late _SortType sortType;
   
   @override
   void initState() {
      super.initState();
      peqsLoaded  = false;
      goodStatus  = true;
      toggleGone    = true;
      toggleBad     = true;
      toggleGood    = true;
      updateView  = true;
      updateModel = true;
      cPeqs       = {};
      hPeqs       = {};
      peqHeader   = [];
      badPeqs     = [];
      headerDims  = [];

      body        = [];
      goneParts   = [];
      goodParts   = [];
      badParts    = [];

      sortType    = _SortType.end;

      ingestNoticeDisplayed = false;
   }

   @override
   void dispose() {
      super.dispose();
   }

   // NOTE that popScroll throws overlay on top of current page, greying it out.
   // This causes project_page to rebuild (gotta change colors), which then causes current tab to rebuild (status frame, in this case).
   // Unavoidable, so make sure expensive stuff doesn't run twice.
   Future<void> _ingestNotice( context ) async {
      List<Widget> buttons = [];
      buttons.add( new TextButton( key: Key( 'Dismiss' ), child: new Text("Dismiss"), onPressed: () => Navigator.of( context ).pop() ));
      String msg = "There are uningested PEQ actions for this CodeEquity Project.  Please update PEQ summary under the peq summary tab first."; 

      Widget m = makeBodyText( appState, msg, 3.0 * baseWidth, true, 8, keyTxt: "ingestNotice");
      popScroll( context, "Status unavailable.", m, buttons );
      ingestNoticeDisplayed = true;
   }

   Future<void> _loadPeqs( CEProject cep ) async {
      if( !peqsLoaded ) {

         bool safe = true;
         // check for ingested flags, otherwise cePeqs will be out of date on aws.
         // If ingest is run, re-check ingested.  updateAllocTree is set at end of ingest.
         if( ingestNoticeDisplayed && !appState.updateAllocTree ) { safe = false; }   // Have already checked allIngested, not yet run ingest
         else { safe = await allIngested( container, context ); }                     // run allIngested if haven't noticed a problem, or did but just ran ingest.

         if( !safe ) {
            if( !ingestNoticeDisplayed ) { _ingestNotice( context ); }
            return;
         }
         print( "LoadPeqs running" );
         await Future.wait([
                              updateCEPeqs( container, context ),          // get all ce peqs for the currently selected CEP
                              updateHostPeqs( container, cep )             // get all host peqs for the currently selected CEP
                              ]);

         setState(() => peqsLoaded = true );
      }
   }
   
   // XXX would be interesting to add average latency of last few requests to aws and gh.. small font (43)
   List<List<Widget>> _getHeader( context, cep ) {
      List<List<Widget>> header = [];
      // print( ' .. getHeader build' );

      final buttonWidth = 100;
      
      Widget spacer    = Container( height: 1, width: (svWidth - cep.name.length - 2*buttonWidth )/2.0 );
      Widget miniSpace = Container( height: 1, width: 3 * appState.GAP_PAD );
      Widget minierSpace = Container( height: 1, width: 1.5 * appState.GAP_PAD );
      Widget title     = makeIWTitleText( appState, cep.name , false, 1, fontSize: 18 );

      header.add( [ Container( height: appState.MID_PAD ), empty, empty, empty, empty ] );
      header.add( [ spacer, title, empty, empty, empty ] );
      header.add( [ Container( height: appState.MID_PAD ), empty, empty, empty, empty ] );
      
      List<PEQ> peqs      = [];         
      List<PEQ> planPeqs  = [];         
      List<PEQ> pendPeqs  = [];         
      List<PEQ> accrPeqs  = [];         
      List<PEQ> hPeqs     = [];
      List<PEQ> planHPeqs = [];
      List<PEQ> pendHPeqs = [];
      List<PEQ> accrHPeqs = [];

      if( peqsLoaded ) {
         // appState.cePeqs.keys.forEach( print );
         assert( appState.cePeqs[ cep.ceProjectId ] != null );
         peqs     = appState.cePeqs[ cep.ceProjectId ]!;
         planPeqs = peqs.where( (PEQ p) => p.peqType == PeqType.plan ).toList();
         pendPeqs = peqs.where( (PEQ p) => p.peqType == PeqType.pending ).toList();
         accrPeqs = peqs.where( (PEQ p) => p.peqType == PeqType.grant ).toList();

         hPeqs     = appState.hostPeqs[ cep.ceProjectId ]!;
         planHPeqs = hPeqs.where( (PEQ p) => p.peqType == PeqType.plan ).toList();
         pendHPeqs = hPeqs.where( (PEQ p) => p.peqType == PeqType.pending ).toList();
         accrHPeqs = hPeqs.where( (PEQ p) => p.peqType == PeqType.grant ).toList();

      }
      String cePeqDetail  = planPeqs.length.toString() + " planned, " + pendPeqs.length.toString() + " pending, " + accrPeqs.length.toString() + " accrued.";
      String cePeqs       = peqs.length.toString() + " PEQs: " + cePeqDetail;
      String ceStorage    = "CodeEquity Data (AWS)";
      
      String hostStorage   = "Host Data (" + cep.hostPlatform + ")";
      String hostPeqDetail = planHPeqs.length.toString() + " planned, " + pendHPeqs.length.toString() + " pending, " + accrHPeqs.length.toString() + " accrued.";
      String hostPeqs      = hPeqs.length.toString() + " PEQs: " + hostPeqDetail; 
      
      Widget t1 = makeTitleText( appState, ceStorage, buttonWidth * 3.0, false, 1, fontSize: 16 );
      Widget t2 = makeTitleText( appState, hostStorage, buttonWidth * 3.0, false, 1, fontSize: 16 );

      Widget status = makeTitleText( appState, "STATUS", buttonWidth, false, 1, fontSize: 16);
      Widget good   = makeTitleText( appState, "GOOD", buttonWidth, false, 1, color: Colors.green );
      Widget repair = makeTitleText( appState, "REPAIR", buttonWidth, false, 1, color: Colors.red, fontSize: 16);
      Widget cePeqW   = makeTitleText( appState, cePeqs, buttonWidth * 3.0, false, 1 );
      Widget hostPeqW = makeTitleText( appState, hostPeqs, buttonWidth * 3.0, false, 1 );
      
      header.add( [ Container( height: appState.MID_PAD ), empty, empty, empty, empty ] );
      header.add( [ miniSpace, status, minierSpace, t1, t2 ] );
      if( goodStatus ) { header.add( [ miniSpace, good, minierSpace, cePeqW, hostPeqW ] ); }
      else             { header.add( [ miniSpace, repair, minierSpace, cePeqW, hostPeqW ] ); }
      header.add( [ hdiv, empty, empty, empty, empty ] );      
      
      widget.headerTop = header.length;
      return header;
   }

   // p is from aws, h is host
   bool _same( PEQ p, PEQ? h ) {
      bool res = true;
      if( h == null ) { return false; }

      // hostPeqs are constructed based on host state, which has no access to some information
      // res = res && p.id == h!.id;
      // res = res && p.accrualDate == h!.accrualDate;
      // res = res && p.vestedPerc == h!.vestedPerc;
      // res = res && p.active == h!.active;
      // res = res && p.ceHolderId     != null && eq( p.ceHolderId,     h!.ceHolderId );   

      res = res && p.ceProjectId != null && p.ceProjectId    == h!.ceProjectId;
      // if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + p.ceProjectId + " " + h!.ceProjectId ); }
      
      res = res && p.peqType != null && p.peqType        == h!.peqType;
      // if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + enumToStr( p.peqType ) + " " + enumToStr( h!.peqType )); }

      // XXX Should no longer see a difference.  True?  remove this comment and line
      // res = res && p.amount != null && ( p.amount - h!.amount ).abs() <= 1;
      res = res && p.amount != null && p.amount == h!.amount;
      // if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + p.amount.toString() + " " + h!.amount.toString() ); }

      res = res && p.hostRepoId != null && p.hostRepoId     == h!.hostRepoId;
      // if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + p.hostRepoId + " " + h!.hostRepoId ); }

      res = res && p.hostIssueId != null && p.hostIssueId    == h!.hostIssueId;
      // if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + p.hostIssueId + " " + h!.hostIssueId ); }

      res = res && p.hostIssueTitle != null && p.hostIssueTitle == h!.hostIssueTitle;
      // if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + p.hostIssueTitle + " " + h!.hostIssueTitle ); }
      
      res = res && p.hostHolderId != null && setEquals( p.hostHolderId.toSet(), h!.hostHolderId.toSet() );
      // if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + p.hostHolderId.toString() + " " + h!.hostHolderId.toString() ); }

      res = res && p.hostProjectSub != null && eq( p.hostProjectSub, h!.hostProjectSub );
      // if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + p.hostProjectSub.toString() + " " + h!.hostProjectSub.toString() ); }

      // if( !res ) { print( p ); print( h! ); }

      return res; 
   }

   // verify that the world according to AWS is present on the host
   // get all hostLinks from aws.  identify which are used in peqs.  Along the way, populate other existing host data
   Future<bool> _checkHostStruct(container, List<String> activeAssignees, List<String> activeRepos, List<HostLoc> hostLocs, Map<String,List<int>> activeLabels ) async {

      CEProject? cep = appState.ceProject[ appState.selectedCEProject ];
      assert( cep != null );
      assert( appState.myHostLinks != null );    // had to select a CEP by now, which runs reloadProjects
      assert( appState.cePeqs[ appState.selectedCEProject ] != null );

      print( "Confirming Host project locations exist" );

      List<HostLoc> awsLocs         = appState.myHostLinks!.locations;  // aws-known host locs
      List<HostLoc> activeLocs      = [];                               // active locs for CEP on host according to peqs known to ceMD
      
      // peq: ceProjectId plus hostProjectSub
      // loc: ceProjectId plus hostProjectName, hostColumnName
      appState.cePeqs[ appState.selectedCEProject ]!.forEach( (p) {
            assert( p.hostProjectSub.length == 2 ); 
            String id  = p.ceProjectId;
            String hpn = p.hostProjectSub[0];
            String hcn = p.hostProjectSub[1];

            activeRepos.add( p.hostRepoId );
            activeAssignees.addAll( p.hostHolderId );

            if( !activeLabels.containsKey( p.hostRepoId ) ) { activeLabels[ p.hostRepoId ] = []; }
            activeLabels[p.hostRepoId]!.add( p.amount );
            
            // Don't already have loc?
            List<HostLoc> loc = activeLocs.where( (l) => l.ceProjectId == id && l.hostProjectName == hpn && l.hostColumnName == hcn ).toList();
            if( loc.length == 0 ) {
               List<HostLoc> aLocs = awsLocs.where( (l) => l.ceProjectId == id && l.hostProjectName == hpn && l.hostColumnName == hcn ).toList();
               assert( aLocs.length == 1 );
               activeLocs.add( aLocs[0] );
            }
         });

      // make short list of hostProjectId, then get host locs
      List< Future<List<HostLoc>> > futs = [];

      List<String> hostProjectIds = activeLocs.map( (l) => l.hostProjectId ).toSet().toList();

      var getHostLocs = null;
      if( cep!.hostPlatform == "GitHub" ) { getHostLocs = getGHLocs; }                                       // XXX formalize
      else                                { print( "Host organization not recognized." ); return false; }
      
      hostProjectIds.forEach( (hpid) => futs.add( getHostLocs( container, cep!, hpid )) );
      final res = await Future.wait( futs );
      res.forEach( (r) => hostLocs.addAll( r ) );

      // Make sure each activeLoc exists in host
      bool hostStructGood = true;
      for( HostLoc a in activeLocs ) {
         bool found = false; 
         for( HostLoc h in hostLocs ) {
            if( h.eq( a ) ) {
               found = true;
               break;
            }
         }
         if( !found ) {
            hostStructGood = false;
            print( "Host missing " + a.toString() );
            showToast( "Host project structure is incomplete.  Please fix this before proceeding with repair." );            
            break;
         }
      }
      
      return hostStructGood;
   }
   
   // there is no need to limit this to the needsRepair list.  If not needs repair, then hostPeqs already have those assignees
   Future<bool> _checkHostAssign( container, List<String> activeAssignees, List<String> activeRepos ) async {
      bool hostAssignGood = true;

      CEProject? cep = appState.ceProject[ appState.selectedCEProject ];
      assert( cep != null );

      var getHostAssignees = null;
      if( cep!.hostPlatform == "GitHub" ) { getHostAssignees = getGHAssignees; }                                       // XXX formalize
      else                                { print( "Host organization not recognized." ); return false; }
      
      List<String> hostAssignees = [];
      for( String repoId in activeRepos ) {
         print( "Get Assignees for " + repoId );
         hostAssignees.addAll( await getHostAssignees( container, cep!, repoId ) );
      }

      hostAssignees = hostAssignees.toSet().toList();
      // print( "Host Assign " + hostAssignees.toString() );
      for( String aass in activeAssignees ) {
         hostAssignGood = hostAssignGood && hostAssignees.contains( aass );
         if( !hostAssignGood ) {
            print( "Host missing user: " + aass );
            showToast( "Host assignees are incomplete.  Please fix this before proceeding with repair." );            
            break;
         }
      }
      
      return hostAssignGood;
   }

   Future<bool> _makeHostLabels( container, List<String> activeRepos, Map<String,List<int>> activeLabels, Map<String, List<dynamic>> hostLabels ) async {
      CEProject? cep = appState.ceProject[ appState.selectedCEProject ];
      assert( cep != null );

      bool moddedLabels = false;

      var getHostLabels    = null;
      var createHostLabel = null;
      if( cep!.hostPlatform == "GitHub" ) {  // XXX formalize
         getHostLabels   = getGHLabels;
         createHostLabel = createGHLabel;
      }                                      
      else { print( "Host organization not recognized." ); return false; }

      for( String repoId in activeRepos ) {
         hostLabels[repoId] = await getHostLabels( container, cep!, repoId );
         List<int> hLabelVals = hostLabels[repoId]!.map( (l) => l[0] as int ).toList();
         activeLabels[ repoId ] = activeLabels[ repoId ]!.toSet().toList();
         print( "Got Labels for " + repoId );
         // print( "   active labels: " + activeLabels[ repoId ].toString() );
         
         List<Future<dynamic>> createdLabels = [];
         assert( activeLabels.containsKey( repoId ));
         for( int v in activeLabels[ repoId ]! ) {
            if( !hLabelVals.contains( v ) ) {
               print( "Host missing label " + v.toString());
               createdLabels.add( createHostLabel( container, cep!, repoId, v ) );
               moddedLabels = true;
            }
         }
         await Future.wait( createdLabels );
         // Get directly from host again.  Could avoid by mapping from ghV2.label to ceMD.label better, but very little value
         if( moddedLabels ) { hostLabels[repoId] = await getHostLabels( container, cep!, repoId );  }
      }
      return moddedLabels;
   }

   // Force reload, as core data has changed.
   Future<void> _reset({pop = true}) async {
      print( "Reset called " + DateTime.now().millisecondsSinceEpoch.toString() );
      CEProject? cep = appState.ceProject[ appState.selectedCEProject ];
      assert( cep != null );

      peqsLoaded = false;
      appState.cePeqs.remove( cep!.ceProjectId );
      await _loadPeqs( cep! );
      setState( () => updateModel = true );
      
      // dismiss writeall popup, and the compare popup
      if( pop ) {
         Navigator.of( context ).pop();
         Navigator.of( context ).pop();
      }
   }
   
   // XXX need to expand host and update call pattern
   Future<void> _writeCEtoHost( PEQ p, bool all ) async {
      CEProject? cep = appState.ceProject[ appState.selectedCEProject ];
      assert( cep != null );
      assert( p.ceProjectId == cep!.ceProjectId );
      assert( p.hostProjectSub.length == 2 );
   
      print( "Overwrite Host for " + cep!.name );

      List<String>  activeAssignees = [];           // all host user ids in peqs that ceMD knows about (i.e. from aws)
      List<String>  activeRepos     = [];           // all host repo ids  ""
      List<HostLoc> hostLocs        = [];           // all host locs known to host

      Map<String,List<int>>      activeLabels = {}; // label amounts per repo, according to peqs known to ceMD
      Map<String, List<dynamic>> hostLabels   = {};

      // 1) check projects & cols, back out if not.  Along the way, collect locs, assignees, repos, etc from aws
      bool hostStructGood = await _checkHostStruct( container, activeAssignees, activeRepos, hostLocs, activeLabels );
      if( !hostStructGood ) { return; }

      // This must happen here.. new reference location created
      activeAssignees = activeAssignees.toSet().toList();
      activeRepos     = activeRepos.toSet().toList();
      
      // 2) check assignees exist, back out if not.   new type of query...
      bool hostAssignGood = await _checkHostAssign( container, activeAssignees, activeRepos );
      if( !hostAssignGood ) { return; }
      
      // 3) make sure labels are in good shape.  Create if need be.
      bool moddedLabels = await _makeHostLabels( container, activeRepos, activeLabels, hostLabels );
      
      // 4) make new issue
      if( all ) {
         // XXX these are run serially for now, sloooow.  Host loading, interactions need to be verified before moving to Future.wait
         for( String badPeq in badPeqs ) {
            assert( cPeqs.containsKey( badPeq ) );
            await makeHostIssue( context, container, cep!, cPeqs[badPeq]!, hostLocs, hostLabels );
         }
      }
      else {
         await makeHostIssue( context, container, cep!, p, hostLocs, hostLabels );
      }

      await _reset();

   }

   // will NOT modify CE's accrued peqs
   // No need to check host infrastructure.
   Future<void> _writeHostToCE( PEQ p, bool all ) async {
      CEProject? cep = appState.ceProject[ appState.selectedCEProject ];
      assert( cep != null );

      List<PEQ> writeMe = [];
      if( all ) {
         for( PEQ hp in appState.hostPeqs[ cep!.ceProjectId ]! ) {
            if( badPeqs.contains( hp.hostIssueId )) { writeMe.add( hp ); }
         }
      }
      else { writeMe.add( p ); }

      // makeCEPeq will reject request if matching cePeq is ACCR
      for( PEQ hp in writeMe ) {
         assert( hp.hostIssueId != null );
         await makeCEPeq( context, container, cep!, hp, cPeqs );
      }

      await _reset();
   }

   // will NOT modify CE's accrued peqs
   Future<void> _deleteCE( PEQ p, bool all ) async {
      print( "Oi!  Delete CE peq(s)... all? " + all.toString() );
      CEProject? cep = appState.ceProject[ appState.selectedCEProject ];
      assert( cep != null );

      List<PEQ> removeMe = [];
      if( all ) {
         for( PEQ p in appState.cePeqs[ cep!.ceProjectId ]! ) {
            if( badPeqs.contains( p.hostIssueId )) { removeMe.add( p ); }
         }
      }
      else { removeMe.add( p ); }

      // removeCEPeq will reject request if matching cePeq is ACCR
      for( PEQ p in removeMe ) {
         assert( p.hostIssueId != null );
         await removeCEPeq( context, container, cep!, p, cPeqs );
      }

      await _reset();
   }

   Future<void> _deleteHost( PEQ p, bool all ) async {
      print( "Oi!  Delete Host peq(s)... all? " + all.toString() );
      CEProject? cep = appState.ceProject[ appState.selectedCEProject ];
      assert( cep != null );

      List<PEQ> removeMe = [];
      if( all ) {
         for( PEQ p in appState.hostPeqs[ cep!.ceProjectId ]! ) {
            if( badPeqs.contains( p.hostIssueId )) { removeMe.add( p ); }
         }
      }
      else { removeMe.add( p ); }

      for( PEQ p in removeMe ) {
         assert( p.hostIssueId != null );
         await remGHIssue( container, cep!, p.hostIssueId );
      }

      await _reset();
   }

   // Note that p is built from CE
   Future<void> _chooseDeleteCEPeq( PEQ p ) async {
      assert( p != null );
      String msg1 = "Delete One: Delete this CE PEQ.\n\n";
      String msg2 = "Delete All: Delete all CodeEquity PEQs listed under \'Needing Repair\', including this one.\n\n";
      List<Widget> buttons = [];
      buttons.add( new TextButton( key: Key( 'Delete one CE' ), child: new Text("Delete one"), onPressed: () => _deleteCE( p, false )) );
      buttons.add( new TextButton( key: Key( 'Delete all CE' ), child: new Text("Delete all"), onPressed: () => _deleteCE( p, true  )) );
      buttons.add( new TextButton( key: Key( 'Dismiss' ), child: new Text("Dismiss"), onPressed: () => Navigator.of( context ).pop() ));

      Widget m = makeBodyText( appState, msg1 + msg2, 3.0 * baseWidth, true, 5, keyTxt: "deleteCEPeq"+p.hostIssueId);
      popScroll( context, "CodeEquity PEQ:", m, buttons );
   }

   // Note that p is built from the host
   Future<void> _chooseDeleteHostPeq( PEQ p ) async {
      assert( p != null );
      String msg1 = "Delete One: Delete this Host PEQ.\n\n";
      String msg2 = "Delete All: Delete all Host PEQs listed under \'Needing Repair\', including this one.\n\n";
      List<Widget> buttons = [];
      buttons.add( new TextButton( key: Key( 'Delete one host' ), child: new Text("Delete one"), onPressed: () => _deleteHost( p, false )) );
      buttons.add( new TextButton( key: Key( 'Delete all host' ), child: new Text("Delete all"), onPressed: () => _deleteHost( p, true  )) );
      buttons.add( new TextButton( key: Key( 'Dismiss' ), child: new Text("Dismiss"), onPressed: () => Navigator.of( context ).pop() ));

      Widget m = makeBodyText( appState, msg1 + msg2, 3.0 * baseWidth, true, 5, keyTxt: "deleteHostPeq"+p.hostIssueId);
      popScroll( context, "Host PEQ:", m, buttons );
   }
   Future<void> _chooseCEPeq( PEQ p ) async {
      assert( p != null );
      String msg1 = "Write One: Write this CE PEQ to the host, overwriting any host PEQ with the same hostIssueId or hostIssueTitle.\n\n";
      String msg2 = "Write All: Overwrite all host PEQs for this Code Equity Project with this PEQ and the others listed under \'Needing Repair\'.\n\n";
      String msg3 = "Note all historical data, such as comments, will be lost on the Host.";
      List<Widget> buttons = [];
      buttons.add( new TextButton( key: Key( 'Write one CE' ), child: new Text("Write one"), onPressed: () => _writeCEtoHost( p, false )) );
      buttons.add( new TextButton( key: Key( 'Write all CE' ), child: new Text("Write all"), onPressed: () => _writeCEtoHost( p, true  )) );
      buttons.add( new TextButton( key: Key( 'Dismiss' ), child: new Text("Dismiss"), onPressed: () => Navigator.of( context ).pop() ));

      Widget m = makeBodyText( appState, msg1 + msg2 + msg3, 3.0 * baseWidth, true, 8, keyTxt: "chooseCEPeq"+p.hostIssueId);
      popScroll( context, "CodeEquity PEQ:", m, buttons );
   }

   Future<void> _chooseHostPeq( PEQ p ) async {
      assert( p != null );
      String msg1 = "Write One: Write this Host PEQ to CodeEquity, overwriting any PEQ with the same hostIssueId or hostIssueTitle.\n\n";
      String msg2 = "Write All: Overwrite all CodeEquity PEQs for this Code Equity Project with all host PEQs listed under \'Needing Repair\'.\n\n";
      String msg3 = "Note that accrued PEQs in CodeEquity will not be modified.";
      List<Widget> buttons = [];
      buttons.add( new TextButton( key: Key( 'Write one host' ), child: new Text("Write one"), onPressed: () => _writeHostToCE( p, false )) );
      buttons.add( new TextButton( key: Key( 'Write all host' ), child: new Text("Write all"), onPressed: () => _writeHostToCE( p, true  )) );
      buttons.add( new TextButton( key: Key( 'Dismiss' ), child: new Text("Dismiss"), onPressed: () => Navigator.of( context ).pop() ));

      Widget m = makeBodyText( appState, msg1 + msg2 + msg3, 3.0 * baseWidth, true, 8, keyTxt: "chooseHostPeq"+p.hostIssueId);
      popScroll( context, "Host PEQ:", m, buttons );
   }
   
   void _cancel() {
      updateView = true;
      appState.hoverChunk = "";      
      Navigator.of( context ).pop();
   }


   Widget _makeCompare( bool same, bool noHost, bool noCE, String cat, String ceData, String hostData ) {
      final width = 1.3 * baseWidth;
      final spacer = Container( width: width );

      return Wrap( spacing: appState.FAT_PAD,
                   key: Key( "Wrap"+cat ),
                   children: [
                      Container( width: baseWidth, child: makeTableText( appState, cat, baseWidth, appState!.CELL_HEIGHT, false, 1 )),

                      noCE ?
                      spacer : 
                      makeToolTip(
                         Container( width: width, child: makeTableText( appState, ceData, baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                         ceData ),

                      noHost ?
                      spacer :
                      makeToolTip(  Container( width: width, child: makeTableText( appState, hostData, baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                    hostData ),
                      
                      same ? Icon( Icons.check_circle_outline, color: Colors.green ) : Icon( Icons.cancel_outlined, color: Colors.red )
                      ]);
   }

   Future<void> _detailPopup( context, PEQ? cePeq, PEQ? hostPeq, String status ) async {
      bool noHost = hostPeq == null;
      bool noCE   = cePeq == null;
      
      List<Widget> buttons = [];
      if( status == "bad" ) {
         if( !noCE )  { buttons.add( new TextButton( key: Key( 'Delete CodeEquity PEQ' ), child: new Text("Delete CodeEquity PEQ"), onPressed: () => _chooseDeleteCEPeq( cePeq ) )); }
         if( !noHost) { buttons.add( new TextButton( key: Key( 'Delete Host PEQ' ), child: new Text("Delete Host PEQ"), onPressed: () => _chooseDeleteHostPeq( hostPeq ) )); }
         if( !noCE )  { buttons.add( new TextButton( key: Key( 'Use CodeEquity PEQ' ), child: new Text("Use CodeEquity PEQ"), onPressed: () => _chooseCEPeq( cePeq ) )); }
         if( !noHost) { buttons.add( new TextButton( key: Key( 'Use Host PEQ' ), child: new Text("Use Host PEQ"), onPressed: () => _chooseHostPeq( hostPeq ) )); }
      }
      buttons.add( new TextButton( key: Key( 'Cancel' ), child: new Text("Cancel"), onPressed: _cancel ));

      List<Widget> comparison = [];

      String hostIssueTitle = noCE ? hostPeq!.hostIssueTitle : cePeq!.hostIssueTitle;
      print( "Got detail for " + hostIssueTitle );
      final mux = 1.0;
      final width = 1.3 * baseWidth;
      final spacer = Container( width: width );

      // Header
      comparison.add( Wrap( spacing: appState.FAT_PAD, children: [
                               Container( width: mux*baseWidth ),
                               Container( width: width, child: makeTableText( appState, "CodeEquity Data", baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                               Container( width: width, child: makeTableText( appState, "Host Data", baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                               ]) );
      comparison.add( makeHDivider( appState, 3 * baseWidth, appState.GAP_PAD*3.0, appState.GAP_PAD * 2.0, tgap: appState.TINY_PAD ));

      
      if( noHost || noCE ) {
         final w = 2*width + mux*baseWidth + .5 * baseWidth;
         String msg = noCE ? "NOTE: CodeEquity Peq is not available." : "NOTE: Host Peq is not available.";
         comparison.add( Wrap( spacing: appState.FAT_PAD, children: [ Container( width: w, child: makeTableText( appState, msg, w, appState!.CELL_HEIGHT, false, 1 )) ]) );
      }

      String orderedCEHolderId = "";
      String orderedHPHolderId = "";
      if( cePeq != null && cePeq.hostHolderId != null ) {
         cePeq.hostHolderId.sort( (a,b) => a.compareTo(b) );
         orderedCEHolderId = cePeq.hostHolderId.toString();
      }
      if( hostPeq != null && hostPeq.hostHolderId != null ) {
         hostPeq.hostHolderId.sort( (a,b) => a.compareTo(b) );
         orderedHPHolderId = hostPeq.hostHolderId.toString();
      }
      
      bool same = !noCE && !noHost && cePeq.hostIssueTitle == hostPeq.hostIssueTitle;
      comparison.add( _makeCompare( same, noHost, noCE, "Title:", cePeq?.hostIssueTitle ?? "", hostPeq?.hostIssueTitle ?? "" ) );
      
      same = !noCE && !noHost && cePeq.peqType == hostPeq.peqType;
      comparison.add( _makeCompare( same, noHost, noCE, "Peq Type:", enumToStr( cePeq?.peqType ?? PeqType.end ), enumToStr( hostPeq?.peqType ?? PeqType.end ) ));
      
      same = !noCE && !noHost && cePeq.ceProjectId == hostPeq.ceProjectId;
      comparison.add( _makeCompare( same, noHost, noCE, "CE Project Id:", cePeq?.ceProjectId ?? "", hostPeq?.ceProjectId ?? "" ));
      
      same = !noCE && !noHost && ( hostPeq.amount != null && (cePeq.amount - hostPeq.amount ).abs() < 1 );
      comparison.add( _makeCompare( same, noHost, noCE, "PEQ Amount:", (cePeq?.amount ?? -1).toString(), (hostPeq?.amount ?? -1).toString() ));
      
      same = !noCE && !noHost && cePeq.hostRepoId == hostPeq.hostRepoId;
      comparison.add( _makeCompare( same, noHost, noCE, "Host Repo Id:", cePeq?.hostRepoId ?? "", hostPeq?.hostRepoId ?? "" ));
      
      same = !noCE && !noHost && cePeq.hostIssueId == hostPeq.hostIssueId;
      comparison.add( _makeCompare( same, noHost, noCE, "Host Issue Id:", cePeq?.hostIssueId ?? "", hostPeq?.hostIssueId ?? "" ));
      
      same = !noCE && !noHost && hostPeq.hostHolderId != null && setEquals( cePeq.hostHolderId.toSet(), hostPeq.hostHolderId.toSet() );
      comparison.add( _makeCompare( same, noHost, noCE, "Host Assignees:", orderedCEHolderId, orderedHPHolderId ));

      same = !noCE && !noHost && hostPeq.hostProjectSub != null && eq( cePeq.hostProjectSub, hostPeq.hostProjectSub );
      comparison.add( _makeCompare( same, noHost, noCE, "Host Location:", (cePeq?.hostProjectSub ?? "").toString(), (hostPeq?.hostProjectSub ?? "").toString() ));
             
      Widget scrollBody = Column(
         mainAxisSize: MainAxisSize.max,
         mainAxisAlignment: MainAxisAlignment.spaceBetween,
         children: comparison );
      
      final retVal = await showDialog(
         context: context,
         builder: (BuildContext context) {
                          return AlertDialog(
                             scrollable: true,
                             title: new Text( "CodeEquity vs Host PEQ Data" ),
                             content: Container( width: 5.0 * baseWidth, child: scrollBody ),
                             actions: buttons);
                       });
      if( retVal == null ) {
         // Background clicked, or browser back button
         updateView = true;
         appState.hoverChunk = "";      
      }
   }

   Widget _peqDetail( context, cp, hp, status ) {
      String hostIssueTitle = cp == null ? hp.hostIssueTitle : cp.hostIssueTitle;
      String hostIssueId    = cp == null ? hp.hostIssueId    : cp.hostIssueId;
      
      void _unsetTitle( PointerEvent event ) {
         updateView = true;         
         setState(() { appState.hoverChunk = ""; });
      }
      
      void _setTitle( PointerEvent event ) {
         updateView = true;
         setState(() { appState.hoverChunk = hostIssueTitle; });
      }
      
      return GestureDetector(
         onTap: () async
         {
            await _detailPopup( context, cp, hp, status ); 
         },
         key: Key( 'peqDetail ' + hostIssueId ),
         child: makeClickTableText( appState, hostIssueTitle,  _setTitle, _unsetTitle, 1.3*baseWidth, false, 1, iw: false )
         );
   }

   Widget _makeHeader ( int element, _SortType stAsc, _SortType stDsc ) {
      Widget icon = empty;
      String key = "togglePos" + element.toString();
      assert( headerDims.length == listHeaders.length );
      assert( _SortType.values.length >= 2*element + 1 );

      if( sortType == _SortType.values[ 2 * element ] )          { icon = Icon( Icons.arrow_drop_up, size: 20.0 ); }
      else if( sortType == _SortType.values[ 2 * element + 1 ] ) { icon = Icon( Icons.arrow_drop_down, size: 20.0 ); }

      final mux = element == 0 ? 2.7 : 1.0;
      return GestureDetector(
         onTap: () async { updateView = true; setState(() => sortType = ( sortType == stAsc ? stDsc : stAsc )); },
         key: Key( key ),
         child: Container( width: headerDims[element],
                           child: Wrap( spacing: 0,
                                        children: [
                                           makeIWTableText( appState, listHeaders[element], baseWidth, appState!.CELL_HEIGHT, false, 1, mux: mux),
                                           icon
                                           ])
            )
         );
   }

   // stable sort based on the idx'th component of the list l.
   // Needed otherwise when hover over title, a regularly sorted list can change order.
   _stableSort( List<List<dynamic>> parts, idx, bool ascending, { isInt = false } ) {

      // MapEntry is an entry in a map.  a 'pair' in many senses.  Create a list of pairs (string, original_index)
      final List< MapEntry<List<dynamic>, int> > indexedList = [];
      for (int i = 0; i < parts.length; i++) {
         indexedList.add( MapEntry( parts[i], i) );
      }
      
      // Sort, use original index for tie-breaking to ensure stability.
      indexedList.sort((a, b) {
            var comp = 0;

            if( !isInt ) { comp = ascending ? a.key[idx].compareTo( b.key[idx] ) : b.key[idx].compareTo( a.key[idx] ); }
            else         { comp = ascending ?
                  int.parse( a.key[idx] ).compareTo( int.parse( b.key[idx] ) ) :
                  int.parse( b.key[idx] ).compareTo( int.parse( a.key[idx] ) );
            }
            if( comp != 0 ) { return comp; }
            return a.value.compareTo( b.value );
         });
      
      // Reconstruct the stable-sorted list of strings
      final List<List<dynamic>> stableSortedList = indexedList.map((entry) => entry.key).toList();
      return stableSortedList;
   }

   
   List<List<Widget>> _makePeqs( List<List<dynamic>> parts, String status, int dummyCount ) {
      List<List<Widget>> retVal = [];
      // insert dummy headers to make subsequent construction easier
      for( int i = 0; i < dummyCount; i++ ) {
         retVal.add( [ vSpace, empty, empty, empty, empty ] );
      }
      if( parts.length == 0 ) { return retVal; }

      if( peqHeader.length < 1 || updateView ) {
         
         peqHeader = [];
         final row0Width = 1.45*baseWidth + 1.7*appState.GAP_PAD; // need to add in left indent in mtt
         headerDims = [ row0Width, 1.4*baseWidth, 0.6*baseWidth, 0.6*baseWidth, 1.7*baseWidth ];

         Widget row0 = _makeHeader( 0, _SortType.titleAsc,  _SortType.titleDsc );
         Widget row1 = _makeHeader( 1, _SortType.hprojAsc,  _SortType.hprojDsc );
         Widget row2 = _makeHeader( 2, _SortType.pvalAsc,   _SortType.pvalDsc );
         Widget row3 = _makeHeader( 3, _SortType.ptypeAsc,  _SortType.ptypeDsc );
         Widget row4 = _makeHeader( 4, _SortType.assignAsc, _SortType.assignDsc );
         
         peqHeader.add( [ vSpace, vSpace, vSpace, vSpace, vSpace ] );
         peqHeader.add( [ row0, row1, row2, row3, row4 ] );
         peqHeader.add( [ makeHDivider( appState, 4 * baseWidth, appState.GAP_PAD*3.5, appState.GAP_PAD * 4.0 ), empty, empty, empty, empty ] );
      }

      retVal.addAll( peqHeader );

      // Sort before building widgets
      assert( parts[0].length == 7 );

      if( sortType == _SortType.titleAsc )  { parts = _stableSort( parts, 2, true ); }  
      if( sortType == _SortType.titleDsc )  { parts = _stableSort( parts, 2, false ); } 

      if( sortType == _SortType.hprojAsc )  { parts = _stableSort( parts, 3, true ); }  
      if( sortType == _SortType.hprojDsc )  { parts = _stableSort( parts, 3, false ); } 

      if( sortType == _SortType.pvalAsc )   { parts = _stableSort( parts, 4, true,  isInt: true ); } 
      if( sortType == _SortType.pvalDsc )   { parts = _stableSort( parts, 4, false, isInt: true ); }

      if( sortType == _SortType.ptypeAsc )  { parts = _stableSort( parts, 5, true ); } 
      if( sortType == _SortType.ptypeDsc )  { parts = _stableSort( parts, 5, false ); }

      if( sortType == _SortType.assignAsc ) { parts = _stableSort( parts, 6, true ); }
      if( sortType == _SortType.assignDsc ) { parts = _stableSort( parts, 6, false ); }
      
      for( List<dynamic> part in parts ) {
         assert( part.length == 7 );
         Widget title   = paddedLTRB( _peqDetail(context, part[0], part[1], status ), 2 * appState.GAP_PAD, 0, 0, 0 );               
         Widget hproj   = Container( width: headerDims[1], child: makeTableText( appState, part[3], baseWidth, appState!.CELL_HEIGHT, false, 1 ));
         Widget peqVal  = Container( width: headerDims[2], child: makeTableText( appState, part[4], baseWidth, appState!.CELL_HEIGHT, false, 1 ));
         Widget peqType = Container( width: headerDims[3], child: makeTableText( appState, part[5], baseWidth, appState!.CELL_HEIGHT, false, 1 ));               
         Widget assign  = Container( width: headerDims[4], child: makeTableText( appState, part[6], baseWidth, appState!.CELL_HEIGHT, false, 1 ));
         retVal.add( [ title, hproj, peqVal, peqType, assign ] );
      }
      return retVal;
   }


   
   List<List<Widget>> _getBody( context, cep ) {
      final buttonWidth = 100;
      final dummyHeaderCount = 3;
      // print( ' .. getBody build ' + peqsLoaded.toString() + updateView.toString() );
      
      Widget categoryHDiv = makeHDivider( appState, 4.5 * baseWidth, appState.GAP_PAD*3.0, appState.GAP_PAD * 2.0, tgap: appState.TINY_PAD );

      List<List<Widget>> gone;
      List<List<Widget>> bad;
      List<List<Widget>> good;

      // Load the *parts from hpeqs and cpeqs
      if( peqsLoaded && updateModel ) {
         updateView = true;                   // if model changes, update view too
         cPeqs.clear();
         hPeqs.clear();
         badPeqs   = [];
         goneParts = [];
         goodParts = [];
         badParts  = [];

         appState.cePeqs[ cep.ceProjectId ]!.forEach( (p) {
               assert( p.hostIssueId != null );
               // do NOT filter on active, that is a host-specific flag
               cPeqs[p.hostIssueId] = p; 
            });
         appState.hostPeqs[ cep.ceProjectId ]!.forEach( (p) {
               assert( p.hostIssueId != null );
               hPeqs[p.hostIssueId] = p;
            });

         // Working from cPeqs gives complete 'gone' and 'good' picture, but incomplete 'bad' picture.
         cPeqs.forEach( (k,v) {
               // several widgets here identical with those in approvalFrame.. but not quite enough sharing to refactor
               assert( v.hostProjectSub.length >= 2 );
               String title   = v.hostIssueTitle;
               String hproj   = v.hostProjectSub[ v.hostProjectSub.length - 2 ];
               String peqVal  = v.amount.toString();
               String peqType = enumToStr(v.peqType);
               List<String> userNames = v.ceHolderId.map( (ceuid) {
                     assert( appState.cePeople[ceuid] != null );
                     return appState.cePeople[ceuid]!.userName;
                  }).toList();
               userNames.sort( (a,b) => a.compareTo(b) );
               
               PEQ? h = hPeqs[k];
               if( !v.active && v.peqType == PeqType.grant ) { goneParts.add( [ v, h, title, hproj, peqVal, peqType, userNames.toString() ] ); }
               else if( _same( v, h ) )                      { goodParts.add( [ v, h, title, hproj, peqVal, peqType, userNames.toString() ] ); }
               else {
                  badParts.add( [ v, h, title, hproj, peqVal, peqType, userNames.toString() ] );
                  badPeqs.add( k );
               }
            });

         // XXX clean getBody
         // complete the 'bad' picture
         hPeqs.forEach( (k,v) {
               // if there is a cpeq for this hostPeq, then is already in 1 of 3 categories above
               if( cPeqs[k] == null ) {
                  String title   = v.hostIssueTitle;
                  String hproj   = v.hostProjectSub[ v.hostProjectSub.length - 2 ];
                  String peqVal  = v.amount.toString();
                  String peqType = enumToStr(v.peqType);
                  List<String> userNames = v.ceHolderId.map( (ceuid) {
                        assert( appState.cePeople[ceuid] != null );
                        return appState.cePeople[ceuid]!.userName;
                     }).toList();
                  userNames.sort( (a,b) => a.compareTo(b) );
                  
                  badParts.add( [ null, v, title, hproj, peqVal, peqType, userNames.toString() ] );
                  badPeqs.add( k );
               }
            });

         updateModel = false;
      }

      if( updateView ) {
         Widget expandGone = GestureDetector(
            onTap: () async { updateView = true; setState(() => toggleGone = false ); },
            key: Key( 'toggleGone'),
            child: makeToolTip( Icon( Icons.arrow_drop_down ), "Expand", wait: true )
            );
         
         Widget shrinkGone = GestureDetector(
            onTap: () async { updateView = true; setState(() => toggleGone = true ); },
            key: Key( 'toggleGone'),
            child: makeToolTip( Icon( Icons.arrow_drop_down_circle ), "hide", wait: true )
            );
         
         Widget expandBad = GestureDetector(
            onTap: () async { updateView = true; setState(() => toggleBad = false ); },
            key: Key( 'toggleBad'),
            child: makeToolTip( Icon( Icons.arrow_drop_down ), "Expand", wait: true )
            );
         
         Widget shrinkBad = GestureDetector(
            onTap: () async { updateView = true; setState(() => toggleBad = true ); },
            key: Key( 'toggleBad'),
            child: makeToolTip( Icon( Icons.arrow_drop_down_circle ), "hide", wait: true )
            );
         
         Widget expandGood = GestureDetector(
            onTap: () async { updateView = true; setState(() => toggleGood = false ); },
            key: Key( 'toggleGood'),
            child: makeToolTip( Icon( Icons.arrow_drop_down ), "Expand", wait: true )
            );
         
         Widget shrinkGood = GestureDetector(
            onTap: () async { updateView = true; setState(() => toggleGood = true ); },
            key: Key( 'toggleGood'),
            child: makeToolTip( Icon( Icons.arrow_drop_down_circle ), "hide", wait: true )
            );

         // This is view-centric, involves sorting and title highlighting
         gone = _makePeqs( goneParts, "good", dummyHeaderCount );  // dummy space for vspace, then actual header 0 and header 1
         bad  = _makePeqs( badParts,  "bad",  dummyHeaderCount );
         good = _makePeqs( goodParts, "good", dummyHeaderCount );

         // updateModel is performed first.  gone/good/bad are all be length dummyHeaderCount+ here, with pos 0 being vSpace that need not be overwritten
         // overwrite old headers
         assert( gone.length >= dummyHeaderCount );
         assert( bad.length  >= dummyHeaderCount );
         assert( good.length >= dummyHeaderCount );
         
         if( bad.length >  3  ) { goodStatus = false; }
         else                   { goodStatus = true; }
         
         body = [];

         int peqLen      = gone.length > dummyHeaderCount ? (gone.length - peqHeader.length - dummyHeaderCount) : 0;
         String goneText = peqLen.toString() + " PEQs are granted and in good standing, but no longer visible on the host.";
         Widget category = paddedLTRB( makeTitleText( appState, "Unavailable on host", 1.5*buttonWidth, false, 1, fontSize: 16 ), appState.FAT_PAD, 0, 0, 0 );
         gone[1] = [ empty, category,
                     makeTitleText( appState, goneText, 6*buttonWidth, false, 1 ),
                     toggleGone ? expandGone : shrinkGone, empty ];
         gone[2] = [ categoryHDiv, empty, empty, empty, empty ];      
         
         peqLen         = bad.length > dummyHeaderCount ? (bad.length - peqHeader.length - dummyHeaderCount) : 0;
         String disText = peqLen.toString() + " PEQs are mismatched.  Click in to choose how to make repairs.";
         category       = paddedLTRB( makeTitleText( appState, "Needing Repair", 1.5*buttonWidth, false, 1, fontSize: 16 ), appState.FAT_PAD, 0, 0, 0 );      
         bad[1] = [ empty, category, 
                    makeTitleText( appState, disText, 6*buttonWidth, false, 1 ),
                    toggleBad ? expandBad : shrinkBad, empty ];
         bad[2] = [ categoryHDiv, empty, empty, empty, empty ];      
         
         peqLen         = good.length > dummyHeaderCount ? (good.length - peqHeader.length - dummyHeaderCount) : 0;
         String agrText = peqLen.toString() + " PEQs match.  Nothing needs be done here.";
         category       = paddedLTRB( makeTitleText( appState, "In Agreement", 1.5*buttonWidth, false, 1, fontSize: 16 ), appState.FAT_PAD, 0, 0, 0 );            
         good[1] = [ empty, category, 
                     makeTitleText( appState, agrText, 6*buttonWidth, false, 1 ),
                     toggleGood ? expandGood : shrinkGood, empty ];
         good[2] = [ categoryHDiv, empty, empty, empty, empty ];      
         
         body.addAll( toggleGone ? gone.sublist( 0, 3 ) : gone );
         body.addAll( toggleBad  ? bad.sublist(  0, 3 ) : bad );
         body.addAll( toggleGood ? good.sublist( 0, 3 ) : good );

         body.addAll( [[Container( width: appState.GAP_PAD*1.8 ),
                        makeActionButtonFixed(
                               appState,
                               "Update Status?",
                               buttonWidth, 
                               () async {
                                  showToast( "Updated." );
                                  _reset( pop: false ); 
                               }),
                        empty, empty, empty ]] );
         
         updateView = false;
      }
      return body;
   }
   
   Widget getStatus( context ) {

      List<List<Widget>> pending = [];

      // print( ' .. getStatus build '  + peqsLoaded.toString() + updateView.toString() + ingestNoticeDisplayed.toString() );
      CEProject? cep = appState.ceProject[ appState.selectedCEProject ];
      if( cep == null ) { return makeTitleText( appState, "First choose Project from home screen.", 8*appState.CELL_HEIGHT, false, 1, fontSize: 16); }

      if( appState.cePeqs[ cep.ceProjectId ] != null  &&  appState.hostPeqs[ cep.ceProjectId ] != null   ) { peqsLoaded  = true; }
      // Note, this runs in a sep thread, so ingest notice can fire before the first build finishes
      _loadPeqs( cep! );

      // header afterwards to get status.  If need ingest, don't print header as it will say status is good
      if( !ingestNoticeDisplayed ) {  
         if( peqsLoaded && ( updateModel || updateView )) { pending.addAll( _getBody( context, cep! ) ); }
         else                                             { pending.addAll( body ); }
         
         pending.insertAll( 0, _getHeader( context, cep! ) ); 
      }
      
      return ScrollConfiguration(
         behavior: MyCustomScrollBehavior(),
         child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
               height: svHeight,
               width: svWidth,
               child: ListView(
                  children: List.generate(
                     pending.length,
                     (indexX) => Row(
                        key: Key( 'pending ' + ( indexX - widget.headerTop ).toString() ),                           
                        children: List.generate( 
                           pending[0].length,
                           (indexY) => pending[indexX][indexY] ))
                     )))));

   }

   
   @override
   Widget build(BuildContext context) {

      container = widget.appContainer;   
      appState  = container.state;
      assert( appState != null );

      svHeight       = ( appState.screenHeight - widget.frameHeightUsed ) * .9;
      svWidth        = appState.MAX_PANE_WIDTH; 
      baseWidth      = ( appState.MIN_PANE_WIDTH - 2*appState.FAT_PAD ) / 2.0;
      
      empty     = Container( width: 1, height: 1 );
      fatPad    = Container( width: appState.FAT_PAD, height: 1 );
      vSpace    = Container( width: 1, height: appState!.CELL_HEIGHT * .4 );
      Widget miniHor   = Container( height: 1, width: 1.7 * appState.GAP_PAD );       // XXX

      Widget hd    = makeHDivider( appState, svWidth - 2*appState.GAP_PAD, appState.TINY_PAD, appState.TINY_PAD, tgap: appState.TINY_PAD, bgap: appState.TINY_PAD );
      hdiv         = Wrap( spacing: 0, children: [fatPad, hd] );   

      // if( appState.verbose >= 1 ) { print( "STATUS BUILD. " + ingestNoticeDisplayed.toString() + " " + enumToStr( sortType )); }
      if( appState.verbose >= 4 ) { print( "STATUS BUILD. " + updateView.toString() + " " + updateModel.toString() + " " + enumToStr( sortType )); }
      
      return getStatus( context );
   }
}
