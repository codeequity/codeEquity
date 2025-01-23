import 'dart:ui';
import 'dart:typed_data';
import 'package:flutter/widgets.dart';
import 'package:flutter/material.dart';
import 'package:fluttertoast/fluttertoast.dart';

import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/utils/search.dart';

import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/screens/home_page.dart';
import 'package:ceFlutter/screens/project_page.dart';
import 'package:ceFlutter/screens/profile_page.dart';
import 'package:ceFlutter/screens/settings_page.dart';

import 'package:ceFlutter/customIcons.dart';


// XXX after update from 3.X to 7.X, move to web, background color is wrong
void notYetImplemented(BuildContext context) {
   Fluttertoast.showToast(
      msg: "Future feature",
      toastLength: Toast.LENGTH_SHORT,
      // toastLength: Toast.LENGTH_LONG,
      gravity: ToastGravity.CENTER,
      backgroundColor: Colors.pinkAccent,
      //style.background: Colors.pinkAccent,
      textColor: Colors.white,
      fontSize: 14.0
      );
}


// This package is growing - positioning will improve over time
void showToast(String msg) {
   print( "Toasting.." );
   Fluttertoast.showToast(
      msg: msg,
      toastLength: Toast.LENGTH_LONG,    
      backgroundColor: Colors.pinkAccent,
      // style.background: Colors.pinkAccent,
      gravity: ToastGravity.CENTER,
      textColor: Colors.white,
      fontSize: 18.0,
      // For web
      webShowClose: true,
      webBgColor: "#eb59e6",
      webPosition: "center",
      timeInSecForIosWeb: 5,
      );
}

void popScroll( BuildContext context, scrollHeader, scrollBody, dismissFunc ) {
   showDialog(
      context: context,
      builder: (BuildContext context) {
                 return AlertDialog(
                    scrollable: true,
                    title: new Text( scrollHeader ),
                    content: scrollBody,
                    actions: <Widget>[
                       new TextButton(
                          key: Key( 'Dismiss' ),
                          child: new Text("Dismiss"),
                          onPressed: dismissFunc )
                       ]);
              });
}


Future<void> editList( BuildContext context, appState, scrollHeader,
                       List<String> itemHeaders, List<TextEditingController> controllers, List<String> values, saveFunc, cancelFunc, deleteFunc ) async {

   bool edit = scrollHeader.contains( "Edit" );
   assert( controllers.length == values.length );
   List<Widget> editVals = [];
   Widget c = Container( height: 1, width: appState.MID_PAD );
   for( int i = 0; i < values.length; i++ ) {
      Widget text = makeInputField( appState, values[i], false, controllers[i], keyName: "editRow " + values[i], edit: edit);
      Widget w = IntrinsicWidth( child: text );
      Widget h = IntrinsicWidth( stepWidth: 40, child: Text( itemHeaders[i] ));
      editVals.add(
         Row( 
            mainAxisSize: MainAxisSize.max,
            mainAxisAlignment: MainAxisAlignment.start,
            children: [h, c, w, c] ) );
   }

   Widget scrollBody = Column(
      mainAxisSize: MainAxisSize.max,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: editVals );
   
   List<Widget> buttons = [];
   buttons.add( new TextButton( key: Key( 'Save' ), child: new Text("Save"), onPressed: saveFunc ));

   if( deleteFunc != null ) {
      buttons.add( new TextButton( key: Key( 'Delete' ), child: new Text("Delete"), onPressed: deleteFunc ) );
   }

   buttons.add( new TextButton( key: Key( 'Cancel' ), child: new Text("Cancel"), onPressed: cancelFunc ));
   
   await showDialog(
      context: context,
      builder: (BuildContext context) {
                 return AlertDialog(
                    scrollable: true,
                    title: new Text( scrollHeader ),
                    content: scrollBody,
                    actions: buttons);
              });
   // print( "Edit row finished" );
}

void confirm( BuildContext context, confirmHeader, confirmBody, okFunc, cancelFunc ) {
   showDialog(
      context: context,
      builder: (BuildContext context) {
                 return AlertDialog(
                    title: new Text( confirmHeader ),
                    content: new Text( confirmBody ),
                    actions: <Widget>[
                       new TextButton(
                          key: Key( 'confirmContinue' ),
                          child: new Text("Continue"),
                          onPressed: okFunc ),
                       new TextButton(
                          key: Key( 'cancelContinue' ),
                          child: new Text("Cancel"),
                          onPressed: cancelFunc )
                       ]);
              });
}

// No border padding
Widget makeHDivider( appState, width, lgap, rgap, {tgap=0, bgap=0}) {
   return Padding(
      padding: EdgeInsets.fromLTRB(lgap, tgap, rgap, bgap),
      child: Container( width: width, height: 2, color: appState.DIV_BAR_COLOR ));
}
   

Widget paddedLTRB( child, double L, double T, double R, double B ) {
   return Padding(
      padding: EdgeInsets.fromLTRB(L,T,R,B),
      child: child );
}

Widget makeActionButton( appState, buttonText, fn ) {
   TextStyle style = TextStyle(fontFamily: 'Montserrat', fontSize: 14.0);
   return Material(
      elevation: 5.0,
      borderRadius: BorderRadius.circular(10.0),
      color: appState.BUTTON_COLOR,
      child: MaterialButton(
         key: Key( buttonText ),
         minWidth: appState.screenWidth - 2*appState.FAT_PAD,
         padding: EdgeInsets.fromLTRB(appState.GAP_PAD, appState.FAT_PAD, appState.GAP_PAD, appState.FAT_PAD),
         onPressed: fn,
         child: Text( buttonText,
                      textAlign: TextAlign.center,
                      style: style.copyWith(
                         color: Colors.white, fontWeight: FontWeight.bold)),
         )
      );
}

Widget makeActionButtonSmall( appState, buttonText, fn ) {
   TextStyle style = TextStyle(fontFamily: 'Montserrat', fontSize: 12.0);
   return Material(
      elevation: 5.0,
      borderRadius: BorderRadius.circular(10.0),
      color: appState.BUTTON_COLOR,
      child: MaterialButton(
         key: Key( buttonText ),
         minWidth: appState.screenWidth * .20,
         onPressed: fn,
         child: Text( buttonText,
                      textAlign: TextAlign.center,
                      style: style.copyWith(
                         color: Colors.white, fontWeight: FontWeight.bold)),
         )
      );
}

Widget makeActionButtonFixed( appState, buttonText, minWidth, fn ) {
   TextStyle style = TextStyle(fontFamily: 'Montserrat', fontSize: 12.0);
   return Material(
      elevation: 5.0,
      borderRadius: BorderRadius.circular(10.0),
      color: appState.BUTTON_COLOR,
      child: MaterialButton(
         key: Key( buttonText ),
         minWidth: minWidth,
         onPressed: fn,
         child: Text( buttonText,
                      textAlign: TextAlign.center,
                      style: style.copyWith(
                         color: Colors.white, fontWeight: FontWeight.bold)),
         )
      );
}

Widget makeClickTableText( appState, title, hov, nohov, width, height, wrap, lines, { fontSize = 14, mux = 1.0 } ) {
   return MouseRegion(
      onEnter: hov,
      onExit: nohov,
      cursor: SystemMouseCursors.click,
      child: Padding(
      padding: EdgeInsets.fromLTRB(mux * appState.GAP_PAD, appState.TINY_PAD, appState.TINY_PAD, 0),
      child: IntrinsicWidth(
         key: Key( title ),
         child: Text(title, softWrap: wrap, maxLines: lines, overflow: TextOverflow.ellipsis,
                     style: TextStyle(fontSize: fontSize,
                                      fontWeight: FontWeight.bold,
                                      color:      title == appState.hoverChunk ? appState.BUTTON_COLOR : Colors.black,
                                      decoration: title == appState.hoverChunk ? TextDecoration.underline : null ))))
         );
}

Widget makeIndentedActionableText( appState, title, hov, nohov, width, wrap, lines ) {
   return MouseRegion(
      onEnter: hov,
      onExit: nohov,
      cursor: SystemMouseCursors.click,
      child: Padding(
      padding: EdgeInsets.fromLTRB(appState.GAP_PAD + appState.TINY_PAD, appState.MID_PAD, appState.TINY_PAD, 0),
      child: IntrinsicWidth(
                        key: Key( title ),
                        child: Text(title, softWrap: wrap, maxLines: lines, overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 14,
                                                     color:      title == appState.hoverChunk ? appState.BUTTON_COLOR : Colors.black,
                                                     fontWeight: title == appState.hoverChunk ? FontWeight.bold : null,
                                                     decoration: title == appState.hoverChunk ? TextDecoration.underline : null
                                       )))
         ));
}

Widget makeIndentedText( appState, title, width, wrap, lines ) {
   return Padding(
      padding: EdgeInsets.fromLTRB(appState.GAP_PAD + appState.TINY_PAD, appState.MID_PAD, appState.TINY_PAD, 0),
      child: Container( width: width,
                        height: appState.BASE_TXT_HEIGHT*lines,   
                        key: Key( title ),
                        child: Text(title, softWrap: wrap, maxLines: lines, overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 14, color: Colors.black,
                                                     // fontWeight: FontWeight.bold
                                       ))));
}

Widget makeActionableText(  appState, title, id, hov, nohov, width, wrap, lines, {keyPreface = "", lgap = -1, tgap=-1, bgap=0} ) {

   String lead = "";
   for( int i = 0; i < title.length; i++ ) {
      if( title[i] == " " ) { lead += " "; }
      else{ break; }
   }

   String theKey = title;
   if( keyPreface != "" ) { theKey = keyPreface + title.trim();  }
   lgap = lgap == -1 ? appState.GAP_PAD : lgap;
   tgap = tgap == -1 ? appState.MID_PAD : tgap;
   Widget mr = MouseRegion(
      onEnter: hov,
      onExit: nohov,
      cursor: SystemMouseCursors.click,
      child: Padding(
         padding: EdgeInsets.fromLTRB(lgap, tgap, appState.TINY_PAD, bgap),
         child: IntrinsicWidth(
            key: Key( theKey ),
            child: Text(title.trim(), softWrap: wrap, maxLines: lines, overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 14,
                                         color: id == appState.hoverChunk ? appState.BUTTON_COLOR : Colors.black,
                                         fontWeight: FontWeight.bold,
                                         decoration: id == appState.hoverChunk ? TextDecoration.underline : null
                           ))))
      );
   
   if( lead.length <= 0 ) { return mr; }
   else                   { return Wrap( spacing: 0, children: [ Text(lead ), mr ] );  }
}

Widget makeToolTip( child, message, {wait=false} ) {
   final dengdeng = wait ? 2 : 0;
   return new Tooltip(
      child: child,
      message: message,
      preferBelow: true,
      height: 50,
      padding: const EdgeInsets.all(8.0),
      textStyle: const TextStyle( fontSize: 16, color: Colors.blue ),
      decoration: BoxDecoration(
         // color: Colors.grey[100],
         color: Colors.white,
        border: Border.all( width: 2 ),
        borderRadius: BorderRadius.circular(10),
      ),
      showDuration: const Duration(seconds: 2),
      waitDuration: Duration(seconds: dengdeng),
      );
}

Widget makeTitleText( appState, title, width, wrap, lines, { fontSize = 14, keyTxt = "" } ) {
   // Add as encountered.
   var mux = 1.0;
   if     ( fontSize == 18 ) { mux = 24.0 / appState.BASE_TXT_HEIGHT; }
   else if( fontSize == 24 ) { mux = 32.0 / appState.BASE_TXT_HEIGHT; }
   else if( fontSize == 28 ) { mux = 38.0 / appState.BASE_TXT_HEIGHT; }
   else if( fontSize == 36 ) { mux = 48.0 / appState.BASE_TXT_HEIGHT; }

   String keyName = keyTxt == "" ? title : keyTxt; 
   
   return Padding(
      padding: EdgeInsets.fromLTRB(appState.GAP_PAD, appState.TINY_PAD, appState.TINY_PAD, 0),
      child: Container( width: width,
                        height: appState.BASE_TXT_HEIGHT * lines * mux,
                        key: Key( keyName ),
                        child: Text(title, softWrap: wrap, maxLines: lines, overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.bold))));
}

Widget makeTableText( appState, title, width, height, wrap, lines, { fontSize = 14, mux = 1.0 } ) {

   // print( "    mtt $title w,h,m: $width $height $mux" );
   return Padding(
      padding: EdgeInsets.fromLTRB(mux * appState.GAP_PAD, appState.TINY_PAD, appState.TINY_PAD, 0),
      child: Container( width: width,
                        height: height - appState.GAP_PAD - appState.TINY_PAD,
                        key: Key( title ),
                        child: Text(title, softWrap: wrap, maxLines: lines, overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.bold))));
}

Widget makeBodyText( appState, title, width, wrap, lines, { keyTxt = "" } ) {
   String keyName = keyTxt == "" ? title : keyTxt;
   return Padding(
      padding: EdgeInsets.fromLTRB(appState.GAP_PAD, appState.TINY_PAD, appState.TINY_PAD, 0),
      child: Container( width: width,
                        key: Key( keyName ),
                        child: Text(title, softWrap: wrap, maxLines: lines, overflow: TextOverflow.ellipsis,
                                    style: TextStyle(height: 2, fontSize: 14))));
}

      
Widget makeInputField( appState, hintText, obscure, controller, {keyName = "", edit = false} ) {
   TextStyle style     = TextStyle(fontFamily: 'Montserrat', fontSize: 20.0);
   TextStyle hintStyle = TextStyle(fontFamily: 'Montserrat', fontSize: 20.0, fontStyle: FontStyle.italic);
   if( keyName == "" ) { keyName = hintText; }
   if( edit ) { controller.text = hintText; };
   return TextField(
      key: Key( keyName ),
      obscureText: obscure,
      style: style,
      decoration: InputDecoration(
         contentPadding: EdgeInsets.fromLTRB(appState.GAP_PAD, appState.FAT_PAD, appState.GAP_PAD, appState.FAT_PAD),
         hintText: hintText,
         hintStyle: hintStyle,
         border: OutlineInputBorder(borderRadius: BorderRadius.circular(10.0))),
      controller: controller
      );
}


PreferredSizeWidget makeTopAppBar( BuildContext context, currentPage ) {
   final container   = AppStateContainer.of(context);
   final appState    = container.state;
   final iconSize    = appState.screenHeight*.0422;
   final spacer      = Container( width: 2.0 * appState.GAP_PAD );
   final miniSpace   = Container( width: appState.MID_PAD );
   Widget search     = CESearch();
   
   TextEditingController tc = new TextEditingController();   
   return PreferredSize(
      preferredSize: Size.fromHeight( appState.screenHeight*.054 ),
      child: AppBar(
         leading: IconButton(
            icon: currentPage == "Home" ? Icon(customIcons.home_here) : Icon(customIcons.home),
            key:  currentPage == "Home" ? Key( "homeHereIcon" ) : Key( "homeIcon" ),
            onPressed: ()
            {
               if( currentPage == "Home" ) { return; }
               MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEHomePage());
               confirmedNav( context, container, newPage );
            },
            iconSize: iconSize,
            padding: EdgeInsets.fromLTRB(0.0, 0.0, 0.0, 2.0)
            ),
         title: Wrap( spacing: 0, children: [ spacer, Text( "CodeEquity", key: Key("CodeEquityTitle"), style: new TextStyle( fontFamily: 'Mansalva', fontSize: 18 )) ] ),
         actions: <Widget>[
            Container( width: 12*appState.GAP_PAD, height: 0.5*appState.CELL_HEIGHT, child: search ), 
            spacer,
            IconButton(
               icon: currentPage == "Project" ? Icon(customIcons.project_here) : Icon(customIcons.project),
               key:  currentPage == "Project" ? Key( "projectHereIcon" ) : Key( "projectIcon" ),
               onPressed: ()
               {
                  if( currentPage == "Project" ) { return; }
                  // Can't directly use reloadCEProjects here - may not have selected a project yet.
                  if( appState.myPEQSummary != null ) { appState.updateAllocTree = true;  } // force alloc tree update
                  if( appState.myEquityPlan != null ) { appState.updateEquityPlan = true; } // force equity tree update
                  if( appState.myEquityPlan != null ) { appState.updateEquityView = true; } // force equity view creation on first pass
                  
                  MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEProjectPage());
                  confirmedNav( context, container, newPage );
               },
               iconSize: iconSize,
               ),
            IconButton(
               icon: currentPage == "Profile" ? Icon(customIcons.profile_here) : Icon(customIcons.profile),
               key:  currentPage == "Profile" ? Key( "profileHereIcon" ) : Key( "profileIcon" ),
               onPressed: ()
               {
                  if( currentPage == "Profile" ) { return; }
                  MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEProfilePage(), settings: RouteSettings( arguments: {"id": "", "profType": "Person"} ));
                  confirmedNav( context, container, newPage );
               },
               iconSize: iconSize,
               padding: EdgeInsets.fromLTRB(0.0, 0.0, 0.0, 1.0)
               ),
            miniSpace,
            IconButton(
               icon: currentPage == "Settings" ? Icon(customIcons.settings_here) : Icon(customIcons.settings),
               key:  currentPage == "Settings" ? Key( "settingsHereIcon" ) : Key( "settingsIcon" ),
               onPressed: ()
               {
                  if( currentPage == "Settings" ) { return; }
                  MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CESettingsPage());
                  confirmedNav( context, container, newPage );
               },
               iconSize: iconSize,
               padding: EdgeInsets.fromLTRB(0.0, 0.0, 0.0, 1.0)
               ),
            ]));
}
