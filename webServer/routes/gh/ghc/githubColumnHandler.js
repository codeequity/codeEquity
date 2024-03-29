const rootLoc = "../../../";

const assert = require( 'assert' );
const config = require( rootLoc + 'config' );

const utils    = require( rootLoc + 'utils/ceUtils' );
const awsUtils = require( rootLoc + 'utils/awsUtils' );

const ghClassic = require( rootLoc + 'utils/gh/ghc/ghClassicUtils' );
const gh        = ghClassic.githubUtils;
const ghSafe    = ghClassic.githubSafe;


// Actions: created, edited, moved or deleted
async function handler( authData, ghLinks, pd, action, tag ) {

    // Sender is the event generator.
    let sender   = pd.reqBody['sender']['login'];
    // console.log( authData.job, pd.reqBody.project_column.updated_at, "column name:", pd.reqBody.project_column.name, action );
    console.log( authData.who, "start", authData.job );

    pd.columnId    = pd.reqBody.project_column.id.toString();
    pd.columnName  = pd.reqBody.project_column.name;
    pd.projectId   = pd.reqBody.project_column.project_url.split('/').pop();

    switch( action ) {
    case 'deleted':
	{
	    ghLinks.removeLocs( { authData: authData, ceProjId: pd.ceProjectId, colId: pd.columnId } );
	}
	break;
    case 'created':
	{
	    const locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "projId": pd.projectId } );
	    const loc = locs == -1 ? locs : locs[0];
	    assert( loc != -1 );

	    let nLoc = {};
	    nLoc.ceProjectId     = pd.ceProjectId;
	    nLoc.hostProjectId   = pd.projectId;
	    nLoc.hostProjectName = loc.hostProjectName;
	    nLoc.hostColumnId    = pd.columnId;
	    nLoc.hostColumnName  = pd.columnName;
	    nLoc.active          = "true";
	    
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
		    awsUtils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.ceProjectId,
					   config.PACTVERB_CONF, config.PACTACT_NOTE, [oldName], "Column rename attempted",
					   utils.getToday(), pd.reqBody );
		}
		else {
		    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "colName": oldName } );
		    links.forEach( link => link.hostColumnName = newName );

		    // send 1 PAct to update any peq projSub.  don't wait.
		    awsUtils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.ceProjectId,
					   config.PACTVERB_CONF, config.PACTACT_CHAN, [pd.columnId, oldName, newName], "Column rename",
					   utils.getToday(), pd.reqBody );

		    let nLoc = {};
		    nLoc.ceProjectId     = pd.ceProjectId;
		    nLoc.hostProjectId   = pd.projectId;
		    nLoc.hostProjectName = loc.hostProjectName;
		    nLoc.hostColumnId    = pd.columnId;
		    nLoc.hostColumnName  = newName;
		    nLoc.active          = "true";
		    
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
