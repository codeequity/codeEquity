import 'dart:ui';       // pointerKinds
import 'dart:convert';  // json encode/decode

import 'package:collection/collection.dart'; // list eq
import 'package:flutter/foundation.dart';    // setEquals  
import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';
import 'package:ceFlutter/utils/ghUtils.dart';     // to load host peqs for comparison

import 'package:ceFlutter/models/app_state.dart';
import 'package:ceFlutter/models/CEProject.dart';
import 'package:ceFlutter/models/PEQ.dart';

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


class _CEStatusState extends State<CEStatusFrame> {

   late var      container;
   late AppState appState;

   late double frameMinWidth;
   late double svWidth;
   late double svHeight;
   static const frameMinHeight = 300;
   
   late Widget empty;  // XXX formalize
   late Widget gapPad;
   late Widget fatPad;
   late Widget midPad;
   late Widget hdiv;
   late Widget vSpace; 
   
   late bool     peqsLoaded;

   @override
   void initState() {
      super.initState();
      peqsLoaded = false;
   }

   @override
   void dispose() {
      super.dispose();
   }

   void _loadPeqs( CEProject cep ) async {
      if( !peqsLoaded ) {
         await Future.wait([
                              updateCEPeqs( container, context ),           // get all ce peqs for the currently selected CEP
                              updateHostPeqs( container, cep )             // get all host peqs for the currently selected CEP
                              ]);
         
         setState(() => peqsLoaded = true );
      }
   }
   
   // XXX would be interesting to add average latency of last few requests to aws and gh.. small font (43)
   List<List<Widget>> _getHeader( cep ) {
      List<List<Widget>> header = [];

      final width = ( frameMinWidth - 2*appState.FAT_PAD ) / 2.0;
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
      
      String hostStorage   = "Host Data: (" + cep.hostPlatform + ")";
      String hostPeqDetail = planHPeqs.length.toString() + " planned, " + pendHPeqs.length.toString() + " pending, " + accrHPeqs.length.toString() + " accrued.";
      String hostPeqs      = hPeqs.length.toString() + " PEQs: " + hostPeqDetail; 

      Widget t1 = makeTitleText( appState, ceStorage, buttonWidth * 3.0, false, 1, fontSize: 16 );
      Widget t2 = makeTitleText( appState, hostStorage, buttonWidth * 3.0, false, 1, fontSize: 16 );

      Widget status = makeTitleText( appState, "STATUS", buttonWidth, false, 1, fontSize: 16);
      Widget good   = makeTitleText( appState, "GOOD", buttonWidth, false, 1, color: Colors.green );
      Widget repair = makeTitleText( appState, "REPAIR", buttonWidth, false, 1, fontSize: 16);
      Widget cePeqW   = makeTitleText( appState, cePeqs, buttonWidth * 3.0, false, 1 );
      Widget hostPeqW = makeTitleText( appState, hostPeqs, buttonWidth * 3.0, false, 1 );
      
      header.add( [ Container( height: appState.MID_PAD ), empty, empty, empty, empty ] );
      header.add( [ miniSpace, status, minierSpace, t1, t2 ] );
      header.add( [ miniSpace, good, minierSpace, cePeqW, hostPeqW ] );
      header.add( [ hdiv, empty, empty, empty, empty ] );      
      
      widget.headerTop = header.length;
      return header;
   }

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
      if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + p.ceProjectId + " " + h!.ceProjectId ); }
      
      res = res && p.peqType != null && p.peqType        == h!.peqType;
      if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + enumToStr( p.peqType ) + " " + enumToStr( h!.peqType )); }

      // amounts in ceMD may be off by one. there are no fractions, two assignees...
      res = res && p.amount != null && ( p.amount - h!.amount ).abs() <= 1;
      if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + p.amount.toString() + " " + h!.amount.toString() ); }

      res = res && p.hostRepoId != null && p.hostRepoId     == h!.hostRepoId;
      if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + p.hostRepoId + " " + h!.hostRepoId ); }

      res = res && p.hostIssueId != null && p.hostIssueId    == h!.hostIssueId;
      if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + p.hostIssueId + " " + h!.hostIssueId ); }

      res = res && p.hostIssueTitle != null && p.hostIssueTitle == h!.hostIssueTitle;
      if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + p.hostIssueTitle + " " + h!.hostIssueTitle ); }
      
      res = res && p.hostHolderId != null && setEquals( p.hostHolderId.toSet(), h!.hostHolderId.toSet() );
      if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + p.hostHolderId.toString() + " " + h!.hostHolderId.toString() ); }

      res = res && p.hostProjectSub != null && eq( p.hostProjectSub, h!.hostProjectSub );
      if( !res ) { print( "Bad at: " + p.hostIssueTitle + " " + p.hostProjectSub.toString() + " " + h!.hostProjectSub.toString() ); }

      if( !res ) { print( p ); print( h! ); }

      return res; 
   }
   
   List<List<Widget>> _getBody( cep ) {
      Widget miniSpace = Container( height: 1, width: 3 * appState.GAP_PAD );

      List<List<Widget>> bad  = [];
      List<List<Widget>> good = [];
      List<List<Widget>> body = [];

      String disText = "For each PEQ mismatch below, select which version is correct and CE MD will make repairs.";
      bad.add( [ miniSpace, makeIWTitleText( appState, "Needing Repair", false, 1, fontSize: 16 ), empty, empty, empty ] );
      bad.add( [ miniSpace, makeIWTitleText( appState, disText, false, 1 ), empty, empty, empty ] );
      bad.add( [ hdiv, empty, empty, empty, empty ] );      

      String agrText = "These are shown for completeness, nothing needs be done for these PEQs.";
      good.add( [ miniSpace, makeIWTitleText( appState, "In Agreement", false, 1, fontSize: 16 ), empty, empty, empty ] );
      good.add( [ miniSpace, makeIWTitleText( appState, agrText, false, 1 ), empty, empty, empty ] );
      good.add( [ hdiv, empty, empty, empty, empty ] );      

      if( peqsLoaded ) {
         Map<String, PEQ> peqs  = {};
         Map<String, PEQ> hPeqs = {};
         appState.cePeqs[ cep.ceProjectId ]!.forEach( (p) {
               assert( p.hostIssueId != null );
               peqs[p.hostIssueId] = p;
            });
         appState.hostPeqs[ cep.ceProjectId ]!.forEach( (p) {
               assert( p.hostIssueId != null );
               hPeqs[p.hostIssueId] = p;
            });
         
         peqs.forEach( (k,v) {
               PEQ? h = hPeqs[k];
               if( _same( v, h ) ) {
                  print( "Good added " + v.hostIssueTitle );
                  good.add( [ miniSpace, makeIWTitleText( appState, v.hostIssueTitle, false, 1 ), empty, empty, empty ] ); }
               else                {
                  print( "Bad added " + v.hostIssueTitle );
                  bad.add( [ miniSpace, makeIWTitleText( appState, v.hostIssueTitle, false, 1 ), empty, empty, empty ] ); }
            });
      }
      
      body.addAll( bad );
      body.addAll( good );
      
      return body;
   }
   
   Widget getStatus( context ) {

      CEProject? cep = appState.ceProject[ appState.selectedCEProject ];
      if( cep == null ) { return makeTitleText( appState, "First choose Project from home screen.", 8*appState.CELL_HEIGHT, false, 1, fontSize: 16); }

      if( appState.cePeqs[ cep.ceProjectId ] != null  &&  appState.hostPeqs[ cep.ceProjectId ] != null   ) { peqsLoaded  = true; }     
      _loadPeqs( cep! );

      List<List<Widget>> pending = [];
      
      pending.addAll( _getHeader( cep! ) );

      pending.addAll( _getBody( cep! ) );

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

      frameMinWidth  = appState.MIN_PANE_WIDTH;
      svHeight       = ( appState.screenHeight - widget.frameHeightUsed ) * .9;
      svWidth        = appState.MAX_PANE_WIDTH; 

      empty     = Container( width: 1, height: 1 );
      gapPad    = Container( width: appState.GAP_PAD*2.0, height: 1 );
      fatPad    = Container( width: appState.FAT_PAD, height: 1 );
      midPad    = Container( width: appState.MID_PAD, height: 1 );
      vSpace    = Container( width: 1, height: appState!.CELL_HEIGHT * .5 );

      Widget hd = makeHDivider( appState, svWidth - 2*appState.GAP_PAD, appState.TINY_PAD, appState.TINY_PAD, tgap: appState.TINY_PAD, bgap: appState.TINY_PAD );
      hdiv      = Wrap( spacing: 0, children: [fatPad, hd] );   

      if( appState.verbose >= 2 ) { print( "STATUS BUILD. " ); }
      
      return getStatus( context );
   }
}
