const assert = require( 'assert' );
const config = require( '../../../config' );

const utils    = require( '../../../utils/ceUtils' );
const awsUtils = require( '../../../utils/awsUtils' );

const tu       = require( '../../ceTestUtils' );

const testData = require( '../testData' );
const gh2tu    = require( './gh2TestUtils' );

const ISS_FLOW = "Snow melt";
const ISS_RACE = "Ice skating";
const ASSIGNEE1 = "ariCETester";
const ASSIGNEE2 = "builderCE";


// Newborn issues are not carded, by definition.  Too clunky in projects if we were to do so.
async function checkNewbornIssue( authData, testLinks, td, issueData, testStatus ) {

    console.log( "Check Newborn Issue", issueData);
    let subTest = [ 0, 0, []];

    // CHECK github issues
    let meltIssue = await gh2tu.findIssue( authData, issueData[0] );
    subTest = tu.checkEq( meltIssue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
    subTest = tu.checkEq( meltIssue.number, issueData[1].toString(), subTest, "Github issue troubles" );
    
    // CHECK github location  .. should not be present.  This is overkill (bordering on silly), but will do it once.
    let projs = await gh2tu.getProjects( authData, td );
    let cards = [];
    for( const proj of projs ) {
	let cols = await gh2tu.getColumns( authData, proj.id );
	for( const col of cols ) { cards = cards.concat( await gh2tu.getCards( authData, proj.id, col.id )); }
    }
    let meltCards = cards.filter((card) => card.hasOwnProperty( 'issueNum' ) && card.issueNum == issueData[1].toString() );
    subTest = tu.checkEq( meltCards.length, 0,    subTest, "invalid card" );
    
    
    // CHECK dynamo linkage
    let links    = await tu.getLinks( authData, testLinks, { "ceProjId": td.ceProjectId, "repo": td.GHFullName } );
    let meltLink = links.filter((link) => link.hostIssueId == issueData[0] );
    subTest = tu.checkEq( meltLink.length, 0, subTest, "invalid linkage" );
    
    // CHECK dynamo Peq
    let peqs =  await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
    let meltPeqs = peqs.filter((peq) => peq.HostIssueId == issueData[0] );
    subTest = tu.checkEq( meltPeqs.length, 0, subTest, "invalid peq" );
    
    return await tu.settle( subTest, testStatus, checkNewbornIssue, authData, testLinks, td, issueData, testStatus );
}


// Peq-labeling a newborn issue is valid.  In which case, we need a card, a linkage, a pec and a pact.
// But no card/column has been provided.  So, CE creates an unclaimed area for safe keeping.
async function checkUnclaimedIssue( authData, testLinks, td, issueData, testStatus ) {
    // CHECK github issues
    let kp = "1k " + config.PEQ_LABEL;
    let meltIssue = await gh2tu.findIssue( authData, issueData[0] );
    let subTest = [ 0, 0, []];
    subTest = tu.checkEq( meltIssue !== 'undefined', true,       subTest, "Wait for GH issue" );
    if( meltIssue !== 'undefined' ) {
	subTest = tu.checkEq( meltIssue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
	subTest = tu.checkEq( meltIssue.number, issueData[1].toString(), subTest, "Github issue troubles" );
	subTest = tu.checkEq( meltIssue.labels.length, 1,                subTest, "Issue label" );
	subTest = tu.checkEq( meltIssue.labels[0].name, kp,              subTest, "Issue label" );
    }
	
    // CHECK github location
    let cards = await gh2tu.getCards( authData, td.unclaimPID, td.unclaimCID );   // everything here has an issue

    // First time out, createUnclaimed can take a moment.
    subTest = tu.checkEq( cards != -1, true,        subTest, "cards not yet ready", td.unclaimCID );
    if( cards == -1 ) {
	await gh2tu.refreshUnclaimed( authData, td );	
	return await tu.settle( subTest, testStatus, checkUnclaimedIssue, authData, testLinks, td, issueData, testStatus );
    }

    let meltCard = ( cards.filter((card) => card.hasOwnProperty( 'issueNum' ) && card.issueNum == issueData[1].toString() ))[0];
    subTest = tu.checkEq( typeof meltCard !== 'undefined', true,        subTest, "mcards not yet ready" );
    if( typeof meltCard === 'undefined' ) { return await tu.settle( subTest, testStatus, checkUnclaimedIssue, authData, testLinks, td, issueData, testStatus ); }

    subTest = tu.checkEq( meltCard.columnId, td.unclaimCID,     subTest, "Card location" );
    
    // CHECK dynamo linkage
    let links    = await tu.getLinks( authData, testLinks, { "ceProjId": td.ceProjectId, "repo": td.GHFullName });
    let meltLink = ( links.filter((link) => link.hostIssueId == issueData[0] ))[0];
    subTest = tu.checkEq( typeof meltLink !== 'undefined', true,        subTest, "Link not present" );

    if( typeof meltLink !== 'undefined' ) {
	subTest = tu.checkEq( meltLink.hostIssueNum, issueData[1].toString(), subTest, "Linkage Issue num" );
	subTest = tu.checkEq( meltLink.hostCardId, meltCard.cardId,               subTest, "Linkage Card Id" );
	subTest = tu.checkEq( meltLink.hostColumnName, config.UNCLAIMED,      subTest, "Linkage Col name" );
	subTest = tu.checkEq( meltLink.hostIssueName, ISS_FLOW,               subTest, "Linkage Card Title" );
	subTest = tu.checkEq( meltLink.hostProjectName, config.UNCLAIMED,     subTest, "Linkage Project Title" );
	subTest = tu.checkEq( meltLink.hostColumnId, td.unclaimCID,           subTest, "Linkage Col Id" );
	subTest = tu.checkEq( meltLink.hostProjectId, td.unclaimPID,          subTest, "Linkage project id" );
	
	// CHECK dynamo Peq
	let peqs =  await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
	let meltPeq = ( peqs.filter((peq) => peq.HostIssueId == issueData[0] ))[0];
	subTest = tu.checkEq( typeof meltPeq !== 'undefined', true,        subTest, "no peq yet" );
	if( typeof meltPeq !== 'undefined' ) {
	    subTest = tu.checkEq( meltPeq.PeqType, config.PEQTYPE_PLAN,        subTest, "peq type invalid" );
	    subTest = tu.checkEq( meltPeq.HostProjectSub.length, 2,            subTest, "peq project sub invalid" );
	    subTest = tu.checkEq( meltPeq.HostProjectSub[0], config.UNCLAIMED, subTest, "peq project sub invalid" );
	    subTest = tu.checkEq( meltPeq.HostProjectSub[1], config.UNCLAIMED, subTest, "peq project sub invalid" );
	    subTest = tu.checkEq( meltPeq.HostProjectId, td.unclaimPID,        subTest, "peq unclaimed PID bad" );
	    subTest = tu.checkEq( meltPeq.HostIssueTitle, ISS_FLOW,            subTest, "peq title is wrong" );
	    subTest = tu.checkEq( meltPeq.HostHolderId.length, 0,              subTest, "peq holders wrong" );
	    subTest = tu.checkEq( meltPeq.CEHolderId.length, 0,                subTest, "peq holders wrong" );
	    subTest = tu.checkEq( meltPeq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );
	    subTest = tu.checkEq( meltPeq.Amount, 1000,                        subTest, "peq amount" );
	    subTest = tu.checkEq( meltPeq.Active, "true",                      subTest, "peq" );
	    
	    // CHECK dynamo Pact
	    let pacts = await awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
	    subTest = tu.checkEq( typeof pacts !== 'undefined', true,             subTest, "no pact yet" );
	    if( typeof pacts !== 'undefined' ) {
		let mps = (pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId ));
		let meltPact = mps[0];
		subTest = tu.checkEq( typeof meltPact !== 'undefined', true,         subTest, "no pact yet" );
		if( typeof meltPact !== 'undefined' ) {
		    let hasRaw = await tu.hasRaw( authData, meltPact.PEQActionId );
		    subTest = tu.checkEq( hasRaw, true,                                   subTest, "PAct Raw match" ); 
		    subTest = tu.checkEq( meltPact.Verb, config.PACTVERB_CONF,            subTest, "PAct Verb"); 
		    subTest = tu.checkEq( meltPact.HostUserName, config.TEST_ACTOR,       subTest, "PAct user name" ); 
		    subTest = tu.checkEq( meltPact.Ingested, "false",                     subTest, "PAct ingested" );
		    subTest = tu.checkEq( meltPact.Locked, "false",                       subTest, "PAct locked" );
		}

		let padd = false;
		let prel = false;
		for( const mp of mps ) {
		    if( mp.Action == config.PACTACT_ADD )  { padd = true; }
		    if( mp.Action == config.PACTACT_RELO ) { prel = true; }
		}
		subTest = tu.checkEq( padd && prel, true,            subTest, "PAct Action");
	    }
	}
    }
    return await tu.settle( subTest, testStatus, checkUnclaimedIssue, authData, testLinks, td, issueData, testStatus );
}



async function checkMove( authData, testLinks, td, issueData, pid, colId, meltCard, testStatus ) {

    // CHECK github issues
    // id, num in linkage
    let meltIssue = await gh2tu.findIssue( authData, issueData[0] );
    let subTest = [ 0, 0, []];
    
    subTest = tu.checkEq( meltIssue.assignees.length, 2,                              subTest, "Issue assignee count" );
    if     ( colId == td.dsPendId ) { subTest = tu.checkEq( meltIssue.state, "CLOSED",     subTest, "Issue status" );  }
    else if( colId == td.dsAccrId ) { subTest = tu.checkEq( meltIssue.state, "CLOSED",     subTest, "Issue status" );  }
    else                            { subTest = tu.checkEq( meltIssue.state, "OPEN",       subTest, "Issue status" );  }

    // CHECK github location
    let cards = await gh2tu.getCards( authData, pid, colId );   
    let mCard = cards.filter((card) => card.hasOwnProperty( 'issueNum' ) && card.issueNum == meltIssue.number );
    subTest = tu.checkGE( mCard.length, 1,                           subTest, "Card location" );
    let foundCard = false;
    for( const c of mCard ) { if( c.cardId == meltCard.cardId ) { foundCard = true; }}
    subTest = tu.checkEq( foundCard, true,                           subTest, "Card location" );   

    
    // CHECK Dynamo PEQ
    // Should be no change
    let peqs =  await awsUtils.getPeqs( authData,  { "CEProjectId": td.ceProjectId });
    let meltPeqs = peqs.filter((peq) => peq.HostIssueId == meltIssue.id );
    subTest = tu.checkEq( meltPeqs.length, 1,                          subTest, "Peq count" );
    let meltPeq = meltPeqs[0];
    if( meltPeq !== 'undefined' ) {
	subTest = tu.checkEq( meltPeq.PeqType, config.PEQTYPE_PLAN,        subTest, "peq type invalid" );
	subTest = tu.checkEq( meltPeq.HostProjectSub.length, 3,            subTest, "peq project sub invalid" );
	subTest = tu.checkEq( meltPeq.HostIssueTitle, issueData[3],        subTest, "peq title is wrong" );
	subTest = tu.checkEq( meltPeq.HostHolderId.length, 0,              subTest, "peq holders wrong" );
	subTest = tu.checkEq( meltPeq.CEHolderId.length, 0,                subTest, "peq holders wrong" );
	subTest = tu.checkEq( meltPeq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );
	subTest = tu.checkEq( meltPeq.Amount, 1000,                        subTest, "peq amount" );
	subTest = tu.checkEq( meltPeq.HostProjectSub[0], td.softContTitle, subTest, "peq project sub invalid" );
	subTest = tu.checkEq( meltPeq.HostProjectSub[1], td.dataSecTitle,  subTest, "peq project sub invalid" );
	subTest = tu.checkEq( meltPeq.HostProjectId, td.dataSecPID,        subTest, "peq unclaimed PID bad" );
	subTest = tu.checkEq( meltPeq.Active, "true",                      subTest, "peq" );
	
	// CHECK Dynamo PAct
	// Should show relevant change 
	let pacts = await awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
	let meltPacts = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
	subTest = tu.checkGE( meltPacts.length, 4,                     subTest, "PAct count" );
	
	meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
	const pact = meltPacts[ meltPacts.length - 1];
	
	let hasRaw = await tu.hasRaw( authData, pact.PEQActionId );
	console.log( pact.PEQActionId );
	subTest = tu.checkEq( hasRaw, true,                            subTest, "PAct Raw match" ); 
	subTest = tu.checkEq( pact.HostUserName, config.TEST_ACTOR,    subTest, "PAct user name" ); 
	subTest = tu.checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
	subTest = tu.checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
	if( colId == td.dsProgId ) {
	    subTest = tu.checkEq( pact.Verb, config.PACTVERB_CONF,     subTest, "PAct Verb"); 
	    subTest = tu.checkEq( pact.Action, config.PACTACT_RELO,    subTest, "PAct Action");
	}
	else if( colId == td.dsPendId ) {
	    subTest = tu.checkEq( pact.Verb, config.PACTVERB_PROP,     subTest, "PAct Verb"); 
	    subTest = tu.checkEq( pact.Action, config.PACTACT_ACCR,    subTest, "PAct Action");
	}
	else if( colId == td.dsAccrId ) {
	    subTest = tu.checkEq( pact.Verb, config.PACTVERB_CONF,     subTest, "PAct Verb"); 
	    subTest = tu.checkEq( pact.Action, config.PACTACT_ACCR,    subTest, "PAct Action");
	}
    }


    // CHECK dynamo linkage
    let prog = config.PROJ_COLS[ config.PROJ_PROG ]; 
    let pend = config.PROJ_COLS[ config.PROJ_PEND ]; 
    let accr = config.PROJ_COLS[ config.PROJ_ACCR ]; 
    let links = await tu.getLinks( authData, testLinks, { "ceProjId": td.ceProjectId, "repo": td.GHFullName });
    assert( links != -1 );
    let meltLink = ( links.filter((link) => link.hostIssueId == meltIssue.id ))[0];
    subTest = tu.checkEq( meltLink.hostIssueNum, meltIssue.number,        subTest, "Linkage Issue num" );
    subTest = tu.checkEq( meltLink.hostCardId, meltCard.cardId,               subTest, "Linkage Card Id" );
    subTest = tu.checkEq( meltLink.hostIssueName, issueData[3],           subTest, "Linkage Card Title" );
    subTest = tu.checkEq( meltLink.hostProjectName, td.dataSecTitle,      subTest, "Linkage Project Title" );
    subTest = tu.checkEq( meltLink.hostProjectId, td.dataSecPID,          subTest, "Linkage project id" );
    subTest = tu.checkEq( meltLink.hostColumnId, colId,                   subTest, "Linkage Col Id" );
    if     ( colId == td.dsProgId ) { subTest = tu.checkEq( meltLink.hostColumnName, prog,  subTest, "Linkage Col name" ); }
    else if( colId == td.dsPendId ) { subTest = tu.checkEq( meltLink.hostColumnName, pend,  subTest, "Linkage Col name" ); }
    else if( colId == td.dsAccrId ) { subTest = tu.checkEq( meltLink.hostColumnName, accr,  subTest, "Linkage Col name" ); }

    return await tu.settle( subTest, testStatus, checkMove, authData, testLinks, td, issueData, pid, colId, meltCard, testStatus );
}

async function testStepByStep( authData, testLinks, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "Test basic lifecycle of an issue" );

    await gh2tu.refreshRec( authData, td );
    await gh2tu.refreshFlat( authData, td );

    const VERBOSE = true;
    const flowPlan = await gh2tu.getFullLoc( authData, td.softContTitle, td.dataSecPID, td.dataSecTitle, config.PROJ_COLS[config.PROJ_PLAN] );
    
    // 1. Create issue 
    let meltData = await gh2tu.makeIssue( authData, td, ISS_FLOW, [] );               // [id, number, cardId, title] 
    // NOTE this check is local, not testUtils.  1-time overkill check
    testStatus = await checkNewbornIssue( authData, testLinks, td, meltData, testStatus );

    if( VERBOSE ) { tu.testReport( testStatus, "A" ); }
    
    // 2. add peq label
    let newLabel = await gh2tu.findOrCreateLabel( authData, td.GHRepoId, false, "", 1000 );
    await gh2tu.addLabel( authData, newLabel.id, meltData );

    // gh needs to create unclaimed first time through.  can take time. 
    await tu.settleWithVal( "forced refresh unclaimed", gh2tu.forcedRefreshUnclaimed, authData, testLinks, td );
    testStatus = await checkUnclaimedIssue( authData, testLinks, td, meltData, testStatus );
    
    if( VERBOSE ) { tu.testReport( testStatus, "B" ); }

    // 3. Add to project
    let meltCard  = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.dataSecPID, td.dsPlanId, meltData[0] );
    await utils.sleep( 1000 );
    testStatus = await gh2tu.checkNewlySituatedIssue( authData, testLinks, td, flowPlan, meltData, meltCard, testStatus );

    if( VERBOSE ) { tu.testReport( testStatus, "C" ); }

    // 4. add assignee
    let assignee1 = await gh2tu.getAssignee( authData, ASSIGNEE1 );
    let assignee2 = await gh2tu.getAssignee( authData, ASSIGNEE2 );
    await gh2tu.addAssignee( authData, meltData, assignee1 );
    await gh2tu.addAssignee( authData, meltData, assignee2 );
    await utils.sleep( 1000 );
    testStatus = await gh2tu.checkAssignees( authData, td, [ASSIGNEE1, ASSIGNEE2], meltData, testStatus );
    testStatus = await gh2tu.checkPact( authData, testLinks, td, ISS_FLOW, config.PACTVERB_CONF, config.PACTACT_CHAN, "add assignee", testStatus );
    
    if( VERBOSE ) { tu.testReport( testStatus, "D" ); }

    // 5. move to prog
    await gh2tu.moveCard( authData, testLinks, td.ceProjectId, meltCard.cardId, td.dsProgId );
    await utils.sleep( 1000 );
    testStatus = await checkMove( authData, testLinks, td, meltData, td.dataSecPID, td.dsProgId, meltCard, testStatus );
	
    if( VERBOSE ) { tu.testReport( testStatus, "E" ); }

    // 6. close
    await gh2tu.closeIssue( authData, td, meltData );
    await utils.sleep( 1000 );
    testStatus = await checkMove( authData, testLinks, td, meltData, td.dataSecPID, td.dsPendId, meltCard, testStatus );

    tu.testReport( testStatus, "F" );

    // 7. move to accr
    await gh2tu.moveCard( authData, testLinks, td.ceProjectId, meltCard.cardId, td.dsAccrId );
    await utils.sleep( 1000 );
    testStatus = await checkMove( authData, testLinks, td, meltData, td.dataSecPID, td.dsAccrId, meltCard, testStatus );
    
    tu.testReport( testStatus, "Test Basic flow" );
    return testStatus;
}

async function testEndpoint( authData, testLinks, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "\nTest basic lifecycle of an issue, endpoint check" );

    await gh2tu.refreshRec( authData, td );
    await gh2tu.refreshFlat( authData, td );
    await gh2tu.refreshUnclaimed( authData, td );

    // 1. Create issue 
    let meltData = await gh2tu.makeIssue( authData, td, ISS_RACE, [] );               // [id, number, title]  (mix str/int)
    
    // 2. add peq label
    let newLabel = await gh2tu.findOrCreateLabel( authData, td.GHRepoId, false, "", 1000 );
    await gh2tu.addLabel( authData, newLabel.id, meltData );
    
    // 3. Add to project
    let meltCard  = await gh2tu.makeProjectCard( authData, testLinks, td.ceProjectId, td.dataSecPID, td.dsPlanId, meltData[0] );

    // 4. add assignee
    let assignee1 = await gh2tu.getAssignee( authData, ASSIGNEE1 );
    let assignee2 = await gh2tu.getAssignee( authData, ASSIGNEE2 );
    await gh2tu.addAssignee( authData, meltData, assignee1 );
    await gh2tu.addAssignee( authData, meltData, assignee2 );

    // 5. move to prog
    await gh2tu.moveCard( authData, testLinks, td.ceProjectId, meltCard.cardId, td.dsProgId );
	
    // 6. close
    await gh2tu.closeIssue( authData, td, meltData );

    // Here, physically can't get from close issue screen to project screen to move it within a second.
    // which is good, since if GH updates the internal move a hair too slowly, the subsequent move below fails.
    // To see this, set mindelay to 1s or less, and comment out this sleep.
    await utils.sleep( 1000 );
    
    // 7. move to accr
    await gh2tu.moveCard( authData, testLinks, td.ceProjectId, meltCard.cardId, td.dsAccrId );

    await utils.sleep( 1000 );

    testStatus = await checkMove( authData, testLinks, td, meltData, td.dataSecPID, td.dsAccrId, meltCard, testStatus );

    tu.testReport( testStatus, "Test lifecycle endpoint" );
    return testStatus;
}


async function blastLink( authData, testLinks, title, ceProjId, fullName ) {
    let links  = await tu.getLinks( authData, testLinks, { "ceProjId": ceProjId, "repo": fullName } );
    let link   = links.find( link => link.hostIssueName == title );
    return link;
}


// Run several blasts, since incoming order is variable.
async function testBlast( authData, testLinks, td ) {

    // [pass, fail, msgs]
    let testStatus = [ 0, 0, []];

    console.log( "\nTest Blast issue" );

    await gh2tu.refreshRec( authData, td );

    const LAB1     = "604 " + config.PEQ_LABEL;
    const LABNP1   = "nutty1";
    const LABNP2   = "nutty2";

    let assignee1   = await gh2tu.getAssignee( authData, ASSIGNEE1 );
    let assignee2   = await gh2tu.getAssignee( authData, ASSIGNEE2 );
    
    let lab1   = await gh2tu.findOrCreateLabel( authData, td.GHRepoId, false, "",      604 );
    let labNP1 = await gh2tu.findOrCreateLabel( authData, td.GHRepoId, false, LABNP1, -1 );	
    let labNP2 = await gh2tu.findOrCreateLabel( authData, td.GHRepoId, false, LABNP2, -1 );	


    // 1. Simple blast
    let issDat = await gh2tu.blastIssue( authData, td, "Blast 1", [lab1], [assignee1] );               

    await utils.sleep( 1500 );
    await gh2tu.refreshUnclaimed( authData, td );    
    const uncLoc = await gh2tu.getFlatLoc( authData, td.unclaimPID, config.UNCLAIMED, config.UNCLAIMED );

    let title  = "Blast 1";
    let link   = await tu.settleWithVal( "blastLink " + title, blastLink, authData, testLinks, title, td.ceProjectId, td.GHFullName );
    let card   = await gh2tu.getCard( authData, link.hostCardId );
    testStatus = await gh2tu.checkUnclaimedIssue( authData, testLinks, td, uncLoc, issDat, card, testStatus, {label: 604, lblCount: 1, assigns: [assignee1.id]});

    tu.testReport( testStatus, "Test Blast A" );    

    // 2. blast  
    issDat = await gh2tu.blastIssue( authData, td, "Blast 2", [labNP1, lab1, labNP2], [assignee1, assignee2] );
    title  = "Blast 2";
    link   = await tu.settleWithVal( "blastLink " + title, blastLink, authData, testLinks, title, td.ceProjectId, td.GHFullName );    
    card   = await gh2tu.getCard( authData, link.hostCardId );
    testStatus = await gh2tu.checkUnclaimedIssue( authData, testLinks, td, uncLoc, issDat, card, testStatus, {label: 604, lblCount: 3, assigns: [assignee1.id, assignee2.id]});

    tu.testReport( testStatus, "Test Blast B" );    

    // 3. blast  
    issDat = await gh2tu.blastIssue( authData, td, "Blast 3", [lab1, labNP2], [assignee1, assignee2] );               
    title  = "Blast 3";
    link   = await tu.settleWithVal( "blastLink " + title, blastLink, authData, testLinks, title, td.ceProjectId, td.GHFullName );
    card   = await gh2tu.getCard( authData, link.hostCardId );
    testStatus = await gh2tu.checkUnclaimedIssue( authData, testLinks, td, uncLoc, issDat, card, testStatus, {label: 604, lblCount: 2, assigns: [assignee1.id, assignee2.id]});

    tu.testReport( testStatus, "Test Blast C" );    

    // 4. blast  
    issDat = await gh2tu.blastIssue( authData, td, "Blast 4", [labNP1, lab1], [assignee1, assignee2] );
    title  = "Blast 4";
    link   = await tu.settleWithVal( "blastLink " + title, blastLink, authData, testLinks, title, td.ceProjectId, td.GHFullName );
    card   = await gh2tu.getCard( authData, link.hostCardId );
    testStatus = await gh2tu.checkUnclaimedIssue( authData, testLinks, td, uncLoc, issDat, card, testStatus, {label: 604, lblCount: 2, assigns: [assignee1.id, assignee2.id]});

    tu.testReport( testStatus, "Test Blast D" );    

    // 5. blast  
    issDat = await gh2tu.blastIssue( authData, td, "Blast 5", [labNP1, labNP2, lab1], [assignee2, assignee1] );               
    title  = "Blast 5";
    link   = await tu.settleWithVal( "blastLink " + title, blastLink, authData, testLinks, title, td.ceProjectId, td.GHFullName );
    card   = await gh2tu.getCard( authData, link.hostCardId );
    testStatus = await gh2tu.checkUnclaimedIssue( authData, testLinks, td, uncLoc, issDat, card, testStatus, {label: 604, lblCount: 3, assigns: [assignee2.id, assignee1.id]});

    tu.testReport( testStatus, "Test Blast E" );    

    // 6. blast, undo
    issDat = await gh2tu.blastIssue( authData, td, "Blast 6", [lab1, labNP1, labNP2], [assignee1, assignee2] );
    await utils.sleep( 1500 );
    await gh2tu.remAssignee( authData, td, issDat[1], assignee2 );
    await gh2tu.remAssignee( authData, td, issDat[1], assignee1 );
    await gh2tu.remLabel( authData, labNP1, issDat );    
    await gh2tu.remLabel( authData, labNP2, issDat );    
    
    title  = "Blast 6";
    link   = await tu.settleWithVal( "blastLink " + title, blastLink, authData, testLinks, title, td.ceProjectId, td.GHFullName );
    card   = await gh2tu.getCard( authData, link.hostCardId );
    // Assigns show up still - peq assignees not updated once created until ceFlutter
    testStatus = await gh2tu.checkUnclaimedIssue( authData, testLinks, td, uncLoc, issDat, card, testStatus, {label: 604, lblCount: 1, assigns: [assignee1.id, assignee2.id]});

    tu.testReport( testStatus, "Test Blast F" );    

    // Clean
    await gh2tu.delLabel( authData, labNP1 );
    await gh2tu.delLabel( authData, labNP2 );
    
    tu.testReport( testStatus, "Test Blast" );
    return testStatus;
}



async function runTests( authData, testLinks, td ) {

    console.log( "Basic Flow tests =================" );

    let testStatus = [ 0, 0, []];

    // Stop and check each step
    let t1 = await testStepByStep( authData, testLinks, td );

    // Endpoint only, no waiting 
    let t2 = await testEndpoint( authData, testLinks, td );

    // Blast tests
    let t3 = await testBlast( authData, testLinks, td );
    
    // Basic flow alloc already done in setup.  Basically, create.  Period.

    testStatus = tu.mergeTests( testStatus, t1 );
    testStatus = tu.mergeTests( testStatus, t2 );
    testStatus = tu.mergeTests( testStatus, t3 );
    return testStatus
}


exports.runTests = runTests;
