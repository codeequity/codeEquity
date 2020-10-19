import 'package:random_string/random_string.dart';

// CEProject is currently 1:1 with GHRepo.
// For each repo, track association between  issueId, and ghProj/col/cardID
// Makes webServer:issueHandler:close/reopen feasible without a gazillion rest calls to GH

class CEProject {
   final String       id;
   final String       ghRepo;        // reponame is form /owner/repo, so is unique
   final String       ghIssueId;     // this is unique, but not often used by octokit (!!)
   final String       ghIssueNum;    // oddly, octokit usually wants an issueNum, unique only within repo.

   final String       ghProjectId;
   final String       ghProjectName;

   final String       ghColumnId;
   final String       ghColumnName;

   final String       ghCardId;
   final String       ghCardTitle;


   CEProject({this.id, this.ghRepo, this.ghIssueId, this.ghIssueNum, this.ghProjectId, this.ghProjectName,
            this.ghColumnId, this.ghColumnName, this.ghCardId, this.ghCardTitle });
            
   dynamic toJson() => {'id': id, 'ghRepo': ghRepo, 'ghIssueId': ghIssueId, 'ghIssueNum': ghIssueNum, 
                           'ghProjectId': ghProjectId, 'ghProjectName': ghProjectName,
                           'ghColumnId': ghColumnId, 'ghColumnName': ghColumnName,
                           'ghCardId': ghCardId, 'ghCardTitle': ghCardTitle };
   
   factory CEProject.fromJson(Map<String, dynamic> json) {

      return CEProject(
         id:            json['ProjectId'],
         ghRepo:        json['GHRepo'],
         ghIssueId:     json['GHIssueId'],
         ghIssueNum:    json['GHIssueNum'],

         ghProjectId:   json['GHProjectId'],
         ghProjectName: json['GHProjectName'],

         ghColumnId:    json['GHColumnId'],
         ghColumnName:  json['GHColumnName'],

         ghCardId:      json['GHCardId']
         ghCardTitle:   json['GHCardTitle']
         );
   }
   
   String toString() {
      String res = "\n" + ghRepo + " issueId: " + ghIssueId + " issueNum " + ghIssueNum;
      res += "\n    GH ProjectId, name, ColumnID, CardID: " + ghProjectId + " " + ghProjectName + " " + ghColumnId + " " + ghCardId;
      res += "\n    columnName, cardTitle: " + ghColumnName + " " ghCardTitle
      return res;
   }

}
