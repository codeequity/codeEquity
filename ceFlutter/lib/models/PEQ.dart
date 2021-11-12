import 'package:random_string/random_string.dart';

import 'package:ceFlutter/utils.dart';

enum PeqType   { allocation, plan, pending, grant, end } 

// Legally, only CEUIDs have signed agreements.  ceHolderId is binding.  ghHolderId is just a helpful comment.

class PEQ {
   final String        id;
         List<String>  ceHolderId;   // assignees evenly splitting this PEQ, CEUIDs    
   final List<String>  ghHolderId;   // assignees evenly splitting this PEQ, ghUserNames
   final String        ceGrantorId;

   final PeqType       peqType;      // usually from Master, sub created/inprogress, sub pending/accrued
   final int           amount;     
   final String        accrualDate;  // when accrued
   final double        vestedPerc;   // as of accrual date

   final String        ghRepo;   
   final List<String>  ghProjectSub; // project subs, i.e. ["Master", "codeEquity web front end"]
   final String        ghProjectId;    
   final String        ghIssueId;   
   final String        ghIssueTitle; // actually, issue-or-card title.

   final bool          active;       // has this PEQ been deliberately deleted, unlabeled or otherwise removed from project?

   PEQ({this.id, this.ceHolderId, this.ghHolderId, this.ceGrantorId,
            this.peqType, this.amount, this.accrualDate, this.vestedPerc,
            this.ghRepo, this.ghProjectSub, this.ghProjectId, this.ghIssueId, this.ghIssueTitle,
            this.active});

   dynamic toJson() => {'PEQId': id, 'CEHolderId': ceHolderId, 'GHHolderId': ghHolderId, 'CEGrantorId': ceGrantorId,
                           'PeqType': enumToStr(peqType), 'Amount': amount, 'AccrualDate': accrualDate, 'VestedPerc': vestedPerc,
                           'GHRepo': ghRepo, 'GHProjectSub': ghProjectSub, 'GHProjectId': ghProjectId, 'GHIssueId': ghIssueId,
                           'GHIssueTitle': ghIssueTitle, 'Active': active }; 

   // No PEQ found.  return empty peq.
   factory PEQ.empty() {
      return PEQ(
         id:            "-1",
         ceHolderId:    new List<String>(),
         ghHolderId:    new List<String>(),
         ceGrantorId:   "-1",

         peqType:       PeqType.end,
         amount:        -1,
         accrualDate:   "-1",
         vestedPerc:    0.0,

         ghRepo:        "-1",
         ghProjectSub:  new List<String>(),
         ghProjectId:   "-1",
         ghIssueId:     "-1",
         ghIssueTitle:  "-1",

         active:        false,
         );
   }
      
   factory PEQ.fromJson(Map<String, dynamic> json) {

      print( "fromming " + json['PEQId'] );

      var dynamicSub   = json['GHProjectSub'];
      var dynamicAssCE = json['CEHolderId'];
      var dynamicAssGH = json['GHHolderId'];

      // DynamoDB is not camelCase
      return PEQ(
         id:            json['PEQId'],
         ceHolderId:    new List<String>.from(dynamicAssCE),
         ghHolderId:    new List<String>.from(dynamicAssGH),
         ceGrantorId:   json['CEGrantorId'],

         peqType:       enumFromStr<PeqType>( json['PeqType'], PeqType.values ),
         amount:        json['Amount'],
         accrualDate:   json['AccrualDate'],
         vestedPerc:    json['VestedPerc'],

         ghRepo:        json['GHRepo'],
         ghProjectSub:  new List<String>.from(dynamicSub),
         ghProjectId:   json['GHProjectId'],
         ghIssueId:     json['GHIssueId'],
         ghIssueTitle:  json['GHIssueTitle'],

         active:        json['Active'] == "true" ? true : false,         
         );
   }
   
   String toString() {
      String res = "\n" + ghRepo + " PEQs";
      res += "\n    active? " + active.toString();
      res += "\n   " + amount.toString() + " PEQ, for: " + ghIssueTitle;
      res += "\n    grantor: " + ceGrantorId;
      res += "\n    type: " + enumToStr(peqType) + ", accrued: " + accrualDate + ", vested %: " + vestedPerc.toString();
      res += "\n    projectSub: " + ghProjectSub.toString() + " projId: " + ghProjectId + ", issue: " + ghIssueId;
      res += "\n    holder: " + ceHolderId.toString();
      res += "\n    GHholder: " + ghHolderId.toString();
      res += "\n";

      return res;
   }


}

