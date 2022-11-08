var assert = require('assert');
var config = require('../../config');

const utils = require( '../../utils/ceUtils' );

const ghClassic = require( '../../utils/gh/ghc/ghClassicUtils' );
const gh        = ghClassic.githubUtils;
const ghSafe    = ghClassic.githubSafe;


// Actions: created, edited, moved or deleted
async function handler( authData, ghLinks, pd, action, tag ) {

    // Sender is the event generator.
    let sender   = pd.reqBody['sender']['login'];
    // console.log( authData.job, pd.reqBody.project_column.updated_at, "column name:", pd.reqBody.project_column.name, action );
    console.log( authData.who, "start", authData.job );

    pd.GHColumnId    = pd.reqBody.project_column.id.toString();
    pd.GHColumnName  = pd.reqBody.project_column.name;
    pd.GHProjectId   = pd.reqBody.project_column.project_url.split('/').pop();

    switch( action ) {
    case 'deleted':
	{
	    ghLinks.removeLocs( { authData: authData, ceProjId: pd.CEProjectId, colId: pd.GHColumnId } );
	}
	break;
    case 'created':
	{
	    const locs = ghLinks.getLocs( authData, { "ceProjId": pd.CEProjectId, "repo": pd.GHFullName, "projId": pd.GHProjectId } );
	    const loc = locs == -1 ? locs : locs[0];
	    assert( loc != -1 );

	    let nLoc = {};
	    nLoc.CEProjectId     = pd.CEProjectId;
	    nLoc.HostRepository  = pd.GHFullName;
	    nLoc.HostProjectId   = pd.GHProjectId;
	    nLoc.HostProjectName = loc.HostProjectName;
	    nLoc.HostColumnId    = pd.GHColumnId;
	    nLoc.HostColumnName  = pd.GHColumnName;
	    nLoc.Active          = "true";
	    
	    await ghLinks.addLoc( authData, nLoc, true );
	}
	break;
    case 'edited':
	{
	    // Don't allow renaming of ACCR here, muddies the water.  Keep it clean, in or out.
	    let oldName = -1;
	    let newName = pd.reqBody.project_column.name;
	    if( typeof pd.reqBody.changes.name !== 'undefined' ) { oldName = pd.reqBody.changes.name.from; }

	    if( oldName != -1 ) {

		if( oldName == config.PROJ_COLS[config.PROJ_PEND] || oldName == config.PROJ_COLS[config.PROJ_ACCR] ) {
		    console.log( "WARNING.", oldName, "is a reserved column.  To change the name, modify your config file and re-create.  Reverting." );
		    // Don't wait
		    ghSafe.updateColumn( authData, pd.reqBody.project_column.id, oldName );

		    // send 1 PAct to update any peq projSub.  don't wait.
		    utils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.GHFullName,
					   config.PACTVERB_CONF, config.PACTACT_NOTE, [oldName], "Column rename attempted",
					   utils.getToday(), pd.reqBody );
		}
		else {
		    let links = ghLinks.getLinks( authData, { "ceProjId": pd.CEProjectId, "repo": pd.GHFullName, "colName": oldName } );
		    links.forEach( link => link.GHColumnName = newName );

		    // send 1 PAct to update any peq projSub.  don't wait.
		    utils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.GHFullName,
					   config.PACTVERB_CONF, config.PACTACT_CHAN, [pd.GHColumnId, oldName, newName], "Column rename",
					   utils.getToday(), pd.reqBody );

		    let nLoc = {};
		    nLoc.CEProjectId     = pd.CEProjectId;
		    nLoc.HostRepository  = pd.GHFullName;
		    nLoc.HostProjectId   = pd.GHProjectId;
		    nLoc.HostProjectName = loc.HostProjectName;
		    nLoc.HostColumnId    = pd.GHColumnId;
		    nLoc.HostColumnName  = newName;
		    nLoc.Active          = "true";
		    
		    await ghLinks.addLoc( authData, nLoc, true );
		}
	    }
	}
	break;
    case 'moved':   // do nothing.  move within project
    default:
	console.log( "Unrecognized action (issues)" );
	break;
    }
    
    return;
}

exports.handler = handler;
