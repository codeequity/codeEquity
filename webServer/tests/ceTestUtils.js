const assert   = require( 'assert' );

const config   = require( '../config' );

const utils    = require( '../utils/ceUtils' );
const awsUtils = require( '../utils/awsUtils' );

const circBuff = require('../components/circBuff.js');

const MIN_DELAY       = 1800;     
const CE_DELAY_MAX    = 8;
var CETestDelayCounts = {};
var CE_Notes          = new circBuff.CircularBuffer( config.NOTICE_BUFFER_SIZE );


// Fisher-yates (knuth) https://github.com/coolaj86/knuth-shuffle
function shuffle(arr) {
    var temporaryValue, randomIndex;
    var currentIndex = arr.length;
    
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
	
	randomIndex = Math.floor(Math.random() * currentIndex);
	currentIndex -= 1;
	
	temporaryValue = arr[currentIndex];
	arr[currentIndex] = arr[randomIndex];
	arr[randomIndex] = temporaryValue;
    }
    
    return arr;
}

// Get everything from ceServer
async function getLinks( authData, ghLinks, query ) {
    let postData = {"Endpoint": "Testing", "Request": "getLinks" };
    let linkData = await utils.postCE( "testHandler", JSON.stringify( postData ));
    ghLinks.fromJson( authData, linkData );
    return ghLinks.getLinks( authData, query );
}

async function getLocs( authData, ghLinks, query ) {
    let postData = {"Endpoint": "Testing", "Request": "getLocs" };
    let locData = await utils.postCE( "testHandler", JSON.stringify( postData ));
    ghLinks.fromJsonLocs( locData );
    return ghLinks.getLocs( authData, query );
}

async function getNotices() {
    let postData = {"Endpoint": "Testing", "Request": "getNotices" };
    return await utils.postCE( "testHandler", JSON.stringify( postData ));
}

async function findNotice( query ) {
    let notes = await getNotices();
    CE_Notes.fromJson( notes );
    // console.log( "NOTICES.  Looking for", query, notes, CE_Notes );
    console.log( "NOTICES.  Looking for", query );
    CE_Notes.show();
    // if( Math.random() < .05 ) { console.log(""); CE_Notes.show(); console.log(""); }
    return CE_Notes.find( query );
}

// Purge repo's links n locs from ceServer
async function remLinks( authData, ghLinks, repo ) {
    let postData = {"Endpoint": "Testing", "Request": "purgeLinks", "Repo": repo };
    let res = await utils.postCE( "testHandler", JSON.stringify( postData ));
    return res;
}

// Purge ceJobs from ceServer
async function purgeJobs( repo ) {
    let postData = {"Endpoint": "Testing", "Request": "purgeJobs" }; 
    let res = await utils.postCE( "testHandler", JSON.stringify( postData ));
    return res;
}

// XXX XXX
async function setUnpopulated( authData, td ) {
    // XXX erm.. no more repo here
    console.log( "Error.  repo no longer stored with ceProjects" );
    assert( false ); 
    let status = await awsUtils.getProjectStatus( authData, td.ceProjectId );
    let statusIds = status == -1 ? [] : [ [status.GHRepo] ];
    console.log( "Dynamo status id", statusIds );
    await awsUtils.cleanDynamo( authData, "CERepoStatus", statusIds );
}


async function hasRaw( authData, pactId ) {
    let retVal = false;
    let praw = await awsUtils.getRaw( authData, pactId );
    if( praw != -1 ) { retVal = true; }
    return retVal;
}


// Build map from issue_num to issue
function buildIssueMap( issues ) {
    let m = {};
    for( const issue of issues ) {
	m[issue.number] = issue;
    }
    return m;
}

// does the array include aStr?
function makeTitleReducer( aStr ) {
    // return ( acc, cur ) => ( console.log( cur, acc, aStr) || acc || cur.includes( aStr ) ); 
    return ( accumulator, cur ) => ( accumulator || cur.includes( aStr ) ); 
}

// Can't just rely on host for confirmation.  Notification arrival to CE can be much slower, and in some cases we need
// CE local state to be updated or the pending operation will fail.  So, MUST expose showLocs, same as showLinks.
async function confirmProject( authData, ghLinks, ceProjId, fullName, projId ) {
    // console.log( "Confirm Proj", ceProjId, fullName, projId );
    let locs = await getLocs( authData, ghLinks, { ceProjId: ceProjId, repo: fullName, projId: projId } );
    // ghLinks.showLocs();
    // console.log( "query got", locs );
    return locs != -1; 
}

async function confirmColumn( authData, ghLinks, ceProjId, pNodeId, colId ) {
    let locs = await getLocs( authData, ghLinks, { ceProjId: ceProjId, projId: pNodeId, colId: colId } );
    return locs != -1; 
}



function checkEq( lhs, rhs, testStatus, msg ) {
    if( lhs == rhs ) {
	testStatus[0]++;
    }
    else {
	testStatus[1]++;
	testStatus[2].push( msg + ": " + lhs + " != " + rhs );
    }
    return testStatus;
}

function checkNEq( lhs, rhs, testStatus, msg ) {
    if( lhs != rhs ) {
	testStatus[0]++;
    }
    else {
	testStatus[1]++;
	testStatus[2].push( msg + ": " + lhs + " == " + rhs );
    }
    return testStatus;
}

function checkGE( lhs, rhs, testStatus, msg ) {
    if( lhs >= rhs ) {
	testStatus[0]++;
    }
    else {
	testStatus[1]++;
	testStatus[2].push( msg + ": " + lhs );
    }
    return testStatus;
}

function checkLE( lhs, rhs, testStatus, msg ) {
    return checkGE( rhs, lhs, testStatus, msg );
}

function checkAr( lhs, rhs, testStatus, msg ) {
    let test = true;
    if( lhs.length != rhs.length ) { test = false; }
    else {
	for( let i = 0; i < lhs.length; i++ ) {
	    if( lhs[i] != rhs[i] ) {
		test = false;
		break;
	    }
	}
    }
	
    if( test ) {
	testStatus[0]++;
    }
    else {
	testStatus[1]++;
	testStatus[2].push( msg + ": " + lhs );
    }
    return testStatus;
}

function testReport( testStatus, component ) {
    let count = testStatus[0] + testStatus[1];
    if( testStatus[1] == 0 ) { console.log( count, "Tests for", component, ".. All Passed." ); }
    else                     { console.log( count, "Tests results for", component, ".. failed test count:", testStatus[1] ); }

    for( const failure of testStatus[2] ) {
	console.log( "   failed test:", failure );
    }
    console.log( "" );
}

function mergeTests( t1, t2 ) {
    if( typeof t1 === 'undefined' ) { console.log( "t1 is undefined!" ); }
    if( typeof t2 === 'undefined' ) { console.log( "t2 is undefined!" ); }
    return [t1[0] + t2[0], t1[1] + t2[1], t1[2].concat( t2[2] ) ];
}

async function delayTimer( fname ) {
    // Settle for up to 30s (Total) before failing.  First few are quick.
    if( CETestDelayCounts[fname] > 0 ) { console.log( "XXX GH Settle Time", CETestDelayCounts[fname] ); }
    let waitVal = CETestDelayCounts[fname] < 3 ? (CETestDelayCounts[fname]+1) * 500 : 3000 + CETestDelayCounts[fname] * 1000;
    await utils.sleep( waitVal );
    CETestDelayCounts[fname]++;
    return CETestDelayCounts[fname] < CE_DELAY_MAX;
}

// Let GH and/or ceServer settle , try again
async function settle( subTest, testStatus, func, ...params ) {
    if( typeof testStatus === 'undefined' ) { console.log( "testStatus is undefined!" ); }
    if( typeof subTest    === 'undefined' ) { console.log( "subTest is undefined!" ); }

    if( !CETestDelayCounts.hasOwnProperty(func.name) ) { CETestDelayCounts[func.name] = 0; }
	
    if( subTest[1] > 0 && CETestDelayCounts[func.name] < CE_DELAY_MAX) {
	testReport( subTest, "Settle waiting.." );
	await delayTimer( func.name );
	return await func( ...params );
    }
    else { CETestDelayCounts[func.name] = 0; }
    testStatus = mergeTests( testStatus, subTest );
    return testStatus;
}

async function settleWithVal( fname, func, ...params ) {

    if( !CETestDelayCounts.hasOwnProperty(func.name) ) { CETestDelayCounts[func.name] = 0; }

    let retVal = await func( ...params );
    while( (typeof retVal === 'undefined' || retVal == false ) && CETestDelayCounts[func.name] < CE_DELAY_MAX) {
	console.log( "SettleVal waiting.. ", fname );
	await delayTimer( func.name );
	retVal = await func( ...params );

	if( CETestDelayCounts[func.name] > 2 ) { console.log( "SWV:", params.slice(1) ); }  // don't print authData
    }
    CETestDelayCounts[func.name] = 0;
    return retVal;
}


exports.MIN_DELAY        = MIN_DELAY;

// Generic utils
exports.shuffle          = shuffle;    

// Communicate with ceServer, aws
exports.getLinks         = getLinks;
exports.getLocs          = getLocs;
exports.findNotice       = findNotice;
exports.remLinks         = remLinks;
exports.purgeJobs        = purgeJobs;
exports.setUnpopulated   = setUnpopulated;

// minor testing utils
exports.hasRaw           = hasRaw; 
exports.buildIssueMap    = buildIssueMap;
exports.makeTitleReducer = makeTitleReducer;
exports.confirmProject   = confirmProject;
exports.confirmColumn    = confirmColumn;

// Core testing 
exports.checkEq         = checkEq;
exports.checkGE         = checkGE;
exports.checkLE         = checkLE;
exports.checkAr         = checkAr;
exports.testReport      = testReport;
exports.mergeTests      = mergeTests;
exports.settle          = settle;
exports.settleWithVal   = settleWithVal;

