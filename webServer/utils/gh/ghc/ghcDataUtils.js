const assert = require('assert');

const config = require( '../../../config');

const utils    = require( '../../ceUtils' );
const awsUtils = require( '../../awsUtils' );
const ghUtils  = require( '../ghUtils' );

const ghClassic = require( './ghClassicUtils' );
const gh        = ghClassic.githubUtils;
const ghSafe    = ghClassic.githubSafe;


// populateCE is called BEFORE first PEQ label association.  Resulting resolve may have many 1:m with large m and PEQ.
// each of those needs to recordPeq and recordPAction
// NOTE: when this triggers, it can be very expensive.  But after populate, any trigger is length==2, and only until user
//       learns 1:m is a semantic error in CE
// Main trigger during typical runtime:
//  1: add another project card to situated issue
async function resolve( authData, ghLinks, pd, allocation ) {
    let gotSplit = false;

    // on first call from populate, list may be large.  Afterwards, max 2.
    if( pd.GHIssueId == -1 )              { console.log(authData.who, "Resolve: early return" ); return gotSplit; }

    let links = ghLinks.getLinks( authData, { "ceProjId": pd.CEProjectId, "repo": pd.GHFullName, "issueId": pd.GHIssueId } );
    if( links == -1 || links.length < 2 ) { console.log(authData.who, "Resolve: early return" ); return gotSplit; }
    gotSplit = true;

    // Resolve gets here in 2 major cases: a) populateCE - not relevant to this, and b) add card to an issue.  PEQ not required.
    // For case b, ensure ordering such that pd element (the current card-link) is acted on below - i.e. is not in position 0
    //             since the carded issue has already been acted on earlier.
    if( pd.peqType != "end" && links[0].GHColumnId == pd.GHColumnId ) {
	console.log( "Ping" );
	[links[0], links[1]] = [links[1], links[0]];
    }
    
    console.log( authData.who, "Splitting issue to preserve 1:1 issue:card mapping, issueId:", pd.GHIssueId, pd.GHIssueNum );

    // Need all issue data, with mod to title and to comment
    assert( links[0].GHIssueNum == pd.GHIssueNum );
    let issue = await gh.getFullIssue( authData, pd.GHOwner, pd.GHRepo, pd.GHIssueNum );  
    assert( issue != -1 );

    // Can get here with blank slate from Populate, in which case no peq label to split.
    // Can get here with peq issue that just added new card, so will have peq label to split.
    // If peq label exists, recast it.  There can only be 0 or 1.
    // Note: could make array of promises, but very low impact - rarely (never?) see more than 1 peq label
    let idx = 0;
    let newLabel = "";
    for( label of issue.labels ) {
	let content = label['description'];
	let peqVal  = ghUtils.parseLabelDescr( [content] );

	if( peqVal > 0 ) {
	    console.log( "Resolve, original peqValue:", peqVal );
	    peqVal = Math.floor( peqVal / links.length );
	    console.log( ".... new peqValue:", peqVal );

	    pd.peqType = allocation ? config.PEQTYPE_ALLOC : config.PEQTYPE_PLAN; 
	    let peqHumanLabelName = peqVal.toString() + " " + ( allocation ? config.ALLOC_LABEL : config.PEQ_LABEL );
	    newLabel = await gh.findOrCreateLabel( authData, pd.GHOwner, pd.GHRepo, allocation, peqHumanLabelName, peqVal )
	    issue.labels[idx] = newLabel;
	    // update peqData for subsequent recording
	    pd.peqValue = peqVal;

	    await ghSafe.rebuildLabel( authData, pd.GHOwner, pd.GHRepo, issue.number, label, newLabel );
	    // Don't wait
	    awsUtils.changeReportPeqVal( authData, pd, peqVal, links[0] );
	    break;
	}
	idx += 1;
    }

    for( let i = 1; i < links.length; i++ ) {
	let origCardId = links[i].GHCardId;
	let splitTag   = utils.randAlpha(8);

	// Note: This information could be passed down.. but save speedups for graphql
	if( pd.peqType != "end" ) {
	    // PopulateCELink trigger is a peq labeling.  If applied to a multiply-carded issue, need to update info here.
	    links[i].GHProjectName = gh.getProjectName( authData, ghLinks, pd.CEProjectId, pd.GHFullName, links[i].GHProjectId );
	    links[i].GHColumnId    = ( await gh.getCard( authData, origCardId ) ).column_url.split('/').pop();
	    links[i].GHColumnName  = gh.getColumnName( authData, ghLinks, pd.CEProjectId, pd.GHFullName, links[i].GHColumnId );
	}

	let issueData   = await ghSafe.rebuildIssue( authData, pd.GHOwner, pd.GHRepo, issue, "", splitTag );  
	let newCardId   = await gh.rebuildCard( authData, pd.CEProjectId, ghLinks, pd.GHOwner, pd.GHRepo, links[i].GHColumnId, origCardId, issueData );

	pd.GHIssueId    = issueData[0];
	pd.GHIssueNum   = issueData[1];
	pd.GHIssueTitle = issue.title + " split: " + splitTag;
	ghLinks.rebuildLinkage( authData, links[i], issueData, newCardId, pd.GHIssueTitle );
    }

    // On initial populate call, this is called first, followed by processNewPeq.
    // Leave first issue for PNP.  Start from second.
    console.log( "Building peq for", links[1].GHIssueTitle );
    for( let i = 1; i < links.length; i++ ) {    
	// Don't record simple multiply-carded issues
	if( pd.peqType != "end" ) {
	    let projName   = links[i].GHProjectName;
	    let colName    = links[i].GHColumnName;
	    assert( projName != "" );
	    pd.projSub = await utils.getProjectSubs( authData, ghLinks, pd.CEProjectId, pd.GHFullName, projName, colName );	    
	    
	    awsUtils.recordPeqData(authData, pd, false );
	}
    }
    console.log( authData.who, "Resolve DONE" );
    return gotSplit;
}

// Note: this function can be sped up, especially when animating an unclaimed
// Only routes here are from issueHandler:label (peq only), or cardHandler:create (no need to be peq)
async function processNewPEQ( authData, ghLinks, pd, issueCardContent, link, specials ) {
    pd.GHIssueTitle = issueCardContent[0];

    // normal for card -> issue.  odd but legal for issue -> card
    let allocation = ghUtils.getAllocated( issueCardContent );

    // If this new item is an issue becoming a card, any label will be human readable - different parse requirement
    if( pd.GHIssueNum == -1 ) { pd.peqValue = ghSafe.parsePEQ( issueCardContent, allocation ); }
    else                      { pd.peqValue = ghUtils.parseLabelDescr( issueCardContent ); }

    // Don't wait
    awsUtils.checkPopulated( authData, pd.CEProjectId ).then( res => assert( res != -1 ));
    
    if( pd.peqValue > 0 ) { pd.peqType = allocation ? config.PEQTYPE_ALLOC : config.PEQTYPE_PLAN; } 
    console.log( authData.who, "PNP: processing", pd.peqValue.toString(), pd.peqType );

    let origCardId = link == -1 ? pd.reqBody['project_card']['id']                           : link.GHCardId;
    pd.GHColumnId  = link == -1 ? pd.reqBody['project_card']['column_id']                    : link.GHColumnId;
    pd.GHProjectId = link == -1 ? pd.reqBody['project_card']['project_url'].split('/').pop() : link.GHProjectId;
    let colName    = gh.getColumnName( authData, ghLinks, pd.CEProjectId, pd.GHFullName, pd.GHColumnId );
    let projName   = "";

    const links = ghLinks.getLinks( authData, { "ceProjId": pd.CEProjectId, "repo": pd.GHFullName, "issueId": pd.GHIssueId } );

    // Bail, if this create is an add-on to an ACCR 
    if( links != -1 && links[0].GHColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
	console.log( authData.who, "WARNING.", links[0].GHColumnName, "is reserved, can not duplicate cards from here.  Removing excess card." );
	gh.removeCard( authData, origCardId );
	return 'early';
    }

    // Bail, if this is alloc in x3
    if( allocation && config.PROJ_COLS.slice(config.PROJ_PROG).includes( colName )) {
	// remove card, leave issue & label in place.
	console.log( authData.who, "WARNING.", "Allocations only useful in config:PROJ_PLAN, or flat columns.  Removing card from", colName );
	gh.removeCard( authData, origCardId );
	return 'early';
    }
	

    if( pd.peqType == "end" ) {
	assert( link == -1 );

	// If reserved column, remove the card.  Can't create newbies here.  Leave issue in place else work is lost.
	const reserved = [config.PROJ_COLS[config.PROJ_PEND], config.PROJ_COLS[config.PROJ_ACCR]];
	if( reserved.includes( colName ) ) {
	    console.log( "WARNING.", colName, "is reserved, can not create non-peq cards here.  Removing card, keeping issue (if any)." );
	    gh.removeCard( authData, origCardId );
	}
	else if( pd.GHIssueId != -1 ) {
	    let blank      = config.EMPTY;
	    ghLinks.addLinkage( authData, pd.CEProjectId, pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, blank , -1, blank, origCardId, blank );
	}
    }
    else {
	let peqHumanLabelName = pd.peqValue.toString() + " " + ( allocation ? config.ALLOC_LABEL : config.PEQ_LABEL );  
	// Wait later, maybe
	let peqLabel = gh.findOrCreateLabel( authData, pd.GHOwner, pd.GHRepo, allocation, peqHumanLabelName, pd.peqValue );
	projName = gh.getProjectName( authData, ghLinks, pd.CEProjectId, pd.GHFullName, pd.GHProjectId );

	// Can assert here if new repo, not yet populated, repoStatus not set, locs not updated
	assert( colName != -1 ); 

	if( colName == config.PROJ_COLS[ config.PROJ_ACCR ] ) {
	    console.log( authData.who, "WARNING.", colName, "is reserved, can not create cards here.  Removing card, keeping issue." );
	    gh.removeCard( authData, origCardId );

	    // If already exists, will be in links.  Do not destroy it
	    if( links == -1 ) {
		// Don't wait
		peqLabel = await peqLabel;
		ghSafe.removeLabel( authData, pd.GHOwner, pd.GHRepo, pd.GHIssueNum, peqLabel );
		// chances are, an unclaimed PEQ exists.  deactivate it.
		if( pd.GHIssueId != -1 ) {
		    const daPEQ = await awsUtils.getPeq( authData, pd.CEProjectId, pd.HostIssueId );
		    awsUtils.removePEQ( authData, daPEQ.PEQId );
		}
	    }
	    return "removeLabel";
	}
	
	// issue->card:  issueId is available, but linkage has not yet been added
	if( pd.GHIssueNum > -1 ) {
	    ghLinks.addLinkage( authData, pd.CEProjectId, pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, projName,
				pd.GHColumnId, colName, origCardId, issueCardContent[0] );

	    // If assignments exist before an issue is PEQ, this is the only time to catch them.  PActs will catch subsequent mods.
	    // Note: likely to see duplicate assignment pacts for assignment during blast creates.  ceFlutter will need to filter.
	    // Note: assigments are not relevant for allocations
	    // If moving card out of unclaimed, keep those assignees.. recordPeqData handles this for relocate
	    if( specials != "relocate" && !allocation ) {
		pd.GHAssignees = await gh.getAssignees( authData, pd.GHOwner, pd.GHRepo, pd.GHIssueNum );
	    }
	    
	}
	// card -> issue..  exactly one linkage.
	else {
	    pd.GHIssueTitle = issueCardContent[0];

	    // create new issue, rebuild card
	    peqLabel = await peqLabel; // peqHumanLabelName dep
	    let issueData = await ghSafe.createIssue( authData, pd.GHOwner, pd.GHRepo, pd.GHIssueTitle, [peqHumanLabelName], allocation );
	    pd.GHIssueId  = issueData[0];
	    pd.GHIssueNum = issueData[1];

	    // Creating a situated card.. no assignees possible so no PEND possible.  Accrued handled above.
	    let isReserved = false;
	    if( colName == config.PROJ_COLS[config.PROJ_PEND] ) {
		console.log( authData.who, "WARNING.", colName, "is reserved, requires assignees.  Moving card out of reserved column." );
		isReserved = true;
	    }
	    let locData = { "reserved": isReserved, "projId": pd.GHProjectId, "projName": pd.GHProjectName, "fullName": pd.GHFullName };
	    let newCardId = await gh.rebuildCard( authData, pd.CEProjectId, ghLinks, pd.GHOwner, pd.GHRepo, pd.GHColumnId, origCardId, issueData, locData );

	    // Add card issue linkage
	    ghLinks.addLinkage( authData, pd.CEProjectId, pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, projName,
				pd.GHColumnId, colName, newCardId, pd.GHIssueTitle);
	}
    }

    // Resolve splits issues to ensure a 1:1 mapping issue:card, record data for all newly created issue:card(s)
    let gotSplit = await resolve( authData, ghLinks, pd, allocation );

    // record peq data for the original issue:card
    // NOTE: If peq == end, there is no peq/pact to record, in resolve or here.
    //       else, if resolve splits an issue due to create card, that means the base link is already fully in dynamo.
    //                Resolve will add the new one, which means work is done.
    //       resolve with an already-populated repo can NOT split an issue based on a labeling, since the only way to add a card to an existing
    //                issue is to create card.  Furthermore populate does not call this function.
    //       So.. this fires only if resolve doesn't split - all standard peq labels come here.
    if( !gotSplit && pd.peqType != "end" ) {
	pd.projSub = await utils.getProjectSubs( authData, ghLinks, pd.CEProjectId, pd.GHFullName, projName, colName );
	awsUtils.recordPeqData( authData, pd, true, specials );
    }
}

// Add linkage data for all carded issues in a project.
// 
// As soon as 1 situated (or carded) issue is labeled, all this work must be done to find it if not already in dynamo.
// May as well just do this once.
//
// This occurs once only per repo, preferably when CE usage starts.
// Afterwards, if a newborn issue adds a card, githubCardHandler will pick it up.
// Afterwards, if a newborn issue adds peqlabel, create card, githubCardHandler will pick it up.
// Afterwards, if a newborn card converts to issue, pick it up in githubIssueHandler
//
// Would be soooo much better if Octokit/Github had reverse link from issue to card.
// newborn issues not populated.  newborn cards not populated.  Just linkages.
// Note. something like this really needs graphQL
async function populateCELinkage( authData, ghLinks, pd )
{
    console.log( authData.who, "Populate CE Linkage start" );
    // Wait later
    let origPop = awsUtils.checkPopulated( authData, pd.CEProjectId );

    // XXX this does more work than is needed - checks for peqs which only exist during testing.
    const proj = await awsUtils.getProjectStatus( authData, pd.CEProjectId );
    let linkage = await ghLinks.initOneProject( authData, proj );

    // At this point, we have happily added 1:m issue:card relations to linkage table (no other table)
    // Resolve here to split those up.  Normally, would then worry about first time users being confused about
    // why the new peq label applied to their 1:m issue, only 'worked' for one card.
    // But, populate will be run from ceFlutter, separately from actual label notification.
    pd.peqType    = "end";
    
    // Only resolve once per issue.
    // XXX once this is running again, confirm link[3] is issueId, not cardId.  getBasicLinkData.
    let showOnce  = [];
    let showTwice = [];
    let one2Many = [];
    for( const link of linkage ) {
	if( !showOnce.includes( link[3] ))       { showOnce.push( link[3] ); }
	else if( !showTwice.includes( link[3] )) {
	    showTwice.push( link[3] );
	    one2Many.push( link );
	}
    }
    
    console.log( "Remaining links to resolve", one2Many );

    // XXX
    // [ [projId, cardId, issueNum, issueId], ... ]
    // Note - this can't be a promise.all - parallel execution with shared pd == big mess
    //        serial... SLOOOOOOOOOOW   will revisit entire populate with graphql. 
    // Note - this mods values of pd, but exits immediately afterwards.
    for( const link of one2Many ) {
	pd.GHIssueId  = link[3];
	pd.GHIssueNum = link[2];
	await resolve( authData, ghLinks, pd, "???" );
    }

    origPop = await origPop;  // any reason to back out of this sooner?
    assert( !origPop );
    // Don't wait.
    awsUtils.setPopulated( authData, pd.CEProjectId );
    console.log( authData.who, "Populate CE Linkage Done" );
    return true;
}



exports.resolve          = resolve;
exports.processNewPEQ    = processNewPEQ;
exports.populateCELinage = populateCELinkage;
