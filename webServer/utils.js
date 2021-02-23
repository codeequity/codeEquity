var fetch  = require('node-fetch');
var assert = require('assert');

const auth = require( './auth' );
var config = require('./config');
var fifoQ  = require('./components/queue.js');

var ghUtils = require('./ghUtils');
var gh      = ghUtils.githubUtils;
var ghSafe  = ghUtils.githubSafe;

// read apiBasePath
// XXX combine
var fs = require('fs'), json;


function getAPIPath() {
    let fname = config.APIPATH_CONFIG_LOC;
    try {
	var data = fs.readFileSync(fname, 'utf8');
	// console.log(data);
	return data;
    } catch(e) {
	console.log('Error:', e.stack);
    }
}
function getCognito() {
    let fname = config.COGNITO_CONFIG_LOC;
    try {
	let data = fs.readFileSync(fname, 'utf8');
	let jdata = JSON.parse( data );
	// console.log(jdata);

	let rdata = { 'UserPoolId': jdata['CognitoUserPool']['Default']['PoolId'], 
		      'ClientId': jdata['CognitoUserPool']['Default']['AppClientId'],
		      'Region': jdata['CognitoUserPool']['Default']['Region'] };
	
	return rdata;
    } catch(e) {
	console.log('Error:', e.stack);
    }
}

function getCEServer() {
    let fname = config.CESERVER_CONFIG_LOC;
    try {
	let data = fs.readFileSync(fname, 'utf8');
	let jdata = JSON.parse( data );
	// console.log(jdata);

	let rdata = { 'Username': jdata['Username'],
		      'Password': jdata['Password'] };

	return rdata;
    } catch(e) {
	console.log('Error:', e.stack);
    }
}

// XXX Gimme a fname
async function getRemotePackageJSONObject(owner, repo, installationAccessToken) {
    const installationClient = await auth.getInstallationClient(owner, repo);
    const fileData = await installationClient.repos.getContents({
	owner,
	repo,
	path: 'package.json',
    });
    const fileObject = JSON.parse(Buffer.from(fileData.data.content, 'base64').toString());
    return fileObject;
};

// XXX rename postIt
async function postGH( PAT, url, postData ) {
    const params = {
	method: "POST",
        headers: {'Authorization': 'bearer ' + PAT },
	body: postData 
    };

    return fetch( url, params )
	.then(res => res.json())
	.catch(err => console.log(err));
}


async function postCE( shortName, postData ) {
    // XXX
    const ceServerTestingURL = "http://127.0.0.1:3000/github/testing";

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
    

// postAWS
async function postIt( authData, shortName, postData ) {

    // console.log( authData.who, "postIt:", shortName );
    
    const params = {
        url: authData.api,
	method: "POST",
        headers: { 'Authorization': authData.cog },
        body: postData
    };

    return fetch( authData.api, params )
	.catch(err => console.log(err));
};

async function wrappedPostIt( authData, shortName, postData ) {
    let response = await postIt( authData, shortName, JSON.stringify( postData ))
    if( typeof response === 'undefined' ) return null;

    let tableName = "";
    if( shortName == "GetEntry" || shortName == "GetEntries" ) { tableName = postData.tableName; }
    
    if (response['status'] == 201) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else if (response['status'] == 204) {
	if( tableName != "CEPEQs" ) { console.log(authData.who, tableName, "Not found.", response['status'] ); }
	return -1;
    }
    else if (response['status'] == 422) {
	console.log(authData.who, "Semantic error.  Normally means more items found than expected.", response['status'] );
	return -1;
    }
    else {
	console.log("Unhandled status code:", response['status'] );
	let body = await response.json();
	console.log(authData.who, shortName, postData, "Body:", body);
	return -1;
    }
}


async function getPeq( authData, issueId, checkActive ) {
    console.log( authData.who, "Get PEQ from issueId:", issueId );
    let active = true;
    if( typeof checkActive !== 'undefined' ) { active = checkActive; }

    let shortName = "GetEntry";
    let query     = active ? { "GHIssueId": issueId.toString(), "Active": "true" } : { "GHIssueId": issueId.toString() }; 
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQs", "query": query };

    return await wrappedPostIt( authData, shortName, postData );
}

async function getPeqFromTitle( authData, repo, projId, title ) {
    console.log( authData.who, "Get PEQ from title:", title, projId );

    let shortName = "GetEntry";
    let query     = { "GHRepo": repo, "GHProjectId": projId.toString(), "GHCardTitle": title };
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQs", "query": query };

    return await wrappedPostIt( authData, shortName, postData );
}


async function removePEQ( authData, peqId ) {

    let shortName = "UpdatePEQ";
    let query = { "PEQId": peqId, "Active": "false" };

    let pd = { "Endpoint": shortName, "pLink": query };
    return await wrappedPostIt( authData, shortName, pd );
}


async function checkPopulated( authData, repo ) {
    console.log( authData.who, "check populated: ", repo );

    let shortName = "CheckSetGHPop";
    let postData = { "Endpoint": shortName, "GHRepo": repo, "Set": "false" };
    
    return await wrappedPostIt( authData, shortName, postData );
}

async function setPopulated( authData, repo ) {
    console.log( authData.who, "Set populated: ", repo );

    let shortName = "CheckSetGHPop";
    let postData = { "Endpoint": shortName, "GHRepo": repo, "Set": "true" };
    
    return await wrappedPostIt( authData, shortName, postData );
}

// This needs to occur after linkage is overwritten.
// Provide good subs no matter if using Master project indirection, or flat projects.
async function getProjectSubs( authData, ghLinks, repoName, projName, colName ) {
    let projSub = [ "Unallocated" ];  // Should not occur.

    console.log( authData.who, "Set up proj subs", repoName, projName, colName );
	
    if( projName == config.MAIN_PROJ ) { projSub = [ colName ]; }
    else {
	// Check if project is a card in Master
	let links = ghLinks.getLinks( authData, {"repo": repoName, "projName": config.MAIN_PROJ, "cardTitle": projName} );
	if( links != -1 ) { projSub = [ links[0]['GHColumnName'], projName ]; }  // XXX multiple?
	else              { projSub = [ projName ]; }

	// If col isn't a CE organizational col, add to psub
	if( ! config.PROJ_COLS.includes( colName ) ) { projSub.push( colName ); }
    }
	    
    // console.log( "... returning", projSub.toString() );
    return projSub;
}


async function updatePEQPSub( authData, peqId, projSub ) {
    console.log( authData.who, "Updating PEQ project sub", projSub.toString() );

    let shortName = "UpdatePEQ";

    let postData = {};
    postData.PEQId        = peqId.toString();
    postData.GHProjectSub = projSub;
    
    let pd = { "Endpoint": shortName, "pLink": postData }; 
    return await wrappedPostIt( authData, shortName, pd );
}

// XXX combine
// XXX This must be guarded, at a minimum, not ACCR
async function updatePEQVal( authData, peqId, peqVal ) {
    console.log( authData.who, "Updating PEQ value after label split", peqVal );

    let shortName = "UpdatePEQ";

    let postData = {};
    postData.PEQId        = peqId.toString();
    postData.Amount       = peqVal;
    
    let pd = { "Endpoint": shortName, "pLink": postData }; 
    return await wrappedPostIt( authData, shortName, pd );
}

// also allow actionNote, i.e. 'issue reopened, not full CE project layout, no related card moved"
async function recordPEQAction( authData, ceUID, ghUserName, ghRepo, verb, action, subject, note, entryDate, rawBody ) {
    console.log( authData.who, "Recording PEQAction: ", verb, action );

    let shortName = "RecordPEQAction";

    let postData      = { "CEUID": ceUID, "GHUserName": ghUserName, "GHRepo": ghRepo };
    postData.Verb     = verb;
    postData.Action   = action;
    postData.Subject  = subject; 
    postData.Note     = note;
    postData.Date     = entryDate;
    postData.RawBody  = JSON.stringify( rawBody );
    postData.Ingested  = "false";
    postData.Locked    = "false";
    postData.TimeStamp = JSON.stringify( Date.now() );

    let pd = { "Endpoint": shortName, "newPAction": postData };
    return await wrappedPostIt( authData, shortName, pd );
}

async function recordPEQ( authData, postData ) {
    console.log( authData.who, "Recording PEQ", postData.PeqType, postData.Amount, "PEQs for", postData.GHIssueTitle );

    let shortName = "RecordPEQ";
    postData.GHIssueTitle = postData.GHIssueTitle.replace(/[\x00-\x1F\x7F-\x9F]/g, "");   // was keeping invisible linefeeds

    if( postData.PeqType == "allocation" || postData.PeqType == "plan" ) {
	postData.CEGrantorId = config.EMPTY;
	postData.AccrualDate = config.EMPTY;
	postData.VestedPerc  = 0.0;
    }
    else
    {
	// XXX accrued - todo
    }

    postData.CEHolderId   = [];            // no access to this, yet

    let pd = { "Endpoint": shortName, "newPEQ": postData };
    
    return await wrappedPostIt( authData, shortName, pd );
}

function sleep(ms) {
    if( ms >= 1000 ) { console.log( "Sleeping for", ms / 1000, "seconds" ); }
    return new Promise(resolve => setTimeout(resolve, ms));
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


async function rebuildPeq( authData, link, oldPeq ) {
    let postData = {};
    postData.PEQId        = -1;
    postData.GHHolderId   = oldPeq.GHHolderId;
    postData.PeqType      = oldPeq.PeqType;
    postData.Amount       = oldPeq.Amount;
    postData.GHRepo       = oldPeq.GHRepo;
    postData.GHProjectSub = [ link.GHProjectName, link.GHColumnName ];
    postData.GHProjectId  = link.GHProjectId; 
    postData.GHIssueId    = link.GHIssueId;
    postData.GHIssueTitle = link.GHCardTitle;   // XXX fix link name here.  cwazy
    postData.Active       = "true";

    if( config.PROJ_COLS.includes( link.GHColumnName ) ) { postData.GHProjectSub = [ link.GHProjectName ]; }
    
    newPEQId = await recordPEQ(	authData, postData );
    assert( newPEQId != -1 );
    return newPEQId; 
}

// XXX dup check could occur in lambda handler, save a round trip
async function recordPeqData( authData, pd, checkDup, specials ) {
    console.log( "Recording peq data for", pd.GHIssueTitle );	
    let newPEQId = -1;
    if( checkDup ) { 
	// Only 1 peq per issueId. Might be moving a card here
	const newPEQ = await getPeq( authData, pd.GHIssueId, false );
	if( newPEQ != -1 ) { newPEQId = newPEQ.PEQId; }
    }

    let postData = {};
    postData.PEQId        = newPEQId;
    postData.GHHolderId   = pd.GHAssignees;           // list of ghUserLogins assigned
    postData.PeqType      = pd.peqType;               // type of peq
    postData.Amount       = pd.peqValue;              // amount
    postData.GHRepo       = pd.GHFullName;            // gh repo
    postData.GHProjectSub = pd.projSub;               // gh project subs
    postData.GHProjectId  = pd.GHProjectId;           // gh project id
    postData.GHIssueId    = pd.GHIssueId.toString();  // gh issue id
    postData.GHIssueTitle = pd.GHIssueTitle;          // gh issue title
    postData.Active       = "true";

    // Don't wait if already have Id
    if( newPEQId == -1 ) { newPEQId = await recordPEQ( authData, postData ); }
    else                 { recordPEQ( authData, postData ); }
    assert( newPEQId != -1 );
    
    let action = "add";
    let subject = [ newPEQId ];
    if( typeof specials !== 'undefined' && specials == "relocate" ) {
	action = "relocate";
	subject = [ newPEQId, pd.GHProjectId, pd.GHColumnId.toString() ];
    }
	
    // no need to wait
    recordPEQAction( authData, config.EMPTY, pd.GHCreator, pd.GHFullName,
		     "confirm", action,	subject, "",
		     getToday(), pd.reqBody );

    return newPEQId;
}

function rebuildLinkage( authData, ghLinks, link, issueData, newCardId, newTitle ) {
    // no need to wait for the deletion
    ghLinks.removeLinkage({ "authData": authData, "issueId": link.GHIssueId, "cardId": link.GHCardId });

    // is this an untracked carded issue?
    if( link.GHColumnId == -1 ) { newTitle = config.EMPTY; } 

    ghLinks.addLinkage( authData, link.GHRepo, issueData[0], issueData[1], link.GHProjectId, link.GHProjectName,
			link.GHColumnId, link.GHColumnName, newCardId, newTitle )
}

// The only critical component here for interleaving is getting the ID.
async function changeReportPeqVal( authData, pd, peqVal ) {
    console.log( "rebuild existing peq for issue:", pd.GHIssueId );
    let newPEQ = await getPeq( authData, pd.GHIssueId );
    console.log( "Updating peq", newPEQ.PEQId, peqVal );
    updatePEQVal( authData, newPEQ.PEQId, peqVal );

    recordPEQAction( authData, config.EMPTY, pd.GHCreator, pd.GHFullName,
		     "confirm",	"change", [newPEQ.PEQId], "peq val update", 
		     getToday(), pd.reqBody );
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

    let links = ghLinks.getLinks( authData, { "repo": pd.GHFullName, "issueId": pd.GHIssueId } );
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

	    pd.peqType = allocation ? "allocation" : "plan"; 
	    let peqHumanLabelName = peqVal.toString() + ( allocation ? " AllocPEQ" : " PEQ" );  // XXX config
	    newLabel = await gh.findOrCreateLabel( authData, pd.GHOwner, pd.GHRepo, allocation, peqHumanLabelName, peqVal )
	    issue.labels[idx] = newLabel;
	    // update peqData for subsequent recording
	    pd.peqValue = peqVal;

	    await ghSafe.rebuildLabel( authData, pd.GHOwner, pd.GHRepo, issue.number, label, newLabel );
	    // Don't wait
	    changeReportPeqVal( authData, pd, peqVal );
	    break;
	}
	idx += 1;
    }

    for( let i = 1; i < links.length; i++ ) {
	let origCardId = links[i].GHCardId;
	let splitTag   = randAlpha(8);

	// XXX This information could be passed down.. but save speedups for graphql
	if( pd.peqType != "end" ) {
	    // PopulateCELink trigger is a peq labeling.  If applied to a multiply-carded issue, need to update info here.
	    links[i].GHProjectName = gh.getProjectName( authData, ghLinks, pd.GHFullName, links[i].GHProjectId );
	    links[i].GHColumnId    = ( await gh.getCard( authData, origCardId ) ).column_url.split('/').pop();
	    links[i].GHColumnName  = gh.getColumnName( authData, ghLinks, pd.GHFullName, links[i].GHColumnId );
	}

	let issueData   = await ghSafe.splitIssue( authData, pd.GHOwner, pd.GHRepo, issue, "", splitTag );  
	let newCardId   = await gh.rebuildCard( authData, pd.GHOwner, pd.GHRepo, links[i].GHColumnId, origCardId, issueData );

	pd.GHIssueId    = issueData[0];
	pd.GHIssueNum   = issueData[1];
	pd.GHIssueTitle = issue.title + " split: " + splitTag;
	rebuildLinkage( authData, ghLinks, links[i], issueData, newCardId, pd.GHIssueTitle );
    }

    // On initial populate call, this is called first, followed by processNewPeq.
    // Leave first issue for PNP.  Start from second.
    console.log( "Building peq for", links[1].GHCardTitle );
    for( let i = 1; i < links.length; i++ ) {    
	// Don't record simple multiply-carded issues
	if( pd.peqType != "end" ) {
	    let projName   = links[i].GHProjectName;
	    let colName    = links[i].GHColumnName;
	    assert( projName != "" );
	    pd.projSub = await getProjectSubs( authData, ghLinks, pd.GHFullName, projName, colName );	    
	    
	    recordPeqData(authData, pd, false );
	}
    }
    console.log( authData.who, "Resolve DONE" );
    return gotSplit;
}

// XXX this function can be sped up, especially when animating an unclaimed
// Only routes here are from issueHandler:label (peq only), or cardHandler:create (no need to be peq)
async function processNewPEQ( authData, ghLinks, pd, issueCardContent, link, specials ) {
    pd.GHIssueTitle = issueCardContent[0];

    // normal for card -> issue.  odd but legal for issue -> card
    let allocation = ghSafe.getAllocated( issueCardContent );

    // If this new item is an issue becoming a card, any label will be human readable - different parse requirement
    if( pd.GHIssueNum == -1 ) { pd.peqValue = ghSafe.parsePEQ( issueCardContent, allocation ); }
    else                      { pd.peqValue = ghSafe.parseLabelDescr( issueCardContent ); }

    // Don't wait
    checkPopulated( authData, pd.GHFullName ).then( res => assert( res != -1 ));
    
    if( pd.peqValue > 0 ) { pd.peqType = allocation ? "allocation" : "plan"; } 
    console.log( authData.who, "PNP: processing", pd.peqValue.toString(), pd.peqType );

    let origCardId = link == -1 ? pd.reqBody['project_card']['id']                           : link.GHCardId;
    pd.GHColumnId  = link == -1 ? pd.reqBody['project_card']['column_id']                    : link.GHColumnId;
    pd.GHProjectId = link == -1 ? pd.reqBody['project_card']['project_url'].split('/').pop() : link.GHProjectId;
    let colName    = gh.getColumnName( authData, ghLinks, pd.GHFullName, pd.GHColumnId );
    let projName   = "";

    const links = ghLinks.getLinks( authData, { "repo": pd.GHFullName, "issueId": pd.GHIssueId } );

    // Bail, if this create is an add-on to an ACCR 
    if( links != -1 && links[0].GHColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) {
	console.log( authData.who, "WARNING.", links[0].GHColumnName, "is reserved, can not duplicate cards from here.  Removing excess card." );
	gh.removeCard( authData, origCardId );
	return;
    }

    // Bail, if this is alloc in x4
    if( allocation && config.PROJ_COLS.includes( colName )) {
	// remove card, leave issue & label in place.
	console.log( authData.who, "WARNING.", "Allocations are not useful in config's PROJ_COLS columns.  Removing card from", colName );
	gh.removeCard( authData, origCardId );
	return;
    }
	

    if( pd.peqType == "end" ) {
	assert( link == -1 );

	// If reserved column, remove the card.  Can't create newbies here.  Leave issue in place else work is lost.
	const reserved = [config.PROJ_COLS[config.PROJ_PEND], config.PROJ_COLS[config.PROJ_ACCR]];
	if( reserved.includes( colName ) ) {
	    console.log( "WARNING.", colName, "is reserved, can not create non-peq cards here.  Removing card, keeping issue." );
	    gh.removeCard( authData, origCardId );
	}
	else if( pd.GHIssueId != -1 ) {
	    let blank      = config.EMPTY;
	    ghLinks.addLinkage( authData, pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, blank , -1, blank, origCardId, blank );
	}
    }
    else {
	let peqHumanLabelName = pd.peqValue.toString() + ( allocation ? " AllocPEQ" : " PEQ" );  // XXX config
	// Wait later, maybe
	let peqLabel = gh.findOrCreateLabel( authData, pd.GHOwner, pd.GHRepo, allocation, peqHumanLabelName, pd.peqValue );
	projName = gh.getProjectName( authData, ghLinks, pd.GHFullName, pd.GHProjectId );

	// Can assert here if new repo, not yet populated, repoStatus not set, locs not updated
	assert( colName != -1 ); // XXX baseGH + label - link is pd.GHColumnId-1

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
		    const daPEQ = await getPeq( authData, pd.GHIssueId );
		    removePEQ( authData, daPEQ.PEQId );
		}
	    }
	    return "removeLabel";
	}
	
	// issue->card:  issueId is available, but linkage has not yet been added
	if( pd.GHIssueNum > -1 ) {
	    ghLinks.addLinkage( authData, pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, projName,
				pd.GHColumnId, colName, origCardId, issueCardContent[0] );
	}
	// card -> issue..  exactly one linkage.
	else {
	    pd.GHIssueTitle = issueCardContent[0];
	    
	    // create new issue, rebuild card
	    peqLabel = await peqLabel; // peqHumanLabelName dep
	    let issueData = await ghSafe.createIssue( authData, pd.GHOwner, pd.GHRepo, pd.GHIssueTitle, [peqHumanLabelName], allocation );
	    let newCardId = await gh.rebuildCard( authData, pd.GHOwner, pd.GHRepo, pd.GHColumnId, origCardId, issueData );

	    pd.GHIssueId  = issueData[0];
	    pd.GHIssueNum = issueData[1];
	    
	    // Add card issue linkage
	    ghLinks.addLinkage( authData, pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, projName,
				pd.GHColumnId, colName, newCardId, pd.GHIssueTitle);
	}
    }

    // NO.. There are PActs for this.  GH/CE jobQ misalignment can cause this value to change depending on ms timing.
    //       Remember, this is only called for PEQs, not for initial populate
    // if( pd.peqType != "end" ) { pd.GHAssignees = await gh.getAssignees( authData, pd.GHOwner, pd.GHRepo, pd.GHIssueNum ); }

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
	pd.projSub = await getProjectSubs( authData, ghLinks, pd.GHFullName, projName, colName );
	recordPeqData( authData, pd, true, specials );
    }
}

async function getRaw( authData, pactId ) {
    // console.log( authData.who, "Get raw PAction", pactId );

    let shortName = "GetEntry";
    let query     = { "PEQRawId": pactId.toString() };
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQRaw", "query": query };

    return await wrappedPostIt( authData, shortName, postData );
}

async function getPActs( authData, query ) {
    // console.log( authData.who, "Get PEQActions:", query );

    let shortName = "GetEntries";
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQActions", "query": query };

    return await wrappedPostIt( authData, shortName, postData );
}

async function getPeqs( authData, query ) {
    // console.log( "Get PEQs for a given repo:", query);

    let shortName = "GetEntries";
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQs", "query": query };

    return await wrappedPostIt( authData, shortName, postData );
}


async function getRepoStatus( authData, repo ) {
    console.log( authData.who, "Get Status for a given repo:", repo );

    let shortName = repo == -1 ? "GetEntries" : "GetEntry";
    let query     = repo == -1 ? { "empty": config.EMPTY } : { "GHRepo": repo};
    let postData  = { "Endpoint": shortName, "tableName": "CERepoStatus", "query": query };

    return await wrappedPostIt( authData, shortName, postData );
}

async function cleanDynamo( authData, tableName, ids ) {
    // console.log( tableName, "deleting ids:", ids );

    let shortName = "RemoveEntries";
    let postData  = { "Endpoint": shortName, "tableName": tableName, "ids": ids };

    return await wrappedPostIt( authData, shortName, postData );
}

// XXX unused?
function getTimeDiff( lastEvent, newStamp ) {
    // lastEvent: {h, m, s}
    // newstamp: "2020-12-23T20:55:27Z"
    assert( newStamp.length >= 20 );
    let h = parseInt( newStamp.substr(11,2) );
    let m = parseInt( newStamp.substr(14,2) );
    let s = parseInt( newStamp.substr(17,2) );

    let newTime = h * 3600 + m * 60 + s;
    let oldTime = lastEvent.h * 3600 + lastEvent.m * 60 + lastEvent.s;
    let tdiff = newTime - oldTime;

    if( tdiff < 0 ) { console.log( "Old event:", lastEvent, "New timestamp", h, m, s ); }

    lastEvent.h = h;
    lastEvent.m = m;
    lastEvent.s = s;

    return tdiff;
}

function makeStamp( newStamp ) {
    // newstamp: "2020-12-23T20:55:27Z"
    assert( newStamp.length >= 20 );
    const h = parseInt( newStamp.substr(11,2) );
    const m = parseInt( newStamp.substr(14,2) );
    const s = parseInt( newStamp.substr(17,2) );

    return h * 3600 + m * 60 + s;
}

function makeJobData( jid, handler, sender, reqBody, tag, delayCount ) {
    let jobData        = {};
    jobData.QueueId    = jid;
    jobData.Handler    = handler;
    jobData.GHOwner    = reqBody['repository']['owner']['login'];
    jobData.GHRepo     = reqBody['repository']['name'];
    jobData.Action     = reqBody['action'];
    jobData.ReqBody    = reqBody;
    jobData.Tag        = tag;
    jobData.DelayCount = delayCount;

    let newStamp = reqBody[handler].updated_at;
    if( typeof newStamp === 'undefined' ) { newStamp = "1970-01-01T12:00:00Z"; }   
    jobData.Stamp = makeStamp( newStamp );
    
    return jobData;
}

function summarizeQueue( ceJobs, msg, limit ) {
    console.log( msg, " Depth", ceJobs.jobs.length, "Max depth", ceJobs.maxDepth, "Count:", ceJobs.count, "Demotions:", ceJobs.delay);
    const jobs = ceJobs.jobs.getAll();
    limit = ceJobs.jobs.length < limit ? ceJobs.jobs.length : limit;
    for( let i = 0; i < limit; i++ ) {
	console.log( "   ", jobs[i].GHOwner, jobs[i].GHRepo, jobs[i].QueueId, jobs[i].Handler, jobs[i].Action, jobs[i].Tag, jobs[i].Stamp, jobs[i].DelayCount );
    }
}

// Do not remove top, that is getNextJob's sole perogative
// add at least 2 jobs down (top is self).  if Queue is empty, await.  If too many times, we have a problem.
async function demoteJob( ceJobs, pd, jobId, event, sender, tag, delayCount ) {
    console.log( "Demoting", jobId, delayCount );
    const newJob   = makeJobData( jobId, event, sender, pd.reqBody, tag, delayCount+1 );

    assert( delayCount < 5 );
    ceJobs.delay++;
    
    // get splice index
    let spliceIndex = 1;
    let jobs = ceJobs.jobs.getAll();
    
    // If nothing else is here yet, delay
    if( jobs.length <= 1 ) { console.log( "... empty queue, sleep" );  await sleep( 300 ); }
    else {
	for( let i = 1; i < jobs.length; i++ ) {
	    if( jobs[i].Stamp - newJob.Stamp > 1 )     { break;  }
	    if( newJob.Stamp - jobs[i].Stamp > 86398 ) { break;  }  // looped
	    spliceIndex = i+1;
	}
    }

    console.log( "Got splice index of", spliceIndex );
    jobs.splice( spliceIndex, 0, newJob );

    summarizeQueue( ceJobs, "\nceJobs, after demotion", 3 );
}

// XXX seems to belong elsewhere
// Put the job.  Then return first on queue.  Do NOT delete first.
function checkQueue( ceJobs, jid, handler, sender, reqBody, tag ) {
    const jobData = makeJobData( jid, handler, sender, reqBody, tag, 0 );

    ceJobs.jobs.push( jobData );

    if( ceJobs.jobs.length > ceJobs.maxDepth ) { ceJobs.maxDepth = ceJobs.jobs.length; }
    ceJobs.count++;

    summarizeQueue( ceJobs, "\nceJobs, after push", 3 );
    
    return ceJobs.jobs.first;
}

function purgeQueue( ceJobs ) {

    console.log( "Purging ceJobs" )
    ceJobs.count = 0;
    ceJobs.delay = 0;

    // XXX  Note, this should not be necessary.
    if( ceJobs.jobs.length > 0 ) { 
	summarizeQueue( ceJobs, "Error.  Should not be jobs to purge.", 200 );
	ceJobs.jobs.purge();
    }
}


// Remove top of queue, get next top.
async function getFromQueue( ceJobs ) {
    
    ceJobs.jobs.shift();
    return ceJobs.jobs.first;
}


// UNIT TESTING ONLY!!
// Ingesting is a ceFlutter operation. 
async function ingestPActs( authData, pactIds ) {
    console.log( authData.who, "ingesting pacts TESTING ONLY", pactIds );

    let shortName = "UpdatePAct";
    let pd = { "Endpoint": shortName, "PactIds": pactIds }; 
    return await wrappedPostIt( authData, shortName, pd );
}


exports.randAlpha = randAlpha;
exports.getTimeDiff = getTimeDiff;

exports.getAPIPath = getAPIPath;
exports.getCognito = getCognito;
exports.postGH = postGH;
exports.postCE = postCE;
exports.getCognito = getCognito;
exports.getCEServer = getCEServer;
exports.getRemotePackageJSONObject = getRemotePackageJSONObject;
exports.recordPEQAction = recordPEQAction;
exports.recordPEQ = recordPEQ;
exports.rebuildPeq = rebuildPeq;
exports.recordPeqData = recordPeqData;
exports.removePEQ = removePEQ;
exports.getPeq = getPeq;
exports.getPeqFromTitle = getPeqFromTitle;
exports.checkPopulated = checkPopulated;
exports.setPopulated = setPopulated;
exports.updatePEQPSub = updatePEQPSub;
exports.sleep = sleep;
exports.getToday = getToday;
exports.resolve = resolve;
exports.processNewPEQ = processNewPEQ;

exports.getRaw   = getRaw; 
exports.getPActs = getPActs;
exports.getPeqs = getPeqs;
exports.getRepoStatus = getRepoStatus;
exports.cleanDynamo = cleanDynamo;

exports.checkQueue = checkQueue;
exports.purgeQueue = purgeQueue;
exports.getFromQueue = getFromQueue;
exports.demoteJob = demoteJob;

exports.ingestPActs = ingestPActs;       // TESTING ONLY
