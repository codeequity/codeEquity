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
	    if( typeof pd.reqBody.changes.name === 'undefined' && typeof pd.reqBody.changes.description === 'undefined' ) {
		return;
	    }
	    
	    let origDesc = pd.reqBody.label.description;
	    let origName = pd.reqBody.label.name;
	    if( typeof pd.reqBody.changes.description !== 'undefined' ) { origDesc = pd.reqBody.changes.description.from; }
	    if( typeof pd.reqBody.changes.name !== 'undefined' )        { origName = pd.reqBody.changes.name.from; }
	    
	    const lVal     = ghSafe.parseLabelDescr( [ origDesc ] );
	    let allocation = ghSafe.getAllocated( [ origDesc ] );
	    tVal = allocation ? "allocation" : "plan";
	    
	    // Only proceed if there are active peqs with this label
	    const query = { GHRepo: pd.GHFullName, Active: "true", Amount: lVal, PeqType: tVal };
	    const peqs  = await utils.getPeqs( authData, query );
	    if( peqs == -1 ) {
		console.log( authData.who, "No active peqs with this edited label" );
		return;
	    }

	    // XXX need to warn .. card be good
	    // undo current edits.
	    const name = pd.reqBody.label.name;
	    console.log( authData.who, "Undoing label edit, back to", origName, origDesc );
	    await ghSafe.updateLabel( authData, pd.GHOwner, pd.GHRepo, name, origName, origDesc );

	    // no need to wait
	    // make new label, iff the name changed.  If only descr, we are done already.  This need not be peq.
	    if( origName != name ) {
		console.log( "Making new label to contain the edit" );
		const peqValue = ghSafe.parseLabelName( name );
		const descr = ( allocation ? config.ADESC : config.PDESC ) + peqValue.toString();
		ghSafe.createLabel( authData, pd.GHOwner, pd.GHRepo, name, pd.reqBody.label.color, descr );
	    }
	    utils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.GHFullName,
				   "confirm", "notice", [], "PEQ label edit attempt",
				   utils.getToday(), pd.reqBody );
	}
	break;
    case 'deleted':
	// The proper way to delete a peq label is to unlabel all issues first, then can remove the unused label.  Otherwise, we put them back.
	// Check if this is in use.  If so, recreate it, and relabel all.  Potentially very expensive!
	// If this was used peq label, by now, unlabels have been issued everywhere, triggering de-peq actions, and the label is gone.
	{
	    // All work done here.
	    // Issue handler gets notifications for open issues.  It will do nothing if the label still exists.
	    const desc = pd.reqBody.label.description;
	    const lVal = ghSafe.parseLabelDescr( [ desc ] );
	    let   tVal = ghSafe.getAllocated( [ desc ] );
	    tVal = tVal ? "allocation" : "plan";                     // XXX config

	    const query = { GHRepo: pd.GHFullName, Active: "true", Amount: parseInt( lVal ), PeqType: tVal };
	    const peqs  = await utils.getPeqs( authData, query );
	    if( peqs == -1 ) {
		console.log( authData.who, "No active peqs with this deleted label" );
		return;
	    }

	    // We have peqs.  Unlabel did not trigger, so no need to fix links or peqs.
	    // remake label.  inform.
	    let label = await ghSafe.createPeqLabel( authData, pd.GHOwner, pd.GHRepo, tVal == "allocation", lVal );
	    
	    // add label to all.  No need to wait.
	    console.log( "WARNING.  Active Peq labels can not be deleted.  To delete, remove them from issues first. Recreating." );
	    for( const peq of peqs ) {
		let links = ghLinks.getLinks( authData, { "repo": pd.GHFullName, "issueId": peq.GHIssueId });
		assert( links.length == 1 );
		ghSafe.addLabel( authData, pd.GHOwner, pd.GHRepo, links[0].GHIssueNum, label );
	    }
	    utils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.GHFullName,
				   "confirm", "notice", [], "PEQ label delete attempt",
				   utils.getToday(), pd.reqBody );
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
