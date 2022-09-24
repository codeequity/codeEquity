// ceServerConfig
// XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx

const CE_USER = 'codeEquity';
const CE_BOT  = 'codeequity[bot]';
const TESTER_BOT = 'cetester[bot]';

// CE Server locs
const APIPATH_CONFIG_LOC  = './public-flutter/assets/files/api_base_path.txt';
const COGNITO_CONFIG_LOC  = './public-flutter/assets/files/awsconfiguration.json';
const CESERVER_CONFIG_LOC = '../ops/aws/auth/ceServerConfig.json';

// Default path locations:  CodeEquity app
const CREDS_PATH          = '../ops/github/auth/ghAppCredentials';
const SERVER_PAT_PATH     = "../ops/github/auth/ghBuilderPAT";
const SERVER_NOREPO       = "CEServer-Wide";

const GQL_ENDPOINT        = 'https://api.github.com/graphql';
const TESTING_ENDPOINT    = 'http://127.0.0.1:3000/github/testing';


// Host notifier platforms
const HOST_GH = "Host:GitHub";

// Project Management Source
const PMS_GHC = "GH Classic";   // Github's 'classic' projects that are now largely deprecated
const PMS_GH2 = "GH Version 2"; // Github's 'Projects Version 2' projects

const PROJ_OPTIONS = [ PMS_GHC, PMS_GH2 ];
const PROJ_SOURCE  = PROJ_OPTIONS[1];  // Which project management system is the notification source for this effort


// For testing .. needs work
const CREDS_TPATH       = "../ops/github/auth/ghAppTestCredentials";

const TEST_PAT_PATH     = "../ops/github/auth/ghAriPAT";
const CROSS_PAT_PATH    = "../ops/github/auth/ghAriPAT";
const MULTI_PAT_PATH    = "../ops/github/auth/ghConniePAT"; 

const TEST_OWNER        = "ariCETester";
const TEST_REPO         = "CodeEquityTester";
const FLUTTER_TEST_REPO = "ceFlutterTester";

const CROSS_TEST_OWNER  = "ariCETester";          
const CROSS_TEST_REPO   = "ceTesterAlt";

const MULTI_TEST_OWNER  = "connieCE";
const MULTI_TEST_REPO   = "CodeEquityTester";


// Required project columns.  Can rename, not reorder, and retain CE functionality
// These are used in conjunction with ceRepoPrefs:PROJ_COLS
const PROJ_PLAN = 0;  // for code maintainability - no type checking 
const PROJ_PROG = 1;  
const PROJ_PEND = 2;
const PROJ_ACCR = 3;


// Peq label grammar
const PEQSTART = '<';
const PEQ      = 'PEQ: ';
const _PEQ     = ' PEQ';

const PPLAN    = PEQSTART + PEQ;
const PALLOC   = PEQSTART +'allocation';
const PDESC    = 'PEQ value: '; 
const ADESC    = 'Allocation ' + PDESC;

// Peq label names
const PEQ_LABEL   = 'PEQ';
const ALLOC_LABEL = 'AllocPEQ';

const EMPTY     = '---';

// Flutter model enums
const PEQTYPE_ALLOC = "allocation";
const PEQTYPE_PLAN  = "plan";
const PEQTYPE_PEND  = "pending";
const PEQTYPE_GRANT = "grant";
const PEQTYPE_END   = "end";

const PACTVERB_CONF = "confirm";
const PACTVERB_PROP = "propose";
const PACTVERB_REJ  = "reject";

const PACTACT_ADD  = "add";
const PACTACT_DEL  = "delete";
const PACTACT_NOTE = "notice";
const PACTACT_ACCR = "accrue";
const PACTACT_RELO = "relocate";
const PACTACT_CHAN = "change";


// server job queue operation
const MAX_DELAYS = 30;          // how many times can a single job be pushed further back into queue waiting for pre-req job to complete
const STEP_COST  = 300;         // expanding job backoff timer, step_cost * delay number millis
const NOQ_DELAY  = 20000;       // backoff millis if queue is empty
const MIN_DIFF   = 1000;        // min timestamp diff in millis for new insert location 

// GitHub related
const MAX_GH_RETRIES = 5;       // GH internals can be quite slow to update at times. Allow retries in some cases.

// AWS related
const MAX_AWS_RETRIES = 5;      // Very, very rarely, can see AWS timeouts

// server notification buffer size for testing
const NOTICE_BUFFER_SIZE = 20;

// XXX TEMP will go way
const POPULATE = "populate";


// ceRepoPrefs
// XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx

const PROJ_COLS = ["Planned", "In Progress", "Pending PEQ Approval", "Accrued" ];    // Project columns used by codeEquity
const MAIN_PROJ = 'Master';                                                          // Parent project for all tracked github projects in repo
const UNCLAIMED = 'UnClaimed';                                                       // Catch-all project for peq issues with no project home

const PEQ_COLOR  = 'ffcc80';   // github color for PEQ labels
const APEQ_COLOR = 'fef2c0';   // github color Alloc PEQ labels






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

exports.HOST_GH      = HOST_GH;
exports.PMS_GHC      = PMS_GHC;
exports.PMS_GH2      = PMS_GH2;
exports.PROJ_OPTIONS = PROJ_OPTIONS;
exports.PROJ_SOURCE  = PROJ_SOURCE;

exports.APIPATH_CONFIG_LOC  = APIPATH_CONFIG_LOC;
exports.COGNITO_CONFIG_LOC  = COGNITO_CONFIG_LOC;
exports.CESERVER_CONFIG_LOC = CESERVER_CONFIG_LOC;

exports.GQL_ENDPOINT     = GQL_ENDPOINT;
exports.TESTING_ENDPOINT = TESTING_ENDPOINT;

exports.CREDS_PATH       = CREDS_PATH;
exports.CREDS_TPATH      = CREDS_TPATH;
exports.SERVER_PAT_PATH  = SERVER_PAT_PATH
exports.SERVER_NOREPO    = SERVER_NOREPO
exports.TEST_PAT_PATH    = TEST_PAT_PATH
exports.CROSS_PAT_PATH   = CROSS_PAT_PATH
exports.MULTI_PAT_PATH   = MULTI_PAT_PATH
exports.TEST_OWNER       = TEST_OWNER;
exports.TEST_REPO        = TEST_REPO;
exports.FLUTTER_TEST_REPO = FLUTTER_TEST_REPO;
exports.CROSS_TEST_OWNER = CROSS_TEST_OWNER;
exports.CROSS_TEST_REPO  = CROSS_TEST_REPO;
exports.MULTI_TEST_OWNER = MULTI_TEST_OWNER;
exports.MULTI_TEST_REPO  = MULTI_TEST_REPO;

exports.PEQ_LABEL   = PEQ_LABEL;
exports.ALLOC_LABEL = ALLOC_LABEL;

exports.PEQTYPE_ALLOC = PEQTYPE_ALLOC;
exports.PEQTYPE_PLAN  = PEQTYPE_PLAN;
exports.PEQTYPE_PEND  = PEQTYPE_PEND;
exports.PEQTYPE_GRANT = PEQTYPE_GRANT;
exports.PEQTYPE_END   = PEQTYPE_END;
             
exports.PACTVERB_CONF = PACTVERB_CONF;
exports.PACTVERB_PROP = PACTVERB_PROP;
exports.PACTVERB_REJ  = PACTVERB_REJ;
             
exports.PACTACT_ADD  = PACTACT_ADD;
exports.PACTACT_DEL  = PACTACT_DEL;
exports.PACTACT_NOTE = PACTACT_NOTE;
exports.PACTACT_ACCR = PACTACT_ACCR;
exports.PACTACT_RELO = PACTACT_RELO;
exports.PACTACT_CHAN = PACTACT_CHAN;

exports.MAX_DELAYS = MAX_DELAYS;
exports.STEP_COST  = STEP_COST;
exports.NOQ_DELAY  = NOQ_DELAY;
exports.MIN_DIFF   = MIN_DIFF;

exports.NOTICE_BUFFER_SIZE = NOTICE_BUFFER_SIZE;
