const assert = require( 'assert' );

const config  = require( '../config' );

const awsUtils = require( '../utils/awsUtils' );

// A simple fast lookup map to get ceProjectIds from job data
class CEProjects {

    constructor( ) {
	this.cep   = {};  // { <CEProjects> }
	this.hp2cp = {};  // { host: { org: { hostProjId: ceProjId }}}
    }  

    find( host, org, hostProjId ) {
	let retVal = config.EMPTY;
	if( this.hp2cp.hasOwnProperty( host )) {
	    if( this.hp2cp[host].hasOwnProperty( org )) {
		if( this.hp2cp[host][org].hasOwnProperty( hostProjId )) {
		    retVal = this.hp2cp[host][org][hostProjId];
		}
	    }
	}
	// this.show(10);
	// console.log( "CEP find", host, org, hostProjId, "GOT", retVal );
	return retVal;
    }

    findByRepo( host, org, repo ) {
	let retVal = config.EMPTY;
	let proj = this.cep.find( cep => cep.HostPlatform == host && cep.Organization == org && cep.HostParts.hostRepositories.includes( repo ));
	retVal = typeof proj === 'undefined' ? retVal : proj.CEProjectId;
	return retVal;
    }
    
    async init( authData ) {
	console.log( "Initializing ceProjects" );
	this.cep = await awsUtils.getProjectStatus( authData, -1 );   // get all ce projects
	for( const entry of this.cep ) {
	    await this.add( authData, entry );
	}
    }

    // Called during server initialization,
    // XXX and when once a new hostProject has been identified in ceFlutter
    async add( authData, newCEP ) {
	let cpid = newCEP.CEProjectId;
	let host = newCEP.HostPlatform;
	let pms  = newCEP.ProjectManagementSys;
	let org  = newCEP.Organization;

	let awsLinks = await awsUtils.getLinkage( authData, { "CEProjectId": cpid } );		
	assert( awsLinks.length == 1 );

	if( !this.hp2cp.hasOwnProperty( host ))                  { this.hp2cp[host]                  = {}; }
	if( !this.hp2cp[host].hasOwnProperty( org ))             { this.hp2cp[host][org]             = {}; }
	
	for( const awsLoc of awsLinks[0].Locations ) {

	    if( host == config.HOST_GH && pms == config.PMS_GHC ) {
		org = awsLoc.hostRepository.split('/')[0];          // Take the owner (individual or org) as org
	    }
	    let hpid = awsLoc.hostProjectId;

	    if( !this.hp2cp[host][org].hasOwnProperty( hpid )) { this.hp2cp[host][org][hpid] = cpid; }
	}
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

    show( count ) {
	console.log( "CEProjects Map contents" );
	if( Object.keys( this.hp2cp ).length <= 0 ) { return ""; }
	
	console.log( this.fill( "ceProjectId", 20 ),
		     this.fill( "Host", 15 ),
		     this.fill( "Organization", 15 ),
		     this.fill( "HostProjectId", 22 ),
		     this.fill( "HostParts", 22 ),
		   );
	
	let printables = [];
	for( const [host, hceps] of Object.entries( this.hp2cp )) {
	    for( const [org, oceps] of Object.entries( hceps )) {
		for( const [hpid, cep] of Object.entries( oceps )) {
		    printables.push( { h: host, o: org, hp: hpid, cp: cep }  );
		}}
	}

	let start = 0;
	if( typeof count !== 'undefined' ) { start = printables.length - count; }
	start = start < 0 ? 0 : start;
	
	for( let i = start; i < printables.length; i++ ) {
	    let p     = printables[i];
	    let parts = ( this.cep.find( c => c.CEProjectId == p.cp ) ).HostParts;
	    console.log( this.fill( p.cp,  20 ),
			 this.fill( p.h,   15 ),
			 this.fill( p.o,   15 ),
			 this.fill( p.hp,  22 ),
			 this.fill( parts, 22 )
		       );
	}
    }
}

exports.CEProjects = CEProjects;
