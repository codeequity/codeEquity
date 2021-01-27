var assert = require('assert');

var utils   = require('../utils');
var ghUtils = require('../ghUtils');
var config  = require('../config');

var gh     = ghUtils.githubUtils;
var ghSafe = ghUtils.githubSafe;


// Actions: created, edited, or deleted
async function handler( authData, ghLinks, pd, action, tag ) {

    // Sender is the event generator.
    let sender   = pd.reqBody['sender']['login'];
    console.log( authData.job, pd.reqBody.label.updated_at, "label name:", pd.reqBody.label.name, action );
    
    switch( action ) {
    case 'created':
	{
	    
	}
	break;
    case 'edited':
	{
	}
	break;
    case 'deleted':
	{
	}
	break;
    default:
	console.log( "Unrecognized action (label)" );
	break;
    }
    
    return;
}

exports.handler = handler;
