var assert = require('assert');

const utils    = require( '../utils/ceUtils' );

// A simple fast lookup map to get ceProjectIds from job data
class CEProjects {

    constructor( ) {
	// { host: { org: { repo: ceProjId }}}
	this.cep = {};
    }  


    find( host, org, repo ) {
	let retVal = -1;
	if( this.cep.hasOwnProperty( host )) {
	    if( this.cep[host].hasOwnProperty( org )) {
		if( this.cep[host][org].hasOwnProperty( repo )) {
		    retVal = this.cep[host][org][repo];
		}
	    }
	}
	return retVal;
    }
    
    async init( authData ) {
	this.cep = await utils.getProjectStatus( authData, -1 );   // get all ce projects
	for( const entry of this.cep ) {
	    this.add(entry );
	}
    }

    add( newCEP ) {
	let host   = newCEP.HostPlatform;
	let org    = newCEP.Organization;
	let repo   = newCEP.HostRepository;
	let ceproj = newCEP.CEProjectId;

	if( !this.cep.hasOwnProperty( host ))            { this.cep[host]            = {}; }
	if( !this.cep[host].hasOwnProperty( org ))       { this.cep[host][org]       = {}; }
	if( !this.cep[host][org].hasOwnProperty( repo )) { this.cep[host][org][repo] = {}; }
	
	this.cep[host][org][repo] = ceproj;
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
