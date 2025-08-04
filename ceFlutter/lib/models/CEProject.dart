class CEProject {
   final String ceProjectId;
   final String ceVentureId;
   final String name;
   final String description;
   final String hostPlatform;
   final String hostOrganization;
   final String ownerCategory;
   final String projectMgmtSys;
   final List<String> repositories;          //  host repoName
   final List<String> hostRepoId;            //  host repoId

   CEProject({ required this.ceProjectId, required this.ceVentureId, required this.name, required this.description,
            required this.hostPlatform, required this.hostOrganization, required this.ownerCategory,  required this.projectMgmtSys,  
               required this.repositories, required this.hostRepoId}) {
      assert( repositories.length == hostRepoId.length );
   }

   dynamic toJson() => { 'CEProjectId': ceProjectId, 'CEVentureId': ceVentureId, 'Name': name, 'Description': description,
         'HostPlatform': hostPlatform, 'HostOrganization': hostOrganization, 'OwnerCategory': ownerCategory, 'ProjectMgmtSys': projectMgmtSys,
            'Repositories': repositories, 'HostRepoId': hostRepoId }; 

   // No CEProject found.  return empty 
   factory CEProject.empty() {
      return CEProject(
         ceProjectId:         "-1",
         ceVentureId:         "-1",
         name:                "",
         description:         "",
         hostPlatform:        "",
         hostOrganization:    "",
         ownerCategory:       "",
         projectMgmtSys:      "",
         repositories:        [],   // XXX name
         hostRepoId:          []
         );
   }
      
   factory CEProject.fromJson(Map<String, dynamic> json) {

      var dynamicRepos  = json['HostParts'] ?? {};
      var dynamicRList  = dynamicRepos['hostRepositories'] != null ? new List<Map<dynamic, dynamic>>.from( dynamicRepos['hostRepositories'] ) : [];

      // Because ceProject does not cross hostPlatforms, both repoName and repoId can be assumed to be unique
      List<String> repos   = [];
      List<String> repoIds = [];
      for( final r in dynamicRList ) {
         repos.add(   r['repoName'] );
         repoIds.add( r['repoId'] ); 
      }

      print( "Working on " + json.toString() );
      
      // DynamoDB is not camelCase
      return CEProject(
         ceProjectId:        json['CEProjectId'],
         ceVentureId:        json['CEVentureId'],
         name:               json['Name'],
         description:        json['Description'],
         hostPlatform:       json['HostPlatform'],
         hostOrganization:   json['HostOrganization'] ?? "",  // Some host setups (like GH classic) don't have this
         ownerCategory:      json['OwnerCategory'],
         projectMgmtSys:     json['ProjectMgmtSys'],
         repositories:       repos,
         hostRepoId:         repoIds
         );
   }

   
   String toString() {
      String res = "\n" + name + " (" + ceProjectId + ") " + description;
      res += "\n   Part of the venture: " + ceVentureId;
      res += "\n   " + hostOrganization + " " + hostPlatform + " " + ownerCategory; 
      res += "\n    Repositories: " + repositories.toString();
      res += "\n";

      return res;
   }


}

