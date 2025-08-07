import 'dart:convert';  // json encode/decode
import 'dart:async';
import 'dart:typed_data';

import 'package:collection/collection.dart';      // list equals, firstwhereornull
import 'package:fluttertoast/fluttertoast.dart';
import 'package:tuple/tuple.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';
import 'package:ceFlutter/utils/awsUtils.dart';

import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/PEQAction.dart';
import 'package:ceFlutter/models/PEQSummary.dart';
import 'package:ceFlutter/models/Allocation.dart';
import 'package:ceFlutter/models/HostLoc.dart';
import 'package:ceFlutter/models/EquityPlan.dart';

Function listEq = const ListEquality().equals;

final CEUID_PLACEHOLDER = "HostUSER";

// Allow separate _vPrints. It is handy when debugging to turn entire module verbosity up or down in 1 spot.
// lower values harder to print
void _vPrint( appState, v, String astring ) {
   // XXX
   if( v + 2 >= appState.verbose ) { print( astring ); }
}

// XXX With move from Allocations stored with hostUserId, to ceUserId, uses of this go away once GH sends next_global_id
//     pact.subject assignees are names, currently.  The payload for assignees still reports the node_id in the legacy form.
//     The next globalId is not available without a specific query, or more state in ceServer.
//     Stay with this until new_global_id is actually sent in payload.
String _convertNameToId( appState, String aname ) {

   String hostUserId = appState.idMapHost.keys.firstWhere( (k) => appState.idMapHost[k]['hostUserName'] == aname, orElse: () => aname );
   // if( hostUserId == aname ) { print( "XXX Convert is no-op " + aname ); }
   // else { print( "YYY Convert converted " + aname + " " + hostUserId ); }
   return hostUserId;
}


// XXX associateGithub has to update appState.idMapHost
// PActions, PEQs are added by webServer, which does not have access to ceUID.
// set CEUID by matching my peqAction:hostUserId to CEHostUser:HostUserId, then writing that CEUserId
// if there is not yet a corresponding ceUID, use "HOSTUSER: $hostUserId" in it's place, to be fixed later by associateGitub XXX (done?)
// NOTE: Expect multiple PActs for each PEQ.  For example, open, close, and accrue
// NOTE: These are initial conditions, before todos are processed.
Future _updateCEUID( appState, todos, context, container, peqMods ) async {

   _vPrint( appState, 4, "Updating CE UIDs" );

   for( var tup in todos ) {
      PEQAction pact = tup.item1;
      PEQ       peq  = tup.item2;
      var       origHIDLen = peq.ceHolderId.length; 

      // hostUserId is actor, pact records actor only.
      String hostUID  = pact.hostUserId;
      assert( appState.idMapHost.containsKey( hostUID ) );
      String ceu = appState.idMapHost[ hostUID ]['ceUID'];
      
      // Too aggressive.  If run 'refresh repos' from homepage, hostAccount is rewritten with new repo list, at which point pacts are updated with 'new' ceuid.
      //                  This is done because in some (many?) cases, pacts are created by a host user before that user has a CEUID.
      // assert( pact.ceUID == appState.EMPTY );
      assert( pact.ceUID == appState.EMPTY || pact.ceUID == ceu );
      
      // XXX Collect putPActCEUID, shoot upstream in 1 chunk as is done with updateDynamoPeqMods. 
      if( ceu != "" ) {
         // Don't await here, CEUID not used during processPEQ
         updateDynamo( context, container, '{ "Endpoint": "putPActCEUID", "CEUID": "$ceu", "PEQActionId": "${pact.id}" }', "putPActCEUID" );
      }

      // PEQ holder may have been set via earlier PAct.  But here, may be adding or removing CEUIDs
      // This is a no-op for many PActs.  For example, hostHolderId will not be set in most cases until during or after ingest.
      // BUT for splits with existing assignees, but no addAssignee pact, this is required.
      peq.ceHolderId = [];
      for( var peqHostUser in peq.hostHolderId ) {
         if( !appState.idMapHost.containsKey( peqHostUser )) {
            print( peqHostUser );
            print( peq.toString() );
            print( appState.idMapHost.toString() );
            assert( appState.idMapHost.containsKey( peqHostUser ) );
         }
         String ceUID = appState.idMapHost[ peqHostUser ]['ceUID'];
         if( ceUID == "" ) { ceUID = CEUID_PLACEHOLDER + ": " + peqHostUser; }
         peq.ceHolderId.add( ceUID );
      }
      
      // Ignore CEGrantorId.  Must already be signed up to authorize PEQ, so all IDs will already be correct.
      // Update PEQ, if there is one
      if( peq.id != "-1" ) {
         var peqData            = {};
         peqData['id']          = peq.id;
         peqData['ceHolderId']  = peq.ceHolderId;
         _addMod( context, container, peq, peqData, peqMods );   
      }
   }
}

// This is the single location where a source allocation is added to the summary.
// One allocation per category: project:column:assignee.
// HostProjectId:
//   peqs (correctly) do not hold host information.
//   every confirm add has a confirm relo.    every relo has an hpid.  propagate from here.
//   it's possible to come in with propose accrue (i.e. create in PEND), buuut then you get confirm add, confirm relo, no propose.
//   if propose from existing, should have source alloc.

void adjustSummaryAlloc( appState, peqId, List<String> cat, String subCat, splitAmt, PeqType peqType, {Allocation? source = null, String pid = ""} ) {
   
   assert( appState.myPEQSummary.allocations != null );

   // splitAmt arrives as double to avoid huge rounding errors when calculating assignee shares.  Drop remainder here
   int splitAmount = splitAmt.toInt();
   
   // subCat is assignee, hostUID.
   List<String> suba = new List<String>.from( cat );
   if( source == null ) {
      assert( subCat != appState.EMPTY );
      suba.add( subCat );
   }
   else {
      suba   = source.category;
      subCat = source.category.last;
      if( pid == "" ) { pid = ( source.hostProjectId ?? "" ); }
   }

   String ceUID = ( appState.idMapHost[subCat] == null || appState.idMapHost[subCat]["ceUID"] == null )
                  ? appState.UNASSIGN_USER
                  : appState.idMapHost[subCat]["ceUID"];

   if( splitAmount > 0 ) { _vPrint( appState, 1, "Adjust up   summary allocation " + suba.toString() ); }
   else                  { _vPrint( appState, 1, "Adjust down summary allocation " + suba.toString() ); }

   // Update, if already in place
   Allocation? alloc = appState.myPEQSummary.getByCategory( suba.toString() ) ?? null;
   if( alloc != null ) {
      // print( " ... matched category: " + suba.toString()  );
      alloc.amount = ( alloc!.amount! + splitAmount ).toInt();
      
      // Assignee notices can arrive late.  If correction here is obvious, do it.
      // Case 1: assignee notice arrives after propose accrue, then reject accrue.  Problem is on adjust down, not up.
      //         in this case, attempt to remove from [path, Pending PEQ Approval, assignee] but alloc is actually in [path, X, assignee]
      if( alloc.amount! < 0 ) {
         print( "WARNING.  Detected negative allocation, likely due to out of order Notifications.  Attempting to repair." );
         for( var allocActual in appState.myPEQSummary.getAllAllocs() ) {  
            if( allocActual.sourcePeq.containsKey( peqId ) &&
                allocActual.category.last == suba.last     &&
                listEq( allocActual.category.sublist( 0, allocActual.category.length - 2 ), suba.sublist( 0, suba.length - 2 ) )) {
               
               print( "... found where the late assignment allocation went: " + allocActual.category.toString() );
               alloc.amount       = ( alloc.amount!    - splitAmount ).toInt();
               allocActual.amount = allocActual.amount + splitAmount;
               assert( allocActual.amount >= 0 && splitAmount < 0 );
               if ( allocActual.amount == 0 )  { appState.myPEQSummary.removeAlloc( allocActual ); }
               else                            { appState.myPEQSummary.removeSourcePeq( allocActual, peqId ); }
               
               return;                  
            }
         }
      }
      assert( alloc.amount! >= 0 );

      // ug.  Null protection is visually confusing at times.  This is not !==, but rather ==.
      if     ( alloc.amount! == 0 )                                        { appState.myPEQSummary.removeAlloc( alloc ); }
      else if( alloc.sourcePeq!.containsKey(  peqId ) && splitAmount < 0 ) { appState.myPEQSummary.removeSourcePeq( alloc, peqId ); }
      else if( !alloc.sourcePeq!.containsKey( peqId ) && splitAmount > 0 ) { appState.myPEQSummary.addSourcePeq( alloc, peqId, splitAmount ); }
      else {
         // This should not be overly harsh.  Negotiations can remove then re-add.
         print( "Error.  Uh oh.  AdjustSummaryAlloc $splitAmount $peqId " + alloc.toString() );
         // assert( false );
      }
      
      return;
   }
   
   // If we get here, could not find existing match. 
   // if peqType == end, we are reducing an existing allocation.
   assert( peqType != PeqType.end && splitAmount >= 0 );
   assert( source == null );
   assert( splitAmount > 0 );
   assert( suba.length >= 3 );

   // suba will have an extra "assignee" attached.
   String assignee      = subCat;
   List<String> catBase = suba.sublist(0, suba.length-1);
   
   // Create allocs, if not already updated
   _vPrint( appState, 1, " ... adding new Allocation" );
   Allocation newAlloc = new Allocation( category: suba, categoryBase: catBase, amount: splitAmount, sourcePeq: {peqId: splitAmount}, allocType: peqType,
                                      ceUID: ceUID, hostUserId: assignee, vestedPerc: 0.0, notes: "", hostProjectId: pid );

   appState.myPEQSummary.addAlloc( newAlloc );
}


// Oh boy.  dart extensions are ugly, dart templates via abstract are much worse.  For now, 
void _swap( List<Tuple2<PEQAction, PEQ>> alist, int indexi, int indexj ) {
   assert( indexi < alist.length );
   assert( indexj < alist.length );
   Tuple2<PEQAction, PEQ> elti = alist[indexi];
   alist[indexi] = alist[indexj];
   alist[indexj] = elti;
}


// In a handful of cases, like BLAST issue testing, some operations can arrive in a bad order.  Reorder, as needed.
// 
// Case 1: "add assignee" arrives before the peq issue is added.
//         PPA has strict guidelines from ceServer for when info in peq is valid - typically first 'confirm' 'add'.  assert protected.
// Case 2: <removed>
// Case 3: "add" will arrive twice in many cases, one addRelo for no status (when peq label an issue), then the second when situating the issue
//          ignore the second add, it is irrelevant
// Case 4: "relo"  _relo handles allocation removal.  ignore delete and let relo manage local kp
// Case 5: Creating a card during blast can begin with card in 'No Status' column.  Rarely, relo to No Status pact arrives after
//         relo to actual location.
// 
// Need to have seen a 'confirm' 'add' before another action, in order for the allocation to be in a good state.
// This will either occur in current ingest batch, or is already present in mySummary from a previous update.
// Remember, all peqs are already in aws, either active or inactive, so no point to look there.
// NOTE: Could speed this up somewhat - save some work, hashmap, etc.  but most of time is in communication with host, aws.
Future fixOutOfOrder( List<Tuple2<PEQAction, PEQ>> todos, context, container ) async {

   final appState            = container.state;
   List<String>           kp = []; // known peqs, with todo index
   Map<String,List<int>>  dp = {}; // demoted peq: list of positions in todos
   List<int>              it = []; // ignore todo.  ignore 2nd add of peq, index.  ignore delete of relocated peq.
   List<String>           ip = []; // ignore 2nd add of peq, peqId, to allow quick failure check

   // build kp from mySummary.  Only active peqs are part of allocations.
   if( appState.myPEQSummary != null ) {
      for( Allocation alloc in appState.myPEQSummary.getAllAllocs() ) {
         assert( alloc.sourcePeq != null );
         kp = kp + alloc.sourcePeq!.keys.toList();
      }
      kp = kp.toSet().toList();  // if this way to remove duplicates turns out to be slow, use hashmap
   }

   _vPrint( appState, 4, "Initial known peq-allocs: " + kp.toString() );

   // Case 1.  Fairly generic - if operation depends on peq, but haven't added it yet, swap the operation with the following confirm.add
   // look through current ingest batch for issues to resolve.
   for( int i = 0; i < todos.length; i++ ) {
      PEQAction pact = todos[i].item1;
      PEQ       peq  = todos[i].item2;

      _vPrint( appState, 1, i.toString() + ": Working on " + peq.hostIssueTitle + ": " + peq.id );

      if( peq.id == "-1" ) { continue; }
      bool deleted = false;
      bool ignored = false;
      
      // print( pact );
      // print( peq );
      
      // update known peqs with current todo.
      if( pact.verb == PActVerb.confirm && pact.action == PActAction.add ) {
         if( kp.contains( peq.id ) ) {
            it.add( i );
            // make sure peq was not added more than twice
            assert( !ip.contains( peq.id ) );
            ip.add( peq.id );
            ignored = true;
            _vPrint( appState, 2, "   Ignoring 2nd add of peq " + peq.hostIssueTitle + " " + peq.id );            
         }
         else {
            kp.add( peq.id );
            _vPrint( appState, 1, "   Adding known peq " + peq.hostIssueTitle + " " + peq.id );
         }
      }
      else if( pact.verb == PActVerb.confirm && pact.action == PActAction.delete && pact.note != PActNotes['transfer'] ) {  
         assert( kp.contains( peq.id ) );
         kp.remove( peq.id );
         deleted = true;
         _vPrint( appState, 1, "   Removing known peq " + peq.hostIssueTitle + " " + peq.id + " " + peq.active.toString());
      }
      else if( pact.verb == PActVerb.confirm && pact.action == PActAction.delete && pact.note == PActNotes['transfer'] ) {
         assert( false ); // XXX verify. no longer possible
         _vPrint( appState, 2, "   Ignoring delete for relocated peq" + peq.hostIssueTitle + " " + peq.id + " " + peq.active.toString());
         it.add( i );
         ignored = true;
      }
      else if( pact.verb == PActVerb.confirm && pact.action == PActAction.relocate && pact.subject.last == "No Status" ) {
         // Case 5
         // XXX it is remotely possible that incremental ingest boundary sits between a blast 'no status' and '<proper location>'
         //     it is remotely possible that '<proper location>' pact arrived much earlier.
         //     in both cases, currently relying on nightly sanity check to repair.
         // XXX Next time this fails to recover, add check to GH
         assert( pact.subject.length == 3 );
         print( "Case 5 check " + pact.subject[0] );
         for( int j = i-1; j >= 0; j-- ) {
            PEQAction pactEarlier = todos[j].item1;

            print( "Checking " + j.toString() );

            // Stop if pass 1s (only failure known as of 3/2025 was 4ms off)
            if( pact.timeStamp - pactEarlier.timeStamp > 1000 ) { print( "Looks like a valid No Status location" );  break; }

            // Pact in range.. check if relocate same PEQ.  If so, direct swap, no other interactions
            if( pactEarlier.verb == PActVerb.confirm && pactEarlier.action == PActAction.relocate ) {
               assert( pactEarlier.subject.length == 3 );
               if( pact.subject[0] == pactEarlier.subject[0] ) {
                  print( "  .. got a winner.  Swap " + i.toString() + " " + j.toString() + " " + (pact.timeStamp - pactEarlier.timeStamp).toString() + "ms" );
                  print( pactEarlier );
                  print( pact );
                  _swap( todos, i, j );
                  break;
               }
            }
         }
      }

      // print( "    KP: " + kp.toString() );
      
      if( !ignored ) {
         
         // update demotion status.
         // Undemote if have demoted from earlier, and just saw confirm add.  If so, swap all down one.
         if( dp.containsKey( peq.id ) && kp.contains( peq.id ) ) {
            assert( dp[peq.id]!.length > 0 );
            dp[peq.id]!.sort();
            
            // sort is lowest to highest.  Keep swapping current todo up the chain in reverse order, has the effect of pushing all down.
            int confirmAdd = i;
            for( int j = dp[peq.id]!.length-1; j >= 0; j-- ) {
               _vPrint( appState, 2, "   swapping todo at position:" + confirmAdd.toString() + " to position:" + dp[peq.id]![j].toString() );
               _swap( todos, dp[peq.id]![j], confirmAdd );
               confirmAdd--;
               assert( confirmAdd >= 0 );
            }
            
            dp.remove( peq.id );
            _vPrint( appState, 2, "   peq: " + peq.hostIssueTitle + " " + peq.id + " UN-demoted." );
         }
         // demote if needed.  Attempting to work (non-add, non-delete) on peq that hasn't been added yet.  Can be more actions here than 1.
         // Note: in some cases, demotion can occur on, say, a relo that has happened after delete.  Demotion does not hurt here, but certainly doesn't help
         else if( !kp.contains( peq.id ) && !deleted ) {
            if( !dp.containsKey( peq.id ) ) { dp[peq.id] = []; }
            dp[peq.id]!.add( i );  
            _vPrint( appState, 2, "   demoting peq: " + peq.hostIssueTitle + " " + peq.id );
         }
      }
   }
   
   // Remove it 'ignore add' todos, there is nothing todo here.  These did not participate in any swaps above.
   for( int i = it.length - 1; i >= 0; i-- ) {
      todos.removeAt( it[ i ] );
   }

}

Future _updateEquityPlan( appState, context, container, String oldHostPName, String newHostPName ) async {
   // To get to ingest, must have selected CEP inside CEV, then hit update peq summary button.
   EquityPlan? ep = appState.myEquityPlan;
   if( ep == null ) { return; }

   print( "Updating equity plan from " + oldHostPName + " to " + newHostPName);

   // Cleanest way here is update model, write to aws, then reload.
   for( var i = 0; i < ep.hostNames.length; i++ ) {
      if( oldHostPName == ep.hostNames[i] ) {

         // cats
         int pindex = ep.categories[i].indexOf( oldHostPName );
         assert( pindex >= 0 );
         ep.categories[i][pindex] = newHostPName;

         // hnames
         ep.hostNames[i] = newHostPName;
         break;
      }
   }
   
   await writeEqPlan( appState, context, container );
   print( "Reloading Equity plan for " + appState.selectedCEVenture );
   
   appState.ceEquityPlans.remove( appState.selectedCEVenture );
   await reloadCEVentureOnly(context, container);
}

// ingest may contain edits to HOST projects or columns.
// Update any existing state in peq summary, and equity plan before process new ingest.
// For renaming, will update peqSummary from dynamo, and build the list of current names for the next ingest
// Example: ingest todos contains renames of project: aProj -> bProj, and bProj -> cProj
//    aws dynamo peqs          will contain aproj, exactly.
//    myPEQSummary allocations will contain aProj, exactly.
//    myHostLinks hostLocs     will contain cProj (ceServer provided)
//    ingest todos             will contain aProj, bProj and cProj

// Todo list processing for relo and reject-to uses IDs, so names will be up to date based on myHostLinks.
// Adds are based on psub, but immediate relos are myHostLinks.
// The only adds without relos are for unclaimed:unclaimed, which should be name-protected.
// updateHostNames will update all allocs to cProj, leaving todo's alone as above.
Future _updateHostNames( appState, List<Tuple2<PEQAction, PEQ>> todos, context, container, peqMods ) async {
   _vPrint( appState, 4, "Updating Host Names in appAllocs ");

   List<HostLoc> colRenames  = [];
   List<HostLoc> projRenames = [];
   List<String>  projRenameTo = [];

   // ceServer has already updated appLocs to be consistent with renaming.
   List<HostLoc>    appLocs   = appState.myHostLinks.locations;
   List<Allocation> appAllocs = [];
   if( appState.myPEQSummary != null ) { appAllocs = appState.myPEQSummary.getAllAllocs(); }

   print( appLocs );

   // look through current ingest batch renaming events.  Save old here, look up new later.
   // subject is [ pid, oldName, newName ]
   for( var i = 0; i < todos.length; i++ ) {
      PEQAction pact = todos[i].item1;
      PEQ       peq  = todos[i].item2;

      // print( pact );
      // print( peq );

      if( pact.verb == PActVerb.confirm && pact.action == PActAction.change ) {
         // XXX colRenames are not possible in ghV2, and so are not issued by ceServer.
         //     Should this change, note that as of 2025, col ids are not unique (yet?) so below loc is bad.
         if( pact.note == PActNotes['colRename'] ) {
            assert( pact.subject.length == 3 );
            HostLoc? loc = appLocs.firstWhereOrNull( (a) => a.hostColumnId == pact.subject[0] );
            assert( loc != null );
            colRenames.add( new HostLoc( ceProjectId: "-1", hostUtility: "-1", hostProjectId: loc!.hostProjectId, hostProjectName: loc.hostProjectName,
                                       hostColumnId: pact.subject[0], hostColumnName: pact.subject[1], active: loc.active ) );
            _vPrint( appState, 2, "... col rename " + pact.subject[1] );
         }
         else if( pact.note == PActNotes['projRename'] ) {
            assert( pact.subject.length == 3 );
            HostLoc? loc = appLocs.firstWhereOrNull( (a) => a.hostProjectId == pact.subject[0] );
            assert( loc != null );
            projRenames.add( new HostLoc( ceProjectId: "-1", hostUtility: "-1", hostProjectId: pact.subject[0], hostColumnId: "-1", hostProjectName: pact.subject[1],
                                        hostColumnName: loc!.hostColumnName, active: loc.active ) );
            projRenameTo.add( pact.subject[2] );
               
            _vPrint( appState, 2, "... proj rename " + pact.subject[1] + " to " + pact.subject[2] );            
         }
      }
   }

   if( colRenames.length == 0 && projRenames.length == 0 ) { return; }
   
   // AppAllocs is blank if starting from cleanFlutter, but most often will be populated.
   // Note: this could be sped up, but any value?
   // Update allocations.
   _vPrint( appState, 2, "... allocations size: " + appAllocs.length.toString() + " " + colRenames.length.toString() + " " + projRenames.length.toString() );
   for( Allocation alloc in appAllocs ) {
      assert( alloc.categoryBase != null );
      
      // NOTE can't rename equity plan lines - not derived from host projects locs.  Renaming can break how host projects are situated.. that's correct.
      //      so renaming here does not need to be concerned with interaction between host locs and how they tie into equity plan items.
      
      for( HostLoc proj in projRenames ) {
         _vPrint( appState, 4, " .. checking " + (alloc.hostProjectId ?? "" ) + " " + alloc.category.toString() + " " + alloc.sourcePeq.toString() + " vs " + proj.hostProjectId );
         if( alloc.hostProjectId == proj.hostProjectId ) {
            HostLoc? loc = appLocs.firstWhereOrNull( (a) => a.hostProjectId == proj.hostProjectId );
            assert( loc != null );
            _vPrint( appState, 4, " .. found project name update: " + proj.hostProjectName  + " => " + loc!.hostProjectName );

            // pindex can be -1 when there are multiple renames in this ingest stream.  myHostLinks will skip to the final.
            //        i.e. a->b, b->c.. first set here will move from a->c, skipping b.
            int pindex = alloc.category.indexOf( proj.hostProjectName );
            if( pindex >= 0 ) { alloc.category[pindex] = loc.hostProjectName; }

            pindex = alloc.categoryBase!.indexOf( proj.hostProjectName );
            if( pindex >= 0 ) { alloc.categoryBase![pindex] = loc.hostProjectName; }

            // XXX minor.  restructure to minimize aws trips.. but proj rename will be quite rare, and cost is not significant
            assert( alloc.sourcePeq != null );
            String peqIds = json.encode( alloc.sourcePeq!.keys.toList() );
            List<PEQ> peqs = await fetchPEQs( context, container,'{ "Endpoint": "GetPEQsById", "PeqIds": $peqIds }' );

            for( PEQ peq in peqs ) {
               var peqData = {};
               peqData['id']             = peq.id;
               peqData['hostProjectSub'] = alloc.categoryBase;
               assert( peqData['hostProjectSub'] != peq.hostProjectSub );
               _vPrint( appState, 4, "updateHostNames changing " + peq.id +"'s psub to " + peqData['hostProjectSub'].toString() );
               _addMod( context, container, peq, peqData, peqMods );   
            }

         }
      }
      for( HostLoc col in colRenames ) {
         if( alloc.hostProjectId == col.hostProjectId ) {
            
            HostLoc? loc = appLocs.firstWhereOrNull( (a) => a.hostColumnId == col.hostColumnId );
            assert( loc != null );
            _vPrint( appState, 4, " .. found Column name update: " + col.hostColumnName + " => " + loc!.hostColumnName );

            int pindex = alloc.category.indexOf( col.hostColumnName );
            if( pindex >= 0 ) { alloc.category[pindex] = loc.hostColumnName; }
            
            pindex = alloc.categoryBase!.indexOf( col.hostColumnName );
            if( pindex >= 0 ) { alloc.categoryBase![pindex] = loc.hostColumnName; }
         }
      }

      // No need (and can't anyway, not stateful).  If updatePeqAllocations does anything, allocTree is rebuilt.
      // setState(() => appState.updateAllocTree = true );
   }

   // Force update, reload to equity plan.  Don't wait.
   for( var i = 0; i < projRenames.length; i++ ) {
      _updateEquityPlan( appState, context, container, projRenames[i].hostProjectName, projRenameTo[i] );
   }
   
   _vPrint( appState, 4, "Done with updateHostName" );
}

/*
// No need to clear appState.ingestUpdates - updateDynamo does that.
// Could, maybe, be more picky about releasing once the specific peq.id reaches 0
// void checkPendingUpdates( appState, dynamo, peqId ) async {
Future checkPendingUpdates( appState, dynamo, peqId ) async {
   if( appState.ingestUpdates.containsKey( peqId ) && appState.ingestUpdates[peqId] > 0 ) {
      _vPrint( appState, "peq " + peqId + " has pending updates to dynamo.  Waiting." );
      await Future.wait( dynamo );
      dynamo.clear();
   }
}
*/

// NOTE: this sets models:PEQ, which is then sent to aws via fromjson.  so.  normal camelCase.
// Mods will be entire peqs.  Could instead save individual attributes, but very little gain
void _addMod( context, container, peq, postData, peqMods ) {
   final appState = container.state;
   _vPrint( appState, 1, "AddMod " + postData.toString() );
   if( !peqMods.containsKey( peq.id )) {
      peqMods[ peq.id ] = peq;
   }

   for( String attr in postData.keys.toList() ) {
      // print( "updating attr " + attr + " to " + postData[ attr ].toString() );
      peqMods[peq.id].set( attr, postData[attr] );
   }
}

Future _accrue( context, container, pact, peq, peqMods, assignees, assigneeShare, Allocation? sourceAlloc, subBase ) async {
   // Once see action accrue, should have already seen peqType.pending
   final appState = container.state;
   _vPrint( appState, 1, "Accrue PAct " + enumToStr( pact.action ) + " " + enumToStr( pact.verb ));
   final startPPA = DateTime.now();
   
   if( assignees.length == 1 && assignees[0] == appState.UNASSIGN ) {
      print( "WARNING.  Must have assignees in order to accrue!" );
      return;
   }
   
   List<String> subProp = new List<String>.from( subBase ); subProp.last = appState.PEND; 
   List<String> subAccr = new List<String>.from( subBase ); subAccr.last = appState.ACCRUED;
   String hpid = sourceAlloc == null ? "" : (sourceAlloc.hostProjectId ?? "");
   
   // iterate over assignees
   String       newType = "";
   List<String> peqLoc  = [];
   for( var assignee in assignees ) {
      _vPrint( appState, 1, "\n Assignee: " + assignee );
      
      if( pact.verb == PActVerb.propose ) {
         // add propose, rem plan
         adjustSummaryAlloc( appState, peq.id, subBase, assignee, -1 * assigneeShare, PeqType.plan, pid: hpid );
         adjustSummaryAlloc( appState, peq.id, subProp, assignee, assigneeShare, PeqType.pending, pid: hpid );
         newType = enumToStr( PeqType.pending );
         peqLoc  = subProp;
      }
      else if( pact.verb == PActVerb.reject ) {
         // rem propose, add plan
         HostLoc loc = appState.myHostLinks.locations.firstWhere( (a) => a.hostColumnId == pact.subject.last );
         assert( loc != null );
         List<String> subDest = new List<String>.from( subBase ); subDest.last = loc.hostColumnName;
         
         adjustSummaryAlloc( appState, peq.id, subProp, assignee, -1 * assigneeShare, PeqType.pending, pid: hpid );
         adjustSummaryAlloc( appState, peq.id, subDest, assignee, assigneeShare, PeqType.plan, pid: hpid );
         newType = enumToStr( PeqType.plan );
         peqLoc  = subDest;
      }
      else if( pact.verb == PActVerb.confirm ) {
         // remove any source alloc
         assert( sourceAlloc != null );
         adjustSummaryAlloc( appState, peq.id, subBase, assignee, -1 * assigneeShare, sourceAlloc!.allocType, pid: hpid );
         adjustSummaryAlloc( appState, peq.id, subAccr, assignee,  assigneeShare, PeqType.grant, pid: hpid );

         for( Allocation alloc in appState.myPEQSummary.getByPeqId( peq.id ) ) {
            print( "Confirm accrue, set in stone activated, type 1 " );
            if( alloc.setInStone == null ) { alloc.setInStone = []; }
            alloc.setInStone!.add( peq.id );
         }

         newType = enumToStr( PeqType.grant );
         peqLoc  = subAccr;
      }
      else {
         print( "Unrecognized verb " + enumToStr( pact.verb ) );
         assert( false );
      }
   }
      
   var peqData = {};  
   peqData['id']           = peq.id;
   peqData['peqType']      = newType;
   peqData['hostHolderId'] = listEq( assignees, [appState.UNASSIGN]) ? [] : assignees;

   if( newType == enumToStr( PeqType.grant )) {
      peqData['accrualDate'] = pact.entryDate;
      String ceUID = appState.idMapHost[ pact.hostUserId ]['ceUID'];
      if( ceUID == "" ) { ceUID = CEUID_PLACEHOLDER + ": " + pact.hostUserId; }
      peqData['ceGrantorId'] = ceUID;
   }
   else {
      peqData['accrualDate'] = peq.accrualDate;
      peqData['ceGrantorId'] = peq.ceGrantorId;
   }
   
   // peqData['amount'] = ( assigneeShare * assignees.length ).toInt();
   peqData['amount'] = ( assigneeShare * assignees.length ).round();
   peqData['hostProjectSub'] = peqLoc;

   if( peqData['peqType']      != peq.peqType )                  { _vPrint( appState, 1, "_accrue changing peqType to "     + peqData['peqType'] ); }
   if( peqData['accrualDate']  != peq.accrualDate )              { _vPrint( appState, 1, "_accrue changing accrualDate to " + peqData['accrualDate'] ); }
   if( peqData['amount']       != peq.amount )                   { _vPrint( appState, 1, "_accrue changing amount to "      + peqData['amount'].toString() ); }
   if( peqData['ceGrantorId']  != peq.ceGrantorId )              { _vPrint( appState, 1, "_accrue changing grantor to "     + peqData['ceGrantorId'] ); }
   if( !listEq( peqData['hostHolderId'],   peq.hostHolderId ))   { _vPrint( appState, 1, "_accrue changing assignees to "   + peqData['hostHolderId'].toString() ); }
   if( !listEq( peqData['hostProjectSub'], peq.hostProjectSub )) { _vPrint( appState, 1, "_accrue changing psub to "        + peqData['hostProjectSub'].toString() ); }

   print( "Accrue updating with "  + peqData["peqType"] + " " + peq.peqType.toString() );
   _addMod( context, container, peq, peqData, peqMods );
   // print( "MILLI accr " + DateTime.now().difference(startPPA).inMilliseconds.toString() );   
   
}

// Note: for del proj/col, ceFlutter need do nothing special, ceServer sends all component deletes
// Delete proj/col with no peqs?  Don't care.
// Delete proj/col with peqs?     issues remain, series of del card/label are sent.  
// Delete proj/col with ACCR?     ACCR are relocated
void _delete( appState, pact, peq, assignees, assigneeShare, ka ) {
   // For transfer, can see 'transOut', or 'badXfer'
   if( ka != null ) {
      if(   pact.note == PActNotes['transOut'] ) { _vPrint( appState, 1, "\n Transfer out: " + ka.category.toString() ); }
      else                                       { _vPrint( appState, 1, "\n Delete: " + ka.category.toString() ); }

      List<Allocation> remAllocs = [];  // category, hostUserId, allocType
      
      // avoid concurrent mod of list
      for( Allocation sourceAlloc in appState.myPEQSummary.getByPeqId( peq.id ) ) {
         Allocation miniAlloc = new Allocation( category: sourceAlloc.category, allocType: sourceAlloc.allocType, hostUserId: sourceAlloc.hostUserId, ceUID: sourceAlloc.ceUID );
         remAllocs.add( miniAlloc );
      }
      for( var remAlloc in remAllocs ) {
         if( pact.note == PActNotes['transOut'] ) {
            assert( assignees.contains( remAlloc.hostUserId ));
            _vPrint( appState, 1, "\n Assignee: " + (remAlloc.hostUserName ?? "") + "(" + remAlloc.hostUserId + ")" );
         }
         adjustSummaryAlloc( appState, peq.id, [], appState.EMPTY, -1*assigneeShare, ka.allocType, source: remAlloc );
      }

      // No need to update dyamo.  'Active' is managed by ceServer, all others are managed by other operations during ingest.
   }
}

// Note: there is no 'transferred in'.  transferred peq issues have a separate 'add' pact.
// Note: some early peq states may be unexpected during add.  For example, LabelTest.
//       When performing a sequence of add/delete/move, an issue can be created correctly, then bounced out of reserved into "In Prog",
//       then unlabeled (untracked), then re-tracked.  In this case, the PEQ is re-created, with the correct column of "In Prog".
//       From ingest point of view, In Prog === Planned, so no difference in operation.

Future _add( context, container, pact, peq, peqMods, assignees, assigneeShare, subBase ) async {
   // When adding, will only see peqType plan
   List<String> peqLoc = [];
   final appState = container.state;

   final startPPA = DateTime.now();
   
   if( peq.peqType == PeqType.plan || peq.peqType == PeqType.pending ) {  // plan == prog in peqtype, aws
      _vPrint( appState, 1, "Normal PEQ" );
      
      // XXX Speed this up.  This is relevant 1/1000 times, but runs always.  But not yet..
      //     Don't convert to preprocessing which depends on both recreate and add showing up in same ingest chunk - can fail.
      // Generated as part of 'recreate'?  If so, check location then ignore it.
      for( Allocation anAlloc in appState.myPEQSummary.getByPeqId( peq.id ) ) {
         assert( listEq( subBase, [appState.UNCLAIMED, appState.ACCRUED ] ));
         _vPrint( appState, 2, "Skipping Add, which was generated as part of Recreate, which was already handled." );

         // XXX 1) if does not fire by 3/25, /**/ out.  
         // XXX 2) This should not occur.  Remove this chunk once projectHandler:delete test is running.
         assert( false );
         
         return;
      }

      // iterate over assignees, which are hostUserIds.
      for( var assignee in assignees ) {

         String hostUserName = assignee; 
         if( appState.idMapHost.containsKey( assignee )) { hostUserName = appState.idMapHost[assignee]['hostUserName']; }
         
         _vPrint( appState, 1, "\n Assignee: " + assignee + " (" + hostUserName + ")" );
         peqLoc = subBase;
         adjustSummaryAlloc( appState, peq.id, subBase, assignee, assigneeShare, peq.peqType );
      }
   }
   else {
      print( "Error.  Action add on peqType of " + peq.peqType.toString() );
      notYetImplemented( context );
   }

   // can not add into ACCR
   var peqData = {};
   // peqType is unchanged.  amount is unchanged
   peqData['id']          = peq.id;
   peqData['hostHolderId']   = listEq( assignees, [appState.UNASSIGN] ) ? [] : assignees;
   peqData['hostProjectSub'] = peqLoc;

   if( !listEq( peqData['hostHolderId'],   peq.hostHolderId ))   { _vPrint( appState, 1, "_add changing assignees to "   + peqData['hostHolderId'].toString() ); }
   if( !listEq( peqData['hostProjectSub'], peq.hostProjectSub )) { _vPrint( appState, 1, "_add changing psub to "        + peqData['hostProjectSub'].toString() ); }
   
   _addMod( context, container, peq, peqData, peqMods );   
   // print( "MILLI add " + DateTime.now().difference(startPPA).inMilliseconds.toString() );   
}


// Note.  The only cross-project moves (not transfers) allowed by ceServer are unclaimed -> new home.  This move is programmatic via ceServer.
// Note.  There is a rare race condition in ceServer that may reorder when recordPeqs arrive.  Specifically, psub
//        may be unclaimed when expect otherwise.  Relo must then deal with it.
// Note.  Once an allocation is in Accr, relo will no longer touch it.
Future _relo( context, container, pact, peq, peqMods, assignees, assigneeShare, ka, pending, subBase ) async {

   final startPPA = DateTime.now();

   final appState = container.state;   
   var baseCat                = subBase.sublist( 0, subBase.length-1 );  // remove old column
   List<String> peqLoc        = [];
   
   // _vPrint( appState, "subBase: " + subBase.toString() );
   // _vPrint( appState, "baseCat: " + baseCat.toString() );

   _vPrint( appState, 1, "Relo PEQ" );
   
   Allocation sourceAlloc = ka != null ? ka : -1;
   assert( sourceAlloc != -1 );
   assert( sourceAlloc.category.length >= 1 );
   
   if( sourceAlloc.setInStone != null && sourceAlloc.setInStone!.contains( peq.id )) {
      print( "Attempting to relocate an Accrued PEQ.  Disregard." );
      return;
   }
   
   // Get name of new column home.  Assume locations projectId.columnId are unique.
   assert( pact.subject.length == 3 );
   HostLoc loc = appState.myHostLinks.locations.firstWhere( (a) => a.hostProjectId == pact.subject[1] && a.hostColumnId == pact.subject[2] );
   assert( loc != null );
   
   // peq.psub IS the correct initial home if unclaimed, and right after the end of unclaimed residence.  Column is correct afterwards.
   // (if no existing alloc, use psub - can't happen).  If alloc.cat is not unclaimed, use column (only moves within proj).
   // If alloc.cat is unclaimed, ceServer will move across projects.  use psub.   Test col.  Will be stable even with multiple relos, since
   // psub is only overwritten the first time after unclaimed is claimed.
   // pallocs do not have assignees
   
   // Exactly one alloc per peq.id,assignee pair
   List<Allocation> reloAlloc = [];  // category, hostUserId, allocType
   
   // avoid concurrent mod of list
   for( Allocation sourceAlloc in appState.myPEQSummary.getByPeqId( peq.id ) ) {
      Allocation miniAlloc = new Allocation( category: sourceAlloc.category, allocType: sourceAlloc.allocType, hostUserId: sourceAlloc.hostUserId, ceUID: sourceAlloc.ceUID );
      reloAlloc.add( miniAlloc );
   }
   
   for( var remAlloc in reloAlloc ) {
      assert( assignees.contains( remAlloc.hostUserId ));
      _vPrint( appState, 1, "\n Assignee: " + (remAlloc.hostUserName ?? "") + "(" + remAlloc.hostUserId + ")" );
      adjustSummaryAlloc( appState, peq.id, [], appState.EMPTY, -1 * assigneeShare, remAlloc.allocType, source: remAlloc, pid: loc.hostProjectId );
      
      // Check to see if relo contains new information (new proj name, or new location if recordPeqData race condition).  If so, get category from existing allocs.
      if( !baseCat.contains( loc.hostProjectName ) ) {
         _vPrint( appState, 2, "  .. RELO is cross project!  Reconstituting category ");
         
         Allocation? newSource = null;
         // does not like firstwhereornull...
         for( var ns in appState.myPEQSummary.getAllAllocs() ) {
            if( ns.category.contains( loc.hostProjectName )) {
               newSource = ns;
               break;
            }
         }
         
         if( newSource == null ) {
            // Possible if project name just changed.
            baseCat = [loc.hostProjectName];
         }
         else {
            List<String> sourceCat = newSource.category;
            baseCat = sourceCat.sublist( 0, sourceCat.indexOf( loc.hostProjectName ) + 1 );
         }
      }
      
      // Moving into ACCR is handled by _accrue.  moving out of ACCR, for example by rejecting a propose ACCR, must update allocType here
      if( remAlloc.allocType == PeqType.grant && loc.hostColumnName != appState.ACCRUED ) {
         remAlloc.allocType = loc.hostColumnName == appState.PEND ? PeqType.pending : PeqType.plan;
         _vPrint( appState, 4, "  .. Removed granted status, set to " + enumToStr(remAlloc.allocType) );
      }
      
      _vPrint( appState, 1, "  .. relocating to " + loc.toString() );
      peqLoc = baseCat + [loc.hostColumnName];
      adjustSummaryAlloc( appState, peq.id, baseCat + [loc.hostColumnName], remAlloc.hostUserId, assigneeShare, remAlloc.allocType, pid: loc.hostProjectId );
   }
   
   
   var peqData = {};
   // peqType is set by prior add, accrues, etc.
   // peqLoc can change.  Note that allocation titles are not part of psub.
   peqData['id']        = peq.id;
   peqData['hostProjectSub'] = peqLoc;
   
   if( !listEq( peqData['hostProjectSub'], peq.hostProjectSub )) {
      _vPrint( appState, 1, "_relo changing psub to "        + peqData['hostProjectSub'].toString() );
      _addMod( context, container, peq, peqData, peqMods );   
   }
   // print( "MILLI Relo " + DateTime.now().difference(startPPA).inMilliseconds.toString() );   
}   

// Return newShareAmount.  Internally adjust newAssign.
List<dynamic> _addAssignee( appState, pact, peq, assignees, assigneeShare, ka, pactLast ) {
   final sourceType = ka == null ? "" : ka.allocType;
   final baseCat    = ka == null ? "" : ka.category.sublist( 0, ka.category.length-1 );
   String hpid      = ka == null ? "" : (ka.hostProjectId ?? "");
   
   _vPrint( appState, 1, "Add assignee: " + pact.subject.last + " " + pactLast );
   
   List<String> curAssign = [ pactLast ]; // hostUserId
   
   // Count the current assignees != unassigned.  readjust assigneeShare.  Ignore duplicate adds (blast).
   for( String assign in assignees ) {
      if( assign != appState.UNASSIGN && !curAssign.contains( assign ) ) { curAssign.add( assign ); }
   }
   final newShareAmount = (assigneeShare * assignees.length).round() / curAssign.length;
   
   // Remove all old, add all current with new assigneeShares
   for( var assign in assignees ) {
      _vPrint( appState, 1, "Remove " + baseCat.toString() + " " + assign + " " + assigneeShare.floor().toString() );
      adjustSummaryAlloc( appState, peq.id, baseCat, assign, -1 * assigneeShare, sourceType, pid: hpid );
   }
   for( var assign in curAssign ) {
      _vPrint( appState, 1, "Add " + assign + " " + newShareAmount.floor().toString() );
      adjustSummaryAlloc( appState, peq.id, baseCat, assign, newShareAmount, sourceType, pid: hpid );
   }

   return [newShareAmount, curAssign];
}

// Return newShareAmount.  Internally adjust newAssign.
List<dynamic> _remAssignee( appState, pact, peq, assignees, assigneeShare, ka, pactLast ) {
   final sourceType = ka == null ? "" : ka.allocType;
   final baseCat    = ka == null ? "" : ka.category.sublist( 0, ka.category.length-1 );
   String hpid      = ka == null ? "" : (ka.hostProjectId ?? "");
   
   _vPrint( appState, 1, "Remove assignee: " + pact.subject.last );
   
   int originalSize = assignees.length;
   
   assert( assignees.contains( pactLast ));
   
   // Remove all old allocs
   for( var assign in assignees ) {
      _vPrint( appState, 1, "Remove " + baseCat.toString() + " " + assign + " " + assigneeShare.floor().toString() );
      adjustSummaryAlloc( appState, peq.id, baseCat, assign, -1 * assigneeShare, sourceType, pid: hpid );
   }
   
   // Remove, then readjust assigneeShare
   assignees.remove( pactLast );
   if( assignees.length == 0 ) { assignees.add( appState.UNASSIGN ); }
   
   final newShareAmount  = (assigneeShare * originalSize).round() / assignees.length;
   
   for( var assign in assignees ) {
      _vPrint( appState, 1, "Add " + assign + " " + newShareAmount.floor().toString() );
      adjustSummaryAlloc( appState, peq.id, baseCat, assign, newShareAmount, sourceType, pid: hpid );
   }

   return [newShareAmount, assignees];
}

double _pvUpdate( appState, pact, peq, assignees, assigneeShare, ka, pactLast ) {
   final sourceType = ka == null ? "" : ka.allocType;
   final baseCat    = ka == null ? "" : ka.category.sublist( 0, ka.category.length-1 );
   String hpid      = ka == null ? "" : (ka.hostProjectId ?? "");
   
   _vPrint( appState, 1, "Peq val update, new val: " + pact.subject.last );
   
   // Remove all old allocs
   for( var assign in assignees ) {
      _vPrint( appState, 1, "Remove " + baseCat.toString() + " " + assign + " " + assigneeShare.floor().toString() );
      adjustSummaryAlloc( appState, peq.id, baseCat, assign, -1 * assigneeShare, sourceType, pid: hpid );
   }
   
   final newShareAmount = int.parse( pact.subject.last ) / assignees.length;
   
   for( var assign in assignees ) {
      _vPrint( appState, 1, "Add " + assign + " " + newShareAmount.floor().toString() );
      adjustSummaryAlloc( appState, peq.id, baseCat, assign, newShareAmount, sourceType, pid: hpid );
   }

   return newShareAmount;
}


// This is only issued when user deletes a peq issue by directly deleting a host project.
// Host GH on deleted project now sends only 1 notification: 'deleted', leaving issues in place in repo, 'secretly' deleting cards.
// ceServer will send a recreate pact, no other.  It deletes old peq in aws, rebuilds new one with new peq id, link.
// If the PEQ is not ACCR, ceServer puts it in unclaimed:unclaimed, otherwise unclaimed:accrued.
//
// Note. After 8/2021, Github sends only partial issues in request body during issue delete.  Thanks GQL.
//       Assignees may be removed.. safest place to transfer them is here.
void _recreate( appState, pact, peq, assignees, assigneeShare, ka, pactLast ) {
   final sourceType = ka == null ? "" : ka.allocType;
   final baseCat    = ka == null ? "" : ka.category.sublist( 0, ka.category.length-1 );
   String hpid      = ka == null ? "" : (ka.hostProjectId ?? "");
   
   assert( pact.subject.length == 2 );
   _vPrint( appState, 4, "Recreate PEQ: " + pact.subject[0] + " --> " + pact.subject[1] );
   
   // peq is always subject0
   assert( peq.id == pact.subject[0] );
   
   // Remove old allocs for peq
   for( var assign in assignees ) {
      _vPrint( appState, 4, "Remove " + peq.id + " in " + baseCat.toString() + " " + assign + " " + assigneeShare.floor().toString() );
      adjustSummaryAlloc( appState, peq.id, baseCat, assign, -1 * assigneeShare, sourceType, pid: hpid );
   }
   
   // We need assignees for accrued, and in particular need to retain assignees for accrued issues.
   // Add back here, then ignore subsequent add.
   for( var assign in assignees ) {
      _vPrint( appState, 4, "Add " + pact.subject[1] + " for " + assign + " " + assigneeShare.floor().toString() );
      adjustSummaryAlloc( appState, pact.subject[1], [appState.UNCLAIMED, appState.ACCRUED ], assign, assigneeShare, sourceType, pid: hpid );
   }
   
   // In this case, active flag is managed by ceServer, as is new peq creation.
   // ceServer creates the new peq with correct values for all but assignees, which was set properly above.
}

// update peq on aws occurs in _change
// no alloc-related work to be done here, allocs are not recorded by regular peq issue name.
String _titRename( appState, pact, ka ) {
   assert( ka != null );
   assert( pact.subject.length == 2 );
   
   _vPrint( appState, 1, "Change title, new val: " + pact.subject.last );
   
   return pact.subject.last;
}

Future _colRename( context, container, pact ) async {
   final appState = container.state;
   // XXX REVISIT once this is possible again
   // These arrive as viable pact, and -1 as peq.  Pact subject is [ colId, oldName, newName ]
   // ceServer handles locs in dynamo.  myHostLinks.locations is current.
   // This has the potential to impact any future operation on peqs. wait.
   await updateColumnName( context, container, pact.subject );
   _vPrint( appState, 1, "Column rename handled at start of todo processing" );
   _vPrint( appState, 1, "Done waiting on column name update" );
   return; 
}

// XXX Remove
// Possible out of order here
Future _projRename( context, container, pact ) async {
   final appState = container.state;
   // These arrive as viable pact, and -1 as peq.  Pact subject is [ projId, oldName, newName ]
   // ceServer handles locs in dynamo.  myHostLinks.locations is current.
   // await updateProjectName( context, container, pact.subject );
   // This has the potential to impact any future operation on peqs. wait.
   _vPrint( appState, 1, "Project rename handled at start of todo processing" );
   _vPrint( appState, 1, "Done waiting on project name update" );
   return;
}

// Note: peq.hostHolder will only inform us of the latest status, not all the changes in the middle.
//      Ingest needs to track all the changes in the middle
Future _change( context, container, pact, peq, peqMods, assignees, assigneeShare, ka, pending ) async {
   final appState = container.state;
   assert( ka != null || pact.note == PActNotes['colRename'] || pact.note == PActNotes['projRename'] );
   final startPPA = DateTime.now();

   List<String> newAssign = assignees;
   double newShareAmount  = assigneeShare;  
   String newTitle        = peq.hostIssueTitle;
   String newIssueId      = peq.hostIssueId;
   String pactLast        = _convertNameToId( appState, pact.subject.last );  // if peqValUpdate, this will be an int, but won't be used.

   if( pact.note == PActNotes['addAssignee'] ) {
      var aa  = _addAssignee( appState, pact, peq, assignees, assigneeShare, ka, pactLast );
      newShareAmount = aa[0];
      newAssign      = aa[1];
   }
   else if( pact.note == PActNotes['remAssignee'] ) {
      var aa = _remAssignee( appState, pact, peq, assignees, assigneeShare, ka, pactLast ); 
      newShareAmount = aa[0];
      newAssign      = aa[1];
   }
   else if( pact.note == PActNotes['pvUpdate'] ) {
      newShareAmount = _pvUpdate( appState, pact, peq, assignees, assigneeShare, ka, pactLast );
   }
   else if( pact.note == PActNotes['recreate'] ) {
      _recreate( appState, pact, peq, assignees, assigneeShare, ka, pactLast );
   }
   else if( pact.note == PActNotes['titRename'] ) {
      newTitle = _titRename( appState, pact, ka );
   }
   else if( pact.note == PActNotes['colRename']) {
      _colRename( context, container, pact );
   }
   else if( pact.note == PActNotes['projRename']) {
      _projRename( context, container, pact );
   }
   else if( pact.note == PActNotes['badXfer']) {
      assert( false );  // XXX verify
      assert( pact.subject.length == 7 );
      // This must be handled by ceServer to avoid server issues with mismatched peqs & hostIssueIds
      // newIssueId = pact.subject[4];
   }
   
   List<String> ceHolders = [];
   if( !listEq( newAssign, [appState.UNASSIGN ] )) {
      newAssign.forEach( (hostHolder) {
            assert( appState.idMapHost.containsKey( hostHolder ) );
            ceHolders.add( appState.idMapHost[ hostHolder ]['ceUID'] ); 
         });
   }

   if( pact.note == PActNotes['addAssignee'] ) { print( "ceHolders " + ceHolders.toString() ); }
   
   var peqData = {};
   peqData['id']             = peq.id;
   peqData['hostHolderId']   = listEq( newAssign, [appState.UNASSIGN] ) ? [] : newAssign;
   peqData['ceHolderId'  ]   = ceHolders;
   peqData['amount']         = ( newShareAmount * newAssign.length ).round();
   peqData['hostIssueTitle'] = newTitle;
   peqData['hostIssueId']    = newIssueId;

   if( !listEq( peqData['hostHolderId'], peq.hostHolderId )) { _vPrint( appState, 1, "_change changing assignees to "   + peqData['hostHolderId'].toString() ); }
   if( peqData['amount']         != peq.amount )             { _vPrint( appState, 1, "_change changing amount to "      + peqData['amount'].toString() ); }
   if( peqData['hostIssueTitle'] != peq.hostIssueTitle )     { _vPrint( appState, 1, "_change changing title to "       + peqData['hostIssueTitle'] ); }
   if( peqData['hostIssueId']    != peq.hostIssueId )        { _vPrint( appState, 1, "_change changing issueId to "     + peqData['hostIssueId'] ); }
   
   _addMod( context, container, peq, peqData, peqMods );      
   // print( "MILLI Change " + DateTime.now().difference(startPPA).inMilliseconds.toString() );   
}

void _notice( appState ) {
   _vPrint( appState, 1, "Notice actions are no-ops" );
}


void _summarizeTodos( appState, todos, pactionLength, foundPeqs ) {

   _vPrint( appState, 4, "Will now process " + pactionLength.toString() + " pactions for " + foundPeqs.toString() + " non-unique peqs." );
   var i = 0;
   for( var tup in todos ) {
      final pa = tup.item1;
      final pp = tup.item2;
      String tmpStr = i.toString() + "   " + pa.timeStamp.toString() + " <pact,peq> " + pa.id + " " + pp.id;
      tmpStr       += " " + enumToStr(pa.verb) + " " + enumToStr(pa.action) + " " + pa.note + " " + pa.subject.toString();
      _vPrint( appState, 1, tmpStr );
      i++;
   }
}


/* -----------------------
Ingest process
The incoming PAct is all current information.
The incoming PEQ is a combination of (possibly) future information (assignees, values, active) with old information (type).
The current list of myAllocations is the current correct state of PEQ, given the progress of ingest through the raw PActs.
Much of the work below is searching myAllocations to get the current state, and ... ? updating PEQ?
Updating PEQ.........  safe to change assignees, types, etc. on the fly?  must be sure not being used below.
                       regardless, if no uningested PActs involve PEQ, PEQ should be pristine.  clean, not dirty.

Basic Flow, based on makeIssue, add label, make project card, add assignee x 2, close, accrue
   makeIssue
   add label
   hYMgLYxllp   confirm add	---	<empty>	      [ { "S" : "DAcWeodOvb" } ]
                 peq psub: [Software Contributions, Data Security]
                 actual location: unclaimed:unclaimed

   makeProjCard
   oJHIzkqTwP   confirm relocate---	<empty>	      [ { "S" : "DAcWeodOvb" }, { "S" : "13302090" }, { "S" : "15978796" } ]
                 pact sub: peqID, destination project ID, destination column ID
                 peq psub: [Software Contributions, Data Security]  
                 location in Host: dataSec:planned

https://github.com/ariCETester/CodeEquityTester/projects/428#column-15978796
   add assignees
   GMpDtDUucD   confirm change	---	add assignee  [ { "S" : "DAcWeodOvb" }, { "S" : "ariCETester" } ]
   HGyfhTfPCl   confirm change	---	add assignee  [ { "S" : "DAcWeodOvb" }, { "S" : "codeequity" } ]
   YIQBiXPbru   confirm notice	---	<empty>	      [ { "S" : "DAcWeodOvb" } ]
   fjbjbYCcYn   propose accrue	---	<empty>	      [ { "S" : "DAcWeodOvb" } ]
   JhkTqESCvR   confirm accrue	---	<empty>	      [ { "S" : "DAcWeodOvb" } ]

peq is a mix of past and future
psub:  [Software Contributions, Data Security]
alloc: [Software Contributions, Data Security, Planned, Unassigned]
note:  [DAcWeodOvb, 13302090, 15978796]
*/

// ---------------
// ceServer will...
//    not modify PAct after issuing it.
//    not modify peq.peqType, peq.id after initial creation
//    not modify peq.amount after initial creation
//    modify peq.HostProjectSub after first relo from unclaimed to initial home
//    set assignees only if issue existed before it was PEQ (pacts wont see this assignment)
//    modify hostIssueId during bad transfer
// ---------------
// Note: Good transfer PActs arrive as:  1) confirm delete trans out, 2) confirm add, 3) confirm note all xfer details
//       Bad transfers are undone:  1) add/relo, 2) delete, 3) confirm note with xfer detail, 4) confirm note blank
//           (note that ceServer removes bad peq, updates hostIssueId, and may or may not receive an extra labeling request from GH.)
//   in all cases, GH retains card, assignees, labels, and loc.
//   in all cases, ceServer handles updating dynamo with both deactivation on delete, and creating new peq in new loc.  ingest must handle allocs.
//   ACCR is allowed, as the only xfers that ceServer does not undo is PEQ within CEV.  The CEProjectId can change.
//   XXX Should inform participants.  Otherwise, this just disappears.
Future processPEQAction( Tuple2<PEQAction, PEQ> tup, context, container, pending, peqMods ) async {

   PEQAction pact = tup.item1;
   PEQ       peq  = tup.item2;
   
   final appState = container.state;
   _vPrint( appState, 1, "\n-------------------------------" );
   _vPrint( appState, 1, " processing " + enumToStr(pact.verb) + " " + enumToStr(pact.action) + ", " + enumToStr(peq.peqType) + " for " + peq.amount.toString() + ", " + peq.hostIssueTitle );

   _vPrint( appState, 1, pact.toString() );
   _vPrint( appState, 1, peq.toString() );

   // is PEQ already a Known Alloc?  Always use it when possible - is the most accurate current view during ingest.
   // remember, issue:card is 1:1.  1 allocation is proj/{proj}/column/assignee with a set of member peqId:peqValues
   // peq.projsub? unclaimed, or updated to reflect first home outside unclaimed.  only.
   // peq.hostUser?  empty, or reflects only issues assigned before becoming peq.  
   // peq.amount?  full initial peq amount for the issue, independent of number of assignees.  assigneeShares are identical per assignee per issue.
   List<String> assignees = [];

   // Note: assignees will always be hostUserId in PEQ.  they may arrive as hostUserName .. convert as need be
   Allocation? ka         = null;
   for( Allocation alloc in appState.myPEQSummary.getByPeqId( peq.id ) ) {
      if( alloc.hostUserId != "" ) { assignees.add( alloc.hostUserId );  }
      ka = alloc;
   }
   // i.e. can't be relo .. relocating what if not already ka?
   if( ka == null ) {
      bool nonPeqChange = pact.action == PActAction.change && ( pact.note == PActNotes['colRename'] || pact.note == PActNotes['projRename'] );
      bool peqChange    = pact.action == PActAction.add || pact.action == PActAction.delete || pact.action == PActAction.notice;
      if( !( pact.verb == PActVerb.confirm && ( nonPeqChange || peqChange )) ) {
         print( "XXX FAIL " + nonPeqChange.toString() + " " + peqChange.toString() + " " + enumToStr( pact.verb) );
      }
      assert( pact.verb == PActVerb.confirm && ( nonPeqChange || peqChange ));
      assignees = peq.hostHolderId;
      if( assignees.length == 0 ) { assignees = [ appState.UNASSIGN ]; } 
      else {
         List<String> hids = [];
         assignees.forEach( (a) { hids.add( _convertNameToId( appState, a ) ); });
         assignees = hids;
      }
   }
   // NOTE: assignees can be [] at this point, if ka is not null
   if( assignees.length == 0 ) { assignees = [ appState.UNASSIGN ]; }
       
   assert( ka == null || ka.categoryBase       != null );
   assert( ka == null || ka.sourcePeq          != null );
   assert( ka == null || ka.sourcePeq![peq.id] != null );

   // subBase is subjectBase, or project:column.  Useful to split this out since can have multiple assignees (then, allocs) per subBase.
   // NOTE: If assignee share includes a fraction of a PEQ, it will be floor'd.  This means a peq label may mismatch the total summary allocation value by 1 peq.
   List<String> subBase = ka == null ? peq.hostProjectSub                      : ka.categoryBase!; 
   // int assigneeShare    = ka == null ? (peq.amount / assignees.length).floor() : ka.sourcePeq![ peq.id ]!;
   double assigneeShare    = ( ka == null ? (peq.amount / assignees.length) : ka.sourcePeq![ peq.id ]! ).toDouble();

   // propose accrue == pending.   confirm accrue == grant.  others are plan.  end?
   if     ( pact.action == PActAction.accrue )                                    { await _accrue( context, container, pact, peq, peqMods, assignees, assigneeShare, ka, subBase ); }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.delete )   { _delete(                 appState, pact, peq,          assignees, assigneeShare, ka      ); }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.add )      { await _add(    context, container, pact, peq, peqMods, assignees, assigneeShare, subBase ); }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.relocate ) { await _relo(   context, container, pact, peq, peqMods, assignees, assigneeShare, ka, pending, subBase ); }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.change )   { await _change( context, container, pact, peq, peqMods, assignees, assigneeShare, ka, pending ); }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.notice )   { _notice( appState ); }
   else { notYetImplemented( context ); }
   
   // NOTE: only leaf allocs have PID - is only set during relocation.
   // NOTE: situated accrued card 1st - YES peq should exist as unclaimed:accrued.  it has been deleted elsewhere.
   //       furthermore, trip begins and ends as unclaimed:accr, which is good.  in the middle it replicates the journey, which is fine.
   // NOTE: in all cases, if ingest is halted in the middle, it should be accurate as of last todo, just not necessarily up to date.
   if( subBase.length > 0 ) {  // notices have no subs
      _vPrint( appState, 1, "current allocs" );
      for( var alloc in appState.myPEQSummary.getAllAllocs() ) {
         // if( subBase[0] == alloc.category[0] ) { print( alloc.category.toString() + " " + alloc.amount.toString() + " " + alloc.sourcePeq.toString() ); }
         // print( alloc.hostProjectId + " " + alloc.category.toString() + " " + alloc.amount.toString() + " " + alloc.sourcePeq.toString() );
         _vPrint( appState, 1, alloc.category.toString() + " " + alloc.amount.toString() + " " + alloc.sourcePeq.toString() );
      }
   }
}


// Note.  locking is sticky.
// Record all PEQ actions:add, delete, accrue, relocate, change, notice
// Examples of useful actions without associated PEQ
//   change:'Column rename'
//   change:'Project rename'
//   change:'Column rename attempted'
//   notice:'PEQ label delete attempt'
//   notice:'PEQ label edit attempt'

Future<void> updatePEQAllocations( context, container ) async {
   final appState  = container.state;
   final ceProjId  = appState.selectedCEProject;
   _vPrint( appState, 4, "Updating allocations for ceProjectId: " + ceProjId );
   final startUPA = DateTime.now();
   
   _vPrint( appState, 4, "Get uningested PActs." );
   // Get all uningested pacts.
   final todoPActions = await lockFetchPActions( context, container, '{ "Endpoint": "GetUnPAct", "CEProjectId": "$ceProjId" }' );
   print( "TIME FetchPAct " + DateTime.now().difference(startUPA).inSeconds.toString() );
   
   if( todoPActions.length == 0 ) { print( "Allocations are up to date." );   return; }


   // First, update myHostLinks.locs, since ceFlutter may have been sitting in memory long enough to be out of date.
   // These MUST be up to date.
   _vPrint( appState, 4, "Start myLoc update" );
   var pd = { "Endpoint": "GetEntry", "tableName": "CELinkage", "query": { "CEProjectId": "$ceProjId" }};
   Future myLocs = fetchHostLinkage( context, container, json.encode( pd ) );
   
   List<String> pactIds = [];
   List<String> peqIds = [];

   _vPrint( appState, 4, "Building peqPActs" );
   // Build pact peq pairs for active 'todo' PActions.  First, need to get ids where available
   for( var pact in todoPActions ) {
      print( pact.toString() );
      assert( !pact.ingested );
      pactIds.add( pact.id );
      // Note: not all in peqIds are valid peqIds, even with non-zero subject
      // peqIds -1's do not get removed, they are processed as NO-OPS for now.  Later, might trigger notifications to collaborators.
      pact.subject.length > 0 ? peqIds.add( pact.subject[0] ) : peqIds.add( "-1" );  
   }
   print( "TIME PeqPactPair " + DateTime.now().difference(startUPA).inSeconds.toString() );

   List<String> cleanPIDs  = [];
   List<int>    peqToClean = [];
   for( var pid in peqIds ) {
      var index = cleanPIDs.indexOf( pid );
      if( index == -1 ) {
         cleanPIDs.add( pid );
         index = cleanPIDs.length - 1;
      }
      assert( index >= 0 );
      peqToClean.add( index );
   }

   // This returns in order of request, including duplicates
   // cleanPeqs is basically a set.. will be many fewer of these than todoPeqs in general.
   String PeqIds = json.encode( cleanPIDs );
   List<PEQ> cleanPeqs = await fetchPEQs( context, container,'{ "Endpoint": "GetPEQsById", "PeqIds": $PeqIds }' );
   List<PEQ> todoPeqs  = [];
   assert( peqToClean.length == peqIds.length );
   for( var i in peqToClean ) {
      assert( i < cleanPeqs.length );
      todoPeqs.add( cleanPeqs[i] ); 
   }
   
   assert( pactIds.length == todoPActions.length );
   assert( peqIds.length  == todoPeqs.length );
   assert( peqIds.length  == pactIds.length );

   // XXX NOTE - timestamp sort may hurt this. stable sort in dart?
   // sort by peq category length before processing.
   List<Tuple2<PEQAction, PEQ>> todos = [];
   var foundPeqs = 0;
   for( var i = 0; i < todoPActions.length; i++ ) {
      // Can not assert the peqs are active - PAct might be a delete.
      assert( pactIds[i] == todoPActions[i].id );
      if( todoPeqs[i].id != "-1" ) {
         assert( peqIds[i] == todoPeqs[i].id );
         foundPeqs++;
      }
      
      // print( "associated peq-pact" );
      // print(  todoPActions[i] );
      // print(  todoPeqs[i] );
      todos.add( new Tuple2<PEQAction, PEQ>( todoPActions[i], todoPeqs[i] ) );
   }
   // todos.sort((a, b) => a.item2.hostProjectSub.length.compareTo(b.item2.hostProjectSub.length));
   todos.sort((a, b) => a.item1.timeStamp.compareTo(b.item1.timeStamp));
   print( "TIME Sorted " + DateTime.now().difference(startUPA).inSeconds.toString() );

   _summarizeTodos( appState, todos, todoPActions.length, foundPeqs );

   _vPrint( appState, 4, "Pre order fix " + todos.length.toString());
   await fixOutOfOrder( todos, context, container );
   
   _vPrint( appState, 4, "Complete myLoc update " + todos.length.toString());
   appState.ceHostLinks[ceProjId] = await myLocs;
   appState.myHostLinks = appState.ceHostLinks[ceProjId];
   if( appState.myHostLinks == null ) { return; }
   
   Map<String, PEQ> peqMods = new Map<String, PEQ>();
   var pending = {};

   await _updateHostNames( appState, todos, context, container, peqMods );
   await _updateCEUID( appState, todos, context, container, peqMods );
   _vPrint( appState, 4, "... done (ceuid)" );

   print( "TIME CEUID, hostnames " + DateTime.now().difference(startUPA).inSeconds.toString() );

   // Create, if need to
   if( appState.myPEQSummary == null && todos.length > 0) {
      _vPrint( appState, 4, "Create new appstate PSum " + todos[0].item2.ceProjectId + "\n" );
      appState.myPEQSummary = new PEQSummary( ceProjectId: ceProjId, 
                                              targetType: "repo", targetId: todos[0].item2.hostRepoId, lastMod: getToday(),
                                              accruedTot: 0, taskedTot: 0, allocations: {}, jsonAllocs: [] );
   }
   
   // appState.ingestUpdates.clear();
   for( var tup in todos ) {
      await processPEQAction( tup, context, container, pending, peqMods );
   }
   print( "TIME PPA " + DateTime.now().difference(startUPA).inSeconds.toString() );
   _vPrint( appState, 4, "Finishing updating PPA..." );

   List<Future> dynamo = [];
   // First, make sure locking mechanism for peqMods and headless integration tests have a home
   if( peqMods.length > 0 ) {
      assert( appState.myPEQSummary != null );  // make sure we update psum below.
      String postData = '{ "Endpoint": "AddPSumLock", "ceProjId": "$ceProjId" }';
      await updateDynamo( context, container, postData, "AddPSumLock" );
   }
   
   // send up peqMods
   if( peqMods.length > 0 ) {
      String pmods = json.encode( peqMods );
      String postData = '{ "Endpoint": "PutPeqMods", "CEProjectId": "$ceProjId", "PeqMods": $pmods }';
      dynamo.add( updateDynamoPeqMods( context, container, postData, "PutPeqMods") );
   }
   
   _vPrint( appState, 4, "... done (dynamo)" );
   print( "TIME Finish initial dynamo actions " + DateTime.now().difference(startUPA).inSeconds.toString() );

   
   print( "Ingest todos finished processing.  Update Dynamo." );
   // NOTE: summary_frame:_buildAllocTree is called after ingest completes, with getAllAlloc, which sorts.
   // XXX Skip this if no change (say, on a series of notices).
   if( appState.myPEQSummary != null ) {
      appState.myPEQSummary.lastMod = getToday();
      String psum = json.encode( appState.myPEQSummary );
      String postData = '{ "Endpoint": "PutPSum", "NewPSum": $psum }';
      dynamo.add( updateDynamo( context, container, postData, "PutPSum" ) );
   }
   print( "TIME update dynamo peq summary " + DateTime.now().difference(startUPA).inSeconds.toString() );

   // unlock, set ingested
   if( pactIds.length > 0 ) {
      String newPIDs = json.encode( pactIds );
      dynamo.add( updateDynamo( context, container,'{ "Endpoint": "UpdatePAct", "PactIds": $newPIDs }', "UpdatePAct" ) );
   }

   await Future.wait( dynamo ); 
   print( "TIME Ingested " + DateTime.now().difference(startUPA).inSeconds.toString() );

}

