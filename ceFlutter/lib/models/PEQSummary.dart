import 'package:random_string/random_string.dart';

// No source here - only project owner / founder has perms to do this, and
// each individual grant is stored with full metadata

class PEQSummary {
   final String       id;
   final String       ghRepo;        // reponame is form /owner/repo, so is unique
   final bool         mostRecent;
   final List<String> summary;       // <"  Software Contributions:    10,000,000   < 1%", "   - sam, lambda, cognito, dynamo ">
   final String       dateComputed;

   PEQSummary({this.id, this.ghRepo, this.mostRecent, this.summary, this.dateComputed });
            
   dynamic toJson() => {'id': id, 'ghRepo': ghRepo, 'mostRecent': mostRecent, 'summary': summary, 'dateComputed': dateComputed };
   
   factory PEQSummary.fromJson(Map<String, dynamic> json) {

      var dynamicSum = json['Subject'];

      return PEQSummary(
         id:            json['PEQSummaryId'],
         ghRepo:        json['GHRepo'],
         mostRecent:    json['MostRecent'],
         summary:       new List<String>.from(dynamicSum),
         dateComputed:  json['DateComputed']
         );
   }
   
   String toString() {
      String res = "\n" + ghRepo + " Most recent? " + mostRecent.toString() + ", computed: " + dateComputed;
      res += "\n" + summary.toString();
      return res;
   }

}
