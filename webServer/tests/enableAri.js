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

// NOTE: for flutter testing, only.
async function runTests() {
    console.log( "Make sure ariTester has exec role for testing" );

    let authData     = new authDataC();
    authData.who     = "<TEST: Flutter> ";
    authData.api     = awsUtils.getAPIPath() + "/find";
    authData.cog     = await awsAuth.getCogIDToken();

    await setCEVTestRoles( authData, config.FLUTTER_TEST_CEVID );
    await setCEVTestRoles( authData, config.FLUTTER_MULTI_TEST_CEVID );
    await setCEVTestRoles( authData, config.FLUTTER_CROSS_TEST_CEVID );
    await setCEVTestRoles( authData, config.FAIL_CROSS_TEST_CEVID );

}


export {setCEVTestRoles};
export {runTests};

// npm run enableAri
//runTests();
