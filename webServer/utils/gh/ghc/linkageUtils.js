import assert    from 'assert' ;

import * as config    from "../../../config.js" ;
import * as ceAuth    from "../../../auth/ceAuth.js" ;
import * as utils     from "../../../utils/ceUtils.js" ;

// import ghClassic from './ghClassicUtils.js' ;


// classic is per repo.
// Init repo with CE_ACTOR, which is typically a builder account that needs full access.

async function buildHostLinks( authData, ghLinks, ceProject, baseLinks, locData )  {
    console.log( "GHC DEPRECATED" );
    assert( false );
}
/*
async function buildHostLinks( authData, ghLinks, ceProject, baseLinks, locData )  {

    let host  = utils.validField( ceProject, "HostPlatform" )       ? ceProject.HostPlatform                    : "";
    let org   = utils.validField( ceProject, "Organization" )       ? ceProject.Organization                    : "";
    let pms   = utils.validField( ceProject, "ProjectMgmtSys" )     ? ceProject.ProjectMgmtSys                  : "";
    let comp  = utils.validField( ceProject, "CEProjectComponent" ) ? ceProject.CEProjectComponent              : "";
    let isOrg = utils.validField( ceProject, "OwnerCategory" )      ? ceProject.OwnerCategory == "Organization" : false;
    assert( host != "" && pms != "" && org != "" );
    assert( utils.validField( ceProject, "CEProjectId" ) );
    
    console.log( authData.who, ".. working on the", comp, "portion of", org, "at", host, "which is a", pms, "project." );

    assert( pms == config.PMS_GHC );
	
    // HostRepos are stored with linkages, and in ceProj.
    // If there is not an existing link in aws, no need to iterate through the repo looking for baselinks.
    // If there is an existing link, use it (them) to populate repos.  It will not be a large list - just proj/col.
    // As long as hproj and cproj are linked, there will be at least one link irregardless of ceServer status.
    // ceFlutter is the main consumer of this information, excluding this call.
    
    let repos     = [];

    for( const repo of ceProject.HostParts.hostRepositories ) {
	if( !repos.includes( repo.repoName )) {
	    repos.push( repo.repoName );
	    
	    console.log( authData.who, "Refreshing", ceProject.CEProjectId, repo );
	    let fnParts = repo.repoName.split('/');
	    let rlinks = [];
	    
	    if( isOrg ) { await ceAuth.getAuths( authData, host, pms, org,  config.CE_ACTOR ); }
	    else        { await ceAuth.getAuths( authData, host, pms, repo.repoName, config.CE_ACTOR ); }
	    
	    // XXX this should not be here
	    let blPromise =  gh.getBasicLinkDataGQL( authData.pat, fnParts[0], fnParts[1], rlinks, -1 )
		.catch( e => console.log( authData.who, "Error.  GraphQL for basic linkage failed.", e ));
	    
	    let ldPromise = gh.getRepoColsGQL( authData.pat, fnParts[0], fnParts[1], locData, -1 )
		.catch( e => console.log( authData.who, "Error.  GraphQL for repo cols failed.", e ));
	    
	    ldPromise = await ldPromise;  // no val here, just ensures locData is set
	    for( var loc of locData ) {
		loc.ceProjectId = ceProject.CEProjectId;
		loc.active = "true";
		// ghLinks.addLoc( authData, loc, false );  
	    }
	    
	    blPromise = await blPromise;  // no val here, just ensures linkData is set
	    
	    rlinks.forEach( function (link) { link.hostRepoName = repo.repoName;
					      ghLinks.addLinkage( authData, ceProject.CEProjectId, link, { populate: true } ); 
					    }, ghLinks);
	    
	    baseLinks = baseLinks.concat( rlinks );
	}
    }
    return { links: baseLinks, locs: locData };    
}
*/
export {buildHostLinks};
			       
