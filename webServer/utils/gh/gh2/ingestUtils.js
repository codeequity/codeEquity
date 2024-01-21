var assert = require( 'assert' );

const config   = require( '../../../config' );
const utils    = require( '../../ceUtils' );
const awsUtils = require( '../../awsUtils' );

const ghUtils  = require( '../ghUtils' );

const ghV2     = require( './ghV2Utils' );

const gh2Data  = require( '../../../routes/gh/gh2/gh2Data' );

// populateCE is called BEFORE first PEQ label association.  Resulting resolve may have many 1:m with large m and PEQ.
// each of those needs to recordPeq and recordPAction
// NOTE: when this triggers, it can be very expensive.  But after populate, any trigger is length==2, and only until user
//       learns 1:m is a semantic error in CE
// Main trigger during typical runtime:
//  1: add another project card to situated issue
async function resolve( authData, ghLinks, pd, doNotTrack ) {
    let gotSplit = false;
    
    // console.log( authData.who, "RESOLVE", pd.issueId );
    if( pd.issueId == -1 ) { console.log(authData.who, "Resolve: early return, no issueId." ); return gotSplit; }
    
    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "issueId": pd.issueId });
    // This can happen if an issue in a non-ceProj repo links to a project that is in a ceProj.  The 'visiting' issue should not be managed by ceServer.
    if( links === -1 ) { console.log(authData.who, "Resolve: early return, visitor is not part of ceProject." ); return gotSplit; }
    // console.log( links[0] );
    if( links.length < 2 ) { console.log(authData.who, "Resolve: early return, nothing to resolve." ); return gotSplit; }
    gotSplit = true;

    // Resolve gets here in 2 major cases: a) populateCE - not relevant to this, and b) add card to an issue.  PEQ not required.
    // For case b, ensure ordering such that pd element (the current card-link) is acted on below - i.e. is not in position 0
    //             since the carded issue has already been acted on earlier.
    if( pd.peqType != config.PEQTYPE_END && links[0].hostColumnId == pd.columnId ) {
	console.log( "XXX Ping" );
	console.log( authData.who, "Switching link in resolve", links[0], links[1] );
	[links[0], links[1]] = [links[1], links[0]];
    }

    
    console.log( authData.who, "Splitting issue to preserve 1:1 issue:card mapping, issueId:", pd.issueId, pd.issueNum );

    // Need all issue data, with mod to title and to comment
    assert( links[0].hostIssueNum == pd.issueNum );
    let issue = await ghV2.getFullIssue( authData, pd.issueId );  
    assert( Object.keys( issue ).length > 0 );
    pd.repoId    = links[1].hostRepoId;
    pd.projectId = links[1].hostProjectId;
    
    // Can get here with blank slate from Populate, in which case no peq label to split.
    // Can get here with peq issue that just added new card, so will have peq label to split.
    // If peq label exists, recast it.  There can only be 0 or 1.
    let idx = 0;
    let newLabel = "";
    for( const label of issue.labels ) {
	let content = ghUtils.parseLabelName( label.name );
	let peqVal  = content[0];
	let allocation  = content[1];

	if( peqVal > 0 ) {
	    console.log( authData.who, "Resolve, original peqValue:", peqVal );
	    peqVal = Math.floor( peqVal / links.length );
	    console.log( authData.who, ".... new peqValue:", peqVal );

	    pd.peqType = allocation ? config.PEQTYPE_ALLOC : config.PEQTYPE_PLAN; 
	    let peqHumanLabelName = ghV2.makeHumanLabel( peqVal, ( allocation ? config.ALLOC_LABEL : config.PEQ_LABEL ) );
	    newLabel = await ghV2.findOrCreateLabel( authData, pd.repoId, allocation, peqHumanLabelName, peqVal )
	    issue.labels[idx] = newLabel;
	    // update peqData for subsequent recording
	    pd.peqValue = peqVal;

	    await ghV2.rebuildLabel( authData, label.id, newLabel.id, issue.id );
	    // Don't wait
	    awsUtils.changeReportPEQVal( authData, pd, peqVal, links[0] );
	    break;
	}
	idx += 1;
    }

    // Create a new split issue for each copy, move new card loc if need be, set links
    let splitIssues = [];
    for( let i = 1; i < links.length; i++ ) {
	let splitTag   = utils.randAlpha(8);
	pd.repoId      = links[i].hostRepoId;
	pd.projectId   = links[i].hostProjectId;
	const locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "pid": pd.projectId, "colId": links[i].hostColumnId} );
	if( locs === -1 ) {
	    console.log( links, pd, issue );
	    let t = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "pid": pd.projectId} );
	    console.log( "OI", i, links[i].hostColumnId, locs );
	}
	assert( locs !== -1 );

	// About to remove user's card.  Before doing so, get the column info, since that does not come in the move notice.
	// The column info will be in links, which are available during card:move
	let userCard = await ghV2.getCard( authData, links[i].hostCardId );
	links[i].hostColumnId   = userCard.columnId   != config.GH_NO_STATUS ? userCard.columnId   : links[i].hostColumnId;
	links[i].hostColumnName = userCard.columnName != config.GH_NO_STATUS ? userCard.columnName : links[i].hostColumnName;
	
	// Remove card user just created.  Create new issue and card, relink.  Leave it in 'no status' for subsequent card:move to manage.
	ghV2.removeCard( authData, pd.projectId, links[i].hostCardId); 
	let issueData  = await ghV2.rebuildIssue( authData, pd.repoId, pd.projectId, issue, "", splitTag );
	assert( issueData[2] != -1 );

	// Need to put card in correct spot in GH
	let success = await ghV2.moveCard( authData, pd.projectId, issueData[2], locs[0].hostUtility, links[i].hostColumnId );
	assert( success );

	// New issueId, name, num, cardId.  Location is already correct in links[i] so no need to update splitLink
	// resolve needed col data to rewrite info to GH.  But should not keep it if non-peq.  resolve handles 1-n, pnp handles 0
	// Note: above card removal means subsequent card:moved notice fails since card does not exist.  rebuild uses link.hostUtil to record connection
	links[i].hostUtility = links[i].hostCardId;
	let splitLink = ghLinks.rebuildLinkage( authData, links[i], issueData, issue.title );
	if( doNotTrack ) { splitLink = ghLinks.rebaseLinkage( authData, pd.ceProjectId, issueData[0] ); }
	
	splitIssues.push( splitLink );
    }

    // On initial populate call, resolve is called first, followed by processNewPeq.
    // Leave first issue for PNP.  Start from second.
    // Can no longer depend on links[i], since rebuildLinkage modded, then destroyed original copy.
    for( split of splitIssues ) {
	// Don't record simple multiply-carded issues
	if( pd.peqType != config.PEQTYPE_END ) {
	    console.log( authData.who, "Building peq for", split.hostIssueName, split.hostColumnName );
	    let projName   = split.hostProjectName;
	    let colName    = split.hostColumnName;
	    assert( projName != "" );
	    pd.projSub = await utils.getProjectSubs( authData, ghLinks, pd.ceProjectId, projName, colName );	    

	    pd.issueId    = split.hostIssueId;
	    pd.issueNum   = split.hostIssueNum;
	    pd.issueName  = split.hostIssueName;

	    let specials = {};
	    specials.pact     = "addRelo";
	    specials.columnId = split.hostColumnId; 
	    
	    awsUtils.recordPEQData(authData, pd, false, specials );
	}
    }
    
    console.log( authData.who, "Resolved." );
    return gotSplit;
}

// Add linkage data for all carded issues in a new project, then resolve to guarantee 1:1
// 
// This occurs once only per repo, preferably when CE usage starts.
// Afterwards, if a newborn issue adds a card, cardHandler will pick it up.
// Afterwards, if a newborn issue adds peqlabel, create card, cardHandler will pick it up.
// Afterwards, if a newborn card converts to issue, pick it up in issueHandler
async function populateCELinkage( authData, ghLinks, pd )
{
    console.log( authData.who, "Populate CE Linkage start" );
    // Wait later
    let origPop = awsUtils.checkPopulated( authData, pd.ceProjectId, pd.repoId );

    // XXX this does more work than is needed - checks for peqs which only exist during testing.
    const proj = await awsUtils.getProjectStatus( authData, pd.ceProjectId );
    let linkage = await ghLinks.initOneCEProject( authData, proj, pd.repoId );  // only init one repo

    // At this point, we have happily added 1:m issue:card relations to linkage table (no other table)
    // Resolve here to split those up.  Normally, would then worry about first time users being confused about
    // why the new peq label applied to their 1:m issue, only 'worked' for one card.
    // But, populate will be run from ceFlutter, separately from actual label notification.
    pd.peqType    = config.PEQTYPE_END;
    
    // Only resolve once per issue.  Happily, PV2 gql model has reverse links from issueContentId to cards (pvti_* node ids)
    // Note: allCards are still raw: [ {node: {id:}}, {{}}, ... ]
    // Note: linkage is also raw..
    // Note: GH allows an issue to have multiple locations, but only 1 per host project.
    //       A ceProject may have multiple host projects, linkage is per ceProject, iteration to create linkage is per card, so issueContent may show up twice.
    let promises = [];
    for( const link of linkage ) {
	if( typeof link.duplicate === 'undefined' ) {
	    if( link.allCards.length > 1 ) {
		console.log( authData.who, "Found link with multiple cards", link.hostIssueName, link.hostIssueId );
		pd.issueId  = link.hostIssueId;
		pd.issueNum = link.hostIssueNum;
		let pdCopy =  gh2Data.GH2Data.from( pd );
		promises.push( resolve( authData, ghLinks, pdCopy, false ) );
	    }
	}
	// mark duplicates
	linkage.forEach(l => { if( l.issueId == link.hostIssueId ) { l.duplicate = true; } });
    }
    await Promise.all( promises );

    origPop = await origPop;  // any reason to back out of this sooner?
    assert( !origPop );
    
    console.log( authData.who, "Populate CE Linkage Done" );
    return true;
}


// Create new linkages, update peqs.
// Only routes here are from issueHandler:label (peq only), or cardHandler:create (no need to be peq)
// Both fromCard, fromLabel do peq-related work - for example fromCard handles relo from unclaimed.   fromCard can trigger heavy lifting in resolve.
// Linkage exists for carded & up issues.  Pure carded issues are not further tracked, so column info and many names set to -1 and ---, not updated further.
// 
// Note: if fromCard, PNP is being called from card:create.  If cardCreate detects issue is PEQ, it will remove old card from unclaimed and create a new one for PNP.
// Note: specials for peq creation, 'relo' is needed mainly for ceFlutter summary, not really for peq data. 
//       issue:label is addRelo.  add manages peq and pact, whereas relo just sends pact
//       ceServer   only updates peq psub once after unclaimed -> home
//
// label, then later create/move as part of separate call
// ---------------------------------
//  GH will have unclaimed card after issue:label is done.
//    * label will create card in unclaimed.
//
// label, create/move as part of same call(s)
// ---------------------------------
//  GH will have card.  issue:label will detect card was created already, so will not create unclaimed.
//  
//  By-hand add issue to project, before triage.
//  -----------------------------------
//   GH card will be in 'no status' for which all col info is null.
//    * create-only case
//      no matter order of arrival.  Create first?  postpone.  Label does addrelo. Label recognizes 'card no status', so does not create unclaimed.
//                                   then create (redundantly) sets linkage in PNP, stops (i.e. no addrelo).
//	    
// Bail: because cards are created in no status, notice:create can't tell if destination is reserved until notice:move.
//       Need to tread carefully with linkage for split (which creates new cards in GH) and linkage for cardHandler (which needs no tracking info at times)
//      order of ops during split:
//        1) tester makeProjectCard( issues create card, move card to GH as user)
//        2) gh receives create card, makes card in no status, sends created notice
//        3,4) ce receives created notice.  gh receives move request, sends move notice     
//        5) ce sends card delete.  gh deletes original card
//        6) ce creates new split issue, card.
//        7) ce process move notice, but orig card no longer exists
async function processNewPEQ( authData, ghLinks, pd, issue, link, specials ) {

    let pact      = typeof specials !== 'undefined' && specials.hasOwnProperty( "pact" )     ? specials.pact     : -1;
    let fromCard  = typeof specials !== 'undefined' && specials.hasOwnProperty( "fromCard" ) ? specials.fromCard : false;
    let havePeq   = typeof specials !== 'undefined' && specials.hasOwnProperty( "havePeq" )  ? specials.havePeq  : false;
    
    let fromLabel = !fromCard;
    assert( fromLabel || link === -1 );
    assert( fromCard  || link !== -1 );
    
    let issDat = [issue.title];
    let lNodeId = -1;
    
    // labelIssue does not call getFullIssue, cardHandler does
    if( !havePeq ) {
	if( utils.validField( issue, "labelContent" ) ) {
	    issDat.push( issue.labelContent );
	    lNodeId = issue.labelNodeId; 
	}
	else if( issue.labels.length > 0 )              { for( node of issue.labels ) { issDat.push( node.description ); } }
    }
	
    // console.log( authData.who, "PNP: issDat", issDat, pd.repoName, pact, fromCard );
    
    pd.issueName = issDat[0];
    pd.issueNum  = issue.number;
    pd.repoName  = issue.repository.nameWithOwner;
    pd.repoId    = issue.repository.id;

    // normal for card -> issue.  odd but legal for issue -> card
    let allocation = ghUtils.getAllocated( issDat );

    // Note.  If support convert from draft issue with <> shorthand, will need to use parsePEQ( issDat, allocation ) instead
    if( !havePeq ) { pd.peqValue = ghUtils.parseLabelDescr( issDat ); }

    if( !havePeq && pd.peqValue > 0 ) { pd.peqType = allocation ? config.PEQTYPE_ALLOC : config.PEQTYPE_PLAN; } 
    // console.log( authData.who, "PNP: processing", pd.peqValue.toString(), pd.peqType );

    // fromLabel link is good, cardDat will be undefined.  fromCard is the reverse.
    let cardDat    = pd.reqBody.projects_v2_item;
    let origCardId = fromCard ? cardDat.node_id         : link.hostCardId;
    pd.projectId   = fromCard ? cardDat.project_node_id : link.hostProjectId;
    pd.columnId    = fromCard ? -1                      : link.hostColumnId;
    let colName    = fromCard ? config.EMPTY            : link.hostColumnName;
    let projName   = ghV2.getProjectName( authData, ghLinks, pd.ceProjectId, pd.projectId );
	
    console.log( authData.who, "PNP: cardid, pid colName repoid", origCardId, pd.ceProjectId, projName, pd.projectId, colName, pd.repoId, pd.peqType, pd.peqValue );

    // This will be undef if this is for a new issue
    const links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "issueId": pd.issueId } );
    const reserved = [config.PROJ_COLS[config.PROJ_PEND], config.PROJ_COLS[config.PROJ_ACCR]];

    // No.  This 'fix' triggers when adding card to peq, then tricks resolve into ping-reordering links, which breaks validatePeq.
    /*
    // Occasionally, card.move arrives before card.create.  In this case, link exists and is correct.  Do not overwrite.
    if( fromCard && links !== -1 && links.length == 1 ) {
	console.log( authData.who, "PNP: fromCard, but move notice preceeded create notice.  Do not destroy link." );
	pd.columnId = links[0].hostColumnId;
	colName     = links[0].hostColumnName;
    }
    */
    
    // Bail. ACCR peq issue trying to add a card. Links will have ACCR peq issue. There will not be links[1] unless during populate.  Can not modify ACCR.
    if( fromCard && links !== -1 && reserved.includes( links[0].hostColumnName )) {
	console.log( authData.who, "WARNING.", links[0].hostColumnName, "is reserved, can not duplicate cards from here.  Removing excess card." );
	ghV2.removeCard( authData, pd.projectId, origCardId );
	return 'early';
    }

    //  Bail.  situated card exists in PROG+ (really, just PROG).  Add alloc peq label.  Link exists.
    //         other cases will be caught in card:moved
    if( fromLabel && allocation && config.PROJ_COLS.slice(config.PROJ_PROG).includes( colName )) {
	// remove label, leave issue & card in place.
	console.log( authData.who, "WARNING.", "Allocations only useful in config:PROJ_PLAN, or flat columns.  Removing label." );
	assert( lNodeId != -1 );
	await ghV2.removeLabel( authData, lNodeId, pd.issueId );
	return 'early';
    }

    // Can't typically have carded issue in reserved.
    // However, we are allowing some negotiation, e.g. peq issue in PEND, owner sez 2k instead of 1k, unlabels and relabels.
    //          It is a narrow entry point to this case, but currently valid.
    // assert( !( fromLabel && reserved.includes( link.hostColumnName )) );

    let orig = {};
    orig.hostColumnId = pd.columnId;
    let peqHumanLabelName = ghV2.makeHumanLabel( pd.peqValue, ( allocation ? config.ALLOC_LABEL : config.PEQ_LABEL ) );
    if( fromCard ) {
	// Work from no status.
	if( colName == config.EMPTY ) {
	    colName       = config.GH_NO_STATUS;
	    pd.columnId   = colName;
	    orig.columnId = colName;
	}
	specials.columnId = pd.columnId;

	// At this point, if create-edit preceeded label, may be in create when card is built in no-status, meaning no column data.
	// console.log( authData.who, "PNP: fromCard.  ColId", pd.columnId, colName, pd.peqValue );
    }
    else {
	// console.log( authData.who, "PNP: fromLabelIssue", pd.issueName, colName, peqHumanLabelName, pd.repoName );

	assert( pd.issueNum > -1 );
	
	// If assignments exist before an issue is PEQ, this is the only time to catch them.  PActs will catch subsequent mods.
	// Note: likely to see duplicate assignment pacts for assignment during blast creates.  ceFlutter will need to filter.
	// Note: assigments are not relevant for allocations
	// If moving card out of unclaimed, keep those assignees.. recordPEQData handles this for relocate
	if( !allocation ) { pd.assignees = await ghV2.getAssignees( authData, pd.issueId ); }
    }

    orig.hostProjectName  = projName;
    orig.hostRepoName     = pd.repoName;
    orig.hostRepoId       = pd.repoId;
    orig.hostIssueId      = pd.issueId;
    orig.hostIssueNum     = pd.issueNum;
    orig.hostIssueName    = pd.issueName;
    orig.hostProjectId    = pd.projectId;
    orig.hostCardId       = origCardId;
    orig.hostColumnName   = colName;

    // Resolve splits issues to ensure a 1:1 mapping issue:card, record data for all newly created issue:card(s)
    // Update linkage with future GH locations, presuming peq.  Will undo this after resolve as needed.  Split needs locs to create for GH.
    ghLinks.addLinkage( authData, pd.ceProjectId, orig );
    let doNotTrack = fromCard && pd.peqValue <= 0; 
    let gotSplit = await resolve( authData, ghLinks, pd, doNotTrack );  
    if( doNotTrack ) { ghLinks.rebaseLinkage( authData, pd.ceProjectId, orig.hostIssueId ); }

    // record peq data for the original issue:card
    // NOTE: If peq == end, there is no peq/pact to record, in resolve or here.
    //       else, if resolve splits an issue due to create card, that means the base link is already fully in dynamo.
    //                Resolve will add the new one, which means work is done.
    //       resolve with an already-populated repo can NOT split an issue based on a labeling, since the only way to add a card to an existing
    //                issue is to create card.  Furthermore populate does not call this function.
    //       So.. this fires only if resolve doesn't split - all standard peq labels come here.
    if( pact != -1 && !gotSplit && pd.peqType != "end" ) {
	pd.projSub = await utils.getProjectSubs( authData, ghLinks, pd.ceProjectId, projName, colName );
	awsUtils.recordPEQData( authData, pd, true, specials );
    }
    else {
	console.log( authData.who, "No need to update peq" );
    }
}

exports.resolve           = resolve;
exports.populateCELinkage = populateCELinkage;
exports.processNewPEQ     = processNewPEQ;
