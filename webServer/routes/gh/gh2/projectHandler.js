import assert   from 'assert';

import * as config  from  '../../../config.js';
import * as utils    from '../../../utils/ceUtils.js';
import * as awsUtils from '../../../utils/awsUtils.js';

import * as ghV2        from '../../../utils/gh/gh2/ghV2Utils.js';


// Project_v2 notifications do not include repo or CEP.  Can collect ceProjectIds from links.

// Actions: created, edited, closed, reopened, or deleted
async function handler( authData, ceProjects, ghLinks, pd, action, tag ) {

    pd.actor       = pd.reqBody.sender.login;
    pd.projectId   = pd.reqBody.projects_v2.node_id;
    pd.projectName = pd.reqBody.projects_v2.title;

    switch( action ) {
    case 'deleted':
	// Deleting a project now sends only 1 notification, this 'deleted' one.  Leaves issues in place, 'secretly' deletes cards.
	// Projects are cross-repo, and therefore cross-CodeEquity projects.  All deleted peqs move to host's unclaimed, for any cePID tied to host. repo does not change.
	// Work from links, which hold hostProjectIds
	// Can't just send delete issue, that will record as bot, and skip processing.  and it's slower. do processing here.
	// Need to handle peqs, links, locs.
	// NOTE: pd.ceProjectId is not yet known - notification does not carry any useful identifying information. 
	{

	    // ceProjectId is not known here.
	    let  links = ghLinks.getLinks( authData, { pid: pd.projectId } );

	    console.log( "---------- Del (first arg is ---)", pd.ceProjectId, pd.projectId, pd.projectName );
	    // console.log( pd.reqBody );
	    
	    // get unique hostRepoIds that hostProject touches

	    let hostRepoIds = [];
	    links = links === -1 ? [] : links;
	    console.log( "Links for", pd.projectId, links.toString() );
	    for( const link of links ) {
		if( !hostRepoIds.includes( link.hostRepoId ) ) { hostRepoIds.push( link.hostRepoId ); }
	    }

	    let peqs = [];
	    let promises = [];
	    for( const rid of hostRepoIds ) {
		const query = { HostRepoId: rid, Active: "true" };
		console.log( "Checking for peqs in repo", rid );
		promises.push( awsUtils.getPEQs( authData, query ) );
	    }
	    await Promise.all( promises ).then( function (v) { peqs = v.flat(); });

	    let peqCEProjs = [];
	    if( peqs.length > 0 ) {
		console.log( authData.who, "Deleted project", pd.projectId, pd.projectName, "had PEQ issues. Reforming them in", config.UNCLAIMED, peqs.length.toString() );

		// XXX promise.all?  This is very expensive for larger project... but rare.  Redoing some work here as well
		for( const peq of peqs ) {
		    const ceProjId = peq.CEProjectId;
		    if( !peqCEProjs.includes( ceProjId )) { peqCEProjs.push( ceProjId ); }
		    
		    let link = links.find( (l) => l.hostIssueId == peq.HostIssueId )
		    assert( typeof link !== 'undefined' );

		    let accr  = peq.PeqType == config.PEQTYPE_GRANT;

		    pd.ceProjectId = ceProjId;
		    pd.repoId      = peq.HostRepoId;
		    pd.repoName    = link.hostRepoName;
		    let card  = await ghV2.createUnClaimedCard( authData, ghLinks, ceProjects, pd, link.hostIssueId, accr );

		    // rewrite link for peq
		    link.hostCardId      = card.cardId;
		    link.hostColumnId    = card.columnId;
		    link.hostColumnName  = card.columnName;
		    link.hostProjectId   = card.pid;
		    link.hostProjectName = config.UNCLAIMED;

		    // Update peq for new project, psub
		    const newPeqId = await awsUtils.rebuildPEQ( authData, link, peq );
	
		    awsUtils.removePEQ( authData, peq.PEQId );
		    let tmp = pd.ceProjectId;
		    pd.ceProjectId = link.ceProjectId;
		    awsUtils.recordPEQAction( authData, config.EMPTY, pd,
					      config.PACTVERB_CONF, config.PACTACT_CHAN, [peq.PEQId, newPeqId], config.PACTNOTE_RECR,
					      utils.getToday() );
		    pd.ceProjectId = tmp;
		    
		}
	    }

	    for( const cepid of peqCEProjs ) {
		ghLinks.removeLocs(  { authData: authData, ceProjId: cepid, pid: pd.projectId } );
	    }

	    // peq links were rewritten above.  Eliminate any remaining links that were for carded issues for the project.
	    let delLinks = ghLinks.getLinks( authData, { pid: pd.projectId } );
	    delLinks = delLinks === -1 ? [] : delLinks;
	    for( const link of delLinks ) {
		ghLinks.removeLinkage( { authData: authData, ceProjId: link.ceProjectId, issueId: link.hostIssueId } );
	    }
	}
	break;
    case 'edited':
	// If have links, then have a reason to care about this.  Otherwise, skip.
	{
	    // update ghlinks
	    let oldName = -1;
	    let newName = pd.projectName;
	    // console.log( pd.reqBody );
	    if( typeof pd.reqBody.changes.title !== 'undefined' ) { oldName = pd.reqBody.changes.title.from; }
	    
	    if( oldName != -1 ) {
		console.log( pd.ceProjectId, pd.repoName, pd.projectId, oldName, newName );
		
		let links = ghLinks.getLinks( authData, { pid: pd.projectId } );
		links.forEach( link => link.hostProjectName = newName );
		
		let cePIDs = [];
		for( const link of links ) {
		    if( !cePIDs.includes( link.ceProjectId )) {
			cePIDs.push( link.ceProjectId );
			pd.ceProjectId = link.ceProjectId;
			
			// don't wait
			awsUtils.recordPEQAction( authData, config.EMPTY, pd,
						  config.PACTVERB_CONF, config.PACTACT_CHAN, [pd.projectId, oldName, newName], config.PACTNOTE_PREN,
						  utils.getToday());
			const locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "projId": pd.projectId } );
			for( const loc of locs ) {
			    loc.hostProjectName = newName;
			}
			
			await ghLinks.addLocs( authData, locs );
		    }
		}
	    }
	}
	break;
    case 'reopened':
    case 'closed':
	{
	    // Prefer closing a project over deleting it.  Notify if there are PEQs.
	    const links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "projId": pd.projectId });
	    if( links == -1 ) { return; }

	    const projLink = links.find( link => link.hostColumnName != config.EMPTY );

	    if( typeof projLink !== 'undefined' ) {
		console.log( "Notice.", action,  "project with active PEQs.  Notifying server."  );
		awsUtils.recordPEQAction( authData, config.EMPTY, pd,
					  config.PACTVERB_CONF, config.PACTACT_NOTE, [pd.projectId], config.PACTNOTE_PCLO,
					  utils.getToday());
	    }
	    
	}
	break;
    case 'created':     // Do nothing.  Projects can be a view over anyting within org, part of ceProject or outside it.
	break;
    default:
	console.log( "Unrecognized action (projects)" );
	break;
    }
    
    return;
}

export {handler};
