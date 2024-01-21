var config    = require('../../config');

class TestData {
    constructor( ) {
	this.ceProjectId  = config.EMPTY;
	this.ghRepo       = config.EMPTY;
	this.ghOwner      = config.EMPTY;
	this.ghOwnerId    = config.EMPTY; 
	this.actor        = config.EMPTY;
	this.actorId      = config.EMPTY; 
	this.ghRepoId     = config.EMPTY; 
	this.ghFullName   = config.EMPTY;

	// A Recommended CE structure
	this.softContTitle    = "Software Contributions";
	this.busOpsTitle      = "Business Operations"; 
	this.dataSecTitle     = "Data Security";
	this.githubOpsTitle   = "Github Operations";
	this.unallocTitle     = "Unallocated";
	
	this.masterPID        = config.EMPTY;
	this.scColId          = config.EMPTY;
	this.boColId          = config.EMPTY;
	this.unColId          = config.EMPTY;

	this.scUnallocCID     = config.EMPTY;
	this.boUnallocCID     = config.EMPTY;
	this.githubOpsCID     = config.EMPTY;
	this.dataSecCID       = config.EMPTY;
	    
	this.dataSecPID       = config.EMPTY;
	this.dsPlanId         = config.EMPTY;
	this.dsProgId         = config.EMPTY;
	this.dsPendId         = config.EMPTY;
	this.dsAccrId         = config.EMPTY;
	this.githubOpsPID     = config.EMPTY;
	this.ghProgId         = config.EMPTY;

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
	this.col1Id           = config.EMPTY;
	this.col2Id           = config.EMPTY;

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
	loc.colId    = this.dsPlanId;
	loc.colName  = config.PROJ_COLS[config.PROJ_PLAN];
	loc.projSub  = [this.softContTitle, this.dataSecTitle, config.PROJ_COLS[config.PROJ_PLAN]];
	loc.peqType  = config.PEQTYPE_PLAN;
	return loc;
    }
    getDSProgLoc() { 
	let loc = {};
	loc.pid   = this.dataSecPID;
	loc.projName = this.dataSecTitle;
	loc.colId    = this.dsProgId;
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
	loc.colId    = this.dsPendId;
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
	loc.colId    = this.dsAccrId;
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
	loc.colId    = this.col2Id;
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
	loc.colId    = this.col1Id;
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
	if( this.ghRepo     != config.EMPTY ) { console.log( "GHRepo", this.ghRepo ); }
	if( this.ghRepoId   != config.EMPTY ) { console.log( "GHRepoId", this.ghRepoId ); }
	if( this.ghOwner    != config.EMPTY ) { console.log( "GHOwner", this.ghOwner ); }
	if( this.ghOwnerId  != config.EMPTY ) { console.log( "GHOwnerId", this.ghOwnerId ); }
	if( this.actor      != config.EMPTY ) { console.log( "actor", this.actor ); }
	if( this.actorId    != config.EMPTY ) { console.log( "GHactorId", this.actorId ); }
	if( this.ghFullName != config.EMPTY ) { console.log( "GHFullName", this.ghFullName ); }

	if( this.masterPID    != config.EMPTY ) { console.log( "masterPID", this.masterPID ); }
	if( this.dataSecPID   != config.EMPTY )   { console.log( "dataSecPID", this.dataSecPID ); }
	if( this.githubOpsPID != config.EMPTY )   { console.log( "githubOpsPID", this.githubOpsPID ); }

	if( this.scColId  != config.EMPTY )   { console.log( "scColId", this.scColId ); }
	if( this.boColId  != config.EMPTY )   { console.log( "boColId", this.boColId ); }
	if( this.unColId  != config.EMPTY )   { console.log( "unColId", this.unColId ); }
	if( this.dsPlanId != config.EMPTY )   { console.log( "dsPlanId", this.dsPlanId ); }
	if( this.dsProgId != config.EMPTY )   { console.log( "dsProgId", this.dsProgId ); }
	if( this.dsPendId != config.EMPTY )   { console.log( "dsPendId", this.dsPendId ); }
	if( this.dsAccrId != config.EMPTY )   { console.log( "dsAccrId", this.dsAccrId ); }
	if( this.ghProgId != config.EMPTY )   { console.log( "ghProgId", this.ghProgId ); }

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
	if( this.col1Id      != config.EMPTY ) { console.log( "col1Id", this.col1Id ); }
	if( this.col2Id      != config.EMPTY ) { console.log( "col2Id", this.col2Id ); }

	console.log( "TestData object contents.. Unclaimed=========" );	
	if( this.unclaimPID     != config.EMPTY ) { console.log( "unclaimPID", this.unclaimPID ); }
	if( this.unclaimCID     != config.EMPTY ) { console.log( "unclaimCID", this.unclaimCID ); }

    }
}

exports.TestData = TestData;
