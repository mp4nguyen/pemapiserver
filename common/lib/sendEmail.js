/**
 * Created by phuongnguyen on 1/01/16.
 */
var Q = require("q");
var loopback = require('loopback');
var moment = require('moment');

module.exports = function(model){

    var m = {};
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

    m.sendConfirmationEmail = function(pEmailType,candidate,bookingHeader,site,packageView){

        var deferred = Q.defer();

        //get contact email of current user
        var emailType = pEmailType + " ";
        var currentUser = loopback.getCurrentContext().active.currentUser;
        var currentCompany = loopback.getCurrentContext().active.company;

        console.log("   site = ",site);
        
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

                    console.log("headerComments=",headerComments,"detailComments=",detailComments);
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
                    
                    console.log(">>>>>>>>>>>>>>>>>>>>>>will send confirmation email","to = ",candidate.email,currentUser.contactEmail,currentCompany.reportToEmail);//," sub = ",candidate.candidatesName,"html = ",html

                    model.app.models.Email.send({
                        to: [candidate.email,currentUser.contactEmail,currentCompany.reportToEmail,bookingHeader.contactEmail,'pnguyen@redimed.com.au'] ,

                        from: "HealthScreenings@redimed.com.au",
                        subject: emailSubject,
                        html: html
                    }, function(err) {
                        if (err) {
                            console.log('> error sending confirmation email',err);
                            deferred.reject(new Error('Error sending confirmation email to '  + candidate.candidatesName + '<' + candidate.email + '>; ' + bookingHeader.bookingPerson +  ' <'+ bookingHeader.contactEmail + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '> <' + currentCompany.reportToEmail + '> ' + err));
                        }else{
                            console.log('>Sent confirmation email to: '+ candidate.candidatesName + '<' + candidate.email + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '>');
                            deferred.resolve('Sent confirmation email to: ' + candidate.candidatesName + '<' + candidate.email + '>; ' + bookingHeader.bookingPerson +  ' <'+ bookingHeader.contactEmail + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '> <' + currentCompany.reportToEmail + '>');
                        }

                    });

                });
            //end confirmed email
            }else if(candidate.appointmentStatus.indexOf('Pending')>=0){
            //begin pending email
                emailSubject = 'Appointment note #' + candidate.candidatesName;
                html = "Your booking request has been successfully submitted. Please note that your booking is NOT confirmed until you have received a confirmation email from the REDIMED healthscreening team confirming the booking request and the time of the appointment. REDIMED will endeavour to make appointments for preferred times wherever possible, however where this is not possible, the next available time/date will be made available for your candidate.";
                console.log(">>>>>>>>>>>>>>>>>>>>>>will send pending email","to = ",candidate.email,currentUser.contactEmail,currentCompany.reportToEmail);//," sub = ",candidate.candidatesName,"html = ",html

                model.app.models.Email.send({
                    to: [currentUser.contactEmail,currentCompany.reportToEmail,bookingHeader.contactEmail,'pnguyen@redimed.com.au'] ,
                    from: "HealthScreenings@redimed.com.au",
                    subject: emailSubject,
                    html: html
                }, function(err) {
                    if (err) {
                        console.log('> error sending pending email',err);
                        deferred.reject(new Error('Error sending pending email to '  + candidate.candidatesName + '<' + candidate.email + '>; ' + bookingHeader.bookingPerson +  ' <'+ bookingHeader.contactEmail + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '> <' + currentCompany.reportToEmail + '> ' + err));
                    }else{
                        console.log('>Sent pending email to: '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '>');
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
                    console.log(">>>>>>>>>>>>>>>>>>>>>>will send cancelled email","to = ",candidate.email,currentUser.contactEmail,currentCompany.reportToEmail);//," sub = ",candidate.candidatesName,"html = ",html

                    model.app.models.Email.send({
                        to: [candidate.email,currentUser.contactEmail,currentCompany.reportToEmail,bookingHeader.contactEmail,'pnguyen@redimed.com.au'] ,
                        from: "HealthScreenings@redimed.com.au",
                        subject: emailSubject,
                        html: html
                    }, function(err) {
                        if (err) {
                            console.log('> error sending cancelled  email',err);
                            deferred.reject(new Error('Error sending cancellation  email to '  + candidate.candidatesName + '<' + candidate.email + '>; ' + bookingHeader.bookingPerson +  ' <'+ bookingHeader.contactEmail + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '> <' + currentCompany.reportToEmail + '> ' + err));
                        }else{
                            console.log('>Sent cancelled  email to: '+ candidate.candidatesName + '<' + candidate.email + '>; '+ currentUser.bookingPerson + '<' + currentUser.contactEmail + '>');
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

    return m;

}
