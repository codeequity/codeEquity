const rootLoc = "../../../";

const config  = require( rootLoc + 'config' );

const utils    = require( rootLoc + 'utils/ceUtils' );
const awsUtils = require( rootLoc + 'utils/awsUtils' );

// Actions: created, edited, closed, reopened, or deleted
async function handler( authData, ceProjects, ghLinks, pd, action, tag ) {

    pd.actor       = pd.reqBody.sender.login;
    pd.projectId   = pd.reqBody.projects_v2.node_id;
    pd.projectName = pd.reqBody.projects_v2.title;

    switch( action ) {
    case 'deleted':
	// Deleting a project now sends only 1 notification, this 'deleted' one.  Leaves issues in place, 'secretly' deletes cards.
	// Projects are cross-repo, and therefore cross-CodeEquity projects.
	// So.. get (all) pd.ceProjectId from links, work from there.  (i.e. don't need to pass in CEPid)
	// Can't just send delete issue, that will record as bot, and skip processing.  and it's slower. do processing here.
	// Need to handle peqs, links, locs.
	{
	    const query = { HostProjectId: pd.projectId, Active: "true" };
	    const peqs  = await awsUtils.getPEQs( authData, query );
	    const links = ghLinks.getLinks( authData, { pid: pd.projectId } );
	    const locs  = ghLinks.getLocs( authData, { pid: pd.projectId } );	    

	    if( peqs !== -1 ) {
		assert( links !== -1 );

		console.log( authData.who, "Deleted project", pd.projectId, pd.projectName, "had PEQ issues. Reforming them in", config.UNCLAIMED );

		// XXX promise.all?  This is very expensive for larger project.
		for( const peq of peqs ) {
		    let link = links.find( (l) => l.hostIssueId == peq.HostIssueId )
		    assert( typeof link !== 'undefined' );

		    let accr  = peq.PeqType == config.PEQTYPE_ALLOC;
		    let card  = await ghV2.createUnClaimedCard( authData, ghLinks, ceProjects, pd, link.issueId, accr );

		    // Move to unclaimed:unclaimed or unclaimed:accrued col
		    const loc = accr ?
			  locs.find( (l) => l.ceProjectId == link.ceProjectId && l.hostProjectName == config.UNCLAIMED && l.hostColumnName == config.UNCLAIMED ) : 
			  locs.find( (l) => l.ceProjectId == link.ceProjectId && l.hostProjectName == config.UNCLAIMED && l.hostColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) ;
		
		    assert( typeof loc !== 'undefined' );

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
		    awsUtils.recordPEQAction( authData, config.EMPTY, pd.actor, link.ceProjectId,
					      config.PACTVERB_CONF, config.PACTACT_CHAN, [peq.PEQId, newPeqId], config.PACTNOTE_RECR,
					      utils.getToday(), pd.reqBody );
		    awsUtils.recordPEQAction( authData, config.EMPTY, pd.actor, link.ceProjectId,
					      config.PACTVERB_CONF, config.PACTACT_ADD, [newPeqId], "",
					      utils.getToday(), pd.reqBody );
		}
	    }

	    ghLinks.removeLocs(  { authData: authData, pid: pd.projectId } );

	    // peq links were rewritten above.  Eliminate any remaining links that were for carded issues for the project.
	    const delLinks = ghLinks.getLinks( authData, { pid: pd.projectId } );
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
		awsUtils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.ceProjectId,
				       config.PACTVERB_CONF, config.PACTACT_CHAN, [pd.projectId.toString(), oldName, newName], "Project rename",
				       utils.getToday(), pd.reqBody );

		// Must wait to prevent out-of-order overwrites.  Could build an addLocs func, but value is low.
		// Can't do promises.all - must be sequential.
		const locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "projId": pd.projectId } );
		for( const loc of locs ) {
		    nLoc.hostProjectName = newName;
		    nLoc.hostColumnName = loc.hostColumnName;
		    nLoc.hostColumnId = loc.hostColumnId;
		    await ghLinks.addLoc( authData, nLoc, true );
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
		const note = "Project " + action;
		console.log( "Notice.", action,  "project with active PEQs.  Notifying server."  );
		awsUtils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.ceProjectId,
				       config.PACTVERB_CONF, config.PACTACT_NOTE, [pd.projectId], note,
				       utils.getToday(), pd.reqBody );
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

exports.handler = handler;
