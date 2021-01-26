var utils = require('../utils');
var ghUtils = require('../ghUtils');
var config  = require('../config');
var assert = require('assert');

var gh     = ghUtils.githubUtils;
var ghSafe = ghUtils.githubSafe;

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



async function deleteIssue( installClient, ghLinks, pd ) {
    // Carded, at least?
    let links = ghLinks.getLinks( installClient, { "repo": pd.GHFullName, "issueId": pd.GHIssueId });
    if( links == -1 ) return;
    
    let peq = -1;
    pd.peqValue = ghSafe.theOnePEQ( pd.reqBody['issue']['labels'] );
    if( pd.peqValue > 0 ) {
	peq = await utils.getPeq( installClient, pd.GHIssueId );
    }

    let link = links[0];
    let verb = "confirm";
    let subject = peq == -1 ? [] : [ peq.PEQId ];
    
    // peq may be out of date (no ingest).  Must rely on linkage table
    if( link.GHColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
	// the entire issue has been given to us here.  Recreate it.
	console.log( "WARNING.  Can't delete issue associated with an accrued PEQ.  Rebuilding.." );
	assert( peq != -1 );
	
	const msg = "Accrued PEQ issues can not be deleted.  CodeEquity has rebuilt it.";
	const issueData = await ghSafe.rebuildIssue( installClient, pd.GHOwner, pd.GHRepo, pd.reqBody.issue, msg );
	const cardId    = await ghSafe.createProjectCard( installClient, link.GHColumnId, issueData[0], true );
	
	await ghSafe.updateIssue( installClient, pd.GHOwner, pd.GHRepo, issueData[1], "closed" );
	ghLinks.rebuildLinkage( installClient, link, issueData, cardId );
	
	// issueId is new, we need a new peq.  create that here, then create a 'reject delete' pact below while deactivating the old one.
	pd.GHAssignees  = peq.GHHolderId;
	pd.peqType      = peq.PeqType;
	pd.peqValue     = peq.Amount;
	pd.projSub      = peq.GHProjectSub;
	pd.GHProjectId  = peq.GHProjectId;
	pd.GHIssueId    = issueData[0].toString();
	pd.GHIssueTitle = peq.GHIssueTitle;
	
	let newPEQId = await utils.recordPeqData( installClient, pd, false );
	subject.push( newPEQId );
	verb = "reject";
    }
    else { ghLinks.removeLinkage({"installClient": installClient, "issueId": pd.GHIssueId }); }

    if( peq != -1 ) {
	utils.removePEQ( installClient, peq.PEQId );
	utils.recordPEQAction(
	    installClient,
	    config.EMPTY,     // CE UID
	    pd.GHCreator,     // gh user name
	    pd.GHFullName,    // of the repo
	    verb,
	    "delete",         // action
	    subject,
	    "delete",        // note
	    utils.getToday(), // entryDate
	    pd.reqBody        // raw
	);
    }
}


// Actions: opened, edited, deleted, closed, reopened, labeled, unlabeled, transferred, 
//          pinned, unpinned, assigned, unassigned,  locked, unlocked, milestoned, or demilestoned.
// Note: issue:opened         notification after 'submit' is pressed.
//       issue:labeled        notification after click out of label section
//       project_card:created notification after submit, then projects:triage to pick column.
async function handler( installClient, ghLinks, pd, action, tag ) {

    // Sender is the event generator.
    let sender   = pd.reqBody['sender']['login'];
    console.log( installClient[4], pd.reqBody.issue.updated_at, "issue title:", pd.reqBody['issue']['title'], action );
    
    // XXX Will probably want to move peq value check here or further up, for all below, once this if filled out

    // title can have bad, invisible control chars that break future matching, esp. w/issues created from GH cards
    pd.GHIssueId    = pd.reqBody['issue']['id'];
    pd.GHIssueNum   = pd.reqBody['issue']['number'];		
    pd.GHCreator    = pd.reqBody['issue']['user']['login'];
    pd.GHIssueTitle = (pd.reqBody['issue']['title']).replace(/[\x00-\x1F\x7F-\x9F]/g, "");  

    // await gh.checkRateLimit(installClient);

    switch( action ) {
    case 'labeled':
	// Can get here at any point in issue interface by adding a label, peq or otherwise
	// Should not get here from adding alloc card - that is a bot action.
	// Can peq-label any type of issue (newborn, carded, situated) that is not >= PROJ_ACCR
	// PROJ_PEND label can be added during pend negotiation
	// ... but it if is situated already, adding a second peq label is ignored.
	// Note: a 1:1 mapping issue:card is maintained here, via utils:resolve.  So, this labeling is relevant to 1 card only
	// Note: if n labels were added at same time, will get n notifications, where issue.labels are all including ith, and .label is ith of n

	// XXXX XXXXX This will go away with ceFlutter
	if( gh.populateRequest( pd.reqBody['issue']['labels'] )) {
	    await gh.populateCELinkage( installClient, ghLinks, pd );
	    return;
	}
	
	pd.peqValue = ghSafe.theOnePEQ( pd.reqBody.issue.labels );

	// more than 1 peq?  remove it.
	let curVal  = ghSafe.parseLabelDescr( [ pd.reqBody.label.description ] );
	if( pd.peqValue <= 0 && curVal > 0 ) {
	    console.log( "WARNING.  Only one PEQ label allowed per issue.  Removing most recent label." );
	    await ghSafe.removeLabel( installClient, pd.GHOwner, pd.GHRepo, pd.reqBody.issue.number, pd.reqBody.label );
	    return;
	}

	// Current notification not for peq label?
	if( pd.peqValue <= 0 || curVal <= 0 ) {
	    console.log( "Not a PEQ issue, or not a PEQ label.  No action taken." );
	    return;
	}
	
	// Was this a carded issue?  Get linkage
	let links = ghLinks.getLinks( installClient, { "issueId": pd.GHIssueId } );
	assert( links == -1 || links.length == 1 );
	let link = links == -1 ? links : links[0];

	// Newborn PEQ issue, pre-triage.  Create card in unclaimed to maintain promise of linkage in dynamo,
	// since can't create card without column_id.  No project, or column_id without triage.
	if( link == -1 || link.GHColumnId == -1) {
	    if( link == -1 ) {    
		link = {};
		let card = await gh.createUnClaimedCard( installClient, pd.GHOwner, pd.GHRepo, pd.GHIssueId );
		let issueURL = card.content_url.split('/');
		assert( issueURL.length > 0 );
		link.GHIssueNum  = parseInt( issueURL[issueURL.length - 1] );  // XXX already have this
		link.GHCardId    = card.id
		link.GHProjectId = card.project_url.split('/').pop();
		link.GHColumnId  = card.column_url.split('/').pop();
	    }
	    else {  // newborn issue, or carded issue.  colId drives rest of link data in PNP
		let card = await gh.getCard( installClient, link.GHCardId );
		link.GHColumnId  = card.column_url.split('/').pop();
	    }
	}

	pd.updateFromLink( link );
	console.log( installClient[1], "Ready to update Proj PEQ PAct:", link.GHCardId, link.GHIssueNum );

	let content = [];
	content.push( pd.GHIssueTitle );
	content.push( config.PDESC + pd.peqValue.toString() );
	let retVal = await utils.processNewPEQ( installClient, ghLinks, pd, content, link );

	// Attempted to label >= ACCR.  GH has already applied it, so remove
	// XXX This should not be possible, as would be 2nd peq label since ACCR already has one
	if( retVal == "removeLabel" ) {
	    assert( false ); 
	    console.log( "..removing GH label on ACCR card" );
	    link.GHColumnId = -1;
	    await ghSafe.removeLabel( installClient, pd.GHOwner, pd.GHRepo, link.GHIssueNum, pd.reqBody.label );
	}
	break;
    case 'unlabeled':
	// Can unlabel issue that may or may not have a card, as long as not >= PROJ_ACCR.  
	// Do not move card, would be confusing for user.
	{
	    // Unlabel'd label data is not located under issue.. parseLabel looks in arrays
	    pd.peqValue = ghSafe.parseLabelDescr( [ pd.reqBody['label']['description'] ] );
	    if( pd.peqValue <= 0 ) {
		console.log( "Not a PEQ label, no action taken." );
		return;
	    }
	    let links = ghLinks.getLinks( installClient, { "repo": pd.GHFullName, "issueId": pd.GHIssueId } );
	    let link = links[0]; // cards are 1:1 with issues, this is peq
	    let newNameIndex = config.PROJ_COLS.indexOf( link.GHColumnName );	    

	    // GH already removed this.  Put it back.
	    if( newNameIndex >= config.PROJ_ACCR ) { 
		console.log( "WARNING.  Can't remove the peq label from an accrued PEQ" );
		ghSafe.addLabel( installClient, pd.GHOwner, pd.GHRepo, pd.GHIssueNum, pd.reqBody.label );
		return;
	    }
	    
	    // XXX Inform contributors that status is now UNTRACKED
	    let peq = await utils.getPeq( installClient, pd.GHIssueId );	
	    console.log( "PEQ Issue unlabeled" );
	    ghLinks.rebaseLinkage( installClient, pd.GHIssueId );   // setting various to -1, as it is now untracked
	    utils.removePEQ( installClient, peq.PEQId );
	    utils.recordPEQAction(
		installClient,
		config.EMPTY,     // CE UID
		pd.GHCreator,     // gh user name
		pd.GHFullName,    // of the repo
		"confirm",        // verb
		"delete",         // action
		[ peq.PEQId ],    // subject
		"unlabel",        // note
		utils.getToday(), // entryDate
		pd.reqBody        // raw
	    );
	}
	break;
    case 'deleted':
	// Delete card of carded issue sends 1 notification.  Delete issue of carded issue sends two: card, issue, in random order.
	// This must be robust given differnet notification order of { delIssue, delCard} 
	
	// Get here by: deleting an issue, which first notifies deleted project_card (if carded or situated)
	// Similar to unlabel, but delete link (since issueId is now gone).  No access to label
	await deleteIssue( installClient, ghLinks, pd );
	break;
    case 'closed':
    case 'reopened':
	console.log( installClient[1], "closed or reopened" );

	pd.peqValue = ghSafe.theOnePEQ( pd.reqBody['issue']['labels'] );
	if( pd.peqValue <= 0 ) {
	    console.log( "Not a PEQ issue, no action taken." );
	    return;
	}

	// Get array: [proj_id, col_idx4]
	// XXX getLayout and moveIssue both call getGHCard
	let ceProjectLayout = await gh.getCEProjectLayout( installClient, ghLinks, pd.GHIssueId );
	if( ceProjectLayout[0] == -1 ) {
	    console.log( "Project does not have recognizable CE column layout.  No action taken." );
	}
	else {
	    let success = await gh.moveIssueCard( installClient, ghLinks, pd.GHOwner, pd.GHRepo, [pd.GHIssueId, pd.GHIssueNum], action, ceProjectLayout ); 
	    if( success ) {
		console.log( installClient[1], "Find & validate PEQ" );
		let peqId = ( await( ghSafe.validatePEQ( installClient, pd.GHFullName, pd.GHIssueId, pd.GHIssueTitle, ceProjectLayout[0] )) )['PEQId'];
		if( peqId == -1 ) {
		    console.log( installClient[1], "Could not find or verify associated PEQ.  Trouble in paradise." );
		}
		else {
		    // githubCardHandler:recordMove must handle many more options.  Choices here are limited.
		    // Closed: 
		    let verb = "propose";
		    let paction = "accrue";
		    if( action == "reopened" ) { verb = "reject"; }
		    
		    let subject = [ peqId.toString() ];
		    utils.recordPEQAction(
			installClient,
			config.EMPTY,     // CE UID
			sender,           // gh user name
			pd.GHFullName,    // of the repo
			verb,
			paction,
			subject,          // subject
			"",               // note
			utils.getToday(), // entryDate
			pd.reqBody        // raw
		    );
		}
	    }
	    else { console.log( "Unable to complete move of issue card.  No action taken" ); }
	}
	break;
    case 'assigned': 
	{
	    // Careful - reqBody.issue carries it's own assignee data, which is not what we want here
	    console.log( installClient[1], "Assign", pd.reqBody.assignee.login, "to issue", pd.GHIssueId );
	    
	    pd.peqValue = ghSafe.theOnePEQ( pd.reqBody['issue']['labels'] );
	    if( pd.peqValue <= 0 ) {
		console.log( "Not a PEQ issue, no action taken." );
		return;
	    }
	    
	    // Peq issues only.  PEQ tracks assignees from ceFlutter.  Just send PAct upstream.
	    let peq = await utils.getPeq( installClient, pd.GHIssueId );
	    let assignee = pd.reqBody.assignee.login;
	    let verb = "confirm";
	    let action = "change";
	    let subject = [peq.PEQId.toString(), assignee];
	    utils.recordPEQAction(
		installClient,
		config.EMPTY,     // CE UID
		sender,           // gh user name
		pd.GHFullName,    // of the repo
		verb,
		action,
		subject,          // subject
		"add assignee",   // note
		utils.getToday(), // entryDate
		pd.reqBody        // raw
	    );
	}
	break;
    case 'unassigned':
	{
	    console.log( "Unassign", pd.reqBody.assignee.login, "from issue", pd.GHIssueId );
	    
	    pd.peqValue = ghSafe.theOnePEQ( pd.reqBody['issue']['labels'] );
	    if( pd.peqValue <= 0 ) {
		console.log( "Not a PEQ issue, no action taken." );
		return;
	    }
	    
	    let peq = await utils.getPeq( installClient, pd.GHIssueId );
	    let assignee = pd.reqBody.assignee.login;
	    let verb = "confirm";
	    let action = "change";
	    let subject = [peq.PEQId.toString(), assignee];
	    utils.recordPEQAction(
		installClient,
		config.EMPTY,     // CE UID
		sender,           // gh user name
		pd.GHFullName,    // of the repo
		verb,
		action,
		subject,          // subject
		"remove assignee",   // note
		utils.getToday(), // entryDate
		pd.reqBody        // raw
	    );
	}
	break;
    case 'edited':
	// Only need to catch title edits, and only for situated.  
	{
	    if( pd.reqBody.changes.hasOwnProperty( 'title' ) && 
		pd.reqBody.changes.title.hasOwnProperty( 'from' )) {

		const newTitle = pd.reqBody.issue.title;
		let links = ghLinks.getLinks( installClient, { "repo": pd.GHFullName, "issueId": pd.GHIssueId } );
		let link = links == -1 ? links : links[0]; 

		if( link != -1 && link.GHCardTitle != config.EMPTY) {

		    // Unacceptable for ACCR.  No changes, no PAct.  Put old title back.
		    if( link.GHColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
			console.log( "WARNING.  Can't modify PEQ issues that have accrued." );
			ghSafe.updateTitle( installClient, pd.GHOwner, pd.GHRepo, pd.GHIssueNum, link.GHCardTitle );
		    }
		    else {
			assert( pd.reqBody.changes.title.from == link.GHCardTitle );
			console.log( "Title changed from", link.GHCardTitle, "to", newTitle );
			
			// if link has title, we have situated card.
			ghLinks.updateTitle( installClient, link, newTitle );
			let peq = await utils.getPeq( installClient, pd.GHIssueId );
			assert( peq != -1 );  
			const subject = [ peq.PEQId, newTitle ]; 
			utils.recordPEQAction(
			    installClient,
			    config.EMPTY,     // CE UID
			    sender,           // gh user name
			    pd.GHFullName,    // of the repo
			    "confirm",
			    "change",
			    subject,          
			    "Change title",   // note
			    utils.getToday(), // entryDate
			    pd.reqBody        // raw
			);
		    }
		}
	    }
	}
	break;
    case 'transferred':
	// Transfer IN:  do nothing.  comes as newborn issue, no matter what it was in previous repo

	// Transfer OUT: Peq?  remove.  (open issue in new repo, delete project card, transfer issue)
	{
	    if( pd.reqBody.changes.new_repository.full_name != pd.GHRepo ) {
		console.log( installClient[1], "Transfer out.  Cleanup." );
		await deleteIssue( installClient, ghLinks, pd );
	    }
	}
	break;

    case 'opened':	        // Do nothing.
	// Get here with: Convert to issue' on a newborn card, which also notifies with project_card converted.  handle in cards.
	// Get here with: or more commonly, New issue with submit.
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

exports.handler = handler;
