const assert = require( 'assert' );

const config   = require( '../config' );
const ceAuth   = require( '../auth/ceAuth' );

const utils    = require( '../utils/ceUtils' );
const awsUtils = require( '../utils/awsUtils' );

// XXX this should not be here
const ghClassic = require( '../utils/gh/ghc/ghClassicUtils' );
const gh        = ghClassic.githubUtils;
const ghV2      = require( '../utils/gh/gh2/ghV2Utils' );

const locData  = require( './locData' );


// Linkage table contains all identifying info related to situated issues or better.
// linkage is { issueId: { cardId: {} }}
// linkage is NOT stored in dynamo.

// Loc table is projects and columns per repo.

// Loc table contains all proj/col in repo.  linkage table will only have that info where there are PEQs.
// All adds to loc update aws, except batch related adds present herein.
// loc was { projId: { colId: {} }}
// loc is  { ceProjId: { projId: { colId: {} }}} where projId is the unique project id within ceProjId.hostPlatform
// loc IS stored in dynamo, for speed and privacy benefits during ingest (ceFlutter).

class Linkage {

    constructor( ) {
	this.links = {};   // { ceProjId: { issueId:    { cardId:    {link}}}}
	this.locs  = {};   // { ceProjId: { hostProjId: { hostColId: {loc }}}}
    }


    // For each ceProject
    async initOneProject( authData, entry ) {

	let host  = utils.validField( entry, "HostPlatform" )       ? entry.HostPlatform                    : "";
	let org   = utils.validField( entry, "Organization" )       ? entry.Organization                    : "";
	let pms   = utils.validField( entry, "ProjectMgmtSys" )     ? entry.ProjectMgmtSys                  : "";
	let comp  = utils.validField( entry, "CEProjectComponent" ) ? entry.CEProjectComponent              : "";
	let isOrg = utils.validField( entry, "OwnerCategory" )      ? entry.OwnerCategory == "Organization" : false;
	assert( host != "" && pms != "" && org != "" );
	assert( utils.validField( entry, "CEProjectId" ) );
	
	console.log( authData.who, ".. working on the", comp, "portion of", org, "at", host, "which is a", pms, "project." );

	// Wait later
	let peqs = awsUtils.getPeqs( authData, { "CEProjectId": entry.CEProjectId } );

	let baseLinks = [];
	let blPromise = [];
	let ldPromise = [];
	let locData   = [];

	// XXX local implementations should not be here.
	// classic is per repo.
	// Init repo with CE_ACTOR, which is typically a builder account that needs full access.
	if( host == config.HOST_GH ) {
	    if( pms == config.PMS_GHC ) {
		
		// HostRepos are stored with linkages, and in ceProj.
		// If there is not an existing link in aws, no need to iterate through the repo looking for baselinks.
		// If there is an existing link, use it (them) to populate repos.  It will not be a large list - just proj/col.
		// As long as hproj and cproj are linked, there will be at least one link irregardless of ceServer status.
		// ceFlutter is the main consumer of this information, excluding this call.

		let awsLinks = await awsUtils.getLinkage( authData, { "CEProjectId": entry.CEProjectId } );		
		assert( awsLinks.length == 1 );
		let repos = [];
		
		for( const awsLoc of awsLinks[0].Locations ) {
		    let repo = awsLoc.hostRepository;
		    if( !repos.includes( repo )) {
			repos.push( repo );

			console.log( authData.who, "Refreshing", entry.CEProjectId, repo );
			let fnParts = repo.split('/');
			let rlinks = [];
			
			if( isOrg ) { await ceAuth.getAuths( authData, host, pms, org,  config.CE_ACTOR ); }
			else        { await ceAuth.getAuths( authData, host, pms, repo, config.CE_ACTOR ); }
			
			// XXX this should not be here
			blPromise =  gh.getBasicLinkDataGQL( authData.pat, fnParts[0], fnParts[1], rlinks, -1 )
			    .catch( e => console.log( authData.who, "Error.  GraphQL for basic linkage failed.", e ));
			
			ldPromise = gh.getRepoColsGQL( authData.pat, fnParts[0], fnParts[1], locData, -1 )
			    .catch( e => console.log( authData.who, "Error.  GraphQL for repo cols failed.", e ));
			
			ldPromise = await ldPromise;  // no val here, just ensures locData is set
			for( var loc of locData ) {
			    loc.ceProjectId = entry.CEProjectId;
			    loc.active = "true";
			    this.addLoc( authData, loc, false ); 
			}
			
			blPromise = await blPromise;  // no val here, just ensures linkData is set

			rlinks.forEach( function (link) { link.hostRepo = repo;
							  this.addLinkage( authData, entry.CEProjectId, link, { populate: true } ); 
							}, this);

			baseLinks = baseLinks.concat( rlinks );
		    }
		}
	    }
	    // XXX local implementations should not be here.
	    // All ids for GH2 are GQL node_ids.
	    else if( pms == config.PMS_GH2 ) {
		// mainly to get pat
		await ceAuth.getAuths( authData, host, pms, org, config.CE_ACTOR ); 

		// No need to handle entry.HostParts.hostProjectIds.  hostRepositories have linked projects.  If not linked,
		// ceProj will not interact.  If linked, then it is part of ceProj.
		let hostProjs = [];
		for( const repoName of entry.HostParts.hostRepositories ) {
		    await ghV2.getProjectIds( authData, repoName, hostProjs, -1 );
		}

		// console.log( authData.who, "GET FOR PROJECT", entry.CEProjectId, hostProjs.length );
		
		for( const proj of hostProjs ) {
		    const projId = proj.hostProjectId;
		    console.log( authData.who, "GET FOR PROJECT", entry.CEProjectId, proj.hostProjectId );
		    let rLinks = [];
		    let rLocs  = [];
		    
		    await ghV2.getHostLinkLoc( authData, proj.hostProjectId, rLocs, rLinks, -1 )
			.catch( e => console.log( authData.who, "Error.  GraphQL for project layout failed.", e ));

		    // console.log( authData.who, "Populate Linkage", proj.hostProjectId );
		    rLinks.forEach( function (link) { link.hostRepo   = proj.hostRepoName;
						      link.hostRepoId = proj.hostRepoId;
						      this.addLinkage( authData, entry.CEProjectId, link, { populate: true } );
						    }, this);
		    
		    // console.log( authData.who, "LINKAGE: Locs",  rLocs );
		    // console.log( authData.who, "LINKAGE: Links", rLinks );
		    for( var loc of rLocs ) {
			loc.ceProjectId = entry.CEProjectId;
			loc.active = "true";
			loc.hostRepository = proj.hostRepoName;
			loc.hostRepositoryId = proj.hostRepoId;
			this.addLoc( authData, loc, false ); 
		    }
		    
		    baseLinks = baseLinks.concat( rLinks );
		    locData = locData.concat( rLocs );
		}
	    }
	}

	awsUtils.refreshLinkageSummary( authData, entry.CEProjectId, locData );  

	
	// peq add: cardTitle, colId, colName, projName - carded issues do not track this.
	// flatSource is a column id.  May not be in current return data, since source is orig col, not cur col.
	// XXX this could be smarter, i.e. are peqs >> non-peqs?  zero out instead of fill
	let badPeq = false;
	let badSource = false;
	peqs = await peqs;
	if( peqs == -1 ) { peqs = []; }
	for( const peq of peqs ) {
	    if( peq.Active == "false" ) {
		// console.log( authData.who, "Skipping inactive peq", peq.HostIssueTitle );
		continue;
	    }
	    const iid = peq.HostIssueId;
	    let link = this.getUniqueLink( authData, entry.CEProjectId, iid );
	    if( link == -1 ) {
		console.log( authData.who, "Did you remove an issue without removing the corresponding PEQ?", peq.PEQId, peq.HostIssueTitle );
		// this.show(20);
		badPeq = true;
		continue;
	    }

	    let card = baseLinks.find( datum => datum.cardId == link.hostCardId );
	    
	    link.hostIssueName   = card.title;
	    link.hostColumnId    = card.columnId.toString();
	    link.hostProjectName = card.projectName;
	    link.hostColumnName  = card.columnName;

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

	assert( !badPeq, "Mismatching PEQs."  );  // will be caught.
	return baseLinks; 
    }

    
    // Note: Run init in order of most recently and most active repos.
    // populateCEServer migrates a project into CE.  lots of extra checks.
    // init here is to handle a server restart, only 'remembers' official CE projects.
    async init( authData ) {
	let tstart = Date.now();
	console.log( authData.who, "Init linkages" );
	
	// XXX aws fix name here.  Get ceProj status.
	let ceProjects = await awsUtils.getProjectStatus( authData, -1 );   // get all ce projects
	if( ceProjects == -1 ) { return; }
	let promises = [];
	for( const entry of ceProjects ) {
	    promises.push( this.initOneProject( authData, entry )
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
	// console.log( "Creating ghLinks from json data" );
	for( const [_, clinks] of Object.entries( linkData ) ) {
	    for( const [_, plinks] of Object.entries( clinks ) ) {
		for( const [col, link] of Object.entries( plinks ) ) {
		    // XXX grunk.  naming in addLinkage causes this conversion. kinda silly.  but testUtils only, so min impact.
		    let orig = {};
		    orig.hostRepoName  = link.hostRepo;
		    orig.hostRepoId    = link.hostRepoId;
		    orig.issueId       = link.hostIssueId;
		    orig.issueNum      = link.hostIssueNum;
		    orig.projectId     = link.hostProjectId;
		    orig.projectName   = link.hostProjectName;
		    orig.columnId      = link.hostColumnId;
		    orig.columnName    = link.hostColumnName;
		    orig.cardId        = link.hostCardId;
		    orig.title         = link.hostIssueName;
		    this.addLinkage( authData, link.ceProjectId, orig, { source: link.flatSource } );
		}
	    }
	}
    }

    // Linkage table only contains situated issues or better.  Card titles point to issue titles for situated issues.
    addLinkage( authData, ceProjId, orig, specials ) {
	let source   = typeof specials !== 'undefined' && specials.hasOwnProperty( "source" )   ? specials.source   : false;
	let populate = typeof specials !== 'undefined' && specials.hasOwnProperty( "populate" ) ? specials.populate : false;
	
	// console.log( authData.who, "add link", ceProjId, orig.issueId, orig.cardId, orig.columnName, orig.columnId, orig.title );
	
	assert( ceProjId     != config.EMPTY );
	assert( orig.issueId != config.EMPTY );
	assert( orig.cardId  != config.EMPTY );
	if( !utils.validField( this.links, ceProjId ) )                            { this.links[ceProjId] = {}; }
	if( !utils.validField( this.links[ceProjId], orig.issueId ) )              { this.links[ceProjId][orig.issueId] = {}; }
	if( !utils.validField( this.links[ceProjId][orig.issueId], orig.cardId ) ) { this.links[ceProjId][orig.issueId][orig.cardId] = {}; }

	let link = this.links[ceProjId][orig.issueId][orig.cardId];

	link.ceProjectId     = ceProjId;
	link.hostRepo        = typeof orig.hostRepoName === 'undefined' ? config.EMPTY : orig.hostRepoName;
	link.hostRepoId      = typeof orig.hostRepoId   === 'undefined' ? config.EMPTY : orig.hostRepoId;
	link.hostIssueId     = typeof orig.issueId      === 'undefined' ? config.EMPTY : orig.issueId.toString();
	link.hostIssueNum    = typeof orig.issueNum     === 'undefined' ? config.EMPTY : orig.issueNum.toString();
	link.hostProjectId   = typeof orig.projectId    === 'undefined' ? config.EMPTY : orig.projectId.toString();
	link.hostProjectName = typeof orig.projectName  === 'undefined' ? config.EMPTY : orig.projectName;
	link.hostColumnId    = typeof orig.columnId     === 'undefined' ? config.EMPTY : orig.columnId.toString();
	link.hostColumnName  = typeof orig.columnName   === 'undefined' ? config.EMPTY : orig.columnName;
	link.hostCardId      = typeof orig.cardId       === 'undefined' ? config.EMPTY : orig.cardId.toString();
	link.hostIssueName   = typeof orig.title        === 'undefined' ? config.EMPTY : orig.title;   
	link.flatSource      = source ? source : link.hostColumnId;

	// Do not track some information during initial populate.  If these are for peqs, they get filled in later during initOneRepo
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

	// console.log( authData.who, "Get unique link", ceProjId, issueId );
	// this.show(5);
	let retVal = -1;
	if( utils.validField( this.links, ceProjId ) && utils.validField( this.links[ceProjId], issueId )) {
	    let issueLinks = Object.entries( this.links[ceProjId][issueId] );  // [ [cardId, link], [cardId, link] ...]
	    // console.log( "XXX", issueLinks );
	    
	    if      ( issueLinks.length < 1 ) { console.log(authData.who, "Link not found.", issueId ); }  // 204
	    else if ( issueLinks.length > 1 ) { console.log(authData.who, "Semantic error.  More items found than expected.", issueId ); } // 422
	    else                              { retVal = issueLinks[0][1]; }
	}
	return retVal;
    }


    // issueId:cardId 1:m  cardId:issueId 1:1
    getLinks( authData, query ) {

	if( typeof query.ceProjId === 'undefined' ) {
	    console.log( authData.who, "Error.  ceProjectId was not defined in Links query." );
	    assert( false );
	}

	const ceProjId   = query.ceProjId;
	const repo       = utils.validField( query, "repo" )       ? query.repo               : config.EMPTY;
	const repoId     = utils.validField( query, "repoId" )     ? query.repoId.toString()  : config.EMPTY;
	const issueId    = utils.validField( query, "issueId" )    ? query.issueId.toString() : -1;
	const cardId     = utils.validField( query, "cardId" )     ? query.cardId.toString()  : -1;
	const projId     = utils.validField( query, "projId" )     ? query.projId             : -1;
	const projName   = utils.validField( query, "projName" )   ? query.projName           : config.EMPTY;
	const colName    = utils.validField( query, "colName" )    ? query.colName            : config.EMPTY;
	const issueTitle = utils.validField( query, "issueTitle" ) ? query.issueTitle         : config.EMPTY;

	// console.log( authData.who, "get Links", ceProjId, issueId, cardId, projId, projName, colName, issueTitle );
	
	let links = [];
	if( this.links[ceProjId] == null ) { return -1; }  // could be an empty ceproj
	
	for( const [_, clinks] of Object.entries( this.links[ceProjId] ) ) {  // one clinks is {cardId: { <link>}, cardId2: { <link> }}
	    // Note, during initial resolve, this may NOT be 1:1 issue:card
	    for( const [_, link] of Object.entries( clinks ) ) {
		let match = true;
		match = issueId == -1              ? match : match && (link.hostIssueId     == issueId);
		match = cardId == -1               ? match : match && (link.hostCardId      == cardId);
		match = projId == -1               ? match : match && (link.hostProjectId   == projId);
		match = repo == config.EMPTY       ? match : match && (link.hostRepo        == repo);
		match = repoId == config.EMPTY     ? match : match && (link.hostRepoId      == repoId);
		match = projName == config.EMPTY   ? match : match && (link.hostProjectName == projName );
		match = colName == config.EMPTY    ? match : match && (link.hostColumnName  == colName );
		match = issueTitle == config.EMPTY ? match : match && (link.hostIssueName   == issueTitle );
		match = ceProjId == config.EMPTY   ? match : match && (link.ceProjectId     == ceProjId );
		
		if( match ) { links.push( link ); }
	    }
	}
	
	if( links.length == 0 ) { links = -1; }
	return links;
    }

    // No match on utility slot.  yet?
    getLocs( authData, query ) {
	// console.log( authData.who, "get Locs", query );
	// this.showLocs();
	    
	if( typeof query.ceProjId === 'undefined' ) {
	    console.log( authData.who, "Error.  ceProjectId was not defined in Locs query." );
	    assert( false );
	}

	const ceProjId  = query.ceProjId;
	const repo      = utils.validField( query, "repo" )     ? query.repo              : config.EMPTY;
	const repoId    = utils.validField( query, "repoId" )   ? query.repoId            : -1;
	const projId    = utils.validField( query, "projId" )   ? query.projId.toString() : -1;
	const colId     = utils.validField( query, "colId" )    ? query.colId.toString()  : -1;
	const projName  = utils.validField( query, "projName" ) ? query.projName          : config.EMPTY;
	const colName   = utils.validField( query, "colName" )  ? query.colName           : config.EMPTY;

	// At times, locs can be purged.  Without recreating here, object.entries below is unhappy
	if( !this.locs[ceProjId] ) { return -1; }

	let locs = [];
	for( const [_, clocs] of Object.entries( this.locs[ceProjId] ) ) {// one clocs is {projId1: { coldata }, projId2: { coldata }}
	    for( const [_, loc] of Object.entries( clocs ) ) {            
		let match = true;
		
		match = projId == -1             ? match : match && (loc.hostProjectId    == projId);
		match = colId == -1              ? match : match && (loc.hostColumnId     == colId);
		match = repoId == -1             ? match : match && (loc.hostRepositoryId == repoId);
		match = ceProjId == config.EMPTY ? match : match && (loc.ceProjectId      == ceProjId);
		match = repo == config.EMPTY     ? match : match && (loc.hostRepository   == repo);
		match = projName == config.EMPTY ? match : match && (loc.hostProjectName  == projName);
		match = colName == config.EMPTY  ? match : match && (loc.hostColumnName   == colName);
		match =                                    match && (loc.active           == "true");
		
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
    rebaseLinkage( authData, ceProjId, issueId ) {
	console.log( authData.who, "Rebasing link for", ceProjId, issueId );
	let cLinks = this.links[ceProjId][issueId];
	assert( Object.keys( cLinks ).length == 1 );
	let [_, link] = Object.entries( cLinks )[0];

	link.hostProjectName = config.EMPTY;
	link.hostColumnId    = config.EMPTY;
	link.hostColumnName  = config.EMPTY;
	link.hostIssueName  = config.EMPTY;
	link.flatSource    = -1;
    }

    updateLinkage( authData, ceProjId, issueId, cardId, newColId, newColName ) {
	console.log( authData.who, "Update linkage for", ceProjId, issueId, cardId, newColId );
	let link = this.links[ceProjId][issueId][cardId];
	assert( link !== 'undefined' );

	link.hostColumnId   = newColId.toString();
	link.hostColumnName = newColName;

	// update, need to track specially
	if( !config.PROJ_COLS.includes( newColName ) ) { link.flatSource = link.hostColumnId; }
	return true;
    }

    updateTitle( authData, linkData, newTitle ) {
	let link = this.links[linkData.ceProjectId][linkData.hostIssueId][linkData.hostCardId];
	assert( link !== 'undefined' );

	link.hostIssueName  = newTitle;

	return true;
    }

    // primary keys have changed.
    rebuildLinkage( authData, oldLink, issueData, cardId, splitTitle ) {
	console.log( authData.who, "Rebuild linkage", oldLink.ceProjectId, oldLink.hostIssueNum, "->", issueData[0] );
	let newTitle = oldLink.hostIssueName;
	if( typeof splitTitle !== 'undefined' ) {
	    newTitle = oldLink.hostColumnId == config.EMPTY ? config.EMPTY : splitTitle;
	}
	let alink = {};
	alink.hostRepoName = oldLink.hostRepo;
	alink.issueId      = issueData[0].toString();
	alink.issueNum     = issueData[1].toString();
	alink.projectId    = oldLink.hostProjectId;
	alink.projectName  = oldLink.hostProjectName;
	alink.columnId     = oldLink.hostColumnId;
	alink.columnName   = oldLink.hostColumnName;
	alink.hostCardId   = cardId.toString();
	alink.title        = newTitle;
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

    removeLocs({ authData, ceProjId, projId, colId }) {
	if( !authData ) { console.log( authData.who, "missing authData" ); return false; }


	if( colId )       { console.log( authData.who, "Remove loc for colId:", ceProjId, colId ); }    // one delete
	else if( projId ) { console.log( authData.who, "Remove locs for projId:", ceProjId, projId ); } // many deletes


	let havePID = typeof projId !== 'undefined';
	let haveCID = typeof colId  !== 'undefined';
	let cpid    = "";
	
	// Easy cases, already do not exist
	// No need to check for empty ceProjectIds, since there is nothing to set inactive.
	if( (!havePID && !haveCID) ||                                                            // nothing specified
	    (!utils.validField( this.locs, ceProjId )) ||                                        // nothing yet for ceProject
	    (havePID && !utils.validField( this.locs[ceProjId], projId )) ||                     // have pid, but already not in locs
	    (havePID && haveCID && !utils.validField( this.locs[ceProjId][projId], colId ))) {   // have pid & cid, but already not in locs
	}
	else if( havePID && utils.validField( this.locs[ceProjId], projId )) {
	    if( haveCID && utils.validField( this.locs[ceProjId][projId], colId ))
	    {
		assert( cpid == "" || cpid == this.locs[ceProjId][projId][colId].ceProjectId );
		cpid = this.locs[ceProjId][projId][colId].ceProjectId;
		this.locs[ceProjId][projId][colId].active = "false"; 
	    }
	    else if( !haveCID ) {
		for( var [_, loc] of Object.entries( this.locs[ceProjId][projId] )) {
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
	    for( const [_, cloc] of Object.entries( this.locs ) ) {
		for( const [_, loc] of Object.entries( cloc )) {

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
	    awsUtils.refreshLinkageSummary( authData, cpid, locs, false );
	}
    }

    // Unlink project from repo.  in this case, remove repo info
    async unlinkProject( authData, ceProjects, ceProjId, hostProjectId, hostRepoId ) {
	console.log( "Unlink repo", ceProjId, hostRepoId, hostProjectId );
	
	if( this.locs[ceProjId] != null && this.locs[ceProjId][hostProjectId] != null ) {
	    for( const [_, loc] of Object.entries( this.locs[ceProjId][hostProjectId] ) ) {
		// console.log( "  .. clearing", loc );
		loc.hostRepository   = config.EMPTY;
		loc.hostRepositoryId = config.EMPTY;
	    }
	}

	if( this.links[ceProjId] != null ) {
	    for( const [_, clinks] of Object.entries( this.links[ceProjId] ) ) {
		for( const [_, link] of Object.entries( clinks ) ) {
		    link.hostRepo   = config.EMPTY;
		    link.hostRepoId = config.EMPTY;
		}}
	}

	await awsUtils.unlinkProject( authData, {"ceProjId": ceProjId, "hostProjectId": hostProjectId} );
	await ceProjects.init( authData );
	
	this.removeLocs( { authData: authData, ceProjId: ceProjId, projId: hostProjectId } );
	
	return true;
    }


    async linkProject( authData, ceProjects, ceProjId, hostProjectId, hostRepoId, hostRepoName ) {
	let rLocs  = [];
	let rLinks = [];
	console.log( authData.who, "link project", ceProjId, hostProjectId, hostRepoName );

	await ghV2.getHostLinkLoc( authData, hostProjectId, rLocs, rLinks, -1 )
	    .catch( e => console.log( authData.who, "Error.  linkProject failed.", e ));

	// XXX Should be no this.links for ceProjId, hostProjectId.  Verify and/or Purge.
	
	// add (or overwrite matching.. hmm see above)
	// Don't wait, no adds to dynamo
	rLinks.forEach( function (link) { link.hostRepo   = hostRepoName;
					  link.hostRepoId = hostRepoId;
					  this.addLinkage( authData, ceProjId, link, { populate: true } );
					}, this);

	
	// Wait.. adds to dynamo
	let promises = [];
	promises.push( awsUtils.linkProject( authData, {"ceProjId": ceProjId, "hostProjectId": hostProjectId} ));
	    
	for( var loc of rLocs ) {
	    loc.ceProjectId = ceProjId;
	    loc.active = "true";
	    loc.hostRepository = hostRepoName;
	    loc.hostRepositoryId = hostRepoId;
	    // console.log( "linkage:addLoc", loc );
	    promises.push( this.addLoc( authData, loc, true ) );
	}
	await Promise.all( promises );
	// Could just add/remove... but why?
	await ceProjects.init( authData );
	
	return true;
    }
    

    purgeLocs( ceProjId, projId ) {
	let killList = [];	
	for( const [_,cplinks] of Object.entries( this.locs )) {
	    for( const [_,cloc] of Object.entries( cplinks )) {
		for( const [col,loc] of Object.entries( cloc )) {
		    if( ceProjId == "TESTING-FROMJSONLOCS" || ( loc.ceProjectId == ceProjId && loc.hostProjectId == projId )) {
			killList.push({ "cpid": loc.ceProjectId, "pid": loc.hostProjectId });
		    }  
		}
	    }
	}
	for( const id of killList ) { delete this.locs[id.cpid][id.pid]; }
	return true;
    }
    
    purge( ceProjId, projId, specials ) {
	let linksOnly  = typeof specials !== 'undefined' && specials.hasOwnProperty( "linksOnly" )  ? specials.linksOnly : false;	
	console.log( "Removing links, locs for", ceProjId, projId, "links only?", linksOnly );

	let killList = [];
	for( const [_,cplinks] of Object.entries( this.links )) {
	    for( const [_,clink] of Object.entries( cplinks )) {
		for( const [cid,link] of Object.entries( clink )) {
		    if( link.ceProjectId == ceProjId && link.hostProjectId == projId ) { killList.push( {"cpid": link.ceProjectId, "iid": link.hostIssueId} ); }
		}
	    }
	}
	for( const id of killList ) { delete this.links[id.cpid][id.iid]; }

	// GH Testing can't purge links until apiV2 allows create col, and make project notifications
	if( !linksOnly ) {  this.purgeLocs( ceProjId, projId ); }
	
	return true;
    }

    // first 4, ..., last 4
    fill( val, num ) {
	let retVal = "";
	if( typeof val !== 'undefined' ) {  // undef if bad loc, say
	    if( val.length > num ) {
		let fromVal = Math.floor( (num-3)/2 );  // number of characters from val in retVal
		for( var i = 0; i < fromVal; i++ ) { retVal = retVal.concat( val[i] ); }
		retVal = retVal.concat( "..." );
		for( var i = val.length - fromVal ; i < val.length; i++ ) { retVal = retVal.concat( val[i] ); }
		if( val.length % 2 == 0 ) { retVal = retVal.concat( " " ); }
	    }
	    else {
		for( var i = 0; i < num; i++ ) {
		    if( val.length > i ) { retVal = retVal.concat( val[i] ); }
		    else                 { retVal = retVal.concat( " " ); }
		}
	    }
	}
	return retVal;
    }

    show( count, cep ) {
	if( Object.keys( this.links ).length <= 0 ) { return ""; }
	
	console.log( this.fill( "ceProjId", 13 ),
	             this.fill( "IssueId", 13 ),
		     "IssueNum",
		     this.fill( "CardId", 13),
		     this.fill( "Title", 25 ),
		     this.fill( "ColId", 13),
		     this.fill( "ColName", 20),
		     this.fill( "ProjId", 13 ), 
		     this.fill( "ProjName", 15 ),
		     this.fill( "sourceCol", 10 )
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
	    console.log( this.fill( link.ceProjectId, 13 ),
			 this.fill( link.hostIssueId, 13 ),
			 link.hostIssueNum,
			 this.fill( link.hostCardId, 13 ),
			 this.fill( link.hostIssueName, 25 ),
			 link.hostColumnId == config.EMPTY ? this.fill( "-1", 13 ) : this.fill( link.hostColumnId, 13 ),
			 this.fill( link.hostColumnName, 20 ),
			 link.hostProjectId == config.EMPTY ? this.fill( "-1", 13 ) : this.fill( link.hostProjectId, 13 ),
			 this.fill( link.hostProjectName, 15 ),
			 link.flatSource == -1 ? this.fill( "-1", 10 ) : this.fill( link.flatSource, 10 ),
			 // link.hostRepo,
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
	    console.log( this.fill( "ceProj", 16 ),
			 this.fill( "Repo", 20 ),
			 this.fill( "RepoId", 12 ),
			 this.fill( "ProjId", 20 ), 
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
	    console.log( this.fill( loc.ceProjectId, 16 ),
			 this.fill( loc.hostRepository, 20 ),
			 this.fill( loc.hostRepositoryId, 12 ),
			 loc.hostProjectId == -1 ? this.fill( "-1", 20 ) : this.fill( loc.hostProjectId, 20 ),
			 this.fill( loc.hostProjectName, 15 ),
			 loc.hostColumnId == config.EMPTY ? this.fill( "-1", 10 ) : this.fill( loc.hostColumnId, 10 ),
			 this.fill( loc.hostColumnName, 20 ), this.fill( loc.active, 7 )
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
