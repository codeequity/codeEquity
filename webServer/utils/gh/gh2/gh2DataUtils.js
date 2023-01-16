var assert = require( 'assert' );

const config   = require( '../../../config' );
const awsUtils = require( '../../awsUtils' );

const ghUtils  = require( '../ghUtils' );

const ghV2     = require( 'ghV2Utils' );

// populateCE is called BEFORE first PEQ label association.  Resulting resolve may have many 1:m with large m and PEQ.
// each of those needs to recordPeq and recordPAction
// NOTE: when this triggers, it can be very expensive.  But after populate, any trigger is length==2, and only until user
//       learns 1:m is a semantic error in CE
// Main trigger during typical runtime:
//  1: add another project card to situated issue
async function resolve( authData, ghLinks, pd, allocation ) {
    let gotSplit = false;

    // on first call from populate, list may be large.  Afterwards, max 2.
    if( pd.issueId == -1 ) { console.log(authData.who, "Resolve: early return" ); return gotSplit; }
    
    let links = ghLinks.getLinks( authData, { "ceProjId": pd.ceProjectId, "issueId": pd.issueId });
    if( links == -1 || links.length < 2 ) { console.log(authData.who, "Resolve: early return" ); return gotSplit; }
    gotSplit = true;
    
    // XXX pd.columnId is undefined..!  revise.  unnecessary?
    // Resolve gets here in 2 major cases: a) populateCE - not relevant to this, and b) add card to an issue.  PEQ not required.
    // For case b, ensure ordering such that pd element (the current card-link) is acted on below - i.e. is not in position 0
    //             since the carded issue has already been acted on earlier.
    if( pd.peqType != "end" && links[0].HostColumnId == pd.columnId ) {
	console.log( "Ping" );
	[links[0], links[1]] = [links[1], links[0]];
    }
    
    console.log( authData.who, "Splitting issue to preserve 1:1 issue:card mapping, issueId:", pd.issueId, pd.issueNum );

    // Need all issue data, with mod to title and to comment
    assert( links[0].HostIssueNum == pd.issueNum );
    let issue = await ghV2.getFullIssue( authData, pd.issueId );  
    assert( issue != -1 );

    // Can get here with blank slate from Populate, in which case no peq label to split.
    // Can get here with peq issue that just added new card, so will have peq label to split.
    // If peq label exists, recast it.  There can only be 0 or 1.
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

    // XXXX XXXX here
    
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
    let origPop = awsUtils.checkPopulated( authData, pd.CEProjectId );

    // XXX this does more work than is needed - checks for peqs which only exist during testing.
    const proj = await awsUtils.getProjectStatus( authData, pd.CEProjectId );
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
    for( link in linkage ) {
	if( typeof link.duplicate === 'undefined' ) {
	    if( link.allCards.length > 1 ) {
		console.log( "Found link with multiple cards", link );
		pd.issueId  = link.issueId;
		pd.issueNum = link.issueNum;
		let pdCopy = new gh2Data.copyCons( pd );
		promises.push( resolve( authData, ghLinks, pdCopy, "???" ) );
	    }
	}
	// mark duplicates
	linkage.forEach(l => if( l.issueId == link.issueId ) { l.duplicate = true; } );
    }
    await Promise.all( promises );

    origPop = await origPop;  // any reason to back out of this sooner?
    assert( !origPop );
    // Don't wait.
    awsUtils.setPopulated( authData, pd.CEProjectId );
    console.log( authData.who, "Populate CE Linkage Done" );
    return true;
}


exports.resolve           = resolve;
exports.populateCELinkage = populateCELinkage;

