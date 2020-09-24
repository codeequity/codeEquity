import 'package:random_string/random_string.dart';

// CEProject is currently 1:1 with GHRepo.
// For each repo, track association between  issueId, and ghProj/col/cardID
// Makes webServer:issueHandler:close/reopen feasible without a gazillion rest calls to GH

class CEProject {
   final String       id;
   final String       ghRepo;        // reponame is form /owner/repo, so is unique

   final String       ghIssueId;

   final String       ghProjectId;
   final String       ghColumnId;
   final String       ghCardId;


   CEProject({this.id, this.ghRepo, this.ghIssueId, this.ghProjectId, this.ghColumnId, this.ghCardId });
            
   dynamic toJson() => {'id': id, 'ghRepo': ghRepo,
                           'ghIssueId': ghIssueId, 'ghProjectId': ghProjectId, 'ghColumnId': ghColumnId, 'ghCardId': ghCardId };
   
   factory CEProject.fromJson(Map<String, dynamic> json) {

      return CEProject(
         id:            json['ProjectId'],
         ghRepo:        json['GHRepo'],
         ghIssueId:     json['GHIssueId'],
         ghProjectId:   json['GHProjectId'],
         ghColumnId:    json['GHColumnId'],
         ghCardId:      json['GHCardId']
         );
   }
   
   String toString() {
      String res = "\n" + ghRepo + " issueId: " + ghIssueId;
      res += "\n    GH ProjectId, ColumnID, CardID: " + ghProjectId + " " + ghColumnId + " " + ghCardId;
      return res;
   }

}
