var loopback = require('loopback');
var moment = require('moment');
module.exports = function(BookingCandidates) {
    var email = require('../lib/sendEmail.js')(BookingCandidates);
    var emailQueue = require('../lib/mailqueue.js');


    BookingCandidates.sendConfirmationEmail = function(candidateId,emailType,cb) {
        var currentUser = loopback.getCurrentContext().active.currentUser;
        var currentCompany = loopback.getCurrentContext().active.company;

        emailQueue.newEmail(candidateId,emailType,currentUser,currentCompany);
        /*
        var fromDate = moment().add(-3,'d');
        BookingCandidates.find({where:{candidateId:{neq:candidateId},issendemail:null,creationDate:{gt:fromDate}}},(err,data)=>{
          console.log('not yet send email',err,data);
          data.forEach(can=>{
            emailQueue.newEmail(can.candidateId,emailType,currentUser,currentCompany);
          });
        });
        */
        if(cb){
          cb(null,"Will send the email");  
        }

    };

    BookingCandidates.remoteMethod('sendConfirmationEmail', {
        accepts: [
            {arg: 'id', type: 'number'},
            {arg: 'type', type: 'string'},
        ],
        returns: {arg: 'sentEmailStatus', type: 'array'},
        http: {path:'/sendConfirmationEmail', verb: 'get'}
    });

};
