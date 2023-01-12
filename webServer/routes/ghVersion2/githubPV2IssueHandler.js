var assert      = require( 'assert' );

var config      = require( '../../config' );

const utils    = require( '../../utils/ceUtils' );
const awsUtils = require( '../../utils/awsUtils' );
const ghUtils  = require( '../../utils/gh/ghUtils' );

const ghV2     = require( '../../utils/gh/gh2/ghV2Utils' );

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



// Actions: opened, edited, deleted, closed, reopened, labeled, unlabeled, transferred, 
//          pinned, unpinned, assigned, unassigned,  locked, unlocked, milestoned, or demilestoned.
// Note: issue:opened         notification after 'submit' is pressed.
//       issue:labeled        notification after click out of label section
//       project_card:created notification after submit, then projects:triage to pick column.
async function handler( authData, ghLinks, pd, action, tag ) {

    let actor   = pd.actor;
    // console.log( authData.job, pd.reqBody.issue.updated_at, "issue title:", pd.reqBody['issue']['title'], action );
    console.log( authData.who, "issueHandler start", authData.job );
    
    // title can have bad, invisible control chars that break future matching, esp. w/issues created from GH cards
    pd.IssueId    = pd.reqBody['issue']['id'];
    pd.IssueNum   = pd.reqBody['issue']['number'];		
    pd.Creator    = pd.reqBody['issue']['user']['login'];
    pd.IssueTitle = (pd.reqBody['issue']['title']).replace(/[\x00-\x1F\x7F-\x9F]/g, "");  

    // switch( action ) {
    switch( issueId ) {
    case 'labeled':
	// Can get here at any point in issue interface by adding a label, peq or otherwise
	// Can peq-label newborn and carded issues that are not >= PROJ_PEND
	// PROJ_PEND label can be added during pend negotiation, but it if is situated already, adding a second peq label is ignored.
	// Note: a 1:1 mapping issue:card is maintained here, via utils:resolve.  So, this labeling is relevant to 1 card only
	// Note: if n labels were added at same time, will get n notifications, where issue.labels are all including ith, and .label is ith of n
	{
	    // XXXX XXXXX This will go away with ceFlutter
	    if( gh.populateRequest( pd.reqBody['issue']['labels'] )) {
		await ghcDUtils.populateCELinkage( authData, ghLinks, pd );
		return;
	    }

	    let success = await labelIssue( authData, ghLinks, pd, pd.reqBody.issue.number, pd.reqBody.issue.labels, pd.reqBody.label );
	    
	    // Special case.  Closed issue in flat column just labeled PEQ.  Should now move to PEND.
	    // Will not allow this in ACCR.
	    if( success && pd.reqBody.issue.state == 'closed' ) {

		console.log( "PEQ labeled closed issue." )

		// Must be situated by now.  Move, if in flatworld.
		let links = ghLinks.getLinks( authData, { "ceProjId": pd.CEProjectId, "repo": pd.FullName, "issueId": pd.IssueId } );
		assert( links.length == 1 );
		let link = links[0];

		if( !config.PROJ_COLS.includes( link.GHColumnName )) {

		    let ceProjectLayout = await gh.getCEProjectLayout( authData, ghLinks, pd );
		    if( ceProjectLayout[0] == -1 ) { console.log( "Project does not have recognizable CE column layout.  No action taken." ); }
		    else {
			// Must wait.  Move card can fail if, say, no assignees
			let newColId = await gh.moveIssueCard( authData, ghLinks, pd, 'closed', ceProjectLayout ); 
			if( newColId ) {
		    
			    // NOTE.  Spin wait for peq to finish recording from PNP in labelIssue above.  Should be rare.
			    let peq = await utils.settleWithVal( "validatePeq", ghSafe.validatePEQ, authData, pd.FullName,
								 link.GHIssueId, link.GHIssueTitle, link.GHProjectId );

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
		
	    let links = ghLinks.getLinks( authData, { "ceProjId": pd.CEProjectId, "repo": pd.FullName, "issueId": pd.IssueId } );
	    let link = links[0]; // cards are 1:1 with issues, this is peq
	    let newNameIndex = config.PROJ_COLS.indexOf( link.GHColumnName );	    

	    // GH already removed this.  Put it back.
	    if( newNameIndex >= config.PROJ_ACCR ) {
		console.log( "WARNING.  Can't remove the peq label from an accrued PEQ" );
		ghSafe.addLabel( authData, pd.Owner, pd.Repo, pd.IssueNum, pd.reqBody.label );
		return;
	    }
	    
	    let peq = await awsUtils.getPeq( authData, pd.CEProjectId, pd.IssueId );	
	    console.log( "WARNING.  PEQ Issue unlabeled, issue no longer tracked." );
	    ghLinks.rebaseLinkage( authData, pd.CEProjectId, pd.IssueId );   // setting various to -1, as it is now untracked
	    awsUtils.removePEQ( authData, peq.PEQId );
	    awsUtils.recordPEQAction(
		authData,
		config.EMPTY,     // CE UID
		pd.Creator,     // gh user name
		pd.CEProjectId,
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
		    let peqId = ( await( ghSafe.validatePEQ( authData, pd.FullName, pd.IssueId, pd.IssueTitle, ceProjectLayout[0] )) )['PEQId'];
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
			
			awsUtils.recordPEQAction( authData, config.EMPTY, actor, pd.CEProjectId,
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
	    console.log( authData.who, action, pd.reqBody.assignee.login, "to issue", pd.IssueId );

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
	    let peq = await awsUtils.getPeq( authData, pd.CEProjectId, pd.IssueId );

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
	    let links = ghLinks.getLinks( authData, { "ceProjId": pd.CEProjectId, "repo": pd.FullName, "issueId": pd.IssueId });
	    if( links != -1 && links[0].GHColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
		console.log( "WARNING.", links[0].GHColumnName, "is reserved, accrued issues should not be modified.  Undoing this assignment." );
		paction = config.PACTACT_NOTE;
		note = "Bad assignment attempted";
		if( action == "assigned" ) { ghSafe.remAssignee( authData, pd.Owner, pd.Repo, pd.IssueNum, assignee ); }
		else                       { ghSafe.addAssignee( authData, pd.Owner, pd.Repo, pd.IssueNum, assignee ); }
	    }
	    
	    let subject = [peq.PEQId.toString(), assignee];
	    awsUtils.recordPEQAction( authData, config.EMPTY, actor, pd.CEProjectId,
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
		let links = ghLinks.getLinks( authData, { "ceProjId": pd.CEProjectId, "repo": pd.FullName, "issueId": pd.IssueId } );
		let link = links == -1 ? links : links[0]; 

		if( link != -1 && link.GHIssueTitle != config.EMPTY) {

		    // Unacceptable for ACCR.  No changes, no PAct.  Put old title back.
		    if( link.GHColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
			console.log( "WARNING.  Can't modify PEQ issues that have accrued." );
			ghSafe.updateTitle( authData, pd.Owner, pd.Repo, pd.IssueNum, link.GHIssueTitle );
		    }
		    else {
			assert( pd.reqBody.changes.title.from == link.GHIssueTitle );
			console.log( "Title changed from", link.GHIssueTitle, "to", newTitle );
			
			// if link has title, we have situated card.
			ghLinks.updateTitle( authData, link, newTitle );
			let peq = await awsUtils.getPeq( authData, pd.CEProjectId, pd.IssueId );
			assert( peq != -1 );  
			const subject = [ peq.PEQId, newTitle ]; 
			awsUtils.recordPEQAction( authData, config.EMPTY, actor, pd.CEProjectId,
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
		const status = await awsUtils.getProjectStatus( authData, pd.CEProjectId );
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
		let peq = await awsUtils.getPeq( authData, pd.CEProjectId, pd.IssueId, false );
		if( peq != -1 ) {
		    const subject = [ peq.PEQId, fullRepoName ];
		    awsUtils.recordPEQAction( authData, config.EMPTY, actor, pd.CEProjectId,
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

    case 'opened':	        // Do nothing.  These are resolved before reaching this handler.
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
