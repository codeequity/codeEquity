// DEPRECATED

@JS()                       // Sets the context, which in this case is `window`
library githubShots; // required library declaration called main, or whatever name you wish

import 'package:js/js.dart'; 


@JS('githubUtils')
class myUtils {
   external static zoink();
   external static getColumns( String ownerId, String repoId );
}


