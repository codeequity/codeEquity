const assert   = require( 'assert' );

const config   = require( '../../../config' );

const utils    = require( '../../../utils/ceUtils' );
const awsUtils = require( '../../../utils/awsUtils' );
const ghUtils  = require( '../../../utils/gh/ghUtils' );

const tu       = require('../../ceTestUtils');

const gh2tu    = require( './gh2TestUtils' );


async function remDraftIssues( authData, testLinks, pd ) {
    console.log( "Removing all draft issues. " );
    let drafts = await gh2tu.getDraftIssues( authData, pd.projectId );
    console.log( "REMDRAFT", pd.projectId, drafts );
    
    if( drafts != -1 ) {
	for( const draft of drafts) { await gh2tu.remDraftIssue( authData, pd.projectId, draft ); }
    }
}

// This has to finish before running rest of delete.  Otherwise, for example, links are killed, then delete is over-simplified.
async function remIssues( authData, testLinks, pd ) {
    // Get all existing issues for deletion.  GraphQL required node_id (global), rather than id.
    let issues = await gh2tu.getIssues( authData, pd );
    console.log( authData.who, pd.ghFullName, "REMISSUE", issues.length );
    
    let allLinks = await tu.getLinks( authData, testLinks, { "ceProjId": pd.ceProjectId, "repo": pd.ghFullName } );
    
    // Could probably do this in one fel swoop, but for now
    // Note the awaits here wait to issue GH remove, not for notice, or for CE to complete...  promise.all doesn't help
    let promises = [];
    if( issues != -1 ) {
	for( const issue of issues) {
	    console.log( "  ..  pushing remIssue", pd.ghFullName, issue.id, issue.title );
	    promises.push( gh2tu.remIssue( authData, issue.id ) );

	    // space requests a little to give GH a break
	    await utils.sleep( 600 );
	}
    }
    await Promise.all( promises );
}

// Note: this may be called multiple times for the same ceProj
// Can not clear entire CEProj - host projects overlap hostrepos.
async function clearCEProj( authData, testLinks, pd ) {
    console.log( "\nClearing ceProj", pd.ceProjectId, pd.ghRepoId );

    let ceProjP = awsUtils.getProjectStatus( authData, pd.ceProjectId );
    
    console.log( "Remove links", pd.ceProjectId, pd.ghRepoId );
    await tu.remLinks( authData, testLinks, pd.ceProjectId, pd.ghRepoId );
    let links  = await tu.getLinks( authData, testLinks, { ceProjId: pd.ceProjectId, repoId: pd.ghRepoId } );
    let locs   = await tu.getLocs ( authData, testLinks, { ceProjId: pd.ceProjectId, repoId: pd.ghRepoId } );
    if( links !== -1 ) { console.log( links ); }
    assert( links === -1 );
    if( locs !== -1 ) { console.log( locs ); }
    assert( locs === -1 );
    
    // PEQs
    // Are now attached to repo
    // NOTE this will run twice for ServTest.  td and tdM are same proj.  Runs in parallel, soooo....  inefficient, but not broken
    let peqs = await awsUtils.getPEQs( authData,  { "CEProjectId": pd.ceProjectId, "HostRepoId": pd.ghRepoId });
    let peqIds = peqs == -1 ? [] : peqs.map(( peq ) => [peq.PEQId] );
    if( peqIds.length > 0 ) {
	console.log( "Dynamo PEQ ids", pd.ceProjectId, peqIds );
	await awsUtils.cleanDynamo( authData, "CEPEQs", peqIds );
    }
}


async function clearUnclaimed( authData, testLinks, pd ) {
    console.log( "Clearing Unclaimed" );
    let projs = await gh2tu.getProjects( authData, pd );
    
    if( projs != -1 ) {
	for( const proj of projs ) {
	    if( proj.title == config.UNCLAIMED ) {
		pd.projectId = proj.id;
		await remIssues( authData, testLinks, pd );
		await remDraftIssues( authData, testLinks, pd );
		await gh2tu.unlinkProject( authData, pd.ceProjectId, proj.id, pd.ghRepoId );
		await utils.sleep( 1000 );
	    }
	}
    }

    // CEProjects
    gh2tu.unlinkRepo( authData, pd.ceProjectId, pd.ghRepoId );
    
}

async function remIssueHelp( authData, testLinks, pd ) {
    let retVal = false;

    // Allow a brief moment for accrued deletions to complete.  
    await utils.sleep( 3000 );
    let issues = await gh2tu.getIssues( authData, pd );
    if( issues.length != 0 ) { await remIssues( authData, testLinks, pd ); }
    else                     { retVal = true; }
    return retVal;
}

async function clearRepo( authData, testLinks, pd ) {
    console.log( "\nClearing", pd.ghFullName );

    // Delete all issues, cards, projects, columns, labels.
    // Eeek.  This works a little too well.  Make sure the repo is expected.
    assert( pd.ghRepo == config.TEST_REPO || pd.ghRepo == config.FLUTTER_TEST_REPO || pd.ghRepo == config.CROSS_TEST_REPO || pd.ghRepo == config.MULTI_TEST_REPO );

    // Start promises
    let jobsP  = tu.purgeJobs( pd.ghRepo );

    // Ensure unclaimed exists, to hold deleted accr issues.  Sometimes yesterday's crash can occur before unc is linked.
    // await gh2tu.createProjectWorkaround( authData, pd, config.UNCLAIMED, "" );
    
    // Issues.
    // Some deleted issues get recreated in unclaimed.  Wait for them to finish, then repeat
    await remIssues( authData, testLinks, pd );

    // await remIssues awaits issuance, but can't await completion either at GH or by subsequent notification-driven ceServer.
    // So keep plugging away until things are done.
    await tu.settleWithVal( "remIssue helper", remIssueHelp, authData, testLinks, pd);	    

    let pactsP  = awsUtils.getPActs( authData, { "CEProjectId": pd.ceProjectId });

    // Get all existing projects in repo for deletion
    let pids = await gh2tu.getProjects( authData, pd );

    if( pids != -1 ) {
	// Do not unlink unclaimed - causes race conditions when clearing multiple repos, some of which have ACCR issues that need to be recreated
	let unclIndex = pids.findIndex( project => project.title == config.UNCLAIMED ); 
	pids.splice( unclIndex, 1 );
	console.log( "Unlinking all Projects but Unclaimed.", pd.ghRepoId, pd.ghFullName, pids );

	if( pids != -1 ) {
	    pids = pids.map( project => project.id );
	    console.log( "ProjIds", pd.ghFullName, pids );
	    
	    // XXX would like to delete.. buuut..
	    for( const pid of pids ) {
		pd.projectId = pid;
		await remDraftIssues( authData, testLinks, pd );
		await gh2tu.unlinkProject( authData, pd.ceProjectId, pid, pd.ghRepoId );
		await utils.sleep( 1000 );
	    }
	}
    }

    await utils.sleep( 1000 );

    jobsP = await jobsP;
    
    // Clean up dynamo.
    // Note: awaits may not be needed here.  No dependencies... yet...
    // Note: this could easily be 1 big function in lambda handler, but for now, faster to build/debug here.

    // PActions raw and otherwise
    // Note: bot, ceServer and actor may have pacts.  Just clean out all.
    let pacts = await pactsP;
    let pactIds = pacts == -1 ? [] : pacts.map(( pact ) => [pact.PEQActionId] );
    console.log( "Dynamo bot PActIds", pd.ghFullName, pactIds );
    let pactP  = awsUtils.cleanDynamo( authData, "CEPEQActions", pactIds );
    let pactRP = awsUtils.cleanDynamo( authData, "CEPEQRaw", pactIds );
    
    
    // Get all peq labels in repo for deletion... dependent on peq removal first.
    console.log( "Removing all PEQ Labels.", pd.ghFullName );
    let pLabels = [];
    let labels  = await gh2tu.getLabels( authData, pd ); 

    for( const label of labels ) {
	if( ghUtils.parseLabelName( label.name )[0] > 0 ) { pLabels.push( label ); }
    }

    if( pLabels.length > 0 ) {
	console.log( "Labels", pLabels.map( p => p.name ) );
	console.log( pLabels );
    }
    for( const label of pLabels ) {
	await gh2tu.delLabel( authData, label );
    }

    // Delete special label mod adds
    let labelRes = await gh2tu.getLabel( authData, pd.ghRepoId, "nonPeq1" );
    if( labelRes.status == 200 ) { gh2tu.delLabel( authData, labelRes.label ); }
    labelRes = await gh2tu.getLabel( authData, pd.ghRepoId, "nonPeq2" );
    if( labelRes.status == 200 ) { gh2tu.delLabel( authData, labelRes.label ); }
    labelRes = await gh2tu.getLabel( authData, pd.ghRepoId, "newName" );
    if( labelRes.status == 200 ) { gh2tu.delLabel( authData, labelRes.label ); }
    
    pactP  = await pactP;
    pactRP = await pactRP;
}


// A ceProject can own several repos.
// Split delete into clearing repo-specific data, then clearing higher level ceProject-specific data.
// clearRepo can not clear project-wide data.
async function runTests( authData, authDataX, authDataM, testLinks, td, tdX, tdM ) {

    console.log( "Clear testing environment" );
    
    let promises = [];
    promises.push( clearRepo( authData,  testLinks, td ));
    promises.push( clearRepo( authDataX, testLinks, tdX ));
    promises.push( clearRepo( authDataM, testLinks, tdM ));
    await Promise.all( promises );

    console.log( "... Clear Repo finished." );
    
    // clearRepo should unlinkRepo.  Running clearRepos in parallel saves a lot of time, but can cause
    // a race condition in linkage:unlinkRepo.  Serialize
    await gh2tu.unlinkRepo( authData,  td.ceProjectId,  td.ghRepoId );
    await gh2tu.unlinkRepo( authDataX, tdX.ceProjectId, tdX.ghRepoId ); 
    await gh2tu.unlinkRepo( authDataM, tdM.ceProjectId, tdM.ghRepoId );   // this is ce_serv, multiproj

    console.log( "... Unlink Repo finished." );
    
    // Now, unlink unclaimed, which was avoided above to remove race condition
    await clearUnclaimed( authData,  testLinks, td  );
    await clearUnclaimed( authDataX, testLinks, tdX );
    await clearUnclaimed( authDataM, testLinks, tdM );
    
    promises = [];
    promises.push( clearCEProj( authData,  testLinks, td ));
    promises.push( clearCEProj( authDataX, testLinks, tdX ));
    promises.push( clearCEProj( authDataM, testLinks, tdM ));
    await Promise.all( promises );

}


// runTests();
exports.runTests = runTests;
