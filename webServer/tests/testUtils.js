var utils = require('../utils');
var ghUtils = require('../ghUtils');
var config  = require('../config');
var assert = require('assert');

var gh = ghUtils.githubUtils;

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


async function hasRaw( source, pactId ) {
    let retVal = false;
    let praw = await utils.getRaw( source, pactId );
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
    let status = await utils.getRepoStatus( installClient[1], td.GHFullName );
    let statusIds = status == -1 ? [] : [ [status.GHRepo] ];
    console.log( "Dynamo status id", statusIds );
    await utils.cleanDynamo( installClient[1], "CERepoStatus", statusIds );
}


async function makeProject(installClient, td, name, body ) {
    let pid = await installClient[0].projects.createForRepo({ owner: td.GHOwner, repo: td.GHRepo, name: name, body: body })
	.then((project) => { return  project.data.id; })
	.catch( e => { console.log( installClient[1], "Create project failed.", e ); });

    console.log( "MakeProject:", name, pid );
    utils.sleep( 300 );
    return pid;
}

async function makeColumn( installClient, projId, name ) {
    
    let cid = await installClient[0].projects.createColumn({ project_id: projId, name: name })
	.then((column) => { return column.data.id; })
	.catch( e => { console.log( installClient[1], "Create column failed.", e ); });

    console.log( "MakeColumn:", name, cid );
    utils.sleep( 300 );
    return cid;
}

async function make4xCols( installClient, projId ) {

    let plan = await makeColumn( installClient, projId, config.PROJ_COLS[ config.PROJ_PLAN ] );
    let prog = await makeColumn( installClient, projId, config.PROJ_COLS[ config.PROJ_PROG ] );
    let pend = await makeColumn( installClient, projId, config.PROJ_COLS[ config.PROJ_PEND ] );
    let accr = await makeColumn( installClient, projId, config.PROJ_COLS[ config.PROJ_ACCR ] );
	
    utils.sleep( 300 );
    return [prog, plan, pend, accr];
}

async function makeAllocCard( installClient, colId, title, amount ) {
    let note = title + "\n<allocation, PEQ: " + amount + ">";
    
    let cid = await installClient[0].projects.createCard({ column_id: colId, note: note })
	.then((card) => { return card.data.id; })
	.catch( e => { console.log( installClient[1], "Create newborn card failed.", e ); });

    console.log( "MakeCard:", cid );
    utils.sleep( 300 );
    return cid;
}

async function makeNewbornCard( installClient, colId, title ) {
    let note = title;
    
    let cid = await installClient[0].projects.createCard({ column_id: colId, note: note })
	.then((card) => { return card.data.id; })
	.catch( e => { console.log( installClient[1], "Create newborn card failed.", e ); });

    utils.sleep( 300 );
    return cid;
}

async function makeProjectCard( installClient, colId, issueId ) {
    let card = await gh.createProjectCard( installClient, colId, issueId );
    utils.sleep( 300 );
    return card;
}

async function makeIssue( installClient, td, title, labels ) {
    let issue = await gh.createIssue( installClient, td.GHOwner, td.GHRepo, title, labels, false );
    utils.sleep( 300 );
    return issue;
}

async function addLabel( installClient, td, issueNumber, labelName ) {
    await installClient[0].issues.addLabels({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, labels: [labelName] })
	.catch( e => { console.log( installClient[1], "Add label failed.", e ); });
}	

async function addAssignee( installClient, td, issueNumber, assignee ) {
    await installClient[0].issues.addAssignees({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, assignees: [assignee] })
	.catch( e => { console.log( installClient[1], "Add assignee failed.", e ); });
}

async function moveCard( installClient, cardId, columnId ) {
    await installClient[0].projects.moveCard({ card_id: cardId, position: "top", column_id: columnId })
	.catch( e => { console.log( installClient[1], "Move card failed.", e );	});
}

async function closeIssue( installClient, td, issueNumber ) {
    await installClient[0].issues.update({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, state: "closed" })
	.catch( e => { console.log( installClient[1], "Close issue failed.", e );	});
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
exports.addAssignee     = addAssignee;
exports.moveCard        = moveCard;
exports.closeIssue      = closeIssue;

exports.hasRaw          = hasRaw; 
exports.getPeqLabels    = getPeqLabels;
exports.getIssues       = getIssues;
exports.getProjects     = getProjects;
exports.getColumns      = getColumns;
exports.getCards        = getCards;
exports.findIssue        = findIssue;

exports.findCardForIssue = findCardForIssue;
exports.setUnpopulated   = setUnpopulated;

exports.checkEq         = checkEq;
exports.checkGE         = checkGE;
exports.checkAr         = checkAr;
exports.testReport      = testReport;
