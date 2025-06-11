import 'package:ceFlutter/utils/ceUtils.dart';   // enum 

// Assignees split evenly

// Patterns: 
//    confirm:{add,delete}     for adding or deleting planned, in progress, pending peqID, or master allocation
//    confirm:{notice}         for moving a plan peq between plan & in progress
//    {confirm,reject}:accrue  founder-authorized individuals
//    confirm:         grant   down the road, could see rejecting this as well - voting support
//    {prop,conf,rej}:update   peq or allocated peq amounts

//    confirm:relocate         to most, not all cols.  subject: [id, projId, colId]  psub has names.  transfer?  [id, newRepoName]
//    {prop,conf,rej}:change   assignees
//    confirm:change           title   subject: [id, newtitle]
//    reject:delete            delete accr
//    confirm:change           recreate accr in unclaimed.  subject: [oldId, newId].  note: recreate 
//    confirm:change           mod proj / col name.  subject: [oldName, newName].  note: proj/col rename

// Note: 
// Move to "pending peq" col is 'close'.
// action may occur with 'close', or project card move, or ceFlutter.
// result in ce must be identical either way.  1 function - does, say, confirm close, confirm relocate


enum PActVerb   { confirm, propose, reject }
enum PActAction { add, delete, notice, accrue, relocate, change }        // (add, delete, update), (grant, accrue), relocate, change
Map<String,String> PActNotes = Map.unmodifiable( {
      'addAssignee': "add assignee",
      'transfer':    "Transferred",
      'recreate':    "recreate",
      'colRename':   "Column rename",
      'transOut':    "Transferred out",
      'projRename':  "Project rename", 
      'remAssignee': "remove assignee", 
      'titRename':   "Change title", 
      'pvUpdate':    "peq val update",
      'badXfer':     "Bad transfer attempted"
   });

class PEQAction {
   final String  id;
   final String  ceUID;            // actor.
   final String  hostUserName;     // actor.  i.e. grantor, proposer, confirmer, etc.
   final String  hostUserId;       // actor.  i.e. grantor, proposer, confirmer, etc.
   final String  ceProjectId;

   final PActVerb   verb;      
   final PActAction action;           
   final List<String> subject;     // update:  <assignee(s)> or
                                   // relocate:  <oldproj, oldcol, oldissue, newproj, newcol, newissue> or
                                   // allocate, accrue, grant:  <PEQId>
                                   // change, col/proj rename: <projId, oldName, newName>, <colId, oldName, newName>
                                   // notice: <PEQId, "{reopen,close}, moved to column y">
                                   // NOTE: 0th arg is ALWAYS peqId
   
   final String  note;             // i.e. 'issue reopened, not full ce project layout, no related card moved"
   final String  entryDate;        // today  grant: today == PEQ:accrued.   planning: PEQaccrued = ""

   final bool    ingested;         // has this action been ingested yet to push info to summary?
   final bool    locked;           // is this action currently being ingested
   final int     timeStamp;        // for operation sequencing control

   PEQAction({required this.id, required this.ceUID, required this.hostUserName, required this.hostUserId, required this.ceProjectId,
            required this.verb, required this.action, required this.subject,
            required this.note, required this.entryDate,
            required this.ingested, required this.locked, required this.timeStamp });
            
   dynamic toJson() => {'id': id, 'ceUID': ceUID, 'hostUserName': hostUserName, 'hostUserId': hostUserId, 'ceProjectId': ceProjectId,
                           'verb': enumToStr(verb), 'action': enumToStr(action), 'subject': subject,
                           'note': note, 'entryDate': entryDate, 
                           'ingested': ingested, 'locked': locked, 'timeStamp': timeStamp };
   
   factory PEQAction.fromJson(Map<String, dynamic> json) {

      var dynamicSubs = json['Subject'];

      
      
      // DynamoDB is not camelCase
      return PEQAction(
         id:           json['PEQActionId'],
         ceUID:        json['CEUID'] ?? "",
         hostUserName: json['HostUserName'] ?? "",
         hostUserId:   json['HostUserId']   ?? "",
         ceProjectId:  json['CEProjectId'],

         verb:       enumFromStr<PActVerb>(   json['Verb'], PActVerb.values ),
         action:     enumFromStr<PActAction>( json['Action'], PActAction.values ),
         subject:    new List<String>.from(dynamicSubs),

         note:       json['Note'],
         entryDate:  json['EntryDate'],

         ingested:   json['Ingested'] == "true" ? true : false,
         locked:     json['Locked']   == "true" ? true : false,
         timeStamp:  int.parse( json['TimeStamp'] )
         );
   }
   
   String toString() {
      String res = "\nPEQAction for ceUserId: " + ceUID;
      res += "\n    hostUser: " + hostUserName + " " + hostUserId + ", ceProjectId: " + ceProjectId;
      res += "\n    " + enumToStr(verb) + ", " + enumToStr(action) + " " + subject.toString();
      // res += "\n    entry made: " + entryDate;
      // res += "\n    ingested, locked, timestamp: " + ingested.toString() + " " + locked.toString() + " " + timeStamp.toString();
      if( note != null && note != "" ) {
         res += "\n    " + note;
      }
      return res;
   }


}

