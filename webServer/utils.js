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
    // const installationClient = await auth.getInstallationClient(installationAccessToken);
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
	.then((res) => {
	    return res.json();
	})
	.catch(err => console.log(err));
}


async function postCE( shortName, postData ) {
    console.log( "PostCE" );

    // XXX
    const ceServerTestingURL = "http://127.0.0.1:3000/github/testing";

    const params = {
	url: ceServerTestingURL,
	method: "POST",
	headers: {'Content-Type': 'application/json' },
	body: postData
    };

    let ret = await fetch( ceServerTestingURL, params )
	.then ((res) => res )
	.catch( err => console.log( err ));

    if( ret['status'] == 201 ) { 
	let body = await ret.json();
	return body;
    }
    else { return -1; }
}
    

// postAWS
async function postIt( installClient, shortName, postData ) {

    // console.log( installClient[1], "postIt:", shortName );
    
    const params = {
        url: installClient[2],
	method: "POST",
        headers: { 'Authorization': installClient[3] },
        body: postData
    };

    return fetch( installClient[2], params )
	.then((res) => {
	    return res;
	})
	.catch(err => console.log(err));
};

async function wrappedPostIt( installClient, shortName, postData ) {
    let response = await postIt( installClient, shortName, JSON.stringify( postData ))
    if( typeof response === 'undefined' ) return null;

    let tableName = "";
    if( shortName == "GetEntry" || shortName == "GetEntries" ) { tableName = postData.tableName; }
    
    if (response['status'] == 201) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else if (response['status'] == 204) {
	console.log(installClient[1], tableName, "Not found.", response['status'] );
	return -1;
    }
    else if (response['status'] == 422) {
	console.log(installClient[1], "Semantic error.  Normally means more items found than expected.", response['status'] );
	return -1;
    }
    else {
	console.log("Unhandled status code:", response['status'] );
	// let body = await response.json();
	// console.log(installClient[1], "Body:", body);
	return -1;
    }
}


async function getPeq( installClient, issueId, checkActive ) {
    console.log( installClient[1], "Get PEQ from issueId:", issueId );
    let active = true;
    if( checkActive !== undefined ) { active = checkActive; }

    let shortName = "GetEntry";
    let query     = active ? { "GHIssueId": issueId.toString(), "Active": "true" } : { "GHIssueId": issueId.toString() }; 
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQs", "query": query };

    return await wrappedPostIt( installClient, shortName, postData );
}

async function getPeqFromTitle( installClient, repo, projId, title ) {
    console.log( installClient[1], "Get PEQ from title:", title, projId );

    let shortName = "GetEntry";
    let query     = { "GHRepo": repo, "GHProjectId": projId.toString(), "GHCardTitle": title };
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQs", "query": query };

    return await wrappedPostIt( installClient, shortName, postData );
}


async function removePEQ( installClient, peqId ) {

    let shortName = "UpdatePEQ";
    let query = { "PEQId": peqId, "Active": "false" };

    let pd = { "Endpoint": shortName, "pLink": query };
    return await wrappedPostIt( installClient, shortName, pd );
}


async function checkPopulated( installClient, repo ) {
    console.log( installClient[1], "check populated: ", repo );

    let shortName = "CheckSetGHPop";
    let postData = { "Endpoint": shortName, "GHRepo": repo, "Set": "false" };
    
    return await wrappedPostIt( installClient, shortName, postData );
}

async function setPopulated( installClient, repo ) {
    console.log( installClient[1], "Set populated: ", repo );

    let shortName = "CheckSetGHPop";
    let postData = { "Endpoint": shortName, "GHRepo": repo, "Set": "true" };
    
    return await wrappedPostIt( installClient, shortName, postData );
}

// This needs to occur after linkage is overwritten.
// Provide good subs no matter if using Master project indirection, or flat projects.
async function getProjectSubs( installClient, ghLinks, repoName, projName, colName ) {
    let projSub = [ "Unallocated" ];  // Should not occur.

    console.log( installClient[1], "Set up proj subs", repoName, projName, colName );
	
    if( projName == config.MAIN_PROJ ) { projSub = [ colName ]; }
    else {
	// Check if project is a card in Master
	let links = ghLinks.getLinks( installClient, {"repo": repoName, "projName": config.MAIN_PROJ, "cardTitle": projName} );
	if( links != -1 ) { projSub = [ links[0]['GHColumnName'], projName ]; }  // XXX multiple?
	else              { projSub = [ projName ]; }

	// If col isn't a CE organizational col, add to psub
	if( ! config.PROJ_COLS.includes( colName ) ) { projSub.push( colName ); }
    }
	    
    console.log( "... returning", projSub.toString() );
    return projSub;
}


async function updatePEQPSub( installClient, peqId, projSub ) {
    console.log( installClient[1], "Updating PEQ project sub", projSub.toString() );

    let shortName = "UpdatePEQ";

    let postData = {};
    postData.PEQId        = peqId.toString();
    postData.GHProjectSub = projSub;
    
    let pd = { "Endpoint": shortName, "pLink": postData }; 
    return await wrappedPostIt( installClient, shortName, pd );
}

// XXX combine
// XXX This must be guarded, at a minimum, not ACCR
async function updatePEQVal( installClient, peqId, peqVal ) {
    console.log( installClient[1], "Updating PEQ value after label split", peqVal );

    let shortName = "UpdatePEQ";

    let postData = {};
    postData.PEQId        = peqId.toString();
    postData.Amount       = peqVal;
    
    let pd = { "Endpoint": shortName, "pLink": postData }; 
    return await wrappedPostIt( installClient, shortName, pd );
}

// also allow actionNote, i.e. 'issue reopened, not full CE project layout, no related card moved"
async function recordPEQAction( installClient, ceUID, ghUserName, ghRepo, verb, action, subject, note, entryDate, rawBody ) {
    console.log( installClient[1], "Recording PEQAction: ", verb, action );

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
    return await wrappedPostIt( installClient, shortName, pd );
}

async function recordPEQ( installClient, postData ) {
    console.log( installClient[1], "Recording PEQ", postData.PeqType, postData.Amount, "PEQs for", postData.GHIssueTitle );

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
    
    return await wrappedPostIt( installClient, shortName, pd );
}

async function recordPEQTodo( blit, blot ) {
    console.log( "Musta hava sum tingy here" );
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

// XXX dup check could occur in lambda handler, save a round trip
async function recordPeqData( installClient, pd, checkDup ) {
    console.log( "Recording peq data for", pd.GHIssueTitle );	
    let newPEQ   = -1;
    let newPEQId = -1;
    if( checkDup ) { 
	// Only 1 peq per issueId. Might be moving a card here
	let newPEQ = await getPeq( installClient, pd.GHIssueId, false );
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

    newPEQId = await recordPEQ(	installClient, postData );
    assert( newPEQId != -1 );
    
    // no need to wait
    let subject = [ newPEQId ];
    recordPEQAction(
	installClient,
	config.EMPTY,     // CE UID
	pd.GHCreator,     // gh user name
	pd.GHFullName,    // gh repo
	"confirm",        // verb
	"add",            // action
	subject,          // subject
	"",               // note
	getToday(),       // entryDate
	pd.reqBody        // raw
    );
}

function rebuildLinkage( installClient, ghLinks, link, issueData, newCardId, newTitle ) {

    let tstart = Date.now();
    
    // no need to wait for the deletion
    ghLinks.removeLinkage({ "installClient": installClient, "issueId": link.GHIssueId, "cardId": link.GHCardId });

    // is this an untracked carded issue?
    if( link.GHColumnId == -1 ) { newTitle = config.EMPTY; } 

    ghLinks.addLinkage( installClient, link.GHRepo, issueData[0], issueData[1], link.GHProjectId, link.GHProjectName,
			link.GHColumnId, link.GHColumnName, newCardId, newTitle )
    
    
    console.log( "millis", Date.now() - tstart );    
}

// The only critical component here for interleaving is getting the ID.
async function rebuildPEQ( installClient, pd, peqVal ) {
    console.log( "rebuild existing peq for issue:", pd.GHIssueId );
    let newPEQ = await getPeq( installClient, pd.GHIssueId );
    console.log( "Updating peq", newPEQ.PEQId, peqVal );
    updatePEQVal( installClient, newPEQ.PEQId, peqVal );

    recordPEQAction(
	installClient,
	config.EMPTY,     // CE UID
	pd.GHCreator,     // gh user name
	pd.GHFullName,    // gh repo
	"confirm",        // verb
	"change",         // action
	[newPEQ.PEQId],   // subject
	"",               // note
	getToday(),       // entryDate
	pd.reqBody        // raw
    );
}


// populateCE is called BEFORE first PEQ label association.  Resulting resolve may have many 1:m with large m and PEQ.
// each of those needs to recordPeq and recordPAction
// NOTE: when this triggers, it can be very expensive.  But after populate, any trigger is length==2, and only until user
//       learns 1:m is a semantic error in CE
// Main trigger during typical runtime:
//  1: add another project card to situated issue
async function resolve( installClient, ghLinks, pd, allocation ) {
    let gotSplit = false;
    console.log( installClient[1], "resolve" );
    // on first call from populate, list may be large.  Afterwards, max 2.
    let links = ghLinks.getLinks( installClient, { "issueId": pd.GHIssueId } );
    if( links == -1 || links.length < 2 ) { console.log("Resolve: early return" ); return gotSplit; }
    gotSplit = true;

    // Resolve gets here in 2 major cases: a) populateCE - not relevant to this, and b) add card to peq issue.
    // For case b, ensure ordering such that pd element (the current card-link) is acted on below - i.e. is not in position 0
    //             since the peq issue has already been acted on earlier.
    if( pd.peqType != "end" && links[0].GHColumnId == pd.GHColumnId ) {
	console.log( "Ping" );
	[links[0], links[1]] = [links[1], links[0]];
    }
    
    console.log( installClient[1], "Splitting issue to preserve 1:1 issue:card mapping, issueId:", pd.GHIssueId, pd.GHIssueNum );

    // Need all issue data, with mod to title and to comment
    assert( links[0].GHIssueNum == pd.GHIssueNum );
    let issue = await gh.getFullIssue( installClient, pd.GHOwner, pd.GHRepo, pd.GHIssueNum );  
    assert( issue != -1 );

    // Can get here with blank slate from Populate, in which case no peq label to split.
    // Can get here with peq issue that just added new card, so will have peq label to split.
    // If peq label exists, recast it.  There can only be 0 or 1.
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
	    newLabel = await gh.findOrCreateLabel( installClient, pd.GHOwner, pd.GHRepo, allocation, peqHumanLabelName, peqVal )
	    issue.labels[idx] = newLabel;
	    // update peqData for subsequent recording
	    pd.peqValue = peqVal;

	    await ghSafe.rebuildLabel( installClient, pd.GHOwner, pd.GHRepo, issue.number, label, newLabel );
	    await rebuildPEQ( installClient, pd, peqVal );
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
	    links[i].GHProjectName = await gh.getProjectName( installClient, links[i].GHProjectId );
	    links[i].GHColumnId    = ( await gh.getCard( installClient, origCardId ) ).column_url.split('/').pop();
	    links[i].GHColumnName  = await gh.getColumnName( installClient, links[i].GHColumnId );
	}

	let issueData   = await ghSafe.splitIssue( installClient, pd.GHOwner, pd.GHRepo, issue, splitTag );  
	let newCardId   = await gh.rebuildCard( installClient, pd.GHOwner, pd.GHRepo, links[i].GHColumnId, origCardId, issueData );

	pd.GHIssueId    = issueData[0];
	pd.GHIssueNum   = issueData[1];
	pd.GHIssueTitle = issue.title + " split: " + splitTag;
	rebuildLinkage( installClient, ghLinks, links[i], issueData, newCardId, pd.GHIssueTitle );
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
	    pd.projSub = await getProjectSubs( installClient, ghLinks, pd.GHFullName, projName, colName );	    
	    
	    recordPeqData(installClient, pd, false );
	}
    }
    console.log( installClient[1], "Resolve DONE" );
    return gotSplit;
}

// XXX this function can be sped up, especially when animating an unclaimed
// Only routes here are from issueHandler:label (peq only), or cardHandler:create (no need to be peq)
async function processNewPEQ( installClient, ghLinks, pd, issueCardContent, link ) {
    pd.GHIssueTitle = issueCardContent[0];
    
    // normal for card -> issue.  odd but legal for issue -> card
    let allocation = ghSafe.getAllocated( issueCardContent );

    // If this new item is an issue becoming a card, any label will be human readable - different parse requirement
    if( pd.GHIssueNum == -1 ) { pd.peqValue = ghSafe.parsePEQ( issueCardContent, allocation ); }
    else                      { pd.peqValue = ghSafe.parseLabelDescr( issueCardContent ); }

    assert( await checkPopulated( installClient, pd.GHFullName ) != -1 );
    
    if( pd.peqValue > 0 ) { pd.peqType = allocation ? "allocation" : "plan"; } 
    console.log( installClient[1], "PNP: processing", pd.peqValue.toString(), pd.peqType );

    let origCardId = link == -1 ? pd.reqBody['project_card']['id']                           : link.GHCardId;
    let colId      = link == -1 ? pd.reqBody['project_card']['column_id']                    : link.GHColumnId;
    pd.GHProjectId = link == -1 ? pd.reqBody['project_card']['project_url'].split('/').pop() : link.GHProjectId;
    let colName    = "";
    let projName   = "";

    if( pd.peqType == "end" ) {
	assert( link == -1 );

	// If reserved column, remove the card.  Can't create newbies here.
	colName = await gh.getColumnName( installClient, colId );
	const reserved = [config.PROJ_COLS[config.PROJ_PEND], config.PROJ_COLS[config.PROJ_ACCR]];
	if( reserved.includes( colName ) ) {
	    console.log( "WARNING.  Can not create non-peq cards in codeEquity's reserved pending or accrued columns." );
	    gh.removeCard( installClient, origCardId );
	}
	
	if( pd.GHIssueId != -1 ) {
	    let blank      = config.EMPTY;
	    ghLinks.addLinkage( installClient, pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, blank , -1, blank, origCardId, blank );
	}
    }
    else {
	let peqHumanLabelName = pd.peqValue.toString() + ( allocation ? " AllocPEQ" : " PEQ" );  // XXX config
	let peqLabel = await gh.findOrCreateLabel( installClient, pd.GHOwner, pd.GHRepo, allocation, peqHumanLabelName, pd.peqValue );
	colName  = await gh.getColumnName( installClient, colId );
	projName = await gh.getProjectName( installClient, pd.GHProjectId );
	assert( colName != -1 ); // XXX baseGH + label - link is colId-1

	if( colName == config.PROJ_COLS[ config.PROJ_ACCR ] ) {
	    console.log( installClient[1], "WARNING.  Action not processed in CE.", colName, "is reserved, do not label or create cards here." );
	    return "removeLabel";
	}
	
	// issue->card:  issueId is available, but linkage has not yet been added
	if( pd.GHIssueNum > -1 ) {
	    ghLinks.addLinkage( installClient, pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, projName, colId, colName, origCardId, issueCardContent[0] );
	}
	// card -> issue..  exactly one linkage.
	else {
	    pd.GHIssueTitle = issueCardContent[0];
	    
	    // create new issue, rebuild card
	    let issueData = await ghSafe.createIssue( installClient, pd.GHOwner, pd.GHRepo, pd.GHIssueTitle, [peqHumanLabelName], allocation );
	    let newCardId = await gh.rebuildCard( installClient, pd.GHOwner, pd.GHRepo, colId, origCardId, issueData );

	    pd.GHIssueId  = issueData[0];
	    pd.GHIssueNum = issueData[1];
	    
	    // Add card issue linkage
	    ghLinks.addLinkage( installClient, pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, projName, colId, colName, newCardId, pd.GHIssueTitle);
	}
    }

    // NO.. There are PActs for this.  GH/CE jobQ misalignment can cause this value to change depending on ms timing.
    //       Remember, this is only called for PEQs, not for initial populate
    // if( pd.peqType != "end" ) { pd.GHAssignees = await gh.getAssignees( installClient, pd.GHOwner, pd.GHRepo, pd.GHIssueNum ); }

    // Resolve splits issues to ensure a 1:1 mapping issue:card, record peq data for all newly created issue:card(s)
    let gotSplit = await resolve( installClient, ghLinks, pd, allocation );

    // record peq data for the original issue:card
    // NOTE: If peq == end, there is no peq/pact to record, in resolve or here.
    //       else, if resolve splits an issue due to create card, that means the base link is already fully in dynamo.
    //                Resolve will add the new one, which means work is done.
    //       resolve with an already-populated repo can NOT split an issue based on a labeling, since the only way to add a card to an existing
    //                issue is to create card.  Furthermore populate does not call this function.
    //       So.. this fires only if resolve doesn't split - all standard peq labels come here.
    if( !gotSplit && pd.peqType != "end" ) {
	pd.projSub = await getProjectSubs( installClient, ghLinks, pd.GHFullName, projName, colName );
	// Need to wait here - occasionally rapid fire testing creates a card before peq is finished recording
	await recordPeqData( installClient, pd, true );
    }
}

async function getRaw( installClient, pactId ) {
    // console.log( installClient[1], "Get raw PAction", pactId );

    let shortName = "GetEntry";
    let query     = { "PEQRawId": pactId.toString() };
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQRaw", "query": query };

    return await wrappedPostIt( installClient, shortName, postData );
}

async function getPActs( installClient, query ) {
    console.log( installClient[1], "Get PEQActions:", query );

    let shortName = "GetEntries";
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQActions", "query": query };

    return await wrappedPostIt( installClient, shortName, postData );
}

async function getPeqs( installClient, query ) {
    // console.log( "Get PEQs for a given repo:", query);

    let shortName = "GetEntries";
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQs", "query": query };

    return await wrappedPostIt( installClient, shortName, postData );
}


async function getRepoStatus( installClient, repo ) {
    console.log( installClient[1], "Get Status for a given repo:", repo );

    let shortName = repo == -1 ? "GetEntries" : "GetEntry";
    let query     = repo == -1 ? { "empty": config.EMPTY } : { "GHRepo": repo};
    let postData  = { "Endpoint": shortName, "tableName": "CERepoStatus", "query": query };

    return await wrappedPostIt( installClient, shortName, postData );
}

async function cleanDynamo( installClient, tableName, ids ) {
    // console.log( tableName, "deleting ids:", ids );

    let shortName = "RemoveEntries";
    let postData  = { "Endpoint": shortName, "tableName": tableName, "ids": ids };

    return await wrappedPostIt( installClient, shortName, postData );
}

// XXX seems to belong elsewhere
// Put the job.  Then return first on queue.  Do NOT delete first.
function checkQueue( ceJobs, installClient, handler, sender, reqBody, tag ) {
    // XXX handle aws, sam
    let jobData     = {};
    jobData.QueueId = installClient[4];
    jobData.Handler = handler;
    jobData.GHOwner = reqBody['repository']['owner']['login'];
    jobData.GHRepo  = reqBody['repository']['name'];
    jobData.Action  = reqBody['action'];
    jobData.ReqBody = reqBody;
    jobData.Tag     = tag;

    // Get or create fifoQ
    let fullName = reqBody['repository']['full_name'];
    if( !ceJobs.hasOwnProperty( fullName ) )         { ceJobs[fullName] = {}; }
    if( !ceJobs[fullName].hasOwnProperty( sender ) ) { ceJobs[fullName][sender] = new fifoQ.Queue(); }
    
    ceJobs[fullName][sender].push( jobData );

    // console.log("Check q after push", ceJobs[fullName][sender] );
    
    return ceJobs[fullName][sender].first;
}

// Remove top of queue, get next top.
async function getFromQueue( ceJobs, installClient, fullName, sender ) {
    // console.log("Get from q at start", ceJobs[fullName][sender] );

    assert( ceJobs.hasOwnProperty( fullName ) );
    assert( ceJobs[fullName].hasOwnProperty( sender ) );
    
    ceJobs[fullName][sender].shift();
    return ceJobs[fullName][sender].first;
}


// UNIT TESTING ONLY!!
// Ingesting is a ceFlutter operation. 
async function ingestPActs( installClient, pactIds ) {
    console.log( installClient[1], "ingesting pacts TESTING ONLY", pactIds );

    let shortName = "UpdatePAct";
    let pd = { "Endpoint": shortName, "PactIds": pactIds }; 
    return await wrappedPostIt( installClient, shortName, pd );
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
exports.recordPEQTodo = recordPEQTodo;
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
exports.getFromQueue = getFromQueue;


exports.ingestPActs = ingestPActs;       // TESTING ONLY
