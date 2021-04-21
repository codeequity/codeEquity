var assert = require('assert');

var utils   = require('../utils');
var ghUtils = require('../ghUtils');
var config  = require('../config');

const peqData = require( '../peqData' );
var issHan    = require('./githubIssueHandler');

var gh     = ghUtils.githubUtils;
var ghSafe = ghUtils.githubSafe;


async function nameDrivesLabel( authData, pd, name, description ) {
    const [nameVal,alloc] = ghSafe.parseLabelName( name );
    if( nameVal <= 0 ) { return false; }
    
    const descrVal  = ghSafe.parseLabelDescr( [description] );
    const consistentDescr     = ( alloc ? config.ADESC : config.PDESC ) + nameVal.toString();
    
    // Name drives description.  This will allow different color, if naming/descr is correct.
    if( nameVal != descrVal || consistentDescr != description ) {
	console.log( "WARNING.  Modified PEQ label description not consistent with name.  Updating." );
	const color = alloc ? config.APEQ_COLOR : config.PEQ_COLOR;
	// Don't wait
	ghSafe.updateLabel( authData, pd.GHOwner, pd.GHRepo, name, name, consistentDescr, color );		    
    }
    return true;
}


// Actions: created, edited, or deleted
async function handler( authData, ghLinks, pd, action, tag ) {

    // Sender is the event generator.
    let sender   = pd.reqBody['sender']['login'];
    // console.log( authData.job, "label name:", pd.reqBody.label.name, action );
    console.log( authData.who, "start", authData.job );

    // Note: the peq table is the key source here.  We must assume most fields in the peq table are out of date.
    //       happily, the peq label is protected - there is only 1 ever, when unlabled the peq table entry is deactivated
    //       and when the peq label is added, the peq entry is updated.
    switch( action ) {
    case 'edited':
	// Check if this is in use.  If so, undo edit (preserves current peq issues) and create a new label for the edit.
	{
	    // pd.reqBody.label has new label.   pd.reqBody.changes has what changed.
	    // First, check if changes are to name or description.  else, return.
	    if( typeof pd.reqBody.changes.name === 'undefined' && typeof pd.reqBody.changes.description === 'undefined' ) {
		return;
	    }

	    const name = pd.reqBody.label.name;
	    let origDesc = pd.reqBody.label.description;
	    let origName = name;
	    if( typeof pd.reqBody.changes.description !== 'undefined' ) { origDesc = pd.reqBody.changes.description.from; }
	    if( typeof pd.reqBody.changes.name !== 'undefined' )        { origName = pd.reqBody.changes.name.from; }
	    
	    const lVal     = ghSafe.parseLabelDescr( [ origDesc ] );
	    let allocation = ghSafe.getAllocated( [ origDesc ] );
	    tVal = allocation ? config.PEQTYPE_ALLOC : config.PEQTYPE_PLAN;

	    // Allow, if no active peqs
	    const query = { GHRepo: pd.GHFullName, Active: "true", Amount: lVal, PeqType: tVal };
	    const peqs  = await utils.getPeqs( authData, query );
	    if( peqs == -1 ) {
		console.log( authData.who, "No active peqs to handle with this edited label" );
		// Just make sure description is consistent with name, if it is a peq label.  Must wait for bool, else always true.  Could break this up, buuuutttt
		let isPeqLabel = await nameDrivesLabel( authData, pd, pd.reqBody.label.name, pd.reqBody.label.description );

		if( isPeqLabel ) {
		    console.log( "New label is PEQ, converting issues." );
		    let labelIssues = [];
		    await gh.getLabelIssuesGQL( authData.pat, pd.GHOwner, pd.GHRepo, pd.reqBody.label.name, labelIssues, -1 );

		    // Need to peq-label each attached issue.  Expensive.  Probably don't need to wait, but this operation should be rare.
		    let promises = [];
		    for( const issue of labelIssues ) {
			// get issue labels
			// NOTE newly named label is already here... remove it to pass theOnePeq
			let issueLabels = await gh.getLabels( authData, pd.GHOwner, pd.GHRepo, issue.num );
			if( issueLabels.length > 99 ) { console.log( "Error.  Too many labels for issue", issue.num );} 			
			assert( issueLabels != -1 );

			let newLabel = issueLabels.data.find( label => label.name == pd.reqBody.label.name );
			issueLabels = issueLabels.data;
			// issueLabels  = issueLabels.data.filter( label => label.name != pd.reqBody.label.name );
			assert( typeof newLabel !== 'undefined' );
			// console.log( "Labels for", issue.title, issue.num, newLabel, issueLabels );

			// modify, fill pd
			let newPD = new peqData.PeqData();
			newPD.GHIssueNum   = issue.num;
			newPD.GHIssueTitle = issue.title;
			newPD.GHIssueId    = issue.issueId;
			newPD.GHRepo       = pd.GHRepo;
			newPD.GHOwner      = pd.GHOwner;
			newPD.GHFullName   = pd.GHFullName;
			newPD.GHCreator    = pd.reqBody.sender.login;
			newPD.reqBody      = pd.reqBody;

			promises.push( issHan.labelIssue( authData, ghLinks, newPD, issue.num, issueLabels, newLabel ) );
		    }
		    await Promise.all( promises );
		}
		
		return;
	    }

	    // undo current edits, then make new.  Need to wait, else wont create label with same name
	    console.log( authData.who, "WARNING.  Undoing label edit, back to", origName, origDesc );
	    await ghSafe.updateLabel( authData, pd.GHOwner, pd.GHRepo, name, origName, origDesc );

	    // no need to wait
	    // make new label, iff the name changed.  If only descr, we are done already.  This need not be peq.
	    if( origName != name ) {
		console.log( "Making new label to contain the edit" );
		const [peqValue,_] = ghSafe.parseLabelName( name );
		const descr = ( allocation ? config.ADESC : config.PDESC ) + peqValue.toString();
		ghSafe.createLabel( authData, pd.GHOwner, pd.GHRepo, name, pd.reqBody.label.color, descr );
	    }
	    utils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.GHFullName,
				   config.PACTVERB_CONF, config.PACTACT_NOTE, [], "PEQ label edit attempt",
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
	    if( !desc ) { return; } // bad label
	    const lVal = ghSafe.parseLabelDescr( [ desc ] );
	    let   tVal = ghSafe.getAllocated( [ desc ] );
	    tVal = tVal ? config.PEQTYPE_ALLOC : config.PEQTYPE_PLAN;

	    const query = { GHRepo: pd.GHFullName, Active: "true", Amount: parseInt( lVal ), PeqType: tVal };
	    const peqs  = await utils.getPeqs( authData, query );
	    if( peqs == -1 ) {
		console.log( authData.who, "No active peqs with this deleted label" );
		return;
	    }

	    // We have peqs.  Unlabel did not trigger, so no need to fix links or peqs.
	    // remake label.  inform.
	    let label = await ghSafe.createPeqLabel( authData, pd.GHOwner, pd.GHRepo, tVal == config.PEQTYPE_ALLOC, lVal );
	    
	    // add label to all.  recreate card.  peq was not modified.
	    console.log( "WARNING.  Active Peq labels can not be deleted.  To delete, remove them from issues first. Recreating." );
	    for( const peq of peqs ) {
		let links = ghLinks.getLinks( authData, { "repo": pd.GHFullName, "issueId": peq.GHIssueId });
		assert( links.length == 1 );
		ghSafe.addLabel( authData, pd.GHOwner, pd.GHRepo, links[0].GHIssueNum, label );
	    }
	    utils.recordPEQAction( authData, config.EMPTY, pd.reqBody['sender']['login'], pd.GHFullName,
				   config.PACTVERB_CONF, config.PACTACT_NOTE, [], "PEQ label delete attempt",
				   utils.getToday(), pd.reqBody );
	}
	break;
    case 'created':  // do nothing
	// GH doesn't allow labels with same name in repo.
	// Protect PEQ or Alloc label name format, to avoid confusion.  No need to wait.
	{
	    nameDrivesLabel( authData, pd, pd.reqBody.label.name, pd.reqBody.label.description );
	}
	break;
    default:
	console.log( "Unrecognized action (label)" );
	break;
    }
    
    return;
}

exports.handler = handler;
