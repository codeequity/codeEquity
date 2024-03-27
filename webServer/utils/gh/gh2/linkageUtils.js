const rootLoc = "../../../";

const assert    = require( 'assert' );

const config    = require( rootLoc + 'config' );
const ceAuth    = require( rootLoc + 'auth/ceAuth' );

const utils     = require( rootLoc + 'utils/ceUtils' );
const awsUtils  = require( rootLoc + 'utils/awsUtils' );

const ghV2        = require( './ghV2Utils' );
const ingestUtils = require( './ingestUtils' );


// If project has peq in CEP, then get all links, locs, then filter links out for those that are from repos associated with cep.
// if repoId is provided, filter to pass only from that repo.  Locs will overwrite in this latter case.
async function buildHostLinks( authData, ghLinks, ceProject, preferredRepoId, baseLinks, locData ) {
    
    let host  = utils.validField( ceProject, "HostPlatform" )       ? ceProject.HostPlatform                    : "";
    let org   = utils.validField( ceProject, "Organization" )       ? ceProject.Organization                    : "";
    let pms   = utils.validField( ceProject, "ProjectMgmtSys" )     ? ceProject.ProjectMgmtSys                  : "";
    let comp  = utils.validField( ceProject, "CEProjectComponent" ) ? ceProject.CEProjectComponent              : "";
    assert( host != "" && pms != "" && org != "" );
    assert( utils.validField( ceProject, "CEProjectId" ) );
    
    console.log( authData.who, ".. working on the", comp, "portion of", org, "at", host, "which is a", pms, "project." );

    assert( pms  == config.PMS_GH2 );
    assert( host == config.HOST_GH );
    
    // mainly to get pat
    await ceAuth.getAuths( authData, host, pms, org, config.CE_ACTOR );

    // Get all hostRepoIds that belong to the ceProject
    // Add organization's unclaimed to each hostRepo that holds PEQ, since aws:peq table will not record delete movements to UNCL
    if( !utils.validField( ceProject, "HostParts" ) || !utils.validField( ceProject.HostParts, "hostRepositories" ) ) { return { links: [], locs: [] }; }
    let hostRepoIds = preferredRepoId == -1 ? ceProject.HostParts.hostRepositories.map( repo => repo.repoId ) : [preferredRepoId]; 

    // Get all PEQs in ceProject
    let peqs = await awsUtils.getPEQs( authData, { "CEProjectId": ceProject.CEProjectId, "Active": "true" })

    let hostProjs = [];

    // XXX hmmm if uncl has peq, is built in below.  Otherwise, we add later, yes?  otherwise, need to special case front part of while
    // let unclPID = await ghV2.findProjectByName( authData, org, "", config.UNCLAIMED ); 
    // if( unclPID != -1 && !hostProjs.includes( unclPID ) ) { hostProjs.push( unclPID ); }

    while( peqs.length > 0 ) {
	const peq = peqs[0];
	const pid = await ghV2.getProjIdFromPeq( authData, peq.HostIssueId );
	assert( pid != -1 );

	assert( !hostProjs.includes( pid ) );
	hostProjs.push( pid );
	
	// Note, for links being built below, the link is a complete ceServer:link that supplied info for the 1:1 mapping issue:card.
	//       it is not necessarily a complete picture of a host link (which ceServer does not need).
	//       for example, in GH an issue may be 1:m i.e. in 1 repo with cards in many projects. several links will be created below
	//       these multiple links will be resolved once that issue becomes peq.
	// Note, any peq issue will have already been resolved.
	console.log( authData.who, "GET FOR PROJECT", ceProject.CEProjectId, pid );
	let rLinks = [];
	let rLocs  = [];
	
	await ghV2.getHostLinkLoc( authData, pid, rLocs, rLinks, -1 )
	    .catch( e => console.log( authData.who, "Error.  GraphQL for project layout failed.", e ));
	
	// hostProjs may contain issues from other ceProjects.  Filter these out by requiring hostRepo to match one of the list in ceProjects
	// initialization of the other ceProjects will pick up these filtered out links.
	rLinks = rLinks.filter( (link) => hostRepoIds.includes( link.hostRepoId ));
	
	// console.log( authData.who, "Populate Linkage", pid );
	rLinks.forEach( function (link) { ghLinks.addLinkage( authData, ceProject.CEProjectId, link, { populate: true } );
					}, ghLinks);
	
	for( var loc of rLocs ) {
	    loc.ceProjectId = ceProject.CEProjectId;
	    loc.active = "true";
	}
	// ghLinks.addLocs( authData, rLocs, false ); 
	
	// Concat creates a new array - need to return these results.
	baseLinks = baseLinks.concat( rLinks );
	locData = locData.concat( rLocs );

	// Filter peqs list to remove those just pulled in by getHostLinkLoc
	for( const link of rLinks ) {
	    const idx = peqs.findIndex( p => p.HostIssueId == link.hostIssueId );
	    if( idx >= 0 ) {
		peqs.splice( idx, 1 );
	    }
	}
	
    }
    
    /*
    
    // Find all hostProjects that provide a card home for a peq in the cep
    let hostProjs = await awsUtils.getHostPEQProjects( authData, { CEProjectId: ceProject.CEProjectId } );
    if( hostProjs == -1 ) { hostProjs = []; }

    // Add organization's unclaimed to each hostRepo that holds PEQ, since aws:peq table will not record delete movements to UNCL
    let unclPID = await ghV2.findProjectByName( authData, org, "", config.UNCLAIMED ); 
    if( unclPID != -1 && !hostProjs.includes( unclPID ) ) { hostProjs.push( unclPID ); }
    
    // console.log( "HOST PROJs POST", ceProject.CEProjectId, hostProjs );
    
    // Note, for links being built below, the link is a complete ceServer:link that supplied info for the 1:1 mapping issue:card.
    //       it is not necessarily a complete picture of a host link (which ceServer does not need).
    //       for example, in GH an issue may be 1:m i.e. in 1 repo with cards in many projects. several links will be created below
    //       these multiple links will be resolved once that issue becomes peq.
    // Note, any peq issue will have already been resolved.
    for( const pid of hostProjs ) {
	
	console.log( authData.who, "GET FOR PROJECT", ceProject.CEProjectId, pid );
	let rLinks = [];
	let rLocs  = [];
	
	await ghV2.getHostLinkLoc( authData, pid, rLocs, rLinks, -1 )
	    .catch( e => console.log( authData.who, "Error.  GraphQL for project layout failed.", e ));
	
	// hostProjs may contain issues from other ceProjects.  Filter these out by requiring hostRepo to match one of the list in ceProjects
	// initialization of the other ceProjects will pick up these filtered out links.
	rLinks = rLinks.filter( (link) => hostRepoIds.includes( link.hostRepoId ));
	
	// console.log( authData.who, "Populate Linkage", pid );
	rLinks.forEach( function (link) { ghLinks.addLinkage( authData, ceProject.CEProjectId, link, { populate: true } );
					}, ghLinks);

	for( var loc of rLocs ) {
	    loc.ceProjectId = ceProject.CEProjectId;
	    loc.active = "true";
	}
	// ghLinks.addLocs( authData, rLocs, false ); 

	// Concat creates a new array - need to return these results.
	baseLinks = baseLinks.concat( rLinks );
	locData = locData.concat( rLocs );

    }
    */
    
    return { links: baseLinks, locs: locData };
}

// This method does not line up with GH linkProject.  It builds required links and locs for ceServer when peqs are created
// So, user linking existing project?  Not relevant.
//  1) We do not get linkProject notifications, so it could not be driven by notification
//  2) Not symmetric with what ce needs.  For example, issue in repo can exist in a project that is not GH-linked to repo.  GH linkRepo is purely a view relation.
// Other cases:
// testing creating a project?               proj is empty, no need to get links 
// user or testing creating unclaimed card?  according to ceServer strict relation, unclaimedProj belongs to ceProj, is not shared.
async function linkProject( authData, ghLinks, ceProjId, hostProjectId, pushAWS ) {
    
    let rLocs  = [];
    let rLinks = [];
    console.log( authData.who, "linkage:link project", ceProjId, hostProjectId, pushAWS );
    
    await ghV2.getHostLinkLoc( authData, hostProjectId, rLocs, rLinks, -1 )
	.catch( e => console.log( authData.who, "Error.  linkProject failed.", e ));

    // Can't test rLinks for the new repoId.  If this is a transfer result, GH may have already placed the new issue.
    // There may be links for ceProjId, hostProjId, for example unclaimed may be linked to repo1 not repo2, and now are linking to repo2.
    
    // Overwrites any existing locations, creates new ones as needed
    for( var loc of rLocs ) {
	loc.ceProjectId = ceProjId;
	loc.active = "true";
    }
    await ghLinks.addLocs( authData, rLocs, pushAWS );

    return true;
}

// Unlink project from repo.  in this case, remove repo info
async function unlinkProject( authData, ghLinks, ceProjects, ceProjId, hostProjectId, hostRepoId ) {
    console.log( "Unlink project", ceProjId, hostRepoId, hostProjectId );
    
    if( ghLinks.links[ceProjId] != null ) {
	for( const [_, clinks] of Object.entries( ghLinks.links[ceProjId] ) ) {
	    for( const [_, link] of Object.entries( clinks ) ) {
		if( link.hostProjectId == hostProjectId && link.hostRepoId == hostRepoId ) {
		    link.hostRepoName = config.EMPTY;
		    link.hostRepoId   = config.EMPTY;
		}
	    }}
    }
    
    await ceProjects.init( authData );
    
    // At this point, aws does not associate cPID with unlinked hPID, and internal ceProjects does not register for hPID
    ghLinks.removeLocs( { authData: authData, ceProjId: ceProjId, pid: hostProjectId } );
    
    return true;
}

async function linkRepo( authData, ghLinks, ceProjects, ceProjId, repoId, repoName, cepDetails ) {
    console.log( "Link repo", ceProjId, repoId, repoName );
    if( ceProjId == config.EMPTY || repoId == config.EMPTY ) {
	console.log( authData.who, "WARNING.  Attempting to link a repo to a ceProject, one of which is empty.", ceProjId, repoId, repoName );
	return false;
    }
    
    let cep = ceProjects.findById( ceProjId );
    
    // TESTING ONLY!  Outside testing, ceFlutter controls all access to this, will never need initBlank.
    if( typeof cep === 'undefined' ) {
	let testingRepos = [config.TEST_REPO, config.MULTI_TEST_REPO, config.CROSS_TEST_REPO];
	let repoShort    = repoName.split('/');
	repoShort        = repoShort[ repoShort.length - 1 ]; 
	assert( testingRepos.includes( repoShort ));
	assert( typeof cepDetails !== 'undefined' );
	cep = ceProjects.initBlank( ceProjId, cepDetails );
    }
    
    // CEP may already be linked.  For example, transfering issues will issue linkRepo for new connection.
    // If already linked, we are done.
    if( utils.validField( cep, "HostParts" ) && utils.validField( cep.HostParts, "hostRepositories" ) ) {
	let repo = cep.HostParts.hostRepositories.find( c => c.repoId == repoId );
	if( typeof repo !== 'undefined' ) {
	    console.log( authData.who, "Repo is already linked", ceProjId, repoName );
	    return cep;
	}
    }
    
    // Expensive.  Handle resolve, links, locs.
    await ingestUtils.populateCELinkage( authData, ghLinks, { ceProjectId: ceProjId, repoId: repoId } );
    
    // Update AWS, ceProjects (via cep)
    let hostRepos = ceProjects.getHostRepos( authData, ceProjId, repoId, repoName, { operation: "add" } );
    if( !utils.validField( cep, "HostParts" )) { cep.HostParts = {}; }
    cep.HostParts.hostRepositories = hostRepos;
    return await awsUtils.updateCEPHostParts( authData, cep );
}

exports.buildHostLinks  = buildHostLinks; 
exports.linkProject     = linkProject;
exports.unlinkProject   = unlinkProject;
exports.linkRepo        = linkRepo;
