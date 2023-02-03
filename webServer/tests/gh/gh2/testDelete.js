const assert   = require( 'assert' );

const config   = require( '../../../config' );

const utils    = require( '../../../utils/ceUtils' );
const awsUtils = require( '../../../utils/awsUtils' );
const ghUtils  = require( '../../../utils/gh/ghUtils' );

const ghV2     = require( '../../../utils/gh/gh2/ghV2Utils' );

const tu       = require('../../ceTestUtils');

const gh2tu    = require( './gh2TestUtils' );


async function remIssues( authData, ghLinks, pd ) {
    // Get all existing issues for deletion.  GraphQL required node_id (global), rather than id.
    console.log( "Removing all issues. " );
    let issues = await gh2tu.getIssues( authData, pd );
    
    let allLinks = await tu.getLinks( authData, ghLinks, { "ceProjId": pd.ceProjectId, "repo": pd.repoName } );
    
    // Could probably do this in one fel swoop, but for now
    // Note the awaits here wait for GH to complete, not for CE to complete...  promise.all doesn't help

    for( const issue of issues) {
	await gh2tu.remIssue( authData, issue.id );
	let link = allLinks == -1 ? allLinks : allLinks.find(link => link.hostIssueId == issue.id.toString());
	if( link != -1 && typeof link != 'undefined' && link.hostColumnName == config.PROJ_COLS[config.PROJ_ACCR] ) { await utils.sleep( 800 ); }
	else                                                                                                        { await utils.sleep( 400 ); }
    }
}


async function clearRepo( authData, ghLinks, pd ) {
    console.log( "\nClearing", pd.repoName );

    // Delete all issues, cards, projects, columns, labels.
    // Eeek.  This works a little too well.  Make sure the repo is expected.
    assert( pd.GHRepo == config.TEST_REPO || pd.GHRepo == config.FLUTTER_TEST_REPO || pd.GHRepo == config.CROSS_TEST_REPO || pd.GHRepo == config.MULTI_TEST_REPO );

    // Start promises
    let jobsP  = tu.purgeJobs( pd.GHRepo );

    // Issues.
    // Some deleted issues get recreated in unclaimed.  Wait for them to finish, then repeat
    await remIssues( authData, ghLinks, pd );
    await utils.sleep( 1000 );
    await remIssues( authData, ghLinks, pd );
    await utils.sleep( 1000 );

    // Start here, else lots left undeleted after issue munging. 
    let peqsP  = awsUtils.getPeqs( authData,  { "CEProjectId": pd.ceProjectId });
    let pactsP = awsUtils.getPActs( authData, { "CEProjectId": pd.ceProjectId });

    // XXX would like to delete.. buuut..
    // Get all existing projects in repo for deletion
    console.log( "Unlinking all Projects. " );
    let projIds = gh2tu.getProjects( authData, pd );
    projIds = projIds.map((project) => project.id );
    console.log( "ProjIds", pd.repoName, projIds );
    
    for( const projId of projIds ) {
	await gh2tu.unlinkProject( authData, projId, pd.GHRepoId );
	await utils.sleep( 1000 );
    }

    await utils.sleep( 1000 );

    jobsP = await jobsP;
    
    // Clean up dynamo.
    // Note: awaits may not be needed here.  No dependencies... yet...
    // Note: this could easily be 1 big function in lambda handler, but for now, faster to build/debug here.

    // PEQs
    let peqs =  await peqsP;
    let peqIds = peqs == -1 ? [] : peqs.map(( peq ) => [peq.PEQId] );
    console.log( "Dynamo PEQ ids", pd.repoName, peqIds );
    let peqP = awsUtils.cleanDynamo( authData, "CEPEQs", peqIds );

    // PActions raw and otherwise
    // Note: bot, ceServer and GHOwner may have pacts.  Just clean out all.
    let pacts = await pactsP;
    let pactIds = pacts == -1 ? [] : pacts.map(( pact ) => [pact.PEQActionId] );
    console.log( "Dynamo bot PActIds", pd.repoName, pactIds );
    let pactP  = awsUtils.cleanDynamo( authData, "CEPEQActions", pactIds );
    let pactRP = awsUtils.cleanDynamo( authData, "CEPEQRaw", pactIds );
    
    // Get all peq labels in repo for deletion... dependent on peq removal first.
    console.log( "Removing all PEQ Labels.", pd.repoName );
    let pLabels = [];
    let labels  = await gh2tu.getLabels( authData, pd ); 

    for( const label of labels ) {
	if( ghUtils.parseLabelName( label.name )[0] > 0 ) { pLabels.push( label.name ); }
	else if( label.name == config.POPULATE )          { pLabels.push( label.name ); }
    }
    console.log( "Labels", pLabels.map( p => p.name ) );

    for( const label of pLabels ) {
	await gh2tu.delLabel( authData, label );
    }

    // Delete special label mod adds
    let labelRes = await ghV2.getLabel( authData, pd.GHRepoId, "nonPeq1" );
    if( typeof labelRes.label != 'undefined' ) { gh2tu.delLabel( authData, labelRes.label ); }
    labelRes = await ghV2.getLabel( authData, pd.GHRepoId, "nonPeq2" );
    if( typeof labelRes.label != 'undefined' ) { gh2tu.delLabel( authData, labelRes.label ); }
    labelRes = await ghV2.getLabel( authData, pd.GHRepoId, "newName" );
    if( typeof labelRes.label != 'undefined' ) { gh2tu.delLabel( authData, labelRes.label ); }
    

    // Linkages
    // Usually empty, since above deletes remove links as well.  but sometimes, der's turds.
    console.log( "Remove links", pd.repoName );
    await tu.remLinks( authData, ghLinks, pd.GHFullName );
    let links  = await tu.getLinks( authData, ghLinks, { "ceProjId": pd.ceProjectId, "repo": pd.GHFullName } );
    if( links != -1 ) { console.log( links ); }
    assert( links == -1 );

    peqP   = await peqP;
    pactP  = await pactP;
    pactRP = await pactRP;


    // set unpopulated
    // XXX Maybe clear hostRepos at some point?
    console.log( "Depopulate" );
    await awsUtils.unpopulate( authData, pd.ceProjectId );
}


async function runTests( authData, authDataX, authDataM, ghLinks, td, tdX, tdM ) {

    console.log( "Clear testing environment" );

    let promises = [];
    promises.push( clearRepo( authData,  ghLinks, td ));
    promises.push( clearRepo( authDataX, ghLinks, tdX ));
    promises.push( clearRepo( authDataM, ghLinks, tdM ));
    await Promise.all( promises );
}


// runTests();
exports.runTests = runTests;
