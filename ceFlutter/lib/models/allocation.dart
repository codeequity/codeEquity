import 'package:ceFlutter/utils.dart';
import 'package:ceFlutter/models/PEQ.dart';

// ceFlutter use only

// Baseline unit for representing an equity allocation.
// PEQSummary collects these to present an overall provisional equity structure.
// This is not intended to be independently stored in dynamo, only in association with PEQSummary

// 1 Alloc per project/{project}/column/assignee .. so 1 peq      : m allocations  where m = number of assignees.
//                                                     1 assignee : n allocations where n = number of peqs for assignee

class Allocation {
   final List<String> category;        // i.e. [founding], [Software Contributions, Data Security, Planned, Unassigned]
   final List<String>? categoryBase;    // i.e. category, minus "planned", assignee
   int?               amount;          // amount of provisional equity for this category
   Map<String,int>?   sourcePeq;       // all peqId:value that make up the total for this category. 
   PeqType            allocType;
   final String?      ceUID;           // if Plan or Grant, who is it for
   final String       hostUserName;    // hostUser associated with ceUID
   final String?      hostUserId;      // hostUser associated with ceUID
   double?            vestedPerc;      // granted or accrued
   final String?      notes;           // any details on category contents, i.e.: sam, lambda, cognito, dynamo
   final String?      hostProjectId;     // a fixed point that chains the category to a specific location in GH

   Allocation({required this.category, this.categoryBase, this.amount, this.sourcePeq,
            required this.allocType, this.ceUID, required this.hostUserName, this.hostUserId, this.vestedPerc, this.notes, this.hostProjectId });

   // Not explicitly constructed in lambda handler - watch caps
   dynamic toJson() => {'Category': category, 'CategoryBase': categoryBase, 'Amount': amount, 'SourcePEQ': sourcePeq, 'AllocType': enumToStr(allocType),
                           'CEUID': ceUID, 'HostUserName': hostUserName, 'HostUserId': hostUserId,
                           'Vested': vestedPerc, 'Notes': notes, 'GHProjectId': hostProjectId };
   
   factory Allocation.fromJson(Map<String, dynamic> json) {

      assert( json != null );
      
      var dynamicCat     = json['Category'];
      var dynamicCatBase = json['CategoryBase'];
      var dynamicSource  = json['SourcePEQ'];

      Map<String,int> sp = {};
      dynamicSource.forEach((k,v) { sp[k] = v; });

      // print( json );
      
      return Allocation(
         category:      new List<String>.from(dynamicCat),
         categoryBase:  new List<String>.from(dynamicCatBase),
         amount:        json['Amount'],
         sourcePeq:     sp,
         allocType:     enumFromStr<PeqType>( json['AllocType'], PeqType.values ),
         ceUID:         json['CEUID'],
         hostUserName:  json['HostUserName'] ?? "",
         hostUserId:    json['HostUserId'] ?? "",
         vestedPerc:    json['Vested'],
         notes:         json['Notes'],
         hostProjectId:   json['HostProjectId']
         );
   }
   
   String toString() {
      String res = "\n" + category.toString() + "  " + (hostProjectId ?? "");
      res += "\n    " + enumToStr( allocType ) + " ceUID and hostUserName: " + (ceUID ?? "") + " " + hostUserName + " " + (hostUserId ?? "");
      res += "\n    Amount: "+ (amount ?? -1).toString() + " of which vested %: " + (vestedPerc ?? 0.0).toString();
      res += "\n    Source PEQs: " + (sourcePeq ?? []).toString();
      res += "\n    Notes: " + (notes ?? "");
      return res;
   }

}
