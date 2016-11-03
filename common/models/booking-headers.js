var request = require('request');
var loopback = require('loopback');
var _ = require('underscore');
var moment = require('moment');
var Q = require("q");
var DEFAULT_PHONE_BOOKING_TTL = 60 * 60; // 15 mins in seconds

module.exports = function(BookingHeaders) {
    // Update user
    BookingHeaders.emailBookingForm = function(bookingInfo,cb) {
        console.log('emailBookingForm = ',bookingInfo);

        BookingHeaders.app.models.Accounts.findOne({ where: {username: 'meditekadmin'} }, function(err, user) {
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
            user.accessTokens.create({ttl: DEFAULT_PHONE_BOOKING_TTL}, function(err, accessToken) {
                if (err) {
                    return cb(err);
                }
                console.log('accessToken was created = ',accessToken);
                ///Create booking header for this token
                var companyId,subCompanyId,companyName;
                if(bookingInfo.subsidiary.fatherId){
                  companyId = bookingInfo.subsidiary.fatherId;
                  subCompanyId = bookingInfo.subsidiary.id;
                  companyName = bookingInfo.subsidiary.companyName;
                }else{
                  companyId = bookingInfo.subsidiary.id;
                  companyName = bookingInfo.subsidiary.companyName;
                }

                if(bookingInfo.subsidiary2){
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
                BookingHeaders.create(bookingHeader,(err,bookingHeaderReturn)=>{
                  console.log('created the booking header for phone booking',bookingHeaderReturn);
                });
                ////send email////

                var url = 'https://medicalbookings.redimed.com.au:2000/#/bookingForm/' + accessToken.id; //' + config.host + ':' + config.port + '


                var fs = require('fs')
                    , filename = __dirname+"/an_email_for_phone_booking.html";

                fs.readFile(filename, 'utf8', function(err, data) {
                    if (err) throw err;

                    var html = data;
                    html = html.replace(new RegExp("{{action_url}}", 'g'),url);
                    html = html.replace("{{name}}", bookingInfo.bookingPerson);

                    BookingHeaders.app.models.Email.send({
                        to: bookingInfo.email,
                        from: "healthscreenings@redimed.com.au",
                        subject: 'Redimed Pre-employment Booking Form',
                        html: html
                    }, function(err) {
                        if (err) return console.log('> error sending password reset email to ',err);
                        console.log('> sending password reset email to:');
                    });
                });

                //////////////////
            });
        });
        cb(null,{data:'return data'});

    };

    BookingHeaders.remoteMethod('emailBookingForm', {
        accepts: [
            { arg: 'data', type: 'object', http: { source: 'body' } }
        ],
        returns: {arg: 'emailBookingForm', type: 'array'},
        http: {path:'/emailBookingForm', verb: 'post'}
    });


    var insertBooking = function(data,tx,cb){
        BookingHeaders.create(data,{transaction: tx},function(err,bookingHeader){
            if(err){
                console.log("Packages.beginTransaction ", err);
                 tx.rollback(function(tranErr) {
                        console.log("Error to rollback the transaction", tranErr);
                        var returnObj = {};
                        returnObj.err = "'" + err + "'";
                        returnObj.tranErr = tranErr;
                        cb(returnObj,null);
                    });
            }else{
                //console.log(' Added =', err,bookingHeader);
                for(var i in data.candidates){
                    data.candidates[i].bookingId = bookingHeader.bookingId;
                }
                BookingHeaders.app.models.BookingCandidates.create(data.candidates,{transaction: tx},function(err,bookingCandidates){
                    //delete calendar holding after submit the booking
                    for(var j in data.candidates){
                        if(data.candidates[j].holdingId){
                            BookingHeaders.app.models.CalendarHoldings.destroyAll({"holdingId":data.candidates[j].holdingId},function(err,data){
                                console.log(' error = ',err,' data = ',data);
                            });

                        }
                    }

                    if(err){
                        console.log(">>>Packages.beginTransaction ", err);
                        tx.rollback(function(tranErr) {
                            var returnObj = {};
                            returnObj.err = "'" + err + "'";
                            returnObj.tranErr = tranErr;
                            console.log(">>>>Error to rollback the transaction", returnObj);
                            cb(returnObj,null);
                        });
                    }else{
                        //console.log("candidate added",err,bookingCandidates);
                        tx.commit(function(tranErr) {
                            console.log("Commited the transaction", tranErr);
                            bookingHeader.bookingCandidates = bookingCandidates;
                            transferToEforms(BookingHeaders,bookingHeader,bookingCandidates);
                            cb(null,bookingHeader);
                        });
                    }
                });
            }
        });
    };//end var insertBooking

    var insertPhoneBooking = function(data,tx,cb){
        var deferred = Q.defer();
        var phoneBookingHeader = {
            comments: data.comments,
            resultEmail: data.resultEmail,
            invoiceEmail: data.invoiceEmail,
            poNumber: data.poNumber,
            packageId: data.packageId,
            paperwork: data.paperwork
        };
        console.log('will update bookingHeader with data',phoneBookingHeader);
        BookingHeaders.update({bookingId:data.bookingId},phoneBookingHeader,{transaction: tx},function(err,bookingHeader){
            console.log('update booking header ',err,bookingHeader);
            if(err){
                console.log("Packages.beginTransaction ", err);
                 tx.rollback(function(tranErr) {
                        console.log("Error to rollback the transaction", tranErr);
                        var returnObj = {};
                        returnObj.err = "'" + err + "'";
                        returnObj.tranErr = tranErr;
                        deferred.reject(returnObj);
                        cb(returnObj,null);
                    });
            }else{
                //console.log(' Added =', err,bookingHeader);
                BookingHeaders.app.models.BookingCandidates.create(data.candidates,{transaction: tx},function(err,bookingCandidates){
                  console.log('create patient ',err,bookingCandidates);
                    if(err){
                        console.log(">>>Packages.beginTransaction ", err);
                        tx.rollback(function(tranErr) {
                            var returnObj = {};
                            returnObj.err = "'" + err + "'";
                            returnObj.tranErr = tranErr;
                            console.log(">>>>Error to rollback the transaction", returnObj);
                            deferred.reject(returnObj);
                            cb(returnObj,null);
                        });
                    }else{
                        //console.log("candidate added",err,bookingCandidates);
                        tx.commit(function(tranErr) {
                            console.log("Commited the transaction", tranErr);
                            bookingHeader.bookingCandidates = bookingCandidates;
                            transferToEforms(BookingHeaders,data,bookingCandidates);
                            deferred.resolve(bookingCandidates);
                            cb(null,bookingCandidates);
                        });
                    }
                });
            }
        });

        return deferred.promise;
    };//end var insertBooking

    var customPackageFunc = function(data,tx,cb){
        console.log('data.customPackage = ',data.customPackage);
        var deferred = Q.defer();
        var packageObj = {};
        packageObj.id = 0;
        packageObj.packageName = "Custom";

        BookingHeaders.app.models.Packages.create(packageObj,{transaction: tx},function(err,pack){
            if(err){
                console.log("Packages.beginTransaction ", err);
                 tx.rollback(function(tranErr) {
                        var returnObj = {};
                        returnObj.err = "'" + err + "'";
                        returnObj.tranErr = tranErr;
                        console.log("Error to rollback the transaction", tranErr);
                        deferred.reject('Error while inserted Packages');
                        cb(returnObj,null);
                });
            }else{

                data.packageId = pack.id;
                console.log("data = ",data);
                var packAssArray = [];
                for(var i in data.customPackage){
                    var packAssObj = {};
                    packAssObj.packId = pack.id;
                    packAssObj.assId = data.customPackage[i];
                    packAssArray.push(packAssObj);
                }
                BookingHeaders.app.models.PackagesAssessments.create(packAssArray,{transaction: tx},function(err,pack){
                    if(err){
                        console.log("Packages.beginTransaction ", err);
                        tx.rollback(function(tranErr) {
                            console.log("Error to rollback the transaction", tranErr);
                            var returnObj = {};
                            returnObj.err = "'" + err + "'";
                            returnObj.tranErr = tranErr;
                            deferred.reject('Error while inserted assessments');
                            cb(returnObj,null);
                        });
                    }else{
                        //console.log("candidate added",err,bookingCandidates);
                        tx.commit(function(tranErr) {
                            console.log("created package assessments = " ,err, pack);
                            deferred.resolve(data);
                        });
                    }
                });
            }
        });

        return deferred.promise;
    }

    BookingHeaders.submitBooking = function(data,cb) {
        BookingHeaders.beginTransaction({isolationLevel: BookingHeaders.Transaction.READ_COMMITTED}, function(errTran, tx) {
            if(errTran){
                console.log("Packages.beginTransaction ", errTran);
                cb(errTran,null);
            }else{
                console.log("submitBooking data= ",data);
                //for custom package, then create the package before make the booking
                if(data.customPackage){
                    if(data.customPackage.length > 0){
                        customPackageFunc(data,tx,cb).then(function(bookingData){
                            insertBooking(bookingData,tx,cb);
                        });
                    }
                }else{
                    insertBooking(data,tx,cb);
                }
            }
        });
    };

    BookingHeaders.remoteMethod('submitBooking', {
        accepts: [
            { arg: 'data', type: 'object', http: { source: 'body' } }
        ],
        returns: {arg: 'booking', type: 'array'},
        http: {path:'/submitBooking', verb: 'post'}
    });

    BookingHeaders.submitPhoneBooking = function(data,cb) {
        BookingHeaders.beginTransaction({isolationLevel: BookingHeaders.Transaction.READ_COMMITTED}, function(errTran, tx) {
            if(errTran){
                console.log("Packages.beginTransaction ", errTran);
                cb(errTran,null);
            }else{
                console.log("submitBooking data= ",data);
                //for custom package, then create the package before make the booking
                customPackageFunc(data,tx,cb).then(function(bookingData){
                    console.log('update booking header and create candidate record...',bookingData);
                    insertPhoneBooking(bookingData,tx,cb).then((data)=>{
                        BookingHeaders.app.models.BookingCandidates.sendConfirmationEmail({id:data[0].candidateId,type:"new"},function(rs){

                        });
                        ///delete access token after update password, prevent update 2 times
                        var accessToken = loopback.getCurrentContext().active.accessToken;
                        var ACCESS_TOKEN = accessToken.id;
                        // remove just the token
                        var token = new BookingHeaders.app.models.AccessToken({id: ACCESS_TOKEN});
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
        returns: {arg: 'booking', type: 'object'},
        http: {path:'/submitPhoneBooking', verb: 'post'}
    });

    var findCompanyName = function(model,companyId){
      console.log('Find the companyName for id = ',companyId);
      var deferred = Q.defer();
      model.app.models.CompaniesInternal.find({where:{id:companyId}},function(err,company){
        console.log('find the company for transfer data to the eform',err,company);
        if(err){
          deferred.reject(err);
        }else{
          if(company.length == 1){
            deferred.resolve(company[0]);
          }else{
            deferred.reject("Cannot find the company or the companyId is not uquine !!!");
          }
        }
      });
      return deferred.promise;
    };

    var transferToEforms = function(model,header,candidates){

        var companyId;
        //console.log(' -> transfer row data header = ',header,'candidates = ',candidates,'subsidiaries = ',subsidiaries,'company= ', company);
        //console.log(' ->transferToEforms.company =',company);

        var isSiteCompany = false;
        if(header.subCompanyId){
            companyId = header.subCompanyId;
            isSiteCompany = true;
        }else{
            companyId = header.companyId;
        }

        model.app.models.Packages.find({where:{id:header.packageId}},function(err,packData){
            var packageView = "";
            var candidateObjects = [];

            var package = JSON.parse(JSON.stringify(packData[0]));
            //console.log(" printBookingForm has package = ",package);

            for(var i in package.AssessmentHeaders){
                var headerPack = package.AssessmentHeaders[i];
                packageView = packageView + "<b>" + headerPack.headerName + "</b><br>";
                for(var j in headerPack.Assessments){
                    var ass = headerPack.Assessments[j];
                    packageView = packageView + " - " + ass.assName + "<br>";
                }
            }
            console.log(" ->  packageView = ",packageView);

            for(var i in candidates){
                console.log(candidates[i]);

                var apptTime = null,preferredFromDate = null,preferredToDate = null, DOB = null;

                if(candidates[i].appointmentTime){
                    apptTime = moment(candidates[i].appointmentTime).format("YYYY-MM-DD HH:mm:ss") + ' +0800';
                }

                preferredFromDate = moment(candidates[i].fromDate).add(candidates[i].fromDate.getTimezoneOffset(),"m").format("YYYY-MM-DD") + ' +0800';
                preferredToDate = moment(candidates[i].toDate).format("YYYY-MM-DD") + ' +0800';
                DOB = moment(candidates[i].dob).format("DD/MM/YYYY");
                var fullName = candidates[i].candidatesName;
                var firstName,lastName;
                if(fullName.lastIndexOf(' ') > 0){
                    firstName = fullName.substring(0,fullName.lastIndexOf(' '));
                    lastName = fullName.substring(fullName.lastIndexOf(' ') + 1);
                }else{
                    firstName = fullName;
                    lastName = fullName;
                }

                if(lastName == ''){
                    lastName = fullName;
                }

                candidateObjects.push({
                    "candidateId": candidates[i].candidateId,
                    "CandidateFirstName": firstName,
                    "CandidateLastName": lastName,
                    "Position":  candidates[i].position,
                    "DOB":  DOB,
                    "email2": candidates[i].email,
                    "mobile": null,
                    "homePhoneNumber": candidates[i].phone,
                    "workPhoneNumber": null,
                    "preferredFromDate": preferredFromDate,
                    "preferredToDate": preferredToDate,
                    "preferredSiteId": candidates[i].siteId,
                    "AppointmentTime": apptTime,
                    "Notes": candidates[i].appointmentNotes
                });
            }

            //////////////////////////////
            var bookingData = {
                    "AppointmentType": "PreEmployment",
                    "headerId": header.bookingId,
                    "companyId": companyId,
                    "packageDescription":packageView,
                    "Paperwork": header.paperwork,
                    "Notes": header.comments,
                    "BookingCandidates":candidateObjects
                };

            var bookingOptions = {
                method: 'post',
                body: bookingData, // Javascript object
                json: true, // Use,If you are sending JSON data
                url: 'https://testapp.redimed.com.au:3005/api/onlinebooking/appointment-request'
            };

            var createCompany = function(cb){
                findCompanyName(model,header.companyId,null).then(
                  function(companyObject){
                    var companyData = {
                        companyId : header.companyId,
                        CompanyName : companyObject.companyName
                    }

                    var companyOptions = {
                        method: 'post',
                        body: companyData, // Javascript object
                        json: true, // Use,If you are sending JSON data
                        url: 'https://testapp.redimed.com.au:3005/api/onlinebooking/create-company'
                    };

                    console.log('will create the new company = ',companyData);
                    request(companyOptions, function (err, res, body) {
                        if (err) {
                            console.log('createCompany.Error :' ,err)
                        }

                        if(!body.ErrorsList){
                            console.log(' createCompany.Body :',body);
                            //createAppointment();
                            cb();
                        }else{
                            console.log(' createCompany.Body :',body.ErrorsList);
                        };
                    });
                  }
                );
            };

            var createCompanySite = function(){
                //console.log('-------------------------------------------------------------------->',companyId,'     =       ',subsidiaries,_.indexOf(subsidiaries,{id:companyId}));
                findCompanyName(model,header.subCompanyId,null).then(function(companyObject){
                    console.log(' => findCompanyName = ',companyObject);

                    var companySiteData = {
                        companyId : header.subCompanyId,
                        CompanyName : companyObject.companyName,
                        FatherId: header.companyId
                    }

                    var companySiteOptions = {
                        method: 'post',
                        body: companySiteData, // Javascript object
                        json: true, // Use,If you are sending JSON data
                        url: 'https://testapp.redimed.com.au:3005/api/onlinebooking/create-company'
                    };

                    console.log('will create the new site = ',companySiteData);

                    request(companySiteOptions, function (err, res, body) {
                        if (err) {
                            console.log('createCompany.Error :' ,err)
                        }

                        if(!body.ErrorsList){
                            console.log(' createCompany.Body :',body);
                            createAppointment();
                        }else{
                            console.log(' create sub Company.Body err :',body.ErrorsList);
                            if(body.ErrorsList[0] == 'Company.notFound'){
                                //create father company
                                createCompany(createCompanySite);
                            }
                        };
                    });
                });


            };

            var createAppointment = function(){

                console.log('will transfer data to e-forms',bookingData);

                request(bookingOptions, function (err, res, body) {
                  if (err) {
                    console.log('createAppointment.Error :' ,err)
                    console.log('createAppointment.Res :' ,res)
                    console.log('createAppointment.Body :' ,body)
                  }

                  if(body){
                    if(!body.ErrorsList){
                        console.log(' createAppointment.Body :',body);
                        if(body.status == 'success'){
                            console.log(' createAppointment.Body :',body.data);
                            for(var i in body.data){
                                var appt = body.data[i].appointment;
                                console.log(" -> data return : ",appt);
                                model.app.models.BookingCandidates.update({candidateId:appt.candidateId},{headerCandidateId:appt.ID},function(err,data){
                                    console.log('-> update back ID from eforms',err,data);
                                });
                            }
                        }
                        }else{
                            console.log(' createAppointment.Body :',body.ErrorsList);
                            if(_.indexOf(body.ErrorsList,'company.notFound') >= 0){

                            if(isSiteCompany){
                                console.log("=>Sub Company not found; will create a new sub company !");
                                createCompanySite();
                            }else{
                                console.log("=>Company not found; will create a new company !");
                                createCompany(createAppointment);
                            }
                        }
                    };
                  }
                });
            };

            createAppointment();

            //////////////////////////////
        });
    };


};
