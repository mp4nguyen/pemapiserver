var loopback = require('loopback');
var app = require('../../server/server'); //require `server.js` as in any node.js app
var moment = require('moment');

module.exports = function(Companies) {

    Companies.observe('before delete', function(ctx, next) {
        console.log('Going to delete %s matching %j',
            ctx.Model.pluralModelName,
            ctx.where);

        var currentUser = loopback.getCurrentContext().active.currentUser;
        if(currentUser.userType.indexOf("RediMed") >= 0 ){
            console.log("before delete =",ctx.where);
            app.models.BookingHeaders.find({where:{companyId:ctx.where.id}},function(err,data){
                console.log("before delete = ",data.length,err);
                if(data.length == 0){
                    next();
                }else{
                    //Stop the deletion of this Client
                    var err = new Error("Company has " + data.length + " bookings, cannot delete");
                    err.statusCode = 400;
                    console.log(err.toString());
                    next(err);
                }
            });
        } else {
            //Stop the deletion of this Client
            var err = new Error("Unauthorised user, cannot delete");
            err.statusCode = 400;
            console.log(err.toString());
            next(err);
        }
    });

    Companies.observe('access', function limitToUser(ctx, next) {
        /// before query, check the current user , so set the companyId and necessary  lists

        var companyId = loopback.getCurrentContext().active.companyId;
        var currentUser = loopback.getCurrentContext().active.currentUser;
        //console.log("Companies.observe('access' query = ",ctx.query);
        if(currentUser && (currentUser.userType.indexOf("Company") >= 0 )){
            //only modify the id when the account is a Company Account
            ctx.query.where = {id: companyId};
            //console.log("Companies.observe('access' query = ",ctx.query);
        }else if(currentUser.userType.indexOf("RediMed") >= 0 ){

        }
        next();
    });

    //get all subsidiaries of Redimed company for admin only.
    Companies.getRediSubsidiaries = function(cb) {

        var currentUser = loopback.getCurrentContext().active.currentUser;
        if(currentUser && currentUser.userType.indexOf("RediMed") >= 0){
            //check if the user is admin  ; if yes, return all subsidiaries
            Companies.find({where:{fatherId:112}},function(err,data){
                cb(err,data);
            });
        }
        else{
            cb("Authorization Required (For Admin only)",null);
        }
    };

    Companies.remoteMethod('getRediSubsidiaries', {
        returns: {arg: 'subsidiaries', type: 'array'},
        http: {path:'/getRediSubsidiaries', verb: 'get'}
    });


    //get all neceassary data for user to use the online booking

    Companies.initData = function(cb) {
        var _ = require('lodash');
        var currentUser = loopback.getCurrentContext().active.currentUser;
        var companyData = {};



        //Begin delete all holing calendar if the creation time older than 30 minutes
        var timeToDelete = moment().subtract(30,'m');
        //console.log('Will delete all holding calendars that older than ',timeToDelete);

        Companies.app.models.CalendarHoldings.destroyAll({"creationDate":{lte:timeToDelete}},function(err,data){
            //console.log(' error = ',err,' deleted holing calendar = ',data);
        });
        //End delete all holing calendar if the creation time older than 30 minutes

        if(currentUser && currentUser.userType.indexOf("RediMed") >= 0){
            //check if the user is admin  ; if yes, return all bookings
            Companies.find( {where:{id:currentUser.companyId},"include": ["subsidiaries","packages","positions","accounts"]},function(err,data){
                companyData = data[0];
                companyData = _.clone(data[0].__data);
                companyData.assessments = [];
                companyData.allBookings = [];
                companyData.telehealthBookings = [];
                companyData.allPackages = [];
                companyData.allPackagesOfAdmin = [];

                app.models.AssessmentHeaders.find({include:"assessments"},function(err,data){
                    companyData.assessments = data;
                    app.models.BookingCandidatesV.find({limit:1500,order:'creationDate DESC'},function(err,data){
                        companyData.allBookings = data;
                        //find all company that not is Redimed , this is used for booking on behalf of the companies
                        Companies.find({where:{id:{neq:112},fatherId:null},include:"subsidiaries"},function(err,data){
                            var temp = _.clone(data);
                            var arrayTemp = _.union(companyData.subsidiaries,temp);
                            companyData.subsidiaries = arrayTemp;
                            //console.log(">>>>>>>>>>><<<<<<<<<<<<<");
                            app.models.accounts.find({where:{id:{neq:currentUser.id}},include:"company"},function(err,accData){
                                var temp = _.clone(accData);
                                var arrayTemp = _.union(companyData.accounts,temp);
                                companyData.accounts = arrayTemp;
                                app.models.TelehealthBookings.find({limit:1500,order:'creationDate DESC'},function(err,telehealthBookingData){
                                    companyData.telehealthBookings = telehealthBookingData;
                                    cb(null,companyData);
                                });
                            });
                        });
                    });
                });
            });

        }else if(currentUser && currentUser.userType.indexOf("Company") >= 0){
            Companies.find( {where:{id:currentUser.companyId},"include": ["subsidiaries","packages","positions","accounts","telehealthBookings"]},function(err,data){
                companyData = data[0];
                companyData.assessments = [];

                companyData.allBookings = [];
                //console.log(companyData);
                app.models.AssessmentHeaders.find({include:"assessments"},function(err,data2){
                    companyData.assessments = data2;

                    app.models.BookingCandidatesV.find({where:{companyId :currentUser.companyId},limit:1000,order:'creationDate DESC'},function(err,data3){
                        companyData.allBookings = data3;
                        //console.log(data3[0]);
                        cb(null,companyData);
                    });
                });
            });
        }
        else{
            cb(null,"Authorization Required");
        }
    };

    Companies.remoteMethod('initData', {
        returns: {arg: 'initData', type: 'array'},
        http: {path:'/initData', verb: 'get'}
    });

    Companies.getPackages = function(cb) {
        var currentUser = loopback.getCurrentContext().active.currentUser;
        var companyData = {};
        if(currentUser){
            app.models.Packages.find({},function(err,data2){
                cb(null,data2);
            });
        }
        else{
            cb(null,"Authorization Required");
        }
    };

    Companies.remoteMethod('getPackages', {
        returns: {arg: 'packages', type: 'array'},
        http: {path:'/getPackages', verb: 'get'}
    });


    Companies.getAssessments = function(cb) {
        var currentUser = loopback.getCurrentContext().active.currentUser;

        if(currentUser){
          app.models.AssessmentHeaders.find({include:"assessments"},function(err,data){

              if(err) cb(err,err);

              cb(null,data);
          });
        }
        else{
            cb("Authorization Required",null);
        }
    };

    Companies.remoteMethod('getAssessments', {
        returns: {arg: 'assessments', type: 'array'},
        http: {path:'/getAssessments', verb: 'get'}
    });

    Companies.getPhoneBookingHeader = function(cb) {
        var accessToken = loopback.getCurrentContext().active.accessToken.id;


        if(accessToken){
          app.models.BookingHeaders.find({where:{accesstokenForPhoneBooking:accessToken}},function(err,data){
              var phoneBookingHeaderObject = {};
              console.log( accessToken,' getPhoneBookingHeader = ',err,data);
              if(err) cb(err,null);
              phoneBookingHeaderObject.bookingId = data[0].bookingId;
              phoneBookingHeaderObject.bookingPerson = data[0].bookingPerson;
              phoneBookingHeaderObject.contactEmail = data[0].contactEmail;
              phoneBookingHeaderObject.contactNumber = data[0].contactNumber;
              phoneBookingHeaderObject.companyId = data[0].companyId;
              phoneBookingHeaderObject.companyName = data[0].companyName;
              phoneBookingHeaderObject.subCompanyId = data[0].subCompanyId;
              cb(null,phoneBookingHeaderObject);


          });
        }
        else{
            cb("Authorization Required",null);
        }
    };

    Companies.remoteMethod('getPhoneBookingHeader', {
        returns: {arg: 'phoneBookingHeader', type: 'object'},
        http: {path:'/getPhoneBookingHeader', verb: 'get'}
    });

    // list Booking for admin and company
    //check account type before return data; if admin, return all; if company; only return the company's data
     Companies.listBookings = function(cb) {

        var currentUser = loopback.getCurrentContext().active.currentUser;
        if(currentUser && currentUser.userType.indexOf("RediMed") >= 0){
            //check if the user is admin  ; if yes, return all bookings
            app.models.BookingCandidatesV.find({limit:1000,order:'creationDate DESC'},function(r,r2){
                cb(null,r2);
            });
        }else if(currentUser && currentUser.userType.indexOf("Company") >= 0){
            app.models.BookingCandidatesV.find({where:{companyId :currentUser.companyId},limit:200,order:'creationDate DESC'},function(r,r2){
                cb(null,r2);
            });
        }
        else{
            cb(null,"Authorization Required");
        }
    };

    Companies.remoteMethod('listBookings', {
        returns: {arg: 'bookings', type: 'array'},
        http: {path:'/listBookings', verb: 'get'}
    });

    // list telehealthBookings Booking for admin and company
    //check account type before return data; if admin, return all; if company; only return the company's data
     Companies.listTelehealthBookings = function(cb) {

        var currentUser = loopback.getCurrentContext().active.currentUser;
        if(currentUser && currentUser.userType.indexOf("RediMed") >= 0){
            //check if the user is admin  ; if yes, return all bookings
            app.models.TelehealthBookings.find({limit:1000,order:'creationDate DESC'},function(r,r2){
                cb(null,r2);
            });
        }else if(currentUser && currentUser.userType.indexOf("Company") >= 0){
            app.models.TelehealthBookings.find({where:{companyId :currentUser.companyId},limit:500,order:'creationDate DESC'},function(r,r2){
                cb(null,r2);
            });
        }
        else{
            cb(null,"Authorization Required");
        }
    };

    Companies.remoteMethod('listTelehealthBookings', {
        returns: {arg: 'bookings', type: 'array'},
        http: {path:'/listTelehealthBookings', verb: 'get'}
    });

    Companies.countBookings = function(cb) {

        var currentUser = loopback.getCurrentContext().active.currentUser;
        if(currentUser && currentUser.userType.indexOf("RediMed") >= 0){
            //check if the user is admin  ; if yes, return all bookings
            app.models.BookingCandidatesV.count(function(r,r2){
                //console.log(r,r2);
                cb(null,r2);
            });
        }else if(currentUser && currentUser.userType.indexOf("Company") >= 0){
            app.models.BookingCandidatesV.count({companyId :currentUser.companyId},function(r,r2){
                //console.log(r,r2);
                cb(null,r2);
            });
        }
        else{
            cb(null,"Authorization Required");
        }
    };

    Companies.remoteMethod('countBookings', {
        returns: {arg: 'count', type: 'array'},
        http: {path:'/countBookings', verb: 'get'}
    });

    // list Assessment Headers
    Companies.listUser = function(cb) {

        var comId = loopback.getCurrentContext().active.companyId;
        if(comId){
            app.models.Accounts.find({"where":{"companyId":comId}},function(r,r2){
                //console.log("comId=",comId,"Users",r);
                cb(null,r2);
            });
        }else{
            cb(null,"Authorization Required");
        }

        //.Assessments({id:packageId},cb);  , "scope": {"include": ["students"]}
    };
    Companies.remoteMethod('listUser', {
        returns: {arg: 'users', type: 'array'},
        http: {path:'/list-user', verb: 'get'}
    });



    ///Get all site to make a booking
    Companies.getSites = function(cb) {
        var currentUser = loopback.getCurrentContext().active.currentUser;
        if(currentUser){
            Companies.app.models.Redimedsites.find({where:{ispreempbk:1},include:{relation:'States',scope:{include:'SubStates'}}},function(err,data){
                cb(err,data);
            });
        }
        else{
            cb("Authorization Required",null);
        }
    };

    Companies.remoteMethod('getSites', {
        returns: {arg: 'sites', type: 'array'},
        http: {path:'/getSites', verb: 'get'}
    });

    ///Get calendar to make a booking
    Companies.getCalendars = function(args,cb) {
        //console.log( "Companies.getCalendars = " , args);

        var siteID = args.id,fromDate = args.from, toDate = args.to;

        var currentUser = loopback.getCurrentContext().active.currentUser;
        if(currentUser){
            Companies.app.models.CalendarForCandidateV.find({where:{siteId:siteID,fromTime:{between:[(new Date(fromDate)),(new Date(toDate))]}}, order:'fromTime'},function(err,data){
                cb(err,data);
            });
        }
        else{
            cb("Authorization Required",null);
        }
    };

    Companies.remoteMethod('getCalendars', {
        accepts: [
            { arg: 'args', type: 'object', http: { source: 'body' } }
        ],
        returns: {arg: 'calendars', type: 'array'},
        http: {path:'/getCalendars', verb: 'post'}
    });

    ///Get all site to make a booking
    Companies.getStatus = function(cb) {
        var currentUser = loopback.getCurrentContext().active.currentUser;
        if(currentUser){
            Companies.app.models.SysBookingStatus.find(function(err,data){
                cb(err,data);
            });
        }
        else{
            cb("Authorization Required",null);
        }
    };

    Companies.remoteMethod('getStatus', {
        returns: {arg: 'status', type: 'array'},
        http: {path:'/getStatus', verb: 'get'}
    });
};
