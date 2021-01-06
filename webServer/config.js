const CE_USER = 'codeEquity';
const CE_BOT  = 'codeequity[bot]';
const TESTER_BOT = 'cetester[bot]';

// Default path locations
const APIPATH_CONFIG_LOC  = './public-flutter/assets/files/api_base_path.txt';
const COGNITO_CONFIG_LOC  = './public-flutter/assets/files/awsconfiguration.json';
const CESERVER_CONFIG_LOC = '../ops/aws/auth/ceServerConfig.json';


// oi, no strongly-typed enums.  Can rename, not reorder, and retain CE functionality
const PROJ_COLS = ["Planned", "In Progress", "Pending PEQ Approval", "Accrued" ];
const PROJ_PLAN = 0;  // for code maintainability - no type checking 
const PROJ_PROG = 1;  
const PROJ_PEND = 2;
const PROJ_ACCR = 3;

const POPULATE = "populate";

// XXX Hmm better as two enums?
const PEQ_COLOR = 'ffcc80';
const APEQ_COLOR = 'fef2c0';

const PEQSTART = '<';
const PEQ      = 'PEQ: ';
const _PEQ     = ' PEQ';

const PPLAN    = PEQSTART + PEQ;
const PALLOC   = PEQSTART +'allocation';
const PDESC    = 'PEQ value: '; 
const ADESC    = 'Allocation ' + PDESC;

const MAIN_PROJ = 'Master';

const EMPTY     = '---';
const UNCLAIMED = 'UnClaimed';

const GQL_ENDPOINT = "https://api.github.com/graphql";

const CREDS_PATH  = "../ops/github/auth/ghAppCredentials";
const CREDS_TPATH = "../ops/github/auth/ghAppTestCredentials";
const PAT_PATH    = "../ops/github/auth/ghPersonalAccessToken"; 
const TEST_OWNER  = "rmusick2000";
const TEST_REPO   = "CodeEquityTester";

exports.CE_USER   = CE_USER;
exports.CE_BOT    = CE_BOT;
exports.TESTER_BOT = TESTER_BOT;
exports.PROJ_COLS = PROJ_COLS;
exports.PROJ_PLAN = PROJ_PLAN;
exports.PROJ_PROG = PROJ_PROG;
exports.PROJ_PEND = PROJ_PEND;
exports.PROJ_ACCR = PROJ_ACCR;

exports.POPULATE = POPULATE;

exports.PEQ_COLOR = PEQ_COLOR;
exports.APEQ_COLOR = APEQ_COLOR;

exports.PEQSTART = PEQSTART;
exports.PEQ      = PEQ;
exports._PEQ     = _PEQ;
exports.PPLAN    = PPLAN;
exports.PALLOC   = PALLOC;
exports.PDESC    = PDESC;
exports.ADESC    = ADESC;

exports.MAIN_PROJ = MAIN_PROJ;
exports.EMPTY     = EMPTY;
exports.UNCLAIMED = UNCLAIMED;

exports.APIPATH_CONFIG_LOC  = APIPATH_CONFIG_LOC;
exports.COGNITO_CONFIG_LOC  = COGNITO_CONFIG_LOC;
exports.CESERVER_CONFIG_LOC = CESERVER_CONFIG_LOC;

exports.GQL_ENDPOINT = GQL_ENDPOINT;

exports.CREDS_PATH  = CREDS_PATH;
exports.CREDS_TPATH = CREDS_TPATH;
exports.PAT_PATH    = PAT_PATH
exports.TEST_OWNER  = TEST_OWNER;
exports.TEST_REPO   = TEST_REPO;
