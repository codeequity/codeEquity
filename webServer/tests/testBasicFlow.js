var assert = require('assert');
var utils = require('../utils');
var config  = require('../config');
var ghUtils = require('../ghUtils');
var gh = ghUtils.githubUtils;

const testData = require( './testData' );
const tu = require('./testUtils');

const ISS_FLOW = "Snow melt";
const ISS_RACE = "Ice skating";
const ASSIGNEE1 = "rmusick2000";
const ASSIGNEE2 = "codeequity";


// Newborn issues are not carded, by definition.  Too clunky in projects if we were to do so.
async function checkNewbornIssue( authData, ghLinks, td, issueData, testStatus ) {

    // CHECK github issues
    let meltIssue = await tu.findIssue( authData, td, issueData[0] );
    testStatus = tu.checkEq( meltIssue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    
    // CHECK github location  .. should not be present.  This is overkill, but will do it once.
    let projs = await tu.getProjects( authData, td );
    let cols = [];
    let cards = [];
    for( const proj of projs ) { cols = cols.concat( await tu.getColumns( authData, proj.id )); }
    for( const col of cols )   { cards = cards.concat( await tu.getCards( authData, col.id )); }
    let meltCards = cards.filter((card) => card.hasOwnProperty( 'content_url' ) && card.content_url.split('/').pop() == issueData[1].toString() );
    testStatus = tu.checkEq( meltCards.length, 0,    testStatus, "invalid card" );
    
    
    // CHECK dynamo linkage
    let links    = await tu.getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let meltLink = links.filter((link) => link.GHIssueId == issueData[0] );
    testStatus = tu.checkEq( meltLink.length, 0, testStatus, "invalid linkage" );
    
    // CHECK dynamo Peq
    let peqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0] );
    testStatus = tu.checkEq( meltPeqs.length, 0, testStatus, "invalid peq" );
    
    return testStatus;
}


// Peq-labeling a newborn issue is valid.  In which case, we need a card, a linkage, a pec and a pact.
// But no card/column has been provided.  So, CE creates an unclaimed area for safe keeping.
async function checkUnclaimedIssue( authData, ghLinks, td, issueData, testStatus ) {
    // CHECK github issues
    let meltIssue = await tu.findIssue( authData, td, issueData[0] );
    testStatus = tu.checkEq( meltIssue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = tu.checkEq( meltIssue.labels.length, 1,                testStatus, "Issue label" );
    testStatus = tu.checkEq( meltIssue.labels[0].name, "1000 PEQ",      testStatus, "Issue label" );
    
    // CHECK github location
    let cards = await tu.getCards( authData, td.unclaimCID );   // everything here has an issue
    let meltCard = ( cards.filter((card) => card.content_url.split('/').pop() == issueData[1].toString() ))[0];
    testStatus = tu.checkEq( meltCard.column_url.split('/').pop(), td.unclaimCID,     testStatus, "Card location" );
    
    // CHECK dynamo linkage
    let links    = await tu.getLinks( authData, ghLinks, { "repo": td.GHFullName });
    let meltLink = ( links.filter((link) => link.GHIssueId == issueData[0] ))[0];
    testStatus = tu.checkEq( meltLink.GHIssueNum, issueData[1].toString(), testStatus, "Linkage Issue num" );
    testStatus = tu.checkEq( meltLink.GHCardId, meltCard.id,               testStatus, "Linkage Card Id" );
    testStatus = tu.checkEq( meltLink.GHColumnName, config.UNCLAIMED,      testStatus, "Linkage Col name" );
    testStatus = tu.checkEq( meltLink.GHCardTitle, ISS_FLOW,               testStatus, "Linkage Card Title" );
    testStatus = tu.checkEq( meltLink.GHProjectName, config.UNCLAIMED,     testStatus, "Linkage Project Title" );
    testStatus = tu.checkEq( meltLink.GHColumnId, td.unclaimCID,           testStatus, "Linkage Col Id" );
    testStatus = tu.checkEq( meltLink.GHProjectId, td.unclaimPID,          testStatus, "Linkage project id" );

    // CHECK dynamo Peq
    let peqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let meltPeq = ( peqs.filter((peq) => peq.GHIssueId == issueData[0] ))[0];
    testStatus = tu.checkEq( meltPeq.PeqType, "plan",                     testStatus, "peq type invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub.length, 2,              testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub[0], config.UNCLAIMED,   testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub[1], config.UNCLAIMED,   testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectId, td.unclaimPID,          testStatus, "peq unclaimed PID bad" );
    testStatus = tu.checkEq( meltPeq.GHIssueTitle, ISS_FLOW,              testStatus, "peq title is wrong" );
    testStatus = tu.checkEq( meltPeq.GHHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = tu.checkEq( meltPeq.CEHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = tu.checkEq( meltPeq.CEGrantorId, config.EMPTY,           testStatus, "peq grantor wrong" );
    testStatus = tu.checkEq( meltPeq.Amount, 1000,                        testStatus, "peq amount" );
    testStatus = tu.checkEq( meltPeq.Active, "true",                      testStatus, "peq" );

    // CHECK dynamo Pact
    let pacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let meltPact = (pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId ))[0];
    let hasRaw = await tu.hasRaw( authData, meltPact.PEQActionId );
    testStatus = tu.checkEq( hasRaw, true,                                   testStatus, "PAct Raw match" ); 
    testStatus = tu.checkEq( meltPact.Verb, "confirm",                       testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( meltPact.Action, "add",                         testStatus, "PAct Verb"); 
    testStatus = tu.checkEq( meltPact.GHUserName, config.TESTER_BOT,         testStatus, "PAct user name" ); 
    testStatus = tu.checkEq( meltPact.Ingested, "false",                     testStatus, "PAct ingested" );
    testStatus = tu.checkEq( meltPact.Locked, "false",                       testStatus, "PAct locked" );

    return testStatus;
}



async function checkMove( authData, ghLinks, td, issueData, colId, meltCard, testStatus ) {

    // CHECK github issues
    // id, num in linkage
    let meltIssue = await tu.findIssue( authData, td, issueData[0] );
    testStatus = tu.checkEq( meltIssue.assignees.length, 2,                              testStatus, "Issue assignee count" );
    if     ( colId == td.dsPendID ) { testStatus = tu.checkEq( meltIssue.state, "closed",     testStatus, "Issue status" );  }
    else if( colId == td.dsAccrID ) { testStatus = tu.checkEq( meltIssue.state, "closed",     testStatus, "Issue status" );  }
    else                            { testStatus = tu.checkEq( meltIssue.state, "open",       testStatus, "Issue status" );  }

    // CHECK github location
    let cards = await tu.getCards( authData, colId );   
    let mCard = cards.filter((card) => card.content_url.split('/').pop() == meltIssue.number );
    testStatus = tu.checkGE( mCard.length, 1,                           testStatus, "Card location" );
    let foundCard = false;
    for( const c of mCard ) {
	if( c.id == meltCard.id ) { foundCard = true; }
    }
    testStatus = tu.checkEq( foundCard, true,                           testStatus, "Card location" );   

    
    // CHECK Dynamo PEQ
    // Should be no change
    let peqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == meltIssue.id );
    testStatus = tu.checkEq( meltPeqs.length, 1,                          testStatus, "Peq count" );
    let meltPeq = meltPeqs[0];
    testStatus = tu.checkEq( meltPeq.PeqType, "plan",                     testStatus, "peq type invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub.length, 2,              testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHIssueTitle, issueData[2],          testStatus, "peq title is wrong" );
    testStatus = tu.checkEq( meltPeq.GHHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = tu.checkEq( meltPeq.CEHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = tu.checkEq( meltPeq.CEGrantorId, config.EMPTY,           testStatus, "peq grantor wrong" );
    testStatus = tu.checkEq( meltPeq.Amount, 1000,                        testStatus, "peq amount" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub[0], td.softContTitle,   testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectSub[1], td.dataSecTitle,    testStatus, "peq project sub invalid" );
    testStatus = tu.checkEq( meltPeq.GHProjectId, td.dataSecPID,          testStatus, "peq unclaimed PID bad" );
    testStatus = tu.checkEq( meltPeq.Active, "true",                      testStatus, "peq" );

    // CHECK Dynamo PAct
    // Should show relevant change 
    let pacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let meltPacts = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    testStatus = tu.checkGE( meltPacts.length, 4,                     testStatus, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    const pact = meltPacts[ meltPacts.length - 1];

    let hasRaw = await tu.hasRaw( authData, pact.PEQActionId );
    console.log( pact.PEQActionId );
    testStatus = tu.checkEq( hasRaw, true,                            testStatus, "PAct Raw match" ); 
    testStatus = tu.checkEq( pact.GHUserName, config.TESTER_BOT,      testStatus, "PAct user name" ); 
    testStatus = tu.checkEq( pact.Ingested, "false",                  testStatus, "PAct ingested" );
    testStatus = tu.checkEq( pact.Locked, "false",                    testStatus, "PAct locked" );
    if( colId == td.dsProgID ) {
	testStatus = tu.checkEq( pact.Verb, "confirm",                testStatus, "PAct Verb"); 
	testStatus = tu.checkEq( pact.Action, "notice",               testStatus, "PAct Verb");
    }
    else if( colId == td.dsPendID ) {
	testStatus = tu.checkEq( pact.Verb, "propose",                testStatus, "PAct Verb"); 
	testStatus = tu.checkEq( pact.Action, "accrue",               testStatus, "PAct Verb");
    }
    else if( colId == td.dsAccrID ) {
	testStatus = tu.checkEq( pact.Verb, "confirm",                testStatus, "PAct Verb"); 
	testStatus = tu.checkEq( pact.Action, "accrue",               testStatus, "PAct Verb");
    }


    // CHECK dynamo linkage
    let prog = config.PROJ_COLS[ config.PROJ_PROG ]; 
    let pend = config.PROJ_COLS[ config.PROJ_PEND ]; 
    let accr = config.PROJ_COLS[ config.PROJ_ACCR ]; 
    let links = await tu.getLinks( authData, ghLinks, { "repo": td.GHFullName });
    assert( links != -1 );
    let meltLink = ( links.filter((link) => link.GHIssueId == meltIssue.id ))[0];
    testStatus = tu.checkEq( meltLink.GHIssueNum, meltIssue.number,        testStatus, "Linkage Issue num" );
    testStatus = tu.checkEq( meltLink.GHCardId, meltCard.id,               testStatus, "Linkage Card Id" );
    testStatus = tu.checkEq( meltLink.GHCardTitle, issueData[2],           testStatus, "Linkage Card Title" );
    testStatus = tu.checkEq( meltLink.GHProjectName, td.dataSecTitle,      testStatus, "Linkage Project Title" );
    testStatus = tu.checkEq( meltLink.GHProjectId, td.dataSecPID,          testStatus, "Linkage project id" );
    testStatus = tu.checkEq( meltLink.GHColumnId, colId,                   testStatus, "Linkage Col Id" );
    if     ( colId == td.dsProgID ) { testStatus = tu.checkEq( meltLink.GHColumnName, prog,  testStatus, "Linkage Col name" ); }
    else if( colId == td.dsPendID ) { testStatus = tu.checkEq( meltLink.GHColumnName, pend,  testStatus, "Linkage Col name" ); }
    else if( colId == td.dsAccrID ) { testStatus = tu.checkEq( meltLink.GHColumnName, accr,  testStatus, "Linkage Col name" ); }
    
    return testStatus;
}

async function testStepByStep( authData, ghLinks, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test basic lifecycle of an issue" );

    await tu.refreshRec( authData, td );
    await tu.refreshFlat( authData, td );

    const VERBOSE = true;
    const flowPlan = await tu.getFullLoc( authData, td.softContTitle, td.dataSecPID, td.dataSecTitle, config.PROJ_COLS[config.PROJ_PLAN] );
    
    // 1. Create issue 
    let meltData = await tu.makeIssue( authData, td, ISS_FLOW, [] );               // [id, number, title]  (mix str/int)
    testStatus = await checkNewbornIssue( authData, ghLinks, td, meltData, testStatus );

    if( VERBOSE ) { tu.testReport( testStatus, "A" ); }
    
    // 2. add peq label
    let newLabel = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );
    await tu.addLabel( authData, td, meltData[1], newLabel.name );
    await utils.sleep( 1000 );  
    await tu.refreshUnclaimed( authData, td );
    testStatus = await checkUnclaimedIssue( authData, ghLinks, td, meltData, testStatus );
    
    if( VERBOSE ) { tu.testReport( testStatus, "B" ); }

    // 3. Add to project
    let meltCard  = await tu.makeProjectCard( authData, td.dsPlanID, meltData[0] );
    await utils.sleep( 1000 );
    testStatus = await tu.checkNewlySituatedIssue( authData, ghLinks, td, flowPlan, meltData, meltCard, testStatus );

    if( VERBOSE ) { tu.testReport( testStatus, "C" ); }

    // 4. add assignee
    await tu.addAssignee( authData, td, meltData[1], ASSIGNEE1 );
    await tu.addAssignee( authData, td, meltData[1], ASSIGNEE2 );
    await utils.sleep( 1000 );
    testStatus = await tu.checkAssignees( authData, td, ASSIGNEE1, ASSIGNEE2, meltData, testStatus );

    if( VERBOSE ) { tu.testReport( testStatus, "D" ); }

    // 5. move to prog
    await tu.moveCard( authData, meltCard.id, td.dsProgID );
    await utils.sleep( 1000 );
    testStatus = await checkMove( authData, ghLinks, td, meltData, td.dsProgID, meltCard, testStatus );
	
    if( VERBOSE ) { tu.testReport( testStatus, "E" ); }

    // 6. close
    await tu.closeIssue( authData, td, meltData[1] );
    await utils.sleep( 1000 );
    testStatus = await checkMove( authData, ghLinks, td, meltData, td.dsPendID, meltCard, testStatus );

    tu.testReport( testStatus, "F" );

    // 7. move to accr
    await tu.moveCard( authData, meltCard.id, td.dsAccrID );
    await utils.sleep( 1000 );
    testStatus = await checkMove( authData, ghLinks, td, meltData, td.dsAccrID, meltCard, testStatus );
    
    tu.testReport( testStatus, "Test Basic flow" );
    return testStatus;
}

async function testEndpoint( authData, ghLinks, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "\nTest basic lifecycle of an issue, fastest speed" );

    await tu.refreshRec( authData, td );
    await tu.refreshFlat( authData, td );
    await tu.refreshUnclaimed( authData, td );

    // 1. Create issue 
    let meltData = await tu.makeIssue( authData, td, ISS_RACE, [] );               // [id, number, title]  (mix str/int)
    
    // 2. add peq label
    let newLabel = await gh.findOrCreateLabel( authData, td.GHOwner, td.GHRepo, false, "1000 PEQ", 1000 );
    await tu.addLabel( authData, td, meltData[1], newLabel.name );
    
    // 3. Add to project
    let meltCard  = await tu.makeProjectCard( authData, td.dsPlanID, meltData[0] );

    // 4. add assignee
    await tu.addAssignee( authData, td, meltData[1], ASSIGNEE1 );
    await tu.addAssignee( authData, td, meltData[1], ASSIGNEE2 );

    // 5. move to prog
    await tu.moveCard( authData, meltCard.id, td.dsProgID );
	
    // 6. close
    await tu.closeIssue( authData, td, meltData[1] );

    // Here, physically can't get from close issue screen to project screen to move it within a second.
    // which is good, since if GH updates the internal move a hair too slowly, the subsequent move below fails.
    // To see this, set mindelay to 1s or less, and comment out this sleep.
    await utils.sleep( 1000 );
    
    // 7. move to accr
    await tu.moveCard( authData, meltCard.id, td.dsAccrID );

    await utils.sleep( 1000 );

    testStatus = await checkMove( authData, ghLinks, td, meltData, td.dsAccrID, meltCard, testStatus );

    tu.testReport( testStatus, "Test lifecycles" );
    return testStatus;
}



async function runTests( authData, ghLinks, td ) {

    console.log( "Basic Flow tests =================" );

    let testStatus = [ 0, 0, []];

    // Stop and check each step
    let t1 = await testStepByStep( authData, ghLinks, td );

    // Blast through, check the end
    let t2 = await testEndpoint( authData, ghLinks, td );

    testStatus = tu.mergeTests( testStatus, t1 );
    testStatus = tu.mergeTests( testStatus, t2 );
    return testStatus
}


exports.runTests = runTests;
