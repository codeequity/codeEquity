var utils = require('../utils');
var ghUtils = require('../ghUtils');
var config  = require('../config');
var assert = require('assert');

var gh = ghUtils.githubUtils;

// Had to add a small sleep in each make* - GH seems to get confused if requests come in too fast


async function refresh( installClient, td ){
    if( td.masterPID != config.EMPTY ) { return; }

    await installClient[0].projects.listForRepo({ owner: td.GHOwner, repo: td.GHRepo, state: "open" })
	.then((projects) => {
	    for( const project of projects.data ) {
		if( project.name == "Master" ) { td.masterPID = project.id; }
	    }
	})
	.catch( e => { console.log( installClient[1], "list projects failed.", e ); });
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

exports.makeProject     = makeProject;
exports.makeColumn      = makeColumn;
exports.make4xCols      = make4xCols;
exports.makeAllocCard   = makeAllocCard;

exports.hasRaw          = hasRaw; 
exports.getPeqLabels    = getPeqLabels;

exports.checkEq         = checkEq;
exports.checkGE         = checkGE;
exports.checkAr         = checkAr;
exports.testReport      = testReport;
