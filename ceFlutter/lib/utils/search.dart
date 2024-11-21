import 'dart:async';

import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/models/PEQ.dart';

import 'package:ceFlutter/utils/ceUtils.dart';

const Duration debounceDuration = Duration(milliseconds: 200);


class CESearch extends StatefulWidget {
   const CESearch();

   @override
   State<CESearch> createState() => _CESearchState();
}

class _CESearchState extends State<CESearch> {
   late var      container;
   late AppState appState;
   
   // The query currently being searched for. If null, there is no pending request.
   String? _currentQuery;
   
   // The most recent suggestions received from the API.
   late Iterable<Widget> _lastOptions = <Widget>[];
   
   late final _Debounceable<Iterable<String>?, String, dynamic, dynamic, dynamic> _debouncedSearch;
   
   // Calls search API to search with the given query. Returns null when the call has been made obsolete.
   Future<Iterable<String>?> _search(String query, container, context, appState ) async {
      _currentQuery = query;

      // XXX error handling?
      final Iterable<String> options = await _getPossibilities.search(_currentQuery!, container, context, appState );
      
      // Hmmm... no detectable difference .... yet?  XXX
      // If another search happened while waiting for above, throw away these options.
      // if (_currentQuery != query) { print( "OI!" ); return null; }

      _currentQuery = null;
      
      return options;
   }

   @override
   void initState() {
      super.initState();
      _debouncedSearch = _debounce<Iterable<String>?, String, dynamic, dynamic, dynamic>(_search);
   }

   @override
   Widget build(BuildContext context) {
      container   = AppStateContainer.of(context);
      appState    = container.state;
      assert( appState != null );
      
      return SearchAnchor(
         builder: (BuildContext context, SearchController controller)
         {
            return SearchBar(
               controller: controller,
               padding: const MaterialStatePropertyAll<EdgeInsets>( EdgeInsets.symmetric(horizontal: 16.0)),
               onTap: ()      { controller.openView(); },
               onChanged: (_) { controller.openView(); },
               leading: const Icon(Icons.search),
               );                           
         },
         suggestionsBuilder: (BuildContext context, SearchController controller) async
         {
            final List<String>? options = (await _debouncedSearch(controller.text, container, context, appState))?.toList();
            if (options == null) { return _lastOptions; }
            _lastOptions = List<ListTile>.generate(options.length, (int index) {
                  final String item = options[index];
                  return ListTile(
                     title: Text(item),
                     onTap: () { debugPrint('You just selected $item'); },
                     );
               });
            
            return _lastOptions;
         },
         );
   }
}


// NOTE: Debounceable below is a Flutter Example.
typedef _Debounceable<S, T, T1, T2, T3> = Future<S?> Function(T parameter, T1 p1, T2 p2, T3 p3);

// Returns a new function that is a debounced version of the given function.
//
// This means that the original function will be called only after no calls
// have been made for the given Duration.
_Debounceable<S, T, T1, T2, T3> _debounce<S, T, T1, T2, T3>(_Debounceable<S?, T, T1, T2, T3> function) {
   _DebounceTimer? debounceTimer;
   
   return (T parameter, T1 p1, T2 p2, T3 p3) async {
      if( debounceTimer != null && !debounceTimer!.isCompleted ) { debounceTimer!.cancel(); }
         
      debounceTimer = _DebounceTimer();
         try { await debounceTimer!.future; }
         catch (error) {
            if (error is _CancelException) {
               return null;
            }
            rethrow;
         }
         return function(parameter, p1, p2, p3);
   };
}

// A wrapper around Timer used for debouncing.
class _DebounceTimer {
   _DebounceTimer() { _timer = Timer(debounceDuration, _onComplete); }
   
   late final Timer _timer;
   final Completer<void> _completer = Completer<void>();
   
   void _onComplete() { _completer.complete(); }
   
   Future<void> get future => _completer.future;
   
   bool get isCompleted => _completer.isCompleted;
   
   void cancel() {
      _timer.cancel();
      _completer.completeError(const _CancelException());
   }
}

// An exception indicating that the timer was canceled.
class _CancelException implements Exception {
   const _CancelException();
}



// XXX populate
class _getPossibilities {

   static Future<Iterable<String>> search(String query, container, context, appState )  async
   {

      if (query == '') { return const Iterable<String>.empty(); }
      
      // Profiles for users, ceps
      // hosts

      // XXX oi
      // peq issues 
      // appState.selectedUser = "ariCETester";
      appState.selectedUser = "U_kgDOBP2eEw";
      await updateUserPeqs( container, context );  // XXX could probably skip this
      
      List<PEQ> ariPeqs = appState.userPeqs[ appState.selectedUser ]; 
      
      print( "We have " + ariPeqs.length.toString() + " ari items" );
      
      List<PEQ>? peqs = ariPeqs.where((PEQ p) => ( p.toString().toLowerCase().contains(query.toLowerCase())) ).toList();

      // host projects
      // host repos

      return (peqs ?? []).map( (p) => p.hostIssueTitle ); 
   }
}
