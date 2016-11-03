var requestify = require('requestify'); 
var request = require('request');
var _ = require('underscore');
var sslRootCAs = require('ssl-root-cas/latest')

module.exports = function(app) {
			
		console.log("Running script...........................................................................................");
		sslRootCAs.inject();

		var bookingData = {
			    "headerId": 1,
			    "companyId": 14,
			    "packageDescription":"helo ne",
			    "Paperwork": "gogon",
			    "Notes": "note ne",			    
			    "BookingCandidates": [
			        {
			            "candidateId": 1, 
			            "CandidateFirstName": "Adam",
			            "CandidateLastName": "Smith",
			            "Position": "Giam doc",
			            "DOB": "1993/12/27",
			            "email": "tannv.dts@gmail.com",
			            "mobile": "0468996833",
			            "homePhoneNUmber": "91234567",
			            "workPhoneNumber": "94567895",
			            "preferredFromDate": "2016-01-01 +0700",
			            "preferredToDate": "2016-01-03 +0700",
			            "preferredSiteId": "2",
			            "AppointmentTime": "2016-01-01 17:11:11 +0700",
			            "Notes": "gap dau giet do"
			        }
			    ]
			    
			};

		var companyData = {
			companyId : 1,
			CompanyName : 'Meditek Company'
		}	

		var companySiteData = {
			companyId : 14,
			CompanyName : 'Meditek Perth',
			FatherId: 100000000
		}	

		var options = {
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

		var companySiteOptions = {
			method: 'post',
			body: companySiteData, // Javascript object
			json: true, // Use,If you are sending JSON data
			url: 'https://testapp.redimed.com.au:3005/api/onlinebooking/create-company'
		};		

		var createCompany = function(){
	  		request(companyOptions, function (err, res, body) {
	 			if (err) {
	    			console.log('createCompany.Error :' ,err)
	  			}      			

	  			if(!body.ErrorsList){
				  	console.log(' createCompany.Body :',body);	
				  	createAppointment();
				}else{
				  	console.log(' createCompany.Body :',body.ErrorsList);	
				};
	  		});			
		};

		var createCompanySite = function(){
	  		request(companySiteOptions, function (err, res, body) {
	 			if (err) {
	    			console.log('createCompany.Error :' ,err)
	  			}      			

	  			if(!body.ErrorsList){
				  	console.log(' createCompany.Body :',body);	
				  	createAppointment();
				}else{
				  	console.log(' createCompany.Body :',body.ErrorsList);	
				};
	  		});			
		};

		var createAppointment = function(){

			request(options, function (err, res, body) {
			  if (err) {
			    console.log('createAppointment.Error :' ,err)
			    console.log('createAppointment.Res :' ,res)
			    console.log('createAppointment.Body :' ,body)
			  }     
			 
			  if(!body.ErrorsList){
			  	console.log(' createAppointment.Body :',body);	
			  	if(body.status == 'success'){
			  		console.log(' createAppointment.Body :',body.data);	
			  	}
			  }else{
			  	console.log(' createAppointment.Body :',body.ErrorsList);	
			  	if(_.indexOf(body.ErrorsList,'company.notFound') >= 0){
			  		console.log("=>Company not found; will create a new company !");
			  		//createCompany();
			  		createCompanySite();
			  	}

			  };
			});			
		}

		//createAppointment();
		//createCompany();
		//createCompanySite();
 
/*
 requestify.request('https://testapp.redimed.com.au:3005/api/onlinebooking/appointment-request', 
 		{
            method: 'POST',
            body: bookingData,
            dataType: 'json',
            responseType:'arraybuffer',
            withCredentials: true,
            rejectUnauthorized: false
        }).then(function(response) {
        // Get the response body (JSON parsed or jQuery object for XMLs)
        response.getBody();

        console.log("response.body =",response.body)
        // Get the raw response body
        response.body;
    });      


 requestify.post('https://testapp.redimed.com.au:3005/api/onlinebooking/appointment-request',
			{
			    "headerId": 1,
			    "companyId": 14,
			    "packageDescription":"helo ne",
			    "Paperwork": "gogon",
			    "Notes": "note ne",			    
			    "BookingCandidates": [
			        {
			            "candidateId": 1, 
			            "CandidateFirstName": "Adam",
			            "CandidateLastName": "Smith",
			            "Position": "Giam doc",
			            "DOB": "1993/12/27",
			            "email": "tannv.dts@gmail.com",
			            "mobile": "0468996833",
			            "homePhoneNUmber": "91234567",
			            "workPhoneNumber": "94567895",
			            "preferredFromDate": "2016-01-01 +0700",
			            "preferredToDate": "2016-01-03 +0700",
			            "preferredSiteId": "2",
			            "AppointmentTime": "2016-01-01 17:11:11 +0700",
			            "Notes": "gap dau giet do"
			        }
			    ]
			    
			}
 	)
    .then(function(response) {
        // Get the response body (JSON parsed or jQuery object for XMLs)
        response.getBody();

        console.log("response.body =",response.body)
        // Get the raw response body
        response.body;
    });      
*/
}
