import 'dart:convert';  // json encode/decode
import 'dart:io';       // httpheaders (not in http...!!)
import 'package:flutter/material.dart';

// import 'package:ceFlutter/githubShots.dart';

import 'package:http/http.dart' as http;

void main() {
  runApp(MyApp());
}

Future<http.Response> postIt( String shortName, postData ) async {
     print( shortName );
     // https://stackoverflow.com/questions/43871637/no-access-control-allow-origin-header-is-present-on-the-requested-resource-whe
     // https://medium.com/@alexishevia/using-cors-in-express-cac7e29b005b
     final gatewayURL = new Uri.http("127.0.0.1:3000", "/update/github");

     // need httpheaders app/json else body is empty
     final response =
        await http.post(
           gatewayURL,
           headers: {HttpHeaders.contentTypeHeader: 'application/json' },
           body: postData
           );
     
     return response;
  }

class MyApp extends StatelessWidget {
  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      home: MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  MyHomePage({Key key, this.title}) : super(key: key);

  final String title;

  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  int _counter = 0;


  
  Future<bool> pingGH(name) async {
     String postData = '{"Endpoint": "$name", "All": "false" }';
     var response = await postIt( "pingGH", postData );

     print( response.body );
     
     if (response.statusCode != 200) {
        print( "RESPONSE Single: " + response.statusCode.toString() + " " + json.decode(utf8.decode(response.bodyBytes)).toString());
        throw Exception('Failed to load books');
     }
     
     print( "There are " );
     return true;
  }
  
  Widget _makeButton( name ) {
     return FloatingActionButton(
        onPressed: () async
        {
           // myUtils.zoink();
           await pingGH(name);
           setState(() {  _counter++;  });
        },
        child: Icon(Icons.add));
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Text( 'You have pushed a button this many times:' ),
            Text( '$_counter', style: Theme.of(context).textTheme.headline4 ),
            Row(
               children: <Widget> [
                  _makeButton("Left"),
                  _makeButton("Right"),
                  ])
             ])),
       );
  }
}
