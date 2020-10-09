import 'package:random_string/random_string.dart';

// XXX floats
// Baseline unit for representing an equity allocation.
// PEQSummary collects these to present an overall provisional equity structure.
// This is not intended to be independently stored in dynamo, only in association with PEQSummary

class Allocation {
   final List<String> category;        // i.e. [founding], [software contributions, awsOperations]
   int                amount;          // planned amount of provisional equity set aside for this category
   int                committed;       // granted and/or accrued
   final String       notes;           // any details on category contents, i.e.: sam, lambda, cognito, dynamo

   Allocation({this.category, this.amount, this.committed, this.notes });

   // Not explicitly constructed in lambda handler - watch caps
   dynamic toJson() => {'Category': category, 'Amount': amount, 'Committed': committed, 'Notes': notes };
   
   factory Allocation.fromJson(Map<String, dynamic> json) {

      var dynamicCat = json['Category'];

      return Allocation(
         category:      new List<String>.from(dynamicCat),
         amount:        json['Amount'],
         committed:     json['Committed'],
         notes:         json['Notes']
         );
   }
   
   String toString() {
      String res = "\n" + category.toString();
      res += "\n    Amount: "+ amount.toString() + " of which committed: " + committed.toString();
      res += "\n    Notes: " + notes;
      return res;
   }

}
