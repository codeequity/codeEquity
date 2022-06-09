var assert = require('assert');

const auth = require( "../auth");
var utils = require('../utils');
var config  = require('../config');

var ghUtils = require('../ghUtils');
var gh      = ghUtils.githubUtils;
var ghSafe  = ghUtils.githubSafe;


// Linkage table contains all identifying info related to situated issues or better.
// linkage is { issueId: { cardId: {} }}
// linkage is NOT stored in dynamo.

// Loc table is projects and columns per repo.

// Loc table contains all proj/col in repo.  linkage table will only have that info where there are PEQs.
// All adds to loc update aws, except batch related adds present herein.
// loc is { projId: { colId: {} }}
// loc IS stored in dynamo, for speed and privacy benefits during ingest (ceFlutter).

class Linkage {

    constructor( ) {
	this.links = {};   // { issueId: { cardId: {link}}}
	this.locs  = {};   // { projId: { colId: {loc}}}
    }


    async initOneRepo( authData, fn ) {
	
	console.log( ".. working on", fn );

	// Wait later
	let peqs = utils.getPeqs( authData, { "GHRepo": fn } );

	let fnParts = fn.split('/');
	
	let baseLinks = [];
	let blPromise =  gh.getBasicLinkDataGQL( authData.pat, fnParts[0], fnParts[1], baseLinks, -1 )
	    .catch( e => console.log( "Error.  GraphQL for basic linkage failed.", e ));

	let locData = [];
	let ldPromise = gh.getRepoColsGQL( authData.pat, fnParts[0], fnParts[1], locData, -1 )
	    .catch( e => console.log( "Error.  GraphQL for repo cols failed.", e ));

	ldPromise = await ldPromise;  // no val here, just ensures locData is set
	for( const loc of locData ) {
	    this.addLoc( authData, fn, loc.GHProjectName, loc.GHProjectId, loc.GHColumnName, loc.GHColumnId, "true", false );
	}
	utils.refreshLinkageSummary( authData, fn, locData );

	blPromise = await blPromise;  // no val here, just ensures locData is set
	this.populateLinkage( authData, fn, baseLinks );

	// flatSource is a column id.  May not be in current return data, since source is orig col, not cur col.
	// peq add: cardTitle, colId, colName, projName
	// XXX this could be smarter, i.e. are peqs >> non-peqs?  zero out instead of fill
	let badPeq = false;
	let badSource = false;
	peqs = await peqs;
	if( peqs == -1 ) { peqs = []; }
	for( const peq of peqs ) {
	    if( peq.Active == "false" ) {
		// console.log( authData.who, "Skipping inactive peq", peq.GHIssueTitle );
		continue;
	    }
	    const iid = peq.GHIssueId;
	    let link = this.getUniqueLink( authData, iid );
	    if( link == -1 ) {
		console.log( "Did you remove an issue without removing the corresponding PEQ?", peq.PEQId, peq.GHIssueTitle );
		badPeq = true;
		continue;
	    }

	    let card = baseLinks.find( datum => datum.cardId == link.GHCardId );
	    
	    link.GHIssueTitle  = card.title;
	    link.GHColumnId    = card.columnId.toString();
	    link.GHProjectName = card.projectName;
	    link.GHColumnName  = card.columnName;

	    // need a name here
	    link.flatSource    = peq.GHProjectSub[ peq.GHProjectSub.length - 1 ];
	    if( config.PROJ_COLS.includes( link.flatSource )) { link.flatSource = -1; }
	    // XXX could make this faster if cols use gets broader.
	    if( link.flatSource != -1 ) {
		const loc = locData.find( loc => loc.GHProjectId == link.GHProjectId && loc.GHColumnName == link.flatSource );
		if( typeof loc !== 'undefined' ) { link.flatSource = loc.GHColumnId; }
		else { link.flatSource = -1; }   // e.g. projSub is (master)[softCont, dataSec]
	    }
	}

	assert( !badPeq  );  // will be caught.
	return baseLinks; 
    }

    
    // Note: Run init in order of most recently and most active repos.
    // populateCEServer migrates a project into CE.  lots of extra checks.
    // init here is to handle a server restart, only 'remembers' official CE projects.
    async init( authData ) {
	let tstart = Date.now();
	console.log( "Init linkages" );

	let fullNames = await utils.getRepoStatus( authData, -1 );   // get all repos
	if( fullNames == -1 ) { return; }
	let promises = [];
	for( const entry of fullNames ) {
	    let fn = entry.GHRepo;
	    promises.push( this.initOneRepo( authData, fn )
			   .catch( e => console.log( "Error.  Init Linkage failed.", e )) );
	}
	await Promise.all( promises );
	console.log( "Linkage init done", Object.keys(this.links).length, "links", Date.now() - tstart, "millis" );
	this.show(10);
	//this.showLocs();
    }

    fromJson( linkData ) {
	this.links = {};
	console.log( "Creating ghLinks from json data" );
	for( const [_, clinks] of Object.entries( linkData ) ) {
	    for( const [_, link] of Object.entries( clinks ) ) {
		this.addLinkage( {}, link.GHRepo, link.GHIssueId, link.GHIssueNum,
				 link.GHProjectId, link.GHProjectName, link.GHColumnId, link.GHColumnName,
				 link.GHCardId, link.GHIssueTitle );
	    }
	}
    }

    // Linkage table only contains situated issues or better.  Card titles point to issue titles for situated issues.
    addLinkage( authData, repo, issueId, issueNum, projId, projName, colId, colName, cardId, issueTitle, source ) {

	// console.log( authData.who, "add link", issueId, cardId, colName, colId, issueTitle );

	if( !this.links.hasOwnProperty( issueId ) )         { this.links[issueId] = {}; }
	if( !this.links[issueId].hasOwnProperty( cardId ) ) { this.links[issueId][cardId] = {}; }

	let haveSource = false;
	if( typeof source !== 'undefined' ) { haveSource = true; }

	let link = this.links[issueId][cardId];
	// issuedId, cardId doubly-stored for convenience
	link.GHRepo        = repo;
	link.GHIssueId     = issueId.toString();
	link.GHIssueNum    = issueNum.toString();
	link.GHProjectId   = projId.toString();
	link.GHProjectName = projName;
	link.GHColumnId    = colId.toString();
	link.GHColumnName  = colName;
	link.GHCardId      = cardId.toString();
	link.GHIssueTitle  = issueTitle;   
	link.flatSource    = haveSource ? source : link.GHColumnId;

	// Do not track source col if is in full layout
	if( !haveSource && config.PROJ_COLS.includes( link.GHColumnName ) ) { link.flatSource = -1; }
	return link;
    }


    // For testing, locData grabbed from server and queried, do NOT modify AWS.
    fromJsonLocs( locData ) {
	this.links = {};

	// Need to purge first!
	this.purgeLocs( "TESTING-FROMJSONLOCS" );
	
	console.log( "Creating ghLinks.locs from json data" );
	for( const [_, clocs] of Object.entries( locData ) ) {
	    for( const [_, loc] of Object.entries( clocs ) ) {
		this.addLoc( {}, loc.GHRepo, loc.GHProjectName, loc.GHProjectId, loc.GHColumnName, loc.GHColumnId, loc.Active );
	    }
	}
    }

    // ProjectID is the kanban project.  repo:pid  is 1:many
    async addLoc( authData, repo, projName, projId, colName, colId, active, pushAWS = false ) {
	colId  = colId.toString();
	projId = projId.toString();
	if( !this.locs.hasOwnProperty( projId ))        { this.locs[projId] = {}; }
	if( !this.locs[projId].hasOwnProperty( colId )) { this.locs[projId][colId] = {}; }
	
	let loc = this.locs[projId][colId];

	loc.GHRepo        = repo;
	loc.GHProjectId   = projId;
	loc.GHProjectName = projName;
	loc.GHColumnId    = colId;
	loc.GHColumnName  = colName;
	loc.Active        = active;

	// Must wait.. aws dynamo ops handled by multiple threads.. order of processing is not dependable in rapid-fire situations.
	// No good alternative - refresh could be such that earlier is processed later in dynamo
	if( pushAWS ) { await utils.updateLinkageSummary( authData, loc ); }
	
	return loc;
    }
    
    populateLinkage( authData, fn, baseLinkData ) {
	console.log( authData.who, "Populate linkage" );
	for( const elt of baseLinkData ) {
	    this.addLinkage( authData, fn, elt.issueId, elt.issueNum, elt.projectId, config.EMPTY, -1, config.EMPTY, elt.cardId, config.EMPTY );
	}
    }
    

    getUniqueLink( authData, issueId ) {

	// console.log( authData.who, "Get unique link", issueId );
	let retVal = -1;
	if( this.links.hasOwnProperty( issueId )) {
	    let issueLinks = Object.entries( this.links[issueId] );  // [ [cardId, link], [cardId, link] ...]
	    
	    if      ( issueLinks.length < 1 ) { console.log(authData.who, "Link not found.", issueId ); }  // 204
	    else if ( issueLinks.length > 1 ) { console.log(authData.who, "Semantic error.  More items found than expected.", issueId ); } // 422
	    else                              { retVal = issueLinks[0][1]; }
	}
	return retVal;
    }


    // issueId:cardId 1:m  cardId:issueId 1:1
    getLinks( authData, query ) {

	if( typeof query.repo === 'undefined' ) {
	    console.log( "Error.  Repo was not defined in Links query." );
	    assert( false );
	}

	const repo = query.repo;
	const issueId    = query.hasOwnProperty( "issueId" )   ? query.issueId.toString() : -1;
	const cardId     = query.hasOwnProperty( "cardId" )    ? query.cardId.toString()  : -1;
	const projId     = query.hasOwnProperty( "projId" )    ? query.projId             : -1;
	const projName   = query.hasOwnProperty( "projName" )  ? query.projName           : config.EMPTY;
	const colName    = query.hasOwnProperty( "colName" )   ? query.colName            : config.EMPTY;
	const issueTitle = query.hasOwnProperty( "issueTitle" ) ? query.issueTitle        : config.EMPTY;

	// console.log( authData.who, "get Links", issueId, cardId, projId, projName, colName, issueTitle );
	
	let links = [];
	for( const [key, clinks] of Object.entries( this.links ) ) {  // one clinks is {cardId: { <link>}, cardId2: { <link> }}
	    // Note, during initial resolve, this may NOT be 1:1 issue:card
	    for( const [_, link] of Object.entries( clinks ) ) {
		let match = true;
		match = issueId == -1              ? match : match && (link.GHIssueId == issueId);
		match = cardId == -1               ? match : match && (link.GHCardId  == cardId);
		match = projId == -1               ? match : match && (link.GHProjectId == projId);
		match = repo == config.EMPTY       ? match : match && (link.GHRepo    == repo);
		match = projName == config.EMPTY   ? match : match && (link.GHProjectName == projName );
		match = colName == config.EMPTY    ? match : match && (link.GHColumnName == colName );
		match = issueTitle == config.EMPTY ? match : match && (link.GHIssueTitle == issueTitle );
		
		if( match ) { links.push( link ); }
	    }
	}

	if( links.length == 0 ) { links = -1; }
	return links;
    }

    getLocs( authData, query ) {
	// console.log( authData.who, "get Locs", query );
	// this.showLocs();
	    
	if( typeof query.repo === 'undefined' ) {
	    console.log( "Error.  Repo was not defined in Locs query." );
	    assert( false );
	}

	const repo = query.repo;
	const projId    = query.hasOwnProperty( "projId" )   ? query.projId.toString() : -1;
	const colId     = query.hasOwnProperty( "colId" )    ? query.colId.toString()  : -1;
	const projName  = query.hasOwnProperty( "projName" ) ? query.projName          : config.EMPTY;
	const colName   = query.hasOwnProperty( "colName" )  ? query.colName           : config.EMPTY;
	
	let locs = [];
	for( const [_, clocs] of Object.entries( this.locs ) ) { 
	    for( const [_, loc] of Object.entries( clocs ) ) {
		let match = true;

		match = projId == -1             ? match : match && (loc.GHProjectId   == projId);
		match = colId == -1              ? match : match && (loc.GHColumnId    == colId);
		match = repo == config.EMPTY     ? match : match && (loc.GHRepo        == repo);
		match = projName == config.EMPTY ? match : match && (loc.GHProjectName == projName);
		match = colName == config.EMPTY  ? match : match && (loc.GHColumnName  == colName);
		match =                                    match && (loc.Active        == "true");
		
		if( match ) { locs.push( loc ); }
	    }
	}

	if( locs.length == 0 ) { locs = -1; }
	return locs;
    }

    
    // Use only with known PEQ issues, 1:1
    // Zero out fields in linkage table no longer being tracked
    // Base linkage is for issue-cards that are not in validated CE project structure.
    //
    // [ [projId, cardId, issueNum, issueId], ... ]
    // Each cardId quad is one of three types:
    //  1. issue-card linkage is already in place.    Should not overwrite - handled by caller
    //  2. no linkage in dynamo, but linkage in GH,   Do write.
    //  3. no linkage in dynamo, only card in GH,     No.  Need a linkage in order to add to linkage table.
    //
    // Write repo, projId, cardId, issueNum.    issueId is much more expensive to find, not justified speculatively.
    rebaseLinkage( authData, issueId ) {
	console.log( authData.who, "Rebasing link for", issueId );
	let cLinks = this.links[issueId];
	assert( Object.keys( cLinks ).length == 1 );
	let [_, link] = Object.entries( cLinks )[0];

	link.GHProjectName = config.EMPTY;
	link.GHColumnId    = -1;
	link.GHColumnName  = config.EMPTY;
	link.GHIssueTitle   = config.EMPTY;
	link.flatSource    = -1;
    }

    updateLinkage( authData, issueId, cardId, newColId, newColName ) {
	console.log( authData.who, "Update linkage for", issueId, cardId, newColId );
	let link = this.links[issueId][cardId];
	assert( link !== 'undefined' );

	link.GHColumnId   = newColId.toString();
	link.GHColumnName = newColName;

	// update, need to track specially
	if( !config.PROJ_COLS.includes( newColName ) ) { link.flatSource = link.GHColumnId; }
	return true;
    }

    updateTitle( authData, linkData, newTitle ) {
	let link = this.links[linkData.GHIssueId][linkData.GHCardId];
	assert( link !== 'undefined' );

	link.GHIssueTitle  = newTitle;

	return true;
    }

    // primary keys have changed.
    rebuildLinkage( authData, oldLink, issueData, cardId, splitTitle ) {
	console.log( authData.who, "Rebuild linkage", oldLink.GHIssueNum, "->", issueData[0] );
	let newTitle = oldLink.GHIssueTitle;
	if( typeof splitTitle !== 'undefined' ) {
	    newTitle = oldLink.GHColumnId == -1 ? config.EMPTY : splitTitle;
	}
	
	let link = this.addLinkage( authData,
				    oldLink.GHRepo,
				    issueData[0].toString(), issueData[1].toString(),
				    oldLink.GHProjectId, oldLink.GHProjectName,
				    oldLink.GHColumnId, oldLink.GHColumnName,
				    cardId.toString(), newTitle, oldLink.flatSource );
	
	this.removeLinkage( { "authData": authData, "issueId": oldLink.GHIssueId, "cardId": oldLink.GHCardId } );

	return link;
    }

    removeLinkage({ authData, issueId, cardId }) {
	let retVal = false;
	if( !authData ) { console.log( "missing authData" ); return retVal; }
	if( !issueId )  { console.log( "missing issueId" ); return retVal; }
	// cardId can be missing

	console.log( authData.who, "Remove link for issueId:", issueId );

	if( !this.links.hasOwnProperty( issueId ))                { return retVal; }  // may see multiple deletes
	if( Object.keys( this.links[issueId] ).length == 0 )      { return retVal; }
	else if( Object.keys( this.links[issueId] ).length == 1 ) { delete this.links[issueId]; }
	else                                                      { delete this.links[issueId][cardId]; }
	retVal = true;
	return retVal;
    }

    removeLocs({ authData, projId, colId }) {
	if( !authData ) { console.log( "missing authData" ); return false; }


	if( colId )       { console.log( authData.who, "Remove loc for colId:", colId ); }    // one delete
	else if( projId ) { console.log( authData.who, "Remove locs for projId:", projId ); } // many deletes


	let havePID = typeof projId !== 'undefined';
	let haveCID = typeof colId  !== 'undefined';
	let repo    = "";
	
	// Easy cases, already do not exist
	if( (!havePID && !haveCID) ||                                              // nothing specified
	    (havePID && !this.locs.hasOwnProperty( projId )) ||                    // have pid, but already not in locs
	    (havePID && haveCID && !this.locs[projId].hasOwnProperty( colId ))) {  // have pid & cid, but already not in locs
	}
	else if( havePID && this.locs.hasOwnProperty( projId )) {
	    if( haveCID && this.locs[projId].hasOwnProperty( colId ))
	    {
		assert( repo == "" || repo == this.locs[projId][colId].GHRepo );
		repo = this.locs[projId][colId].GHRepo;
		this.locs[projId][colId].Active = "false"; 
	    }
	    else if( !haveCID ) {
		for( var [_, loc] of Object.entries( this.locs[projId] )) {
		    assert( repo == "" || repo == loc.GHRepo );
		    repo = loc.GHRepo;
		    loc.Active = "false"; 
		}
	    }
	}
	// I don't have PID, but I do have CID
	else {  
	    for( const [proj,cloc] of Object.entries( this.locs )) {
		if( cloc.hasOwnProperty( colId )) {
		    assert( repo == "" || repo == this.locs[proj][colId].GHRepo );
		    repo = this.locs[proj][colId].GHRepo;
		    this.locs[proj][colId].Active = "false";
		    break;
		}
	    }
	}

	// No need to wait.  Pass a list here, so no-one else need care about internals.
	if( repo != "" ) {
	    let locs = [];
	    for( const [_, cloc] of Object.entries( this.locs ) ) {
		for( const [_, loc] of Object.entries( cloc )) {

		    if( loc.GHRepo == repo ) {
			let aloc = {};
			aloc.GHProjectId   = loc.GHProjectId;
			aloc.GHProjectName = loc.GHProjectName;
			aloc.GHColumnId    = loc.GHColumnId;
			aloc.GHColumnName  = loc.GHColumnName;
			aloc.Active        = loc.Active;

			locs.push( aloc );
		    }
		}
	    }
	    utils.refreshLinkageSummary( authData, repo, locs, false );
	}
	
    	// this.showLocs();
	return repo != "";
    }

    // NOTE: testing will purge every repo
    purgeLocs( repo ) {
	let killList = [];	
	for( const [proj,cloc] of Object.entries( this.locs )) {
	    for( const [col,loc] of Object.entries( cloc )) {
		if( repo == "TESTING-FROMJSONLOCS" || loc.GHRepo == repo ) { killList.push( loc.GHProjectId ); }
	    }
	}
	for( const id of killList ) { delete this.locs[id]; }
	return true;
    }
    
    purge( repo ) {
	console.log( "Removing links, locs for", repo );
	let killList = [];
	for( const [iss,clink] of Object.entries( this.links )) {
	    for( const [cid,link] of Object.entries( clink )) {
		if( link.GHRepo == repo ) { killList.push( link.GHIssueId ); }
	    }
	}
	for( const id of killList ) { delete this.links[id]; }

	this.purgeLocs( repo );
	
	return true;
    }

    fill( val, num ) {
	let retVal = "";
	if( typeof val !== 'undefined' ) {
	    for( var i = 0; i < num; i++ ) {
		if( val.length > i ) { retVal = retVal.concat( val[i] ); }
		else                 { retVal = retVal.concat( " " ); }
	    }
	}
	return retVal
    }

    show( count ) {
	if( Object.keys( this.links ).length <= 0 ) { return ""; }
	
	console.log( "IssueId",
		     "IssueNum",
		     this.fill( "CardId", 7),
		     this.fill( "Title", 35 ),
		     this.fill( "ColId", 10),
		     this.fill( "ColName", 20),
		     this.fill( "ProjId", 10 ), 
		     this.fill( "ProjName", 15 ),
		     this.fill( "sourceCol", 10 )
		   );

	let printables = [];
	for( const [issueId, clinks] of Object.entries( this.links )) {
	    for( const [_, link] of Object.entries( clinks )) {
		printables.push( link );
	    }}

	let start = 0;
	if( typeof count !== 'undefined' ) { start = printables.length - count; }
	start = start < 0 ? 0 : start;
	
	for( let i = start; i < printables.length; i++ ) {
	    let link = printables[i]; 
	    console.log( link.GHIssueId,
			 link.GHIssueNum,
			 this.fill( link.GHCardId, 10 ),
			 this.fill( link.GHIssueTitle, 35 ),
			 link.GHColumnId == -1 ? this.fill( "-1", 10 ) : this.fill( link.GHColumnId, 10 ),
			 this.fill( link.GHColumnName, 20 ),
			 link.GHProjectId == -1 ? this.fill( "-1", 10 ) : this.fill( link.GHProjectId, 10 ),
			 this.fill( link.GHProjectName, 15 ),
			 link.flatSource == -1 ? this.fill( "-1", 10 ) : this.fill( link.flatSource, 10 ),
			 // link.GHRepo,
		       );
	}
    }

    showLocs( count ) {
	let printables = [];
	for( const [_, clocs] of Object.entries( this.locs )) {
	    for( const [_, loc] of Object.entries( clocs )) {
		// if( loc.Active == "true" ) { printables.push( loc ); }
		printables.push( loc );
	    }
	}

	if( printables.length > 0 ) {
	    console.log( this.fill( "Repo", 20 ),
			 this.fill( "ProjId", 10 ), 
			 this.fill( "ProjName", 15 ),
			 this.fill( "ColId", 10),
			 this.fill( "ColName", 20)
		       );
	}


	let start = 0;
	if( typeof count !== 'undefined' ) { start = printables.length - count; }
	start = start < 0 ? 0 : start;

	for( let i = start; i < printables.length; i++ ) {
	    const loc = printables[i];
	    console.log( this.fill( loc.GHRepo, 20 ),
			 loc.GHProjectId == -1 ? this.fill( "-1", 10 ) : this.fill( loc.GHProjectId, 10 ),
			 this.fill( loc.GHProjectName, 15 ),
			 loc.GHColumnId == -1 ? this.fill( "-1", 10 ) : this.fill( loc.GHColumnId, 10 ),
			 this.fill( loc.GHColumnName, 20 ), this.fill( loc.Active, 7 )
		       );
	}
    }

    toString() {
	this.show(10);
	this.showLocs();
	return "";
    }
}

exports.Linkage = Linkage;
