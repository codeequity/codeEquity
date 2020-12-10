var config    = require('./config');
const auth    = require( './auth' );
const awsAuth = require( './awsAuth' );
var fetch     = require('node-fetch');
var ghUtils = require('./ghUtils');
var assert = require('assert');

var gh = ghUtils.githubUtils;

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

// XXX This is called many times during one create/move.  Should keep where possible.
async function postIt( source, shortName, postData ) {
    let apiPath = getAPIPath() + "/find";
    let idToken = await awsAuth.getCogIDToken();
    // console.log( "postIt:", shortName, postData );
    console.log( source, "postIt:", shortName );
    
    const params = {
        url: apiPath,
	method: "POST",
        headers: { 'Authorization': idToken },
        body: postData
    };

    return fetch( apiPath, params )
	.then((res) => {
	    return res;
	})
	.catch(err => console.log(err));
};

async function wrappedPostIt( source, shortName, postData ) {
    let response = await postIt( source, shortName, JSON.stringify( postData ))
    if( typeof response === 'undefined' ) return null;
    
    if (response['status'] == 201) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else if (response['status'] == 204) {
	console.log(source, "Not found.", response['status'] );
	return -1;
    }
    else if (response['status'] == 422) {
	console.log(source, "Semantic error.  Normally means more items found than expected.", response['status'] );
	return -1;
    }
    else {
	console.log("Unhandled status code:", response['status'] );
	// let body = await response.json();
	// console.log(source, "Body:", body);
	return -1;
    }
}



// One of two methods to get linkage from issueId.
// Here: 204 or 422 if count != 1... if it is a known peq issue, the mapping is guaranteed to be 1:1
async function getPEQLinkageFId( source, issueId ) {
    console.log( source, "Get PEQ linkage from issue:", issueId );

    let shortName = "GetEntry";
    let query     = { "GHIssueId": issueId.toString() };
    let postData  = { "Endpoint": shortName, "tableName": "CELinkage", "query": query };

    return await wrappedPostIt( source, shortName, postData );
}


// One of two methods to get linkage from issueId.
// Here: expect list return.
// Clean results?  A clean list expects: 1) <= 1 peqtype == PLAN; and 2) either no unclaimed or no PLAN/ALLOC peq type in list
async function getIssueLinkage( source, issueId ) {
    // console.log( source, "Get card data from issue:", issueId );

    let shortName = "GetLinkages";
    let postData  = { "Endpoint": shortName, "GHIssueId": issueId.toString() };

    return await wrappedPostIt( source, shortName, postData );
}

async function getPeq( source, issueId ) {
    console.log( "Get PEQ from issueId:", issueId );

    let shortName = "GetEntry";
    let query     = { "GHIssueId": issueId.toString() };
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQs", "query": query };

    return await wrappedPostIt( source, shortName, postData );
}

async function getPeqFromTitle( source, repo, projId, title ) {
    console.log( source, "Get PEQ from title:", title, projId );

    let shortName = "GetEntry";
    let query     = { "GHRepo": repo, "GHProjectId": projId.toString(), "GHCardTitle": title };
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQs", "query": query };

    return await wrappedPostIt( source, shortName, postData );
}

async function getFromCardName( source, repoName, projName, cardTitle ) {
    console.log( source, "Get linkage from repo, card info", repoName, projName, cardTitle );

    let shortName = "GetEntry";
    let query     = { "GHRepo": repoName, "GHProjName": projName, "GHCardTitle": cardTitle };
    let postData  = { "Endpoint": shortName, "tableName": "CELinkage", "query": query };

    return await wrappedPostIt( source, shortName, postData );
}

// card:issue 1:1   issue:card 1:m   should be good
async function getFromCardId( source, repo, cardId ) {
    console.log( source, "Get linkage from repo, card Id", repo, cardId );

    let shortName = "GetEntry";
    let query     = { "GHRepo": repo, "GHCardId": cardId.toString() };
    let postData  = { "Endpoint": shortName, "tableName": "CELinkage", "query": query };

    return await wrappedPostIt( source, shortName, postData );
}

async function getExistCardIds( source, repo, cardIds ) {
    console.log( source, "Which of these already exist?" );

    const shortName = "GetExistCardIds";
    const ids = cardIds.map((id) => id.toString() );
    const postData = { "Endpoint": shortName, "GHRepo": repo, "GHCardIds": ids };

    return await wrappedPostIt( source, shortName, postData );
}

async function removeLinkage( issueId, cardId ) {
    let shortName = "DeleteLinkage";
    let pd = { "Endpoint": shortName, "GHIssueId": issueId.toString(), "GHCardId": cardId.toString() };

    return await wrappedPostIt( "", shortName, pd );
}

async function removePEQ( issueId, projSub ) {
    let shortName = "DeletePEQ";
    let pd = { "Endpoint": shortName, "GHIssueId": issueId.toString(), "subComponent": projSub };

    return await wrappedPostIt( "", shortName, pd );
}

async function addLinkage( source, repo, issueId, issueNum, projId, projName, colId, colName, newCardId, cardTitle ) {
    console.log( source, "AddLinkage", repo, issueId, newCardId, projName, colId );

    let shortName = "RecordGHCard";
    let cardTitleStrip = cardTitle.replace(/[\x00-\x1F\x7F-\x9F]/g, "");   // was keeping invisible linefeeds
    
    let postData = { "GHRepo": repo };
    postData.GHIssueId     = issueId.toString();          // all headed into dynamo is String, future flexibility
    postData.GHProjectId   = projId.toString();
    postData.GHIssueNum    = issueNum.toString();
    postData.GHProjectName = projName;
    postData.GHColumnId    = colId.toString();
    postData.GHColumnName  = colName;
    postData.GHCardId      = newCardId.toString();
    postData.GHCardTitle   = cardTitleStrip;

    let pd = { "Endpoint": shortName, "icLink": postData };

    return await wrappedPostIt( "", shortName, pd );
}

async function checkPopulated( source, repo ) {
    console.log( source, "check populated: ", repo );

    let shortName = "CheckSetGHPop";
    let postData = { "Endpoint": shortName, "GHRepo": repo, "Set": "false" };
    
    return await wrappedPostIt( source, shortName, postData );
}

async function setPopulated( source, repo ) {
    console.log( source, "Set populated: ", repo );

    let shortName = "CheckSetGHPop";
    let postData = { "Endpoint": shortName, "GHRepo": repo, "Set": "true" };
    
    return await wrappedPostIt( source, shortName, postData );
}

// Base linkage is for issue-cards that are not in validated CE project structure.
//
// [ [projId, cardId, issueNum, issueId], ... ]
// Each cardId quad is one of three types:
//  1. issue-card linkage is already in place.    Should not overwrite - handled by caller
//  2. no linkage in dynamo, but linkage in GH.   Do write.
//  3. no linkage in dynamo, only card in GH.     No.  Need a linkage in order to add to linkage table.
//
// Write repo, projId, cardId, issueNum.    issueId is much more expensive to find, not justified speculatively.
async function populateIssueCards( repo, cardIds ) {
    console.log( "Populating issue / card linkages for", repo );

    let shortName = "RecordBaseGH";

    // XXX repo is repeated needlessly
    let postData = [];
    for( const card of cardIds ) {
	
	let pData = { "GHRepo": repo };
	pData.GHProjectId   = card[0].toString();
	pData.GHCardId      = card[1].toString();
	pData.GHIssueNum    = card[2].toString();
	pData.GHIssueId     = card[3].toString();
	postData.push( pData );
    }

    let pd = { "Endpoint": shortName, "icLinks": postData };
    return await wrappedPostIt( "", shortName, pd );
}

// Use only with known PEQ issues, 1:1
// Zero out fields in linkage table no longer being tracked
async function rebaseLinkage( fullName, issueId ) {
    console.log( "Rebasing card linkage for", issueId );

    let shortName = "UpdateGHCard";

    let postData = {};
    postData.GHIssueId     = issueId.toString();  // pkey
    postData.GHCardId      = -1;                  // pkey

    postData.GHProjectName = config.EMPTY;
    postData.GHColumnId    = -1;
    postData.GHColumnName  = config.EMPTY;
    postData.GHCardTitle   = config.EMPTY;

    let pd = { "Endpoint": shortName, "icLink": postData };
    return await wrappedPostIt( "", shortName, pd );
}


// XXX handle move to new project?
// XXX this should be reused in util funcs here
async function updateLinkage( source, issueId, cardId, newColId, newColName ) {
    console.log( source, "Updating issue / card linkage" );

    let shortName = "UpdateGHCard";

    let postData = {};
    postData.GHIssueId     = issueId.toString();  // pkey
    postData.GHCardId      = cardId.toString();   // pkey

    postData.GHColumnId = newColId.toString();
    postData.GHColumnName = newColName;

    let pd = { "Endpoint": shortName, "icLink": postData };
    return await wrappedPostIt( source, shortName, pd );
}


async function updatePEQPSub( source, peqId, projSub ) {
    console.log( source, "Updating PEQ project sub", projSub.toString() );

    let shortName = "UpdatePEQ";

    let postData = {};
    postData.PEQId        = peqId.toString();
    postData.GHProjectSub = projSub;
    
    let pd = { "Endpoint": shortName, "pLink": postData }; 
    return await wrappedPostIt( source, shortName, pd );
}

// also allow actionNote, i.e. 'issue reopened, not full CE project layout, no related card moved"
async function recordPEQAction( source, ceUID, ghUserName, ghRepo, verb, action, subject, note, entryDate, rawBody ) {
    console.log( source, "Recording PEQAction: ", verb, action );

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
    return await wrappedPostIt( source, shortName, pd );
}

async function recordPEQ( source, amount, peqType, assignees, repo, projSub, projId, issueId, title ) {
    console.log( source, "Recording PEQ", peqType, amount, "PEQs for", title );

    // Erm.. model is defined in .dart.  Could jump through hoops to access it via public_flutter, buuuuut this is simpler?
    
    let shortName = "RecordPEQ";
    let titleStrip = title.replace(/[\x00-\x1F\x7F-\x9F]/g, "");   // was keeping invisible linefeeds

    let postData = {}

    if( peqType == "allocation" || peqType == "plan" ) {
	postData.CEGrantorId = config.EMPTY;
	postData.AccrualDate = config.EMPTY;
	postData.VestedPerc  = 0.0;
    }
    else
    {
	// XXX accrued - todo
    }

    postData.CEHolderId   = [];            // no access to this, yet
    postData.GHHolderId   = assignees;     
    postData.PeqType      = peqType;
    postData.Amount       = amount;
    postData.GHRepo       = repo;
    postData.GHProjectSub = projSub;
    postData.GHProjectId  = projId;
    postData.GHIssueId    = issueId;
    postData.GHIssueTitle = titleStrip;
    postData.Active       = "true";

    let pd = { "Endpoint": shortName, "newPEQ": postData };
    return await wrappedPostIt( source, shortName, pd );
}

async function recordPEQTodo( blit, blot ) {
    console.log( "Musta hava sum tingy here" );
}

function sleep(ms) {
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

// XXX dup check could occur in lambda handler, save a round trip
async function recordPeqData( installClient, pd, checkDup ) {
    let newPEQ   = -1;
    let newPEQId = -1;
    if( checkDup ) { 
	// Only 1 peq per issueId. Might be moving a card here
	let newPEQ = await getPeq( installClient[1], pd.GHIssueId );
    }

    if( newPEQ != -1 ) {
	console.log( "Peq", newPEQId, "already exists - using it instead of creating a new one" );
	console.log( "XXX XXXX XXXXX what circumstance?  If this still occurs, fix psub below." );
	// no need to wait
	newPEQId = newPEQ.PEQId;
	updatePEQPSub( installClient[1], newPEQId, pd.projSub );
    }
    else {
	newPEQId = await( recordPEQ(
	    installClient[1],
	    pd.peqValue,                    // amount
	    pd.peqType,                     // type of peq
	    pd.GHAssignees,                 // list of ghUserLogins assigned
	    pd.GHFullName,                  // gh repo
	    pd.projSub,                     // gh project subs
	    pd.GHProjectId,                 // gh project id
	    pd.GHIssueId.toString(),        // gh issue id
	    pd.GHIssueTitle                 // gh issue title
	));
	assert( newPEQId != -1 );
    }
    
    // no need to wait
    let subject = [ newPEQId ];
    recordPEQAction(
	installClient[1],
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

async function rebuildLinkage( source, link, issueData, newCardId, newTitle ) {
    // no need to wait for the deletion
    removeLinkage( link.GHIssueId, link.GHCardId );

    // is this an untracked carded issue?
    if( link.GHColumnId == -1 ) { newTitle = config.EMPTY; } 
    
    await( addLinkage( source, link.GHRepo, issueData[0], issueData[1], link.GHProjectId, link.GHProjectName,
		       link.GHColumnId, link.GHColumnName, newCardId, newTitle ));
}

// populateCE is called with first PEQ label association.  Resulting resolve may have many 1:m with large m and PEQ.
// each of those needs to recordPeq and recordPAction
// NOTE: when this triggers, it can be very expensive.  But after populate, any trigger is length==2, and only until user
//       learns 1:m is a semantic error in CE
async function resolve( installClient, pd, allocation ) {
    console.log( installClient[1], "resolve" );
    // on first call from populate, list may be large.  Afterwards, max 2.
    let links = await( getIssueLinkage( installClient[1], pd.GHIssueId ));
    if( links == -1 || links.length < 2 ) { return; }

    console.log( installClient[1], "Splitting issue to preserve 1:1 issue:card mapping, issueId:", pd.GHIssueId, pd.GHIssueNum );

    // Need all issue data, with mod to title and to comment
    assert( links[0].GHIssueNum == pd.GHIssueNum );
    let issue = await gh.getFullIssue( installClient, pd.GHOwner, pd.GHRepo, pd.GHIssueNum );  
    assert( issue != -1 );

    // console.log( "FULL ISSUE", issue );

    // If peq label exists, recast it.  There can only be 0 or 1.
    let idx = 0;
    let newLabel = "";
    for( label of issue.labels ) {
	let content = label['description'];
	let peqVal  = gh.parseLabelDescr( [content] );

	if( peqVal > 0 ) {
	    console.log( "Resolve, original peqValue:", peqVal );
	    peqVal = Math.floor( peqVal / links.length );
	    console.log( ".... new peqValue:", peqVal );

	    let peqHumanLabelName = peqVal.toString() + ( allocation ? " AllocPEQ" : " PEQ" );  // XXX config
	    newLabel = await gh.findOrCreateLabel( installClient, pd.GHOwner, pd.GHRepo, allocation, peqHumanLabelName, peqVal )
	    issue.labels[idx] = newLabel;
	    console.log( "New label", issue.labels[idx] );
	    break;
	}
	idx += 1;
    }

    // Leave first issue, card, linkage in place. Start from second.
    for( let i = 1; i < links.length; i++ ) {
	let colId      = links[i].GHColumnId;
	let origCardId = links[i].GHCardId;
	let projName   = links[i].GHProjectName;
	let colName    = links[i].GHColumnName;
	let splitTag   = randAlpha(8);

	let issueData   = await gh.splitIssue( installClient, pd.GHOwner, pd.GHRepo, issue, splitTag );  
	let newCardId   = await gh.rebuildCard( installClient, pd.GHOwner, pd.GHRepo, colId, origCardId, issueData );

	pd.GHIssueTitle = issue.title + " split: " + splitTag;
	await rebuildLinkage( installClient[1], links[i], issueData, newCardId, pd.GHIssueTitle );

	if( pd.peqType != "end" ) {
	    assert( projName != "" );
	    assert( colName != "" );
	    pd.projSub = await gh.getProjectSubs( installClient, pd.GHFullName, projName, colName );	    
	    
	    recordPEQData(installClient, pd, false );
	}
    }
}

// XXX this function can be sped up, especially when animating an unclaimed
// Only routes here are from issueHandler:label (peq only), or cardHandler:create (no need to be peq)
async function processNewPEQ( installClient, pd, issueCardContent, link ) {
    pd.GHIssueTitle = issueCardContent[0];
    
    // normal for card -> issue.  odd but legal for issue -> card
    let allocation = gh.getAllocated( issueCardContent );

    // If this new item is an issue becoming a card, any label will be human readable - different parse requirement
    if( pd.GHIssueNum == -1 ) { pd.peqValue = gh.parsePEQ( issueCardContent, allocation ); }
    else                      { pd.peqValue = gh.parseLabelDescr( issueCardContent ); }   
    
    // XXX allow PROJ_PEND
    if( pd.peqValue > 0 ) { pd.peqType = allocation ? "allocation" : "plan"; }
    console.log( installClient[1], "PNP: processing", pd.peqValue.toString(), pd.peqType );

    let origCardId = link == -1 ? pd.reqBody['project_card']['id']                           : link.GHCardId;
    let colId      = link == -1 ? pd.reqBody['project_card']['column_id']                    : link.GHColumnId;
    pd.GHProjectId = link == -1 ? pd.reqBody['project_card']['project_url'].split('/').pop() : link.GHProjectId;
    let colName    = "";
    let projName   = "";
    
    if( pd.peqType == "end" ) {
	assert( link == -1 );  
	if( pd.GHIssueId != -1 ) {
	    let blank      = config.EMPTY;
	    await addLinkage( installClient[1], pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, blank , -1, blank, origCardId, blank );
	}
    }
    else {
	let peqHumanLabelName = pd.peqValue.toString() + ( allocation ? " AllocPEQ" : " PEQ" );  // XXX config
	let peqLabel = await gh.findOrCreateLabel( installClient, pd.GHOwner, pd.GHRepo, allocation, peqHumanLabelName, pd.peqValue );
	colName  = await gh.getColumnName( installClient, colId );
	projName = await gh.getProjectName( installClient, pd.GHProjectId );

	assert( colName != -1 ); // XXX baseGH + label - link is colId-1
	assert( colName != config.PROJ_COLS[ config.PROJ_PEND ] );
	assert( colName != config.PROJ_COLS[ config.PROJ_ACCR ] );
	
	// XXX currently linkage await unnecessary?  getProjSubs calls getLinkage.  could pass info eh?
	// Note: some linkages exist and will be overwritten with dup info.  this is rare, and it is faster to do so than to check.
	// issue->card:  issueId is available, but linkage has not yet been added
	if( pd.GHIssueNum > -1 ) {
	    await( addLinkage( installClient[1], pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, projName, colId, colName, origCardId, issueCardContent[0] ));
	}
	// card -> issue..  exactly one linkage.
	else {
	    pd.GHIssueTitle = issueCardContent[0];
	    
	    // create new issue, rebuild card
	    let issueData = await gh.createIssue( installClient, pd.GHOwner, pd.GHRepo, pd.GHIssueTitle, [peqHumanLabelName], allocation );
	    let newCardId = await gh.rebuildCard( installClient, pd.GHOwner, pd.GHRepo, colId, origCardId, issueData );

	    pd.GHIssueId  = issueData[0];
	    pd.GHIssueNum = issueData[1];
	    
	    // Add card issue linkage
	    await( addLinkage( installClient[1], pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, projName, colId, colName, newCardId, pd.GHIssueTitle));

	    // Can get here by creating allocation card.  there is no issue, by def.  so no double linkage.
	    // This could be the trigger for populateCE   check and do so
	    if( allocation ) { await( gh.populateCELinkage( installClient, pd.GHOwner, pd.GHRepo, pd.GHFullName )); }
	}
    }

    if( pd.peqType != "end" ) { pd.GHAssignees = await gh.getAssignees( installClient, pd.GHOwner, pd.GHRepo, pd.GHIssueNum ); }

    // Resolve splits issues to ensure a 1:1 mapping issue:card, record peq data for all newly created issue:card(s)
    await resolve( installClient, pd, allocation );

    // record peq data for the original issue:card
    if( pd.peqType != "end" ) {
	pd.projSub = await gh.getProjectSubs( installClient, pd.GHFullName, projName, colName );
	recordPeqData( installClient, pd, true );
    }
}

async function getPActs( source, owner, repo ) {
    console.log( "Get PEQActions for a given repo:", owner, repo );

    let shortName = "GetEntries";
    let query     = { "GHUserName": owner, "GHRepo": repo};
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQActions", "query": query };

    return await wrappedPostIt( source, shortName, postData );
}

async function getPeqs( source, query ) {
    // console.log( "Get PEQs for a given repo:", query);

    let shortName = "GetEntries";
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQs", "query": query };

    return await wrappedPostIt( source, shortName, postData );
}

async function getLinks( source, repo ) {
    console.log( "Get Linkages for a given repo:", repo );

    let shortName = "GetEntries";
    let query     = { "GHRepo": repo};
    let postData  = { "Endpoint": shortName, "tableName": "CELinkage", "query": query };

    return await wrappedPostIt( source, shortName, postData );
}

async function getRepoStatus( source, repo ) {
    console.log( "Get Status for a given repo:", repo );

    let shortName = "GetEntry";
    let query     = { "GHRepo": repo};
    let postData  = { "Endpoint": shortName, "tableName": "CERepoStatus", "query": query };

    return await wrappedPostIt( source, shortName, postData );
}

async function cleanDynamo( source, tableName, ids ) {
    // console.log( tableName, "deleting ids:", ids );

    let shortName = "RemoveEntries";
    let postData  = { "Endpoint": shortName, "tableName": tableName, "ids": ids };

    return await wrappedPostIt( source, shortName, postData );
}


exports.postGH = postGH;
exports.getCognito = getCognito;
exports.getCEServer = getCEServer;
exports.getRemotePackageJSONObject = getRemotePackageJSONObject;
exports.recordPEQAction = recordPEQAction;
exports.recordPEQ = recordPEQ;
exports.recordPEQTodo = recordPEQTodo;
exports.addLinkage = addLinkage;
exports.removeLinkage = removeLinkage;
exports.removePEQ = removePEQ;
exports.getFromCardName = getFromCardName;
exports.getFromCardId = getFromCardId;
exports.getExistCardIds = getExistCardIds;
exports.getPeq = getPeq;
exports.getPeqFromTitle = getPeqFromTitle;
exports.checkPopulated = checkPopulated;
exports.setPopulated = setPopulated;
exports.populateIssueCards = populateIssueCards;
exports.rebaseLinkage = rebaseLinkage;
exports.updateLinkage = updateLinkage;
exports.getIssueLinkage = getIssueLinkage;
exports.getPEQLinkageFId = getPEQLinkageFId;
exports.updatePEQPSub = updatePEQPSub;
exports.sleep = sleep;
exports.getToday = getToday;
exports.resolve = resolve;
exports.processNewPEQ = processNewPEQ;

exports.getPActs = getPActs;
exports.getPeqs = getPeqs;
exports.getLinks = getLinks;
exports.getRepoStatus = getRepoStatus;
exports.cleanDynamo = cleanDynamo;
