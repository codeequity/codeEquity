const assert  = require('assert');

const rootLoc = "../../../";

const config  = require( rootLoc + 'config' );

const ceData  = require( '../../ceData' );
const jobData = require( '../../jobData' );

const ghUtils = require( rootLoc + "utils/gh/ghUtils" );

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

	let retVal = config.EMPTY; 
	if( Object.keys(ceProjects).length == 0 ) { return retVal; }
	
	// If this is content notice, get from repo
	if( !ghUtils.validField( jd.reqBody, "projects_v2_item" ) || !ghUtils.validField( jd.reqBody.projects_v2_item, "project_node_id" ) ) {
	    assert( ghUtils.validField( jd.reqBody, "repository" ));
	    // console.log( "Find by repo" );
	    retVal = ceProjects.findByRepo( config.HOST_GH, jd.org, jd.reqBody.repository.full_name ); 
	}
	else {
	    // console.log( "Find by pid" );
	    retVal = ceProjects.find( config.HOST_GH, jd.org, jd.reqBody.projects_v2_item.project_node_id );
	}

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
	this.projectId = link.hostProjectId; 
	this.issueNum  = link.hostIssueNum;
    }
}

exports.GH2Data = GH2Data;
