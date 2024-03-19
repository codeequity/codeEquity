import 'package:ceFlutter/utils.dart';

class CEProject {
   final String ceProjectId;
   final String ceProjectComponent;
   final String description;
   final String hostPlatform;
   final String organization;
   final String ownerCategory;
   final String projectMgmtSys;
   final List<Map<String, String>> repositories;  // [ {repoId: "", repoName: "" }, .. ]

   CEProject({ required this.ceProjectId, required this.ceProjectComponent,  required this.description,
            required this.hostPlatform,  required this.organization,  required this.ownerCategory,  required this.projectMgmtSys,  
            required this.repositories});

   dynamic toJson() => { 'ceProjectId': ceProjectId, 'ceProjectComponent': ceProjectComponent, 'description': description,
                            'hostPlatform': hostPlatform, 'organization': organization, 'ownerCategory': ownerCategory, 'projectMgmtSys': projectMgmtSys,
                            'repositories': repositories }; 

   // No CEProject found.  return empty 
   factory CEProject.empty() {
      return CEProject(
         ceProjectId:         "-1",
         ceProjectComponent:  "", 
         description:         "",
         hostPlatform:        "",
         organization:        "",
         ownerCategory:       "",
         projectMgmtSys:      "",
         repositories:        []
         );
   }
      
   factory CEProject.fromJson(Map<String, dynamic> json) {

      var dynamicRepos  = json['HostParts'] ?? {};
      var dynamicRList  = new List<Map<dynamic, dynamic>>.from( dynamicRepos['hostRepositories'] );

      List<Map<String, String>> repos = [];
      for( final r in dynamicRList ) {
         repos.add( {"repoName": r['repoName'], "repoId": r['repoId'] } );
      }
      

      // DynamoDB is not camelCase
      return CEProject(
         ceProjectId:        json['CEProjectId'],
         ceProjectComponent: json['CEProjectComponent'],
         description:        json['Description'],
         hostPlatform:       json['HostPlatform'],
         organization:       json['Organization'],
         ownerCategory:      json['OwnerCategory'],
         projectMgmtSys:     json['ProjectMgmtSys'],
         repositories:       repos
         );
   }
   
   String toString() {
      String res = "\n" + ceProjectId + " " + ceProjectComponent + " " + description; 
      res += "\n   " + hostPlatform + " " + organization + " " + ownerCategory; 
      res += "\n    Repositories: " + repositories.toString();
      res += "\n";

      return res;
   }


}

