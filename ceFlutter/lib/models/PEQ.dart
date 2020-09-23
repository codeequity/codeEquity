import 'package:random_string/random_string.dart';

class PEQ {
   final String  id;
   final String  ceHolderId;
   final String  ceGrantorId;

   final String  type;           // type is grant/swCont/busOp
   final String  amount;     
   final String  accrualDate;    // when accrued
   final String  vestedPercent;  // as of accrual date

   final String  ghRepo;   
   final String  ghProject;      // sub for plannedAlloc
   final String  ghIssueId;   
   final String  ghIssueTitle; 

   PEQ({this.id, this.ceHolderId, this.ceGrantorId,
            this.type, this.amount, this.accrualDate, this.vestedPercent,
            this.ghRepo, this.ghProject, this.ghIssueId, this.ghIssueTitle});

   dynamic toJson() => {'id': id, 'ceHolderId': ceHolderId, 'ceGrantorId': ceGrantorId,
                           'type': type, 'amount': amount, 'accrualDate': accrualDate, 'vestedPercent': vestedPercent,
                           'ghRepo': ghRepo, 'ghProject': ghProject, 'ghIssueId': ghIssueId, 'ghIssueTitle': ghIssueTitle }; 
   
   factory PEQ.fromJson(Map<String, dynamic> json) {

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
         ghProject:     json['GHProject'],
         ghIssueId:     json['GHIssueId'],
         ghIssueTitle:  json['GHIssueTitle'],
         );
   }
   
   String toString() {
      String res = "\n" + ghRepo + " PEQs";
      res += "\n   " + amount + " PEQ, for: " + ghIssueTitle;
      res += "\n    holder: " + ceHolderId + ", grantor: " + ceGrantorId;
      res += "\n    type: " + type + ", accrued: " + accrualDate + ", vested %: " + vestedPercent;
      res += "\n    project: " + ghProject + ", issue: " + ghIssueId;
      return res;
   }


}

