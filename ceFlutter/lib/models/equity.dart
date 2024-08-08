import 'package:ceFlutter/utils.dart';

// ceFlutter use only

// Baseline unit for representing one line in the CEProject's equity plan.
// This is not intended to be independently stored in dynamo, only in association with EquityPlan


class Equity {
   final List<String> category;        // i.e. [Software Contributions, Data Security]
   int                amount;          // amount of provisional equity for this category

   Equity({required this.category, required this.amount });

   dynamic toJson() => {'Category': category, 'Amount': amount };

   
   factory Equity.fromJson(Map<String, dynamic> json) {

      assert( json != null );
      
      var dynamicCat     = json['Category'];

      return Equity(
         category:      new List<String>.from(dynamicCat),
         amount:        json['Amount'],
         );
   }
   
   String toString() {
      String res = "\n" + category.toString() + "  " +" Amount: "+ amount.toString();
      return res;
   }

}
