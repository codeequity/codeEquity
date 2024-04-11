import 'package:ceFlutter/utils.dart';

enum PeqType   { allocation, plan, pending, grant, end } 

// Legally, only CEUIDs have signed agreements.  ceHolderId is binding.  hostHolderId is just a helpful comment.

class PEQ {
   final String        id;
   final String        ceProjectId;
         List<String>  ceHolderId;   // assignees evenly splitting this PEQ, CEUIDs    
   final List<String>  hostHolderId;   // assignees evenly splitting this PEQ, hostUserNames
   final String        ceGrantorId;

   final PeqType       peqType;      // usually from Master, sub created/inprogress, sub pending/accrued
   final int           amount;     
   final String        accrualDate;  // when accrued
   final double        vestedPerc;   // as of accrual date

   final List<String>  hostProjectSub; // project subs, i.e. ["Master", "codeEquity web front end"]
   final String        hostRepoId;    
   final String        hostIssueId;   
   final String        hostIssueTitle; // actually, issue-or-card title.

   final bool          active;       // has this PEQ been deliberately deleted, unlabeled or otherwise removed from project?

   PEQ({ required this.id, required this.ceProjectId, required this.ceHolderId, required this.hostHolderId, required this.ceGrantorId,
            required this.peqType, required this.amount, required this.accrualDate, required this.vestedPerc,
            required this.hostProjectSub, required this.hostRepoId, required this.hostIssueId, required this.hostIssueTitle,
            required this.active});

   dynamic toJson() => {'id': id, 'ceProjectId': ceProjectId, 'ceHolderId': ceHolderId, 'hostHolderId': hostHolderId, 'ceGrantorId': ceGrantorId,
                           'peqType': enumToStr(peqType), 'amount': amount, 'accrualDate': accrualDate, 'vestedPerc': vestedPerc,
                           'hostProjectSub': hostProjectSub, 'hostRepoId': hostRepoId, 'hostIssueId': hostIssueId,
                           'hostIssueTitle': hostIssueTitle, 'active': active }; 

   // No PEQ found.  return empty peq.
   factory PEQ.empty() {
      return PEQ(
         id:            "-1",
         ceProjectId:   "-1",
         ceHolderId:    [],
         hostHolderId:    [],
         ceGrantorId:   "-1",

         peqType:       PeqType.end,
         amount:        -1,
         accrualDate:   "-1",
         vestedPerc:    0.0,

         hostProjectSub:  [],
         hostRepoId:   "-1",
         hostIssueId:     "-1",
         hostIssueTitle:  "-1",

         active:        false,
         );
   }
      
   factory PEQ.fromJson(Map<String, dynamic> json) {

      var dynamicSub   = json['HostProjectSub'] ?? [];
      var dynamicAssCE = json['CEHolderId']     ?? [];
      var dynamicAssHost = json['HostHolderId'] ?? [];

      // DynamoDB is not camelCase
      return PEQ(
         id:            json['PEQId'],
         ceProjectId:   json['CEProjectId'],
         ceHolderId:    new List<String>.from(dynamicAssCE),
         hostHolderId:  new List<String>.from(dynamicAssHost),
         ceGrantorId:   json['CEGrantorId'] ?? "",

         peqType:       enumFromStr<PeqType>( json['PeqType'], PeqType.values ),
         amount:        json['Amount'],
         accrualDate:   json['AccrualDate'],
         vestedPerc:    json['VestedPerc'],

         hostProjectSub:  new List<String>.from(dynamicSub),
         hostRepoId:      json['HostRepoId'],
         hostIssueId:     json['HostIssueId'],
         hostIssueTitle:  json['HostIssueTitle'],

         active:        json['Active'] == "true" ? true : false,         
         );
   }
   
   String toString() {
      String res = "\n" + ceProjectId + " PEQs, active? " + active.toString();
      res += "\n   " + amount.toString() + " PEQ, for: " + hostIssueTitle;
      // res += "\n    grantor: " + ceGrantorId;
      res += "\n    type: " + enumToStr(peqType) + ", accrued: " + accrualDate + ", vested %: " + vestedPerc.toString();
      res += "\n    projectSub: " + hostProjectSub.toString() + " repoId: " + hostRepoId + ", issue: " + hostIssueId;
      // res += "\n    holder: " + ceHolderId.toString();
      res += "\n    HostholderId: " + hostHolderId.toString();
      res += "\n";

      return res;
   }


}

