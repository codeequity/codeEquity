import 'package:random_string/random_string.dart';

import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/models/PEQ.dart';

// ceFlutter use only

// Baseline unit for representing an equity allocation.
// PEQSummary collects these to present an overall provisional equity structure.
// This is not intended to be independently stored in dynamo, only in association with PEQSummary

class Allocation {
   final List<String> category;        // i.e. [founding], [software contributions, awsOperations]
   int                amount;          // amount of provisional equity for this category
   List<String>       sourcePeq;       // all PEQs that make up the total for this category.  
   PeqType            allocType;
   final String       ceUID;           // if Plan or Grant, who is it for
   final String       ghUserName;      // ghUser associated with ceUID
   double             vestedPerc;      // granted or accrued
   final String       notes;           // any details on category contents, i.e.: sam, lambda, cognito, dynamo

   Allocation({this.category, this.amount, this.sourcePeq, this.allocType, this.ceUID, this.ghUserName, this.vestedPerc, this.notes });

   // Not explicitly constructed in lambda handler - watch caps
   dynamic toJson() => {'Category': category, 'Amount': amount, 'SourcePEQ': sourcePeq, 'AllocType': enumToStr(allocType),
                           'CEUID': ceUID, 'GHUserName': ghUserName, 
                           'Vested': vestedPerc, 'Notes': notes };
   
   factory Allocation.fromJson(Map<String, dynamic> json) {

      var dynamicCat    = json['Category'];
      var dynamicSource = json['SourcePEQ'];

      return Allocation(
         category:      new List<String>.from(dynamicCat),
         amount:        json['Amount'],
         sourcePeq:     new List<String>.from(dynamicSource),
         allocType:     enumFromStr<PeqType>( json['AllocType'], PeqType.values ),
         ceUID:         json['CEUID'],
         ghUserName:    json['ghUserName'],
         vestedPerc:    json['Vested'],
         notes:         json['Notes']
         );
   }
   
   String toString() {
      String res = "\n" + category.toString();
      res += "\n    " + enumToStr( allocType ) + " ceUID and ghUserName: " + ceUID + " " + ghUserName;
      res += "\n    Amount: "+ amount.toString() + " of which vested %: " + vestedPerc.toString();
      res += "\n    Source PEQs: " + sourcePeqs.toString();
      res += "\n    Notes: " + notes;
      return res;
   }

}
