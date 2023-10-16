const rootLoc = "../../../";

const assert    = require( 'assert' );
const config    = require( rootLoc + 'config' );

const utils     = require( rootLoc + 'utils/ceUtils' );
const ghUtils   = require( rootLoc + 'utils/gh/ghUtils' );

const ghV2      = require( rootLoc + 'utils/gh/gh2/ghV2Utils' );

const cardHandler = require( './cardHandler' );

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


async function handler( authData, ceProjects, ghLinks, pd, action, tag, delayCount ) {

    delayCount = typeof delayCount === 'undefined' ? 0 : delayCount;

    console.log( authData.who, "itemHandler start", authData.job );
    
    // await gh.checkRateLimit(authData);

    // event:        projects_v2_item
    // action:       archived, converted, created, deleted, edited, reordered, restored
    // content_type: DraftIssue, Issue, PullRequest
    // from project_node_id, content_node_id can get project, labels, columns, maybe changes.
    // https://docs.github.com/en/graphql/overview/changelog
    // https://docs.github.com/en/graphql/reference
    // https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#projects_v2_item

    let item = pd.reqBody.projects_v2_item;
    assert( typeof item !== 'undefined' );

    if( item.content_type != "Issue" ) {
	console.log( authData.who, "Skipping", item.content_type, action );
	return;
    }

    // Note: can't set repo here for pd.. can be several.  
    let reqBody  = pd.reqBody;
    pd.projectId = item.project_node_id;

    // XXX need to pass in and return res from ceRouter


    //                       -> event           :action      content_type

    // Create issue notifications: (can ignore)
    // * create draft issue  -> projects_v2_item:created     draft issue
    // * convert draft issue -> projects_v2_item:reorder     draft issue     (sometimes)
    // * (pick a repo)       -> projects_v2_item:converted   issue
    //                       -> issues          :opened      XXX confirm event

    // Create issue, by hand from within repo
    //                       -> issues          :opened      

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
	    //  -> card moved
	    //  -> issues          :labeled     
	    //  -> projects_v2_item:edited     issue
	    // This is the generic notification sent alongside the content-specific notice (i.e. issue:label).
	    // changes:field_value will have a projectV2Field that tells what field changed, but not what the change was.
	    // Need to then process the content-specific notice for details.
	    // Example:  { field_value: { field_node_id: 'PVTF_<*>', field_type: 'labels' }}
	    // No need to rebuild the map on server startup, since notice comes every time.  Demote content_node job this notice hasn't arrived yet.
	    console.log( authData.who, "PV2ItemHandler", action );

	    if( utils.validField( reqBody, "changes" )) {
		let fv = reqBody.changes.field_value;
		if( utils.validField( fv, "field_type" )) {
		    
		    if( fv.field_type == "single_select" ) {
			return await cardHandler.handler( authData, ceProjects, ghLinks, pd, 'moved', tag, delayCount );
		    }
		    else if( fv.field_type == "labels" ) {
			console.log( authData.who, "Item handler found edit:labels.. no action taken in favor of issue:labels" );
		    }
		}
	    }
	    else { console.log( "Unrecognized, skipping.", item.changes ); }

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
	// creating a card here.
	// generated from cardIssue or adding issue to project in GH
	{
	    // add return to catch postpone
	    return await cardHandler.handler( authData, ceProjects, ghLinks, pd, action, tag ); 
	}
	break;
    case 'deleted':
	// generated from remCard
	{
	    return await cardHandler.handler( authData, ceProjects, ghLinks, pd, action, tag ); 
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
