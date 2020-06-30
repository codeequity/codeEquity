

var githubUtils = {

    zoink: function() {
	return poink();
    },

    getColumns: function( ownerId, repoId ) {
	return columnInfo( ownerId, repoId );
    }

};



function columnInfo( ownerId, repoId ) {
    console.log( "Cols et. al.", ownerId, repoId );
    
}

function poink() {
    console.log( "ZOINK your PEQ!" );
}








// XXX 
// !!! Keep this, backend (githubIssueHandler) works.
//     remove this, remove load error for localHost
// ??  ifdef for window being global obj?
// ??  third by-hand step?  fug
exports.githubUtils = githubUtils;



