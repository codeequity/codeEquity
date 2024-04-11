import 'dart:convert';  // json encode/decode
import 'dart:async';
import 'dart:typed_data';

import 'package:collection/collection.dart';      // list equals, firstwhereornull
import 'package:fluttertoast/fluttertoast.dart';
import 'package:tuple/tuple.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';

import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/PEQAction.dart';
import 'package:ceFlutter/models/PEQSummary.dart';
import 'package:ceFlutter/models/allocation.dart';
import 'package:ceFlutter/models/hostLoc.dart';

Function listEq = const ListEquality().equals;

void vPrint( appState, String astring ) {
   if( appState.verbose >= 1 ) { print( astring ); }
}

// XXX This is silly.  Consider reverse map
String _convertNameToId( appState, String aname ) {
   String hostUserId = appState.idMapHost.keys.firstWhere( (k) => appState.idMapHost[k]['hostUserName'] == aname, orElse: () => aname );
   return hostUserId;
}


// XXX associateGithub has to update appState.idMapHost
// PActions, PEQs are added by webServer, which does not have access to ceUID.
// set CEUID by matching my peqAction:hostUserId to CEHostUser:HostUsernId, then writing that CEUserId
// if there is not yet a corresponding ceUID, use "HOSTUSER: $hostUserId" in it's place, to be fixed later by associateGitub XXX (done?)
// NOTE: Expect multiple PActs for each PEQ.  For example, open, close, and accrue
Future updateCEUID( appState, Tuple2<PEQAction, PEQ> tup, context, container ) async {

   PEQAction pact = tup.item1;
   PEQ       peq  = tup.item2;

   // print( pact );
   // print( peq );
   
   String hostUID  = pact.hostUserId;
   assert( appState.idMapHost.containsKey( hostUID ) );
   /*
   if( !appState.idMapHost.containsKey( hostUID )) {
      appState.idMapHost[ hostUID ] = await fetchString( context, container, '{ "Endpoint": "GetCEUID", "HostUserId": "$hostUID" }', "GetCEUID" );
   }
   */
   String ceu = appState.idMapHost[ hostUID ]['ceUID'];

   // Too aggressive.  If run 'refresh repos' from homepage, hostAccount is rewritten with new repo list, at which point pacts are updated with 'new' ceuid.
   //                  This is done because in some (many?) cases, pacts are created by a host user before that user has a CEUID.
   // assert( pact.ceUID == EMPTY );
   assert( pact.ceUID == EMPTY || pact.ceUID == ceu );

   // print( "Started dynamo pact update " + ceu + " " + pact.id);
   
   if( ceu != "" ) {
      // Don't await here, CEUID not used during processPEQ
      await updateDynamo( context, container, '{ "Endpoint": "putPActCEUID", "CEUID": "$ceu", "PEQActionId": "${pact.id}" }', "putPActCEUID" );
   }

   // print( "Started erm dynamo pact update " + ceu + " " + pact.id);

   // PEQ holder may have been set via earlier PAct.  But here, may be adding or removing CEUIDs
   peq.ceHolderId = [];
   for( var peqHostUser in peq.hostHolderId ) {
      if( !appState.idMapHost.containsKey( peqHostUser )) {
         print( peqHostUser );
         print( peq.toString() );
         print( appState.idMapHost.toString() );
         assert( appState.idMapHost.containsKey( peqHostUser ) );
      }
      /*
      if( !appState.idMapHost.containsKey( peqHostUser )) {
         appState.idMapHost[ peqHostUser ] = await fetchString( context, container, '{ "Endpoint": "GetCEUID", "HostUserId": "$peqHostUser" }', "GetCEUID" );
      }
      */
      String ceUID = appState.idMapHost[ peqHostUser ]['ceUID'];
      if( ceUID == "" ) { ceUID = "HostUSER: " + peqHostUser; }  // XXX formalize
      peq.ceHolderId.add( ceUID );
   }

   // Ignore CEGrantorId.  Must already be signed up to authorize PEQ, so all IDs will already be correct.

   // Update PEQ, if there is one.
   if( peq.id != "-1" ) {
      var postData = {};
      postData['PEQId']       = peq.id;
      postData['CEHolderId']  = peq.ceHolderId;
      var pd = { "Endpoint": "UpdatePEQ", "pLink": postData }; 
      
      // Do await, processPEQs needs holders
      await updateDynamo( context, container, json.encode( pd ), "UpdatePEQ" );
   }
   // print( "Finished peq update " + ceu + " " + peq.id + " " + pact.id);   
}

// XXX may be able to kill categoryBase

// One allocation per category.. i.e. project:column:pallocCat or project:column:assignee.  Could also be project:project is first is the master proj
void adjustSummaryAlloc( appState, peqId, List<String> cat, String subCat, splitAmount, PeqType peqType, {Allocation? source = null, String pid = ""} ) {
   
   assert( appState.myPEQSummary.allocations != null );
   
   // subCat is either assignee, or palloc title (if peqType is alloc)
   List<String> suba = new List<String>.from( cat );
   if( source == null ) {
      assert( subCat != EMPTY );
      suba.add( subCat );
   }
   else {
      suba   = source.category;
      subCat = source.category.last;
   }

   if( splitAmount > 0 ) { vPrint( appState, "Adjust up   summary allocation " + suba.toString() ); }
   else                  { vPrint( appState, "Adjust down summary allocation " + suba.toString() ); }
   
   // Update, if already in place
   for( var alloc in appState.myPEQSummary.allocations ) {
      if( suba.toString() == alloc.category.toString() ) {
         // print( " ... matched category: " + suba.toString()  );
         alloc.amount = alloc.amount + splitAmount;

         // XXX pull this out as func.  may need more cases down the road.
         // Assignee notices can arrive late.  If correction here is obvious, do it.
         // Case 1: assignee notice arrives after propose accrue, then reject accrue.  Problem is on adjust down, not up.
         //         in this case, attempt to remove from [path, Pending PEQ Approval, assignee] but alloc is actually in [path, X, assignee]
         if( alloc.amount < 0 ) {
            print( "WARNING.  Detected negative allocation, likely due to out of order Notifications.  Attempting to repair." );
            for( var allocActual in appState.myPEQSummary.allocations ) {
               if( allocActual.sourcePeq.containsKey( peqId ) &&
                   allocActual.category.last == suba.last     &&
                   listEq( allocActual.category.sublist( 0, allocActual.category.length - 2 ), suba.sublist( 0, suba.length - 2 ) )) {

                  print( "... found where the late assignment allocation went: " + allocActual.category.toString() );
                  alloc.amount       = alloc.amount       - splitAmount;
                  allocActual.amount = allocActual.amount + splitAmount;
                  assert( allocActual.amount >= 0 && splitAmount < 0 );
                  if ( allocActual.amount == 0 )  { appState.myPEQSummary.allocations.remove( allocActual ); }
                  else                            { allocActual.sourcePeq.remove( peqId ); }
                  
                  return;                  
               }
            }
         }
         assert( alloc.amount >= 0 );

         if     ( alloc.amount == 0 )                                        { appState.myPEQSummary.allocations.remove( alloc ); }
         else if( alloc.sourcePeq.containsKey(  peqId ) && splitAmount < 0 ) { alloc.sourcePeq.remove( peqId ); }
         else if( !alloc.sourcePeq.containsKey( peqId ) && splitAmount > 0 ) { alloc.sourcePeq[ peqId ] = splitAmount; }
         else {
            // This should not be overly harsh.  Negotiations can remove then re-add.
            print( "Error.  XXX.  Uh oh.  AdjustSummaryAlloc $splitAmount $peqId " + alloc.toString() );
            // assert( false );
         }
         
         return;
      }
   }
   
   // If we get here, could not find existing match. 
   // if peqType == end, we are reducing an existing allocation.
   assert( peqType != PeqType.end && splitAmount >= 0 );
   assert( source == null );
   assert( splitAmount > 0 );
   assert( peqType == PeqType.allocation || suba.length >= 3 );

   // depending on peqType, suba will be the base (allocation), or will have an extra "assignee" attached.
   String assignee      = peqType == PeqType.allocation ? "" : subCat;
   List<String> catBase = peqType == PeqType.allocation ? suba : suba.sublist(0, suba.length-1);
   
   // Create allocs, if not already updated
   vPrint( appState, " ... adding new Allocation" );
   Allocation alloc = new Allocation( category: suba, categoryBase: catBase, amount: splitAmount, sourcePeq: {peqId: splitAmount}, allocType: peqType,
                                      ceUID: EMPTY, hostUserId: assignee, vestedPerc: 0.0, notes: "", hostProjectId: pid );
   appState.myPEQSummary.allocations.add( alloc );
}

// XXX utils: enumFromStr
// Oh boy.  dart extensions are ugly, dart templates via abstract are much worse.  For now, 
void swap( List<Tuple2<PEQAction, PEQ>> alist, int indexi, int indexj ) {
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
// Case 2: "add" arrives before a deleted accrued issue is recreated.
//         recreate already handles the add - need to tamp down on this one, which is automatic if it follows.
// Case 3: "add" will arrive twice in many cases, one addRelo for no status (when peq label an issue, then the second when situating the issue
//          ignore the second add, it is irrelevant
// Need to have seen a 'confirm' 'add' before another action, in order for the allocation to be in a good state.
// This will either occur in current ingest batch, or is already present in mySummary from a previous update.
// Remember, all peqs are already in aws, either active or inactive, so no point to look there.
// XXX really need to save some of this work (i.e. not always redo it).
// XXX hashmap would probably speed this up a fair amount
// XXX could speed up recreate bit.. no need to scan again
// XXX minor - in theory recreate.source peq could come from myPEQSummary while recreate is in ingest batch.  vastly improbable...
Future fixOutOfOrder( List<Tuple2<PEQAction, PEQ>> todos, context, container ) async {

   final appState            = container.state;
   List<String>           kp = []; // known peqs, with todo index
   Map<String,List<int>>  dp = {}; // demoted peq: list of positions in todos
   List<int>              ia = []; // ignore 2nd add of peq, index
   List<String>           ip = []; // ignore 2nd add of peq, peqId, to allow quick failure check

   // build kp from mySummary.  Only active peqs are part of allocations.
   if( appState.myPEQSummary != null ) {
      for( Allocation alloc in appState.myPEQSummary.allocations ) {
         assert( alloc.sourcePeq != null );
         kp = kp + alloc.sourcePeq!.keys.toList();
      }
      kp = kp.toSet().toList();  // if this way to remove duplicates turns out to be slow, use hashmap
   }

   vPrint( appState, "Initial known peq-allocs: " + kp.toString() );

   // Case 1.  Fairly generic - if operation depends on peq, but haven't added it yet, swap the operation with the following confirm.add
   // Case 2.  Very specific  - if confirm.add matches subsequent recreate target, swap
   // look through current ingest batch for issues to resolve.
   for( int i = 0; i < todos.length; i++ ) {
      PEQAction pact = todos[i].item1;
      PEQ       peq  = todos[i].item2;

      vPrint( appState, i.toString() + ": Working on " + peq.hostIssueTitle + ": " + peq.id );

      if( peq.id == "-1" ) { continue; }
      bool deleted = false;
      bool ignored = false;
      
      // print( pact );
      // print( peq );
      
      // update known peqs and recreate targets with current todo.
      if( pact.verb == PActVerb.confirm && pact.action == PActAction.add ) {
         if( kp.contains( peq.id ) ) {
            ia.add( i );
            // make sure peq was not added more than twice
            assert( !ip.contains( peq.id ) );
            ip.add( peq.id );
            ignored = true;
            vPrint( appState, "   Ignoring 2nd add of peq " + peq.hostIssueTitle + " " + peq.id );            
         }
         else {
            kp.add( peq.id );
            vPrint( appState, "   Adding known peq " + peq.hostIssueTitle + " " + peq.id );
         }
      }
      else if( pact.verb == PActVerb.confirm && pact.action == PActAction.delete ) {
         assert( kp.contains( peq.id ) );
         kp.remove( peq.id );
         deleted = true;
         vPrint( appState, "   Removing known peq " + peq.hostIssueTitle + " " + peq.id + " " + peq.active.toString());
      }
      else if ( pact.note == "recreate" ) {    // XXX formalize
         assert( pact.subject.length == 2 );   // pact.subject[0] --> pact.subject[1]
         if( kp.contains( pact.subject[1] )) {
            vPrint( appState, "Add occured before recreate - swapping." );
            int kpIndex = -1;
            for( int j = 0; j < i; j++ ) {
               if( todos[j].item1.verb == PActVerb.confirm && todos[j].item1.action == PActAction.add ) {
                  kpIndex = j;
                  continue;
               }
            }
            assert( kpIndex >= 0 );  // XXX if this fails, see vastly improbable above.
            swap( todos, kpIndex, i );
            // At this point, todo at position i is the faulty add, which will be ignored.
            // XXX it is possible that there is an earlier assignment.  check for this and warn, or treat recreate as official kp in swap below.
            continue;
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
               vPrint( appState, "   swapping todo at position:" + confirmAdd.toString() + " to position:" + dp[peq.id]![j].toString() );
               swap( todos, dp[peq.id]![j], confirmAdd );
               confirmAdd--;
               assert( confirmAdd >= 0 );
            }
            
            dp.remove( peq.id );
            vPrint( appState, "   peq: " + peq.hostIssueTitle + " " + peq.id + " UN-demoted." );
         }
         // demote if needed.  Needed if working on peq that hasn't been added yet.
         else if( !kp.contains( peq.id ) && !deleted ) {
            if( !dp.containsKey( peq.id ) ) { dp[peq.id] = []; }
            dp[peq.id]!.add( i );  
            vPrint( appState, "   demoting peq: " + peq.hostIssueTitle + " " + peq.id );
         }
      }
   }
   
   // Remove ia 'ignore add' todos, there is nothing todo here.  These did not participate in any swaps above.
   for( int i = ia.length - 1; i >= 0; i-- ) {
      todos.removeAt( ia[ i ] );
   }

}


// ingest may contain edits to HOST projects or columns.
// For renaming, will update peqSummary from dynamo, and build the list of current names for the next ingest
// Example: ingest todos contains renames of project: aProj -> bProj, and bProj -> cProj
//    aws dynamo peqs          will contain aproj, or earlier.  these will probably stay put
//    myPEQSummary allocations will contain aProj
//    myHostLinks hostLocs       will contain cProj
//    ingest todos             will contain aProj, bProj and cProj

// Todo list processing for relo and reject-to uses IDs, so names will be up to date based on myHostLinks.
// Adds are based on psub, but immediate relos are myHostLinks.
// The only adds without relos are for unclaimed:unclaimed, which should be name-protected.
// updateHostNames will update all allocs to cProj, leaving todo's alone as above.
Future updateHostNames( List<Tuple2<PEQAction, PEQ>> todos, appState ) async {
   vPrint( appState, "Updating Host Names in appAllocs ");

   List<HostLoc> colRenames  = [];
   List<HostLoc> projRenames = [];
   
   List<Allocation> appAllocs = [];
   List<HostLoc>      appLocs   = appState.myHostLinks.locations;
   if( appState.myPEQSummary != null ) { appAllocs = appState.myPEQSummary.allocations; }

   print( appLocs );

   // look through current ingest batch renaming events.  Save old here, look up new later.
   for( var i = 0; i < todos.length; i++ ) {
      PEQAction pact = todos[i].item1;
      PEQ       peq  = todos[i].item2;

      // print( pact );
      // print( peq );

      if( pact.verb == PActVerb.confirm && pact.action == PActAction.change ) {
         if( pact.note == "Column rename" ) {
            assert( pact.subject.length == 3 );
            HostLoc? loc = appLocs.firstWhereOrNull( (a) => a.hostColumnId == pact.subject[0] );
            assert( loc != null );
            // XXX why do I need loc! for projId, but can't have it for active?  funky promotion short-circuit?
            colRenames.add( new HostLoc( ceProjectId: "-1", hostUtility: "-1", hostProjectId: loc!.hostProjectId, hostProjectName: loc.hostProjectName,
                                       hostColumnId: pact.subject[0], hostColumnName: pact.subject[1], active: loc.active ) );
            vPrint( appState, "... col rename " + pact.subject[1] );
         }
         else if( pact.note == "Project rename" ) {
            assert( pact.subject.length == 3 );
            HostLoc? loc = appLocs.firstWhereOrNull( (a) => a.hostColumnId == pact.subject[0] );
            assert( loc != null );
            projRenames.add( new HostLoc( ceProjectId: "-1", hostUtility: "-1", hostProjectId: pact.subject[0], hostColumnId: "-1", hostProjectName: pact.subject[1],
                                        hostColumnName: loc!.hostColumnName, active: loc.active ) );
            vPrint( appState, "... proj rename " + pact.subject[1] );            
         }
      }
   }

   // XXX this could be sped up, but any value?
   // XXX Untested
   // Update allocations.
   vPrint( appState, "... allocations size: " + appAllocs.length.toString() + " " + colRenames.length.toString() + " " + projRenames.length.toString() );
   for( Allocation alloc in appAllocs ) {
      assert( alloc.categoryBase != null );
      for( HostLoc proj in projRenames ) {
         if( alloc.hostProjectId == proj.hostProjectId ) {
            HostLoc? loc = appLocs.firstWhereOrNull( (a) => a.hostProjectId == proj.hostProjectId );
            assert( loc != null );
            vPrint( appState, " .. found project name update: " + proj.hostProjectName  + " => " + loc!.hostProjectName );

            // pindex can be -1 when there are multiple renames in this ingest stream.  myHostLinks will skip to the final.
            int pindex = alloc.category.indexOf( proj.hostProjectName );
            if( pindex >= 0 ) { alloc.category[pindex] = loc.hostProjectName; }

            pindex = alloc.categoryBase!.indexOf( proj.hostProjectName );
            if( pindex >= 0 ) { alloc.categoryBase![pindex] = loc.hostProjectName; }
         }
      }
      for( HostLoc col in colRenames ) {
         if( alloc.hostProjectId == col.hostProjectId ) {
            
            HostLoc? loc = appLocs.firstWhereOrNull( (a) => a.hostColumnId == col.hostColumnId );
            assert( loc != null );
            vPrint( appState, " .. found Column name update: " + col.hostColumnName + " => " + loc!.hostColumnName );

            int pindex = alloc.category.indexOf( col.hostColumnName );
            if( pindex >= 0 ) { alloc.category[pindex] = loc.hostColumnName; }
            
            pindex = alloc.categoryBase!.indexOf( col.hostColumnName );
            if( pindex >= 0 ) { alloc.categoryBase![pindex] = loc.hostColumnName; }
         }
      }
   }
}

// No need to clear appState.ingestUpdates - updateDynamo does that.
// XXX Could, maybe, be more picky about releasing once the specific peq.id reaches 0
// void checkPendingUpdates( appState, dynamo, peqId ) async {
Future checkPendingUpdates( appState, dynamo, peqId ) async {
   if( appState.ingestUpdates.containsKey( peqId ) && appState.ingestUpdates[peqId] > 0 ) {
      vPrint( appState, "peq " + peqId + " has pending updates to dynamo.  Waiting." );
      await Future.wait( dynamo );
      dynamo.clear();
   }
}

Future _accrue( context, container, PEQAction pact, PEQ peq, List<Future> dynamo, List<String> assignees, int assigneeShare, Allocation? sourceAlloc, List<String> subBase ) async {
   // Once see action accrue, should have already seen peqType.pending
   final appState = container.state;
   vPrint( appState, "Accrue PAct " + enumToStr( pact.action ) + " " + enumToStr( pact.verb ));
   
   if( assignees.length == 1 && assignees[0] == "Unassigned" ) {
      print( "WARNING.  Must have assignees in order to accrue!" );
      return;
   }

   List<String> subProp = new List<String>.from( subBase ); subProp.last = "Pending PEQ Approval";  // XXX Where does this name come from in ceFlutter?
   List<String> subAccr = new List<String>.from( subBase ); subAccr.last = "Accrued";  // XXX 
   
   // iterate over assignees
   String       newType = "";
   List<String> peqLoc  = [];
   for( var assignee in assignees ) {
      vPrint( appState, "\n Assignee: " + assignee );
      
      if( pact.verb == PActVerb.propose ) {
         // add propose, rem plan
         adjustSummaryAlloc( appState, peq.id, subBase, assignee, -1 * assigneeShare, PeqType.plan );
         adjustSummaryAlloc( appState, peq.id, subProp, assignee, assigneeShare, PeqType.pending ); 
         newType = enumToStr( PeqType.pending );
         peqLoc  = subProp;
      }
      else if( pact.verb == PActVerb.reject ) {
         // rem propose, add plan
         HostLoc loc = appState.myHostLinks.locations.firstWhere( (a) => a.hostColumnId == pact.subject.last );
         assert( loc != null );
         List<String> subDest = new List<String>.from( subBase ); subDest.last = loc.hostColumnName;
         
         adjustSummaryAlloc( appState, peq.id, subProp, assignee, -1 * assigneeShare, PeqType.pending );
         adjustSummaryAlloc( appState, peq.id, subDest, assignee, assigneeShare, PeqType.plan); 
         newType = enumToStr( PeqType.plan );
         peqLoc  = subDest;
      }
      else if( pact.verb == PActVerb.confirm ) {
         // remove any source alloc
         assert( sourceAlloc != null );
         adjustSummaryAlloc( appState, peq.id, subBase, assignee, -1 * assigneeShare, sourceAlloc!.allocType );
         adjustSummaryAlloc( appState, peq.id, subAccr, assignee,  assigneeShare, PeqType.grant );
         newType = enumToStr( PeqType.grant );
         peqLoc  = subAccr;
      }
      else {
         print( "Unrecognized verb " + enumToStr( pact.verb ) );
         assert( false );
      }
   }
      
   var postData = {};
   postData['PEQId']      = peq.id;
   postData['PeqType']    = newType;
   postData['HostHolderId'] = listEq( assignees, ["Unassigned"]) ? [] : assignees;

   if( newType == enumToStr( PeqType.grant )) {
      postData['AccrualDate'] = pact.entryDate;
      String ceUID = appState.idMapHost[ pact.hostUserId ]['ceUID'];
      if( ceUID == "" ) { ceUID = "HostUSER: " + pact.hostUserId; }  // XXX formalize
      postData['CEGrantorId'] = ceUID;
   }
   else {
      postData['AccrualDate'] = peq.accrualDate;
      postData['CEGrantorId'] = peq.ceGrantorId;
   }
   
   postData['Amount'] = ( assigneeShare * assignees.length ).toInt();
   postData['HostProjectSub'] = peqLoc;

   if( postData['PeqType']      != peq.peqType )              { vPrint( appState, "_accrue changing peqType to "     + postData['PeqType'] ); }
   if( postData['AccrualDate']  != peq.accrualDate )          { vPrint( appState, "_accrue changing accrualDate to " + postData['AccrualDate'] ); }
   if( postData['Amount']       != peq.amount )               { vPrint( appState, "_accrue changing amount to "      + postData['Amount'].toString() ); }
   if( postData['CEGrantorId']  != peq.ceGrantorId )          { vPrint( appState, "_accrue changing grantor to "     + postData['CEGrantorId'] ); }
   if( !listEq( postData['HostHolderId'],   peq.hostHolderId ))   { vPrint( appState, "_accrue changing assignees to "   + postData['HostHolderId'].toString() ); }
   if( !listEq( postData['HostProjectSub'], peq.hostProjectSub )) { vPrint( appState, "_accrue changing psub to "        + postData['HostProjectSub'].toString() ); }
   
   var pd = { "Endpoint": "UpdatePEQ", "pLink": postData };
   await checkPendingUpdates( appState, dynamo, peq.id );
   dynamo.add( updateDynamo( context, container, json.encode( pd ), "UpdatePEQ", peqId: peq.id ));
}

// Note: for del proj/col, ceFlutter need do nothing special, ceServer sends all component deletes
// Delete proj/col with no peqs?  Don't care.
// Delete proj/col with peqs?     issues remain, series of del card/label are sent.  
// Delete proj/col with ACCR?     ACCR are relocated
void _delete( appState, pact, peq, List<Future> dynamo, assignees, assigneeShare, ka ) {
   // This can be called as part of a transfer out, in which this is a no-op, handled in _relo.
   List<Allocation> appAllocs = appState.myPEQSummary.allocations;

   if( ka != null ) {
      if( pact.note != "Transfer out" ) {  // XXX formalize
         if( ka.allocType == PeqType.allocation ) {
            vPrint( appState, "\n Delete allocation: " + ka.category.toString() );
            adjustSummaryAlloc( appState, peq.id, [], EMPTY, -1*assigneeShare, PeqType.allocation, source: ka );
         }
         else {
            vPrint( appState, "\n Delete: " + ka.category.toString() );
            List<Allocation> remAllocs = [];  // category, hostUserId, allocType
            
            // avoid concurrent mod of list
            for( Allocation sourceAlloc in appAllocs.where( (a) => ( a.sourcePeq != null ) && a.sourcePeq!.containsKey( peq.id ) )) {
               Allocation miniAlloc = new Allocation( category: sourceAlloc.category, allocType: sourceAlloc.allocType, hostUserId: sourceAlloc.hostUserId );
               remAllocs.add( miniAlloc );
            }
            for( var remAlloc in remAllocs ) {
               adjustSummaryAlloc( appState, peq.id, [], EMPTY, -1*assigneeShare, ka.allocType, source: remAlloc );
            }
         }
      }

      // No need to update dyamo.  'Active' is managed by ceServer, all others are managed by other operations during ingest.
   }
}

// Note: there is no transfer in.  transfered peq issues arrive as uncarded newborns, and so are untracked.
// Note: some early peq states may be unexpected during add.  For example, LabelTest.
//       When performing a sequence of add/delete/move, an issue can be created correctly, then bounced out of reserved into "In Prog",
//       then unlabeled (untracked), then re-tracked.  In this case, the PEQ is re-created, with the correct column of "In Prog".
//       From ingest point of view, In Prog === Planned, so no difference in operation.

Future _add( context, container, pact, peq, List<Future> dynamo, assignees, assigneeShare, subBase ) async {
   // When adding, will only see peqType alloc or plan
   List<String> peqLoc = [];
   final appState = container.state;
   
   if( peq.peqType == PeqType.allocation ) {
      vPrint( appState, "Alloc PEQ" );
      // Note.. title will be set to future value here. Will create redundant 'change' in future ingest item
      String pt = peq.hostIssueTitle;
      adjustSummaryAlloc( appState, peq.id, peq.hostProjectSub, pt, peq.amount, PeqType.allocation );
      peqLoc = peq.hostProjectSub;
   }
   else if( peq.peqType == PeqType.plan || peq.peqType == PeqType.pending ) {  // plan == prog in peqtype, aws
      vPrint( appState, "Normal PEQ" );
      
      // XXX Speed this up.  This is relevant 1/1000 times, but runs always.
      //     Don't convert to preprocessing which depends on both recreate and add showing up in same ingest chunk - can fail.
      // Generated as part of 'recreate'?  If so, check location then ignore it.
      List<Allocation> appAllocs = appState.myPEQSummary.allocations;      
      for( Allocation anAlloc in appAllocs.where( (a) => ( a.sourcePeq != null ) && a.sourcePeq!.containsKey( peq.id ) )) {
         assert( listEq( subBase, ["UnClaimed", "Accrued" ] ));
         vPrint( appState, "Skipping Add, which was generated as part of Recreate, which was already handled." );
         return;
      }

      // iterate over assignees.  
      for( var assignee in assignees ) {

         String hostUserName = assignee;
         if( appState.idMapHost.containsKey( assignee )) { hostUserName = appState.idMapHost[assignee]['hostUserName']; }
         
         vPrint( appState, "\n Assignee: " + assignee + " (" + hostUserName + ")" );
         peqLoc = subBase;
         adjustSummaryAlloc( appState, peq.id, subBase, assignee, assigneeShare, peq.peqType );
      }
   }
   else {
      print( "Error.  Action add on peqType of " + peq.peqType.toString() );
      notYetImplemented( context );
   }

   // can not add into ACCR
   var postData = {};
   // peqType is unchanged.  amount is unchanged
   postData['PEQId']          = peq.id;
   postData['HostHolderId']   = listEq( assignees, ["Unassigned"] ) ? [] : assignees;
   postData['HostProjectSub'] = peqLoc;

   if( !listEq( postData['HostHolderId'],   peq.hostHolderId ))   { vPrint( appState, "_add changing assignees to "   + postData['HostHolderId'].toString() ); }
   if( !listEq( postData['HostProjectSub'], peq.hostProjectSub )) { vPrint( appState, "_add changing psub to "        + postData['HostProjectSub'].toString() ); }
   
   var pd = { "Endpoint": "UpdatePEQ", "pLink": postData };
   await checkPendingUpdates( appState, dynamo, peq.id );
   dynamo.add( updateDynamo( context, container, json.encode( pd ), "UpdatePEQ", peqId: peq.id ));
}


// Note.  The only cross-project moves allowed are unclaimed -> new home.  This move is programmatic via ceServer.
// Note.  There is a rare race condition in ceServer that may reorder when recordPeqs arrive.  Specifically, psub
//        may be unclaimed when expect otherwise.  Relo must then deal with it.
Future _relo( context, container, pact, peq, List<Future> dynamo, assignees, assigneeShare, ka, pending, subBase ) async {

   final appState = container.state;   
   List<Allocation> appAllocs = appState.myPEQSummary.allocations;
   var baseCat                = subBase.sublist( 0, subBase.length-1 );  // remove old column
   List<String> peqLoc        = [];
   
   // vPrint( appState, "subBase: " + subBase.toString() );
   // vPrint( appState, "baseCat: " + baseCat.toString() );

   // Delete only.
   if( pact.note == "Transfer out" ) {  // XXX formalize
      vPrint( appState, "Transfer out of repository" );
      // Note.  Transfer out is basically a delete, so no update of PID in dynamo PEQ table.
      //        Transfer in, issue comes in as newborn, so no PEQ to update.
      // XXX Should inform participants.  Otherwise, this just disappears.
      // XXX Can transfer accrued........?
      
      Allocation sourceAlloc = ka != null ? ka : -1;
      assert( sourceAlloc != -1 );
      assert( sourceAlloc.category.length >= 1 );
      
      if( sourceAlloc.allocType == PeqType.allocation ) {
         adjustSummaryAlloc( appState, peq.id, [], EMPTY, -1 * assigneeShare, sourceAlloc.allocType, source: sourceAlloc );
      }
      else
      {
         // Exactly one alloc per peq.id,assignee pair
         List<Allocation> reloAlloc = [];  // category, hostUserId, allocType
         
         // avoid concurrent mod of list
         for( Allocation sourceAlloc in appAllocs.where( (a) => (a.sourcePeq != null ) && a.sourcePeq!.containsKey( peq.id ) )) {
            Allocation miniAlloc = new Allocation( category: sourceAlloc.category, allocType: sourceAlloc.allocType, hostUserId: sourceAlloc.hostUserId );
            reloAlloc.add( miniAlloc );
         }
         
         for( var remAlloc in reloAlloc ) {
            assert( assignees.contains( remAlloc.hostUserId ));
            vPrint( appState, "\n Assignee: " + (remAlloc.hostUserName ?? "") + "(" + remAlloc.hostUserId + ")" );
            adjustSummaryAlloc( appState, peq.id, [], EMPTY, -1 * assigneeShare, remAlloc.allocType, source: remAlloc );
         }
      }

      // As with delete, ceServer manages 'active' flag, no work here in dynamo.
      return;
   }
   else {
      vPrint( appState, "Relo PEQ" );
      
      Allocation sourceAlloc = ka != null ? ka : -1;
      assert( sourceAlloc != -1 );
      assert( sourceAlloc.category.length >= 1 );

      if( pact.subject.length == 7 ) {
         print( "TRANSFERS ARE NOT YET HANDLED" );
         return;
      }
      
      // Get name of new column home
      assert( pact.subject.length == 3 );
      HostLoc loc = appState.myHostLinks.locations.firstWhere( (a) => a.hostProjectId == pact.subject[1] && a.hostColumnId == pact.subject[2] );
      assert( loc != null );
      
      // peq.psub IS the correct initial home if unclaimed, and right after the end of unclaimed residence.  Column is correct afterwards.
      // (if no existing alloc, use psub - can't happen).  If alloc.cat is not unclaimed, use column (only moves within proj).
      // If alloc.cat is unclaimed, ceServer will move across projects.  use psub.   Test col.  Will be stable even with multiple relos, since
      // psub is only overwritten the first time after unclaimed is claimed.
      // pallocs do not have assignees
      if( sourceAlloc.allocType == PeqType.allocation ) {
         // Remove it
         adjustSummaryAlloc( appState, peq.id, [], EMPTY, -1 * assigneeShare, sourceAlloc.allocType, source: sourceAlloc );
         
         vPrint( appState, "  .. relocating to " + loc.toString() );
         
         if( sourceAlloc.category[0] == "Unclaimed" ) {   // XXX formalize
            // XXX Untested
            // Here (hostIssueTitle) is the only dependency on peq that would require dynamo to have been updated.
            // changeTitle would have to have occured in this ingest chunk.  Peq data is old, so use information in 'pending'.
            // pending[peq.id] = [oldTitle, newTitle]
            String newTitle = peq.hostIssueTitle;
            if( pending.containsKey( peq.id ) ) {
               assert( pending[peq.id].length == 2 );
               newTitle = pending[peq.id][1];
            }
            peqLoc = peq.hostProjectSub;
            adjustSummaryAlloc( appState, peq.id, peq.hostProjectSub, newTitle, assigneeShare, sourceAlloc.allocType, pid: loc.hostProjectId ); 
         }
         else {
            // Have at least proj, col, title.
            assert( sourceAlloc.category.length >= 2 );
            List<String> suba = new List<String>.from( sourceAlloc.category.sublist(0, sourceAlloc.category.length-2) );
            suba.add( loc.hostColumnName );
            peqLoc = suba;
            adjustSummaryAlloc( appState, peq.id, suba, sourceAlloc.category.last, assigneeShare, sourceAlloc.allocType, pid: loc.hostProjectId ); 
         }
      }
      else
      {
         // Exactly one alloc per peq.id,assignee pair
         List<Allocation> reloAlloc = [];  // category, hostUserId, allocType
         
         // avoid concurrent mod of list
         for( Allocation sourceAlloc in appAllocs.where( (a) => (a.sourcePeq != null ) && a.sourcePeq!.containsKey( peq.id ) )) {
            Allocation miniAlloc = new Allocation( category: sourceAlloc.category, allocType: sourceAlloc.allocType, hostUserId: sourceAlloc.hostUserId );
            reloAlloc.add( miniAlloc );
         }
         
         for( var remAlloc in reloAlloc ) {
            assert( assignees.contains( remAlloc.hostUserId ));
            vPrint( appState, "\n Assignee: " + (remAlloc.hostUserName ?? "") + "(" + remAlloc.hostUserId + ")" );
            adjustSummaryAlloc( appState, peq.id, [], EMPTY, -1 * assigneeShare, remAlloc.allocType, source: remAlloc, pid: loc.hostProjectId );

            // Check to see if relo contains new information (new proj name, or new location if recordPeqData race condition).  If so, get category from existing allocs.
            if( !baseCat.contains( loc.hostProjectName ) ) {
               vPrint( appState, "  .. RELO is cross project!  Reconstituting category ");

               Allocation? newSource = appAllocs.firstWhereOrNull( (a) => a.category.contains( loc.hostProjectName ) );
               if( newSource == null ) {
                  // Possible if project name just changed.
                  // XXX If proj of MasterCol.proj just changed, will no longer see masterCol.
                  baseCat = [loc.hostProjectName];
               }
               else {
                  List<String> sourceCat = newSource.category;
                  baseCat = sourceCat.sublist( 0, sourceCat.indexOf( loc.hostProjectName ) + 1 );
               }
            }
            
            vPrint( appState, "  .. relocating to " + loc.toString() );
            peqLoc = baseCat + [loc.hostColumnName];
            adjustSummaryAlloc( appState, peq.id, baseCat + [loc.hostColumnName], remAlloc.hostUserId, assigneeShare, remAlloc.allocType, pid: loc.hostProjectId );
         }
      }


      var postData = {};
      // peqType is set by prior add, accrues, etc.
      // peqLoc can change.  Note that allocation titles are not part of psub.
      postData['PEQId']        = peq.id;
      postData['HostProjectSub'] = peqLoc;
      
      if( !listEq( postData['HostProjectSub'], peq.hostProjectSub )) {
         vPrint( appState, "_relo changing psub to "        + postData['HostProjectSub'].toString() );
         var pd = { "Endpoint": "UpdatePEQ", "pLink": postData }; 
         await checkPendingUpdates( appState, dynamo, peq.id );
         dynamo.add( updateDynamo( context, container, json.encode( pd ), "UpdatePEQ", peqId: peq.id ));
      }
   }
}   
   
// Note: peq.hostHolder will only inform us of the latest status, not all the changes in the middle.
//      Ingest needs to track all the changes in the middle
// XXX If add assignee that is already present, expect to remove all, then re-add all allocs.
//     this is slow, can cause n separate useless ingest steps - blast, n = #assignees
Future _change( context, container, pact, peq, List<Future> dynamo, assignees, assigneeShare, ka, pending ) async {
   final appState = container.state;
   assert( ka != null || pact.note == "Column rename" || pact.note == "Project rename" );

   var sourceType = ka == null ? "" : ka.allocType;
   var baseCat    = ka == null ? "" : ka.category.sublist( 0, ka.category.length-1 );

   List<String> newAssign = assignees;
   int newShareAmount     = assigneeShare;
   String newTitle        = peq.hostIssueTitle;
   String pactLast        = _convertNameToId( appState, pact.subject.last );  // if peqValUpdate, this will be an int, but won't be used.

   if( pact.note == "add assignee" ) {    // XXX formalize this
      assert( ka.allocType != PeqType.allocation );
      vPrint( appState, "Add assignee: " + pact.subject.last );
      
      List<String> curAssign = [ pactLast ];
      
      // Count the current assignees != unassigned.  readjust assigneeShare.  Ignore duplicate adds (blast).
      for( String assign in assignees ) {
         if( assign != "Unassigned" && !curAssign.contains( assign ) ) { curAssign.add( assign ); }   // XXX formalize this            
      }
      
      var curSplitAmount = ( assigneeShare * assignees.length / curAssign.length ).floor();
      newAssign      = curAssign;
      newShareAmount = curSplitAmount;
      
      // Remove all old, add all current with new assigneeShares
      for( var assign in assignees ) {
         vPrint( appState, "Remove " + baseCat.toString() + " " + assign + " " + assigneeShare.toString() );
         adjustSummaryAlloc( appState, peq.id, baseCat, assign, -1 * assigneeShare, sourceType );
      }
      for( var assign in curAssign ) {
         vPrint( appState, "Add " + assign + " " + curSplitAmount.toString() );
         adjustSummaryAlloc( appState, peq.id, baseCat, assign, curSplitAmount, sourceType );
      }
   }
   else if( pact.note == "remove assignee" ) {    // XXX formalize this
      assert( ka.allocType != PeqType.allocation );
      vPrint( appState, "Remove assignee: " + pact.subject.last );
      
      int originalSize = assignees.length;
      
      assert( assignees.contains( pactLast ));
      
      // Remove all old allocs
      for( var assign in assignees ) {
         vPrint( appState, "Remove " + baseCat.toString() + " " + assign + " " + assigneeShare.toString() );
         adjustSummaryAlloc( appState, peq.id, baseCat, assign, -1 * assigneeShare, sourceType );
      }
      
      // Remove, then readjust assigneeShare
      assignees.remove( pactLast );
      if( assignees.length == 0 ) { assignees.add( "Unassigned" ); }// XXX formalize this
      
      var curSplitAmount = ( assigneeShare * originalSize / assignees.length ).floor();  
      newAssign      = assignees;
      newShareAmount = curSplitAmount;
      
      for( var assign in assignees ) {
         vPrint( appState, "Add " + assign + " " + curSplitAmount.toString() );
         adjustSummaryAlloc( appState, peq.id, baseCat, assign, curSplitAmount, sourceType );
      }
   }
   else if( pact.note == "peq val update" ) { // XXX formalize this
      vPrint( appState, "Peq val update, new val: " + pact.subject.last );

      if( ka.allocType != PeqType.allocation ) {
         // Remove all old allocs
         for( var assign in assignees ) {
            vPrint( appState, "Remove " + baseCat.toString() + " " + assign + " " + assigneeShare.toString() );
            adjustSummaryAlloc( appState, peq.id, baseCat, assign, -1 * assigneeShare, sourceType );
         }
         
         var curSplitAmount = ( int.parse( pact.subject.last ) / assignees.length ).floor();  
         newShareAmount = curSplitAmount;
         
         for( var assign in assignees ) {
            vPrint( appState, "Add " + assign + " " + curSplitAmount.toString() );
            adjustSummaryAlloc( appState, peq.id, baseCat, assign, curSplitAmount, sourceType );
         }
      }
      else {
         // Remove old alloc
         String aTitle = ka.category.last;
         vPrint( appState, "Remove " + baseCat.toString() + " " + aTitle + " " + assigneeShare.toString() );
         adjustSummaryAlloc( appState, peq.id, baseCat, aTitle, -1 * assigneeShare, sourceType );

         var divisor = assignees.length == 0 ? 1 : assignees.length;   // might have assignees, might have none
         var curSplitAmount = ( int.parse( pact.subject.last ) / divisor ).floor();  
         newShareAmount = curSplitAmount;
         
         vPrint( appState, "Add " + aTitle + " " + curSplitAmount.toString() );
         adjustSummaryAlloc( appState, peq.id, baseCat, aTitle, curSplitAmount, sourceType );
      }
      
   }
   else if( pact.note == "recreate" ) {    // XXX formalize this
      // This is only issued when user deletes an accrued issue, which ceServer then recreates in unclaimed.
      // Note. After 8/2021, Github sends only partial issues in request body during issue delete.  Thanks GQL.
      //       Assignees may be removed.. safest place to transfer them is here.
      // This should be a rare event, seen after deleting an accrued issue.  ceServer rebuilds and saves a copy if the issue was removed first
      assert( ka.allocType != PeqType.allocation );
      assert( pact.subject.length == 2 );
      vPrint( appState, "Recreate PEQ: " + pact.subject[0] + " --> " + pact.subject[1] );

      // peq is always subject0
      assert( peq.id == pact.subject[0] );
      
      // Remove old allocs for peq
      for( var assign in assignees ) {
         vPrint( appState, "Remove " + peq.id + " in " + baseCat.toString() + " " + assign + " " + assigneeShare.toString() );
         adjustSummaryAlloc( appState, peq.id, baseCat, assign, -1 * assigneeShare, sourceType );
      }

      // Do NOT Add for new peq, there is a follow-on 'add' pact that does the job
      // The new peq is added in unclaimed:accrued with unassigned, as is correct.
      // No.
      // We need assignees for accrued, and in particular need to retain assignees for accrued issues.
      // Add back here, then ignore subsequent add.
      for( var assign in assignees ) {
         vPrint( appState, "Add " + pact.subject[1] + " for " + assign + " " + assigneeShare.toString() );
         adjustSummaryAlloc( appState, pact.subject[1], ["UnClaimed", "Accrued" ], assign, assigneeShare, sourceType ); // XXX formalize
      }

      // In this case, active flag is managed by ceServer, as is new peq creation.
      // ceServer creates the new peq with correct values for all but assignees, which was set properly above.
   }
   else if( pact.note == "Change title" ) { // XXX formalize this
      // XXX untested
      vPrint( appState, "Change title, new val: " + pact.subject.last );

      assert( ka != null );
      newTitle = pact.subject.last;
      
      if( ka.allocType == PeqType.allocation ) {
         // Remove old alloc
         assert( assignees.length == 1 );
         String oldTitle = ka.category.last;
         vPrint( appState, "Remove " + baseCat.toString() + " " + oldTitle + " " + assigneeShare.toString() );
         adjustSummaryAlloc( appState, peq.id, baseCat, oldTitle, -1 * assigneeShare, sourceType );
         
         vPrint( appState, "Add " + newTitle + " " + assigneeShare.toString() );
         adjustSummaryAlloc( appState, peq.id, baseCat, newTitle, assigneeShare, sourceType );

         // inform pending _relos, if any
         pending[peq.id] = [oldTitle, newTitle];
      }
      else {
         // no alloc-related work to be done here, allocs are not recorded by regular peq issue name.
      }
      
   }
   else if( pact.note == "Column rename" ) {    // XXX formalize this
      // These arrive as viable pact, and -1 as peq.  Pact subject is [ colId, oldName, newName ]
      // ceServer handles locs in dynamo.  myHostLinks.locations is current.
      vPrint( appState, "Column rename handled at start of todo processing" );
      dynamo.add( updateColumnName( context, container, pact.subject ) );
      // This has the potential to impact any future operation on peqs.  Rather than look for each, wait for all.
      vPrint( appState, "Waiting on column name update in dynamo" );
      await Future.wait( dynamo );
      dynamo.clear();
      return; 
   }
   else if( pact.note == "Project rename" ) {    // XXX formalize this
      // These arrive as viable pact, and -1 as peq.  Pact subject is [ projId, oldName, newName ]
      // ceServer handles locs in dynamo.  myHostLinks.locations is current.
      vPrint( appState, "Project rename handled at start of todo processing" );
      dynamo.add( updateProjectName( context, container, pact.subject ) );
      // This has the potential to impact any future operation on peqs.  Rather than look for each, wait for all.
      vPrint( appState, "Waiting on project name update in dynamo" );
      await Future.wait( dynamo );
      dynamo.clear();
      return;
   }

   var postData = {};
   postData['PEQId']          = peq.id;
   postData['HostHolderId']   = listEq( newAssign, ["Unassigned"] ) ? [] : newAssign;
   postData['Amount']         = ( newShareAmount * newAssign.length ).toInt();
   postData['HostIssueTitle'] = newTitle;

   if( !listEq( postData['HostHolderId'], peq.hostHolderId )) { vPrint( appState, "_change changing assignees to "   + postData['HostHolderId'].toString() ); }
   if( postData['Amount']         != peq.amount )             { vPrint( appState, "_change changing amount to "      + postData['Amount'].toString() ); }
   if( postData['HostIssueTitle'] != peq.hostIssueTitle )     { vPrint( appState, "_change changing title to "       + postData['HostIssueTitle'] ); }
   
   var pd = { "Endpoint": "UpdatePEQ", "pLink": postData }; 
   await checkPendingUpdates( appState, dynamo, peq.id );
   dynamo.add( updateDynamo( context, container, json.encode( pd ), "UpdatePEQ", peqId: peq.id ));
   
}

void _notice( appState ) {
   vPrint( appState, "Notice actions are no-ops" );
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

// XXX reverse index by peqId would save a lot of lookups
// XXX need to be updating PEQ in AWS after processing!  Ouch... slow, but could speed it up..
// XXX Hmm.. why is "allocated" treated differently than "planned", "proposed" and "accrued" ?  that's why the length sort.
//     Fix this before timestamp sort.  also interacts with adjustSummaryAlloc
// XXX this may need updating if allow 1:many ce/host association.  maybe limit ce login to 1:1 - pick before see stuff.
// Assignees use host names instead of ce ids - user comfort

// ---------------
// ceServer will...
//    not modify PAct after issuing it.
//    not modify peq.peqType, peq.id after initial creation
//    not modify peq.amount after initial creation
//    modify peq.HostProjectSub after first relo from unclaimed to initial home
//    set assignees only if issue existed before it was PEQ (pacts wont see this assignment)
// ---------------
Future processPEQAction( Tuple2<PEQAction, PEQ> tup, List<Future> dynamo, context, container, pending ) async {

   PEQAction pact = tup.item1;
   PEQ       peq  = tup.item2;
 
   final appState = container.state;
   vPrint( appState, "\n-------------------------------" );
   print( "processing " + enumToStr(pact.verb) + " " + enumToStr(pact.action) + ", " + enumToStr(peq.peqType) + " for " + peq.amount.toString() + ", " + peq.hostIssueTitle );

   vPrint( appState, pact.toString() );
   vPrint( appState, peq.toString() );

   List<Allocation> appAllocs = appState.myPEQSummary.allocations;

   // is PEQ already a Known Alloc?  Always use it when possible - is the most accurate current view during ingest.
   // remember, issue:card is 1:1.  1 allocation is proj/{proj}/column/assignee with a set of member peqId:peqValues
   // peq.projsub? unclaimed, or updated to reflect first home outside unclaimed.  only.
   // peq.hostUser?  empty, or reflects only issues assigned before becoming peq.  
   // peq.amount?  full initial peq amount for the issue, independent of number of assignees.  assigneeShares are identical per assignee per issue.
   List<String> assignees = [];

   // Note: assignees will always be hostUserId in PEQ.  they may arrive as hostUserName .. convert as need be
   Allocation? ka         = null;
   for( Allocation alloc in appAllocs.where( (a) => ( a.sourcePeq != null ) && a.sourcePeq!.containsKey( peq.id ) )) {
      if( alloc.hostUserId != "" ) { assignees.add( alloc.hostUserId );  }
      ka = alloc;
   }
   if( ka == null ) {
      bool nonPeqChange = pact.action == PActAction.change && ( pact.note == "Column rename" || pact.note == "Project rename" );
      bool peqChange    = pact.action == PActAction.add || pact.action == PActAction.delete || pact.action == PActAction.notice;
      assert( pact.verb == PActVerb.confirm && ( nonPeqChange || peqChange ));
      assignees = peq.hostHolderId;
      if( assignees.length == 0 ) { assignees = [ "Unassigned" ]; }  // XXX Formalize
      else {
         List<String> hids = [];
         assignees.forEach( (a) { hids.add( _convertNameToId( appState, a ) ); });
         assignees = hids;
      }
   }

   assert( ka == null || ka.categoryBase       != null );
   assert( ka == null || ka.sourcePeq          != null );
   assert( ka == null || ka.sourcePeq![peq.id] != null );
   
   List<String> subBase = ka == null ? peq.hostProjectSub                        : ka.categoryBase!; 
   int assigneeShare    = ka == null ? (peq.amount / assignees.length).floor() : ka.sourcePeq![ peq.id ]!;
   
   // XXX switch
   // propose accrue == pending.   confirm accrue == grant.  others are plan.  end?
   if     ( pact.action == PActAction.accrue )                                    { await _accrue( context, container, pact, peq, dynamo, assignees, assigneeShare, ka, subBase ); }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.delete )   { _delete(           appState, pact, peq, dynamo, assignees, assigneeShare, ka      ); }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.add )      { await _add(    context, container, pact, peq, dynamo, assignees, assigneeShare, subBase ); }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.relocate ) { await _relo(   context, container, pact, peq, dynamo, assignees, assigneeShare, ka, pending, subBase ); }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.change )   { await _change( context, container, pact, peq, dynamo, assignees, assigneeShare, ka, pending ); }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.notice )   { _notice( appState ); }
   else { notYetImplemented( context ); }

   // NOTE: only leaf allocs have PID - is only set during relocation.
   // NOTE: situated accrued card 1st - YES peq should exist as unclaimed:accrued.  it has been deleted elsewhere.
   //       furthermore, trip begins and ends as unclaimed:accr, which is good.  in the middle it replicates the journey, which is fine.
   // NOTE: in all cases, if ingest is halted in the middle, it should be accurate as of last todo, just not necessarily up to date.
   if( subBase.length > 0 ) {  // notices have no subs
      vPrint( appState, "current allocs" );
      for( var alloc in appAllocs ) {
         // if( subBase[0] == alloc.category[0] ) { print( alloc.category.toString() + " " + alloc.amount.toString() + " " + alloc.sourcePeq.toString() ); }
         // print( alloc.hostProjectId + " " + alloc.category.toString() + " " + alloc.amount.toString() + " " + alloc.sourcePeq.toString() );
         vPrint( appState, alloc.category.toString() + " " + alloc.amount.toString() + " " + alloc.sourcePeq.toString() );
      }
   }
}


// XXX Note.  locking is sticky.
// XXX sort by timestamp
// Record all PEQ actions:add, delete, accrue, relocate, change, notice
// Examples of useful actions without associated PEQ
//   change:'Column rename'
//   change:'Project rename'
//   change:'Column rename attempted'
//   notice:'PEQ label delete attempt'
//   notice:'PEQ label edit attempt'

Future<void> updatePEQAllocations( repoName, context, container ) async {
   final appState  = container.state;
   final ceProjId  = appState.selectedCEProject;
   vPrint( appState, "Updating allocations for ceProjectId: " + ceProjId );

   // First, update myHostLinks.locs, since ceFlutter may have been sitting in memory long enough to be out of date.
   vPrint( appState, "Start myLoc update" );
   Future myLocs = fetchHostLinkage( context, container, { "Endpoint": "GetEntry", "tableName": "CELinkage", "query": { "CEProjectId": "$ceProjId" }} );
   
   vPrint( appState, "Start pact update" );
   final todoPActions = await lockFetchPActions( context, container, '{ "Endpoint": "GetUnPAct", "CEProjectId": "$ceProjId" }' );

   if( todoPActions.length == 0 ) { return; }

   List<String> pactIds = [];
   List<String> peqIds = [];

   vPrint( appState, "Building peqPActs" );
   // Build pact peq pairs for active 'todo' PActions.  First, need to get ids where available
   for( var pact in todoPActions ) {
      print( pact.toString() );
      assert( !pact.ingested );
      pactIds.add( pact.id );
      // Note: not all in peqIds are valid peqIds, even with non-zero subject
      pact.subject.length > 0 ? peqIds.add( pact.subject[0] ) : peqIds.add( "-1" );  
   }

   // XXX Could preprocess peqIds to cut aws workload.. remove dups, bad peqs, etc.

   // This returns in order of request, including duplicates
   String PeqIds = json.encode( peqIds );
   List<PEQ> todoPeqs = await fetchPEQs( context, container,'{ "Endpoint": "GetPEQsById", "PeqIds": $PeqIds }' );
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

   // XXX Probably want another pass to stack up all updateCEUIDs.  Most can lay ontop of one another.
   vPrint( appState, "Will now process " + todoPActions.length.toString() + " pactions for " + foundPeqs.toString() + " non-unique peqs." );
   var i = 0;
   for( var tup in todos ) {
      final pa = tup.item1;
      final pp = tup.item2;
      vPrint( appState, i.toString() + "   " + pa.timeStamp.toString() + " <pact,peq> " + pa.id + " " + pp.id + " " + enumToStr(pa.verb) + " " + enumToStr(pa.action) + " " + pa.note + " " + pa.subject.toString());
      i++;
   }

   vPrint( appState, "Pre order fix " + todos.length.toString());

   await fixOutOfOrder( todos, context, container );

   vPrint( appState, "Complete myLoc update " + todos.length.toString());
   appState.myHostLinks  = await myLocs;
   if( appState.myHostLinks == null ) { return; }
   
   await updateHostNames( todos, appState );

   List<Future> dynamo = [];
   var pending = {};

   List<Future> ceuid = [];
   vPrint( appState, "Updating CE UIDs" );
   for( var tup in todos ) {
      // Wait here, else summary may be inaccurate
      ceuid.add( updateCEUID( appState, tup, context, container ) );
   }
   await Future.wait( ceuid );
   vPrint( appState, "... done (ceuid)" );

   // Create, if need to
   if( appState.myPEQSummary == null && todos.length > 0) {
      String pid = randAlpha(10);
      vPrint( appState, "Create new appstate PSum " + pid + "\n" );
      appState.myPEQSummary = new PEQSummary( id: pid, ceProjectId: todos[0].item2.ceProjectId,
                                              targetType: "repo", targetId: todos[0].item2.hostRepoId, lastMod: getToday(), allocations: [] );
   }
   
   appState.ingestUpdates.clear();
   for( var tup in todos ) {
      await processPEQAction( tup, dynamo, context, container, pending );
   }
   vPrint( appState, "Finishing updating Dynamo..." );
   await Future.wait( dynamo );
   vPrint( appState, "... done (dynamo)" );

   
   print( "Ingest todos finished processing.  Update Dynamo." );
   // XXX Skip this if no change (say, on a series of notices).
   if( appState.myPEQSummary != null ) {
      appState.myPEQSummary.lastMod = getToday();
      String psum = json.encode( appState.myPEQSummary );
      String postData = '{ "Endpoint": "PutPSum", "NewPSum": $psum }';
      await updateDynamo( context, container, postData, "PutPSum" );
   }

   // unlock, set ingested
   if( pactIds.length > 0 ) {
      String newPIDs = json.encode( pactIds );
      final status = await updateDynamo( context, container,'{ "Endpoint": "UpdatePAct", "PactIds": $newPIDs }', "UpdatePAct" );
   }

}

