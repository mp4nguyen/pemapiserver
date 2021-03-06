var request = require('request');
var loopback = require('loopback');
var _ = require('underscore');
var moment = require('moment');
var Q = require("q");
//var baseUrl = 'https://115.79.192.205:3005';
//var baseUrl = 'https://testapp.redimed.com.au:3005';
var baseUrl = 'https://testapp.redimed.com.au:3005';

module.exports = function(SynToEMR) {

    SynToEMR.synSites = function(cb) {

      var reqoptions = {
          method: 'get',
          json: true,
          rejectUnauthorized: false,
          requestCert: true,
          agent: false,
          url: baseUrl + '/api/online-booking/site/list?IsOnSite=N'
      };

      request(reqoptions, function (err, res, body) {
          if (err) {
              console.log('synSites.Error :' ,err);
              cb(err,null);
          }
          body.data.forEach((site)=>{
            SynToEMR.app.models.Redimedsites.findOne({where:{refId: site.ID}},(err,redimedSite)=>{
              console.log("find site =",err,redimedSite);
              if(redimedSite){
                  redimedSite.siteName = site.SiteName;
                  redimedSite.siteAddr = site.Location;
                  redimedSite.refUUID = site.UID;
                  redimedSite.save();
              }else{
                  SynToEMR.app.models.Redimedsites.create({id:0,siteName: site.SiteName,siteAddr: site.Location,refUUID: site.UID,refId: site.ID,bookingStatus:'Confirmed'},(err,newredimedSite)=>{
                        console.log('create new site = ',err,newredimedSite);
                  });
              }
            });
          });

          cb(null,body);
      });

    };


    SynToEMR.synCalendars = function(cb) {

      var synBody =
          {
                  "data":{
                      "Filter": [{
                        "Calendar": {
                          "ClinicSiteID":{"$in":[1,2,3]},
                          "ServiceID":{"$in":[13]},
                          "IsPEMSync": {"$ne": "SYNC"}
                        }
                      }],
                      "Range": [{
                        "Calendar": {
                        "CalendarFromTime": ["2016-10-27 00:00:00 +0800", "2030-10-30 00:00:00 +0800"]
                        }
                      }],
                      "Order": [{
                        "Calendar": {
                          "ClinicSiteID": "ASC",
                          "DoctorID": "ASC",
                          "CalendarFromTime": "ASC"
                        }
                      }]
                  }
              };

      var synCalOptions = {
          method: 'post',
          json: true,
          body: synBody,
          rejectUnauthorized: false,
          requestCert: true,
          agent: false,
          url: baseUrl + '/api/calendar/online-booking/list'
      };

      var updateSynBody = {
        "data": {
          "Calendars": {
            "ID": {
              "$in": []
            }
          }
        }
      };

      var updateSynCalOptions = {
          method: 'post',
          json: true,
          body: updateSynBody,
          rejectUnauthorized: false,
          requestCert: true,
          agent: false,
          url: baseUrl + '/api/calendar/online-booking/update-pemsync'
      };

      request(synCalOptions, function (err, res, body) {
          if (err) {
              console.log('synSites.Error :' ,err);
          }
          console.log('total of records found in core server = ',body.data.length);
          var insertArray = [];
          var ids = [];

          body.data.forEach((cal)=>{
              //console.log(cal);
              ids.push(cal.ID);
              insertArray.push({
                                  calId: cal.ID,
                                	uid: cal.UID,
                                	rosterId: cal.RosterID,
                                	doctorId: cal.DoctorID,
                                	doctorName: cal.DoctorName,
                                	fromTime: cal.CalendarFromTime,
                                	toTime: cal.CalendarToTime,
                                	siteId: cal.ClinicSiteID,
                                	serviceId: cal.ServiceID,
                                	enable: cal.Enable,
                                  isPEMSync: cal.IsPEMSync
                                });
          });

          SynToEMR.app.models.Calendar2.destroyAll({calId:{inq:ids}},(err,info)=>{

            console.log('Deleted all cal before insert into calendar2 ',err,info);

            SynToEMR.app.models.Calendar2.create(insertArray,function(err,rs){
              //console.log(' insert data into calendar2 = ',err,rs);
              console.log(" error = ",err);

              console.log(" total or records created in calendar2 of online booking = ",rs.length);
              updateSynBody.data.Calendars.ID["$in"] = ids;
              if(rs.length > 0){
                request(updateSynCalOptions, function (err, res, body) {
                    if (err) {
                        console.log('synSites.Error :' ,err);
                    }
                    console.log('updateSynCalOptions = ',body);
                });
              }
            });
          });

      });
      cb(null,"Submit successfully");
    };

};
