const config  = require( '../config' );

class CEData {

    constructor( settings  ) {

	this.ceProjectId = settings.hasOwnProperty( "ceProjectId" ) ? settings.ceProjectId : config.EMPTY;

	this.org         = settings.hasOwnProperty( "org" )         ? settings.org         : config.EMPTY;
	this.actor       = settings.hasOwnProperty( "actor" )       ? settings.actor       : config.EMPTY;
	this.reqBody     = settings.hasOwnProperty( "reqBody" )     ? settings.reqBody     : config.EMPTY;

	this.repoId      = settings.hasOwnProperty( "repoId" )      ? settings.repoId      : config.EMPTY;
	this.repoName    = settings.hasOwnProperty( "repoName" )    ? settings.repoName    : config.EMPTY;

	this.projectId   = settings.hasOwnProperty( "projectId" )   ? settings.projectId   : config.EMPTY;
	this.projectName = settings.hasOwnProperty( "projectName" ) ? settings.projectName : config.EMPTY;

	this.issueId     = settings.hasOwnProperty( "issueId" )     ? settings.issueId     : config.EMPTY;
	this.issueName   = settings.hasOwnProperty( "issueName" )   ? settings.issueName   : config.EMPTY;

	this.columnId    = settings.hasOwnProperty( "columnId" )    ? settings.columnId    : config.EMPTY;
	this.columnName  = settings.hasOwnProperty( "columnName" )  ? settings.columnName  : config.EMPTY;

	this.peqValue    = settings.hasOwnProperty( "peqValue" )    ? settings.peqValue    : -1;
	this.peqType     = settings.hasOwnProperty( "peqType" )     ? settings.peqType     : config.PEQTYPE_END;
	this.assignees   = settings.hasOwnProperty( "assignees" )   ? settings.assignees   : [];
	this.projSub     = settings.hasOwnProperty( "projSub" )     ? settings.projSub     : [];
    }

    static from( orig ) {
	let settings = {};
	settings.ceProjectId = orig.ceProjectId;
	settings.org         = orig.org;
	settings.actor       = orig.actor;
	settings.reqBody     = orig.reqBody;
	settings.repoId      = orig.repoId;
	settings.repoName    = orig.repoName;
	settings.projectId   = orig.projectId;
	settings.projectName = orig.projectName;
	settings.issueId     = orig.issueId;
	settings.issueName   = orig.issueName;
	settings.columnId    = orig.columnId;
	settings.columnName  = orig.columnName;
	settings.peqValue    = orig.peqValue;
	settings.peqType     = orig.peqType;
	settings.assignees   = orig.assignees;
	settings.projSub     = orig.projSub;
	
	return new CEData( settings );
    }
    
    show() {
	console.log( "CEData object contents" );
	if( this.ceProjectId != -1           ) { console.log( "ceProjectId", this.CEProjectId ); }
	if( this.org         != config.EMPTY ) { console.log( "org", this.org ); }
	if( this.actor       != config.EMPTY ) { console.log( "actor", this.actor ); }

	if( this.repoId      != config.EMPTY ) { console.log( "repoId", this.repoId ); }
	if( this.repoName    != config.EMPTY ) { console.log( "repoName", this.repoName ); }

	if( this.projectId   != config.EMPTY ) { console.log( "projectId", this.projectId ); }
	if( this.projectName != config.EMPTY ) { console.log( "projectName", this.projectName ); }

	if( this.issueId     != config.EMPTY ) { console.log( "issueId", this.issueId ); }
	if( this.issueName   != config.EMPTY ) { console.log( "issueName", this.issueName ); }

	if( this.columnId    != config.EMPTY ) { console.log( "columnId", this.columnId ); }
	if( this.columnName  != config.EMPTY ) { console.log( "columnName", this.columnName ); }


	if( this.peqValue    != -1 ) { console.log( "peqValue", this.peqValue ); }
	console.log( "peqType", this.peqType );
	if( this.assignees.length > 0 ) { console.log( "assignees", this.assignees ); }
	if( this.projSub.length > 0   ) { console.log( "projSub", this.projSub ); }
    }
}

exports.CEData = CEData;
