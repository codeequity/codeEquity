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
    console.log( "Loading PEQs from", fname );

    const dataStr = getData( fname );
    const peqJson = JSON.parse( dataStr );

    var promises = [];
    for( var aput of peqJson.CEPEQs ) {
	const repo = aput.PutRequest.Item.GHRepo.S;
	const id   = aput.PutRequest.Item.PEQId.S;
	
	if( repo == td.GHFullName ) {
	    console.log( "Loading", repo, id );

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

	    // managed by lambda handler, alone.
	    // postData.LockId       = aput.PutRequest.Item.LockId.S;   

	    promises.push( utils.recordPEQ( authData, postData ) );
	}
    }
    await Promise.all( promises );    
}

async function loadPAct( authData, td ) {

    // PAct and PActRaw go together
    let fname = baselineLoc + "dynamoCEPEQActions.json";
    let rname = baselineLoc + "dynamoCEPEQRaw.json";
    console.log( "Loading PEQs from", fname, rname );

    const dataStr  = getData( fname );
    const rawStr   = getData( rname );
    const pactJson = JSON.parse( dataStr );
    const rawJson  = JSON.parse( rawStr );

    var promises = [];
    var pactIds  = [];
    for( var aput of pactJson.CEPEQActions ) {
	const repo = aput.PutRequest.Item.GHRepo.S;
	const id   = aput.PutRequest.Item.PEQActionId.S;

	pactIds.push( id );
	
	if( repo == td.GHFullName ) {
	    console.log( "Loading", repo, id );

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
	    postData.EntryDate  = aput.PutRequest.Item.EntryDate.S;

	    postData.Subject   = aput.PutRequest.Item.Subject.L.map( elt => elt.S )

	    // managed by lambda handler, alone.
	    // postData.LockId       = aput.PutRequest.Item.LockId.S;

	    // XXX Need raw as part of this

	    promises.push( utils.recordPEQ( authData, postData ) );
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
	
    promises = [];
    // Just overwrite.
    promises.push( loadPEQ(  authData, td ));
    promises.push( loadPAct( authData, td ));
    await Promise.all( promises );
}


// npm run cleanLoad
runTests();
