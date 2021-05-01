var utils = require('../utils');
var config  = require('../config');
var assert = require('assert');

var ghUtils = require('../ghUtils');
var gh      = ghUtils.githubUtils;
var ghSafe  = ghUtils.githubSafe;

var circBuff  = require('../components/circBuff.js');

// Make up for rest variance, and GH slowness.  Expect 500-1000    Faster is in-person
// Server is fast enough for sub 1s, but GH struggles.
//const MIN_DELAY = 1200;  
const MIN_DELAY = 1800;     
//const MIN_DELAY = 2500;     
const GH_DELAY = 400;

var CETestDelayCount = 0;
const CE_DELAY_MAX = 8;

var CE_Notes = new circBuff.CircularBuffer( config.NOTICE_BUFFER_SIZE );

// Had to add a small sleep in each make* - GH seems to get confused if requests come in too fast


// Fisher-yates (knuth) https://github.com/coolaj86/knuth-shuffle
function shuffle(arr) {
    var temporaryValue, randomIndex;
    var currentIndex = arr.length;
    
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
	
	randomIndex = Math.floor(Math.random() * currentIndex);
	currentIndex -= 1;
	
	temporaryValue = arr[currentIndex];
	arr[currentIndex] = arr[randomIndex];
	arr[randomIndex] = temporaryValue;
    }
    
    return arr;
}


async function refresh( authData, td, projName ){
    if( td.masterPID != config.EMPTY ) { return; }

    await authData.ic.projects.listForRepo({ owner: td.GHOwner, repo: td.GHRepo, state: "open" })
	.then((projects) => {
	    for( const project of projects.data ) {
		if( project.name ==  projName ) { td.masterPID = project.id; }
	    }
	})
	.catch( e => { console.log( authData.who, "list projects failed.", e ); });
}


// Refresh a recommended project layout.  This is useful when running tests piecemeal.
async function refreshRec( authData, td ) {
    let projects = await getProjects( authData, td );
    for( const proj of projects ) {
	if( proj.name == config.MAIN_PROJ ) {
	    td.masterPID = proj.id;

	    let columns = await getColumns( authData, proj.id );
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

    let columns = await getColumns( authData, td.dataSecPID );
    for( const col of columns ) {
	if( col.name == config.PROJ_COLS[ config.PROJ_PLAN ] ) { td.dsPlanID = col.id; }
	if( col.name == config.PROJ_COLS[ config.PROJ_PROG ] ) { td.dsProgID = col.id; }
	if( col.name == config.PROJ_COLS[ config.PROJ_PEND ] ) { td.dsPendID = col.id; }
	if( col.name == config.PROJ_COLS[ config.PROJ_ACCR ] ) { td.dsAccrID = col.id; }
    }
    columns = await getColumns( authData, td.githubOpsPID );
    for( const col of columns ) {
	if( col.name == config.PROJ_COLS[ config.PROJ_PROG ] ) { td.ghProgID = col.id; }
    }
    
}

// Refresh a flat project layout.  This is useful when running tests piecemeal.
async function refreshFlat( authData, td ) {
    let projects = await getProjects( authData, td );
    for( const proj of projects ) {
	if( proj.name == td.flatTitle ) {
	    td.flatPID = proj.id;

	    let columns = await getColumns( authData, proj.id );
	    for( const col of columns ) {
		if( col.name == td.col1Title )  { td.col1ID = col.id; }
		if( col.name == td.col2Title )  { td.col2ID = col.id; }
	    }
	}
    }
    assert( td.flatPID != -1 );
}

// Refresh unclaimed.
async function refreshUnclaimed( authData, td ) {
    let projects = await getProjects( authData, td );
    for( const proj of projects ) {
	if( proj.name == td.unclaimTitle ) {
	    td.unclaimPID = proj.id;

	    let columns = await getColumns( authData, proj.id );
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
    return ( accumulator, cur ) => ( accumulator || cur.includes( aStr ) ); 
}


// Can't just rely on GH for confirmation.  Notification arrival to CE can be much slower, and in this case we need
// CE local state to be updated or the pending operation will fail.  So, MUST expose showLocs, same as showLinks.
async function confirmProject( authData, ghLinks, fullName, projId ) {
    /*
    let retVal = false;
    await( authData.ic.projects.get( { project_id: projId }))
	.then( proj => { retVal = true; })
	.catch( e => { console.log( authData.who, "get project failed.", e ); });
    return retVal;
    */
    
    let locs = await getLocs( authData, ghLinks, { repo: fullName, projId: projId } );
    return locs != -1; 
}

async function confirmColumn( authData, ghLinks, fullName, colId ) {
    /*
    let retVal = false;
    await( authData.ic.projects.getColumn( { column_id: colId }))
	.then( proj => { retVal = true; })
	.catch( e => { console.log( authData.who, "get column failed.", e ); });
    return retVal;
    */
    let locs = await getLocs( authData, ghLinks, { repo: fullName, colId: colId } );
    return locs != -1; 
}

async function hasRaw( authData, pactId ) {
    let retVal = false;
    let praw = await utils.getRaw( authData, pactId );
    if( praw != -1 ) { retVal = true; }
    return retVal;
}

async function getPeqLabels( authData, td ) {
    let peqLabels = -1;

    await( authData.ic.issues.listLabelsForRepo( { owner: td.GHOwner, repo: td.GHRepo }))
	.then( labels => { peqLabels = labels['data']; })
	.catch( e => { console.log( authData.who, "list projects failed.", e ); });

    return peqLabels;
}

async function getIssues( authData, td ) {
    let issues = -1;

    await( authData.ic.issues.listForRepo( { owner: td.GHOwner, repo: td.GHRepo, state: "all" }))
	.then( allissues => { issues = allissues['data']; })
	.catch( e => { console.log( authData.who, "list issues failed.", e ); });

    return issues;
}

async function getProjects( authData, td ) {
    let projects = -1;

    await( authData.ic.projects.listForRepo( { owner: td.GHOwner, repo: td.GHRepo }))
	.then( allproj => { projects = allproj['data']; })
	.catch( e => { console.log( authData.who, "list projects failed.", e ); });

    return projects;
}

async function getColumns( authData, projId ) {
    let cols = -1;

    await( authData.ic.projects.listColumns( { project_id: projId }))
	.then( allcols => { cols = allcols['data']; })
	.catch( e => { console.log( authData.who, "list columns failed.", e ); });

    return cols;
}

async function getCards( authData, colId ) {
    let cards = -1;

    if( colId != config.EMPTY ) {
	await( authData.ic.projects.listCards( { column_id: colId }))
	    .then( allcards => { cards = allcards['data']; })
	    .catch( e => { console.log( authData.who, "list cards failed.", e ); });
    }

    return cards;
}

async function getCard( authData, cardId ) {
    let card = await gh.getCard( authData, cardId );
    return card;
}

async function getComments( authData, td, issueNum ) {
    let comments = -1;

    await authData.ic.issues.listComments( { owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNum })
	.then( allcom => { comments = allcom['data']; })
	.catch( e => { console.log( authData.who, "list comments failed.", e ); });

    return comments
}


// Get everything from ceServer
async function getLinks( authData, ghLinks, query ) {
    let postData = {"Endpoint": "Testing", "Request": "getLinks" };
    let linkData = await utils.postCE( "testHandler", JSON.stringify( postData ));
    ghLinks.fromJson( linkData );
    return ghLinks.getLinks( authData, query );
}

async function getLocs( authData, ghLinks, query ) {
    let postData = {"Endpoint": "Testing", "Request": "getLocs" };
    let locData = await utils.postCE( "testHandler", JSON.stringify( postData ));
    ghLinks.fromJsonLocs( locData );
    return ghLinks.getLocs( authData, query );
}

async function getNotices() {
    let postData = {"Endpoint": "Testing", "Request": "getNotices" };
    return await utils.postCE( "testHandler", JSON.stringify( postData ));
}

async function findNotice( query ) {
    let notes = await getNotices();
    CE_Notes.fromJson( notes );
    console.log( "NOTICES.  Looking for", query );

    if( Math.random() < .05 ) { console.log(""); CE_Notes.show(); console.log(""); }
    return CE_Notes.find( query );
}

// Purge repo's links n locs from ceServer
async function remLinks( authData, ghLinks, repo ) {
    let postData = {"Endpoint": "Testing", "Request": "purgeLinks", "Repo": repo };
    let res = await utils.postCE( "testHandler", JSON.stringify( postData ));
    return res;
}

// Purge ceJobs from ceServer
async function purgeJobs( repo ) {
    let postData = {"Endpoint": "Testing", "Request": "purgeJobs" }; 
    let res = await utils.postCE( "testHandler", JSON.stringify( postData ));
    return res;
}

async function findIssue( authData, td, issueId ) {
    let retVal = -1;
    let issues = await getIssues( authData, td );
    retVal = issues.find( issue => issue.id == issueId );
    if( typeof retVal == 'undefined' ) { retVal = -1; }
    return retVal; 
}

// Prefer to use findIssue.  IssueNames are not unique.
async function findIssueByName( authData, td, issueName ) {
    let retVal = -1;
    let issues = await getIssues( authData, td );
    retVal = issues.find( issue => issue.title == issueName );
    if( typeof retVal == 'undefined' ) { retVal = -1; }
    return retVal; 
}

async function findProject( authData, td, projId ) {
    let retVal = -1;
    const projects = await getProjects( authData, td );
    retVal = projects.find( proj => proj.id == projId );
    if( typeof retVal == 'undefined' ) { retVal = -1; }
    return retVal; 
}

async function findRepo( authData, td ) {
    let repo = -1;

    await( authData.ic.repos.get( { owner: td.GHOwner, repo: td.GHRepo }))
	.then( r => { repo = r['data']; })
	.catch( e => { console.log( authData.who, "Get repo failed.", e ); });

    return repo;
}

async function getFlatLoc( authData, projId, projName, colName ) {
    const cols = await getColumns( authData, projId );
    let col = cols.find(c => c.name == colName );

    let ptype = config.PEQTYPE_PLAN;
    // no.  ceFlutter makes this happen
    // if( colName == config.PROJ_COLS[config.PROJ_PEND] ) { ptype = "pending"; }
    // if( colName == config.PROJ_COLS[config.PROJ_ACCR] ) { ptype = "grant"; }

    let psub = [projName, colName];
    if( config.PROJ_COLS.includes( colName ) ) { psub = [projName]; }
	
    let loc = {};
    loc.projId   = projId;
    loc.projName = projName;
    loc.colId    = col.id;
    loc.colName  = col.name;
    loc.projSub  = psub;
    loc.peqType  = ptype; // XXX probably need to add alloc

    return loc;
}

async function getFullLoc( authData, masterColName, projId, projName, colName ) {

    let loc = await getFlatLoc( authData, projId, projName, colName );

    loc.projSub  = config.PROJ_COLS.includes( colName ) ? [masterColName, projName] : [masterColName, projName, colName];
    
    return loc;
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

async function setUnpopulated( authData, td ) {
    let status = await utils.getRepoStatus( authData, td.GHFullName );
    let statusIds = status == -1 ? [] : [ [status.GHRepo] ];
    console.log( "Dynamo status id", statusIds );
    await utils.cleanDynamo( authData, "CERepoStatus", statusIds );
}


async function ingestPActs( authData, issueData ) {
    const peq   = await utils.getPeq( authData, issueData[0] );    
    const pacts = await utils.getPActs( authData, {"Subject": [peq.PEQId.toString()], "Ingested": "false"} );
    const pactIds = pacts.map( pact => pact.PEQActionId );
    await utils.ingestPActs( authData, pactIds );
}



async function makeProject(authData, td, name, body ) {
    let pid = await authData.ic.projects.createForRepo({ owner: td.GHOwner, repo: td.GHRepo, name: name, body: body })
	.then((project) => { return  project.data.id; })
	.catch( e => { console.log( authData.who, "Create project failed.", e ); });

    console.log( "MakeProject:", name, pid );
    await utils.sleep( GH_DELAY );
    return pid;
}

async function remProject( authData, projId ) {
    await ( authData.ic.projects.delete( {project_id: projId}) )
	.catch( e => { console.log( authData.who, "Problem in delete Project", e ); });
    await utils.sleep( MIN_DELAY );
}


async function updateColumn( authData, colId, name ) {
    await ghSafe.updateColumn( authData, colId, name );
    await utils.sleep( MIN_DELAY);
}

async function updateProject( authData, projId, name ) {
    await ghSafe.updateProject( authData, projId, name );
    await utils.sleep( MIN_DELAY);
}

async function makeColumn( authData, ghLinks, fullName, projId, name ) {
    // First, wait for projId, can lag
    await settleWithVal( "make col", confirmProject, authData, ghLinks, fullName, projId );
    
    let cid = await authData.ic.projects.createColumn({ project_id: projId, name: name })
	.then((column) => { return column.data.id; })
	.catch( e => { console.log( authData.who, "Create column failed.", e ); });

    console.log( "MakeColumn:", name, cid );
    let query = "project_column created " + name + " " + fullName;
    await settleWithVal( "makeCol", findNotice, query );

    return cid;
}

async function make4xCols( authData, ghLinks, fullName, projId ) {

    let plan = await makeColumn( authData, ghLinks, fullName, projId, config.PROJ_COLS[ config.PROJ_PLAN ] );
    let prog = await makeColumn( authData, ghLinks, fullName, projId, config.PROJ_COLS[ config.PROJ_PROG ] );
    let pend = await makeColumn( authData, ghLinks, fullName, projId, config.PROJ_COLS[ config.PROJ_PEND ] );
    let accr = await makeColumn( authData, ghLinks, fullName, projId, config.PROJ_COLS[ config.PROJ_ACCR ] );
	
    await utils.sleep( MIN_DELAY );
    return [prog, plan, pend, accr];
}


// do NOT return card or id here.  card is rebuilt to be driven from issue.
async function makeAllocCard( authData, ghLinks, fullName, colId, title, amount ) {
    // First, wait for colId, can lag
    await settleWithVal( "make alloc card", confirmColumn, authData, ghLinks, fullName, colId );

    let note = title + "\n<allocation, PEQ: " + amount + ">";
    
    let card = await authData.ic.projects.createCard({ column_id: colId, note: note })
	.then( c => c.data )
	.catch( e => console.log( authData.who, "Create alloc card failed.", e ));

    console.log( "Made AllocCard:", card.id, "but this will be deleted to make room for issue-card" );
    await utils.sleep( MIN_DELAY );
}

async function makeNewbornCard( authData, ghLinks, fullName, colId, title ) {
    // First, wait for colId, can lag
    await settleWithVal( "make newbie card", confirmColumn, authData, ghLinks, fullName, colId );

    let note = title;
    
    let cid = await authData.ic.projects.createCard({ column_id: colId, note: note })
	.then((card) => { return card.data.id; })
	.catch( e => { console.log( authData.who, "Create newborn card failed.", e ); });

    await utils.sleep( MIN_DELAY );
    return cid;
}

async function makeProjectCard( authData, ghLinks, fullName, colId, issueId ) {
    // First, wait for colId, can lag
    await settleWithVal( "make Proj card", confirmColumn, authData, ghLinks, fullName, colId );

    let card = await ghSafe.createProjectCard( authData, colId, issueId );

    let query = "project_card created iss" + card.content_url.split('/').pop() + " " + fullName;
    await settleWithVal( "makeProjCard", findNotice, query );

    // XXX either leave this in to allow peq data to record, or set additional post condition.
    await utils.sleep( MIN_DELAY );
    return card;
}

async function makeIssue( authData, td, title, labels ) {
    let issue = await ghSafe.createIssue( authData, td.GHOwner, td.GHRepo, title, labels, false );
    issue.push( title );
    await utils.sleep( MIN_DELAY );
    return issue;
}

async function makeAllocIssue( authData, td, title, labels ) {
    let issue = await ghSafe.createIssue( authData, td.GHOwner, td.GHRepo, title, labels, true );
    issue.push( title );
    await utils.sleep( MIN_DELAY );
    return issue;
}

async function blastIssue( authData, td, title, labels, assignees, specials ) {
    let wait  = typeof specials !== 'undefined' && specials.hasOwnProperty( "wait" )   ? specials.wait   : true;

    let issueData = [-1,-1];  // issue id, num

    const body = "Hola";
    await( authData.ic.issues.create( { owner: td.GHOwner, repo: td.GHRepo, title: title, labels: labels, body: body, assignees: assignees } ))
	.then( issue => {
	    issueData[0] = issue['data']['id'];
	    issueData[1] = issue['data']['number'];
	})
	.catch( e => {
	    console.log( authData.who, "Create Blast issue failed.", e );
	});
    
    issueData.push( title );
    if( wait ) { await utils.sleep( MIN_DELAY ); }
    return issueData;
}

async function addLabel( authData, td, issueNumber, labelName ) {
    await authData.ic.issues.addLabels({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, labels: [labelName] })
	.catch( e => { console.log( authData.who, "Add label failed.", e ); });
}	

async function remLabel( authData, td, issueData, label ) {
    console.log( "Removing", label.name, "from issueNum", issueData[1] );
    await authData.ic.issues.removeLabel({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueData[1], name: label.name })
	.catch( e => { console.log( authData.who, "Remove label failed.", e ); });

    let query = "issue unlabeled " + issueData[2] + " " + td.GHFullName;
    await settleWithVal( "unlabel", findNotice, query );
}

// NOTE - this ignores color... 
async function updateLabel( authData, td, label, updates ) {
    console.log( "Updating", label.name );

    let newName = updates.hasOwnProperty( "name" )        ? updates.name : label.name;
    let newDesc = updates.hasOwnProperty( "description" ) ? updates.description : label.description;
    
    await( authData.ic.issues.updateLabel( { owner: td.GHOwner, repo: td.GHRepo, name: label.name, new_name: newName, description: newDesc }))
	.catch( e => console.log( authData.who, "Update label failed.", e ));

    await utils.sleep( MIN_DELAY );
}

async function delLabel( authData, td, name ) {
    console.log( "Removing label:", name );
    await authData.ic.issues.deleteLabel({ owner: td.GHOwner, repo: td.GHRepo, name: name })
	.catch( e => { console.log( authData.who, "Remove label failed.", e ); });

    let query = "label deleted " + name + " " + td.GHFullName;
    await settleWithVal( "del label", findNotice, query );
}

async function addAssignee( authData, td, issueData, assignee ) {
    await authData.ic.issues.addAssignees({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueData[1], assignees: [assignee] })
	.catch( e => { console.log( authData.who, "Add assignee failed.", e ); });

    let query = "issue assigned " + issueData[2] + " " + td.GHFullName;
    await settleWithVal( "assign issue", findNotice, query );
}

async function remAssignee( authData, td, issueNumber, assignee ) {
    await authData.ic.issues.removeAssignees({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, assignees: [assignee] })
	.catch( e => { console.log( authData.who, "Remove assignee failed.", e ); });
    await utils.sleep( MIN_DELAY );
}

async function moveCard( authData, cardId, columnId ) {
    await authData.ic.projects.moveCard({ card_id: cardId, position: "top", column_id: columnId })
	.catch( e => { console.log( authData.who, "Move card failed.", e );	});
    await utils.sleep( MIN_DELAY );
}

async function remCard( authData, cardId ) {
    await authData.ic.projects.deleteCard( { card_id: cardId } )
	.catch( e => console.log( authData.who, "Remove card failed.", e ));
    await utils.sleep( MIN_DELAY );
}

async function closeIssue( authData, td, issueData ) {
    await authData.ic.issues.update({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueData[1], state: "closed" })
	.catch( e => { console.log( authData.who, "Close issue failed.", e );	});

    let query = "issue closed " + issueData[2] + " " + td.GHFullName;
    await settleWithVal( "closeIssue", findNotice, query );
}

async function reopenIssue( authData, td, issueNumber ) {
    console.log( "Opening", td.GHRepo, issueNumber );
    await authData.ic.issues.update({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, state: "open" })
	.catch( e => { console.log( authData.who, "Open issue failed.", e );	});

    // Can take GH a long time to move card.  
    await utils.sleep( MIN_DELAY + 500 );
}

async function remIssue( authData, td, issueId ) {

    let issue     = await findIssue( authData, td, issueId );
    let endpoint  = config.GQL_ENDPOINT;
    let query     = "mutation( $id:String! ) { deleteIssue( input:{ issueId: $id }) {clientMutationId}}";
    let variables = {"id": issue.node_id };
    query         = JSON.stringify({ query, variables });
    
    let res = await utils.postGH( authData.pat, endpoint, query );

    console.log( "remIssue query", query );
    console.log( "remIssue res", res.data );
    
    await utils.sleep( MIN_DELAY );
}

function checkEq( lhs, rhs, testStatus, msg ) {
    if( lhs == rhs ) {
	testStatus[0]++;
    }
    else {
	testStatus[1]++;
	testStatus[2].push( msg + ": " + lhs + " != " + rhs );
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
    console.log( "" );
}

function mergeTests( t1, t2 ) {
    return [t1[0] + t2[0], t1[1] + t2[1], t1[2].concat( t2[2] ) ];
}

async function delayTimer() {
    // Settle for up to 30s (Total) before failing.  First few are quick.
    console.log( "XXX GH Settle Time", CETestDelayCount );
    let waitVal = CETestDelayCount < 3 ? (CETestDelayCount+1) * 500 : 3000 + CETestDelayCount * 1000;
    await utils.sleep( waitVal );
    CETestDelayCount++;
    return CETestDelayCount < CE_DELAY_MAX;
}

// Let GH and/or ceServer settle , try again
async function settle( subTest, testStatus, func, ...params ) {
    if( subTest[1] > 0 && CETestDelayCount < CE_DELAY_MAX) {
	testReport( subTest, "Settle waiting.." );
	await delayTimer();
	return await func( ...params );
    }
    else { CETestDelayCount = 0; }
    testStatus = mergeTests( testStatus, subTest );
    return testStatus;
}

async function settleWithVal( fname, func, ...params ) {

    let retVal = await func( ...params );
    // console.log( "swt", retVal, CETestDelayCount );
    while( (typeof retVal === 'undefined' || retVal == false ) && CETestDelayCount < CE_DELAY_MAX) {
	console.log( "SettleVal waiting.. ", fname );
	await delayTimer();
	retVal = await func( ...params );
    }
    CETestDelayCount = 0;
    return retVal;
}

// Untracked issues have only partial entries in link table
// Should work for carded issues that have never been peq.  Does NOT work for newborn.
async function checkUntrackedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 0;

    console.log( "Check Untracked issue", issueData );
    let subTest = [ 0, 0, []];

    // CHECK github issues
    let issue  = await findIssue( authData, td, issueData[0] );
    subTest = checkEq( issue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
    subTest = checkEq( issue.number, issueData[1].toString(), subTest, "Github issue troubles" );
    subTest = checkEq( issue.labels.length, labelCnt,         subTest, "Issue label" );

    // CHECK linkage
    let links  = await getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let link   = ( links.filter((link) => link.GHIssueId == issueData[0] ))[0];
    subTest = checkEq( link.GHIssueNum, issueData[1].toString(), subTest, "Linkage Issue num" );
    subTest = checkEq( link.GHCardId, card.id,                   subTest, "Linkage Card Id" );
    subTest = checkEq( link.GHColumnName, config.EMPTY,          subTest, "Linkage Col name" );
    subTest = checkEq( link.GHIssueTitle, config.EMPTY,           subTest, "Linkage Card Title" );
    subTest = checkEq( link.GHProjectName, config.EMPTY,         subTest, "Linkage Project Title" );
    subTest = checkEq( link.GHColumnId, -1,                      subTest, "Linkage Col Id" );
    subTest = checkEq( link.GHProjectId, loc.projId,             subTest, "Linkage project id" );     // XXX tracking this??

    // CHECK dynamo Peq.  inactive, if it exists
    let peqs      = await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let issuePeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    subTest = checkLE( issuePeqs.length, 1,                      subTest, "Peq count" );
    if( issuePeqs.length > 0 ) {
	let peq = issuePeqs[0];
	subTest = checkEq( peq.Active, "false",                  subTest, "peq should be inactive" );
	subTest = checkEq( peq.GHIssueTitle, issueData[2],       subTest, "peq title is wrong" );
	subTest = checkEq( peq.CEGrantorId, config.EMPTY,        subTest, "peq grantor wrong" );
    }

    // CHECK dynamo Pact.. nothing to do here for newborn

    return await settle( subTest, testStatus, checkUntrackedIssue, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
}

// Used for previously situated issues that were unlabeled
async function checkDemotedIssue( authData, ghLinks, td, loc, issueData, card, testStatus ) {

    console.log( "Check demotedissue", loc.projName, loc.colName );

    // For issues, linkage
    testStatus = await checkUntrackedIssue( authData, ghLinks, td, loc, issueData, card, testStatus );
    let subTest = [ 0, 0, []];
    
     // CHECK github location
    let cards  = await getCards( authData, td.unclaimCID );   
    let tCard  = cards.filter((card) => card.hasOwnProperty( "content_url" ) ? card.content_url.split('/').pop() == issueData[1].toString() : false );
    subTest = checkEq( tCard.length, 0,                       subTest, "No unclaimed" );
    
    cards      = await getCards( authData, loc.colId );   
    let mCard  = cards.filter((card) => card.hasOwnProperty( "content_url" ) ? card.content_url.split('/').pop() == issueData[1].toString() : false );
    subTest = checkEq( mCard.length, 1,                       subTest, "Card claimed" );
    subTest = checkEq( mCard[0].id, card.id,                  subTest, "Card claimed" );
    

    // CHECK dynamo Peq.  inactive
    // Will have 1 or 2, both inactive, one for unclaimed, one for the demoted project.
    // Unclaimed may not have happened if peq'd a carded issue
    let peqs      = await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let issuePeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    subTest = checkEq( issuePeqs.length, 1,                      subTest, "Peq count" );
    for( const peq of issuePeqs ) {
	subTest = checkEq( peq.Active, "false",                  subTest, "peq should be inactive" );
	subTest = checkEq( peq.GHIssueTitle, issueData[2],       subTest, "peq title is wrong" );
	subTest = checkEq( peq.CEGrantorId, config.EMPTY,        subTest, "peq grantor wrong" );
    }
    let peqId = issuePeqs[0].GHProjectSub[0] == "UnClaimed" ? issuePeqs[1].PEQId : issuePeqs[0].PEQId;
    
    
    // CHECK dynamo Pact
    let pacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let issuePacts = pacts.filter((pact) => pact.Subject[0] == peqId );

    // Must have been a PEQ before. Depeq'd with unlabel, or delete.
    issuePacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let lastPact = issuePacts[ issuePacts.length - 1 ];
    
    let hr     = await hasRaw( authData, lastPact.PEQActionId );
    subTest = checkEq( hr, true,                                subTest, "PAct Raw match" ); 
    subTest = checkEq( lastPact.Verb, config.PACTVERB_CONF,     subTest, "PAct Verb"); 
    subTest = checkEq( lastPact.Action, config.PACTACT_DEL,     subTest, "PAct Verb"); 
    subTest = checkEq( lastPact.GHUserName, config.TESTER_BOT,  subTest, "PAct user name" ); 
    subTest = checkEq( lastPact.Ingested, "false",              subTest, "PAct ingested" );
    subTest = checkEq( lastPact.Locked, "false",                subTest, "PAct locked" );

    return await settle( subTest, testStatus, checkDemotedIssue, authData, ghLinks, td, loc, issueData, card, testStatus );
}

async function checkAlloc( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    let labelVal    = typeof specials !== 'undefined' && specials.hasOwnProperty( "val" )       ? specials.val         : 1000000;
    let labelCnt    = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )  ? specials.lblCount    : 1;
    let assignCnt   = typeof specials !== 'undefined' && specials.hasOwnProperty( "assignees" ) ? specials.assignees   : false;
    let state       = typeof specials !== 'undefined' && specials.hasOwnProperty( "state" )     ? specials.state       : "open";
    
    console.log( "Check Allocation", loc.projName, loc.colName, labelVal );
    let subTest = [ 0, 0, []];

    // CHECK github issues
    let issue  = await findIssue( authData, td, issueData[0] );
    subTest = checkEq( issue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
    subTest = checkEq( issue.number, issueData[1].toString(), subTest, "Github issue troubles" );
    subTest = checkEq( issue.labels.length, labelCnt,         subTest, "Issue label count" );
    subTest = checkEq( issue.state, state,                    subTest, "Issue state" );

    const lname = labelVal.toString() + " " + config.ALLOC_LABEL;
    subTest = checkEq( issue.labels[0].name, lname,           subTest, "Issue label name" );

    // CHECK github location
    cards = await getCards( authData, loc.colId );
    let mCard = cards.filter((card) => card.hasOwnProperty( "content_url" ) ? card.content_url.split('/').pop() == issueData[1].toString() : false );
    subTest = checkEq( mCard.length, 1,                           subTest, "Card claimed" );
    subTest = checkEq( mCard[0].id, card.id,                      subTest, "Card claimed" );

    // CHECK linkage
    let links    = await getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let link = ( links.filter((link) => link.GHIssueId == issueData[0] ))[0];
    subTest = checkEq( link.GHIssueNum, issueData[1].toString(), subTest, "Linkage Issue num" );
    subTest = checkEq( link.GHCardId, card.id,                   subTest, "Linkage Card Id" );
    subTest = checkEq( link.GHColumnName, loc.colName,           subTest, "Linkage Col name" );
    subTest = checkEq( link.GHIssueTitle, issueData[2],           subTest, "Linkage Card Title" );
    subTest = checkEq( link.GHProjectName, loc.projName,         subTest, "Linkage Project Title" );
    subTest = checkEq( link.GHColumnId, loc.colId,               subTest, "Linkage Col Id" );
    subTest = checkEq( link.GHProjectId, loc.projId,             subTest, "Linkage project id" );

    // CHECK dynamo Peq
    let allPeqs  =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let peqs = allPeqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    subTest = checkEq( peqs.length, 1,                          subTest, "Peq count" );
    let peq = peqs[0];

    assignCnt = assignCnt ? assignCnt : 0;
    
    subTest = checkEq( peq.PeqType, config.PEQTYPE_ALLOC,       subTest, "peq type invalid" );        
    subTest = checkEq( peq.GHProjectSub.length, loc.projSub.length, subTest, "peq project sub len invalid" );
    subTest = checkEq( peq.GHIssueTitle, issueData[2],          subTest, "peq title is wrong" );
    subTest = checkEq( peq.GHHolderId.length, assignCnt,        subTest, "peq gh holders wrong" );      
    subTest = checkEq( peq.CEHolderId.length, 0,                subTest, "peq ce holders wrong" );    
    subTest = checkEq( peq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );      
    subTest = checkEq( peq.Amount, labelVal,                    subTest, "peq amount" );
    subTest = checkEq( peq.Active, "true",                      subTest, "peq" );
    subTest = checkEq( peq.GHProjectId, loc.projId,             subTest, "peq project id bad" );
    for( let i = 0; i < loc.projSub.length; i++ ) {
	subTest = checkEq( peq.GHProjectSub[i], loc.projSub[i], subTest, "peq project sub bad" );
    }

    // CHECK dynamo Pact
    let allPacts  = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    subTest = checkGE( pacts.length, 1,                         subTest, "PAct count" );  
    
    // Could have been many operations on this.
    for( const pact of pacts ) {
	let hr  = await hasRaw( authData, pact.PEQActionId );
	subTest = checkEq( hr, true,                                subTest, "PAct Raw match" ); 
	subTest = checkEq( pact.GHUserName, config.TESTER_BOT,      subTest, "PAct user name" ); 
	subTest = checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
	subTest = checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
    }

    return await settle( subTest, testStatus, checkAlloc, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
}

async function checkSituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    let muteIngested = typeof specials !== 'undefined' && specials.hasOwnProperty( "muteIngested" ) ? specials.muteIngested : false;
    let issueState   = typeof specials !== 'undefined' && specials.hasOwnProperty( "state" )        ? specials.state        : false;
    let labelVal     = typeof specials !== 'undefined' && specials.hasOwnProperty( "label" )        ? specials.label        : false;
    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 1;
    let skipPeqPID   = typeof specials !== 'undefined' && specials.hasOwnProperty( "skipPeqPID" )   ? specials.skipPeqPID   : false;
    let assignCnt    = typeof specials !== 'undefined' && specials.hasOwnProperty( "assign" )       ? specials.assign       : false; 
    
    console.log( "Check situated issue", loc.projName, loc.colName, muteIngested, labelVal, assignCnt );
    let subTest = [ 0, 0, []];
    
    // Start promises
    let cardsP = getCards( authData, loc.colId );
    let cardsU = getCards( authData, td.unclaimCID );
    let linksP = getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let peqsP  = utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let pactsP = utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    
    // CHECK github issues
    let issue  = await findIssue( authData, td, issueData[0] );
    subTest = checkEq( issue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
    subTest = checkEq( issue.number, issueData[1].toString(), subTest, "Github issue troubles" );

    if( assignCnt ) { subTest = checkEq( issue.assignees.length, assignCnt, subTest, "Assignee count" ); }
    
    const lname = labelVal ? labelVal.toString() + " " + config.PEQ_LABEL : "1000 " + config.PEQ_LABEL;
    const lval  = labelVal ? labelVal : 1000;

    subTest = checkEq( typeof issue.labels !== 'undefined', true, subTest, "labels not yet ready" );
    
    if( typeof issue.labels !== 'undefined' ){
	subTest = checkEq( typeof issue.labels[0] !== 'undefined', true, subTest, "labels not yet ready" );
	subTest = checkEq( issue.labels.length, labelCnt,         subTest, "Issue label count" );
	if( typeof issue.labels[0] !== 'undefined' ) {
	    subTest = checkEq( issue.labels[0].name, lname,           subTest, "Issue label name" );
	}
    }
    if( issueState ) { subTest = checkEq( issue.state, issueState, subTest, "Issue state" );  }

    // XXX Crappy test.  many locs are not related to td.unclaim.  Can be situated and in unclaim.
    //     Should kill this here, put in a handful in basic flow to ensure cleanUnclaimed when we know it should be.
    //     Use of assignCnt to ignore is poor, but will do until this is rebuilt, only shows in testCross.
    // CHECK github location
    let cards = td.unclaimCID == config.EMPTY ? [] : await cardsU;
    if( !assignCnt ) {
	let tCard = cards.filter((card) => card.hasOwnProperty( "content_url" ) ? card.content_url.split('/').pop() == issueData[1].toString() : false );
	subTest = checkEq( tCard.length, 0,                           subTest, "No unclaimed" );
    }

    cards = await cardsP;
    let mCard = cards.filter((card) => card.hasOwnProperty( "content_url" ) ? card.content_url.split('/').pop() == issueData[1].toString() : false );

    // Long GH pauses show their fury here, more likely than not.
    subTest = checkEq( typeof mCard[0] !== 'undefined', true,     subTest, "mCard not yet ready" );
    subTest = checkEq( typeof card     !== 'undefined', true,     subTest, "Card not yet ready" );
    if( typeof mCard[0] !== 'undefined' && typeof card !== 'undefined' ) {
    
	subTest = checkEq( mCard.length, 1,                           subTest, "Card claimed" );
	subTest = checkEq( mCard[0].id, card.id,                      subTest, "Card claimed" );
	
	// CHECK linkage
	let links  = await linksP;
	let link   = ( links.filter((link) => link.GHIssueId == issueData[0] ))[0];
	subTest = checkEq( link.GHIssueNum, issueData[1].toString(), subTest, "Linkage Issue num" );
	subTest = checkEq( link.GHCardId, card.id,                   subTest, "Linkage Card Id" );
	subTest = checkEq( link.GHColumnName, loc.colName,           subTest, "Linkage Col name" );
	subTest = checkEq( link.GHIssueTitle, issueData[2],           subTest, "Linkage Card Title" );
	subTest = checkEq( link.GHProjectName, loc.projName,         subTest, "Linkage Project Title" );
	subTest = checkEq( link.GHColumnId, loc.colId,               subTest, "Linkage Col Id" );
	subTest = checkEq( link.GHProjectId, loc.projId,             subTest, "Linkage project id" );
	
	// CHECK dynamo Peq
	let allPeqs = await peqsP;
	let peqs    = allPeqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
	subTest     = checkEq( peqs.length, 1,                          subTest, "Peq count" );
	let peq     = peqs[0];
	subTest     = checkEq( typeof peq !== 'undefined', true,        subTest, "peq not ready yet" );

	if( typeof peq !== 'undefined' ) {
	    
	    assignCnt = assignCnt ? assignCnt : 0;
	
	    subTest = checkEq( peq.PeqType, loc.peqType,                subTest, "peq type invalid" );        
	    subTest = checkEq( peq.GHProjectSub.length, loc.projSub.length, subTest, "peq project sub len invalid" );
	    subTest = checkEq( peq.GHIssueTitle, issueData[2],          subTest, "peq title is wrong" );
	    subTest = checkEq( peq.GHHolderId.length, assignCnt,        subTest, "peq holders wrong" );      
	    subTest = checkEq( peq.CEHolderId.length, 0,                subTest, "peq ceholders wrong" );    
	    subTest = checkEq( peq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );      
	    subTest = checkEq( peq.Amount, lval,                        subTest, "peq amount" );
	    subTest = checkEq( peq.GHProjectSub[0], loc.projSub[0],     subTest, "peq project sub 0 invalid" );
	    subTest = checkEq( peq.Active, "true",                      subTest, "peq" );
	    if( !skipPeqPID ) {
		subTest = checkEq( peq.GHProjectId, loc.projId,         subTest, "peq project id bad" );
	    }
	    
	    // CHECK dynamo Pact
	    let allPacts = await pactsP;
	    let pacts    = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
	    subTest   = checkGE( pacts.length, 1,                         subTest, "PAct count" );  
	    
	    // This can get out of date quickly.  Only check this if early on, before lots of moving (which PEQ doesn't keep up with)
	    if( pacts.length <= 3 && loc.projSub.length > 1 ) {
		const pip = [ config.PROJ_COLS[config.PROJ_PEND], config.PROJ_COLS[config.PROJ_ACCR] ];
		if( !pip.includes( loc.projSub[1] )) { 
		    subTest = checkEq( peq.GHProjectSub[1], loc.projSub[1], subTest, "peq project sub 1 invalid" );
		}
	    }
	    
	    // Could have been many operations on this.
	    for( const pact of pacts ) {
		let hr  = await hasRaw( authData, pact.PEQActionId );
		subTest = checkEq( hr, true,                                subTest, "PAct Raw match" ); 
		subTest = checkEq( pact.GHUserName, config.TESTER_BOT,      subTest, "PAct user name" ); 
		subTest = checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
		
		if( !muteIngested ) { subTest = checkEq( pact.Ingested, "false", subTest, "PAct ingested" ); }
	    }
	}
    }
    
    return await settle( subTest, testStatus, checkSituatedIssue, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
}


async function checkUnclaimedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    let labelVal     = typeof specials !== 'undefined' && specials.hasOwnProperty( "label" )        ? specials.label        : false;
    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 1;
    let assignees    = typeof specials !== 'undefined' && specials.hasOwnProperty( "assigns" )      ? specials.assigns      : [];
    
    console.log( "Check unclaimed issue", loc.projName, loc.colName, labelVal );
    let subTest = [ 0, 0, []];
    
    // Start promises
    let cardsU = getCards( authData, td.unclaimCID );
    let linksP = getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let peqsP  = utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let pactsP = utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    
    // CHECK github issues
    let issue  = await findIssue( authData, td, issueData[0] );
    subTest = checkEq( issue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
    subTest = checkEq( issue.number, issueData[1].toString(), subTest, "Github issue troubles" );
    subTest = checkEq( issue.labels.length, labelCnt,         subTest, "Issue label count" );
    
    const lname = labelVal ? labelVal.toString() + " " + config.PEQ_LABEL : "1000 " + config.PEQ_LABEL;
    const lval  = labelVal ? labelVal                     : 1000;
    subTest = checkEq( issue.labels[0].name, lname,           subTest, "Issue label name" );
    subTest = checkEq( issue.state, "open",                   subTest, "Issue state" ); 

    // CHECK github location
    let cards = td.unclaimCID == config.EMPTY ? [] : await cardsU;
    let tCard = cards.filter((card) => card.hasOwnProperty( "content_url" ) ? card.content_url.split('/').pop() == issueData[1].toString() : false );
    subTest = checkEq( tCard.length, 1,                        subTest, "No unclaimed" );
    subTest = checkEq( tCard[0].id, card.id,                   subTest, "Card id" );
    
    // CHECK linkage
    let links  = await linksP;
    let link   = ( links.filter((link) => link.GHIssueId == issueData[0] ))[0];
    subTest = checkEq( link.GHIssueNum, issueData[1].toString(), subTest, "Linkage Issue num" );
    subTest = checkEq( link.GHCardId, card.id,                   subTest, "Linkage Card Id" );
    subTest = checkEq( link.GHColumnName, loc.colName,           subTest, "Linkage Col name" );
    subTest = checkEq( link.GHIssueTitle, issueData[2],           subTest, "Linkage Card Title" );
    subTest = checkEq( link.GHProjectName, loc.projName,         subTest, "Linkage Project Title" );
    subTest = checkEq( link.GHColumnId, loc.colId,               subTest, "Linkage Col Id" );
    subTest = checkEq( link.GHProjectId, loc.projId,             subTest, "Linkage project id" );

    // CHECK dynamo Peq
    let allPeqs =  await peqsP;
    let peqs    = allPeqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    let peq = peqs[0];
    subTest  = checkEq( peqs.length, 1,                          subTest, "Peq count" );
    subTest  = checkEq( typeof peq !== 'undefined', true,        subTest, "Peq count" );
    if( typeof peq !== 'undefined' ) {
	subTest = checkEq( peq.PeqType, loc.peqType,                subTest, "peq type invalid" );        
	subTest = checkEq( peq.GHProjectSub.length, loc.projSub.length, subTest, "peq project sub len invalid" );
	subTest = checkEq( peq.GHIssueTitle, issueData[2],          subTest, "peq title is wrong" );
	subTest = checkEq( peq.GHHolderId.length, assignees.length, subTest, "peq holders wrong" );      
	subTest = checkEq( peq.CEHolderId.length, 0,                subTest, "peq ce holders wrong" );    
	subTest = checkEq( peq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );      
	subTest = checkEq( peq.Amount, lval,                        subTest, "peq amount" );
	subTest = checkEq( peq.GHProjectSub[0], loc.projSub[0],     subTest, "peq project sub 0 invalid" );
	subTest = checkEq( peq.Active, "true",                      subTest, "peq" );
	subTest = checkEq( peq.GHProjectId, loc.projId,             subTest, "peq project id bad" );
    }

    for( const assignee of assignees ) {
	subTest = checkEq( peq.GHHolderId.includes( assignee ), true, subTest, "peq holder bad" );
    }
    
    // CHECK dynamo Pact
    let allPacts  = await pactsP;
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    subTest = checkGE( pacts.length, 1,                         subTest, "PAct count" );  

    // This can get out of date quickly.  Only check this if early on, before lots of moving (which PEQ doesn't keep up with)
    if( pacts.length <= 3 && loc.projSub.length > 1 ) {
	const pip = [ config.PROJ_COLS[config.PROJ_PEND], config.PROJ_COLS[config.PROJ_ACCR] ];
	if( !pip.includes( loc.projSub[1] )) { 
	    subTest = checkEq( peq.GHProjectSub[1], loc.projSub[1], subTest, "peq project sub 1 invalid" );
	}
    }
    
    // Could have been many operations on this.
    for( const pact of pacts ) {
	let hr     = await hasRaw( authData, pact.PEQActionId );
	subTest = checkEq( hr, true,                            subTest, "PAct Raw match" ); 
	subTest = checkEq( pact.GHUserName, config.TESTER_BOT,      subTest, "PAct user name" ); 
	subTest = checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
	subTest = checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
    }

    return await settle( subTest, testStatus, checkUnclaimedIssue, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
}


// Check last PAct
async function checkNewlyClosedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    if( typeof specials === 'undefined' ) { specials = {}; }
    if( !specials.state ) { specials.state = "closed"; }
    testStatus = await checkSituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials );
    let subTest = [ 0, 0, []];

    console.log( "Check Closed issue", loc.projName, loc.colName );

    // Start promises
    let peqsP  = utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let pactsP = utils.getPActs( authData, {"GHRepo": td.GHFullName });
    
    const allPeqs =  await peqsP;
    const peqs = allPeqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    const peq = peqs[0];

    // CHECK dynamo Pact
    const allPacts = await pactsP;
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    const pact = pacts[ pacts.length - 1];
    subTest = checkEq( pact.Verb, config.PACTVERB_PROP,     subTest, "PAct Verb"); 
    subTest = checkEq( pact.Action, config.PACTACT_ACCR,    subTest, "PAct Action"); 

    return await settle( subTest, testStatus, checkNewlyClosedIssue, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
}

// Check last PAct
async function checkNewlyOpenedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    if( typeof specials === 'undefined' ) { specials = {}; }
    if( !specials.state ) { specials.state = "open"; }
    testStatus = await checkSituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials );
    let subTest = [ 0, 0, []];

    console.log( "Check Opened issue", loc.projName, loc.colName );

    // Start promises
    let peqsP  = utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let pactsP = utils.getPActs( authData, {"GHRepo": td.GHFullName });
    
    const allPeqs = await peqsP;
    const peqs = allPeqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    const peq = peqs[0];

    // CHECK dynamo Pact
    const allPacts = await pactsP;
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    const pact = pacts[ pacts.length - 1];
    subTest = checkEq( pact.Verb, config.PACTVERB_REJ,               subTest, "PAct Verb"); 
    subTest = checkEq( pact.Action, config.PACTACT_ACCR,             subTest, "PAct Action"); 

    return await settle( subTest, testStatus, checkNewlyOpenedIssue, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
}



async function checkNewlySituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    if( typeof specials === 'undefined' ) { specials = {}; }
    if( !specials.hasOwnProperty( "state" ) ) { specials.state = "open"; }
    testStatus = await checkSituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials );

    console.log( "Check newly situated issue", loc.projName, loc.colName );
    let subTest = [ 0, 0, []];
    
    // Start promises
    let peqsP  = utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let pactsP = utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    
    // CHECK dynamo Peq
    let allPeqs =  await peqsP;
    let peqs = allPeqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    subTest = checkEq( peqs.length, 1,                          subTest, "Peq count" );
    let peq = peqs[0];
    subTest = checkEq( peq.PeqType, loc.peqType,                subTest, "peq type invalid" );       
    subTest = checkEq( peq.GHProjectSub.length, loc.projSub.length, subTest, "peq project sub invalid" );
    subTest = checkEq( peq.GHIssueTitle, issueData[2],          subTest, "peq title is wrong" );
    subTest = checkEq( peq.GHHolderId.length, 0,                subTest, "peq holders wrong" );
    subTest = checkEq( peq.CEHolderId.length, 0,                subTest, "peq holders wrong" );
    subTest = checkEq( peq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );
    subTest = checkEq( peq.GHProjectSub[0], loc.projSub[0],     subTest, "peq project sub invalid" );
    if( loc.projSub.length > 1 ) {
	subTest = checkEq( peq.GHProjectSub[1], loc.projSub[1], subTest, "peq project sub invalid" );
    }
    subTest = checkEq( peq.GHProjectId, loc.projId,             subTest, "peq PID bad" );
    subTest = checkEq( peq.Active, "true",                      subTest, "peq" );

    // CHECK dynamo Pact
    // label carded issue?  1 pact.  attach labeled issue to proj col?  2 pact.
    // Could be any number.  add (unclaimed).  change (assign) x n.  relocate (peqify)
    let allPacts = await pactsP;
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    subTest = checkGE( pacts.length, 1,                         subTest, "PAct count" );         
    
    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let addUncl  = pacts.length >= 2 ? pacts[0] : {"Action": config.PACTACT_ADD };
    let relUncl  = pacts.length >= 2 ? pacts[ pacts.length -1 ] : {"Action": config.PACTACT_RELO };
    let pact     = pacts.length >= 2 ? pacts[ pacts.length -1 ] : pacts[0];
    for( const pact of pacts ) {
	let hr     = await hasRaw( authData, pact.PEQActionId );
	subTest = checkEq( hr, true,                            subTest, "PAct Raw match" ); 
	subTest = checkEq( pact.Verb, config.PACTVERB_CONF,         subTest, "PAct Verb"); 
	subTest = checkEq( pact.GHUserName, config.TESTER_BOT,      subTest, "PAct user name" ); 
	subTest = checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
	subTest = checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
    }
    subTest = checkEq( addUncl.Action, config.PACTACT_ADD,          subTest, "PAct Action"); 
    subTest = checkEq( relUncl.Action, config.PACTACT_RELO,         subTest, "PAct Action");
    const source = pact.Action == config.PACTACT_ADD || pact.Action == config.PACTACT_RELO;
    subTest = checkEq( source, true,                                subTest, "PAct Action"); 

    return await settle( subTest, testStatus, checkNewlySituatedIssue, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
}

async function checkNewlyAccruedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    testStatus = await checkSituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials );
    console.log( "Check newly accrued issue", loc.projName, loc.colName );
    let subTest = [ 0, 0, []];

    // CHECK dynamo Peq
    let allPeqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let peqs = allPeqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    subTest = checkEq( peqs.length, 1,                          subTest, "Peq count" );
    let peq = peqs[0];

    // CHECK dynamo Pact  smallest number is add, move.  check move (confirm accr)
    let allPacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    subTest = checkGE( pacts.length, 2,                         subTest, "PAct count" );         
    
    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let pact = pacts[ pacts.length - 1];
    subTest = checkEq( pact.Verb, config.PACTVERB_CONF,                    subTest, "PAct Verb"); 
    subTest = checkEq( pact.Action, config.PACTACT_ACCR,                   subTest, "PAct Action");

    return await settle( subTest, testStatus, checkNewlyAccruedIssue, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
}

// Accrued in !unclaimed just removed.  Check landing in unclaimed, which depends on source (delete card, delete issue)
// construct data from new issue and new card as needed.
async function checkUnclaimedAccr( authData, ghLinks, td, loc, issueDataOld, issueDataNew, cardNew, testStatus, source ) {

    // Don't check peq projectID for card delete.  Issue is old issue, peq is behind.  Pact knows all.  
    let skip = source == "card" ? true : false; 
    if( source == "card" ) { assert( issueDataOld[0] == issueDataNew[0] ); }

    testStatus = await checkSituatedIssue( authData, ghLinks, td, loc, issueDataNew, cardNew, testStatus, { "skipPeqPID": skip });
    console.log( "Check unclaimed accrued issue", loc.projName, loc.colName, issueDataOld );
    let subTest = [ 0, 0, []];
    
    // CHECK dynamo Peq
    let allPeqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let peqs = allPeqs.filter((peq) => peq.GHIssueId == issueDataNew[0].toString() );
    subTest = checkEq( peqs.length, 1,                          subTest, "Peq count" );
    let peq = peqs[0];

    // CHECK dynamo Pact 
    let allPacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    subTest = checkGE( pacts.length, 1,                         subTest, "PAct count" );

    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let pact = pacts[ pacts.length - 1];
    subTest = checkEq( pact.Verb, config.PACTVERB_CONF,                subTest, "PAct Verb"); 
    if     ( source == "card" )  { subTest = checkEq( pact.Action, config.PACTACT_RELO,        subTest, "PAct Action"); }
    else if( source == "issue" ) { subTest = checkEq( pact.Action, config.PACTACT_ADD,         subTest, "PAct Action"); }

    // Check old issue
    // For source == issue, new peq is added.  Old peq is changed.
    if( source == "issue" ) {
	// PEQ inactive
	peqs = allPeqs.filter((peq) => peq.GHIssueId == issueDataOld[0].toString() );
	peq = peqs[0];
	subTest = checkEq( peqs.length, 1,                      subTest, "Peq count" );
	subTest = checkEq( peq.Active, "false",                 subTest, "peq should be inactive" );
	
	// CHECK dynamo Pact  old: add, move, change
	pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
	subTest = checkGE( pacts.length, 3,                     subTest, "PAct count" );
	
	pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
	let pact = pacts[ pacts.length - 1];
	subTest = checkEq( pact.Verb, config.PACTVERB_CONF,     subTest, "PAct Verb"); 
	subTest = checkEq( pact.Action, config.PACTACT_CHAN,    subTest, "PAct Action"); 
	subTest = checkEq( pact.Note, "recreate",               subTest, "PAct Note"); 
    }

    return await settle( subTest, testStatus, checkUnclaimedAccr, authData, ghLinks, td, loc, issueDataOld, issueDataNew, cardNew, testStatus, source );
}


async function checkNewbornCard( authData, ghLinks, td, loc, cardId, title, testStatus ) {

    console.log( "Check Newborn Card", title, cardId );
    let subTest = [ 0, 0, []];
    
    // CHECK github issue
    // no need, get content link below
    
    // CHECK github card
    let cards  = await getCards( authData, loc.colId );
    let card   = cards.find( card => card.id == cardId );
    const cardTitle = card.note.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    subTest = checkEq( card.hasOwnProperty( "content_url" ), false, subTest, "Newbie has content" );
    subTest = checkEq( cardTitle, title,                            subTest, "Newbie title" );

    // CHECK linkage
    let links  = await getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let link   = links.find( l => l.GHCardId == cardId );
    subTest = checkEq( typeof link, "undefined",                    subTest, "Newbie link exists" );

    // CHECK dynamo Peq.  inactive, if it exists
    // Risky test - will fail if unrelated peqs with same title exist
    let peqs = await utils.getPeqs( authData, { "GHRepo": td.GHFullName, "GHIssueTitle": title });
    subTest = checkEq( peqs, -1,                                    subTest, "Newbie peq exists" );

    // CHECK dynamo Pact.. nothing to do here for newborn

    return await settle( subTest, testStatus, checkNewbornCard, authData, ghLinks, td, loc, cardId, title, testStatus );
}

async function checkNewbornIssue( authData, ghLinks, td, issueData, testStatus, specials ) {

    console.log( "Check Newborn Issue", issueData);
    let subTest = [ 0, 0, []];

    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 0;
    
    // CHECK github issue
    let issue  = await findIssue( authData, td, issueData[0] );
    subTest = checkEq( issue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
    subTest = checkEq( issue.number, issueData[1].toString(), subTest, "Github issue troubles" );
    subTest = checkEq( issue.title, issueData[2],             subTest, "Github issue troubles" );
    subTest = checkEq( issue.labels.length, labelCnt,         subTest, "Issue label" );

    // CHECK github card
    // no need, get content link below
    
    // CHECK linkage
    let links  = await getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let link   = links.find( l => l.GHIssueId == issueData[0].toString() );
    subTest = checkEq( typeof link, "undefined",                    subTest, "Newbie link exists" );

    // CHECK dynamo Peq.  inactive, if it exists
    let peqs = await utils.getPeqs( authData, { "GHRepo": td.GHFullName, "GHIssueId": issueData[0] });
    if( peqs != -1 ) {
	let peq = peqs.find(peq => peq.GHIssueId == issueData[0].toString() );
	subTest = checkEq( peq.Active, "false",                  subTest, "peq should be inactive" );
	subTest = checkEq( peq.GHIssueTitle, issueData[2],       subTest, "peq title is wrong" );
	subTest = checkEq( peq.CEGrantorId, config.EMPTY,        subTest, "peq grantor wrong" );
    }

    // CHECK dynamo Pact.. nothing to do here for newborn

    return await settle( subTest, testStatus, checkNewbornIssue, authData, ghLinks, td, issueData, testStatus, specials );
}

async function checkSplit( authData, ghLinks, td, issDat, origLoc, newLoc, origVal, testStatus, specials ) {
    let situated   = typeof specials !== 'undefined' && specials.hasOwnProperty( "peq" )        ? specials.peq        : false;
    let labelCnt   = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )   ? specials.lblCount   : 1;
    let assignCnt  = typeof specials !== 'undefined' && specials.hasOwnProperty( "assignees" )  ? specials.assignees  : 1;

    console.log( "Check Split", issDat[2], origLoc.colName, newLoc.colName );
    let subTest = [ 0, 0, []];
    
    // Get new issue
    let issues   = await getIssues( authData, td );
    let issue    = await findIssue( authData, td, issDat[0] );    
    let splitIss = issues.find( issue => issue.title.includes( issDat[2] + " split" ));
    const splitDat = typeof splitIss == 'undefined' ? [-1, -1, -1] : [ splitIss.id.toString(), splitIss.number.toString(), splitIss.title ];

    subTest = await checkEq( splitDat[0] != -1, true, subTest, "split iss trouble" );
    if( splitDat[0] != -1 ) {
    
	// Get cards
	let allLinks  = await getLinks( authData, ghLinks, { repo: td.GHFullName });
	let issLink   = allLinks.find( l => l.GHIssueId == issDat[0].toString() );
	let splitLink = allLinks.find( l => l.GHIssueId == splitDat[0].toString() );
	
	if( typeof issLink === 'undefined' ) { console.log( allLinks ); console.log( issDat ); }
	
	subTest = await checkEq( typeof issLink   !== 'undefined', true, subTest, "issLink trouble" );
	subTest = await checkEq( typeof splitLink !== 'undefined', true, subTest, "splitLink trouble" );

	if( typeof issLink !== 'undefined' && typeof splitLink !== 'undefined' ) {
	    const card      = await getCard( authData, issLink.GHCardId );
	    const splitCard = await getCard( authData, splitLink.GHCardId );
	    
	    if( situated ) {
		let lval = origVal / 2;
		subTest = await checkSituatedIssue( authData, ghLinks, td, origLoc, issDat,   card,      subTest, {label: lval, lblCount: labelCnt} );
		subTest = await checkSituatedIssue( authData, ghLinks, td, newLoc,  splitDat, splitCard, subTest, {label: lval, lblCount: labelCnt } );
	    }
	    else {
		subTest = await checkUntrackedIssue( authData, ghLinks, td, origLoc, issDat,   card,      subTest, {lblCount: labelCnt} );
		subTest = await checkUntrackedIssue( authData, ghLinks, td, newLoc,  splitDat, splitCard, subTest, {lblCount: labelCnt } );
	    }
	    subTest = checkEq( issue.state, splitIss.state,    subTest, "Issues have different state" );
	    
	    // check assign
	    subTest = checkEq( issue.assignees.length, assignCnt,    subTest, "Issue assignee count" );
	    subTest = checkEq( splitIss.assignees.length, assignCnt, subTest, "Issue assignee count" );
	
	    // Check comment on splitIss
	    const comments = await getComments( authData, td, splitDat[1] );
	    subTest = checkEq( typeof comments !== 'undefined',                      true,   subTest, "Comment not yet ready" );
	    subTest = checkEq( typeof comments[0] !== 'undefined',                   true,   subTest, "Comment not yet ready" );
	    if( typeof comments !== 'undefined' && typeof comments[0] !== 'undefined' ) {
		subTest = checkEq( comments[0].body.includes( "CodeEquity duplicated" ), true,   subTest, "Comment bad" );
	    }
	}
    }
    
    return await settle( subTest, testStatus, checkSplit, authData, ghLinks, td, issDat, origLoc, newLoc, origVal, testStatus, specials );
}


async function checkAllocSplit( authData, ghLinks, td, issDat, origLoc, newLoc, origVal, testStatus, specials ) {
    let labelCnt   = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )   ? specials.lblCount   : 1;
    // One is for dynamo peq, one is for gh issue
    let assignCnt  = typeof specials !== 'undefined' && specials.hasOwnProperty( "assignees" )  ? specials.assignees  : 0;
    let issAssignCnt = typeof specials !== 'undefined' && specials.hasOwnProperty( "issAssignees" )  ? specials.issAssignees  : 1;
    
    console.log( "Check Alloc Split", issDat[2], origLoc.colName, newLoc.colName );
    let subTest = [ 0, 0, []];

    // Get new issue
    let issues   = await getIssues( authData, td );
    let issue    = await findIssue( authData, td, issDat[0] );    
    let splitIss = issues.find( issue => issue.title.includes( issDat[2] + " split" ));
    const splitDat = typeof splitIss == 'undefined' ? [-1, -1, -1] : [ splitIss.id.toString(), splitIss.number.toString(), splitIss.title ];

    subTest = checkEq( splitDat[0] != -1, true, subTest, "split iss not ready yet" );
    if( splitDat[0] != -1 ) {
	
	// Get cards
	let allLinks  = await getLinks( authData, ghLinks, { repo: td.GHFullName });
	let issLink   = allLinks.find( l => l.GHIssueId == issDat[0].toString() );
	let splitLink = allLinks.find( l => l.GHIssueId == splitDat[0].toString() );
	
	if( typeof issLink === 'undefined' ) { console.log( allLinks ); console.log( issDat ); }
	
	// Break this in two to avoid nested loop for settle timer
	if( typeof issLink   !== 'undefined' && typeof splitLink !== 'undefined' ) {
	    
	    const card      = await getCard( authData, issLink.GHCardId );
	    const splitCard = await getCard( authData, splitLink.GHCardId );
	    
	    let lval = origVal / 2;
	    testStatus = await checkAlloc( authData, ghLinks, td, origLoc, issDat,   card,      testStatus, {val: lval, lblCount: labelCnt, assignees: assignCnt } );
	    testStatus = await checkAlloc( authData, ghLinks, td, newLoc,  splitDat, splitCard, testStatus, {val: lval, lblCount: labelCnt, assignees: assignCnt } );
	}
	
	if( typeof issLink   !== 'undefined' && typeof splitLink !== 'undefined' ) {
	    subTest = checkEq( issue.state, splitIss.state,    subTest, "Issues have different state" );
	    
	    // check assign
	    subTest = checkEq( issue.assignees.length, issAssignCnt,    subTest, "Issue assignee count" );
	    subTest = checkEq( splitIss.assignees.length, issAssignCnt, subTest, "Issue assignee count" );
	    
	    // Check comment on splitIss
	    const comments = await getComments( authData, td, splitDat[1] );
	    subTest = checkEq( comments[0].body.includes( "CodeEquity duplicated" ), true,   subTest, "Comment bad" );
	}
	
	subTest = await checkEq( typeof issLink   !== 'undefined', true, subTest, "issLink trouble" );
	subTest = await checkEq( typeof splitLink !== 'undefined', true, subTest, "splitLink trouble" );
    }
    
    return await settle( subTest, testStatus, checkAllocSplit, authData, ghLinks, td, issDat, origLoc, newLoc, origVal, testStatus, specials );
}

async function checkNoSplit( authData, ghLinks, td, issDat, newLoc, cardId, testStatus ) {
    
    console.log( "Check No Split", issDat[2], newLoc.colName );
    let subTest = [ 0, 0, []];
    
    const splitName = issDat[2] + " split";
    
    // Check issue
    let issues   = await getIssues( authData, td );
    let splitIss = issues.find( issue => issue.title.includes( splitName ));
				
    subTest = checkEq( typeof splitIss === 'undefined', true, subTest, "Split issue should not exist" );
				
    // Check card
    let colCards = await getCards( authData, newLoc.colId );
    let noCard = true;
    if( colCards != -1 ) {
	const card = colCards.find( c => c.note && c.note.includes( splitName ));
	if( typeof card !== 'undefined' ) { noCard = false; }
    }
    subTest = checkEq( noCard, true,                  subTest, "Split card should not exist" );

    // Check peq
    let allPeqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let peq = allPeqs.find( peq => peq.GHIssueTitle.includes( splitName ));
    subTest = checkEq( typeof peq === 'undefined', true,   subTest, "Peq should not exist" );

    // Linkage, id search.
    subTest = await checkNoCard( authData, ghLinks, td, newLoc, cardId, issDat[2], subTest, {skipAllPeq: true} );
    
    return await settle( subTest, testStatus, checkNoSplit, authData, ghLinks, td, issDat, newLoc, cardId, testStatus );
}

async function checkNoCard( authData, ghLinks, td, loc, cardId, title, testStatus, specials ) {

    console.log( "Check No Card", title, cardId );
    
    // default is -1 peq
    // Send skipAll if peq exists, is active, and checked elsewhere.
    // send checkpeq if peq is inactive.
    let checkPeq   = typeof specials !== 'undefined' && specials.hasOwnProperty( "peq" )        ? specials.peq     : false;    
    let skipAllPeq = typeof specials !== 'undefined' && specials.hasOwnProperty( "skipAllPeq" ) ? specials.skipAllPeq : false;    

    // CHECK github card
    let cards  = await getCards( authData, loc.colId );
    if( cards != -1 ) { 
	let card   = cards.find( card => card.id == cardId );
	testStatus = checkEq( typeof card === "undefined", true,  testStatus, "Card should not exist" );
    }

    // CHECK linkage
    let links  = await getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let link   = links.find( l => l.GHCardId == cardId.toString() );
    testStatus = checkEq( typeof link === "undefined", true,      testStatus, "Link should not exist" );

    // CHECK dynamo Peq.  inactive, if it exists
    if( !skipAllPeq ) {
	// Risky test - will fail if unrelated peqs with same title exist
	// No card may have inactive peq
	let peqs = await utils.getPeqs( authData, { "GHRepo": td.GHFullName, "GHIssueTitle": title });
	if( checkPeq ) {
	    let peq = peqs[0];
	    testStatus = checkEq( peq.Active, "false",                  testStatus, "peq should be inactive" );
	    testStatus = checkEq( peq.GHIssueTitle, title,              testStatus, "peq title is wrong" );
	    testStatus = checkEq( peq.CEGrantorId, config.EMPTY,        testStatus, "peq grantor wrong" );
	}
	else {
	    testStatus = checkEq( peqs, -1,                             testStatus, "Peq should not exist" );
	}
    }

    return testStatus;
}

async function checkPact( authData, ghLinks, td, title, verb, action, note, testStatus, specials ) {
    console.log( "Check PAct" );
    let subTest = [ 0, 0, []];
    
    let subject = typeof specials !== 'undefined' && specials.hasOwnProperty( "sub" )   ? specials.sub   : -1;
    let depth   = typeof specials !== 'undefined' && specials.hasOwnProperty( "depth" ) ? specials.depth : 1;

    let pact = {};
    let pacts = {};
    let allPacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );

    // Either check last related to PEQ, or just find latest.

    if( title != -1 ) {
	// Risky test - will fail if unrelated peqs with same title exist.  Do not use with remIssue/rebuildIssue.  No card may have inactive peq
	let peqs = await utils.getPeqs( authData, { "GHRepo": td.GHFullName, "GHIssueTitle": title });
	pacts    = allPacts.filter((pact) => pact.Subject[0] == peqs[0].PEQId );
    }
    else { pacts = allPacts; }
    
    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let foundPAct = false;
    for( let i = pacts.length - depth; i < pacts.length; i++ ) {
	const pact = pacts[i];
	// console.log( i, pact );
	foundPAct = true;
	foundPAct = foundPAct && pacts.length >= 1; 
	foundPAct = foundPAct && pact.Verb == verb;
	foundPAct = foundPAct && pact.Action == action;
	foundPAct = foundPAct && pact.Note == note;
	
	if( subject != -1 ) {
	    foundPAct = foundPAct && pact.Subject.length == subject.length;
	    for( let i = 0; i < subject.length; i++ ) {
		foundPAct = foundPAct && pact.Subject[i] == subject[i];
	    }
	}
	// console.log( verb, action, note, subject, depth, foundPAct );
	if( foundPAct ) { break; }
    }
    subTest = checkEq( foundPAct, true,                     subTest, "pact bad" );

    return await settle( subTest, testStatus, checkPact, authData, ghLinks, td, title, verb, action, note, testStatus, specials );
}

async function checkNoIssue( authData, ghLinks, td, issueData, testStatus ) {

    console.log( "Check No Issue", issueData );
    let subTest = [ 0, 0, []];

    // CHECK github issue
    let issue  = await findIssue( authData, td, issueData[0] );
    subTest = checkEq( issue, -1,                               subTest, "Issue should not exist" );

    // CHECK linkage
    let links  = await getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let link   = links.find( l => l.GHIssueId == issueData[0] );
    subTest = checkEq( typeof link, "undefined",                subTest, "Link should not exist" );

    return await settle( subTest, testStatus, checkNoIssue, authData, ghLinks, td, issueData, testStatus );
}


async function checkAssignees( authData, td, assigns, issueData, testStatus ) {
    console.log( "Check assignees" );
    let subTest = [ 0, 0, []];

    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    
    // CHECK github issues
    let issue  = await findIssue( authData, td, issueData[0] );
    subTest = checkEq( issue.id, issueData[0].toString(),      subTest, "Github issue troubles" );
    subTest = checkEq( issue.number, issueData[1].toString(),  subTest, "Github issue troubles" );
    subTest = checkEq( issue.assignees.length, assigns.length, subTest, "Issue assignee count" );
    if( issue.assignees.length == assigns.length ) {
	for( let i = 0; i < assigns.length; i++ ) {
	    subTest = checkEq( issue.assignees[i].login, assigns[i], subTest, "assignee1" );
	}
    }

    // CHECK Dynamo PEQ
    // Should be no change
    let peqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    subTest = checkEq( meltPeqs.length, 1,                          subTest, "Peq count" );
    let meltPeq = meltPeqs[0];
    subTest = checkEq( meltPeq.PeqType, config.PEQTYPE_PLAN,        subTest, "peq type invalid" );
    subTest = checkEq( meltPeq.GHProjectSub.length, 2,              subTest, "peq project sub invalid" );
    subTest = checkEq( meltPeq.GHIssueTitle, issueData[2],          subTest, "peq title is wrong" );
    subTest = checkEq( meltPeq.GHHolderId.length, 0,                subTest, "peq holders wrong" );
    subTest = checkEq( meltPeq.CEHolderId.length, 0,                subTest, "peq ceholders wrong" );
    subTest = checkEq( meltPeq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );
    subTest = checkEq( meltPeq.Amount, 1000,                        subTest, "peq amount" );
    subTest = checkEq( meltPeq.GHProjectSub[0], td.softContTitle,   subTest, "peq project sub invalid" );
    subTest = checkEq( meltPeq.GHProjectSub[1], td.dataSecTitle,    subTest, "peq project sub invalid" );
    subTest = checkEq( meltPeq.GHProjectId, td.dataSecPID,          subTest, "peq unclaimed PID bad" );
    subTest = checkEq( meltPeq.Active, "true",                      subTest, "peq" );

    
    // CHECK Dynamo PAct
    // Should show relevant change action.. last three are related to current entry - may be more for unclaimed
    let pacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let meltPacts = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    subTest = checkGE( meltPacts.length, 3,                            subTest, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    
    for( const pact of meltPacts ) {
	let hr  = await hasRaw( authData, pact.PEQActionId );
	subTest = checkEq( hr, true,                                subTest, "PAct Raw match" ); 
	subTest = checkEq( pact.GHUserName, config.TESTER_BOT,      subTest, "PAct user name" ); 
	subTest = checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
	subTest = checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
    }

    return await settle( subTest, testStatus, checkAssignees, authData, td, assigns, issueData, testStatus );
}

async function checkNoAssignees( authData, td, ass1, ass2, issueData, testStatus ) {
    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    let subTest = [ 0, 0, []];
    
    // CHECK github issues
    let meltIssue = await findIssue( authData, td, issueData[0] );
    subTest = checkEq( meltIssue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
    subTest = checkEq( meltIssue.number, issueData[1].toString(), subTest, "Github issue troubles" );
    subTest = checkEq( meltIssue.assignees.length, 0,             subTest, "Issue assignee count" );

    // CHECK Dynamo PEQ
    // Should be no change
    let peqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0] );
    subTest = checkEq( meltPeqs.length, 1,                          subTest, "Peq count" );
    let meltPeq = meltPeqs[0];
    subTest = checkEq( meltPeq.PeqType, config.PEQTYPE_PLAN,        subTest, "peq type invalid" );
    subTest = checkEq( meltPeq.GHProjectSub.length, 2,              subTest, "peq project sub invalid" );
    subTest = checkEq( meltPeq.GHIssueTitle, issueData[2],          subTest, "peq title is wrong" );
    subTest = checkEq( meltPeq.GHHolderId.length, 0,                subTest, "peq holders wrong" );
    subTest = checkEq( meltPeq.CEHolderId.length, 0,                subTest, "peq holders wrong" );
    subTest = checkEq( meltPeq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );
    subTest = checkEq( meltPeq.Amount, 1000,                        subTest, "peq amount" );
    subTest = checkEq( meltPeq.GHProjectSub[0], td.softContTitle,   subTest, "peq project sub invalid" );
    subTest = checkEq( meltPeq.GHProjectSub[1], td.dataSecTitle,    subTest, "peq project sub invalid" );
    subTest = checkEq( meltPeq.GHProjectId, td.dataSecPID,          subTest, "peq unclaimed PID bad" );
    subTest = checkEq( meltPeq.Active, "true",                      subTest, "peq" );

    
    // CHECK Dynamo PAct
    // Should show relevant change action
    let pacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let meltPacts = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    subTest = checkGE( meltPacts.length, 5,                            subTest, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let len = meltPacts.length;
    let addMP  = meltPacts[len-5];   // add the issue (relocate)
    let addA1  = meltPacts[len-4];   // add assignee 1
    let addA2  = meltPacts[len-3];   // add assignee 2
    let remA1  = meltPacts[len-2];   // rem assignee 1
    let remA2  = meltPacts[len-1];   // rem assignee 2
    for( const pact of [addMP, addA1, addA2, remA1, remA2] ) {
	let hr  = await hasRaw( authData, pact.PEQActionId );
	subTest = checkEq( hr, true,                                subTest, "PAct Raw match" ); 
	subTest = checkEq( pact.Verb, config.PACTVERB_CONF,         subTest, "PAct Verb"); 
	subTest = checkEq( pact.GHUserName, config.TESTER_BOT,      subTest, "PAct user name" ); 
	subTest = checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
	subTest = checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
    }
    subTest = checkEq( addMP.Action, config.PACTACT_RELO,           subTest, "PAct action"); 
    subTest = checkEq( remA1.Action, config.PACTACT_CHAN,           subTest, "PAct action"); 
    subTest = checkEq( remA2.Action, config.PACTACT_CHAN,           subTest, "PAct action");
    let assignees = ( remA1.Subject[1] == ass1 && remA2.Subject[1] == ass2 ) || ( remA1.Subject[1] == ass2 && remA2.Subject[1] == ass1 );
    subTest = checkEq( assignees, true,                             subTest, "PAct sub"); 
    subTest = checkEq( remA1.Note, "remove assignee",               subTest, "PAct note"); 
    subTest = checkEq( remA2.Note, "remove assignee",               subTest, "PAct note"); 

    return await settle( subTest, testStatus, checkNoAssignees, authData, td, ass1, ass2, issueData, testStatus );
}

async function checkProgAssignees( authData, td, ass1, ass2, issueData, testStatus ) {
    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    let subTest = [ 0, 0, []];

    // CHECK github issues
    let meltIssue = await findIssue( authData, td, issueData[0] );
    subTest = checkEq( meltIssue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
    subTest = checkEq( meltIssue.number, issueData[1].toString(), subTest, "Github issue troubles" );
    subTest = checkEq( meltIssue.assignees.length, 2,             subTest, "Issue assignee count" );

    // CHECK Dynamo PEQ  .. no change already verified
    let peqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0] );
    subTest = checkEq( meltPeqs.length, 1, subTest, "Peq count" );
    let meltPeq = meltPeqs[0];
    
    // CHECK Dynamo PAct
    // Check new relevant actions
    let pacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let meltPacts = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    subTest = checkGE( meltPacts.length, 8, subTest, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    // earlier 5 verified: add peq, add assignees, rem assignees
    let len = meltPacts.length;
    let addA1  = meltPacts[len-3];   // add assignee 1
    let addA2  = meltPacts[len-2];   // add assignee 2
    let note1  = meltPacts[len-1];   // move to Prog
    for( const pact of [note1, addA1, addA2] ) {
	let hr     = await hasRaw( authData, pact.PEQActionId );
	subTest = checkEq( hr, true,                                subTest, "PAct Raw match" ); 
	subTest = checkEq( pact.Verb, config.PACTVERB_CONF,         subTest, "PAct Verb"); 
	subTest = checkEq( pact.GHUserName, config.TESTER_BOT,      subTest, "PAct user name" ); 
	subTest = checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
	subTest = checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
    }
    subTest = checkEq( note1.Action, config.PACTACT_NOTE,           subTest, "PAct Act"); 
    subTest = checkEq( addA1.Action, config.PACTACT_CHAN,           subTest, "PAct Act"); 
    subTest = checkEq( addA2.Action, config.PACTACT_CHAN,           subTest, "PAct Act"); 
    subTest = checkEq( addA1.Subject[1], ass1,                      subTest, "PAct sub"); 
    subTest = checkEq( addA2.Subject[1], ass2,                      subTest, "PAct sub"); 
    subTest = checkEq( addA1.Note, "add assignee",                  subTest, "PAct note"); 
    subTest = checkEq( addA2.Note, "add assignee",                  subTest, "PAct note"); 

    return await settle( subTest, testStatus, checkProgAssignees, authData, td, ass1, ass2, issueData, testStatus );
}


async function checkLabel( authData, label, name, desc, testStatus ) {

    if( name == -1 || desc == -1 ) {
	testStatus = checkEq( typeof label, 'undefined',  testStatus, "Label should not exist" );
	return testStatus;
    }

    testStatus = checkEq( typeof label !== 'undefined', true, testStatus, "Label not here yet" );
    if( typeof label !== 'undefined' ) {
	testStatus = checkEq( label.name, name,        testStatus, "Label name bad" );
	testStatus = checkEq( label.description, desc, testStatus, "Label description bad" );
    }
    
    return testStatus;
}


exports.shuffle         = shuffle;    // XXX utils
exports.refresh         = refresh;
exports.refreshRec      = refreshRec;  
exports.refreshFlat     = refreshFlat;
exports.refreshUnclaimed = refreshUnclaimed;
exports.buildIssueMap   = buildIssueMap;
exports.getQuad         = getQuad;
exports.makeTitleReducer = makeTitleReducer;

exports.makeProject     = makeProject;
exports.remProject      = remProject;
exports.makeColumn      = makeColumn;
exports.updateColumn    = updateColumn;
exports.updateProject   = updateProject;
exports.make4xCols      = make4xCols;
exports.makeAllocCard   = makeAllocCard;
exports.makeNewbornCard = makeNewbornCard;
exports.makeProjectCard = makeProjectCard;
exports.makeIssue       = makeIssue;
exports.makeAllocIssue  = makeAllocIssue;
exports.blastIssue      = blastIssue;

exports.addLabel        = addLabel;
exports.remLabel        = remLabel;
exports.updateLabel     = updateLabel;
exports.delLabel        = delLabel;
exports.addAssignee     = addAssignee;
exports.remAssignee     = remAssignee;
exports.moveCard        = moveCard;
exports.remCard         = remCard;
exports.closeIssue      = closeIssue;
exports.reopenIssue     = reopenIssue;
exports.remIssue        = remIssue;

exports.hasRaw          = hasRaw; 
exports.getPeqLabels    = getPeqLabels;
exports.getIssues       = getIssues;
exports.getProjects     = getProjects;
exports.getColumns      = getColumns;
exports.getCards        = getCards;
exports.getCard         = getCard;
exports.getLinks        = getLinks;
exports.getComments     = getComments;
exports.remLinks        = remLinks;
exports.purgeJobs       = purgeJobs;
exports.findIssue       = findIssue;
exports.findIssueByName = findIssueByName;
exports.findProject     = findProject;
exports.findRepo        = findRepo;
exports.getFlatLoc      = getFlatLoc; 
exports.getFullLoc      = getFullLoc; 

exports.findCardForIssue = findCardForIssue;
exports.setUnpopulated   = setUnpopulated;
exports.ingestPActs      = ingestPActs;

exports.checkEq         = checkEq;
exports.checkGE         = checkGE;
exports.checkLE         = checkLE;
exports.checkAr         = checkAr;
exports.testReport      = testReport;
exports.mergeTests      = mergeTests;
exports.settle          = settle;
exports.settleWithVal   = settleWithVal;

exports.checkNewlyClosedIssue   = checkNewlyClosedIssue;
exports.checkNewlyOpenedIssue   = checkNewlyOpenedIssue;
exports.checkNewlySituatedIssue = checkNewlySituatedIssue;
exports.checkNewlyAccruedIssue  = checkNewlyAccruedIssue;
exports.checkAlloc              = checkAlloc;                 // allocated issue
exports.checkSituatedIssue      = checkSituatedIssue;         // has active peq
exports.checkDemotedIssue       = checkDemotedIssue;          // has inactive peq
exports.checkUntrackedIssue     = checkUntrackedIssue;        // partial link table
exports.checkNewbornCard        = checkNewbornCard;           // no issue
exports.checkNewbornIssue       = checkNewbornIssue;          // no card
exports.checkSplit              = checkSplit;                 // result of incremental resolve
exports.checkAllocSplit         = checkAllocSplit;            // result of incremental resolve
exports.checkNoSplit            = checkNoSplit;               // no corresponding split issue
exports.checkUnclaimedIssue     = checkUnclaimedIssue;        // has active peq, unc:unc
exports.checkUnclaimedAccr      = checkUnclaimedAccr;
exports.checkNoCard             = checkNoCard;
exports.checkPact               = checkPact;
exports.checkNoIssue            = checkNoIssue;
exports.checkAssignees          = checkAssignees;
exports.checkNoAssignees        = checkNoAssignees;
exports.checkProgAssignees      = checkProgAssignees;
exports.checkLabel              = checkLabel;
