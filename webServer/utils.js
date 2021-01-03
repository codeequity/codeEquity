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

/*
Future<http.Response> localPost( String shortName, postData ) async {
   print( shortName );
   // https://stackoverflow.com/questions/43871637/no-access-control-allow-origin-header-is-present-on-the-requested-resource-whe
   // https://medium.com/@alexishevia/using-cors-in-express-cac7e29b005b

   // XXX
   final gatewayURL = new Uri.http("127.0.0.1:3000", "/update/github");
   
   // need httpheaders app/json else body is empty
   final response =
      await http.post(
         gatewayURL,
         headers: {HttpHeaders.contentTypeHeader: 'application/json' },
         body: postData
         );
   
   return response;
}
*/

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

    console.log( installClient[1], "postIt:", shortName );
    
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
    
    if (response['status'] == 201) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else if (response['status'] == 204) {
	console.log(installClient[1], "Not found.", response['status'] );
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


/* YYY
// One of two methods to get linkage from issueId.
// Here: 204 or 422 if count != 1... if it is a known peq issue, the mapping is guaranteed to be 1:1
async function getPEQLinkageFId( installClient, issueId ) {
    console.log( installClient[1], "Get linkage:", issueId );

    let tstart = Date.now();
    
    let shortName = "GetEntry";
    let query     = { "GHIssueId": issueId.toString() };
    let postData  = { "Endpoint": shortName, "tableName": "CELinkage", "query": query };

    let rv = await wrappedPostIt( installClient, shortName, postData );
    console.log( "millis", Date.now() - tstart );
    return rv;
}

// One of two methods to get linkage from issueId.
// Here: expect list return.
// Clean results?  A clean list expects: 1) <= 1 peqtype == PLAN; and 2) either no unclaimed or no PLAN/ALLOC peq type in list
async function getIssueLinkage( installClient, issueId ) {
    // console.log( source, "Get card data from issue:", issueId );

    let tstart = Date.now();
    
    let shortName = "GetLinkages";
    let postData  = { "Endpoint": shortName, "GHIssueId": issueId.toString() };

    let rv = await wrappedPostIt( installClient, shortName, postData );
    console.log( "millis", Date.now() - tstart );
    return rv;
}
*/

async function getPeq( installClient, issueId ) {
    console.log( "Get PEQ from issueId:", issueId );

    let shortName = "GetEntry";
    let query     = { "GHIssueId": issueId.toString(), "Active": "true" };
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

/*
async function getFromCardName( installClient, repoName, projName, cardTitle ) {
    console.log( installClient[1], "Get linkage from repo, card info", repoName, projName, cardTitle );

    let tstart = Date.now();
    
    let shortName = "GetEntry";
    let query     = { "GHRepo": repoName, "GHProjName": projName, "GHCardTitle": cardTitle };
    let postData  = { "Endpoint": shortName, "tableName": "CELinkage", "query": query };

    let rv = await wrappedPostIt( installClient, shortName, postData );
    console.log( "millis", Date.now() - tstart );
    return rv;
}

// card:issue 1:1   issue:card 1:m   should be good
async function getFromCardId( installClient, repo, cardId ) {
    console.log( installClient[1], "Get linkage from repo, card Id", repo, cardId );

    let tstart = Date.now();
    
    let shortName = "GetEntry";
    let query     = { "GHRepo": repo, "GHCardId": cardId.toString() };
    let postData  = { "Endpoint": shortName, "tableName": "CELinkage", "query": query };

    let rv = await wrappedPostIt( installClient, shortName, postData );
    console.log( "millis", Date.now() - tstart );
    return rv;
}

// YYY clean out dynamo
async function getExistCardIds( installClient, repo, cardIds ) {
    console.log( installClient[1], "Which of these already exist?" );

    const shortName = "GetExistCardIds";
    const ids = cardIds.map((id) => id.toString() );
    const postData = { "Endpoint": shortName, "GHRepo": repo, "GHCardIds": ids };

    return await wrappedPostIt( installClient, shortName, postData );
}

async function removeLinkage( installClient, issueId, cardId ) {
    let shortName = "DeleteLinkage";
    let pd = { "Endpoint": shortName, "GHIssueId": issueId.toString(), "GHCardId": cardId.toString() };

    return await wrappedPostIt( installClient, shortName, pd );
}
*/

async function removePEQ( installClient, peqId ) {

    let shortName = "UpdatePEQ";
    let query = { "PEQId": peqId, "Active": "false" };

    let pd = { "Endpoint": shortName, "pLink": query };
    return await wrappedPostIt( installClient, shortName, pd );
}

/*
async function addLinkage( installClient, repo, issueId, issueNum, projId, projName, colId, colName, newCardId, cardTitle ) {
    console.log( installClient[1], "AddLinkage", repo, issueId, newCardId, projName, colId );

    let tstart = Date.now();

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

    let rv = await wrappedPostIt( installClient, shortName, pd );
    console.log( "millis", Date.now() - tstart );
    return rv;
}
*/

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
	// YYY let card = await( getFromCardName( installClient, repoName, config.MAIN_PROJ, projName ));
	let links = ghLinks.getLinks( installClient, {"repo": repoName, "projName": config.MAIN_PROJ, "cardTitle": projName} );
	if( links != -1 ) { projSub = [ links[0]['GHColumnName'], projName ]; }  // XXX multiple?
	else              { projSub = [ projName ]; }

	// If col isn't a CE organizational col, add to psub
	if( ! config.PROJ_COLS.includes( colName ) ) { projSub.push( colName ); }
    }
	    
    console.log( "... returning", projSub.toString() );
    return projSub;
}



// Base linkage is for issue-cards that are not in validated CE project structure.
//
// [ [projId, cardId, issueNum, issueId], ... ]
// Each cardId quad is one of three types:
//  1. issue-card linkage is already in place.    Should not overwrite - handled by caller
//  2. no linkage in dynamo, but linkage in GH,   Do write.
//  3. no linkage in dynamo, only card in GH,     No.  Need a linkage in order to add to linkage table.
//
// Write repo, projId, cardId, issueNum.    issueId is much more expensive to find, not justified speculatively.
/*
async function populateIssueCards( installClient, repo, cardIds ) {
    console.log( "Populating issue / card linkages for", repo );

    let shortName = "RecordBaseGH";

    let tstart = Date.now();

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

    let rv = await wrappedPostIt( installClient, shortName, pd );
    console.log( "millis", Date.now() - tstart );
    return rv;
}
*/

/*
// Use only with known PEQ issues, 1:1
// Zero out fields in linkage table no longer being tracked
async function rebaseLinkage( installClient, fullName, issueId ) {
    console.log( "Rebasing card linkage for", issueId );

    let shortName = "UpdateGHCard";

    let tstart = Date.now();

    let postData = {};
    postData.GHIssueId     = issueId.toString();  // pkey
    postData.GHCardId      = -1;                  // pkey    // XXXXXXX wrong

    postData.GHProjectName = config.EMPTY;
    postData.GHColumnId    = -1;
    postData.GHColumnName  = config.EMPTY;
    postData.GHCardTitle   = config.EMPTY;

    let pd = { "Endpoint": shortName, "icLink": postData };

    let rv = await wrappedPostIt( installClient, shortName, pd );
    console.log( "millis", Date.now() - tstart );
    return rv;
}
*/


// XXX handle move to new project?
// XXX this should be reused in util funcs here
/*
async function updateLinkage( installClient, issueId, cardId, newColId, newColName ) {
    console.log( installClient[1], "Updating issue / card linkage" );

    let shortName = "UpdateGHCard";

    let tstart = Date.now();

    let postData = {};
    postData.GHIssueId     = issueId.toString();  // pkey
    postData.GHCardId      = cardId.toString();   // pkey

    postData.GHColumnId = newColId.toString();
    postData.GHColumnName = newColName;

    let pd = { "Endpoint": shortName, "icLink": postData };

    let rv = await wrappedPostIt( installClient, shortName, pd );
    console.log( "millis", Date.now() - tstart );
    return rv;
}
*/

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

async function recordPEQ( installClient, amount, peqType, assignees, repo, projSub, projId, issueId, title ) {
    console.log( installClient[1], "Recording PEQ", peqType, amount, "PEQs for", title );

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
    return await wrappedPostIt( installClient, shortName, pd );
}

async function recordPEQTodo( blit, blot ) {
    console.log( "Musta hava sum tingy here" );
}

function sleep(ms) {
    if( ms > 1000 ) { console.log( "Sleeping for", ms / 1000, "seconds" ); }
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
    let newPEQ   = -1;
    let newPEQId = -1;
    if( checkDup ) { 
	// Only 1 peq per issueId. Might be moving a card here
	let newPEQ = await getPeq( installClient, pd.GHIssueId );
    }

    if( newPEQ != -1 ) {
	console.log( "Peq", newPEQId, "already exists - using it instead of creating a new one" );
	console.log( "XXX XXXX XXXXX what circumstance?  If this still occurs, fix psub below." );
	// no need to wait
	newPEQId = newPEQ.PEQId;
	updatePEQPSub( installClient, newPEQId, pd.projSub );
    }
    else {
	newPEQId = await( recordPEQ(
	    installClient,
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
    ghLinks.removeLinkage( installClient, link.GHIssueId, link.GHCardId );

    // is this an untracked carded issue?
    if( link.GHColumnId == -1 ) { newTitle = config.EMPTY; } 
    
    // YYY await( addLinkage( installClient, link.GHRepo, issueData[0], issueData[1], link.GHProjectId, link.GHProjectName,
    // link.GHColumnId, link.GHColumnName, newCardId, newTitle ));
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
    // YYY let links = await( getIssueLinkage( installClient, pd.GHIssueId ));
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
	    // YYY await addLinkage( installClient, pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, blank , -1, blank, origCardId, blank );
	    ghLinks.addLinkage( installClient, pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, blank , -1, blank, origCardId, blank );
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
	    // YYY await( addLinkage( installClient, pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, projName, colId, colName, origCardId, issueCardContent[0] ));
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
	    // YYY await( addLinkage( installClient, pd.GHFullName, pd.GHIssueId, pd.GHIssueNum, pd.GHProjectId, projName, colId, colName, newCardId, pd.GHIssueTitle));
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
	console.log( "Building peq for", pd.GHIssueTitle );	
	pd.projSub = await getProjectSubs( installClient, ghLinks, pd.GHFullName, projName, colName );
	// Need to wait here - occasionally rapid fire testing creates a card before peq is finished recording
	await recordPeqData( installClient, pd, true );
    }
}

async function getRaw( installClient, pactId ) {
    console.log( installClient[1], "Get raw PAction", pactId );

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

/*
async function getLinks( installClient, repo ) {
    console.log( installClient[1], "Get Linkages for a given repo:", repo );

    let tstart = Date.now();
    
    let shortName = "GetEntries";
    let query     = { "GHRepo": repo};
    let postData  = { "Endpoint": shortName, "tableName": "CELinkage", "query": query };

    let rv =  await wrappedPostIt( installClient, shortName, postData );
    console.log( "millis", Date.now() - tstart );
    return rv;
}
*/

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
// exports.addLinkage = addLinkage;            YYY
// exports.removeLinkage = removeLinkage;      YYY
exports.removePEQ = removePEQ;
// exports.getFromCardName = getFromCardName;  YYY
// exports.getFromCardId = getFromCardId;      YYY
// exports.getExistCardIds = getExistCardIds;  YYY
exports.getPeq = getPeq;
exports.getPeqFromTitle = getPeqFromTitle;
exports.checkPopulated = checkPopulated;
exports.setPopulated = setPopulated;
// exports.populateIssueCards = populateIssueCards;  YYY
// exports.rebaseLinkage = rebaseLinkage;            YYY
// exports.updateLinkage = updateLinkage;            YYY
// exports.getIssueLinkage = getIssueLinkage;    YYY
// exports.getPEQLinkageFId = getPEQLinkageFId;  YYY
exports.updatePEQPSub = updatePEQPSub;
exports.sleep = sleep;
exports.getToday = getToday;
exports.resolve = resolve;
exports.processNewPEQ = processNewPEQ;

exports.getRaw   = getRaw; 
exports.getPActs = getPActs;
exports.getPeqs = getPeqs;
// exports.getLinks = getLinks;                  YYY
exports.getRepoStatus = getRepoStatus;
exports.cleanDynamo = cleanDynamo;

exports.checkQueue = checkQueue;
exports.getFromQueue = getFromQueue;
