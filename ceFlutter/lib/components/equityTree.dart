import 'package:flutter/material.dart';

// modeled after composition pattern here:
// https://medium.com/flutter-community/flutter-design-patterns-4-composite-23473cccf2b3
abstract class EquityTree {

   EquityTree?      findNode( List<String> target ); 
   List<EquityTree> depthFirstWalk( List<EquityTree> treeList );
   
   int    getAmount();
   String getTitle();
   String toStr();

   List<List<Widget>> getCurrent( container, {treeDepth = 0, ancestors = ""} );

   List<Widget> getTile();
}

mixin paths {

   String convertFromPath( List<String> target ) {
      String res = ""; 
      target.forEach( (s) => res = res + "/" + s );
      return res.length > 0 ? res.substring( 1 ) : res;
   }
      
   List<String> getPath( parent, title ) {
      List<String> res = [];
      if( parent != null ) {
         res = parent!.getPath( parent.parent, parent.getTitle() ); 
      }
      if( title != "Category" ) {  res.add( title ); }   // XXX formalize
      return res;
   }
     
   String getPathName( parent, title ) {
     List<String> p = this.getPath( parent, title );
     return this.convertFromPath( p ); 
  }


      
}
