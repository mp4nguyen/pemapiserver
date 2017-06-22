var request = require('request');
var loopback = require('loopback');
var _ = require('underscore');
var moment = require('moment');
var Q = require("q");
var DEFAULT_PHONE_BOOKING_TTL = 60 * 60; // 15 mins in seconds
var baseUrl = 'https://testapp.redimed.com.au:3005';
var logger = require("../../server/logger");
//var baseUrl = 'https://testapp.redimed.com.au:3005';


module.exports = function(BookingHeaders) {
    // Update user
    BookingHeaders.emailBookingForm = function(bookingInfo, cb) {
        console.log('emailBookingForm = ', bookingInfo);

        BookingHeaders.app.models.Accounts.findOne({ where: { username: 'meditekadmin' } }, function(err, user) {
            if (err) {
                return cb(err);
            }
            if (!user) {
                err = new Error('Email and Username not found');
                err.statusCode = 404;
                err.code = 'EMAIL_NOT_FOUND';
                return cb(err);
            }
            // create a short lived access token for temp login to change password
            // TODO(ritch) - eventually this should only allow password change
            user.accessTokens.create({ ttl: DEFAULT_PHONE_BOOKING_TTL }, function(err, accessToken) {
                if (err) {
                    return cb(err);
                }
                console.log('accessToken was created = ', accessToken);
                ///Create booking header for this token
                var companyId, subCompanyId, companyName;
                if (bookingInfo.subsidiary.fatherId) {
                    companyId = bookingInfo.subsidiary.fatherId;
                    subCompanyId = bookingInfo.subsidiary.id;
                    companyName = bookingInfo.subsidiary.companyName;
                } else {
                    companyId = bookingInfo.subsidiary.id;
                    companyName = bookingInfo.subsidiary.companyName;
                }

                if (bookingInfo.subsidiary2) {
                    subCompanyId = bookingInfo.subsidiary2.id;
                    companyName = bookingInfo.subsidiary.companyName + ' - ' + bookingInfo.subsidiary2.companyName;
                }

                var bookingHeader = {
                    bookingId: 0,
                    bookingPerson: bookingInfo.bookingPerson,
                    contactNumber: bookingInfo.contactNumber,
                    contactEmail: bookingInfo.email,
                    invoiceEmail: bookingInfo.email,
                    companyId: companyId,
                    companyName: companyName,
                    subCompanyId: subCompanyId,
                    accesstokenForPhoneBooking: accessToken.id
                };
                BookingHeaders.create(bookingHeader, (err, bookingHeaderReturn) => {
                    console.log('created the booking header for phone booking', bookingHeaderReturn);
                });
                ////send email////

                var url = 'https://medicalbookings.redimed.com.au:8181/#/bookingForm/' + accessToken.id; //' + config.host + ':' + config.port + '


                var fs = require('fs'),
                    filename = __dirname + "/an_email_for_phone_booking.html";

                fs.readFile(filename, 'utf8', function(err, data) {
                    if (err) throw err;

                    var html = data;
                    html = html.replace(new RegExp("{{action_url}}", 'g'), url);
                    html = html.replace("{{name}}", bookingInfo.bookingPerson);

                    BookingHeaders.app.models.Email.send({
                        to: bookingInfo.email,
                        from: "healthscreenings@redimed.com.au",
                        subject: 'Redimed Pre-employment Booking Form',
                        html: html
                    }, function(err) {
                        if (err) return console.log('> error sending password reset email to ', err);
                        console.log('> sending password reset email to:');
                    });
                });

                //////////////////
            });
        });
        cb(null, { data: 'return data' });

    };

    BookingHeaders.remoteMethod('emailBookingForm', {
        accepts: [
            { arg: 'data', type: 'object', http: { source: 'body' } }
        ],
        returns: { arg: 'emailBookingForm', type: 'array' },
        http: { path: '/emailBookingForm', verb: 'post' }
    });


    var insertBooking = function(data, tx, cb) {
        logger.log('makeBooking',"BookingHeaders.insertBooking >> id =  " + process.pid + ' ,will make a new booking with data = ' + JSON.stringify(data) );
        getPackageDetail(data.packageId).then((package)=>{
            console.log("packageDetail = ",package.packageDetail," apptAssessments = ",package.apptAssessments);
            data.packageDetail = package.packageDetail;
            BookingHeaders.create(data, { transaction: tx }, function(err, bookingHeader) {
                logger.log('makeBooking',"BookingHeaders.insertBooking >> id =  " + process.pid + ' ,inserted bookingHeader err = ' + JSON.stringify(err));
                logger.log('makeBooking',"BookingHeaders.insertBooking >> id =  " + process.pid + ' ,inserted bookingHeader bookingHeader = ' + JSON.stringify(bookingHeader));

                if (err) {
                    console.log("Packages.beginTransaction ", err);
                    tx.rollback(function(tranErr) {
                        console.log("Error to rollback the transaction", tranErr);
                        var returnObj = {};
                        returnObj.err = "'" + err + "'";
                        returnObj.tranErr = tranErr;
                        cb(returnObj, null);
                    });
                } else {
                    //console.log(' Added =', err,bookingHeader);
                    for (var i in data.candidates) {
                        data.candidates[i].bookingId = bookingHeader.bookingId;
                    }
                    BookingHeaders.app.models.BookingCandidates.create(data.candidates, { transaction: tx }, function(err, bookingCandidates) {
                        logger.log('makeBooking',"BookingHeaders.insertBooking >> id =  " + process.pid + ' ,inserted BookingCandidates err = ' + JSON.stringify(err) );
                        logger.log('makeBooking',"BookingHeaders.insertBooking >> id =  " + process.pid + ' ,inserted BookingCandidates bookingCandidates = ' + JSON.stringify(bookingCandidates));

                        if (err) {
                            console.log(">>>Packages.beginTransaction ", err);
                            tx.rollback(function(tranErr) {
                                var returnObj = {};
                                returnObj.err = "'" + err + "'";
                                returnObj.tranErr = tranErr;
                                console.log(">>>>Error to rollback the transaction", returnObj);
                                cb(returnObj, null);
                            });
                        } else {
                            //console.log("candidate added",err,bookingCandidates);
                            //console.log(' will insert slots for candidate ',insertSlots);
                            if (err) {
                                    console.log(">>>Packages.beginTransaction ", err);
                                    tx.rollback(function(tranErr) {
                                        var returnObj = {};
                                        returnObj.err = "'" + err + "'";
                                        returnObj.tranErr = tranErr;
                                        console.log(">>>>Error to rollback the transaction", returnObj);
                                        cb(returnObj, null);
                                    });
                            } else {
                                tx.commit(function(tranErr) {
                                    console.log("Commited the transaction", tranErr);
                                    bookingHeader.bookingCandidates = bookingCandidates;
                                    transferToEforms(BookingHeaders, bookingHeader, bookingCandidates,package.packageDetail,package.apptAssessments);
                                    cb(null, bookingHeader);
                                });
                            }

                        }
                    });
                }
            });


        });
      }; //end var insertBooking

    var updateBookingCandiate = function(data, tx, cb) {
        BookingHeaders.app.models.BookingCandidates.update({ candidateId: data.candidateId }, data, { transaction: tx }, function(err, bookingCandidates) {
            //console.log(' after insert booking candidates = ',err,bookingCandidates);
            if (err) {
                console.log(">>>Packages.beginTransaction ", err);
                tx.rollback(function(tranErr) {
                    var returnObj = {};
                    returnObj.err = "'" + err + "'";
                    returnObj.tranErr = tranErr;
                    console.log(">>>>Error to rollback the transaction", returnObj);
                    cb(returnObj, null);
                });
            } else {
                tx.commit(function(tranErr) {
                    console.log("Commited the transaction", tranErr);
                    updateToEforms(BookingHeaders, data);
                    cb(null, "Update successfully");
                });
                /*
                //console.log("candidate added",err,bookingCandidates);
                BookingHeaders.app.models.BookingCandidateSlots.destroyAll({ candidateId: data.candidateId }, function(err, deleteAllSlots) {
                    console.log('deleted old BookingCandidateSlots = ', err, deleteAllSlots);
                    //console.log(' will insert slots for candidate ',insertSlots);
                    var insertSlots = [];
                    console.log(' >>>>>>>>>>>>>> data.slots= ',data);
                    if (data.slots){
                      data.slots.forEach((slot) => {
                          insertSlots.push({ id: 0, candidateId: data.candidateId, calId: slot });
                      });
                    }
                    BookingHeaders.app.models.BookingCandidateSlots.create(insertSlots, { transaction: tx }, function(err, candidateSlots) {
                        console.log('insert booking slots for candidate = ', err, candidateSlots);
                        if (err) {
                            console.log(">>>Packages.beginTransaction ", err);
                            tx.rollback(function(tranErr) {
                                var returnObj = {};
                                returnObj.err = "'" + err + "'";
                                returnObj.tranErr = tranErr;
                                console.log(">>>>Error to rollback the transaction", returnObj);
                                cb(returnObj, null);
                            });
                        } else {
                            tx.commit(function(tranErr) {
                                console.log("Commited the transaction", tranErr);
                                updateToEforms(BookingHeaders, data);
                                cb(null, "Update successfully");
                            });
                        }
                    });
                });
                */
                if (data.calendarId) {
                    //delete holding
                    BookingHeaders.app.models.CalendarHoldings.findOne({ where: { calendarId: data.calendarId } }, function(err, data) {
                        //console.log(' find holding to delete after submit the booking = ',err,data);
                        if (data) {
                            BookingHeaders.app.models.CalendarHoldings.destroyAll({ holdingId: data.holdingId }, function(err, data) {
                                //console.log('deleted CalendarHoldings = ',err,data);
                            });
                            BookingHeaders.app.models.CalendarHoldingDetails.destroyAll({ holdingId: data.holdingId }, function(err, data) {
                                //console.log('deleted CalendarHoldingDetails = ',err,data);
                            });
                        }
                    });
                }
            }
        });


    }; //end var updateBooking

    var insertPhoneBooking = function(data, tx, cb) {
        var deferred = Q.defer();
        var phoneBookingHeader = {
            comments: data.comments,
            resultEmail: data.resultEmail,
            invoiceEmail: data.invoiceEmail,
            poNumber: data.poNumber,
            packageId: data.packageId,
            paperwork: data.paperwork
        };
        console.log('will update bookingHeader with data', phoneBookingHeader);
        BookingHeaders.update({ bookingId: data.bookingId }, phoneBookingHeader, { transaction: tx }, function(err, bookingHeader) {
            console.log('update booking header ', err, bookingHeader);
            if (err) {
                //console.log("Packages.beginTransaction ", err);
                tx.rollback(function(tranErr) {
                    //console.log("Error to rollback the transaction", tranErr);
                    var returnObj = {};
                    returnObj.err = "'" + err + "'";
                    returnObj.tranErr = tranErr;
                    deferred.reject(returnObj);
                    cb(returnObj, null);
                });
            } else {
                //console.log(' Added =', err,bookingHeader);
                BookingHeaders.app.models.BookingCandidates.create(data.candidates, { transaction: tx }, function(err, bookingCandidates) {
                    //console.log('create patient ',err,bookingCandidates);
                    if (err) {
                        //console.log(">>>Packages.beginTransaction ", err);
                        tx.rollback(function(tranErr) {
                            var returnObj = {};
                            returnObj.err = "'" + err + "'";
                            returnObj.tranErr = tranErr;
                            console.log(">>>>Error to rollback the transaction", returnObj);
                            deferred.reject(returnObj);
                            cb(returnObj, null);
                        });
                    } else {
                        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> candidate added", err, bookingCandidates);
                        tx.commit(function(tranErr) {
                            console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> Commited the transaction", tranErr);
                            bookingHeader.bookingCandidates = bookingCandidates;
                            transferToEforms(BookingHeaders, data, bookingCandidates); //dang lam
                            console.log(">>>>>> after transferToEforms");
                            deferred.resolve(bookingCandidates);
                            cb(null, bookingCandidates);
                        });
                    }
                });
            }
        });

        return deferred.promise;
    }; //end var insertBooking

    var customPackageFunc = function(data, tx, cb) {
        //console.log('data.customPackage = ',data.customPackage);
        var deferred = Q.defer();
        var packageObj = {};
        packageObj.id = 0;
        packageObj.packageName = "Custom";

        BookingHeaders.app.models.Packages.create(packageObj, { transaction: tx }, function(err, pack) {
            if (err) {
                //console.log("Packages.beginTransaction ", err);
                tx.rollback(function(tranErr) {
                    var returnObj = {};
                    returnObj.err = "'" + err + "'";
                    returnObj.tranErr = tranErr;
                    console.log("Error to rollback the transaction", tranErr);
                    deferred.reject('Error while inserted Packages');
                    cb(returnObj, null);
                });
            } else {

                data.packageId = pack.id;
                console.log("data = ", data);
                var packAssArray = [];
                for (var i in data.customPackage) {
                    var packAssObj = {};
                    packAssObj.packId = pack.id;
                    packAssObj.assId = data.customPackage[i];
                    packAssArray.push(packAssObj);
                }
                BookingHeaders.app.models.PackagesAssessments.create(packAssArray, { transaction: tx }, function(err, pack) {
                    if (err) {
                        //console.log("Packages.beginTransaction ", err);
                        tx.rollback(function(tranErr) {
                            console.log("Error to rollback the transaction", tranErr);
                            var returnObj = {};
                            returnObj.err = "'" + err + "'";
                            returnObj.tranErr = tranErr;
                            deferred.reject('Error while inserted assessments');
                            cb(returnObj, null);
                        });
                    } else {
                        //console.log("candidate added",err,bookingCandidates);
                        tx.commit(function(tranErr) {
                            console.log("created package assessments = ", err, pack);
                            deferred.resolve(data);
                        });
                    }
                });
            }
        });

        return deferred.promise;
    }

    var checkBookingSlot = function(data) {
        console.log(' ---> will check booking slots before create the new booking with data = ', data);
        var deferred = Q.defer();
        var results = [];
        var slots = [];
        var errorCandidates = [];
        data.candidates.forEach((candidate, index) => {
            if (candidate.slots){
              candidate.slots.forEach((slot) => {
                  slots.push(slot);
              });
            }
        });

        //console.log('  ---> will check all slots here = ', candidate.slots, slots, ' at index = ', index);
        logger.log('makeBooking',"BookingHeaders.checkBookingSlot >> id =  " + process.pid + ' ,will check the slots: data = ' + JSON.stringify(slots) );

        var whereClause = { where: { or: [{calendarId: { inq: slots }}, {calendarId3: { inq: slots }}, {calendarId4: { inq: slots }}, {calendarId5: { inq: slots }}]}};

        BookingHeaders.app.models.BookingCandidates.find(whereClause, (err, candidateResult) => {
          //console.log(' found booked slots in BookingCandidates = ', err, candidateResult);
              logger.log('makeBooking',"BookingHeaders.checkBookingSlot >> id =  " + process.pid + ' ,found booked slots in BookingCandidates  ' + JSON.stringify(err) + JSON.stringify(candidateResult) );

              if (candidateResult.length > 0) {
                    candidateResult.forEach(can=>{
                        console.log('will check the existing candiate = ',can);
                        data.candidates.forEach((candidate, index) => {
                            console.log(' new candiate = ',candidate);
                            if (candidate.slots){
                                for(var i=0;i<candidate.slots.length;i++){
                                    var pslot = candidate.slots[i];
                                    console.log(' check slot = ',pslot);
                                    if (pslot == can.calendarId || pslot == can.calendarId3 || pslot == can.calendarId4 || pslot == can.calendarId5)  {
                                        console.log('candidate name = ',candidate.candidatesName);
                                        errorCandidates.push(candidate.candidatesName);

                                        break;
                                    }
                                }
                            }
                        });
                    });

                    if(errorCandidates.length > 0){
                        deferred.reject(errorCandidates);
                    }
              }else{
                    deferred.resolve('Good');
              }
        });



        return deferred.promise;
    }

    BookingHeaders.submitBooking = function(data, cb) {
        checkBookingSlot(data).then((checkResult) => {
            console.log('check result = ',checkResult);
            console.log(' ---> Will create this booking = ', data);

            BookingHeaders.beginTransaction({ isolationLevel: BookingHeaders.Transaction.READ_COMMITTED }, function(errTran, tx) {
                if (errTran) {
                    console.log("Packages.beginTransaction ", errTran);
                    cb(errTran, null);
                } else {
                    console.log("submitBooking data= ", data);
                    //for custom package, then create the package before make the booking
                    if (data.customPackage) {
                        if (data.customPackage.length > 0) {
                            customPackageFunc(data, tx, cb).then(function(bookingData) {
                                insertBooking(bookingData, tx, cb);
                            });
                        }
                    } else {
                        insertBooking(data, tx, cb);
                    }
                }
            });
        }, (errors) => {
            var errorReturn = "Sorry !, the booking slots are not available  for patient : ";
            errors.forEach((err) => {
                errorReturn = errorReturn + ' ' + err + '; '
            });
            errorReturn = errorReturn + ' Please select other booking slots.'
            console.log('There is error = ', errorReturn);
            err = new Error(errorReturn);
            err.statusCode = 404;
            err.code = 'SLOT_NOT_AVAILABLE';
            cb(err, null)
        });

    };

    BookingHeaders.remoteMethod('submitBooking', {
        accepts: [
            { arg: 'data', type: 'object', http: { source: 'body' } }
        ],
        returns: { arg: 'booking', type: 'array' },
        http: { path: '/submitBooking', verb: 'post' }
    });

    BookingHeaders.updateBooking = function(data, cb) {
        console.log(' ---> Will update this booking = ', data);
        var checkSlotObject = { candidates: [data] };
        checkBookingSlot(checkSlotObject).then((resultOfCheckBooking) => {
            console.log(' resultOfCheckBooking = ', resultOfCheckBooking);
            BookingHeaders.beginTransaction({ isolationLevel: BookingHeaders.Transaction.READ_COMMITTED }, function(errTran, tx) {
                if (errTran) {
                    console.log("Packages.beginTransaction ", errTran);
                    cb(errTran, null);
                } else {
                    console.log("submitBooking data= ", data);
                    updateBookingCandiate(data, tx, cb);
                }
            });
        }, (errors) => {
            var errorReturn = "Sorry !, the booking slots are not available  for patient : ";
            errors.forEach((err) => {
                errorReturn = errorReturn + ' ' + err + '; '
            });
            errorReturn = errorReturn + ' Please select other booking slots.'
            console.log('There is error = ', errorReturn);
            err = new Error(errorReturn);
            err.statusCode = 404;
            err.code = 'SLOT_NOT_AVAILABLE';
            cb(err, null)
        });

    };

    BookingHeaders.remoteMethod('updateBooking', {
        accepts: [
            { arg: 'data', type: 'object', http: { source: 'body' } }
        ],
        returns: { arg: 'updateBooking', type: 'array' },
        http: { path: '/updateBooking', verb: 'post' }
    });

    BookingHeaders.cancelBooking = function(data, cb) {
        console.log(' ---> Will cancelBooking this booking = ', data);
        var updateValue = {};
        updateValue.appointmentNotes = data.appointmentNotes;
        updateValue.appointmentStatus = 'Cancel';
        updateValue.calendarId = -1;
        updateValue.calendarId2 = -1;
        updateValue.calendarId3 = -1;
        updateValue.calendarId4 = -1;
        updateValue.calendarId5 = -1;

        BookingHeaders.app.models.BookingCandidates.update({ candidateId: data.candidateId }, updateValue, function(err, count) {
            console.log(' Update candidate id = ', data.candidateId, ' count = ', count, ' err = ', err);
            if (err) {
                cb(err, null);
            } else {
                BookingHeaders.app.models.BookingCandidateSlots.destroyAll({ candidateId: data.candidateId }, (err, count) => {
                    console.log('delete all slots of this candidate count = ', count, ' err = ', err);
                    cb(null, 'Cancel Successfully');

                    var cancelOptions = {
                        method: 'get',
                        url: baseUrl + '/api/calendar/online-booking/update-status2/'+data.candidateId
                    };
                    console.log('will cancel Appointment & Calendar(s) with candidate = ',data.candidateId);
                    request(cancelOptions, function(err, res) {
                        if (err) {
                            console.log('Canceled.Error :', err)
                        }else{
                            console.log(' Canceled appointment & calendar(s); api = ', cancelOptions.url);
                        };
                    });

                });
            }
        });

    };

    BookingHeaders.remoteMethod('cancelBooking', {
        accepts: [
            { arg: 'data', type: 'object', http: { source: 'body' } }
        ],
        returns: { arg: 'cancelBooking', type: 'array' },
        http: { path: '/cancelBooking', verb: 'post' }
    });


    BookingHeaders.submitPhoneBooking = function(data, cb) {
        BookingHeaders.beginTransaction({ isolationLevel: BookingHeaders.Transaction.READ_COMMITTED }, function(errTran, tx) {
            if (errTran) {
                console.log("Packages.beginTransaction ", errTran);
                cb(errTran, null);
            } else {
                console.log("submitBooking data= ", data);
                //for custom package, then create the package before make the booking
                customPackageFunc(data, tx, cb).then(function(bookingData) {
                    console.log('update booking header and create candidate record...', bookingData);
                    insertPhoneBooking(bookingData, tx, cb).then((data) => {
                        BookingHeaders.app.models.BookingCandidates.sendConfirmationEmail({ id: data[0].candidateId, type: "new" }, function(rs) {

                        });
                        ///delete access token after update password, prevent update 2 times
                        var accessToken = loopback.getCurrentContext().active.accessToken;
                        var ACCESS_TOKEN = accessToken.id;
                        // remove just the token
                        var token = new BookingHeaders.app.models.AccessToken({ id: ACCESS_TOKEN });
                        token.destroy();
                    });
                });
            }
        });
    };

    BookingHeaders.remoteMethod('submitPhoneBooking', {
        accepts: [
            { arg: 'data', type: 'object', http: { source: 'body' } }
        ],
        returns: { arg: 'booking', type: 'object' },
        http: { path: '/submitPhoneBooking', verb: 'post' }
    });


    var findCompanyName = function(model, companyId) {
        console.log('Find the companyName for id = ', companyId);
        var deferred = Q.defer();
        model.app.models.CompaniesInternal.find({ where: { id: companyId } }, function(err, company) {
            console.log('find the company for transfer data to the eform', err, company);
            if (err) {
                deferred.reject(err);
            } else {
                if (company.length == 1) {
                    deferred.resolve(company[0]);
                } else {
                    deferred.reject("Cannot find the company or the companyId is not uquine !!!");
                }
            }
        });
        return deferred.promise;
    };


    BookingHeaders.transferEform = function(data, cb) {
      console.log("headerId = ",data);

      BookingHeaders.find({where:{bookingId:data.bookingId}}, function(err, bookingHeader) {
        console.log(err, bookingHeader);
        BookingHeaders.app.models.BookingCandidates.find({where:{bookingId:data.bookingId,headerCandidateId:null}}, function(err, bookingCandidates) {
            console.log(err, bookingCandidates);
            if(bookingCandidates.length>0){
                getPackageDetail(bookingHeader.packageId).then((package)=>{
                    transferToEforms(BookingHeaders, bookingHeader[0], bookingCandidates,package.packageDetail,package.apptAssessments);
                });
            }
        });
      });
    };

    BookingHeaders.remoteMethod('transferEform', {
        accepts: [
            { arg: 'data', type: 'object', http: { source: 'body' } }
        ],
        returns: { arg: 'transferEform', type: 'object' },
        http: { path: '/transferEform', verb: 'post' }
    });

    var getPackageDetail = function(packId){
        var defered  = Q.defer();

        BookingHeaders.app.models.Packages.find({ where: { id: packId }, include: {"relation": "AssessmentHeaders","scope": {"include": ["Assessments"]}} }, function(err, packData) {
            var packageView = "";
            var PatientAppointmentAssessment = [];
            var package = JSON.parse(JSON.stringify(packData[0]));

    //        console.log('package query  = ',package)

            for (var i in package.AssessmentHeaders) {
                var headerPack = package.AssessmentHeaders[i];
                packageView = packageView + "<b>" + headerPack.headerName + "</b><br>";
                for (var j in headerPack.Assessments) {
                    var ass = headerPack.Assessments[j];
                    packageView = packageView + " - " + ass.assName + "<br>";
                    PatientAppointmentAssessment.push({"AssessmentID":ass.id,"AssessmentName":ass.assName});
                }
            }
            var r = {packageDetail:packageView,apptAssessments:PatientAppointmentAssessment};
      //      console.log("+++++++++++++++++++will return object = ",r);
            defered.resolve(r);
        });

        return defered.promise;

    }

    var transferToEforms = function(model, header, candidates,packageDetail,apptAssessments) {

        var companyId;
      //  console.log(' --------------------> transfer row data header = ', header, 'candidates = ', candidates,' apptAssessments = ',apptAssessments);
        //console.log(' ->transferToEforms.company =',company);

        var isSiteCompany = false;
        if (header.subCompanyId) {
            companyId = header.subCompanyId;
            isSiteCompany = true;
        } else {
            companyId = header.companyId;
        }

        var packageView = packageDetail;

        var cans = { data: { Appointments: [] } };
        var PatientAppointmentAssessment = apptAssessments;

        for (var i in candidates) {
            //console.log(candidates[i]);

            var apptTime = null,
                preferredFromDate = null,
                preferredToDate = null,
                DOB = null;

            if (candidates[i].appointmentTime) {
                apptTime = moment(candidates[i].appointmentTime).format("YYYY-MM-DD HH:mm:ss") + ' +0800';
            }

            preferredFromDate = moment(candidates[i].fromDate).add(candidates[i].fromDate.getTimezoneOffset(), "m").format("YYYY-MM-DD") + ' +0800';
            preferredToDate = moment(candidates[i].toDate).format("YYYY-MM-DD") + ' +0800';
            if(candidates[i].dob){
              DOB = moment(candidates[i].dob).format("DD/MM/YYYY");
            }

            var fullName = candidates[i].candidatesName;
            var firstName, lastName;
            if (fullName.lastIndexOf(' ') > 0) {
                firstName = fullName.substring(0, fullName.lastIndexOf(' '));
                lastName = fullName.substring(fullName.lastIndexOf(' ') + 1);
            } else {
                firstName = fullName;
                lastName = fullName;
            }

            if (lastName == '') {
                lastName = fullName;
            }

            var slot = [];
            if (candidates[i].slots && candidates[i].slots.length > 0) {
                console.log(">>>>>>> Cadidate = ", candidates[i].slots);
                slot = candidates[i].slots
            }else{
              if(candidates[i].calendarId){
                slot.push(candidates[i].calendarId)
              }
              if(candidates[i].calendarId2){
                slot.push(candidates[i].calendarId2)
              }
              if(candidates[i].calendarId3){
                slot.push(candidates[i].calendarId3)
              }
              if(candidates[i].calendarId4){
                slot.push(candidates[i].calendarId4)
              }
              if(candidates[i].calendarId5){
                slot.push(candidates[i].calendarId5)
              }
            }


            var can = {
                "PatientAppointmentAssessment": PatientAppointmentAssessment,
                "Calendar": { "ID": { "$in": slot } },
                "Info": {
                    "PackageDescription": packageView,
                    "Paperwork": header.paperwork,
                    "Notes": header.comments,
                    "Position": candidates[i].position,
                    "CandidateID": candidates[i].candidateId,
                    "PONumber":header.poNumber,
                    "ProjectIdentification":header.projectIdentofication,
                    "BookingPerson": header.bookingPerson,
                    "BookingPersonContactNumber": header.contactNumber,
                    "ResultsTo": header.resultEmail,
                    "InvoicesTo": header.invoiceEmail,
                    "Status": candidates[i].appointmentStatus
                },
                "CompanySite": { "SiteIDRefer": companyId },
                "Patient": {
                    "Gender": candidates[i].gender,
                    "State": "WA",
                    "CountryID1": 14,
                    "Title": "Mr",
                    "FirstName": firstName,
                    "MiddleName": null,
                    "LastName": lastName,
                    "DOB": DOB,
                    "PhoneNumber": candidates[i].phone,
                    "Email1": candidates[i].email,
                    "Address1": null,
                    "Address2": null,
                    "HomePhoneNumber": null,
                    "WorkPhoneNumber": null,
                    "Suburb": null,
                    "Postcode": null,
                    "Email": candidates[i].email
                }
            };

            cans.data.Appointments.push(can);
        }

        //////////////////////////////

        var createCompany = function(cb) {
            findCompanyName(model, header.companyId, null).then(
                function(companyObject) {
                    var companyData = {
                        companyId: header.companyId,
                        CompanyName: companyObject.companyName
                    }

                    var companyOptions = {
                        method: 'post',
                        body: companyData, // Javascript object
                        json: true, // Use,If you are sending JSON data
                        url: baseUrl + '/api/onlinebooking/create-company'
                    };

                    console.log('will create the new company = ', companyData);
                    request(companyOptions, function(err, res, body) {
                        if (err) {
                            console.log('createCompany.Error :', err)
                        }

                        if (!body.ErrorsList) {
                            console.log(' createCompany.Body :', body);
                            //createAppointment();
                            cb();
                        } else {
                            console.log(' createCompany.Body :', body.ErrorsList);
                        };
                    });
                }
            );
        };

        var createCompanySite = function() {
            //console.log('-------------------------------------------------------------------->',companyId,'     =       ',subsidiaries,_.indexOf(subsidiaries,{id:companyId}));
            findCompanyName(model, header.subCompanyId, null).then(function(companyObject) {
                console.log(' => findCompanyName = ', companyObject);

                var companySiteData = {
                    companyId: header.subCompanyId,
                    CompanyName: companyObject.companyName,
                    FatherId: header.companyId
                }

                var companySiteOptions = {
                    method: 'post',
                    body: companySiteData, // Javascript object
                    json: true, // Use,If you are sending JSON data
                    url: baseUrl + '/api/onlinebooking/create-company'
                };

                console.log('will create the new site = ', companySiteData);

                request(companySiteOptions, function(err, res, body) {
                    if (err) {
                        console.log('createCompany.Error :', err)
                    }

                    if (!body.ErrorsList) {
                        console.log(' createCompany.Body :', body);
                        createAppointment2();
                    } else {
                        console.log(' create sub Company.Body err :', body.ErrorsList);
                        if (body.ErrorsList[0] == 'Company.notFound') {
                            //create father company
                            createCompany(createCompanySite);
                        }
                    };
                });
            });
        };

        var createAppointment2 = function() {
            console.log('======>>>>will transfer data to e-forms<<<<=======', cans);
            var bookingOptions = {
                method: 'post',
                body: cans, // Javascript object
                rejectUnauthorized: false,
                requestCert: true,
                agent: false,
                json: true, // Use,If you are sending JSON data
                url: baseUrl + '/api/online-booking/appointment/request/'
            };

            console.log('-> will call bookingOptions to testapp = ', cans);
            request(bookingOptions, function(err, res, body) {
                if (err) {
                    console.log('createAppointment.Error :', err)
                    console.log('createAppointment.Res :', res)
                    console.log('createAppointment.Body :', body)
                }
                console.log(' get eform from testapp = ', err, body);

                if (body) {
                    if (body.status == 'success') {
                        console.log(' createAppointment.Body :', body.data);
                        body.data.forEach((appt) => {
                            console.log(" -> data return : ", appt);
                            model.app.models.BookingCandidates.update({ candidateId: appt.RefID }, { headerCandidateId: appt.AppointmentID }, function(err, data) {
                                console.log('-> update back ID from eforms', err, data);
                            });
                        });
                    } else if (body.message == 'COMPANY SITE NOT EXIST') {
                        console.log(' createAppointment.Body :', body.message);
                        if (isSiteCompany) {
                            console.log("=>Sub Company not found; will create a new sub company !");
                            createCompanySite();
                        } else {
                            console.log("=>Company not found; will create a new company !");
                            createCompany(createAppointment2);
                        }
                    }
                }
            });


        };


        createAppointment2();


    };

    var updateToEforms = function(model, candidate) {
        console.log('======>>>>will update data to e-forms<<<<=======', candidate);
        if (candidate.slots){
        var updateData = {
            "data": {
                "Calendar": {
                    "ID": {
                        "$in": candidate.slots
                    }
                },
                "Appointment": {
                    "CandidateID": candidate.candidateId
                }
            }
        };
        var bookingOptions = {
            method: 'post',
            body: updateData, // Javascript object
            rejectUnauthorized: false,
            requestCert: true,
            agent: false,
            json: true, // Use,If you are sending JSON data
            url: baseUrl + '/api/online-booking/appointment/link-calendar-appointment'
        };
      }else{
            var updateData = {
                "data": {
                  "CandidateID": candidate.candidateId,
                  "apptFromTime": candidate.appointmentTime
                }
            };
            var bookingOptions = {
                method: 'post',
                body: updateData, // Javascript object
                rejectUnauthorized: false,
                requestCert: true,
                agent: false,
                json: true, // Use,If you are sending JSON data
                url: baseUrl + '/api/online-booking/appointment/update-appointment-onlinebooking'
            };
      }

        request(bookingOptions, function(err, res, body) {
            if (err) {
                console.log('createAppointment.Error :', err)
                console.log('createAppointment.Res :', res)
                console.log('createAppointment.Body :', body)
            }

            console.log(' updateToEforms get eform from testapp = ', err, body);
        });

    };
};
