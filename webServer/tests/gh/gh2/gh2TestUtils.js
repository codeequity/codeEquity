import assert from 'assert';

import * as config   from '../../../config.js'
import * as utils    from '../../../utils/ceUtils.js'
import * as awsUtils from '../../../utils/awsUtils.js'

import * as ghUtils  from '../../../utils/gh/ghUtils.js'
import * as ghV2     from '../../../utils/gh/gh2/ghV2Utils.js'

import * as tu       from '../../ceTestUtils.js'

// Make up for rest variance, and GH slowness.  Expect 500-1000 top speed for human given net delays for updates
// Server is fast enough for sub 1s, but GH struggles.
// DELAYs have some merit - CE is built for human hands, and hands + native github delay means human
// operations are far slower than the test execution.  Need to keep things just faster than what GH+human allows.
const GH_DELAY = 400;  // No point to dip below 400 - GH interface does not even support this speed

// Had to add a small sleep in each make* - GH seems to get confused if requests come in too fast

// NOTE
// Wherever possible, all data acquisition and checks are against what exists in GH, 
// since most tests are confirming both GH state, and internal ceServer state in one way or another.

// NOTE
// All project, card, repo ids are GQL node ids.  All issue ids are content ids.   

async function refresh( authData, td, projName ){
    if( td.masterPID != config.EMPTY ) { return; }

    let hostProjs = [];
    await ghV2.getProjectIds( authData, td.ghFullname, hostProjs, -1 );

    hostProjs.forEach( proj => { if( proj.hostProjectName == projName ) { td.masterPID = project.id; } });
}


// Refresh a recommended project layout.  This is useful when running tests piecemeal.
async function refreshRec( authData, td ) {
    let hostProjs = [];
    await ghV2.getProjectIds( authData, td.ghFullName, hostProjs, -1 );

    // console.log( "Got hprojs", hostProjs );
    for( const proj of hostProjs ) {
	if( proj.hostProjectName == td.dataSecTitle )   { td.dataSecPID = proj.hostProjectId; }
	if( proj.hostProjectName == td.githubOpsTitle ) { td.githubOpsPID = proj.hostProjectId; }
    }
    assert( td.dataSecPID != -1 );
    assert( td.githubOpsPID != -1 );

    let columns = await getColumns( authData, td.dataSecPID );
    for( const col of columns ) {
	if( col.name == config.PROJ_COLS[ config.PROJ_PLAN ] ) { td.dsPlanId = col.id; }
	if( col.name == config.PROJ_COLS[ config.PROJ_PROG ] ) { td.dsProgId = col.id; }
	if( col.name == config.PROJ_COLS[ config.PROJ_PEND ] ) { td.dsPendId = col.id; }
	if( col.name == config.PROJ_COLS[ config.PROJ_ACCR ] ) { td.dsAccrId = col.id; }
    }
    columns = await getColumns( authData, td.githubOpsPID );
    for( const col of columns ) {
	if( col.name == config.PROJ_COLS[ config.PROJ_PROG ] ) { td.ghProgId = col.id; }
    }
    
}

// Refresh a flat project layout.  This is useful when running tests piecemeal.
async function refreshFlat( authData, td ) {
    let hostProjs = [];
    await ghV2.getProjectIds( authData, td.ghFullName, hostProjs, -1 );

    for( const proj of hostProjs ) {
	if( proj.hostProjectName == td.flatTitle ) {
	    td.flatPID = proj.hostProjectId;

	    let columns = await getColumns( authData, proj.hostProjectId );
	    for( const col of columns ) {
		if( col.name == td.col1Title )  { td.col1Id = col.id; }
		if( col.name == td.col2Title )  { td.col2Id = col.id; }
	    }
	}
    }
    assert( td.flatPID !== -1 );
}

// Refresh unclaimed.
// Note: if unclaimed has not yet been linked, expect config.EMPTY
async function refreshUnclaimed( authData, td ) {
    let hostProjs = [];
    await ghV2.getProjectIds( authData, td.ghFullName, hostProjs, -1, true );

    for( const proj of hostProjs ) {
	console.log( "checking", proj.hostProjectName, proj.hostProjectId, td.ghFullName, td.unclaimTitle );
	if( proj.hostProjectName == td.unclaimTitle ) {
	    td.unclaimPID = proj.hostProjectId;

	    let columns = await getColumns( authData, proj.hostProjectId );
	    for( const col of columns ) {
		if( col.name == td.unclaimTitle )  { td.unclaimCID = col.id; }
	    }
	}
    }

    if( td.unclaimCID == config.EMPTY ) { console.log( "refresh unclaimed .. did not find." ); }
}

async function forcedRefreshUnclaimed( authData, testLinks, td ) {
    await refreshUnclaimed( authData, td );
    return await tu.confirmColumn( authData, testLinks, td.ceProjectId, td.unclaimPID, td.unclaimCID ); 
}

// [ cardId, issueNum, issueId, issueTitle]
// Cards can not exist without issues in V2
function getQuad( card, issueMap ) {
    if( !card.hasOwnProperty( 'issueNum' )) { return [card.cardId, -1, -1, ""]; }  // XXX probably unused

    let issue = issueMap[card.issueNum];
    
    return [card.cardId, card.issueNum, issue.id, issue.title];
}

// If need be, could also add check for issue state
async function checkLoc( authData, td, issDat, loc ) {

    let issue = await findIssue( authData, issDat[0] );
    let retVal = true;
    if( typeof issue === 'undefined' || issue === -1 ) { retVal = false; }

    if( retVal ) {
	if( loc === -1 ) {
	    retVal = retVal && (issue.state == config.GH_ISSUE_OPEN || issue.state == config.GH_ISSUE_CLOSED );
	}
	else {
	    let cards = await getCards( authData, td.ghRepoId, loc.pid, loc.colId );
	    if( cards === -1 ) { retVal = false; }
	    else {
		let mCard = cards.filter((card) => card.hasOwnProperty( "issueNum" ) ? card.issueNum == issDat[1].toString() : false );
		if( typeof mCard[0] === 'undefined' ) { retVal = false; }
	    }
	}
    }
    return retVal;
}

async function getLabel( authData, repoId, lName ) {
    let retVal = await ghV2.getLabel( authData, repoId, lName );
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
    let variables = {"nodeId": td.ghRepoId };
    query = JSON.stringify({ query, variables });

    try{ 
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "TU_getLabels" )
	    .then( async (raw) => {
		if( raw.status != 200 ) { throw raw; }
		let labs = raw.data.node.labels.edges;
		assert( labs.length < 99, "Need to paginate getLabels." );
		
		for( let i = 0; i < labs.length; i++ ) {
		    const label = labs[i].node;
		    let datum = {};
		    datum.id          = label.id;
		    datum.name        = label.name;
		    datum.color       = label.color;
		    datum.description = label.description;
		    labels.push( datum );
		}});
    }
    catch( e ) { labels = await ghUtils.errorHandler( "getLabels", e, getLabels, authData, td ); }

    return labels.length == 0 ? -1 : labels;
}

// Note, this is not returning full issues. 
async function getIssues( authData, td ) {
    let issues = await ghV2.getIssues( authData, td.ghRepoId );
    return issues;
}

// ids, names, faceplate for zeroth repo
async function getProjects( authData, td ) {
    let projects = [];

    let query = `query($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on Repository {
            projectsV2(first:100) {
               edges{node{
                 title id 
                 repositories(first:100) {
                    edges{node{ id name owner { login }}}}}}}
    }}}`;
    let variables = {"nodeId": td.ghRepoId };
    query = JSON.stringify({ query, variables });

    try{
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "TU_getProjects" )
	    .then( async (raw) => {
		if( raw.status != 200 ) { throw raw; }
		if( utils.validField( raw.data.node.projectsV2, "edges" )) {
		    let projs = raw.data.node.projectsV2.edges;
		    assert( projs.length < 99, "Need to paginate getProjects." );
		    
		    for( let i = 0; i < projs.length; i++ ) {
			const p    = projs[i].node;
			const repo = p.repositories.edges[0].node;
			
			let datum = {};
			datum.id        = p.id;
			datum.title     = p.title;
			datum.repoCount = p.repositories.edges.length;
			datum.repoId    = repo.id;
			datum.repoOwner = repo.owner.login;
			datum.repoName  = repo.name;
			projects.push( datum );
		    }
		}});
    }
    catch ( e ) {
	if( utils.validField( e, "errors" ) && e.errors.length >= 1 ) {
	    let m = e.errors[0].message;
	    if( m == 'Field \'ProjectV2\' doesn\'t exist on type \'Repository\'' ) { projects = []; }
	    else                                                                   { console.log( authData.who, "get projects failed.", e ); }
	}
	else { projects = await ghUtils.errorHandler( "getProjects", e, getProjects, authData, td ); }
    }

    return projects.length == 0 ? -1 : projects; 
}

// Note: first view only
async function getColumns( authData, pid ) {
    let cols = [];
    // console.log( "get cols", pid );
    if( pid == config.EMPTY ) { return cols; }
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
    let variables = {"nodeId": pid };
    query = JSON.stringify({ query, variables });

    try{ 
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "TU_getColumns" )
	    .then( async (raw) => {
		if( raw.status != 200 ) { throw raw; }
		let views = raw.data.node.views.edges;
		assert( views.length == 1 );
		
		let view = views[0].node;
		let statusId = -1;
		
		for( let i = 0; i < view.fields.edges.length; i++ ) {
		    const afield = view.fields.edges[i].node;
		    if( afield.name == config.GH_COL_FIELD ) {
			statusId = afield.id;  
			for( let k = 0; k < afield.options.length; k++ ) {
			    let datum = {};
			    datum.statusId = statusId;
			    datum.id = afield.options[k].id;
			    datum.name = afield.options[k].name;
			    cols.push( datum );
			}
			/*
			// Hmm.. do not.. can not move to, and no need for address to move out of.. 
			// Build "No Status" by hand
			let datum = {};
			datum.statusId = statusId;
			datum.id   = config.GH_NO_STATUS;
			datum.name = config.GH_NO_STATUS;
			cols.push( datum );
			*/
			break;
		    }
		}
	    });
    }
    catch( e ) { cols = await ghUtils.errorHandler( "getColumns", e, getColumns, authData, pid ); }

    return cols.length == 0 ? -1 : cols;
}

async function getDraftIssues( authData, pid ) {
    let diss = [];

    let query = `query($nodeId: ID!) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            items(first: 100) {
               edges { node {
               ... on ProjectV2Item {
                   type id
               }}}}
    }}}`;
    let variables = {"nodeId": pid };
    query = JSON.stringify({ query, variables });

    try{ 
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "TU_getDraftIssues" )
	    .then( async (raw) => {
		if( raw.status != 200 ) { throw raw; }
		let drafts = raw.data.node.items.edges;
		assert( drafts.length < 99, "Need to paginate getDraftIssues." );
		
		for( let i = 0; i < drafts.length; i++ ) {
		    const iss = drafts[i].node;
		    if( iss.type == "DRAFT_ISSUE" ) { diss.push( iss.id ); }
		}
	    });
    }
    catch( e ) { diss = await ghUtils.errorHandler( "getDraftIssues", e, getDraftIssues, authData, pid ); }

    return diss.length == 0 ? -1 : diss;
}


// Get all cards for project.  Filter for column.  Filter for repo to avoid other CEProjects
// Needs to work for draft issues as well, i.e. newborn cards.
async function getCards( authData, rid, pid, colId ) {
    let cards = [];

    console.log( "get cards", rid, pid, colId );
    let query = `query($nodeId: ID!, $fName: String!) {
	node( id: $nodeId ) {
        ... on ProjectV2 {
            items(first: 100) {
               edges { node {
               ... on ProjectV2Item {
                   type id
                   fieldValueByName(name: $fName) {
                   ... on ProjectV2ItemFieldSingleSelectValue { name optionId }}
                   content {
                   ... on ProjectV2ItemContent { ... on Issue { id title number repository {id} }
                                                 ... on DraftIssue { id title }
                           }}
               }}}}
    }}}`;
    let variables = {"nodeId": pid, "fName": config.GH_COL_FIELD };
    query = JSON.stringify({ query, variables });

    // If use error handler this way, it passes out and avoids settle wait
    try{ 
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "TU_getCards" )
	    .then( async (raw) => {
		if( raw.status != 200 ) { throw raw; }
		if( raw.status == 200 && typeof raw.errors !== 'undefined' ) {
		    console.log( authData.who, "WARNING. Get cards failed.", pid, colId, raw.errors );
		    raw.status = 422; 
		    throw raw;
		}
		let issues = raw.data.node.items.edges;
		assert( issues.length < 99, "Need to paginate getCards." );
		
		for( let i = 0; i < issues.length; i++ ) {
		    const iss = issues[i].node;

		    // GH can sometimes take a long time to move a card out of No Status to it's home.  Try throwing a few times..
		    if( ( iss.type == "DRAFT_ISSUE" || iss.type == "ISSUE" ) && !utils.validField( iss, "fieldValueByName" ) ) {
			console.log( "Column is No Status.  Toss" );
			raw.status = 500;
			throw raw;
		    }
		    
		    if( ( iss.type == "DRAFT_ISSUE" || iss.type == "ISSUE" ) && iss.fieldValueByName.optionId == colId ) {
			let datum = {};
			datum.cardId = iss.id;                  // pvti or cardId here
			datum.issueNum = iss.content.number;
			datum.issueId  = iss.content.id;
			datum.title    = iss.content.title;
			datum.columnId = colId;
			if( utils.validField( iss.content, "repository" )) { datum.repoId = iss.content.repository.id; }  // draft issue avoidance
			if( typeof datum.issueNum === 'undefined' )        { datum.issueNum = -1; }                       // draft issue

			// wrong CEProject avoidance.  take all draft issues (not strictly correct, but OK for testing)
			if( !utils.validField( datum, "repoId" ) ||
			    (utils.validField( datum, "repoId" ) && datum.repoId == rid ) )
			{
			    cards.push( datum );
			}
		    }
		}
	    });
    }
    catch( e ) { cards = []; }

    // return cards.length == 0 ? -1 : cards;
    return cards;
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

    try{ 
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "TU_getComments" )
	    .then( async (raw) => {
		if( raw.status != 200 || utils.validField( raw, "errors" )) { throw raw; }
		if( !( utils.validField( raw.data, "node" ) && utils.validField( raw.data.node, "comments" ) )) { throw raw; }
		let coms = raw.data.node.comments.edges;
		assert( coms.length < 99, "Need to paginate getComments." );
		
		for( let i = 0; i < coms.length; i++ ) {
		    const com = coms[i].node;
		    let datum = {};
		    datum.id     = com.id;
		    datum.body   = com.body;
		    comments.push( datum );
		}
	    });
    }
    catch( e ) { comments = await ghUtils.errorHandler( "getComments", e, getComments, authData, issueId ); }

    return comments.length == 0 ? -1 : comments;
}

async function getAssignee( authData, aName ) {
    let nodeId = await ghUtils.getOwnerId( authData.pat, aName );
    let retVal = -1;
    if( nodeId != -1 ) {  retVal = { id: nodeId, login: aName };  }
	
    return retVal;
}

async function findIssue( authData, issueId ) {
    let retVal = await ghV2.getFullIssue( authData, issueId );

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

async function findProject( authData, td, pid ) {
    let retVal = -1;
    const projects = await getProjects( authData, td );
    retVal = projects.find( proj => proj.id == pid );
    if( typeof retVal === 'undefined' ) { retVal = -1; }
    return retVal; 
}

async function findProjectByName( authData, orgLogin, userLogin, projName ) {
    let pid = await ghV2.findProjectByName( authData, orgLogin, userLogin, projName );

    if( pid < -1 ) { console.log( "WARNING.  Wakey project exists multiple times", projects ); }

    return pid;
}

async function findProjectByRepo( authData, rNodeId, projName ) {
    let pid = await ghV2.findProjectByRepo( authData, rNodeId, projName );

    if( pid < -1 ) { console.log( "WARNING.  Project exists multiple times", projects ); }

    return pid;
}

async function findRepo( authData, td ) {
    let repoId = await ghUtils.getRepoId( authData.pat, td.ghOwner, td.ghRepo ); 
    if( repoId != -1 ) { repoId = {id:repoId}; }
    return repoId;
}

async function getFlatLoc( authData, pid, projName, colName ) {
    const cols = await getColumns( authData, pid );

    let col = cols.find(c => c.name == colName );

    let ptype = config.PEQTYPE_PLAN;
    // no.  ceFlutter makes this happen
    // if( colName == config.PROJ_COLS[config.PROJ_PEND] ) { ptype = "pending"; }
    // if( colName == config.PROJ_COLS[config.PROJ_ACCR] ) { ptype = "grant"; }

    let psub = [projName, colName];
    // if( config.PROJ_COLS.includes( colName ) ) { psub = [projName]; }
	
    let loc = {};
    loc.pid      = pid;
    loc.projName = projName;
    loc.colId    = col.id;
    loc.colName  = col.name;
    loc.projSub  = psub;
    loc.peqType  = ptype;

    return loc;
}


function findCardForIssue( cards, issueNum ) {
    let card = cards.find( c => c.issueNum == issueNum );
    return typeof card === 'undefined' ? -1 : card.cardId; 
}


/* not in use
async function ingestPActs( authData, issDat ) {
    const peq   = await awsUtils.getPEQ( authData, issDat[0] );    
    const pacts = await awsUtils.getPActs( authData, {"Subject": [peq.PEQId.toString()], "Ingested": "false"} );
    const pactIds = pacts.map( pact => pact.PEQActionId );
    await utils.ingestPActs( authData, pactIds );
}
*/


// If can't find project by collab login or organization name, make it.
// If did find it, then see if it is already linked to the repo.  If not, link it.
// do NOT send ghLinks, ceProjects as that would create in local testServer copy.
// NOTE: testing projects are created by codeequity
async function createProjectWorkaround( authData, td, name, body ) {

    let pid = await ghV2.linkProject( authData, -1, -1, td.ceProjectId, config.TEST_OWNER, td.ghOwner, td.ghRepoId, td.ghFullName, name, body );
    assert( typeof pid !== 'undefined' && !(pid <= -1) );

    // force linking in ceServer:ghLinks, not local ghLinks
    await tu.linkProject( authData, td.ceProjectId, pid, td.ghRepoId, td.ghFullName ); 
    
    console.log( "Confirmed", name, "with PID:", pid, "in repo:", td.ghRepoId );

    await utils.sleep( tu.MIN_DELAY );
    return pid;
}

// XXX This creates a simple default pv2 project.. can not yet (3/2025) create custom columns.
async function createDefaultProject(  authData, td, name, body ) {
    let pid = await ghV2.createProject( authData, td.ghOwnerId, td.ghRepoId, name );

    // force linking in ceServer:ghLinks, not local ghLinks
    await tu.linkProject( authData, td.ceProjectId, pid, td.ghRepoId, name ); 

    return pid;
}

async function remProject( authData, pid ) {
    await ghV2.deleteProject( authData, pid );
    await utils.sleep( tu.MIN_DELAY );
}


// do NOT move to ghV2 - this is used during testing only.  handlers are oblivious to this view-centric action.
async function unlinkProject( authData, ceProjId, pid, rNodeId ) {
    let query     = "mutation( $pid:ID!, $rid:ID! ) { unlinkProjectV2FromRepository( input:{projectId: $pid, repositoryId: $rid }) {clientMutationId}}";
    let variables = {"pid": pid, "rid": rNodeId };
    query         = JSON.stringify({ query, variables });

    let res = -1;
    try{ 
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, query, "TU_unlinkProject" )
	    .then( ret => {
		if( ret.status != 200 ) { throw ret; }
		res = ret;
	    });
    }
    catch( e ) { res = await ghUtils.errorHandler( "unlinkProject", e, unlinkProject, authData, ceProjId, pid, rNodeId ); }
    
    if( typeof res.data === 'undefined' ) { console.log( "UnlinkProject failed.", res ); }
    else {
	// Cards are still valid, just can't find the project from the repo.  Clear repo info
	await tu.unlinkProject( authData, ceProjId, pid, rNodeId );
    }

    await utils.sleep( tu.MIN_DELAY );
}

async function linkRepo( authData, ceProjId, rNodeId, rName, cepDetails ) {
    // force linking in ceServer:ghLinks, not local ghLinks
    console.log( "gh2tu:Linking repo", ceProjId, rNodeId, rName );
    await tu.linkRepo( authData, ceProjId, rNodeId, rName, cepDetails );
}

async function unlinkRepo( authData, ceProjId, rNodeId ) {
    // force linking in ceServer:ghLinks, not local ghLinks
    console.log( "gh2tu:unlinking repo", ceProjId, rNodeId );
    await tu.unlinkRepo( authData, ceProjId, rNodeId );
}

async function cloneFromTemplate( authData, oid, spid, title ) {
    let newPID = await ghV2.cloneFromTemplate( authData, oid, spid, title );
    await utils.sleep( tu.MIN_DELAY);
    return newPID;
}

async function createCustomField( authData, fieldName, pid, sso ) {
    await ghV2.createCustomField( authData, fieldName, pid, sso );
    await utils.sleep( tu.MIN_DELAY);
}

async function createColumnTest( authData, pid, colId, name ) {
    await ghV2.createColumnTest( authData, pid, colId, name );
    await utils.sleep( tu.MIN_DELAY);
}

async function updateProject( authData, pid, name ) {
    await ghV2.updateProject( authData, pid, name );
    await utils.sleep( tu.MIN_DELAY);
}


async function makeColumn( authData, testLinks, ceProjId, fullName, pid, name ) {
    // First, wait for pid, can lag
    await tu.settleWithVal( "confirmProj", tu.confirmProject, authData, testLinks, ceProjId, fullName, pid );
    let loc = await ghV2.createColumn( authData, testLinks, ceProjId, pid, name );
    let cid = loc === -1 ? loc : loc.hostColumnId;
    
    if( cid === -1 ) { console.log( "Missing column:", name ); }
    else             { console.log( "Found column:", name, cid ); }

    // XXX Can't verify this, since we know col can not be created by apiV2 yet
    // let query = "project_column created " + name + " " + fullName;
    // await tu.settleWithVal( "makeCol", tu.findNotice, query );

    return cid;
}

async function make4xCols( authData, testLinks, ceProjId, fullName, pid ) {

    let plan = await makeColumn( authData, testLinks, ceProjId, fullName, pid, config.PROJ_COLS[ config.PROJ_PLAN ] );
    let prog = await makeColumn( authData, testLinks, ceProjId, fullName, pid, config.PROJ_COLS[ config.PROJ_PROG ] );
    let pend = await makeColumn( authData, testLinks, ceProjId, fullName, pid, config.PROJ_COLS[ config.PROJ_PEND ] );
    let accr = await makeColumn( authData, testLinks, ceProjId, fullName, pid, config.PROJ_COLS[ config.PROJ_ACCR ] );
	
    await utils.sleep( tu.MIN_DELAY );
    return [prog, plan, pend, accr];
}

async function createDraftIssue( authData, pid, title, body ) {
    console.log( authData.who, "Create Draft issue" );

    let query = `mutation( $pid:ID!, $title:String!, $body:String! )
                    {addProjectV2DraftIssue( input:{ projectId: $pid, title: $title, body: $body }) 
                    {clientMutationId, projectItem{id}}}`;

    let variables = { "pid": pid, "title": title, "body": body };
    let queryJ    = JSON.stringify({ query, variables });

    let pvId = -1;
    try{
	await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "TU_createDraftIssue" )
	    .then( ret => {
		if( ret.status != 200 ) { throw ret; }
		pvId = ret.data.addProjectV2DraftIssue.projectItem.id;
		console.log( authData.who, " .. draft issue created, id:", pvId );
	    });
    }
    catch( e ) { pvId = await ghUtils.errorHandler( "createDraftIssue", e, createDraftIssue, authData, pid, title, body ); }
    
    return pvId;
}


async function makeNewbornCard( authData, testLinks, ceProjId, pid, colId, title ) {
    const locs = testLinks.getLocs( authData, { "ceProjId": ceProjId, "pid": pid, "colId": colId } );    
    assert( locs !== -1 );
    let statusId = locs[0].hostUtility;

    // First, wait for colId, can lag
    await tu.settleWithVal( "make newbie card", tu.confirmColumn, authData, testLinks, ceProjId, pid, colId );

    let pvId = await createDraftIssue( authData, pid, title, "" );
    await ghV2.moveCard( authData, pid, pvId, statusId, colId );
    
    await utils.sleep( tu.MIN_DELAY );
    return pvId;
}

// Only makes card, no issue.
// { pid cardId statusId columnId columnName }
async function makeProjectCard( authData, testLinks, ceProjId, pid, colId, issueId, justId ) {
    let query = { ceProjId: ceProjId, pid: pid, colId: colId };  
    const locs = testLinks.getLocs( authData, query );    
    assert( locs !== -1 );
    let statusId = locs[0].hostUtility;

    // First, wait for colId, can lag
    await tu.settleWithVal( "make Proj card", tu.confirmColumn, authData, testLinks, ceProjId, pid, colId );

    justId = typeof justId === 'undefined' ? false : justId;
    let card = await ghV2.createProjectCard( authData, testLinks, query, issueId, statusId, justId );

    // Very weak notice - could be anything.
    // Notification: ariCETester projects_v2_item edited codeequity/I_kwDOIiH6ss5fNfog VudsdHVkWc for codeequity 03.17.798
    // gives notice: projects_v2_item edited codeequity/I_kwDOIiH6ss5fNinX GitHub/codeequity/I_kwDOIiH6ss5fNinX
    let path = config.TEST_OWNER + "/" + issueId;
    let locator = " " + config.HOST_GH + "/" + config.TEST_OWNER + "/" + config.TEST_ACTOR;    
    query       = "projects_v2_item edited " + path + locator;
    await tu.settleWithVal( "makeProjCard", tu.findNotice, query );

    await utils.sleep( tu.MIN_DELAY );
    return card;
}

// [contentId, num, cardId, title]
// NOTE this creates an uncarded issue.  Call 'createProjectCard' to situate it.
async function makeIssue( authData, td, title, labels ) {
    let issue = await ghV2.createIssue( authData, td.ghRepoId, -1, {title: title, labels: labels} );
    issue.push( title );
    assert( issue.length == 4 );
    await utils.sleep( tu.MIN_DELAY );
    return issue;
}


// NOTE this creates an uncarded issue.  Call 'createProjectCard' to situate it.
async function blastIssue( authData, td, title, labels, assignees, specials ) {
    let wait  = typeof specials !== 'undefined' && specials.hasOwnProperty( "wait" )   ? specials.wait   : true;

    let issDat = await ghV2.createIssue( authData, td.ghRepoId, -1, {title: title, labels: labels, assignees: assignees, body: "Hola"} );    
    
    issDat.push( title );
    if( wait ) { await utils.sleep( tu.MIN_DELAY ); }
    return issDat;
}

async function transferIssue( authData, issueId, toRepoId ) {
    await ghV2.transferIssue( authData, issueId, toRepoId );
    await utils.sleep( tu.MIN_DELAY );
    return true;
}


async function addLabel( authData, lNodeId, issDat ) {
    await ghV2.addLabel( authData, lNodeId, issDat[0] );

    let locator = " " + config.HOST_GH + "/" + config.TEST_OWNER + "/" + config.TEST_ACTOR;
    let query = "issue labeled " + issDat[3] + locator;
    await tu.settleWithVal( "label", tu.findNotice, query );
}	

async function remLabel( authData, label, issDat ) {
    console.log( "Removing", label.name, "from issueNum", issDat[1] );
    await ghV2.removeLabel( authData, label.id, issDat[0] );

    let locator = " " + config.HOST_GH + "/" + config.TEST_OWNER + "/" + config.TEST_ACTOR;
    let query = "issue unlabeled " + issDat[3] + locator;
    await tu.settleWithVal( "unlabel", tu.findNotice, query );
}

// NOTE - this ignores color... 
async function updateLabel( authData, label, updates ) {
    console.log( "Updating", label.name );
    let subTest = [ 0, 0, []];
    
    let newName = updates.hasOwnProperty( "name" )        ? updates.name : label.name;
    let newDesc = updates.hasOwnProperty( "description" ) ? updates.description : label.description;
    
    await ghV2.updateLabel( authData, label.id, newName, newDesc, label.color );

    // XXX
    let locator = " " + config.HOST_GH + "/" + config.TEST_OWNER + "/" + config.TEST_ACTOR;    
    let query = "label edited " + newName + locator;
    let res = await tu.settleWithVal( "verify update label", tu.findNotice, query );

    subTest = tu.checkEq( ((res !== 'undefined') && res), true,    subTest, "Label update notification not sent" );
    await utils.sleep( tu.MIN_DELAY );
    return subTest;
}

async function delLabel( authData, label ) {
    console.log( "Removing label from repo:", label.name, label.id );

    let query     = `mutation( $labelId:ID! ) 
                        { deleteLabel( input:{ id: $labelId })  {clientMutationId}}`;
    let variables = {"labelId": label.id };
    let queryJ    = JSON.stringify({ query, variables });

    try{ await ghUtils.postGH( authData.pat, config.GQL_ENDPOINT, queryJ, "TU_delLabel" ); }
    catch( e ) { await ghUtils.errorHandler( "delLabel", e, delLabel, authData, label ); }

    let locator = " " + config.HOST_GH + "/" + config.TEST_OWNER + "/" + config.TEST_ACTOR;    
    query = "label deleted " + label.name + locator;
    await tu.settleWithVal( "del label", tu.findNotice, query );
}

async function findOrCreateLabel( authData, repoNode, lname, peqValue ) {
    
    let name = lname;
    if( typeof peqValue == "string" ) { peqValue = parseInt( peqValue.replace(/,/g, "" )); }
    
    if( peqValue > 0 ) { name = ghV2.makeHumanLabel( peqValue, config.PEQ_LABEL ); }
    let label = await ghV2.findOrCreateLabel( authData, repoNode, name, peqValue );
    return label;
}

async function addAssignee( authData, issDat, assignee ) {
    let ret = await ghV2.addAssignee( authData, issDat[0], assignee.id );
    assert( ret, "Assignement failed" );

    let locator = " " + config.HOST_GH + "/" + config.TEST_OWNER + "/" + config.TEST_ACTOR;
    let query = "issue assigned " + issDat[3] + locator;
    await tu.settleWithVal( "assign issue", tu.findNotice, query );
}

async function remAssignee( authData, iNodeId, assignee ) {
    await ghV2.remAssignee( authData, iNodeId, assignee.id );
    await utils.sleep( tu.MIN_DELAY );
}

async function moveCard( authData, testLinks, ceProjId, cardId, columnId, specials ) {
    console.log( authData.who, "Move Card", ceProjId, cardId, columnId );
    assert( typeof cardId   !== 'undefined' );
    assert( typeof columnId !== 'undefined' );
    
    let links  = await tu.getLinks( authData, testLinks, { "ceProjId": ceProjId, "cardId": cardId } );    
    if( !( links !== -1 && links.length == 1) ) { console.log( "erm", links ); }
    assert( links !== -1 && links.length == 1);

    let locs  = await tu.getLocs( authData, testLinks, { ceProjId: ceProjId, pid: links[0].hostProjectId, colId: columnId } );    
    assert( locs !== -1 && locs.length == 1 );

    assert( columnId != config.GH_NO_STATUS );
    await ghV2.moveCard( authData, links[0].hostProjectId, cardId, locs[0].hostUtility, columnId );
    
    let issId  = typeof specials !== 'undefined' && specials.hasOwnProperty( "issId" )  ? specials.issId : false;

    // This check is weak now, without updating internal notices.
    // Looking for something like: projects_v2_item edited codeequity/I_kwDOIiH6ss50ZsVo GitHub/codeequity/ariCETester
    if( issId ) {
	let locator = " " + config.HOST_GH + "/" + config.TEST_OWNER + "/" + config.TEST_ACTOR;	
	let query = "projects_v2_item edited " + config.TEST_OWNER + "/" + issId + locator;
	await tu.settleWithVal( "moveCard", tu.findNotice, query );
    }
    
    await utils.sleep( tu.MIN_DELAY );
}

async function remCard( authData, ceProjId, pid, cardId ) {
    await ghV2.removeCard( authData, pid, cardId );
    
    await utils.sleep( tu.MIN_DELAY );
}

// NOTE Send loc when, say, close followed by accr move.  Otherwise, just check state of issue from GH - if connection is slow, this will help with pacing.
// Extra time needed.. CE bot-sent notifications to, say, move to PEND, time to get seen by GH.
// Without it, a close followed immediately by a move, will be processed in order by CE, but may arrive out of order for GH.
async function closeIssue( authData, td, issDat, loc = -1 ) {
    await ghV2.updateIssue( authData, issDat[0], "state", config.GH_ISSUE_CLOSED );

    let locator = " " + config.HOST_GH + "/" + config.TEST_OWNER + "/" + config.TEST_ACTOR;
    let query = "issue closed " + issDat[3] + locator;
    await tu.settleWithVal( "closeIssue", tu.findNotice, query );

    await tu.settleWithVal( "closeIssue finished", checkLoc, authData, td, issDat, loc );
}

async function reopenIssue( authData, td, issueId ) {
    await ghV2.updateIssue( authData, issueId, "state", config.GH_ISSUE_OPEN );

    // Can take GH a long time to move card.  
    await utils.sleep( tu.MIN_DELAY + 500 );
}

async function remIssue( authData, issueId ) {

    await ghV2.remIssue( authData, issueId );
    
    await utils.sleep( tu.MIN_DELAY );
}

async function remDraftIssue( authData, pid, dissueId ) {

    await ghV2.removeCard( authData, pid, dissueId ); 
    
    await utils.sleep( tu.MIN_DELAY );
}

// Untracked issues have only partial entries in link table
// Should work for carded issues that have never been peq.  Does NOT work for newborn.
async function checkUntrackedIssue( authData, testLinks, td, loc, issDat, card, testStatus, specials ) {

    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 0;

    console.log( "Check Untracked issue", issDat, labelCnt.toString() );
    let subTest = [ 0, 0, []];

    // CHECK github issues
    let issue  = await findIssue( authData, issDat[0] );
    subTest = tu.checkEq( issue.id, issDat[0].toString(),     subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.number, issDat[1].toString(), subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.labels.length, labelCnt,         subTest, "Issue label" );

    // CHECK linkage
    let links  = await tu.getLinks( authData, testLinks, { "ceProjId": td.ceProjectId, "repo": td.ghFullName } );
    let link   = ( links.filter((link) => link.hostIssueId == issDat[0] ))[0];
    subTest = tu.checkEq( link.hostIssueNum, issDat[1].toString(), subTest, "Linkage Issue num" );
    subTest = tu.checkEq( link.hostCardId, card.cardId,               subTest, "Linkage Card Id" );
    subTest = tu.checkEq( link.hostColumnName, config.EMPTY,          subTest, "Linkage Col name" );
    subTest = tu.checkEq( link.hostIssueName, config.EMPTY,           subTest, "Linkage Card Title" );
    subTest = tu.checkEq( link.hostProjectName, config.EMPTY,         subTest, "Linkage Project Title" );
    subTest = tu.checkEq( link.hostColumnId, config.EMPTY,            subTest, "Linkage Col Id" );
    subTest = tu.checkEq( link.hostProjectId, loc.pid,             subTest, "Linkage project id" );

    // CHECK dynamo Peq.  inactive, if it exists
    let peqs      = await awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId });
    let issuePeqs = peqs.filter((peq) => peq.HostIssueId == issDat[0].toString() );
    subTest = tu.checkLE( issuePeqs.length, 1,                      subTest, "Peq count" );
    if( issuePeqs.length > 0 ) {
	let peq = issuePeqs[0];
	subTest = tu.checkEq( peq.Active, "false",                  subTest, "peq should be inactive" );
	subTest = tu.checkEq( peq.HostIssueTitle, issDat[3],       subTest, "peq title is wrong" );
	subTest = tu.checkEq( peq.CEGrantorId, config.EMPTY,        subTest, "peq grantor wrong" );
    }

    // CHECK dynamo Pact.. nothing to do here for newborn

    return await tu.settle( subTest, testStatus, checkUntrackedIssue, authData, testLinks, td, loc, issDat, card, testStatus, specials );
}

// Used for previously peq'd issues that were unlabeled
async function checkDemotedIssue( authData, testLinks, td, loc, issDat, card, testStatus ) {

    console.log( "Check demotedissue", loc.projName, loc.colName );

    // For issues, linkage
    testStatus = await checkUntrackedIssue( authData, testLinks, td, loc, issDat, card, testStatus );
    let subTest = [ 0, 0, []];
    
     // CHECK github location
    let cards  = await getCards( authData, td.ghRepoId, td.unclaimPID, td.unclaimCID );   
    let tCard  = cards.filter((card) => card.hasOwnProperty( "issueNum" ) ? card.issueNum == issDat[1].toString() : false );
    subTest = tu.checkEq( tCard.length, 0,                       subTest, "No unclaimed" );
    
    cards      = await getCards( authData, td.ghRepoId, loc.pid, loc.colId );   
    let mCard  = cards.filter((card) => card.hasOwnProperty( "issueNum" ) ? card.issueNum == issDat[1].toString() : false );

    subTest = tu.checkEq( typeof mCard[0] !== 'undefined', true,     subTest, "mCard not yet ready" );
    if( typeof mCard[0] !== 'undefined' ) {

	subTest = tu.checkEq( mCard.length, 1,                       subTest, "Card claimed" );
	subTest = tu.checkEq( mCard[0].cardId, card.cardId,                  subTest, "Card claimed" );

	// CHECK dynamo Peq.  inactive
	// Will have 1 or 2, both inactive, one for unclaimed, one for the demoted project.
	// Unclaimed may not have happened if peq'd a carded issue
	let peqs      = await awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId });
	let issuePeqs = peqs.filter((peq) => peq.HostIssueId == issDat[0].toString() );
	subTest = tu.checkEq( issuePeqs.length, 1,                      subTest, "Peq count" );
	for( const peq of issuePeqs ) {
	    subTest = tu.checkEq( peq.Active, "false",                  subTest, "peq should be inactive" );
	    subTest = tu.checkEq( peq.HostIssueTitle, issDat[3],       subTest, "peq title is wrong" );
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
	subTest = tu.checkEq( lastPact.HostUserId, td.actorId,         subTest, "PAct user name" ); 
	subTest = tu.checkEq( lastPact.Ingested, "false",              subTest, "PAct ingested" );
	subTest = tu.checkEq( lastPact.Locked, "false",                subTest, "PAct locked" );
    }
    
    return await tu.settle( subTest, testStatus, checkDemotedIssue, authData, testLinks, td, loc, issDat, card, testStatus );
}


// This does not strictly need to check for a peq amount, which is why it is not checkPeq.
async function checkSituatedIssue( authData, testLinks, td, loc, issDat, card, testStatus, specials ) {

    let muteIngested = typeof specials !== 'undefined' && specials.hasOwnProperty( "muteIngested" ) ? specials.muteIngested : false;
    let issueState   = typeof specials !== 'undefined' && specials.hasOwnProperty( "state" )        ? specials.state        : false;
    let labelVal     = typeof specials !== 'undefined' && specials.hasOwnProperty( "label" )        ? specials.label        : false;
    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 1;
    let peqIID       = typeof specials !== 'undefined' && specials.hasOwnProperty( "peqIID" )       ? specials.peqIID       : issDat[0];
    let peqCEP       = typeof specials !== 'undefined' && specials.hasOwnProperty( "peqCEP" )       ? specials.peqCEP       : td.ceProjectId;
    let skipPeqPID   = typeof specials !== 'undefined' && specials.hasOwnProperty( "skipPeqPID" )   ? specials.skipPeqPID   : false;
    let assignCnt    = typeof specials !== 'undefined' && specials.hasOwnProperty( "assign" )       ? specials.assign       : false;
    let opVal        = typeof specials !== 'undefined' && specials.hasOwnProperty( "opVal" )        ? specials.opVal        : false;
    let peqHolder    = typeof specials !== 'undefined' && specials.hasOwnProperty( "peqHolder" )    ? specials.peqHolder    : false;
    let rejected     = typeof specials !== 'undefined' && specials.hasOwnProperty( "rejected" )     ? specials.rejected     : false;
    let newCardId    = typeof specials !== 'undefined' && specials.hasOwnProperty( "newCardId" )    ? specials.newCardId    : false;
    
    console.log( "Check situated issue", loc.projName, loc.colName, muteIngested, labelVal, assignCnt, peqIID, peqCEP );
    let subTest = [ 0, 0, []];
    
    // Start promises
    let cardsP = getCards( authData, td.ghRepoId, loc.pid, loc.colId );
    let cardsU = td.unclaimPID == config.EMPTY ? [] : getCards( authData, td.ghRepoId, td.unclaimPID, td.unclaimCID );
    let linksP = tu.getLinks( authData, testLinks, { "ceProjId": td.ceProjectId, "repo": td.ghFullName } );
    let peqsP  = awsUtils.getPEQs( authData, { "CEProjectId": peqCEP });
    let pactsP = awsUtils.getPActs( authData, { "CEProjectId": peqCEP });
    
    // CHECK github issues
    let issue  = await findIssue( authData, issDat[0] );
    subTest = tu.checkEq( issue.id, issDat[0].toString(),     subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.number, issDat[1].toString(), subTest, "Github issue troubles" );

    if( assignCnt ) { subTest = tu.checkEq( issue.assignees.length, assignCnt, subTest, "Assignee count" ); }
    
    const lname = labelVal ? ghV2.makeHumanLabel( labelVal, config.PEQ_LABEL ) : ghV2.makeHumanLabel( 1000, config.PEQ_LABEL );
    let   lval  = labelVal ? labelVal : 1000;
    lval        = opVal    ? opVal    : lval;    // resolve, original issue peq amount is not updated.  label is.

    subTest = tu.checkEq( typeof issue.labels !== 'undefined', true, subTest, "labels not yet ready" );
    
    if( typeof issue.labels !== 'undefined' ){
	subTest = tu.checkEq( typeof issue.labels[0] !== 'undefined', true, subTest, "labels not yet ready" );
	subTest = tu.checkEq( issue.labels.length, labelCnt,         subTest, "Issue label count" );
	if( typeof issue.labels[0] !== 'undefined' ) {
	    subTest = tu.checkEq( typeof issue.labels.find( l => l.name == lname ) !== "undefined", true,  subTest, "Issue label names missing " + lname );
	}
    }
    if( issueState ) { subTest = tu.checkEq( issue.state, issueState, subTest, "Issue state" );  }

    // XXX Crappy test.  many locs are not related to td.unclaim.  Can be situated and in unclaim.
    //     Should kill this here, put in a handful in basic flow to ensure cleanUnclaimed when we know it should be.
    //     Use of assignCnt to ignore is poor, but will do until this is rebuilt, only shows in testCross.
    // CHECK github location
    let cards = td.unclaimCID == config.EMPTY ? [] : await cardsU;
    if( !assignCnt ) {
	let tCard = []; 
	if( cards.length > 0 ) { tCard = cards.filter((card) => card.hasOwnProperty( "issueNum" ) ? card.issueNum == issDat[1].toString() : false ); }
	subTest = tu.checkEq( tCard.length, 0,                           subTest, "No unclaimed" );
    }

    cards = await cardsP;
    let mCard = cards.filter((card) => card.hasOwnProperty( "issueNum" ) ? card.issueNum == issDat[1].toString() : false );

    // Long GH pauses show their fury here, more likely than not.
    if( typeof mCard[0] === 'undefined' ) {
	console.log( "mCard failure. issDat: ", issDat.toString() );
	console.log( "               card: ", card.title );
	console.log( "               loc: ", loc );
	console.log( "               loc: ", loc.projSub.toString() );
    }
    
    subTest = tu.checkEq( typeof mCard[0] !== 'undefined', true,     subTest, "mCard not yet ready" );
    subTest = tu.checkEq( typeof card     !== 'undefined', true,     subTest, "Card not yet ready" );
    if( typeof mCard[0] !== 'undefined' && typeof card !== 'undefined' ) {
    
	subTest = tu.checkEq( mCard.length, 1,                           subTest, "Card claimed" );
	if( !newCardId ) { subTest = tu.checkEq( mCard[0].cardId, card.cardId,              subTest, "Card claimed" ); }

	// CHECK linkage
	let links  = await linksP;
	subTest = tu.checkEq( links !== -1, true,               subTest, "Wait for links" );
	if( links != -1 ) {
	    let link   = ( links.filter((link) => link.hostIssueId == issDat[0] ))[0];
	    subTest = tu.checkEq( link !== 'undefined', true,               subTest, "Wait for link" );
	    if( typeof link !== 'undefined' ) {
		subTest = tu.checkEq( link.hostIssueNum, issDat[1].toString(), subTest, "Linkage Issue num" );
		subTest = tu.checkEq( link.hostCardId, mCard[0].cardId,        subTest, "Linkage Card Id" );
		subTest = tu.checkEq( link.hostColumnName, loc.colName,        subTest, "Linkage Col name" );
		subTest = tu.checkEq( link.hostIssueName, issDat[3],           subTest, "Linkage Card Title" );
		subTest = tu.checkEq( link.hostProjectName, loc.projName,      subTest, "Linkage Project Title" );
		subTest = tu.checkEq( link.hostColumnId, loc.colId,            subTest, "Linkage Col Id" );
		subTest = tu.checkEq( link.hostProjectId, loc.pid,             subTest, "Linkage project id" );
	    }
	}
	
	// CHECK dynamo Peq
	let allPeqs = await peqsP;
	if( allPeqs != -1 ) {
	    let peqs    = allPeqs.filter((peq) => peq.HostIssueId == peqIID.toString() );
	    subTest     = tu.checkEq( peqs.length, 1,                          subTest, "Peq count" );
	    let peq     = peqs[0];
	    subTest     = tu.checkEq( typeof peq !== 'undefined', true,        subTest, "peq not ready yet" );
	    
	    if( typeof peq !== 'undefined' ) {
		
		assignCnt = assignCnt ? assignCnt : 0;
		
		// When making an issue, peq.HostHolder will be assigned, or not, depending on if GH got the assign
		// signal before CE fully processed the label notification.  Since either is acceptible, let both pass.
		let holderCheck = peq.HostHolderId.length == assignCnt;
		if( peqHolder == "maybe" ) { holderCheck = holderCheck || peq.HostHolderId.length > 0; }
		if( !holderCheck ) {
		    console.log( peq.HostHolderId.length.toString(), assignCnt.toString(), peqHolder );
		    console.log( peqIID, peq, peqs );
		}
		subTest = tu.checkEq( holderCheck, true,                       subTest, "peq holders wrong" );      
		
		subTest = tu.checkEq( peq.PeqType, loc.peqType,                subTest, "peq type invalid" );        
		subTest = tu.checkEq( peq.HostProjectSub.length, loc.projSub.length, subTest, "peq project sub len invalid" );
		subTest = tu.checkEq( peq.HostIssueTitle, issDat[3],           subTest, "peq title is wrong" );
		subTest = tu.checkEq( peq.CEHolderId.length, 0,                subTest, "peq ceholders wrong" );    
		subTest = tu.checkEq( peq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );      
		subTest = tu.checkEq( peq.Amount, lval,                        subTest, "peq amount" );
		subTest = tu.checkEq( peq.HostProjectSub[0], loc.projSub[0],   subTest, "peq project sub 0 invalid" );
		subTest = tu.checkEq( peq.Active, "true",                      subTest, "peq" );
		if( !skipPeqPID ) {
		    subTest = tu.checkEq( peq.HostRepoId, td.ghRepoId,         subTest, "peq repo id bad" );
		}
		
		// CHECK dynamo Pact
		let allPacts = await pactsP;
		subTest   = tu.checkNEq( allPacts, -1,                           subTest, "PActs not yet ready" );
		
		if( allPacts !== -1 ) {
		    
		    let pacts    = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
		    subTest   = tu.checkGE( pacts.length, 1,                         subTest, "PAct count" );

		    // rejected tracks if a split attempted to be created in reserved, then was rejected.  psub not updated until ingest.
		    // This can get out of date quickly.  Only check this if early on, before lots of moving (which PEQ doesn't keep up with)
		    if( !rejected && pacts.length <= 3 && loc.projSub.length > 1 ) {
			const pip = [ config.PROJ_COLS[config.PROJ_PEND], config.PROJ_COLS[config.PROJ_ACCR], config.GH_NO_STATUS ];
			if( !pip.includes( loc.projSub[1] ) && peq.HostProjectSub[1] != config.GH_NO_STATUS ) { 
			    subTest = tu.checkEq( peq.HostProjectSub[1], loc.projSub[1], subTest, "peq project sub 1 invalid" );
			}
		    }
		    
		    // Could have been many operations on this.
		    for( const pact of pacts ) {
			let hr  = await tu.hasRaw( authData, pact.PEQActionId );
			subTest = tu.checkEq( hr, true,                                subTest, "PAct Raw match" ); 
			subTest = tu.checkEq( pact.HostUserId, td.actorId,             subTest, "PAct user name" ); 
			subTest = tu.checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
			
			if( !muteIngested ) { subTest = tu.checkEq( pact.Ingested, "false", subTest, "PAct ingested" ); }
		    }
		}
	    }
	}
    }
    
    return await tu.settle( subTest, testStatus, checkSituatedIssue, authData, testLinks, td, loc, issDat, card, testStatus, specials );
}


async function checkUnclaimedIssue( authData, testLinks, td, loc, issDat, card, testStatus, specials ) {

    let labelVal     = typeof specials !== 'undefined' && specials.hasOwnProperty( "label" )        ? specials.label        : false;
    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 1;
    let assignees    = typeof specials !== 'undefined' && specials.hasOwnProperty( "assigns" )      ? specials.assigns      : [];
    let soft         = typeof specials !== 'undefined' && specials.hasOwnProperty( "soft" )         ? specials.soft         : false;
    
    console.log( "Check unclaimed issue", loc.projName, loc.colName, labelVal, issDat );
    let subTest = [ 0, 0, []];
    
    // Start promises
    let cardsU = getCards( authData, td.ghRepoId, td.unclaimPID, td.unclaimCID );
    let linksP = tu.getLinks( authData, testLinks, { "ceProjId": td.ceProjectId, "repo": td.ghFullName } );
    let peqsP  = awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId });
    let pactsP = awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    
    // CHECK github issues
    let issue  = await findIssue( authData, issDat[0] );
    subTest = tu.checkEq( issue.id, issDat[0].toString(),     subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.number, issDat[1].toString(), subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.labels.length, labelCnt,      subTest, "Issue label count" );
    
    const lname = labelVal ? ghV2.makeHumanLabel( labelVal, config.PEQ_LABEL ) : ghV2.makeHumanLabel( 1000, config.PEQ_LABEL );
    const lval  = labelVal ? labelVal                     : 1000;
    subTest = tu.checkEq( typeof issue.labels.find( l => l.name == lname ) !== "undefined", true, subTest, "Issue label names missing" + lname );        
    subTest = tu.checkEq( issue.state, config.GH_ISSUE_OPEN,                   subTest, "Issue state" ); 

    // CHECK github location.
    // If this fails, check notification arrival distance.  if too long, break out and let this be a subtest failure before checking tCard guts
    // console.log( "XXXX OI?", td.unclaimCID );
    let cards = td.unclaimCID == config.EMPTY ? [] : await cardsU;
    let tCard = cards.filter((card) => card.hasOwnProperty( "issueNum" ) ? card.issueNum == issDat[1].toString() : false );

    // console.log( td.unclaimCID, tCard[0] );
    // for( let i = 0; i < cards.length; i++ ) {
    // console.log( cards[i].title, cards[i].issueNum, cards[i].cardId );
    // }
    
    subTest = tu.checkEq( typeof tCard === 'undefined', false,       subTest, "No unclaimed" );
    subTest = tu.checkEq( tCard.length, 1,                           subTest, "No unclaimed" );
    if( typeof tCard !== 'undefined' && tCard.length >= 1 ) {
	subTest = tu.checkEq( tCard[0].cardId, card.cardId,       subTest, "Card id" );
    }
    
    // CHECK linkage
    let links  = await linksP;
    let link   = ( links.filter((link) => link.hostIssueId == issDat[0] ))[0];
    subTest = tu.checkEq( link.hostIssueNum, issDat[1].toString(), subTest, "Linkage Issue num" );
    subTest = tu.checkEq( link.hostCardId, card.cardId,               subTest, "Linkage Card Id" );
    subTest = tu.checkEq( link.hostColumnName, loc.colName,           subTest, "Linkage Col name" );
    subTest = tu.checkEq( link.hostIssueName, issDat[3],              subTest, "Linkage Card Title" );
    subTest = tu.checkEq( link.hostProjectName, loc.projName,         subTest, "Linkage Project Title" );
    subTest = tu.checkEq( link.hostColumnId, loc.colId,               subTest, "Linkage Col Id" );
    subTest = tu.checkEq( link.hostProjectId, loc.pid,                subTest, "Linkage project id" );

    // CHECK dynamo Peq
    // If peq holders fail, especially during blast, one possibility is that GH never recorded the second assignment.
    // This happened 6/29/22, 7/5  To be fair, blast is punishing - requests on same issue arrive inhumanly fast, like 10x.
    let allPeqs =  await peqsP;
    let peqs    = allPeqs.filter((peq) => peq.HostIssueId == issDat[0].toString() );
    let peq = peqs[0];
    subTest  = tu.checkEq( peqs.length, 1,                        subTest, "Peq count" );
    subTest  = tu.checkEq( typeof peq !== 'undefined', true,      subTest, "Peq count" );
    if( typeof peq === 'undefined' ) { return await tu.settle( subTest, testStatus, checkUnclaimedIssue, authData, testLinks, td, loc, issDat, card, testStatus, specials ); }
    subTest = tu.checkEq( peq.PeqType, loc.peqType,               subTest, "peq type invalid" );        
    subTest = tu.checkEq( peq.HostProjectSub.length, loc.projSub.length, subTest, "peq project sub len invalid" );
    subTest = tu.checkEq( peq.HostIssueTitle, issDat[3],          subTest, "peq title is wrong" );
    subTest = tu.checkEq( peq.CEHolderId.length, 0,               subTest, "peq ce holders wrong" );    
    subTest = tu.checkEq( peq.CEGrantorId, config.EMPTY,          subTest, "peq grantor wrong" );      
    subTest = tu.checkEq( peq.Amount, lval,                       subTest, "peq amount" );
    subTest = tu.checkEq( peq.HostProjectSub[0], loc.projSub[0],  subTest, "peq project sub 0 invalid" );
    subTest = tu.checkEq( peq.Active, "true",                     subTest, "peq" );
    subTest = tu.checkEq( peq.HostRepoId, link.hostRepoId,        subTest, "peq repo id bad" );

    let holderMatch = peq.HostHolderId.length == assignees.length;

    // It is also possible 12/15/23, 7/1/24 that the test is too stringent even if GH succeeds.  From utils:recordpeqdata:
    //     PNP sets GHAssignees based on call to GH.  This means we MAY have assignees, or not, upon first
    //     creation of AWS PEQ, depending on if assignment occured in GH before peq label notification processing completes.
    //     soft = skip.
    
    subTest = tu.checkEq( holderMatch || soft, true, subTest, "peq holders wrong" );      

    for( const assignee of assignees ) {
	if( !peq.HostHolderId.includes( assignee ) ) { console.log( "Assignees don't match, but test is on soft:", peq.HostHolderId, assignee ); }
	if( !soft ) { subTest = tu.checkEq( peq.HostHolderId.includes( assignee ), true, subTest, "peq holder bad" ); }
    }
    
    // CHECK dynamo Pact
    let allPacts  = await pactsP;
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    subTest = tu.checkGE( pacts.length, 1,                         subTest, "PAct count" );  

    // This can get out of date quickly.  Only check this if early on, before lots of moving (which PEQ doesn't keep up with)
    if( pacts.length <= 3 && loc.projSub.length > 1 ) {
	const pip = [ config.PROJ_COLS[config.PROJ_PEND], config.PROJ_COLS[config.PROJ_ACCR], config.GH_NO_STATUS ];
	if( !pip.includes( loc.projSub[1] ) && peq.HostProjectSub[1] != config.GH_NO_STATUS ) { 
	    subTest = tu.checkEq( peq.HostProjectSub[1], loc.projSub[1], subTest, "peq project sub 1 invalid" );
	}
    }
    
    // Could have been many operations on this.
    for( const pact of pacts ) {
	let hr     = await tu.hasRaw( authData, pact.PEQActionId );
	subTest = tu.checkEq( hr, true,                            subTest, "PAct Raw match" ); 
	subTest = tu.checkEq( pact.HostUserId, td.actorId,         subTest, "PAct user name" ); 
	subTest = tu.checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
	subTest = tu.checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
    }

    return await tu.settle( subTest, testStatus, checkUnclaimedIssue, authData, testLinks, td, loc, issDat, card, testStatus, specials );
}


// Check last PAct
async function checkNewlyClosedIssue( authData, testLinks, td, loc, issDat, card, testStatus, specials ) {

    if( typeof specials === 'undefined' ) { specials = {}; }
    if( !specials.state ) { specials.state = config.GH_ISSUE_CLOSED; }

    testStatus = await checkSituatedIssue( authData, testLinks, td, loc, issDat, card, testStatus, specials );
    let subTest = [ 0, 0, []];

    console.log( "Check Closed issue", loc.projName, loc.colName );

    // Start promises
    let peqsP  = awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId });
    let pactsP = awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    
    const allPeqs =  await peqsP;
    const peqs = allPeqs.filter((peq) => peq.HostIssueId == issDat[0].toString() );
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

    return await tu.settle( subTest, testStatus, checkNewlyClosedIssue, authData, testLinks, td, loc, issDat, card, testStatus, specials );
}

// Check last PAct
async function checkNewlyOpenedIssue( authData, testLinks, td, loc, issDat, card, testStatus, specials ) {

    if( typeof specials === 'undefined' ) { specials = {}; }
    if( !specials.state ) { specials.state = config.GH_ISSUE_OPEN; }

    testStatus = await checkSituatedIssue( authData, testLinks, td, loc, issDat, card, testStatus, specials );

    let subTest = [ 0, 0, []];

    console.log( "Check Opened issue", loc.projName, loc.colName );

    // Start promises
    let peqsP  = awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId });
    let pactsP = awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    
    const allPeqs = await peqsP;
    const peqs = allPeqs.filter((peq) => peq.HostIssueId == issDat[0].toString() );
    const peq = peqs[0];

    // CHECK dynamo Pact
    const allPacts = await pactsP;
    let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
    pacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    const pact = pacts[ pacts.length - 1];
    subTest = tu.checkEq( pact.Verb, config.PACTVERB_REJ,               subTest, "PAct Verb"); 
    subTest = tu.checkEq( pact.Action, config.PACTACT_ACCR,             subTest, "PAct Action"); 

    return await tu.settle( subTest, testStatus, checkNewlyOpenedIssue, authData, testLinks, td, loc, issDat, card, testStatus, specials );
}



async function checkNewlySituatedIssue( authData, testLinks, td, loc, issDat, card, testStatus, specials ) {

    if( typeof specials === 'undefined' ) { specials = {}; }
    if( !specials.hasOwnProperty( "state" ) ) { specials.state = config.GH_ISSUE_OPEN; }

    testStatus = await checkSituatedIssue( authData, testLinks, td, loc, issDat, card, testStatus, specials );

    console.log( "Check newly situated issue", loc.projName, loc.colName );
    let subTest = [ 0, 0, []];
    
    // Start promises
    let peqsP  = awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId });
    let pactsP = awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    
    // CHECK dynamo Peq
    let allPeqs =  await peqsP;
    subTest = tu.checkEq( allPeqs != -1, true,                     subTest, "No peqs" );
    if( allPeqs != -1 ) {
	let peqs = allPeqs.filter((peq) => peq.HostIssueId == issDat[0].toString() );
	subTest = tu.checkEq( peqs.length, 1,                          subTest, "Peq count" );
	let peq = peqs[0];
	subTest = tu.checkEq( peq.PeqType, loc.peqType,                subTest, "peq type invalid" );       
	subTest = tu.checkEq( peq.HostProjectSub.length, loc.projSub.length, subTest, "peq project sub invalid" );
	subTest = tu.checkEq( peq.HostIssueTitle, issDat[3],           subTest, "peq title is wrong" );
	subTest = tu.checkEq( peq.HostHolderId.length, 0,              subTest, "peq holders wrong" );
	subTest = tu.checkEq( peq.CEHolderId.length, 0,                subTest, "peq holders wrong" );
	subTest = tu.checkEq( peq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );
	subTest = tu.checkEq( peq.HostProjectSub[0], loc.projSub[0],   subTest, "peq project sub invalid" );
	if( loc.projSub.length > 1 ) {
	    // NS is valid, allow for it here
	    let foundPsub = ( peq.HostProjectSub[1] == loc.projSub[1] ) || ( peq.HostProjectSub[1] == config.GH_NO_STATUS ); 
	    subTest = tu.checkEq( foundPsub, true,                    subTest, "peq project sub invalid" );
	}
	subTest = tu.checkEq( peq.HostRepoId, td.ghRepoId,            subTest, "peq RID bad" );
	subTest = tu.checkEq( peq.Active, "true",                     subTest, "peq" );
	
	// CHECK dynamo Pact
	// label carded issue?  1 pact.  attach labeled issue to proj col?  2 pact.
	// Could be any number.  add (unclaimed).  change (assign) x n.  relocate (peqify)
	// Note.  Can arrive in dynamo out of order - no awaiting for most PActs
	let allPacts = await pactsP;
	let pacts = allPacts.filter((pact) => pact.Subject[0] == peq.PEQId );
	subTest = tu.checkGE( pacts.length, 1,                         subTest, "PAct count" );         
	
	// Verify number of adds == relos.  Don't count on order of arrival.
	let addUncl  = 0;
	let relUncl  = 0;
	for( const pact of pacts ) {
	    let hr     = await tu.hasRaw( authData, pact.PEQActionId );
	    subTest = tu.checkEq( hr, true,                            subTest, "PAct Raw match" ); 
	    subTest = tu.checkEq( pact.Verb, config.PACTVERB_CONF,         subTest, "PAct Verb"); 
	    subTest = tu.checkEq( pact.HostUserId, td.actorId,             subTest, "PAct user name" ); 
	    subTest = tu.checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
	    subTest = tu.checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
	    addUncl = addUncl + ( pact.Action == config.PACT_ADD  ? 1 : 0 ); 
	    relUncl = relUncl + ( pact.Action == config.PACT_RELO ? 1 : 0 ); 
	}
	subTest = tu.checkEq( addUncl, relUncl,          subTest, "PAct Action counts"); 
    }
    return await tu.settle( subTest, testStatus, checkNewlySituatedIssue, authData, testLinks, td, loc, issDat, card, testStatus, specials );
}

async function checkNewlyAccruedIssue( authData, testLinks, td, loc, issDat, card, testStatus, specials ) {

    let assignCnt    = typeof specials !== 'undefined' && specials.hasOwnProperty( "preAssign" )       ? specials.preAssign : 0;

    testStatus = await checkSituatedIssue( authData, testLinks, td, loc, issDat, card, testStatus, specials );

    console.log( "Check newly accrued issue", loc.projName, loc.colName );
    let subTest = [ 0, 0, []];

    // CHECK dynamo Peq
    let allPeqs =  await awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId });
    let peqs = allPeqs.filter((peq) => peq.HostIssueId == issDat[0].toString() );
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
		pact.Note   == config.PACTNOTE_ADDA ) {
		foundAssignment = true;
		break;
	    }
	}
    }
    
    subTest = tu.checkEq( foundAssignment, true,      subTest, "peq holders wrong" );
    
    return await tu.settle( subTest, testStatus, checkNewlyAccruedIssue, authData, testLinks, td, loc, issDat, card, testStatus, specials );
}


// XXX still in use?
// Accrued in !unclaimed just removed.  Check landing in unclaimed, which depends on source (delete card, delete issue)
// construct data from new issue and new card as needed.
async function checkUnclaimedAccr( authData, testLinks, td, loc, issDatOld, issDatNew, cardNew, testStatus, source ) {

    // Don't check peq projectID for card delete.  Issue is old issue, peq is behind.  Pact knows all.  
    let skip = source == "card" ? true : false; 
    if( source == "card" ) { assert( issDatOld[0] == issDatNew[0] ); }

    testStatus = await checkSituatedIssue( authData, testLinks, td, loc, issDatNew, cardNew, testStatus, { "skipPeqPID": skip });

    console.log( "Check unclaimed accrued issue", loc.projName, loc.colName, issDatOld, source );
    let subTest = [ 0, 0, []];
    
    // CHECK dynamo Peq
    let allPeqs =  await awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId });
    let peqs = allPeqs.filter((peq) => peq.HostIssueId == issDatNew[0].toString() );
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
	peqs = allPeqs.filter((peq) => peq.HostIssueId == issDatOld[0].toString() );
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
	subTest = tu.checkEq( pact.Note, config.PACTNOTE_RECR,     subTest, "PAct Note"); 
    }

    return await tu.settle( subTest, testStatus, checkUnclaimedAccr, authData, testLinks, td, loc, issDatOld, issDatNew, cardNew, testStatus, source );
}


async function checkNewbornCard( authData, testLinks, td, loc, cardId, title, testStatus ) {

    console.log( "Check Newborn Card", title, cardId );
    let subTest = [ 0, 0, []];
    
    // CHECK github issue
    // no need, get content link below
    
    // CHECK github card
    let cards  = await getCards( authData, td.ghRepoId, loc.pid, loc.colId );
    let card   = cards.find( card => card.cardId == cardId );
    let foundCard = ( typeof card !== 'undefined' );
    subTest = tu.checkEq( foundCard, true,                             subTest, "no card yet" );
    
    if( foundCard ) {
	const cardTitle = card.title.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
	let goodCard = utils.validField( card, "issueNum" ) && card.issueNum != -1;
	subTest = tu.checkEq( goodCard, false,                             subTest, "Newbie has content" );
	subTest = tu.checkEq( cardTitle, title,                            subTest, "Newbie title" );
	
	// CHECK linkage
	let links  = await tu.getLinks( authData, testLinks, { "ceProjId": td.ceProjectId, "repo": td.ghFullName } );
	subTest = tu.checkEq( links != -1, true,                          subTest, "Links fail for " + td.ghFullName );
	if( links != -1 ) {
	    let link   = links.find( l => l.hostCardId == cardId );
	    subTest = tu.checkEq( typeof link, "undefined",                    subTest, "Newbie link exists" );
	}
	
	// CHECK dynamo Peq.  inactive, if it exists
	// Risky test - will fail if unrelated peqs with same title exist
	let peqs = await awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId, "HostIssueTitle": title });
	subTest = tu.checkEq( peqs, -1,                                    subTest, "Newbie peq exists" );
	
	// CHECK dynamo Pact.. nothing to do here for newborn
    }

    return await tu.settle( subTest, testStatus, checkNewbornCard, authData, testLinks, td, loc, cardId, title, testStatus );
}

async function checkNewbornIssue( authData, testLinks, td, issDat, testStatus, specials ) {

    console.log( "Check Newborn Issue", issDat);
    let subTest = [ 0, 0, []];

    let labelCnt     = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )     ? specials.lblCount     : 0;
    
    // CHECK github issue
    let issue  = await findIssue( authData, issDat[0] );
    subTest = tu.checkEq( issue.id, issDat[0].toString(),     subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.number, issDat[1].toString(), subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.title, issDat[3],             subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.labels.length, labelCnt,         subTest, "Issue label" );

    // CHECK github card
    // no need, get content link below
    
    // CHECK linkage
    let links  = await tu.getLinks( authData, testLinks, { "ceProjId": td.ceProjectId, "repo": td.ghFullName } );
    let link   = links != -1 ? links.find( l => l.hostIssueId == issDat[0].toString() ) : [].find( l => true );
    subTest = tu.checkEq( typeof link, "undefined",                    subTest, "Newbie link exists" );

    // CHECK dynamo Peq.  inactive, if it exists
    let peqs = await awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId, "HostIssueId": issDat[0] });
    if( peqs !== -1 ) {
	let peq = peqs.find(peq => peq.HostIssueId == issDat[0].toString() );
	subTest = tu.checkEq( peq.Active, "false",                  subTest, "peq should be inactive" );
	subTest = tu.checkEq( peq.HostIssueTitle, issDat[3],       subTest, "peq title is wrong" );
	subTest = tu.checkEq( peq.CEGrantorId, config.EMPTY,        subTest, "peq grantor wrong" );
    }

    // CHECK dynamo Pact.. nothing to do here for newborn

    return await tu.settle( subTest, testStatus, checkNewbornIssue, authData, testLinks, td, issDat, testStatus, specials );
}

// origVal is peq label value before split.  New labels will be 1/2.  orig peq.amount will not change.  new peq amount will be 1/2.
// opVal   is original peq.amount.  If split peq, then split it again, peq.amount is 4x the label, until ceFlutter ingest.
async function checkSplit( authData, testLinks, td, issDat, origLoc, newLoc, origVal, opVal, testStatus, specials ) {
    let situated   = typeof specials !== 'undefined' && specials.hasOwnProperty( "peq" )        ? specials.peq        : false;
    let labelCnt   = typeof specials !== 'undefined' && specials.hasOwnProperty( "lblCount" )   ? specials.lblCount   : 1;
    let assignCnt  = typeof specials !== 'undefined' && specials.hasOwnProperty( "assignees" )  ? specials.assignees  : 1;
    let checkPeq   = typeof specials !== 'undefined' && specials.hasOwnProperty( "checkPeq" )   ? specials.checkPeq   : false;
    let rejected   = typeof specials !== 'undefined' && specials.hasOwnProperty( "rejected" )   ? specials.rejected   : false;

    console.log( "Check Split", issDat[3], origLoc.colName, newLoc.colName, situated.toString(), labelCnt.toString(), assignCnt.toString() );
    let subTest = [ 0, 0, []];
    
    // Get new issue
    let issues   = await getIssues( authData, td );
    let issue    = await findIssue( authData, issDat[0] );

    let splitIssues = issues.filter( issue => issue.title.includes( issDat[3] + " split" ));
    subTest = tu.checkGE( splitIssues.length, 1, subTest, "split iss trouble" );

    if( splitIssues.length > 0 ) {
	let cards = await getCards( authData, td.ghRepoId, newLoc.pid, newLoc.colId );
	if( cards === -1 ) { cards = []; }
	subTest = tu.checkGE( cards.length, 1, subTest, "split has nothing in newLoc" );
    
	// Some tests will have two split issues here.  The newly split issue has a larger issNum
	const splitIss = splitIssues.reduce( ( a, b ) => { return a.number > b.number  ? a : b } );
	const splitDat = [ splitIss.id.toString(), splitIss.number.toString(), -1, splitIss.title ];
	
	// console.log( "Split..", cards, newLoc, splitIssues.length, splitIss, splitDat );

	// Get cards
	let allLinks  = await tu.getLinks( authData, testLinks, { "ceProjId": td.ceProjectId, repo: td.ghFullName });
	let issLink   = allLinks.find( l => l.hostIssueId == issDat[0].toString() );
	let splitLink = allLinks.find( l => l.hostIssueId == splitDat[0].toString() );
	
	if( typeof issLink   === 'undefined' || typeof splitLink === 'undefined' ) { console.log( allLinks ); console.log( issDat ); console.log( splitDat ); }
	
	subTest = tu.checkEq( typeof issLink   !== 'undefined', true, subTest, "issLink trouble" );
	subTest = tu.checkEq( typeof splitLink !== 'undefined', true, subTest, "splitLink trouble" );

	if( typeof issLink !== 'undefined' && typeof splitLink !== 'undefined' ) {
	    const card      = await getCard( authData, issLink.hostCardId );
	    const splitCard = await getCard( authData, splitLink.hostCardId );
	    splitDat[2]     = splitCard.cardId;

	    let newLocIds = cards.map( c => c.cardId );
	    if( !newLocIds.includes( splitCard.cardId ) ) {
		console.log( "splitDat", splitDat, "splitLink", splitLink, "splitCard", splitCard, "cards", cards, "cardIds", newLocIds );
	    }
	    subTest = tu.checkEq( newLocIds.includes( splitCard.cardId ), true, subTest, "split loc does not have split card" );

	    
	    // NOTE: orig issue will not adjust initial peq value.  new issue will be set with new value.  label is up to date tho.
	    // NOTE: Orig issue will depend on future assign to add assignee.  the split relies on this first plug for assignees since followon notification is bot-sent
	    if( situated ) {
		let lval = origVal / 2;
		subTest = await checkSituatedIssue( authData, testLinks, td, origLoc, issDat,   card,      subTest, {opVal: opVal, label: lval, lblCount: labelCnt} );
		let splitSpecials = checkPeq ? {label: lval, lblCount: labelCnt, assign: assignCnt, rejected: rejected } : {label: lval, lblCount: labelCnt, rejected: rejected }; 
		subTest = await checkSituatedIssue( authData, testLinks, td, newLoc,  splitDat, splitCard, subTest, splitSpecials );
	    }
	    else {
		subTest = await checkUntrackedIssue( authData, testLinks, td, origLoc, issDat,   card,      subTest, {lblCount: labelCnt } );
		subTest = await checkUntrackedIssue( authData, testLinks, td, newLoc,  splitDat, splitCard, subTest, {lblCount: labelCnt } );
	    }
	    // Bad test.  Can split plan into pend as a proposal. Will have different state.
	    // subTest = tu.checkEq( issue.state, splitIss.state,    subTest, "Issues have different state" );
	    
	    // check assign
	    subTest = tu.checkEq( issue.assignees.length, assignCnt,    subTest, "Issue assignee count" );
	    subTest = tu.checkEq( splitIss.assignees.length, assignCnt, subTest, "Issue assignee count" );
	
	    // Check comment on splitIss
	    const comments = await getComments( authData, splitDat[0] );
	    subTest = tu.checkEq( typeof comments !== 'undefined',                      true,   subTest, "Comment not yet ready" );
	    subTest = tu.checkEq( typeof comments[0] !== 'undefined',                   true,   subTest, "Comment not yet ready" );
	    if( typeof comments !== 'undefined' && typeof comments[0] !== 'undefined' ) {
		subTest = tu.checkEq( comments[0].body.includes( "CodeEquity duplicated" ), true,   subTest, "Comment bad" );
	    }
	}
    }
    
    return await tu.settle( subTest, testStatus, checkSplit, authData, testLinks, td, issDat, origLoc, newLoc, origVal, opVal, testStatus, specials );
}

function splitHelper( issues, title ) {
    let splitIssues = issues.filter( issue => issue.title.includes( title + " split" ));
    let retVal = typeof splitIssues === 'undefined' ? false : splitIssues;
    return retVal;
}


async function checkNoSplit( authData, testLinks, td, issDat, newLoc, cardId, testStatus ) {
    
    console.log( "Check No Split", issDat[3], newLoc.colName );
    let subTest = [ 0, 0, []];
    
    const splitName = issDat[3] + " split";
    
    // Check issue
    let issues   = await getIssues( authData, td );
    let splitIss = issues.find( issue => issue.title.includes( splitName ));
				
    subTest = tu.checkEq( typeof splitIss === 'undefined', true, subTest, "Split issue should not exist" );

    // Check links
    let links  = await tu.getLinks( authData, testLinks, { "ceProjId": td.ceProjectId, "repo": td.ghFullName } );
    let flinks = ( links.filter((link) => link.hostIssueId == issDat[0] ));
    if( flinks.length > 1 ) { console.log( "Flinks", flinks, link, issDat ); }
    subTest = tu.checkLE( flinks.length, 1, subTest, "Split issue should not exist, too many links" );
    
    // Check card
    let colCards = await getCards( authData, td.ghRepoId, newLoc.pid, newLoc.colId );
    let noCard = true;
    if( colCards !== -1 ) {
	const card = colCards.find( c => c.title && c.title.includes( splitName ));
	if( typeof card !== 'undefined' ) { noCard = false; }
    }
    subTest = tu.checkEq( noCard, true,                  subTest, "Split card should not exist" );

    // Check peq
    let allPeqs =  await awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId });
    let peq = allPeqs.find( peq => peq.HostIssueTitle.includes( splitName ));
    subTest = tu.checkEq( typeof peq === 'undefined', true,   subTest, "Peq should not exist" );

    // Linkage, id search.
    subTest = await checkNoCard( authData, testLinks, td, newLoc, cardId, issDat[3], subTest, {skipAllPeq: true} );
    
    return await tu.settle( subTest, testStatus, checkNoSplit, authData, testLinks, td, issDat, newLoc, cardId, testStatus );
}

async function checkNoCard( authData, testLinks, td, loc, cardId, title, testStatus, specials ) {
    console.log( "Check No Card", title, cardId );
    let subTest = [ 0, 0, []];    

    // default is -1 peq
    // Send skipAll if peq exists, is active, and checked elsewhere.
    // send checkpeq if peq is inactive.
    let checkPeq   = typeof specials !== 'undefined' && specials.hasOwnProperty( "peq" )        ? specials.peq     : false;    
    let skipAllPeq = typeof specials !== 'undefined' && specials.hasOwnProperty( "skipAllPeq" ) ? specials.skipAllPeq : false;    

    // CHECK github card
    let cards  = await getCards( authData, td.ghRepoId, loc.pid, loc.colId );
    if( cards !== -1 ) { 
	let card   = cards.find( card => card.cardId == cardId );
	if( typeof card === "undefined") { console.log( "Card", title, cardId, "was rightfully deleted or moved this time." ); }
	else                             { console.log( "XXX ERROR.  Card", title, cardId, "was wrongfully NOT deleted this time." ); }
    }
    
    // CHECK linkage
    let links  = await tu.getLinks( authData, testLinks, { "ceProjId": td.ceProjectId, "repo": td.ghFullName } );
    let link   = links.find( l => l.hostCardId == cardId.toString() );
    subTest = tu.checkEq( typeof link === "undefined", true,            subTest, "Link should not exist" );

    // CHECK dynamo Peq.  inactive, if it exists
    if( !skipAllPeq ) {
	// Risky test - will fail if unrelated peqs with same title exist
	// No card may have inactive peq
	let peqs = await awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId, "HostIssueTitle": title });
	if( checkPeq ) {
	    let peq = peqs[0];
	    subTest = tu.checkEq( peq.Active, "false",                  subTest, "peq should be inactive" );
	    subTest = tu.checkEq( peq.HostIssueTitle, title,            subTest, "peq title is wrong" );
	    subTest = tu.checkEq( peq.CEGrantorId, config.EMPTY,        subTest, "peq grantor wrong" );
	}
	else {
	    subTest = tu.checkEq( peqs, -1,                             subTest, "Peq should not exist" );
	}
    }

    return await tu.settle( subTest, testStatus, checkNoCard, authData, testLinks, td, loc, cardId, title, testStatus, specials );
}

async function checkPact( authData, testLinks, td, title, verb, action, note, testStatus, specials ) {
    console.log( "Check PAct", td.ceProjectId, verb, action, note );
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
	let peqs = await awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId, "HostIssueTitle": title });
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
	    /*
	    console.log( i, depth, foundPAct );
	    console.log( " ..", "[", verb, pact.Verb, "]" );
	    console.log( " ..", "[", action, pact.Action, "]" );
	    console.log( " ..", "[", note, pact.Note, "]" );
	    console.log( " ..", "[", subject, pact.Subject, "]" );
	    */

	    if( foundPAct ) { break; }
	}
    }

    subTest = tu.checkEq( foundPAct, true,                     subTest, "pact bad " + subject.toString() );

    if( !foundPAct ) {
	console.log( "Pact bad?  darg.  ", depth, pacts.length, subject.toString() );
	for( let i = pacts.length - depth; i < pacts.length; i++ ) {
	    const pact = pacts[i];
	    console.log( i, pact );
	}
    }

    return await tu.settle( subTest, testStatus, checkPact, authData, testLinks, td, title, verb, action, note, testStatus, specials );
}

async function checkNoIssue( authData, testLinks, td, issDat, testStatus ) {

    console.log( "Check No Issue", issDat );
    let subTest = [ 0, 0, []];

    // CHECK github issue
    let issue  = await findIssue( authData, issDat[0] );
    subTest = tu.checkEq( issue, -1,                               subTest, "Issue should not exist" );

    // CHECK linkage
    let links  = await tu.getLinks( authData, testLinks, { "ceProjId": td.ceProjectId, "repo": td.ghFullName } );
    let link   = links.find( l => l.hostIssueId == issDat[0] );
    subTest = tu.checkEq( typeof link, "undefined",                subTest, "Link should not exist" );

    return await tu.settle( subTest, testStatus, checkNoIssue, authData, testLinks, td, issDat, testStatus );
}


async function checkAssignees( authData, td, assigns, issDat, testStatus ) {
    console.log( "Check assignees" );
    let subTest = [ 0, 0, []];

    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    
    // CHECK github issues
    let issue  = await findIssue( authData, issDat[0] );
    subTest = tu.checkEq( issue.id, issDat[0].toString(),      subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.number, issDat[1].toString(),  subTest, "Github issue troubles" );
    subTest = tu.checkEq( issue.assignees.length, assigns.length, subTest, "Issue assignee count" );
    if( issue.assignees.length == assigns.length ) {
	for( let i = 0; i < assigns.length; i++ ) {
	    subTest = tu.checkEq( assigns.includes( issue.assignees[i].login ), true, subTest, "extra assignee " + issue.assignees[i].login );
	}
    }

    // CHECK Dynamo PEQ
    // Should be no change
    let peqs =  await awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId });
    let meltPeqs = peqs.filter((peq) => peq.HostIssueId == issDat[0].toString() );
    subTest = tu.checkEq( meltPeqs.length, 1,                          subTest, "Peq count" );
    let meltPeq = meltPeqs[0];
    subTest = tu.checkEq( meltPeq.PeqType, config.PEQTYPE_PLAN,        subTest, "peq type invalid" );
    subTest = tu.checkEq( meltPeq.HostProjectSub.length, 2,            subTest, "peq project sub invalid" );
    subTest = tu.checkEq( meltPeq.HostIssueTitle, issDat[3],           subTest, "peq title is wrong" );
    subTest = tu.checkEq( meltPeq.HostHolderId.length, 0,              subTest, "peq holders wrong" );
    subTest = tu.checkEq( meltPeq.CEHolderId.length, 0,                subTest, "peq ceholders wrong" );
    subTest = tu.checkEq( meltPeq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );
    subTest = tu.checkEq( meltPeq.Amount, 1000,                        subTest, "peq amount" );
    subTest = tu.checkEq( meltPeq.HostProjectSub[0], td.dataSecTitle,  subTest, "peq project sub invalid" );
    subTest = tu.checkEq( meltPeq.HostRepoId, td.ghRepoId,             subTest, "peq unclaimed Repo bad" );
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
	subTest = tu.checkEq( pact.HostUserId, td.actorId,             subTest, "PAct user name" ); 
	subTest = tu.checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
	subTest = tu.checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
    }

    return await tu.settle( subTest, testStatus, checkAssignees, authData, td, assigns, issDat, testStatus );
}

async function checkNoAssignees( authData, td, ass1, ass2, issDat, testStatus ) {
    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    let subTest = [ 0, 0, []];
    
    // CHECK github issues
    let meltIssue = await findIssue( authData, issDat[0] );
    subTest = tu.checkEq( meltIssue.id, issDat[0].toString(),     subTest, "Github issue troubles" );
    subTest = tu.checkEq( meltIssue.number, issDat[1].toString(), subTest, "Github issue troubles" );
    subTest = tu.checkEq( meltIssue.assignees.length, 0,             subTest, "Issue assignee count" );

    // CHECK Dynamo PEQ
    // Should be no change
    let peqs =  await awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId });
    let meltPeqs = peqs.filter((peq) => peq.HostIssueId == issDat[0] );
    subTest = tu.checkEq( meltPeqs.length, 1,                          subTest, "Peq count" );
    let meltPeq = meltPeqs[0];
    subTest = tu.checkEq( meltPeq.PeqType, config.PEQTYPE_PLAN,        subTest, "peq type invalid" );
    subTest = tu.checkEq( meltPeq.HostProjectSub.length, 2,              subTest, "peq project sub invalid" );
    subTest = tu.checkEq( meltPeq.HostIssueTitle, issDat[3],          subTest, "peq title is wrong" );
    subTest = tu.checkEq( meltPeq.HostHolderId.length, 0,                subTest, "peq holders wrong" );
    subTest = tu.checkEq( meltPeq.CEHolderId.length, 0,                subTest, "peq holders wrong" );
    subTest = tu.checkEq( meltPeq.CEGrantorId, config.EMPTY,           subTest, "peq grantor wrong" );
    subTest = tu.checkEq( meltPeq.Amount, 1000,                        subTest, "peq amount" );
    subTest = tu.checkEq( meltPeq.HostProjectSub[0], td.dataSecTitle,    subTest, "peq project sub invalid" );
    subTest = tu.checkEq( meltPeq.HostRepoId, td.ghRepoId,             subTest, "peq unclaimed RID bad" );
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
	subTest = tu.checkEq( pact.HostUserId, td.actorId,             subTest, "PAct user name" ); 
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

    return await tu.settle( subTest, testStatus, checkNoAssignees, authData, td, ass1, ass2, issDat, testStatus );
}

async function checkProgAssignees( authData, td, ass1, ass2, issDat, testStatus ) {
    let plan = config.PROJ_COLS[config.PROJ_PLAN];
    let subTest = [ 0, 0, []];

    // CHECK github issues
    let meltIssue = await findIssue( authData, issDat[0] );
    subTest = tu.checkEq( meltIssue.id, issDat[0].toString(),     subTest, "Github issue troubles" );
    subTest = tu.checkEq( meltIssue.number, issDat[1].toString(), subTest, "Github issue troubles" );
    subTest = tu.checkEq( meltIssue.assignees.length, 2,             subTest, "Issue assignee count" );

    // CHECK Dynamo PEQ  .. no change already verified
    let peqs =  await awsUtils.getPEQs( authData, { "CEProjectId": td.ceProjectId });
    let meltPeqs = peqs.filter((peq) => peq.HostIssueId == issDat[0] );
    subTest = tu.checkEq( meltPeqs.length, 1, subTest, "Peq count" );
    let meltPeq = meltPeqs[0];
    
    // CHECK Dynamo PAct
    // Check new relevant actions
    let pacts = await awsUtils.getPActs( authData, { "CEProjectId": td.ceProjectId });
    let meltPacts = pacts.filter((pact) => pact.Subject[0] == meltPeq.PEQId );
    subTest = tu.checkGE( meltPacts.length, 8, subTest, "PAct count" );
    
    meltPacts.sort( (a, b) => parseInt( a.TimeStamp ) - parseInt( b.TimeStamp ) );
    // earlier 5 verified: add peq, add assignees, rem assignees
    let foundAdd1 = false;
    let foundAdd2 = false;
    let foundRelo = false;
    let foundAss1 = false;
    let foundAss2 = false;
    for( const pact of meltPacts.slice(-3) ) {
	let hr     = await tu.hasRaw( authData, pact.PEQActionId );
	subTest = tu.checkEq( hr, true,                                subTest, "PAct Raw match" ); 
	subTest = tu.checkEq( pact.Verb, config.PACTVERB_CONF,         subTest, "PAct Verb"); 
	subTest = tu.checkEq( pact.HostUserId, td.actorId,             subTest, "PAct user name" ); 
	subTest = tu.checkEq( pact.Ingested, "false",                  subTest, "PAct ingested" );
	subTest = tu.checkEq( pact.Locked, "false",                    subTest, "PAct locked" );
	if( pact.Action == config.PACTACT_RELO ) { foundRelo = true; }
	else if( pact.Action == config.PACTACT_CHAN ) {
	    if( foundAdd1 ) { foundAdd2 = true; }
	    else            { foundAdd1 = true; }

	    if     ( pact.Subject[1] == ass1 ) { foundAss1 = true; }
	    else if( pact.Subject[1] == ass2 ) { foundAss2 = true; }

	    subTest = tu.checkEq( pact.Note, config.PACTNOTE_ADDA,     subTest, "PAct note"); 	    
	}
    }
    if(!(foundAdd1 && foundAdd2 && foundRelo )) { console.log( "missing pact", foundAdd1, foundAdd2, foundRelo ); }
    if(!(foundAss1 && foundAss2 ))              { console.log( "missing assignee", foundAss1, foundAss2, ass1, ass2 ); }

    subTest = tu.checkEq( foundAdd1 && foundAdd2 && foundRelo, true,  subTest, "PAct Act" );
    subTest = tu.checkEq( foundAss1 && foundAss2, true,               subTest, "PAct Act" );

    return await tu.settle( subTest, testStatus, checkProgAssignees, authData, td, ass1, ass2, issDat, testStatus );
}

// peq labels convert thousands, millions to k, m for human legibility
function convertName( name ) {
    const peqValue = ghUtils.parseLabelName( name );
    if( peqValue > 0 ) { name = ghV2.makeHumanLabel( peqValue, config.PEQ_LABEL ); }
    return name;
}

async function checkLabel( authData, label, name, desc, testStatus ) {

    console.log( "Checking ", name, desc );
    if( name === -1 || desc === -1 ) {
	testStatus = tu.checkEq( typeof label, 'undefined',  testStatus, "Label should not exist" );
	return testStatus;
    }

    name = convertName( name );
    
    testStatus = tu.checkEq( typeof label !== 'undefined', true, testStatus, "Label not here yet" );
    if( typeof label !== 'undefined' ) {
	testStatus = tu.checkEq( label.name, name,        testStatus, "Label name bad" );
	testStatus = tu.checkEq( label.description, desc, testStatus, "Label description bad" );
    }
    
    return testStatus;
}


export {refresh};
export {refreshRec};
export {refreshFlat};
export {refreshUnclaimed};
export {forcedRefreshUnclaimed};
export {getQuad};

export {createProjectWorkaround};
export {createDefaultProject};
export {remProject};

export {cloneFromTemplate};   // XXX speculative.  useful?
export {createCustomField};   // XXX speculative.  useful?

export {unlinkProject};
export {linkRepo};
export {unlinkRepo};
export {makeColumn};
export {createColumnTest};
export {updateProject};
export {make4xCols};
export {makeNewbornCard};
export {makeProjectCard};
export {makeIssue};
export {blastIssue};
export {transferIssue};

export {addLabel};
export {remLabel};
export {updateLabel};
export {delLabel};
export {findOrCreateLabel};
export {addAssignee};
export {remAssignee};
export {moveCard};
export {remCard};
export {closeIssue};
export {reopenIssue};
export {remIssue};
export {remDraftIssue};

export {getLabel};
export {getLabels};
export {getIssues};
export {getProjects};
export {getColumns};
export {getDraftIssues};
export {getCards};
export {getCard};
export {getComments};
export {getAssignee};
export {findIssue};
export {findIssueByName};
export {findProject};
export {findProjectByName};
export {findProjectByRepo};
export {findRepo};
export {getFlatLoc};

export {findCardForIssue};
// export {ingestPActs};

export {checkNewlyClosedIssue};
export {checkNewlyOpenedIssue};
export {checkNewlySituatedIssue};
export {checkNewlyAccruedIssue};
export {checkSituatedIssue};
export {checkDemotedIssue};
export {checkUntrackedIssue};
export {checkNewbornCard};
export {checkNewbornIssue};
export {checkSplit};
export {checkNoSplit};
export {checkUnclaimedIssue};
export {checkUnclaimedAccr};
export {checkNoCard};
export {checkPact};
export {checkNoIssue};
export {checkAssignees};
export {checkNoAssignees};
export {checkProgAssignees};
export {convertName};
export {checkLabel};
