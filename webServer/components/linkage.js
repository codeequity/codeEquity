var assert = require('assert');

const auth = require( "../auth");
var utils = require('../utils');
var config  = require('../config');

var ghUtils = require('../ghUtils');
var gh      = ghUtils.githubUtils;
var ghSafe  = ghUtils.githubSafe;


// linkage is {issueId: {cardId: {} }}
class Linkage {

    constructor( ) {
	this.links  = {};
    }


    async initOneRepo( authData, fn ) {
	let peqs = await utils.getPeqs( authData, { "GHRepo": fn } );
	if( peqs == -1 ) { peqs = []; }
	
	let fnParts = fn.split('/');
	
	let baseLinks = [];
	await gh.getBasicLinkDataGQL( authData.pat, fnParts[0], fnParts[1], baseLinks, -1 )
	    .catch( e => console.log( "Error.  GraphQL for basic linkage failed.", e ));

	// XXX Could save a good number of calls to GH with this data
	// flatSource is a column id.  May not be in current return data, since source is orig col, not cur col.
	let cols = [];
	await gh.getRepoColsGQL( authData.pat, fnParts[0], fnParts[1], cols, -1 )
	    .catch( e => console.log( "Error.  GraphQL for repo cols failed.", e ));
	
	this.populateLinkage( authData, fn, baseLinks );

	// peq add: cardTitle, colId, colName, projName
	// XXX this could be smarter, i.e. are peqs >> non-peqs?  zero out instead of fill
	let badPeq = false;
	let badSource = false;
	for( const peq of peqs ) {
	    if( peq.Active == "false" ) {
		console.log( authData.who, "Skipping inactive peq", peq.GHIssueTitle );
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
	    
	    link.GHCardTitle   = card.title;
	    link.GHColumnId    = card.columnId.toString();
	    link.GHProjectName = card.projectName;
	    link.GHColumnName  = card.columnName;

	    // need a name here
	    link.flatSource    = peq.GHProjectSub[ peq.GHProjectSub.length - 1 ];
	    if( config.PROJ_COLS.includes( link.flatSource )) { link.flatSource = -1; }
	    // XXX could make this faster if cols use gets broader.
	    if( link.flatSource != -1 ) {
		const colData = cols.find( col => col.projectId == link.GHProjectId && col.columnName == link.flatSource );
		if( typeof colData !== 'undefined' ) { link.flatSource = colData.columnId.toString(); }
		else { link.flatSource = -1; }   // e.g. projSub is (master)[softCont, dataSec]
	    }
	}

	assert( !badPeq  );  // will be caught.
	return baseLinks; 
    }

    
    // XXX Fix cold start.  This should occur at startup, in order of most active repos.
    // populateCEServer migrates a project into CE.  lots of extra checks.
    // init here is to handle a server restart, only 'remembers' official CE projects.
    async init( authData, owner ) {
	let tstart = Date.now();
	console.log( "Init linkages" );

	let fullNames = await utils.getRepoStatus( authData, -1 );   // get all repos
	if( fullNames == -1 ) { return; }
	for( const entry of fullNames ) {
	    let fn = entry.GHRepo;
	    console.log( ".. working on", fn );
	    await this.initOneRepo( authData, fn )
		.catch( e => console.log( "Error.  Init Linkage failed.", e ));
	}
	// console.log( this.links );
	console.log( "Linkage init done", Object.keys(this.links).length, "links", Date.now() - tstart, "millis" );
	this.show();
    }

    fromJson( linkData ) {
	this.links = {};
	console.log( "Creating ghLinks from json data" );
	for( const [_, clinks] of Object.entries( linkData ) ) {
	    for( const [_, link] of Object.entries( clinks ) ) {
		this.addLinkage( ["", "fromJson"], link.GHRepo, link.GHIssueId, link.GHIssueNum,
				 link.GHProjectId, link.GHProjectName, link.GHColumnId, link.GHColumnName,
				 link.GHCardId, link.GHCardTitle );
	    }
	}
    }
    
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
	link.GHCardTitle   = issueTitle;   // XXX rename
	link.flatSource    = haveSource ? source : link.GHColumnId;

	// Do not track source col if is in full layout
	if( !haveSource && config.PROJ_COLS.includes( link.GHColumnName ) ) { link.flatSource = -1; }
	return link;
    }

    populateLinkage( authData, fn, baseLinkData ) {
	console.log( authData.who, "Populate linkage" );
	for( const elt of baseLinkData ) {
	    this.addLinkage( authData, fn, elt.issueId, elt.issueNum, elt.projectId, config.EMPTY, -1, config.EMPTY, elt.cardId, config.EMPTY );
	}
    }
    

    getUniqueLink( authData, issueId ) {

	console.log( authData.who, "Get unique link", issueId );
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
    // XXX down the road, will want to index by repo - too many otherwise.
    getLinks( authData, query ) {

	console.log( authData.who, "get Links", query );
	let issueId   = query.hasOwnProperty( "issueId" )   ? query.issueId.toString() : -1;
	let cardId    = query.hasOwnProperty( "cardId" )    ? query.cardId.toString()  : -1;
	let repo      = query.hasOwnProperty( "repo" )      ? query.repo               : config.EMPTY;
	let projName  = query.hasOwnProperty( "projName" )  ? query.projName           : config.EMPTY;
	let cardTitle = query.hasOwnProperty( "cardTitle" ) ? query.cardTitle          : config.EMPTY;
	
	// Is at least one condition active
	if( issueId == -1 &&
	    cardId == -1  &&
	    repo == config.EMPTY &&
	    projName == config.EMPTY &&
	    cardTitle == config.EMPTY
	  ) {
	    return -1;
	}

	let links = [];
	for( const [key, clinks] of Object.entries( this.links ) ) {  // one clinks is {cardId: { <link>}, cardId2: { <link> }}
	    // Note, during initial resolve, this may NOT be 1:1 issue:card
	    for( const [_, link] of Object.entries( clinks ) ) {
		let match = true;
		match = issueId == -1             ? match : match && (link.GHIssueId == issueId);
		match = cardId == -1              ? match : match && (link.GHCardId  == cardId);
		match = repo == config.EMPTY      ? match : match && (link.GHRepo    == repo);
		match = projName == config.EMPTY  ? match : match && (link.GHProjectName == projName );
		match = cardTitle == config.EMPTY ? match : match && (link.GHCardTitle == cardTitle );
		
		if( match ) { links.push( link ); }
	    }
	}

	if( links.length == 0 ) { links = -1; }
	return links;
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
	link.GHCardTitle   = config.EMPTY;
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

	link.GHCardTitle  = newTitle;

	return true;
    }

    // primary keys have changed.
    rebuildLinkage( authData, oldLink, issueData, cardId ) {
	console.log( authData.who, "Rebuild linkage", oldLink.GHIssueNum, "->", issueData[0] );
	let link = this.addLinkage( authData,
				    oldLink.GHRepo,
				    issueData[0].toString(), issueData[1].toString(),
				    oldLink.GHProjectId, oldLink.GHProjectName,
				    oldLink.GHColumnId, oldLink.GHColumnName,
				    cardId.toString(),
				    oldLink.GHCardTitle, oldLink.flatSource );
	
	this.removeLinkage( { "authData": authData, "issueId": oldLink.GHIssueId, "cardId": oldLink.GHCardId } );

	return link;
    }

    removeLinkage({ authData, issueId, cardId }) {
	let retVal = false;
	if( !authData ) { console.log( "missing authData" ); return retVal; }
	if( !issueId )       { console.log( "missing issueId" ); return retVal; }
	// cardId can be missing

	console.log( authData.who, "Remove link for issueId:", issueId );

	if( !this.links.hasOwnProperty( issueId ))                { return retVal; }  // may see multiple deletes
	if( Object.keys( this.links[issueId] ).length == 0 )      { return retVal; }
	else if( Object.keys( this.links[issueId] ).length == 1 ) { delete this.links[issueId]; }
	else                                                      { delete this.links[issueId][cardId]; }
	retVal = true;
	return retVal;
    }

    purge( repo ) {
	console.log( "Removing links for", repo );
	let killList = [];
	for( const [iss,clink] of Object.entries( this.links )) {
	    for( const [cid,link] of Object.entries( clink )) {
		if( link.GHRepo == repo ) { killList.push( link.GHIssueId ); }
	    }
	}
	// console.log( killList );
	for( const id of killList ) { delete this.links[id]; }
	return true;
    }

    fill( val, num ) {
	let retVal = "";
	for( var i = 0; i < num; i++ ) {
	    if( val.length > i ) { retVal = retVal.concat( val[i] ); }
	    else                 { retVal = retVal.concat( " " ); }
	}
	return retVal
    }

    // XXX stringiness vs. intyness of link is bass ackwards.
    show() {
	console.log( "IssueId",
		     "IssueNum",
		     this.fill( "CardId", 7),
		     this.fill( "Title", 35 ),
		     this.fill( "ColId", 10),
		     this.fill("ColName", 20),
		     this.fill( "ProjId", 10 ), 
		     this.fill( "ProjName", 15 ),
		     this.fill( "sourceCol", 10 )
		   );
	
	for( const [issueId, clinks] of Object.entries( this.links )) {
	    for( const [_, link] of Object.entries( clinks )) {
		console.log( link.GHIssueId,
			     link.GHIssueNum,
			     this.fill( link.GHCardId, 10 ),
			     this.fill( link.GHCardTitle, 35 ),
			     link.GHColumnId == -1 ? this.fill( "-1", 10 ) : this.fill( link.GHColumnId, 10 ),
			     this.fill( link.GHColumnName, 20 ),
			     link.GHProjectId == -1 ? this.fill( "-1", 10 ) : this.fill( link.GHProjectId, 10 ),
			     this.fill( link.GHProjectName, 15 ),
			     link.flatSource == -1 ? this.fill( "-1", 10 ) : this.fill( link.flatSource, 10 ),
			   );
	    }
	}
    }
}

exports.Linkage = Linkage;
