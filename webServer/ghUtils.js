var config  = require('./config');

var githubUtils = {

    zoink: function() {
	return poink();
    },

    getColumns: function( ownerId, repoId ) {
	return columnInfo( ownerId, repoId );
    },

    getPEQLabel: function( labels ) {
	return getPEQLabel( labels );
    },

    parsePEQ: function( cardContent ) {
	return parsePEQ( cardContent );
    },

};



function getPEQLabel( labels ) {
    console.log( "Retrieving PEQ amount, type" );
    return 1000;
}

function parsePEQ( content ) {
    let peqValue = 0;
    console.log( "Looking for planned PEQ" );
    for( const line of content ) {
	let s =  line.indexOf( config.PEQ_ );

	if( s > -1 ){
	    let lineVal = line.substring( s );
	    let e = lineVal.indexOf( ">" );
	    if( e == -1 ) {
		console.log( "Malformed peq" );
		break;
	    }
	    let numStart = config.PEQ_.length;
	    console.log( "Found peq val in ", s, e, lineVal.substring(numStart, e) );
	    peqValue = parseInt( lineVal.substring( numStart, e ) );
	    console.log( peqValue );
	    break;
	}
    }
    return peqValue;
}

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



