var assert = require('assert');

const awsAuth        = require( '../awsAuth' );
const auth           = require( "../auth");
const config         = require('../config');
const utils          = require( "../utils");
const testSaveDynamo = require( './testSaveDynamo' );
const testData       = require( './testData' );
var links            = require('../components/linkage.js');

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
    let success = await utils.clearIngested( authData, { "GHRepo": td.GHFullName });
}

async function clearSummary( authData, td ) {
    const sums = await utils.getSummaries( authData, { "GHRepo": td.GHFullName });
    if( sums != -1 ) {
	const sumIds = sums.map( summary => [summary.PEQSummaryId] );    
	console.log( "Clearing summaries for", sumIds );
	await utils.cleanDynamo( authData, "CEPEQSummary", sumIds );
    }
}


// Only load items for  TEST_OWNER, FLUTTER_TEST_REPO.  Need to work through dynamo storage format.
async function loadPEQ( authData, td ) {

    // First, remove.
    const oldPeqs = await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    if( oldPeqs != -1 ) {
	const opids = oldPeqs.map( peq => [peq.PEQId] );
	await utils.cleanDynamo( authData, "CEPEQs", opids );				   
    }
    
    let fname = baselineLoc + "dynamoCEPEQs_latest.json";
    const dataStr = getData( fname );
    const peqJson = JSON.parse( dataStr );
    console.log( "Reading", peqJson.CEPEQs.length.toString(), "PEQs from", fname );

    let peqCount = 0;
    var promises = [];
    for( var aput of peqJson.CEPEQs ) {
	// console.log( aput.toString() );
	const repo = aput.PutRequest.Item.GHRepo.S;
	const id   = aput.PutRequest.Item.PEQId.S;
	
	if( repo == td.GHFullName ) {
	    // console.log( "Loading", repo, id );
	    peqCount++;

	    let postData = {};
	    postData.PEQId        = id;
	    postData.GHRepo       = repo;
	    
	    postData.PeqType      = aput.PutRequest.Item.PeqType.S;
	    postData.GHProjectId  = aput.PutRequest.Item.GHProjectId.S;
	    postData.GHIssueId    = aput.PutRequest.Item.GHIssueId.S;
	    postData.GHIssueTitle = aput.PutRequest.Item.GHIssueTitle.S;
	    postData.Active       = aput.PutRequest.Item.Active.S;
	    postData.AccrualDate  = aput.PutRequest.Item.AccrualDate.S;
	    postData.CEGrantorId  = aput.PutRequest.Item.CEGrantorId.S;
	    
	    postData.Amount       = parseInt( aput.PutRequest.Item.Amount.N );
	    postData.VestedPerc   = parseInt( aput.PutRequest.Item.VestedPerc.N );            // XXX ??? parseFloat?

	    postData.GHHolderId   = aput.PutRequest.Item.GHHolderId.L.map( elt => elt.S )
	    postData.CEHolderId   = aput.PutRequest.Item.CEHolderId.L.map( elt => elt.S )
	    postData.GHProjectSub = aput.PutRequest.Item.GHProjectSub.L.map( elt => elt.S )

	    postData.silent       = "true";
	    postData.skipLock     = "true";
	    
	    // managed by lambda handler, alone.
	    // postData.LockId       = aput.PutRequest.Item.LockId.S;   
	    
	    promises.push( utils.recordPEQ( authData, postData ) );
	}
    }
    console.log( "Inserting ", peqCount.toString(), "peqs." );
    await Promise.all( promises );    
}


async function loadPAct( authData, td ) {

    // First, remove.
    const oldPacts = await utils.getPActs( authData, { "GHRepo": td.GHFullName });
    if( oldPacts != -1 ) {
	const opids = oldPacts.map( pact => [pact.PEQActionId] );
	await utils.cleanDynamo( authData, "CEPEQActions", opids );				   
    }
    
    // NOTE!  PActRaw doesn't change - no need to overwrite.
    let fname = baselineLoc + "dynamoCEPEQActions_latest.json";

    const dataStr  = getData( fname );
    const pactJson = JSON.parse( dataStr );
    console.log( "Reading", pactJson.CEPEQActions.length.toString(), "PActs from", fname );

    var praw = {};
    var loadRaw = false;
    /*
    // Set to true to load CEPEQRaw.  Requires mod in aws dynamo as well.
    if( loadRaw ) {
	// PEQRawId == PEQActionId
	// Slower approach when data is small, but more scalable.
	var pactIds  = [];
	let rname      = baselineLoc + "dynamoCEPEQRaw_latest.json";
	const rawStr   = getData( rname );
	const rawJson  = JSON.parse( rawStr );
	for( var aput of pactJson.CEPEQActions ) {
	    const repo = aput.PutRequest.Item.GHRepo.S;
	    const id   = aput.PutRequest.Item.PEQActionId.S;
	    
	    if( repo == td.GHFullName ) { pactIds.push( id ); }
	}
	
	// Skip other repos
	for( var araw of rawJson.CEPEQRaw ) {
	    const pid = araw.PutRequest.Item.PEQRawId.S;
	    if( pactIds.includes( pid  )) {
		console.log( "put", pid );
		praw[pid] = araw.PutRequest.Item.RawBody.S;
	    }
	    // else { console.log( "FAIL PUT", pid ); }
	}
    }
    */

    let pactCount = 0;
    var promises = [];
    for( var aput of pactJson.CEPEQActions ) {
	const repo = aput.PutRequest.Item.GHRepo.S;
	const id   = aput.PutRequest.Item.PEQActionId.S;
	
	if( repo == td.GHFullName ) {
	    pactCount++;
	    if( loadRaw ) {
		assert( praw.hasOwnProperty( id ) );
		console.log( "Loading", repo, id, praw[id].length.toString());
	    }

	    let postData = {};
	    postData.PEQActionId  = id;
	    postData.GHRepo       = repo;

	    postData.Note       = aput.PutRequest.Item.Note.S;
	    postData.CEUID      = aput.PutRequest.Item.CEUID.S;
	    postData.Action     = aput.PutRequest.Item.Action.S;
	    postData.GHUserName = aput.PutRequest.Item.GHUserName.S;
	    postData.Ingested   = aput.PutRequest.Item.Ingested.S;
	    postData.TimeStamp  = aput.PutRequest.Item.TimeStamp.S;
	    postData.Verb       = aput.PutRequest.Item.Verb.S;
	    postData.Date       = aput.PutRequest.Item.EntryDate.S;
	    postData.Locked     = aput.PutRequest.Item.Locked.S;

	    postData.RawBody    = loadRaw ? praw[id] : "";
	    
	    postData.Subject   = aput.PutRequest.Item.Subject.L.map( elt => elt.S )
	    
	    promises.push( utils.rewritePAct( authData, postData ) );
	}
    }
    console.log( "Inserting ", pactCount.toString(), "pacts." );
    await Promise.all( promises );    

}

async function loadLinkage( authData, td ) {

    // First, remove.  In this case, not ghLinks, but stored aws.
    utils.clearLinkage( authData, td );

    // Next, load, ingest stored
    let fname      = baselineLoc + "dynamoCELinkage_latest.json";
    const dataStr  = getData( fname );
    const linkJson = JSON.parse( dataStr );
    console.log( "Reading", linkJson.CELinkage.length.toString(), "Linkages from", fname );

    for( let repoNum = 0; repoNum < linkJson.length; repoNum++ ) {
	let locSummary = linkJson[repoNum].PutRequest.Item;
	let repo    = locSummary.GHRepo.S;

	if( repo == td.GHFullName ) {
	    let locs    = locSummary.Locations.L;
	    let ghLinks = new links.Linkage();
	    for( let i = 0; i < locs.length; i++  ) {
		let loc = locs[i].M;
		
		if( i == locs.length - 1 ) {
		    ghLinks.addLoc( authData, repo, loc.GHProjectName.S, loc.GHProjectId.S, loc.GHColumnName.S, loc.GHColumnId.S, loc.Active.S, false);
		}
		else {
		    ghLinks.addLoc( authData, repo, loc.GHProjectName.S, loc.GHProjectId.S, loc.GHColumnName.S, loc.GHColumnId.S, loc.Active.S, true);
		}
	    }
	}
    }
    console.log( "Inserted fresh linkage " );
}



async function runTests() {
    console.log( "Clean and recreate ceFlutter testing environment in AWS" );

    // TEST_REPO auth
    let td          = new testData.TestData();
    td.GHOwner      = config.TEST_OWNER;
    td.GHRepo       = config.FLUTTER_TEST_REPO;
    td.GHFullName   = td.GHOwner + "/" + td.GHRepo;

    let authData = {};
    authData.who = "<TEST: Main> ";
    authData.ic  = await auth.getInstallationClient( td.GHOwner, td.GHRepo, td.GHOwner );
    authData.api = utils.getAPIPath() + "/find";
    authData.cog = await awsAuth.getCogIDToken();
    authData.pat = await auth.getPAT( td.GHOwner );

    let promises = [];
    promises.push( clearIngested( authData, td ));
    promises.push( clearSummary(  authData, td ));
    await Promise.all( promises );

    /* 
    // No longer needed.. 
    // make true to generate new baseline data.
    if( false ) {
	subTest = await testSaveDynamo.runTests( );
	console.log( "\n\nSave Dynamo complete" );
	await utils.sleep( 1000 );
	let cmd = "./tests/flutterTestData/baselineData/create.sh";
	execSync( cmd, { encoding: 'utf-8' });
    }
    */
	
    // Can't just overwrite, new operations will be in aws and be processed.
    await loadPEQ(  authData, td );

    // PActs are modified (CEUID), so clean these.  Raw is not modded.
    await loadPAct( authData, td );

    // Load Linkage.  This means if last generate run failed, linkage table will be out of date with GH, 
    // but in synch with loaded PEQ/PAct.  Ingest requires linkage.
    await loadLinkage( authData, td );
}


// npm run cleanLoad
runTests();
