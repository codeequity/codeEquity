import 'dart:convert';  // json encode/decode
import 'dart:async';
import 'dart:typed_data';

import 'package:fluttertoast/fluttertoast.dart';
import 'package:random_string/random_string.dart';
import 'package:tuple/tuple.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';

import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/PEQAction.dart';
import 'package:ceFlutter/models/PEQSummary.dart';
import 'package:ceFlutter/models/allocation.dart';
import 'package:ceFlutter/models/ghLoc.dart';


// XXX associateGithub has to update appState.idMapGH
// PActions, PEQs are added by webServer, which does not have access to ceUID.
// set CEUID by matching my peqAction:ghUserName  or peq:ghUserNames to cegithub:ghUsername, then writing that CEOwnerId
// if there is not yet a corresponding ceUID, use "GHUSER: $ghUserName" in it's place, to be fixed later by associateGitub XXX (done?)
// NOTE: Expect multiple PActs for each PEQ.  For example, open, close, and accrue
Future<void> updateCEUID( appState, PEQAction pact, PEQ peq, context, container ) async {
   print( pact );
   print( peq );
   assert( pact.ceUID == EMPTY );
   String ghu  = pact.ghUserName;
   if( !appState.idMapGH.containsKey( ghu )) {
      appState.idMapGH[ ghu ] = await fetchString( context, container, '{ "Endpoint": "GetCEUID", "GHUserName": "$ghu" }', "GetCEUID" );
   }
   String ceu = appState.idMapGH[ ghu ];
   
   if( ceu != "" ) {
      // Don't await here, CEUID not used during processPEQ
      updateDynamo( context, container, '{ "Endpoint": "putPActCEUID", "CEUID": "$ceu", "PEQActionId": "${pact.id}" }', "putPActCEUID" );
   }

   // PEQ holder may have been set via earlier PAct.  But here, may be adding or removing CEUIDs
   peq.ceHolderId = new List<String>();
   for( var peqGHUser in peq.ghHolderId ) {
      if( !appState.idMapGH.containsKey( peqGHUser )) {
         appState.idMapGH[ peqGHUser ] = await fetchString( context, container, '{ "Endpoint": "GetCEUID", "GHUserName": "$peqGHUser" }', "GetCEUID" );
      }
      String ceUID = appState.idMapGH[ peqGHUser ];
      if( ceUID == "" ) { ceUID = "GHUSER: " + peqGHUser; }
      peq.ceHolderId.add( ceUID );
   }

   // 0 length is ok, when unassigned.
   String ceGrantor = EMPTY;
   // XXX ??? should grantor be CE or GH id?  Maybe depends on ability to permission prot a project column
   if( pact.action == PActAction.accrue && pact.verb == PActVerb.confirm ) {  ceGrantor = ghu;   }
   

   // Update PEQ, if there is one.
   if( peq.id != "-1" ) {
      var postData = {};
      postData['PEQId']       = peq.id;
      postData['CEHolderId']  = peq.ceHolderId;
      postData['CEGrantorId'] = ceGrantor;
      var pd = { "Endpoint": "UpdatePEQ", "pLink": postData }; 
      
      // print( "Start update peq" );
      print( postData );
      // Do await, processPEQs needs holders
      await updateDynamo( context, container, json.encode( pd ), "UpdatePEQ" );
      // print( "Finish update peq" );
   }
}

// XXX may be able to kill categoryBase

// One allocation per category.. i.e. project:column:pallocCat or project:column:assignee.  Could also be project:project is first is the master proj
void adjustSummaryAlloc( appState, peqId, List<String> cat, String subCat, splitAmount, PeqType peqType, {Allocation source = null} ) {
   
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
   
   print( "Adjust summary allocation " + suba.toString() );
   
   // Update, if already in place
   for( var alloc in appState.myPEQSummary.allocations ) {
      if( suba.toString() == alloc.category.toString() ) {
         // print( " ... matched category: " + suba.toString()  );
         alloc.amount = alloc.amount + splitAmount;
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
   print( " ... adding new Allocation" );
   Allocation alloc = new Allocation( category: suba, categoryBase: catBase, amount: splitAmount, sourcePeq: {peqId: splitAmount}, allocType: peqType,
                                      ceUID: EMPTY, ghUserName: assignee, vestedPerc: 0.0, notes: "" );
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
// 
// Need to have seen a 'confirm' 'add' before another action, in order for the allocation to be in a good state.
// This will either occur in current ingest batch, or is already present in mySummary from a previous update.
// Remember, all peqs are already in aws, either active or inactive, so no point to look there.
// XXX really need to save some of this work.
// XXX hashmap would probably speed this up a fair amount
void fixOutOfOrder( List<Tuple2<PEQAction, PEQ>> todos, context, container ) async {

   final appState           = container.state;
   List<String>    kp       = []; // known peqs 
   Map<String,List<int>> dp = {}; // demoted peq: list of positions in todos   

   // build kp from mySummary.  Only active peqs are part of allocations.
   if( appState.myPEQSummary != null ) {
      for( Allocation alloc in appState.myPEQSummary.allocations ) { kp = kp + alloc.sourcePeq.keys; }
      kp = kp.toSet().toList();  // if this way to remove duplicates turns out to be slow, use hashmap
   }

   print( "Initial known peq-allocs: " + kp.toString() );

   // look through current ingest batch for issues to resolve.
   for( int i = 0; i < todos.length; i++ ) {
      PEQAction pact = todos[i].item1;
      PEQ       peq  = todos[i].item2;

      print( i.toString() + ": Working on " + peq.ghIssueTitle + ": " + peq.id );

      if( peq.id == "-1" ) { continue; }
      bool deleted = false;
      
      // print( pact );
      // print( peq );
      
      // update kp
      if( pact.verb == PActVerb.confirm && pact.action == PActAction.add ) {
         assert( !kp.contains( peq.id ) );
         kp.add( peq.id );
         print( "   Adding known peq " + peq.ghIssueTitle + " " + peq.id );
      }
      else if( pact.verb == PActVerb.confirm && pact.action == PActAction.delete ) {
         assert( kp.contains( peq.id ) );
         kp.remove( peq.id );
         deleted = true;
         print( "   Removing known peq " + peq.ghIssueTitle + " " + peq.id + " " + peq.active.toString());
      }

      // print( "    KP: " + kp.toString() );
      
      // update demotion status.
      // Undemote if have demoted from earlier, and just saw confirm add.  If so, swap all down one.
      if( dp.containsKey( peq.id ) && kp.contains( peq.id ) ) {
         assert( dp[peq.id].length > 0 );
         dp[peq.id].sort();

         // sort is lowest to highest.  Keep swapping current todo up the chain in reverse order, has the effect of pushing all down.
         int confirmAdd = i;
         for( int j = dp[peq.id].length-1; j >= 0; j-- ) {
            print( "   moving todo at position:" + confirmAdd.toString() + " to position:" + dp[peq.id][j].toString() );
            swap( todos, dp[peq.id][j], confirmAdd );
            confirmAdd = j;
         }

         dp.remove( peq.id );
         print( "   peq: " + peq.ghIssueTitle + " " + peq.id + " UN-demoted." );
      }
      // demote if needed
      else if( !kp.contains( peq.id ) && !deleted ) {
         if( !dp.containsKey( peq.id ) ) { dp[peq.id] = []; }
         dp[peq.id].add( i );  
         print( "   demoting peq: " + peq.ghIssueTitle + " " + peq.id );
      }

   }
}



void _accrue( appState, PEQAction pact, PEQ peq, List<String> assignees, int assigneeShare, List<String> subBase ) {
   // Once see action accrue, should have already seen peqType.pending
   print( "Accrue PAct " + enumToStr( pact.action ) + " " + enumToStr( pact.verb ));
   
   if( assignees.length == 1 && assignees[0] == "Unassigned" ) {
      print( "WARNING.  Must have assignees in order to accrue!" );
      return;
   }
   
   List<String> subProp = new List<String>.from( subBase ); subProp.last = "Pending";
   List<String> subDest = new List<String>.from( subBase ); subDest.add( pact.subject.last ); 
   List<String> subAccr = new List<String>.from( subBase ); subAccr.last = "Accrued";
   
   // iterate over assignees
   for( var assignee in assignees ) {
      print( "\n Assignee: " + assignee );
      
      String newType = "";
      if( pact.verb == PActVerb.propose ) {
         // add propose, rem plan
         adjustSummaryAlloc( appState, peq.id, subProp, assignee, assigneeShare, PeqType.pending ); 
         adjustSummaryAlloc( appState, peq.id, subBase, assignee, -1 * assigneeShare, PeqType.plan );
         newType = enumToStr( PeqType.pending );
      }
      else if( pact.verb == PActVerb.reject ) {
         // rem propose, add plan
         adjustSummaryAlloc( appState, peq.id, subProp, assignee, -1 * assigneeShare, PeqType.pending );
         adjustSummaryAlloc( appState, peq.id, subDest, assignee, assigneeShare, PeqType.plan); 
         newType = enumToStr( PeqType.plan );
      }
      else if( pact.verb == PActVerb.confirm ) {
         // rem propose, add accrue
         adjustSummaryAlloc( appState, peq.id, subProp, assignee, -1 * assigneeShare, PeqType.pending );
         adjustSummaryAlloc( appState, peq.id, subAccr, assignee,  assigneeShare, PeqType.grant );
         newType = enumToStr( PeqType.grant );
      }
      else {
         print( "Unrecognized verb " + enumToStr( pact.verb ) );
         assert( false );
      }
      
      /*
        var postData = {};
        postData['PEQId']    = peq.id;
        postData['PeqType']  = newType;
        var pd = { "Endpoint": "UpdatePEQ", "pLink": postData }; 
        await updateDynamo( context, container, json.encode( pd ), "UpdatePEQ" );
      */
   }
}

void _delete( appState, pact, peq, assignees, assigneeShare, ka ) {
   // This can be called as part of a transfer out, in which this is a no-op.
   if( ka != null ) {
      if( pact.note != "Transfer out" ) {  // XXX formalize
         if( ka.allocType == PeqType.allocation ) {
            print( "\n Delete allocation: " + ka.category.toString() );
            adjustSummaryAlloc( appState, peq.id, ka.categoryBase, ka.category.last, assigneeShare, PeqType.allocation );
         }
         else {
            for( var assignee in assignees ) {
               print( "\n Delete: " + ka.category.toString() + " " + assignee );
               adjustSummaryAlloc( appState, peq.id, ka.category, assignee, assigneeShare, ka.allocType );
            }
         }
      }
   }
}

void _add( appState, pact, peq, assignees, assigneeShare, subBase ) {
   // When adding, will only see peqType alloc or plan
   if( peq.peqType == PeqType.allocation ) {
      // Note.. title will be set to future value here. Will create redundant 'change' in future ingest item
      String pt = peq.ghIssueTitle;
      adjustSummaryAlloc( appState, peq.id, peq.ghProjectSub, pt, peq.amount, PeqType.allocation ); 
   }
   else if( peq.peqType == PeqType.plan ) {
      print( "Plan PEQ" );

      /* XXX
      var loc = appState.myGHLinks.locations.firstWhere( (a) => a.ghProjectName == subBase.last, orElse: () => null );
      List<String> subPlan = new List<String>.from( subBase );
      
      // If last portion of sub cat is a project, then we are not in a flat project.
      if( loc != null && subBase.last != "UnClaimed" ) { subPlan.add( "Planned" ); }    // XXX formalize
      */
      
      // iterate over assignees
      for( var assignee in assignees ) {
         print( "\n Assignee: " + assignee );
         adjustSummaryAlloc( appState, peq.id, subBase, assignee, assigneeShare, PeqType.plan );
      }
   }
   else {
      print( "Error.  Action add on peqType of " + peq.peqType.toString() );
      notYetImplemented( context );
   }
}


// Note.  The only cross-project moves allowed are from unclaimed: to a new home.  This move is programmatic via ceServer.
void _relo( appState, pact, peq, assignees, assigneeShare, ka, subBase ) {

   List<Allocation> appAllocs = appState.myPEQSummary.allocations;
   
   // Delete only.
   if( pact.note == "Transfer out" ) {  // XXX formalize
      print( "Transfer out of repository" );
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
         List<Allocation> reloAlloc = [];  // category, ghUserName, allocType
         
         // avoid concurrent mod of list
         for( Allocation sourceAlloc in appAllocs.where( (a) => a.sourcePeq.containsKey( peq.id ) )) {
            Allocation miniAlloc = new Allocation( category: sourceAlloc.category, allocType: sourceAlloc.allocType, ghUserName: sourceAlloc.ghUserName );
            reloAlloc.add( miniAlloc );
         }
         
         for( var remAlloc in reloAlloc ) {
            assert( assignees.contains( remAlloc.ghUserName ));
            print( "\n Assignee: " + remAlloc.ghUserName );
            adjustSummaryAlloc( appState, peq.id, [], EMPTY, -1 * assigneeShare, remAlloc.allocType, source: remAlloc );
         }
      }
      
   }
   else {
      print( "Relo PEQ" );
      
      Allocation sourceAlloc = ka != null ? ka : -1;
      assert( sourceAlloc != -1 );
      assert( sourceAlloc.category.length >= 1 );
      
      // Get name of new column home
      assert( pact.subject.length == 3 );
      var loc = appState.myGHLinks.locations.firstWhere( (a) => a.ghProjectId == pact.subject[1] && a.ghColumnId == pact.subject[2], orElse: () => null );
      assert( loc != null );
      
      // peq.psub IS the correct initial home if unclaimed, and right after the end of unclaimed residence.  Column is correct afterwards.
      // So, (if no existing alloc, use psub - can't happen).  If alloc.cat is not unclaimed, use column (only moves within proj).
      // If alloc.cat is unclaimed, ceServer will move across projects.  use psub.   Test col.  Will be stable even with multiple relos, since
      // psub is only overwritten the first time after unclaimed is claimed.
      // pallocs do not have assignees
      if( sourceAlloc.allocType == PeqType.allocation ) {
         // Remove it
         adjustSummaryAlloc( appState, peq.id, [], EMPTY, -1 * assigneeShare, sourceAlloc.allocType, source: sourceAlloc );
         
         print( "  .. relocating to " + loc.toString() );
         
         if( sourceAlloc.category[0] == "Unclaimed" ) {   // XXX formalize
            adjustSummaryAlloc( appState, peq.id, peq.ghProjectSub, peq.ghIssueTitle, assigneeShare, sourceAlloc.allocType ); 
         }
         else {
            // Have at least proj, col, title.
            assert( sourceAlloc.category.length >= 2 );
            List<String> suba = new List<String>.from( sourceAlloc.category.sublist(0, sourceAlloc.category.length-2) );
            suba.add( loc.ghColumnName );
            adjustSummaryAlloc( appState, peq.id, suba, sourceAlloc.category.last, assigneeShare, sourceAlloc.allocType ); 
         }
      }
      else
      {
         // Exactly one alloc per peq.id,assignee pair
         List<Allocation> reloAlloc = [];  // category, ghUserName, allocType
         
         // avoid concurrent mod of list
         for( Allocation sourceAlloc in appAllocs.where( (a) => a.sourcePeq.containsKey( peq.id ) )) {
            Allocation miniAlloc = new Allocation( category: sourceAlloc.category, allocType: sourceAlloc.allocType, ghUserName: sourceAlloc.ghUserName );
            reloAlloc.add( miniAlloc );
         }
         
         for( var remAlloc in reloAlloc ) {
            assert( assignees.contains( remAlloc.ghUserName ));
            print( "\n Assignee: " + remAlloc.ghUserName );
            adjustSummaryAlloc( appState, peq.id, [], EMPTY, -1 * assigneeShare, remAlloc.allocType, source: remAlloc );
            
            print( "  .. relocating to " + loc.toString() );
            adjustSummaryAlloc( appState, peq.id, subBase + [loc.ghColumnName], remAlloc.ghUserName, assigneeShare, remAlloc.allocType );
         }
      }
   }
}   
   
// Note: peq.ghHolder will only inform us of the latest status, not all the changes in the middle.
//      Ingest needs to track all the changes in the middle 
void _change( appState, pact, peq, assignees, assigneeShare, ka ) {
   assert( ka != null );
   assert( ka.allocType != PeqType.allocation );
      
   if( pact.note == "add assignee" ) {    // XXX formalize this
      print( "Add assignee: " + pact.subject.last );
      
      var curAssign  = [ pact.subject.last ];
      // Count the current assignees != unassigned.  readjust assigneeShare.  Ignore duplicate adds (blast).
      for( String assign in assignees ) {
         if( assign != "Unassigned" && !curAssign.contains( assign ) ) { curAssign.add( assign ); }   // XXX formalize this            
      }
      
      var sourceType     = ka.allocType;
      var baseCat        = ka.category.sublist( 0, ka.category.length-1 );
      var curSplitAmount = ( assigneeShare * assignees.length / curAssign.length ).floor();  
      
      // Remove all old, add all current with new assigneeShares
      for( var assign in assignees ) {
         print( "Remove " + baseCat.toString() + " " + assign + " " + assigneeShare.toString() );
         adjustSummaryAlloc( appState, peq.id, baseCat, assign, -1 * assigneeShare, sourceType );
      }
      for( var assign in curAssign ) {
         print( "Add " + assign + " " + curSplitAmount.toString() );
         adjustSummaryAlloc( appState, peq.id, baseCat, assign, curSplitAmount, sourceType );
      }
   }
   else if( pact.note == "remove assignee" ) {    // XXX formalize this
      print( "Remove assignee: " + pact.subject.last );
      
      int originalSize = assignees.length;
      
      assert( assignees.contains( pact.subject.last ));
      
      var sourceType = ka.allocType;
      var baseCat    = ka.category.sublist( 0, ka.category.length-1 );
      
      // Remove all old allocs
      for( var assign in assignees ) {
         print( "Remove " + baseCat.toString() + " " + assign + " " + assigneeShare.toString() );
         adjustSummaryAlloc( appState, peq.id, baseCat, assign, -1 * assigneeShare, sourceType );
      }
      
      // Remove, then readjust assigneeShare
      assignees.remove( pact.subject.last );
      if( assignees.length == 0 ) { assignees.add( "Unassigned" ); }// XXX formalize this
      
      var curSplitAmount = ( assigneeShare * originalSize / assignees.length ).floor();  
      
      for( var assign in assignees ) {
         print( "Add " + assign + " " + curSplitAmount.toString() );
         adjustSummaryAlloc( appState, peq.id, baseCat, assign, curSplitAmount, sourceType );
      }
   }
   else if( pact.note == "peq val update" ) { // XXX formalize this
      print( "Peq val update, new val: ", pact.subject.last.toString() );
      
      var baseCat    = ka.category.sublist( 0, ka.category.length-1 );
      
      // Remove all old allocs
      for( var assign in assignees ) {
         print( "Remove " + baseCat.toString() + " " + assign + " " + assigneeShare.toString() );
         adjustSummaryAlloc( appState, peq.id, baseCat, assign, -1 * assigneeShare, sourceType );
      }
      
      var curSplitAmount = ( pact.subject.last / assignees.length ).floor();  
      
      for( var assign in assignees ) {
         print( "Add " + assign + " " + curSplitAmount.toString() );
         adjustSummaryAlloc( appState, peq.id, baseCat, assign, curSplitAmount, sourceType );
      }
      
   }
}


/* -----------------------
Ingest process
The incoming PAct is all current information.
The incoming PEQ is a combination of future information (assignees, values) with old information (type).
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
                 location in GH: dataSec:planned

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
// XXX this may need updating if allow 1:many ce/gh association.  maybe limit ce login to 1:1 - pick before see stuff.
// Assignees use gh names instead of ce ids - user comfort

// ---------------
// ceServer will...
//    not modify PAct after issuing it.
//    not modify peq.peqType, peq.id after initial creation
//    not modify peq.amount after initial creation
//    modify peq.GHProjectSub after first relo from unclaimed to initial home
//    set assignees only if issue existed before it was PEQ (pacts wont see this assignment)
// ---------------
void processPEQAction( PEQAction pact, PEQ peq, context, container ) async {
   print( "\n-------------------------------" );
   print( "processing " + enumToStr(pact.verb) + " " + enumToStr(pact.action) + ", " + enumToStr(peq.peqType) + " for " + peq.amount.toString() + ", " + peq.ghIssueTitle );
   final appState = container.state;

   // Wait here, else summary may be inaccurate
   // XXX this could be hugely sped up - batch up front.
   await updateCEUID( appState, pact, peq, context, container );

   // Create, if need to
   if( appState.myPEQSummary == null ) {
      print( "Create new appstate PSum\n" );
      String pid = randomAlpha(10);
      appState.myPEQSummary = new PEQSummary( id: pid, ghRepo: peq.ghRepo,
                                              targetType: "repo", targetId: peq.ghProjectId, lastMod: getToday(), allocations: [] );
   }

   List<Allocation> appAllocs = appState.myPEQSummary.allocations;

   // is PEQ already a Known Alloc?  Always use it when possible - is the most accurate current view during ingest.
   // remember, issue:card is 1:1.  1 allocation is proj/{proj}/column/assignee with a set of member peqId:peqValues
   // peq.projsub? unclaimed, or updated to reflect first home outside unclaimed.  only.
   // peq.ghUser?  empty, or reflects only issues assigned before becoming peq.  
   // peq.amount?  full initial peq amount for the issue, independent of number of assignees.  assigneeShares are identical per assignee per issue.
   List<String> assignees = [];
   Allocation ka          = null;
   for( Allocation alloc in appAllocs.where( (a) => a.sourcePeq.containsKey( peq.id ) )) {
      assignees.add( alloc.ghUserName );
      ka = alloc;
   }
   if( ka == null ) {
      assert( pact.verb == PActVerb.confirm && ( pact.action == PActAction.add || pact.action == PActAction.delete ));
      assignees = peq.ghHolderId;
      if( assignees.length == 0 ) { assignees = [ "Unassigned" ]; }
   }

   List<String> subBase = ka == null ? peq.ghProjectSub                        : ka.categoryBase; 
   int assigneeShare    = ka == null ? (peq.amount / assignees.length).floor() : ka.sourcePeq[ peq.id ];
   

   // propose accrue == pending.   confirm accrue == grant.  others are plan.  end?
   if( pact.action == PActAction.notice ) {
      print( "Peq Action is a notice event: " + pact.subject.toString() );
      print( "updated CEUID if available - no other action needed." );
   }
   else if( pact.action == PActAction.accrue )                                    { _accrue( appState, pact, peq, assignees, assigneeShare, subBase ); }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.delete )   { _delete( appState, pact, peq, assignees, assigneeShare, ka      ); }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.add )      { _add(    appState, pact, peq, assignees, assigneeShare, subBase ); }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.relocate ) { _relo(   appState, pact, peq, assignees, assigneeShare, ka, subBase ); }
   else if( pact.verb == PActVerb.confirm && pact.action == PActAction.change )   { _change( appState, pact, peq, assignees, assigneeShare, ka ); }
   else { notYetImplemented( context ); }

   print( "current allocs" );
   for( var alloc in appAllocs ) {
      if( subBase[0] == alloc.category[0] ) { print( alloc.category.toString() + " " + alloc.amount.toString() + " " + alloc.sourcePeq.toString() ); }
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
   print( "Updating allocations for ghRepo" );

   final appState  = container.state;
   final todoPActions = await lockFetchPActions( context, container, '{ "Endpoint": "GetUnPAct", "GHRepo": "$repoName" }' );

   if( todoPActions.length == 0 ) { return; }

   List<String> pactIds = [];
   List<String> peqIds = [];

   // Build pact peq pairs for active 'todo' PActions.  First, need to get ids where available
   for( var pact in todoPActions ) {
      // print( pact.toString() );
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
   List<Tuple2<PEQAction, PEQ>> todos = new List<Tuple2<PEQAction, PEQ>>();
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
   // todos.sort((a, b) => a.item2.ghProjectSub.length.compareTo(b.item2.ghProjectSub.length));
   todos.sort((a, b) => a.item1.timeStamp.compareTo(b.item1.timeStamp));

   // XXX Probably want another pass to stack up all updateCEUIDs.  Most can lay ontop of one another.
   print( "Will now process " + todoPActions.length.toString() + " pactions for " + foundPeqs.toString() + " non-unique peqs." );
   for( var tup in todos ) {
      final pa = tup.item1;
      final pp = tup.item2;
      print(  "   " + pa.timeStamp.toString() + " <pact,peq> " + pa.id + " " + pp.id + " " + enumToStr(pa.verb) + " " + enumToStr(pa.action) + " " + pa.note + " " + pa.subject.toString());
   }
   await fixOutOfOrder( todos, context, container );
   for( var tup in todos ) {
      await processPEQAction( tup.item1, tup.item2, context, container );
   }

   // XXX Skip this is no change (say, on a series of notices).
   if( appState.myPEQSummary != null ) {
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

