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
// action( add, remove, update )  verb( propose, confirm, reject)  assignees   sender(login)  date  raw_reqBody
// also allow actionNote, i.e. 'issue reopened, not full CE project layout, no related card moved"
// Assignees split evenly
async function recordPEQ( title, peqAmount ) {
    console.log( "Recording", peqAmount, "PEQs for", title );
}


exports.getRemotePackageJSONObject = getRemotePackageJSONObject;
exports.recordPEQ = recordPEQ;
