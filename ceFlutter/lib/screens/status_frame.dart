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
   late double baseWidth;
   static const frameMinHeight = 300;
   
   late Widget empty;  // XXX formalize
   late Widget gapPad;
   late Widget fatPad;
   late Widget midPad;
   late Widget hdiv;
   late Widget vSpace; 
   
   late bool peqsLoaded;
   late bool goodStatus;     
   late bool hideGone; 
   late bool hideBad; 
   late bool hideGood;

   late List<List<Widget>> peqHeader;

   final listHeaders = ["Issue Title", "Host Project", "PEQ", "Assignee(s)" ];
   
   @override
   void initState() {
      super.initState();
      peqsLoaded = false;
      goodStatus = true;
      hideGone   = true;
      hideBad    = true;
      hideGood   = true;
      peqHeader  = [];
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

   void _chooseCEPeq() {
      print( "choose ce" );
      Navigator.of( context ).pop();
   }
   void _chooseHostPeq() {
      print( "Choose host" );
      Navigator.of( context ).pop();
   }
   void _cancel() {
      print( "Cancel" );
      Navigator.of( context ).pop();
   }

   

   Future<void> _detailPopup( context, PEQ cePeq, PEQ? hostPeq, String status ) async {
      List<Widget> buttons = [];
      if( status == "bad" ) {
         buttons.add( new TextButton( key: Key( 'Choose CE Peq' ), child: new Text("Use CE Peq"), onPressed: _chooseCEPeq ));
         buttons.add( new TextButton( key: Key( 'Choose Host Peq' ), child: new Text("Use Host Peq"), onPressed: _chooseHostPeq ));
      }
      buttons.add( new TextButton( key: Key( 'Cancel Peq fix' ), child: new Text("Cancel"), onPressed: _cancel ));

      List<Widget> comparison = [];
      // ceData   hostData  x or check
      if( hostPeq == null ) {
         print( "hostPeq is missing" );
      }
      else {
         print( "Got " + cePeq.hostIssueTitle );
         var mux = 1.0;
         comparison.add( Wrap( spacing: appState.FAT_PAD, children: [
                               Container( width: mux*baseWidth ),
                               Container( width: 1.3*baseWidth, child: makeTableText( appState, "CodeEquity Data", baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                               Container( width: 1.3*baseWidth, child: makeTableText( appState, "Host Data", baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                               Container( width: 0.3*baseWidth, child: makeTableText( appState, "Match?", baseWidth, appState!.CELL_HEIGHT, false, 1 ))
                                  ]) );
         comparison.add( makeHDivider( appState, 3 * baseWidth, appState.GAP_PAD*3.0, appState.GAP_PAD * 2.0, tgap: appState.TINY_PAD ));

         bool same = cePeq.hostIssueTitle == hostPeq.hostIssueTitle;
         comparison.add( Wrap( spacing: appState.FAT_PAD, children: [
                                  Container( width: mux*baseWidth, child: makeTableText( appState, "Title:", mux*baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  Container( width: 1.3*baseWidth, child: makeTableText( appState, cePeq.hostIssueTitle, baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  Container( width: 1.3*baseWidth, child: makeTableText( appState, hostPeq.hostIssueTitle, baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  same ? Icon( Icons.check_circle_outline, color: Colors.green ) : Icon( Icons.cancel_outlined, color: Colors.red )
                                  ]) );

         same = cePeq.ceProjectId == hostPeq.ceProjectId;
         comparison.add( Wrap( spacing: appState.FAT_PAD, children: [
                                  Container( width: mux*baseWidth, child: makeTableText( appState, "CE Project Id:", mux*baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  Container( width: 1.3*baseWidth, child: makeTableText( appState, cePeq.ceProjectId, baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  Container( width: 1.3*baseWidth, child: makeTableText( appState, hostPeq.ceProjectId, baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  same ? Icon( Icons.check_circle_outline, color: Colors.green ) : Icon( Icons.cancel_outlined, color: Colors.red )
                                  ]) );

         same = ( hostPeq.amount != null && (cePeq.amount - hostPeq.amount ).abs() <= 1 );
         comparison.add( Wrap( spacing: appState.FAT_PAD, children: [
                                  Container( width: mux*baseWidth, child: makeTableText( appState, "PEQ Amount:", mux*baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  Container( width: 1.3*baseWidth, child: makeTableText( appState, cePeq.amount.toString(), baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  Container( width: 1.3*baseWidth, child: makeTableText( appState, hostPeq.amount.toString(), baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  same ? Icon( Icons.check_circle_outline, color: Colors.green ) : Icon( Icons.cancel_outlined, color: Colors.red )
                                  ]) );

         same = cePeq.hostRepoId == hostPeq.hostRepoId;
         comparison.add( Wrap( spacing: appState.FAT_PAD, children: [
                                  Container( width: mux*baseWidth, child: makeTableText( appState, "Host Repo Id:", mux*baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  Container( width: 1.3*baseWidth, child: makeTableText( appState, cePeq.hostRepoId, baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  Container( width: 1.3*baseWidth, child: makeTableText( appState, hostPeq.hostRepoId, baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  same ? Icon( Icons.check_circle_outline, color: Colors.green ) : Icon( Icons.cancel_outlined, color: Colors.red )
                                  ]) );

         same = cePeq.hostIssueId == hostPeq.hostIssueId;
         comparison.add( Wrap( spacing: appState.FAT_PAD, children: [
                                  Container( width: mux*baseWidth, child: makeTableText( appState, "Host Issue Id:", mux*baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  Container( width: 1.3*baseWidth, child: makeTableText( appState, cePeq.hostIssueId, baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  Container( width: 1.3*baseWidth, child: makeTableText( appState, hostPeq.hostIssueId, baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  same ? Icon( Icons.check_circle_outline, color: Colors.green ) : Icon( Icons.cancel_outlined, color: Colors.red )
                                  ]) );
         
         same = hostPeq.hostHolderId != null && setEquals( cePeq.hostHolderId.toSet(), hostPeq.hostHolderId.toSet() );
         comparison.add( Wrap( spacing: appState.FAT_PAD, children: [
                                  Container( width: mux*baseWidth, child: makeTableText( appState, "Host Assignees:", mux*baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  makeToolTip(
                                     Container( width: 1.3*baseWidth, child: makeTableText( appState, cePeq.hostHolderId.toString(), baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                     cePeq.hostHolderId.toString(), wait: true ),
                                  makeToolTip(
                                     Container( width: 1.3*baseWidth, child: makeTableText( appState, hostPeq.hostHolderId.toString(), baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                     hostPeq.hostHolderId.toString(), wait: true ),
                                  same ? Icon( Icons.check_circle_outline, color: Colors.green ) : Icon( Icons.cancel_outlined, color: Colors.red )
                                  ]) );
         
         same = hostPeq.hostProjectSub != null && eq( cePeq.hostProjectSub, hostPeq.hostProjectSub );
         comparison.add( Wrap( spacing: appState.FAT_PAD, children: [
                                  Container( width: mux*baseWidth, child: makeTableText( appState, "Host Location:", mux*baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                  makeToolTip(
                                     Container( width: 1.3*baseWidth, child: makeTableText( appState, cePeq.hostProjectSub.toString(), baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                     cePeq.hostProjectSub.toString(), wait: true ),
                                  makeToolTip(
                                     Container( width: 1.3*baseWidth, child: makeTableText( appState, hostPeq.hostProjectSub.toString(), baseWidth, appState!.CELL_HEIGHT, false, 1 )),
                                     hostPeq.hostProjectSub.toString(), wait: true ),
                                  same ? Icon( Icons.check_circle_outline, color: Colors.green ) : Icon( Icons.cancel_outlined, color: Colors.red )
                                  ]) );
         
      }
             
      Widget scrollBody = Column(
         mainAxisSize: MainAxisSize.max,
         mainAxisAlignment: MainAxisAlignment.spaceBetween,
         children: comparison );
      
      await showDialog(
         context: context,
         builder: (BuildContext context) {
                          return AlertDialog(
                             scrollable: true,
                             title: new Text( "CodeEquity vs Host PEQ Data" ),
                             content: Container( width: 5.0 * baseWidth, child: scrollBody ),
                             actions: buttons);
                       });
   }
      
   
   List<List<Widget>> _getBody( context, cep ) {
      final buttonWidth = 100;
      
      Widget expandGone = GestureDetector(
         onTap: () async { setState(() => hideGone = false ); },
         key: Key( 'hideGone'),
         child: makeToolTip( Icon( Icons.arrow_drop_down ), "Expand", wait: true )
         );
      
      Widget shrinkGone = GestureDetector(
         onTap: () async { setState(() => hideGone = true ); },
         key: Key( 'hideGone'),
         child: makeToolTip( Icon( Icons.arrow_drop_down_circle ), "hide", wait: true )
         );
      
      Widget expandBad = GestureDetector(
         onTap: () async { setState(() => hideBad = false ); },
         key: Key( 'hideBad'),
         child: makeToolTip( Icon( Icons.arrow_drop_down ), "Expand", wait: true )
         );
      
      Widget shrinkBad = GestureDetector(
         onTap: () async { setState(() => hideBad = true ); },
         key: Key( 'hideBad'),
         child: makeToolTip( Icon( Icons.arrow_drop_down_circle ), "hide", wait: true )
         );
      
      Widget expandGood = GestureDetector(
         onTap: () async { setState(() => hideGood = false ); },
         key: Key( 'hideGood'),
         child: makeToolTip( Icon( Icons.arrow_drop_down ), "Expand", wait: true )
         );
      
      Widget shrinkGood = GestureDetector(
         onTap: () async { setState(() => hideGood = true ); },
         key: Key( 'hideGood'),
         child: makeToolTip( Icon( Icons.arrow_drop_down_circle ), "hide", wait: true )
         );
      
      Widget categoryHDiv = makeHDivider( appState, 4.5 * baseWidth, appState.GAP_PAD*3.0, appState.GAP_PAD * 2.0, tgap: appState.TINY_PAD );
      List<List<Widget>> gone = [];
      List<List<Widget>> bad  = [];
      List<List<Widget>> good = [];
      List<List<Widget>> body = [];

      if( peqsLoaded ) {
         Map<String, PEQ> peqs  = {};
         Map<String, PEQ> hPeqs = {};
         appState.cePeqs[ cep.ceProjectId ]!.forEach( (p) {
               assert( p.hostIssueId != null );
               // do NOT filter on active, that is a host-specific flag
               peqs[p.hostIssueId] = p; 
            });
         appState.hostPeqs[ cep.ceProjectId ]!.forEach( (p) {
               assert( p.hostIssueId != null );
               hPeqs[p.hostIssueId] = p;
            });

         void _unsetTitle( PointerEvent event ) {
            setState(() { appState.hoverChunk = ""; });
         }

         peqs.forEach( (k,v) {
               void _setTitle( PointerEvent event ) {
                  setState(() { appState.hoverChunk = v.hostIssueTitle; });
               }
               Widget peqDetail = GestureDetector(
                  onTap: () async
                  {
                     print( "Show Detail " + v.hostIssueTitle );
                     await _detailPopup( context, v, hPeqs[k], "good" );
                  },
                  key: Key( 'peqDetail ' + v.hostIssueId ),
                  child: makeClickTableText( appState, v.hostIssueTitle,  _setTitle, _unsetTitle, 1.3*baseWidth, false, 1, iw: false )
                  );


               // XXX shared with approvalFrame
               assert( v.hostProjectSub.length >= 2 );
               List<String> userNames = v.ceHolderId.map( (ceuid) {
                     assert( appState.cePeople[ceuid] != null );
                     return appState.cePeople[ceuid]!.userName;
                  }).toList();
               Widget hproj   = Container( width: 1.5*baseWidth, child: makeTableText( appState, v.hostProjectSub[ v.hostProjectSub.length - 2 ], baseWidth, appState!.CELL_HEIGHT, false, 1 ));
               Widget peqVal  = Container( width: 0.6*baseWidth, child: makeTableText( appState, v.amount.toString(), baseWidth, appState!.CELL_HEIGHT, false, 1 ));
               Widget assign  = Container( width: 1.8*baseWidth, child: makeTableText( appState, userNames.toString(), baseWidth, appState!.CELL_HEIGHT, false, 1 ));
               Widget title   = paddedLTRB( peqDetail, 2 * appState.GAP_PAD, 0, 0, 0 );
               
               PEQ? h = hPeqs[k];
               if( !v.active && v.peqType == PeqType.grant ) {
                  if( gone.length < 1 ) { gone.addAll( peqHeader ); }
                  gone.add( [ empty, title, hproj, peqVal, assign ] );
               }
               else if( _same( v, h ) ) {
                  if( good.length < 1 ) { good.addAll( peqHeader ); }                  
                  good.add( [ empty, title, hproj, peqVal, assign ] );
               }
               else {
                  if( bad.length < 1 ) { bad.addAll( peqHeader ); }
                  bad.add( [ empty, title, hproj, peqVal, assign ] );
               }
            });
         hPeqs.forEach( (k,v) {
               PEQ? p = peqs[k];
               if( p == null ) { print("Extra host peq: " + v.toString() ); }
            });
      }

      if( bad.length > 0 ) { setState(() => goodStatus = false ); }

      int peqLen      = gone.length > 0 ? (gone.length - peqHeader.length) : 0;
      String goneText = peqLen.toString() + " PEQs are granted and in good standing, but no longer visible on the host.";
      Widget category = paddedLTRB( makeTitleText( appState, "Unavailable on host", 1.5*buttonWidth, false, 1, fontSize: 16 ), appState.FAT_PAD, 0, 0, 0 );
      if( hideGone ) { gone = []; }
      gone.insert( 0, [ empty, category,
                        makeTitleText( appState, goneText, 6*buttonWidth, false, 1 ),
                        hideGone ? expandGone : shrinkGone, empty ] );
      gone.insert( 1, [ categoryHDiv, empty, empty, empty, empty ] );      

      peqLen         = bad.length > 0 ? (bad.length - peqHeader.length) : 0;
      String disText = peqLen.toString() + " PEQs are mismatched. Select which version CE MD should use to  make repairs.";
      category       = paddedLTRB( makeTitleText( appState, "Needing Repair", 1.5*buttonWidth, false, 1, fontSize: 16 ), appState.FAT_PAD, 0, 0, 0 );      
      if( hideBad ) { bad = []; }
      bad.insert( 0, [ empty, category, 
                       makeTitleText( appState, disText, 6*buttonWidth, false, 1 ),
                       hideBad ? expandBad : shrinkBad, empty ] );
      bad.insert( 1, [ categoryHDiv, empty, empty, empty, empty ] );      

      peqLen         = good.length > 0 ? (good.length - peqHeader.length) : 0;
      String agrText = peqLen.toString() + " PEQs match. Nothing needs be done here.";
      category       = paddedLTRB( makeTitleText( appState, "In Agreement", 1.5*buttonWidth, false, 1, fontSize: 16 ), appState.FAT_PAD, 0, 0, 0 );            
      if( hideGood ) { good = []; }
      good.insert( 0, [ empty, category, 
                        makeTitleText( appState, agrText, 6*buttonWidth, false, 1 ),
                        hideGood ? expandGood : shrinkGood, empty ] );
      good.insert( 1, [ categoryHDiv, empty, empty, empty, empty ] );      

      gone.insert( 0, [ vSpace, empty, empty, empty, empty ] );
      gone.add( [ vSpace, empty, empty, empty, empty ] );
      bad.add(  [ vSpace, empty, empty, empty, empty ] );
      
      body.addAll( gone );
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

      pending.addAll( _getBody( context, cep! ) );

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

      // XXX hdiv, minispace, minierspace,
      
      container = widget.appContainer;   
      appState  = container.state;
      assert( appState != null );

      frameMinWidth  = appState.MIN_PANE_WIDTH;
      svHeight       = ( appState.screenHeight - widget.frameHeightUsed ) * .9;
      svWidth        = appState.MAX_PANE_WIDTH; 
      baseWidth      = ( frameMinWidth - 2*appState.FAT_PAD ) / 2.0;
      
      empty     = Container( width: 1, height: 1 );
      gapPad    = Container( width: appState.GAP_PAD*3.0, height: 1 );
      fatPad    = Container( width: appState.FAT_PAD, height: 1 );
      midPad    = Container( width: appState.MID_PAD, height: 1 );
      vSpace    = Container( width: 1, height: appState!.CELL_HEIGHT * .4 );
      Widget miniHor   = Container( height: 1, width: 1.7 * appState.GAP_PAD );       // XXX

      Widget hd    = makeHDivider( appState, svWidth - 2*appState.GAP_PAD, appState.TINY_PAD, appState.TINY_PAD, tgap: appState.TINY_PAD, bgap: appState.TINY_PAD );
      hdiv         = Wrap( spacing: 0, children: [fatPad, hd] );   

      if( appState.verbose >= 2 ) { print( "STATUS BUILD. " ); }

      Widget row0 = Container( width: 1.5*baseWidth, child: makeTableText( appState, listHeaders[0], baseWidth, appState!.CELL_HEIGHT, false, 1 ) );
      Widget row1 = Container( width: 1.5*baseWidth, child: makeTableText( appState, listHeaders[1], baseWidth, appState!.CELL_HEIGHT, false, 1 ) );
      Widget row2 = Container( width: 0.6*baseWidth, child: makeTableText( appState, listHeaders[2], baseWidth, appState!.CELL_HEIGHT, false, 1 ) );
      Widget row3 = Container( width: 1.8*baseWidth, child: makeTableText( appState, listHeaders[3], baseWidth, appState!.CELL_HEIGHT, false, 1 ) );

      if( peqHeader.length < 1 ) {
         peqHeader.add( [ vSpace, vSpace, vSpace, vSpace, vSpace ] );
         peqHeader.add( [ miniHor, row0, row1, row2, row3 ] );
         peqHeader.add( [ makeHDivider( appState, 3.5 * baseWidth, appState.GAP_PAD*3.5, appState.GAP_PAD * 4.0 ), empty, empty, empty, empty ] );
      }
      
      return getStatus( context );
   }
}
