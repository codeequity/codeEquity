const fetch  = require( 'node-fetch' );
const assert = require( 'assert' );
var fs     = require( 'fs' ), json;    // read apiBasePath

const config = require( '../config' );

const utils    = require( './ceUtils' );

// aws lambda interface, stay sync
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

// aws auth, stay sync
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

// aws base accounts
function getCEServer() {
    let fname = config.CESERVER_CONFIG_LOC;
    try {
	let data = fs.readFileSync(fname, 'utf8');
	let jdata = JSON.parse( data );
	// console.log(jdata);

	if( !jdata.hasOwnProperty( "ceServer" ) || !jdata.ceServer.hasOwnProperty( "Username" ) ) {
	    console.log( "Error.  Data in ops/aws/auth/ceServerConfig.json is not well-constructed." )
	    console.log( "expecting something of the form: {\"ceServer\": {\"Username\": <username here>, \"Password\" : <passwd here>, \"Email\" : <email here> }}" );
	    assert( false );
	}
	
	let rdata = { 'Username': jdata.ceServer.Username,
		      'Password': jdata.ceServer.Password };

	return rdata;
    } catch(e) {
	console.log('Error:', e.stack);
    }
}

async function postAWS( authData, shortName, postData ) {

    // console.log( authData.who, "postAWS:", shortName );
    
    const params = {
        url: authData.api,
	method: "POST",
        headers: { 'Authorization': authData.cog },
        body: postData
    };

    return fetch( authData.api, params )
	.catch(err => console.log(err));
};

async function wrappedPostAWS( authData, shortName, postData ) {
    let response = await postAWS( authData, shortName, JSON.stringify( postData ))
    if( typeof response === 'undefined' ) return null;

    if( response['status'] == 504 && shortName == "GetEntries" ) {
	let retries = 0;
	while( retries < config.MAX_AWS_RETRIES && response['status'] == 504 ) {
	    console.log( authData.who, "Error. Timeout.  Retrying.", retries );
	    response = await postAWS( authData, shortName, JSON.stringify( postData ))
	    if( typeof response === 'undefined' ) return null;
	}
    }
    
    let tableName = "";
    if( shortName == "GetEntry" || shortName == "GetEntries" ) { tableName = postData.tableName; }
    
    if( response['status'] == 201 ) {
	let body = await response.json();
	// console.log("Good status.  Body:", body);
	return body;
    }
    else if( response['status'] == 204 ) {
	if( tableName != "CEPEQs" ) { console.log(authData.who, tableName, "Not found.", response['status'] ); }
	return -1;
    }
    else if( response['status'] == 422 ) {
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

// Check for stored PAT.  Not available means public repo that uses ceServer PAT
async function getStoredPAT( authData, host, actor ) {
    console.log( authData.who, "Get stored PAT for:", host, actor );

    let shortName = "GetEntry";
    let query     = { "HostPlatform": host, "HostUserName": actor };
    let postData  = { "Endpoint": shortName, "tableName": "CEHostUser", "query": query };

    let repoStatus = await wrappedPostAWS( authData, shortName, postData );
    if( repoStatus == -1 ) { return -1; }
    else                   { return repoStatus.PAT; }
}

async function getProjectStatus( authData, ceProjId ) {
    console.log( authData.who, "Get Status for a given CE Project", ceProjId );

    let shortName = ceProjId == -1 ? "GetEntries" : "GetEntry";
    let query     = ceProjId == -1 ? { "empty": config.EMPTY } : { "CEProjectId": ceProjId};
    let postData  = { "Endpoint": shortName, "tableName": "CEProjects", "query": query };

    return await wrappedPostAWS( authData, shortName, postData );
}

// XXX inconsistent caps
async function getPeq( authData, ceProjId, issueId, checkActive ) {
    console.log( authData.who, "Get PEQ from issueId:", ceProjId, issueId );
    let active = true;
    if( typeof checkActive !== 'undefined' ) { active = checkActive; }

    let shortName = "GetEntry";
    let query     = active ? { "CEProjectId": ceProjId, "HostIssueId": issueId.toString(), "Active": "true" } : { "CEProjectId": ceProjId, "HostIssueId": issueId.toString() }; 
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQs", "query": query };

    return await wrappedPostAWS( authData, shortName, postData );
}

async function removePEQ( authData, peqId ) {

    let shortName = "UpdatePEQ";
    let query = { "PEQId": peqId, "Active": "false" };

    let pd = { "Endpoint": shortName, "pLink": query };
    return await wrappedPostAWS( authData, shortName, pd );
}

async function updatePEQPSub( authData, peqId, projSub ) {
    console.log( authData.who, "Updating PEQ project sub", projSub.toString() );

    let shortName = "UpdatePEQ";

    let postData = {};
    postData.PEQId          = peqId.toString();
    postData.HostProjectSub = projSub;
    
    let pd = { "Endpoint": shortName, "pLink": postData }; 
    return await wrappedPostAWS( authData, shortName, pd );
}

// Note: Only called by resolve.  PNP rejects all attempts to create in ACCR before calling resolve.
// The only critical component here for interleaving is getting the ID.
async function changeReportPeqVal( authData, pd, peqVal, link ) {
    console.log( "rebuild existing peq for issue:", pd.issueId );

    // Confirm call chain is as expected.  Do NOT want to be modifying ACCR peq vals
    assert( link.hostColumnName != config.PROJ_COLS[config.PROJ_ACCR] );

    let newPEQ = await getPeq( authData, pd.ceProjectId, pd.issueId );

    // do NOT update aws.. rely on ceFlutter to update values during ingest, using pact.  otherwise, when a split happens after
    // the initial peq has been ingested, if ingest is ignoring this pact, new value will not be picked up correctly.
    // console.log( "Updating peq", newPEQ.PEQId, peqVal );
    // updatePEQVal( authData, newPEQ.PEQId, peqVal );

    recordPEQAction( authData, config.EMPTY, pd.actor, pd.ceProjectId,
		     config.PACTVERB_CONF, "change", [newPEQ.PEQId, peqVal.toString()], "peq val update",   // XXX formalize
		     utils.getToday(), pd.reqBody );
}

async function recordPEQ( authData, postData ) {
    if( !postData.hasOwnProperty( "silent" )) { console.log( authData.who, "Recording PEQ", postData.PeqType, postData.Amount, "PEQs for", postData.HostIssueTitle ); }

    let shortName = "RecordPEQ";
    postData.HostIssueTitle = postData.HostIssueTitle.replace(/[\x00-\x1F\x7F-\x9F]/g, "");   // was keeping invisible linefeeds

    postData.CEGrantorId = postData.hasOwnProperty( "CEGrantorId" ) ? postData.CEGrantorId : config.EMPTY;
    postData.AccrualDate = postData.hasOwnProperty( "AccrualDate" ) ? postData.AccrualDate : config.EMPTY;
    postData.VestedPerc  = postData.hasOwnProperty( "VestedPerc" )  ? postData.VestedPerc  : 0.0;
    postData.CEHolderId  = postData.hasOwnProperty( "CEHolderId" )  ? postData.CEHolderId  : [];

    let pd = { "Endpoint": shortName, "newPEQ": postData };
    
    return await wrappedPostAWS( authData, shortName, pd );
}

async function rebuildPEQ( authData, link, oldPeq ) {
    let postData = {};
    postData.PEQId          = -1;
    postData.HostHolderId   = oldPeq.HostHolderId;
    postData.PeqType        = oldPeq.PeqType;
    postData.Amount         = oldPeq.Amount;
    postData.HostRepo       = oldPeq.HostRepo;
    postData.HostProjectSub = [ link.hostProjectName, link.hostColumnName ];
    postData.HostProjectId  = link.hostProjectId; 
    postData.HostIssueId    = link.hostIssueId;
    postData.HostIssueTitle = link.hostIssueName;
    postData.Active         = "true";

    // No.  No special cases, otherwise flat project handling makes things tricky in a useless way.
    // if( config.PROJ_COLS.includes( link.hostColumnName ) ) { postData.HostProjectSub = [ link.hostProjectName ]; }
    
    newPEQId = await recordPEQ(	authData, postData );
    assert( newPEQId != -1 );
    return newPEQId; 
}

// XXX evaluate extent.  ran into this where recordPeq for open issue (with unclaimed) landed after (makeCard -> gho).
//     messed up psub, but ingest is managing it.
// There is a rare race condition that can cause recordPeqData to fail.
//   label issue.  calls PNP, but does not await.  (PNP will create PEQ, eventually)
//   create card.  calls PNP, which calls recordPeqData, which checks for unclaimed:relocate and existence of PEQ.  
// await in label does not solve it 100%.   Having bad dependent peq recordings in aws may hurt later.
// Settlewait.. this has shown up once in... hundreds of runs of the full test suite?
// not, dup check could occur in lambda handler, save a round trip
// NOTE PNP sets hostAssignees based on call to host.  This means we MAY have assignees, or not, upon first
//      creation of AWS PEQ, depending on if assignment occured in host before peq label notification processing completes.
async function recordPeqData( authData, pd, checkDup, specials ) {
    let newPEQId = -1;
    let newPEQ = -1
    if( checkDup ) { 
	// Only 1 peq per issueId. Might be moving a card here
	newPEQ = await getPeq( authData, pd.ceProjectId, pd.issueId, false );
	if( newPEQ != -1 ) { newPEQId = newPEQ.PEQId; }
    }

    // If relocate, must have existing peq
    // Make sure aws has dependent PEQ before proceeding.
    if( specials == "relocate" && newPEQ == -1 ) {
	newPEQ = await utils.settleWithVal( "recordPeqData", getPeq, authData, pd.ceProjectId, pd.issueId, false );
	newPEQId = newPEQ.PEQId; 
    }
    
    let postData = {};
    postData.PEQId          = newPEQId;
    postData.HostHolderId   = specials == "relocate" ? newPEQ.HostHolderId : pd.assignees;   // list of hostUserLogins assigned
    postData.PeqType        = pd.peqType;               
    postData.Amount         = pd.peqValue;              
    postData.HostRepo       = pd.repoName;
    postData.HostProjectSub = pd.projSub;               
    postData.HostProjectId  = pd.projectId;         
    postData.HostIssueId    = pd.issueId.toString();
    postData.HostIssueTitle = pd.issueName;        
    postData.Active         = "true";

    console.log( authData.who, "Recording peq data for", pd.issueName, postData.HostHolderId.toString() );	

    // Don't wait if already have Id
    if( newPEQId == -1 ) { newPEQId = await recordPEQ( authData, postData ); }
    else                 { recordPEQ( authData, postData ); }
    assert( newPEQId != -1 );
    
    let action = "add";
    let subject = [ newPEQId ];
    if( typeof specials !== 'undefined' && specials == "relocate" ) {
	action = config.PACTACT_RELO;
	subject = [ newPEQId, pd.projectId, pd.columnId.toString() ];
    }
	
    // no need to wait
    recordPEQAction( authData, config.EMPTY, pd.actor, pd.ceProjectId,
		     config.PACTVERB_CONF, action, subject, "",
		     utils.getToday(), pd.reqBody );

    return newPEQId;
}


// also allow actionNote, i.e. 'issue reopened, not full CE project layout, no related card moved"
async function recordPEQAction( authData, ceUID, hostUserName, ceProjId, verb, action, subject, note, entryDate, rawBody ) {
    console.log( authData.who, "Recording PEQAction: ", verb, action, ceUID );

    let shortName = "RecordPEQAction";

    let postData      = { "CEUID": ceUID, "HostUserName": hostUserName, "CEProjectId": ceProjId };
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
    return await wrappedPostAWS( authData, shortName, pd );
}

async function checkPopulated( authData, ceProjId ) {
    console.log( authData.who, "check populated: ", ceProjId );

    let shortName = "CheckSetHostPop";
    let postData = { "Endpoint": shortName, "CEProjectId": ceProjId, "Set": "false" };
    
    return await wrappedPostAWS( authData, shortName, postData );
}

async function setPopulated( authData, ceProjId ) {
    console.log( authData.who, "Set populated: ", repo );

    let shortName = "CheckSetHostPop";
    let postData = { "Endpoint": shortName, "CEProjectId": ceProjId, "Set": "true" };
    
    return await wrappedPostAWS( authData, shortName, postData );
}

async function rewritePAct( authData, postData ) {
    let shortName = "RecordPEQAction";

    let pd = { "Endpoint": shortName, "newPAction": postData };
    return await wrappedPostAWS( authData, shortName, pd );
}

// locData can be from GQL, or linkage
async function refreshLinkageSummary( authData, ceProjId, locData, gql = true ) {
    console.log( "Refreshing linkage summary" );


    if( gql ) {
	for( var loc of locData ) {
            loc.Active = "true";
	}
    }

    let summary = {};
    summary.CEProjectId = ceProjId;
    summary.LastMod     = utils.getToday();
    summary.Locations   = locData;

    let shortName = "RecordLinkage"; 
    let pd = { "Endpoint": shortName, "summary": summary }; 
    return await wrappedPostAWS( authData, shortName, pd );
}

// Called via linkage:addLoc from project/col handlers, and from ghUtils when creating unclaimed, ACCR, etc.
async function updateLinkageSummary( authData, ceProjId, loc ) {
    console.log( "Updating linkage summary" );

    let newLoc = {};
    newLoc.CEProjId  = ceProjId;
    newLoc.LastMod   = utils.getToday();
    newLoc.Location  = loc;

    let shortName = "UpdateLinkage"; 

    let pd = { "Endpoint": shortName, "newLoc": newLoc }; 
    return await wrappedPostAWS( authData, shortName, pd );
}


async function getRaw( authData, pactId ) {
    // console.log( authData.who, "Get raw PAction", pactId );

    let shortName = "GetEntry";
    let query     = { "PEQRawId": pactId.toString() };
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQRaw", "query": query };

    return await wrappedPostAWS( authData, shortName, postData );
}

async function getPRaws( authData, query ) {
    // console.log( authData.who, "Get PEQActions:", query );

    let shortName = "GetEntries";
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQRaw", "query": query };

    return await wrappedPostAWS( authData, shortName, postData );
}

async function getPActs( authData, query ) {
    // console.log( authData.who, "Get PEQActions:", query );

    let shortName = "GetEntries";
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQActions", "query": query };

    return await wrappedPostAWS( authData, shortName, postData );
}

async function getPeqs( authData, query ) {
    // console.log( "Get PEQs for a given repo:", query);

    let shortName = "GetEntries";
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQs", "query": query };

    return await wrappedPostAWS( authData, shortName, postData );
}

async function getSummaries( authData, query ) {
    // console.log( "Get Summaries for a given repo:", query);

    let shortName = "GetEntries";
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQSummary", "query": query };

    return await wrappedPostAWS( authData, shortName, postData );
}

async function getLinkage( authData, query ) {

    let shortName = "GetEntries";
    let postData  = { "Endpoint": shortName, "tableName": "CELinkage", "query": query };

    return await wrappedPostAWS( authData, shortName, postData );
}

async function cleanDynamo( authData, tableName, ids ) {
    // console.log( tableName, "deleting ids:", ids );

    let shortName = "RemoveEntries";
    let postData  = { "Endpoint": shortName, "tableName": tableName, "ids": ids };

    return await wrappedPostAWS( authData, shortName, postData );
}

async function clearIngested( authData, query ) {
    // console.log( "Clear ingested flag for a given repo:", query);

    let shortName = "Uningest";
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQActions", "query": query };

    return await wrappedPostAWS( authData, shortName, postData );
}

// ******************
// Pure Testing support
// ******************

// UNIT TESTING ONLY!!
// Get linkage table on aws, without requiring server 
async function getStoredLocs( authData, ceProjId ) {
    console.log( authData.who, "get CELinkage TESTING ONLY", repo )

    let shortName = "GetEntry";
    let query     = { "CEProjectId": ceProjId };
    let postData  = { "Endpoint": shortName, "tableName": "CELinkage", "query": query };

    return await wrappedPostAWS( authData, shortName, postData );
}

/* Not in use
async function clearLinkage( authData, pd ) {
    let shortName = "GetEntry";
    let query     = { "CEProjectId": pd.ceProjectId };
    let postData  = { "Endpoint": shortName, "tableName": "CELinkage", "query": query };
    let oldLinks  = await wrappedPostAWS( authData, shortName, postData );
    
    if( oldLinks != -1 ) {
	console.log( "Clearing linkage id:", oldLinks.CELinkageId );	
	await cleanDynamo( authData, "CELinkage", [ [ oldLinks.CELinkageId ] ] );
    }
}

// Ingest does this work now.
// XXX Note.   This must be guarded, at a minimum, not ACCR
async function updatePEQVal( authData, peqId, peqVal ) {
    console.log( authData.who, "Updating PEQ value after label split", peqVal );

    let shortName = "UpdatePEQ";

    let postData = {};
    postData.PEQId        = peqId.toString();
    postData.Amount       = peqVal;
    
    let pd = { "Endpoint": shortName, "pLink": postData }; 
    return await wrappedPostAWS( authData, shortName, pd );
}
*/


exports.getAPIPath   = getAPIPath;
exports.getCognito   = getCognito;
exports.getCEServer  = getCEServer;
exports.getStoredPAT = getStoredPAT;

exports.getProjectStatus   = getProjectStatus;
exports.getPeq             = getPeq;
exports.removePEQ          = removePEQ;
exports.updatePEQPSub      = updatePEQPSub;
exports.changeReportPeqVal = changeReportPeqVal;
exports.recordPEQ          = recordPEQ;
exports.rebuildPEQ         = rebuildPEQ;
exports.recordPeqData      = recordPeqData;

exports.recordPEQAction = recordPEQAction;
exports.checkPopulated  = checkPopulated;
exports.setPopulated    = setPopulated;
exports.rewritePAct     = rewritePAct;

exports.refreshLinkageSummary = refreshLinkageSummary;
exports.updateLinkageSummary  = updateLinkageSummary;

exports.getRaw       = getRaw; 
exports.getPRaws     = getPRaws;
exports.getPActs     = getPActs;
exports.getPeqs      = getPeqs;
exports.getSummaries = getSummaries;
exports.getLinkage   = getLinkage;

exports.cleanDynamo   = cleanDynamo;
exports.clearIngested = clearIngested;

exports.getStoredLocs = getStoredLocs;    // TESTING ONLY
