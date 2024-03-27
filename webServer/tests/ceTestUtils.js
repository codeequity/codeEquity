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

async function showCallCounts( full ) {
    let postData = {"Endpoint": "Testing", "Request": "showCallCounts", "full": full };
    // not need to await
    utils.postCE( "testHandler", JSON.stringify( postData ));
    return true;
}

// Get everything from ceServer
async function getLinks( authData, testLinks, query ) {
    let postData = {"Endpoint": "Testing", "Request": "getLinks" };
    let linkData = await utils.postCE( "testHandler", JSON.stringify( postData ));
    testLinks.fromJson( authData, linkData );
    return testLinks.getLinks( authData, query );
}

async function getLocs( authData, testLinks, query ) {
    let postData = {"Endpoint": "Testing", "Request": "getLocs" };
    let locData = await utils.postCE( "testHandler", JSON.stringify( postData ));
    testLinks.fromJsonLocs( locData );
    // testLinks.showLocs();
    return testLinks.getLocs( authData, query );
}

async function getNotices() {
    let postData = {"Endpoint": "Testing", "Request": "getNotices" };
    return await utils.postCE( "testHandler", JSON.stringify( postData ));
}

async function findNotice( query ) {
    let notes = await getNotices();
    CE_Notes.fromJson( notes );
    console.log( "NOTICES.  Looking for", query );
    if( CETestDelayCounts["findNotice"] > 3 ) { CE_Notes.show(); }
    return CE_Notes.find( query );
}

// Purge repo's links n locs from ceServer
async function remLinks( authData, testLinks, ceProjId, hostRepoId ) {
    let postData = {"Endpoint": "Testing", "Request": "purgeLinks", "CEProjectId": ceProjId, "HostRepoId": hostRepoId };
    let res = await utils.postCE( "testHandler", JSON.stringify( postData ));
    return res;
}

// Purge ceJobs from ceServer
async function purgeJobs( repo ) {
    let postData = {"Endpoint": "Testing", "Request": "purgeJobs" }; 
    let res = await utils.postCE( "testHandler", JSON.stringify( postData ));
    return res;
}

// Some hosts don't notify link/unlink project.  Update ceServer internal state as push from testHandler.
async function linkProject( authData, ceProjId, pid, rNodeId, rName ) {
    let auth = {"pat": authData.pat, "who": authData.who, "api": authData.api, "cog": authData.cog };
    let postData = {"Endpoint": "Testing", "Request": "linkProject", "ceProjId": ceProjId, "pid": pid, "rNodeId": rNodeId, "rName": rName, "auth": auth }; 
    let res = await utils.postCE( "testHandler", JSON.stringify( postData ));
    return res;
}

// Some hosts don't notify link/unlink project.  Update ceServer internal state as push from testHandler.
async function unlinkProject( authData, ceProjId, pid, rNodeId ) {
    let auth = {"pat": authData.pat, "who": authData.who, "api": authData.api, "cog": authData.cog };
    let postData = {"Endpoint": "Testing", "Request": "unlinkProject", "ceProjId": ceProjId, "pid": pid, "rNodeId": rNodeId, "auth": auth }; 
    let res = await utils.postCE( "testHandler", JSON.stringify( postData ));
    return res;
}

async function linkRepo( authData, ceProjId, rNodeId, rName, cepDetails ) {
    let auth = {"pat": authData.pat, "who": authData.who, "api": authData.api, "cog": authData.cog };
    let postData = {"Endpoint": "Testing", "Request": "linkRepo", "ceProjId": ceProjId, "rNodeId": rNodeId, "rName": rName, "auth": auth, "cepDetails": cepDetails }; 
    let res = await utils.postCE( "testHandler", JSON.stringify( postData ));
    return res;
}

async function unlinkRepo( authData, ceProjId, rNodeId ) {
    let auth = {"pat": authData.pat, "who": authData.who, "api": authData.api, "cog": authData.cog };
    let postData = {"Endpoint": "Testing", "Request": "unlinkRepo", "ceProjId": ceProjId, "rNodeId": rNodeId, "auth": auth }; 
    let res = await utils.postCE( "testHandler", JSON.stringify( postData ));
    return res;
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
async function confirmProject( authData, testLinks, ceProjId, fullName, pid ) {
    // console.log( "Confirm Proj", ceProjId, fullName, pid );
    let locs = await getLocs( authData, testLinks, { ceProjId: ceProjId, repo: fullName, pid: pid } );
    return locs != -1; 
}

async function confirmColumn( authData, testLinks, ceProjId, pid, colId ) {
    let locs = await getLocs( authData, testLinks, { ceProjId: ceProjId, pid: pid, colId: colId } );
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
	testStatus[2].push( msg + ": " + lhs + " " + rhs );
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
    if( CETestDelayCounts[fname] > 1 ) { console.log( "XXX Settle Time", CETestDelayCounts[fname] ); }
    let waitVal = CETestDelayCounts[fname] < 3 ? (CETestDelayCounts[fname]+1) * 500 : 3000 + CETestDelayCounts[fname] * 1000;
    await utils.sleep( waitVal );
    CETestDelayCounts[fname]++;
    return CETestDelayCounts[fname] < CE_DELAY_MAX;
}

// Let host, ceServer settle , try again
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

	if( CETestDelayCounts[func.name] > 3 ) {
	    console.log( "SWV:", params.slice(1) );  // don't print authData
	    // console.log( params[1].locs.CE_ServTest_usda23k425 ); 
	}  
    }
    CETestDelayCounts[func.name] = 0;
    return retVal;
}


exports.MIN_DELAY        = MIN_DELAY;

// Generic utils
exports.shuffle          = shuffle;    

// Communicate with ceServer, aws
exports.showCallCounts   = showCallCounts;
exports.getLinks         = getLinks;
exports.getLocs          = getLocs;
exports.findNotice       = findNotice;
exports.remLinks         = remLinks;
exports.purgeJobs        = purgeJobs;
exports.linkProject      = linkProject;
exports.unlinkProject    = unlinkProject;
exports.linkRepo         = linkRepo;
exports.unlinkRepo       = unlinkRepo;

// minor testing utils
exports.hasRaw           = hasRaw; 
exports.buildIssueMap    = buildIssueMap;
exports.makeTitleReducer = makeTitleReducer;
exports.confirmProject   = confirmProject;
exports.confirmColumn    = confirmColumn;

// Core testing 
exports.checkEq         = checkEq;
exports.checkNEq        = checkNEq;
exports.checkGE         = checkGE;
exports.checkLE         = checkLE;
exports.checkAr         = checkAr;
exports.testReport      = testReport;
exports.mergeTests      = mergeTests;
exports.settle          = settle;
exports.settleWithVal   = settleWithVal;

