import 'dart:math';

// ceFlutter use only

class EquityPlan {
   final String              ceProjectId;   // Summaries are per ceProject.. this is the pkey
   final List<List<String>>  categories;    // e.g. [[ Software Contributions, Data Security], ... ]
   final List<int>           amounts;       // e.g. [ 1000000, ... ]  
   final String              lastMod;

   EquityPlan({ required this.ceProjectId, required this.categories, required this.amounts, required this.lastMod }) {
      assert( categories.length == amounts.length );
   }
            
   dynamic toJson() => { 'ceProjectId': ceProjectId, 'categories': categories, 'amounts': amounts, 'lastMod': lastMod };
   
   factory EquityPlan.fromJson(Map<String, dynamic> json) {

      return EquityPlan(
         ceProjectId:   json['CEProjectId'],
         categories:    json['Categories'],
         amounts:       json['Amounts'],
         lastMod:       json['LastMod'],
         );
   }

   // Moving down?  all between move up.
   // XXX Hmm... or use 'removeAt' and 'insert'
   void move( int oldIndex, int newIndex ) {
      assert( categories.length == amounts.length );
      assert( oldIndex < categories.length );
      assert( newIndex < categories.length );

      var tmpCat = categories[oldIndex];
      var tmpAmt = amounts[oldIndex];

      if( oldIndex < newIndex ) {  // move in-betweens up
         for( int i = oldIndex + 1; i <= newIndex; i++ ) {
            categories[i-1] = categories[i];
            amounts[i-1]    = amounts[i];
         }
      }
      else { // move in-betweens down
         for( int i = oldIndex; i > newIndex; i-- ) {
            categories[i] = categories[i-1];
            amounts[i]    = amounts[i-1];
         }
      }

      categories[newIndex] = tmpCat;
      amounts[newIndex]    = tmpAmt;
   }
   
   String toString() {
      String res = "\n" + ceProjectId + " last modified: " + lastMod;
      for( int i = 0; i < categories.length; i++ ) {
         res += "   " + amounts[i].toString() + " " +  categories[i].toString();
      }
      return res;
   }

}
