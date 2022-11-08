var assert = require('assert');

const awsAuth   = require( '../auth/aws/awsAuth' );
const auth      = require( "../auth");
const config    = require('../config');
const utils     = require( '../utils');

const ghUtils = require( '../ghUtils');
var gh      = ghUtils.githubUtils;
var ghSafe  = ghUtils.githubSafe;

const testData = require( './testData' );
const authDataC = require( '../authData' );

// NOTE:
// Sanity checker's main job is to inform when things have gone wrong.
// Sanity does some limited repair, however:
//   1) often there are several possible causes that are hard to distinguish
//   2) during regression testing, a single failure will typically cause a chain of failures down the line
//   3) it is very involved to manage repairs beyond a single failure.
// In light of the above, the job is to warn, then recommend common causes to user.  Consider repair down the road.


async function getGHTestLabels( authData, td ) {
    let res = [];
    await gh.getRepoLabelsGQL( authData.pat, td.GHOwner, td.GHRepo, res, -1 );
    return res;
}

async function getGHTestIssues( authData, td ) {
    let res = [];
    await gh.getRepoIssuesGQL( authData.pat, td.GHOwner, td.GHRepo, res, -1 );
    return res;
}

async function getGHTestLocs( authData, td ) {
    let res = [];
    await gh.getRepoColsGQL( authData.pat, td.GHOwner, td.GHRepo, res, -1 );
    return res;
}

async function getAWSTestPeqs( authData, td ) {
    let res = await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    return res;
}

async function getAWSTestLocs( authData, td ) {
    let res = await utils.getStoredLocs( authData, td.GHFullName );
    res = typeof res === 'undefined' ? {Locations:[]} : res;
    return res.Locations;
}


function showRaw( authData, ghLabels, ghIssues, awsPeqs, awsLocs, preview ) {

    if(( ghLabels.length + ghIssues.length + awsPeqs.length + awsLocs.length > 0 ) && typeof preview !== 'undefined' ) {
	console.log( "----------------------" );
	console.log( preview );
    }
    
    if( ghLabels.length > 0 ) {
	console.log( "GH Labels: " );
	for( var label of ghLabels ) {
	    console.log( authData.who, label.name, "**", label.description, label.id );
	}
    }

    if( ghIssues.length > 0 ) {
	console.log( "GH Issues: " );
	for( var issue of ghIssues ) {
	    console.log( authData.who, issue.issueTitle, issue.issueNumber, issue.issueId, issue.projectId, issue.projectName, issue.columnId, issue.columnName );
	    for( var label of issue.labels ) {
		console.log( "        ", label.name, "**", label.description.substring(0,8) );
	    }
	}
    }

    if( awsPeqs.length > 0 ) {
	console.log( "AWS PEQ:" );
	for( var peq of awsPeqs ) {
	    console.log( authData.who, peq.GHIssueId, peq.GHIssueTitle, peq.Active, peq.PeqType );
	}
    }

    if( awsLocs.length > 0 ) {
	console.log( "AWS Loc:" );
	let limit = 0;
	for( var loc of awsLocs ) {
	    console.log( loc.Active, loc.GHProjectId, loc.GHProjectName, loc.GHColumnId, loc.GHColumnName );
	    if( limit++ > 50 ) {
		break;
	    }
	}
    }
}

// Active peq in AWS with no matching issue id in GH
// Possible causes, single failure:
//  - missing notification:  remove issue                                          remedy: deleteIssue logic
//  - missing notification:  remove/edit label  x no.  issue would still exist
//  - missing notification:  remove card        x no.  issue would still exist
//  - missing notification:  remove proj/col    x no.  remove proj/col generates remove issue.
//  - create split issue failed                 x no.  requires multiple failures in resolve:rebuildIssue/rebuildCard
//  - missing aws update:    aws update lost    o does paction exist?  if not, single fail points to GH
//  - missing notification:  transfer           o is issueId in other owned repos?
async function repairPeqNoIss( authData, td, pacts, peqNoIss ) {

    if( peqNoIss == -1 ) { return; }
    
    let repos = [];
    await gh.getReposGQL( authData.pat, td.GHOwner, repos, -1 );

    // XXX Note: ceFlutter deactivate peq will need to run ceServer deleteIssue/Card logic.
    for( var peq of peqNoIss ) {
	let foundAltCause = false;
	// Check for paction
	let issuePacts = pacts.filter( pact => pact.Subject[0] == peq.PEQId && pact.Action == config.PACTACT_DEL );
	if( issuePacts != -1 ) {
	    // If a pact was sent, then we got the notification.
	    console.log( "Peq:", peq.GHIssueId, peq.GHIssueTitle, "has corresponding peq action for AWS.  This raises the odds that AWS missed an update." );
	    foundAltCause = true;
	    // Note.  If this was deletion of ACCR issue, ceServer would reconstruct the GH issue and move the card to unclaimed:accr.
	    //        If it was deleted again, the aws peq would be inactive.  So in neither case should it trigger this condition.
	    console.log( "   Remediation: If the issue was removed from Github on purpose, edit the PEQ in ceFlutter to deactivate it." );
	}

	// get full issue by id
	for( var repo of repos ) {
	    let issue = [];
	    await gh.getRepoIssueGQL( authData.pat, td.GHOwner, repo, peq.GHIssueId, issue, -1 );
	    if( issue.length > 0 ) {
		console.log( "Peq:", peq.GHIssueId, peq.GHIssueTitle, "was found in repo:", repo, "implying a transfer took place." );
		foundAltCause = true;
		console.log( "   Remediation: If the issue was transferred to another repo, edit the PEQ in ceFlutter for this repo to deactivate it." );
	    }
	}

	if( !foundAltCause ) {
	    console.log( "Peq:", peq.GHIssueId, peq.GHIssueTitle, "was not found in another Github repo, nor is there evidence of a missing update for AWS." );
	    console.log( "   It is likely that ceServer did not receive Github's delete notification. " );
	    console.log( "   Remediation: If the issue was removed from Github on purpose, edit the PEQ in ceFlutter to deactivate it." );
	}

    }

}

// Active peq in aws with matching issue in GH, but no peq label
// Possible causes, single failure:
//  - missing notification:  remove/edit label                                     remedy: make inactive if not accr
//  - missing aws update:    aws update lost    x no.  on remove or edit, ceServer drives mods, would require multiple failures.
//  - create split issue failed                 x no, as with peqNoIss
function repairPeqNoLab( peqNoLab ){
    if( peqNoLab == -1 ) { return; }

    for( var peq of peqNoLab ) {
	let foundAltCause = false;

	// Check for paction?  No.  On remove or edit peq label, ceServer will
	// carry out multiple actions, like creating a new label, updating labels, rejecting delete, and so on.
	// Hard to see how a single missing aws update would lead to peqNoLab.

	if( !foundAltCause ) {
	    console.log( "Peq:", peq.GHIssueId, peq.GHIssueTitle, "was reviewed." );
	    console.log( "   It is likely that ceServer did not receive Github's delete or edit label (away from PEQ) notification. " );
	    console.log( "   Remediation: A label can impact many issues.  If the label was deleted or edited intentionally,");
	    console.log( "                re-create the original label in GitHub, then delete (or edit) it again." );
	}
	
    }    
}

// Inactive peq in aws, but matching issueId in GH with peq label
// Possible causes, single failure:
//  - missing notification:  add peq label after remove 
//  - missing aws update:    aws update lost    o does paction exist?  if not, single fail points to GH
function repairPeqInactiveBut( pacts, peqInactiveBut ){

    if( peqInactiveBut == -1 ) { return; }

    for( var peq of peqInactiveBut ) {
	let foundAltCause = false;

	// Check for paction
	let issuePacts = pacts.filter( pact => pact.Subject[0] == peq.PEQId && pact.Action == config.PACTACT_ADD );
	if( issuePacts != -1 ) {
	    // If a pact was sent, then we got the notification.
	    console.log( "Peq:", peq.GHIssueId, peq.GHIssueTitle, "has corresponding peq action for AWS.  This raises the odds that AWS missed an update." );
	    console.log( "   Remediation: In Github, remove the PEQ label from this issue, then add it again." );
	    foundAltCause = true;
	}

	if( !foundAltCause ) {
	    console.log( "Peq:", peq.GHIssueId, peq.GHIssueTitle, "was reviewed." );
	    console.log( "   It is likely that ceServer did not receive Github's add label notification. " );
	    console.log( "   Remediation: In Github, remove the PEQ label from this issue, then add it again." );
	}
	
    }
    
}

// Issue with peq label in GH, no matching active peq in aws
// This differs from peqInactiveBut in cases where aws peq was never created so no matching id
// Possible causes, single failure:
//  - transfer in:                              Most likely.  xfer is now keeping labels.
//  - missing notification:  add peq label 1st time
//  - missing notification:  open issue
//  - missing notification:  make project card  x no.  would at least be in unclaimed, single failure
function repairIssNoPeq( issNoPeq ){
    if( issNoPeq == -1 ) { return; }

    for( var iss of issNoPeq ) {
	let foundAltCause = false;

	if( !foundAltCause ) {
	    console.log( "Issue:", iss.issueId, iss.issueTitle, "was reviewed." );
	    console.log( "   The most likely failure at this point in time is that the issue was transferred in from another repository." );
	    console.log( "   Github began keeping labels on transferred issues in Feb 2022.  Documentation indicates the opposite should happen.  Wait and see. " );
	    console.log( "   Remediation: In Github, remove the PEQ label from this issue, then add it again." );
	}
    }
}

// Issue with peq label in GH, active in aws but no matching proj/col in aws
// Possible causes, single failure:
//  - transfer in:                              Most likely.  xfer is now keeping labels.
//  - missing notification:  create col/proj    ? confirm ceServer code path here
//  - missing notification:  edit col/proj      
//  - missing notification:  delete card        o does project card exist in GH?  is GH col/proj defined?  i.e. violate 1:1?
//  - missing notification:  move card          x no.  would at least see proj col after create
//  - missing aws update:    aws update lost    o does paction exist?  
function repairIssNoLoc( issNoLoc ){
    if( issNoLoc == -1 ) { return; }
    for( var iss of issNoLoc ) {
	let foundAltCause = false;

	if( !foundAltCause ) {
	    console.log( "Issue:", iss.issueId, iss.issueTitle, "was reviewed." );
	    console.log( "   The most likely failure at this point in time is that the issue was transferred in from another repository." );
	    console.log( "   Github began keeping labels on transferred issues in Feb 2022.  Documentation indicates the opposite should happen.  Wait and see. " );
	    console.log( "   Remediation: In Github, remove the PEQ label from this issue, then add it again." );
	}
    }
}

// Active loc in aws with no matching loc in gh
// Possible causes, single failure:
//  - missing notification:  edit col/proj
//  - missing notification:  delete col/proj    GH will send a slew of delete issue/card.  These can be treated as empty, meaning no PActs sent for the del col.
//  - missing aws update:    aws update lost    o does paction exist?  this is a theme
function repairLocNoLoc( pacts, locNoLoc ){
    if( locNoLoc == -1 ) { return; }
    for( var loc of locNoLoc ) {
	let foundAltCause = false;

	// Check for paction
	let locPacts = pacts.filter( pact => ( pact.Subject[0] == loc.GHColumnId && pact.Note == "Column rename" ) ||
				             ( pact.Subject[0] == loc.GHProjectId && pact.Note == "Project rename" ) );  // XXX formalize
	if( locPacts != -1 ) {
	    // If a pact was sent, then we got the notification.
	    console.log( "Loc:", loc.GHProjectName, loc.GHColumnName, "has corresponding peq action for AWS.  This raises the odds that AWS missed an update." );
	    console.log( "   Remediation: In ceFlutter, update the column or project that was edited." );
	    foundAltCause = true;
	}

	if( !foundAltCause ) {
	    console.log( "Loc:", loc.GHProjectName, loc.GHColumnName, "was reviewed." );
	    console.log( "   It is likely that ceServer did not receive Github's edit or delete notification. " );
	    console.log( "   Remediation: In ceFlutter, update the column or project that was edited." );
	}
	
    }

}


async function preIngestCheck( authData, td, ghLabels, ghIssues, awsPeqs, awsLocs, ghLocs ) {

    showRaw( authData, ghLabels, ghIssues, awsPeqs, awsLocs );
    console.log( "\n\n\n");
    
    if( ghIssues.length > 0 ) {
	for( var issue of ghIssues ) {
	    [issue.peqValue,_] = ghSafe.theOnePEQ( issue.labels );
	}
    }
    
    
    // AWS:(peq.active=true).id   1:1 match  GH:(issue) && GH:(issue has a peq label, may not match amount.)
    let peqNoIss = [];
    let peqNoLab = [];    
    let peqInactiveBut = [];    
    if( awsPeqs.length > 0 ) {
	for( var peq of awsPeqs ) {
	    if( peq.Active == "true" ) {
		let issue = ghIssues.find( iss => iss.issueId == peq.GHIssueId );
		if( typeof issue === 'undefined' ) { peqNoIss.push( peq ); }
		else if( issue.peqValue <= 0 )    { peqNoLab.push( peq ); }
	    }
	    else {
		let issue = ghIssues.find( iss => iss.issueId == peq.GHIssueId );
		if( typeof issue !== 'undefined' && issue.peqValue > 0 ) { peqInactiveBut.push( issue ); }
	    }
	}
    }
    let issNoPeq = [];
    if( ghIssues.length > 0 ) {
	for( var issue of ghIssues ) {
	    if( issue.peqValue > 0 ) {
		let peq = awsPeqs.find( p => p.GHIssueId == issue.issueId && p.Active == "true" );
		if( typeof peq === 'undefined' ) { issNoPeq.push( issue ); }
	    }
	}
    }


    // GH:(issue has peq label).proj,col,repo exists in AWS with active=true
    let issNoLoc = [];
    if( ghIssues.length > 0 ) {
	for( var issue of ghIssues ) {
	    if( issue.peqValue > 0 ) {
		let loc = awsLocs.find( l => l.Active == "true" && l.GHProjectId == issue.projectId && l.GHColumnId == issue.columnId );
		if( typeof loc === 'undefined' || loc.GHProjectName != issue.projectName || loc.GHColumnName != issue.columnName ) { issNoLoc.push( issue ); }
	    }
	}
    }

    // XXX roundabout way to compute there.  The first section is unnecessary, it is not a bug
    // AWS(proj,col where active=true) has GH:(issue with peq label and matching proj,col,repo)
    let locNoIss = [];
    let locNoLoc = [];
    if( awsLocs.length > 0 ) {
	for( var loc of awsLocs ) {
	    if( loc.Active == "true" ) {
		let issue = ghIssues.find( iss => iss.projectId == loc.GHProjectId && iss.columnId == loc.GHColumnId );
		if( typeof issue === 'undefined' || issue.projectName != loc.GHProjectName || issue.columnName != loc.GHColumnName ) { locNoIss.push( loc ); }
	    }
	}
	// No issues for these locs, which is O.K.  Check the locs exist in GH.
	// Ignore aws internal locs, namely project placeholders with no column info.
	for( var loc of locNoIss ) {
	    let ghLoc = ghLocs.find( l => l.GHProjectId == loc.GHProjectId && l.GHColumnId == loc.GHColumnId );
	    if( ( typeof ghLoc === 'undefined' || ghLoc.GHProjectName != loc.GHProjectName || ghLoc.GHColumnName != loc.GHColumnName ) &&
		( loc.GHColumnId != -1 && loc.GHColumnName != config.EMPTY ) )
	    { locNoLoc.push( loc ) }
	}
    }
    
    console.log( "SANITY", "peqNoIss", peqNoIss.length.toString(), "Number of peqs with no matching issues." );
    console.log( "SANITY", "peqNoLab", peqNoLab.length.toString(), "Number of peqs with no matching peq labels." );
    console.log( "SANITY", "peqInactiveBut", peqInactiveBut.length.toString(), "Number of inactive peqs but with issues with peq labels." );
    console.log( "SANITY", "issNoPeq", issNoPeq.length.toString(), "Number of issues with no active peqs." );
    console.log( "SANITY", "issNoLoc", issNoLoc.length.toString(), "Number of issues with no matching loc." );
    console.log( "SANITY", "locNoLoc", locNoLoc.length.toString(), "Number of locs with no matching issue or ghLoc." );

    showRaw( authData, [], [], peqNoIss, [], "PeqNoIss" );
    showRaw( authData, [], [], peqNoLab, [], "PeqNoLab" );
    showRaw( authData, [], [], peqInactiveBut, [], "PeqInactiveBut" );
    showRaw( authData, [], issNoPeq, [], [], "IssNoPeq" );
    showRaw( authData, [], issNoLoc, [], [], "IssNoLoc" );
    showRaw( authData, [], [], [], locNoLoc, "LocNoLoc" );

    // POSSIBLE REPAIRS
    // All share the possibility of aws missing an update.
    let pacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    
    await repairPeqNoIss( authData, td, pacts, peqNoIss );
    repairPeqNoLab( peqNoLab );
    repairPeqInactiveBut( pacts, peqInactiveBut );
    repairIssNoPeq( issNoPeq );
    repairIssNoLoc( issNoLoc );
    repairLocNoLoc( pacts, locNoLoc );

    console.log( "\n\n" );
    
}

// XXX confirm this offline mode is sensible.  Alternative: get ghLocs directly from ceServer.  Which mods are not written out immediately?
// Testing consistency checks
// Get current state in GH  for ariCETester/CodeEquityTester
// Get current state in AWS for the same
// Identify differences
// Correct differences
// Repeat
async function runTests() {

    console.log( "Do GH & AWS agree on current state of ariCETester/CodeEquityTester?" );

    // TEST_REPO auth
    let td          = new testData.TestData();
    td.GHOwner      = config.TEST_OWNER;
    td.GHRepo       = config.TEST_REPO;
    td.GHFullName   = td.GHOwner + "/" + td.GHRepo;

    let authData     = new authDataC.AuthData();
    authData.who     = "<SANITY: Main> ";
    authData.ic      = await auth.getInstallationClient( td.GHOwner, td.GHRepo, td.GHOwner );
    authData.api     = utils.getAPIPath() + "/find";
    authData.cog     = await awsAuth.getCogIDToken();
    authData.cogLast = Date.now();            
    authData.pat     = await auth.getPAT( td.GHOwner );


    // Pre-ingest
    // Most of what is in aws:peq is outdated. labels could be updated and removed.  No locations.  Can do:
    // CEPEQS
    //     * AWS:(peq.active=true).id   1:1 match  GH:(issue) && GH:(issue has peq label)
    //       - issueId match.  repo match.  That's it.
    //     * AWS:(peq.active=false).id !exist in GH:(issue s.t. issue has peq label)
    // CELinkage
    //     * GH:(issue has peq label).proj,col,repo exists in AWS with active=true
    //     * AWS(proj,col where active=true) has GH:(issue with peq label and matching proj,col,repo).. false.  Just has to exist, not be occupied.

    let promises = [];
    let ghLabels = [];
    let ghIssues = [];
    let awsPeqs  = [];
    let awsLocs  = [];
    let ghLocs   = [];
    promises.push( getGHTestLabels( authData, td ).then( res => ghLabels = res ));
    promises.push( getGHTestIssues( authData, td ).then( res => ghIssues = res ));
    promises.push( getAWSTestPeqs( authData, td  ).then( res => awsPeqs = res ));
    promises.push( getAWSTestLocs( authData, td  ).then( res => awsLocs = res ));
    promises.push( getGHTestLocs( authData, td  ).then( res => ghLocs = res ));
    await Promise.all( promises );

    await preIngestCheck( authData, td, ghLabels, ghIssues, awsPeqs, awsLocs, ghLocs );

    // Post-ingest
    //     * All pre-ingest tests remain true
    // CEPEQS
    //     * AWS:(peq.active=true).id   1:1 match  GH:(issue) && GH:(issue has peq label)
    //       - issueId match.  repo match.
    //       - AWS:GHHolderId == GH:assignees
    //       - AWS:ProjSub matches GH.location
    //       - AWS:(projectId, issueTitle) equals GH
    //       - AWS:amount  matches GH.peqLabel  
    //       - AWS:peqType matches GH.peqLabel, status
    // CELinkage
    //     * identical to pre-ingest
    

}


// npm run sanityCheck
runTests();
