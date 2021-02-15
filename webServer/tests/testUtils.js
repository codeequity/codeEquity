var utils = require('../utils');
var config  = require('../config');
var assert = require('assert');

var ghUtils = require('../ghUtils');
var gh      = ghUtils.githubUtils;
var ghSafe  = ghUtils.githubSafe;

// Make up for rest variance, and GH slowness.  Expect 500-1000    Faster is in-person
//const MIN_DELAY = 1500;
const MIN_DELAY = 2500;     


// Had to add a small sleep in each make* - GH seems to get confused if requests come in too fast


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

    await( authData.ic.projects.listCards( { column_id: colId }))
	.then( allcards => { cards = allcards['data']; })
	.catch( e => { console.log( authData.who, "list cards failed.", e ); });

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

// Purge repo's links n locs from ceServer
async function remLinks( authData, ghLinks, repo ) {
    let postData = {"Endpoint": "Testing", "Request": "purgeLinks", "Repo": repo };
    let res = await utils.postCE( "testHandler", JSON.stringify( postData ));
    return res;
}

// Purge ceJobs from ceServer
async function purgeJobs( repo, owner ) {
    let fullName = owner + "/" + repo;
    let postData = {"Endpoint": "Testing", "Request": "purgeJobs", "FullName": fullName }; 
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

async function getFlatLoc( authData, projId, projName, colName ) {
    const cols = await getColumns( authData, projId );
    let col = cols.find(c => c.name == colName );

    let ptype = "plan";
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
    await utils.sleep( MIN_DELAY );
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

async function makeColumn( authData, projId, name ) {
    
    let cid = await authData.ic.projects.createColumn({ project_id: projId, name: name })
	.then((column) => { return column.data.id; })
	.catch( e => { console.log( authData.who, "Create column failed.", e ); });

    console.log( "MakeColumn:", name, cid );
    await utils.sleep( MIN_DELAY );
    return cid;
}

async function make4xCols( authData, projId ) {

    let plan = await makeColumn( authData, projId, config.PROJ_COLS[ config.PROJ_PLAN ] );
    let prog = await makeColumn( authData, projId, config.PROJ_COLS[ config.PROJ_PROG ] );
    let pend = await makeColumn( authData, projId, config.PROJ_COLS[ config.PROJ_PEND ] );
    let accr = await makeColumn( authData, projId, config.PROJ_COLS[ config.PROJ_ACCR ] );
	
    await utils.sleep( MIN_DELAY );
    return [prog, plan, pend, accr];
}


// do NOT return card or id here.  card is rebuilt to be driven from issue.
async function makeAllocCard( authData, colId, title, amount ) {
    let note = title + "\n<allocation, PEQ: " + amount + ">";
    
    let card = await authData.ic.projects.createCard({ column_id: colId, note: note })
	.then( c => c.data )
	.catch( e => console.log( authData.who, "Create alloc card failed.", e ));

    console.log( "Made AllocCard:", card.id, "but this will be deleted to make room for issue-card" );
    await utils.sleep( MIN_DELAY );
}

async function makeNewbornCard( authData, colId, title ) {
    let note = title;
    
    let cid = await authData.ic.projects.createCard({ column_id: colId, note: note })
	.then((card) => { return card.data.id; })
	.catch( e => { console.log( authData.who, "Create newborn card failed.", e ); });

    await utils.sleep( MIN_DELAY );
    return cid;
}

async function makeProjectCard( authData, colId, issueId ) {
    let card = await ghSafe.createProjectCard( authData, colId, issueId );
    await utils.sleep( MIN_DELAY );
    return card;
}

async function makeIssue( authData, td, title, labels ) {
    let issue = await ghSafe.createIssue( authData, td.GHOwner, td.GHRepo, title, labels, false );
    issue.push( title );
    await utils.sleep( MIN_DELAY );
    return issue;
}

async function blastIssue( authData, td, title, labels, assignees ) {
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
    await utils.sleep( MIN_DELAY );
    return issueData;
}

async function addLabel( authData, td, issueNumber, labelName ) {
    await authData.ic.issues.addLabels({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, labels: [labelName] })
	.catch( e => { console.log( authData.who, "Add label failed.", e ); });
    await utils.sleep( MIN_DELAY );
}	

async function remLabel( authData, td, issueNumber, label ) {
    console.log( "Removing", label.name, "from issueNum", issueNumber );
    await authData.ic.issues.removeLabel({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, name: label.name })
	.catch( e => { console.log( authData.who, "Remove label failed.", e ); });
    await utils.sleep( MIN_DELAY );
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
    await utils.sleep( MIN_DELAY );
}

async function addAssignee( authData, td, issueNumber, assignee ) {
    await authData.ic.issues.addAssignees({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, assignees: [assignee] })
	.catch( e => { console.log( authData.who, "Add assignee failed.", e ); });
    await utils.sleep( MIN_DELAY );
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

async function closeIssue( authData, td, issueNumber ) {
    await authData.ic.issues.update({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, state: "closed" })
	.catch( e => { console.log( authData.who, "Close issue failed.", e );	});
    await utils.sleep( MIN_DELAY );
}

async function reopenIssue( authData, td, issueNumber ) {
    console.log( "Opening", td.GHRepo, issueNumber );
    await authData.ic.issues.update({ owner: td.GHOwner, repo: td.GHRepo, issue_number: issueNumber, state: "open" })
	.catch( e => { console.log( authData.who, "Open issue failed.", e );	});
    await utils.sleep( MIN_DELAY );
}

async function remIssue( authData, td, issueId ) {

    let issue     = await findIssue( authData, td, issueId );
    let endpoint  = "https://api.github.com/graphql";
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
    console.log( "" );
}

function mergeTests( t1, t2 ) {
    return [t1[0] + t2[0], t1[1] + t2[1], t1[2].concat( t2[2] ) ];
}


// Untracked issues have only partial entries in link table
// Should work for carded issues that have never been peq.  Does NOT work for newborn.
async function checkUntrackedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 0;

    console.log( "Check Untracked issue", issueData );

    // CHECK github issues
    let issue  = await findIssue( authData, td, issueData[0] );
    testStatus = checkEq( issue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = checkEq( issue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = checkEq( issue.labels.length, labelCnt,         testStatus, "Issue label" );

    // CHECK linkage
    let links  = await getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let link   = ( links.filter((link) => link.GHIssueId == issueData[0] ))[0];
    testStatus = checkEq( link.GHIssueNum, issueData[1].toString(), testStatus, "Linkage Issue num" );
    testStatus = checkEq( link.GHCardId, card.id,                   testStatus, "Linkage Card Id" );
    testStatus = checkEq( link.GHColumnName, config.EMPTY,          testStatus, "Linkage Col name" );
    testStatus = checkEq( link.GHCardTitle, config.EMPTY,           testStatus, "Linkage Card Title" );
    testStatus = checkEq( link.GHProjectName, config.EMPTY,         testStatus, "Linkage Project Title" );
    testStatus = checkEq( link.GHColumnId, -1,                      testStatus, "Linkage Col Id" );
    testStatus = checkEq( link.GHProjectId, loc.projId,             testStatus, "Linkage project id" );     // XXX tracking this??

    // CHECK dynamo Peq.  inactive, if it exists
    let peqs      = await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let issuePeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    testStatus = checkLE( issuePeqs.length, 1,                      testStatus, "Peq count" );
    if( issuePeqs.length > 0 ) {
	let peq = issuePeqs[0];
	testStatus = checkEq( peq.Active, "false",                  testStatus, "peq should be inactive" );
	testStatus = checkEq( peq.GHIssueTitle, issueData[2],       testStatus, "peq title is wrong" );
	testStatus = checkEq( peq.CEGrantorId, config.EMPTY,        testStatus, "peq grantor wrong" );
    }

    // CHECK dynamo Pact.. nothing to do here for newborn

    return testStatus;
}

// Used for previously situated issues that were unlabeled
async function checkDemotedIssue( authData, ghLinks, td, loc, issueData, card, testStatus ) {

    console.log( "Check demotedissue", loc.projName, loc.colName );

    // For issues, linkage
    testStatus = await checkUntrackedIssue( authData, ghLinks, td, loc, issueData, card, testStatus );
	
     // CHECK github location
    let cards  = await getCards( authData, td.unclaimCID );   
    let tCard  = cards.filter((card) => card.hasOwnProperty( "content_url" ) ? card.content_url.split('/').pop() == issueData[1].toString() : false );
    testStatus = checkEq( tCard.length, 0,                       testStatus, "No unclaimed" );
    
    cards      = await getCards( authData, loc.colId );   
    let mCard  = cards.filter((card) => card.hasOwnProperty( "content_url" ) ? card.content_url.split('/').pop() == issueData[1].toString() : false );
    testStatus = checkEq( mCard.length, 1,                       testStatus, "Card claimed" );
    testStatus = checkEq( mCard[0].id, card.id,                  testStatus, "Card claimed" );
    

    // CHECK dynamo Peq.  inactive
    // Will have 1 or 2, both inactive, one for unclaimed, one for the demoted project.
    // Unclaimed may not have happened if peq'd a carded issue
    let peqs      = await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let issuePeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    testStatus = checkEq( issuePeqs.length, 1,                      testStatus, "Peq count" );
    for( const peq of issuePeqs ) {
	testStatus = checkEq( peq.Active, "false",                  testStatus, "peq should be inactive" );
	testStatus = checkEq( peq.GHIssueTitle, issueData[2],       testStatus, "peq title is wrong" );
	testStatus = checkEq( peq.CEGrantorId, config.EMPTY,        testStatus, "peq grantor wrong" );
    }
    let peqId = issuePeqs[0].GHProjectSub[0] == "UnClaimed" ? issuePeqs[1].PEQId : issuePeqs[0].PEQId;
    
    
    // CHECK dynamo Pact
    let pacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let issuePacts = pacts.filter((pact) => pact.Subject[0] == peqId );

    // Must have been a PEQ before. Depeq'd with unlabel, or delete.
    issuePacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let lastPact = issuePacts[ issuePacts.length - 1 ];
    
    let hasraw = await hasRaw( authData, lastPact.PEQActionId );
    testStatus = checkEq( hasraw, true,                            testStatus, "PAct Raw match" ); 
    testStatus = checkEq( lastPact.Verb, "confirm",                testStatus, "PAct Verb"); 
    testStatus = checkEq( lastPact.Action, "delete",               testStatus, "PAct Verb"); 
    testStatus = checkEq( lastPact.GHUserName, config.TESTER_BOT,  testStatus, "PAct user name" ); 
    testStatus = checkEq( lastPact.Ingested, "false",              testStatus, "PAct ingested" );
    testStatus = checkEq( lastPact.Locked, "false",                testStatus, "PAct locked" );

    return testStatus;
}

async function checkAlloc( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    let labelVal    = typeof specials !== 'undefined' && specials.hasOwnProperty( "val" )       ? specials.val         : 1000000;
    let labelCnt    = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )  ? specials.lblCount    : 1;
    let assignCnt   = typeof specials !== 'undefined' && specials.hasOwnProperty( "assignees" ) ? specials.assignees   : false;
    let state       = typeof specials !== 'undefined' && specials.hasOwnProperty( "state" )     ? specials.state       : "open";
    
    console.log( "Check Allocation", loc.projName, loc.colName, labelVal );

    // CHECK github issues
    let issue  = await findIssue( authData, td, issueData[0] );
    testStatus = checkEq( issue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = checkEq( issue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = checkEq( issue.labels.length, labelCnt,         testStatus, "Issue label count" );
    testStatus = checkEq( issue.state, state,                    testStatus, "Issue state" );

    const lname = labelVal.toString() + " AllocPEQ";
    testStatus = checkEq( issue.labels[0].name, lname,           testStatus, "Issue label name" );

    // CHECK github location
    cards = await getCards( authData, loc.colId );
    let mCard = cards.filter((card) => card.hasOwnProperty( "content_url" ) ? card.content_url.split('/').pop() == issueData[1].toString() : false );
    testStatus = checkEq( mCard.length, 1,                           testStatus, "Card claimed" );
    testStatus = checkEq( mCard[0].id, card.id,                      testStatus, "Card claimed" );

    // CHECK linkage
    let links    = await getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let link = ( links.filter((link) => link.GHIssueId == issueData[0] ))[0];
    testStatus = checkEq( link.GHIssueNum, issueData[1].toString(), testStatus, "Linkage Issue num" );
    testStatus = checkEq( link.GHCardId, card.id,                   testStatus, "Linkage Card Id" );
    testStatus = checkEq( link.GHColumnName, loc.colName,           testStatus, "Linkage Col name" );
    testStatus = checkEq( link.GHCardTitle, issueData[2],           testStatus, "Linkage Card Title" );
    testStatus = checkEq( link.GHProjectName, loc.projName,         testStatus, "Linkage Project Title" );
    testStatus = checkEq( link.GHColumnId, loc.colId,               testStatus, "Linkage Col Id" );
    testStatus = checkEq( link.GHProjectId, loc.projId,             testStatus, "Linkage project id" );

    // CHECK dynamo Peq
    let allPeqs  =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let peqs = allPeqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    testStatus = checkEq( peqs.length, 1,                          testStatus, "Peq count" );
    let peq = peqs[0];

    testStatus = checkEq( peq.PeqType, "allocation",               testStatus, "peq type invalid" );        
    testStatus = checkEq( peq.GHProjectSub.length, loc.projSub.length, testStatus, "peq project sub len invalid" );
    testStatus = checkEq( peq.GHIssueTitle, issueData[2],          testStatus, "peq title is wrong" );
    testStatus = checkEq( peq.GHHolderId.length, 0,                testStatus, "peq holders wrong" );      
    testStatus = checkEq( peq.CEHolderId.length, 0,                testStatus, "peq holders wrong" );    
    testStatus = checkEq( peq.CEGrantorId, config.EMPTY,           testStatus, "peq grantor wrong" );      
    testStatus = checkEq( peq.Amount, labelVal,                    testStatus, "peq amount" );
    testStatus = checkEq( peq.Active, "true",                      testStatus, "peq" );
    testStatus = checkEq( peq.GHProjectId, loc.projId,             testStatus, "peq project id bad" );
    for( let i = 0; i < loc.projSub.length; i++ ) {
	testStatus = checkEq( peq.GHProjectSub[i], loc.projSub[i], testStatus, "peq project sub bad" );
    }

    // CHECK dynamo Pact
    let allPacts  = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    testStatus = checkGE( pacts.length, 1,                         testStatus, "PAct count" );  
    
    // Could have been many operations on this.
    for( const pact of pacts ) {
	let hasraw = await hasRaw( authData, pact.PEQActionId );
	testStatus = checkEq( hasraw, true,                            testStatus, "PAct Raw match" ); 
	testStatus = checkEq( pact.GHUserName, config.TESTER_BOT,      testStatus, "PAct user name" ); 
	testStatus = checkEq( pact.Locked, "false",                    testStatus, "PAct locked" );
	testStatus = checkEq( pact.Ingested, "false",                  testStatus, "PAct ingested" );
    }

    return testStatus;
}

async function checkSituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    let muteIngested = typeof specials !== 'undefined' && specials.hasOwnProperty( "muteIngested" ) ? specials.muteIngested : false;
    let issueState   = typeof specials !== 'undefined' && specials.hasOwnProperty( "state" )        ? specials.state        : false;
    let labelVal     = typeof specials !== 'undefined' && specials.hasOwnProperty( "label" )        ? specials.label        : false;
    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 1;
    let skipPeqPID   = typeof specials !== 'undefined' && specials.hasOwnProperty( "skipPeqPID" )   ? specials.skipPeqPID   : false;
    
    console.log( "Check situated issue", loc.projName, loc.colName, muteIngested, labelVal );

    // CHECK github issues
    let issue  = await findIssue( authData, td, issueData[0] );
    testStatus = checkEq( issue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = checkEq( issue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = checkEq( issue.labels.length, labelCnt,         testStatus, "Issue label count" );

    const lname = labelVal ? labelVal.toString() + " PEQ" : "1000 PEQ";
    const lval  = labelVal ? labelVal                     : 1000;
    testStatus = checkEq( issue.labels[0].name, lname,           testStatus, "Issue label name" );

    if( issueState ) { testStatus = checkEq( issue.state, issueState, testStatus, "Issue state" );  }

    // CHECK github location
    let cards = td.unclaimCID == config.EMPTY ? [] : await getCards( authData, td.unclaimCID );   
    let tCard = cards.filter((card) => card.hasOwnProperty( "content_url" ) ? card.content_url.split('/').pop() == issueData[1].toString() : false );
    testStatus = checkEq( tCard.length, 0,                           testStatus, "No unclaimed" );

    cards = await getCards( authData, loc.colId );
    let mCard = cards.filter((card) => card.hasOwnProperty( "content_url" ) ? card.content_url.split('/').pop() == issueData[1].toString() : false );
    testStatus = checkEq( mCard.length, 1,                           testStatus, "Card claimed" );
    testStatus = checkEq( mCard[0].id, card.id,                      testStatus, "Card claimed" );

    // CHECK linkage
    let links    = await getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let link = ( links.filter((link) => link.GHIssueId == issueData[0] ))[0];
    testStatus = checkEq( link.GHIssueNum, issueData[1].toString(), testStatus, "Linkage Issue num" );
    testStatus = checkEq( link.GHCardId, card.id,                   testStatus, "Linkage Card Id" );
    testStatus = checkEq( link.GHColumnName, loc.colName,           testStatus, "Linkage Col name" );
    testStatus = checkEq( link.GHCardTitle, issueData[2],           testStatus, "Linkage Card Title" );
    testStatus = checkEq( link.GHProjectName, loc.projName,         testStatus, "Linkage Project Title" );
    testStatus = checkEq( link.GHColumnId, loc.colId,               testStatus, "Linkage Col Id" );
    testStatus = checkEq( link.GHProjectId, loc.projId,             testStatus, "Linkage project id" );

    // CHECK dynamo Peq
    let allPeqs  =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let peqs = allPeqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    testStatus = checkEq( peqs.length, 1,                          testStatus, "Peq count" );
    let peq = peqs[0];

    testStatus = checkEq( peq.PeqType, loc.peqType,                testStatus, "peq type invalid" );        
    testStatus = checkEq( peq.GHProjectSub.length, loc.projSub.length, testStatus, "peq project sub len invalid" );
    testStatus = checkEq( peq.GHIssueTitle, issueData[2],          testStatus, "peq title is wrong" );
    testStatus = checkEq( peq.GHHolderId.length, 0,                testStatus, "peq holders wrong" );      
    testStatus = checkEq( peq.CEHolderId.length, 0,                testStatus, "peq holders wrong" );    
    testStatus = checkEq( peq.CEGrantorId, config.EMPTY,           testStatus, "peq grantor wrong" );      
    testStatus = checkEq( peq.Amount, lval,                        testStatus, "peq amount" );
    testStatus = checkEq( peq.GHProjectSub[0], loc.projSub[0],     testStatus, "peq project sub 0 invalid" );
    testStatus = checkEq( peq.Active, "true",                      testStatus, "peq" );
    if( !skipPeqPID ) {
	testStatus = checkEq( peq.GHProjectId, loc.projId,         testStatus, "peq project id bad" );
    }

    // CHECK dynamo Pact
    let allPacts  = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    testStatus = checkGE( pacts.length, 1,                         testStatus, "PAct count" );  

    // This can get out of date quickly.  Only check this if early on, before lots of moving (which PEQ doesn't keep up with)
    if( pacts.length <= 3 && loc.projSub.length > 1 ) {
	const pip = [ config.PROJ_COLS[config.PROJ_PEND], config.PROJ_COLS[config.PROJ_ACCR] ];
	if( !pip.includes( loc.projSub[1] )) { 
	    testStatus = checkEq( peq.GHProjectSub[1], loc.projSub[1], testStatus, "peq project sub 1 invalid" );
	}
    }
    
    // Could have been many operations on this.
    for( const pact of pacts ) {
	let hasraw = await hasRaw( authData, pact.PEQActionId );
	testStatus = checkEq( hasraw, true,                            testStatus, "PAct Raw match" ); 
	testStatus = checkEq( pact.GHUserName, config.TESTER_BOT,      testStatus, "PAct user name" ); 
	testStatus = checkEq( pact.Locked, "false",                    testStatus, "PAct locked" );

	if( !muteIngested ) { testStatus = checkEq( pact.Ingested, "false", testStatus, "PAct ingested" ); }
    }

    return testStatus;
}


async function checkUnclaimedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    let labelVal     = typeof specials !== 'undefined' && specials.hasOwnProperty( "label" )        ? specials.label        : false;
    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 1;
    
    console.log( "Check unclaimed issue", loc.projName, loc.colName, labelVal );

    // CHECK github issues
    let issue  = await findIssue( authData, td, issueData[0] );
    testStatus = checkEq( issue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = checkEq( issue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = checkEq( issue.labels.length, labelCnt,         testStatus, "Issue label count" );
    
    const lname = labelVal ? labelVal.toString() + " PEQ" : "1000 PEQ";
    const lval  = labelVal ? labelVal                     : 1000;
    testStatus = checkEq( issue.labels[0].name, lname,           testStatus, "Issue label name" );
    testStatus = checkEq( issue.state, "open",                   testStatus, "Issue state" ); 

    // CHECK github location
    let cards = td.unclaimCID == config.EMPTY ? [] : await getCards( authData, td.unclaimCID );   
    let tCard = cards.filter((card) => card.hasOwnProperty( "content_url" ) ? card.content_url.split('/').pop() == issueData[1].toString() : false );
    testStatus = checkEq( tCard.length, 1,                        testStatus, "No unclaimed" );
    testStatus = checkEq( tCard[0].id, card.id,                   testStatus, "Card id" );
    
    // CHECK linkage
    let links    = await getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let link = ( links.filter((link) => link.GHIssueId == issueData[0] ))[0];
    testStatus = checkEq( link.GHIssueNum, issueData[1].toString(), testStatus, "Linkage Issue num" );
    testStatus = checkEq( link.GHCardId, card.id,                   testStatus, "Linkage Card Id" );
    testStatus = checkEq( link.GHColumnName, loc.colName,           testStatus, "Linkage Col name" );
    testStatus = checkEq( link.GHCardTitle, issueData[2],           testStatus, "Linkage Card Title" );
    testStatus = checkEq( link.GHProjectName, loc.projName,         testStatus, "Linkage Project Title" );
    testStatus = checkEq( link.GHColumnId, loc.colId,               testStatus, "Linkage Col Id" );
    testStatus = checkEq( link.GHProjectId, loc.projId,             testStatus, "Linkage project id" );

    // CHECK dynamo Peq
    let allPeqs  =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let peqs = allPeqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    testStatus = checkEq( peqs.length, 1,                          testStatus, "Peq count" );
    let peq = peqs[0];

    testStatus = checkEq( peq.PeqType, loc.peqType,                testStatus, "peq type invalid" );        
    testStatus = checkEq( peq.GHProjectSub.length, loc.projSub.length, testStatus, "peq project sub len invalid" );
    testStatus = checkEq( peq.GHIssueTitle, issueData[2],          testStatus, "peq title is wrong" );
    testStatus = checkEq( peq.GHHolderId.length, 0,                testStatus, "peq holders wrong" );      
    testStatus = checkEq( peq.CEHolderId.length, 0,                testStatus, "peq holders wrong" );    
    testStatus = checkEq( peq.CEGrantorId, config.EMPTY,           testStatus, "peq grantor wrong" );      
    testStatus = checkEq( peq.Amount, lval,                        testStatus, "peq amount" );
    testStatus = checkEq( peq.GHProjectSub[0], loc.projSub[0],     testStatus, "peq project sub 0 invalid" );
    testStatus = checkEq( peq.Active, "true",                      testStatus, "peq" );
    testStatus = checkEq( peq.GHProjectId, loc.projId,             testStatus, "peq project id bad" );

    // CHECK dynamo Pact
    let allPacts  = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    testStatus = checkGE( pacts.length, 1,                         testStatus, "PAct count" );  

    // This can get out of date quickly.  Only check this if early on, before lots of moving (which PEQ doesn't keep up with)
    if( pacts.length <= 3 && loc.projSub.length > 1 ) {
	const pip = [ config.PROJ_COLS[config.PROJ_PEND], config.PROJ_COLS[config.PROJ_ACCR] ];
	if( !pip.includes( loc.projSub[1] )) { 
	    testStatus = checkEq( peq.GHProjectSub[1], loc.projSub[1], testStatus, "peq project sub 1 invalid" );
	}
    }
    
    // Could have been many operations on this.
    for( const pact of pacts ) {
	let hasraw = await hasRaw( authData, pact.PEQActionId );
	testStatus = checkEq( hasraw, true,                            testStatus, "PAct Raw match" ); 
	testStatus = checkEq( pact.GHUserName, config.TESTER_BOT,      testStatus, "PAct user name" ); 
	testStatus = checkEq( pact.Locked, "false",                    testStatus, "PAct locked" );
	testStatus = checkEq( pact.Ingested, "false",                  testStatus, "PAct ingested" );
    }

    return testStatus;
}


// Check last PAct
async function checkNewlyClosedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    if( typeof specials === 'undefined' ) { specials = {}; }
    if( !specials.state ) { specials.state = "closed"; }
    testStatus = await checkSituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials );

    console.log( "Check Closed issue", loc.projName, loc.colName );
    
    const allPeqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    const peqs = allPeqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    const peq = peqs[0];

    // CHECK dynamo Pact
    const allPacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    const pact = pacts[ pacts.length - 1];
    testStatus = checkEq( pact.Verb, "propose",                testStatus, "PAct Verb"); 
    testStatus = checkEq( pact.Action, "accrue",               testStatus, "PAct Action"); 

    return testStatus;
}

// Check last PAct
async function checkNewlyOpenedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    if( typeof specials === 'undefined' ) { specials = {}; }
    if( !specials.state ) { specials.state = "open"; }
    testStatus = await checkSituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials );

    console.log( "Check Opened issue", loc.projName, loc.colName );
    
    const allPeqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    const peqs = allPeqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    const peq = peqs[0];

    // CHECK dynamo Pact
    const allPacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    const pact = pacts[ pacts.length - 1];
    testStatus = checkEq( pact.Verb, "reject",                testStatus, "PAct Verb"); 
    testStatus = checkEq( pact.Action, "accrue",               testStatus, "PAct Action"); 

    return testStatus;
}



async function checkNewlySituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    if( typeof specials === 'undefined' ) { specials = {}; }
    if( !specials.hasOwnProperty( "state" ) ) { specials.state = "open"; }
    testStatus = await checkSituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials );

    console.log( "Check newly situated issue", loc.projName, loc.colName );

    // CHECK dynamo Peq
    let allPeqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let peqs = allPeqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    testStatus = checkEq( peqs.length, 1,                          testStatus, "Peq count" );
    let peq = peqs[0];
    testStatus = checkEq( peq.PeqType, loc.peqType,                testStatus, "peq type invalid" );       
    testStatus = checkEq( peq.GHProjectSub.length, loc.projSub.length, testStatus, "peq project sub invalid" );
    testStatus = checkEq( peq.GHIssueTitle, issueData[2],          testStatus, "peq title is wrong" );
    testStatus = checkEq( peq.GHHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = checkEq( peq.CEHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = checkEq( peq.CEGrantorId, config.EMPTY,           testStatus, "peq grantor wrong" );
    testStatus = checkEq( peq.GHProjectSub[0], loc.projSub[0],     testStatus, "peq project sub invalid" );
    if( loc.projSub.length > 1 ) {
	testStatus = checkEq( peq.GHProjectSub[1], loc.projSub[1], testStatus, "peq project sub invalid" );
    }
    testStatus = checkEq( peq.GHProjectId, loc.projId,             testStatus, "peq PID bad" );
    testStatus = checkEq( peq.Active, "true",                      testStatus, "peq" );

    // CHECK dynamo Pact
    // label carded issue?  1 pact.  attach labeled issue to proj col?  2 pact.
    // Could be any number.  add (unclaimed).  change (assign) x n.  relocate (peqify)
    let allPacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    testStatus = checkGE( pacts.length, 1,                         testStatus, "PAct count" );         
    
    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let addUncl  = pacts.length >= 2 ? pacts[0] : {"Action": "add" };
    let relUncl  = pacts.length >= 2 ? pacts[ pacts.length -1 ] : {"Action": "relocate" };
    let pact     = pacts.length >= 2 ? pacts[ pacts.length -1 ] : pacts[0];
    for( const pact of pacts ) {
	let hasraw = await hasRaw( authData, pact.PEQActionId );
	testStatus = checkEq( hasraw, true,                            testStatus, "PAct Raw match" ); 
	testStatus = checkEq( pact.Verb, "confirm",                    testStatus, "PAct Verb"); 
	testStatus = checkEq( pact.GHUserName, config.TESTER_BOT,      testStatus, "PAct user name" ); 
	testStatus = checkEq( pact.Ingested, "false",                  testStatus, "PAct ingested" );
	testStatus = checkEq( pact.Locked, "false",                    testStatus, "PAct locked" );
    }
    testStatus = checkEq( addUncl.Action, "add",                       testStatus, "PAct Action"); 
    testStatus = checkEq( relUncl.Action, "relocate",                  testStatus, "PAct Action");
    const source = pact.Action == "add" || pact.Action == "relocate";
    testStatus = checkEq( source, true,                                testStatus, "PAct Action"); 

    return testStatus;
}

async function checkNewlyAccruedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    testStatus = await checkSituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials );

    console.log( "Check newly accrued issue", loc.projName, loc.colName );

    // CHECK dynamo Peq
    let allPeqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let peqs = allPeqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    testStatus = checkEq( peqs.length, 1,                          testStatus, "Peq count" );
    let peq = peqs[0];

    // CHECK dynamo Pact  smallest number is add, move.  check move (confirm accr)
    let allPacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    testStatus = checkGE( pacts.length, 2,                         testStatus, "PAct count" );         
    
    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let pact = pacts[ pacts.length - 1];
    testStatus = checkEq( pact.Verb, "confirm",                    testStatus, "PAct Verb"); 
    testStatus = checkEq( pact.Action, "accrue",                   testStatus, "PAct Action");

    return testStatus;
}

// Accrued in !unclaimed just removed.  Check landing in unclaimed, which depends on source (delete card, delete issue)
// construct data from new issue and new card as needed.
async function checkUnclaimedAccr( authData, ghLinks, td, loc, issueDataOld, issueDataNew, cardNew, testStatus, source ) {

    // Don't check peq projectID for card delete.  Issue is old issue, peq is behind.  Pact knows all.  
    let skip = source == "card" ? true : false; 
    if( source == "card" ) { assert( issueDataOld[0] == issueDataNew[0] ); }

    testStatus = await checkSituatedIssue( authData, ghLinks, td, loc, issueDataNew, cardNew, testStatus, { "skipPeqPID": skip });

    console.log( "Check unclaimed accrued issue", loc.projName, loc.colName, issueDataOld );
    
    // CHECK dynamo Peq
    let allPeqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let peqs = allPeqs.filter((peq) => peq.GHIssueId == issueDataNew[0].toString() );
    testStatus = checkEq( peqs.length, 1,                          testStatus, "Peq count" );
    let peq = peqs[0];

    // CHECK dynamo Pact 
    let allPacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    testStatus = checkGE( pacts.length, 1,                         testStatus, "PAct count" );

    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let pact = pacts[ pacts.length - 1];
    testStatus = checkEq( pact.Verb, "confirm",                testStatus, "PAct Verb"); 
    if     ( source == "card" )  { testStatus = checkEq( pact.Action, "relocate",        testStatus, "PAct Action"); }
    else if( source == "issue" ) { testStatus = checkEq( pact.Action, "add",             testStatus, "PAct Action"); }

    // Check old issue
    // For source == issue, new peq is added.  Old peq is changed.
    if( source == "issue" ) {
	// PEQ inactive
	peqs = allPeqs.filter((peq) => peq.GHIssueId == issueDataOld[0].toString() );
	peq = peqs[0];
	testStatus = checkEq( peqs.length, 1,                       testStatus, "Peq count" );
	testStatus = checkEq( peq.Active, "false",                  testStatus, "peq should be inactive" );
	
	// CHECK dynamo Pact  old: add, move, change
	pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
	testStatus = checkGE( pacts.length, 3,                         testStatus, "PAct count" );
	
	pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
	let pact = pacts[ pacts.length - 1];
	testStatus = checkEq( pact.Verb, "confirm",                testStatus, "PAct Verb"); 
	testStatus = checkEq( pact.Action, "change",               testStatus, "PAct Action"); 
	testStatus = checkEq( pact.Note, "recreate",               testStatus, "PAct Note"); 
    }

    return testStatus;
}


async function checkNewbornCard( authData, ghLinks, td, loc, cardId, title, testStatus ) {

    console.log( "Check Newborn Card", title, cardId );

    // CHECK github issue
    // no need, get content link below
    
    // CHECK github card
    let cards  = await getCards( authData, loc.colId );
    let card   = cards.find( card => card.id == cardId );
    const cardTitle = card.note.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    testStatus = checkEq( card.hasOwnProperty( "content_url" ), false, testStatus, "Newbie has content" );
    testStatus = checkEq( cardTitle, title,                            testStatus, "Newbie title" );

    // CHECK linkage
    let links  = await getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let link   = links.find( l => l.GHCardId == cardId );
    testStatus = checkEq( typeof link, "undefined",                    testStatus, "Newbie link exists" );

    // CHECK dynamo Peq.  inactive, if it exists
    // Risky test - will fail if unrelated peqs with same title exist
    let peqs = await utils.getPeqs( authData, { "GHRepo": td.GHFullName, "GHIssueTitle": title });
    testStatus = checkEq( peqs, -1,                                    testStatus, "Newbie peq exists" );

    // CHECK dynamo Pact.. nothing to do here for newborn

    return testStatus;
}

async function checkNewbornIssue( authData, ghLinks, td, issueData, testStatus, specials ) {

    console.log( "Check Newborn Issue", issueData);
    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 0;
    
    // CHECK github issue
    let issue  = await findIssue( authData, td, issueData[0] );
    testStatus = checkEq( issue.id, issueData[0].toString(),     testStatus, "Github issue troubles" );
    testStatus = checkEq( issue.number, issueData[1].toString(), testStatus, "Github issue troubles" );
    testStatus = checkEq( issue.title, issueData[2],             testStatus, "Github issue troubles" );
    testStatus = checkEq( issue.labels.length, labelCnt,         testStatus, "Issue label" );

    // CHECK github card
    // no need, get content link below
    
    // CHECK linkage
    let links  = await getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let link   = links.find( l => l.GHIssueId == issueData[0].toString() );
    testStatus = checkEq( typeof link, "undefined",                    testStatus, "Newbie link exists" );

    // CHECK dynamo Peq.  inactive, if it exists
    let peqs = await utils.getPeqs( authData, { "GHRepo": td.GHFullName, "GHIssueId": issueData[0] });
    if( peqs != -1 ) {
	let peq = peqs.find(peq => peq.GHIssueId == issueData[0].toString() );
	testStatus = checkEq( peq.Active, "false",                  testStatus, "peq should be inactive" );
	testStatus = checkEq( peq.GHIssueTitle, issueData[2],       testStatus, "peq title is wrong" );
	testStatus = checkEq( peq.CEGrantorId, config.EMPTY,        testStatus, "peq grantor wrong" );
    }

    // CHECK dynamo Pact.. nothing to do here for newborn

    return testStatus;
}

async function checkSplit( authData, ghLinks, td, issDat, origLoc, newLoc, origVal, testStatus, specials ) {
    let situated   = typeof specials !== 'undefined' && specials.hasOwnProperty( "peq" )        ? specials.peq        : false;
    let labelCnt   = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )   ? specials.lblCount   : 1;
    let assignCnt  = typeof specials !== 'undefined' && specials.hasOwnProperty( "assignees" )  ? specials.assignees  : 1;

    console.log( "Check Split", issDat[2], origLoc.colName, newLoc.colName );

    // Get new issue
    let issues   = await getIssues( authData, td );
    let issue    = await findIssue( authData, td, issDat[0] );    
    let splitIss = issues.find( issue => issue.title.includes( issDat[2] + " split" ));
    const splitDat = typeof splitIss == 'undefined' ? [-1, -1, -1] : [ splitIss.id.toString(), splitIss.number.toString(), splitIss.title ];
    assert( splitDat[0] != -1 );
    
    // Get cards
    let allLinks  = await getLinks( authData, ghLinks, { repo: td.GHFullName });
    let issLink   = allLinks.find( l => l.GHIssueId == issDat[0].toString() );
    let splitLink = allLinks.find( l => l.GHIssueId == splitDat[0].toString() );

    if( typeof issLink === 'undefined' ) { console.log( allLinks ); console.log( issDat ); }
	
    assert( typeof issLink !== 'undefined' );
    assert( typeof splitLink !== 'undefined' );
    const card      = await getCard( authData, issLink.GHCardId );
    const splitCard = await getCard( authData, splitLink.GHCardId );

    if( situated ) {
	let lval = origVal / 2;
	testStatus = await checkSituatedIssue( authData, ghLinks, td, origLoc, issDat,   card,      testStatus, {label: lval, lblCount: labelCnt} );
	testStatus = await checkSituatedIssue( authData, ghLinks, td, newLoc,  splitDat, splitCard, testStatus, {label: lval, lblCount: labelCnt } );
    }
    else {
	testStatus = await checkUntrackedIssue( authData, ghLinks, td, origLoc, issDat,   card,      testStatus, {lblCount: labelCnt} );
	testStatus = await checkUntrackedIssue( authData, ghLinks, td, newLoc,  splitDat, splitCard, testStatus, {lblCount: labelCnt } );
    }
    testStatus = checkEq( issue.state, splitIss.state,    testStatus, "Issues have different state" );
    
    // check assign
    testStatus = checkEq( issue.assignees.length, assignCnt,    testStatus, "Issue assignee count" );
    testStatus = checkEq( splitIss.assignees.length, assignCnt, testStatus, "Issue assignee count" );

    // Check comment on splitIss
    const comments = await getComments( authData, td, splitDat[1] );
    testStatus = checkEq( comments[0].body.includes( "CodeEquity duplicated" ), true,   testStatus, "Comment bad" );
    
    return testStatus;
}


async function checkAllocSplit( authData, ghLinks, td, issDat, origLoc, newLoc, origVal, testStatus, specials ) {
    let labelCnt   = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )   ? specials.lblCount   : 1;
    let assignCnt  = typeof specials !== 'undefined' && specials.hasOwnProperty( "assignees" )  ? specials.assignees  : 1;

    console.log( "Check Alloc Split", issDat[2], origLoc.colName, newLoc.colName );

    // Get new issue
    let issues   = await getIssues( authData, td );
    let issue    = await findIssue( authData, td, issDat[0] );    
    let splitIss = issues.find( issue => issue.title.includes( issDat[2] + " split" ));
    const splitDat = typeof splitIss == 'undefined' ? [-1, -1, -1] : [ splitIss.id.toString(), splitIss.number.toString(), splitIss.title ];
    assert( splitDat[0] != -1 );
    
    // Get cards
    let allLinks  = await getLinks( authData, ghLinks, { repo: td.GHFullName });
    let issLink   = allLinks.find( l => l.GHIssueId == issDat[0].toString() );
    let splitLink = allLinks.find( l => l.GHIssueId == splitDat[0].toString() );

    if( typeof issLink === 'undefined' ) { console.log( allLinks ); console.log( issDat ); }
	
    assert( typeof issLink !== 'undefined' );
    assert( typeof splitLink !== 'undefined' );
    const card      = await getCard( authData, issLink.GHCardId );
    const splitCard = await getCard( authData, splitLink.GHCardId );

    let lval = origVal / 2;
    testStatus = await checkAlloc( authData, ghLinks, td, origLoc, issDat,   card,      testStatus, {val: lval, lblCount: labelCnt, assignees: assignCnt } );
    testStatus = await checkAlloc( authData, ghLinks, td, newLoc,  splitDat, splitCard, testStatus, {val: lval, lblCount: labelCnt, assignees: assignCnt } );
    testStatus = checkEq( issue.state, splitIss.state,    testStatus, "Issues have different state" );
    
    // check assign
    testStatus = checkEq( issue.assignees.length, assignCnt,    testStatus, "Issue assignee count" );
    testStatus = checkEq( splitIss.assignees.length, assignCnt, testStatus, "Issue assignee count" );

    // Check comment on splitIss
    const comments = await getComments( authData, td, splitDat[1] );
    testStatus = checkEq( comments[0].body.includes( "CodeEquity duplicated" ), true,   testStatus, "Comment bad" );
    
    return testStatus;
}

async function checkNoSplit( authData, ghLinks, td, issDat, newLoc, cardId, testStatus ) {
    
    console.log( "Check No Split", issDat[2], newLoc.colName );

    const splitName = issDat[2] + " split";
    
    // Check issue
    let issues   = await getIssues( authData, td );
    let splitIss = issues.find( issue => issue.title.includes( splitName ));
				
    testStatus = checkEq( typeof splitIss, 'undefined', testStatus, "Split issue should not exist" );
				
    // Check card
    let colCards = await getCards( authData, newLoc.colId );
    let noCard = true;
    if( colCards != -1 ) {
	const card = colCards.find( c => c.note && c.note.includes( splitName ));
	if( typeof card !== 'undefined' ) { noCard = false; }
    }
    testStatus = checkEq( noCard, true,                  testStatus, "Split card should not exist" );

    // Check peq
    let allPeqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let peq = allPeqs.find( peq => peq.GHIssueTitle.includes( splitName ));
    testStatus = checkEq( typeof peq, 'undefined',       testStatus, "Peq should not exist" );

    // Linkage, id search.
    testStatus = checkNoCard( authData, ghLinks, td, newLoc, cardId, issDat[2], testStatus, {skipAllPeq: true} );
    
    return testStatus;
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
	testStatus = checkEq( typeof card, "undefined",            testStatus, "Card should not exist" );
    }

    // CHECK linkage
    let links  = await getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let link   = links.find( l => l.GHCardId == cardId.toString() );
    testStatus = checkEq( typeof link, "undefined",                testStatus, "Link should not exist" );

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

    let subject = typeof specials !== 'undefined' && specials.hasOwnProperty( "sub" )   ? specials.sub   : -1;

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
    pact     = pacts[ pacts.length - 1];

    testStatus = checkGE( pacts.length, 1,                     testStatus, "PAct count" );
    testStatus = checkEq( pact.Verb, verb,                     testStatus, "pact verb" );
    testStatus = checkEq( pact.Action, action,                 testStatus, "pact action" );
    testStatus = checkEq( pact.Note, note,                     testStatus, "pact note" );

    if( subject != -1 ) {
	testStatus = checkEq( pact.Subject.length, subject.length,       testStatus, "pact subject" );
	for( let i = 0; i < subject.length; i++ ) {
	    testStatus = checkEq( pact.Subject[i], subject[i],           testStatus, "pact subject" );
	}
    }

    return testStatus;
}

async function checkNoIssue( authData, ghLinks, td, issueData, testStatus ) {

    console.log( "Check No Issue", issueData );

    // CHECK github issue
    let issue  = await findIssue( authData, td, issueData[0] );
    testStatus = checkEq( issue, -1,                               testStatus, "Issue should not exist" );

    // CHECK linkage
    let links  = await getLinks( authData, ghLinks, { "repo": td.GHFullName } );
    let link   = links.find( l => l.GHIssueId == issueData[0] );
    testStatus = checkEq( typeof link, "undefined",                testStatus, "Link should not exist" );

    return testStatus;
}


async function checkAssignees( authData, td, assigns, issueData, testStatus ) {
    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    
    // CHECK github issues
    let issue  = await findIssue( authData, td, issueData[0] );
    testStatus = checkEq( issue.id, issueData[0].toString(),      testStatus, "Github issue troubles" );
    testStatus = checkEq( issue.number, issueData[1].toString(),  testStatus, "Github issue troubles" );
    testStatus = checkEq( issue.assignees.length, assigns.length, testStatus, "Issue assignee count" );
    for( let i = 0; i < assigns.length; i++ ) {
	testStatus = checkEq( issue.assignees[i].login, assigns[i], testStatus, "assignee1" );
    }

    // CHECK Dynamo PEQ
    // Should be no change
    let peqs =  await utils.getPeqs( authData, { "GHRepo": td.GHFullName });
    let meltPeqs = peqs.filter((peq) => peq.GHIssueId == issueData[0].toString() );
    testStatus = checkEq( meltPeqs.length, 1,                          testStatus, "Peq count" );
    let meltPeq = meltPeqs[0];
    testStatus = checkEq( meltPeq.PeqType, "plan",                     testStatus, "peq type invalid" );
    testStatus = checkEq( meltPeq.GHProjectSub.length, 2,              testStatus, "peq project sub invalid" );
    testStatus = checkEq( meltPeq.GHIssueTitle, issueData[2],          testStatus, "peq title is wrong" );
    testStatus = checkEq( meltPeq.GHHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = checkEq( meltPeq.CEHolderId.length, 0,                testStatus, "peq holders wrong" );
    testStatus = checkEq( meltPeq.CEGrantorId, config.EMPTY,           testStatus, "peq grantor wrong" );
    testStatus = checkEq( meltPeq.Amount, 1000,                        testStatus, "peq amount" );
    testStatus = checkEq( meltPeq.GHProjectSub[0], td.softContTitle,   testStatus, "peq project sub invalid" );
    testStatus = checkEq( meltPeq.GHProjectSub[1], td.dataSecTitle,    testStatus, "peq project sub invalid" );
    testStatus = checkEq( meltPeq.GHProjectId, td.dataSecPID,          testStatus, "peq unclaimed PID bad" );
    testStatus = checkEq( meltPeq.Active, "true",                      testStatus, "peq" );

    
    // CHECK Dynamo PAct
    // Should show relevant change action.. last three are related to current entry - may be more for unclaimed
    let pacts = await utils.getPActs( authData, {"GHRepo": td.GHFullName} );
    let meltPacts = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    testStatus = checkGE( meltPacts.length, 3,                            testStatus, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    
    for( const pact of meltPacts ) {
	let hasraw = await hasRaw( authData, pact.PEQActionId );
	testStatus = checkEq( hasraw, true,                            testStatus, "PAct Raw match" ); 
	testStatus = checkEq( pact.GHUserName, config.TESTER_BOT,      testStatus, "PAct user name" ); 
	testStatus = checkEq( pact.Ingested, "false",                  testStatus, "PAct ingested" );
	testStatus = checkEq( pact.Locked, "false",                    testStatus, "PAct locked" );
    }
    
    return testStatus;
}

async function checkLabel( authData, label, name, desc, testStatus ) {

    if( name == -1 || desc == -1 ) {
	testStatus = checkEq( typeof label, 'undefined',  testStatus, "Label should not exist" );
	return testStatus;
    }
    
    testStatus = checkEq( label.name, name,        testStatus, "Label name bad" );
    testStatus = checkEq( label.description, desc, testStatus, "Label description bad" );
    
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
exports.remProject      = remProject;
exports.makeColumn      = makeColumn;
exports.updateColumn    = updateColumn;
exports.updateProject   = updateProject;
exports.make4xCols      = make4xCols;
exports.makeAllocCard   = makeAllocCard;
exports.makeNewbornCard = makeNewbornCard;
exports.makeProjectCard = makeProjectCard;
exports.makeIssue       = makeIssue;
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
exports.checkLabel              = checkLabel;
