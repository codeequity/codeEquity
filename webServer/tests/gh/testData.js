var config    = require('../../config');

class TestData {
    constructor( ) {
	this.ceProjectId  = config.EMPTY;
	this.GHRepo       = config.EMPTY;
	this.GHOwner      = config.EMPTY;
	this.GHOwnerId    = config.EMPTY; 
	this.actor        = config.EMPTY;
	this.actorId      = config.EMPTY; 
	this.GHRepoId     = config.EMPTY; 
	this.GHFullName   = config.EMPTY;

	// A Recommended CE structure
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
	this.dsPlanID         = config.EMPTY;
	this.dsProgID         = config.EMPTY;
	this.dsPendID         = config.EMPTY;
	this.dsAccrID         = config.EMPTY;
	this.githubOpsPID     = config.EMPTY;
	this.ghProgID         = config.EMPTY;

	this.githubOpsIss     = config.EMPTY;  // [ id, num ] 
	this.dataSecIss       = config.EMPTY;
	this.unallocIss1      = config.EMPTY;
	this.unallocIss2      = config.EMPTY;

	// A Flat CE Structure
	this.flatTitle        = "A Pre-Existing Project";
	this.col1Title        = "Eggs";
	this.col2Title        = "Bacon";
	this.card1Title       = "Parsley";
	this.card2Title       = "Sage";
	this.card3Title       = "Rosemary";

	this.flatPID          = config.EMPTY;
	this.col1ID           = config.EMPTY;
	this.col2ID           = config.EMPTY;

	// Unclaimed
	this.unclaimTitle     = config.UNCLAIMED;
	this.unclaimPID       = config.EMPTY;
	this.unclaimCID       = config.EMPTY;
	
    }

    // These helper functions are nice for testing
    getDSPlanLoc() { 
	let loc = {};
	loc.pid   = this.dataSecPID;
	loc.projName = this.dataSecTitle;
	loc.colId    = this.dsPlanID;
	loc.colName  = config.PROJ_COLS[config.PROJ_PLAN];
	loc.projSub  = [this.softContTitle, this.dataSecTitle, config.PROJ_COLS[config.PROJ_PLAN]];
	loc.peqType  = config.PEQTYPE_PLAN;
	return loc;
    }
    getDSProgLoc() { 
	let loc = {};
	loc.pid   = this.dataSecPID;
	loc.projName = this.dataSecTitle;
	loc.colId    = this.dsProgID;
	loc.colName  = config.PROJ_COLS[config.PROJ_PROG];
	loc.projSub  = [this.softContTitle, this.dataSecTitle, config.PROJ_COLS[config.PROJ_PROG]];
	loc.peqType  = config.PEQTYPE_PLAN;
	return loc;
    }
    // NOTE: peq type is not updated by ceServer, only ceFlutter.
    getDSPendLoc() {
	let loc = {};
	loc.pid   = this.dataSecPID;
	loc.projName = this.dataSecTitle;
	loc.colId    = this.dsPendID;
	loc.colName  = config.PROJ_COLS[config.PROJ_PEND];
	loc.projSub  = [this.softContTitle, this.dataSecTitle, config.PROJ_COLS[config.PROJ_PEND]];
	loc.peqType  = config.PEQTYPE_PLAN;
	return loc;
    }
    // NOTE: peq type is not updated by ceServer, only ceFlutter.
    getDSAccrLoc() {
	let loc = {};
	loc.pid   = this.dataSecPID;
	loc.projName = this.dataSecTitle;
	loc.colId    = this.dsAccrID;
	loc.colName  = config.PROJ_COLS[config.PROJ_ACCR];
	loc.projSub  = [this.softContTitle, this.dataSecTitle, config.PROJ_COLS[config.PROJ_ACCR]];
	loc.peqType  = config.PEQTYPE_PLAN;
	return loc;
    }
    // NOTE: peq type is not updated by ceServer, only ceFlutter.
    getBaconLoc() {
	let loc = {};
	loc.pid   = this.flatPID;
	loc.projName = this.flatTitle;
	loc.colId    = this.col2ID;
	loc.colName  = this.col2Title;
	loc.projSub  = [this.flatTitle, this.col2Title];
	loc.peqType  = config.PEQTYPE_PLAN;
	return loc;
    }
    // NOTE: peq type is not updated by ceServer, only ceFlutter.
    getEggsLoc() {
	let loc = {};
	loc.pid   = this.flatPID;
	loc.projName = this.flatTitle;
	loc.colId    = this.col1ID;
	loc.colName  = this.col1Title;
	loc.projSub  = [this.flatTitle, this.col1Title];
	loc.peqType  = config.PEQTYPE_PLAN;
	return loc;
    }
    getUntrackLoc( pid ) {
	let loc = {};
	loc.pid   = pid;
	loc.projName = config.EMPTY;
	loc.colId    = -1;
	loc.colName  = config.EMPTY;
	loc.projSub  = -1;
	loc.peqType  = config.EMPTY;
	return loc;
    }
    
    show() {
	console.log( "TestData object contents.. Recommended==============" );
	if( this.GHRepo     != config.EMPTY ) { console.log( "GHRepo", this.GHRepo ); }
	if( this.GHRepoId   != config.EMPTY ) { console.log( "GHRepoId", this.GHRepoId ); }
	if( this.GHOwner    != config.EMPTY ) { console.log( "GHOwner", this.GHOwner ); }
	if( this.GHOwnerId  != config.EMPTY ) { console.log( "GHOwnerId", this.GHOwnerId ); }
	if( this.actor      != config.EMPTY ) { console.log( "actor", this.actor ); }
	if( this.actorId    != config.EMPTY ) { console.log( "GHactorId", this.actorId ); }
	if( this.GHFullName != config.EMPTY ) { console.log( "GHFullName", this.GHFullName ); }

	if( this.masterPID    != config.EMPTY ) { console.log( "masterPID", this.masterPID ); }
	if( this.dataSecPID   != config.EMPTY )   { console.log( "dataSecPID", this.dataSecPID ); }
	if( this.githubOpsPID != config.EMPTY )   { console.log( "githubOpsPID", this.githubOpsPID ); }

	if( this.scColID  != config.EMPTY )   { console.log( "scColID", this.scColID ); }
	if( this.boColID  != config.EMPTY )   { console.log( "boColID", this.boColID ); }
	if( this.unColID  != config.EMPTY )   { console.log( "unColID", this.unColID ); }
	if( this.dsPlanID != config.EMPTY )   { console.log( "dsPlanID", this.dsPlanID ); }
	if( this.dsProgID != config.EMPTY )   { console.log( "dsProgID", this.dsProgID ); }
	if( this.dsPendID != config.EMPTY )   { console.log( "dsPendID", this.dsPendID ); }
	if( this.dsAccrID != config.EMPTY )   { console.log( "dsAccrID", this.dsAccrID ); }
	if( this.ghProgID != config.EMPTY )   { console.log( "ghProgID", this.ghProgID ); }

	if( this.scUnallocCID != config.EMPTY )   { console.log( "scUnallocCID", this.scUnallocCID ); }
	if( this.boUnallocCID != config.EMPTY )   { console.log( "boUnallocCID", this.boUnallocCID ); }
	if( this.githubOpsCID != config.EMPTY )   { console.log( "githubOpsCID", this.githubOpsCID ); }
	if( this.dataSecCID   != config.EMPTY )   { console.log( "dataSecCID", this.dataSecCID ); }

	if( this.githubOpsIss != config.EMPTY )   { console.log( "githubOpsIss", this.githubOpsIss ); }
	if( this.dataSecIss   != config.EMPTY )   { console.log( "dataSecIss", this.dataSecIss ); }
	if( this.unallocIss1  != config.EMPTY )   { console.log( "unallocIss1", this.unallocIss1 ); }
	if( this.unallocIss2  != config.EMPTY )   { console.log( "unallocIss2", this.unallocIss2 ); }

	console.log( "TestData object contents.. Flat==============" );	
	if( this.flatPID     != config.EMPTY ) { console.log( "flatPID", this.flatPID ); }
	if( this.col1ID      != config.EMPTY ) { console.log( "col1ID", this.col1ID ); }
	if( this.col2ID      != config.EMPTY ) { console.log( "col2ID", this.col2ID ); }

	console.log( "TestData object contents.. Unclaimed=========" );	
	if( this.unclaimPID     != config.EMPTY ) { console.log( "unclaimPID", this.unclaimPID ); }
	if( this.unclaimCID     != config.EMPTY ) { console.log( "unclaimCID", this.unclaimCID ); }

    }
}

exports.TestData = TestData;
