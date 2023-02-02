var assert = require( 'assert' );

var config = require( '../../../config' );

const utils    = require( '../../../utils/ceUtils' );
const awsUtils = require( '../../../utils/awsUtils' );

const ghUtils  = require( '../../../utils/gh/ghUtils' );

const ghV2     = require( '../../../utils/gh/gh2/ghV2Utils' );

const tu       = require( '../../ceTestUtils ');

// Make up for rest variance, and GH slowness.  Expect 500-1000    Faster is in-person
// Server is fast enough for sub 1s, but GH struggles.
// Is GQL faster?  Start at 0.
const GH_DELAY = 0;

// Had to add a small sleep in each make* - GH seems to get confused if requests come in too fast

// NOTE
// Wherever possible, all data acquisition and checks are against what exists in GH, 
// since most tests are confirming both GH state, and internal ceServer state in one way or another.

async function refresh( authData, td, projName ){
    if( td.masterPID != config.EMPTY ) { return; }

    let hostProjs = [];
    await ghV2.getProjectIds( authData, td.GHFullname, hostProjs, -1 );

    hostProjs.forEach( proj => if( proj.hostProjectName == projName ) { td.masterPID = project.id; } );
}


// Refresh a recommended project layout.  This is useful when running tests piecemeal.
async function refreshRec( authData, td ) {
    let hostProjs = [];
    await ghV2.getProjectIds( authData, td, hostProjs, -1 );

    for( const proj of hostProjs ) {
	if( proj.hostProjectName == config.MAIN_PROJ ) {
	    td.masterPID = proj.hostProjectId;

	    let columns = await getColumns( authData, proj.hostProjectId );
	    for( const col of columns ) {
		if( col.name == td.softContTitle ) { td.scColID = col.id; }
		if( col.name == td.busOpsTitle )   { td.boColID = col.id; }
		if( col.name == td.unallocTitle )  { td.unColID = col.id; }
	    }
	}
	if( proj.hostProjectName == td.dataSecTitle )   { td.dataSecPID = proj.hostProjectId; }
	if( proj.hostProjectName == td.githubOpsTitle ) { td.githubOpsPID = proj.hostProjectId; }
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
    let hostProjs = [];
    await ghV2.getProjectIds( authData, td, hostProjs, -1 );

    for( const proj of hostProjs ) {
	if( proj.hostProjectName == td.flatTitle ) {
	    td.flatPID = proj.hostProjectId;

	    let columns = await getColumns( authData, proj.hostProjectId );
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
    let hostProjs = [];
    await ghV2.getProjectIds( authData, td, hostProjs, -1 );

    for( const proj of hostProjs ) {
	if( proj.hostProjectName == td.unclaimTitle ) {
	    td.unclaimPID = proj.hostProjectId;

	    let columns = await getColumns( authData, proj.hostProjectId );
	    for( const col of columns ) {
		if( col.name == td.unclaimTitle )  { td.unclaimCID = col.id; }
	    }
	}
    }
    assert( td.unclaimPID != -1 );
}

// [ cardId, issueNum, issueId, issueTitle]
// Cards can not exist without issues in V2
function getQuad( card, issueMap ) {
    if( !card.hasOwnProperty( 'issNum' )) { return [card.id, -1, -1, ""]; }  // XXX probably unused

    let issue = issueMap[card.issNum];
    
    return [card.id, card.issNum, issue.id, issue.title];
}

// If need be, could also add check for issue state
async function checkLoc( authData, td, issueData, loc ) {

    let issue = await findIssue( authData, issueData[0] );
    let retVal = true;
    if( typeof issue === 'undefined' || issue == -1 ) { retVal = false; }

    if( retVal ) {
	if( loc == -1 ) {
	    retVal = retVal && (issue.state == 'open' || issue.state == 'closed' );
	}
	else {
	    let cards = await getCards( authData, loc.projId, loc.colId );
	    if( cards == -1 ) { retVal = false; }
	    else {
		let mCard = cards.filter((card) => card.hasOwnProperty( "issNum" ) ? card.issNum == issueData[1].toString() : false );
		if( typeof mCard[0] === 'undefined' ) { retVal = false; }
	    }
	}
    }
    return retVal;
}

// was getPeqLabels, but never filtered
async function getLabels( authData, td ) {
    let labels = [];

    let query = `query($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on Repository {
            labels(first:100) {
               edges{node{
                 id, name, color, description}}}
    }}}`;
    let variables = {"nodeId": td.GHRepoId };
    query = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( raw.status != 200 ) { throw raw; }
	    let labs = raw.data.labels.edges;
	    assert( labs.length < 99, "Need to paginate getLabels." );

	    for( let i = 0; i < labs.length; i++ ) {
		const label = labs[i].node;
		let datum = {};
		datum.id          = label.id;
		datum.name        = label.name;
		datum.color       = label.color;
		datum.description = label.description;
		labels.push( datum );
	    }})
	.catch( e => { console.log( authData.who, "get labels failed.", e ); });

    return labels.length == 0 ? -1 : labels;
}

// Note, this is not returning full issues, just faceplate.  could return, say, labels.length..
async function getIssues( authData, td ) {
    let issues = [];

    let query = `query($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on Repository {
            ProjectV2(first:100) {
               edges{node{
                 title id
                 items(first: 100) {
                     edges{node{
                     ... on ProjectV2Item {
                         type id
                         content {
                         ... on ProjectV2ItemContent {
                            ... on Issue { id title number }}}}}}}}}}


    }}}`;
    let variables = {"nodeId": td.GHRepoId };
    query = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( raw.status != 200 ) { throw raw; }
	    let projects = raw.data.projectsV2.edges;
	    assert( projects.length < 99, "Need to paginate getIssues." );

	    for( let i = 0; i < projects.length; i++ ) {
		const p = projects[i].node;
		let items = p.items.edges;
		assert( items.length < 99, "Need to paginate getIssues(items)". );

		for( let k = 0; k < items.length; k++ ) {
		    let iss = items[i].node;
		    if( iss.type == "ISSUE" ) {
			let datum = {};
			datum.id       = iss.content.id;
			datum.number   = iss.content.number;
			datum.title    = iss.content.title;
			datum.projName = p.title;
			datum.projId   = p.id;
			issues.push( datum );
		    }}
	    }})
	.catch( e => { console.log( authData.who, "get issues failed.", e ); });

    return issues.length == 0 ? -1 : issues;
}

// ids, names, faceplate for zeroth repo
async function getProjects( authData, td ) {
    let projects = [];

    let query = `query($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on Repository {
            ProjectV2(first:100) {
               edges{node{
                 title id 
                 repositories(first:100) {
                    edges{node{ id name owner { login }}}}}}}


    }}}`;
    let variables = {"nodeId": td.GHRepoId };
    query = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( raw.status != 200 ) { throw raw; }
	    let projects = raw.data.projectsV2.edges;
	    assert( projects.length < 99, "Need to paginate getProjects." );

	    for( let i = 0; i < projects.length; i++ ) {
		const p    = projects[i].node;
		const repo = p.repositories.edges[0].node;

		let datum = {};
		datum.id        = p.id;
		datum.title     = p.title;
		datum.repoCount = p.repositories.edges.length;
		datum.repoId    = repo.id;
		datum.repoOwner = repo.owner.login;
		datum.repoName  = repo.name;
		projects.push( datum );
	    }})
	.catch( e => { console.log( authData.who, "get projects failed.", e ); });

    return projects.length == 0 ? -1 : projects; 
}

// Note: first view only
async function getColumns( authData, pNodeId ) {
    let cols = [];

    let query = `query($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            views(first: 1) {
              edges { node { 
              ... on ProjectV2View {
                    fields(first: 100) {
                     edges { node { 
                     ... on ProjectV2FieldConfiguration {
                        ... on ProjectV2SingleSelectField {id name options {id name}
                              }}}}}}}}}
    }}}`;
    let variables = {"nodeId": pNodeId };
    query = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( raw.status != 200 ) { throw raw; }
	    let views = raw.data.node.views.edges;
	    assert( views.length == 1 );

	    let view = views[0].node;
	    let statusId = -1;
	    
	    for( let i = 0; i < view.fields.edges.length; i++ ) {
		const afield = view.fields.edges[i].node;
		if( afield.name == "Status" ) {
		    statusId = afield.id;  
		    for( let k = 0; k < afield.options.length; k++ ) {
			let datum = {};
			datum.statusId = statusId;
			datum.id = afield.options[i].id;
			datum.name = afield.options[i].name;
			cols.push( datum );
		    }
		    break;
		}
	    }
	})
	.catch( e => { console.log( authData.who, "get columns failed.", e ); });

    return cols.length == 0 ? -1 : cols;
}

// Get all cards for project.  Filter for column.  Could very easily add, say, col info.. useful?
async function getCards( authData, pNodeId, colId ) {
    let cards = [];

    let query = `query($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            items(first: 100) {
               edges { node {
               ... on ProjectV2Item {
                   type id
                   fieldValueByName(name: "Status") {
                   ... on ProjectV2ItemFieldSingleSelectValue { name optionId }}
                   content {
                   ... on ProjectV2ItemContent { ... on Issue { id title number }}}
               }}}}
    }}}`;
    let variables = {"nodeId": pNodeId };
    query = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( raw.status != 200 ) { throw raw; }
	    let issues = raw.data.node.items.edges;
	    assert( issues.length < 99, "Need to paginate getCards." );

	    for( let i = 0; i < issues.length; i++ ) {
		const iss = issues[i].node;
		if( iss.type == "ISSUE" && iss.fieldValueByName.optionId == colId ) {
		    let datum = {};
		    datum.id     = iss.id;
		    datum.issNum = iss.content.number;
		    datum.title  = iss.content.title;
		}
	    }
	})
	.catch( e => { console.log( authData.who, "get cards failed.", e ); });

    return cards.length == 0 ? -1 : cards;
}

async function getCard( authData, cardId ) {
    let card = await ghV2.getCard( authData, cardId );
    return card;
}

async function getComments( authData, issueId ) {
    let comments = [];

    let query = `query($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on Issue {
            id title
            comments(first: 100) {
               edges{node { id body }}}
    }}}`;
    let variables = {"nodeId": issueId };
    query = JSON.stringify({ query, variables });

    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query )
	.then( async (raw) => {
	    if( raw.status != 200 ) { throw raw; }
	    let coms = raw.data.node.comments.edges;
	    assert( coms.length < 99, "Need to paginate getComments." );

	    for( let i = 0; i < coms.length; i++ ) {
		const com = coms[i].node;
		let datum = {};
		datum.id     = com.id;
		datum.body   = com.body;
		comments.push( datum );
	    }
	})
	.catch( e => { console.log( authData.who, "get comments failed.", e ); });

    return comments.length == 0 ? -1 : comments;
}

async function findIssue( authData, issueId ) {
    let retVal = ghV2.getFullIssue( authData, issueId );
    if( Object.keys( retVal ).length <= 0 ) { retVal = -1; }
    return retVal; 
}


// Prefer to use findIssue.  IssueNames are not unique. 
async function findIssueByName( authData, td, issueName ) {
    let retVal = -1;
    let issues = await getIssues( authData, td );
    retVal = issues.find( issue => issue.title == issueName );
    if( typeof retVal == 'undefined' ) {
	retVal = -1;
    }
    else {
	retVal = findIssue( authData, retVal.id );
    }
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
    let repoId = ghV2.getRepoId( authData, td.GHOwner, td.GHRepo ); 
    if( repoId != -1 ) { repoId = {id:repoId}; }
    return repoId;
}

async function getFlatLoc( authData, projId, projName, colName ) {
    const cols = await getColumns( authData, projId );
    let col = cols.find(c => c.name == colName );

    let ptype = config.PEQTYPE_PLAN;
    // no.  ceFlutter makes this happen
    // if( colName == config.PROJ_COLS[config.PROJ_PEND] ) { ptype = "pending"; }
    // if( colName == config.PROJ_COLS[config.PROJ_ACCR] ) { ptype = "grant"; }

    let psub = [projName, colName];
    // if( config.PROJ_COLS.includes( colName ) ) { psub = [projName]; }
	
    let loc = {};
    loc.projId   = projId;
    loc.projName = projName;
    loc.colId    = col.id;
    loc.colName  = col.name;
    loc.projSub  = psub;
    loc.peqType  = ptype;

    return loc;
}

async function getFullLoc( authData, masterColName, projId, projName, colName ) {

    let loc = await getFlatLoc( authData, projId, projName, colName );

    // loc.projSub  = config.PROJ_COLS.includes( colName ) ? [masterColName, projName] : [masterColName, projName, colName];
    loc.projSub  = [masterColName, projName, colName];
    
    return loc;
}


function findCardForIssue( cards, issueNum ) {
    let card = cards.find( c => c.issNum == issueNum );
    return typeof card === 'undefined' ? -1 : card.id; 
}


/* not in use
async function ingestPActs( authData, issueData ) {
    const peq   = await awsUtils.getPeq( authData, issueData[0] );    
    const pacts = await awsUtils.getPActs( authData, {"Subject": [peq.PEQId.toString()], "Ingested": "false"} );
    const pactIds = pacts.map( pact => pact.PEQActionId );
    await utils.ingestPActs( authData, pactIds );
}
*/


async function makeProject(authData, td, name, body ) {

    let pid = await ghV2.createProject( authData, td.GHOwnerId, td.GHRepoId, name );
    
    console.log( "MakeProject:", name, pid );
    await utils.sleep( GH_DELAY );
    return pid;
}

// XXX This is not working.. but without ability to create columns yet, this may not get used.  wait.
async function remProject( authData, projId ) {

    assert( false, "Delete project  NYI." );
    /* 
       // Can't find id.. because classic only?  or because pvt is closed?
       mutation {
       deleteProject(input: {projectId: "PVT_kwDOA8JELs4AGXxl"}) {
       clientMutationId
       }
       }
       
       // first error here is your token has insufficient scopes
       mutation {
       deleteProjectV2Item(input: {itemId: "PVT_kwDOA8JELs4AGXxl", projectId: "PVT_kwDOA8JELs4AGXxl"}) {
       clientMutationId
       }
    */

    await utils.sleep( tu.MIN_DELAY );
}


async function linkProject( authData, pNodeId, rNodeId ) {
    let query     = "mutation( $pid:ID!, $rid:ID! ) { linkProjectV2ToRepository( input:{projectId: $pid, repositoryId: $rid }) {clientMutationId}}";
    let variables = {"pid": pNodeId, "rid": rNodeId };
    query         = JSON.stringify({ query, variables });
    
    let res = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query );

    if( typeof res.data === 'undefined' ) { console.log( "LinkProject failed.", res ); }
    
    await utils.sleep( tu.MIN_DELAY );
}

async function unlinkProject( authData, pNodeId, rNodeId ) {
    let query     = "mutation( $pid:ID!, $rid:ID! ) { unlinkProjectV2FromRepository( input:{projectId: $pid, repositoryId: $rid }) {clientMutationId}}";
    let variables = {"pid": pNodeId, "rid": rNodeId };
    query         = JSON.stringify({ query, variables });
    
    let res = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query );

    if( typeof res.data === 'undefined' ) { console.log( "UnlinkProject failed.", res ); }
    
    await utils.sleep( tu.MIN_DELAY );
}

async function updateColumn( authData, pNodeId, colId, name ) {
    await ghV2.updateColumn( authData, pNodeId, colId, name );
    await utils.sleep( tu.MIN_DELAY);
}

async function updateProject( authData, projId, name ) {
    await ghV2.updateProject( authData, projId, name );
    await utils.sleep( tu.MIN_DELAY);
}


async function makeColumn( authData, ghLinks, ceProjId, fullName, projId, name ) {
    // First, wait for projId, can lag
    await tu.settleWithVal( "confirmProj", tu.confirmProject, authData, ghLinks, ceProjId, fullName, projId );
    let cid = await ghV2.createColumn( authData, ghLinks, ceProjId, projId, name );
    
    console.log( "MakeColumn:", name, cid );
    let query = "project_column created " + name + " " + fullName;
    await tu.settleWithVal( "makeCol", tu.findNotice, query );

    return cid;
}

async function make4xCols( authData, ghLinks, ceProjId, fullName, projId ) {

    let plan = await makeColumn( authData, ghLinks, ceProjId, fullName, projId, config.PROJ_COLS[ config.PROJ_PLAN ] );
    let prog = await makeColumn( authData, ghLinks, ceProjId, fullName, projId, config.PROJ_COLS[ config.PROJ_PROG ] );
    let pend = await makeColumn( authData, ghLinks, ceProjId, fullName, projId, config.PROJ_COLS[ config.PROJ_PEND ] );
    let accr = await makeColumn( authData, ghLinks, ceProjId, fullName, projId, config.PROJ_COLS[ config.PROJ_ACCR ] );
	
    await utils.sleep( tu.MIN_DELAY );
    return [prog, plan, pend, accr];
}

async function createDraftIssue( authData, pNodeId, title, body ) {
    console.log( authData.who, "Create Draft issue" );

    let query = `mutation( $pid:ID!, $title:String!, $body:String! )
                    {addProjectV2DraftIssue( input:{ projectId: $pid, title: $title, body: $body }) 
                    {clientMutationId, projectItem{id}}}`;

    let variables = { "pid": pNodeId, "title": title, "body": body };
    let queryJ    = JSON.stringify({ query, variables });

    let pvId = -1;
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.then( ret => {
	    if( ret.status != 200 ) { throw ret; }
	    pvId = ret.data.addProjectV2DraftIssue.projectItem.id;
	    console.log( authData.who, " .. draft issue created, id:", pvId );
	})
	.catch( e => { console.log( "createDraftIssue failed.", e ); });
    
    return pvId;
}

// do NOT return card or id here.  card is rebuilt to be driven from issue.
async function makeAllocCard( authData, ghLinks, ceProjId, pNodeId, colId, title, amount ) {
    // Will need statusId
    const locs = ghLinks.getLocs( authData, { "ceProjId": ceProjId, "projId": pNodeId, "colId": colId } );    
    assert( locs != -1 );
    let statusId = locs[0].hostUtility;

    // First, wait for colId, can lag
    await tu.settleWithVal( "make alloc card", tu.confirmColumn, authData, ghLinks, ceProjId, pNodeId, colId );

    let note = title + "\n<allocation, PEQ: " + amount + ">";
    let pvId = createDraftIssue( authData, pNodeId, title, note );
    await ghV2.moveCard( authData, pNodeId, pvId, statusId, colId );
    
    console.log( "Made AllocCard:", pvId, "but this will be deleted to make room for issue-card" );
    await utils.sleep( tu.MIN_DELAY );
}

async function makeNewbornCard( authData, ghLinks, ceProjId, pNodeId, colId, title ) {
    const locs = ghLinks.getLocs( authData, { "ceProjId": ceProjId, "projId": pNodeId, "colId": colId } );    
    assert( locs != -1 );
    let statusId = locs[0].hostUtility;

    // First, wait for colId, can lag
    await tu.settleWithVal( "make newbie card", tu.confirmColumn, authData, ghLinks, ceProjId, pNodeId, colId );

    let pvId = createDraftIssue( authData, pNodeId, title, "" );
    await ghV2.moveCard( authData, pNodeId, pvId, statusId, colId );
    
    await utils.sleep( tu.MIN_DELAY );
    return cid;
}

async function makeProjectCard( authData, ghLinks, ceProjId, pNodeId, colId, issueId ) {
    const locs = ghLinks.getLocs( authData, { "ceProjId": ceProjId, "projId": pNodeId, "colId": colId } );    
    assert( locs != -1 );
    let statusId = locs[0].hostUtility;

    // First, wait for colId, can lag
    await tu.settleWithVal( "make Proj card", tu.confirmColumn, authData, ghLinks, ceProjId, pNodeId, colId );

    // If i have an issue, then I have a card.  find, then move it
    let link = ghLinks.getUniqueLink( authData, ceProjId, issueId );
    await ghV2.moveCard( authData, pNodeId, link.hostCardId, statusId, colId );

    // XXX check new form of this notice
    let query = "project_card moved iss" + link.hostIssueNum;
    await tu.settleWithVal( "makeProjCard", tu.findNotice, query );

    // XXX either leave this in to allow peq data to record, or set additional post condition.
    await utils.sleep( tu.MIN_DELAY );
    return card;
}

async function makeIssue( authData, td, title, labels ) {
    let issue = await ghV2.createIssue( authData, td.GHRepoId, -1, {title: title, labels: labels} );
    issue.push( title );
    await utils.sleep( tu.MIN_DELAY );
    return issue;
}

async function makeAllocIssue( authData, td, title, labels ) {
    let issue = await ghV2.createIssue( authData, td.GHRepoId, -1, {title: title, labels: labels, allocation: true} );
    issue.push( title );
    await utils.sleep( tu.MIN_DELAY );
    return issue;
}

async function blastIssue( authData, td, title, labels, assignees, specials ) {
    let wait  = typeof specials !== 'undefined' && specials.hasOwnProperty( "wait" )   ? specials.wait   : true;

    let issueData = await ghV2.createIssue( authData, td.GHRepoId, -1, {title: title, labels: labels, assignees: assignees, body: "Hola"} );    
    
    issueData[2] = title;
    if( wait ) { await utils.sleep( tu.MIN_DELAY ); }
    return issueData;
}


async function addLabel( authData, lNodeId, issDat ) {
    await ghV2.addLabel( authData, lNodeId, issDat[0] );

    // XXX verify all notice query strings
    let query = "issue labeled " + issDat[2];
    await tu.settleWithVal( "label", tu.findNotice, query );
}	

async function remLabel( authData, label, issDat ) {
    console.log( "Removing", label.name, "from issueNum", issDat[1] );
    await ghV2.removeLabel( authData, label.id, issDat[0] );

    let query = "issue unlabeled " + issueData[2];
    await tu.settleWithVal( "unlabel", tu.findNotice, query );
}

// NOTE - this ignores color... 
async function updateLabel( authData, label, updates ) {
    console.log( "Updating", label.name );

    let newName = updates.hasOwnProperty( "name" )        ? updates.name : label.name;
    let newDesc = updates.hasOwnProperty( "description" ) ? updates.description : label.description;
    
    await ghV2.updateLabel( authData, label.id, newName, newDesc, label.color );
    await utils.sleep( tu.MIN_DELAY );
}

async function delLabel( authData, label ) {
    console.log( "Removing label from repo:", label.name );

    let query     = `mutation( $labelId:ID! ) 
                        { deleteLabel( input:{ id: $labelId })  {clientMutationId}}`;
    let variables = {"labelId": label.id };
    let queryJ    = JSON.stringify({ query, variables });
    
    await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ )
	.catch( e => console.log( "Delete label failed.", e ));
    
    let query = "label deleted " + name;
    await tu.settleWithVal( "del label", tu.findNotice, query );
}

async function addAssignee( authData, issDat, assignee ) {
    await ghV2.addAssignee( authData, issDat[0], assignee.id );

    let query = "issue assigned " + issueData[2];
    await tu.settleWithVal( "assign issue", tu.findNotice, query );
}

async function remAssignee( authData, iNodeId, assignee ) {
    await ghV2.remAssignee( authData, iNodeId, assignee.id );
    await utils.sleep( tu.MIN_DELAY );
}

async function moveCard( authData, ghLinks, ceProjId, cardId, columnId, specials ) {
    const links = ghLinks.getLinks( authData, { "ceProjId": ceProjId, "cardId": cardId } );    
    assert( links != -1 && links.length == 1);
    
    await ghV2.moveCard( authData, links[0].hostProjectId, cardId, links[0].hostUtility, columnId );

    let issNum  = typeof specials !== 'undefined' && specials.hasOwnProperty( "issNum" )  ? specials.issNum : false;

    if( issNum ) { 
	let query = "project_card moved iss" + issNum + " " + td.GHFullName;
	await tu.settleWithVal( "moveCard", tu.findNotice, query );
    }
    
    await utils.sleep( tu.MIN_DELAY );
}

// We can no longer remove a card - just move to no status.
async function remCard( authData, ceProjId, cardId ) {
    const links = ghLinks.getLinks( authData, { "ceProjId": ceProjId, "cardId": cardId } );
    assert( links != -1 && links.length == 1);    

    const locs  = ghLinks.getLocs( authData, { "ceProjId": ceProjId, "projId": links[0].hostProjectId, "colName": "No Status" } );
    assert( locs != -1 && locs.length == 1 );

    await ghV2.moveCard( authData, links[0].hostProjectId, cardId, links[0].hostUtility, locs[0].hostColumnId );
    
    await utils.sleep( tu.MIN_DELAY );
}

// Extra time needed.. CE bot-sent notifications to, say, move to PEND, time to get seen by GH.
// Without it, a close followed immediately by a move, will be processed in order by CE, but arrive out of order for GH.
async function closeIssue( authData, td, issDat, loc = -1 ) {
    await ghV2.updateIssue( authData, issDat[0], "state", "closed" );

    let query = "issue closed " + issDat[2];
    await tu.settleWithVal( "closeIssue", tu.findNotice, query );

    // Send loc for serious checks.  Otherwise, just check state of issue from GH - if connection is slow, this will help with pacing.
    await tu.settleWithVal( "closeIssue finished", checkLoc, authData, td, issDat, loc );
}

async function reopenIssue( authData, td, issueId ) {
    await ghV2.updateIssue( authData, issueId, "state", "open" );

    // Can take GH a long time to move card.  
    await utils.sleep( tu.MIN_DELAY + 500 );
}

async function remIssue( authData, td, issueId ) {

    let issue     = await findIssue( authData, issueId );
    let query     = "mutation( $id:ID! ) { deleteIssue( input:{ issueId: $id }) {clientMutationId}}";
    let variables = {"id": issueId };
    query         = JSON.stringify({ query, variables });
    
    let res = await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query );

    console.log( "remIssue query", query );
    if( typeof res.data === 'undefined' ) { console.log( "ERROR.", res ); }
    
    await utils.sleep( tu.MIN_DELAY );
}

// Untracked issues have only partial entries in link table
// Should work for carded issues that have never been peq.  Does NOT work for newborn.
async function checkUntrackedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 0;

    console.log( "Check Untracked issue", issueData, labelCnt.toString() );
    let subTest = [ 0, 0, []];

    // CHECK github issues
    let issue  = await findIssue( authData, issueData[0] );
    subTest = tu.checkEq( issue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.number, issueData[1].toString(), subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.labels.length, labelCnt,         subTest, "Issue label" );

    // CHECK linkage
    let links  = await tu.getLinks( authData, ghLinks, { "ceProjId": td.ceProjectId, "repo": td.GHFullName } );
    let link   = ( links.filter((link) => link.hostIssueId == issueData[0] ))[0];
    subTest = tu.checkEq( link.hostIssueNum, issueData[1].toString(), subTest, "Linkage Issue num" );
    subTest = tu.checkEq( link.hostCardId, card.id,                   subTest, "Linkage Card Id" );
    subTest = tu.checkEq( link.hostColumnName, config.EMPTY,          subTest, "Linkage Col name" );
    subTest = tu.checkEq( link.hostIssueName, config.EMPTY,           subTest, "Linkage Card Title" );
    subTest = tu.checkEq( link.hostProjectName, config.EMPTY,         subTest, "Linkage Project Title" );
    subTest = tu.checkEq( link.hostColumnId, -1,                      subTest, "Linkage Col Id" );
    subTest = tu.checkEq( link.hostProjectId, loc.projId,             subTest, "Linkage project id" );

    // CHECK dynamo Peq.  inactive, if it exists
    let peqs      = await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
    let issuePeqs = peqs.filter((peq) => peq.HostIssueId == issueData[0].toString() );
    subTest = tu.checkLE( issuePeqs.length, 1,                      subTest, "Peq count" );
    if( issuePeqs.length > 0 ) {
	let peq = issuePeqs[0];
	subTest = tu.checkEq( peq.Active, "false",                  subTest, "peq should be inactive" );
	subTest = tu.checkEq( peq.HostIssueTitle, issueData[2],       subTest, "peq title is wrong" );
	subTest = tu.checkEq( peq.CEGrantorId, config.EMPTY,        subTest, "peq grantor wrong" );
    }

    // CHECK dynamo Pact.. nothing to do here for newborn

    return await tu.settle( subTest, testStatus, checkUntrackedIssue, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
}

// Used for previously situated issues that were unlabeled
async function checkDemotedIssue( authData, ghLinks, td, loc, issueData, card, testStatus ) {

    console.log( "Check demotedissue", loc.projName, loc.colName );

    // For issues, linkage
    testStatus = await checkUntrackedIssue( authData, ghLinks, td, loc, issueData, card, testStatus );
    let subTest = [ 0, 0, []];
    
     // CHECK github location
    let cards  = await getCards( authData, td.unclaimPID, td.unclaimCID );   
    let tCard  = cards.filter((card) => card.hasOwnProperty( "issueNum" ) ? card.issueNum == issueData[1].toString() : false );
    subTest = tu.checkEq( tCard.length, 0,                       subTest, "No unclaimed" );
    
    cards      = await getCards( authData, loc.projId, loc.colId );   
    let mCard  = cards.filter((card) => card.hasOwnProperty( "issueNum" ) ? card.issueNum == issueData[1].toString() : false );

    subTest = tu.checkEq( typeof mCard[0] !== 'undefined', true,     subTest, "mCard not yet ready" );
    if( typeof mCard[0] !== 'undefined' ) {

	subTest = tu.checkEq( mCard.length, 1,                       subTest, "Card claimed" );
	subTest = tu.checkEq( mCard[0].id, card.id,                  subTest, "Card claimed" );

	// CHECK dynamo Peq.  inactive
	// Will have 1 or 2, both inactive, one for unclaimed, one for the demoted project.
	// Unclaimed may not have happened if peq'd a carded issue
	let peqs      = await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
	let issuePeqs = peqs.filter((peq) => peq.HostIssueId == issueData[0].toString() );
	subTest = tu.checkEq( issuePeqs.length, 1,                      subTest, "Peq count" );
	for( const peq of issuePeqs ) {
	    subTest = tu.checkEq( peq.Active, "false",                  subTest, "peq should be inactive" );
	    subTest = tu.checkEq( peq.HostIssueTitle, issueData[2],       subTest, "peq title is wrong" );
	    subTest = tu.checkEq( peq.CEGrantorId, config.EMPTY,        subTest, "peq grantor wrong" );
	}
	let peqId = issuePeqs[0].HostProjectSub[0] == "UnClaimed" ? issuePeqs[1].PEQId : issuePeqs[0].PEQId;
	
	
	// CHECK dynamo Pact
	let pacts = await awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
	let issuePacts = pacts.filter((pact) => pact.Subject[0] == peqId );
	
	// Must have been a PEQ before. Depeq'd with unlabel, or delete.
	issuePacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
	let lastPact = issuePacts[ issuePacts.length - 1 ];
	
	let hr     = await tu.hasRaw( authData, lastPact.PEQActionId );
	subTest = tu.checkEq( hr, true,                                subTest, "PAct Raw match" ); 
	subTest = tu.checkEq( lastPact.Verb, config.PACTVERB_CONF,     subTest, "PAct Verb"); 
	subTest = tu.checkEq( lastPact.Action, config.PACTACT_DEL,     subTest, "PAct Verb"); 
	subTest = tu.checkEq( lastPact.HostUserName, config.TESTER_BOT,  subTest, "PAct user name" ); 
	subTest = tu.checkEq( lastPact.Ingested, "false",              subTest, "PAct ingested" );
	subTest = tu.checkEq( lastPact.Locked, "false",                subTest, "PAct locked" );
    }
    
    return await tu.settle( subTest, testStatus, checkDemotedIssue, authData, ghLinks, td, loc, issueData, card, testStatus );
}

async function checkAlloc( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    let labelVal    = typeof specials !== 'undefined' && specials.hasOwnProperty( "val" )       ? specials.val         : 1000000;
    let labelCnt    = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )  ? specials.lblCount    : 1;
    let assignCnt   = typeof specials !== 'undefined' && specials.hasOwnProperty( "assignees" ) ? specials.assignees   : false;
    let state       = typeof specials !== 'undefined' && specials.hasOwnProperty( "state" )     ? specials.state       : "open";
    let opVal       = typeof specials !== 'undefined' && specials.hasOwnProperty( "opVal" )     ? specials.opVal       : false;
    
    console.log( "Check Allocation", loc.projName, loc.colName, labelVal );
    let subTest = [ 0, 0, []];

    // CHECK github issues
    let issue  = await findIssue( authData, issueData[0] );
    subTest = tu.checkEq( issue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.number, issueData[1].toString(), subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.labels.length, labelCnt,         subTest, "Issue label count" );
    subTest = tu.checkEq( issue.state, state,                    subTest, "Issue state" );

    const lname = labelVal.toString() + " " + config.ALLOC_LABEL;
    subTest = tu.checkNEq( issue.labels.find( l => l.name == lname ), "undefined", subTest, "Issue label names missing" + lname );
    labelVal = opVal ? opVal : labelVal;

    // CHECK github location
    cards = await getCards( authData, loc.projId, loc.colId );
    let mCard = cards.filter((card) => card.hasOwnProperty( "issueNum" ) ? card.issueNum == issueData[1].toString() : false );

    subTest = tu.checkEq( typeof mCard[0] !== 'undefined', true,     subTest, "mCard not yet ready" );
    if( typeof mCard[0] !== 'undefined' ) {
    
	subTest = tu.checkEq( mCard.length, 1,                           subTest, "Card claimed" );
	subTest = tu.checkEq( mCard[0].id, card.id,                      subTest, "Card claimed" );
	
	// CHECK linkage
	let links    = await tu.getLinks( authData, ghLinks, { "ceProjId": td.ceProjectId, "repo": td.GHFullName } );
	let link = ( links.filter((link) => link.hostIssueId == issueData[0] ))[0];
	subTest = tu.checkEq( link.hostIssueNum, issueData[1].toString(), subTest, "Linkage Issue num" );
	subTest = tu.checkEq( link.hostCardId, card.id,                   subTest, "Linkage Card Id" );
	subTest = tu.checkEq( link.hostColumnName, loc.colName,           subTest, "Linkage Col name" );
	subTest = tu.checkEq( link.hostIssueName, issueData[2],           subTest, "Linkage Card Title" );
	subTest = tu.checkEq( link.hostProjectName, loc.projName,         subTest, "Linkage Project Title" );
	subTest = tu.checkEq( link.hostColumnId, loc.colId,               subTest, "Linkage Col Id" );
	subTest = tu.checkEq( link.hostProjectId, loc.projId,             subTest, "Linkage project id" );
	
	// CHECK dynamo Peq
	let allPeqs  =  await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
	let peqs = allPeqs.filter((peq) => peq.HostIssueId == issueData[0].toString() );
	subTest = tu.checkEq( peqs.length, 1,                          subTest, "Peq count" );
	let peq = peqs[0];
	
	assignCnt = assignCnt ? assignCnt : 0;
	
	subTest = tu.checkEq( peq.PeqType, config.PEQTYPE_ALLOC,       subTest, "peq type invalid" );        
	subTest = tu.checkEq( peq.HostProjectSub.length, loc.projSub.length, subTest, "peq project sub len invalid" );
	subTest = tu.checkEq( peq.HostIssueTitle, issueData[2],          subTest, "peq title is wrong" );
	subTest = tu.checkEq( peq.HostHolderId.length, assignCnt,        subTest, "peq gh holders wrong" );      
	subTest = tu.checkEq( peq.CEHolderId.length, 0,                subTest, "peq ce holders wrong" );    
	subTest = tu.checkEq( peq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );      
	subTest = tu.checkEq( peq.Amount, labelVal,                    subTest, "peq amount" );
	subTest = tu.checkEq( peq.Active, "true",                      subTest, "peq" );
	subTest = tu.checkEq( peq.HostProjectId, loc.projId,             subTest, "peq project id bad" );
	for( let i = 0; i < loc.projSub.length; i++ ) {
	    subTest = tu.checkEq( peq.HostProjectSub[i], loc.projSub[i], subTest, "peq project sub bad" );
	}
	
	// CHECK dynamo Pact
	let allPacts  = await awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
	let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
	subTest = tu.checkGE( pacts.length, 1,                         subTest, "PAct count" );  
	
	// Could have been many operations on this.
	for( const pact of pacts ) {
	    let hr  = await tu.hasRaw( authData, pact.PEQActionId );
	    subTest = tu.checkEq( hr, true,                                subTest, "PAct Raw match" ); 
	    subTest = tu.checkEq( pact.HostUserName, config.TESTER_BOT,      subTest, "PAct user name" ); 
	    subTest = tu.checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
	    subTest = tu.checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
	}
    }

    return await tu.settle( subTest, testStatus, checkAlloc, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
}

async function checkSituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    let muteIngested = typeof specials !== 'undefined' && specials.hasOwnProperty( "muteIngested" ) ? specials.muteIngested : false;
    let issueState   = typeof specials !== 'undefined' && specials.hasOwnProperty( "state" )        ? specials.state        : false;
    let labelVal     = typeof specials !== 'undefined' && specials.hasOwnProperty( "label" )        ? specials.label        : false;
    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 1;
    let skipPeqPID   = typeof specials !== 'undefined' && specials.hasOwnProperty( "skipPeqPID" )   ? specials.skipPeqPID   : false;
    let assignCnt    = typeof specials !== 'undefined' && specials.hasOwnProperty( "assign" )       ? specials.assign       : false;
    let opVal        = typeof specials !== 'undefined' && specials.hasOwnProperty( "opVal" )        ? specials.opVal        : false;
    let peqHolder    = typeof specials !== 'undefined' && specials.hasOwnProperty( "peqHolder" )    ? specials.peqHolder    : false;
    
    console.log( "Check situated issue", loc.projName, loc.colName, muteIngested, labelVal, assignCnt );
    let subTest = [ 0, 0, []];
    
    // Start promises
    let cardsP = getCards( authData, loc.projId, loc.colId );
    let cardsU = getCards( authData, loc.unclaimPID, td.unclaimCID );
    let linksP = tu.getLinks( authData, ghLinks, { "ceProjId": td.ceProjectId, "repo": td.GHFullName } );
    let peqsP  = awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
    let pactsP = awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    
    // CHECK github issues
    let issue  = await findIssue( authData, issueData[0] );
    subTest = tu.checkEq( issue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.number, issueData[1].toString(), subTest, "Github issue troubles" );

    if( assignCnt ) { subTest = tu.checkEq( issue.assignees.length, assignCnt, subTest, "Assignee count" ); }
    
    const lname = labelVal ? labelVal.toString() + " " + config.PEQ_LABEL : "1000 " + config.PEQ_LABEL;
    let   lval  = labelVal ? labelVal : 1000;
    lval        = opVal    ? opVal    : lval;    // resolve, original issue peq amount is not updated.  label is.

    subTest = tu.checkEq( typeof issue.labels !== 'undefined', true, subTest, "labels not yet ready" );
    
    if( typeof issue.labels !== 'undefined' ){
	subTest = tu.checkEq( typeof issue.labels[0] !== 'undefined', true, subTest, "labels not yet ready" );
	subTest = tu.checkEq( issue.labels.length, labelCnt,         subTest, "Issue label count" );
	if( typeof issue.labels[0] !== 'undefined' ) {
	    subTest = tu.checkNEq( issue.labels.find( l => l.name == lname ), "undefined", subTest, "Issue label names missing" + lname );
	}
    }
    if( issueState ) { subTest = tu.checkEq( issue.state, issueState, subTest, "Issue state" );  }

    // XXX Crappy test.  many locs are not related to td.unclaim.  Can be situated and in unclaim.
    //     Should kill this here, put in a handful in basic flow to ensure cleanUnclaimed when we know it should be.
    //     Use of assignCnt to ignore is poor, but will do until this is rebuilt, only shows in testCross.
    // CHECK github location
    let cards = td.unclaimCID == config.EMPTY ? [] : await cardsU;
    if( !assignCnt ) {
	let tCard = [1,2,3]; 
	if( cards != -1 ) { tCard = cards.filter((card) => card.hasOwnProperty( "issueNum" ) ? card.issueNum == issueData[1].toString() : false ); }
	subTest = tu.checkEq( tCard.length, 0,                           subTest, "No unclaimed" );
    }

    cards = await cardsP;
    let mCard = cards.filter((card) => card.hasOwnProperty( "issueNum" ) ? card.issueNum == issueData[1].toString() : false );

    // Long GH pauses show their fury here, more likely than not.
    if( typeof mCard[0] === 'undefined' ) {
	console.log( "mCard failure. issDat: ", issueData.toString() );
	console.log( "               card: ", card.content_url );
	console.log( "               loc: ", loc );
	console.log( "               loc: ", loc.projSub.toString() );
    }
    
    subTest = tu.checkEq( typeof mCard[0] !== 'undefined', true,     subTest, "mCard not yet ready" );
    subTest = tu.checkEq( typeof card     !== 'undefined', true,     subTest, "Card not yet ready" );
    if( typeof mCard[0] !== 'undefined' && typeof card !== 'undefined' ) {
    
	subTest = tu.checkEq( mCard.length, 1,                           subTest, "Card claimed" );
	subTest = tu.checkEq( mCard[0].id, card.id,                      subTest, "Card claimed" );
	
	// CHECK linkage
	let links  = await linksP;
	let link   = ( links.filter((link) => link.hostIssueId == issueData[0] ))[0];
	subTest = tu.checkEq( link !== 'undefined', true,               subTest, "Wait for link" );
	if( link !== 'undefined' ) {
	    subTest = tu.checkEq( link.hostIssueNum, issueData[1].toString(), subTest, "Linkage Issue num" );
	    subTest = tu.checkEq( link.hostCardId, card.id,                   subTest, "Linkage Card Id" );
	    subTest = tu.checkEq( link.hostColumnName, loc.colName,           subTest, "Linkage Col name" );
	    subTest = tu.checkEq( link.hostIssueName, issueData[2],          subTest, "Linkage Card Title" );
	    subTest = tu.checkEq( link.hostProjectName, loc.projName,         subTest, "Linkage Project Title" );
	    subTest = tu.checkEq( link.hostColumnId, loc.colId,               subTest, "Linkage Col Id" );
	    subTest = tu.checkEq( link.hostProjectId, loc.projId,             subTest, "Linkage project id" );
	}
	
	// CHECK dynamo Peq
	let allPeqs = await peqsP;
	let peqs    = allPeqs.filter((peq) => peq.HostIssueId == issueData[0].toString() );
	subTest     = tu.checkEq( peqs.length, 1,                          subTest, "Peq count" );
	let peq     = peqs[0];
	subTest     = tu.checkEq( typeof peq !== 'undefined', true,        subTest, "peq not ready yet" );

	if( typeof peq !== 'undefined' ) {

	    assignCnt = assignCnt ? assignCnt : 0;

	    // When making an issue, peq.HostHolder will be assigned, or not, depending on if GH got the assign
	    // signal before CE fully processed the label notification.  Since either is acceptible, let both pass.
	    let holderCheck = peq.HostHolderId.length == assignCnt;
	    if( peqHolder == "maybe" ) { holderCheck = holderCheck || peq.HostHolderId.length > 0; }
	    if( !holderCheck ) { console.log( peq.HostHolderId.length.toString(), assignCnt.toString(), peqHolder ); }
	    subTest = tu.checkEq( holderCheck, true,                       subTest, "peq holders wrong" );      
	
	    subTest = tu.checkEq( peq.PeqType, loc.peqType,                subTest, "peq type invalid" );        
	    subTest = tu.checkEq( peq.HostProjectSub.length, loc.projSub.length, subTest, "peq project sub len invalid" );
	    subTest = tu.checkEq( peq.HostIssueTitle, issueData[2],          subTest, "peq title is wrong" );
	    subTest = tu.checkEq( peq.CEHolderId.length, 0,                subTest, "peq ceholders wrong" );    
	    subTest = tu.checkEq( peq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );      
	    subTest = tu.checkEq( peq.Amount, lval,                        subTest, "peq amount" );
	    subTest = tu.checkEq( peq.HostProjectSub[0], loc.projSub[0],     subTest, "peq project sub 0 invalid" );
	    subTest = tu.checkEq( peq.Active, "true",                      subTest, "peq" );
	    if( !skipPeqPID ) {
		subTest = tu.checkEq( peq.HostProjectId, loc.projId,         subTest, "peq project id bad" );
	    }
	    
	    // CHECK dynamo Pact
	    let allPacts = await pactsP;
	    subTest   = tu.checkNEq( allPacts, -1,                           subTest, "PActs not yet ready" );

	    if( allPacts != -1 ) {
		
		let pacts    = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
		subTest   = tu.checkGE( pacts.length, 1,                         subTest, "PAct count" );  
		
		// This can get out of date quickly.  Only check this if early on, before lots of moving (which PEQ doesn't keep up with)
		if( pacts.length <= 3 && loc.projSub.length > 1 ) {
		    const pip = [ config.PROJ_COLS[config.PROJ_PEND], config.PROJ_COLS[config.PROJ_ACCR] ];
		    if( !pip.includes( loc.projSub[1] )) { 
			subTest = tu.checkEq( peq.HostProjectSub[1], loc.projSub[1], subTest, "peq project sub 1 invalid" );
		    }
		}
		
		// Could have been many operations on this.
		for( const pact of pacts ) {
		    let hr  = await tu.hasRaw( authData, pact.PEQActionId );
		    subTest = tu.checkEq( hr, true,                                subTest, "PAct Raw match" ); 
		    subTest = tu.checkEq( pact.HostUserName, config.TESTER_BOT,      subTest, "PAct user name" ); 
		    subTest = tu.checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
		    
		    if( !muteIngested ) { subTest = tu.checkEq( pact.Ingested, "false", subTest, "PAct ingested" ); }
		}
	    }
	}
    }
    
    return await tu.settle( subTest, testStatus, checkSituatedIssue, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
}


async function checkUnclaimedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    let labelVal     = typeof specials !== 'undefined' && specials.hasOwnProperty( "label" )        ? specials.label        : false;
    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 1;
    let assignees    = typeof specials !== 'undefined' && specials.hasOwnProperty( "assigns" )      ? specials.assigns      : [];
    
    console.log( "Check unclaimed issue", loc.projName, loc.colName, labelVal );
    let subTest = [ 0, 0, []];
    
    // Start promises
    let cardsU = getCards( authData, td.unclaimPID, td.unclaimCID );
    let linksP = tu.getLinks( authData, ghLinks, { "ceProjId": td.ceProjectId, "repo": td.GHFullName } );
    let peqsP  = awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
    let pactsP = awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    
    // CHECK github issues
    let issue  = await findIssue( authData, issueData[0] );
    subTest = tu.checkEq( issue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.number, issueData[1].toString(), subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.labels.length, labelCnt,         subTest, "Issue label count" );
    
    const lname = labelVal ? labelVal.toString() + " " + config.PEQ_LABEL : "1000 " + config.PEQ_LABEL;
    const lval  = labelVal ? labelVal                     : 1000;
    subTest = tu.checkNEq( issue.labels.find( l => l.name == lname ), "undefined", subTest, "Issue label names missing" + lname );        
    subTest = tu.checkEq( issue.state, "open",                   subTest, "Issue state" ); 

    // CHECK github location
    let cards = td.unclaimCID == config.EMPTY ? [] : await cardsU;
    let tCard = cards.filter((card) => card.hasOwnProperty( "issueNum" ) ? card.issueNum == issueData[1].toString() : false );
    subTest = tu.checkEq( tCard.length, 1,                        subTest, "No unclaimed" );
    subTest = tu.checkEq( tCard[0].id, card.id,                   subTest, "Card id" );
    
    // CHECK linkage
    let links  = await linksP;
    let link   = ( links.filter((link) => link.hostIssueId == issueData[0] ))[0];
    subTest = tu.checkEq( link.hostIssueNum, issueData[1].toString(), subTest, "Linkage Issue num" );
    subTest = tu.checkEq( link.hostCardId, card.id,                   subTest, "Linkage Card Id" );
    subTest = tu.checkEq( link.hostColumnName, loc.colName,           subTest, "Linkage Col name" );
    subTest = tu.checkEq( link.hostIssueName, issueData[2],           subTest, "Linkage Card Title" );
    subTest = tu.checkEq( link.hostProjectName, loc.projName,         subTest, "Linkage Project Title" );
    subTest = tu.checkEq( link.hostColumnId, loc.colId,               subTest, "Linkage Col Id" );
    subTest = tu.checkEq( link.hostProjectId, loc.projId,             subTest, "Linkage project id" );

    // CHECK dynamo Peq
    // If peq holders fail, especially during blast, one possibility is that GH never recorded the second assignment.
    // This happened 6/29/22, 7/5  To be fair, blast is punishing - requests on same issue arrive inhumanly fast, like 10x.
    // It is also possible that the test is too stringent even if GH succeeds.  From utils:recordpeqdata:
    //     PNP sets GHAssignees based on call to GH.  This means we MAY have assignees, or not, upon first
    //     creation of AWS PEQ, depending on if assignment occured in GH before peq label notification processing completes.
    let allPeqs =  await peqsP;
    let peqs    = allPeqs.filter((peq) => peq.HostIssueId == issueData[0].toString() );
    let peq = peqs[0];
    subTest  = tu.checkEq( peqs.length, 1,                          subTest, "Peq count" );
    subTest  = tu.checkEq( typeof peq !== 'undefined', true,        subTest, "Peq count" );
    if( typeof peq === 'undefined' ) { return await tu.settle( subTest, testStatus, checkUnclaimedIssue, authData, ghLinks, td, loc, issueData, card, testStatus, specials ); }
    subTest = tu.checkEq( peq.PeqType, loc.peqType,                subTest, "peq type invalid" );        
    subTest = tu.checkEq( peq.HostProjectSub.length, loc.projSub.length, subTest, "peq project sub len invalid" );
    subTest = tu.checkEq( peq.HostIssueTitle, issueData[2],          subTest, "peq title is wrong" );
    subTest = tu.checkEq( peq.HostHolderId.length, assignees.length, subTest, "peq holders wrong" );      
    subTest = tu.checkEq( peq.CEHolderId.length, 0,                subTest, "peq ce holders wrong" );    
    subTest = tu.checkEq( peq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );      
    subTest = tu.checkEq( peq.Amount, lval,                        subTest, "peq amount" );
    subTest = tu.checkEq( peq.HostProjectSub[0], loc.projSub[0],     subTest, "peq project sub 0 invalid" );
    subTest = tu.checkEq( peq.Active, "true",                      subTest, "peq" );
    subTest = tu.checkEq( peq.HostProjectId, loc.projId,             subTest, "peq project id bad" );

    for( const assignee of assignees ) {
	subTest = tu.checkEq( peq.HostHolderId.includes( assignee ), true, subTest, "peq holder bad" );
    }
    
    // CHECK dynamo Pact
    let allPacts  = await pactsP;
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    subTest = tu.checkGE( pacts.length, 1,                         subTest, "PAct count" );  

    // This can get out of date quickly.  Only check this if early on, before lots of moving (which PEQ doesn't keep up with)
    if( pacts.length <= 3 && loc.projSub.length > 1 ) {
	const pip = [ config.PROJ_COLS[config.PROJ_PEND], config.PROJ_COLS[config.PROJ_ACCR] ];
	if( !pip.includes( loc.projSub[1] )) { 
	    subTest = tu.checkEq( peq.HostProjectSub[1], loc.projSub[1], subTest, "peq project sub 1 invalid" );
	}
    }
    
    // Could have been many operations on this.
    for( const pact of pacts ) {
	let hr     = await tu.hasRaw( authData, pact.PEQActionId );
	subTest = tu.checkEq( hr, true,                            subTest, "PAct Raw match" ); 
	subTest = tu.checkEq( pact.HostUserName, config.TESTER_BOT,      subTest, "PAct user name" ); 
	subTest = tu.checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
	subTest = tu.checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
    }

    return await tu.settle( subTest, testStatus, checkUnclaimedIssue, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
}


// Check last PAct
async function checkNewlyClosedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    if( typeof specials === 'undefined' ) { specials = {}; }
    if( !specials.state ) { specials.state = "closed"; }

    testStatus = await checkSituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials );
    let subTest = [ 0, 0, []];

    console.log( "Check Closed issue", loc.projName, loc.colName );

    // Start promises
    let peqsP  = awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
    let pactsP = awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    
    const allPeqs =  await peqsP;
    const peqs = allPeqs.filter((peq) => peq.HostIssueId == issueData[0].toString() );
    const peq = peqs[0];

    // CHECK dynamo Pact
    // Note that assignee pact can arrive after confirm close.  Ingest is OK with this.  allow.
    const allPacts = await pactsP;
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let foundProp = false;
    for( const pact of pacts.slice(-2) ) {
	if( pact.Verb == config.PACTVERB_PROP && pact.Action == config.PACTACT_ACCR ) {
	    foundProp = true;
	    break;
	}
    }
    subTest = tu.checkEq( foundProp, true, subTest, "PAct Prop Accr not found"); 

    return await tu.settle( subTest, testStatus, checkNewlyClosedIssue, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
}

// Check last PAct
async function checkNewlyOpenedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    if( typeof specials === 'undefined' ) { specials = {}; }
    if( !specials.state ) { specials.state = "open"; }

    testStatus = await checkSituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials );

    let subTest = [ 0, 0, []];

    console.log( "Check Opened issue", loc.projName, loc.colName );

    // Start promises
    let peqsP  = awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
    let pactsP = awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    
    const allPeqs = await peqsP;
    const peqs = allPeqs.filter((peq) => peq.HostIssueId == issueData[0].toString() );
    const peq = peqs[0];

    // CHECK dynamo Pact
    const allPacts = await pactsP;
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    const pact = pacts[ pacts.length - 1];
    subTest = tu.checkEq( pact.Verb, config.PACTVERB_REJ,               subTest, "PAct Verb"); 
    subTest = tu.checkEq( pact.Action, config.PACTACT_ACCR,             subTest, "PAct Action"); 

    return await tu.settle( subTest, testStatus, checkNewlyOpenedIssue, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
}



async function checkNewlySituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    if( typeof specials === 'undefined' ) { specials = {}; }
    if( !specials.hasOwnProperty( "state" ) ) { specials.state = "open"; }

    testStatus = await checkSituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials );

    console.log( "Check newly situated issue", loc.projName, loc.colName );
    let subTest = [ 0, 0, []];
    
    // Start promises
    let peqsP  = awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
    let pactsP = awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    
    // CHECK dynamo Peq
    let allPeqs =  await peqsP;
    let peqs = allPeqs.filter((peq) => peq.HostIssueId == issueData[0].toString() );
    subTest = tu.checkEq( peqs.length, 1,                          subTest, "Peq count" );
    let peq = peqs[0];
    subTest = tu.checkEq( peq.PeqType, loc.peqType,                subTest, "peq type invalid" );       
    subTest = tu.checkEq( peq.HostProjectSub.length, loc.projSub.length, subTest, "peq project sub invalid" );
    subTest = tu.checkEq( peq.HostIssueTitle, issueData[2],          subTest, "peq title is wrong" );
    subTest = tu.checkEq( peq.HostHolderId.length, 0,                subTest, "peq holders wrong" );
    subTest = tu.checkEq( peq.CEHolderId.length, 0,                subTest, "peq holders wrong" );
    subTest = tu.checkEq( peq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );
    subTest = tu.checkEq( peq.HostProjectSub[0], loc.projSub[0],     subTest, "peq project sub invalid" );
    if( loc.projSub.length > 1 ) {
	subTest = tu.checkEq( peq.HostProjectSub[1], loc.projSub[1], subTest, "peq project sub invalid" );
    }
    subTest = tu.checkEq( peq.HostProjectId, loc.projId,             subTest, "peq PID bad" );
    subTest = tu.checkEq( peq.Active, "true",                      subTest, "peq" );

    // CHECK dynamo Pact
    // label carded issue?  1 pact.  attach labeled issue to proj col?  2 pact.
    // Could be any number.  add (unclaimed).  change (assign) x n.  relocate (peqify)
    // Note.  Can arrive in dynamo out of order - no awaiting for most PActs
    let allPacts = await pactsP;
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    subTest = tu.checkGE( pacts.length, 1,                         subTest, "PAct count" );         
    
    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let addUncl  = pacts.length >= 2 ? pacts[0] :                 {"Action": config.PACTACT_ADD };
    let relUncl  = pacts.length >= 2 ? pacts[ pacts.length -1 ] : {"Action": config.PACTACT_RELO };
    let pact     = pacts.length >= 2 ? pacts[ pacts.length -1 ] : pacts[0];
    for( const pact of pacts ) {
	let hr     = await tu.hasRaw( authData, pact.PEQActionId );
	subTest = tu.checkEq( hr, true,                            subTest, "PAct Raw match" ); 
	subTest = tu.checkEq( pact.Verb, config.PACTVERB_CONF,         subTest, "PAct Verb"); 
	subTest = tu.checkEq( pact.HostUserName, config.TESTER_BOT,      subTest, "PAct user name" ); 
	subTest = tu.checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
	subTest = tu.checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
    }

    // reorder, in case arrival got messed up
    if( addUncl.Action == config.PACTACT_RELO && relUncl.Action == config.PACTACT_ADD ) {
	let t   = addUncl;
	addUncl = relUncl;
	relUncl = t;
    }
    
    subTest = tu.checkEq( addUncl.Action, config.PACTACT_ADD,          subTest, "PAct Action"); 
    subTest = tu.checkEq( relUncl.Action, config.PACTACT_RELO,         subTest, "PAct Action");
    const source = pact.Action == config.PACTACT_ADD || pact.Action == config.PACTACT_RELO;
    subTest = tu.checkEq( source, true,                                subTest, "PAct Action"); 

    return await tu.settle( subTest, testStatus, checkNewlySituatedIssue, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
}

async function checkNewlyAccruedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials ) {

    let assignCnt    = typeof specials !== 'undefined' && specials.hasOwnProperty( "preAssign" )       ? specials.preAssign : 0;

    testStatus = await checkSituatedIssue( authData, ghLinks, td, loc, issueData, card, testStatus, specials );

    console.log( "Check newly accrued issue", loc.projName, loc.colName );
    let subTest = [ 0, 0, []];

    // CHECK dynamo Peq
    let allPeqs =  await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
    let peqs = allPeqs.filter((peq) => peq.HostIssueId == issueData[0].toString() );
    subTest = tu.checkEq( peqs.length, 1,                          subTest, "Peq count" );
    let peq = peqs[0];

    // CHECK dynamo Pact  smallest number is add, move.  check move (confirm accr)
    let allPacts = await awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    subTest = tu.checkGE( pacts.length, 2,                         subTest, "PAct count" );

    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let pact = pacts[ pacts.length - 1];
    subTest = tu.checkEq( pact.Verb, config.PACTVERB_CONF,                    subTest, "PAct Verb"); 
    subTest = tu.checkEq( pact.Action, config.PACTACT_ACCR,                   subTest, "PAct Action");

    // Note that occasionally during a blast open, notification arrival can be: issue opened, then assigned then labeled.
    //      in this case, peq will have ghHolders.  Typically, the label notification comes first, in which case there will not be.
    //      Must check for either ghHolder, or assignement PAct.  Both cases are valid for GH.. More typical usage:
    //         * peq issue is assigned, get assignment notification
    //         * non peq assigned issue, which has not been tracked, gets a peq label.
    let foundAssignment = false;
    foundAssignment = assignCnt > 0 && peq.HostHolderId.length == assignCnt;

    if( !foundAssignment ) {
	for( let i = 0; i < pacts.length; i++ ) {
	    const pact = pacts[i];
	    if( pact.Action == config.PACTACT_CHAN &&
		pact.Verb   == config.PACTVERB_CONF &&
		pact.Note   == "add assignee" ) {
		foundAssignment = true;
		break;
	    }
	}
    }
    
    subTest = tu.checkEq( foundAssignment, true,      subTest, "peq holders wrong" );
    
    return await tu.settle( subTest, testStatus, checkNewlyAccruedIssue, authData, ghLinks, td, loc, issueData, card, testStatus, specials );
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
    let allPeqs =  await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
    let peqs = allPeqs.filter((peq) => peq.HostIssueId == issueDataNew[0].toString() );
    subTest = tu.checkEq( peqs.length, 1,                          subTest, "Peq count" );
    let peq = peqs[0];

    // CHECK dynamo Pact 
    let allPacts = await awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    subTest = tu.checkGE( pacts.length, 1,                         subTest, "PAct count" );

    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let pact = pacts[ pacts.length - 1];
    subTest = tu.checkEq( pact.Verb, config.PACTVERB_CONF,                subTest, "PAct Verb"); 
    if     ( source == "card" )  { subTest = tu.checkEq( pact.Action, config.PACTACT_RELO,        subTest, "PAct Action"); }
    else if( source == "issue" ) { subTest = tu.checkEq( pact.Action, config.PACTACT_ADD,         subTest, "PAct Action"); }

    // Check old issue
    // For source == issue, new peq is added.  Old peq is changed.
    if( source == "issue" ) {
	// PEQ inactive
	peqs = allPeqs.filter((peq) => peq.HostIssueId == issueDataOld[0].toString() );
	peq = peqs[0];
	subTest = tu.checkEq( peqs.length, 1,                      subTest, "Peq count" );
	subTest = tu.checkEq( peq.Active, "false",                 subTest, "peq should be inactive" );
	
	// CHECK dynamo Pact  old: add, move, change
	pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
	subTest = tu.checkGE( pacts.length, 3,                     subTest, "PAct count" );
	
	pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
	let pact = pacts[ pacts.length - 1];
	subTest = tu.checkEq( pact.Verb, config.PACTVERB_CONF,     subTest, "PAct Verb"); 
	subTest = tu.checkEq( pact.Action, config.PACTACT_CHAN,    subTest, "PAct Action"); 
	subTest = tu.checkEq( pact.Note, "recreate",               subTest, "PAct Note"); 
    }

    return await tu.settle( subTest, testStatus, checkUnclaimedAccr, authData, ghLinks, td, loc, issueDataOld, issueDataNew, cardNew, testStatus, source );
}


async function checkNewbornCard( authData, ghLinks, td, loc, cardId, title, testStatus ) {

    console.log( "Check Newborn Card", title, cardId );
    let subTest = [ 0, 0, []];
    
    // CHECK github issue
    // no need, get content link below
    
    // CHECK github card
    let cards  = await getCards( authData, loc.projId, loc.colId );
    let card   = cards.find( card => card.id == cardId );
    const cardTitle = card.note.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    subTest = tu.checkEq( card.hasOwnProperty( "issueNum" ), false, subTest, "Newbie has content" );
    subTest = tu.checkEq( cardTitle, title,                            subTest, "Newbie title" );

    // CHECK linkage
    let links  = await tu.getLinks( authData, ghLinks, { "ceProjId": td.ceProjectId, "repo": td.GHFullName } );
    let link   = links.find( l => l.hostCardId == cardId );
    subTest = tu.checkEq( typeof link, "undefined",                    subTest, "Newbie link exists" );

    // CHECK dynamo Peq.  inactive, if it exists
    // Risky test - will fail if unrelated peqs with same title exist
    let peqs = await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId, "HostIssueTitle": title });
    subTest = tu.checkEq( peqs, -1,                                    subTest, "Newbie peq exists" );

    // CHECK dynamo Pact.. nothing to do here for newborn

    return await tu.settle( subTest, testStatus, checkNewbornCard, authData, ghLinks, td, loc, cardId, title, testStatus );
}

async function checkNewbornIssue( authData, ghLinks, td, issueData, testStatus, specials ) {

    console.log( "Check Newborn Issue", issueData);
    let subTest = [ 0, 0, []];

    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 0;
    
    // CHECK github issue
    let issue  = await findIssue( authData, issueData[0] );
    subTest = tu.checkEq( issue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.number, issueData[1].toString(), subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.title, issueData[2],             subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.labels.length, labelCnt,         subTest, "Issue label" );

    // CHECK github card
    // no need, get content link below
    
    // CHECK linkage
    let links  = await tu.getLinks( authData, ghLinks, { "ceProjId": td.ceProjectId, "repo": td.GHFullName } );
    let link   = links.find( l => l.hostIssueId == issueData[0].toString() );
    subTest = tu.checkEq( typeof link, "undefined",                    subTest, "Newbie link exists" );

    // CHECK dynamo Peq.  inactive, if it exists
    let peqs = await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId, "HostIssueId": issueData[0] });
    if( peqs != -1 ) {
	let peq = peqs.find(peq => peq.HostIssueId == issueData[0].toString() );
	subTest = tu.checkEq( peq.Active, "false",                  subTest, "peq should be inactive" );
	subTest = tu.checkEq( peq.HostIssueTitle, issueData[2],       subTest, "peq title is wrong" );
	subTest = tu.checkEq( peq.CEGrantorId, config.EMPTY,        subTest, "peq grantor wrong" );
    }

    // CHECK dynamo Pact.. nothing to do here for newborn

    return await tu.settle( subTest, testStatus, checkNewbornIssue, authData, ghLinks, td, issueData, testStatus, specials );
}

// origVal is peq label value before split.  New labels will be 1/2.  orig peq.amount will not change.  new peq amount will be 1/2.
// opVal   is original peq.amount.  If split peq, then split it again, peq.amount is 4x the label, until ceFlutter ingest.
async function checkSplit( authData, ghLinks, td, issDat, origLoc, newLoc, origVal, opVal, testStatus, specials ) {
    let situated   = typeof specials !== 'undefined' && specials.hasOwnProperty( "peq" )        ? specials.peq        : false;
    let labelCnt   = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )   ? specials.lblCount   : 1;
    let assignCnt  = typeof specials !== 'undefined' && specials.hasOwnProperty( "assignees" )  ? specials.assignees  : 1;

    console.log( "Check Split", issDat[2], origLoc.colName, newLoc.colName, situated.toString(), labelCnt.toString(), assignCnt.toString() );
    let subTest = [ 0, 0, []];
    
    // Get new issue
    let issues   = await getIssues( authData, td );
    let issue    = await findIssue( authData, issDat[0] );

    // Some tests will have two split issues here.  Find the right one before proceeding
    let splitIssues = issues.filter( issue => issue.title.includes( issDat[2] + " split" ));
    let cards = await getCards( authData, newLoc.projId, newLoc.colId );
    if( cards == -1 ) { cards = []; }
    let splitIss = -1;
    for( const iss of splitIssues ) {
	mCard = cards.filter((card) => card.hasOwnProperty( "issueNum" ) ? card.issueNum == iss.number.toString() : false );
	if( typeof mCard !== 'undefined' ) {
	    splitIss = iss;
	    break;
	}
    }
    
    const splitDat = splitIss == -1 ? [-1, -1, -1] : [ splitIss.id.toString(), splitIss.number.toString(), splitIss.title ];

    subTest = tu.checkEq( splitDat[0] != -1, true, subTest, "split iss trouble" );
    if( splitDat[0] != -1 ) {
    
	// Get cards
	let allLinks  = await tu.getLinks( authData, ghLinks, { "ceProjId": td.ceProjectId, repo: td.GHFullName });
	let issLink   = allLinks.find( l => l.hostIssueId == issDat[0].toString() );
	let splitLink = allLinks.find( l => l.hostIssueId == splitDat[0].toString() );
	
	if( typeof issLink === 'undefined' ) { console.log( allLinks ); console.log( issDat ); }
	
	subTest = tu.checkEq( typeof issLink   !== 'undefined', true, subTest, "issLink trouble" );
	subTest = tu.checkEq( typeof splitLink !== 'undefined', true, subTest, "splitLink trouble" );

	if( typeof issLink !== 'undefined' && typeof splitLink !== 'undefined' ) {
	    const card      = await getCard( authData, issLink.hostCardId );
	    const splitCard = await getCard( authData, splitLink.hostCardId );

	    // NOTE: orig issue will not adjust initial peq value.  new issue will be set with new value.  label is up to date tho.
	    if( situated ) {
		let lval = origVal / 2;
		subTest = await checkSituatedIssue( authData, ghLinks, td, origLoc, issDat,   card,      subTest, {opVal: opVal, label: lval, lblCount: labelCnt} );
		subTest = await checkSituatedIssue( authData, ghLinks, td, newLoc,  splitDat, splitCard, subTest, {label: lval, lblCount: labelCnt } );
	    }
	    else {
		subTest = await checkUntrackedIssue( authData, ghLinks, td, origLoc, issDat,   card,      subTest, {lblCount: labelCnt } );
		subTest = await checkUntrackedIssue( authData, ghLinks, td, newLoc,  splitDat, splitCard, subTest, {lblCount: labelCnt } );
	    }
	    subTest = tu.checkEq( issue.state, splitIss.state,    subTest, "Issues have different state" );
	    
	    // check assign
	    subTest = tu.checkEq( issue.assignees.length, assignCnt,    subTest, "Issue assignee count" );
	    subTest = tu.checkEq( splitIss.assignees.length, assignCnt, subTest, "Issue assignee count" );
	
	    // Check comment on splitIss
	    const comments = await getComments( authData, splitDat[1] );
	    subTest = tu.checkEq( typeof comments !== 'undefined',                      true,   subTest, "Comment not yet ready" );
	    subTest = tu.checkEq( typeof comments[0] !== 'undefined',                   true,   subTest, "Comment not yet ready" );
	    if( typeof comments !== 'undefined' && typeof comments[0] !== 'undefined' ) {
		subTest = tu.checkEq( comments[0].body.includes( "CodeEquity duplicated" ), true,   subTest, "Comment bad" );
	    }
	}
    }
    
    return await tu.settle( subTest, testStatus, checkSplit, authData, ghLinks, td, issDat, origLoc, newLoc, origVal, opVal, testStatus, specials );
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
    let issue    = await findIssue( authData, issDat[0] );    
    let splitIss = issues.find( issue => issue.title.includes( issDat[2] + " split" ));
    const splitDat = typeof splitIss == 'undefined' ? [-1, -1, -1] : [ splitIss.id.toString(), splitIss.number.toString(), splitIss.title ];

    subTest = tu.checkEq( splitDat[0] != -1, true, subTest, "split iss not ready yet" );
    if( splitDat[0] != -1 ) {
	
	// Get cards
	let allLinks  = await tu.getLinks( authData, ghLinks, { "ceProjId": td.ceProjectId, repo: td.GHFullName });
	let issLink   = allLinks.find( l => l.hostIssueId == issDat[0].toString() );
	let splitLink = allLinks.find( l => l.hostIssueId == splitDat[0].toString() );
	
	if( typeof issLink === 'undefined' ) { console.log( allLinks ); console.log( issDat ); }
	
	// Break this in two to avoid nested loop for settle timer
	if( typeof issLink   !== 'undefined' && typeof splitLink !== 'undefined' ) {
	    
	    const card      = await getCard( authData, issLink.hostCardId );
	    const splitCard = await getCard( authData, splitLink.hostCardId );
	    
	    let lval = origVal / 2;
	    testStatus = await checkAlloc( authData, ghLinks, td, origLoc, issDat, card, testStatus, {opVal: origVal, val: lval, lblCount: labelCnt, assignees: assignCnt } );
	    testStatus = await checkAlloc( authData, ghLinks, td, newLoc,  splitDat, splitCard, testStatus, {val: lval, lblCount: labelCnt, assignees: assignCnt } );
	}
	
	if( typeof issLink   !== 'undefined' && typeof splitLink !== 'undefined' ) {
	    subTest = tu.checkEq( issue.state, splitIss.state,    subTest, "Issues have different state" );
	    
	    // Check assign
	    subTest = tu.checkEq( issue.assignees.length, issAssignCnt,    subTest, "Issue assignee count" );
	    subTest = tu.checkEq( splitIss.assignees.length, issAssignCnt, subTest, "Issue assignee count" );
	    
	    // Check comment on splitIss
	    const comments = await getComments( authData, splitDat[1] );
	    subTest = tu.checkEq( comments[0].body.includes( "CodeEquity duplicated" ), true,   subTest, "Comment bad" );
	}
	
	subTest = await tu.checkEq( typeof issLink   !== 'undefined', true, subTest, "issLink trouble" );
	subTest = await tu.checkEq( typeof splitLink !== 'undefined', true, subTest, "splitLink trouble" );
    }
    
    return await tu.settle( subTest, testStatus, checkAllocSplit, authData, ghLinks, td, issDat, origLoc, newLoc, origVal, testStatus, specials );
}

async function checkNoSplit( authData, ghLinks, td, issDat, newLoc, cardId, testStatus ) {
    
    console.log( "Check No Split", issDat[2], newLoc.colName );
    let subTest = [ 0, 0, []];
    
    const splitName = issDat[2] + " split";
    
    // Check issue
    let issues   = await getIssues( authData, td );
    let splitIss = issues.find( issue => issue.title.includes( splitName ));
				
    subTest = tu.checkEq( typeof splitIss === 'undefined', true, subTest, "Split issue should not exist" );
				
    // Check card
    let colCards = await getCards( authData, newLoc.projId, newLoc.colId );
    let noCard = true;
    if( colCards != -1 ) {
	const card = colCards.find( c => c.note && c.note.includes( splitName ));
	if( typeof card !== 'undefined' ) { noCard = false; }
    }
    subTest = tu.checkEq( noCard, true,                  subTest, "Split card should not exist" );

    // Check peq
    let allPeqs =  await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
    let peq = allPeqs.find( peq => peq.HostIssueTitle.includes( splitName ));
    subTest = tu.checkEq( typeof peq === 'undefined', true,   subTest, "Peq should not exist" );

    // Linkage, id search.
    subTest = await checkNoCard( authData, ghLinks, td, newLoc, cardId, issDat[2], subTest, {skipAllPeq: true} );
    
    return await tu.settle( subTest, testStatus, checkNoSplit, authData, ghLinks, td, issDat, newLoc, cardId, testStatus );
}

async function checkNoCard( authData, ghLinks, td, loc, cardId, title, testStatus, specials ) {
    console.log( "Check No Card", title, cardId );
    let subTest = [ 0, 0, []];    

    // default is -1 peq
    // Send skipAll if peq exists, is active, and checked elsewhere.
    // send checkpeq if peq is inactive.
    let checkPeq   = typeof specials !== 'undefined' && specials.hasOwnProperty( "peq" )        ? specials.peq     : false;    
    let skipAllPeq = typeof specials !== 'undefined' && specials.hasOwnProperty( "skipAllPeq" ) ? specials.skipAllPeq : false;    

    // CHECK github card
    // XXX XXX XXX 6/8 notes.  This is no longer dependable, ATM
    /*
    let cards  = await getCards( authData, loc.projId, loc.colId );
    if( cards != -1 ) { 
	let card   = cards.find( card => card.id == cardId );
	subTest = tu.checkEq( typeof card === "undefined", true,  subTest, "Card should not exist" );
    }
    */
    let cards  = await getCards( authData, loc.projId, loc.colId );
    if( cards != -1 ) { 
	let card   = cards.find( card => card.id == cardId );
	if( typeof card === "undefined") { console.log( "XXX ERROR.  Card", title, cardId, "was rightfully deleted this time." ); }
	else                             { console.log( "XXX ERROR.  Card", title, cardId, "was wrongfully NOT deleted this time." ); }
    }
    
    // CHECK linkage
    let links  = await tu.getLinks( authData, ghLinks, { "ceProjId": td.ceProjectId, "repo": td.GHFullName } );
    let link   = links.find( l => l.hostCardId == cardId.toString() );
    subTest = tu.checkEq( typeof link === "undefined", true, subTest, "Link should not exist" );

    // CHECK dynamo Peq.  inactive, if it exists
    if( !skipAllPeq ) {
	// Risky test - will fail if unrelated peqs with same title exist
	// No card may have inactive peq
	let peqs = await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId, "HostIssueTitle": title });
	if( checkPeq ) {
	    let peq = peqs[0];
	    subTest = tu.checkEq( peq.Active, "false",                  subTest, "peq should be inactive" );
	    subTest = tu.checkEq( peq.HostIssueTitle, title,              subTest, "peq title is wrong" );
	    subTest = tu.checkEq( peq.CEGrantorId, config.EMPTY,        subTest, "peq grantor wrong" );
	}
	else {
	    subTest = tu.checkEq( peqs, -1,                             subTest, "Peq should not exist" );
	}
    }

    return await tu.settle( subTest, testStatus, checkNoCard, authData, ghLinks, td, loc, cardId, title, testStatus, specials );
}

async function checkPact( authData, ghLinks, td, title, verb, action, note, testStatus, specials ) {
    console.log( "Check PAct" );
    let subTest = [ 0, 0, []];
    
    let subject = typeof specials !== 'undefined' && specials.hasOwnProperty( "sub" )   ? specials.sub   : -1;
    // Allow for notification out of order.. pacts are not usually awaited
    let depth   = typeof specials !== 'undefined' && specials.hasOwnProperty( "depth" ) ? specials.depth : 3;

    let pact = {};
    let pacts = {};
    let allPacts = await awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });

    // Either check last related to PEQ, or just find latest.

    if( title != -1 ) {
	// modestly risky test - will fail if unrelated peqs with same title exist.  Do not use with remIssue/rebuildIssue.  No card may have inactive peq
	let peqs = await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId, "HostIssueTitle": title });
	pacts    = allPacts.filter((pact) => pact.Subject[0] == peqs[0].PEQId );
    }
    else { pacts = allPacts; }
    
    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    depth = pacts.length >= depth ? depth : pacts.length;
    
    let foundPAct = false;
    for( let i = pacts.length - depth; i < pacts.length; i++ ) {
	const pact = pacts[i];
	// console.log( i, pact );
	if( pact.Action == action ) {
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
    }

    subTest = tu.checkEq( foundPAct, true,                     subTest, "pact bad" );

    if( !foundPAct ) {
	console.log( "Pact bad?  darg.  ", depth, pacts.length );
	for( let i = pacts.length - depth; i < pacts.length; i++ ) {
	    const pact = pacts[i];
	    console.log( i, pact );
	}
    }

    return await tu.settle( subTest, testStatus, checkPact, authData, ghLinks, td, title, verb, action, note, testStatus, specials );
}

async function checkNoIssue( authData, ghLinks, td, issueData, testStatus ) {

    console.log( "Check No Issue", issueData );
    let subTest = [ 0, 0, []];

    // CHECK github issue
    let issue  = await findIssue( authData, issueData[0] );
    subTest = tu.checkEq( issue, -1,                               subTest, "Issue should not exist" );

    // CHECK linkage
    let links  = await tu.getLinks( authData, ghLinks, { "ceProjId": td.ceProjectId, "repo": td.GHFullName } );
    let link   = links.find( l => l.hostIssueId == issueData[0] );
    subTest = tu.checkEq( typeof link, "undefined",                subTest, "Link should not exist" );

    return await tu.settle( subTest, testStatus, checkNoIssue, authData, ghLinks, td, issueData, testStatus );
}


async function checkAssignees( authData, td, assigns, issueData, testStatus ) {
    console.log( "Check assignees" );
    let subTest = [ 0, 0, []];

    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    
    // CHECK github issues
    let issue  = await findIssue( authData, issueData[0] );
    subTest = tu.checkEq( issue.id, issueData[0].toString(),      subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.number, issueData[1].toString(),  subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.assignees.length, assigns.length, subTest, "Issue assignee count" );
    if( issue.assignees.length == assigns.length ) {
	for( let i = 0; i < assigns.length; i++ ) {
	    subTest = tu.checkEq( assigns.includes( issue.assignees[i].login ), true, subTest, "extra assignee " + issue.assignees[i].login );
	}
    }

    // CHECK Dynamo PEQ
    // Should be no change
    let peqs =  await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
    let meltPeqs = peqs.filter((peq) => peq.HostIssueId == issueData[0].toString() );
    subTest = tu.checkEq( meltPeqs.length, 1,                          subTest, "Peq count" );
    let meltPeq = meltPeqs[0];
    subTest = tu.checkEq( meltPeq.PeqType, config.PEQTYPE_PLAN,        subTest, "peq type invalid" );
    subTest = tu.checkEq( meltPeq.HostProjectSub.length, 3,              subTest, "peq project sub invalid" );
    subTest = tu.checkEq( meltPeq.hostIssueName, issueData[2],          subTest, "peq title is wrong" );
    subTest = tu.checkEq( meltPeq.HostHolderId.length, 0,                subTest, "peq holders wrong" );
    subTest = tu.checkEq( meltPeq.CEHolderId.length, 0,                subTest, "peq ceholders wrong" );
    subTest = tu.checkEq( meltPeq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );
    subTest = tu.checkEq( meltPeq.Amount, 1000,                        subTest, "peq amount" );
    subTest = tu.checkEq( meltPeq.HostProjectSub[0], td.softContTitle,   subTest, "peq project sub invalid" );
    subTest = tu.checkEq( meltPeq.HostProjectSub[1], td.dataSecTitle,    subTest, "peq project sub invalid" );
    subTest = tu.checkEq( meltPeq.HostProjectId, td.dataSecPID,          subTest, "peq unclaimed PID bad" );
    subTest = tu.checkEq( meltPeq.Active, "true",                      subTest, "peq" );

    
    // CHECK Dynamo PAct
    // Should show relevant change action.. last three are related to current entry - may be more for unclaimed
    let pacts = await awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    let meltPacts = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    subTest = tu.checkGE( meltPacts.length, 3,                            subTest, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    
    for( const pact of meltPacts ) {
	let hr  = await tu.hasRaw( authData, pact.PEQActionId );
	subTest = tu.checkEq( hr, true,                                subTest, "PAct Raw match" ); 
	subTest = tu.checkEq( pact.HostUserName, config.TESTER_BOT,      subTest, "PAct user name" ); 
	subTest = tu.checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
	subTest = tu.checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
    }

    return await tu.settle( subTest, testStatus, checkAssignees, authData, td, assigns, issueData, testStatus );
}

async function checkNoAssignees( authData, td, ass1, ass2, issueData, testStatus ) {
    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    let subTest = [ 0, 0, []];
    
    // CHECK github issues
    let meltIssue = await findIssue( authData, issueData[0] );
    subTest = tu.checkEq( meltIssue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
    subTest = tu.checkEq( meltIssue.number, issueData[1].toString(), subTest, "Github issue troubles" );
    subTest = tu.checkEq( meltIssue.assignees.length, 0,             subTest, "Issue assignee count" );

    // CHECK Dynamo PEQ
    // Should be no change
    let peqs =  await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
    let meltPeqs = peqs.filter((peq) => peq.HostIssueId == issueData[0] );
    subTest = tu.checkEq( meltPeqs.length, 1,                          subTest, "Peq count" );
    let meltPeq = meltPeqs[0];
    subTest = tu.checkEq( meltPeq.PeqType, config.PEQTYPE_PLAN,        subTest, "peq type invalid" );
    subTest = tu.checkEq( meltPeq.HostProjectSub.length, 3,              subTest, "peq project sub invalid" );
    subTest = tu.checkEq( meltPeq.HostIssueTitle, issueData[2],          subTest, "peq title is wrong" );
    subTest = tu.checkEq( meltPeq.HostHolderId.length, 0,                subTest, "peq holders wrong" );
    subTest = tu.checkEq( meltPeq.CEHolderId.length, 0,                subTest, "peq holders wrong" );
    subTest = tu.checkEq( meltPeq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );
    subTest = tu.checkEq( meltPeq.Amount, 1000,                        subTest, "peq amount" );
    subTest = tu.checkEq( meltPeq.HostProjectSub[0], td.softContTitle,   subTest, "peq project sub invalid" );
    subTest = tu.checkEq( meltPeq.HostProjectSub[1], td.dataSecTitle,    subTest, "peq project sub invalid" );
    subTest = tu.checkEq( meltPeq.HostProjectId, td.dataSecPID,          subTest, "peq unclaimed PID bad" );
    subTest = tu.checkEq( meltPeq.Active, "true",                      subTest, "peq" );

    
    // CHECK Dynamo PAct
    // Should show relevant change action
    let pacts = await awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    let meltPacts = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    subTest = tu.checkGE( meltPacts.length, 5,                            subTest, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    let len = meltPacts.length;
    let addMP  = meltPacts[len-5];   // add the issue (relocate)
    let addA1  = meltPacts[len-4];   // add assignee 1
    let addA2  = meltPacts[len-3];   // add assignee 2
    let remA1  = meltPacts[len-2];   // rem assignee 1
    let remA2  = meltPacts[len-1];   // rem assignee 2
    let foundRelo = false;
    let foundChan = 0;
    let foundRA   = 0;
    let foundA1   = false; 
    let foundA2   = false;
    for( const pact of [addMP, addA1, addA2, remA1, remA2] ) {
	subTest = tu.checkEq( typeof pact === 'undefined', false,  subTest, "Pact not there yet" );
	if( typeof pact === 'undefined' ) { break; }
	    
	let hr  = await tu.hasRaw( authData, pact.PEQActionId );
	subTest = tu.checkEq( hr, true,                                subTest, "PAct Raw match" ); 
	subTest = tu.checkEq( pact.Verb, config.PACTVERB_CONF,         subTest, "PAct Verb"); 
	subTest = tu.checkEq( pact.HostUserName, config.TESTER_BOT,      subTest, "PAct user name" ); 
	subTest = tu.checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
	subTest = tu.checkEq( pact.Locked, "false",                    subTest, "PAct locked" );

	// Because PActs can be reordered on the way in, just check for exists, not order.
	if( pact.Action == config.PACTACT_RELO || pact.Action == config.PACTACT_ADD ) { foundRelo = true; }
	if( pact.Action == config.PACTACT_CHAN )                                      { foundChan++; }

	if( pact.Note == "remove assignee" ) {
	    foundRA++;
	    if( pact.Subject[1] == ass1 ) { foundA1 = true; }
	    if( pact.Subject[1] == ass2 ) { foundA2 = true; }
	}

    }
    subTest = tu.checkEq( foundRelo, true,           subTest, "PAct add/relo"); 
    subTest = tu.checkEq( foundChan, 4,              subTest, "PAct change count"); 
    subTest = tu.checkEq( foundRA  , 2,              subTest, "PAct assignee count");
    subTest = tu.checkEq( foundA1  , true,           subTest, "PAct sub A1");
    subTest = tu.checkEq( foundA2  , true,           subTest, "PAct sub A2");

    return await tu.settle( subTest, testStatus, checkNoAssignees, authData, td, ass1, ass2, issueData, testStatus );
}

async function checkProgAssignees( authData, td, ass1, ass2, issueData, testStatus ) {
    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    let subTest = [ 0, 0, []];

    // CHECK github issues
    let meltIssue = await findIssue( authData, issueData[0] );
    subTest = tu.checkEq( meltIssue.id, issueData[0].toString(),     subTest, "Github issue troubles" );
    subTest = tu.checkEq( meltIssue.number, issueData[1].toString(), subTest, "Github issue troubles" );
    subTest = tu.checkEq( meltIssue.assignees.length, 2,             subTest, "Issue assignee count" );

    // CHECK Dynamo PEQ  .. no change already verified
    let peqs =  await awsUtils.getPeqs( authData, { "CEProjectId": td.ceProjectId });
    let meltPeqs = peqs.filter((peq) => peq.HostIssueId == issueData[0] );
    subTest = tu.checkEq( meltPeqs.length, 1, subTest, "Peq count" );
    let meltPeq = meltPeqs[0];
    
    // CHECK Dynamo PAct
    // Check new relevant actions
    let pacts = await awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    let meltPacts = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    subTest = tu.checkGE( meltPacts.length, 8, subTest, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    // earlier 5 verified: add peq, add assignees, rem assignees
    let len = meltPacts.length;
    let addA1  = meltPacts[len-3];   // add assignee 1
    let addA2  = meltPacts[len-2];   // add assignee 2
    let relo1  = meltPacts[len-1];   // move to Prog
    for( const pact of [relo1, addA1, addA2] ) {
	let hr     = await tu.hasRaw( authData, pact.PEQActionId );
	subTest = tu.checkEq( hr, true,                                subTest, "PAct Raw match" ); 
	subTest = tu.checkEq( pact.Verb, config.PACTVERB_CONF,         subTest, "PAct Verb"); 
	subTest = tu.checkEq( pact.HostUserName, config.TESTER_BOT,      subTest, "PAct user name" ); 
	subTest = tu.checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
	subTest = tu.checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
    }
    let foundAssigns = ( addA1.Subject[1] == ass1 && addA2.Subject[1] == ass2 ) || ( addA2.Subject[1] == ass1 && addA1.Subject[1] == ass2 );
    subTest = tu.checkEq( relo1.Action, config.PACTACT_RELO,           subTest, "PAct Act"); 
    subTest = tu.checkEq( addA1.Action, config.PACTACT_CHAN,           subTest, "PAct Act"); 
    subTest = tu.checkEq( addA2.Action, config.PACTACT_CHAN,           subTest, "PAct Act"); 
    subTest = tu.checkEq( foundAssigns, true,                          subTest, "PAct sub"); 
    subTest = tu.checkEq( addA1.Note, "add assignee",                  subTest, "PAct note"); 
    subTest = tu.checkEq( addA2.Note, "add assignee",                  subTest, "PAct note"); 

    return await tu.settle( subTest, testStatus, checkProgAssignees, authData, td, ass1, ass2, issueData, testStatus );
}


async function checkLabel( authData, label, name, desc, testStatus ) {

    if( name == -1 || desc == -1 ) {
	testStatus = tu.checkEq( typeof label, 'undefined',  testStatus, "Label should not exist" );
	return testStatus;
    }

    testStatus = tu.checkEq( typeof label !== 'undefined', true, testStatus, "Label not here yet" );
    if( typeof label !== 'undefined' ) {
	testStatus = tu.checkEq( label.name, name,        testStatus, "Label name bad" );
	testStatus = tu.checkEq( label.description, desc, testStatus, "Label description bad" );
    }
    
    return testStatus;
}


exports.refresh         = refresh;
exports.refreshRec      = refreshRec;  
exports.refreshFlat     = refreshFlat;
exports.refreshUnclaimed = refreshUnclaimed;
exports.getQuad         = getQuad;

exports.makeProject     = makeProject;
exports.remProject      = remProject;
exports.linkProject     = linkProject;
exports.unlinkProject   = unlinkProject;
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

exports.getLabels       = getLabels;
exports.getIssues       = getIssues;
exports.getProjects     = getProjects;
exports.getColumns      = getColumns;
exports.getCards        = getCards;
exports.getCard         = getCard;
exports.getComments     = getComments;
exports.findIssue       = findIssue;
exports.findIssueByName = findIssueByName;
exports.findProject     = findProject;
exports.findRepo        = findRepo;
exports.getFlatLoc      = getFlatLoc; 
exports.getFullLoc      = getFullLoc; 

exports.findCardForIssue = findCardForIssue;
// exports.ingestPActs      = ingestPActs;      

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
