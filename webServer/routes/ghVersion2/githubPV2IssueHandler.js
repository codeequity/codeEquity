var assert      = require( 'assert' );

var config      = require( '../../config' );

const utils    = require( '../../utils/ceUtils' );
const awsUtils = require( '../../utils/awsUtils' );
const ghUtils  = require( '../../utils/gh/ghUtils' );

const ghV2      = require( '../../utils/gh/gh2/ghV2Utils' );
const gh2DUtils = require( '../../utils/gh/gh2/gh2DataUtils' );

// Terminology:
// situated issue: an issue with a card in a CE-valid project structure
// carded issue:   an issue with a card not in a CE-valid structure
// newborn issue:  a plain issue without a project card, without PEQ label
// newborn card :  a card without an issue

// Guarantee: Once populateCEProjects has been run once for a repo:
//            1) Every carded issues in that repo resides in the linkage table.
//            2) Newborn issues and newborn cards can still exist (pre-existing, or post-populate), and will not reside in the linkage table.
//            3) {label, add card} operation on newborn issues will cause conversion to carded (unclaimed) or situated issue as needed,
//               and inclusion in linkage table.
//            Implies: {open} newborn issue will not create linkage.. else the attached PEQ would be confusing


// XXX NOTE deleteCard notification will NOT be sent, but pv2item edit (?) will be?  Revisit
async function deleteIssue( authData, ghLinks, pd ) {

    let tstart = Date.now();

    // Either not carded, or delete card already fired successfully.  No-op.
    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "issueId": pd.issueId });
    if( links == -1 ) return;
    let link = links[0];

    console.log( "DELETE" );
    console.log( pd.reqBody );

    // After August 2021, GitHub notifications no longer have labels in the pd.reqBody after a GQL issue delete.
    // Can no longer short-circuit to no-op when just carded (delete issue also sends delete card, which handles linkage)
    // [pd.peqValue, _] = ghUtils.theOnePEQ( pd.reqBody['issue']['labels'] );
    // if( pd.peqValue <= 0 ) return;

    // PEQ.  Card is gone, issue is gone.  Delete card will handle all but the one case below, in which case it leaves link intact.
    
    // ACCR, not unclaimed, deleted issue.
    if( link.hostProjectName != config.UNCLAIMED && link.hostColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) {

	// Because of the change in August 2021, the request body no longer has labels.  
	// Can recreate linkage to peq label, but will lose the others.  This is a bug, out of our immediate control.
	// Rare.  GQL-only.  Would need to save more state.  Painful.
	console.log( authData.who, "WARNING.  Deleted an accrued PEQ issue.  Recreating this in Unclaimed.  Non-PEQ labels will be lost.", pd.GHIssueNum );

	// the entire issue has no longer(!) been given to us here.  Recreate it.
	// Can only be alloc:false peq label here.
	let peq  = await awsUtils.getPeq( authData, pd.ceProjectId, link.hostIssueId );
	const lName = peq.Amount.toString() + " " + config.PEQ_LABEL;
	const theLabel = await gh.findOrCreateLabel( authData,  pd.GHOwner, pd.GHRepo, false, lName, peq.Amount );
	pd.reqBody.issue.labels = [ theLabel ];
	const msg = "Accrued PEQ issue was deleted.  CodeEquity has rebuilt it.";

	const issueData = await ghSafe.rebuildIssue( authData, pd.GHOwner, pd.GHRepo, pd.reqBody.issue, msg );

	// Promises
	console.log( authData.who, "creating card from new issue" );
	let card = gh.createUnClaimedCard( authData, ghLinks, pd, issueData[0], true );

	// Don't wait - closing the issue at GH, no dependence
	ghSafe.updateIssue( authData, pd.GHOwner, pd.GHRepo, issueData[1], "closed" );

	card = await card;
	link = ghLinks.rebuildLinkage( authData, link, issueData, card.id );
	link.hostColumnName  = config.PROJ_COLS[config.PROJ_ACCR];
	link.hostProjectName = config.UNCLAIMED;
	link.hostProjectId   = card.project_url.split('/').pop();
	link.hostColumnId    = card.column_url.split('/').pop();
	console.log( authData.who, "rebuilt link" );

	// issueId is new.  Deactivate old peq, create new peq.  Reflect that in PAct.
	// peq = await peq;
	const newPeqId = await awsUtils.rebuildPEQ( authData, link, peq );
	
	awsUtils.removePEQ( authData, peq.PEQId );	
	awsUtils.recordPEQAction( authData, config.EMPTY, pd.actor, pd.ceProjectId,
			       config.PACTVERB_CONF, config.PACTACT_CHAN, [peq.PEQId, newPeqId], "recreate",
			       utils.getToday(), pd.reqBody );
	awsUtils.recordPEQAction( authData, config.EMPTY, pd.actor, pd.ceProjectId,
			       config.PACTVERB_CONF, config.PACTACT_ADD, [newPeqId], "",
			       utils.getToday(), pd.reqBody );
    }

    console.log( "Delete", Date.now() - tstart );
}

async function labelIssue( authData, ghLinks, pd, issueNum, issueLabels, label ) {
    console.log( "LabelIssue" );
    // Zero's peqval if 2 found
    [pd.peqValue,_] = ghUtils.theOnePEQ( issueLabels );  
    
    // more than 1 peq?  remove it.
    let curVal  = ghUtils.parseLabelDescr( [ label.description ] );
    if( pd.peqValue <= 0 && curVal > 0 ) {
	console.log( "WARNING.  Only one PEQ label allowed per issue.  Removing most recent label." );
	// Don't wait, no dependence
	ghSafe.removeLabel( authData, pd.GHOwner, pd.GHRepo, issueNum, label );
	return false;
    }
    
    // Current notification not for peq label?
    if( pd.peqValue <= 0 || curVal <= 0 ) {
	console.log( "Not a PEQ issue, or not a PEQ label.  No action taken." );
	return false;
    }
    
    // Was this a carded issue?  Get linkage
    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "issueId": pd.issueId } );
    assert( links == -1 || links.length == 1 );
    let link = links == -1 ? links : links[0];
    
    // Newborn PEQ issue, pre-triage.  Create card in unclaimed to maintain promise of linkage in dynamo,
    // since can't create card without column_id.  No project, or column_id without triage.
    if( link == -1 || link.hostColumnId == -1) {
	if( link == -1 ) {    
	    link = {};
	    let card = await gh.createUnClaimedCard( authData, ghLinks, pd, pd.issueId );
	    let issueURL = card.content_url.split('/');
	    assert( issueURL.length > 0 );
	    link.hostIssueNum  = pd.issueNum;
	    link.hostCardId    = card.id
	    link.hostProjectId = card.project_url.split('/').pop();
	    link.hostColumnId  = card.column_url.split('/').pop();
	}
	else {  // newborn issue, or carded issue.  colId drives rest of link data in PNP
	    let card = await gh.getCard( authData, link.hostCardId );
	    link.hostColumnId  = card.column_url.split('/').pop();
	}
    }
    
    pd.updateFromLink( link );
    console.log( authData.who, "Ready to update Proj PEQ PAct:", link.hostCardId, link.hostIssueNum );
    
    let content = [];
    content.push( pd.issueName );
    content.push( label.description );
    // Don't wait, no dependence
    let retVal = ghcDUtils.processNewPEQ( authData, ghLinks, pd, content, link );
    return (retVal != 'early' && retVal != 'removeLabel')
}


// Actions: opened, edited, deleted, closed, reopened, labeled, unlabeled, transferred, 
//          pinned, unpinned, assigned, unassigned,  locked, unlocked, milestoned, or demilestoned.
// Note: issue:opened         notification after 'submit' is pressed.
//       issue:labeled        notification after click out of label section
//       project_card:created notification after submit, then projects:triage to pick column.
async function handler( authData, ghLinks, pd, action, tag ) {

    // console.log( authData.job, pd.reqBody.issue.updated_at, "issue title:", pd.reqBody['issue']['title'], action );
    console.log( authData.who, "issueHandler start", authData.job );
    
    // title can have bad, invisible control chars that break future matching, esp. w/issues created from GH cards
    pd.issueId    = pd.reqBody.issue.node_id;         // issue content id
    pd.issueNum   = pd.reqBody.issue.number;		
    pd.actor      = pd.reqBody.sender.login;
    pd.issueName  = (pd.reqBody.issue.title).replace(/[\x00-\x1F\x7F-\x9F]/g, "");  

    // switch( issueId ) {
    switch( action ) {
    case 'labeled':
	// Can get here at any point in issue interface by adding a label, peq or otherwise
	// Can peq-label newborn and carded issues that are not >= PROJ_PEND
	// PROJ_PEND label can be added during pend negotiation, but it if is situated already, adding a second peq label is ignored.
	// Note: a 1:1 mapping issue:card is maintained here, via utils:resolve.  So, this labeling is relevant to 1 card only
	// Note: if n labels were added at same time, will get n notifications, where issue.labels are all including ith, and .label is ith of n
	{
	    // XXXX XXXXX This will go away with ceFlutter
	    if( ghUtils.populateRequest( pd.reqBody['issue']['labels'] )) {
		await gh2DUtils.populateCELinkage( authData, ghLinks, pd );
		return;
	    }

	    let success = await labelIssue( authData, ghLinks, pd, pd.reqBody.issue.number, pd.reqBody.issue.labels, pd.reqBody.label );
	    
	    // Special case.  Closed issue in flat column just labeled PEQ.  Should now move to PEND.
	    // Will not allow this in ACCR.
	    if( success && pd.reqBody.issue.state == 'closed' ) {

		console.log( "PEQ labeled closed issue." )

		// Must be situated by now.  Move, if in flatworld.
		let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "issueId": pd.issueId } );
		assert( links.length == 1 );
		let link = links[0];

		if( !config.PROJ_COLS.includes( link.hostColumnName )) {

		    let ceProjectLayout = await gh.getCEProjectLayout( authData, ghLinks, pd );
		    if( ceProjectLayout[0] == -1 ) { console.log( "Project does not have recognizable CE column layout.  No action taken." ); }
		    else {
			// Must wait.  Move card can fail if, say, no assignees
			let newColId = await gh.moveIssueCard( authData, ghLinks, pd, 'closed', ceProjectLayout ); 
			if( newColId ) {
		    
			    // NOTE.  Spin wait for peq to finish recording from PNP in labelIssue above.  Should be rare.
			    let peq = await utils.settleWithVal( "validatePeq", ghUtils.validatePEQ, authData, pd.repoName,
								 link.hostIssueId, link.hostIssueName, link.hostProjectId );

			    cardHandler.recordMove( authData, ghLinks, pd, -1, config.PROJ_PEND, link, peq );
			}
		    }
		}
	    }
	    
	}
	break;
    case 'unlabeled':
	// Can unlabel issue that may or may not have a card, as long as not >= PROJ_ACCR.  
	// Do not move card, would be confusing for user.
	{
	    // Unlabel'd label data is not located under issue.. parseLabel looks in arrays
	    if( typeof pd.reqBody.label !== 'undefined' ) {
		pd.peqValue = ghUtils.parseLabelDescr( [ pd.reqBody['label']['description'] ] );
		if( pd.peqValue <= 0 ) {
		    console.log( "Not a PEQ label, no action taken." );
		    return;
		}
	    }
	    else {
		console.log( authData.who, "Label was deleted.  Stop, let labelHandler address this." );
		return;
	    }
		
	    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "issueId": pd.issueId } );
	    let link = links[0]; // cards are 1:1 with issues, this is peq
	    let newNameIndex = config.PROJ_COLS.indexOf( link.hostColumnName );	    

	    // GH already removed this.  Put it back.
	    if( newNameIndex >= config.PROJ_ACCR ) {
		console.log( "WARNING.  Can't remove the peq label from an accrued PEQ" );
		ghSafe.addLabel( authData, pd.Owner, pd.Repo, pd.issueNum, pd.reqBody.label );  // XXXXXX
		return;
	    }
	    
	    let peq = await awsUtils.getPeq( authData, pd.ceProjectId, pd.issueId );	
	    console.log( "WARNING.  PEQ Issue unlabeled, issue no longer tracked." );
	    ghLinks.rebaseLinkage( authData, pd.ceProjectId, pd.issueId );   // setting various to -1, as it is now untracked
	    awsUtils.removePEQ( authData, peq.PEQId );
	    awsUtils.recordPEQAction(
		authData,
		config.EMPTY,     // CE UID
		pd.actor,     // gh user name
		pd.ceProjectId,
		config.PACTVERB_CONF,       // verb
		config.PACTACT_DEL,         // action
		[ peq.PEQId ],    // subject
		"unlabel",        // note
		utils.getToday(), // entryDate
		pd.reqBody        // raw
	    );
	}
	break;
    case 'deleted':
	// Delete card of carded issue sends 1 notification.  Delete issue of carded issue sends two: card, issue, in random order.
	// This must be robust given different notification order of { delIssue, delCard}

	// NOTE!!  As of 6/8/2022 the above is no longer true.  delIssue notification is generated, delCard is.. well.. see deleteIssue comments.
	
	// Get here by: deleting an issue, which first notifies deleted project_card (if carded or situated)
	// Similar to unlabel, but delete link (since issueId is now gone).  No access to label
	// Wait here, since delete issue can createUnclaimed
	// XXX NYI
	await deleteIssue( authData, ghLinks, pd );
	break;
    case 'closed':
    case 'reopened':
	{
	    console.log( authData.who, "closed or reopened" );

	    let allocation = false;
	    [pd.peqValue,allocation] = ghUtils.theOnePEQ( pd.reqBody['issue']['labels'] );
	    if( pd.peqValue <= 0 ) {
		console.log( "Not a PEQ issue, no action taken." );
		return;
	    }
	    if( allocation ) {
		console.log( "Allocation, no action taken." );
		return;
	    }
	    
	    // Get array: [proj_id, col_idx4]
	    let ceProjectLayout = await gh.getCEProjectLayout( authData, ghLinks, pd );
	    if( ceProjectLayout[0] == -1 ) {
		console.log( "Project does not have recognizable CE column layout.  No action taken." );
	    }
	    else {
		// Must wait.  Move card can fail if, say, no assignees
		let newColId = await gh.moveIssueCard( authData, ghLinks, pd, action, ceProjectLayout ); 
		if( newColId ) {
		    console.log( authData.who, "Find & validate PEQ" );
		    let peqId = ( await( ghUtils.validatePEQ( authData, pd.repoName, pd.issueId, pd.issueName, ceProjectLayout[0] )) )['PEQId'];
		    if( peqId == -1 ) {
			console.log( authData.who, "Could not find or verify associated PEQ.  Trouble in paradise." );
		    }
		    else {
			// githubCardHandler:recordMove must handle many more options.  Choices here are limited.
			// Closed: 
			let verb = config.PACTVERB_PROP;
			let paction = config.PACTACT_ACCR;
			let subject = [ peqId.toString() ];

			if( action == "reopened" ) {
			    verb = config.PACTVERB_REJ;
			    subject = [ peqId.toString(), newColId.toString() ];
			}
			
			awsUtils.recordPEQAction( authData, config.EMPTY, pd.actor, pd.ceProjectId,
					       verb, paction, subject, "",
					       utils.getToday(), pd.reqBody );
		    }
		}
		else { console.log( "Unable to complete move of issue card.  No action taken" ); }
	    }
	}
	break;
    case 'assigned': 
    case 'unassigned':
	{
	    // Careful - reqBody.issue carries it's own assignee data, which is not what we want here
	    // NOTE: blast create issue (fill in all values, then submit), assign notification may arrive before label notification.
	    //       in this case, peq is not yet created, so peq.PEQId is bad.  
	    console.log( authData.who, action, pd.reqBody.assignee.login, "to issue", pd.issueId );

	    let allocation = false;
	    [pd.peqValue, allocation] = ghUtils.theOnePEQ( pd.reqBody['issue']['labels'] );
	    if( pd.peqValue <= 0 ) {
		console.log( "Not a PEQ issue, no action taken." );
		return;
	    }

	    // Allocations are simply closed/reopened.  No special activity.
	    if( allocation ) {
		console.log( "Allocation", action, "no other action taken" );
		return;
	    }
	    
	    // Peq issues only.  PEQ tracks assignees from ceFlutter.  Just send PAct upstream.
	    let peq = await awsUtils.getPeq( authData, pd.ceProjectId, pd.issueId );

	    // This should only happen during blast-issue creation.
	    if( peq == -1 ) {
		console.log( "Assignment to peq issue, but peq doesn't exist (yet).  Reshuffle." );
		return "postpone"; 
	    }
	    
	    let assignee = pd.reqBody.assignee.login;
	    let verb = config.PACTVERB_CONF;
	    let paction = config.PACTACT_CHAN;
	    let note = ( action == "assigned" ? "add" : "remove" ) + " assignee";

	    // Not if ACCR
	    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "issueId": pd.issueId });
	    if( links != -1 && links[0].hostColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
		console.log( "WARNING.", links[0].hostColumnName, "is reserved, accrued issues should not be modified.  Undoing this assignment." );
		paction = config.PACTACT_NOTE;
		note = "Bad assignment attempted";
		if( action == "assigned" ) { ghSafe.remAssignee( authData, pd.Owner, pd.Repo, pd.issueNum, assignee ); }
		else                       { ghSafe.addAssignee( authData, pd.Owner, pd.Repo, pd.issueNum, assignee ); }
	    }
	    
	    let subject = [peq.PEQId.toString(), assignee];
	    awsUtils.recordPEQAction( authData, config.EMPTY, pd.actor, pd.ceProjectId,
				   verb, paction, subject, note,
				   utils.getToday(), pd.reqBody );
	}
	break;
    case 'edited':
	// Only need to catch title edits, and only for situated.  
	{
	    if( pd.reqBody.changes.hasOwnProperty( 'title' ) && 
		pd.reqBody.changes.title.hasOwnProperty( 'from' )) {

		const newTitle = pd.reqBody.issue.title;
		let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "issueId": pd.issueId } );
		let link = links == -1 ? links : links[0]; 

		if( link != -1 && link.hostIssueName != config.EMPTY) {

		    // Unacceptable for ACCR.  No changes, no PAct.  Put old title back.
		    if( link.hostColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
			console.log( "WARNING.  Can't modify PEQ issues that have accrued." );
			ghSafe.updateTitle( authData, pd.Owner, pd.Repo, pd.issueNum, link.hostIssueName );
		    }
		    else {
			assert( pd.reqBody.changes.title.from == link.hostIssueName );
			console.log( "Title changed from", link.hostIssueName, "to", newTitle );
			
			// if link has title, we have situated card.
			ghLinks.updateTitle( authData, link, newTitle );
			let peq = await awsUtils.getPeq( authData, pd.ceProjectId, pd.issueId );
			assert( peq != -1 );  
			const subject = [ peq.PEQId, newTitle ]; 
			awsUtils.recordPEQAction( authData, config.EMPTY, pd.actor, pd.ceProjectId,
					       config.PACTVERB_CONF, config.PACTACT_CHAN, subject, "Change title",
					       utils.getToday(), pd.reqBody );
		    }
		}
	    }
	}
	break;
    case 'transferred':
	// (open issue in new repo, delete project card, transfer issue)
	// NOTE.  As of 2/13/2022 GH is keeping labels with transferred issue, although tooltip still contradicts this.
	//        Currently, this is in flux.  the payload has new_issue, but the labels&assignees element is empty.
	//        Also, as is, this is violating 1:1 issue:card
	// Transfer IN:  Not getting these any longer.
	// Transfer OUT: Peq?  RecordPAct.  Do not delete issue, no point acting beyond GH here.  GH will send delete card.
	//
	// Transfer from non-CE to ceProj: issue arrives as newborn.
	// Transfer out of ceProj: as above xfer out.

	// Transfer from ceProj to ceProj: issue arrives with peq labels, assignees.  Receiving transferOut notification with .changes
	// https://docs.github.com/en/issues/tracking-your-work-with-issues/transferring-an-issue-to-another-repository
	// only xfer between repos 1) owned by same person/org; 2) where you have write access to both
	
	{
	    if( pd.reqBody.changes.new_repository.full_name != pd.Repo ) {
		console.log( authData.who, "Transfer out.  Cleanup." );
		const fullRepoName = pd.reqBody.changes.new_repository.full_name;
		const newRepoName = pd.reqBody.changes.new_repository.name;
		const newIssNum   = pd.reqBody.changes.new_issue.number;

		/* XXX REVISIT
		// Check for xfer to another ceProject (i.e. ceServer-enabled repo).
		const status = await awsUtils.getProjectStatus( authData, pd.ceProjectId );
		const ceProj = status != -1 && status.Populated == "true" ? true : false;

		if( ceProj ) {
		    // Switch auths
		    let baseAuth = authData.ic;
		    authData.ic = authData.icXfer;
		    assert( authData.ic != -1 );
		    console.log( authData.who, newIssNum.toString(), "Landed in ceProject", newRepoName );
		    let newLabs = await gh.getLabels( authData, pd.Owner, newRepoName, newIssNum );
		    console.log( "New labels:", newLabs.data );

		    // Owner must be the same according to GH
		    let newAssigns = await gh.getAssignees( authData, pd.Owner, newRepoName, newIssNum );
		    console.log( "New Assignees:", newAssigns.data );
		    // XXX Will need to move this to unclaimed:unclaimed

		    // Switch back auths
		    authData.ic = baseAuth; 
		}
		*/
		
		// Only record PAct for peq.  PEQ may be removed, so don't require Active
		let peq = await awsUtils.getPeq( authData, pd.ceProjectId, pd.issueId, false );
		if( peq != -1 ) {
		    const subject = [ peq.PEQId, fullRepoName ];
		    awsUtils.recordPEQAction( authData, config.EMPTY, pd.actor, pd.ceProjectId,
					   config.PACTVERB_CONF, config.PACTACT_RELO, subject, "Transfer out",
					   utils.getToday(), pd.reqBody );
		}
	    }
	    else {
		// XXX 
		console.log( "WARNING.  Seeing transfer in notification for first time. GH project mgmt has changed, revisit." );
	    }
	}
	break;

    case 'opened':	        // Do nothing.  newborn issue created.
    case 'pinned':             	// Do nothing.
    case 'unpinned':      	// Do nothing.
    case 'locked':      	// Do nothing.
    case 'unlocked':      	// Do nothing.
    case 'milestoned':      	// Do nothing.
    case 'demilestoned':     	// Do nothing.
	break;
    default:
	console.log( "Unrecognized action (issues)" );
	break;
    }
    
    return;
}

exports.handler    = handler;
// exports.labelIssue = labelIssue;
