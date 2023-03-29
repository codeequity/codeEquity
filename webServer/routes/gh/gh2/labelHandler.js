const rootLoc = "../../../";

const assert      = require( 'assert' );

const config      = require( rootLoc + 'config' );

const utils    = require( rootLoc + 'utils/ceUtils' );
const awsUtils = require( rootLoc + 'utils/awsUtils' );
const ghUtils  = require( rootLoc + 'utils/gh/ghUtils' );

const ghV2      = require( rootLoc + 'utils/gh/gh2/ghV2Utils' );
const gh2DUtils = require( rootLoc + 'utils/gh/gh2/gh2DataUtils' );



async function handler( authData, ghLinks, pd, action, tag ) {

    // console.log( authData.job, pd.reqBody.issue.updated_at, "issue title:", pd.reqBody['issue']['title'], action );
    console.log( authData.who, "labelHandler start", authData.job );

    console.log( authData.who, "Label Handler NYI" );
    return;
}

exports.handler    = handler;
