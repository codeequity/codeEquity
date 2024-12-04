import 'dart:async';

import 'package:flutter/material.dart';

import 'package:ceFlutter/app_state_container.dart';
import 'package:ceFlutter/models/PEQ.dart';
import 'package:ceFlutter/models/Person.dart';
import 'package:ceFlutter/models/CEProject.dart';

import 'package:ceFlutter/models/app_state.dart';

import 'package:ceFlutter/utils/awsUtils.dart';
import 'package:ceFlutter/utils/widgetUtils.dart';
import 'package:ceFlutter/utils/ceUtils.dart';

import 'package:ceFlutter/screens/detail_page.dart';
import 'package:ceFlutter/screens/profile_page.dart';

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
   
   late final _Debounceable<Iterable<Widget>?, String, dynamic, dynamic, dynamic> _debouncedSearch;

   @override
   void initState() {
      super.initState();
      _debouncedSearch = _debounce<Iterable<Widget>?, String, dynamic, dynamic, dynamic>(_search);
   }

   Widget _makeGD( context, appState, obj, objName ) {
      final textWidth = appState.screenWidth * .4;
      void _setTitle( PointerEvent event ) {
         setState(() => appState.hoverChunk = objName );
      }
      void _unsetTitle( PointerEvent event ) {
         setState(() => appState.hoverChunk = "" );
      }
      
      return GestureDetector(
         onTap: () async
         {
            MaterialPageRoute? newPage = null;
            Map<String,String> screenArgs = {};
            
            if( obj is PEQ ) {
               List<String> holders = (obj as PEQ).hostHolderId;
               appState.selectedUser = ( holders.length > 0 ) ? holders[0] : appState.UNASSIGN_USER;
               List<String> cat = (obj as PEQ).hostProjectSub;
               cat.add( appState.selectedUser );
               appState.userPActUpdate = true;               
               newPage = MaterialPageRoute(builder: (context) => CEDetailPage(), settings: RouteSettings( arguments: cat ));
            }
            else if( obj is Person )   {
               screenArgs["id"] = (obj as Person).id;
               screenArgs["profType"] = "Person" ;
               newPage = MaterialPageRoute(builder: (context) => CEProfilePage(), settings: RouteSettings( arguments: screenArgs ));
            }
            else if( obj is CEProject) {
               screenArgs["id"] = (obj as CEProject).ceProjectId;
               screenArgs["profType"] = "CEProject";
               newPage = MaterialPageRoute(builder: (context) => CEProfilePage(), settings: RouteSettings( arguments: screenArgs ));
            }
            else {
               print( "Error.  Search object is not recognized. " );
               assert( false );
            }
            Navigator.push( context, newPage! );
         },
         child: makeActionableText( appState, objName, _setTitle, _unsetTitle, textWidth, false, 1 ),
         );
   }
   
   // Calls search API to search with the given query. Returns null when the call has been made obsolete.
   Future<Iterable<Widget>?> _search(String query, container, context, appState ) async {
      _currentQuery = query;

      // XXX error handling?
      final Iterable<Widget> options = await _getPossibilities.search(_currentQuery!, container, context, appState, _makeGD );
      
      // Hmmm... no detectable difference .... yet?  XXX
      // If another search happened while waiting for above, throw away these options.
      // if (_currentQuery != query) { print( "OI!" ); return null; }

      _currentQuery = null;
      
      return options;
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
            final List<Widget>? options = (await _debouncedSearch(controller.text, container, context, appState))?.toList();
            if (options == null) { return _lastOptions; }
            _lastOptions = List<ListTile>.generate(options.length, (int index) {
                  final Widget item = options[index];
                  return ListTile(
                     title: item,
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





// XXX minor - search only guarantees finding things that were in place before logging in.
class _getPossibilities {

   static Future<Iterable<Widget>> search(String query, container, context, appState, makeGD )  async
   {

      if (query == '') { return const Iterable<Widget>.empty(); }

      // XXX these expensive fetches should only happen once per login.
      List<Person>    cePeeps    = [];
      List<CEProject> ceProjects = [];

      // XXX peq issues 
      // XXX Allow search over all peqs for every user?  Expensive.  Limit to current user?  Limited.  Hmm...
      //     peqs are not much data, just get every one?  probably.  Should get over all user ceProj's as well.
      appState.selectedUser      = "U_kgDOBP2eEw";
      appState.selectedCEProject = "CE_FlutTest_ks8asdlg42";


      // Collect
      var futs = await Future.wait([
                                      fetchCEPeople( context, container ).then( (p) => cePeeps = p ),
                                      fetchCEProjects( context, container ).then( (p) => ceProjects = p ),
                                      updateUserPeqs( container, context )
                                      ]);
      List<PEQ>       ariPeqs    = appState.userPeqs[ appState.selectedUser ];  // XXX get all

      // Filter
      // XXX search should show first line where term shows up
      List<Person>?    filteredCEPeeps = cePeeps.where( (Person p) => ( p.userName.toString().toLowerCase().contains(query.toLowerCase())) ).toList();
      List<PEQ>?       filteredPeqs    = ariPeqs.where( (PEQ p) => ( p.toString().toLowerCase().contains(query.toLowerCase())) ).toList();
      List<CEProject>? filteredCEProjs = ceProjects.where( (CEProject p) => ( p.toString().toLowerCase().contains(query.toLowerCase())) ).toList();


      // Collate .. GD
      List<Widget> res = [];

      res.addAll( (filteredCEPeeps ?? []).map( (p) => makeGD( context, appState, p, p.userName )) );
      res.addAll( (filteredCEProjs ?? []).map( (p) => makeGD( context, appState, p, p.ceProjectId )) );
      res.addAll( (filteredPeqs    ?? []).map( (p) => makeGD( context, appState, p, p.hostIssueTitle )) );

      
      return res;
   }
}
