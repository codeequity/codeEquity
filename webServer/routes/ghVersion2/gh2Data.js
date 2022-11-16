const config  = require( '../../config' );

const jobData = require( '../jobData' );

class GH2Data {
/*    
    constructor( ) {
	this.ceProjectId = -1;
	    
	this.org        = config.EMPTY;
	this.repo       = config.EMPTY;
	this.actor      = config.EMPTY;
	this.fullName   = config.EMPTY;
	this.reqBody    = config.EMPTY;

	this.projectId  = -1;
	this.issueId    = -1;
	this.issueNum   = -1;
	this.issueTitle = config.EMPTY;

	this.peqValue   = -1;
	this.peqType    = config.PEQTYPE_END;
	this.assignees  = [];
	this.projSub    = [];
    }
*/
    
    constructor( jd ) {
	this.ceProjectId = 123490;  // XXXXXXXXXXXXX
	
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
    
    show() {
	console.log( "GH2Data object contents" );
	if( this.ceProjectId != -1           ) { console.log( "this.ceProjectId", this.ceProjectId ); }
	if( this.org         != config.EMPTY ) { console.log( "this.org", this.org ); }
	if( this.repo        != config.EMPTY ) { console.log( "this.repo", this.repo ); }
	if( this.actor       != config.EMPTY ) { console.log( "this.actor", this.actor ); }
	if( this.fullName    != config.EMPTY ) { console.log( "this.fullName", this.fullName ); }

	if( this.projectId  != -1 ) { console.log( "this.projectId", this.projectId ); }
	if( this.issueId    != -1 ) { console.log( "this.issueId", this.issueId ); }
	if( this.issueNum   != -1 ) { console.log( "this.issueNum", this.issueNum ); }
	if( this.issueTitle != config.EMPTY ) { console.log( "this.issueTitle", this.issueTitle ); }

	if( this.peqValue    != -1 ) { console.log( "this.peqValue", this.peqValue ); }
	console.log( "this.peqType", this.peqType );
	if( this.assignees.length > 0 ) { console.log( "this.assignees", this.assignees ); }
	if( this.projSub.length > 0   ) { console.log( "this.projSub", this.projSub ); }
    }
    
    updateFromLink( link ) {
	this.projectId = link.projectId;
	this.issueNum  = link.issueNum;
    }
}

exports.GH2Data = GH2Data;
