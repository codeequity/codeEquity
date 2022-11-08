// Instances of this class record kanban-style locations for host projects, plus higher level location data.
class LocationData {

    constructor() {
	this.CEProjectId     = "";      // org:ceProjectId 1:m    ceProjectId:hostProject  1:m    ceProjectId:hostRepo 1:m
	this.HostRepository  = "";      // main host storage locator for a host project, e.g. GitHub's repositories
	this.HostProjectId   = "";      // a string-ified id that is unique within hostPlatform
	this.HostProjectName = "";      // 
	this.HostColumnId    = "";      // a string-ified id that is unique within hostProject
	this.HostColumnName  = "";      // 
	this.Active          = "false"; // is this location currently valid
    }

    fromLoc( oldLoc ) {
	this.CEProjectId     = oldLoc.hasOwnProperty( "CEProjectId" )     ? oldLoc.CEProjectId : "";
	this.HostRepository  = oldLoc.hasOwnProperty( "HostRepository" )  ? oldLoc.HostRepository : "";
	this.HostProjectId   = oldLoc.hasOwnProperty( "HostProjectId" )   ? oldLoc.HostProjectId : "";
	this.HostProjectName = oldLoc.hasOwnProperty( "HostProjectName" ) ? oldLoc.HostProjectName : "";
	this.HostColumnId    = oldLoc.hasOwnProperty( "HostColumnId" )    ? oldLoc.HostColumnId : "";
	this.HostColumnName  = oldLoc.hasOwnProperty( "HostColumnName" )  ? oldLoc.HostColumnName : "";
	this.Active          = oldLoc.hasOwnProperty( "Active" )          ? oldLoc.Active : "";
    }
    
    show() {
	console.log( "CEProject", this.CEProjectId );
	console.log( "repo,project,col:", this.HostRepository, this.HostProjectName, this.HostColumnName);
	console.log( "pid,cid,active:", this.HostProjectId, this.ColumnId, this.Active);
    }
    
}
exports.LocData = LocationData;
