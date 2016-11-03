var request = require('request');

request('https://medicalbookings.redimed.com.au:8181/api/accounts/ping', function (error, response, body) {
    if (!error && response.statusCode == 200) {
        console.log(body); // Show the HTML for the Modulus homepage.
    }
});
