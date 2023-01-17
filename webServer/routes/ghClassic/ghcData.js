const config  = require('../../config');

const ceData  = require( '../ceData' );

class GHCData extends ceData.CEData{
    constructor( ) {
	super( {} );
	this.GHRepo       = config.EMPTY;  // repo shortname
	this.GHOwner      = config.EMPTY;  
	this.GHCreator    = config.EMPTY;

	this.GHIssueNum   = -1;
    }
    show() {
	console.log( "GHCData object contents" );
	if( this.GHRepo     != config.EMPTY ) { console.log( "this.GHRepo", this.GHRepo ); }
	if( this.GHOwner    != config.EMPTY ) { console.log( "this.GHOwner", this.GHOwner ); }
	if( this.GHCreator  != config.EMPTY ) { console.log( "this.GHCreator", this.GHCreator ); }

	if( this.GHIssueNum   != -1 ) { console.log( "this.GHIssueNum", this.GHIssueNum ); }
    }
    updateFromLink( link ) {
	this.projectId  = link.projectId;
	this.GHIssueNum = link.issueNum;
    }
}

exports.GHCData = GHCData;
