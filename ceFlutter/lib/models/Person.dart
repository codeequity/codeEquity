import 'dart:typed_data';                   // ByteData

import 'package:flutter/material.dart';

// Dynamodb serializes primary key before using it... so...
class Person {
   final String id;
   String       firstName;
   String       lastName;
   String       userName;
   String       email;
   bool         locked;

   Person({required this.id, required this.firstName, required this.lastName, required this.userName,
            required this.email, required this.locked});
   
   dynamic toJson() {
      return { 'id': id, 'firstName': firstName, 'lastName': lastName, 'userName': userName, 'email': email, 'locked': false }; 
   }

   // No one found.  return empty 
   factory Person.empty() {
      return Person( 
         id:         "-1",
         firstName:  "", 
         lastName:   "",
         userName:   "",
         email:      "",
         locked:     false,
         );
   }
   
   factory Person.fromJson(Map<String, dynamic> json) {

      return Person(
         id:          json['CEUserId'],
         firstName:   json['First'],
         lastName:    json['Last'],
         userName:    json['CEUserName'],
         email:       json['Email'],
         locked:      json['Locked'],
         );
   }

   factory Person.from(p) {

      return Person(
         id:          p.id,
         firstName:   p.firstName,
         lastName:    p.lastName,
         userName:    p.userName,
         email:       p.email,
         locked:      p.locked,
         );
   }

   String toString() {
      firstName = firstName;
      lastName  = lastName;
      userName  = userName;
      email     = email;

      String res = "\nPerson : " + firstName + " " + lastName;
      res += "\n   userName: " + userName;
      res += "\n   email: " + email;
      res += "\n   id: " + id;

      return res;
   }
}
