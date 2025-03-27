import assert from 'assert';

import * as config  from '../config.js';

import * as utils    from '../utils/ceUtils.js';
import * as awsUtils from '../utils/awsUtils.js';

// A simple fast lookup map to get ceProjectIds from job data
// hostProjects are views, which may be shared across ceProjects.
// job data will include hostIssueId, for quick lookup.  Else, caller will need to provide hostRepoId.
class CEProjects {

    constructor( ) {
	this.cep   = [];  // [ <CEProjects> ]
	this.hi2cp = {};  // { host: { org: { hostIssueId: ceProjId }}}
    }

    remove( ceProjId ) {
	let idx = this.cep.findIndex( c => c.CEProjectId == ceProjId );
	assert( idx >= 0 );
	this.cep.splice( idx, 1 );

	// XXX No need to blow the entire cache here
	this.hi2cp = {};
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

    findById( ceProjId ) {
	return this.cep.find( cep => cep.CEProjectId == ceProjId ); 
    }

    // XXX Need better error message here if find that 1 repo is shared between 2 CEPs.
    findByRepo( host, org, repo ) {
	let retVal = config.EMPTY;

	
	let projFRepo = this.cep.filter( cep => cep.HostPlatform == host &&
					cep.HostOrganization == org &&
					utils.validField( cep.HostParts, "hostRepositories" ) &&
					cep.HostParts.hostRepositories.reduce( (acc,cur) => acc || cur.repoName == repo, false ));

	if( projFRepo.length > 1 ) {
	    console.log( "Error.  A host repository may only belong to 1 CodeEquity project." );
	    console.log( repo, "was found in at least", projFRepo[0].CEProjectId, projFRepo[1].CEProjectId );
	    assert( false );
	}

	retVal = projFRepo.length == 1? projFRepo[0].CEProjectId : retVal;
	// console.log( "CEP: cePID", retVal );
	return retVal;
    }
    
    async init( authData ) {
	// console.log( "Initializing ceProjects" );
	this.hi2cp = {};
	this.cep = await awsUtils.getProjectStatus( authData, -1 );   // get all ce projects
    }

    initBlank( ceProjId, cepDetails ) {

	assert( typeof cepDetails.platform      !== 'undefined' );
	assert( typeof cepDetails.org           !== 'undefined' );
	assert( typeof cepDetails.ownerCategory !== 'undefined' );
	assert( typeof cepDetails.pms           !== 'undefined' );
	assert( typeof cepDetails.ceVentureId   !== 'undefined' );
	assert( typeof cepDetails.name          !== 'undefined' );
	assert( typeof cepDetails.description   !== 'undefined' );
	
	let blank = {};

	// Ignore hostParts, set later in linkage
	blank.CEProjectId        = ceProjId;
	blank.HostPlatform       = cepDetails.platform;
	blank.HostOrganization   = cepDetails.org;
	blank.OwnerCategory      = cepDetails.ownerCategory;
	blank.ProjectMgmtSys     = cepDetails.pms;
	blank.CEVentureId        = cepDetails.ceVentureId;	
	blank.Name               = cepDetails.name;	
	blank.Description        = cepDetails.description;	

	this.cep.push( blank );
	return blank;
    }


    getHostRepos( authData, ceProjId, repoId, repoName, specials ) {
	let op = typeof specials !== 'undefined' && specials.hasOwnProperty( "operation" )   ? specials.operation   : config.EMPTY;

	let cep    = this.cep.find( cep => cep.CEProjectId == ceProjId );

	if( typeof cep === 'undefined' ) {
	    console.log( authData.who, "WARNING.  ceProject was not found:", ceProjId );
	    return [];
	}

	let hRepos = [];
	
	if( op == "add" ) {

	    if( !utils.validField( cep, "HostParts" ))                  { cep.HostParts = {}; }
	    if( !utils.validField( cep.HostParts, "hostRepositories" )) { cep.HostParts.hostRepositories = []; }
	    
	    hRepos  = cep.HostParts.hostRepositories;
	    let idx = hRepos.findIndex( r => r.repoId == repoId );
	    if( idx == -1 ) { hRepos.push( { repoId: repoId, repoName: repoName } ); }
	}
	else if( op == "remove" ) {
	    if( utils.validField( cep, "HostParts" ) && utils.validField( cep.HostParts, "hostRepositories" )) {
		hRepos  = cep.HostParts.hostRepositories;
		let idx = hRepos.findIndex( r => r.repoId == repoId );
		if( idx != -1 ) { hRepos.splice( idx, 1 ); }
	    }
	}

	return hRepos;
    }

    showX() {
	console.log( "CEProjects contents" );
	for( const cep of this.cep ) {
	    console.log( cep.CEProjectId, cep.CEVentureId, cep.Name, cep.HostOrganization );
	    console.log( "... repos:" );
	    for( const repo of cep.HostParts.hostRepositories ) {
		console.log( repo.repoName, repo.repoId );
	    }
	}
    }
    
    // XXX broken
    // XXX does not properly show repositories, nor projectIds (i.e. HostParts.hostRepositories)
    show( count ) {
	console.log( "CEProjects Map contents" );
	if( Object.keys( this.hi2cp ).length <= 0 ) { return ""; }
	
	console.log( utils.fill( "ceProjectId", 20 ),
		     utils.fill( "ceVentureId", 15 ),
		     utils.fill( "Name", 15 ),
		     utils.fill( "Host", 15 ),
		     utils.fill( "HostOrg", 15 ),
		     utils.fill( "HostIssueId", 22 ),
		     utils.fill( "HostParts", 22 ),
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
	    console.log( utils.fill( p.cp,  20 ),
			 utils.fill( p.h,   15 ),
			 utils.fill( p.o,   15 ),
			 utils.fill( p.hi,  22 ),
			 utils.fill( parts, 22 )
		       );
	}
    }
}

export default CEProjects;
