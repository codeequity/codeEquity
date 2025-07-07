import  express from 'express';
import  path    from 'path';
import  logger  from 'morgan';
import  cors    from 'cors';
import  cookieParser from 'cookie-parser';
//var bodyParser   = require('body-parser');
import { fileURLToPath } from 'url';
import { dirname } from 'path';


var ceServer = express();

process.on('SIGTERM', () => {
    console.log('Closed out remaining connections');
    // server.close();
    process.exit(0);
});

// ctrl-c
process.on('SIGINT', () => {
    console.log('Closed out remaining connections');
    // server.close();
    process.exit(0);
});

ceServer.use(logger('combined', { skip: function (req, res) { return res.statusCode < 400 }}));
ceServer.use(express.json());
//ceServer.use(bodyParser.json());
ceServer.use(express.urlencoded({ extended: false }));
ceServer.use(cookieParser());
ceServer.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

ceServer.use(express.static(path.join(__dirname, 'public')));
ceServer.use(express.static(path.join(__dirname, 'public-flutter')));

import * as ceRouter from './routes/ceRouter.js';
ceServer.use('/ceServer/server', ceRouter.router);  // hosts send peq updates here
ceServer.use('/ceServer/ceMD', ceRouter.router);    // ceMD interacts with ceServer here
ceServer.use('/github/testing', ceRouter.router);   // ce-github testing interacts with ceServer here

// import * as flutterRouter from './routes/flutterRouter.js';
// ceServer.use('/update/github', flutterRouter.router);

export default ceServer;
