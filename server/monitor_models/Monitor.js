/**
 * Created by phuongnguyen on 13/01/16.
 */
 module.exports = function(sequelize, DataTypes) {
   console.log(12);
   var model =  sequelize.define('Monitor', {
     id: {
       type: DataTypes.INTEGER,
       primaryKey: true,
       autoIncrement: true
     },
     pid: {
       type: DataTypes.INTEGER,
       field: 'pid'
     },
     reqId: {
       type: DataTypes.INTEGER,
       field: 'reqId'
     },
     ip: {
       type: DataTypes.STRING,
       field: 'ip'
     },
     url: {
       type: DataTypes.STRING,
       field: 'url'
     },
     startTime: {
       type: DataTypes.BIGINT,
       field: 'startTime'
     },
     endTime: {
       type: DataTypes.BIGINT,
       field: 'endTime'
     },
     duration: {
       type: DataTypes.INTEGER,
       field: 'duration'
     },
     userId: {
       type: DataTypes.INTEGER,
       field: 'userId'
     },
     userName: {
       type: DataTypes.STRING,
       field: 'userName'
     },
     companyId: {
       type: DataTypes.INTEGER,
       field: 'companyId'
     },
     companyName: {
       type: DataTypes.STRING,
       field: 'companyName'
     },
     count: {
       type: DataTypes.INTEGER,
       field: 'count'
     }
   }, {
     tableName: 'monitor_Express_Request' // Model tableName will be the same as the model name
   });

   console.log(4);
   return model;
 };
