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
   CESearch({Key? key}) : super(key: key);

   @override
   State<CESearch> createState() => _CESearchState();
}

class _CESearchState extends State<CESearch> {
   late var      container;
   late AppState appState;

   late bool saBuilt;
   late SearchAnchor sa;
   
   // The query currently being searched for. If null, there is no pending request.
   String? _currentQuery;
   
   // The most recent suggestions received from the API.
   late Iterable<Widget> _lastOptions = <Widget>[];
   
   // late final _Debounceable<Iterable<Widget>?, String, dynamic, dynamic, dynamic> _debouncedSearch;
   late final _Debounceable<List<dynamic>?, String, dynamic, dynamic, dynamic> _debouncedSearch;

   @override
   void initState() {
      super.initState();
      _debouncedSearch = _debounce<List<dynamic>?, String, dynamic, dynamic, dynamic>(_search);
      saBuilt = false;
   }

   @override
   void dispose() {
      super.dispose();
      print( "ceSearch Disposessed!" );
   }

   /*
   Widget _makeGD( context, appState, obj, objName, objContext ) {
      final textWidth = appState.screenWidth * .4;

      GestureDetector gd = GestureDetector(
         onTap: () async
         {
            MaterialPageRoute? newPage = null;
            Map<String,String> screenArgs        = {};
            Map<String,dynamic> screenArgsDetail = {};
            print( "GD tap: " + appState.hoverChunk );
            
            if( obj is PEQ ) {
               List<String> holders = (obj as PEQ).hostHolderId;
               appState.selectedHostUID = ( holders.length > 0 ) ? holders[0] : appState.UNASSIGN_USER;
               List<String> cat = new List<String>.from( (obj as PEQ).hostProjectSub );
               cat.add( appState.selectedHostUID );
               screenArgsDetail["cat"] = cat;
               screenArgsDetail["id"]  = (obj as PEQ).ceProjectId;
               appState.userPActUpdate = true;
               newPage = MaterialPageRoute(builder: (context) => CEDetailPage(), settings: RouteSettings( arguments: screenArgsDetail ));
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
            confirmedNav( context, container, newPage! );
         },
         child: makeTitleText( appState, objName, textWidth, false, 1 ),
         // child: makeActionableText( appState, objName, "search"+objName, _set, _unset, textWidth, false, 1 ),         
         );

      /*
      Widget detail = makeTableText( appState, objContext, textWidth, appState.CELL_HEIGHT, false, 1, fontSize: 12 );

      Widget unit = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.start,
        children: [ gd, detail ]
        );

      return SizedBox( width: textWidth, height: appState.CELL_HEIGHT + 7.0, child: unit );
      */
      return gd;
   }
*/
   
   // Calls search API to search with the given query. Returns null when the call has been made obsolete.
   // Future<Iterable<Widget>?> _search(String query, container, context, appState ) async {
   Future<List<dynamic>?> _search(String query, container, context, appState ) async {
      _currentQuery = query;

      // XXX error handling?
      final List<dynamic> options = await _getPossibilities.search(_currentQuery!, container, context, appState );
      
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

      if( !saBuilt ) {

         SearchController controller = SearchController();

         sa = SearchAnchor(
            searchController: controller,            
            builder: (BuildContext context, SearchController controller)
            {
               print( "search anchor build" );
               SearchBar sb = SearchBar(
                  key: Key( 'SearchBar' ),
                  controller: controller,
                  padding: const MaterialStatePropertyAll<EdgeInsets>( EdgeInsets.symmetric(horizontal: 16.0)),
                  onTap:     ()  => controller.openView(),
                  onChanged: (_) => controller.openView(),
                  // overlayColor: MaterialStateProperty.all<Color>(Colors.red),
                  leading: const Icon(Icons.search),
                  );
               return sb;
            },
            dividerColor: Colors.purple[400],
              
            viewBuilder: (Iterable<Widget> suggestions) {
                              return  Padding(
                                 padding: EdgeInsets.fromLTRB(appState.TINY_PAD, 0, appState.TINY_PAD, 0),
                                 child: ListView(
                                    children: suggestions.toList()
                                    ));
                              /*
                              return MediaQuery.removePadding(
                                 context: context,
                                 removeTop: true,
                                 child: ListView(
                                    children: suggestions.toList()
                                    ),
                                 );
                              */
                           },

            suggestionsBuilder: (BuildContext context, SearchController controller) async
            {
               final List<dynamic>? options = (await _debouncedSearch(controller.text, container, context, appState))?.toList();
               if (options == null) { return _lastOptions; }
               _lastOptions = List<ListTile>.generate(options.length, (int index) {
                     final textWidth = appState.screenWidth * .4;
                     
                     final obj = options[index];
                     String objName = "";
                     if( obj is PEQ )            { objName = (obj as PEQ).hostIssueTitle; }
                     else if( obj is Person )    { objName = (obj as Person).userName; }
                     else if( obj is CEProject ) { objName = (obj as CEProject).ceProjectId; }
                     
                     final Widget sub  = makeTableText( appState, "Marion Marion", textWidth, appState.CELL_HEIGHT, false, 1, fontSize: 12 ); 
                     final Widget item = makeTitleText( appState, objName, textWidth, false, 1 );
                     
                     return ListTile(
                        dense: true,
                        minVerticalPadding: appState.TINY_PAD / 3.0,
                        title: item,
                        subtitle: sub,
                        onTap: ()
                        {
                           MaterialPageRoute? newPage = null;
                           Map<String,String> screenArgs        = {};
                           Map<String,dynamic> screenArgsDetail = {};

                           setState(() { controller.closeView(objName); });
                           
                           if( obj is PEQ ) {
                              List<String> holders = (obj as PEQ).hostHolderId;
                              appState.selectedHostUID = ( holders.length > 0 ) ? holders[0] : appState.UNASSIGN_USER;
                              List<String> cat = new List<String>.from( (obj as PEQ).hostProjectSub );
                              cat.add( appState.selectedHostUID );
                              screenArgsDetail["cat"] = cat;
                              screenArgsDetail["id"]  = (obj as PEQ).ceProjectId;
                              appState.userPActUpdate = true;
                              newPage = MaterialPageRoute(builder: (context) => CEDetailPage(), settings: RouteSettings( arguments: screenArgsDetail ));
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
                           confirmedNav( context, container, newPage! );
                        });
                        
                  });
               
               return _lastOptions;
            });
         setState( () => saBuilt = true );
      }
      return sa;
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

   static Future<List<dynamic>> search(String query, container, context, appState )  async
   {
      if (query == '') { return List<dynamic>.empty(); }
      
      print( "Searching" );
      
      assert( appState.ceProjects != [] );

      // Collect
      // Allows search over all peqs in all CEPS the currently logged-in user is connected to.
      var futs = await Future.wait([
                                      (appState.cePeople.length == 0 ?
                                      fetchCEPeople( context, container ).then( (p) => appState.cePeople = p ) :
                                      new Future<bool>.value(true) ),
                                      
                                      (!appState.gotAllPeqs ? 
                                       updateUserPeqs( container, context, getAll: true ) :
                                       new Future<bool>.value(true) ),
                                      
                                      ]);

      // Filter
      // XXX search should show a little more context per item (minimally, type of link)
      List<Person>?    filteredCEPeeps = appState.cePeople.where( (Person p) => ( p.userName.toString().toLowerCase().contains(query.toLowerCase())) ).toList();
      List<CEProject>? filteredCEProjs = appState.ceProjects.where( (CEProject p) => ( p.toString().toLowerCase().contains(query.toLowerCase())) ).toList();

      List<PEQ> filteredPeqs = [];
      for( final ceUID in appState.cePeople ) {
         if( appState.userPeqs[ ceUID.id ] != null ) {
            filteredPeqs.addAll( appState.userPeqs[ ceUID.id ].where( (PEQ p) => ( p.toString().toLowerCase().contains(query.toLowerCase())) ).toList() );
         }
      }                              

      // Collate
      List<dynamic> res = [];

      res.addAll( (filteredCEPeeps ?? []) );
      res.addAll( (filteredCEProjs ?? []) );
      res.addAll( (filteredPeqs    ?? []) );
      
      return res;
   }

}
