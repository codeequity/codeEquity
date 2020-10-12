import 'package:random_string/random_string.dart';


class PEQ {
   final String  id;
   final String  ceHolderId;
   final String  ceGrantorId;

   final String  type;           // type is Allocation.  Plan.  Grant.  usually from Master, sub created/inprogress, sub pending/accrued
   final int     amount;     
   final String  accrualDate;    // when accrued
   final String  vestedPercent;  // as of accrual date

   final String        ghRepo;   
   final List<String>  ghProjectSub;      // project subs, i.e. ["Master", "codeEquity web front end"]
   final String        ghProjectId;    
   final String        ghIssueId;   
   final String        ghIssueTitle;      // actually, issue-or-card title.

   PEQ({this.id, this.ceHolderId, this.ceGrantorId,
            this.type, this.amount, this.accrualDate, this.vestedPercent,
            this.ghRepo, this.ghProjectSub, this.ghProjectId, this.ghIssueId, this.ghIssueTitle});

   dynamic toJson() => {'id': id, 'ceHolderId': ceHolderId, 'ceGrantorId': ceGrantorId,
                           'type': type, 'amount': amount, 'accrualDate': accrualDate, 'vestedPercent': vestedPercent,
                           'ghRepo': ghRepo, 'ghProjectSub': ghProjectSub, 'ghProjectId': ghProjectId, 'ghIssueId': ghIssueId,
                           'ghIssueTitle': ghIssueTitle }; 
   
   factory PEQ.fromJson(Map<String, dynamic> json) {

      var dynamicSub = json['GHProjectSub'];
      
      // DynamoDB is not camelCase
      return PEQ(
         id:            json['PEQId'],
         ceHolderId:    json['CEHolderId'],
         ceGrantorId:   json['CEGrantorId'],

         type:          json['Type'],
         amount:        json['Amount'],
         accrualDate:   json['AccrualDate'],
         vestedPercent: json['VestedPercent'],

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
      res += "\n    holder: " + ceHolderId + ", grantor: " + ceGrantorId;
      res += "\n    type: " + type + ", accrued: " + accrualDate + ", vested %: " + vestedPercent;
      res += "\n    projectSub: " + ghProjectSub.toString() + " projId: " + ghProjectId + ", issue: " + ghIssueId;
      return res;
   }


}

