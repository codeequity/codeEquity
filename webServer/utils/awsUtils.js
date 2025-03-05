const fetch  = require( 'node-fetch' );
const assert = require( 'assert' );
var fs     = require( 'fs' ), json;    // read apiBasePath

const config = require( '../config' );

const utils    = require( './ceUtils' );

var postRecord = {};
// var recordCount = 0;

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

// XXX duplicate of ghUtils.show  ... pass in postRecord and move up if this survives
function show( full ) {
    full =  typeof full === 'undefined' ? false : full;

    let arr = [];
    for( const [name, count] of Object.entries( postRecord )) {
	arr.push( [name, count] );
    }

    arr.sort( (a,b) => b[1] - a[1] );

    console.log( "-------------" );
    let tot = 0;
    for( let i = 0; i < arr.length; i++ ) {
	if( full || i < 4 ) { console.log( arr[i][0], arr[i][1] ); }
	tot = tot + arr[i][1]
    }
    console.log( "Total postAWS calls:", tot );
    console.log( "-------------" );
}

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

    let pName = shortName + "." + ( typeof postData.tableName === 'undefined' ? "" : postData.tableName );
    if( typeof postRecord[pName] === 'undefined' ) { postRecord[pName] = 0; }
    postRecord[pName] = postRecord[pName] + 1;
    // XXX formalize or remove ... if use this again, move count to config, with opt out
    // recordCount = recordCount + 1;
    // if( recordCount % 25 == 0 ) { show( true ); }  
    
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
	console.log(authData.who, "Unhandled status code:", response['status'] );
	let body = await response.json();
	console.log(authData.who, shortName, postData, "Body:", body);
	return -1;
    }
}

// returns -1 if could not find.
async function validatePEQ( authData, ceProjId, issueId, title, rid ) {
    let peq = -1;

    let peqType = "";
    assert( issueId != -1 );
    peq = await getPEQ( authData, ceProjId, issueId );

    if( peq !== -1 && peq.HostIssueTitle == title && peq.HostIssueId == issueId && peq.CEProjectId == ceProjId && peq.HostRepoId == rid )  {
	console.log( authData.who, "validatePeq success" );
    }
    else {
	console.log( authData.who, "WARNING.  Peq not valid.", peq.HostIssueTitle, title, peq.HostIssueId, issueId, peq.CEProjectId, ceProjId, peq.HostRepoId, rid );
	peq = -1;
    }
    return peq;  
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
    let shortName = ceProjId == -1 ? "GetEntries" : "GetEntry";
    let query     = ceProjId == -1 ? { "empty": config.EMPTY } : { "CEProjectId": ceProjId};
    let postData  = { "Endpoint": shortName, "tableName": "CEProjects", "query": query };

    let ceps = await wrappedPostAWS( authData, shortName, postData );

    // XXX Filtering deprecated GHC projects.  When ready, should remake these projects as PV2, then remove filtering.
    if( ceProjId == -1 ) {
	let cut = ceps.filter((cep) => cep.ProjectMgmtSys == config.PMS_GHC );
	for( const c of cut ) { console.log( "DEPRECATED ceProject", c.CEProjectId, "is being ignored." ); }
	ceps = ceps.filter((cep) => cep.ProjectMgmtSys != config.PMS_GHC );
    }
    
    return ceps;
}

// XXX inconsistent caps
async function getPEQ( authData, ceProjId, issueId, checkActive ) {
    // console.log( authData.who, "Get PEQ from issueId:", ceProjId, issueId );
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

    // console.log( authData.who, "remove", query );
    
    let pd = { "Endpoint": shortName, "pLink": query };
    return await wrappedPostAWS( authData, shortName, pd );
}

async function updatePEQPSub( authData, peqId, projSub ) {
    console.log( authData.who, "Updating PEQ project sub", projSub.toString() );

    let shortName = "UpdatePEQ";

    let postData = {};
    postData.PEQId          = peqId.toString();
    postData.HostProjectSub = projSub;

    console.log( authData.who, "psub", postData );
    
    let pd = { "Endpoint": shortName, "pLink": postData }; 
    return await wrappedPostAWS( authData, shortName, pd );
}

// Note: Only called by resolve.  PNP rejects all attempts to create in ACCR before calling resolve.
// The only critical component here for interleaving is getting the ID.
async function changeReportPEQVal( authData, pd, peqVal, link ) {
    console.log( authData.who, "rebuild existing peq for issue:", pd.issueId, "to", peqVal );

    // Confirm call chain is as expected.  Do NOT want to be modifying ACCR peq vals
    assert( link.hostColumnName != config.PROJ_COLS[config.PROJ_ACCR] );

    let newPEQ = await getPEQ( authData, pd.ceProjectId, pd.issueId );

    // do NOT update aws.. rely on ceFlutter to update values during ingest, using pact.  otherwise, when a split happens after
    // the initial peq has been ingested, if ingest is ignoring this pact, new value will not be picked up correctly.

    recordPEQAction( authData, config.EMPTY, pd,
		     config.PACTVERB_CONF, config.PACTACT_CHAN, [newPEQ.PEQId, peqVal.toString()], config.PACTNOTE_PVU,
		     utils.getToday() );
}

async function recordPEQ( authData, postData ) {
    assert( postData.CEProjectId !== 'undefined' );
    if( !postData.hasOwnProperty( "silent" )) {
	console.log( authData.who, "Recording PEQ", postData.PeqType, postData.Amount, "PEQs for", postData.HostIssueTitle, postData.HostProjectSub );
    }

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
    postData.CEProjectId    = oldPeq.CEProjectId;
    postData.HostHolderId   = oldPeq.HostHolderId;
    postData.PeqType        = oldPeq.PeqType;
    postData.Amount         = oldPeq.Amount;
    postData.HostRepoId     = oldPeq.HostRepoId;
    postData.HostProjectSub = [ link.hostProjectName, link.hostColumnName ];
    postData.HostIssueId    = link.hostIssueId;
    postData.HostIssueTitle = link.hostIssueName;
    postData.Active         = "true";

    // No.  No special cases, otherwise flat project handling makes things tricky in a useless way.
    // if( config.PROJ_COLS.includes( link.hostColumnName ) ) { postData.HostProjectSub = [ link.hostProjectName ]; }
    
    newPEQId = await recordPEQ(	authData, postData );
    assert( newPEQId != -1 );
    return newPEQId; 
}

// There is a rare race condition that can cause recordPEQData to fail.
//   label issue.  calls PNP, but does not await.  (PNP will create PEQ, eventually)
//   create card.  calls PNP, which calls recordPEQData, which checks for unclaimed:relocate and existence of PEQ.  
// await in label does not solve it 100%.   Having bad dependent peq recordings in aws may hurt later.
// Settlewait.. this has shown up once in... hundreds of runs of the full test suite?
// not, dup check could occur in lambda handler, save a round trip
// NOTE PNP sets hostAssignees based on call to host.  This means we MAY have assignees, or not, upon first
//      creation of AWS PEQ, depending on if assignment occured in host before peq label notification processing completes.
async function recordPEQData( authData, pd, checkDup, specials ) {
    assert(typeof pd.ceProjectId !== 'undefined' );
    let pact      = typeof specials !== 'undefined' && specials.hasOwnProperty( "pact" )     ? specials.pact     : -1;
    let columnId  = typeof specials !== 'undefined' && specials.hasOwnProperty( "columnId" ) ? specials.columnId : -1;
    let propose   = typeof specials !== 'undefined' && specials.hasOwnProperty( "propose" )  ? specials.propose  : false;

    console.log( authData.who, "Recording peq data for", pd.issueName, specials, pact, columnId);

    assert( pact == -1 || pact == "addRelo" || pact == "justAdd" ); 
    let add       = pact == "addRelo" || pact == "justAdd";
    let relocate  = pact != "justAdd" && pact == "addRelo" ;
    
    let newPEQId = -1;
    let newPEQ = -1
    if( checkDup ) { 
	// Only 1 peq per issueId. Might be moving a card here
	newPEQ = await getPEQ( authData, pd.ceProjectId, pd.issueId, false );
	if( newPEQ != -1 ) { newPEQId = newPEQ.PEQId; }
    }
    
    let postData = {};
    postData.CEProjectId    = pd.ceProjectId;
    postData.PEQId          = newPEQId;
    postData.HostHolderId   = pd.assignees;   // list of hostUserIds assigned
    postData.PeqType        = pd.peqType;               
    postData.Amount         = pd.peqValue;              
    postData.HostProjectSub = pd.projSub;               
    postData.HostRepoId     = pd.repoId;         
    postData.HostIssueId    = pd.issueId.toString();
    postData.HostIssueTitle = pd.issueName;        
    postData.Active         = "true";

    console.log( authData.who, "Recording peq data for", pd.issueName, pd.projectId, pact, columnId, pd.assignees);	
    
    // Don't wait if already have Id
    // no need to wait
    if( add ) {
	if( newPEQId == -1 ) { newPEQId = await recordPEQ( authData, postData ); }
	else                 { recordPEQ( authData, postData ); }
	assert( newPEQId != -1 );

	recordPEQAction( authData, config.EMPTY, pd,
			 config.PACTVERB_CONF, config.PACTACT_ADD, [ newPEQId ], "",
			 utils.getToday() );
    }

    // Some actions require both add/relo.  see gh2.issueHandler
    if( relocate ) {
	assert( columnId != -1 );
	let subject = [ newPEQId, pd.projectId, columnId ];
	
	recordPEQAction( authData, config.EMPTY, pd, 
			 config.PACTVERB_CONF, config.PACTACT_RELO, subject, "", 
			 utils.getToday() );
    }

    // Some actions such as split do not issue a non-bot issue:closed.  if split into pend, send note
    if( propose ){
	recordPEQAction( authData, config.EMPTY, pd, 
			 config.PACTVERB_PROP, config.PACTACT_ACCR, [newPEQId], "", 
			 utils.getToday() );
    }
    return newPEQId;
}


// also allow actionNote, i.e. 'issue reopened, not full CE project layout, no related card moved"
async function recordPEQAction( authData, ceUID, pd, verb, action, subject, note, entryDate ) {
    pd.actorId = await pd.actorId;
    console.log( authData.who, "Recording PEQAction: ", verb, action, subject, note, pd.actor, pd.actorId, pd.ceProjectId );

    let shortName = "RecordPEQAction";

    let postData      = { "CEUID": ceUID, "HostUserId": pd.actorId, "CEProjectId": pd.ceProjectId };
    postData.Verb     = verb;
    postData.Action   = action;
    postData.Subject  = subject; 
    postData.Note     = note;
    postData.Date     = entryDate;
    postData.RawBody  = JSON.stringify( pd.reqBody );
    postData.Ingested  = "false";
    postData.Locked    = "false";
    postData.TimeStamp = JSON.stringify( Date.now() );

    let ppd = { "Endpoint": shortName, "newPAction": postData };
    return await wrappedPostAWS( authData, shortName, ppd );
}

async function checkPopulated( authData, ceProjId, repoId ) {
    // console.log( authData.who, "check populated: ", ceProjId, repoId );

    let shortName = "CheckHostPop";
    let postData = { "Endpoint": shortName, "CEProjectId": ceProjId, "RepoId": repoId };
    
    return await wrappedPostAWS( authData, shortName, postData );
}

async function setPopulated( authData, ceProjId ) {
    console.log( authData.who, "Set populated is GHC only.  Disabled.: ", ceProjId );
    assert( false );
}

async function rewritePAct( authData, postData ) {
    let shortName = "RecordPEQAction";

    let pd = { "Endpoint": shortName, "newPAction": postData };
    return await wrappedPostAWS( authData, shortName, pd );
}

// ONLY called from linkage:addLocs/removeLocs
// NOTE unlinked projects will not have ceProjectId
async function refreshLinkageSummary( authData, ceProjId, locData, gql = true ) {
    console.log( authData.who, "Refreshing linkage summary", ceProjId, locData.length );
    if( locData.length < 1 ) { return; }
    
    if( gql ) {
	for( var loc of locData ) {
            loc.active = "true";
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

// ONLY Called via linkage:addLocs 
async function updateLinkageSummary( authData, ceProjId, locs ) {
    console.log( authData.who, "Updating linkage summary", ceProjId, locs.length );

    let newLoc = {};
    newLoc.CEProjectId  = ceProjId;
    newLoc.LastMod      = utils.getToday();
    newLoc.Locs         = locs;

    let shortName = "UpdateLinkage"; 

    let pd = { "Endpoint": shortName, "newLoc": newLoc }; 
    return await wrappedPostAWS( authData, shortName, pd );
}

async function updateCEPHostParts( authData, ceProject ) {
    console.log( authData.who, "Updating hostparts" );

    // assert( typeof ceProject.ceVentureId !== 'undefined' && ceProject.ceVentureId != "" );
    let shortName = "UpdateCEP"; 

    let pd = { Endpoint: shortName, ceProject: ceProject }; 
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

async function getPEQs( authData, query ) {
    // console.log( "Get PEQs for a given repo:", query);

    let shortName = "GetEntries";
    let postData  = { "Endpoint": shortName, "tableName": "CEPEQs", "query": query };

    return await wrappedPostAWS( authData, shortName, postData );
}

async function getPEQsById( authData, peqIds ) {
    // console.log( "Get PEQs for a given repo:", query);

    let shortName = "GetPEQsById";
    let postData  = { "Endpoint": shortName, "PeqIds": peqIds };

    return await wrappedPostAWS( authData, shortName, postData );
}

async function getHostPEQProjects( authData, query ) {
    // console.log( "Get PEQy projects for ceProject:", query);

    let shortName = "GetHostProjects";
    let postData  = { "Endpoint": shortName, "query": query };

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



exports.getAPIPath   = getAPIPath;
exports.getCognito   = getCognito;
exports.getCEServer  = getCEServer;
exports.getStoredPAT = getStoredPAT;
exports.show         = show;

exports.validatePEQ        = validatePEQ;
exports.getProjectStatus   = getProjectStatus;
exports.getPEQ             = getPEQ;
exports.removePEQ          = removePEQ;
exports.updatePEQPSub      = updatePEQPSub;
exports.changeReportPEQVal = changeReportPEQVal;
exports.recordPEQ          = recordPEQ;
exports.rebuildPEQ         = rebuildPEQ;
exports.recordPEQData      = recordPEQData;

exports.recordPEQAction = recordPEQAction;
exports.checkPopulated  = checkPopulated;
exports.setPopulated    = setPopulated;
exports.rewritePAct     = rewritePAct;

exports.refreshLinkageSummary = refreshLinkageSummary;
exports.updateLinkageSummary  = updateLinkageSummary;
exports.updateCEPHostParts    = updateCEPHostParts;

exports.getRaw       = getRaw; 
exports.getPRaws     = getPRaws;
exports.getPActs     = getPActs;
exports.getPEQs      = getPEQs;
exports.getPEQsById  = getPEQsById;
exports.getHostPEQProjects = getHostPEQProjects;
exports.getSummaries = getSummaries;
exports.getLinkage   = getLinkage;

exports.cleanDynamo   = cleanDynamo;
exports.clearIngested = clearIngested;

exports.getStoredLocs = getStoredLocs;    // TESTING ONLY
