const config  = require( '../../config' );

const jobData = require( '../jobData' );

class GH2Data {

    constructor( jd, ceProjects ) {
	// If project_node_id is not in ceProjects, then a new project has been created 'secretly' (thanks GH).
	// this can be done with or without a repo, or by linking to several repos.
	// XXX after the fact, CE will need to check if two repos from different CEProjectIds were linked, then reject.
	// XXX the above may be unnecessarily restrictive..
	// XXX in either case, may need ceFlutter to assign hostProj to ceProj.
	//     when linking hostProj to repo, could do assignment to ceProj internally.

	this.ceProjectId = this.getCEProjectId( jd, ceProjects );
	
	this.org        = jd.org;
	this.actor      = jd.actor;
	this.reqBody    = jd.reqBody;

	this.repo       = config.EMPTY;
	this.fullName   = config.EMPTY;

	this.projectId  = -1;
	this.issueId    = -1;
	this.issueNum   = -1;
	this.issueTitle = config.EMPTY;

	this.peqValue   = -1;
	this.peqType    = config.PEQTYPE_END;
	this.assignees  = [];
	this.projSub    = [];
    }

    getCEProjectId( jd, ceProjects ) {

	let hostProjId = config.EMPTY;
	switch( jd.event ) {
	case 'projects_v2_item' : { hostProjId = jd.reqBody.projects_v2_item.project_node_id;     break;  }
	default :                 { console.log( "Event unhandled." );                            break;  }
	}
	
	let retVal = ceProjects.find( config.HOST_GH, jd.org, hostProjId );

	// XXX XXX No point to speculatively add.
	//         push this step down until we have a peq action.
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
	if( this.repo        != config.EMPTY ) { console.log( "repo", this.repo ); }
	if( this.actor       != config.EMPTY ) { console.log( "actor", this.actor ); }
	if( this.fullName    != config.EMPTY ) { console.log( "fullName", this.fullName ); }

	if( this.projectId  != -1 ) { console.log( "projectId", this.projectId ); }
	if( this.issueId    != -1 ) { console.log( "issueId", this.issueId ); }
	if( this.issueNum   != -1 ) { console.log( "issueNum", this.issueNum ); }
	if( this.issueTitle != config.EMPTY ) { console.log( "issueTitle", this.issueTitle ); }

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
