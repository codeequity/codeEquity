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

export const FAIL_CROSS_TEST_OWNER  = "codeequity";          
export const FAIL_CROSS_TEST_ACTOR  = "ariCETester";          
export const FAIL_CROSS_TEST_REPO   = "ceTesterAriAlt";
export const FAIL_CROSS_TEST_CEPID  = "CE_AltTest_hakeld80a2";     // XXX Remove once ceFlutter is back up
export const FAIL_CROSS_TEST_CEVID  = "CE_TEST_Alt_abcde12345";    // XXX Remove once ceFlutter is back up
export const FAIL_CROSS_TEST_NAME   = "CE Alt Server Testing";     // XXX Remove once ceFlutter is back up
export const FAIL_CROSS_TEST_DESC   = "Internal testing: server";  // XXX Remove once ceFlutter is back up

export const CROSS_TEST_OWNER  = "codeequity";          
export const CROSS_TEST_ACTOR  = "ariCETester";          
export const CROSS_TEST_REPO   = "ceTesterConnie";
export const CROSS_TEST_CEPID  = "CE_ServTest_usda23k425";    // XXX Remove once ceFlutter is back up
export const CROSS_TEST_CEVID  = "CE_TEST_Serv_abcde12345";   // XXX Remove once ceFlutter is back up
export const CROSS_TEST_NAME   = "CE Server Testing";         // XXX Remove once ceFlutter is back up
export const CROSS_TEST_DESC   = "Internal testing: server";  // XXX Remove once ceFlutter is back up
export const FLUTTER_CROSS_TEST_REPO   = "ceFlutterConnie";
export const FLUTTER_CROSS_TEST_CEPID  = "CE_FlutTest_ks8asdlg42";     // XXX Remove once ceFlutter is back up
export const FLUTTER_CROSS_TEST_CEVID  = "CE_TEST_Flut_abcde12345";    // XXX Remove once ceFlutter is back up
export const FLUTTER_CROSS_TEST_NAME   = "CE MD App Testing";          // XXX Remove once ceFlutter is back up
export const FLUTTER_CROSS_TEST_DESC   = "Internal testing: Front end";  // XXX Remove once ceFlutter is back up

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
export const PACTACT_CHAN = "change";     // Note below will further disambiguate change

export const PACTNOTE_PREN = "Project rename";
export const PACTNOTE_PCLO = "Project closed";
export const PACTNOTE_CREN = "Column rename";
export const PACTNOTE_ADDA = "add assignee";
export const PACTNOTE_REMA = "remove assignee";
export const PACTNOTE_PVU  = "peq val update";
export const PACTNOTE_RECR = "recreate";
export const PACTNOTE_CTIT = "Change title";
export const PACTNOTE_UNLB = "unlabel";
export const PACTNOTE_BXFR = "Bad transfer attempted";
export const PACTNOTE_GXFR = "Transferred";
export const PACTNOTE_XFRD = "Transferred out";
export const PACTNOTE_BLEA = "PEQ label edit attempt";
export const PACTNOTE_BLDA = "PEQ label delete attempt";

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
