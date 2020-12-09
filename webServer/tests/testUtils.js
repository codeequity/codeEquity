var utils = require('../utils');
var ghUtils = require('../ghUtils');
var config  = require('../config');
var assert = require('assert');

var gh = ghUtils.githubUtils;

async function makeProject(installClient, pd, name, body ) {
    let pid = await installClient[0].projects.createForRepo({ owner: pd.GHOwner, repo: pd.GHRepo, name: name, body: body })
	.then((project) => { return  project.data.id; })
	.catch( e => { console.log( installClient[1], "Create project failed.", e ); });

    console.log( "MakeProject:", name, pid );
    return pid;
}

async function makeColumn( installClient, projId, name ) {
    
    let cid = await installClient[0].projects.createColumn({ project_id: projId, name: name })
	.then((column) => { return column.data.id; })
	.catch( e => { console.log( installClient[1], "Create column failed.", e ); });

    console.log( "MakeColumn:", name, cid );
    return cid;
}

async function make4xCols( installClient, projId ) {

    let plan = await makeColumn( installClient, projId, config.PROJ_COLS[ config.PROJ_PLAN ] );
    let prog = await makeColumn( installClient, projId, config.PROJ_COLS[ config.PROJ_PROG ] );
    let pend = await makeColumn( installClient, projId, config.PROJ_COLS[ config.PROJ_PEND ] );
    let accr = await makeColumn( installClient, projId, config.PROJ_COLS[ config.PROJ_ACCR ] );
	
    return [prog, plan, pend, accr];
}

async function makeNewbornCard( installClient, colId, note ) {
    let cid = await installClient[0].projects.createCard({ column_id: colId, note: note })
	.then((card) => { return card.data.id; })
	.catch( e => { console.log( installClient[1], "Create newborn card failed.", e ); });

    console.log( "MakeCard:", cid );
    return cid;
    
}


exports.makeProject     = makeProject;
exports.makeColumn      = makeColumn;
exports.make4xCols      = make4xCols;
exports.makeNewbornCard = makeNewbornCard;
