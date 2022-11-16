var config      = require( '../../config' );
var assert      = require( 'assert' );

const utils = require( '../../utils/ceUtils' );

const ghClassic = require( '../../utils/gh/ghc/ghClassicUtils' );
const gh        = ghClassic.githubUtils;
const ghSafe    = ghClassic.githubSafe;

// XXX 
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


// XXX
// Actions: opened, edited, deleted, closed, reopened, labeled, unlabeled, transferred, 
//          pinned, unpinned, assigned, unassigned,  locked, unlocked, milestoned, or demilestoned.
// Note: issue:opened         notification after 'submit' is pressed.
//       issue:labeled        notification after click out of label section
//       project_card:created notification after submit, then projects:triage to pick column.
async function handler( authData, ghLinks, pd, action, tag ) {

    // Actor is the event generator.
    let actor   = pd.actor;
    console.log( authData.who, "start", authData.job );
    
    // await gh.checkRateLimit(authData);

    switch( action ) {
    case 'labeled':
	// Can get here at any point in issue interface by adding a label, peq or otherwise
	// Can peq-label newborn and carded issues that are not >= PROJ_PEND
	// PROJ_PEND label can be added during pend negotiation, but it if is situated already, adding a second peq label is ignored.
	// Note: a 1:1 mapping issue:card is maintained here, via utils:resolve.  So, this labeling is relevant to 1 card only
	// Note: if n labels were added at same time, will get n notifications, where issue.labels are all including ith, and .label is ith of n
	{
	}
	break;
    case 'unlabeled':
	// Can unlabel issue that may or may not have a card, as long as not >= PROJ_ACCR.  
	// Do not move card, would be confusing for user.
	{
	}
	break;
    case 'deleted':
	// Delete card of carded issue sends 1 notification.  Delete issue of carded issue sends two: card, issue, in random order.
	// This must be robust given different notification order of { delIssue, delCard}

	// NOTE!!  As of 6/8/2022 the above is no longer true.  delIssue notification is generated, delCard is.. well.. see deleteIssue comments.
	
	// Get here by: deleting an issue, which first notifies deleted project_card (if carded or situated)
	// Similar to unlabel, but delete link (since issueId is now gone).  No access to label
	// Wait here, since delete issue can createUnclaimed
	{
	}
	break;
    case 'closed':
    case 'reopened':
	{
	}
	break;
    case 'assigned': 
    case 'unassigned':
	{
	}
	break;
    case 'edited':
	// Only need to catch title edits, and only for situated.  
	{
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
	console.log( "PV2ItemHandler Unrecognized action:", action );
	break;
    }
    
    return;
}

exports.handler    = handler;
