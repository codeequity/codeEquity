var config  = require( '../../config' );

const utils = require( '../../utils/ceUtils' );

// Actions: created, edited, closed, reopened, or deleted
async function handler( authData, ghLinks, pd, action, tag ) {

    // Sender is the event generator.
    // let sender   = pd.reqBody['sender']['login'];
    // console.log( authData.job, "project name:", pd.reqBody.project.name, action );
    console.log( authData.who, "start", authData.job );

    pd.GHProjectId   = pd.reqBody.project.id;
    pd.GHProjectName = pd.reqBody.project.name;

    let nLoc = {};
    nLoc.CEProjectId     = pd.CEProjectId;
    nLoc.HostRepository  = pd.GHFullName;
    nLoc.HostProjectId   = pd.GHProjectId;
    nLoc.HostProjectName = pd.GHProjectName;
    nLoc.HostColumnId    = -1;
    nLoc.HostColumnName  = config.EMPTY;
    nLoc.Active          = "true";

    
    switch( action ) {
    case 'deleted':
	// Deleting a project causes project_card delete, project_column delete, project delete (random order).  Leaves issues in place.
	{
	    ghLinks.removeLocs( { authData: authData, ceProjId: pd.CEProjectId, projId: pd.GHProjectId } );
	}
	break;
    case 'created':  
	{
	    await ghLinks.addLoc( authData, nLoc, true );
	}
	break;
    case 'edited':
	{
	    // update ghlinks
	    let oldName = -1;
	    let newName = pd.reqBody.project.name;
	    if( typeof pd.reqBody.changes.name !== 'undefined' ) { oldName = pd.reqBody.changes.name.from; }

	    if( oldName != -1 ) {
		let links = ghLinks.getLinks( authData, { "ceProjId": pd.CEProjectId, "repo": pd.GHFullName, "projName": oldName } );
		links.forEach( link => link.GHProjectName = newName );

		// don't wait
		utils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.GHFullName,
				       config.PACTVERB_CONF, config.PACTACT_CHAN, [pd.GHProjectId.toString(), oldName, newName], "Project rename",
				       utils.getToday(), pd.reqBody );

		// Must wait to prevent out-of-order overwrites.  Could build an addLocs func, but value is low.
		// Can't do promises.all - must be sequential.
		const locs = ghLinks.getLocs( authData, { "ceProjId": pd.CEProjectId, "repo": pd.GHFullName, "projId": pd.GHProjectId } );
		for( const loc of locs ) {
		    nLoc.HostProjectName = newName;
		    nLoc.HostColumnName = loc.GHColumnName;
		    nLoc.HostColumnId = loc.GHColumnId;
		    await ghLinks.addLoc( authData, nLoc, true );
		}
	    }
	}
	break;
    case 'reopened':
    case 'closed':
	{
	    // Prefer closing a project over deleting it.  Notify if there are PEQs.
	    const links = ghLinks.getLinks( authData, { "ceProjId": pd.CEProjectId, "repo": pd.GHFullName, "projId": pd.GHProjectId });
	    if( links == -1 ) { return; }

	    const projLink = links.find( link => link.GHColumnName != config.EMPTY );

	    if( typeof projLink !== 'undefined' ) {
		const note = "Project " + action;
		console.log( "Notice.", action,  "project with active PEQs.  Notifying server."  );
		utils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.GHFullName,
				       config.PACTVERB_CONF, config.PACTACT_NOTE, [pd.GHProjectId], note,
				       utils.getToday(), pd.reqBody );
	    }
	    
	}
	break;
    default:
	console.log( "Unrecognized action (issues)" );
	break;
    }
    
    return;
}

exports.handler = handler;
