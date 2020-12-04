
// CELinkage is currently 1:1 with GHRepo.
// For each repo, track association between  issueId, and ghProj/col/cardID
// Makes webServer:issueHandler:close/reopen feasible without a gazillion rest calls to GH

class CELinkage {
   final String       ghIssueId;     // this is unique, but not often used by octokit (!!)
   final String       ghCardId;

   final String       ghRepo;        // reponame is form /owner/repo, so is unique
   final String       ghIssueNum;    // oddly, octokit usually wants an issueNum, unique only within repo.

   final String       ghProjectId;
   final String       ghProjectName;

   final String       ghColumnId;
   final String       ghColumnName;

   final String       ghCardTitle;


   CELinkage({this.ghIssueId, this.ghCardId, this.ghRepo, this.ghIssueNum, this.ghProjectId, this.ghProjectName,
            this.ghColumnId, this.ghColumnName, this.ghCardTitle });
            
   dynamic toJson() => {'ghIssueId': ghIssueId, 'ghCardId': ghCardId, 'ghRepo': ghRepo, 'ghIssueNum': ghIssueNum, 
                           'ghProjectId': ghProjectId, 'ghProjectName': ghProjectName,
                           'ghColumnId': ghColumnId, 'ghColumnName': ghColumnName,
                           'ghCardTitle': ghCardTitle };
   
   factory CELinkage.fromJson(Map<String, dynamic> json) {

      return CELinkage(

         ghIssueId:     json['GHIssueId'],
         ghCardId:      json['GHCardId']

         ghRepo:        json['GHRepo'],
         ghIssueNum:    json['GHIssueNum'],

         ghProjectId:   json['GHProjectId'],
         ghProjectName: json['GHProjectName'],

         ghColumnId:    json['GHColumnId'],
         ghColumnName:  json['GHColumnName'],

         ghCardTitle:   json['GHCardTitle']
         );
   }
   
   String toString() {
      String res = "\n" + ghRepo + " issueId: " + ghIssueId + " issueNum " + ghIssueNum;
      res += "\n    GH ProjectId, name, ColumnID, CardID: " + ghProjectId + " " + ghProjectName + " " + ghColumnId + " " + ghCardId;
      res += "\n    columnName, cardTitle: " + ghColumnName + " " + ghCardTitle;
      return res;
   }

}
