const utils   = require( '../utils/ceUtils' );
var config    = require('../config');

class JobData {
    constructor( ) {
	this.host        = config.EMPTY;    // The host platform sending notifications to ceServer
	this.org         = config.EMPTY;    // Within the host, which organization does the notification belong to?  Example, GH version 2's 'organization:login'
	this.projMgmtSys = config.EMPTY;    // Within the host, which project system is being used?  Example: GH classic vs version 2
	this.actor       = config.EMPTY;    // The entity that caused this specific notification to be sent

	this.event       = config.EMPTY;    // Primary data type for host notice.       Example - GH's 'project_v2_item'
	this.action      = config.EMPTY;    // Activity being reported on data type.    Example - 'create'

	this.tag         = config.EMPTY;    // host-specific name for object, debugging. Example - iss4810
	this.reqBody     = config.EMPTY;    // The incoming request body, json

	this.delayCount  = 0;                 
	this.queueId     = utils.randAlpha(10);

    }
    show() {
	console.log( "JobData contents" );
	console.log( "   ", this.actor, "in", this.host +"'s", this.org, "issuing a", this.projMgmtSys+"-style ceProject notification" );
	console.log( "      ", "Notification for", this.event, this.action, "with tag:", this.tag );
	console.log( "      ", "Job ID:", this.queueId, "Current demotion count:", this.delayCount );
    }
}

exports.JobData = JobData;
