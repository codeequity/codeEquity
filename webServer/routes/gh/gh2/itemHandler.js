import assert    from 'assert';

import * as config    from '../../../config.js';
import * as utils     from '../../../utils/ceUtils.js';
import * as ghUtils   from '../../../utils/gh/ghUtils.js';

import * as ghV2      from '../../../utils/gh/gh2/ghV2Utils.js';

import * as cardHandler from './cardHandler.js';


// Guarantee: For every repo that is part of a ceProject:
//            1) Every carded issue in that repo resides in the linkage table. but without column info, issue and project names
//            2) Newborn issues and newborn cards can exist, but will not reside in the linkage table.
//            3) {label, add card} operation on newborn issues will cause conversion to a situated issue (carded or peq) as needed,
//               and inclusion in linkage table.
//            4) there is a 1:{0,1} mapping between issue:card
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

    // Allow draftIssue:edit to pass through to protect movement into reserved columns
    let diEdit = item.content_type == config.GH_ISSUE_DRAFT && action == "edited";
    if( item.content_type != config.GH_ISSUE && !diEdit ) {
	console.log( authData.who, "Skipping", item.content_type, action );
	return;
    }

    // Note: can't set repo here for pd.. can be several.  
    let reqBody  = pd.reqBody;
    pd.projectId = item.project_node_id;

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
	    // console.log( authData.who, "PV2ItemHandler", action );

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
	    else { console.log( "Unrecognized, skipping.  Ghost nearby?" ); }

	}
	break;
    case 'converted':
	// Oddly, can add assignees to draft issue, but not labels.
	// This means converted can not be PEQ.  
	// When select "convert" a draft issue, may see a 'reorder' notification for draft issue
	// Will see 'converted' here.
	// Will see 'opened' for event type: issue
	{
	    console.log( "PV2ItemHandler", action );
	    if( !utils.validField( item, "content_type" ) || item.content_type != config.GH_ISSUE ) {
		console.log( "Error.  Unexpected conversion for pv2 item", item );
		assert( false );
	    }

	    // Can not be PEQ.  Make sure project is linked in ceProj to match cardHandler operation during 'create' for non-peq label
	    let projLocs = ghLinks.getLocs( authData, { ceProjId: pd.ceProjectId, pid: pd.projectId } );
	    if( projLocs === -1 ) { await ghLinks.linkProject( authData, pd.ceProjectId, pd.projectId ); }
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

export {handler};
