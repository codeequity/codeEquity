import assert   from 'assert';

import * as config   from '../../../config.js';

import * as utils    from '../../../utils/ceUtils.js';
import * as awsUtils from '../../../utils/awsUtils.js';
import * as ghUtils  from '../../../utils/gh/ghUtils.js';

import * as ghV2        from '../../../utils/gh/gh2/ghV2Utils.js';
import * as ingestUtils from '../../../utils/gh/gh2/ingestUtils.js';

import * as cardHandler from './cardHandler.js';

// Terminology:
// ceProject:      a codeequity project that includes 0 or more gh projects that CE knows about
// newborn card :  a card without an issue.. these are draft issues, ignored by ceServer
// newborn issue:  a plain issue without a project card, without PEQ label
// situated issue: an issue with a card, with or without a PEQ label.  May reside in unclaimed if PID not known.
//                 i.e. situated is a set containing carded and peq.
// carded issue:   an issue with a card, but no PEQ label.
// PEQ issue:      a situated issue with a PEQ label

// Guarantee: For every repo that is part of a ceProject:
//            1) Every carded issue in that repo resides in the linkage table. but without column info, issue and project names
//            2) Newborn issues and newborn cards can exist, but will not reside in the linkage table.
//            3) {label, add card} operation on newborn issues will cause conversion to a situated issue (carded or peq) as needed,
//               and inclusion in linkage table.
//            4) there is a 1:{0,1} mapping between issue:card
//            Implies: {open} newborn issue will not create linkage.. else the attached PEQ would be confusing

// When issueHandler:delete is called, GH will remove card as well.  Call deleteCard from here.
async function deleteIssue( authData, ghLinks, ceProjects, pd ) {

    let tstart = Date.now();
    
    // newborn issue?
    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "issueId": pd.issueId });
    if( links === -1 ) { return; }
    let link = links[0];

    console.log( authData.who, "delIss: DELETE FOR", pd.issueId, link.hostProjectId );

    await cardHandler.deleteCard( authData, ghLinks, ceProjects, pd, link.hostCardId, true );
    
    // After August 2021, GitHub notifications no longer have labels in the pd.reqBody after a GQL issue delete.
    // Can no longer short-circuit to no-op when just carded (delete issue also sends delete card, which handles linkage)
    // [pd.peqValue, _] = ghUtils.theOnePEQ( pd.reqBody['issue']['labels'] );
    // if( pd.peqValue <= 0 ) return;

    // Card is gone, issue is gone.  Delete card handled all but the one case below, in which case it leaves link intact.
    console.log( authData.who, "Delete issue finished, ms:", Date.now() - tstart );

}

// During bad xfer, an issue is created in a cross CEProject repo.  
// XXX Was a permission error.  If this does not fail by 6/25, eliminate function.  Fail 7/8  2x same spot... perms change???
async function waitDelIssue( authData, issueId ) {
    console.log( "Attempting to delete xferd issue", issueId );
    await utils.sleep( 2000 ); 
    await ghV2.remIssue( authData, issueId );
}

// labelIssue must deal with new wrinkles
//   0) item:create can arrive before issue:label and issue:open   demote?
//   1) GH issue dialog can specify project.
//      So when issue:label is received, card may exist in noStatus.  Or not, then issueLabel must createUnclaimed.
async function labelIssue( authData, ghLinks, ceProjects, pd, issueNum, issueLabels, label ) {
    // Zero's peqval if 2 found
    pd.peqValue = ghUtils.theOnePEQ( issueLabels );  

    // label may be from json payload, or from internal call.  Convert id format.
    if( utils.validField( label, "node_id" ) ) { label.id = label.node_id; }
        
    // Was this a situated issue?  Get linkage
    // Note: During initial creation, some item:create notifications are delayed until issue:label, so no linkage (yet)
    // Note: if issue is opened with a project selected, we will receive open, label and create notices.
    //       so, card may exist in GH, but linkage has not been established yet if label preceeds create.
    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repoId": pd.repoId, "issueId": pd.issueId } );
    assert( links === -1 || links.length == 1 );
    let link = links === -1 ? links : links[0];

    let curVal  = ghUtils.parseLabelDescr( [ label.description ] );

    // more than 1 peq?  remove it.
    if( pd.peqValue <= 0 && curVal > 0 ) {

	// Check for negotiation potential - if in PEND, owner (XXX) can add new peq label, then approve.
	assert( link != -1 );
	if( link.hostColumnName == config.PROJ_COLS[config.PROJ_PEND] ) {
	    console.log( authData.who, "Negotiated PEQ label detected in PEND for", pd.issueId, ".  Remove original, keep new" );

	    let origLabel = -1;
	    for( const alab of issueLabels ) {
		let tval = ghUtils.parseLabelDescr( [ alab.description ] );
		if( tval > 0 && tval != curVal ) {
		    origLabel = utils.validField( alab, "node_id" ) ? alab.node_id : alab.id;
		    break;
		}
	    }
	    assert( origLabel != -1 );
	    ghV2.removeLabel( authData, origLabel, pd.issueId );
	    
	    // Don't wait.  this doesn't push to aws
	    awsUtils.changeReportPEQVal( authData, pd, curVal, link );  // XXX new note for PACT would make sense.
	    return false;
	}
	else{
	    console.log( authData.who, "WARNING.  Only one PEQ label allowed per issue.  Removing most recent label." );
	    // Don't wait, no dependence
	    ghV2.removeLabel( authData, label.id, pd.issueId );
	    return false;
	}
    }

    // Current notification not for peq label?
    if( pd.peqValue <= 0 || curVal <= 0 ) {
	console.log( authData.who, "Not a PEQ issue, or not a PEQ label.  No action taken." );
	return false;
    }

    // get card from GH.  Can only be 0 or 1 cards (i.e. new nostatus), since otherwise link would have existed after populate
    // NOTE: occasionally card creation happens a little slowly, so this triggers instead of 'carded issue with status'
    let card = await ghV2.getCardFromIssue( authData, pd.issueId );
    if( card == -1 ) {
	console.log( "WARNING.  Issue Id no longer exists.  Ignoring label." );
	return false;
    }

    // console.log( "label cePID", pd.ceProjectId, card );
    // We have a peq.  Make sure project is linked in ceProj, PNP is dependent on locs existing.
    let projLinks = ghLinks.getLocs( authData, { ceProjId: pd.ceProjectId, pid: card.pid } );
    if( projLinks === -1 ) { await ghLinks.linkProject( authData, pd.ceProjectId, card.pid ); }
    
    // Newborn PEQ issue, pre-triage?  Create card in unclaimed to maintain promise of linkage in dynamo.
    if( link === -1 || link.hostCardId == -1) {

	if( !utils.validField( card, "cardId" )) {
	    console.log( authData.who, "Newborn peq issue" );
	    assert( link === -1 );
	    link = {};
	    card = await ghV2.createUnClaimedCard( authData, ghLinks, ceProjects, pd, pd.issueId, false );
	}
	else if( utils.validField( card, "cardId" ) && !utils.validField( card, "columnId" ) ) {  // label notice beat create notice
	    console.log( authData.who, "carded issue, no status -> peq issue", link === -1 );
	    link = {};
	    // No link, no loc.
	    // Card has project.  "No Status" is a special case, it has a null value in gql response from GH.
	    card.columnName = "No Status";
	    card.columnId   = "No Status";
	}
	else {
	    console.log( authData.who, "carded issue with status -> peq issue" );
	    // link can still be -1 if issue was created on GH with project, then moved, before label or create notices arrive
	    // link can also be -1 if issue created on GH with project, then carded.  notification sequence can be label move create
	    if( link === -1 ) { link = {}; }
	}

	assert( pd.issueNum >= 0 );
	link.hostIssueNum   = pd.issueNum;
	link.hostCardId     = card.cardId
	link.hostProjectId  = card.pid;
	link.hostColumnId   = card.columnId;
	link.hostColumnName = card.columnName;;

    }
    else {
	// Issue is carded, but may be untracked.  update col data.  projectName?  utility?
	link.hostColumnId   = card.columnId;
	link.hostColumnName = card.columnName;;
	console.log( "issue is already carded", link );
    }
    
    // ceFlutter ingest summarization needs relo for loc data when there is no subsequent card:move
    let specials = { pact: "addRelo", columnId: link.hostColumnId };
    
    pd.updateFromLink( link );
    console.log( authData.who, "Ready to update Proj PEQ PAct:", link.hostCardId, link.hostIssueNum, link.hostColumnName );

    // Could getFullIssue, but we already have all required info
    let content                      = {};
    content.title                    = pd.issueName;
    content.number                   = pd.issueNum;
    content.repository               = {};
    content.repository.id            = pd.repoId;
    content.repository.nameWithOwner = pd.repoName;
    content.labelContent             = pd.reqBody.label.description;
    content.labelNodeId              = pd.reqBody.label.node_id;
	
    // Don't wait, no dependence.  Be aware link may be incomplete until this first PNP finishes
    let retVal = ingestUtils.processNewPEQ( authData, ghLinks, pd, content, link, specials );
    return (retVal != 'early' && retVal != 'removeLabel')
}


// Actions: opened, edited, deleted, closed, reopened, labeled, unlabeled, transferred, 
//          pinned, unpinned, assigned, unassigned,  locked, unlocked, milestoned, or demilestoned.
// Note: issue:opened         notification after 'submit' is pressed.
//       issue:labeled        notification after click out of label section
//       project_card:created notification after submit, then projects:triage to pick column.
async function handler( authData, ceProjects, ghLinks, pd, action, tag ) {

    // console.log( authData.job, pd.reqBody.issue.updated_at, "issue title:", pd.reqBody['issue']['title'], action );
    console.log( authData.who, "issueHandler start", authData.job );

    // title can have bad, invisible control chars that break future matching, esp. w/issues created from GH cards
    pd.issueId    = pd.reqBody.issue.node_id;         // issue content id
    pd.issueNum   = pd.reqBody.issue.number;		
    pd.actor      = pd.reqBody.sender.login;
    pd.issueName  = (pd.reqBody.issue.title).replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    pd.repoName   = pd.reqBody.repository.full_name; 
    pd.repoId     = pd.reqBody.repository.node_id; 
    
    switch( action ) {
    case 'labeled':
	// Can get here at any point in issue interface by adding a label, peq or otherwise
	// Can peq-label newborn and carded issues that are not >= PROJ_PEND
	// PROJ_PEND label can be added during pend negotiation, but it if is peq already, adding a second peq label is ignored.
	// Note: a 1:1 mapping issue:card is maintained here, via resolve.  So, this labeling is relevant to 1 card only
	// Note: if n labels were added at same time, will get n notifications, where issue.labels are all including ith, and .label is ith of n
	{
	    
	    assert( utils.validField( pd.reqBody, "repository" ) && utils.validField( pd.reqBody.repository, "node_id" ));
	    // console.log( "Label issue", pd.reqBody );
	    // pd.show();
	    let success = await labelIssue( authData, ghLinks, ceProjects, pd, pd.reqBody.issue.number, pd.reqBody.issue.labels, pd.reqBody.label );
	    
	    // Special case.  Closed issue in flat column just labeled PEQ.  Should now move to PEND.
	    // Will not allow this in ACCR.
	    if( success && pd.reqBody.issue.state == 'CLOSED' ) {

		console.log( "PEQ labeled closed issue." )

		// Must be peq by now.  Move, if in flatworld.
		let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repoId": pd.repoId, "issueId": pd.issueId } );
		assert( links.length == 1 );
		let link = links[0];

		if( !config.PROJ_COLS.includes( link.hostColumnName )) {

		    let ceProjectLayout = await ghV2.getCEProjectLayout( authData, ghLinks, pd );
		    if( ceProjectLayout[0] == -1 ) { console.log( "Could not find projectId for issue.  No action taken." ); }
		    else {
			// Must wait.  Move card can fail if, say, no assignees
			let newColId = await ghV2.moveToStateColumn( authData, ghLinks, pd, 'CLOSED', ceProjectLayout ); 
			if( newColId ) {
		    
			    // NOTE.  Spin wait for peq to finish recording from PNP in labelIssue above.  Should be rare.
			    let peq = await utils.settleWithVal( "validatePeq", awsUtils.validatePEQ, authData, pd.ceProjectId,
								 link.hostIssueId, link.hostIssueName, link.hostRepoId );

			    ingestUtils.recordMove( authData, ghLinks, pd, -1, config.PROJ_PEND, link, peq );
			}
		    }
		}
	    }
	    
	}
	break;
    case 'unlabeled':
	// Can unlabel issue that may or may not have a card, as long as not >= PROJ_PEND.
	// Do not move card, would be confusing for user.
	{
	    // Unlabel'd label data is not located under issue.. parseLabel looks in arrays
	    if( typeof pd.reqBody.label !== 'undefined' ) {
		pd.peqValue = ghUtils.parseLabelDescr( [ pd.reqBody.label.description ] );
		if( pd.peqValue <= 0 ) {
		    console.log( "Not a PEQ label, no action taken." );
		    return;
		}
	    }
	    else {
		console.log( authData.who, "Label was deleted.  Stop, let labelHandler address this." );
		return;
	    }
	    
	    // At this point, PEQ label
	    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repoId": pd.repoId, "issueId": pd.issueId } );
	    let link = links[0]; // cards are 1:1 with issues, this is peq
	    let newNameIndex = config.PROJ_COLS.indexOf( link.hostColumnName );	    
	    
	    // GH already removed this.  Put it back.
	    if( newNameIndex >= config.PROJ_ACCR ) {
		console.log( "WARNING.  Can't remove the peq label from an accrued PEQ" );
		ghV2.addLabel( authData, pd.reqBody.label.node_id, pd.issueId ); 
		return;
	    }
	    if( newNameIndex >= config.PROJ_PEND ) {
		console.log( "WARNING.  Can't remove the peq label from an proposed PEQ." );
		ghV2.addLabel( authData, pd.reqBody.label.node_id, pd.issueId ); 
		return;
	    }
	    
	    let peq = await awsUtils.getPEQ( authData, pd.ceProjectId, pd.issueId );	
	    console.log( "WARNING.  PEQ Issue unlabeled, issue no longer tracked." );
	    ghLinks.rebaseLinkage( authData, pd.ceProjectId, pd.issueId );   // setting various to EMPTY, as it is now untracked
	    awsUtils.removePEQ( authData, peq.PEQId );
	    awsUtils.recordPEQAction( authData, config.EMPTY, pd, 
				      config.PACTVERB_CONF, config.PACTACT_DEL,	[ peq.PEQId ], config.PACTNOTE_UNLB,
				      utils.getToday() ); 
	}
	break;
    case 'deleted':
	// Delete card of situated issue sends itemHandler:deleted.  Delete issue of situated issue sends issueHandler:delete
	
	// Similar to unlabel, but delete link (since issueId is now gone).  No access to label
	// Wait here, since delete issue can createUnclaimed
	await deleteIssue( authData, ghLinks, ceProjects, pd );
	break;
    case 'closed':
    case 'reopened':
	{
	    console.log( authData.who, "closed or reopened" );

	    pd.peqValue = ghUtils.theOnePEQ( pd.reqBody['issue']['labels'] );
	    if( pd.peqValue <= 0 ) {
		console.log( authData.who, "Not a PEQ issue, no action taken." );
		return;
	    }

	    // Get array: [proj_id, col_idx4]
	    let ceProjectLayout = await ghV2.getCEProjectLayout( authData, ghLinks, pd );
	    if( ceProjectLayout[0] == -1 ) {
		console.log( "Project does not have recognizable CE column layout.  No action taken." );
	    }
	    else {
		pd.projectId = ceProjectLayout[0];
		// Must wait.  Move card can fail if, say, no assignees
		let newColId = await ghV2.moveToStateColumn( authData, ghLinks, pd, action, ceProjectLayout ); 
		if( newColId ) {
		    console.log( authData.who, "Find & validate PEQ" );
		    let peqId = ( await( awsUtils.validatePEQ( authData, pd.ceProjectId, pd.issueId, pd.issueName, pd.repoId )) )['PEQId'];
		    if( peqId === -1 ) {
			console.log( authData.who, "Could not find or verify associated PEQ.  Trouble in paradise." );
		    }
		    else {
			// ingestUtils:recordMove must handle many more options.  Choices here are limited.
			// Closed: 
			let verb    = config.PACTVERB_PROP;
			let paction = config.PACTACT_ACCR;
			let subject = [ peqId.toString() ];

			if( action == "reopened" ) {
			    verb = config.PACTVERB_REJ;
			    subject = [ peqId.toString(), newColId.toString() ];
			}
			
			awsUtils.recordPEQAction( authData, config.EMPTY, pd,
						  verb, paction, subject, "",
						  utils.getToday());
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

	    pd.peqValue = ghUtils.theOnePEQ( pd.reqBody['issue']['labels'] );
	    if( pd.peqValue <= 0 ) {
		console.log( "Not a PEQ issue, no action taken." );
		return;
	    }

	    // Peq issues only.  PEQ assignees are tracked in ceFlutter.  Just send PAct upstream.
	    let peq = await awsUtils.getPEQ( authData, pd.ceProjectId, pd.issueId );

	    // This should only happen during blast-issue creation.
	    if( peq === -1 ) {
		console.log( "Assignment to peq issue, but peq doesn't exist (yet).  Reshuffle." );
		return "postpone"; 
	    }
	    
	    let assignee   = pd.reqBody.assignee.login;
	    let assigneeId = pd.reqBody.assignee.node_id;  // NOTE: as of 3/2025 this is still the deprecated user id, not the new global id.  don't use it.
	    let verb = config.PACTVERB_CONF;
	    let paction = config.PACTACT_CHAN;
	    let note = ( action == "assigned" ? config.PACTNOTE_ADDA : config.PACTNOTE_REMA );

	    // Not if ACCR
	    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repoId": pd.repoId, "issueId": pd.issueId });
	    if( links !== -1 && links[0].hostColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
		console.log( "WARNING.", links[0].hostColumnName, "is reserved, accrued issues should not be modified.  Undoing this assignment." );
		paction = config.PACTACT_NOTE;
		note = "Bad assignment attempted";
		
		if( action == "assigned" ) { ghV2.remAssignee( authData, pd.issueId, assigneeId ); }
		else                       { ghV2.addAssignee( authData, pd.issueId, assigneeId ); }
	    }
	    
	    let subject = [peq.PEQId.toString(), assignee];
	    awsUtils.recordPEQAction( authData, config.EMPTY, pd, 
				   verb, paction, subject, note,
				   utils.getToday());
	}
	break;
    case 'edited':
	// Only need to catch title edits, and only for peq.
	// Will get this notice for a transfer, safe to ignore.
	{
	    if( pd.reqBody.changes.hasOwnProperty( 'title' ) && 
		pd.reqBody.changes.title.hasOwnProperty( 'from' )) {

		const newTitle = pd.reqBody.issue.title;
		let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "repo": pd.repoName, "issueId": pd.issueId } );
		let link = links === -1 ? links : links[0]; 

		// Ignores untracked issues
		if( link !== -1 && link.hostIssueName != config.EMPTY) {

		    // Unacceptable for ACCR.  No changes, no PAct.  Put old title back.
		    if( link.hostColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
			console.log( "WARNING.  Can't modify PEQ issues that have accrued." );
			ghV2.updateTitle( authData, pd.issueId, link.hostIssueName );
		    }
		    else {
			assert( pd.reqBody.changes.title.from == link.hostIssueName );
			console.log( "Title changed from", link.hostIssueName, "to", newTitle );
			
			// if link has title, we have peq card.
			ghLinks.updateTitle( authData, link, newTitle );
			let peq = await awsUtils.getPEQ( authData, pd.ceProjectId, pd.issueId );
			assert( peq !== -1 );
			const subject = [ peq.PEQId, newTitle ]; 
			awsUtils.recordPEQAction( authData, config.EMPTY, pd,
					       config.PACTVERB_CONF, config.PACTACT_CHAN, subject, config.PACTNOTE_CTIT,
					       utils.getToday());
		    }
		}
	    }
	}
	break;
    case 'transferred':
	// Multiple notifications
	// 1: issue:open       has full change field, with old_issue, old_repo (!)  (ignored)
	// 2: issue:edit       has a change, has new repo in normal repo field      (ignored)
	// 3: pv2Item edit     has change with type:repo and PVTF for field         (ignored)
	// 4: identical to #3                                                       (ignored)
	// 5: issue:transfer   has full change field, with new_issue, new_repo      (process)

	// GH transfers issue to new repo.  It does not remove or otherwise relocate the card.  Why should it?  Projects are views across repos,
	// so it is expected that card will remain in previous location.
	
	// Transfer from non-CE to ceProj: issue arrives as newborn.
	// Transfer out of ceProj: as above xfer out.

	// do not allow peq transfer between CEVentures.
	// do not allow peq transfer into or out of non-CEP repo.
	// p1_r1_cep1 to p1_r2_cep1:     link (CEP data).  link p1_r2 (adds all links/locs.  no need to resolve, as p1_r1 active).
	// p1_r1_cep1 to p1_r2_cep2:     link (CEP data).  link p1_r2 (adds all links/locs.  no need to resolve, as p1_r1 active).
	// p1_r1_cep1 to p1_r2_---:      carded? remove link. PEQ?  Move it back, link update is issDat only.  TODO: create split issue in p1_r2, non-peq (later)
	// p1_r1_---  to p1_r2_cep1:     any peq labels are removed before being activated.  resolve.  add link(s).  locs are good.
	
	// Transfer from ceProj to ceProj: issue arrives with peq labels, assignees.  
	// https://docs.github.com/en/issues/tracking-your-work-with-issues/transferring-an-issue-to-another-repository
	// only xfer between repos 1) owned by same person/org; 2) where you have write access to both
	
	{
	    let newIssueId  = pd.reqBody.changes.new_issue.node_id;
	    let newRepo     = pd.reqBody.changes.new_repository.full_name;
	    let newCEP      = await ceProjects.findByRepo( config.HOST_GH, pd.org, newRepo );

	    if( utils.validField( pd, "checkDuplicate" ) ) {
		let tdiff = ( Date.now() - pd.checkDuplicate ) / 10.0;
		console.log( authData.who, " .. checking request for checkDuplicate", newIssueId, tdiff );
		if( tdiff >= 10 ) {
		    console.log( authData.who, " - Ready.  Requesting check from aws." );
		    // No need to wait
		    awsUtils.checkDuplicate( authData, newCEP, newIssueId );
		    return;
		}
		else {
		    console.log( authData.who, " - not yet. Wait a bit" );
		    return "checkDuplicate"; 
		}
	    }
	    
	    let issueTitle  = pd.reqBody.issue.title;
	    
	    let oldIssueId  = pd.reqBody.issue.node_id;
	    let oldIssueNum = pd.reqBody.issue.number;
	    let oldRepo     = pd.reqBody.repository.full_name;
	    let oldRepoId   = pd.reqBody.repository.node_id;
	    let oldCEP      = await ceProjects.findByRepo( config.HOST_GH, pd.org, oldRepo );
	    let oldCEV      = ceProjects.findById( oldCEP ).CEVentureId;
	    
	    let newRepoId   = pd.reqBody.changes.new_repository.node_id;
	    let newIssueNum = pd.reqBody.changes.new_issue.number;
	    let newCEV      = ceProjects.findById( newCEP ).CEVentureId;

	    assert( issueTitle == pd.issueName );
	    
	    console.log( authData.who, "Transfer", issueTitle, "from:", oldCEP, oldIssueId, oldIssueNum, oldRepo, oldRepoId );
	    console.log( authData.who, "                          to:", newCEP, newIssueId, newIssueNum, newRepo, newRepoId );
	    console.log( authData.who, "PD                     holds:", pd.ceProjectId, pd.issueId, pd.issueNum, pd.repoName, pd.repoId );

	    // Bail if newborn card.
	    let links = ghLinks.getLinks( authData, { "ceProjId": oldCEP, "repo": oldRepo, "issueId": oldIssueId } );
	    if( links.length <= 0 ) {
		console.log( "Transferred issue is newborn, ignoring." );
		return;
	    }
	    assert( links.length == 1 );
	    let origLink = {...links[0]}; 
	    // console.log( authData.who, "old link", origLink );

	    let peq = await awsUtils.getPEQ( authData, pd.ceProjectId, oldIssueId, false );

	    // Undo if trying to move peq into repo that is not CEP.  ceServer should not create new ceProject without owner input.
	    // Undo if trying to move peq into a different CEVenture.  This is rare, complicated, and should be handled with a one-off agreement.
	    let nonCEP = ( newCEP == config.EMPTY && peq !== -1 );
	    let difCEV = ( oldCEV != config.EMPTY && newCEV != oldCEV && peq != -1 );
	    if( nonCEP || difCEV ) {
		if( nonCEP ) { console.log("Can not transfer a PEQ into a non-CodeEquity project.  Undoing transfer."); }
		if( difCEV ) { console.log("Can not transfer PEQs between CodeEquity Ventures.  Undoing transfer."); }

		// Can't transfer back, will come right back here.  Rebuild.
		let fullIssue = await ghV2.getFullIssue( authData, newIssueId );
		let issueData = await ghV2.rebuildIssue( authData, oldRepoId, origLink.hostProjectId, fullIssue, "Transfer failed, issue recreated." );
		
		// oldCEP peq has old issue id.  Need to repair it here else server discovers mismatching peqs.  Don't wait.
		let origPeq = await awsUtils.getPEQ( authData, oldCEP, oldIssueId, false );
		awsUtils.rehostPEQ( authData, origPeq, issueData[0] );
		
		// rebuild creates in no status.  move to correct loc.
		let locs = ghLinks.getLocs( authData, { "ceProjId": oldCEP, "pid": origLink.hostProjectId, "colId": origLink.hostColumnId } );
		assert( locs.length == 1 );
		
		await ghV2.moveCard( authData, origLink.hostProjectId, issueData[2], locs[0].hostUtility, origLink.hostColumnId );		

		// transfer may or may not send an extra issue:label notice for newCEP.  If it does, a peq is created that must be removed.
		let badPeq  = await awsUtils.getPEQ( authData, newCEP, newIssueId, false );
		if( badPeq != -1 ) {
		    awsUtils.removePEQ( authData, badPeq.PEQId );

		    let pdCopy = {};
		    pdCopy.ceProjectId = newCEP;
		    pdCopy.actor       = pd.actor;
		    pdCopy.actorId     = pd.actorId;
		    pdCopy.reqBody     = pd.reqBody;
		    awsUtils.recordPEQAction( authData, config.EMPTY, pdCopy, 
					      config.PACTVERB_CONF, config.PACTACT_DEL,	[ badPeq.PEQId ], config.PACTNOTE_BXFR,
					      utils.getToday() ); 
		}
		// mysteriously, can getFullIssue above, but sometimes GH is not ready to delete it here.  Don't wait
		// XXX not sent 7/8/25
		waitDelIssue( authData, newIssueId );  

		// a sibling notification 'label' MAY be generated.  If so, remove it.
		ghLinks.removeLinkage( { "authData": authData, "ceProjId": oldCEP, "issueId": oldIssueId } );
		links = ghLinks.getLinks( authData, { "ceProjId": newCEP, "repo": newRepo, "issueId": newIssueId } );
		if( links.length == 1 ) {
		    ghLinks.removeLinkage( { "authData": authData, "ceProjId": newCEP, "issueId": newIssueId } );
		    console.log( authData.who, "removed extra linkage from spurious label notification" );
		}

		let newLink = { ...origLink };
		newLink.hostIssueId  = issueData[0];
		newLink.hostIssueNum = issueData[1];
		newLink.hostCardId   = issueData[2];
		ghLinks.addLinkage( authData, oldCEP, newLink );

		let pdCopy = {};
		pdCopy.ceProjectId = oldCEP;
		pdCopy.actor       = pd.actor;
		pdCopy.actorId     = pd.actorId;
		pdCopy.reqBody     = pd.reqBody;

		const subject = [ peq.PEQId, oldIssueId, oldRepoId, oldCEP, issueData[0], oldRepoId, oldCEP ];
		awsUtils.recordPEQAction( authData, config.EMPTY, pdCopy,
					  config.PACTVERB_CONF, config.PACTACT_NOTE, subject, config.PACTNOTE_BXFR,
					  utils.getToday() );

		// XXX XXX remove this
		awsUtils.recordPEQAction( authData, config.EMPTY, pdCopy,
					  config.PACTVERB_CONF, config.PACTACT_NOTE, [], "",
					  utils.getToday() );


		return;
	    }

	    // XXX Reject carded (i.e. not official peq, but) with peq label from oldRepo not in CEP to newRepo in CEP. Else, could sneak accr in?
	    if( oldCEP == config.EMPTY ) { assert( false ); }

	    // To get here, either peq in cep cep world, carded in cep - ??? world.  Handle carded
	    if( newCEP == config.EMPTY ) {
		// Can only be carded from CEP.  remove link.
		ghLinks.removeLinkage( { "authData": authData, "ceProjId": oldCEP, "issueId": oldIssueId } );
		return;
	    }
	    
	    // To get here, cep cep world, either peq or carded.  both need to update link (remove/add)
	    let newLink = { ...origLink };
	    newLink.ceProjectId  = newCEP; 
	    newLink.hostIssueId  = newIssueId;
	    newLink.hostIssueNum = newIssueNum;
	    newLink.hostRepoName = newRepo;
	    newLink.hostRepoId   = newRepoId;
	    // XXX this link happens in every case above?
	    ghLinks.removeLinkage( { "authData": authData, "ceProjId": oldCEP, "issueId": oldIssueId } );

	    // wait for this, since linkProject rebuilds internal ceProjects from aws
	    // CEP to CEP, no need to provide cepDetails
	    await ghLinks.linkRepo( authData, ceProjects, newCEP, newRepoId, newRepo );
	    
	    // wait for this, PNP needs locs.
	    // (e.g. from testing, issue: CT Blast in cep:serv repo:ari proj:ghOps  goes to  cep:hak repo:ariAlt proj:ghOps with new issue_id)
	    // await ghLinks.linkProject( authData, ceProjects, newCEP, origLink.hostProjectId );
	    await ghV2.linkProject( authData, ghLinks, ceProjects, newCEP, pd.org, pd.actor, newRepoId, newRepo, origLink.hostProjectName ) 
	    await ghLinks.linkProject( authData, newCEP, origLink.hostProjectId );
	    
	    // Do this after linking project, so good link doesn't interfere with badlinks check during linkProject.
	    ghLinks.addLinkage( authData, newCEP, newLink );

	    if( peq !== -1 ) {
		
		// Only record PAct for peq.  PEQ may be removed, so don't require Active.
		// Transfer is PAct'd with oldCEP
		// NOTE: this record is async.  If just send in pd alone, the async won't start for a while, and pd can (is) rewritten before it starts
		//       Need to send copy.
		// NOTE: transfer sends a delete (handles old PEQ), and a justAdd (handles new PEQ).  GXFR not needed - notice for future proofing.
		let pdCopy = {};
		pdCopy.ceProjectId = oldCEP;
		pdCopy.actor       = pd.actor;
		pdCopy.actorId     = pd.actorId;
		pdCopy.reqBody     = pd.reqBody;
		const subject = [ peq.PEQId, oldIssueId, oldRepoId, oldCEP, newIssueId, newRepoId, newCEP ];
		awsUtils.recordPEQAction( authData, config.EMPTY, pdCopy,
					  config.PACTVERB_CONF, config.PACTACT_NOTE, subject, config.PACTNOTE_GXFR,
					  utils.getToday() );

		// Deactivate old peq, can't do much with old ID.
		awsUtils.removePEQ( authData, peq.PEQId );
		awsUtils.recordPEQAction( authData, config.EMPTY, pdCopy,
					  config.PACTVERB_CONF, config.PACTACT_DEL, [peq.PEQId], config.PACTNOTE_XFRD,
					  utils.getToday() );
		
		// add new peq so we can operate on it normally in case of server restart before ingest
		// link is all set, including card info.
		// use PNP, not fromCard.  Need to form link, overwrite some pd data, and provide issue.
		// NOTE. nearly all work in PNP is duplicated or wasted, but if build out transfer case, will want
		//       this template.

		let content                      = {};           // don't getIssue here, would have to wait a long time for it for fully form in GH
		content.title                    = newLink.hostIssueName;
		content.number                   = newIssueNum;
		content.repository               = {};
		content.repository.id            = newRepoId;
		content.repository.nameWithOwner = newRepo;
		pd.peqValue                      = peq.Amount;
		pd.peqType                       = peq.PeqType;
		pd.ceProjectId                   = newCEP;
		pd.issueId                       = newIssueId;
		ingestUtils.processNewPEQ( authData, ghLinks, pd, content, newLink, { havePeq: true, pact: "justAdd" } );

		// On a good transfer, GH will occasionally send a spurious label notification that can be received
		// shortly after the xfer notification was received.  In which case, an extra PEQ with same data different id is generated on aws
		// along with 2 excess pacts.  CheckDup tells ceServer to run as normal for ~10s, then correct this if it has occured.
		return "checkDuplicate"; 
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

export {handler};
export {labelIssue};
