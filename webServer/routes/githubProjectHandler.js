var config  = require('../config');
var utils   = require('../utils');

// Actions: created, edited, closed, reopened, or deleted
async function handler( authData, ghLinks, pd, action, tag ) {

    // Sender is the event generator.
    // let sender   = pd.reqBody['sender']['login'];
    // console.log( authData.job, "project name:", pd.reqBody.project.name, action );
    console.log( authData.who, "start", authData.job );

    pd.GHProjectId   = pd.reqBody.project.id;
    pd.GHProjectName = pd.reqBody.project.name;

    switch( action ) {
    case 'deleted':
	// Deleting a project causes project_card delete, project_column delete, project delete (random order).  Leaves issues in place.
	{
	    ghLinks.removeLocs( { authData: authData, projId: pd.GHProjectId } );
	}
	break;
    case 'created':  
	{
	    ghLinks.addLoc( authData, pd.GHFullName, pd.GHProjectName, pd.GHProjectId, config.EMPTY, -1 );
	}
	break;
    case 'edited':
	{
	    // update ghlinks
	    let oldName = -1;
	    let newName = pd.reqBody.project.name;
	    if( typeof pd.reqBody.changes.name !== 'undefined' ) { oldName = pd.reqBody.changes.name.from; }

	    if( oldName != -1 ) {
		let links = ghLinks.getLinks( authData, { "repo": pd.GHFullName, "projName": oldName } );
		links.forEach( link => link.GHProjectName = newName );

		// send 1 PAct to update any peq projSub
		utils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.GHFullName,
				       "confirm", "change", [oldName, newName], "Project rename",
				       utils.getToday(), pd.reqBody );
	    }
	}
	break;
    case 'reopened':
    case 'closed':
	{
	    // Prefer closing a project over deleting it.  Notify if there are PEQs.
	    const links = ghLinks.getLinks( authData, { "repo": pd.GHFullName, "projId": pd.GHProjectId });
	    if( links == -1 ) { return; }

	    const projLink = links.find( link => link.GHColumnName != config.EMPTY );

	    if( typeof projLink !== 'undefined' ) {
		const note = "Project " + action;
		console.log( "Notice.", action,  "project with active PEQs.  Notifying server."  );
		utils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.GHFullName,
				       "confirm", "notice", [pd.GHProjectId], note,
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
