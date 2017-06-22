/**
 * Created by phuongnguyen on 15/03/16.
 */
var exports = module.exports = {};
var Q = require("q");
var logger = require("../../server/logger");
var moment = require('moment');
var app = require('../../server/server'); //require `server.js` as in any node.js app
var kue = require('kue')
    , jobs = kue.createQueue()
    ;


logger.log('info',">> id =  " + process.pid + '  email queue starting ..............');

exports.newEmail = function(candidateId,emailType,currentUser,currentCompany){
    logger.log('debug',">> id =  " + process.pid + ' ,new email: candidateId' + candidateId);
    logger.log('info',">> id =  " + process.pid + ' ,new email: candidateId' + candidateId);
    name = 'Send the email to the candidateId = ' + candidateId;
    var job = jobs.create('email', {
        name: name,
        candidateId: candidateId,
        emailType: emailType,
        currentUser: currentUser,
        currentCompany: currentCompany
    });

    job
        .on('enqueue', function(id, type){
            logger.log('debug',">> id =  " + process.pid + ' , Job in queue jobId=' + job.id);
            logger.log('info',">> id =  " + process.pid + ' , Job in queue jobId=' + job.id);
        })
        .on('complete', function (){
            logger.log('debug',">> id =  " + process.pid + ' ,Complete email: candidateId' + candidateId + ' Job created, jobId=' + job.id);
            logger.log('info',">> id =  " + process.pid + ' ,Complete email: candidateId' + candidateId + ' Job created, jobId=' + job.id);
        })
        .on('failed attempt', function(errorMessage, doneAttempts){
            logger.log('debug',">> id =  " + process.pid + ' ,Fail attemp to send email: candidateId' + candidateId + ' Job created, jobId=' + job.id + " doneAttempts = " + doneAttempts + " errorMessage = " + errorMessage);
            logger.log('info',">> id =  " + process.pid + ' ,Fail attemp to send email: candidateId' + candidateId + ' Job created, jobId=' + job.id + " doneAttempts = " + doneAttempts + " errorMessage = " + errorMessage);
            console.log("failed attempt doneAttempts = " + doneAttempts );
        })
        .on('failed', function (errorMessage){
            logger.log('debug',">> id =  " + process.pid + ' ,Fail to send email: candidateId' + candidateId + ' Job created, jobId=' + job.id + " errorMessage = " + errorMessage);
            logger.log('info',">> id =  " + process.pid + ' ,Fail to send email: candidateId' + candidateId + ' Job created, jobId=' + job.id + " errorMessage = " + errorMessage);
            console.log("failed");
        });



    job.attempts(3);

    job.save(function(err){
        if (err) {
            logger.log('debug',">> id =  " + process.pid + ' ,save email: candidateId' + candidateId + ' Job created, jobId=' + job.id + ' err=' + err);
            logger.log('info',">> id =  " + process.pid + ' ,save email: candidateId' + candidateId + ' Job created, jobId=' + job.id + ' err=' + err);
        } else {
            logger.log('debug',">> id =  " + process.pid + ' ,save email: candidateId' + candidateId + ' Job created, jobId=' + job.id );
            logger.log('info',">> id =  " + process.pid + ' ,save email: candidateId' + candidateId + ' Job created, jobId=' + job.id );
        }
    });
}

jobs.process('email',1, function (job, done){

    tempFunc(job, done);
});


var tempFunc = function(job, done){
    setTimeout(sendEmailFunc(job,done,job.data.candidateId,job.data.emailType,job.data.currentUser,job.data.currentCompany),10000);
};

var sendEmailFunc = function(job,done,candidateId,emailType,currentUser,currentCompany){


    logger.log('debug',">> id =  " + process.pid + ' ,I am sending: candidateId' + candidateId + ', jobId=' + job.id );
    logger.log('info',">> id =  " + process.pid + ' ,I am sending: candidateId' + candidateId + ', jobId=' + job.id );
    //console.log("Request to send email to candidateId = " +candidateId + " type="+emailType);
    app.models.BookingCandidates.find({"where": {"candidateId": candidateId}},function(err, data){
        //console.log("send email data",data[0]);
        app.models.BookingHeaders.find({where:{bookingId:data[0].bookingId}},function(err,headerData){
            //console.log(">>>>>>>>sendConfirmationEmail",err,headerData[0]);
            app.models.Redimedsites.find({where:{id:data[0].siteId}},function(err,siteData){

                app.models.Packages.find({where:{id:headerData[0].packageId}, include: {"relation": "AssessmentHeaders","scope": {"include": ["Assessments"]}} },function(err,packData){
                    var packageView = "";
                    var assReportTo = [];
                    var package = JSON.parse(JSON.stringify(packData[0]));
                    //console.log(" printBookingForm has package = ",package);

                    for(var i in package.AssessmentHeaders){
                        var header = package.AssessmentHeaders[i];
                        packageView = packageView + "<b>" + header.headerName + "</b><br>";
                        for(var j in header.Assessments){
                            var ass = header.Assessments[j];
                            packageView = packageView + " - " + ass.assName + "<br>";
                            console.log('ass.reportTo=',ass);
                            if(ass.reportTo){
                              assReportTo.push(ass.reportTo);
                            }

                        }
                    }
                    console.log('-----------------------------------------------> will send to nurse = ',assReportTo);
                    //console.log(" printBookingForm has packageView = ",packageView);
                    //console.log("data[0].siteId = " + data[0].siteId,siteData)

                    sendConfirmationEmail(emailType,data[0],headerData[0],siteData[0],packageView,currentUser,currentCompany,job,assReportTo).then(function(res){
                        //console.log(">>>>>>>>sendConfirmationEmail res = ",res);
                        //cb(null,res + " ");
                        logger.log('debug',">> id =  " + process.pid + ' ,sendConfirmationEmail: candidateId' + candidateId + ' Job created, jobId=' + job.id + " Job finished, res=" + res);
                        logger.log('info',">> id =  " + process.pid + ' ,sendConfirmationEmail: candidateId' + candidateId + ' Job created, jobId=' + job.id + " Job finished, res=" + res);
                        done();
                    },function(err){
                        //console.log(">>>>>>>>sendConfirmationEmail err = ",err);
                        logger.log('debug',">> id =  " + process.pid + ' , Error sendConfirmationEmail: candidateId' + candidateId + ' Job created, jobId=' + job.id + " Job finished, err=" + err);
                        logger.log('info',">> id =  " + process.pid + ' , Error sendConfirmationEmail: candidateId' + candidateId + ' Job created, jobId=' + job.id + " Job finished, err=" + err);
                        var err = new Error('purposely fail job');
                        job.failed().error(err);
                        done(err);
                    });

                });
            });
        });
    });
};

var mysqlDate = function(dateSTR) {

    if(dateSTR){
        var t = dateSTR.split(/[- : T .]/);
        // Apply each element to the Date function
        var d = new Date(t[0], t[1]-1, t[2], t[3], t[4], t[5]);
        var myDate = new Date(dateSTR);
        console.log(">>>apt date from send email = ",dateSTR,"   ",t,"   ",d);
        console.log(myDate.getMonth()," ",myDate.getDay()," ",myDate.getYear());
        return d; // No TZ subtraction on this sample
    }
    return "";
}

var sendConfirmationEmail = function(pEmailType,candidate,bookingHeader,site,packageView,currentUser,currentCompany,job,assReportTo){

    var deferred = Q.defer();

    //get contact email of current user
    var emailType = pEmailType + " ";
    var candidateId = candidate.candidateId;

    if(currentUser){
        //console.log(">>>>>>sendConfirmationEmail currentUser=",currentUser);
        // Read the file and print its contents.
        //console.log("candidate=",candidate,"bookingHeader=",bookingHeader);

        //if appointment status = confirmed ;  will send the confirmed tamplate email
        //Pending: pending template email
        //cancel: cancel template email
        if(candidate.appointmentStatus.indexOf('Confirmed')>=0 || candidate.appointmentStatus.indexOf('Reschedule')>=0 ){
            //begin confirmed email
            var fs = require('fs')
                , filename = __dirname+"/emailTemplate.txt";

            fs.readFile(filename, 'utf8', function(err, data) {
                if (err) throw err;

                var html = data + ".";
                var apptTime = "";
                var bookingComment = "";
                var headerComments = bookingHeader.comments + "";
                var detailComments = candidate.appointmentNotes + "";
                var emailSubject = 'Confirmation for appointment #' + candidate.candidatesName;

                if(candidate.appointmentStatus.indexOf('Reschedule')>=0){
                    emailSubject = 'Reschedule appointment #' + candidate.candidatesName;
                }else{
                    emailSubject = 'Confirmation for appointment #' + candidate.candidatesName;
                }


                if( headerComments.indexOf("null") == -1 ){
                    bookingComment = headerComments;
                }

                if(bookingComment.length > 0){
                    if(detailComments.indexOf("null") == -1){
                        bookingComment = bookingComment + " - " + detailComments;
                    }
                }else{
                    if(detailComments.indexOf("null") == -1){
                        bookingComment =detailComments;
                    }
                }


                //console.log(candidate.appointmentTime.getFullYear()," ",candidate.appointmentTime.getMonth()," ",candidate.appointmentTime.getDate()," ",candidate.appointmentTime.getHours()," ",candidate.appointmentTime.getMinutes()," ",candidate.appointmentTime.getTimezoneOffset());
                if(candidate.appointmentTime){
                    apptTime = moment(candidate.appointmentTime).add(candidate.appointmentTime.getTimezoneOffset(),"m").format("DD/MM/YYYY HH:mm");
                }

                html = html.replace("{{appointmentTime}}",apptTime);
                html = html.replace("{{siteName}}",candidate.siteName + " " + site.siteAddr);
                html = html.replace("{{comments}}",bookingComment);
                html = html.replace("{{assessments}}",packageView);

                //console.log(">>>>>>will send confirmation email","to = ",candidate.email,currentUser.contactEmail,currentCompany.reportToEmail);//," sub = ",candidate.candidatesName,"html = ",html
                var sendTo = [
                                candidate.email,
                                currentUser.contactEmail,
                                currentCompany.reportToEmail,
                                bookingHeader.contactEmail,
                                'pnguyen@redimed.com.au'
                              ];

                for(var k in assReportTo){
                  sendTo.push(assReportTo[k]);
                }
                logger.log('debug',">> id =  " + process.pid + ' , will send confirmation email: candidateId' + candidateId + ' , jobId=' + job.id + "to = " + candidate.email + currentUser.contactEmail + currentCompany.reportToEmail);
                logger.log('info',">> id =  " + process.pid + ' , will send confirmation email: candidateId' + candidateId + ' , jobId=' + job.id + "to = " + candidate.email + currentUser.contactEmail + currentCompany.reportToEmail);
                console.log('Will send to :',sendTo);
                app.models.Email.send({
                    to: sendTo,
                    from: "HealthScreenings@redimed.com.au",
                    subject: emailSubject,
                    html: html
                }, function(err) {
                    if (err) {
                        //console.log('> error sending confirmation email',err);
                        logger.log('debug',">> id =  " + process.pid + ' , error sending confirmation email candidateId =' + candidateId + ' , jobId=' + job.id + " err = " + err);
                        logger.log('info',">> id =  " + process.pid + ' , error sending confirmation email candidateId =' + candidateId + ' , jobId=' + job.id + " err = " + err);
                        deferred.reject(new Error('Error sending confirmation email to '  + candidate.candidatesName + '<' + candidate.email + '>; ' + bookingHeader.bookingPerson +  ' <'+ bookingHeader.contactEmail + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '> <' + currentCompany.reportToEmail + '> ' + err));
                    }else{
                        //console.log('>Sent confirmation email to: '+ candidate.candidatesName + '<' + candidate.email + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '>');
                        logger.log('debug',">> id =  " + process.pid + ' , candidateId =' + candidateId + ' , jobId=' + job.id + '>Sent confirmation email to: '+ candidate.candidatesName + '<' + candidate.email + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '>');
                        logger.log('info',">> id =  " + process.pid + ' , candidateId =' + candidateId + ' , jobId=' + job.id + '>Sent confirmation email to: '+ candidate.candidatesName + '<' + candidate.email + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '>');
                        var pId = candidateId;
                        app.models.BookingCandidates.update({candidateId:pId},{issendemail:'Y'},function(err,data){
                          console.log('Update email status for candidate',err,data);
                        });
                        deferred.resolve('Sent confirmation email to: ' + candidate.candidatesName + '<' + candidate.email + '>; ' + bookingHeader.bookingPerson +  ' <'+ bookingHeader.contactEmail + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '> <' + currentCompany.reportToEmail + '>');
                    }

                });

            });
            //end confirmed email
        }else if(candidate.appointmentStatus.indexOf('Pending')>=0){
            //begin pending email
            emailSubject = 'Appointment note #' + candidate.candidatesName;
            html = "Your booking request has been successfully submitted. Please note that your booking is NOT confirmed until you have received a confirmation email from the REDIMED healthscreening team confirming the booking request and the time of the appointment. REDIMED will endeavour to make appointments for preferred times wherever possible, however where this is not possible, the next available time/date will be made available for your candidate.";
            //console.log(">>>>>>will send pending email","to = ",candidate.email,currentUser.contactEmail,currentCompany.reportToEmail);//," sub = ",candidate.candidatesName,"html = ",html
            logger.log('debug',">> id =  " + process.pid + ' , will send pending email: candidateId' + candidateId + ' , jobId=' + job.id + "to = " + candidate.email + currentUser.contactEmail + currentCompany.reportToEmail);
            logger.log('info',">> id =  " + process.pid + ' , will send pending email: candidateId' + candidateId + ' , jobId=' + job.id + "to = " + candidate.email + currentUser.contactEmail + currentCompany.reportToEmail);

            app.models.Email.send({
                to: [currentUser.contactEmail,currentCompany.reportToEmail,bookingHeader.contactEmail,'pnguyen@redimed.com.au'] ,
                from: "HealthScreenings@redimed.com.au",
                subject: emailSubject,
                html: html
            }, function(err) {
                if (err) {
                    //console.log('> error sending pending email',err);
                    logger.log('debug',">> id =  " + process.pid + ' , error sending pending email candidateId =' + candidateId + ' , jobId=' + job.id + " err = " + err);
                    logger.log('info',">> id =  " + process.pid + ' , error sending pending email candidateId =' + candidateId + ' , jobId=' + job.id + " err = " + err);
                    deferred.reject(new Error('Error sending pending email to '  + candidate.candidatesName + '<' + candidate.email + '>; ' + bookingHeader.bookingPerson +  ' <'+ bookingHeader.contactEmail + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '> <' + currentCompany.reportToEmail + '> ' + err));
                }else{
                    //console.log('>Sent pending email to: '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '>');
                    logger.log('debug',">> id =  " + process.pid + ' , candidateId =' + candidateId + ' , jobId=' + job.id + '>Sent pending email to: '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '>');
                    logger.log('info',">> id =  " + process.pid + ' , candidateId =' + candidateId + ' , jobId=' + job.id + '>Sent pending email to: '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '>');
                    var pId = candidateId;
                    app.models.BookingCandidates.update({candidateId:pId},{issendemail:'Y'},function(err,data){
                      console.log('Update email status for candidate',err,data);
                    });
                    deferred.resolve('Sent pending email to: ' + bookingHeader.bookingPerson +  ' <'+ bookingHeader.contactEmail + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '> <' + currentCompany.reportToEmail + '>');
                }

            });
            //end pending email
        }else if(candidate.appointmentStatus.indexOf('Cancel')>=0) {
             //begin cancellation email
                var fs = require('fs')
                    ,filename = __dirname+"/cancelEmailTemplate.txt";

                fs.readFile(filename, 'utf8', function(err, data) {
                    emailSubject = 'Appointment cancellation #' + candidate.candidatesName;

                    var html = data + ".";
                    var apptTime = "";

                    //console.log(candidate.appointmentTime.getFullYear()," ",candidate.appointmentTime.getMonth()," ",candidate.appointmentTime.getDate()," ",candidate.appointmentTime.getHours()," ",candidate.appointmentTime.getMinutes()," ",candidate.appointmentTime.getTimezoneOffset());
                    if(candidate.appointmentTime){
                        apptTime = moment(candidate.appointmentTime).add(candidate.appointmentTime.getTimezoneOffset(),"m").format("DD/MM/YYYY HH:mm");
                    }

                    html = html.replace("{{appointmentTime}}",apptTime);
                    html = html.replace("{{siteName}}",candidate.siteName + " " + site.siteAddr);
                    //console.log(">>>>>>>>>>>>>>>>>>>>>>will send cancelled email","to = ",candidate.email,currentUser.contactEmail,currentCompany.reportToEmail);//," sub = ",candidate.candidatesName,"html = ",html
                    logger.log('debug',">> id =  " + process.pid + ' , will send cancelled email: candidateId' + candidateId + ' , jobId=' + job.id + "to = " + candidate.email + currentUser.contactEmail + currentCompany.reportToEmail);
                    logger.log('info',">> id =  " + process.pid + ' , will send cancelled email: candidateId' + candidateId + ' , jobId=' + job.id + "to = " + candidate.email + currentUser.contactEmail + currentCompany.reportToEmail);

                    app.models.Email.send({
                        to: [candidate.email,currentUser.contactEmail,currentCompany.reportToEmail,bookingHeader.contactEmail,'pnguyen@redimed.com.au'] ,
                        from: "HealthScreenings@redimed.com.au",
                        subject: emailSubject,
                        html: html
                    }, function(err) {
                        if (err) {
                            //console.log('> error sending cancelled  email',err);
                            logger.log('debug',">> id =  " + process.pid + ' , error sending cancelled email candidateId =' + candidateId + ' , jobId=' + job.id + " err = " + err);
                            logger.log('info',">> id =  " + process.pid + ' , error sending cancelled email candidateId =' + candidateId + ' , jobId=' + job.id + " err = " + err);
                            deferred.reject(new Error('Error sending cancellation  email to '  + candidate.candidatesName + '<' + candidate.email + '>; ' + bookingHeader.bookingPerson +  ' <'+ bookingHeader.contactEmail + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '> <' + currentCompany.reportToEmail + '> ' + err));
                        }else{
                            //console.log('>Sent cancelled  email to: '+ candidate.candidatesName + '<' + candidate.email + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '>');
                            logger.log('debug',">> id =  " + process.pid + ' , candidateId =' + candidateId + ' , jobId=' + job.id + '>Sent cancelled email to: ' + candidate.candidatesName + '<' + candidate.email + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '>');
                            logger.log('info',">> id =  " + process.pid + ' , candidateId =' + candidateId + ' , jobId=' + job.id + '>Sent cancelled email to: ' + candidate.candidatesName + '<' + candidate.email + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '>');
                            deferred.resolve('Sent cancellation email to: ' + candidate.candidatesName + '<' + candidate.email + '>; ' + bookingHeader.bookingPerson +  ' <'+ bookingHeader.contactEmail + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '> <' + currentCompany.reportToEmail + '>');
                        }
                    });
                });
            //begin cancellation email

        }

    }else{
        deferred.reject(new Error('Error sending confirmation email, currentAccount is null, please login again!'));
    }

    return deferred.promise;
}
