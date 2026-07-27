import assert from 'assert';

import * as awsAuth   from '../auth/aws/awsAuth.js';
import * as config    from '../config.js';

import * as awsUtils  from '../utils/awsUtils.js';
import authDataC      from '../auth/authData.js';

async function setCEVTestRoles( authData, cevId ) {
    // get CEV
    let cev = await awsUtils.getCEV( authData, cevId );

    // update roles for ari.. note this is a pure aws record
    if( typeof cev.Roles === 'undefined' ) {
	console.log( "Fail.  Roles not found" );
	assert( false );
    }
    
    console.log( "Current roles:" );
    Object.entries( cev.Roles ).forEach( ([k,v]) => console.log( "   ", k, v ) );
    let mod      = false;
    let foundAri = false;
    Object.entries( cev.Roles ).forEach( ([k,v]) => {
	if( k == "eaeIqcqqdp" ) { // XXX
	    foundAri = true;
	    if( v != "Executive" ) {
		v = "Executive";   // XXX
		mod = true;
	    }
	}
    });

    if( !foundAri ) {
	cev.Roles["eaeIqcqqdp"] = "Executive";
	mod = true;
    }

    // put cev
    if( mod ) {
	console.log( "New roles:" );
	Object.entries( cev.Roles ).forEach( ([k,v]) => console.log( "   ", k, v ) );
	await awsUtils.updateCEVenture( authData, cev ); 
    }
}

async function addCEHostProject( authData, actor, cepId ) {
    let actorCEUID = "eaeIqcqqdp";

    let hostUser = await awsUtils.getHostUser( authData, actorCEUID, config.HOST_GH );
    console.log( "Current host user:", hostUser );
    console.log( "Current CEPs:", hostUser.CEProjectIds );
    let mod      = false;
    if( !hostUser.CEProjectIds.includes( cepId ) ) {
	hostUser.CEProjectIds.push( cepId );
	mod = true;
    }

    // put it back
    if( mod ) {
	console.log( "updated CEPs:", hostUser.CEProjectIds );
	// Add fields needed by dynamo func... kinda dumb
	hostUser.hostUserId = hostUser.HostUserId;
	hostUser.ceUserId = hostUser.CEUserId;
	hostUser.hostUserName = hostUser.HostUserName;
	hostUser.hostPlatform = hostUser.HostPlatform;
	hostUser.ceProjectIds = hostUser.CEProjectIds;
	hostUser.futureCEProjects = hostUser.FutureCEProjects;
	await awsUtils.updateHostUser( authData, hostUser );
    }
    
}

// NOTE: for flutter testing, only.
// NOTE: do NOT add CodeEquity - testing should not touch that.
async function runTests() {
    console.log( "Make sure ariTester has exec role and CEPs for testing" );

    let authData     = new authDataC();
    authData.who     = "<TEST: Flutter> ";
    authData.api     = awsUtils.getAPIPath() + "/find";
    authData.cog     = await awsAuth.getCogIDToken();

    await setCEVTestRoles( authData, config.FLUTTER_TEST_CEVID );
    await setCEVTestRoles( authData, config.FLUTTER_MULTI_TEST_CEVID );
    await setCEVTestRoles( authData, config.FLUTTER_CROSS_TEST_CEVID );
    await setCEVTestRoles( authData, config.FAIL_CROSS_TEST_CEVID );
    await setCEVTestRoles( authData, config.TEST_CEVID );

    // Testing
    await addCEHostProject( authData, config.TEST_ACTOR, config.FLUTTER_TEST_CEPID );
    await addCEHostProject( authData, config.TEST_ACTOR, config.FLUTTER_MULTI_TEST_CEPID );
    await addCEHostProject( authData, config.TEST_ACTOR, config.FLUTTER_CROSS_TEST_CEPID );
    await addCEHostProject( authData, config.TEST_ACTOR, config.FAIL_CROSS_TEST_CEPID );

    // others
    await addCEHostProject( authData, config.TEST_ACTOR, config.TEST_CEPID );
    await addCEHostProject( authData, config.TEST_ACTOR, config.CROSS_TEST_CEPID );
    await addCEHostProject( authData, config.TEST_ACTOR, config.FLUTTER_CROSS_TEST_CEPID );
}


export {setCEVTestRoles};
export {runTests};

// npm run enableAri
//runTests();
