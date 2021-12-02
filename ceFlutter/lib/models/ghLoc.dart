// ceFlutter use only

// Baseline unit for representing a location in GitHub
// GHLocations collects these to present an overall structural picture of a repo in GitHub
// This is not intended to be independently stored in dynamo, only in association with GHLocations

class GHLoc {
   final String ghProjectId;
   final String ghProjectName;
   final String ghColumnId;
   final String ghColumnName;
   final bool   active;         // ceServer writes in real time, ceFlutter reads after the fact.  May need legacy data during ingest.

   GHLoc({this.ghProjectId, this.ghProjectName, this.ghColumnId, this.ghColumnName });

   // Direction is ceServer -> aws -> ceFlutter, only.
   factory GHLoc.fromJson(Map<String, dynamic> json) {

      return GHLoc(
         ghProjectId:     json['GHProjectId'],
         ghProjectName:   json['GHProjectName'],
         ghColumnId:      json['GHColumnId'],
         ghColumnName:    json['GHColumnName'],
         active:          json['Active'] == "true" ? true : false;
         );
   }
   
   String toString() {
      String res = "";
      res += "\n    Project: " + ghProjectName + " (" + ghProjectId + ")";
      res += "\n    Column:  " +  ghColumnName + " (" + ghColumnId  + ")";
      res += "\n    " + active ? "Active!" : "Inactive.";
      return res;
   }

}
