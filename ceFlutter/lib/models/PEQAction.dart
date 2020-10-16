import 'package:random_string/random_string.dart';

import 'package:ceFlutter/utils.dart';

// Assignees split evenly

// Patterns: 
//    confirm:{add,delete}     for adding planned, in progress, pending peqID, or master allocation
//    {confirm,reject}:accrue  founder-authorized individuals
//    confirm:         grant   down the road, could see rejecting this as well - voting support
//    {prop,conf,rej}:update   peq or allocated peq amounts

//    confirm:relocate         to most, not all cols
//    {prop,conf,rej}:change   assignees

// Note: 
// Move to "pending peq" col is 'close'.
// action may occur with 'close', or project card move, or ceFlutter.
// result in ce must be identical either way.  1 function - does, say, confirm close, confirm relocate


enum PActVerb   { confirm, propose, reject }
enum PActAction { add, delete, accrue, relocate, change }        // (add, delete, update), (grant, accrue), relocate, change

class PEQAction {
   final String  id;
   final String  ceUID;            // ??? just .. metadata here?
   final String  ghUserName;       // actor.  i.e. grantor, proposer, confirmer, etc.
   final String  ghRepo;

   final PActVerb   verb;      
   final PActAction action;           
   final List<String> subject;     // update:  <assignee(s)> or
                                   // relocate:  <oldproj, oldcol, oldissue, newproj, newcol, newissue> or
                                   // allocate, accrue, grant:  <PEQId>
   
   final String  note;             // i.e. 'issue reopened, not full ce project layout, no related card moved"
   final String  entryDate;        // today  grant: today == PEQ:accrued.   planning: PEQaccrued = ""
   final String  rawReqBody;       // example use: final m = json.decode( rawReqBody ); print( m.keys ); print( m['project_card']['creator'] )

   final bool    ingested;         // has this action been ingested yet to push info to summary?
   final bool    locked;           // is this action currently being ingested
   final int     timeStamp;        // for operation sequencing control

   PEQAction({this.id, this.ceUID, this.ghUserName, this.ghRepo,
            this.verb, this.action, this.subject,
            this.note, this.entryDate, this.rawReqBody,
            this.ingested, this.locked, this.timeStamp });
            
   dynamic toJson() => {'id': id, 'ceUID': ceUID, 'ghUserName': ghUserName, 'ghRepo': ghRepo,
                           'verb': enumToStr(verb), 'action': enumToStr(action), 'subject': subject,
                           'note': note, 'entryDate': entryDate, 'rawReqBody': rawReqBody,
                           'ingested': ingested, 'locked': locked, 'timeStamp': timeStamp };
   
   factory PEQAction.fromJson(Map<String, dynamic> json) {

      var dynamicSubs = json['Subject'];

      
      
      // DynamoDB is not camelCase
      return PEQAction(
         id:         json['PEQActionId'],
         ceUID:      json['CEUID'],
         ghUserName: json['GHUserName'],
         ghRepo:     json['GHRepo'],

         verb:       enumFromStr<PActVerb>(   json['Verb'], PActVerb.values ),
         action:     enumFromStr<PActAction>( json['Action'], PActAction.values ),
         subject:    new List<String>.from(dynamicSubs),

         note:       json['Note'],
         entryDate:  json['EntryDate'],
         rawReqBody: json['RawBody'],         // start as string - rawBody can have many different types.  decode at runtime

         ingested:   json['Ingested'] == "true" ? true : false,
         locked:     json['Locked']   == "true" ? true : false,
         timeStamp:  int.parse( json['TimeStamp'] )
         );
   }
   
   String toString() {
      String res = "\nPEQAction for ceUserId: " + ceUID;
      res += "\n    ghUser: " + ghUserName + ", repo: " + ghRepo;
      res += "\n    " + enumToStr(verb) + ", " + enumToStr(action) + " " + subject.toString();
      res += "\n    entry made: " + entryDate;
      res += "\n    ingested, locked, timestamp: " + ingested.toString() + " " + locked.toString() + " " + timeStamp.toString();
      res += "\n    " + note;
      res += "\n    " + rawReqBody.substring(0,10) + "..."; 
      return res;
   }


}

