const utils   = require( '../utils');
var config    = require('../config');

class JobData {
    constructor( ) {
	this.Host        = config.EMPTY;    // The host platform sending notifications to ceServer
	this.Org         = config.EMPTY;    // Within the host, which organization does the notification belong to?  Example, GH version 2's 'organization:login'
	this.ProjMgmtSys = config.EMPTY;    // Within the host, which project system is being used?  Example: GH classic vs version 2
	this.Actor       = config.EMPTY;    // The entity that caused this specific notification to be sent

	this.Event       = config.EMPTY;    // Primary data type for host notice.       Example - GH's 'project_v2_item'
	this.Action      = config.EMPTY;    // Activity being reported on data type.    Example - 'create'

	this.Tag         = config.EMPTY;    // host-specific name for object, debugging. Example - iss4810
	this.ReqBody     = config.EMPTY;    // The incoming request body, json

	this.DelayCount  = 0;                 
	this.QueueId     = utils.randAlpha(10);

    }
    show() {
	console.log( "JobData contents" );
	console.log( "   ", this.Actor, "in", this.Host +"'s", this.Org, "issuing a", this.ProjMgmtSys+"-style ceProject notification" );
	console.log( "      ", "Notification for", this.Event, this.Action, "with tag:", this.Tag );
	console.log( "      ", "Job ID:", this.QueueId, "Current demotion count:", this.DelayCount );
    }
}

exports.JobData = JobData;
