const auth = require( "./auth" );

// XXX Gimme a fname
async function getRemotePackageJSONObject(owner, repo, installationAccessToken) {
    // const installationClient = await auth.getInstallationClient(installationAccessToken);
    const installationClient = await auth.getInstallationClient(owner, repo);
    const fileData = await installationClient.repos.getContents({
	owner,
	repo,
	path: 'package.json',
    });
    const fileObject = JSON.parse(Buffer.from(fileData.data.content, 'base64').toString());
    return fileObject;
};


// XXX will save entire issue, plus pull out specific metadata (title, name, date, peq)
async function recordPEQ( title, peqAmount ) {
    console.log( "Recording", peqAmount, "PEQs for", title );
}


exports.getRemotePackageJSONObject = getRemotePackageJSONObject;
exports.recordPEQ = recordPEQ;
