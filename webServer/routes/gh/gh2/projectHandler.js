import * as config  from  '../../../config.js';
import * as utils    from '../../../utils/ceUtils.js';
import * as awsUtils from '../../../utils/awsUtils.js';

// Actions: created, edited, closed, reopened, or deleted
async function handler( authData, ceProjects, ghLinks, pd, action, tag ) {

    pd.actor       = pd.reqBody.sender.login;
    pd.projectId   = pd.reqBody.projects_v2.node_id;
    pd.projectName = pd.reqBody.projects_v2.title;

    switch( action ) {
    case 'deleted':
	// Deleting a project now sends only 1 notification, this 'deleted' one.  Leaves issues in place, 'secretly' deletes cards.
	// Projects are cross-repo, and therefore cross-CodeEquity projects.
	// Work from links, which hold hostProjectIds
	// Can't just send delete issue, that will record as bot, and skip processing.  and it's slower. do processing here.
	// Need to handle peqs, links, locs.
	{
	    let links = ghLinks.getLinks( authData, { ceProjId: pd.ceProjectId, pid: pd.projectId } );
	    const locs  = ghLinks.getLocs( authData, { ceProjId: pd.ceProjectId, pid: pd.projectId } );	    

	    console.log( "Del", pd.projectId, pd.projectName );
	    // console.log( "Del", pd.reqBody );
	    
	    // get unique hostRepoIds that hostProject touches

	    let hostRepoIds = [];
	    links = links === -1 ? [] : links;
	    for( const link of links ) {
		if( !hostRepoIds.includes( link.hostRepoId ) ) { hostRepoIds.push( link.hostRepoId ); }
	    }

	    let peqs = [];
	    let promises = [];
	    for( const rid of hostRepoIds ) {
		const query = { HostRepoId: rid, Active: "true" };  
		promises.push( awsUtils.getPEQs( authData, query ) );
	    }
	    Promise.all( promises ).then( function (v) { peqs = v.flat(); });
	    
	    if( peqs !== -1 ) {

		console.log( authData.who, "Deleted project", pd.projectId, pd.projectName, "had PEQ issues. Reforming them in", config.UNCLAIMED, peqs.length.toString() );

		// XXX promise.all?  This is very expensive for larger project.  Redoing some work here as well
		for( const peq of peqs ) {
		    console.log( "PEQ: ", peq.toString() );
		    let link = links.find( (l) => l.hostIssueId == peq.HostIssueId )
		    assert( typeof link !== 'undefined' );

		    let accr  = peq.PeqType == config.PEQTYPE_GRANT;
		    let card  = await ghV2.createUnClaimedCard( authData, ghLinks, ceProjects, pd, link.issueId, accr );

		    // Move to unclaimed:unclaimed or unclaimed:accrued col
		    const loc = accr ?
			  locs.find( (l) => l.ceProjectId == link.ceProjectId && l.hostProjectName == config.UNCLAIMED && l.hostColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) :
			  locs.find( (l) => l.ceProjectId == link.ceProjectId && l.hostProjectName == config.UNCLAIMED && l.hostColumnName == config.UNCLAIMED );
		    
		    assert( typeof loc !== 'undefined' );

		    // XXX Card was created in correct unclaimed location.  Why the move?
		    // XXX need to wait here?
		    await ghV2.moveCard( authData, card.pid, card.cardId, loc.hostUtility, loc.hostColumnId );

		    // rewrite link for peq
		    link.hostCardId      = card.cardId;
		    link.hostColumnId    = card.columnId;
		    link.hostColumnName  = loc.hostColumnName;
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
		    /*
   		    // XXX ingest is ignoring this
		    awsUtils.recordPEQAction( authData, config.EMPTY, pd,
					      config.PACTVERB_CONF, config.PACTACT_ADD, [newPeqId], "",
					      utils.getToday() );
		    */
		    pd.ceProjectId = tmp;
		    
		}
	    }

	    ghLinks.removeLocs(  { authData: authData, ceProjId: pd.ceProjectId, pid: pd.projectId } );

	    // peq links were rewritten above.  Eliminate any remaining links that were for carded issues for the project.
	    let delLinks = ghLinks.getLinks( authData, { ceProjId: pd.ceProjectId, pid: pd.projectId } );
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
	    if( typeof pd.reqBody.changes.name !== 'undefined' ) { oldName = pd.reqBody.changes.name.from; }

	    if( oldName != -1 ) {
		let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "projName": oldName } );
		links.forEach( link => link.hostProjectName = newName );

		// don't wait
		awsUtils.recordPEQAction( authData, config.EMPTY, pd,
					  config.PACTVERB_CONF, config.PACTACT_CHAN, [pd.projectId.toString(), oldName, newName], config.PACTNOTE_PREN,
					  utils.getToday());

		const locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "projId": pd.projectId } );
		for( const loc of locs ) {
		    loc.hostProjectName = newName;
		}
		await ghLinks.addLocs( authData, locs, true );
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
