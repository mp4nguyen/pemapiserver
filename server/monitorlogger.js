/**
 * Created by phuongnguyen on 13/01/16.
 */
var winston = require('winston');
winston.emitErrs = true;
var logDirectory = __dirname + '/monitor_logs'
var dateFormat = require('dateformat');

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
        })
    ]
});

var clientInfor = new winston.Logger({
    levels: {
        warn: 2
    },
    transports: [
        new winston.transports.File({
            level:"warn",
            filename: logDirectory + '/clientInfor-logs.log',
            handleExceptions: true,
            json: true,
            maxsize: 5242880, //5MB
            maxFiles: 100,
            colorize: false,
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
        })
    ]
});

var exports = {
    debug: function(msg){
        debug.debug(msg);
    },
    info: function(msg){
      if(msg.indexOf('.css') > 0 ||msg.indexOf('.html') > 0 ||msg.indexOf('.js') > 0 ||msg.indexOf('.png') > 0){

      }else{
        info.info(msg);
      }
    },
    clientInfor: function(msg){
        clientInfor.warn(msg);
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
