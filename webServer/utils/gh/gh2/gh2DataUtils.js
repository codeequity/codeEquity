var assert = require( 'assert' );

const config   = require( '../../../config' );
const utils    = require( '../../ceUtils' );
const awsUtils = require( '../../awsUtils' );

const ghUtils  = require( '../ghUtils' );

const ghV2     = require( './ghV2Utils' );

const gh2Data  = require( '../../../routes/ghVersion2/gh2Data' );

// XXX allocation set per label - don't bother to pass in
// populateCE is called BEFORE first PEQ label association.  Resulting resolve may have many 1:m with large m and PEQ.
// each of those needs to recordPeq and recordPAction
// NOTE: when this triggers, it can be very expensive.  But after populate, any trigger is length==2, and only until user
//       learns 1:m is a semantic error in CE
// Main trigger during typical runtime:
//  1: add another project card to situated issue
async function resolve( authData, ghLinks, pd, allocation ) {
    let gotSplit = false;

    console.log( authData.who, "RESOLVE", pd.issueId );
    if( pd.issueId == -1 ) { console.log(authData.who, "Resolve: early return, no issueId." ); return gotSplit; }
    
    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "issueId": pd.issueId });
    // This can happen if an issue in a non-ceProj repo links to a project that is in a ceProj.  The 'visiting' issue should not
    // be managed by ceServer.
    if( links == -1 || links.length < 2 ) { console.log(authData.who, "Resolve: early return, visitor is not part of ceProject." ); return gotSplit; }
    gotSplit = true;
    
    // Resolve gets here in 2 major cases: a) populateCE - not relevant to this, and b) add card to an issue.  PEQ not required.
    // For case b, ensure ordering such that pd element (the current card-link) is acted on below - i.e. is not in position 0
    //             since the carded issue has already been acted on earlier.
    if( pd.peqType != "end" && links[0].hostColumnId == pd.columnId ) {
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
	    let peqHumanLabelName = peqVal.toString() + " " + ( allocation ? config.ALLOC_LABEL : config.PEQ_LABEL );
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
    for( let i = 1; i < links.length; i++ ) {
	let origCardId = links[i].hostCardId;
	let splitTag   = utils.randAlpha(8);
	pd.repoId      = links[i].hostRepoId;
	pd.projectId   = links[i].hostProjectId;
	    
	let issueData   = await ghV2.rebuildIssue( authData, pd.repoId, pd.projectId, issue, "", splitTag );
	let newCardId   = await ghV2.rebuildCard( authData, pd.ceProjectId, ghLinks, links[i].hostColumnId, origCardId, issueData, {projId: pd.projectId} );

	pd.issueId    = issueData[0];
	pd.issueNum   = issueData[1];
	pd.issueName  = issue.title;
	ghLinks.rebuildLinkage( authData, links[i], issueData, newCardId, pd.issueName );
    }

    // On initial populate call, resolve is called first, followed by processNewPeq.
    // Leave first issue for PNP.  Start from second.
    console.log( authData.who, "Building peq for", links[1].hostIssueName );
    for( let i = 1; i < links.length; i++ ) {    
	// Don't record simple multiply-carded issues
	if( pd.peqType != "end" ) {
	    let projName   = links[i].hostProjectName;
	    let colName    = links[i].hostColumnName;
	    assert( projName != "" );
	    pd.projSub = await utils.getProjectSubs( authData, ghLinks, pd.ceProjectId, projName, colName );	    
	    
	    awsUtils.recordPeqData(authData, pd, false );
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
    pd.peqType    = "end";
    
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
		promises.push( resolve( authData, ghLinks, pdCopy, "???" ) );
	    }
	}
	// mark duplicates
	linkage.forEach(l => { if( l.issueId == link.issueId ) { l.duplicate = true; } });
    }
    await Promise.all( promises );

    origPop = await origPop;  // any reason to back out of this sooner?
    // XXX TURN THIS BACK ON
    // assert( !origPop );
    // Don't wait.
    awsUtils.setPopulated( authData, pd.ceProjectId );
    console.log( authData.who, "Populate CE Linkage Done" );
    return true;
}


exports.resolve           = resolve;
exports.populateCELinkage = populateCELinkage;

