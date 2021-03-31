var config    = require('./config');

class PeqData {
    constructor( ) {
	this.GHRepo       = config.EMPTY;
	this.GHOwner      = config.EMPTY;
	this.GHCreator    = config.EMPTY;
	this.GHFullName   = config.EMPTY;
	this.reqBody      = config.EMPTY;

	this.GHProjectId  = -1;
	this.GHIssueId    = -1;
	this.GHIssueNum   = -1;
	this.GHIssueTitle = config.EMPTY;

	this.peqValue     = -1;
	this.peqType      = config.PEQTYPE_END;
	this.GHAssignees  = [];
	this.projSub      = [];
    }
    show() {
	console.log( "PeqData object contents" );
	if( this.GHRepo     != config.EMPTY ) { console.log( "this.GHRepo", this.GHRepo ); }
	if( this.GHOwner    != config.EMPTY ) { console.log( "this.GHOwner", this.GHOwner ); }
	if( this.GHCreator  != config.EMPTY ) { console.log( "this.GHCreator", this.GHCreator ); }
	if( this.GHFullName != config.EMPTY ) { console.log( "this.GHFullName", this.GHFullName ); }

	if( this.GHProjectId  != -1 ) { console.log( "this.GHProjectId", this.GHProjectId ); }
	if( this.GHIssueId    != -1 ) { console.log( "this.GHIssueId", this.GHIssueId ); }
	if( this.GHIssueNum   != -1 ) { console.log( "this.GHIssueNum", this.GHIssueNum ); }
	if( this.GHIssueTitle != config.EMPTY ) { console.log( "this.GHIssueTitle", this.GHIssueTitle ); }

	if( this.peqValue    != -1 ) { console.log( "this.peqValue", this.peqValue ); }
	console.log( "this.peqType", this.peqType );
	if( this.GHAssignees != [] ) { console.log( "this.GHAssignees", this.GHAssignees ); }
	if( this.projSub     != [] ) { console.log( "this.projSub", this.projSub ); }
    }
    updateFromLink( link ) {
	this.GHProjectId = link.GHProjectId;
	this.GHIssueNum  = link.GHIssueNum;
    }
}

exports.PeqData = PeqData;
