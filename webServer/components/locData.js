// Instances of this class record kanban-style locations for host projects, plus higher level location data.
class LocationData {

    constructor() {
	this.ceProjectId      = "";      // org:ceProjectId 1:m    ceProjectId:hostProject  1:m    ceProjectId:hostRepo 1:m
	this.hostProjectId    = "";      // a string-ified id that is unique within hostPlatform
	this.hostProjectName  = "";      // 
	this.hostColumnId     = "";      // a string-ified id that is unique within hostProject
	this.hostColumnName   = "";      //
	this.hostUtility      = "";      // a utility slot for hosts.  for example, PV2 uses this to retain status field id.  Classic does not use this.
	this.active           = "false"; // is this location currently valid
    }

    fromLoc( oldLoc ) {
	this.ceProjectId      = oldLoc.hasOwnProperty( "ceProjectId" )      ? oldLoc.ceProjectId : "";
	this.hostProjectId    = oldLoc.hasOwnProperty( "hostProjectId" )    ? oldLoc.hostProjectId : "";
	this.hostProjectName  = oldLoc.hasOwnProperty( "hostProjectName" )  ? oldLoc.hostProjectName : "";
	this.hostColumnId     = oldLoc.hasOwnProperty( "hostColumnId" )     ? oldLoc.hostColumnId : "";
	this.hostColumnName   = oldLoc.hasOwnProperty( "hostColumnName" )   ? oldLoc.hostColumnName : "";
	this.hostUtility      = oldLoc.hasOwnProperty( "hostUtility" )      ? oldLoc.hostUtility : "";
	this.active           = oldLoc.hasOwnProperty( "active" )           ? oldLoc.active : "";
    }
    
    show() {
	console.log( "ceProject", this.ceProjectId );
	console.log( "repo,project,col:", this.hostProjectName, this.hostColumnName);
	console.log( "pid,cid,utility,active:", this.hostProjectId, this.hostColumnId, this.hostUtility, this.active);
    }
    
}
exports.LocData = LocationData;
