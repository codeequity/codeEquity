import 'dart:ui';

import 'package:flutter/widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';                 // imageGrid
import 'package:path/path.dart';                        // imageGrid 
import 'package:path_provider/path_provider.dart';      // imageGrid

import 'package:ceFlutter/app_state_container.dart';

import 'package:ceFlutter/utils/widgetUtils.dart';

import 'package:ceFlutter/models/app_state.dart';


class CEEditPage extends StatefulWidget {
   CEEditPage({Key? key}) : super(key: key);

  @override
  _CEEditState createState() => _CEEditState();
}

class _CEEditState extends State<CEEditPage> {

   late Map<String,String> screenArgs;

   late var      container;
   late AppState appState; 
   late bool     gotImages;

   late Widget   imageGrid;
   late Widget   title;
   late Widget   minispacer;

   late String   selectedImage;
   late String   lastImage;
   late bool     newPick;
   
   @override
   void initState() {
      super.initState();
      gotImages = false;
      selectedImage = "";
      lastImage = "";
      newPick = false;
   }

   @override
   void dispose() {
      super.dispose();
   }

   Future<Widget> makeImagePicker( appState ) async {
      
      final AssetManifest assetManifest = await AssetManifest.loadFromAssetBundle(rootBundle);
      final List<String> assetList = assetManifest.listAssets();
      final int          gridWidth = 5;
      final double       width = ( appState.screenWidth - 2.0 * appState.GAP_PAD ) / gridWidth ; 

      List<String> imageList = assetList.where( (a) => a.substring( 0, 7 ) == "images/" ).toList();
      imageList.sort();

      List<Widget> cards = imageList.map(
         (pix) => Card(
            shape: RoundedRectangleBorder( borderRadius: BorderRadius.circular(8.0) ),
            child: InkWell(
               splashColor: Colors.purple[400],
               onTap: () 
               {
                  setState( () => selectedImage = pix );
                  print( "Selected " + pix );
               },
               child: Padding(
                  padding: const EdgeInsets.all(5.0),
                  child: Stack(
                     children: <Widget>[
                        Container(alignment: Alignment.center, child: Image.asset( pix, width: width ) ),
                        Align(
                           alignment: Alignment.bottomRight, 
                           child: selectedImage == pix ? Icon( Icons.check ) : Container( width: 1 )
                           )]
                     )))
            )).toList();

      lastImage = selectedImage;
      return GridView.count(
         crossAxisCount:   gridWidth,
         padding:          const EdgeInsets.all( 6 ),
         crossAxisSpacing: appState.TINY_PAD,
         mainAxisSpacing:  appState.TINY_PAD,
         children: cards
         );
   }

   // One time update when make selection
   void updateImages( appState ) async {
      if( !gotImages || newPick ) {
         imageGrid = await makeImagePicker( appState );

         title = Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.start,
            children: <Widget>[
               makeTitleText( appState, "Select new profile image", appState.screenWidth / 3.0, false, 1, fontSize: 24 ),
               newPick ?
               Padding(
                  padding: EdgeInsets.fromLTRB(0, appState.TINY_PAD, 0, 0),
                  child: makeActionButtonFixed( appState, 'Update Profile', appState.screenWidth / 6.0, () => _updateProfile( appState )) )
               :
               minispacer
               ]);
         
         setState(() => gotImages = true );
      }
   }

   // Need to update dynamo.  else, how can person1 see person2 image?  
   Future<void> _updateProfile( appState ) async {
      print( "Oh yea, new image: " + selectedImage + " for " + screenArgs.toString() );
      // XXX update CEProfileImage table.   id, type (person, project), image.
   }
   
   Widget _makeBody( appState ) {
      Widget images     = Container( width: appState.GAP_PAD );
      double buffer     = 2.0 * appState.GAP_PAD + 2.0*appState.CELL_HEIGHT;   // leave space at top while scrolling images
      Widget daTitle    = minispacer;
      
      if( gotImages ) {
         images = ConstrainedBox(
            constraints: new BoxConstraints( maxWidth: appState.screenWidth, maxHeight: appState.screenHeight - buffer ),
            child: imageGrid
            );
         daTitle = title;
      }

      return ListView(
         scrollDirection: Axis.vertical,
         children: <Widget>[
            minispacer, 
            daTitle,
            minispacer, 
            images
            ]);
   }

   
   @override
      Widget build(BuildContext context) {

      print( "Edit page" );
      
      container = AppStateContainer.of(context);
      appState  = container.state;
      assert( appState != null );

      screenArgs = ModalRoute.of(context)!.settings.arguments as Map<String,String>;
      minispacer = Container( height: appState.GAP_PAD );
      
      newPick   = selectedImage != "" && selectedImage != lastImage; 
      updateImages( appState ); 
      
      return Scaffold(
         appBar: makeTopAppBar( context, "Edit" ),
         //bottomNavigationBar: makeBotAppBar( context, "Detail" ),
         body: _makeBody( appState )
         );
   }
}
