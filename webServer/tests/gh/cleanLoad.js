var assert = require( 'assert' );

const awsAuth        = require( '../../auth/aws/awsAuth' );
const auth           = require( '../../auth/gh/ghAuth' );
const config         = require( '../../config' );

const utils    = require( '../../utils/ceUtils' );
const awsUtils = require( '../../utils/awsUtils' );
const links    = require( '../../utils/linkage.js' );

const testData  = require( './testData' );
const authDataC = require( '../../auth/authData' );

var   fs       = require('fs'), json;
const execSync = require('child_process').execSync;

const baselineLoc = "./tests/flutterTestData/";

function getData( fname ) {
    try {
	var data = fs.readFileSync(fname, 'utf8');
	return data;
    } catch(e) {
	console.log('Error:', e.stack);
    }
}

async function clearIngested( authData, td ) {
    let success = await awsUtils.clearIngested( authData, { "CEProjectId": td.ceProjectId });
}

async function clearSummary( authData, td ) {
    const sums = await awsUtils.getSummaries( authData, { "PEQSummaryId": td.ceProjectId });
    if( sums != -1 ) {
	const sumIds = sums.map( summary => [summary.PEQSummaryId] );    
	console.log( "Clearing summaries for", sumIds );
	await awsUtils.cleanDynamo( authData, "CEPEQSummary", sumIds );
    }
}


// Only load items for  TEST_ACTOR, FLUTTER_TEST_REPO.  Need to work through dynamo storage format.
async function loadPEQ( authData, td ) {

    // First, remove.
    const oldPeqs = await awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId } );
    if( oldPeqs != -1 ) {
	const opids = oldPeqs.map( peq => [peq.PEQId] );
	await awsUtils.cleanDynamo( authData, "CEPEQs", opids );				   
    }
    
    let fname = baselineLoc + "dynamoCEPEQs_latest.json";
    const dataStr = getData( fname );
    const peqJson = JSON.parse( dataStr );
    console.log( "Reading", peqJson.CEPEQs.length.toString(), "PEQs from", fname );

    let peqCount = 0;
    var promises = [];
    for( var aput of peqJson.CEPEQs ) {
	// console.log( aput.toString() );
	const ceProjId = aput.PutRequest.Item.CEProjectId.S;
	const id       = aput.PutRequest.Item.PEQId.S;
	
	if( ceProjId == td.ceProjectId ) {
	    // console.log( "Loading", ceProjId, id );
	    peqCount++;

	    let postData = {};
	    postData.PEQId        = id;
	    postData.CEProjectId  = aput.PutRequest.Item.CEProjectId.S;
	    
	    postData.PeqType        = aput.PutRequest.Item.PeqType.S;
	    postData.HostRepoId     = aput.PutRequest.Item.HostRepoId.S;
	    postData.HostIssueId    = aput.PutRequest.Item.HostIssueId.S;
	    postData.HostIssueTitle = aput.PutRequest.Item.HostIssueTitle.S;
	    postData.Active         = aput.PutRequest.Item.Active.S;
	    postData.AccrualDate    = aput.PutRequest.Item.AccrualDate.S;
	    postData.CEGrantorId    = aput.PutRequest.Item.CEGrantorId.S;
	    
	    postData.Amount       = parseInt( aput.PutRequest.Item.Amount.N );
	    postData.VestedPerc   = parseInt( aput.PutRequest.Item.VestedPerc.N );            // XXX ??? parseFloat?

	    postData.HostHolderId   = aput.PutRequest.Item.HostHolderId.L.map( elt => elt.S )
	    postData.CEHolderId     = aput.PutRequest.Item.CEHolderId.L.map( elt => elt.S )
	    postData.HostProjectSub = aput.PutRequest.Item.HostProjectSub.L.map( elt => elt.S )

	    postData.silent       = "true";
	    postData.skipLock     = "true";
	    
	    // managed by lambda handler, alone.
	    // postData.LockId       = aput.PutRequest.Item.LockId.S;   
	    
	    promises.push( awsUtils.recordPEQ( authData, postData ) );
	}
    }
    console.log( "Inserting ", peqCount.toString(), "peqs." );
    await Promise.all( promises );    
}


async function loadPAct( authData, td ) {

    // First, remove.
    const oldPacts = await awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    const oldPraws = await awsUtils.getPRaws( authData, { "CEProjectId": td.ceProjectId });
    if( oldPacts != -1 ) {
	const opids = oldPacts.map( pact => [pact.PEQActionId] );
	await awsUtils.cleanDynamo( authData, "CEPEQActions", opids );				   
    }
    if( oldPraws != -1 ) {
	const opids = oldPraws.map( praw => [praw.PEQRawId] );
	await awsUtils.cleanDynamo( authData, "CEPEQRaw", opids );				   
    }
    
    // NOTE!  PActRaw ids need to match PAct ids
    let fname = baselineLoc + "dynamoCEPEQActions_latest.json";

    const dataStr  = getData( fname );
    const pactJson = JSON.parse( dataStr );
    console.log( "Reading", pactJson.CEPEQActions.length.toString(), "PActs from", fname );

    var praw = {};
    var loadRaw = true;

    if( loadRaw ) {
	// PEQRawId == PEQActionId
	// Slower approach when data is small, but more scalable.
	var pactIds  = [];
	let rname      = baselineLoc + "dynamoCEPEQRaw_latest.json";
	const rawStr   = getData( rname );
	const rawJson  = JSON.parse( rawStr );
	for( var aput of pactJson.CEPEQActions ) {
	    const ceProjId = aput.PutRequest.Item.CEProjectId.S;
	    const id       = aput.PutRequest.Item.PEQActionId.S;
	    
	    if( ceProjId == td.ceProjectId ) { pactIds.push( id ); }
	}
	
	// Skip other ceProjects
	for( var araw of rawJson.CEPEQRaw ) {
	    const pid = araw.PutRequest.Item.PEQRawId.S;
	    if( pactIds.includes( pid  )) {
		console.log( "put", pid );
		praw[pid] = araw.PutRequest.Item.RawBody.S;
	    }
	    // else { console.log( "FAIL PUT", pid ); }
	}
    }

    let pactCount = 0;
    var promises = [];
    for( var aput of pactJson.CEPEQActions ) {
	const ceProjId = aput.PutRequest.Item.CEProjectId.S;
	const id       = aput.PutRequest.Item.PEQActionId.S;
	
	if( ceProjId == td.ceProjectId ) {
	    pactCount++;
	    if( loadRaw ) {
		assert( praw.hasOwnProperty( id ) );
		console.log( "Loading", ceProjId, id, praw[id].length.toString());
	    }

	    let postData = {};
	    postData.PEQActionId  = id;
	    postData.CEProjectId  = ceProjId;

	    // XXX Allow hostUserName for now in pact
	    let hun = "";
	    if( aput.PutRequest.Item.hasOwnProperty( "HostUserName" ) ) {
		hun = aput.PutRequest.Item.HostUserName.S;
	    }

	    postData.Note       = aput.PutRequest.Item.Note.S;
	    postData.CEUID      = aput.PutRequest.Item.CEUID.S;
	    postData.Action     = aput.PutRequest.Item.Action.S;
	    postData.HostUserName = hun;
	    postData.HostUserId = aput.PutRequest.Item.HostUserId.S;
	    postData.Ingested   = aput.PutRequest.Item.Ingested.S;
	    postData.TimeStamp  = aput.PutRequest.Item.TimeStamp.S;
	    postData.Verb       = aput.PutRequest.Item.Verb.S;
	    postData.Date       = aput.PutRequest.Item.EntryDate.S;
	    postData.Locked     = aput.PutRequest.Item.Locked.S;

	    postData.RawBody    = loadRaw ? praw[id] : "";
	    
	    postData.Subject   = aput.PutRequest.Item.Subject.L.map( elt => elt.S )
	    
	    promises.push( awsUtils.rewritePAct( authData, postData ) );
	}
    }
    console.log( "Inserting ", pactCount.toString(), "pacts." );
    await Promise.all( promises );    

}

async function loadLinkage( authData, td ) {

    // no need to remove, refresh overwrites

    // load, ingest stored
    let fname      = baselineLoc + "dynamoCELinkage_latest.json";
    const dataStr  = getData( fname );
    const linkJson = JSON.parse( dataStr );
    console.log( "Reading", linkJson.CELinkage.length.toString(), "Linkages from", fname );

    for( let ceProjNum = 0; ceProjNum < linkJson.CELinkage.length; ceProjNum++ ) {
	let locSummary = linkJson.CELinkage[ceProjNum].PutRequest.Item;
	let ceProjId   = locSummary.CEProjectId.S;
	
	if( ceProjId == td.ceProjectId ) {
	    let locs    = locSummary.Locations.L;
	    let ghLinks = new links.Linkage();
	    for( let i = 0; i < locs.length; i++  ) {
		let loc = locs[i].M;

		let nLoc = {};
		nLoc.ceProjectId     = loc.ceProjectId.S;
		nLoc.hostProjectId   = loc.hostProjectId.S;
		nLoc.hostProjectName = loc.hostProjectName.S;
		nLoc.hostColumnId    = loc.hostColumnId.S;
		nLoc.hostColumnName  = loc.hostColumnName.S;
		nLoc.hostUtility     = loc.hostUtility.S;
		nLoc.active          = loc.active.S;
		
		ghLinks.addLocs( authData, [nLoc], { pushAWS: false }); 
	    }

	    var locsL = ghLinks.getLocs( authData, { "ceProjId": ceProjId } );
	    await awsUtils.refreshLinkageSummary( authData, ceProjId, locsL, false ); 
	    break;
	}
    }
    console.log( "Inserted fresh linkage " );
}

// Just renewing hostparts
async function refreshCEProjects( authData, td ) {
    // no need to remove, refresh overwrites

    // load, ingest stored
    let fname      = baselineLoc + "dynamoCEProjects_latest.json";
    const dataStr  = getData( fname );
    const projJson = JSON.parse( dataStr );
    console.log( "Reading", projJson.CEProjects.length.toString(), "CEProjects from", fname );

    for( let ceProjNum = 0; ceProjNum < projJson.CEProjects.length; ceProjNum++ ) {
	let ceProj    = projJson.CEProjects[ceProjNum].PutRequest.Item;
	let ceProjId  = ceProj.CEProjectId.S;
	
	if( ceProjId == td.ceProjectId ) {
	    let updatedCEP = {};
	    updatedCEP.CEProjectId        = ceProjId;
	    updatedCEP.CEProjectComponent = ceProj.CEProjectComponent.S;
	    updatedCEP.OwnerCategory      = ceProj.OwnerCategory.S;
	    updatedCEP.HostPlatform       = ceProj.HostPlatform.S;
	    updatedCEP.Organization       = ceProj.Organization.S;
	    updatedCEP.ProjectMgmtSys     = ceProj.ProjectMgmtSys.S;
	    updatedCEP.Description        = ceProj.Description.S;
	    
	    if( utils.validField( ceProj, "HostParts" )) {
		let repos = ceProj.HostParts.M.hostRepositories.L;
		let hostRepositories = [];
		for( let i = 0; i < repos.length; i++  ) {
		    let repo = repos[i].M;
		    
		    let nRepo = {};
		    nRepo.repoId     = repo.repoId.S;
		    nRepo.repoName   = repo.repoName.S;
		    hostRepositories.push( nRepo );
		}
		updatedCEP.HostParts = {};
		updatedCEP.HostParts.hostRepositories = hostRepositories;
	    }
	    await awsUtils.updateCEPHostParts( authData, updatedCEP );
	    
	    console.log( "Refreshed CEProjects entry" );
	    break;
	}
    }
}



async function runTests() {
    console.log( "Clean and recreate ceFlutter testing environment in AWS" );

    // TEST_REPO auth
    let td          = new testData.TestData();

    td.ghOwner      = config.TEST_OWNER;
    td.actor        = config.TEST_ACTOR;
    td.ceProjectId  = config.FLUTTER_TEST_CEPID;
    td.ghRepo       = config.FLUTTER_TEST_REPO;
    td.ghFullName   = td.ghOwner + "/" + td.ghRepo;

    let authData     = new authDataC.AuthData();
    authData.who     = "<TEST: Main> ";
    // authData.ic      = await auth.getInstallationClient( td.actor, td.ghRepo, td.ghOwner );
    authData.api     = awsUtils.getAPIPath() + "/find";
    authData.cog     = await awsAuth.getCogIDToken();
    authData.cogLast = Date.now();        
    authData.pat     = await auth.getPAT( td.actor );

    let promises = [];
    promises.push( clearIngested( authData, td ));

    promises.push( clearSummary(  authData, td ));
    await Promise.all( promises );

    // Can't just overwrite, new operations will be in aws and be processed.
    await loadPEQ(  authData, td );

    // PActs are modified (CEUID), so clean these.  Raw is not modded.
    await loadPAct( authData, td );

    // Load Linkage.  This means if last generate run failed, linkage table will be out of date with GH, 
    // but in synch with loaded PEQ/PAct.  Ingest requires linkage.
    await loadLinkage( authData, td );

    // CEProject table for ce_flut can be in empty state
    await refreshCEProjects( authData, td );
}


// npm run cleanLoad
runTests();
