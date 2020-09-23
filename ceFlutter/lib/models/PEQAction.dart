import 'package:random_string/random_string.dart';

// peqSummary built from peqactions

// Assignees split evenly

// Confirm does not require propose.  i.e. confirm relocate to most cols is OK

// Move to "pending peq" col is 'close'.
// action may occur with 'close', or project card move, or ceFlutter.
// result in ce must be identical either way.  1 function - does, say, confirm close, confirm relocate

class PEQAction {
   final String  id;
   final String  ceUID;            // ??? just .. metadata here?
   final String  ghUserName;       // actor.  i.e. grantor, proposer, confirmer, etc.
   final String  ghRepo;

   final String  verb;             // propose, confirm, reject
   final String  action;           // add, delete, update, relocate, grant
   final List<String> subject;     // update <assignee(s)> or
                                   // relocate <oldproj, oldcol, oldissue, newproj, newcol, newissue> or
                                   // grant <PEQId>
   
   final String  note;             // i.e. 'issue reopened, not full ce project layout, no related card moved"
   final String  entryDate;        // today  grant: today == PEQ:accrued.   planning: PEQaccrued = ""
   final String  rawReqBody;  

   PEQAction({this.id, this.ceUID, this.ghUserName, this.ghRepo,
            this.verb, this.action, this.subject,
            this.note, this.entryDate, this.rawReqBody });
            
   dynamic toJson() => {'id': id, 'ceUID': ceUID, 'ghUserName': ghUserName, 'ghRepo': ghRepo,
                           'verb': verb, 'action': action, 'subject': subject,
                           'note': note, 'entryDate': entryDate, 'rawReqBody': rawReqBody };
   
   factory PEQAction.fromJson(Map<String, dynamic> json) {

      var dynamicSubs = json['Subject'];

      // DynamoDB is not camelCase
      return PEQAction(
         id:         json['PEQActionId'],
         ceUID:      json['CEUID'],
         ghUserName: json['GHUserName'],
         ghRepo:     json['GHRepo'],

         verb:       json['Verb'],
         action:     json['Action'],
         subject:    new List<String>.from(dynamicSubs),

         note:       json['Note'],
         entryDate:  json['EntryDate'],
         rawReqBody: json['RawReqBody'],
         );
   }
   
   String toString() {
      String res = "\nPEQAction for ceUserId: " + ceUID;
      res += "\n    ghUser: " + ghUserName + ", repo: " + ghRepo;
      res += "\n    " + verb + ", " + action + " " + subject.toString();
      res += "\n    entry made: " + entryDate;
      res += "\n    " + note;
      res += "\n\n   " + rawReqBody; 
      return res;
   }


}

