const assert = require( 'assert' );

const config  = require( '../config' );

const awsUtils = require( '../utils/awsUtils' );

// A simple fast lookup map to get ceProjectIds from job data
// hostProjects are views, which may be shared across ceProjects.
// job data will include hostIssueId, for quick lookup.  Else, caller will need to provide hostRepoId.
class CEProjects {

    constructor( ) {
	this.cep   = {};  // { <CEProjects> }
	this.hi2cp = {};  // { host: { org: { hostIssueId: ceProjId }}}
    }  


    async cacheFind( authData, host, org, hostIssueId, getHostRepoFunc ) {
	let retVal = config.EMPTY;
	if( this.hi2cp.hasOwnProperty( host )) {
	    if( this.hi2cp[host].hasOwnProperty( org )) {
		if( this.hi2cp[host][org].hasOwnProperty( hostIssueId )) {
		    retVal = this.hi2cp[host][org][hostIssueId];
		}
	    }
	}

	if( retVal == config.EMPTY ) {
	    let issueRepo = await getHostRepoFunc( authData, hostIssueId );
	    retVal = this.findByRepo( config.HOST_GH, org, issueRepo.name );
	    this.updateCache( config.HOST_GH, org, hostIssueId, retVal );
	}
	
	return retVal;
    }

    updateCache( host, org, hostIssueId, ceProjectsId ) {
	if( !this.hi2cp.hasOwnProperty( host ))                  { this.hi2cp[host]      = {}; }
	if( !this.hi2cp[host].hasOwnProperty( org ))             { this.hi2cp[host][org] = {}; }
	this.hi2cp[host][org][hostIssueId] = ceProjectsId;
	return true;
    }

    findByRepo( host, org, repo ) {
	let retVal = config.EMPTY;
	let proj = this.cep.find( cep => cep.HostPlatform == host &&
				  cep.Organization == org &&
				  cep.HostParts.hostRepositories.reduce( (acc,cur) => acc || cur.repoName == repo, false ));
	retVal = typeof proj === 'undefined' ? retVal : proj.CEProjectId;
	return retVal;
    }
    
    async init( authData ) {
	// console.log( "Initializing ceProjects" );
	this.hi2cp = {};
	this.cep = await awsUtils.getProjectStatus( authData, -1 );   // get all ce projects
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

    // XXX does not properly show repositories, nor projectIds (i.e. HostParts.hostRepositories)
    show( count ) {
	console.log( "CEProjects Map contents" );
	if( Object.keys( this.hi2cp ).length <= 0 ) { return ""; }
	
	console.log( this.fill( "ceProjectId", 20 ),
		     this.fill( "Host", 15 ),
		     this.fill( "Organization", 15 ),
		     this.fill( "HostIssueId", 22 ),
		     this.fill( "HostParts", 22 ),
		   );
	
	let printables = [];
	for( const [host, hceps] of Object.entries( this.hi2cp )) {
	    for( const [org, oceps] of Object.entries( hceps )) {
		for( const [hiid, cep] of Object.entries( oceps )) {
		    printables.push( { h: host, o: org, hi: hiid, cp: cep }  );
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
			 this.fill( p.hi,  22 ),
			 this.fill( parts, 22 )
		       );
	}
    }
}

exports.CEProjects = CEProjects;
