import 'dart:ui';
import 'dart:typed_data';
import 'dart:math';
import 'package:flutter/widgets.dart';
import 'package:flutter/material.dart';
import 'package:fluttertoast/fluttertoast.dart';

import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/utils_load.dart';

import 'package:ceFlutter/screens/home_page.dart';
import 'package:ceFlutter/screens/detail_page.dart';
import 'package:ceFlutter/screens/profile_page.dart';

import 'package:ceFlutter/customIcons.dart';

// XXX service?
// app-wide constants.  Break this out if more than, say, 3
const EMPTY = "---";


// enum accessibility funcs
// https://medium.com/@amir.n3t/advanced-enums-in-flutter-a8f2e2702ffd
String enumToStr(Object? o) => (o ?? "").toString().split('.').last;

T enumFromStr<T>(String key, List<T> values) => values.firstWhere((v) => key == enumToStr(v),
                                                                  orElse: (() { print( "Warning " + key + " not found"); return values[values.length - 1]; }));



String getToday() {
   final now = new DateTime.now();
   String date = "";

   if( now.month < 10 ) { date += "0"; }
   date = now.month.toString() + "/";

   if( now.day < 10 ) { date += "0"; }
   date += now.day.toString() + "/";
   
   date += now.year.toString();
   return date;
}

String randAlpha(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
   var charactersLength = characters.length;
   var rng = Random();
   for ( var i = 0; i < length; i++ ) {
      result += characters[ rng.nextInt( charactersLength ) ];
   }
   print( "Ralph returning " + result );
   return result;
}


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


// XXX would like a listview - longstanding issue with listview in alertDialog.
// https://github.com/flutter/flutter/issues/18108
/*
void popScroll( BuildContext context, scrollHeader, scrollBody, dismissFunc ) {
   showDialog(
      context: context,
      builder: (BuildContext context) {
                 return AlertDialog(
                    scrollable: true,
                    title: new Text( scrollHeader ),
                    content: Column(
                       mainAxisSize: MainAxisSize.min,
                       children: scrollBody
                       ),
                    actions: <Widget>[
                       new FlatButton(
                          key: Key( 'Dismiss' ),
                          child: new Text("Dismiss"),
                          onPressed: dismissFunc )
                       ]);
              });
}
*/
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
Widget makeHDivider( width, lgap, rgap, {tgap=0, bgap=0}) {
   return Padding(
      padding: EdgeInsets.fromLTRB(lgap, tgap, rgap, bgap),
      child: Container( width: width, height: 2, color: Colors.grey[200] ));
}
   

Widget paddedLTRB( child, double L, double T, double R, double B ) {
   return Padding(
      padding: EdgeInsets.fromLTRB(L,T,R,B),
      child: child );
}

String addCommas( int amount ) {
   String res = "";
   bool neg = amount < 0 ? true : false;
   if( neg ) { amount = -1 * amount; }
         
   String t = amount.toString();

   while( t.length > 3 ) {
      res = "," + t.substring( t.length - 3 ) + res;
      t = t.substring( 0, t.length - 3 );
   }
   res = t + res;
   
   if( neg ) { res = "-" + res; }
   return res;
}

Widget makeActionButton( appState, buttonText, fn ) {
   TextStyle style = TextStyle(fontFamily: 'Montserrat', fontSize: 14.0);
   return Material(
      elevation: 5.0,
      borderRadius: BorderRadius.circular(10.0),
      color: Color(0xff01A0C7),
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
      color: Color(0xff01A0C7),
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
      child: Container( height: height - appState.GAP_PAD - appState.TINY_PAD,
                        child: IntrinsicWidth(
                           key: Key( title ),
                           child: Text(title, softWrap: wrap, maxLines: lines, overflow: TextOverflow.ellipsis,
                                       style: TextStyle(fontSize: fontSize,
                                                        fontWeight: FontWeight.bold,
                                                        color:      title == appState.hoverChunk ? appState.BUTTON_COLOR : Colors.black,
                                                        decoration: title == appState.hoverChunk ? TextDecoration.underline : null ))))
         ));
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

Widget makeActionableText(  appState, title, hov, nohov, width, wrap, lines ) {
   
   return MouseRegion(
      onEnter: hov,
      onExit: nohov,
      cursor: SystemMouseCursors.click,
      child: Padding(
         padding: EdgeInsets.fromLTRB(appState.GAP_PAD, appState.MID_PAD, appState.TINY_PAD, 0),
         child: IntrinsicWidth(
            key: Key( title ),
            child: Text(title, softWrap: wrap, maxLines: lines, overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 14,
                                         color: title == appState.hoverChunk ? appState.BUTTON_COLOR : Colors.black,
                                         fontWeight: FontWeight.bold,
                                         decoration: title == appState.hoverChunk ? TextDecoration.underline : null
                           ))))
      );
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


// XXX Partial
PreferredSizeWidget makeTopAppBar( BuildContext context, currentPage ) {
   final container   = AppStateContainer.of(context);
   final appState    = container.state;
   final iconSize    = appState.screenHeight*.0422;
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
               Navigator.push( context, newPage );
            },
            iconSize: iconSize,
            padding: EdgeInsets.fromLTRB(0.0, 0.0, 0.0, 2.0)
            ),
         title: Text( "CodeEquity", style: new TextStyle( fontFamily: 'Mansalva', fontSize: 16 )),
         actions: <Widget>[
            IconButton(
               icon: currentPage == "Detail" ? Icon(customIcons.loan_here) : Icon(customIcons.loan),
               key:  currentPage == "Detail" ? Key( "loanHereIcon" ) : Key( "loanIcon" ),
               onPressed: ()
               {
                  if( currentPage == "Detail" ) { return; }
                  MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEDetailPage(), settings: RouteSettings( arguments: ["Initializing"] ));
                  Navigator.push( context, newPage);
               },
               iconSize: iconSize,
               ),
            IconButton(
               icon: currentPage == "Profile" ? Icon(customIcons.profile_here) : Icon(customIcons.profile),
               key:  currentPage == "Profile" ? Key( "profileHereIcon" ) : Key( "profileIcon" ),
               onPressed: ()
               {
                  if( currentPage == "Profile" ) { return; }
                  MaterialPageRoute newPage = MaterialPageRoute(builder: (context) => CEProfilePage());
                  Navigator.push( context, newPage );
               },
               iconSize: iconSize,
               padding: EdgeInsets.fromLTRB(0.0, 0.0, 0.0, 1.0)
               ),
            ]));
}



// XXX Placeholder.. maybe not?
Widget makeBotAppBar( BuildContext context, currentPage ) {
   final container   = AppStateContainer.of(context);
   final appState    = container.state;
   final iconSize    = appState.screenHeight*.0422;
   return SizedBox(
      height: appState.screenHeight*.054, 
      child: BottomAppBar(
         child: Row(
            mainAxisSize: MainAxisSize.max,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
               IconButton(
                  icon:  Icon(Icons.camera),
                  key:   Key( "homeIcon" ),
                  onPressed: ()
                  {
                  },
                  iconSize: iconSize,
                  padding: EdgeInsets.fromLTRB(0.0, 0.0, 0.0, 2.0)
                  ),
               Row(
                  mainAxisSize: MainAxisSize.max,
                  children: [
                     IconButton(
                        icon: Icon(Icons.camera),
                        key:  Key( "addProjectIcon" ),
                        onPressed: ()
                        {
                        },
                        iconSize: iconSize,
                        padding: EdgeInsets.fromLTRB(0.0, 0.0, 0.0, 2.0)
                        ),
                     IconButton(
                        icon: Icon(Icons.camera),
                        key:  Key( "profileIcon" ),
                        onPressed: ()
                        {
                        },
                        iconSize: iconSize,
                        padding: EdgeInsets.fromLTRB(0.0, 0.0, 0.0, 2.0)
                        )
                     ])
               ])));
}

