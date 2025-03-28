import assert  from 'assert';

import * as config from '../../../config.js';

import ceData  from '../../ceData.js';
import jobData from '../../jobData.js';

import * as utils   from "../../../utils/ceUtils.js";
import * as ghUtils from "../../../utils/gh/ghUtils.js";

// Cache GitHub hostUserName, hostUserId
var githubUsers = {};


class GH2Data extends ceData{

    // Use projectV2 node ids, not databaseIds
    constructor( authData, jd, ceProjects, ceProjectId ) {
	let settings = {};

	settings.org     = jd.org;
	settings.actor   = jd.actor;
	settings.reqBody = jd.reqBody;

	if( !githubUsers.hasOwnProperty( jd.actor )) {
	    // NOTE this is a promise - not needed for a while.  
	    githubUsers[ jd.actor] = ghUtils.getOwnerId( authData.pat, jd.actor );
	    console.log( "Got promise id for", jd.actor );
	}
	settings.actorId  = githubUsers[ jd.actor ]; 
	
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
	
	let newPD = new GH2Data( {}, jd, orig.ceProjectId );

	newPD.issueNum  = orig.issueNum;
	newPD.issueId   = orig.issueId;
	newPD.repoId    = orig.repoId;

	return newPD;
    }
    
    async setCEProjectId( authData, jd, ceProjects ) {
	
	// console.log( "getCEProjectId",  jd.reqBody );

	let retVal = config.EMPTY; 
	if( Object.keys(ceProjects).length == 0 ) { return retVal; }

	// If this is content notice, get from repo.  If projects_v2, just give up.
	// projects_v2 does not carry repo information, just view data.  no good way to get CEPID here.
	if( utils.validField( jd.reqBody, "projects_v2" ) ) {
	    console.log( authData.who, "skip setting ceProjectId for project_v2 notifications." );
	}
	else if( !utils.validField( jd.reqBody, "projects_v2_item" ) || !utils.validField( jd.reqBody.projects_v2_item, "project_node_id" ) ) {
	    assert( utils.validField( jd.reqBody, "repository" ));
	    console.log( "Find by repo", jd.org, jd.reqBody.repository.full_name );
	    retVal = ceProjects.findByRepo( config.HOST_GH, jd.org, jd.reqBody.repository.full_name ); 
	}
	else {
	    if( jd.reqBody.projects_v2_item.content_type != config.GH_ISSUE ) {
		console.log( "gh2Data object created for item that is not an issue.  No need to set ceProjectId" );
		return;
	    }
	    let issueId = jd.reqBody.projects_v2_item.content_node_id;
	    if( !utils.validField( jd.reqBody.projects_v2_item, "content_node_id" ) ) { console.log( jd.reqBody ); }
	    assert( utils.validField( jd.reqBody.projects_v2_item, "content_node_id" ) );
	    
	    retVal = await ceProjects.cacheFind( authData, config.HOST_GH, jd.org, issueId, ghUtils.getIssueRepo );
	}

	// console.log( "gh2Data: setting cepId", retVal );
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

export default GH2Data;
