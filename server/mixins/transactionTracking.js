
var moment = require('moment');
var loopback = require('loopback');

module.exports = function(Model, options) {
    'use strict';

    Model.observe('before save', function event(ctx, next) {
        var currentDateTime = moment(new Date()).format("YYYY-MM-DD HH:mm:ss") + "";
        var user;
        //console.log("tracsactionTracking.js Model.observe before save currentDateTime=",currentDateTime);
        if(loopback.getCurrentContext()){
            user = loopback.getCurrentContext().active.currentUser;
            if(!user){
                user = {};
                user.id = -1;
            }
            if (ctx.instance) {
                //console.log("tracsactionTracking.js Model.observe before save New record");
                ctx.instance.createdBy = user.id;
                ctx.instance.creationDate = currentDateTime;
                ctx.instance.lastUpdatedBy =  user.id;
                ctx.instance.lastUpdateDate = currentDateTime;
            } else {
                //console.log("tracsactionTracking.js Model.observe before save Update record");
                ctx.data.lastUpdatedBy =  user.id;
                ctx.data.lastUpdateDate = currentDateTime;
            }            
        }

        next();
    });

};

