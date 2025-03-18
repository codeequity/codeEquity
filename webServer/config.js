// ceServerConfig
// XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx

export const CE_ACTOR   = 'builderCE';
export const CE_BOT     = 'codeequity[bot]';
export const TESTER_BOT = 'cetester[bot]';

// CE Server locs
export const APIPATH_CONFIG_LOC  = './public-flutter/assets/files/api_base_path.txt';
export const COGNITO_CONFIG_LOC  = './public-flutter/assets/files/awsconfiguration.json';
export const CESERVER_CONFIG_LOC = '../ops/aws/auth/ceServerConfig.json';

// Default path locations:  CodeEquity app
export const CREDS_PATH          = '../ops/github/auth/ghAppCredentials';
export const SERVER_PAT_PATH     = "../ops/github/auth/ghBuilderPAT";
export const SERVER_NOREPO       = "CEServer-Wide";

export const GQL_ENDPOINT        = 'https://api.github.com/graphql';
export const TESTING_ENDPOINT    = 'http://127.0.0.1:3000/github/testing';


// Host notifier platforms
export const HOST_GH = "GitHub";

// Project Management Source
export const PMS_GHC = "GH Classic";   // Github's 'classic' projects that are now largely deprecated
export const PMS_GH2 = "GH Version 2"; // Github's 'Projects Version 2' projects

// For testing .. needs work
export const CREDS_TPATH       = "../ops/github/auth/ghAppTestCredentials";

export const TEST_PAT_PATH     = "../ops/github/auth/ghAriPAT";
export const CROSS_PAT_PATH    = "../ops/github/auth/ghAriPAT";
export const MULTI_PAT_PATH    = "../ops/github/auth/ghConniePAT"; 

export const TEST_OWNER        = "codeequity";
export const TEST_ACTOR        = "ariCETester";

export const TEST_REPO         = "ceTesterAri";
export const TEST_CEPID        = "CE_ServTest_usda23k425";    // XXX Remove once ceFlutter is back up
export const TEST_CEVID        = "CE_TEST_Serv_abcde12345";   // XXX Remove once ceFlutter is back up
export const TEST_NAME         = "CE Server Testing";         // XXX Remove once ceFlutter is back up
export const TEST_DESC         = "Internal testing: server";  // XXX Remove once ceFlutter is back up
export const FLUTTER_TEST_CEPID = "CE_FlutTest_ks8asdlg42";   // XXX Remove once ceFlutter is back up
export const FLUTTER_TEST_CEVID = "CE_TEST_Flut_abcde12345";  // XXX Remove once ceFlutter is back up
export const FLUTTER_TEST_REPO = "ceFlutterTester";
export const FLUTTER_TEST_NAME = "CE MD App Testing";          // XXX Remove once ceFlutter is back up
export const FLUTTER_TEST_DESC = "Internal testing: Front end"; // XXX Remove once ceFlutter is back up

export const CROSS_TEST_OWNER  = "codeequity";          
export const CROSS_TEST_ACTOR  = "ariCETester";          
export const CROSS_TEST_REPO   = "ceTesterAriAlt";
export const CROSS_TEST_CEPID  = "CE_AltTest_hakeld80a2";     // XXX Remove once ceFlutter is back up
export const CROSS_TEST_CEVID  = "CE_TEST_Alt_abcde12345";    // XXX Remove once ceFlutter is back up
export const CROSS_TEST_NAME   = "CE Alt Server Testing";     // XXX Remove once ceFlutter is back up
export const CROSS_TEST_DESC   = "Internal testing: server";  // XXX Remove once ceFlutter is back up

export const MULTI_TEST_OWNER  = "codeequity";
export const MULTI_TEST_ACTOR  = "connieCE";

export const MULTI_TEST_REPO   = "ceTesterConnie";
export const MULTI_TEST_CEPID  = "CE_ServTest_usda23k425";    // XXX Remove once ceFlutter is back up
export const MULTI_TEST_CEVID  = "CE_TEST_Serv_abcde12345";   // XXX Remove once ceFlutter is back up
export const MULTI_TEST_NAME   = "CE Server Testing";         // XXX Remove once ceFlutter is back up
export const MULTI_TEST_DESC   = "Internal testing: server";  // XXX Remove once ceFlutter is back up
export const FLUTTER_MULTI_TEST_REPO   = "ceFlutterConnie";
export const FLUTTER_MULTI_TEST_CEPID  = "CE_FlutTest_ks8asdlg42";    // XXX Remove once ceFlutter is back up
export const FLUTTER_MULTI_TEST_CEVID  = "CE_TEST_Flut_abcde12345";   // XXX Remove once ceFlutter is back up
export const FLUTTER_MULTI_TEST_NAME   = "CE MD App Testing";         // XXX Remove once ceFlutter is back up
export const FLUTTER_MULTI_TEST_DESC   = "Internal testing: Front end";  // XXX Remove once ceFlutter is back up


// Required project columns.  Can rename, not reorder, and retain CE functionality
// These are used in conjunction with ceRepoPrefs:PROJ_COLS
export const PROJ_PLAN = 0;  // for code maintainability - no type checking 
export const PROJ_PROG = 1;  
export const PROJ_PEND = 2;
export const PROJ_ACCR = 3;


// Peq label grammar
export const PEQ      = 'PEQ: ';
export const PDESC    = 'PEQ value: '; 

// Peq label names
export const PEQ_LABEL   = 'PEQ';

export const EMPTY     = '---';

// Flutter model enums
export const PEQTYPE_PLAN  = "plan";
export const PEQTYPE_PEND  = "pending";
export const PEQTYPE_GRANT = "grant";
export const PEQTYPE_END   = "end";

export const PACTVERB_CONF = "confirm";
export const PACTVERB_PROP = "propose";
export const PACTVERB_REJ  = "reject";

// XXX Tie this more formally to ../ceFlutter/lib/models/PEQAction.dart for notes & subjects
export const PACTACT_ADD  = "add";
export const PACTACT_DEL  = "delete";
export const PACTACT_NOTE = "notice";
export const PACTACT_ACCR = "accrue";
export const PACTACT_RELO = "relocate";   // For moving cards.  Use "Transfer out" if moving out of repo
export const PACTACT_CHAN = "change";     // Notes for change will be one of

export const PACTNOTE_PREN = "Project rename";
export const PACTNOTE_CREN = "Column rename";
export const PACTNOTE_ADDA = "add assignee";
export const PACTNOTE_PVU  = "peq val update";
export const PACTNOTE_RECR = "recreate";
export const PACTNOTE_CTIT = "Change title";

// server job queue operation
export const MAX_DELAYS = 30;          // how many times can a single job be pushed further back into queue waiting for pre-req job to complete
export const STEP_COST  = 500;         // expanding job backoff timer, step_cost * delay number millis
export const NOQ_DELAY  = 10000;       // backoff millis if queue is empty
export const MIN_DIFF   = 1000;        // min timestamp diff in millis for new insert location 

// GitHub related
export const GH_MAX_RETRIES  = 5;           // GH internals can be quite slow to update at times. Allow retries in some cases.
export const GH_GHOST        = "ghost";     // GH bot actions are executed by this actor
export const GH_NO_STATUS    = "No Status"; // GH name of column holding issues whose status has not yet been set
export const GH_BOT          = "github-project-automation[bot]"; // new GH bot name
export const GH_ISSUE_OPEN   = "OPEN";
export const GH_ISSUE_CLOSED = "CLOSED";
export const GH_ISSUE        = "Issue";
export const GH_ISSUE_DRAFT  = "DraftIssue";
export const GH_COL_FIELD    = "Status";    // GH uses a field named status to hold the columns for a project

// AWS related
export const MAX_AWS_RETRIES = 5;      // Very, very rarely, can see AWS timeouts

// server notification buffer size for testing
export const NOTICE_BUFFER_SIZE = 20;



// ceRepoPrefs
// XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx

export const PROJ_COLS = ["Planned", "In Progress", "Pending PEQ Approval", "Accrued" ];    // Project columns used by codeEquity
export const UNCLAIMED      = 'UnClaimed';                                                       // Catch-all project for peq issues with no project home

export const PEQ_COLOR  = 'ffcc80';   // github color for PEQ labels   alternative: fef2c0'

// XXX speculative
export const GH_TEMPLATE = "CodeEquity Project Template";                                   // Contains default view for CodeEquity projects for GitHub
export const GH_VIEW     = "CE View";                                                       // Name of custom CE view for Github projects
export const GH_VIEWCOL  = "CE Cols";                                                       // Name of custom GitHub field CE uses to display columns


/*
// export  CE_ACTOR;
export CE_BOT    = CE_BOT;
export TESTER_BOT = TESTER_BOT;
export PROJ_COLS = PROJ_COLS;
export PROJ_PLAN = PROJ_PLAN;
export PROJ_PROG = PROJ_PROG;
export PROJ_PEND = PROJ_PEND;
export PROJ_ACCR = PROJ_ACCR;

export PEQ_COLOR   = PEQ_COLOR;
export GH_TEMPLATE = GH_TEMPLATE;
export GH_VIEW     = GH_VIEW;
export GH_VIEWCOL  = GH_VIEWCOL;

export PEQ      = PEQ;
export PDESC    = PDESC;

export EMPTY     = EMPTY;
export UNCLAIMED = UNCLAIMED;

export HOST_GH      = HOST_GH;
export PMS_GHC      = PMS_GHC;
export PMS_GH2      = PMS_GH2;

export APIPATH_CONFIG_LOC  = APIPATH_CONFIG_LOC;
export COGNITO_CONFIG_LOC  = COGNITO_CONFIG_LOC;
export CESERVER_CONFIG_LOC = CESERVER_CONFIG_LOC;

export GQL_ENDPOINT     = GQL_ENDPOINT;
export TESTING_ENDPOINT = TESTING_ENDPOINT;

export CREDS_PATH       = CREDS_PATH;
export CREDS_TPATH      = CREDS_TPATH;
export SERVER_PAT_PATH  = SERVER_PAT_PATH
export SERVER_NOREPO    = SERVER_NOREPO
export TEST_PAT_PATH    = TEST_PAT_PATH
export CROSS_PAT_PATH   = CROSS_PAT_PATH
export MULTI_PAT_PATH   = MULTI_PAT_PATH
export TEST_OWNER       = TEST_OWNER;
export TEST_ACTOR       = TEST_ACTOR;
export TEST_REPO        = TEST_REPO;
export TEST_CEPID       = TEST_CEPID;
export TEST_CEVID       = TEST_CEVID;
export TEST_NAME        = TEST_NAME;
export TEST_DESC        = TEST_DESC;
export FLUTTER_TEST_CEPID = FLUTTER_TEST_CEPID;
export FLUTTER_TEST_CEVID = FLUTTER_TEST_CEVID;
export FLUTTER_TEST_NAME  = FLUTTER_TEST_NAME;
export FLUTTER_TEST_DESC  = FLUTTER_TEST_DESC;
export FLUTTER_TEST_REPO  = FLUTTER_TEST_REPO;
export CROSS_TEST_OWNER = CROSS_TEST_OWNER;
export CROSS_TEST_ACTOR  = CROSS_TEST_ACTOR;
export CROSS_TEST_REPO  = CROSS_TEST_REPO;
export CROSS_TEST_CEPID = CROSS_TEST_CEPID;
export CROSS_TEST_CEVID = CROSS_TEST_CEVID;
export CROSS_TEST_NAME  = CROSS_TEST_NAME;
export CROSS_TEST_DESC  = CROSS_TEST_DESC;
export MULTI_TEST_OWNER = MULTI_TEST_OWNER;
export MULTI_TEST_ACTOR  = MULTI_TEST_ACTOR;
export MULTI_TEST_REPO  = MULTI_TEST_REPO;
export MULTI_TEST_CEPID = MULTI_TEST_CEPID;
export MULTI_TEST_CEVID = MULTI_TEST_CEVID;
export MULTI_TEST_NAME  = MULTI_TEST_NAME;
export MULTI_TEST_DESC  = MULTI_TEST_DESC;
export FLUTTER_MULTI_TEST_REPO  = FLUTTER_MULTI_TEST_REPO;
export FLUTTER_MULTI_TEST_CEPID = FLUTTER_MULTI_TEST_CEPID;
export FLUTTER_MULTI_TEST_CEVID = FLUTTER_MULTI_TEST_CEVID;
export FLUTTER_MULTI_TEST_NAME  = FLUTTER_MULTI_TEST_NAME;
export FLUTTER_MULTI_TEST_DESC  = FLUTTER_MULTI_TEST_DESC;

export PEQ_LABEL   = PEQ_LABEL;

export PEQTYPE_PLAN  = PEQTYPE_PLAN;
export PEQTYPE_PEND  = PEQTYPE_PEND;
export PEQTYPE_GRANT = PEQTYPE_GRANT;
export PEQTYPE_END   = PEQTYPE_END;
             
export PACTVERB_CONF = PACTVERB_CONF;
export PACTVERB_PROP = PACTVERB_PROP;
export PACTVERB_REJ  = PACTVERB_REJ;
             
export PACTACT_ADD  = PACTACT_ADD;
export PACTACT_DEL  = PACTACT_DEL;
export PACTACT_NOTE = PACTACT_NOTE;
export PACTACT_ACCR = PACTACT_ACCR;
export PACTACT_RELO = PACTACT_RELO;
export PACTACT_CHAN = PACTACT_CHAN;

export PACTNOTE_PREN = PACTNOTE_PREN;
export PACTNOTE_CREN = PACTNOTE_CREN;
export PACTNOTE_ADDA = PACTNOTE_ADDA;
export PACTNOTE_PVU  = PACTNOTE_PVU;
export PACTNOTE_RECR = PACTNOTE_RECR;
export PACTNOTE_CTIT = PACTNOTE_CTIT;

export MAX_DELAYS = MAX_DELAYS;
export STEP_COST  = STEP_COST;
export NOQ_DELAY  = NOQ_DELAY;
export MIN_DIFF   = MIN_DIFF;

export GH_MAX_RETRIES  = GH_MAX_RETRIES;
export GH_GHOST        = GH_GHOST;
export GH_NO_STATUS    = GH_NO_STATUS;
export GH_BOT          = GH_BOT;
export GH_ISSUE_OPEN   = GH_ISSUE_OPEN;
export GH_ISSUE_CLOSED = GH_ISSUE_CLOSED;
export GH_ISSUE_DRAFT  = GH_ISSUE_DRAFT;
export GH_ISSUE        = GH_ISSUE;
export GH_COL_FIELD    = GH_COL_FIELD;

export NOTICE_BUFFER_SIZE = NOTICE_BUFFER_SIZE;

*/
