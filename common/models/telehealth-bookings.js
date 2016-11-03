var request = require('request');
var loopback = require('loopback');
var _ = require('underscore');
var moment = require('moment');

module.exports = function(TelehealthBookings) {

    var transferToEforms = function(model,candidate){
        console.log('Candidate = ',candidate);
        var companyId;
        var apptTime = null,preferredFromDate = null,preferredToDate = null, DOB = null;
        var DOB = moment(candidate.dob).format("DD/MM/YYYY");
        var apptDate = moment(candidate.apptDate).format("YYYY-MM-DD HH:mm:ss")+ ' +0800';
        var injuryDate =  moment(candidate.injuryDate).format("DD/MM/YYYY");
        var fullName = candidate.patientName;
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

        var apptDesc = "Medical certificate jurisdiction: " + candidate.medicalState + "; Description of injury: ";
        if(candidate.injuryCrush == 1){
          apptDesc = apptDesc + "Crush";
        }
        if(candidate.injuryLaceration == 1){
          apptDesc = apptDesc + ", Laceration";
        }
        if(candidate.injurySprain == 1){
          apptDesc = apptDesc + ", Sprain/Strain";
        }
        if(candidate.injuryFall == 1){
          apptDesc = apptDesc + ", Fall";
        }
        if(candidate.injuryOther == 1){
          apptDesc = apptDesc + ", Other ("+ candidate.descriptionOfInjury+")";
        }

        apptDesc = apptDesc + ", Date of Injury: "+ injuryDate +"";
        apptDesc = apptDesc + ", Medical history: "+ candidate.medicalHistory +", Allergies: " + candidate.allergies;
        apptDesc = apptDesc + ", Body part: "+ candidate.bodyPart +", Service required: " + candidate.serviceRequired;
        apptDesc = apptDesc + ", Date of Appointment: "+ apptDate +", Preferred time:" + candidate.preferredTime;

        var candidateObject = {
            "candidateId": candidate.bookingId,
            "CandidateFirstName": firstName,
            "CandidateLastName": lastName,
            "Position":  "",
            "DOB":  DOB,
            "email2": candidate.emailForDoc,
            "mobile": null,
            "homePhoneNumber": candidate.contactNumber,
            "workPhoneNumber": null,
            "preferredFromDate": preferredFromDate,
            "preferredToDate": preferredToDate,
            "preferredSiteId": candidate.siteId,
            "AppointmentTime": apptDate,
            "Notes": candidate.appointmentNotes,
            "Address": candidate.address,
            "Suburb": candidate.suburb,
            "State": candidate.state,
            "PostCode": candidate.postcode,
            "Occupation": candidate.occupation,
            "Facetime": candidate.facetime,
            "Skype": candidate.skype,
            "Supervisor": candidate.supervisor,
            "EmailForDocument": candidate.emailForDoc,
            "AppointmentDescription": apptDesc
        };

        var injuryEformObject = {
            "data" : {
                "appointmentUID" : "",
                "templateUID" : "e060e666-6c51-4a19-8523-708d9242a2c0",
                "formData" : {
                    "p_claim" : "",
                    "is_work_related" : "1",
                    "service1": "unchecked",
                    "service2" : "unchecked",
                    "service3" : "unchecked",
                    "service4" : "unchecked",
                    "service5" : "unchecked",
                    "service6" : " unchecked",
                    "service7" : "unchecked",
                    "inj_date" : moment(candidate.injuryDate).format('DD/MM/YYYY'),
                    "inj_place" : "",
                    "what_happened" : "",
                    "is_sprain" : (candidate.injurySprain == 1 ? "checked":"unchecked"),
                    "is_laceration" : (candidate.injuryLaceration == 1 ? "checked":"unchecked"),
                    "is_crush" : (candidate.injuryCrush == 1 ? "checked":"unchecked"),
                    "is_fall" : (candidate.injuryFall == 1 ? "checked":"unchecked"),
                    "other_inj" : (candidate.injuryOther == 1 ? "checked":"unchecked"),
                    "is_sym_before" : "unchecked",
                    "part1" : "unchecked",
                    "part2" : "unchecked",
                    "part3" : "unchecked",
                    "part4" : "unchecked",
                    "part5" : "unchecked",
                    "part6" : "unchecked",
                    "part7" : "unchecked",
                    "part8" : "unchecked",
                    "part9" : "unchecked",
                    "part10" : "unchecked",
                    "part11" : "unchecked",
                    "part12" : "unchecked",
                    "part13" : "unchecked",
                    "part14" : "unchecked",
                    "part15" : "unchecked",
                    "other_part_affected" : candidate.bodyPart,
                    "medic_his1" : "unchecked",
                    "medic_his2" : "unchecked",
                    "medic_his3" : "unchecked",
                    "medic_his4" : "unchecked",
                    "medic_his5" : "unchecked",
                    "medic_his6" : "unchecked",
                    "medic_his7" : "unchecked",
                    "medic_his8" : "unchecked",
                    "medic_his9" : " unchecked",
                    "other_medical_history" : candidate.medicalHistory,
                    "is_allergies" : "checked",
                    "allergies" : candidate.allergies,
                    "inj_sym1" : "unchecked",
                    "inj_sym2" : "unchecked",
                    "inj_sym3" : "unchecked",
                    "inj_sym4" : "unchecked",
                    "pain_level" : "5",
                    "other_symptoms" : "",
                    "initial_treatment" : ""
                }
            }
        };

        //////////////////////////////
        var bookingData = {
                "AppointmentType": "Telehealth",
                "headerId": candidate.bookingId,
                "companyId": candidate.employerId,
                "packageDescription":"",
                "Paperwork": "",
                "Notes": "",
                "BookingCandidates":[candidateObject]
            };

        var companyData = {
            companyId : candidate.employerId,
            CompanyName : candidate.employer
        }

        var injuryEFormOptions = {
            method: 'post',
            body: injuryEformObject, // Javascript object
            json: true, // Use,If you are sending JSON data
            url: 'https://telehealth.redimed.com.au/telehealth/index.php/appointment/CreateRedisiteForm/?token=32bdc5ef796675d4e156e2fbf5c7235a'
        };

        var bookingOptions = {
            method: 'post',
            body: bookingData, // Javascript object
            json: true, // Use,If you are sending JSON data
            url: 'https://testapp.redimed.com.au:3005/api/onlinebooking/appointment-request'
        };

        var companyOptions = {
            method: 'post',
            body: companyData, // Javascript object
            json: true, // Use,If you are sending JSON data
            url: 'https://testapp.redimed.com.au:3005/api/onlinebooking/create-company'
        };


        var createCompany = function(cb){
            console.log('will create the new company = ',companyData);
            request(companyOptions, function (err, res, body) {
                if (err) {
                    console.log('createCompany.Error :' ,err)
                }

                if(!body.ErrorsList){
                    console.log(' createCompany.Body :',body);
                    cb();
                }else{
                    console.log(' createCompany.Body :',body.ErrorsList);
                };
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
                            injuryEformObject.data.appointmentUID = appt.UID;

                            model.app.models.TelehealthBookings.update({bookingId:appt.candidateId},{linkId:appt.ID,linkUUID:appt.UID},function(err,data){
                                console.log('-> update back ID from eforms',err,data);
                            });

                      
                            console.log("--------------> will transfer injury e-form:",injuryEformObject);
                            request(injuryEFormOptions, function (err, res, body) {
                              console.log("===================>injuryEformObject result:",err,res,body);
                            });
                        }
                    }
                }else{
                    console.log(' createAppointment.Body :',body.ErrorsList);
                    if(_.indexOf(body.ErrorsList,'company.notFound') >= 0){
                      console.log("=>Company not found; will create a new company !");
                      createCompany(createAppointment);
                    }
                }
              }

            });
        };
        createAppointment();
    };


    TelehealthBookings.observe('after save', function(ctx, next) {
      var emailQueue = require('../lib/telehealthMailQueue.js');
      if (ctx.instance) {
        console.log('===============>Saved %s#%s', ctx.Model.modelName, ctx.instance);
        transferToEforms(TelehealthBookings,ctx.instance);

        var currentCompany = loopback.getCurrentContext().active.company;
        emailQueue.newEmail(ctx.instance,currentCompany);

      } else {
        console.log('Updated %s matching %j',
          ctx.Model.pluralModelName,
          ctx.where);
      }
      next();
    });


};
