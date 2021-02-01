var assert = require('assert');

var utils   = require('../utils');
var ghUtils = require('../ghUtils');
var config  = require('../config');

var gh     = ghUtils.githubUtils;
var ghSafe = ghUtils.githubSafe;


// Actions: created, edited, or deleted
async function handler( authData, ghLinks, pd, action, tag ) {

    // Sender is the event generator.
    let sender   = pd.reqBody['sender']['login'];
    console.log( authData.job, "label name:", pd.reqBody.label.name, action );

    // Note: the peq table is the key source here.  We must assume most fields in the peq table are out of date.
    //       happily, the peq label is protected - there is only 1 ever, when unlabled the peq table entry is deactivated
    //       and when the peq label is added, the peq entry is updated.
    switch( action ) {
    case 'edited':
	// Check if this is in use.  If so, undo edit (preserves current peq issues) and create a new label for the edit.
	{
	    // pd.reqBody.label has new label.   pd.reqBody.changes has what changed.   W
	    // First, check if changes are to name or description.  else, return.
	    if( typeof pd.reqBody.changes.from.name === 'undefined' && typeof pd.reqBody.changes.from.description === 'undefined' ) {
		return;
	    }
	    
	    let lVal = -1;
	    let tVal = -1;
	    let origDesc = pd.reqBody.label.description;
	    let origName = pd.reqBody.label.name;
	    if( typeof pd.reqBody.changes.from.description !== 'undefined' ) { origDesc = pd.reqBody.changes.from.description; }
	    if( typeof pd.reqBody.changes.from.name !== 'undefined' )        { origName = pd.reqBody.changes.from.name; }
	    
	    lVal = ghSafe.parseLabelDescription( [ origDesc ] );
	    tVal = ghSafe.getAllocated( [ origDesc ] );
	    tVal = tVal ? "allocation" : "plan";
	    
	    // Only proceed if there are active peqs with this label
	    const query = { GHRepo: pd.GHRepo, Active: "true", Amount: lVal, PeqType: tVal };
	    const peqs  = await utils.getPeqs( authData, query );
	    if( peqs == -1 ) {
		console.log( authData.who, "No active peqs with this edited label" );
		return;
	    }

	    // XXX need to warn .. card be good
	    // undo current edits.
	    const name = pd.reqBody.label.name;
	    console.log( authData.who, "Undoing label edit, back to", origName, origDesc );
	    ghSafe.updateLabel( authData, owner, repo, name, origName, origDesc );

	    // make new label, iff the name changed.  If only descr, we are done already.  This need not be peq.
	    if( origName != name ) {
		console.log( "Making new label to contain the edit" );
		ghSafe.createLabel( authData, owner, repo, name, pd.reqBody.label.color, pd.reqBody.description );
	    }
	}
	break;
    case 'deleted':
	// Check if this is in use.  If so, recreate it, and relabel all.  Potentially very expensive!
	{
	}
	break;
    case 'created':  // do nothing
	// GH doesn't allow labels with same name in repo.  No need to check.
	break;
    default:
	console.log( "Unrecognized action (label)" );
	break;
    }
    
    return;
}

exports.handler = handler;
