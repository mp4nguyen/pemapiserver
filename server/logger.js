/**
 * Created by phuongnguyen on 13/01/16.
 */
var winston = require('winston');
winston.emitErrs = true;
var logDirectory = __dirname + '/log'
var dateFormat = require('dateformat');

//module.exports = logger;
//var winston = require('winston');
//var configs = require('./env.js');

var debug = new winston.Logger({
    levels: {
        debug: 0
    },
    transports: [
        new winston.transports.File({
            level:"debug",
            filename: logDirectory + '/debug-logs.log',
            handleExceptions: true,
            json: true,
            maxsize: 5242880, //5MB
            maxFiles: 100,
            colorize: false,
            timestamp:function() { return dateFormat((new Date()), "dd/mm/yyyy, hh:MM:ss");}
        })
    ]
});

var info = new winston.Logger({
    levels: {
        info: 1
    },
    transports: [
        new winston.transports.File({
            level:"info",
            filename: logDirectory + '/info-logs.log',
            handleExceptions: true,
            json: true,
            maxsize: 5242880, //5MB
            maxFiles: 100,
            colorize: false,
            timestamp:function() { return dateFormat((new Date()), "dd/mm/yyyy, hh:MM:ss");}
        }),
        new winston.transports.Console({
            level:"info",
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp:function() { return dateFormat((new Date()), "dd/mm/yyyy, hh:MM:ss");}
        })
    ]
});

var warn = new winston.Logger({
    levels: {
        warn: 2
    },
    transports: [
        new winston.transports.File({
            level:"warn",
            filename: logDirectory + '/warn-logs.log',
            handleExceptions: true,
            json: true,
            maxsize: 5242880, //5MB
            maxFiles: 100,
            colorize: false,
            timestamp:function() { return dateFormat((new Date()), "dd/mm/yyyy, hh:MM:ss");}
        }),
        new winston.transports.Console({
            level:"warn",
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp:function() { return dateFormat((new Date()), "dd/mm/yyyy, hh:MM:ss");}
        })
    ]
});

var error = new winston.Logger({
    levels: {
        error: 3
    },
    transports: [
        new winston.transports.File({
            level:"error",
            filename: logDirectory + '/error-logs.log',
            handleExceptions: true,
            json: true,
            maxsize: 5242880, //5MB
            maxFiles: 100,
            colorize: false,
            timestamp:function() { return dateFormat((new Date()), "dd/mm/yyyy, hh:MM:ss");}
        }),
        new winston.transports.Console({
            level:"error",
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp:function() { return dateFormat((new Date()), "dd/mm/yyyy, hh:MM:ss");}
        })
    ]
});

var exports = {
    debug: function(msg){
        debug.debug(msg);
    },
    info: function(msg){
        info.info(msg);
    },
    warn: function(msg){
        warn.warn(msg);
    },
    error: function(msg){
        error.error(msg);
    },
    log: function(level,msg){
        var lvl = exports[level];
        lvl(msg);
    }
};

module.exports = exports;
