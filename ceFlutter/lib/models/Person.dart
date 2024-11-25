import 'dart:typed_data';                   // ByteData

import 'package:flutter/material.dart';

// Dynamodb serializes primary key before using it... so...
class Person {
   final String id;
   String       firstName;
   String       lastName;
   String       userName;
   String       email;
   bool               locked;
   final Uint8List?   imagePng;     // ONLY   use to, from and in dynamoDB
   final Image?       image;        // ALWAYS use elsewhere

   Person({required this.id, required this.firstName, required this.lastName, required this.userName,
            required this.email, required this.locked, required this.imagePng, required this.image});
   
   dynamic toJson() {
      if( imagePng == null ) {
         return { 'id': id, 'firstName': firstName, 'lastName': lastName, 'userName': userName, 'email': email,
               'locked': false, 'imagePng': null }; 

      } else {
         return { 'id': id, 'firstName': firstName, 'lastName': lastName, 'userName': userName, 'email': email, 
               'locked': false, 'imagePng': String.fromCharCodes( imagePng! ) };
      }
   }
   
   factory Person.fromJson(Map<String, dynamic> json) {

      var imagePng;
      var image;
      final dynamicImage = json['ImagePng'];   // string rep of bytes
      if( dynamicImage != null ) {
         imagePng =  Uint8List.fromList( dynamicImage.codeUnits );   // codeUnits gets Uint16List
         image = Image.memory( imagePng );
      }
      
      return Person(
         id:          json['CEUserId'],
         firstName:   json['First'],
         lastName:    json['Last'],
         userName:    json['CEUserName'],
         email:       json['Email'],
         locked:      json['Locked'],
         imagePng:    imagePng,
         image:       image
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
         imagePng:    p.imagePng,
         image:       p.image
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
      if( image != null ) { res += "\n   there is an image"; }

      return res;
   }
}
