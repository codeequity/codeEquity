const CE_BOT = 'codeequity[bot]';

// oi, no strongly-typed enums.  Can rename, not reorder, and retain CE functionality
const PROJ_COLS = ["Planned", "In Progress", "Pending PEQ Approval", "Accrued" ];
const PROJ_PLAN = 0;   // Only real utility is code maintainability
const PROJ_PROG = 1;  
const PROJ_PEND = 2;
const PROJ_ACCR = 3;

// XXX Hmm better as two enums?
const PEQ_COLOR = 'ffcc80';

const PEQSTART = '<';
const PEQ      = 'PEQ: ';
const _PEQ     = ' PEQ';

const PPLAN    = PEQSTART + PEQ;
const PALLOC   = PEQSTART +'allocation';
const PDESC    = 'PEQ value: '; 

// XXX kill these?
const PEQ_1K   = PEQSTART +'PEQ: 1000>';
const PEQ_1Kc  = PEQSTART +'PEQ: 1,000>';
const PEQ_10K  = '<PEQ: 10000>';
const PEQ_10Kc = '<PEQ: 10,000>';
const PEQ_50K  = '<PEQ: 50000>';
const PEQ_50Kc = '<PEQ: 50,000>';

const MAIN_PROJ = 'Master';

const EMPTY    = '---';


// Default path locations
const APIPATH_CONFIG_LOC  = './public-flutter/assets/files/api_base_path.txt';
const COGNITO_CONFIG_LOC  = './public-flutter/assets/files/awsconfiguration.json';
const CESERVER_CONFIG_LOC = '../ops/aws/auth/ceServerConfig.json';


exports.CE_BOT    = CE_BOT;
exports.PROJ_COLS = PROJ_COLS;
exports.PROJ_PLAN = PROJ_PLAN;
exports.PROJ_PROG = PROJ_PROG;
exports.PROJ_PEND = PROJ_PEND;
exports.PROJ_ACCR = PROJ_ACCR;

exports.PEQ_COLOR = PEQ_COLOR;

exports.PEQSTART = PEQSTART;
exports.PEQ      = PEQ;
exports._PEQ     = _PEQ;
exports.PPLAN    = PPLAN;
exports.PALLOC   = PALLOC;
exports.PDESC    = PDESC;

exports.PEQ_1K   = PEQ_1K;
exports.PEQ_1Kc  = PEQ_1Kc;
exports.PEQ_10K  = PEQ_10K;
exports.PEQ_10Kc = PEQ_10Kc;
exports.PEQ_50K  = PEQ_50K;
exports.PEQ_50Kc = PEQ_50Kc;

exports.MAIN_PROJ = MAIN_PROJ;
exports.EMPTY    = EMPTY;

exports.APIPATH_CONFIG_LOC  = APIPATH_CONFIG_LOC;
exports.COGNITO_CONFIG_LOC  = COGNITO_CONFIG_LOC;
exports.CESERVER_CONFIG_LOC = CESERVER_CONFIG_LOC;
