var utils = require('../utils');
var config  = require('../config');
var assert = require('assert');

var ghUtils = require('../ghUtils');
var gh      = ghUtils.githubUtils;
var ghSafe  = ghUtils.githubSafe;

const MIN_DELAY = 1000;   // Make up for rest variance, and GH slowness.  Expect 500-1000


// Had to add a small sleep in each make* - GH seems to get confused if requests come in too fast


async function refresh( installClient, td, projName ){
    if( td.masterPID != config.EMPTY ) { return; }

    await installClient[0].projects.listForRepo({ owner: td.GHOwner, repo: td.GHRepo, state: "open" })
	.then((projects) => {
	    for( const project of projects.data ) {
		if( project.name ==  projName ) { td.masterPID = project.id; }
	    }
	})
	.catch( e => { console.log( installClient[1], "list projects failed.", e ); });
}

// Refresh a recommended project layout.  This is useful when running tests piecemeal.
async function refreshRec( installClient, td ) {
    let projects = await getProjects( installClient, td );
    for( const proj of projects ) {
	if( proj.name == config.MAIN_PROJ ) {
	    td.masterPID = proj.id;

	    let columns = await getColumns( installClient, proj.id );
	    for( const col of columns ) {
		if( col.name == td.softContTitle ) { td.scColID = col.id; }
		if( col.name == td.busOpsTitle )   { td.boColID = col.id; }
		if( col.name == td.unallocTitle )  { td.unColID = col.id; }
	    }
	}
	if( proj.name == td.dataSecTitle )   { td.dataSecPID = proj.id; }
	if( proj.name == td.githubOpsTitle ) { td.githubOpsPID = proj.id; }
    }
    assert( td.masterPID != -1 );
    assert( td.dataSecPID != -1 );
    assert( td.githubOpsPID != -1 );

    let columns = await getColumns( installClient, td.dataSecPID );
    for( const col of columns ) {
	if( col.name == config.PROJ_COLS[ config.PROJ_PLAN ] ) { td.dsPlanID = col.id; }
	if( col.name == config.PROJ_COLS[ config.PROJ_PROG ] ) { td.dsProgID = col.id; }
	if( col.name == config.PROJ_COLS[ config.PROJ_PEND ] ) { td.dsPendID = col.id; }
	if( col.name == config.PROJ_COLS[ config.PROJ_ACCR ] ) { td.dsAccrID = col.id; }
    }
    columns = await getColumns( installClient, td.githubOpsPID );
    for( const col of columns ) {
	if( col.name == config.PROJ_COLS[ config.PROJ_PROG ] ) { td.ghProgID = col.id; }
    }
    
}

// Refresh a flat project layout.  This is useful when running tests piecemeal.
async function refreshFlat( installClient, td ) {
    let projects = await getProjects( installClient, td );
    for( const proj of projects ) {
	if( proj.name == td.flatTitle ) {
	    td.flatPID = proj.id;

	    let columns = await getColumns( installClient, proj.id );
	    for( const col of columns ) {
		if( col.name == td.col1Title )  { td.col1ID = col.id; }
		if( col.name == td.col2Title )  { td.col2ID = col.id; }
	    }
	}
    }
    assert( td.flatPID != -1 );
}

// Refresh unclaimed.
async function refreshUnclaimed( installClient, td ) {
    let projects = await getProjects( installClient, td );
    for( const proj of projects ) {
	if( proj.name == td.unclaimTitle ) {
	    td.unclaimPID = proj.id;

	    let columns = await getColumns( installClient, proj.id );
	    for( const col of columns ) {
		if( col.name == td.unclaimTitle )  { td.unclaimCID = col.id; }
	    }
	}
    }
    assert( td.unclaimPID != -1 );
}

// Build map from issue_num to issue
function buildIssueMap( issues ) {
    let m = {};
    for( const issue of issues ) {
	m[issue.number] = issue;
    }
    return m;
}

// [ cardId, issueNum, issueId, issueTitle]
function getQuad( card, issueMap ) {
    if( !card.hasOwnProperty( 'content_url' )) { return [card.id, -1, -1, ""]; }

    let parts = card['content_url'].split('/');
    let issNum = parts[ parts.length - 1] ;
    let issue = issueMap[issNum];
    
    return [card.id, issNum, issue.id, issue.title];
}

function makeTitleReducer( aStr ) {
    // return ( acc, cur ) => ( console.log( cur, acc, aStr) || acc || cur.includes( aStr ) ); 
    return ( acc, cur ) => ( acc || cur.includes( aStr ) ); 
}


async function hasRaw( installClient, pactId ) {
    let retVal = false;
    let praw = await utils.getRaw( installClient, pactId );
    if( praw != -1 ) { retVal = true; }
    return retVal;
}

async function getPeqLabels( installClient, td ) {
    let peqLabels = "";

    await( installClient[0].issues.listLabelsForRepo( { owner: td.GHOwner, repo: td.GHRepo }))
	.then( labels => { peqLabels = labels['data']; })
	.catch( e => { console.log( installClient[1], "list projects failed.", e ); });

    return peqLabels;
}

async function getIssues( installClient, td ) {
    let issues = "";

    await( installClient[0].issues.listForRepo( { owner: td.GHOwner, repo: td.GHRepo, state: "all" }))
	.then( allissues => { issues = allissues['data']; })
	.catch( e => { console.log( installClient[1], "list issues failed.", e ); });

    return issues;
}

async function getProjects( installClient, td ) {
    let projects = "";

    await( installClient[0].projects.listForRepo( { owner: td.GHOwner, repo: td.GHRepo }))
	.then( allproj => { projects = allproj['data']; })
	.catch( e => { console.log( installClient[1], "list projects failed.", e ); });

    return projects;
}

async function getColumns( installClient, projId ) {
    let cols = "";

    await( installClient[0].projects.listColumns( { project_id: projId }))
	.then( allcols => { cols = allcols['data']; })
	.catch( e => { console.log( installClient[1], "list columns failed.", e ); });

    return cols;
}

async function getCards( installClient, colId ) {
    let cards = "";

    await( installClient[0].projects.listCards( { column_id: colId }))
	.then( allcards => { cards = allcards['data']; })
	.catch( e => { console.log( installClient[1], "list cards failed.", e ); });

    return cards;
}

// Get everything from ceServer
async function getLinks( installClient, ghLinks, query ) {
    let postData = {"Endpoint": "Testing", "Request": "getLinks" };
    let linkData = await utils.postCE( "Grog", JSON.stringify( postData ));
    ghLinks.fromJson( linkData );
    return ghLinks.getLinks( installClient, query );
}

async function findIssue( installClient, td, issueTitle ) {
    let retVal = -1;
    let issues = await getIssues( installClient, td );
    for( const issue of issues ) {
	if( issue.title == issueTitle ){
	    retVal = issue;
	    break;
	}
    }
    return retVal; 
}

function findCardForIssue( cards, issueNum ) {
    let cardId = -1;
    for( const card of cards ) {
	let parts = card['content_url'].split('/');
	let issNum = parts[ parts.length - 1] ;
	if( issNum == issueNum ) {
	    cardId = card.id;
	    break;
	}
    }

    return cardId;
}

async function setUnpopulated( installClient, td ) {
    let status = await utils.getRepoStatus( installClient, td.GHFullName );
    let statusIds = status == -1 ? [] : [ [status.GHRepo] ];
    console.log( "Dynamo status id", statusIds );
    await utils.cleanDynamo( installClient, "CERepoStatus", statusIds );
}


async function makeProject(installClient, td, name, body ) {
    let pid = await installClient[0].projects.createForRepo({ owner: td.GHOwner, repo: td.GHRepo, name: name, body: body })
	.then((project) => { return  project.data.id; })
	.catch( e => { console.log( installClient[1], "Create project failed.", e ); });

    console.log( "MakeProject:", name, pid );
    await utils.sleep( MIN_DELAY );
    return pid;
}

async function makeColumn( installClient, projId, name ) {
    
    let cid = await installClient[0].projects.createColumn({ project_id: projId, name: name })
	.then((column) => { return column.data.id; })
	.catch( e => { console.log( installClient[1], "Create column failed.", e ); });

    console.log( "MakeColumn:", name, cid );
    await utils.sleep( MIN_DELAY );
    return cid;
}

async function make4xCols( installClient, projId ) {

    let plan = await makeColumn( installClient, projId, config.PROJ_COLS[ config.PROJ_PLAN ] );
    let prog = await makeColumn( installClient, projId, config.PROJ_COLS[ config.PROJ_PROG ] );
    let pend = await makeColumn( installClient, projId, config.PROJ_COLS[ config.PROJ_PEND ] );
    let accr = await makeColumn( installClient, projId, config.PROJ_COLS[ config.PROJ_ACCR ] );
	
    await utils.sleep( MIN_DELAY );
    return [prog, plan, pend, accr];
}

async function makeAllocCard( installClient, colId, title, amount ) {
    let note = title + "\n<allocation, PEQ: " + amount + ">";
    
    let cid = await installClient[0].projects.createCard({ column_id: colId, note: note })
	.then((card) => { return card.data.id; })
	.catch( e => { console.log( installClient[1], "Create newborn card failed.", e ); });

    console.log( "MakeCard:", cid );
    await utils.sleep( MIN_DELAY );
    return cid;
}

async function makeNewbornCard( installClient, colId, title ) {
    let note = title;
    
    let cid = await installClient[0].projects.createCard({ column_id: colId, note: note })
	.then((card) => { return card.data.id; })
	.catch( e => { console.log( installClient[1], "Create newborn card failed.", e ); });

    await utils.sleep( MIN_DELAY );
    return cid;
}

async function makeProjectCard( installClient, colId, issueId ) {
    let card = await ghSafe.createProjectCard( installClient, colId, issueId );
    await utils.sleep( MIN_DELAY );
    return card;
}

async function makeIssue( installClient, td, title, labels ) {
    let issue = await ghSafe.createIssue( installClient, td.GHOwner, td.GHRepo, title, labels, false );
    issue.push( title );
    await utils.sleep( MIN_DELAY );
    return issue;
}

async function addLabel( installClient, td, issueNumber, labelName ) {
    await installClient[0].issues.addLabels({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, labels: [labelName] })
	.catch( e => { console.log( installClient[1], "Add label failed.", e ); });
    await utils.sleep( MIN_DELAY );
}	

async function remLabel( installClient, td, issueNumber, label ) {
    console.log( "Removing", label.name, "from issueNum", issueNumber );
    await installClient[0].issues.removeLabel({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, name: label.name })
	.catch( e => { console.log( installClient[1], "Remove label failed.", e ); });
    await utils.sleep( MIN_DELAY );
}

async function addAssignee( installClient, td, issueNumber, assignee ) {
    await installClient[0].issues.addAssignees({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, assignees: [assignee] })
	.catch( e => { console.log( installClient[1], "Add assignee failed.", e ); });
    await utils.sleep( MIN_DELAY );
}

async function remAssignee( installClient, td, issueNumber, assignee ) {
    await installClient[0].issues.removeAssignees({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, assignees: [assignee] })
	.catch( e => { console.log( installClient[1], "Remove assignee failed.", e ); });
    await utils.sleep( MIN_DELAY );
}

async function moveCard( installClient, cardId, columnId ) {
    await installClient[0].projects.moveCard({ card_id: cardId, position: "top", column_id: columnId })
	.catch( e => { console.log( installClient[1], "Move card failed.", e );	});
    await utils.sleep( MIN_DELAY );
}

async function closeIssue( installClient, td, issueNumber ) {
    await installClient[0].issues.update({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, state: "closed" })
	.catch( e => { console.log( installClient[1], "Close issue failed.", e );	});
    await utils.sleep( MIN_DELAY );
}

function checkEq( lhs, rhs, testStatus, msg ) {
    if( lhs == rhs ) {
	testStatus[0]++;
    }
    else {
	testStatus[1]++;
	testStatus[2].push( msg + ": " + lhs );
    }
    return testStatus;
}

function checkGE( lhs, rhs, testStatus, msg ) {
    if( lhs >= rhs ) {
	testStatus[0]++;
    }
    else {
	testStatus[1]++;
	testStatus[2].push( msg + ": " + lhs );
    }
    return testStatus;
}

function checkLE( lhs, rhs, testStatus, msg ) {
    return checkGE( rhs, lhs, testStatus, msg );
}

function checkAr( lhs, rhs, testStatus, msg ) {
    let test = true;
    if( lhs.length != rhs.length ) { test = false; }
    else {
	for( let i = 0; i < lhs.length; i++ ) {
	    if( lhs[i] != rhs[i] ) {
		test = false;
		break;
	    }
	}
    }
	
    if( test ) {
	testStatus[0]++;
    }
    else {
	testStatus[1]++;
	testStatus[2].push( msg + ": " + lhs );
    }
    return testStatus;
}

function testReport( testStatus, component ) {
    let count = testStatus[0] + testStatus[1];
    if( testStatus[1] == 0 ) { console.log( count, "Tests for", component, ".. All Passed." ); }
    else                     { console.log( count, "Tests results for", component, ".. failed test count:", testStatus[1] ); }

    for( const failure of testStatus[2] ) {
	console.log( "   failed test:", failure );
    }
}


async function checkCardedIssue( installClient, ghLinks, td, loc, issueData, card, testStatus ) {
    
    // CHECK github issues
    let issue  = await findIssue( installClient, td, issueData[2] );
    testStatus = checkEq( issue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = checkEq( issue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = checkEq( issue.labels.length, 0,                testStatus, "Issue label" );

    // CHECK github location
    let cards  = await getCards( installClient, td.unclaimCID );   
    let tCard  = cards.filter((card) => card.content_url.split('/').pop() == issueData[1].toString() );
    testStatus = checkEq( tCard.length, 0,                       testStatus, "No unclaimed" );

    cards      = await getCards( installClient, loc.colId );   
    let mCard  = cards.filter((card) => card.content_url.split('/').pop() == issueData[1].toString() );
    testStatus = checkEq( mCard.length, 1,                       testStatus, "Card claimed" );
    testStatus = checkEq( mCard[0].id, card.id,                  testStatus, "Card claimed" );

    // CHECK dynamo linkage
    let links  = await getLinks( installClient, ghLinks, { "repo": td.GHFullName } );
    let link   = ( links.filter((link) => link.GHIssueId == issueData[0] ))[0];
    testStatus = checkEq( link.GHIssueNum, issueData[1].toString(), testStatus, "Linkage Issue num" );
    testStatus = checkEq( link.GHCardId, card.id,                   testStatus, "Linkage Card Id" );
    testStatus = checkEq( link.GHColumnName, loc.colName,           testStatus, "Linkage Col name" );
    testStatus = checkEq( link.GHCardTitle, issueData[2],           testStatus, "Linkage Card Title" );
    testStatus = checkEq( link.GHProjectName, loc.projName,         testStatus, "Linkage Project Title" );
    testStatus = checkEq( link.GHColumnId, loc.colId,               testStatus, "Linkage Col Id" );
    testStatus = checkEq( link.GHProjectId, loc.projId,             testStatus, "Linkage project id" );

    // CHECK dynamo Peq.  inactive, if it exists
    let peqs      = await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });
    let issuePeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0] );
    testStatus = checkLE( issuePeqs.length, 1,                      testStatus, "Peq count" );
    if( issuePeqs.length == 1 ) {
	let peq = issuePeqs[1];
	testStatus = checkEq( peq.Active, "false",                  testStatus, "peq should be inactive" );
	testStatus = checkEq( peq.GHIssueTitle, issueData[2],       testStatus, "peq title is wrong" );
	testStatus = checkEq( peq.CEGrantorId, config.EMPTY,        testStatus, "peq grantor wrong" );
	// The rest can vary
    }

    // CHECK dynamo Pact
    let pacts = await utils.getPActs( installClient, {"GHRepo": td.GHFullName} );
    let peqId = issuePeqs.length == 1 ? issuePeqs[0].PEQId : -1; 
    let issuePacts = pacts.filter((pact) => pact.Subject[0] == peqId );

    // Must have been a PEQ before. Depeq'd with unlabel, or delete.
    if( issuePacts.length > 0 ) {
	issuePacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
	let lastPact = issuePacts[ issuePacts.length - 1 ];

	let hasraw = await hasRaw( installClient, lastPact.PEQActionId );
	testStatus = checkEq( hasraw, true,                            testStatus, "PAct Raw match" ); 
	testStatus = checkEq( lastPact.Verb, "confirm",                testStatus, "PAct Verb"); 
	testStatus = checkEq( lastPact.Action, "delete",               testStatus, "PAct Verb"); 
	testStatus = checkEq( lastPact.GHUserName, config.TESTER_BOT,  testStatus, "PAct user name" ); 
	testStatus = checkEq( lastPact.Ingested, "false",              testStatus, "PAct ingested" );
	testStatus = checkEq( lastPact.Locked, "false",                testStatus, "PAct locked" );
    }

    return testStatus;
}

async function checkSituatedIssue( installClient, ghLinks, td, loc, issueData, card, testStatus ) {
    
    // CHECK github issues
    let meltIssue = await findIssue( installClient, td, issueData[2] );
    testStatus = checkEq( meltIssue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = checkEq( meltIssue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = checkEq( meltIssue.labels.length, 1,                testStatus, "Issue label" );
    testStatus = checkEq( meltIssue.labels[0].name, "1000 PEQ",      testStatus, "Issue label" );

    // CHECK github location
    let cards = await getCards( installClient, td.unclaimCID );   
    let tCard = cards.filter((card) => card.content_url.split('/').pop() == issueData[1].toString() );
    testStatus = checkEq( tCard.length, 0,                           testStatus, "No unclaimed" );

    cards = await getCards( installClient, loc.colId );   
    let mCard = cards.filter((card) => card.content_url.split('/').pop() == issueData[1].toString() );
    testStatus = checkEq( mCard.length, 1,                           testStatus, "Card claimed" );
    testStatus = checkEq( mCard[0].id, card.id,                      testStatus, "Card claimed" );

    // CHECK dynamo linkage
    let links    = await getLinks( installClient, ghLinks, { "repo": td.GHFullName } );
    let meltLink = ( links.filter((link) => link.GHIssueId == issueData[0] ))[0];
    testStatus = checkEq( meltLink.GHIssueNum, issueData[1].toString(), testStatus, "Linkage Issue num" );
    testStatus = checkEq( meltLink.GHCardId, card.id,                   testStatus, "Linkage Card Id" );
    testStatus = checkEq( meltLink.GHColumnName, loc.colName,           testStatus, "Linkage Col name" );
    testStatus = checkEq( meltLink.GHCardTitle, issueData[2],           testStatus, "Linkage Card Title" );
    testStatus = checkEq( meltLink.GHProjectName, loc.projName,         testStatus, "Linkage Project Title" );
    testStatus = checkEq( meltLink.GHColumnId, loc.colId,               testStatus, "Linkage Col Id" );
    testStatus = checkEq( meltLink.GHProjectId, loc.projId,             testStatus, "Linkage project id" );

    // CHECK dynamo Peq
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0] );
    testStatus = checkLE( meltPeqs.length, 2,                          testStatus, "Peq count" );
    let peq = meltPeqs[0].Active == "true" ? meltPeqs[0] : meltPeqs[1];
    
    testStatus = checkEq( peq.PeqType, loc.peqType,                testStatus, "peq type invalid" );        
    testStatus = checkEq( peq.GHProjectSub.length, 2,              testStatus, "peq project sub invalid" ); // XXX
    testStatus = checkEq( peq.GHIssueTitle, issueData[2],          testStatus, "peq title is wrong" );
    testStatus = checkEq( peq.GHHolderId.length, 0,                testStatus, "peq holders wrong" );        // XXX
    testStatus = checkEq( peq.CEHolderId.length, 0,                testStatus, "peq holders wrong" );    
    testStatus = checkEq( peq.CEGrantorId, config.EMPTY,           testStatus, "peq grantor wrong" );       // XXX
    testStatus = checkEq( peq.Amount, 1000,                        testStatus, "peq amount" );
    testStatus = checkEq( peq.GHProjectSub[0], loc.projSub[0],     testStatus, "peq project sub invalid" );
    testStatus = checkEq( peq.GHProjectSub[1], loc.projSub[1],     testStatus, "peq project sub invalid" );  // XXX
    testStatus = checkEq( peq.GHProjectId, loc.projId,             testStatus, "peq unclaimed PID bad" );
    testStatus = checkEq( peq.Active, "true",                      testStatus, "peq" );

    // CHECK dynamo Pact
    let pacts     = await utils.getPActs( installClient, {"GHRepo": td.GHFullName} );
    let meltPacts = pacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    testStatus = checkGE( meltPacts.length, 1,                         testStatus, "PAct count" );  

    // Could have been many operations on this.
    for( const pact of meltPacts ) {
	let hasraw = await hasRaw( installClient, pact.PEQActionId );
	testStatus = checkEq( hasraw, true,                            testStatus, "PAct Raw match" ); 
	testStatus = checkEq( pact.GHUserName, config.TESTER_BOT,      testStatus, "PAct user name" ); 
	testStatus = checkEq( pact.Ingested, "false",                  testStatus, "PAct ingested" );
	testStatus = checkEq( pact.Locked, "false",                    testStatus, "PAct locked" );
    }

    return testStatus;
}

async function checkNewlySituatedIssue( installClient, ghLinks, td, loc, issueData, card, testStatus ) {

    testStatus = await checkSituatedIssue( installClient, ghLinks, td, loc, issueData, card, testStatus );

    // CHECK dynamo Peq
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0] );
    testStatus = checkEq( meltPeqs.length, 2,                          testStatus, "Peq count" );
    let meltPeq = meltPeqs[0].Active == "true" ? meltPeqs[0] : meltPeqs[1];
    let deadPeq = meltPeqs[0].Active == "true" ? meltPeqs[1] : meltPeqs[0];
    for( const peq of meltPeqs ) {
	testStatus = checkEq( peq.PeqType, loc.peqType,                testStatus, "peq type invalid" );       
	testStatus = checkEq( peq.GHProjectSub.length, 2,              testStatus, "peq project sub invalid" );
	testStatus = checkEq( peq.GHIssueTitle, issueData[2],          testStatus, "peq title is wrong" );
	testStatus = checkEq( peq.GHHolderId.length, 0,                testStatus, "peq holders wrong" );
	testStatus = checkEq( peq.CEHolderId.length, 0,                testStatus, "peq holders wrong" );
	testStatus = checkEq( peq.CEGrantorId, config.EMPTY,           testStatus, "peq grantor wrong" );
	testStatus = checkEq( peq.Amount, 1000,                        testStatus, "peq amount" );
    }
    testStatus = checkEq( meltPeq.GHProjectSub[0], loc.projSub[0],     testStatus, "peq project sub invalid" );
    testStatus = checkEq( meltPeq.GHProjectSub[1], loc.projSub[1],     testStatus, "peq project sub invalid" );  // XXX
    testStatus = checkEq( meltPeq.GHProjectId, loc.projId,             testStatus, "peq unclaimed PID bad" );
    testStatus = checkEq( meltPeq.Active, "true",                      testStatus, "peq" );

    testStatus = checkEq( deadPeq.GHProjectSub[0], config.UNCLAIMED,   testStatus, "peq project sub invalid" );
    testStatus = checkEq( deadPeq.GHProjectSub[1], config.UNCLAIMED,   testStatus, "peq project sub invalid" );
    testStatus = checkEq( deadPeq.GHProjectId, td.unclaimPID,          testStatus, "peq unclaimed PID bad" );
    testStatus = checkEq( deadPeq.Active, "false",                     testStatus, "peq" );


    // CHECK dynamo Pact
    let pacts = await utils.getPActs( installClient, {"GHRepo": td.GHFullName} );
    let mps = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    let dps = pacts.filter((pact) => pact.Subject[0] == deadPeq.PEQId );
    let meltPacts = mps.concat( dps );
    testStatus = checkEq( meltPacts.length, 3,                         testStatus, "PAct count" );          // XXX
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let addUncl  = meltPacts[0];
    let remUncl  = meltPacts[1];
    let meltPact = meltPacts[2];
    for( const pact of meltPacts ) {
	let hasraw = await hasRaw( installClient, pact.PEQActionId );
	testStatus = checkEq( hasraw, true,                            testStatus, "PAct Raw match" ); 
	testStatus = checkEq( pact.Verb, "confirm",                    testStatus, "PAct Verb"); 
	testStatus = checkEq( pact.GHUserName, config.TESTER_BOT,      testStatus, "PAct user name" ); 
	testStatus = checkEq( pact.Ingested, "false",                  testStatus, "PAct ingested" );
	testStatus = checkEq( pact.Locked, "false",                    testStatus, "PAct locked" );
    }
    testStatus = checkEq( addUncl.Action, "add",                       testStatus, "PAct Verb"); 
    testStatus = checkEq( remUncl.Action, "delete",                    testStatus, "PAct Verb"); 
    testStatus = checkEq( meltPact.Action, "add",                      testStatus, "PAct Verb"); 

    return testStatus;
}

async function checkAssignees( installClient, td, issueName, ass1, ass2, issueData, testStatus ) {
    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    
    // CHECK github issues
    let meltIssue = await findIssue( installClient, td, issueName );
    testStatus = checkEq( meltIssue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = checkEq( meltIssue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = checkEq( meltIssue.assignees.length, 2,             testStatus, "Issue assignee count" );
    testStatus = checkEq( meltIssue.assignees[0].login, ass1,        testStatus, "assignee1" );
    testStatus = checkEq( meltIssue.assignees[1].login, ass2,        testStatus, "assignee2" );

    // CHECK Dynamo PEQ
    // Should be no change
    let peqs =  await utils.getPeqs( installClient, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0] );
    testStatus = checkEq( meltPeqs.length, 2,                          testStatus, "Peq count" );
    let meltPeq = meltPeqs[0].Active == "true" ? meltPeqs[0] : meltPeqs[1];
    testStatus = checkEq( meltPeq.PeqType, "plan",                     testStatus, "peq type invalid" );
    testStatus = checkEq( meltPeq.GHProjectSub.length, 2,              testStatus, "peq project sub invalid" );
    testStatus = checkEq( meltPeq.GHIssueTitle, issueName,             testStatus, "peq title is wrong" );
    testStatus = checkEq( meltPeq.GHHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = checkEq( meltPeq.CEHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = checkEq( meltPeq.CEGrantorId, config.EMPTY,           testStatus, "peq grantor wrong" );
    testStatus = checkEq( meltPeq.Amount, 1000,                        testStatus, "peq amount" );
    testStatus = checkEq( meltPeq.GHProjectSub[0], td.softContTitle,   testStatus, "peq project sub invalid" );
    testStatus = checkEq( meltPeq.GHProjectSub[1], td.dataSecTitle,    testStatus, "peq project sub invalid" );
    testStatus = checkEq( meltPeq.GHProjectId, td.dataSecPID,          testStatus, "peq unclaimed PID bad" );
    testStatus = checkEq( meltPeq.Active, "true",                      testStatus, "peq" );

    
    // CHECK Dynamo PAct
    // Should show relevant change action
    let pacts = await utils.getPActs( installClient, {"GHRepo": td.GHFullName} );
    let meltPacts = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    testStatus = checkEq( meltPacts.length, 3,                            testStatus, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let addMP  = meltPacts[0];   // add the issue
    let addA1  = meltPacts[1];   // add assignee 1
    let addA2  = meltPacts[2];   // add assignee 2
    for( const pact of [addMP, addA1, addA2] ) {
	let hasraw = await hasRaw( installClient, pact.PEQActionId );
	testStatus = checkEq( hasraw, true,                            testStatus, "PAct Raw match" ); 
	testStatus = checkEq( pact.Verb, "confirm",                    testStatus, "PAct Verb"); 
	testStatus = checkEq( pact.GHUserName, config.TESTER_BOT,      testStatus, "PAct user name" ); 
	testStatus = checkEq( pact.Ingested, "false",                  testStatus, "PAct ingested" );
	testStatus = checkEq( pact.Locked, "false",                    testStatus, "PAct locked" );
    }
    testStatus = checkEq( addMP.Action, "add",                         testStatus, "PAct Verb"); 
    testStatus = checkEq( addA1.Action, "change",                      testStatus, "PAct Verb"); 
    testStatus = checkEq( addA2.Action, "change",                      testStatus, "PAct Verb"); 
    testStatus = checkEq( addA1.Subject[1], ass1,                      testStatus, "PAct Verb"); 
    testStatus = checkEq( addA2.Subject[1], ass2,                      testStatus, "PAct Verb"); 
    testStatus = checkEq( addA1.Note, "add assignee",                  testStatus, "PAct Verb"); 
    testStatus = checkEq( addA2.Note, "add assignee",                  testStatus, "PAct Verb"); 
    
    return testStatus;
}

exports.refresh         = refresh;
exports.refreshRec      = refreshRec;  
exports.refreshFlat     = refreshFlat;
exports.refreshUnclaimed = refreshUnclaimed;
exports.buildIssueMap   = buildIssueMap;
exports.getQuad         = getQuad;
exports.makeTitleReducer = makeTitleReducer;

exports.makeProject     = makeProject;
exports.makeColumn      = makeColumn;
exports.make4xCols      = make4xCols;
exports.makeAllocCard   = makeAllocCard;
exports.makeNewbornCard = makeNewbornCard;
exports.makeProjectCard = makeProjectCard;
exports.makeIssue       = makeIssue;

exports.addLabel        = addLabel;
exports.remLabel        = remLabel;
exports.addAssignee     = addAssignee;
exports.remAssignee     = remAssignee;
exports.moveCard        = moveCard;
exports.closeIssue      = closeIssue;

exports.hasRaw          = hasRaw; 
exports.getPeqLabels    = getPeqLabels;
exports.getIssues       = getIssues;
exports.getProjects     = getProjects;
exports.getColumns      = getColumns;
exports.getCards        = getCards;
exports.getLinks        = getLinks;
exports.findIssue       = findIssue;

exports.findCardForIssue = findCardForIssue;
exports.setUnpopulated   = setUnpopulated;

exports.checkEq         = checkEq;
exports.checkGE         = checkGE;
exports.checkLE         = checkLE;
exports.checkAr         = checkAr;
exports.testReport      = testReport;

exports.checkNewlySituatedIssue = checkNewlySituatedIssue;
exports.checkSituatedIssue      = checkSituatedIssue;
exports.checkCardedIssue        = checkCardedIssue;
exports.checkAssignees          = checkAssignees;
