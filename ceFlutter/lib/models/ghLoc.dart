// ceFlutter use only

// Baseline unit for representing a location in GitHub
// GHLocations collects these to present an overall structural picture of a repo in GitHub
// This is not intended to be independently stored in dynamo, only in association with GHLocations

class GHLoc {
   final String  ceProjectId;
   final String  hostProjectId;
   final String  hostProjectName;
   final String  hostColumnId;
   final String  hostColumnName;
   final String  hostUtility;
   final bool    active;         // ceServer writes in real time, ceFlutter reads after the fact.  May need legacy data during ingest.

   GHLoc({required this.ceProjectId, required this.hostProjectId, required this.hostProjectName, required this.hostColumnId, required this.hostColumnName,
            required this.hostUtility, required this.active});

   // Direction is ceServer -> aws -> ceFlutter, only.
   factory GHLoc.fromJson(Map<String, dynamic> json) {

      // print( json );
      
      return GHLoc(
         ceProjectId:       json['ceProjectId'],
         hostProjectId:     json['hostProjectId'],
         hostProjectName:   json['hostProjectName'],
         hostColumnId:      json['hostColumnId'],
         hostColumnName:    json['hostColumnName'],
         hostUtility   :    json['hostUtility'],
         active:            json['active'] == "true" ? true : false
         );
   }
   
   String toString() {
      String res = "";
      res += "\n    cep: " + ceProjectId + " Project: " + hostProjectName + " (" + hostProjectId + ")";
      res += "\n    Column:  " + hostColumnName  + " (" + hostColumnId  + ")";
      res += "\n    " + (active ? "Active!" : "Inactive.");
      return res;
   }

}
