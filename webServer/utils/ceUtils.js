const fetch  = require( 'node-fetch' );
const assert = require('assert');

const config = require( '../config');


// UNIT TESTING ONLY!!
// Ugly ugly hack to test error handler.  Turn this off for normal runs.
const TEST_EH     = true;
const TEST_EH_PCT = .05;

// UNIT TESTING ONLY!!
// internal server error testing
const FAKE_ISE = {  
    status: 500,
    body: JSON.stringify( "---" ),
};

// UNIT TESTING ONLY!!
async function failHere( source ) {
    console.log( "Error.  Fake internal server error for", source );
    assert( false );
}




async function postCE( shortName, postData ) {
    const ceServerTestingURL = config.TESTING_ENDPOINT;

    const params = {
	url: ceServerTestingURL,
	method: "POST",
	headers: {'Content-Type': 'application/json' },
	body: postData
    };

    let ret = await fetch( ceServerTestingURL, params )
	.catch( err => console.log( err ));

    if( ret['status'] == 201 ) { 
	let body = await ret.json();
	return body;
    }
    else { return -1; }
}
    

// This needs to occur after linkage is overwritten.
// Provide good subs no matter if using Master project indirection, or flat projects.
async function getProjectSubs( authData, ghLinks, ceProjId, repoName, projName, colName ) {
    let projSub = [ "Unallocated" ];  // Should not occur.

    console.log( authData.who, "Set up proj subs", repoName, projName, colName );
	
    if( projName == config.MAIN_PROJ ) { projSub = [ colName ]; }
    else {
	// Check if project is a card in Master
	let links = ghLinks.getLinks( authData, {"ceProjId": ceProjId, "repo": repoName, "projName": config.MAIN_PROJ, "issueTitle": projName} );
	if( links != -1 ) { projSub = [ links[0]['HostColumnName'], projName ]; }
	else              { projSub = [ projName ]; }

	// No, induces too many special cases, with no return.
	// If col isn't a CE organizational col, add to psub
	// if( ! config.PROJ_COLS.includes( colName ) ) { projSub.push( colName ); }
	projSub.push( colName ); 
    }
	    
    // console.log( "... returning", projSub.toString() );
    return projSub;
}


function sleep(ms) {
    if( ms >= 1000 ) { console.log( "Sleeping for", ms / 1000, "seconds" ); }
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getMillis( byHour ) {
    var millis = new Date();

    var hh = String(millis.getHours()).padStart(2, '0');
    var mm = String(millis.getMinutes()).padStart(2, '0');
    var ss = String(millis.getSeconds()).padStart(2, '0');
    var ii = String(millis.getMilliseconds());
    
    // millis = hh + '.' + mm + '.' + ss + '.' + ii;
    if( typeof byHour !== 'undefined' && byHour ) {  millis = hh; }
    else                                          {  millis = mm + '.' + ss + '.' + ii; }

    return millis.toString();
}

function millisDiff( mNew, mOld) {

    var mmNew = parseInt( mNew.substr(0,2) );
    var ssNew = parseInt( mNew.substr(3,2) );
    var iiNew = parseInt( mNew.substr(6,2) );

    var mmOld = parseInt( mOld.substr(0,2) );
    var ssOld = parseInt( mOld.substr(3,2) );
    var iiOld = parseInt( mOld.substr(6,2) );

    if( mmNew < mmOld ) { mmNew += 60; }  // rollover
    const millis = iiNew - iiOld + 1000 * (ssNew - ssOld) + 60 * 1000 * (mmNew - mmOld );

    return millis;
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






// Use this sparingly, if at all!!
async function settleWithVal( fname, func, ...params ) {
    let delayCount = 1;

    let retVal = await func( ...params );
    while( (typeof retVal === 'undefined' || retVal == -1 ) && delayCount < config.MAX_DELAYS) {
	console.log( "WARNING", fname, delayCount, "Spin wait.  Should this happen with any frequency, increase the instance stats, and add a thread pool." );
	await sleep( config.STEP_COST );
	retVal = await func( ...params );
	delayCount++;
    }
    return retVal;
}





/* Not in use
function makeStamp( newStamp ) {
    // newstamp: "2020-12-23T20:55:27Z"
    assert( newStamp.length >= 20 );
    const h = parseInt( newStamp.substr(11,2) );
    const m = parseInt( newStamp.substr(14,2) );
    const s = parseInt( newStamp.substr(17,2) );

    return h * 3600 + m * 60 + s;
}
*/

/* Not in use
// UNIT TESTING ONLY!!
// Ingesting is a ceFlutter operation. 
async function ingestPActs( authData, pactIds ) {
    console.log( authData.who, "ingesting pacts TESTING ONLY", pactIds );

    let shortName = "UpdatePAct";
    let pd = { "Endpoint": shortName, "PactIds": pactIds }; 
    return await wrappedPostAWS( authData, shortName, pd );
}
*/



exports.randAlpha     = randAlpha;
exports.postCE        = postCE;
exports.sleep         = sleep;
exports.getMillis     = getMillis;
exports.millisDiff    = millisDiff;
exports.getToday      = getToday;
exports.settleWithVal = settleWithVal;

// TESTING ONLY
exports.TEST_EH       = TEST_EH;          // TESTING ONLY
exports.TEST_EH_PCT   = TEST_EH_PCT;      // TESTING ONLY
exports.FAKE_ISE      = FAKE_ISE;         // TESTING ONLY
exports.failHere      = failHere;         // TESTING ONLY
