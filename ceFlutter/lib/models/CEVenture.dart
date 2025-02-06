
class CEVenture {
   final String  ceVentureId;
   final String  name;
   final String? web;

   CEVenture({ required this.ceVentureId, required this.ceName, this.web });

   dynamic toJson() => { 'CEVentureId': ceVentureId, 'Name': name, 'Website': web };

   // No CEVenture found.  return empty 
   factory CEVenture.empty() {
      return CEVenture(
         ceVentureId:  "-1",
         name:         "", 
         web:          "",
         );
   }
      
   factory CEVenture.fromJson(Map<String, dynamic> json) {

      // DynamoDB is not camelCase
      return CEVenture(
         ceVentureId:   json['CEVentureId'],
         name:          json['Name'],
         web:           json['Website']
         );
   }

   
   String toString() {
      String res = "\n" + name + " (" ceVentureId + ") " + web;
      res += "\n";
      return res;
   }

}

