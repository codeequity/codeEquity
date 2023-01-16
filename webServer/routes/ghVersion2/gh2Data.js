const config  = require( '../../config' );

const jobData = require( '../jobData' );

class GH2Data {

    constructor( jd, ceProjects, ceProjectId ) {
	// If project_node_id is not in ceProjects, then a new project has been created 'secretly' (thanks GH).
	// this can be done with or without a repo, or by linking to several repos.
	// XXX after the fact, CE will need to check if two repos from different CEProjectIds were linked, then reject.
	// XXX the above may be unnecessarily restrictive..
	// XXX in either case, may need ceFlutter to assign hostProj to ceProj.
	//     when linking hostProj to repo, could do assignment to ceProj internally.

	if( typeof ceProjectId !== 'undefined' ) { this.ceProjectId = ceProjectId; }
	else                                     { this.ceProjectId = this.getCEProjectId( jd, ceProjects ); }
	
	this.org        = jd.org;
	this.actor      = jd.actor;
	this.reqBody    = jd.reqBody;

	this.repoName   = config.EMPTY;  // of the current repository.. maybe remove?

	this.projectId      = config.EMPTY;    // host project data, gql node_id's not databaseIds
	this.issueId        = config.EMPTY;
	this.issueNum       = -1;
	this.issueTitle     = config.EMPTY;

	this.peqValue   = -1;
	this.peqType    = config.PEQTYPE_END;
	this.assignees  = [];
	this.projSub    = [];
    }

    static copyCons( orig ) {
	let jd     = {};
	jd.org     = orig.org;
	jd.actor   = orig.actor;
	jd.reqBody = orig.reqBody;
	
	let newPD        = new GH2Data( jd, {}, orig.ceProjectId );
	newPD.projectId  = orig.projectId;
	newPD.issueId    = orig.issueId;
	newPD.issueNum   = orig.issueNum;
	newPD.issueTitle = orig.issueTitle;
	newPD.peqValue   = orig.peqValue;
	newPD.peqType    = orig.peqType;
	newPD.assignees  = orig.assignees;
	newPD.projSub    = orig.projSub;
	return newPD;
    }
    
    getCEProjectId( jd, ceProjects ) {

	// ceProjects.show();
	
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
	console.log( "GH2Data object contents" );
	if( this.ceProjectId != -1           ) { console.log( "ceProjectId", this.ceProjectId ); }
	if( this.org         != config.EMPTY ) { console.log( "org", this.org ); }
	if( this.actor       != config.EMPTY ) { console.log( "actor", this.actor ); }
	if( this.repoName    != config.EMPTY ) { console.log( "repoName", this.repoName ); }

	if( this.projectId      != config.EMPTY ) { console.log( "projectId", this.projectId ); }
	if( this.issueId        != config.EMPTY ) { console.log( "issueId", this.issueId ); }
	if( this.issueNum       != -1 )           { console.log( "issueNum", this.issueNum ); }
	if( this.issueTitle     != config.EMPTY ) { console.log( "issueTitle", this.issueTitle ); }

	if( this.peqValue    != -1 ) { console.log( "peqValue", this.peqValue ); }
	console.log( "peqType", this.peqType );
	if( this.assignees.length > 0 ) { console.log( "assignees", this.assignees ); }
	if( this.projSub.length > 0   ) { console.log( "projSub", this.projSub ); }
    }
    
    updateFromLink( link ) {
	this.projectId = link.projectId;
	this.issueNum  = link.issueNum;
    }
}

exports.GH2Data = GH2Data;
