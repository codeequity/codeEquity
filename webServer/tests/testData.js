var config    = require('../config');

class TestData {
    constructor( ) {
	this.GHRepo       = config.EMPTY;
	this.GHOwner      = config.EMPTY;
	this.GHFullName   = config.EMPTY;

	// A preferred CE structure
	this.masterPID        =  config.EMPTY;
	this.softContTitle    = "Software Contributions";
	this.busOpsTitle      = "Business Operations"; 
	this.dataSecTitle     = "Data Security";
	this.githubOpsTitle   = "Github Operations";
	this.unallocTitle     = "Unallocated";
	
	
    }
    show() {
	console.log( "TestData object contents" );
	if( this.GHRepo     != config.EMPTY ) { console.log( "GHRepo", this.GHRepo ); }
	if( this.GHOwner    != config.EMPTY ) { console.log( "GHOwner", this.GHOwner ); }
	if( this.GHFullName != config.EMPTY ) { console.log( "GHFullName", this.GHFullName ); }

	if( this.masterPID  != config.EMPTY ) { console.log( "masterPID", this.masterPID ); }


    }
}

exports.TestData = TestData;
