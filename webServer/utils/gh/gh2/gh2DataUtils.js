var assert = require( 'assert' );

const config   = require( '../../../config' );
const utils    = require( '../../ceUtils' );
const awsUtils = require( '../../awsUtils' );

const ghUtils  = require( '../ghUtils' );

const ghV2     = require( './ghV2Utils' );

const gh2Data  = require( '../../../routes/gh/gh2/gh2Data' );

function untrack( authData, ghLinks, ceProjectId, link ) {
    // XXX OMG fix naming!!
    if( utils.validField( link, "hostProjectName" )) {
	console.log( authData.who, "Undoing tracking data in linkage, non-peq." );
	link.hostProjectName  = config.EMPTY;
	link.hostColumnId     = config.EMPTY;   // do not track non-peq   cardHandler depends on this to avoid peq check
	link.hostColumnName   = config.EMPTY;   // do not track non-peq
	link.hostIssueName    = config.EMPTY;   // do not track non-peq

	let intLink = {};
	intLink.ceProjectId = link.ceProjectId;
	intLink.hostRepoName = link.hostRepoName;
	intLink.hostRepoId  = link.hostRepoId;
	intLink.issueId     = link.hostIssueId;
	intLink.issueNum    = link.hostIssueNum;
	intLink.projectId   = link.hostProjectId;
	intLink.projectName = link.hostProjectName;
	intLink.columnId    = link.hostColumnId;
	intLink.columnName  = link.hostColumnName;
	intLink.cardId      = link.hostCardId;
	intLink.title       = link.hostIssueName;
	intLink.flatSource  = link.flatSource;
	ghLinks.addLinkage( authData, ceProjectId, intLink );
    }
    else {
	console.log( authData.who, "Undoing tracking data in linkage, non-peq.", link.title, link.issueId );
	link.projectName  = config.EMPTY;
	link.columnId     = config.EMPTY;   // do not track non-peq   cardHandler depends on this to avoid peq check
	link.columnName   = config.EMPTY;   // do not track non-peq
	link.title        = config.EMPTY;   // do not track non-peq
	ghLinks.addLinkage( authData, ceProjectId, link );
    }
}


// XXX allocation set per label - don't bother to pass in
// populateCE is called BEFORE first PEQ label association.  Resulting resolve may have many 1:m with large m and PEQ.
// each of those needs to recordPeq and recordPAction
// NOTE: when this triggers, it can be very expensive.  But after populate, any trigger is length==2, and only until user
//       learns 1:m is a semantic error in CE
// Main trigger during typical runtime:
//  1: add another project card to situated issue
async function resolve( authData, ghLinks, pd, allocation, doNotTrack, futureColName, futureColId ) {
    if( typeof futureColName === 'undefined' ) { futureColName = config.EMPTY; }
    if( typeof futureColId   === 'undefined' ) { futureColId   = -1; }
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
	console.log( "Ping" );
	[links[0], links[1]] = [links[1], links[0]];
    }
    
    console.log( authData.who, "Splitting issue to preserve 1:1 issue:card mapping, issueId:", pd.issueId, pd.issueNum );

    // Need all issue data, with mod to title and to comment
    assert( links[0].hostIssueNum == pd.issueNum );
    let issue = await ghV2.getFullIssue( authData, pd.issueId );  
    assert( issue != -1 );
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
	allocation  = content[1];

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
	    awsUtils.changeReportPeqVal( authData, pd, peqVal, links[0] );
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
	const locs = ghLinks.getLocs( authData, { "ceProjId": pd.ceProjectId, "projId": pd.projectId, "colId": links[i].hostColumnId} );
	if( locs === -1 ) { console.log( links, pd, issue ); }
	assert( locs !== -1 );

	// Remove card user just created.  Create new card, relink it.  
	ghV2.removeCard( authData, pd.projectId, links[i].hostCardId); 
	let issueData  = await ghV2.rebuildIssue( authData, pd.repoId, pd.projectId, issue, "", splitTag );
	assert( issueData[2] != -1 );

	// Update columnId and name to current loc in GH, since move will fail (orig card is deleted)
	console.log( "XXX CHECK", links[i].hostColumnId, futureColId );
	console.log( "XXX CHECK", links[i].hostColumnName, futureColName );
	links[i].hostColumnId   = futureColId   != -1 ? futureColId   : links[i].hostColumnId;
	links[i].hostColumnName = futureColName != -1 ? futureColName : links[i].hostColumnName;
	let success = await ghV2.moveCard( authData, pd.projectId, issueData[2], locs[0].hostUtility, links[i].hostColumnId );
	assert( success );
	
	// New issueId, name, num, cardId.  Location is already correct in links[i] so no need to update splitLink
	// resolve needed col data to rewrite info to GH.  But should not keep it if non-peq.  resolve handles 1-n, pnp handles 0
	if( doNotTrack ) { untrack( authData, ghLinks, pd.ceProjectId, links[i] ); }
	let splitLink = ghLinks.rebuildLinkage( authData, links[i], issueData, issue.title );
	splitIssues.push( splitLink );
    }

    // On initial populate call, resolve is called first, followed by processNewPeq.
    // Leave first issue for PNP.  Start from second.
    // Can no longer depend on links[i], since rebuildLinkage modded, then destroyed original copy.
    // XXX Verify works for 3+ cards on initial populate.  splitIssues[i-1] is sloppy.
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
	    
	    awsUtils.recordPeqData(authData, pd, false, specials );
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
    let origPop = awsUtils.checkPopulated( authData, pd.ceProjectId );

    // XXX this does more work than is needed - checks for peqs which only exist during testing.
    const proj = await awsUtils.getProjectStatus( authData, pd.ceProjectId );
    let linkage = await ghLinks.initOneProject( authData, proj );

    // At this point, we have happily added 1:m issue:card relations to linkage table (no other table)
    // Resolve here to split those up.  Normally, would then worry about first time users being confused about
    // why the new peq label applied to their 1:m issue, only 'worked' for one card.
    // But, populate will be run from ceFlutter, separately from actual label notification.
    pd.peqType    = config.PEQTYPE_END;
    
    // Only resolve once per issue.  Happily, PV2 gql model has reverse links from issueContentId to cards (pvti_* node ids)
    // Note: allCards are still raw: [ {node: {id:}}, {{}}, ... ]
    // Note: linkage is also raw.. XXX unify naming?
    // Note: GH allows an issue to have multiple locations, but only 1 per host project.
    //       A ceProject may have multiple host projects, linkage is per ceProject, iteration to create linkage is per card, so issueContent may show up twice.
    let promises = [];
    for( const link of linkage ) {
	if( typeof link.duplicate === 'undefined' ) {
	    if( link.allCards.length > 1 ) {
		console.log( authData.who, "Found link with multiple cards", link.title, link.issueId );
		pd.issueId  = link.issueId;
		pd.issueNum = link.issueNum;
		let pdCopy =  gh2Data.GH2Data.from( pd );
		promises.push( resolve( authData, ghLinks, pdCopy, "???", false ) );
	    }
	}
	// mark duplicates
	linkage.forEach(l => { if( l.issueId == link.issueId ) { l.duplicate = true; } });
    }
    await Promise.all( promises );

    origPop = await origPop;  // any reason to back out of this sooner?
    assert( !origPop );
    // Don't wait.
    awsUtils.setPopulated( authData, pd.ceProjectId );
    console.log( authData.who, "Populate CE Linkage Done" );
    return true;
}


// Create new linkages, update peqs.
// Only routes here are from issueHandler:label (peq only), or cardHandler:create (no need to be peq)
// Only issue:label does peq-related work here. card still does linkage, resolve
// Linkage exists for carded & up issues.  Pure carded issues are not further tracked, so column info and many names set to -1 and ---, not updated further.
// 
// Cases:
//  Type1: add 1st card to non-peq:    fromCard.  (populate is here, carded issues are here.  Only this has partial linkage)
//  Type2: add 1st peq label to issue: fromLabel. (card will exist in GH already.  expect companion fromCard call in any order)
//  Type3: add 1st card to peq issue:  fromCard.  (part of above, card:create will fire. expect companion fromLabel call in any order)
//  Type?: add 2nd card ??? issue:     fromCard.  (type depends on type of issue, i.e. resolve will treat as type1 or type3 )
//
// Specials for peq creation
// Rule:
//    issue:label is addRelo                     relo not needed for peq, but for ceFlutter summary
//    card:move   diff col is relo               no x-proj moves are allowed, except unclaimed to first home.
//    card:move   same col is ignore             label, or card:create will send relo pact if appropriate.
//    card:create no  unclaimed is ignore        always accompanied by move.  let move do relo, create just handles resolve.
//    card:create yes unclaimed is addRelo       add manages peq, sends pact.  relo sends pact.
//    ceServer                                   only updates peq psub once after unclaimed -> home
//    ---                                        for card:create, if before (peq) label, typically means postpone, then ignore.
//
// label, then later create/move as part of separate call
// ---------------------------------
//  GH will have unclaimed card after issue:label is done.
//    * label will create card in unclaimed.
//	 
//	 arrival: label, then later create, move
//        ceServer: issue:label addRelo, card:create addRelo, card:move ignore   2nd addRelo moves from unclaimed to 1st home
//
// label, create/move as part of same call(s)
// ---------------------------------
//  GH will have card.  issue:label will detect card was created already, so will not create unclaimed.
//  
//    * create-move case (make project card has column info)
//      in GH, card will be in correct location with correct colId
//
//	 arrival order: label, {create, move}  
//        ceServer: issue:label addRelo, card:create ---, card: ---
//	 arrival order: create, label, move
//        ceServer: card:create ---.  issue:label addRelo, card: ---
//	 arrival order: move, label, create
//        ceServer: card:move relo(?) . issue:label addRelo, card:create ---           XXX verify
//	 arrival order: {create, move}, label
//	   ceServer: card:move relo(?), card:create ---,  issue:label addRelo          XXX verify
//
//      aws peq is correct in all cases.  2-3 pacts per gh2tu call.
//	    -> Can reduce to 1-2 by expanding info carried in add.  not worth it.
//	    
//	 
//  By-hand add issue to project, before triage.  GH card will be in 'no status' for which all col info is null.
//    * create-only case
//      no matter order of arrival.  Create first?  postpone.  Label does addrelo. Label recognizes 'card no status', so does not create unclaimed.
//                                   then create (redundantly) sets linkage in PNP, stops (i.e. no addrelo).

async function processNewPEQ( authData, ghLinks, pd, issue, link, specials ) {

    let pact      = typeof specials !== 'undefined' && specials.hasOwnProperty( "pact" )     ? specials.pact     : -1;
    let fromCard  = typeof specials !== 'undefined' && specials.hasOwnProperty( "fromCard" ) ? specials.fromCard : false;
    let fromLabel = !fromCard;
    assert( fromLabel || link === -1 );
    assert( fromCard  || link !== -1 );
    
    let issDat = [issue.title];

    // labelIssue does not call getFullIssue, cardHandler does
    if( utils.validField( issue, "labelContent" ) ) { issDat.push( issue.labelContent ); }
    else if( issue.labels.length > 0 )              { for( node of issue.labels ) { issDat.push( node.description ); } }

    // console.log( authData.who, "PNP: issDat", issDat, pd.repoName, pact, fromCard );
    
    pd.issueName = issDat[0];
    pd.issueNum  = issue.number;
    pd.repoName  = issue.repository.nameWithOwner;
    pd.repoId    = issue.repository.id;

    // normal for card -> issue.  odd but legal for issue -> card
    let allocation = ghUtils.getAllocated( issDat );

    // Note.  If support convert from draft issue with <> shorthand, will need to use parsePEQ( issDat, allocation ) instead
    pd.peqValue = ghUtils.parseLabelDescr( issDat );

    // Don't wait
    // XXX remove this after ceFlutter initialization is in place
    if( pd.issueName != "A special populate issue" ) { 
	awsUtils.checkPopulated( authData, pd.ceProjectId ).then( res => assert( res != -1 ));
    }
    
    if( pd.peqValue > 0 ) { pd.peqType = allocation ? config.PEQTYPE_ALLOC : config.PEQTYPE_PLAN; } 
    // console.log( authData.who, "PNP: processing", pd.peqValue.toString(), pd.peqType );

    // fromLabel link is good, cardDat will be undefined.  fromCard is the reverse.
    let cardDat    = pd.reqBody.projects_v2_item;
    let origCardId = fromCard ? cardDat.node_id         : link.hostCardId;
    pd.projectId   = fromCard ? cardDat.project_node_id : link.hostProjectId;
    pd.columnId    = fromCard ? -1                      : link.hostColumnId;
    let colName    = fromCard ? config.EMPTY            : link.hostColumnName;
    let projName   = ghV2.getProjectName( authData, ghLinks, pd.ceProjectId, pd.projectId );
	
    console.log( authData.who, "PNP: cardid, projId colName repoid", origCardId, pd.projectId, colName, pd.repoId, pd.peqType, pd.peqValue );

    // This will be undef if this is for a new issue
    const links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "issueId": pd.issueId } );

    // Bail, if this is alloc in x3  This is fromLabel only.  fromCard can't occur first, since unclaimed is bot-created as soon as peq label is attached
    if( allocation && config.PROJ_COLS.slice(config.PROJ_PROG).includes( colName )) {
	// remove card, leave issue & label in place.
	console.log( authData.who, "WARNING.", "Allocations only useful in config:PROJ_PLAN, or flat columns.  Removing card from", colName );
	assert( fromLabel );
	await ghV2.removeCard( authData, pd.projectId, origCardId );
	return 'early';
    }

    // Bail, if ACCR peq issue trying to add a card. Links will have ACCR peq issue. There will not be links[1] unless during populate.  Can not modify ACCR.
    if( fromCard && links !== -1 && links[0].hostColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
	console.log( authData.who, "WARNING.", links[0].hostColumnName, "is reserved, can not duplicate cards from here.  Removing excess card." );
	gh.removeCard( authData, pd.projectId, origCardId );
	return 'early';
    }

    //  Can't have situated issue in reserved.
    const reserved = [config.PROJ_COLS[config.PROJ_PEND], config.PROJ_COLS[config.PROJ_ACCR]];
    assert( !( fromLabel && reserved.includes( link.hostColumnName )) );

    let card          = -1;
    let futureColName = colName; 
    let futureColId   = pd.columnId;
    // First, check if card moved in GH from no status.  Only concerned about it here, to enable skipping.  Otherwise, respect original create loc, move handles the rest.
    // Timing: user creates card in reserved.  GH creates in no status, sends notice, moves to reserved, sends notice
    //         ce starts processing PNP, checks upstream, sees reserved before removing origCard
    if( colName == config.EMPTY || colName == "No Status" || fromCard ) {
	card = await ghV2.getCard( authData, origCardId );
	futureColName = card.columnName;
	futureColId   = card.columnId;
	console.log( authData.who, "got current card loc in GH:", futureColName );
    }
    // Bail.  non-peq card will not generate fromLabel PNP.
    if( pd.peqValue <= 0 && reserved.includes( futureColName ) ) {
	console.log( authData.who, "WARNING.", futureColName, "is reserved, can not create non-peq cards here.  Removing card, keeping issue." );
	// Wait for this, otherwise followup move notice using this cardId could misbehave.
	// XXX could possibly avoid need to await safely..?
	await ghV2.removeCard( authData, pd.projectId, origCardId );
	return 'early';
    }

    let orig = {};
    let peqHumanLabelName = ghV2.makeHumanLabel( pd.peqValue, ( allocation ? config.ALLOC_LABEL : config.PEQ_LABEL ) );
    if( fromCard ) {
	colName = card.columnName;
	pd.columnId       = card.columnId;
	orig.columnId     = card.columnId;
	specials.columnId = card.columnId;

	// At this point, if create-edit preceeded label, may be in create when card is built in no-status, meaning no column data.
	console.log( authData.who, "PNP: fromCard.  ColId", card.columnId, card.columnName, pd.peqValue );
	// XXX Can assert here if new repo, not yet populated, repoStatus not set, locs not updated?
	assert( colName != config.EMPTY );

	// Bail.  This can only happen when splitting a peq issue.  In which case, do NOT destroy original.
	if( colName == config.PROJ_COLS[ config.PROJ_ACCR ] ) {
	    console.log( authData.who, "WARNING.", colName, "is reserved, can not create cards here.  Removing card, keeping issue." );
	    await ghV2.removeCard( authData, pd.projectId, origCardId );
	    assert( pd.peqValue > 0 );

	    /*
	    // If already exists, will be in links.  Do not destroy it
	    if( pd.peqValue > 0 ) {
		let peqLabel = await ghV2.findOrCreateLabel( authData, pd.repoId, allocation, peqHumanLabelName, pd.peqValue );  // this will exist

		// Don't wait.  
		ghV2.removeLabel( authData, peqLabel.id, pd.issueId );  // remove from issue
		// chances are, an unclaimed PEQ exists.  deactivate it.
		if( pd.issueId != -1 ) {
		    const daPEQ = await awsUtils.getPeq( authData, pd.ceProjectId, pd.issueId );
		    awsUtils.removePEQ( authData, daPEQ.PEQId );
		}
	    }
	    return "removeLabel";
	    */
	    return "early";
	}
	
    }
    else {
	console.log( authData.who, "PNP: fromLabelIssue", peqHumanLabelName, pd.repoName );

	assert( pd.issueNum > -1 );
	orig.columnId     = pd.columnId;
	
	// If assignments exist before an issue is PEQ, this is the only time to catch them.  PActs will catch subsequent mods.
	// Note: likely to see duplicate assignment pacts for assignment during blast creates.  ceFlutter will need to filter.
	// Note: assigments are not relevant for allocations
	// If moving card out of unclaimed, keep those assignees.. recordPeqData handles this for relocate
	if( !allocation ) { pd.assignees = await ghV2.getAssignees( authData, pd.issueId ); }
    }

    orig.projectName  = projName;
    orig.hostRepoName = pd.repoName;
    orig.hostRepoId   = pd.repoId;
    orig.issueId      = pd.issueId;
    orig.issueNum     = pd.issueNum;
    orig.title        = pd.issueName;   // XXX inconsistent naming blech
    orig.projectId    = pd.projectId;
    orig.cardId       = origCardId;
    orig.columnName   = colName;

    // Resolve splits issues to ensure a 1:1 mapping issue:card, record data for all newly created issue:card(s)
    // Update linkage with future GH locations, presuming peq.  Will undo this after resolve as needed.  Split needs locs to create for GH.
    ghLinks.addLinkage( authData, pd.ceProjectId, orig );
    let doNotTrack = fromCard && pd.peqValue <= 0; 
    let gotSplit = await resolve( authData, ghLinks, pd, allocation, doNotTrack, futureColName, futureColId );  
    if( doNotTrack ) { untrack( authData, ghLinks, pd.ceProjectId, orig ); }

    // record peq data for the original issue:card
    // NOTE: If peq == end, there is no peq/pact to record, in resolve or here.
    //       else, if resolve splits an issue due to create card, that means the base link is already fully in dynamo.
    //                Resolve will add the new one, which means work is done.
    //       resolve with an already-populated repo can NOT split an issue based on a labeling, since the only way to add a card to an existing
    //                issue is to create card.  Furthermore populate does not call this function.
    //       So.. this fires only if resolve doesn't split - all standard peq labels come here.
    if( pact != -1 && !gotSplit && pd.peqType != "end" ) {
	pd.projSub = await utils.getProjectSubs( authData, ghLinks, pd.ceProjectId, projName, colName );
	awsUtils.recordPeqData( authData, pd, true, specials );
    }
    else {
	console.log( authData.who, "No need to update peq" );
    }
}

exports.resolve           = resolve;
exports.populateCELinkage = populateCELinkage;
exports.processNewPEQ     = processNewPEQ;
