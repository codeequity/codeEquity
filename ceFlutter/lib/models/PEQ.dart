import 'package:ceFlutter/utils.dart';

enum PeqType   { allocation, plan, pending, grant, end } 

// Legally, only CEUIDs have signed agreements.  ceHolderId is binding.  hostHolderId is just a helpful comment.

class PEQ {
   final String  id;
   String        ceProjectId;
   List<String>  ceHolderId;   // assignees evenly splitting this PEQ, CEUIDs    
   List<String>  hostHolderId; // assignees evenly splitting this PEQ, hostUserNames
   String        ceGrantorId;

   PeqType       peqType;      // usually from Master, sub created/inprogress, sub pending/accrued
   int           amount;     
   String        accrualDate;  // when accrued
   double        vestedPerc;   // as of accrual date

   List<String>  hostProjectSub; // project subs, i.e. ["Master", "codeEquity web front end"]
   String        hostRepoId;    
   String        hostIssueId;   
   String        hostIssueTitle; // actually, issue-or-card title.

   bool          active;       // has this PEQ been deliberately deleted, unlabeled or otherwise removed from project?

   PEQ({ required this.id, required this.ceProjectId, required this.ceHolderId, required this.hostHolderId, required this.ceGrantorId,
            required this.peqType, required this.amount, required this.accrualDate, required this.vestedPerc,
            required this.hostProjectSub, required this.hostRepoId, required this.hostIssueId, required this.hostIssueTitle,
            required this.active});

   dynamic toJson() => {'PEQId': id, 'CEProjectId': ceProjectId, 'CEHolderId': ceHolderId, 'HostHolderId': hostHolderId, 'CEGrantorId': ceGrantorId,
                           'PeqType': enumToStr(peqType), 'Amount': amount, 'AccrualDate': accrualDate, 'VestedPerc': vestedPerc,
                           'HostProjectSub': hostProjectSub, 'HostRepoId': hostRepoId, 'HostIssueId': hostIssueId,
                              'HostIssueTitle': hostIssueTitle, 'Active': active ? "true" : "false" };

   
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

      // XXX Modules Until work on ceServer can start again, strip everything to do with Software Contributions here
      List<String> hps = new List<String>.from(dynamicSub);
      hps.removeWhere( (cat) => cat == "Software Contributions" );
      
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

         hostProjectSub:  hps,
         hostRepoId:      json['HostRepoId'],
         hostIssueId:     json['HostIssueId'],
         hostIssueTitle:  json['HostIssueTitle'],

         active:        json['Active'] == "true" ? true : false,         
         );
   }
   
   void set( String attr, var value ) {
      switch( attr ) {
      case "id":             assert( this.id == value );                                    break;
      case "ceProjectId":    this.ceProjectId = value;                                      break;
      case "ceHolderId":     this.ceHolderId = new List<String>.from( value );              break;
      case "hostHolderId":   this.hostHolderId = new List<String>.from( value );            break;
      case "ceGrantorId":    this.ceGrantorId = value;                                      break;
      case "peqType":        this.peqType = enumFromStr<PeqType>( value, PeqType.values );  break;
      case "amount":         this.amount = value;                                           break;
      case "accrualDate":    this.accrualDate = value;                                      break;
      case "vestedPerc":     this.vestedPerc = value;                                       break;
      case "hostProjectSub":
         this.hostProjectSub = new List<String>.from( value );
         // XXX Modules Until work on ceServer can start again, strip everything to do with Software Contributions here
         this.hostProjectSub.removeWhere( (cat) => cat == "Software Contributions" );
         break;
      case "hostRepoId":     this.hostRepoId = value;                                       break;
      case "hostIssueId":    this.hostIssueId = value;                                      break;
      case "hostIssueTitle": this.hostIssueTitle = value;                                   break;
      case "active":         this.active = value;                                           break;
      default:
         print( "PEQ setter failed, did not find attribute: " + attr );
         assert( false );
         break;
      }
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

