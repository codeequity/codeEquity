const assert  = require('assert');

const rootLoc = "../../../";

const config  = require( rootLoc + 'config' );

const ceData  = require( '../../ceData' );
const jobData = require( '../../jobData' );

const utils   = require( rootLoc + "utils/ceUtils" );
const ghUtils = require( rootLoc + "utils/gh/ghUtils" );

class GH2Data extends ceData.CEData{

    // Use projectV2 node ids, not databaseIds
    constructor( authData, jd, ceProjects, ceProjectId ) {
	// XXX May need ceFlutter to assign hostProj to ceProj.
	//     when linking hostProj to repo, could do assignment to ceProj internally.

	let settings = {};

	settings.org     = jd.org;
	settings.actor   = jd.actor;
	settings.reqBody = jd.reqBody;

	super( settings );

	// No async in constructors.  Require caller to get CEP directly if needed.
	if( typeof ceProjectId !== 'undefined' && ceProjectId != config.EMPTY ) { this.ceProjectId = ceProjectId; }
	else                                                                    { this.ceProjectId = -1; }

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
    
    async setCEProjectId( authData, jd, ceProjects ) {
	
	// console.log( "getCEProjectId",  jd.reqBody );

	let retVal = config.EMPTY; 
	if( Object.keys(ceProjects).length == 0 ) { return retVal; }
	
	// If this is content notice, get from repo
	if( !utils.validField( jd.reqBody, "projects_v2_item" ) || !utils.validField( jd.reqBody.projects_v2_item, "project_node_id" ) ) {
	    assert( utils.validField( jd.reqBody, "repository" ));
	    // console.log( "Find by repo" );
	    retVal = ceProjects.findByRepo( config.HOST_GH, jd.org, jd.reqBody.repository.full_name ); 
	}
	else {
	    if( jd.reqBody.projects_v2_item.content_type != "Issue" ) {
		console.log( "gh2Data object created for item that is not an issue.  No need to set ceProjectId" );
		return;
	    }
	    let issueId = jd.reqBody.projects_v2_item.content_node_id;
	    if( !utils.validField( jd.reqBody.projects_v2_item, "content_node_id" ) ) { console.log( jd.reqBody ); }
	    assert( utils.validField( jd.reqBody.projects_v2_item, "content_node_id" ) );
	    
	    retVal = await ceProjects.cacheFind( authData, config.HOST_GH, jd.org, issueId, ghUtils.getIssueRepo );
	}

	this.ceProjectId = retVal;
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
