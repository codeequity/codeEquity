var config    = require('../config');

class TestData {
    constructor( ) {
	this.GHRepo       = config.EMPTY;
	this.GHOwner      = config.EMPTY;
	this.GHFullName   = config.EMPTY;

	// A preferred CE structure
	this.softContTitle    = "Software Contributions";
	this.busOpsTitle      = "Business Operations"; 
	this.dataSecTitle     = "Data Security";
	this.githubOpsTitle   = "Github Operations";
	this.unallocTitle     = "Unallocated";
	
	this.masterPID        = config.EMPTY;
	this.scColID          = config.EMPTY;
	this.boColID          = config.EMPTY;
	this.unColID          = config.EMPTY;

	this.scUnallocCID     = config.EMPTY;
	this.boUnallocCID     = config.EMPTY;
	this.githubOpsCID     = config.EMPTY;
	this.dataSecCID       = config.EMPTY;
	    
	this.dataSecPID       = config.EMPTY;
	this.githubOpsPID     = config.EMPTY;

	this.githubOpsIss     = config.EMPTY;  // [ id, num ]
	this.dataSecIss       = config.EMPTY;
	this.unallocIss1      = config.EMPTY;
	this.unallocIss2      = config.EMPTY;
	
    }
    show() {
	console.log( "TestData object contents" );
	if( this.GHRepo     != config.EMPTY ) { console.log( "GHRepo", this.GHRepo ); }
	if( this.GHOwner    != config.EMPTY ) { console.log( "GHOwner", this.GHOwner ); }
	if( this.GHFullName != config.EMPTY ) { console.log( "GHFullName", this.GHFullName ); }

	if( this.masterPID    != config.EMPTY ) { console.log( "masterPID", this.masterPID ); }
	if( this.dataSecPID   != config.EMPTY )   { console.log( "dataSecPID", this.dataSecPID ); }
	if( this.githubOpsPID != config.EMPTY )   { console.log( "githubOpsPID", this.githubOpsPID ); }

	if( this.scColID  != config.EMPTY )   { console.log( "scColID", this.scColID ); }
	if( this.boColID  != config.EMPTY )   { console.log( "boColID", this.boColID ); }
	if( this.unColID  != config.EMPTY )   { console.log( "unColID", this.unColID ); }

	if( this.scUnallocCID != config.EMPTY )   { console.log( "scUnallocCID", this.scUnallocCID ); }
	if( this.boUnallocCID != config.EMPTY )   { console.log( "boUnallocCID", this.boUnallocCID ); }
	if( this.githubOpsCID != config.EMPTY )   { console.log( "githubOpsCID", this.githubOpsCID ); }
	if( this.dataSecCID   != config.EMPTY )   { console.log( "dataSecCID", this.dataSecCID ); }

	if( this.githubOpsIss != config.EMPTY )   { console.log( "githubOpsIss", this.githubOpsIss ); }
	if( this.dataSecIss   != config.EMPTY )   { console.log( "dataSecIss", this.dataSecIss ); }
	if( this.unallocIss1  != config.EMPTY )   { console.log( "unallocIss1", this.unallocIss1 ); }
	if( this.unallocIss2  != config.EMPTY )   { console.log( "unallocIss2", this.unallocIss2 ); }
	

    }
}

exports.TestData = TestData;
