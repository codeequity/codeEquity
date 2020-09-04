import 'package:random_string/random_string.dart';

class PEQ {
   String        id;
   final String  amount;
   final String  title;
   final String  userId;

   PEQ({this.id, this.amount, this.title, this.userId});


   dynamic toJson() => {'id': id, 'amount': amount, 'title': title, 'userId': userId  };
   
   factory PEQ.fromJson(Map<String, dynamic> json) {

      // DynamoDB is not camelCase
      // All fields here have values, else something is broken in load
      return PEQ(
         id:            json['PEQId'],
         amount:        json['PeqAmount'],
         title:         json['Title'],
         userId:        json['UserId']
         );
   }
   
   String toString() {
      print( "PEQ: " + title + amount );
      print( "user: " + userId );

      String res = "\nPEQ : " + title + " "  + amount;
      res += "\n   user: " + userId;
      return res;
   }


}

