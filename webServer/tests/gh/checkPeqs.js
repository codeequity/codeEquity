import assert from 'assert';

import * as awsAuth   from '../../auth/aws/awsAuth.js';
import * as auth      from '../../auth/gh/ghAuth.js';
import * as config    from '../../config.js';

import * as utils     from '../../utils/ceUtils.js';
import * as awsUtils  from '../../utils/awsUtils.js';
import authDataC      from '../../auth/authData.js';

// ACTIVE PEQS
// --------------------------------

// Data Sec
const _p3 = { title: "Snow melt", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"eaeIqcqqdp",
	      ceHolderId: ["yxsklawdpc", "eaeIqcqqdp"], hostHolderId:["U_kgDOBqJgmQ","U_kgDOBP2eEw"], 
              peqType: "grant", amount: 1000, accrualDate: -1, vestedPerc: 0,
              hostProjectSub:["Data Security Flut", "Accrued"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

const _p4 = { title: "AssignTest", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"eaeIqcqqdp",
	      ceHolderId: ["eaeIqcqqdp"], hostHolderId:["U_kgDOBP2eEw"], 
              peqType: "grant", amount: 1000, accrualDate: -1, vestedPerc: 0,
              hostProjectSub:["Data Security Flut", "Accrued"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

// no ceGrantor - this peq has not been granted.  In fact, no splits will ever be 'granted' in this test since can't touch a peq once it has been set in stone
const _p5 = { title: "IR Plan split", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
	      ceHolderId: ["eaeIqcqqdp"], hostHolderId:["U_kgDOBP2eEw"], 
              peqType: "pending", amount: 250, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["Data Security Flut", "Pending PEQ Approval"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

const _p6 = { title: "IR Prog split", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
	      ceHolderId: ["yxsklawdpc"], hostHolderId:["U_kgDOBqJgmQ"], 
              peqType: "plan", amount: 500, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["Data Security Flut", "Planned"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

// A Pre-existing Project

const _p7 = { title: "LabelTest Dubs", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"eaeIqcqqdp",
	      ceHolderId: ["eaeIqcqqdp"], hostHolderId:["U_kgDOBP2eEw"], 
              peqType: "grant", amount: 500, accrualDate: -1, vestedPerc: 0,
              hostProjectSub:[ "A Pre-Existing Project Flut", "Accrued"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

const _p8 = { title: "Close Open test", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"eaeIqcqqdp",
	      ceHolderId: ["eaeIqcqqdp"], hostHolderId:["U_kgDOBP2eEw"], 
              peqType: "grant", amount: 1000, accrualDate: -1, vestedPerc: 0,
              hostProjectSub:[ "A Pre-Existing Project Flut", "Accrued"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

const _p9 = { title: "IR Plan split", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
	      ceHolderId: ["eaeIqcqqdp"], hostHolderId:["U_kgDOBP2eEw"], 
              peqType: "plan", amount: 500, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["A Pre-Existing Project Flut", "Bacon"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

const _p11 = { title: "LabelTest Carded", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
	      ceHolderId: [], hostHolderId:[], 
              peqType: "plan", amount: 1000, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["A Pre-Existing Project Flut", "Bacon"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

// Github Operations

// Good xfer must be within CEV.  This is all within CEP, but between repos.
// this shows up in inactive as well.  this is a transferred peq, note the different repo
// NOTE: If genFlutData did not run, this will have a ceServer psub, i.e: ["Github Operations", "Stripes"]
const _p13 = { title: "CT Blast", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
              ceHolderId: ["eaeIqcqqdp", "yxsklawdpc" ], hostHolderId:["U_kgDOBP2eEw", "U_kgDOBqJgmQ"], 
              peqType: "plan", amount: 704, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["Github Operations Flut", "Stripes"], hostRepoId: "R_kgDOOHkgXw", hostIssueId: "-1", active: "true" };

const _p15 = { title: "IR Accrued", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"eaeIqcqqdp",
	      ceHolderId: ["eaeIqcqqdp"], hostHolderId:["U_kgDOBP2eEw"], 
              peqType: "grant", amount: 1000, accrualDate: -1, vestedPerc: 0,
              hostProjectSub:["Github Operations Flut", "Accrued"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };
// Note close open also exists in pre-existing
const _p16 = { title: "Close Open test", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"eaeIqcqqdp",
	      ceHolderId: ["eaeIqcqqdp"], hostHolderId:["U_kgDOBP2eEw"], 
              peqType: "grant", amount: 1000, accrualDate: -1, vestedPerc: 0,
              hostProjectSub:["Github Operations Flut", "Accrued"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };
const _p17 = { title: "LM Accrued", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"eaeIqcqqdp",
	      ceHolderId: ["yxsklawdpc"], hostHolderId:["U_kgDOBqJgmQ"], 
              peqType: "grant", amount: 501, accrualDate: -1, vestedPerc: 0,
              hostProjectSub:["Github Operations Flut", "Accrued"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

const _p18 = { title: "IR Pending", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
	      ceHolderId: ["yxsklawdpc", "eaeIqcqqdp"], hostHolderId:["U_kgDOBqJgmQ","U_kgDOBP2eEw"], 
              peqType: "pending", amount: 1000, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["Github Operations Flut", "Pending PEQ Approval"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

// Note, ceServer version of this has 501 peq not 105.  Ingest is not run for ceServer testing.
const _p19 = { title: "LM Pending", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
	      ceHolderId: ["yxsklawdpc", "eaeIqcqqdp"], hostHolderId:["U_kgDOBqJgmQ","U_kgDOBP2eEw"], 
              peqType: "pending", amount: 105, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["Github Operations Flut", "Pending PEQ Approval"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

const _p20 = { title: "IR Plan", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
	      ceHolderId: ["eaeIqcqqdp"], hostHolderId:["U_kgDOBP2eEw"], 
              peqType: "plan", amount: 250, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["Github Operations Flut", "Planned"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };
const _p29 = { title: "Situated Accrued", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
	      ceHolderId: [], hostHolderId:[], 
              peqType: "plan", amount: 1000, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["Github Operations Flut", "Planned"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };


// CROSS PROJ
// Note these two start in ceTesterConne or ceFlutterConnie, then xfer to flut and to serv.  So there are two active peqs here, different ceprojs from dif. runs
const _p23 = { title: "CT Blast X", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
	      ceHolderId: ["eaeIqcqqdp", "yxsklawdpc" ], hostHolderId:["U_kgDOBP2eEw", "U_kgDOBqJgmQ"], 
              peqType: "plan", amount: 704, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["Cross Proj", "Cross Col"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };

// no ingest, so no ceHolder
const _p24 = { title: "CT Blast X", id: "-1", ceProjectId: "CE_ServTest_usda23k425", ceGrantorId:"---",
              ceHolderId: [], hostHolderId:["U_kgDOBP2eEw", "U_kgDOBqJgmQ"], 
              peqType: "plan", amount: 704, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["Cross Proj", "Cross Col"], hostRepoId: "R_kgDOIiH6sg", hostIssueId: "-1", active: "true" };


// UNCLAIMED
const _p25 = { title: "Blast 1", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
	      ceHolderId: ["eaeIqcqqdp"], hostHolderId:["U_kgDOBP2eEw"], 
              peqType: "plan", amount: 604, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["UnClaimed", "UnClaimed"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };
const _p26 = { title: "Blast 2", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
              ceHolderId: ["eaeIqcqqdp", "yxsklawdpc"], hostHolderId:["U_kgDOBP2eEw", "U_kgDOBqJgmQ"], 
              peqType: "plan", amount: 604, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["UnClaimed", "UnClaimed"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };
const _p27 = { title: "Blast 6", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
	      ceHolderId: [], hostHolderId:[], 
              peqType: "plan", amount: 604, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["UnClaimed", "UnClaimed"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };
const _p28 = { title: "Interleave 3", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
              ceHolderId: ["AHLjVaSIlH", "yxsklawdpc", "eaeIqcqqdp"], hostHolderId:["U_kgDOBLisTg", "U_kgDOBqJgmQ","U_kgDOBP2eEw"], 
              peqType: "plan", amount: 903, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["UnClaimed", "UnClaimed"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "true" };


// GH CLOSED


// INACTIVE
const _ip1 = { title: "Situated Flat", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
	       ceHolderId: [], hostHolderId:[], 
               peqType: "plan", amount: 1000, accrualDate: "---", vestedPerc: 0,
               hostProjectSub:[ "Github Operations Flut", "Stars"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "false" };

const _ip2 = { title: "CT Blast", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"---",
	      ceHolderId: ["yxsklawdpc", "eaeIqcqqdp"], hostHolderId:["U_kgDOBqJgmQ","U_kgDOBP2eEw"], 
              peqType: "plan", amount: 704, accrualDate: "---", vestedPerc: 0,
              hostProjectSub:["Github Operations Flut", "Stripes"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "false" };

const _ip3 = { title: "Situated Accrued card1st", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42", ceGrantorId:"eaeIqcqqdp",
	      ceHolderId: ["eaeIqcqqdp"], hostHolderId:["U_kgDOBP2eEw"], 
              peqType: "grant", amount: 1000, accrualDate: -1, vestedPerc: 0,
              hostProjectSub:["Github Operations Flut", "Accrued"], hostRepoId: "R_kgDOLlZyUw", hostIssueId: "-1", active: "false" };


const PEQS_GOLD = [ _p3, _p4, _p5, _p6, _p7, _p8, _p9, _p11, _p13, _p15, _p16, _p17, _p18, _p19, _p20, _p23, _p24,
		    _p25, _p26, _p27, _p28, _p29,
		    _ip1, _ip2, _ip3 ];


// NO PEQS
// --------------------------------
const _np1 = { title: "IR Moons split", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42" }
const _np2 = { title: "Rosemary", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42" }
const _np3 = { title: "Parsley", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42" }
const _np4 = { title: "Carded Pending", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42" }
const _np5 = { title: "Carded Accrued", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42" }
const _np6 = { title: "LM Newborn", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42" }
const _np7 = { title: "Situated Accrued iss1st", id: "-1", ceProjectId: "CE_FlutTest_ks8asdlg42" }

const NO_PEQS_GOLD = [ _np1, _np2, _np3, _np4, _np5, _np6, _np7 ];





function report( gp, ap ) {
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

async function checkPEQs( authData, cepid, cepidX, cepidM ) {
    
    let allPass = true;
    let awsPeqs = await awsUtils.getPEQs( authData, { "CEProjectId": cepid } );
    awsPeqs = awsPeqs.concat( await awsUtils.getPEQs( authData, { "CEProjectId": cepidX } ));
    awsPeqs = awsPeqs.concat( await awsUtils.getPEQs( authData, { "CEProjectId": cepidM } ));

    // rewrite names to remove the random split tag
    awsPeqs.forEach(p => {
	if( typeof p.HostIssueTitle === 'undefined' ) { console.log( p ); }
	let loc = p.HostIssueTitle.indexOf( " split:" );      // XXX formalize
	if( loc != -1 ) { p.HostIssueTitle = p.HostIssueTitle.substring( 0, loc+6 ); }
    });
	
    // For accrual date, this changes nightly.  One option is to set a 'last ingested' date.  For now, just check if a date exists or not.
    for( const gp of PEQS_GOLD ) {
	let goodGold = true;
	let active = gp.active == "true" ? "active" : "inactive";
	// CrossTest now begins from within same CEP/CEV, so need to filter on active flag as well since both active and inactive are available per CEP
	let ap = awsPeqs.find( p => p.CEProjectId == gp.ceProjectId && p.HostIssueTitle == gp.title && gp.active == p.Active && utils.arrayEquals( p.HostProjectSub, gp.hostProjectSub ));
	if( typeof ap === 'undefined' ) {
	    console.log( "ERROR.  Gold image PEQ is not found in dynamo", gp.ceProjectId, gp.title, gp.hostProjectSub );
	    goodGold = false;
	}
	else {
	    console.log( "" );
	    console.log( "Checking", active, gp.title, goodGold );

	    goodGold = goodGold && ( gp.title == ap.HostIssueTitle);
	    goodGold = goodGold && ( gp.ceProjectId == ap.CEProjectId );
	    goodGold = goodGold && ( utils.arrayEquals( gp.ceHolderId.sort(), ap.CEHolderId.sort() ));
	    goodGold = goodGold && ( utils.arrayEquals( gp.hostHolderId.sort(), ap.HostHolderId.sort() ));
	    goodGold = goodGold && ( gp.ceGrantorId == ap.CEGrantorId );
	    
	    goodGold = goodGold && ( gp.peqType == ap.PeqType );
	    goodGold = goodGold && ( gp.amount == ap.Amount );
	    goodGold = goodGold && (gp.accrualDate == -1 ? ( ap.AccrualDate != "---" ) : (ap.AccrualDate == "---")); 
	    goodGold = goodGold && ( gp.vestedPerc == ap.VestedPerc);
	    
	    goodGold = goodGold && ( utils.arrayEquals( gp.hostProjectSub, ap.HostProjectSub ));
	    goodGold = goodGold && ( gp.hostRepoId == ap.HostRepoId );
	    goodGold = goodGold && ( gp.active == ap.Active );
	    
	    if( !goodGold ) {
		console.log( "ERROR.  Gold image does not match dynamo peq (gold standard is first)" );
		report( gp, ap );
	    }
	}
	allPass = allPass && goodGold;
    }

    for( const gp of NO_PEQS_GOLD ) {
	let goodGold = true;
	console.log( "" );
	console.log( "Checking", "no peq", gp.title );
	let ap = awsPeqs.find( p => p.CEProjectId == gp.ceProjectId && p.HostIssueTitle == gp.title && utils.arrayEquals( p.HostProjectSub, gp.hostProjectSub ));
	if( typeof ap !== 'undefined' ) {
	    console.log( "ERROR.  Gold image NO_PEQ was found in dynamo", gp.title );
	    report( gp, ap );
	    goodGold = false;
	}
	allPass = allPass && goodGold;
    }

    if( allPass ) { console.log( "Peq Gold Image testing Passed" ); }
    return allPass;
}

async function runTests() {
    console.log( "Gold image test for AWS Peqs after ingest" );
    console.log( "Don't forget to run ingest first!" );


    let authData     = new authDataC();
    authData.who     = "<TEST: Main> ";
    authData.api     = awsUtils.getAPIPath() + "/find";
    authData.cog     = await awsAuth.getCogIDToken();
    authData.cogLast = Date.now();        
    authData.pat     = await auth.getPAT( config.TEST_ACTOR );

    await checkPEQs(  authData, config.FLUTTER_TEST_CEPID, config.CROSS_TEST_CEPID, config.MULTI_TEST_CEPID );
}


// npm run checkPeqs
runTests();
