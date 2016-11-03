// Load requirements
var http = require('http'),
io = require('socket.io'),
reqMap = new Map();
var clientInforMap = new Map();
var diedWorkerMap = new Map();
var workers = new Map();
var workersData = [];//used to display the workers on the screen.
var justKilledPid = -1;//use to store the pid that is kill , so we can disable the display and add the pid to the new pid
var justKilledLastId = -1;
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
      //console.log(' remove',msg.url);
    }else{
      //console.log(' keep',msg.url);
      requests.set(msg.proId+':'+msg.requestId,{
        pid: msg.proId,
        reqId: msg.requestId,
        ip: msg.ip,
        url: msg.url,
        startTime: msg.startTime,
        endTime: null,
        duration: null,
        userId: msg.userId,
        userName: msg.userName,
        companyId: msg.companyId,
        companyName: msg.companyName,
        count: 0
      });
    }


  });

  socket.on('requestEnd',function(msg){

    var req = requests.get(msg.proId+':'+msg.requestId);
    if(req){
      console.log('ip: ',msg.ip,' proId : ',msg.proId,' reqId: ',msg.requestId,'msg.endTime:',msg.endTime,' duration: ',msg.duration,' url: ',msg.url,'');

      req.endTime = msg.endTime;
      req.duration = msg.duration;
    }

    //logAll.log('ip: ' + msg.ip + ' pid: ' + msg.proId + ' id: ' + msg.requestId + ' time: ' + msg.duration + ' url: ' + msg.url);

        ///models.Monitor.update({endTime:msg.endTime,duration:msg.duration},{where:{pid:msg.proId,reqId:msg.requestId}});
  });


  socket.on('webAskForInitialData',()=>{
      //react connect to the monitor server and ask for the initial data
      //server will emit the whole data to the web
      console.log('Receve message from web.....ss');
      var workersArray = [];
      workers.forEach((worker,key)=>{
        workersArray.push(worker);
      },workers);
      socket.emit('initialDataForWeb',workers);
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
        reqId: request.reqId,
        ip: request.ip,
        url: request.url,
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
    }else if(request.duration && request.count > 0){
      console.log('will update monitor table ',request);
      models.Monitor.update({endTime:request.endTime,duration:request.duration,count:request.count},
                            {where:{pid:request.pid,reqId:request.reqId}}).then(function(v){
                                console.log('---> delete  result = ',key);
                                requests.delete(key);
                            });

    }
    else if(!request.duration && request.count==0){
      bulkInsert.push({
        pid: request.pid,
        reqId: request.reqId,
        ip: request.ip,
        url: request.url,
        startTime: request.startTime,
        endTime: request.endTime,
        duration: request.duration,
        userId: request.userId,
        userName: request.userName,
        companyId: request.companyId,
        companyName: request.companyName,
        count: request.count
      });
      request.count++;
    }else{
      request.count++;
      //models.Monitor.update(
        //{endTime:request.endTime,duration:request.duration,count:request.count},
        //{where:{pid:request.proId,reqId:request.requestId}});
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

},1000);
