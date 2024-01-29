const assert = require( 'assert' );

const config   = require( '../config' );
const ceAuth   = require( '../auth/ceAuth' );

const utils    = require( '../utils/ceUtils' );
const awsUtils = require( '../utils/awsUtils' );

const locData  = require( './locData' );

// Host-specific implementations
const gh2LU    = require( './gh/gh2/linkageUtils' );
const ghcLU    = require( './gh/ghc/linkageUtils' );

// Linkage table contains all identifying info related to peq issues
// Linkage table does not contain column, project name or issue name for carded issues
// linkage is { issueId: { cardId: {} }}
// linkage is NOT stored in dynamo.

// Loc table is projects and columns per repo.

// Loc table contains all proj/col in repo.  linkage table will only have that info where there are PEQs.
// All adds to loc update aws, except batch related adds present herein.
// loc was { pid: { colId: {} }}
// loc is  { ceProjId: { pid: { colId: {} }}} where pid is the unique project id within ceProjId.hostPlatform
// loc IS stored in dynamo, for speed and privacy benefits during ingest (ceFlutter).
// NOTE: colId is no longer unique across projects for GH2.  Within a project, it is.

class Linkage {

    constructor( ) {
	this.links = {};   // { ceProjId: { issueId:    { cardId:    {link}}}}
	this.locs  = {};   // { ceProjId: { hostProjId: { hostColId: {loc }}}}
    }


    // For each ceProject
    async initOneCEProject( authData, entry, preferredRepoId ) {

	preferredRepoId = typeof preferredRepoId === 'undefined' ? -1 : preferredRepoId;
	
	let host  = utils.validField( entry, "HostPlatform" )       ? entry.HostPlatform                    : "";
	let pms   = utils.validField( entry, "ProjectMgmtSys" )     ? entry.ProjectMgmtSys                  : "";
	
	// Wait later
	let peqs = awsUtils.getPEQs( authData, { "CEProjectId": entry.CEProjectId } );

	let res       = {};
	let baseLinks = [];
	let locData   = [];

	// Init repo with CE_ACTOR, which is typically a builder account that needs full access.
	if( host == config.HOST_GH ) {
	    if(      pms == config.PMS_GHC ) { res = await ghcLU.buildHostLinks( authData, this, entry, baseLinks, locData ); }
	    else if( pms == config.PMS_GH2 ) { res = await gh2LU.buildHostLinks( authData, this, entry, preferredRepoId, baseLinks, locData ); }

	    baseLinks = res.links;
	    locData   = res.locs; 
	}
	
	// console.log( authData.who, "LINKAGE: Locs",  locData );
	// console.log( authData.who, "LINKAGE: Links", baseLinks );

	awsUtils.refreshLinkageSummary( authData, entry.CEProjectId, locData );
	
	// peq add: cardTitle, colId, colName, projName - carded issues do not track this.
	// flatSource is a column id.  May not be in current return data, since source is orig col, not cur col.
	// XXX this could be smarter, i.e. are peqs >> non-peqs?  zero out instead of fill
	let badPeq = false;
	let badSource = false;
	peqs = await peqs;
	if( peqs === -1 ) { peqs = []; }
	for( const peq of peqs ) {
	    if( peq.Active == "false" ) {
		// console.log( authData.who, "Skipping inactive peq", peq.HostIssueTitle );
		continue;
	    }
	    const iid = peq.HostIssueId;
	    let link = this.getUniqueLink( authData, entry.CEProjectId, iid );
	    if( link === -1 ) {
		console.log( authData.who, "Did you remove an issue without removing the corresponding PEQ?", peq.PEQId, peq.HostIssueTitle );
		// this.show(20);
		badPeq = true;
		continue;
	    }

	    let card = baseLinks.find( datum => datum.hostCardId == link.hostCardId );

	    // Peqs can only be queried by ceProject.  If the peq does not come from the preferred repo, it is not relevant.
	    // Does link repo match preferred, if it exists?  
	    if( preferredRepoId == -1 || link.hostRepoId == preferredRepoId ) {
	    
		link.hostIssueName   = card.hostIssueName;
		link.hostColumnId    = card.hostColumnId.toString();
		link.hostProjectName = card.hostProjectName;
		link.hostColumnName  = card.hostColumnName;
		
		// need a name here
		link.flatSource    = peq.HostProjectSub[ peq.HostProjectSub.length - 1 ];
		if( config.PROJ_COLS.includes( link.flatSource )) { link.flatSource = -1; }
		// XXX could make this faster if cols use gets broader.
		if( link.flatSource != -1 ) {
		    const loc = locData.find( loc => loc.hostProjectId == link.hostProjectId && loc.hostColumnName == link.flatSource );
		    if( typeof loc !== 'undefined' ) { link.flatSource = loc.hostColumnId; }
		    else { link.flatSource = -1; }   // e.g. projSub is (master)[softCont, dataSec]
		}
	    }
	}

	assert( !badPeq, "Mismatching PEQs."  );  // will be caught.
	return baseLinks; 
    }

    
    // Note: Run init in order of most recently and most active repos.
    // populateCEServer migrates a project into CE.  lots of extra checks.
    // init here is to handle a server restart, only 'remembers' official CE projects.
    async init( authData ) {
	let tstart = Date.now();
	console.log( authData.who, "Init linkages" );
	
	let ceProjects = await awsUtils.getProjectStatus( authData, -1 );   // get all ce projects
	if( ceProjects === -1 ) { return; }
	let promises = [];
	for( const entry of ceProjects ) {
	    promises.push( this.initOneCEProject( authData, entry )
			   .catch( e => console.log( authData.who, "Error.  Init Linkage failed.", e )) );
	}
	await Promise.all( promises );
	console.log( authData.who, "Linkage init done", Object.keys(this.links).length, "links", Date.now() - tstart, "millis" );
	this.show(50);
	this.showLocs();
    }

    // linkData is ceProject-specific, i.e. a single "cplinks"
    fromJson( authData, linkData ) {
	this.links = {};
	// console.log( "Creating ghLinks from json data", linkData );
	for( const [_, clinks] of Object.entries( linkData ) ) {
	    for( const [_, plinks] of Object.entries( clinks ) ) {
		for( const [col, link] of Object.entries( plinks ) ) {
		    // note: hostUtil used during split resolution to maintain 1:1 mapping
		    this.addLinkage( authData, link.ceProjectId, link, { source: link.flatSource } );
		}
	    }
	}
    }

    // Linkage table only contains situated issue data, but only some if issue is just carded
    addLinkage( authData, ceProjId, orig, specials ) {
	let source   = typeof specials !== 'undefined' && specials.hasOwnProperty( "source" )   ? specials.source   : false;
	let populate = typeof specials !== 'undefined' && specials.hasOwnProperty( "populate" ) ? specials.populate : false;
	
	// console.log( authData.who, "add link", ceProjId, orig.hostIssueId, orig.hostCardId, orig.hostColumnName, orig.hostColumnId, orig.hostIssueName );
	
	assert( ceProjId         != config.EMPTY );
	assert( orig.hostIssueId != config.EMPTY );
	assert( orig.hostCardId  != config.EMPTY );
	if( !utils.validField( this.links, ceProjId ) )                                    { this.links[ceProjId] = {}; }
	if( !utils.validField( this.links[ceProjId], orig.hostIssueId ) )                  { this.links[ceProjId][orig.hostIssueId] = {}; }
	if( !utils.validField( this.links[ceProjId][orig.hostIssueId], orig.hostCardId ) ) { this.links[ceProjId][orig.hostIssueId][orig.hostCardId] = {}; }

	let link = this.links[ceProjId][orig.hostIssueId][orig.hostCardId];

	link.ceProjectId     = ceProjId;
	link.hostRepoName    = typeof orig.hostRepoName     === 'undefined' ? config.EMPTY : orig.hostRepoName;
	link.hostRepoId      = typeof orig.hostRepoId       === 'undefined' ? config.EMPTY : orig.hostRepoId;
	link.hostIssueId     = typeof orig.hostIssueId      === 'undefined' ? config.EMPTY : orig.hostIssueId.toString();
	link.hostIssueNum    = typeof orig.hostIssueNum     === 'undefined' ? config.EMPTY : orig.hostIssueNum.toString();
	link.hostProjectId   = typeof orig.hostProjectId    === 'undefined' ? config.EMPTY : orig.hostProjectId.toString();
	link.hostProjectName = typeof orig.hostProjectName  === 'undefined' ? config.EMPTY : orig.hostProjectName;
	link.hostColumnId    = typeof orig.hostColumnId     === 'undefined' ? config.EMPTY : orig.hostColumnId.toString();
	link.hostColumnName  = typeof orig.hostColumnName   === 'undefined' ? config.EMPTY : orig.hostColumnName;
	link.hostCardId      = typeof orig.hostCardId       === 'undefined' ? config.EMPTY : orig.hostCardId.toString();
	link.hostIssueName   = typeof orig.hostIssueName    === 'undefined' ? config.EMPTY : orig.hostIssueName;   
	link.hostUtility     = typeof orig.hostUtility      === 'undefined' ? config.EMPTY : orig.hostUtility;   
	link.flatSource      = source ? source : link.hostColumnId;

	// Do not track some information during initial populate.  If these are for peqs, they get filled in later during initOne
	if( populate ) {
	    link.hostIssueName   = config.EMPTY;
	    link.hostColumnId    = config.EMPTY;
	    link.hostProjectName = config.EMPTY;
	    link.hostColumnName  = config.EMPTY;
	}
	
	// Do not track source col if is in full layout
	if( !source && config.PROJ_COLS.includes( link.hostColumnName ) ) { link.flatSource = -1; }

	return link;
    }


    // LocData will be for specific CEProjectId, i.e. a "cplocs"
    // For testing, locData grabbed from server and queried, do NOT modify AWS.
    fromJsonLocs( locData ) {
	this.links = {};

	// Need to purge first!
	this.purgeLocs( "TESTING-FROMJSONLOCS" );
	
	// console.log( "Creating ghLinks.locs from json data" );
	for( const [_, clocs] of Object.entries( locData ) ) {
	    for( const [_, plocs] of Object.entries( clocs ) ) {
		for( const [col, loc] of Object.entries( plocs )) {
		    this.addLoc( {}, loc );
		}
	    }
	}
    }

    // ProjectID is the kanban project.  repo:pid  is 1:many
    async addLoc( authData, locD, pushAWS = false ) {
	locD.hostColumnId  = locD.hostColumnId.toString();
	locD.hostProjectId = locD.hostProjectId.toString();
	let ceProjId       = locD.ceProjectId;

	if( typeof ceProjId === 'undefined' ) { console.log( authData.who, "Warning.  Linkage addLoc was called without a CE Project Id." ); }
	    
	if( !utils.validField( this.locs, ceProjId ))                                        { this.locs[ceProjId] = {}; }
	if( !utils.validField( this.locs[ceProjId], locD.hostProjectId ))                    { this.locs[ceProjId][locD.hostProjectId] = {}; }
	if( !utils.validField( this.locs[ceProjId][locD.hostProjectId], locD.hostColumnId )) { this.locs[ceProjId][locD.hostProjectId][locD.hostColumnId] = new locData.LocData(); }
											    
	let loc = this.locs[ceProjId][locD.hostProjectId][locD.hostColumnId];
	loc.fromLoc( locD ); 

	// Must wait.. aws dynamo ops handled by multiple threads.. order of processing is not dependable in rapid-fire situations.
	// No good alternative - refresh could be such that earlier is processed later in dynamo
	if( pushAWS ) { await awsUtils.updateLinkageSummary( authData, ceProjId, loc ); }
	
	return loc;
    }

    getUniqueLink( authData, ceProjId, issueId ) {

	// this.show(5);
	let retVal = -1;
	if( utils.validField( this.links, ceProjId ) && utils.validField( this.links[ceProjId], issueId )) {
	    let issueLinks = Object.entries( this.links[ceProjId][issueId] );  // [ [cardId, link], [cardId, link] ...]
	    
	    if      ( issueLinks.length < 1 ) { console.log(authData.who, "Link not found.", issueId ); }  // 204
	    else if ( issueLinks.length > 1 ) { console.log(authData.who, "Semantic error.  More items found than expected.", issueId ); } // 422
	    else                              { retVal = issueLinks[0][1]; }
	    if( retVal == -1 ) { console.log( issueLinks ); }
	}
	return retVal;
    }


    // issueId:cardId 1:m  cardId:issueId 1:1
    // note: id = -1 here is simply used to turn on/off match.  does not grow beyond this func. config.empty signals untracked.
    getLinks( authData, query ) {

	if( typeof query.ceProjId === 'undefined' && typeof query.pid === 'undefined' ) {
	    console.log( authData.who, "Error.  Neither ceProjectId nor host project id were not specified in Locs query." );
	    assert( false );
	}

	const ceProjId    = query.ceProjId;
	const repo        = utils.validField( query, "repo" )        ? query.repo               : config.EMPTY;
	const repoId      = utils.validField( query, "repoId" )      ? query.repoId.toString()  : config.EMPTY;
	const issueId     = utils.validField( query, "issueId" )     ? query.issueId.toString() : -1;
	const cardId      = utils.validField( query, "cardId" )      ? query.cardId.toString()  : -1;
	const pid         = utils.validField( query, "pid" )         ? query.pid                : -1;
	const projName    = utils.validField( query, "projName" )    ? query.projName           : config.EMPTY;
	const colName     = utils.validField( query, "colName" )     ? query.colName            : config.EMPTY;
	const issueTitle  = utils.validField( query, "issueTitle" )  ? query.issueTitle         : config.EMPTY;
	const hostUtility = utils.validField( query, "hostUtility" ) ? query.hostUtility        : config.EMPTY;

	// console.log( authData.who, "get Links", ceProjId, issueId, cardId, pid, projName, colName, issueTitle );

	let links = [];

	let seed = {};
	if( typeof ceProjId === 'undefined' ) { seed = this.links; }
	else                                  { seed = this.links[ceProjId]; }

	// At times, locs can be purged.  Without recreating here, object.entries below is unhappy
	if( !seed ) { return -1; }

	for( const [cpid, clinks] of Object.entries( seed ) ) {  // one clinks is {cardId: { <link>}, cardId2: { <link> }}
	    // Note, during initial resolve, this may NOT be 1:1 issue:card
	    for( const [_, link] of Object.entries( clinks ) ) {
		let match = true;
		match = issueId == -1               ? match : match && (link.hostIssueId     == issueId);
		match = cardId == -1                ? match : match && (link.hostCardId      == cardId);
		match = pid == -1                   ? match : match && (link.hostProjectId   == pid);
		match = repo == config.EMPTY        ? match : match && (link.hostRepoName    == repo);
		match = repoId == config.EMPTY      ? match : match && (link.hostRepoId      == repoId);
		match = projName == config.EMPTY    ? match : match && (link.hostProjectName == projName );
		match = colName == config.EMPTY     ? match : match && (link.hostColumnName  == colName );
		match = issueTitle == config.EMPTY  ? match : match && (link.hostIssueName   == issueTitle );
		match = ceProjId == config.EMPTY    ? match : match && (link.ceProjectId     == ceProjId );
		match = hostUtility == config.EMPTY ? match : match && (link.hostUtility     == hostUtility );
		
		if( match ) { links.push( link ); }
	    }
	}

	/*
	let links = [];
	if( this.links[ceProjId] == null ) { return -1; }  // could be an empty ceproj
	
	for( const [_, clinks] of Object.entries( this.links[ceProjId] ) ) {  // one clinks is {cardId: { <link>}, cardId2: { <link> }}
	    // Note, during initial resolve, this may NOT be 1:1 issue:card
	    for( const [_, link] of Object.entries( clinks ) ) {
		let match = true;
		match = issueId == -1               ? match : match && (link.hostIssueId     == issueId);
		match = cardId == -1                ? match : match && (link.hostCardId      == cardId);
		match = pid == -1                   ? match : match && (link.hostProjectId   == pid);
		match = repo == config.EMPTY        ? match : match && (link.hostRepoName    == repo);
		match = repoId == config.EMPTY      ? match : match && (link.hostRepoId      == repoId);
		match = projName == config.EMPTY    ? match : match && (link.hostProjectName == projName );
		match = colName == config.EMPTY     ? match : match && (link.hostColumnName  == colName );
		match = issueTitle == config.EMPTY  ? match : match && (link.hostIssueName   == issueTitle );
		match = ceProjId == config.EMPTY    ? match : match && (link.ceProjectId     == ceProjId );
		match = hostUtility == config.EMPTY ? match : match && (link.hostUtility     == hostUtility );
		
		if( match ) { links.push( link ); }
	    }
	}
	*/
	
	if( links.length == 0 ) { links = -1; }
	return links;
    }

    iterateLocs( authData, query, matchFunc ) {
	if( typeof query.ceProjId === 'undefined' && typeof query.pid === 'undefined' ) {
	    console.log( authData.who, "Error.  Neither ceProjectId nor host project id were not specified in Locs query." );
	    assert( false );
	}

	const ceProjId  = query.ceProjId;
	const pid       = utils.validField( query, "pid" )      ? query.pid.toString()    : -1;
	const colId     = utils.validField( query, "colId" )    ? query.colId.toString()  : -1;
	const projName  = utils.validField( query, "projName" ) ? query.projName          : config.EMPTY;
	const colName   = utils.validField( query, "colName" )  ? query.colName           : config.EMPTY;

	let locs = [];

	let seed = {};
	if( typeof ceProjId === 'undefined' ) { seed = this.locs; }
	else                                  { seed = this.locs[ceProjId]; }

	// At times, locs can be purged.  Without recreating here, object.entries below is unhappy
	if( !seed ) { return -1; }

	for( const [cpid, clocs] of Object.entries( seed ) ) {  // one clocs is {pid1: { coldata }, pid2: { coldata }}
	    for( const [_, loc] of Object.entries( clocs ) ) {            
		let match = true;
		
		match = pid == -1                ? match : match && (loc.hostProjectId    == pid);
		match = colId == -1              ? match : match && (loc.hostColumnId     == colId);
		match = ceProjId == config.EMPTY ? match : match && (loc.ceProjectId      == ceProjId);
		match = projName == config.EMPTY ? match : match && (loc.hostProjectName  == projName);
		match = colName == config.EMPTY  ? match : match && (loc.hostColumnName   == colName);
		match =                                    match && (loc.active           == "true");

		if( match ) { matchFunc( locs, loc ); }
		// console.log( "locs match", query, match, loc, locs )
	    }
	}

	if( locs.length == 0 ) { locs = -1; }
	return locs;
    }

    getLocs( authData, query ) {
	let matchFunc = function (locs, loc ) { locs.push( loc ); };
	let locs = this.iterateLocs( authData, query, matchFunc );
	return locs;
    }

    /*
    // No match on utility slot.  yet?
    // note: ids = -1 here is simply used to turn on/off match.  does not grow beyond this func.
    // { ceProjId: { pid: { colId: {} } pid: { colId: {}}},  ceProjId: { pid: { colId: {} } pid: { colId: {}}}}
    getLocs( authData, query ) {
	// console.log( authData.who, "get Locs", query );
	// this.showLocs();
	    
	if( typeof query.ceProjId === 'undefined' && typeof query.pid === 'undefined' ) {
	    console.log( authData.who, "Error.  Neither ceProjectId nor host project id were not specified in Locs query." );
	    assert( false );
	}

	const ceProjId  = query.ceProjId;
	const pid       = utils.validField( query, "pid" )      ? query.pid.toString()    : -1;
	const colId     = utils.validField( query, "colId" )    ? query.colId.toString()  : -1;
	const projName  = utils.validField( query, "projName" ) ? query.projName          : config.EMPTY;
	const colName   = utils.validField( query, "colName" )  ? query.colName           : config.EMPTY;

	let locs = [];

	let seed = {};
	if( typeof ceProjId === 'undefined' ) { seed = this.locs; }
	else                                  { seed = this.locs[ceProjId]; }

	// At times, locs can be purged.  Without recreating here, object.entries below is unhappy
	if( !seed ) { return -1; }

	for( const [cpid, clocs] of Object.entries( seed ) ) {  // one clocs is {pid1: { coldata }, pid2: { coldata }}
	    for( const [_, loc] of Object.entries( clocs ) ) {            
		let match = true;
		
		match = pid == -1                ? match : match && (loc.hostProjectId    == pid);
		match = colId == -1              ? match : match && (loc.hostColumnId     == colId);
		match = ceProjId == config.EMPTY ? match : match && (loc.ceProjectId      == ceProjId);
		match = projName == config.EMPTY ? match : match && (loc.hostProjectName  == projName);
		match = colName == config.EMPTY  ? match : match && (loc.hostColumnName   == colName);
		match =                                    match && (loc.active           == "true");
		
		if( match ) { locs.push( loc ); }
	    }
	}
	
	// XXX

	// At times, locs can be purged.  Without recreating here, object.entries below is unhappy
	if( !this.locs[ceProjId] ) { return -1; }

	for( const [_, clocs] of Object.entries( this.locs[ceProjId] ) ) {// one clocs is {pid1: { coldata }, pid2: { coldata }}
	    for( const [_, loc] of Object.entries( clocs ) ) {            
		let match = true;
		
		match = pid == -1                ? match : match && (loc.hostProjectId    == pid);
		match = colId == -1              ? match : match && (loc.hostColumnId     == colId);
		match = ceProjId == config.EMPTY ? match : match && (loc.ceProjectId      == ceProjId);
		match = projName == config.EMPTY ? match : match && (loc.hostProjectName  == projName);
		match = colName == config.EMPTY  ? match : match && (loc.hostColumnName   == colName);
		match =                                    match && (loc.active           == "true");
		
		if( match ) { locs.push( loc ); }
	    }
	}

	    
	if( locs.length == 0 ) { locs = -1; }
	return locs;
    }
    */
    
    
    // Zero out fields in linkage table no longer being tracked
    rebaseLinkage( authData, ceProjId, issueId ) {
	console.log( authData.who, "Rebasing link for", ceProjId, issueId );
	let cLinks = this.links[ceProjId][issueId];
	assert( Object.keys( cLinks ).length == 1 );
	let [_, link] = Object.entries( cLinks )[0];

	link.hostProjectName = config.EMPTY;
	link.hostColumnId    = config.EMPTY;
	link.hostColumnName  = config.EMPTY;
	link.hostIssueName   = config.EMPTY;
	link.flatSource      = -1;
	return link;
    }

    updateLinkage( authData, ceProjId, issueId, cardId, newColId, newColName ) {
	console.log( authData.who, "Update linkage for", ceProjId, issueId, cardId, newColId );
	let link = this.links[ceProjId][issueId][cardId];
	assert( link !== 'undefined' );

	link.hostColumnId   = newColId.toString();
	link.hostColumnName = newColName;

	// update, need to track specially
	if( !config.PROJ_COLS.includes( newColName ) ) { link.flatSource = link.hostColumnId; }
	return link;
    }

    updateTitle( authData, linkData, newTitle ) {
	let link = this.links[linkData.ceProjectId][linkData.hostIssueId][linkData.hostCardId];
	assert( link !== 'undefined' );

	link.hostIssueName  = newTitle;

	return true;
    }

    // issue, card ids have changed.
    rebuildLinkage( authData, oldLink, issueData, splitTitle ) {
	console.log( authData.who, "Rebuild linkage", oldLink.ceProjectId, oldLink.hostIssueNum, "->", issueData[0], issueData[2] );
	let newTitle = oldLink.hostIssueName;
	if( typeof splitTitle !== 'undefined' ) {
	    newTitle = oldLink.hostColumnId == config.EMPTY ? config.EMPTY : splitTitle;
	}
	let alink = {};
	alink.hostRepoName     = oldLink.hostRepoName;
	alink.hostRepoId       = oldLink.hostRepoId;
	alink.hostIssueId      = issueData[0].toString();
	alink.hostIssueNum     = issueData[1].toString();
	alink.hostProjectId    = oldLink.hostProjectId;
	alink.hostProjectName  = oldLink.hostProjectName;
	alink.hostColumnId     = oldLink.hostColumnId;
	alink.hostColumnName   = oldLink.hostColumnName;
	alink.hostCardId       = issueData[2].toString();
	alink.hostIssueName    = newTitle;
	alink.hostUtility      = oldLink.hostUtility;
	let link = this.addLinkage( authData, oldLink.ceProjectId, alink, { source: oldLink.flatSource } );
	
	this.removeLinkage( { "authData": authData, "ceProjId": oldLink.ceProjectId, "issueId": oldLink.hostIssueId, "cardId": oldLink.hostCardId } );

	return link;
    }

    removeLinkage({ authData, ceProjId, issueId, cardId }) {
	let retVal = false;
	if( !authData ) { console.log( authData.who, "missing authData" ); return retVal; }
	if( !issueId )  { console.log( authData.who, "missing issueId" );  return retVal; }
	if( !ceProjId ) { console.log( authData.who, "missing ceProjId" ); return retVal; }
	// cardId can be missing

	// console.log( authData.who, "Remove link for issueId:", ceProjId, issueId );

	if( !utils.validField( this.links, ceProjId ))                      { return retVal; }  // may see multiple deletes
	if( !utils.validField( this.links[ceProjId], issueId ))             { return retVal; }  // may see multiple deletes
	if( Object.keys( this.links[ceProjId][issueId] ).length == 0 )      { return retVal; }
	else if( Object.keys( this.links[ceProjId][issueId] ).length == 1 ) { delete this.links[ceProjId][issueId]; }
	else                                                                { delete this.links[ceProjId][issueId][cardId]; }
	retVal = true;
	return retVal;
    }

    removeLocs({ authData, ceProjId, pid, colId }) {
	if( !authData ) { console.log( authData.who, "missing authData" ); return false; }

	if( colId )    { console.log( authData.who, "Remove loc for colId:", ceProjId, colId ); } // one delete
	else if( pid ) { console.log( authData.who, "Remove locs for pid:", ceProjId, pid ); }    // many deletes

	let query = { authData: authData };
	if( typeof pid       !== 'undefined' ) { query.pid = pid; }
	if( typeof colId     !== 'undefined' ) { query.colId = colId; }
	if( typeof ceProjId  !== 'undefined' ) { query.ceProjId = ceProjId; }

	let matchFunc = function (locs, loc ) {
	    loc.active = false;
	    locs.push( loc );
	};

	let locs = this.iterateLocs( authData, query, matchFunc );
	if( locs == -1 ) { return; }

	// Need to refresh AWS.  In most cases, locs belong to passed in ceProjId.
	// However, if deleting a project, it can cross ceProjId.   Need to construct {ceProjId: [loc, loc], ...} then refresh
	let allLocs = {};
	for( const loc of locs ) {
	    if( utils.validField( allLocs, loc.ceProjectId )) { allLocs[loc.ceProjectId].push( loc ); }
	    else                                              { allLocs[loc.ceProjectId] = [ loc ]; }
	}
	
	for( const [cpid, clocs] of Object.entries( allLocs ) ) {  
	    awsUtils.refreshLinkageSummary( authData, cpid, clocs, false );
	}
    }

    // set .active flag to false.  getLocs requires active true, but showLocs may show inactive during debugging.
    // This is faster, but in an unimportant way.  removeLocs is not a time-sensitive op, nor is it a common op.  This code is
    // hard to maintain, brittle.
    /*
    removeLocs({ authData, ceProjId, pid, colId }) {
	if( !authData ) { console.log( authData.who, "missing authData" ); return false; }

	if( colId )    { console.log( authData.who, "Remove loc for colId:", ceProjId, colId ); } // one delete
	else if( pid ) { console.log( authData.who, "Remove locs for pid:", ceProjId, pid ); }    // many deletes


	let havePID = typeof pid !== 'undefined';
	let haveCID = typeof colId  !== 'undefined';
	let cpid    = "";

	// Easy cases, already do not exist
	// No need to check for empty ceProjectIds, since there is nothing to set inactive.
	if( (!havePID && !haveCID) ||                                                            // nothing specified
	    (!utils.validField( this.locs, ceProjId )) ||                                        // nothing yet for ceProject
	    (havePID && !utils.validField( this.locs[ceProjId], pid )) ||                     // have pid, but already not in locs
	    (havePID && haveCID && !utils.validField( this.locs[ceProjId][pid], colId ))) {   // have pid & cid, but already not in locs
	}
	else if( havePID && utils.validField( this.locs[ceProjId], pid )) {
	    if( haveCID && utils.validField( this.locs[ceProjId][pid], colId ))
	    {
		assert( cpid == "" || cpid == this.locs[ceProjId][pid][colId].ceProjectId );
		cpid = this.locs[ceProjId][pid][colId].ceProjectId;
		this.locs[ceProjId][pid][colId].active = "false"; 
	    }
	    else if( !haveCID ) {
		for( var [_, loc] of Object.entries( this.locs[ceProjId][pid] )) {
		    assert( cpid == "" || cpid == loc.ceProjectId );
		    cpid = loc.ceProjectId;
		    loc.active = "false"; 
		}
	    }
	}
	// I don't have PID, but I do have CID
	else {  
	    for( const [ceproj,cplinks] of Object.entries( this.locs )) {
		for( const [proj,cloc] of Object.entries( cplinks )) {
		    if( utils.validField( cloc, colId )) {
			assert( cpid == "" || cpid == this.locs[ceproj][proj][colId].ceProjectId );
			cpid = this.locs[ceproj][proj][colId].ceProjectId;
			this.locs[ceproj][proj][colId].active = "false";
			break;
		    }
		}
	    }
	}

	// No need to wait.  Pass a list here, so no-one else need care about internals.
	if( cpid != "" ) {
	    let locs = [];
	    for( const [_, cplinks] of Object.entries( this.locs ) ) {   // over ceProjs
		for( const [_, cloc] of Object.entries( cplinks ) ) {    // over hostProjs
		    for( const [_, loc] of Object.entries( cloc )) {     // over cols
			
			if( loc.ceProjectId == cpid ) {
			    let aloc = {};
			    aloc.hostProjectId   = loc.hostProjectId;
			    aloc.hostProjectName = loc.hostProjectName;
			    aloc.hostColumnId    = loc.hostColumnId;
			    aloc.hostColumnName  = loc.hostColumnName;
			    aloc.hostUtility     = loc.hostUtility;
			    aloc.active          = loc.active;
			    
			    locs.push( aloc );
			}
		    }
		}
	    }
	    awsUtils.refreshLinkageSummary( authData, cpid, locs, false );
	}
    }
    */

    async linkProject( authData, ceProjects, ceProjId, hostProjectId ) {
	await gh2LU.linkProject( authData, this, ceProjects, ceProjId, hostProjectId);
	return true;
    }

    // workaround function for GH2
    async unlinkProject( authData, ceProjects, ceProjId, hostProjectId, hostRepoId ) {
	await gh2LU.unlinkProject( authData, this, ceProjects, ceProjId, hostProjectId, hostRepoId );
	return true;
    }

    // To attach major components to ceProject in aws.  Also, manage links, locs, resolve as needed
    async linkRepo( authData, ceProjects, ceProjId, repoId, repoName, cepDetails ) {
	return await gh2LU.linkRepo( authData, this, ceProjects, ceProjId, repoId, repoName, cepDetails );
    }

    // To unattach major components from ceProject
    async unlinkRepo( authData, ceProjects, ceProjId, repoId ) {
	console.log( "unLink repo", ceProjId, repoId );
	if( ceProjId == config.EMPTY || repoId == config.EMPTY ) {
	    console.log( authData.who, "WARNING.  Attempting to unlink a repo from a ceProject, one of which is empty.", ceProjId, repoId );
	    return false;
	}

	let cep = ceProjects.findById( ceProjId );
	if( typeof cep === 'undefined' ) { return true; }

	// TESTING ONLY!  This will be executed by ceFlutter before issuing unlink.
	// We do not allow unlink repo if it contains active peqs.
	const query = { CEProjectId: ceProjId, Active: "true" };
	let peqs  = await awsUtils.getPEQs( authData, query );
	peqs = peqs == -1 ? [] : peqs;
	for( const peq of peqs ) {
	    let link = await this.getLinks( authData, { "ceProjId": ceProjId, "issueId": peq.HostIssueId } );
	    if( link != -1 ) { console.log( link ); }
	    // NOTE: this can trigger if there was a failure in previous test while splitting in resolve
	    assert( link == -1 );
	}
	
	// remove links.  Locs can stay in place, no harm.  Locs only removed with unlinkProject.
	let links = await this.getLinks( authData, { "ceProjId": ceProjId, "repoId": repoId } );
	links = -1 ? [] : links;
	for( const link of links ) {
	    this.removeLinkage( { authData: authData, ceProjId: ceProjId, issueId: link.hostIssueId } );
	}
	
	let hostRepos = ceProjects.getHostRepos( authData, ceProjId, repoId, config.EMPTY, { operation: "remove" } );

	if( hostRepos.length < 1 ) {
	    delete cep.HostParts;
	    ceProjects.remove( ceProjId );
	}
	else { cep.HostParts.hostRepositories = hostRepos; }  // updates ceProjects

	// Update AWS
	return await awsUtils.updateCEPHostParts( authData, cep );
    }

    
    // if pid == -1, all hostProjs are purged
    purgeLocs( ceProjId, pid ) {
	let killList = [];	
	for( const [_,cplinks] of Object.entries( this.locs )) {
	    for( const [_,cloc] of Object.entries( cplinks )) {
		for( const [col,loc] of Object.entries( cloc )) {
		    if( ceProjId == "TESTING-FROMJSONLOCS" || ( loc.ceProjectId == ceProjId && ( loc.hostProjectId == pid || pid == -1))) {
			killList.push({ "cpid": loc.ceProjectId, "pid": loc.hostProjectId });
		    }  
		}
	    }
	}
	/*  
	// if loc is added incorrectly, use this
	if( ceProjId == "TESTING-FROMJSONLOCS" ) {
	    let uhoh = false;
	    for( const id of killList ) { if( !utils.validField( id, "cpid" ) || !utils.validField( id, "pid" )) { uhoh = true; }}
	    if( uhoh ) {
		for( const id of killList ) { console.log( "Bad kill list", id.cpid, id.pid ); }
		this.showLocs();
	    }
	}
	*/
	for( const id of killList ) { delete this.locs[id.cpid][id.pid]; }
	return true;
    }

    // if pid == -1, all hostProjs are purged
    purge( ceProjId, pid, specials ) {
	let linksOnly  = typeof specials !== 'undefined' && specials.hasOwnProperty( "linksOnly" )  ? specials.linksOnly : false;	
	console.log( "Removing links, locs for", ceProjId, pid, "links only?", linksOnly );

	let killList = [];
	for( const [_,cplinks] of Object.entries( this.links )) {
	    for( const [_,clink] of Object.entries( cplinks )) {
		for( const [cid,link] of Object.entries( clink )) {
		    if( link.ceProjectId == ceProjId && (link.hostProjectId == pid || pid == -1 )) {
			killList.push( {"cpid": link.ceProjectId, "iid": link.hostIssueId} );
		    }
		}
	    }
	}
	for( const id of killList ) { delete this.links[id.cpid][id.iid]; }

	if( !linksOnly ) {  this.purgeLocs( ceProjId, pid ); }
	
	return true;
    }

    show( count, cep ) {
	if( Object.keys( this.links ).length <= 0 ) { return ""; }
	
	console.log( utils.fill( "ceProjId", 13 ),
	             utils.fill( "IssueId", 13 ),
		     utils.fill( "IssueNum",10 ),
		     utils.fill( "CardId", 13),
		     utils.fill( "Title", 25 ),
		     utils.fill( "ColId", 13),
		     utils.fill( "ColName", 20),
		     utils.fill( "ProjId", 13 ), 
		     utils.fill( "ProjName", 15 ),
		     utils.fill( "Repo", 10 ),
		     utils.fill( "RepoId", 10 )
		     // utils.fill( "sourceCol", 10 )
		   );

	// console.log( this.links );
	
	let printables = [];
	for( const [ceproj, cplink] of Object.entries( this.links )) {
	    if( typeof cep === 'undefined' || cep == ceproj ) {
		for( const [issueId, clinks] of Object.entries( cplink )) {
		    for( const [_, link] of Object.entries( clinks )) {
			printables.push( link );
		    }}
	    }
	}

	let start = 0;
	if( typeof count !== 'undefined' ) { start = printables.length - count; }
	start = start < 0 ? 0 : start;
	
	for( let i = start; i < printables.length; i++ ) {
	    let link = printables[i]; 
	    console.log( utils.fill( link.ceProjectId, 13 ),
			 utils.fill( link.hostIssueId, 13 ),
			 utils.fill( link.hostIssueNum, 10 ),
			 utils.fill( link.hostCardId, 13 ),
			 utils.fill( link.hostIssueName, 25 ),
			 link.hostColumnId == config.EMPTY ? utils.fill( config.EMPTY, 13 ) : utils.fill( link.hostColumnId, 13 ),
			 utils.fill( link.hostColumnName, 20 ),
			 link.hostProjectId == config.EMPTY ? utils.fill( config.EMPTY, 13 ) : utils.fill( link.hostProjectId, 13 ),
			 utils.fill( link.hostProjectName, 15 ),
			 // link.flatSource == -1 ? utils.fill( "-1", 10 ) : utils.fill( link.flatSource, 10 ),
			 utils.fill( link.hostRepoName, 10 ), 
			 utils.fill( link.hostRepoId, 10 )
		       );
	}
    }

    showLocs( count ) {
	let printables = [];
	for( const [_, cplinks] of Object.entries( this.locs )) {
	    for( const [_, clocs] of Object.entries( cplinks )) {
		for( const [_, loc] of Object.entries( clocs )) {
		    // if( loc.active == "true" ) { printables.push( loc ); }
		    printables.push( loc );
		}
	    }
	}

	if( printables.length > 0 ) {
	    console.log( utils.fill( "ceProj", 15 ),
			 utils.fill( "ProjName", 15 ),
			 utils.fill( "ProjId", 20 ), 
			 utils.fill( "ColId", 10),
			 utils.fill( "ColName", 20)
		       );
	}


	let start = 0;
	if( typeof count !== 'undefined' ) { start = printables.length - count; }
	start = start < 0 ? 0 : start;

	for( let i = start; i < printables.length; i++ ) {
	    const loc = printables[i];
	    console.log( utils.fill( loc.ceProjectId, 16 ),
			 utils.fill( loc.hostProjectName, 15 ),
			 loc.hostProjectId == -1 ? utils.fill( "-1", 20 ) : utils.fill( loc.hostProjectId, 20 ),
			 loc.hostColumnId == config.EMPTY ? utils.fill( config.EMPTY, 10 ) : utils.fill( loc.hostColumnId, 10 ),
			 utils.fill( loc.hostColumnName, 20 ), utils.fill( loc.active, 7 )
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
