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


// XXX unused, untested as of yet.
// XXX naming convention
async function getGH( url ) {

    const params = {
        url: url,
	method: "GET",
        headers: {'contentTypeHeader': 'application/json' }
    };
    
    return fetch( url, params )
	.then((res) => {
	    console.log( res );
	    return res;
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
	console.log(source, "Issue not found.", response['status'] );
	return -1;
    }
    else {
	console.log("Unhandled status code:", response['status'] );
	// let body = await response.json();
	// console.log(source, "Body:", body);
	return -1;
    }
}

async function getFromIssue( source, issueId ) {
    console.log( source, "Get card data from issue:", issueId );

    let shortName = "GetEntry";
    let query     = { "GHIssueId": issueId.toString() };
    let postData  = { "Endpoint": shortName, "tableName": "CEProjects", "query": query };

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
    let postData  = { "Endpoint": shortName, "tableName": "CEProjects", "query": query };

    return await wrappedPostIt( source, shortName, postData );
}

async function getFromCardId( source, repo, cardId ) {
    console.log( source, "Get linkage from repo, card Id", repo, cardId );

    let shortName = "GetEntry";
    let query     = { "GHRepo": repo, "GHCardId": cardId.toString() };
    let postData  = { "Endpoint": shortName, "tableName": "CEProjects", "query": query };

    return await wrappedPostIt( source, shortName, postData );
}

async function getExistCardIds( source, repo, cardIds ) {
    console.log( source, "Which of these already exist?" );

    const shortName = "GetExistCardIds";
    const ids = cardIds.map((id) => id.toString() );
    const postData = { "Endpoint": shortName, "GHRepo": repo, "GHCardIds": ids };

    return await wrappedPostIt( source, shortName, postData );
}

async function addLinkage( repo, issueId, issueNum, projId, projName, colId, colName, newCardId, cardTitle ) {
    console.log( "Adding issue / card linkage", repo, issueId, projName, colId );

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

// XXX awsdynamo change update to 1 func, linkage obj, any exist are set.
// Zero out fields in linkage table no longer being tracked
async function rebaseLinkage( fullName, issueId ) {
    console.log( "Rebasing card linkage for", issueId );

    let shortName = "UpdateGHCard";

    let postData = {};
    postData.GHIssueId     = issueId.toString();  // pkey
    postData.GHRepo        = fullName;                // pkey

    postData.GHProjectName = config.EMPTY;
    postData.GHColumnId    = -1;
    postData.GHColumnName  = config.EMPTY;
    postData.GHCardTitle   = config.EMPTY;

    let pd = { "Endpoint": shortName, "icLink": postData };
    return await wrappedPostIt( "", shortName, pd );
}


// XXX handle move to new project?
async function updateCardFromIssue( source, issueId, fullName, newColId, newColName ) {
    console.log( source, "Updating issue / card linkage" );

    let shortName = "UpdateGHCard";

    let postData = {};
    postData.GHIssueId     = issueId.toString();  // pkey
    postData.GHRepo        = fullName;            // pkey

    postData.GHColumnId = newColId;
    postData.GHColumnName = newColName;

    let pd = { "Endpoint": shortName, "icLink": postData };
    return await wrappedPostIt( source, shortName, pd );
}


// XXX rewrite - want issueId but this is actually valid
async function updateCardFromCardId( source, repo, cardId, colId, colName ) {
    console.log( source, "Updating issue / card linkage from cardId" );

    let shortName = "UpdateGHCardFID";
    let postData = { "Endpoint": shortName, "GHRepo": repo, "GHCardId": cardId.toString(), "GHColumnId": colId.toString(), "GHColumnName": colName };

    return await wrappedPostIt( source, shortName, postData );
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

function getToday() {
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = today.getFullYear();
    
    today = mm + '/' + dd + '/' + yyyy;

    return today.toString();
}

// XXX do not validateCE.  Basic info is plan/pend/accr project ghuser tracking.
// XXX cut down arg count
// XXX this function can be sped up, especially when animating an unclaimed
async function processNewPEQ( installClient, repo, owner, reqBody, issueCardContent, creator, issueNum, issueId, card ) {

    // normal for card -> issue.  odd but legal for issue -> card
    let allocation = gh.getAllocated( issueCardContent );

    // XXX add label can occur before submit issue, after submit issue, or after add to card.  test all
    // If this new item is an issue becoming a card, any label will be human readable - different parse requirement
    let peqValue = 0;
    if( issueNum == -1 ) { peqValue = gh.parsePEQ( issueCardContent, allocation ); }
    else                 { peqValue = gh.parseLabelDescr( issueCardContent ); }   
    if( peqValue <= 0 ) { return; }

    // XXX allow PROJ_PEND
    // should not be able to create PROJ_ACCR card.  check is below
    let peqType = allocation ? "allocation" : "plan";

    console.log( "processing", peqValue.toString(), peqType );

    let projId     = card == -1 ? reqBody['project_card']['project_url'].split('/').pop() : card['project_url'].split('/').pop()
    let colId      = card == -1 ? reqBody['project_card']['column_id'] : card['column_url'].split('/').pop();
    let origCardId = card == -1 ? reqBody['project_card']['id'] : card['id'];
    
    let fullName   = reqBody['repository']['full_name'];
    let peqHumanLabelName = peqValue.toString() + ( allocation ? " AllocPEQ" : " PEQ" );  // XXX config
    let peqLabel = await gh.findOrCreateLabel( installClient, owner, repo, allocation, peqHumanLabelName, peqValue );
    let colName  = await gh.getColumnName( installClient, colId );
    let projName = await gh.getProjectName( installClient, projId );

    assert( colName != config.PROJ_COLS[ config.PROJ_PEND ] );
    assert( colName != config.PROJ_COLS[ config.PROJ_ACCR ] );
    
    // issue->card:  issueId is available, but linkage has not yet been added
    if( issueNum > -1 ) {
	await( addLinkage( fullName, issueId, issueNum, projId, projName, colId, colName, origCardId, issueCardContent[0] ));
    }
    // card -> issue
    else {
	let cardTitle = issueCardContent[0];

	// create new issue
	let issueData = await gh.createIssue( installClient, owner, repo, cardTitle, [peqHumanLabelName], allocation );
	assert( issueData.length == 2 );
	issueId  = issueData[0];
	issueNum = issueData[1];
	assert.notEqual( issueId, -1, "Unable to create issue linked to this card." );
	
	// create issue-linked project_card, requires id not num
	let newCardId = await gh.createProjectCard( installClient, colId, issueId, true );
	assert.notEqual( newCardId, -1, "Unable to create new issue-linked card." );	    
	
	// remove orig card
	await( installClient[0].projects.deleteCard( { card_id: origCardId } ));	    
	
	// Add card issue linkage
	await( addLinkage( fullName, issueId, issueNum, projId, projName, colId, colName, newCardId, cardTitle ));
    }
    
    // Note.. unassigned is normal for plan, abnormal for inProgress, not allowed for accrued.
    // there are no assignees for card-created issues.. they are added, or created directly from issues.
    let assignees = await gh.getAssignees( installClient, owner, repo, issueNum );
    // This needs to occur after linkage is overwritten.
    let projSub   = await gh.getProjectSubs( installClient, fullName, projName, colName );
    
    // Only 1 peq per issueId. Might be moving a card here
    // XXX This check could be done in lambda handler and save a rest roundtrip.
    let newPEQ = await getPeq( installClient[1], issueId );	
    if( newPEQ != -1 ) {
	console.log( "Peq", newPEQId, "already exists - using it instead of creating a new one" );
	newPEQId = newPEQ.PEQId;
	// XXX Handle move from unallocated to within-CE.  But how about between CE projects?
	//     restriction here may be too onery
	if( newPEQ.GHProjectSub.length == 1 && newPEQ.GHProjectSub[0] == "Unallocated" ) {
	    // no need to wait
	    updatePEQPSub( installClient[1], newPEQId, projSub );
	}
    }
    else {
	newPEQId = await( recordPEQ(
	    installClient[1],
	    peqValue,                                  // amount
	    peqType,                                   // type of peq
	    assignees,                                 // list of ghUserLogins assigned
	    fullName,                                  // gh repo
	    projSub,                                   // gh project subs
	    projId,                                    // gh project id
	    issueId.toString(),                        // gh issue id
	    issueCardContent[0]                        // gh issue title
	));
	assert( newPEQId != -1 );
    }
    
    // no need to wait
    let subject = [ newPEQId ];
    recordPEQAction(
	installClient[1],
	config.EMPTY,     // CE UID
	creator,          // gh user name
	fullName,         // gh repo
	"confirm",        // verb
	"add",            // action
	subject,          // subject
	"",               // note
	getToday(),       // entryDate
	reqBody           // raw
    );
}

exports.getGH = getGH;
exports.getCognito = getCognito;
exports.getCEServer = getCEServer;
exports.getRemotePackageJSONObject = getRemotePackageJSONObject;
exports.recordPEQAction = recordPEQAction;
exports.recordPEQ = recordPEQ;
exports.recordPEQTodo = recordPEQTodo;
exports.addLinkage = addLinkage;
exports.getFromIssue = getFromIssue;
exports.getFromCardName = getFromCardName;
exports.getFromCardId = getFromCardId;
exports.getExistCardIds = getExistCardIds;
exports.getPeq = getPeq;
exports.getPeqFromTitle = getPeqFromTitle;
exports.checkPopulated = checkPopulated;
exports.setPopulated = setPopulated;
exports.populateIssueCards = populateIssueCards;
exports.rebaseLinkage = rebaseLinkage;
exports.updateCardFromIssue = updateCardFromIssue;
exports.updateCardFromCardId = updateCardFromCardId;
exports.updatePEQPSub = updatePEQPSub;
exports.getToday = getToday;
exports.processNewPEQ = processNewPEQ;
