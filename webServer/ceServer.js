var express = require('express');
var path    = require('path');
var logger  = require('morgan');
var cors    = require('cors');
var cookieParser = require('cookie-parser');
//var bodyParser   = require('body-parser');

var ceServer = express();

ceServer.use(logger('dev'));
ceServer.use(express.json());
//ceServer.use(bodyParser.json());
ceServer.use(express.urlencoded({ extended: false }));
ceServer.use(cookieParser());
ceServer.use(cors());

ceServer.use(express.static(path.join(__dirname, 'public')));
ceServer.use(express.static(path.join(__dirname, 'public-flutter')));

var githubIssueHandler = require('./routes/githubIssueHandler');
var githubCardHandler  = require('./routes/githubCardHandler');
var githubMergeHandler = require('./routes/githubMergeHandler');
ceServer.use('/archive/github/issue', githubIssueHandler);
ceServer.use('/archive/github/card', githubCardHandler);
ceServer.use('/archive/github/merge', githubMergeHandler);

var flutterRouter      = require('./routes/flutterRouter');
ceServer.use('/update/github', flutterRouter);

module.exports = ceServer;
