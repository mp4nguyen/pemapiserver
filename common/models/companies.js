var loopback = require('loopback');
var app = require('../../server/server'); //require `server.js` as in any node.js app
var moment = require('moment');
var HashMap = require('hashmap');
var _ = require('lodash');

module.exports = function(Companies) {

    Companies.observe('before delete', function(ctx, next) {
        console.log('Going to delete %s matching %j',
            ctx.Model.pluralModelName,
            ctx.where);

        var currentUser = loopback.getCurrentContext().active.currentUser;
        if (currentUser.userType.indexOf("RediMed") >= 0) {
            console.log("before delete =", ctx.where);
            app.models.BookingHeaders.find({ where: { companyId: ctx.where.id } }, function(err, data) {
                console.log("before delete = ", data.length, err);
                if (data.length == 0) {
                    next();
                } else {
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
        if (currentUser && (currentUser.userType.indexOf("Company") >= 0)) {
            //only modify the id when the account is a Company Account
            ctx.query.where = { id: companyId };
            //console.log("Companies.observe('access' query = ",ctx.query);
        } else if (currentUser.userType.indexOf("RediMed") >= 0) {

        }
        next();
    });



    Companies.ping = function(args, cb) {
        Companies.app.models.Assessments.find({ where: { id: 1 } }, function(err, data) {
            if(err){
                console.log(" Companies.ping err = ",err);
            }else{
                cb(null,{status:"OK",pid:process.pid})
            }
        });
    }


    Companies.remoteMethod('ping', {
        accepts: [
            { arg: 'args', type: 'object', http: { source: 'body' } }
        ],
        returns: { arg: 'ping', type: 'object' },
        http: { path: '/ping', verb: 'get' }
    });

    //get all subsidiaries of Redimed company for admin only.
    Companies.getRediSubsidiaries = function(cb) {

        var currentUser = loopback.getCurrentContext().active.currentUser;
        if (currentUser && currentUser.userType.indexOf("RediMed") >= 0) {
            //check if the user is admin  ; if yes, return all subsidiaries
            Companies.find({ where: { fatherId: 112 } }, function(err, data) {
                cb(err, data);
            });
        } else {
            cb("Authorization Required (For Admin only)", null);
        }
    };

    Companies.remoteMethod('getRediSubsidiaries', {
        returns: { arg: 'subsidiaries', type: 'array' },
        http: { path: '/getRediSubsidiaries', verb: 'get' }
    });

    //get all neceassary data for user to use the online booking
    Companies.initData = function(cb) {
        var _ = require('lodash');
        var currentUser = loopback.getCurrentContext().active.currentUser;
        var originalCompanyId = loopback.getCurrentContext().active.originalCompanyId;
        var companyData = {};
        //Begin delete all holing calendar if the creation time older than 30 minutes
        var timeToDelete = moment().subtract(3, 'm');
        //console.log('Will delete all holding calendars that older than ',timeToDelete);

        Companies.app.models.CalendarHoldings.find({ where: { "creationDate": { lte: timeToDelete } } }, function(err, data) {
            console.log('---> find the expired holding = ', err, data);
            Companies.app.models.CalendarHoldings.destroyAll({ "creationDate": { lte: timeToDelete } }, function(err, data) {
                console.log('deleted CalendarHoldings = ', err, data);
            });
            data.forEach(function(hold) {
                Companies.app.models.CalendarHoldingDetails.destroyAll({ holdingId: hold.holdingId }, function(err, data) {
                    console.log('deleted CalendarHoldingDetails = ', err, data);
                });
            });
        });

        //End delete all holing calendar if the creation time older than 30 minutes

        if (currentUser && currentUser.userType.indexOf("RediMed") >= 0) {
            //check if the user is admin  ; if yes, return all bookings
            Companies.find({ where: { id: currentUser.companyId }, "include": [
                                                                                "subsidiaries",
                                                                                { relation:'packages',scope:{include: {"relation": "AssessmentHeaders","scope": {"include": ["Assessments"]}}  }  },
                                                                                "positions",
                                                                                "accounts"]
                                                                              }, function(err, data) {
                companyData = data[0];
                companyData = _.clone(data[0].__data);
                companyData.assessments = [];
                companyData.allBookings = [];
                companyData.telehealthBookings = [];
                companyData.allPackages = [];
                companyData.allPackagesOfAdmin = [];

                app.models.AssessmentHeaders.find({ include: "assessments" }, function(err, data) {
                    companyData.assessments = data;
                    app.models.BookingCandidatesV.find({ limit: 2000, order: 'creationDate DESC' }, function(err, data) {
                        companyData.allBookings = data;
                        //find all company that not is Redimed , this is used for booking on behalf of the companies
                        Companies.find({ where: { id: { neq: 112 }, fatherId: null }, include: "subsidiaries" }, function(err, data) {
                            var temp = _.clone(data);
                            var arrayTemp = _.union(companyData.subsidiaries, temp);
                            companyData.subsidiaries = arrayTemp;
                            //console.log(">>>>>>>>>>><<<<<<<<<<<<<");
                            app.models.accounts.find({ where: { id: { neq: currentUser.id } }, include: "company" }, function(err, accData) {
                                var temp = _.clone(accData);
                                var arrayTemp = _.union(companyData.accounts, temp);
                                companyData.accounts = arrayTemp;
                                app.models.TelehealthBookings.find({ limit: 1500, order: 'creationDate DESC' }, function(err, telehealthBookingData) {
                                    companyData.telehealthBookings = telehealthBookingData;
                                    cb(null, companyData);
                                });
                            });
                        });
                    });
                });
            });

        } else if (currentUser && currentUser.userType.indexOf("Company") >= 0) {
            Companies.find({ where: { id: currentUser.companyId }, "include": [
                                                                                "subsidiaries",
                                                                                { relation:'packages',scope:{include: {"relation": "AssessmentHeaders","scope": {"include": ["Assessments"]}}  }  },
                                                                                "positions",
                                                                                "accounts",
                                                                                "telehealthBookings"] }, function(err, data) {
                companyData = data[0];
                companyData.assessments = [];
                companyData.allBookings = [];
                //console.log(companyData);
                app.models.AssessmentHeaders.find({ include: "assessments" }, function(err, data2) {
                    companyData.assessments = data2;
                    app.models.AccountCompanies.find({ where: { accountId: currentUser.id, isenable: 1 } }, function(err, data) {
                        console.log("app.models.AccountCompanies = ", err, data);
                        var companyIDs = [];
                        companyIDs.push(originalCompanyId);
                        data.forEach((company) => {
                            companyIDs.push(company.companyId);
                        });
                        console.log('will get bookings from a list of company :',companyIDs);
                        app.models.BookingCandidatesV.find({ where: { companyId: { inq: companyIDs } }, limit: 1000, order: 'creationDate DESC' }, function(err, data3) {
                            companyData.allBookings = data3;
                            //console.log(data3[0]);
                            cb(null, companyData);
                        });
                    });
                });
            });
        } else {
            cb(null, "Authorization Required");
        }
    };

    Companies.remoteMethod('initData', {
        returns: { arg: 'initData', type: 'array' },
        http: { path: '/initData', verb: 'get' }
    });

    Companies.getPackages = function(criteria,cb) {
        var currentUser = loopback.getCurrentContext().active.currentUser;
        var companyData = {};

        console.log('Companies.getPackages => criteria = ',criteria);

        if (currentUser) {
            if(criteria.id){
              app.models.Packages.find({where:{id:criteria.id}, include: {"relation": "AssessmentHeaders","scope": {"include": ["Assessments"]}}  }, function(err, data2) {
                  console.log('Companies.getPackages => find packages = ',err,data2);
                  cb(null, data2);
              });
            }else{
              app.models.Packages.find({ include: {"relation": "AssessmentHeaders","scope": {"include": ["Assessments"]}}  }, function(err, data2) {
                  console.log('Companies.getPackages => find packages = ',err,data2);
                  cb(null, data2);
              });
            }
        } else {
            cb(null, "Authorization Required");
        }
    };

    Companies.remoteMethod('getPackages', {
        accepts: [
            { arg: 'args', type: 'object', http: { source: 'body' } }
        ],
        returns: { arg: 'packages', type: 'array' },
        http: { path: '/getPackages', verb: 'post' }
    });

    Companies.getAssessments = function(cb) {
        var currentUser = loopback.getCurrentContext().active.currentUser;

        if (currentUser) {
            app.models.AssessmentHeaders.find({ include: "assessments" }, function(err, data) {

                if (err) cb(err, err);

                cb(null, data);
            });
        } else {
            cb("Authorization Required", null);
        }
    };

    Companies.remoteMethod('getAssessments', {
        returns: { arg: 'assessments', type: 'array' },
        http: { path: '/getAssessments', verb: 'get' }
    });

    Companies.getPhoneBookingHeader = function(cb) {
        var accessToken = loopback.getCurrentContext().active.accessToken.id;


        if (accessToken) {
            app.models.BookingHeaders.find({ where: { accesstokenForPhoneBooking: accessToken } }, function(err, data) {
                var phoneBookingHeaderObject = {};
                console.log(accessToken, ' getPhoneBookingHeader = ', err, data);
                if (err) cb(err, null);
                phoneBookingHeaderObject.bookingId = data[0].bookingId;
                phoneBookingHeaderObject.bookingPerson = data[0].bookingPerson;
                phoneBookingHeaderObject.contactEmail = data[0].contactEmail;
                phoneBookingHeaderObject.contactNumber = data[0].contactNumber;
                phoneBookingHeaderObject.companyId = data[0].companyId;
                phoneBookingHeaderObject.companyName = data[0].companyName;
                phoneBookingHeaderObject.subCompanyId = data[0].subCompanyId;
                cb(null, phoneBookingHeaderObject);


            });
        } else {
            cb("Authorization Required", null);
        }
    };

    Companies.remoteMethod('getPhoneBookingHeader', {
        returns: { arg: 'phoneBookingHeader', type: 'object' },
        http: { path: '/getPhoneBookingHeader', verb: 'get' }
    });

    // list Booking for admin and company
    //check account type before return data; if admin, return all; if company; only return the company's data
    Companies.listBookings = function(cb) {

        var currentUser = loopback.getCurrentContext().active.currentUser;
        var originalCompanyId = loopback.getCurrentContext().active.originalCompanyId;

        if (currentUser && currentUser.userType.indexOf("RediMed") >= 0) {
            //check if the user is admin  ; if yes, return all bookings
            app.models.BookingCandidatesV.find({ limit: 4000, order: 'creationDate DESC' }, function(r, r2) {
                cb(null, r2);
            });
        } else if (currentUser && currentUser.userType.indexOf("Company") >= 0) {
            app.models.AccountCompanies.find({ where: { accountId: currentUser.id, isenable: 1 } }, function(err, data) {
                console.log("app.models.AccountCompanies = ", err, data);
                var companyIDs = [];
                companyIDs.push(originalCompanyId);
                data.forEach((company) => {
                    companyIDs.push(company.companyId);
                });
                app.models.BookingCandidatesV.find({ where: { companyId: { inq: companyIDs } }, limit: 1000, order: 'creationDate DESC' }, function(err, data3) {
                    //console.log(data3[0]);
                    cb(null, data3);
                });
            });
        } else {
            cb(null, "Authorization Required");
        }
    };

    Companies.remoteMethod('listBookings', {
        returns: { arg: 'bookings', type: 'array' },
        http: { path: '/listBookings', verb: 'get' }
    });

    // list telehealthBookings Booking for admin and company
    //check account type before return data; if admin, return all; if company; only return the company's data
    Companies.listTelehealthBookings = function(cb) {

        var currentUser = loopback.getCurrentContext().active.currentUser;
        if (currentUser && currentUser.userType.indexOf("RediMed") >= 0) {
            //check if the user is admin  ; if yes, return all bookings
            app.models.TelehealthBookings.find({ limit: 4000, order: 'creationDate DESC' }, function(r, r2) {
                cb(null, r2);
            });
        } else if (currentUser && currentUser.userType.indexOf("Company") >= 0) {
            app.models.TelehealthBookings.find({ where: { companyId: currentUser.companyId }, limit: 500, order: 'creationDate DESC' }, function(r, r2) {
                cb(null, r2);
            });
        } else {
            cb(null, "Authorization Required");
        }
    };

    Companies.remoteMethod('listTelehealthBookings', {
        returns: { arg: 'bookings', type: 'array' },
        http: { path: '/listTelehealthBookings', verb: 'get' }
    });

    Companies.countBookings = function(cb) {

        var currentUser = loopback.getCurrentContext().active.currentUser;
        if (currentUser && currentUser.userType.indexOf("RediMed") >= 0) {
            //check if the user is admin  ; if yes, return all bookings
            app.models.BookingCandidatesV.count(function(r, r2) {
                //console.log(r,r2);
                cb(null, r2);
            });
        } else if (currentUser && currentUser.userType.indexOf("Company") >= 0) {
            app.models.BookingCandidatesV.count({ companyId: currentUser.companyId }, function(r, r2) {
                //console.log(r,r2);
                cb(null, r2);
            });
        } else {
            cb(null, "Authorization Required");
        }
    };

    Companies.remoteMethod('countBookings', {
        returns: { arg: 'count', type: 'array' },
        http: { path: '/countBookings', verb: 'get' }
    });

    // list Assessment Headers
    Companies.listUser = function(cb) {

        var comId = loopback.getCurrentContext().active.companyId;
        if (comId) {
            app.models.Accounts.find({ "where": { "companyId": comId } }, function(r, r2) {
                //console.log("comId=",comId,"Users",r);
                cb(null, r2);
            });
        } else {
            cb(null, "Authorization Required");
        }

        //.Assessments({id:packageId},cb);  , "scope": {"include": ["students"]}
    };

    Companies.remoteMethod('listUser', {
        returns: { arg: 'users', type: 'array' },
        http: { path: '/list-user', verb: 'get' }
    });
    ///Get all site to make a booking
    Companies.getSites = function(cb) {
        var currentUser = loopback.getCurrentContext().active.currentUser;
        if (currentUser) {
            Companies.app.models.Redimedsites.find({ where: { ispreempbk: 1 }, include: { relation: 'States', scope: { include: 'SubStates' } } }, function(err, data) {
                cb(err, data);
            });
        } else {
            cb("Authorization Required", null);
        }
    };

    Companies.remoteMethod('getSites', {
        returns: { arg: 'sites', type: 'array' },
        http: { path: '/getSites', verb: 'get' }
    });


    ///Get calendar to make a booking
    Companies.getCalendars = function(args, cb) {

        /*
        period = 60 mins
        B1: convert [] => (Date -> Doctor -> slots) (A)
        B2: convert (A) => (Date -> Doctor -> slotSegments : [segment:{slots:[slot1,slot2]}]) (B)
        B3: convert (B) => (Date -> Doctor -> slotSegments : [segment:{firstSlot,lastSlot}]) (C)
        B4: convert (C) and remove not enough time => arrays
        B5: return to clients

        07:45 - first of segment 1
        08:00
        08:15 - last  of segment 1
        08:30 - no use
        08:45 - no use
        09:00 - first  of segment 4
        09:15 - no use
        09:30 - first  of segment 2
        09:45
        10:00
        10:15
        10:30
        10:45
        11:00
        11:15
        11:30
        11:45 - last of segment 2

        13:00 - firt of segment 3
        13:15
        13:30
        13:45
        14:00
        14:15
        14:30
        14:45
        15:00
        15:15
        15:45
        16:00 - last of segment 3

        => firstAvailable = 07:45
            => followingSlots = time - 07:45 < 60mins
        => lastAvailable = 16:00
            => followingSlots = 16:00 - time < 60mins
        */
        var siteID = args.id,
            fromDate = args.from,
            toDate = args.to;
        var maxPeriod = args.maxPeriod * (1000 * 60);
        var currentUser = loopback.getCurrentContext().active.currentUser;
        var buildCals = new HashMap();
        var buildCal2s = new HashMap();
        var startTime = new Date();

        console.log("Companies.getCalendars = ", args);
        console.log("Companies.getCalendars startAt= ", startTime);

        if (currentUser) {

            var doctorFunc = function(cal, calDate) {
                //this func is used to build first and last slot of each doctor
                var doctor = calDate.doctors.get(cal.doctorId);
                if (doctor) {
                    //get min from time as the first slot for this doctor
                    if (doctor.firstAvailable.firstSlot.fromTime.getTime() > cal.fromTime.getTime()) {
                        doctor.firstAvailable.firstSlot = cal;
                    }
                    //get max from time as the last slot for this doctor
                    if (doctor.lastAvailable.lastSlot.fromTime.getTime() < cal.fromTime.getTime()) {
                        doctor.lastAvailable.lastSlot = cal;
                    }
                } else {
                    var doctorObject = {};
                    doctorObject.doctorId = cal.doctorId;
                    doctorObject.doctorName = cal.doctorName;
                    doctorObject.firstAvailable = { firstSlot: cal, followingSlots: [] };
                    doctorObject.lastAvailable = { lastSlot: cal, followingSlots: [] };
                    calDate.doctors.set(cal.doctorId, doctorObject);
                }
            };

            var buildDoctorFunc = function(cal, calDate) {
                //this func is used to build first and last slot of each doctor
                var doctor = calDate.doctors.get(cal.doctorId);
                if (doctor) {
                    doctor.slots.push(cal);
                } else {
                    var doctorObject = {
                      doctorId: cal.doctorId,
                      doctorName: cal.doctorName,
                      slots: [cal],
                      slotSegments: []
                    };
                    calDate.doctors.set(cal.doctorId, doctorObject);
                }
            };

            Companies.app.models.Calendar2V.find({ where: {enable: "Y", siteId: siteID, fromTime: { between: [(new Date(fromDate)), (new Date(toDate))] } }, order: ['doctorId', 'fromTime'] }, function(err, data) {
                console.log("Companies.getCalendar: 1. query period = ", (new Date() - startTime) );
                var startTime2 = new Date();
                console.log(' ---->>>>>>>>>>>>>>>>>>>> Companies.app.models.Calendar2V.find =  ',err);
                if(err){
                    cb(err, null);
                }else{
                    //Step 1:  create a data structure like: Date -> Doctors -> slotSegments -> array slots from the query result

                    data.forEach((cal)=>{
                      //build Date
                      var calDate = buildCal2s.get(cal.calendarDate);
                      if (calDate) {
                          //build Doctor
                          buildDoctorFunc(cal, calDate);
                      } else {
                          buildCal2s.set(cal.calendarDate, { doctors: new HashMap() });
                          var calDate = buildCal2s.get(cal.calendarDate);
                          //build Doctor
                          buildDoctorFunc(cal, calDate);
                      }
                    });

                    //Step 2: build slotSegments for each doctor
                    buildCal2s.forEach((calDate, key) => {
                      calDate.doctors.forEach((doctor,key)=>{
                          doctor.slotSegments.push({slots:[]});
                          var slotSegment = doctor.slotSegments[doctor.slotSegments.length-1];
                          doctor.slots  = _.sortBy(doctor.slots, 'fromTimeInInt');
                          doctor.slots.forEach(slot=>{
                            //if slots = 0, means that it is empty, so just add slot into the array
                            if(slotSegment.slots.length == 0){
                              slotSegment.slots.push(slot);
                            }else{
                              //if slots is not empty, check if the toTime of last slot in the segment == fromTime or not, if the same, it is the same segment; if not, create new segment
                              var lastSlotInSegment = slotSegment.slots[slotSegment.slots.length-1];
                              if(lastSlotInSegment.toTime.getTime() == slot.fromTime.getTime()){
                                slotSegment.slots.push(slot);
                              }else{
                                //create a new segment
                                doctor.slotSegments.push({slots:[]});
                                slotSegment = doctor.slotSegments[doctor.slotSegments.length-1];
                                //slotSegment = {slots:[]};
                                slotSegment.slots.push(slot);
                              }
                            }
                          });
                      });
                    });
                    //Step 3: find firstSlot and lastSlot for each segment
                    buildCal2s.forEach((calDate, key) => {
                      calDate.doctors.forEach((doctor,key)=>{
                          doctor.slotSegments.forEach(segment=>{
                              //console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> segment = ',segment);
                              if(segment.slots.length > 1 ){
                                segment.lastSlot = {slot:segment.slots[segment.slots.length - 1],followingSlots:[]}
                              }
                              segment.slots.forEach((slot,index)=>{
                                if(index == 0){
                                    segment.firstSlot = {slot:segment.slots[0],followingSlots:[segment.slots[0]]}
                                }else {
                                    if(slot.fromTime.getTime() - segment.firstSlot.slot.fromTime.getTime() < maxPeriod){
                                      segment.firstSlot.followingSlots.push(slot);
                                    }
                                    if(segment.lastSlot.slot.fromTime.getTime() - slot.fromTime.getTime() < maxPeriod){
                                      segment.lastSlot.followingSlots.push(slot);
                                    }
                                }
                              })
                          });
                      });
                    });
                    //Step 4: remove all firstSlot and lastSlot that not enough period and re-order lastSlot
                    buildCal2s.forEach((calDate, key) => {
                      calDate.doctors.forEach((doctor,key)=>{
                          doctor.slotSegments.forEach(segment=>{
                              if(segment.firstSlot){
                                  //console.log(' ==================> segment = ',segment, 'segment.firstSlot.followingSlots.length = ',segment.firstSlot.followingSlots.length);
                                  var lastSlotInFollowingOfFirstSlot = segment.firstSlot.followingSlots[segment.firstSlot.followingSlots.length-1];
                                  if(lastSlotInFollowingOfFirstSlot && lastSlotInFollowingOfFirstSlot.toTime){
                                    if(lastSlotInFollowingOfFirstSlot.toTime.getTime() - segment.firstSlot.slot.fromTime.getTime() < maxPeriod){
                                        segment.firstSlot = null;
                                    }
                                  }else{
                                    segment.firstSlot = null;
                                  }
                              }
                              if(segment.lastSlot){
                                var lastSlotInFollowingOfLastlot = segment.lastSlot.followingSlots[segment.lastSlot.followingSlots.length-1];
                                segment.lastSlot.slot = segment.lastSlot.followingSlots[0];
                                //console.log(' ==================> segment = ',segment);
                                //console.log(' ==================> lastSlotInFollowingOfLastlot526 = ',lastSlotInFollowingOfLastlot);
                                if(lastSlotInFollowingOfLastlot && lastSlotInFollowingOfLastlot.toTime){
                                  if(lastSlotInFollowingOfLastlot.toTime.getTime() - segment.lastSlot.slot.fromTime.getTime() < maxPeriod){
                                      segment.lastSlot = null;
                                  }
                                }else{
                                  segment.lastSlot = null;
                                }
                              }
                          });
                      });
                    });
                    //debug:
                    // buildCal2s.forEach((calDate, key) => {
                    //   console.log(' ====> Date = ',key);
                    //   calDate.doctors.forEach((doctor,key)=>{
                    //       console.log(' ==================> doctor = ',doctor.Id,' - ',doctor.doctorName);
                    //       //console.log(' ==================> doctor.slots = ',doctor.slots);
                    //       doctor.slotSegments.forEach(segment=>{
                    //         console.log(' ----------------------------------------------------------------------------------------------------- ');
                    //         console.log(' ==================> doctor.segment = ',segment.firstSlot);
                    //         console.log(' ---------------------------------------------------------- ');
                    //         console.log(' ==================> doctor.segment = ',segment.lastSlot);
                    //       });
                    //   });
                    // });


                    //display results
                    // convert from hashmap to array to return to clients
                    var returnCals = [];
                    buildCal2s.forEach((calDate, key) => {
                        var date = { date: key,formatedDate: moment(key,'DD/MM/YYYY').format('YYYY-MM-DD'), doctors: [], slots: [] };
                        //console.log(' - calDate = ',key,' period = ',args.maxPeriod);
                        calDate.doctors.forEach((doctor, key) => {
                            //check whether the period is enough for max Period or not
                            doctor.slotSegments.forEach(segment=>{
                                if(segment.firstSlot){
                                    date.slots.push({
                                        calId: segment.firstSlot.slot.calId,
                                        calendarDate: segment.firstSlot.slot.calendarDate,
                                        calendarTime: segment.firstSlot.slot.calendarTime,
                                        doctorId: segment.firstSlot.slot.doctorId,
                                        doctorName: segment.firstSlot.slot.doctorName,
                                        fromTime: segment.firstSlot.slot.fromTime,
                                        toTime: segment.firstSlot.followingSlots[segment.firstSlot.followingSlots.length - 1].toTime,
                                        fromTimeInInt: segment.firstSlot.slot.fromTime.getTime(),
                                        siteId: segment.firstSlot.slot.siteId,
                                        followingSlots: segment.firstSlot.followingSlots
                                    });
                                }
                                if(segment.lastSlot){
                                    date.slots.push({
                                        calId: segment.lastSlot.slot.calId,
                                        calendarDate: segment.lastSlot.slot.calendarDate,
                                        calendarTime: segment.lastSlot.slot.calendarTime,
                                        doctorId: segment.lastSlot.slot.doctorId,
                                        doctorName: segment.lastSlot.slot.doctorName,
                                        fromTime: segment.lastSlot.slot.fromTime,
                                        toTime: segment.lastSlot.followingSlots[segment.lastSlot.followingSlots.length - 1].toTime,
                                        fromTimeInInt: segment.lastSlot.slot.fromTime.getTime(),
                                        siteId: segment.lastSlot.slot.siteId,
                                        followingSlots: segment.lastSlot.followingSlots
                                    });
                                }
                            });
                            date.doctors.push(doctor);
                        }, calDate.doctors);
                        date.slots = _.sortBy(date.slots, 'fromTimeInInt');
                        returnCals.push(date);
                    }, buildCals);

                    //console.log('returnCals = ',returnCals);
                    returnCals = _.sortBy(returnCals, 'formatedDate');
                    //remove all slots if they are in the holdings list
                    //will check in slots list and followingSlots list
                    Companies.app.models.CalendarHoldingDetails.find((err, holds) => {
                        console.log('holds = ', holds);
                        holds.forEach((hold) => {
                            returnCals.forEach((date, index) => {
                                date.slots.forEach((slot, index, object) => {
                                    if (slot.calId == hold.calId) {
                                        //console.log(' ==> remove the slot =  ', slot.calId, slot.calendarTime);
                                        object.splice(index, 1);
                                    } else {
                                        slot.followingSlots.forEach((fslot) => {
                                            if (fslot.calId == hold.calId) {
                                                //console.log(' ==> remove the slot =  ', slot.calId, slot.calendarTime);
                                                object.splice(index, 1);
                                            }
                                        });
                                    }
                                });
                            });
                        });

                        console.log("Companies.getCalendar: 2. build calendars period = ", (new Date() - startTime2) );
                        console.log("Companies.getCalendar: 3. total period = ", (new Date() - startTime) );
                        cb(err, returnCals);
                    });
                }

            });
        } else {
            cb("Authorization Required", null);
        }
    };



    Companies.remoteMethod('getCalendars', {
        accepts: [
            { arg: 'args', type: 'object', http: { source: 'body' } }
        ],
        returns: { arg: 'calendars', type: 'array' },
        http: { path: '/getCalendars', verb: 'post' }
    });

    Companies.synSites = function(cb) {
        var currentUser = loopback.getCurrentContext().active.currentUser;
        if (currentUser) {
            Companies.app.models.SynToEMR.synSites(cb);
        } else {
            cb("Authorization Required", null);
        }
    };

    Companies.remoteMethod('synSites', {
        returns: { arg: 'synSites', type: 'array' },
        http: { path: '/synSites', verb: 'get' }
    });

    Companies.synCalendars = function(cb) {
        var currentUser = loopback.getCurrentContext().active.currentUser;
        if (currentUser) {
            Companies.app.models.SynToEMR.synCalendars(cb);
        } else {
            cb("Authorization Required", null);
        }
    };

    Companies.remoteMethod('synCalendars', {
        returns: { arg: 'synCalendars', type: 'array' },
        http: { path: '/synCalendars', verb: 'get' }
    });

    Companies.getPeriod = function(args, cb) {
        console.log('Companies.getPeriod args = ', args);
        var currentUser = loopback.getCurrentContext().active.currentUser;
        if (currentUser) {
            var ds = Companies.dataSource;
            var sql = "select max(period) as period from packages_assessments pa, assessments a where pa.ass_id = a.id and pack_id =?";
            console.log('will run sql = ', sql);
            ds.connector.query(sql, [args.packId], function(err, period) {
                console.log('get period for packId = ', err, period);
                if (err) console.error(err);
                //cb(err, products);
                cb(err, period[0].period);
            });
        } else {
            cb("Authorization Required", null);
        }
    };

    Companies.remoteMethod('getPeriod', {
        accepts: [
            { arg: 'args', type: 'object', http: { source: 'body' } }
        ],
        returns: { arg: 'period', type: 'number' },
        http: { path: '/getPeriod', verb: 'post' }
    });

    ///Get all site to make a booking
    Companies.getStatus = function(cb) {
        var currentUser = loopback.getCurrentContext().active.currentUser;
        if (currentUser) {
            Companies.app.models.SysBookingStatus.find(function(err, data) {
                cb(err, data);
            });
        } else {
            cb("Authorization Required", null);
        }
    };

    Companies.remoteMethod('getStatus', {
        returns: { arg: 'status', type: 'array' },
        http: { path: '/getStatus', verb: 'get' }
    });

    Companies.getRosters = function(args, cb) {
        console.log("Companies.getCalendars = ", args);

        var siteID = args.id,
            fromDate = args.from,
            toDate = args.to;
        var currentUser = loopback.getCurrentContext().active.currentUser;
        var buildCals = new HashMap();
        console.log(currentUser);
        if (currentUser && currentUser.userType == 'RediMed') {

            Companies.app.models.Calendar2ResourcesV.find({ where: { calendarDate: { between: [(new Date(fromDate)), (new Date(toDate))] } }, order: ['id'] }, function(err, resources) {
                //console.log(err,data);
                //find firstSlot and lastSlot
                console.log('Calendar2ResourcesV.data = ', resources);

                Companies.app.models.Calendar2EventsV.find({ where: { calendarDate: { between: [(new Date(fromDate)), (new Date(toDate))] } }, order: ['id'] }, function(err, events) {
                    //console.log(err,data);
                    //find firstSlot and lastSlot
                    //console.log('Calendar2ResourcesV.data = ',events);
                    cb(null, { resources, events })
                });

            });
        } else {
            cb("Authorization Required", null);
        }
    };

    Companies.remoteMethod('getRosters', {
        accepts: [
            { arg: 'args', type: 'object', http: { source: 'body' } }
        ],
        returns: { arg: 'rosters', type: 'object' },
        http: { path: '/getRosters', verb: 'post' }
    });

    Companies.getResources = function(args, cb) {
        console.log("Companies.getResources = ", args);

        var siteID = args.id,
            fromDate = args.from,
            toDate = args.to;
        var currentUser = loopback.getCurrentContext().active.currentUser;

        if (currentUser && currentUser.userType == 'RediMed') {

            Companies.app.models.Calendar2ResourcesV.find(function(err, resources) {
                //console.log(err,data);
                //find firstSlot and lastSlot
                cb(null, resources)
            });
        } else {
            cb("Authorization Required", null);
        }
    };

    Companies.remoteMethod('getResources', {
        accepts: [
            { arg: 'args', type: 'object', http: { source: 'body' } }
        ],
        returns: { arg: 'resources', type: 'array' },
        http: { path: '/getResources', verb: 'post' }
    });

    Companies.getEvents = function(args, cb) {
        console.log("Companies.getEvents = ", args);

        var siteID = args.id,
            fromDate = args.from,
            toDate = args.to;
        var currentUser = loopback.getCurrentContext().active.currentUser;

        if (currentUser && currentUser.userType == 'RediMed') {

            Companies.app.models.Calendar2EventsV.find({ where: { calendarDate: { between: [(new Date(fromDate)), (new Date(toDate))] } }, order: ['id'], include: ['Candidate'] }, function(err, events) {
                //console.log(err,data);
                //find firstSlot and lastSlot
                //console.log('Calendar2ResourcesV.data = ',events);
                cb(null, events)
            });
        } else {
            cb("Authorization Required", null);
        }
    };

    Companies.remoteMethod('getEvents', {
        accepts: [
            { arg: 'args', type: 'object', http: { source: 'body' } }
        ],
        returns: { arg: 'events', type: 'array' },
        http: { path: '/getEvents', verb: 'post' }
    });

    // Companies.removeSlots = function(args, cb) {
    //     console.log("Companies.removeSlots = ", args);
    //
    //     var resourceId = args.resourceId,
    //         fromDate = args.fromTime,
    //         toDate = args.toTime;
    //     var currentUser = loopback.getCurrentContext().active.currentUser;
    //
    //     if (currentUser && currentUser.userType == 'RediMed') {
    //
    //         Companies.app.models.Calendar2.find({ where: { doctorId: resourceId, fromTime: { gte: fromDate }, toTime: { lte: toDate } } }, function(err, slots) {
    //             if (slots.length > 0) {
    //                 var candidateObjects = {
    //                     bookingId: 0,
    //                     candidateId: 0,
    //                     candidatesName: 'NoUse'
    //                 };
    //
    //                 Companies.app.models.BookingCandidates.create(candidateObjects, function(err, newCandidate) {
    //                     if (err) {
    //                         console.log("err create candidate = ", err);
    //                     } else {
    //                         console.log(newCandidate);
    //                         var candidateSlotObjects = [];
    //
    //                         slots.forEach(slot => {
    //                             candidateSlotObjects.push({
    //                                 id: 0,
    //                                 candidateId: newCandidate.candidateId,
    //                                 calId: slot.calId
    //                             });
    //                         });
    //
    //                         Companies.app.models.BookingCandidateSlots.create(candidateSlotObjects, function(err, newcandidateSlots) {
    //                             if (err) {
    //                                 console.log("err create candidateSlots = ", err);
    //                             } else {
    //                                 console.log('newcandidateSlots = ', newcandidateSlots);
    //                                 cb(null, newcandidateSlots);
    //                             }
    //                         });
    //                     }
    //                 });
    //             }
    //         });
    //     } else {
    //         cb("Authorization Required", null);
    //     }
    // };

    Companies.removeSlots = function(args, cb) {
        console.log("Companies.removeSlots = ", args);

        var resourceId = args.resourceId,
            fromDate = args.fromTime,
            toDate = args.toTime;
        var currentUser = loopback.getCurrentContext().active.currentUser;

        if (currentUser && currentUser.userType == 'RediMed') {
            Companies.app.models.Calendar2EventsV.find({ where: { resourceId: resourceId, start: { gte: fromDate }, end: { lte: toDate } } }, function(err, slots) {
                var candidateObjects = [];
                if (slots && slots.length > 0) {
                    slots.forEach((slot, index) => {
                        if (!slot.title) {
                            candidateObjects.push({
                                bookingId: 0,
                                candidateId: 0,
                                candidatesName: 'NoUse',
                                id: 0,
                                calendarId: slot.id ,
                                calId: slot.id
                            });
                        }
                    });
                }
                if (candidateObjects.length > 0) {
                    Companies.app.models.BookingCandidates.create(candidateObjects, function(err, newCandidate) {
                        if (err) {
                            console.log("err create candidate = ", err);
                            cb(err, null);
                        } else {
                            console.log(newCandidate);
                            cb(null, newCandidate);
                            /*
                            var candidateSlotObjects = [];
                            Companies.app.models.BookingCandidateSlots.create(newCandidate, function(err, newcandidateSlots) {
                                if (err) {
                                    console.log("err create candidateSlots = ", err);
                                    cb(err, null);
                                } else {
                                    cb(null, newcandidateSlots);
                                }
                            });
                            */
                        }
                    });
                }
            });
        } else {
            cb("Authorization Required", null);
        }
    };

    Companies.remoteMethod('removeSlots', {
        accepts: [
            { arg: 'args', type: 'object', http: { source: 'body' } }
        ],
        returns: { arg: 'slots', type: 'array' },
        http: { path: '/removeSlots', verb: 'post' }
    });

    Companies.unRemoveSlots = function(args, cb) {
        console.log("Companies.unRemoveSlots = ", args);

        var resourceId = args.resourceId,
            fromDate = args.fromTime,
            toDate = args.toTime;
        var currentUser = loopback.getCurrentContext().active.currentUser;

        if (currentUser && currentUser.userType == 'RediMed') {

            Companies.app.models.Calendar2EventsV.find({ where: { resourceId: resourceId, start: { gte: fromDate }, end: { lte: toDate } } }, function(err, slots) {
                if (slots.length > 0) {
                    var calIds = [];
                    var candidateIds = [];
                    slots.forEach(slot => {
                        if (slot.title == 'NoUse') {
                            calIds.push(slot.id);
                            candidateIds.push(slot.candidateId);
                        }
                    });
                }
                Companies.app.models.BookingCandidateSlots.destroyAll({ calId: { inq: calIds } }, function(err, destroyBookingCandidateSlots) {
                    console.log(">>>>>>>>>>>>>>>>>>>>>> destroyBookingCandidateSlots = ", destroyBookingCandidateSlots);
                    console.log(">>>>>>>>>>>>>>>>>>>>>> unRemoveSlots, calIds = ", calIds);
                    Companies.app.models.BookingCandidates.destroyAll({ candidateId: { inq: candidateIds } }, function(err, destroyBookingCandidates) {
                        console.log(">>>>>>>>>>>>>>>>>>>>>> unRemoveSlots, candidateIds = ", candidateIds);
                        cb(null, destroyBookingCandidates);
                    });
                });
            });
        } else {
            cb("Authorization Required", null);
        }
    };

    Companies.remoteMethod('unRemoveSlots', {
        accepts: [
            { arg: 'args', type: 'object', http: { source: 'body' } }
        ],
        returns: { arg: 'slots', type: 'array' },
        http: { path: '/unRemoveSlots', verb: 'post' }
    });

    Companies.clearAllHoldingsWhenStartup = function() {
        Companies.app.models.CalendarHoldingDetails.destroyAll(function(err, data) {
            console.log('deleted CalendarHoldingDetails when startup server = ', err, data);
        });
    };

    Companies.clearHoldings = function(socketId, cb) {
        Companies.app.models.CalendarHoldingDetails.destroyAll({ socketId: socketId }, function(err, data) {
            console.log('deleted CalendarHoldingDetails due to disconnect = ', err, data);
            cb();
        });
    };

    Companies.setHoldings = function(socketId, newValue, oldValue, cb,candidateTempId) {
        console.log('---> Companies.setHoldings new appt = ', newValue, ' oldValue = ', oldValue);
        /*
        if(oldValue){
            //delete oldValue of holding
            Companies.app.models.CalendarHoldings.findOne({where:{calendarId:oldValue.calId}},function(err,data){
                console.log(' find holding to delete = ',err,data);
                if(data){
                    Companies.app.models.CalendarHoldings.destroyAll({holdingId:data.holdingId},function(err,data){
                        console.log('deleted CalendarHoldings = ',err,data);
                    });
                    Companies.app.models.CalendarHoldingDetails.destroyAll({holdingId:data.holdingId},function(err,data){
                        console.log('deleted CalendarHoldingDetails = ',err,data);
                    });
                }
            });

        }
        */
        Companies.app.models.CalendarHoldingDetails.destroyAll({ socketId: socketId, candidateTempId: candidateTempId }, function(err, data) {
            console.log('deleted CalendarHoldingDetails = ', err, data);
            if (!newValue) cb();
        });

        if (newValue) {
            Companies.app.models.CalendarHoldings.create({ holdingId: 0, calendarId: newValue.calId }, function(err, data) {
                console.log('after inserted CalendarHoldings = ', err, data);
                var holdingDetails = [];
                newValue.followingSlots.forEach((slot) => {
                    holdingDetails.push({ id: 0, holdingId: data.holdingId, calId: slot.calId, socketId: socketId, candidateTempId: candidateTempId });
                });
                Companies.app.models.CalendarHoldingDetails.create(holdingDetails, function(err, data) {
                    console.log(' after inserted holding details = ', err, data);
                    cb();
                });
            });
        }
    };
};
