var express = require('express');
var path    = require('path');
var logger  = require('morgan');
var cors    = require('cors');
var cookieParser = require('cookie-parser');
//var bodyParser   = require('body-parser');

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

ceServer.use(express.static(path.join(__dirname, 'public')));
ceServer.use(express.static(path.join(__dirname, 'public-flutter')));

var ceRouter = require('./routes/ceRouter');
ceServer.use('/archive/github', ceRouter);
ceServer.use('/github/testing', ceRouter);

var flutterRouter      = require('./routes/flutterRouter');
ceServer.use('/update/github', flutterRouter);

module.exports = ceServer;
