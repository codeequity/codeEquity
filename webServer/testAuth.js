const auth = require( "./auth");
const utils = require( "./utils" );
const owner = 'codeEquity';
const repo = 'testbed';


async function runTests() {

    var iaToken = "";

    await auth.getInstallationAccessToken(owner, repo)
	.then((token) => iaToken = token );

    await auth.getInstallationClient( owner, repo )
	.then((obj) => console.log(obj));
    
    utils.getRemotePackageJSONObject(owner, repo, iaToken)
	.then((obj) => console.log(obj));


}

//runTests();
exports.runTests = runTests;
