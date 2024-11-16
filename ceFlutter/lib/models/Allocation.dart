import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/models/PEQ.dart';

// ceFlutter use only

// Baseline unit for representing an equity allocation for an assignee specific to a project/column.  There may be 1 or more peqs involved.
// PEQSummary collects these to present an overall provisional equity structure.
// This is not intended to be independently stored in dynamo, only in association with PEQSummary

// 1 Alloc per project/{project}/column/assignee .. so 1 peq      : m allocations  where m = number of assignees.
//                                                     1 assignee : n allocations where n = number of peqs for assignee

class Allocation {
   final List<String> category;        // i.e. [founding], [Software Contributions, Data Security, Planned, Unassigned]
   final List<String>? categoryBase;   // i.e. category, minus "planned", assignee
   int?               amount;          // amount of provisional equity for this category
   final Map<String,int>?  sourcePeq;  // all peqId:value that make up the total for this category.
   List<String>?      setInStone;      // all source peq ids that have confirm accrued.  These will not be further adjusted
   PeqType            allocType;
   final String?      ceUID;           // if Plan or Grant, who is it for
   final String?      hostUserName;    // hostUser associated with ceUID for this alloc
   final String       hostUserId;      // hostUser associated with ceUID for this alloc
   final double?      vestedPerc;      // granted or accrued
   final String?      notes;           // any details on category contents, i.e.: sam, lambda, cognito, dynamo
   final String?      hostProjectId;   // a fixed point that chains the category to a specific location in host

   Allocation({required this.category, this.categoryBase, this.amount, this.sourcePeq, this.setInStone,
            required this.allocType, this.ceUID, this.hostUserName, required this.hostUserId, this.vestedPerc, this.notes, this.hostProjectId });

   // Not explicitly constructed in lambda handler - watch caps
   dynamic toJson() => {'Category': category, 'CategoryBase': categoryBase, 'Amount': amount, 'SourcePEQ': sourcePeq, 'SetInStone': setInStone, 'AllocType': enumToStr(allocType),
                           'CEUID': ceUID, 'HostUserName': hostUserName, 'HostUserId': hostUserId,
                           'Vested': vestedPerc, 'Notes': notes, 'HostProjectId': hostProjectId };
   
   factory Allocation.fromJson(Map<String, dynamic> json) {

      assert( json != null );
      
      var dynamicCat     = json['Category'];
      var dynamicCatBase = json['CategoryBase'];
      var dynamicSource  = json['SourcePEQ'];
      var dynamicSIS     = json['SetInStone'];

      Map<String,int> sp = {};
      dynamicSource.forEach((k,v) { sp[k] = v; });

      // print( json );
      
      return Allocation(
         category:      new List<String>.from(dynamicCat),
         categoryBase:  new List<String>.from(dynamicCatBase),
         amount:        json['Amount'],
         sourcePeq:     sp,
         setInStone:    new List<String>.from(dynamicSIS ?? []),
         allocType:     enumFromStr<PeqType>( json['AllocType'], PeqType.values ),
         ceUID:         json['CEUID'],
         hostUserName:  json['HostUserName'] ?? "",
         hostUserId:    json['HostUserId'] ?? "",
         vestedPerc:    json['Vested'],
         notes:         json['Notes'],
         hostProjectId: json['HostProjectId']
         );
   }
   
   String toString() {
      String res = "\n" + category.toString() + "  " + (hostProjectId ?? "");
      res += "\n    " + enumToStr( allocType ) + " ceUID and hostUserName: " + (ceUID ?? "") + " " + (hostUserName ?? "") + " " + (hostUserId ?? "");
      res += "\n    Amount: "+ (amount ?? -1).toString() + " of which vested %: " + (vestedPerc ?? 0.0).toString();
      res += "\n    Source PEQs: " + (sourcePeq ?? []).toString();
      res += "\n    Set in stone: " + (setInStone ?? []).toString();
      res += "\n    Notes: " + (notes ?? "");
      return res;
   }

}
