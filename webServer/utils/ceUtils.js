const fetch  = require( 'node-fetch' );
const assert = require('assert');

const config = require( '../config');
const auth   = require( '../auth/gh/ghAuth' );

const ghClassic = require( './gh/ghc/ghClassicUtils' );
const gh        = ghClassic.githubUtils;
const ghSafe    = ghClassic.githubSafe;



// UNIT TESTING ONLY!!
// Ugly ugly hack to test error handler.  Turn this off for normal runs.
const TEST_EH     = true;
const TEST_EH_PCT = .05;

// UNIT TESTING ONLY!!
// internal server error testing
const FAKE_ISE = {  
    status: 500,
    body: JSON.stringify( "---" ),
};

// UNIT TESTING ONLY!!
async function failHere( source ) {
    console.log( "Error.  Fake internal server error for", source );
    assert( false );
}




async function postCE( shortName, postData ) {
    const ceServerTestingURL = config.TESTING_ENDPOINT;

    const params = {
	url: ceServerTestingURL,
	method: "POST",
	headers: {'Content-Type': 'application/json' },
	body: postData
    };

    let ret = await fetch( ceServerTestingURL, params )
	.catch( err => console.log( err ));

    if( ret['status'] == 201 ) { 
	let body = await ret.json();
	return body;
    }
    else { return -1; }
}
    

// This needs to occur after linkage is overwritten.
// Provide good subs no matter if using Master project indirection, or flat projects.
async function getProjectSubs( authData, ghLinks, ceProjId, repoName, projName, colName ) {
    let projSub = [ "Unallocated" ];  // Should not occur.

    console.log( authData.who, "Set up proj subs", repoName, projName, colName );
	
    if( projName == config.MAIN_PROJ ) { projSub = [ colName ]; }
    else {
	// Check if project is a card in Master
	let links = ghLinks.getLinks( authData, {"ceProjId": ceProjId, "repo": repoName, "projName": config.MAIN_PROJ, "issueTitle": projName} );
	if( links != -1 ) { projSub = [ links[0]['GHColumnName'], projName ]; }
	else              { projSub = [ projName ]; }

	// No, induces too many special cases, with no return.
	// If col isn't a CE organizational col, add to psub
	// if( ! config.PROJ_COLS.includes( colName ) ) { projSub.push( colName ); }
	projSub.push( colName ); 
    }
	    
    // console.log( "... returning", projSub.toString() );
    return projSub;
}


function sleep(ms) {
    if( ms >= 1000 ) { console.log( "Sleeping for", ms / 1000, "seconds" ); }
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getMillis( byHour ) {
    var millis = new Date();

    var hh = String(millis.getHours()).padStart(2, '0');
    var mm = String(millis.getMinutes()).padStart(2, '0');
    var ss = String(millis.getSeconds()).padStart(2, '0');
    var ii = String(millis.getMilliseconds());
    
    // millis = hh + '.' + mm + '.' + ss + '.' + ii;
    if( typeof byHour !== 'undefined' && byHour ) {  millis = hh; }
    else                                          {  millis = mm + '.' + ss + '.' + ii; }

    return millis.toString();
}

function millisDiff( mNew, mOld) {

    var mmNew = parseInt( mNew.substr(0,2) );
    var ssNew = parseInt( mNew.substr(3,2) );
    var iiNew = parseInt( mNew.substr(6,2) );

    var mmOld = parseInt( mOld.substr(0,2) );
    var ssOld = parseInt( mOld.substr(3,2) );
    var iiOld = parseInt( mOld.substr(6,2) );

    if( mmNew < mmOld ) { mmNew += 60; }  // rollover
    const millis = iiNew - iiOld + 1000 * (ssNew - ssOld) + 60 * 1000 * (mmNew - mmOld );

    return millis;
}

function getToday() {
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = today.getFullYear();
    
    today = mm + '/' + dd + '/' + yyyy;

    return today.toString();
}

function randAlpha(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}





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
	let peqVal  = ghSafe.parseLabelDescr( [content] );

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
	let splitTag   = randAlpha(8);

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
	    pd.projSub = await getProjectSubs( authData, ghLinks, pd.CEProjectId, pd.GHFullName, projName, colName );	    
	    
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
    let allocation = ghSafe.getAllocated( issueCardContent );

    // If this new item is an issue becoming a card, any label will be human readable - different parse requirement
    if( pd.GHIssueNum == -1 ) { pd.peqValue = ghSafe.parsePEQ( issueCardContent, allocation ); }
    else                      { pd.peqValue = ghSafe.parseLabelDescr( issueCardContent ); }

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
	pd.projSub = await getProjectSubs( authData, ghLinks, pd.CEProjectId, pd.GHFullName, projName, colName );
	awsUtils.recordPeqData( authData, pd, true, specials );
    }
}

// Use this sparingly, if at all!!
async function settleWithVal( fname, func, ...params ) {
    let delayCount = 1;

    let retVal = await func( ...params );
    while( (typeof retVal === 'undefined' || retVal == -1 ) && delayCount < config.MAX_DELAYS) {
	console.log( "WARNING", fname, delayCount, "Spin wait.  Should this happen with any frequency, increase the instance stats, and add a thread pool." );
	await sleep( config.STEP_COST );
	retVal = await func( ...params );
	delayCount++;
    }
    return retVal;
}





/* Not in use
function makeStamp( newStamp ) {
    // newstamp: "2020-12-23T20:55:27Z"
    assert( newStamp.length >= 20 );
    const h = parseInt( newStamp.substr(11,2) );
    const m = parseInt( newStamp.substr(14,2) );
    const s = parseInt( newStamp.substr(17,2) );

    return h * 3600 + m * 60 + s;
}
*/

/* Not in use
// UNIT TESTING ONLY!!
// Ingesting is a ceFlutter operation. 
async function ingestPActs( authData, pactIds ) {
    console.log( authData.who, "ingesting pacts TESTING ONLY", pactIds );

    let shortName = "UpdatePAct";
    let pd = { "Endpoint": shortName, "PactIds": pactIds }; 
    return await wrappedPostAWS( authData, shortName, pd );
}
*/



exports.randAlpha     = randAlpha;
exports.postCE        = postCE;
exports.sleep         = sleep;
exports.getMillis     = getMillis;
exports.millisDiff    = millisDiff;
exports.getToday      = getToday;
exports.settleWithVal = settleWithVal;

exports.resolve       = resolve;
exports.processNewPEQ = processNewPEQ;

// TESTING ONLY
exports.TEST_EH       = TEST_EH;          // TESTING ONLY
exports.TEST_EH_PCT   = TEST_EH_PCT;      // TESTING ONLY
exports.FAKE_ISE      = FAKE_ISE;         // TESTING ONLY
exports.failHere      = failHere;         // TESTING ONLY
