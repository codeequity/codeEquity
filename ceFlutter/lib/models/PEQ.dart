import 'package:random_string/random_string.dart';

import 'package:ceFlutter/utils.dart';

enum PeqType   { allocation, plan, grant }

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

   PEQ({this.id, this.ceHolderId, this.ghHolderId, this.ceGrantorId,
            this.peqType, this.amount, this.accrualDate, this.vestedPerc,
            this.ghRepo, this.ghProjectSub, this.ghProjectId, this.ghIssueId, this.ghIssueTitle});

   dynamic toJson() => {'PEQId': id, 'CEHolderId': ceHolderId, 'GHHolderId': ghHolderId, 'CEGrantorId': ceGrantorId,
                           'PeqType': enumToStr(peqType), 'Amount': amount, 'AccrualDate': accrualDate, 'VestedPerc': vestedPerc,
                           'GHRepo': ghRepo, 'GHProjectSub': ghProjectSub, 'GHProjectId': ghProjectId, 'GHIssueId': ghIssueId,
                           'GHIssueTitle': ghIssueTitle }; 
   
   factory PEQ.fromJson(Map<String, dynamic> json) {

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
         );
   }
   
   String toString() {
      String res = "\n" + ghRepo + " PEQs";
      res += "\n   " + amount.toString() + " PEQ, for: " + ghIssueTitle;
      res += "\n    grantor: " + ceGrantorId;
      res += "\n    type: " + enumToStr(peqType) + ", accrued: " + accrualDate + ", vested %: " + vestedPerc.toString();
      res += "\n    projectSub: " + ghProjectSub.toString() + " projId: " + ghProjectId + ", issue: " + ghIssueId;
      res += "\n    holder: " + ceHolderId.toString();
      res += "\n    GHholder: " + ghHolderId.toString();

      return res;
   }


}

