var config      = require( '../../config' );
var assert      = require( 'assert' );

const utils = require( '../../utils/ceUtils' );

const ghClassic = require( '../../utils/gh/ghc/ghClassicUtils' );
const gh        = ghClassic.githubUtils;
const ghSafe    = ghClassic.githubSafe;
const ghV2      = require( '../../utils/gh/gh2/ghV2Utils' );

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


async function handler( authData, ghLinks, pd, action, tag ) {

    console.log( authData.who, "start", authData.job );
    
    // await gh.checkRateLimit(authData);

    // event:        projects_v2_item
    // action:       archived, converted, created, deleted, edited, reordered, restored
    // content_type: DraftIssue, Issue, PullRequest
    // from project_node_id, content_node_id can get project, labels, columns, maybe changes.
    // https://docs.github.com/en/graphql/overview/changelog
    // https://docs.github.com/en/graphql/reference
    // https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#projects_v2_item

    let actor   = pd.actor;        // Actor is the event generator.
    let reqBody = pd.reqBody;
    let item    = reqBody.projects_v2_item;

    // let projectDetail = await ghV2.getProjectFromNode( authData.pat, item.project_node_id );
    // console.log( "\n\n", "Got projectDetail:", projectDetail, "\n\n" );

    // Note: can't set repo here for pd.. can be several.  Should not need to..?
    pd.installationId = item.installation.id;
    pd.projectId      = item.project_node_id;
    console.log( "In pv2 handler, pd?");
    pd.show();

    assert( typeof item !== 'undefined' );

    if( item.content_type != "Issue" ) {
	console.log( "Skipping", item.content_type, action );
	console.log( reqBody );
	return;
    }

    // XXX need to pass in and return res from ceRouter


    //                       -> event           :action      content_type

    // Create issue notifications: (can ignore)
    // * create draft issue  -> projects_v2_item:created     draft issue
    // * convert draft issue -> projects_v2_item:reorder     draft issue     (sometimes)
    // * (pick a repo)       -> projects_v2_item:converted   issue
    //                       -> issues          :opened      XXX confirm event

    // Create label : have to open issue in new tab (!!)
    // * create new label    -> label          :created
    

    
    // Assign issue: 
    //                       -> issues          :assigned
    //                       -> projects_v2_item:edited     issue

    // Change issue status:
    //                       -> projects_v2_item:edited     issue

    // Close issue:
    // Shucks.  github auto process, actor:ghost moves card to 'done'.  But does not change status back to open.
    //                       -> issues          :closed
    // (ghost moves to done) -> projects_v2_item:edited     issue

    // Reopen issue: 
    //                       -> issues          :reopen

    
    // Create new status, new project:   nothing.  why.
    // Peq label draft issue: can't perform this action

    
    switch( action ) {
    case 'edited':
	{
	    //  -> issues          :labeled     
	    //  -> projects_v2_item:edited     issue
	    // This is the generic notification sent alongside the content-specific notice (i.e. issue:label).
	    // changes:field_value will have a projectV2Field that tells what field changed, but not what the change was.
	    // Need to then process the content-specific notice for details.
	    // Example:  { field_value: { field_node_id: 'PVTF_<*>', field_type: 'labels' }}
	    // So far, only processing use is to tie installation:id to hostProjectId
	    // No need to rebuild the map on server startup, since notice comes every time.  Demote content_node job this notice hasn't arrived yet.
	    console.log( "PV2ItemHandler", action );

	    // no need, checked in switcher
	    // assert( typeof item.changes !== 'undefined' && typeof item.changes.field_value !== 'undefined' && typeof item.changes.field_value.field_type !== 'undefined' );
	    // assert( item.changes.field_value.field_type == "labels" );

	    console.log( "PV2: Issue labels changed for app id", item.installation.id, "and projectv2 nodeId", item.id );
	    console.log( reqBody );
	}
	break;
    case 'converted':
	// Oddly, can add assignees to draft issue, but not labels.
	// This means converted can not be PEQ.  
	// When select "convert" a draft issue, one notification is 'reorder' for draft issue
	// another notification is 'converted' for issue.
	// third notification is 'opened' for event type issue, i.e. different handler
	{
	    console.log( "PV2ItemHandler", action, "No action required."  );
	    console.log( reqBody );
	}
	break;
    case 'created':
	{
	    // Draft issue only.  Could use this to offline look for new proj/col.
	    console.log( "PV2ItemHandler", action );
	    console.log( reqBody );
	}
	break;
    case 'deleted':
	{
	    console.log( "PV2ItemHandler", action );
	    console.log( reqBody );
	}
	break;
    case 'archived':
	{
	    console.log( "PV2ItemHandler", action );
	    console.log( reqBody );
	}
	break;
    case 'restored':
	{
	    console.log( "PV2ItemHandler", action );
	    console.log( reqBody );
	}
	break;
    case 'reordered':
	// Change placement of card in column.  Ignore.
	{
	    console.log( "PV2ItemHandler", action, "no work required" );
	}
	break;
    default:
	console.log( "PV2ItemHandler Unrecognized action:", action );
	break;
    }
    
    return;
}

exports.handler    = handler;
