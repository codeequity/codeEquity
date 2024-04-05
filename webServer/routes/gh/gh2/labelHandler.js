const rootLoc = "../../../";

const assert      = require( 'assert' );

const config      = require( rootLoc + 'config' );

const utils    = require( rootLoc + 'utils/ceUtils' );
const awsUtils = require( rootLoc + 'utils/awsUtils' );
const ghUtils  = require( rootLoc + 'utils/gh/ghUtils' );

const ghV2      = require( rootLoc + 'utils/gh/gh2/ghV2Utils' );

const gh2Data   = require( './gh2Data' );

const issueHandler = require( './issueHandler' );

async function nameDrivesLabel( authData, labelId, name, description ) {
    const [nameVal,alloc] = ghUtils.parseLabelName( name );
    if( nameVal <= 0 ) { return false; }
    
    const descrVal  = ghUtils.parseLabelDescr( [description] );
    const consistentDescr     = ( alloc ? config.ADESC : config.PDESC ) + nameVal.toString();
    
    // Name drives description.  This will allow different color, if naming/descr is correct.
    if( nameVal != descrVal || consistentDescr != description ) {
	console.log( "WARNING.  Modified PEQ label description not consistent with name.  Updating." );
	const color = alloc ? config.APEQ_COLOR : config.PEQ_COLOR;
	// Don't wait
	ghV2.updateLabel( authData, labelId, name, consistentDescr, color );		    
    }
    return true;
}

// Actions: created, edited, or deleted
async function handler( authData, ceProjects, ghLinks, pd, action, tag ) {

    console.log( authData.who, "labelHandler start", authData.job );

    // Sender is the event generator.
    let sender   = pd.reqBody['sender']['login'];

    if( utils.validField( pd.reqBody, "repository" ) ) {
	pd.repoName = pd.reqBody.repository.full_name;
	pd.repoId   = pd.reqBody.repository.node_id;
    }

    // Note: the peq table is the key source here.  We must assume most fields in the peq table are out of date.
    //       happily, the peq label is protected - there is only 1 ever, when unlabled the peq table entry is deactivated
    //       and when the peq label is added, the peq entry is updated.
    switch( action ) {
    case 'edited':
	// Check if this is in use.  If so, undo edit (preserves current peq issues) and create a new label for the edit.
	{
	    assert( pd.repoId != config.EMPTY );

	    // pd.reqBody.label has new label.   pd.reqBody.changes has what changed.
	    // First, check if changes are to name or description.  else, return.
	    console.log( pd.reqBody.changes );
	    if( typeof pd.reqBody.changes.name === 'undefined' && typeof pd.reqBody.changes.description === 'undefined' ) {
		return;
	    }

	    const labelId = pd.reqBody.label.node_id;
	    const newName = pd.reqBody.label.name;
	    let origDesc  = pd.reqBody.label.description;
	    let origName  = newName;
	    if( typeof pd.reqBody.changes.description !== 'undefined' ) { origDesc = pd.reqBody.changes.description.from; }
	    if( typeof pd.reqBody.changes.name !== 'undefined' )        { origName = pd.reqBody.changes.name.from; }
	    
	    const origVal  = ghUtils.parseLabelDescr( [ origDesc ] );
	    let allocation = ghUtils.getAllocated( [ origDesc ] );
	    tVal = allocation ? config.PEQTYPE_ALLOC : config.PEQTYPE_PLAN;

	    // Only disallow if orig label being edited has active peqs.
	    const query = { CEProjectId: pd.ceProjectId, Active: "true", Amount: origVal, PeqType: tVal };
	    const peqs  = await awsUtils.getPEQs( authData, query );
	    if( peqs == -1 ) {
		console.log( authData.who, "No active peqs to handle with this edited label" );
		// Just make sure description is consistent with name, if it is a peq label.  Must wait for bool, else always true.  Could break this up, buuuutttt
		let isPeqLabel = await nameDrivesLabel( authData, labelId, newName, pd.reqBody.label.description );

		if( isPeqLabel ) {
		    console.log( "New label is PEQ, converting issues." );

		    // GH can send 'edited' notification before it rebuilds it's internal GQL structure.
		    // Painful.  Create list from both old and new.
		    let labelIssuesOld = [];
		    let labelIssues = [];
		    
		    if( origName != newName ) {
			console.log(" ... getting labels from orig.. may be empty" );
			await ghV2.getLabelIssues( authData, pd.repoId, origName, labelIssuesOld, -1 );
			console.log(" ... now getting labels from new label.. may be empty" );
		    }
		    await ghV2.getLabelIssues( authData, pd.repoId, newName, labelIssues, -1 );

		    console.log( labelIssuesOld );
		    console.log( labelIssues );

		    let labelIssuesId = labelIssues.map( iss => iss.issueId );
		    for( const oldIss of labelIssuesOld ) {
			if( !labelIssuesId.includes( oldIss.issueId)) { labelIssues.push( oldIss ); }
		    }
		    

		    // Need to peq-label each attached issue.  Expensive.  Probably don't need to wait, but this operation should be rare.
		    let promises = [];
		    for( const issue of labelIssues ) {
			// get issue labels
			// NOTE newly named label is already here... remove it to pass theOnePeq
			let issueLabels = await ghV2.getLabels( authData, issue.issueId );
			if( issueLabels.length > 99 ) { console.log( "Error.  Too many labels for issue", issue.num );} 			
			assert( issueLabels != -1 );

			let newLabel = issueLabels.find( label => label.name == newName );
			assert( typeof newLabel !== 'undefined' );
			// console.log( "Labels for", issue.title, issue.num, newLabel, issueLabels );

			// modify, fill pd. labelIssue does pd.updateFromLink, which requires deep copy.
			// let newPD = Object.assign( pd );               // just provides a reference
			// let newPD = { ...pd };                         // no functions, no reqBody
			// let newPD = JSON.parse( JSON.stringify( pd )); // no functions
			let newPD = gh2Data.GH2Data.from( pd );           // sheesh

			// Bring more over
			newPD.ceProjectId   = pd.ceProjectId;
			newPD.org           = pd.org;
			newPD.repoName      = pd.repoName;
			newPD.reqBody       = {};
			newPD.reqBody.label = {};
			newPD.reqBody.label.description = pd.reqBody.label.description;
			newPD.reqBody.label.node_id     = pd.reqBody.label.node_id;

			// new stuff
			newPD.issueNum  = issue.num;
			newPD.issueName = issue.title;
			newPD.issueId   = issue.issueId;
			newPD.actor     = pd.reqBody.sender.login;
			
			promises.push( issueHandler.labelIssue( authData, ghLinks, ceProjects, newPD, issue.num, issueLabels, newLabel ) );
		    }
		    await Promise.all( promises );
		}
		
		return;
	    }
	    
	    // undo current edits, then make new.  Need to wait, else wont create label with same name
	    console.log( authData.who, "WARNING.  Undoing label edit, back to", origName, origDesc );
	    await ghV2.updateLabel( authData, labelId, origName, origDesc );

	    // no need to wait
	    // make new label, iff the name changed.  If only descr, we are done already.  This need not be peq.
	    if( origName != newName ) {
		console.log( "Making new label to contain the edit" );
		const [peqValue,_] = ghUtils.parseLabelName( newName );
		const descr = ( allocation ? config.ADESC : config.PDESC ) + peqValue.toString();
		if( peqValue > 0 ) { ghV2.createPeqLabel( authData, pd.repoId, allocation, peqValue );  }
		else               { ghV2.createLabel( authData, pd.repoId, newName, pd.reqBody.label.color, descr ); }
	    }
	    awsUtils.recordPEQAction( authData, config.EMPTY, pd,
				   config.PACTVERB_CONF, config.PACTACT_NOTE, [], "PEQ label edit attempt",
				   utils.getToday() );
	}
	break;
    case 'deleted':
	// The proper way to delete a peq label is to unlabel all issues first, then can remove the unused label.  Otherwise, we put them back.
	// Check if label is in use.  If so, recreate it, and relabel all.  Potentially very expensive!
	// If this was used peq label, unlabels are being issued everywhere, triggering de-peq actions.  Watch race conditions.
	{
	    // All work done here.
	    // Issue handler gets notifications for open issues.  It will do nothing if the label still exists.
	    const desc = pd.reqBody.label.description;
	    if( !desc ) { return; } // bad label
	    const lVal = ghUtils.parseLabelDescr( [ desc ] );
	    let   tVal = ghUtils.getAllocated( [ desc ] );
	    tVal = tVal ? config.PEQTYPE_ALLOC : config.PEQTYPE_PLAN;

	    let query = { CEProjectId: pd.ceProjectId, Active: "true", Amount: parseInt( lVal ), PeqType: tVal };
	    let peqs  = await awsUtils.getPEQs( authData, query );

	    // Must modify peqs list for two peq val update (pvu) cases:
	    // 1) add peqs where there was    a pvu to the lVal
	    // 2) remove peqs where there was a pvu away from a the current peq val.
	    // 3) pvu chains ? XXX
	    const pacts = await awsUtils.getPActs( authData, {CEProjectId: pd.ceProjectId, Ingested: "false", Note: config.PACTNOTE_PVU} );
	    let addPeqs = [];
	    let remPeqs = [];
	    if( pacts != -1 ) {
		for( const p of pacts ) {
		    if( p.Subject.length != 2 ) { console.log( "Oi???", p ); }
		    assert( p.Subject.length == 2 );
		    // Case 1: pvu to lval
		    if( lVal == parseInt( p.Subject[1] )) {  addPeqs.push( p.Subject[0] ); }
		    
		    // Case 2: pvu for lval-peq away from lval
		    if( peqs !== -1 ) {
			let rpeqs = peqs.filter( (apeq) => apeq.PEQId == p.Subject[0] && apeq.Amount == lVal );
			if( typeof rpeqs !== 'undefined' ) { remPeqs = remPeqs.concat( rpeqs.map( (r) => r.PEQId ));  }
		    }
		}
		console.log( authData.who, "Peq Val Update is causing havoc.. add peqs", addPeqs, "remove peqs", remPeqs );
		
		// Add
		let newPeqs = await awsUtils.getPeqsById( authData, addPeqs );
		peqs = peqs.concat( newPeqs );
		
		// Remove
		if( peqs !== -1 ) {
		    for( let i = peqs.length; i >= 0; i-- ) {
			if( remPeqs.includes( peqs[i].PEQId )) { peqs.splice( i, 1 ); }
		    }
		}
	    }

	    // hostProject can include peqs from multiple repos and otherwise-identical labels.  Need to winnow here by repo
	    // Peq is not real peq if link doesn't place it in correct repo.  Keep repo in link test below.
	    if( peqs !== -1 ) {
		for( let i = peqs.length - 1; i >= 0; i-- ) {
		    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repoId": pd.repoId, "issueId": peqs[i].HostIssueId });
		    if( links === -1 ) {
			console.log( authData.who, "Winnowing", peqs[i].HostIssueTitle, "for", lVal );
			peqs.splice( i, 1 );
		    }
		    
		}
	    }
	    if( peqs == -1 ) {
		console.log( authData.who, "No active peqs with this deleted label" );
		return;
	    }

	    console.log( authData.who, "WARNING.  Active Peq labels can not be deleted.  To delete, remove them from issues first. Recreating." );

	    // We have peqs.  Unlabel did not trigger, so no need to fix links or peqs.
	    // remake label.  inform.
	    let label = await ghV2.createPeqLabel( authData, pd.repoId, tVal == config.PEQTYPE_ALLOC, lVal );
	    
	    // add label to all.  recreate card.  peq was not modified.
	    for( const peq of peqs ) {
		// Even if unlabelIss came first, link should exist since it is rebased, not deleted.  link count is 1 or 0.
		let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repoId": pd.repoId, "issueId": peq.HostIssueId });
		if( links === -1 || links.length != 1 ) { 
		    console.log( authData.who, "WARNING.  XXX Link does not exist on deleted label.  Mismatching peq during server init?", pd.repoId, pd.ceProjectId, peq, links ); 
		    return;
		}

		// PEQ labels are updated during ingest - they can be out of date.  Make sure issue is not already peq-labeled.
		let pv = 0;
		let issueLabels = await ghV2.getLabels( authData, links[0].hostIssueId );
		if( issueLabels != -1 ) {
		    [pv,_] = ghUtils.theOnePEQ( issueLabels );
		}
		if( issueLabels == -1 ||  pv <= 0 ) {
		    console.log( authData.who, "No peq label conflicts, adding label back", label.id, links[0].hostIssueId );
		    ghV2.addLabel( authData, label.id, links[0].hostIssueId );
		}
		else {
		    console.log( "Looks like peq label was outdated, will not add a 2nd peq label", links[0].hostIssueId );
		}

	    }
	    awsUtils.recordPEQAction( authData, config.EMPTY, pd,
				   config.PACTVERB_CONF, config.PACTACT_NOTE, [], "PEQ label delete attempt",
				   utils.getToday() );
	}
	break;
    case 'created':  // do nothing
	// GH doesn't allow labels with same name in repo.
	// Protect PEQ or Alloc label name format, to avoid confusion.  No need to wait.
	{
	    nameDrivesLabel( authData, pd.reqBody.label.node_id, pd.reqBody.label.name, pd.reqBody.label.description );
	}
	break;
    default:
	console.log( "Unrecognized action (label)" );
	break;
    }
    
    return;
}

exports.handler    = handler;
