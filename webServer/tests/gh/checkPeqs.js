var assert = require( 'assert' );

const awsAuth        = require( '../../auth/aws/awsAuth' );
const auth           = require( '../../auth/gh/ghAuth' );
const config         = require( '../../config' );

const utils    = require( '../../utils/ceUtils' );
const awsUtils = require( '../../utils/awsUtils' );

const authDataC = require( '../../auth/authData' );

// Modules
const _p1 = { title: "Unallocated", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceHolderId: [], hostHolderId:[], ceGrantorId:"---",
              peqType: "allocation", amount: 1000000, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["Business Operations" ], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

const _p2 = { title: "Github Operations Flut", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceHolderId: [], hostHolderId:[], ceGrantorId:"---",
              peqType: "allocation", amount: 1500000, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["Software Contributions" ], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

// Data Sec
const _p3 = { title: "Snow melt", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"eaeIqcqqdp",
	      ceHolderId: ["yxsklawdpc", "eaeIqcqqdp"], hostHolderId:["U_kgDOBqJgmQ","U_kgDOBP2eEw"], 
              peqType: "grant", amount: 1000, accrualDate: -1, vestedPerc: 0,
              hostProjectSub:["Software Contributions", "Data Security Flut", "Accrued"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

const _p4 = { title: "AssignTest", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"eaeIqcqqdp",
	      ceHolderId: ["eaeIqcqqdp"], hostHolderId:["U_kgDOBP2eEw"], 
              peqType: "grant", amount: 1000, accrualDate: -1, vestedPerc: 0,
              hostProjectSub:["Software Contributions", "Data Security Flut", "Accrued"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

// XXXXXXXXXXXXXXX
const _p5 = { title: "IR Plan split", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"eaeIqcqqdp",
	      ceHolderId: ["eaeIqcqqdp"], hostHolderId:["U_kgDOBP2eEw"], 
              peqType: "grant", amount: 1000, accrualDate: -1, vestedPerc: 0,
              hostProjectSub:["Software Contributions", "Data Security Flut", "Accrued"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

const PEQS_GOLD = [ _p1, _p2, _p3, _p4, _p5 ];


function report( gp, ap ) {
    console.log( "ERROR.  Gold image does not match dynamo peq" );
    console.log( "title:", gp.title, ap.HostIssueTitle );
    console.log( "cepid:", gp.ceProjectId, ap.CEProjectId );
    console.log( "ceHolder:", gp.ceHolderId, ap.CEHolderId );
    console.log( "hostHolder:", gp.hostHolderId, ap.HostHolderId );
    console.log( "grantor:", gp.ceGrantorId, ap.CEGrantorId );
    console.log( "type:", gp.peqType, ap.PeqType );
    console.log( "amount:", gp.amount, ap.Amount );
    console.log( "date:", gp.accrualDate, ap.AccrualDate);
    console.log( "vested:", gp.vestedPerc, ap.VestedPerc); 
    console.log( "psub:",  gp.hostProjectSub, ap.HostProjectSub );
    console.log( "repo:", gp.hostRepoId, ap.HostRepoId );
    console.log( "active:", gp.active, ap.Active );
}

async function checkPEQs( authData, cepid ) {
    let goodGold = true;
    const awsPeqs = await awsUtils.getPEQs( authData, { "CEProjectId": cepid } );
    // For accrual date, this changes nightly.  One option is to set a 'last ingested' date.  For now, just check if a date exists or not.
    for( const gp of PEQS_GOLD ) {
	let ap = awsPeqs.find( p => p.HostIssueTitle == gp.title && utils.arrayEquals( p.HostProjectSub, gp.hostProjectSub ));
	assert( typeof ap !== 'undefined' );
	console.log( "Checking", gp.title );
	goodGold = goodGold && ( gp.title == ap.HostIssueTitle);
	goodGold = goodGold && ( gp.ceProjectId == ap.CEProjectId );
	goodGold = goodGold && ( utils.arrayEquals( gp.ceHolderId, ap.CEHolderId ));
	goodGold = goodGold && ( utils.arrayEquals( gp.hostHolderId, ap.HostHolderId ));
	goodGold = goodGold && ( gp.ceGrantorId == ap.CEGrantorId );

	goodGold = goodGold && ( gp.peqType == ap.PeqType );
	goodGold = goodGold && ( gp.amount == ap.Amount );
	goodGold = goodGold && gp.accrualDate == -1 ? ( ap.AccrualDate != "---" ) : (ap.AccrualDate == "---"); 
	goodGold = goodGold && ( gp.vestedPerc == ap.VestedPerc);

	goodGold = goodGold && ( utils.arrayEquals( gp.hostProjectSub, ap.HostProjectSub ));
	goodGold = goodGold && ( gp.hostRepoId == ap.HostRepoId );
	goodGold = goodGold && ( gp.active == ap.Active );

	if( !goodGold ) {
	    report( gp, ap );
	    break;
	}
    }
    if( goodGold ) { console.log( "Peq Gold Image testing Passed" ); }
    return goodGold;
}

async function runTests() {
    console.log( "Gold image test for AWS Peqs after ingest" );


    let authData     = new authDataC.AuthData();
    authData.who     = "<TEST: Main> ";
    authData.api     = awsUtils.getAPIPath() + "/find";
    authData.cog     = await awsAuth.getCogIDToken();
    authData.cogLast = Date.now();        
    authData.pat     = await auth.getPAT( config.TEST_ACTOR );

    await checkPEQs(  authData, config.FLUTTER_TEST_CEPID );
}


// npm run checkPeqs
runTests();
