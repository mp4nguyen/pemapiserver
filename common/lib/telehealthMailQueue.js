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

exports.newEmail = function(booking,currentCompany){
    logger.log('debug',">> id =  " + process.pid + ' ,new email: booking.bookingId' + booking.bookingId);
    logger.log('info',">> id =  " + process.pid + ' ,new email: booking.bookingId' + booking.bookingId);
    name = 'Send the email to the booking.bookingId = ' + booking.bookingId;
    var job = jobs.create('telehealthEmail', {
        bookingId: booking.bookingId,
        serviceRequired: booking.serviceRequired,
        bodyPart: booking.bodyPart,
        descriptionOfInjury: booking.descriptionOfInjury,
        injurySprain: booking.injurySprain,
        injuryOther: booking.injuryOther,
        injuryLaceration: booking.injuryLaceration,
        injuryFall: booking.injuryFall,
        injuryCrush: booking.injuryCrush,
        medicalState: booking.medicalState,
        skype: booking.skype,
        facetime: booking.facetime,
        dob: booking.dob,
        patientName: booking.patientName,
        apptDate: booking.apptDate,
        preferredTime: booking.preferredTime,
        reportToEmail: currentCompany.reportToEmail
    });

    job
        .on('enqueue', function(id, type){
            logger.log('debug',">> id =  " + process.pid + ' , Job in queue jobId=' + job.id);
            logger.log('info',">> id =  " + process.pid + ' , Job in queue jobId=' + job.id);
        })
        .on('complete', function (){
            logger.log('debug',">> id =  " + process.pid + ' ,Complete email: booking.bookingId' + booking.bookingId + ' Job created, jobId=' + job.id);
            logger.log('info',">> id =  " + process.pid + ' ,Complete email: booking.bookingId' + booking.bookingId + ' Job created, jobId=' + job.id);
        })
        .on('failed attempt', function(errorMessage, doneAttempts){
            logger.log('debug',">> id =  " + process.pid + ' ,Fail attemp to send email: booking.bookingId' + booking.bookingId + ' Job created, jobId=' + job.id + " doneAttempts = " + doneAttempts + " errorMessage = " + errorMessage);
            logger.log('info',">> id =  " + process.pid + ' ,Fail attemp to send email: booking.bookingId' + booking.bookingId + ' Job created, jobId=' + job.id + " doneAttempts = " + doneAttempts + " errorMessage = " + errorMessage);
            console.log("failed attempt doneAttempts = " + doneAttempts );
        })
        .on('failed', function (errorMessage){
            logger.log('debug',">> id =  " + process.pid + ' ,Fail to send email: booking.bookingId' + booking.bookingId + ' Job created, jobId=' + job.id + " errorMessage = " + errorMessage);
            logger.log('info',">> id =  " + process.pid + ' ,Fail to send email: booking.bookingId' + booking.bookingId + ' Job created, jobId=' + job.id + " errorMessage = " + errorMessage);
            console.log("failed");
        });



    job.attempts(3);

    job.save(function(err){
        if (err) {
            logger.log('debug',">> id =  " + process.pid + ' ,save email: booking.bookingId' + booking.bookingId + ' Job created, jobId=' + job.id + ' err=' + err);
            logger.log('info',">> id =  " + process.pid + ' ,save email: booking.bookingId' + booking.bookingId + ' Job created, jobId=' + job.id + ' err=' + err);
        } else {
            logger.log('debug',">> id =  " + process.pid + ' ,save email: booking.bookingId' + booking.bookingId + ' Job created, jobId=' + job.id );
            logger.log('info',">> id =  " + process.pid + ' ,save email: booking.bookingId' + booking.bookingId + ' Job created, jobId=' + job.id );
        }
    });
}

jobs.process('telehealthEmail',1, function (job, done){

    tempFunc(job, done);
});


var tempFunc = function(job, done){
    setTimeout(sendEmailFunc(job,done,job.data),10000);
};

var sendEmailFunc = function(job,done,data){


    logger.log('debug',">> id =  " + process.pid + ' ,I am sending: booking.bookingId' + data.bookingId + ', jobId=' + job.id );
    logger.log('info',">> id =  " + process.pid + ' ,I am sending: booking.bookingId' + data.bookingId + ', jobId=' + job.id );
    sendConfirmationEmail(data).then(function(res){
        //console.log(">>>>>>>>sendConfirmationEmail res = ",res);
        //cb(null,res + " ");
        logger.log('debug',">> id =  " + process.pid + ' ,sendConfirmationEmail: booking.bookingId' + data.bookingId + ' Job created, jobId=' + job.id + " Job finished, res=" + res);
        logger.log('info',">> id =  " + process.pid + ' ,sendConfirmationEmail: booking.bookingId' + data.bookingId + ' Job created, jobId=' + job.id + " Job finished, res=" + res);
        done();
    },function(err){
        //console.log(">>>>>>>>sendConfirmationEmail err = ",err);
        logger.log('debug',">> id =  " + process.pid + ' , Error sendConfirmationEmail: booking.bookingId' + data.bookingId + ' Job created, jobId=' + job.id + " Job finished, err=" + err);
        logger.log('info',">> id =  " + process.pid + ' , Error sendConfirmationEmail: booking.bookingId' + data.bookingId + ' Job created, jobId=' + job.id + " Job finished, err=" + err);
        var err = new Error('purposely fail job');
        job.failed().error(err);
        done(err);
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

var sendConfirmationEmail = function(patientInfo){

    var deferred = Q.defer();

    //begin confirmed email
    var fs = require('fs')
        , filename = __dirname+"/telehealthMailTemplate.txt";

    fs.readFile(filename, 'utf8', function(err, data) {
        if (err) throw err;

        var html = data + ".";
        var apptTime = patientInfo.apptDate;
        var emailSubject = 'Telehealth Appointment #' + patientInfo.patientName;


        if(patientInfo.apptDate){
            apptTime = moment(patientInfo.apptDate).format("DD/MM/YYYY HH:mm");
        }
        //add(patientInfo.apptDate.getTimezoneOffset(),"m")
        var injury = "";
        if (patientInfo.injurySprain == 1){ injury = injury + "  Sprain|" }
        if (patientInfo.injuryLaceration == 1){ injury = injury + "  Laceration|" }
        if (patientInfo.injuryFall == 1){ injury = injury + "  Fall|" }
        if (patientInfo.injuryCrush == 1){ injury = injury + "  Crush|"}
        if (patientInfo.injuryOther == 1){ injury = injury + "  " +patientInfo.descriptionOfInjury}

        html = html.replace("{{time}}",apptTime );
        html = html.replace("{{certtype}}",patientInfo.serviceRequired);
        html = html.replace("{{state}}",patientInfo.medicalState);
        html = html.replace("{{patientname}}",patientInfo.patientName);
        html = html.replace("{{dob}}",moment(patientInfo.dob).format("DD/MM/YYYY"));
        html = html.replace("{{facetime}}",patientInfo.facetime);
        html = html.replace("{{skype}}",patientInfo.skype);
        html = html.replace("{{injury}}",injury);
        html = html.replace("{{bodypart}}",patientInfo.bodyPart);
        //console.log(">>>>>>will send confirmation email","to = ",candidate.email,currentUser.contactEmail,currentCompany.reportToEmail);//," sub = ",candidate.candidatesName,"html = ",html
        var sendTo = [
                        patientInfo.reportToEmail,
                        'pnguyen@redimed.com.au'
                      ];

        logger.log('debug',">> id =  " + process.pid + ' , will send confirmation email: patientInfo.bookingId' + patientInfo.bookingId );
        logger.log('info',">> id =  " + process.pid + ' , will send confirmation email: patientInfo.bookingId' + patientInfo.bookingId);
        console.log('Will send to :',sendTo);
        app.models.Email.send({
            to: sendTo,
            from: "HealthScreenings@redimed.com.au",
            subject: emailSubject,
            html: html
        }, function(err) {
            if (err) {
                //console.log('> error sending confirmation email',err);
                logger.log('debug',">> id =  " + process.pid + ' , error sending confirmation email patientInfo.bookingId =' + patientInfo.bookingId  + " err = " + err);
                logger.log('info',">> id =  " + process.pid + ' , error sending confirmation email patientInfo.bookingId =' + patientInfo.bookingId + " err = " + err);
                deferred.reject(new Error('Error sending confirmation email to '  + sendTo + '> ' + err));
            }else{
                //console.log('>Sent confirmation email to: '+ candidate.candidatesName + '<' + candidate.email + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '>');
                logger.log('debug',">> id =  " + process.pid + ' , patientInfo.bookingId =' + patientInfo.bookingId );
                logger.log('info',">> id =  " + process.pid + ' , patientInfo.bookingId =' + patientInfo.bookingId );
                var pId = patientInfo.bookingId;
                app.models.TelehealthBookings.update({bookingId:patientInfo.bookingId},{issendemail:'Y'},function(err,data){
                  console.log('Update email status for telehealth booking',err,data);
                });
                deferred.resolve('Sent confirmation email to: ' + sendTo + '>');
            }

        });

    });
    //end confirmed email


    return deferred.promise;
}
