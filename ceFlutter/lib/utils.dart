import 'dart:ui';
import 'dart:typed_data';
import 'package:flutter/widgets.dart';
import 'package:flutter/material.dart';
import 'package:fluttertoast/fluttertoast.dart';

import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/screens/home_page.dart';


void notYetImplemented(BuildContext context) {
   Fluttertoast.showToast(
      msg: "Future feature",
      toastLength: Toast.LENGTH_SHORT,
      gravity: ToastGravity.CENTER,
      backgroundColor: Colors.pinkAccent,
      textColor: Colors.white,
      fontSize: 14.0
      );
}

void showToast(BuildContext context, msg) {
   Fluttertoast.showToast(
      msg: msg,
      toastLength: Toast.LENGTH_LONG,
      gravity: ToastGravity.CENTER,
      backgroundColor: Colors.pinkAccent,
      textColor: Colors.white,
      fontSize: 18.0
      );
}

void confirm( BuildContext context, confirmHeader, confirmBody, okFunc, cancelFunc ) {
   showDialog(
      context: context,
      builder: (BuildContext context) {
                 return AlertDialog(
                    title: new Text( confirmHeader ),
                    content: new Text( confirmBody ),
                    actions: <Widget>[
                       new FlatButton(
                          key: Key( 'confirmDelete' ),
                          child: new Text("Continue"),
                          onPressed: okFunc ),
                       new FlatButton(
                          key: Key( 'cancelDelete' ),
                          child: new Text("Cancel"),
                          onPressed: cancelFunc )
                       ]);
              });
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
      color: Color(0xff01A0C7),
      child: MaterialButton(
         key: Key( buttonText ),
         minWidth: appState.screenWidth - 30,
         padding: EdgeInsets.fromLTRB(20.0, 15.0, 20.0, 15.0),
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
         minWidth: appState.screenWidth * .25,
         onPressed: fn,
         child: Text( buttonText,
                      textAlign: TextAlign.center,
                      style: style.copyWith(
                         color: Colors.white, fontWeight: FontWeight.bold)),
         )
      );
}


Widget makeTitleText( title, width, wrap, lines ) {
   return Padding(
      padding: const EdgeInsets.fromLTRB(20, 6, 6, 0),
      child: Container( width: width,
                        key: Key( title ),
                        child: Text(title, softWrap: wrap, maxLines: lines, overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold))));
}

Widget makeAuthorText( author, width, wrap, lines ) {
   return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 6, 0),
      child: Container( width: width,
                        key: Key( author ),
                        child: Text("By: " + author, softWrap: wrap, maxLines: lines, overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 14, fontStyle: FontStyle.italic))));
}
      
Widget makeInputField( BuildContext context, hintText, obscure, controller ) {
   TextStyle style = TextStyle(fontFamily: 'Montserrat', fontSize: 20.0);
   return TextField(
      key: Key( hintText ),
      obscureText: obscure,
      style: style,
      decoration: InputDecoration(
         contentPadding: EdgeInsets.fromLTRB(20.0, 15.0, 20.0, 15.0),
         hintText: hintText,
         border: OutlineInputBorder(borderRadius: BorderRadius.circular(10.0))),
      controller: controller
      );
}


// XXX Placeholder
Widget makeTopAppBar( BuildContext context, currentPage ) {
   final container   = AppStateContainer.of(context);
   final appState    = container.state;
   final iconSize    = appState.screenHeight*.0422;
   return PreferredSize(
      preferredSize: Size.fromHeight( appState.screenHeight*.054 ),
      child: AppBar(
         leading: IconButton(
            icon: Icon(Icons.camera),
            key:  Key( "myLibraryIcon" ),
            onPressed: ()
            {
            },
            iconSize: iconSize,
            padding: EdgeInsets.fromLTRB(0.0, 0.0, 0.0, 2.0)
            ),
         title: Text( "CodeEquity", style: new TextStyle( fontFamily: 'Mansalva', fontSize: 16 )),
         actions: <Widget>[
            IconButton(
               icon: Icon(Icons.camera),
               key:  Key( "loanIcon" ),
               onPressed: ()
               {
               },
               iconSize: iconSize,
               ),
            IconButton(
               icon: Icon(Icons.camera),
               key:  Key( "searchIcon" ),
               onPressed: ()
               {
               },
               iconSize: iconSize,
               padding: EdgeInsets.fromLTRB(0.0, 0.0, 0.0, 1.0)
               ),
            ]));
}

// XXX Placeholder
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

