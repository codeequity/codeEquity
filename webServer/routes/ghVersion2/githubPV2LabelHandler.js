var assert      = require( 'assert' );

var config      = require( '../../config' );

const utils    = require( '../../utils/ceUtils' );
const awsUtils = require( '../../utils/awsUtils' );
const ghUtils  = require( '../../utils/gh/ghUtils' );

const ghV2     = require( '../../utils/gh/gh2/ghV2Utils' );
const gh2Data  = require( '../../utils/gh/gh2/gh2DataUtils' );



async function handler( authData, ghLinks, pd, action, tag ) {

    // console.log( authData.job, pd.reqBody.issue.updated_at, "issue title:", pd.reqBody['issue']['title'], action );
    console.log( authData.who, "labelHandler start", authData.job );

    console.log( "Label Handler NYI" );
    return;
}

exports.handler    = handler;
