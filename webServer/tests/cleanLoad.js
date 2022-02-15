var assert = require('assert');

const awsAuth        = require( '../awsAuth' );
const auth           = require( "../auth");
const config         = require('../config');
const utils          = require( "../utils");
const testSaveDynamo = require( './testSaveDynamo' );
const testData       = require( './testData' );

var   fs       = require('fs'), json;
const execSync = require('child_process').execSync;

const baselineLoc = "./tests/testData/baselineData/";

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


// Only load items for  TEST_OWNER, TEST_REPO.  Need to work through dynamo storage format.
async function loadPEQ( authData, td ) {
    let fname = baselineLoc + "dynamoCEPEQs.json";

    const dataStr = getData( fname );
    const peqJson = JSON.parse( dataStr );
    console.log( "Loading", peqJson.CEPEQs.length.toString(), "PEQs from", fname );

    var promises = [];
    for( var aput of peqJson.CEPEQs ) {
	const repo = aput.PutRequest.Item.GHRepo.S;
	const id   = aput.PutRequest.Item.PEQId.S;
	
	if( repo == td.GHFullName ) {
	    // console.log( "Loading", repo, id );

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

	    // Testing, only
	    postData.Testing      = "true";
	    
	    // managed by lambda handler, alone.
	    // postData.LockId       = aput.PutRequest.Item.LockId.S;   

	    promises.push( utils.recordPEQ( authData, postData ) );
	}
    }
    await Promise.all( promises );    
}

async function loadPAct( authData, td ) {

    // NOTE!  PActRaw doesn't change - no need to overwrite.
    let fname = baselineLoc + "dynamoCEPEQActions.json";
    // let rname = baselineLoc + "dynamoCEPEQRaw.json";

    const dataStr  = getData( fname );
    // const rawStr   = getData( rname );
    const pactJson = JSON.parse( dataStr );
    // const rawJson  = JSON.parse( rawStr );
    console.log( "Loading", pactJson.CEPEQActions.length.toString(), "PActs from", fname );

    // PEQRawId == PEQActionId
    // Slower approach when data is small, but more scalable.
    /*
    var pactIds  = [];
    for( var aput of pactJson.CEPEQActions ) {
	const repo = aput.PutRequest.Item.GHRepo.S;
	const id   = aput.PutRequest.Item.PEQActionId.S;

	if( repo == td.GHFullName ) { pactIds.push( id ); }
    }

    var praw = {};
    for( var araw of rawJson.CEPEQRaw ) {
	const pid = araw.PutRequest.Item.PEQRawId.S;
	if( pactIds.includes( pid  )) { praw.pid = araw.PutRequest.Item.RawBody.S; }
    }
    */
    
    var promises = [];
    for( var aput of pactJson.CEPEQActions ) {
	const repo = aput.PutRequest.Item.GHRepo.S;
	const id   = aput.PutRequest.Item.PEQActionId.S;
	
	if( repo == td.GHFullName ) {
	    // console.log( "Loading", repo, id );

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

	    postData.RawBody    = "";
	    
	    postData.Subject   = aput.PutRequest.Item.Subject.L.map( elt => elt.S )
	    
	    promises.push( utils.rewritePAct( authData, postData ) );
	}
    }
    await Promise.all( promises );    
    
}



async function runTests() {
    console.log( "Clean and recreate ceFlutter testing environment in AWS" );

    // TEST_REPO auth
    let td          = new testData.TestData();
    td.GHOwner      = config.TEST_OWNER;
    td.GHRepo       = config.TEST_REPO;
    td.GHFullName   = td.GHOwner + "/" + td.GHRepo;

    let authData = {};
    authData.who = "<TEST: Main> ";
    authData.ic  = await auth.getInstallationClient( td.GHOwner, td.GHRepo, td.GHOwner );
    authData.api = utils.getAPIPath() + "/find";
    authData.cog = await awsAuth.getCogIDToken();
    authData.pat = await auth.getPAT( td.GHOwner );

    let promises = [];
    // promises.push( clearIngested( authData, td ));
    // promises.push( clearSummary(  authData, td ));
    await Promise.all( promises );

    // make true to generate new baseline data.
    if( false ) {
	subTest = await testSaveDynamo.runTests( );
	console.log( "\n\nSave Dynamo complete" );
	await utils.sleep( 1000 );
	let cmd = "./tests/testData/baselineData/create.sh";
	execSync( cmd, { encoding: 'utf-8' });
    }
	
    // Just overwrite.
    await loadPEQ(  authData, td );
    await loadPAct( authData, td ); 
}


// npm run cleanLoad
runTests();
