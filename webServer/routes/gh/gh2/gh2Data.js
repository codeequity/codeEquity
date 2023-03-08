const rootLoc = "../../../";

const config  = require( rootLoc + 'config' );

const ceData  = require( '../../ceData' );
const jobData = require( '../../jobData' );

class GH2Data extends ceData.CEData{

    // Use projectV2 node ids, not databaseIds
    constructor( jd, ceProjects, ceProjectId ) {
	// XXX May need ceFlutter to assign hostProj to ceProj.
	//     when linking hostProj to repo, could do assignment to ceProj internally.

	let settings = {};

	settings.org     = jd.org;
	settings.actor   = jd.actor;
	settings.reqBody = jd.reqBody;

	super( settings );

	if( typeof ceProjectId !== 'undefined' && ceProjectId != config.EMPTY ) { this.ceProjectId = ceProjectId; }
	else                                                                    { this.ceProjectId = this.getCEProjectId( jd, ceProjects ); }

	// Specific to gh2
	this.issueNum       = -1;
    }

    static from( orig ) {
	let jd     = {};
	jd.org     = orig.org;
	jd.actor   = orig.actor;
	jd.reqBody = orig.reqBody;
	
	let newPD = new GH2Data( jd, {}, orig.ceProjectId );

	newPD.issueNum  = orig.issueNum;
	newPD.issueId   = orig.issueId;
	newPD.repoId    = orig.repoId;

	return newPD;
    }
    
    getCEProjectId( jd, ceProjects ) {

	// console.log( "getCEProjectId",  jd.reqBody );
	
	if( Object.keys(ceProjects).length == 0 ) { return config.EMPTY; }
	
	// Have to get this from pv2Notice.  If this is contentNotice, skip.
	if( typeof jd.reqBody.projects_v2_item === 'undefined' ||
	    typeof jd.reqBody.projects_v2_item.project_node_id === 'undefined' ) {
	    return config.EMPTY;
	}

	let hostProjId = jd.reqBody.projects_v2_item.project_node_id;

	let retVal = ceProjects.find( config.HOST_GH, jd.org, hostProjId );

	// XXX No point to speculatively add.
	//     push this step down until we have a peq action.
	/*
	// If did not find an entry, then we have discovered a new project.  add it to unclaimed.
	if( retVal == config.EMPTY ) {
	    console.log( "Found new Host Project: ", hostProjId );
	    console.log( "Associating this with the UnClaimed ceProject until claimed in ceFlutter." );
	    retVal = ceProjects.add(  config.HOST_GH, jd.org, hostProjId );
	}
	*/
	return retVal;
    }
    
    show() {
	super.show();
	if( this.issueNum       != -1 )           { console.log( "issueNum", this.issueNum ); }
    }
    
    updateFromLink( link ) {
	this.projectId = link.projectId; 
	this.issueNum  = link.issueNum;
    }
}

exports.GH2Data = GH2Data;
