const assert = require( 'assert' );

const config  = require( '../config' );

const awsUtils = require( '../utils/awsUtils' );

// A simple fast lookup map to get ceProjectIds from job data
class CEProjects {

    constructor( ) {
	// { host: { org: { hostProjId: ceProjId }}}
	this.cep = {};
    }  


    find( host, org, hostProjId ) {
	let retVal = config.EMPTY;
	if( this.cep.hasOwnProperty( host )) {
	    if( this.cep[host].hasOwnProperty( org )) {
		if( this.cep[host][org].hasOwnProperty( hostProjId )) {
		    retVal = this.cep[host][org][hostProjId];
		}
	    }
	}
	return retVal;
    }
    
    async init( authData ) {
	this.cep = await awsUtils.getProjectStatus( authData, -1 );   // get all ce projects
	for( const entry of this.cep ) {
	    // XXX
	    // this.add(entry );
	}
    }

    // XXX called from wrong spot currently.  revisit.
    // Called during host handler data initialization, once a new hostProject has been identified.
    add( host, org, hostProjId ) {
	let cpid   = newCEP.ceProjId;

	if( !this.cep.hasOwnProperty( host ))                  { this.cep[host]                  = {}; }
	if( !this.cep[host].hasOwnProperty( org ))             { this.cep[host][org]             = {}; }
	if( !this.cep[host][org].hasOwnProperty( hostProjId )) { this.cep[host][org][hostProjId] = {}; }
	
	this.cep[host][org][repo] = config.UNCLAIMED;
	// XXX push to aws
    }

    // called by ceFlutter to attach a hostProject to a ceProject.
    associate( host, org, hostProjId, ceProjId ) {
	// XXX NYI
	assert( false );
    }

    delete( oldCEP ) {
	// XXX NYI
	assert( false );
    }
    
    // XXX in linkage too.. component utils?
    fill( val, num ) {
	let retVal = "";
	if( typeof val !== 'undefined' ) {
	    for( var i = 0; i < num; i++ ) {
		if( val.length > i ) { retVal = retVal.concat( val[i] ); }
		else                 { retVal = retVal.concat( " " ); }
	    }
	}
	return retVal
    }

    // XXX wrong
    show( count ) {
	console.log( "CEProjects contents" );
	if( Object.keys( this.cep ).length <= 0 ) { return ""; }
	
	console.log( this.fill( "ceProjectId", 20 ),
		     this.fill( "Host", 15 ),
		     this.fill( "Organization", 15 ),
		     this.fill( "Repository", 15 ),
		   );
	
	let printables = [];
	for( const [host, hceps] of Object.entries( this.cep )) {
	    for( const [org, oceps] of Object.entries( hceps )) {
		for( const [repo, cep] of Object.entries( oceps )) {
		    printables.push( { h: host, o: org, r: repo, pid: cep }  );
		}}
	}

	let start = 0;
	if( typeof count !== 'undefined' ) { start = printables.length - count; }
	start = start < 0 ? 0 : start;
	
	for( let i = start; i < printables.length; i++ ) {
	    let p = printables[i]; 
	    console.log( this.fill( p.pid, 20 ),
			 this.fill( p.h,   15 ),
			 this.fill( p.o,   15 ),
			 this.fill( p.r,   15 ),
		       );
	}
    }
}

exports.CEProjects = CEProjects;
