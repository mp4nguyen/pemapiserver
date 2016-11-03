module.exports = function(AngularLog) {

    AngularLog.insertLogs = function(data,cb) {

        //console.log("AngularLog.insertLogs = ",data);
        AngularLog.create(data.logs,function(err,logs){
            //console.log(' Added =', err,logs);
            cb(null,logs);
        });
    };

    AngularLog.remoteMethod('insertLogs', {
        accepts: [
            { arg: 'data', type: 'object', http: { source: 'body' } }
        ],
        returns: {arg: 'logs', type: 'array'},
        http: {path:'/insertLogs', verb: 'post'}
    });
};