/**
 * Created by phuongnguyen on 15/12/15.
 */
module.exports = function initNestRouting(app) {
    console.log('Initializing nestRemoting for models');
    var Companies = app.models.Companies;
    //Companies.nestRemoting('bookings');
    //Companies.nestRemoting('subsidiaries');
    //Companies.nestRemoting('packages');
    //Companies.nestRemoting('positions');
    app.models.Redimedsites.nestRemoting('Calendars');


    Companies.packages = function(filter,cb){
        cb("","hello");
    };
}
