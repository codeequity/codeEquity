// An instance of this class is passed around throughout ceServer.
// It contains the current required set of authorizations for any given job.
// The host handler is responsible for acquiring and managing those authorizations.
// The main exceptions what are required for AWS, i.e. cognito and api paths, which are required for every host handler.
class AuthData {
    constructor( ) {
	this.who     = "";    // ceServer, which event is underway, for logging.
	this.job     = -1;    // ceServer, currently active job id

	this.api     = -1;    // AWS api path
	this.cog     = -1;    // AWS cognito id token
	this.cogLast = -1;    // AWS when was last cognito token acquired

	this.pat     = -1;    // GitHub personal access token
	this.ic      = -1;    // GitHub installation client for octokit
    }
    show() {
	console.log( "AuthData contents" );
	console.log( "   ", this.who, "with jobId:", this.job );
	console.log( "   ", "api path:", this.api, "last cog token acquisition:", this.cogLast );
	console.log( "   ", "gh pat:", this.pat );
    }
}

exports.AuthData = AuthData;
