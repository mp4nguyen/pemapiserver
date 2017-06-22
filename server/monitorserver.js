// Load requirements
var http = require('http'),
io = require('socket.io');
var webSocketClients = [];
var webSocketIDClients = [];
var colors = require('colors');
var email = require('emailjs');
var isRunning = require('is-running');
var logger = require('./monitorlogger');
var models = require('./monitor_models');
var requests = new Map();
var mailServer = email.server.connect({
  user: 'mp4nguyen@gmail.com',
  password: 'anhquyen2611@',
  host: 'smtp.gmail.com',
  ssl: true
});
var pusage = require('pidusage')
// Create server & socket
var server = http.createServer(function(req, res)
{
  // Send HTML headers and message
  res.writeHead(404, {'Content-Type': 'text/html'});
  res.end('<h1>Aw, snap! 404</h1>');
});


server.listen(6500,function(){
  //console.log('Monitor server is running...');
});

io = io.listen(server);

// Add a connect listener
var numberOfWorker = 0;
io.sockets.on('connection', function(socket)
{
  console.log('new client connected to the server...........');
  socket.on('clientInfor',function(msg){

  });

  socket.on('requestStart',function(msg){

    if(msg.url.indexOf('.css')>0
        ||msg.url.indexOf('.html')>0
        ||msg.url.indexOf('.png')>0
        ||msg.url.indexOf('.js')>0
        ||msg.url.indexOf('.ico')>0
        ||msg.url.indexOf('.woff')>0
      ){
    }else{
      var reqObject = {
        pid: msg.proId,
        serverName: msg.serverName,
        reqId: msg.requestId,
        isKill: 0,
        ip: msg.ip,
        url: msg.url,
        reqBody: msg.reqBody,
        startTime: msg.startTime,
        endTime: null,
        duration: null,
        userId: msg.userId,
        userName: msg.userName,
        companyId: msg.companyId,
        companyName: msg.companyName,
        count: 0
      };

      requests.set(msg.proId+':'+msg.requestId,reqObject);
      //console.log('------> Will send data to web client',reqObject);
      webSocketClients.forEach(socket=>{
          socket.emit('sendReqBeginToWeb',reqObject);
      });
    }


  });

  socket.on('requestEnd',function(msg){
    var req = requests.get(msg.proId+':'+msg.requestId);
    if(req){
      console.log('ip: ',msg.ip,' proId : ',msg.proId,' reqId: ',msg.requestId,'msg.endTime:',msg.endTime,' duration: ',msg.duration,' url: ',msg.url,'');
      req.endTime = msg.endTime;
      req.duration = msg.duration;
      //console.log('end req....');

      webSocketClients.forEach(socket=>{
          socket.emit('sendReqEndToWeb',{pid:msg.proId,reqId:msg.requestId,endTime:msg.endTime,duration: msg.duration});
      });
    }
  });


  socket.on('webAskForInitialData',()=>{
      //react connect to the monitor server and ask for the initial data
      //server will emit the whole data to the web
      console.log('Receve message from web.....');
      webSocketClients.push(socket);
      webSocketIDClients.push(socket.id);
      var workersArray = [];
      models.Monitor.findAll().then((data)=>{
          console.log('======> data length in DB = ',data.length);
          workersArray = data;
          console.log(' more data from memory ' ,requests.size);
          requests.forEach((worker,key)=>{
            workersArray.push(worker);
          },requests);
          socket.emit('initialDataForWeb',workersArray);
      });
  });

  // Disconnect listener
  socket.on('disconnect', function() {
    //console.log('Client disconnected.');
  });
});

//check requests each second
setInterval(()=>{
  var bulkInsert = [];
  var bulkUpdate = [];

  requests.forEach(function(request,key){
    if(request.duration && request.count == 0){
      bulkInsert.push({
        pid: request.pid,
        serverName: request.serverName,
        reqId: request.reqId,
        isKill: request.isKill,
        ip: request.ip,
        url: request.url,
        reqBody: request.reqBody.substring(0,4990),
        startTime: request.startTime,
        endTime: request.endTime,
        duration: request.duration,
        userId: request.userId,
        userName: request.userName,
        companyId: request.companyId,
        companyName: request.companyName,
        count: request.count
      });

      //request.delete(key);
    }else if( (request.duration && request.count > 0) || request.isKill == 1){
      console.log('will update monitor table ',request);
      models.Monitor.update({endTime:request.endTime,duration:request.duration,count:request.count,isKill:request.isKill},
                            {where:{pid:request.pid,reqId:request.reqId}}).then(function(v){
                                //console.log('---> delete  result = ',key);
                                requests.delete(key);
                            });
    }
    else if(!request.duration && request.count==0){
      bulkInsert.push({
        pid: request.pid,
        serverName: request.serverName,
        reqId: request.reqId,
        isKill: request.isKill,
        ip: request.ip,
        url: request.url,
        reqBody: request.reqBody.substring(0,4990),
        startTime: request.startTime,
        endTime: request.endTime,
        duration: request.duration,
        userId: request.userId,
        userName: request.userName,
        companyId: request.companyId,
        companyName: request.companyName,
        count: request.count
      });
    }else if(!request.duration && request.count > 0){
      models.Monitor.update({count:request.count},
                            {where:{pid:request.pid,reqId:request.reqId}}).then(function(v){
                                //console.log('---> delete  result = ',key);
                            });
    }
  },requests);

  //console.log('bulkInsert=',bulkInsert);
  var monitor = models.Monitor.bulkCreate(bulkInsert).then(function(){
    bulkInsert.forEach(function(value){
      //console.log(' + will delete value = ',value);
      if(value.duration){
          requests.delete(value.pid+':'+value.reqId);
      }
    });
  });

},10000);

setInterval(function(){
  requests.forEach(function(request,key){
      if(!request.duration){
          if(!request.isKill){
              request.count++;
              var outputDiedWorker = 'pid=' + request.pid +
              ' ip=' + request.ip +
              ' count = ' + request.count +
              ' url = ' + request.url +
              ' body = ' + request.reqBody +
              ' userName = ' + request.userName +
              ' companyName = ' + request.companyName;
              console.log('===>late req = ',outputDiedWorker);
              if(request.count > 5 && isRunning(request.pid) && request.isKill == 0){
                    //io.emit('sendReqUpdateToWeb',{pid:msg.proId,reqId:msg.requestId,count:request.count,isKill: 1});
                    //console.log(('Sending an email and kill pid = ' + key).red);
                    webSocketClients.forEach(socket=>{
                        console.log('will emit killing request to ',socket.id);
                        socket.emit('sendReqUpdateToWeb',{pid:request.pid,reqId:request.reqId,count:request.count,isKill:1});
                    });
                    logger.error('Sending an email and kill pid = ' + key);
                    logger.info('Sending an email and kill pid = ' + key);
                    request.isKill = 1;
                    mailServer.send({
                      text: outputDiedWorker,
                      from: 'NodeJS',
                      to: 'phuong_thql@yahoo.com',
                      cc: '',
                      subject: 'processid: ' + key + ' has died'
                    }, function (err, message) {
                      //value.diedRequestLogToScreen.log(err || message);
                    });
                    //process.kill(request.pid)
              }else{
                  webSocketClients.forEach(socket=>{
                      console.log('will emit too long request to ',socket.id);
                      socket.emit('sendReqUpdateToWeb',{pid:request.pid,reqId:request.reqId,count:request.count});
                  });
              }
          }
      }
  },requests);
},500);
