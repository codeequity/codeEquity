import 'package:flutter/material.dart';

// modeled after composition pattern here:
// https://medium.com/flutter-community/flutter-design-patterns-4-composite-23473cccf2b3
abstract class Tree {
   int getAmount();
   String getTitle();
   String toStr();
   Widget render(BuildContext context);
}
