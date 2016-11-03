/**
 * Created by phuongnguyen on 13/01/16.
 */
var Sequelize = require('Sequelize');
var sequelize = new Sequelize('sakila2', 'root', 'root', {
  host: 'localhost',
  dialect: 'mysql',
  pool: {
    max: 5,
    min: 0,
    idle: 10000
  },
  timezone: '+00:00'
});


// load models
var models = [
  'Monitor'
];
console.log(1);
models.forEach(function(model) {
  var m = sequelize.import(__dirname + '/' + model);
  m.sync({force: true});
  module.exports[model] = m;
});
console.log(2);
// export connection
module.exports.sequelize = sequelize;
