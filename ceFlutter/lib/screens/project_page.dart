import 'dart:convert';  // json encode/decode
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/utils_load.dart';

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/allocation.dart';
import 'package:ceFlutter/models/PEQ.dart';

import 'package:ceFlutter/components/tree.dart';
import 'package:ceFlutter/components/node.dart';
import 'package:ceFlutter/components/leaf.dart';

import 'package:ceFlutter/screens/detail_page.dart';


class CEHomePage extends StatefulWidget {
   CEHomePage({Key key}) : super(key: key);

  @override
  _CEHomeState createState() => _CEHomeState();
}

class _CEHomeState extends State<CEHomePage> {

   var      container;
   AppState appState;
   bool     addGHAcct;
   var      ghPersonalAccessToken;
   TextEditingController pat;
   
   @override
   void initState() {
      print( "HOMEPAGE INIT" );
      super.initState();

      addGHAcct = false;
   }

   @override
   void dispose() {
      super.dispose();
   }


   // XXX Wanted to push first, then update - more responsive.  But setState is only rebuilding homepage, not
   //     detail page..?  
   _pactDetail( ghUserLogin, width, context, container ) {
      final appState = container.state;
      return GestureDetector(
         onTap: () async 
         {
            print( "pactDetail fired for: " + ghUserLogin );
            appState.selectedUser = ghUserLogin;
            appState.userPActUpdate = true;            
            Navigator.push( context, MaterialPageRoute(builder: (context) => CEDetailPage()));
         },
         child: makeTitleText( appState, ghUserLogin, width, false, 1 )
         );
   }

   // XXX this could easily be made iterative
   // Categories: Software Contributions: codeEquity web front end: Planned: unassigned:
   // header      alloc                   sub alloc                 plan
   buildAllocationTree( ) {
      print( "Build allocation tree" );
      final appState  = container.state;
      final width = appState.screenWidth * .6;
      
      appState.allocTree = Node( "Category    Alloc / Plan / Accr", 0, null, width, true );

      if( appState.myPEQSummary == null ) {
               appState.updateAllocTree = false;
               return;
      }
      
      for( var alloc in appState.myPEQSummary.allocations ) {
         
         Tree curNode = appState.allocTree;
         
         // when allocs are created, they are leaves.
         // down the road, they become nodes
         for( int i = 0; i < alloc.category.length; i++ ) {
            
            print( "working on " + alloc.category.toString() + " : " + alloc.category[i] );
            
            bool lastCat = false;
            if( i == alloc.category.length - 1 ) { lastCat = true; }
            Tree childNode = curNode.findNode( alloc.category[i] );
            
            if( childNode is Leaf && !lastCat ) {
               // allocation leaf, convert to a node to accomodate plan/accrue
               print( "... leaf in middle - convert" );
               curNode = (curNode as Node).convertToNode( childNode );
            }
            else if( childNode == null ) {
               if( !lastCat ) {
                  print( "... nothing - add node" );
                  Node tmpNode = Node( alloc.category[i], 0, null, width );
                  (curNode as Node).addLeaf( tmpNode );
                  curNode = tmpNode;
               }
               else {
                  print( "... nothing found, last cat, add leaf" );
                  // leaf.  amounts stay at leaves

                  int allocAmount  = ( alloc.allocType == PeqType.allocation ? alloc.amount : 0 );
                  int planAmount   = ( alloc.allocType == PeqType.plan       ? alloc.amount : 0 );
                  int pendAmount   = ( alloc.allocType == PeqType.pending    ? alloc.amount : 0 );
                  int accrueAmount = ( alloc.allocType == PeqType.grant      ? alloc.amount : 0 );
                  Widget details = _pactDetail( alloc.category[i], width, context, container );
                  Leaf tmpLeaf = Leaf( alloc.category[i], allocAmount, planAmount, pendAmount, accrueAmount, null, width, details ); 
                  (curNode as Node).addLeaf( tmpLeaf );
               }
            }
            else if( childNode is Node ) {
               if( !lastCat ) {
                  print( "... found - move on" );
                  curNode = childNode;
               }
               else {
                  print( "... alloc adding into existing chain" );
                  assert( alloc.allocType == PeqType.allocation );
                  (childNode as Node).addAlloc( alloc.amount );
               }
            }
            else {
               print( "XXXXXXXXXXXXXXXX BAD" );
               print( "XXXXXXXXXXXXXXXX BOOBOO" );
               print( "XXXXXXXXXXXXXXXX BABY" );
            }
         }
      }
      appState.updateAllocTree = false;
      // print( appState.allocTree.toStr() );
   }

   
   // XXX consider making peqSummary a list in appState
   List<Widget> _showPAlloc( repo ) {

      List<Widget> allocList = [];

      if( appState.updateAllocTree ) { buildAllocationTree(); }
      
      if( appState.peqUpdated && appState.myPEQSummary != null )
      {
         if( appState.myPEQSummary.ghRepo == repo ) {
            if( appState.myPEQSummary.allocations.length == 0 ) { return []; }
            print( "_showPalloc Update alloc" );
            allocList.add( appState.allocTree );
         }
      }
      else { return []; }
      
      return allocList;
   }
   
   
   Future<void> _updateConfirmed( String repoName ) async {
      appState.peqUpdated = false;
      
      await updatePEQAllocations( repoName, context, container );
      buildAllocationTree();
      
      // XXX local, or app-wide?  app for now
      setState(() { appState.peqUpdated = true; });
      
      Navigator.of( context ).pop(); 
   }
   
   void _updateRejected() {
      print( "not updated" );
      Navigator.of( context ).pop(); 
   }
   
   
   // This GD opens and closes peqSummary.
   Widget _makeRepoChunk( String repoName ) {
      final textWidth = appState.screenWidth * .4;
      return GestureDetector(
         onTap: ()
         {
            appState.selectedRepo = repoName;
            confirm( context, "Update Summary?", "Press Continue to proceed.", () => _updateConfirmed( repoName ), () => _updateRejected() );
         },
         child: makeTitleText( appState, repoName, textWidth, false, 1 )
         );
   }
   
   // XXX Need to add visual cue if repos run out of room, can be hard to tell it's scrollable
   List<Widget> _makeRepos( gha ) {
      final textWidth = appState.screenWidth * .2;
      List<Widget> repoChunks = [];
      repoChunks.add( makeTitleText( appState, gha.ghUserName, textWidth, false, 1 ) );
      gha.repos.forEach((repo) {
            repoChunks.add( _makeRepoChunk( repo ));
            repoChunks.addAll( _showPAlloc(repo ) );
         });
      return repoChunks;
   }
   
   Widget _showGHAccts( ) {
      List<Widget> acctList = [];
      
      if( appState.myGHAccounts != null || appState.ghUpdated ) {
         for( final gha in appState.myGHAccounts ) {
            acctList.addAll( _makeRepos( gha ));
            acctList.add( makeHDivider( appState.screenWidth * .8, 0.0, appState.screenWidth * .1 ));
         }
         
         appState.ghUpdated = false;
         
         return ConstrainedBox( 
            constraints: new BoxConstraints(
               minHeight: 20.0,
               minWidth: 20.0,
               maxHeight: appState.screenHeight * .85,
               maxWidth:  appState.screenWidth * .8
               ),
            child: ListView(
               scrollDirection: Axis.vertical,
               children: acctList
               ));
      }
      else { 
         return CircularProgressIndicator();
      }
   }
   
   
   Widget _ghAssociateButton() {
      return makeActionButtonSmall(
         appState,
         "Enable Github access",
         () async
         {
            bool associated = await associateGithub( context, container, pat.text );
            if( associated ) {
               setState(() { addGHAcct = false; });                 
            }
            
         });
   }
   
   Widget _addGHAcct() {
      return makeActionButtonSmall(
         appState,
         "Add Github account",
         () async
         {
            setState(() {addGHAcct = true; });
         });
   }

   // XXX Col inside col?
   Widget _makeGHZone() {
      final textWidth = appState.screenWidth * .5;
      String ghExplain = "CodeEquity will authenticate your account with Github one time only.";
      ghExplain       += "  You can undo this association at any time.  Click here to generate PAT.";
      
      if( addGHAcct ) {
         return Center(
            child: Row(
               crossAxisAlignment: CrossAxisAlignment.center,
               mainAxisAlignment: MainAxisAlignment.center,
               children: <Widget>[
                  makeTitleText( appState, ghExplain, textWidth, true, 3 ),
                  Expanded( 
                     child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: <Widget>[
                           ghPersonalAccessToken,
                           _ghAssociateButton()
                           ])
                     )
                  ])
            );
      }
      else {
         return Center(
            child: Column(
               crossAxisAlignment: CrossAxisAlignment.start,
               mainAxisAlignment: MainAxisAlignment.start,
               mainAxisSize: MainAxisSize.min,    // required for listView child
               children: <Widget>[
                  
                  // HERE
                  _showGHAccts(),
                  
                  Row(
                     crossAxisAlignment: CrossAxisAlignment.start,
                     mainAxisAlignment: MainAxisAlignment.start,
                     mainAxisSize: MainAxisSize.min, 
                     children: <Widget>[
                        makeTitleText( appState, "Add your githubness here", textWidth, false, 1 ),
                        _addGHAcct()
                        ])
                  ])
            );
      }
      
   }
   
   Widget _makeBody() {
      if( appState.loaded ) {
         
         return Center(
            child: Column(
               crossAxisAlignment: CrossAxisAlignment.start,
               mainAxisAlignment: MainAxisAlignment.start,
               mainAxisSize: MainAxisSize.min,    // required for listView child
               children: <Widget>[
                  SizedBox( height: 5.0),
                  _makeGHZone()
                  ]));
      } else {
         print( "AppState not ? Loaded" );
         return CircularProgressIndicator();
      }
   }
   
   
   @override
      Widget build(BuildContext context) {
      
      container   = AppStateContainer.of(context);
      appState    = container.state;
      
      pat = TextEditingController();
      
      ghPersonalAccessToken = makeInputField( context, "Github Personal Access Token", false, pat );
      
      // ListView horizontal messes with singleChildScroll (to prevent overflow on orientation change). only on this page.
      SystemChrome.setPreferredOrientations([ DeviceOrientation.portraitUp, DeviceOrientation.portraitDown ]);
      

     
     print( "Build Homepage, scaffold x,y: " + appState.screenWidth.toString() + " " + appState.screenHeight.toString() );
     print( getToday() );
     
     return Scaffold(
        appBar: makeTopAppBar( context, "Home" ),
        //bottomNavigationBar: makeBotAppBar( context, "Home" ),
        body: _makeBody()
        );
   }
}
