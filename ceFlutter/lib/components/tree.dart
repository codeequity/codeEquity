import 'package:flutter/material.dart';

// modeled after composition pattern here:
// https://medium.com/flutter-community/flutter-design-patterns-4-composite-23473cccf2b3
abstract class Tree {
   int getAllocAmount();
   int getPlanAmount();
   int getPendingAmount();
   int getAccrueAmount();
   int getChildSurplusAmount();

   Tree? findNode( String target ); 
   
   String getTitle();
   String toStr();

   void setVis( visible );
   void reopenKids();

   List<List<Widget>> getCurrent( container, {treeDepth = 0, ancestors = ""} );

   Widget getTile();
}
