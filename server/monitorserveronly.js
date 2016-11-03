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
////////////////////////////////////////////GUI/////////////////////////////////////////////
var blessed = require('blessed')
  , contrib = require('blessed-contrib')

var screen = blessed.screen()

//create layout and widgets

var grid = new contrib.grid({rows: 12, cols: 12, screen: screen})

var donut = grid.set(8, 8, 4, 1, contrib.donut,
  {
  label: 'Percent Donut',
  radius: 10,
  arcWidth: 4,
  yPadding: 2,
  data: [{label: 'Storage', percent: 87}]
})
var workersTable =  grid.set(8, 8, 4, 1, contrib.table,
  { keys: true
  , fg: 'green'
  , label: 'Workers'
  , columnSpacing: 1
  , columnWidth: [10, 10]});
workersTable.setData({headers: ['PID', 'Status'], data: []});


var ipsTable =  grid.set(8, 9, 4, 3, contrib.table,
  { keys: true
  , fg: 'green'
  , label: 'IPs'
  , columnSpacing: 1
  , columnWidth: [10, 24, 10]});
ipsTable.setData({headers: ['PID', 'IP', 'No Reqs'], data: []});


var workersCPU = grid.set(8, 6, 4, 2, contrib.bar,
  { label: 'Workers CPU (%)'
  , barWidth: 4
  , barSpacing: 6
  , xOffset: 2
  , maxHeight: 100})
//set dummy data on bar chart
function fillWorkersCPU() {
  var arr = [];
  var pids = [];

  workers.forEach(function(value,key){
    if(value.isLive){
      pids.push(key+'');
      pusage.stat(key, function(err, stat) {
        //arr.push(10);
        //console.log('pid=',key,stat);
        if(stat){
          arr.push(Math.round(stat.cpu*10))
          //value.logToScreen.log(' cpu = ' + stat.cpu + ' memory = ' + stat.memory);
          if(pids.length == arr.length){
            workersCPU.setData({titles:pids, data: arr})
          }
        }
      });
    }
  },workers);
}
fillWorkersCPU()
setInterval(fillWorkersCPU, 1000)


screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()
////////////////////////////////////////////GUI/////////////////////////////////////////////
server.listen(6500,function(){
  //console.log('Monitor server is running...');
});
io = io.listen(server);

setInterval(function(){

  workers.forEach(function(value,key){
    var warning = false;
    //console.log(('----------------- processid = ' + key + ' has lastID = ' + value.lastId + ' -----------------' ).green);

    screen.render();
    value.data.forEach(function(value2,key2){
      if(value.lastId <= key2){
          var diedWorker = diedWorkerMap.get(key+':'+value.lastId);
          if(diedWorker){
              if(!diedWorker.isKill){
                diedWorker.count++;
                var outputDiedWorker = 'pid=' + key +
                ' ip=' + value2.ip +
                ' lastID=' + value.lastId +
                ' <= resid = ' + key2 +
                ' count = ' + diedWorker.count +
                ' url = ' + value2.url +
                ' userName = ' + value2.userName +
                ' companyName = ' + value2.companyName;

                //console.log(outputDiedWorker.red);
                value.diedRequestLogToScreen.log(outputDiedWorker);
                logger.error(outputDiedWorker);
                logger.info(outputDiedWorker);
                screen.render();
                if(diedWorker.count > 5){

                    if(isRunning(key) && !diedWorker.isKill){
                      //console.log(('Sending an email and kill pid = ' + key).red);
                      value.diedRequestLogToScreen.log('Sending an email and kill pid = ' + key);
                      logger.error('Sending an email and kill pid = ' + key);
                      logger.info('Sending an email and kill pid = ' + key);
                      screen.render();
                      diedWorker.isKill = true;
                      justKilledPid = key;//store the killed pid
                      justKilledLastId = value.lastId;
                      value.isLive = false;//set false as we will kill this worker
                      mailServer.send({
                        text: outputDiedWorker,
                        from: 'NodeJS',
                        to: 'phuong_thql@yahoo.com',
                        cc: '',
                        subject: 'processid: ' + key + ' has died'
                      }, function (err, message) {
                        //value.diedRequestLogToScreen.log(err || message);
                      });

                      process.kill(key)

                    }
                }
              }
          }else{
              diedWorkerMap.set(key+':'+value.lastId,{pid:key,ip: value2.ip, lastId:value.lastId, url: value2.url, count:1,isKill:false});
          }
      }

      if(value2.url.indexOf('css') > 0 ||value2.url.indexOf('html') > 0 ||value2.url.indexOf('js') > 0 ||value2.url.indexOf('png') > 0){

      }else{
        if(value.lastId - 20 <= key2 ){
          //console.log(key+" : "+ key2 + " lastId = " + value.lastId + " url = " + value2.url);
          //value.diedRequestLogToScreen.log(key+" : "+ key2 + " lastId = " + value.lastId + " url = " + value2.url);
          //screen.render();
        }
      }
    },value.data);
  },workers);

},10000);

setInterval(function(){
  //console.log('>>>>>>>>>>>>checking Map<<<<<<<<<<<<');
  var data = []

  workers.forEach(function(value,key){
    //value.logToScreen.log(' * PID = ' + key);
    //console.log(' * PID = ',key);
    data.push(['----',''+key+' = '+value.lastId,'----'])
    value.ips.forEach(function(value2,key2){
      data.push([''+key,''+key2,''+value2.requestCount])
      //value.logToScreen.log('    - IP = ' + key2 + ' requestCount = ' + value2.requestCount);
      //console.log('    - IP = ',key2,' requestCount = ',value2.requestCount);
        /*
        value2.requests.forEach(function(value3,key3){
          console.log('         + url = ',value3.url);
        },value2.requests);
        */
    },value.ips);
  },workers);
  ipsTable.setData({headers: ['PID', 'IP', 'No Reqs'], data: data})
  screen.render();
},10000);

// Add a connect listener
var numberOfWorker = 0;
io.sockets.on('connection', function(socket)
{

  socket.on('clientInfor',function(msg){
    /*
    process.on('exit', function() {
        clearInterval(interval)
    })
    */
    if(!workers.get(msg.pid) && !msg.isMaster){
      var workerNo = numberOfWorker;
      var justDiedWorkerValue;
      //turn off log display of killed pid, and replace the new workerNo of pid by old one
      if(justKilledPid > 0){
          var killedPid = workers.get(justKilledPid);
          workerNo = killedPid.workerNo;
          killedPid.logToScreen = null;
          killedPid.diedRequestLogToScreen = null;
          justDiedWorkerValue = diedWorkerMap.get(justKilledPid+':'+justKilledLastId)
          logger.error('pid= ' + msg.pid + ' was started... to replace pid= ' + justKilledPid);
      }

      //IF there is no worker in the hash so create one
      var logToScreen = grid.set(workerNo*3, 0, 3, 6, contrib.log,
          { fg: "green"
          , selectedFg: "green"
          , label: 'Worker: '+msg.pid+''})
      var diedRequestLogToScreen = grid.set(workerNo*2, 6, 2, 6, contrib.log,
          { fg: "red"
          , selectedFg: "red"
          , label: 'Died Request: '+msg.pid+''})
      if(justDiedWorkerValue){
        diedRequestLogToScreen.log(justDiedWorkerValue.pid + ' ' +justDiedWorkerValue.ip + ' ' + justDiedWorkerValue.url);
      }
      screen.render();
      workers.set(msg.pid,{workerNo:workerNo,prevPid:justKilledPid,isLive:true,lastId:null,data:new Map(),ips:new Map(),logToScreen:logToScreen,diedRequestLogToScreen:diedRequestLogToScreen});
      logger.info('pid= ' + msg.pid + ' was started...');

      numberOfWorker++;
      workersData.push([msg.pid,'Live']);
      workersTable.setData({headers: ['PID', 'Status'], data: workersData})
      screen.render();
    }
  });



  socket.on('requestStart',function(msg){
    //logging the client information: IP, PID, userName, companyName, time
    if(msg.userName){
        var clientInforElement = clientInforMap.get(msg.proId+':'+msg.ip+':'+msg.userName);
        if(!clientInforElement){
          clientInforMap.set(msg.proId+':'+msg.ip+':'+msg.userName,{pid:msg.pid, ip:msg.ip, userName:msg.userName, companyName:msg.companyName});
          logger.clientInfor('pid:'+msg.proId+' ,ip:' + msg.ip +', userName:'+ msg.userName+', companyName:'+msg.companyName);
        }
    }

    //console.log('msg = ',msg);
    //get value of the worker in the map
    //if there is the worker, so update the worker information
    //if there is no worker, create one
    var w = workers.get(msg.proId);
    if(w){
      w.lastId = msg.requestId;
      w.data.set(msg.requestId,msg);
      var ipMap = w.ips.get(msg.ip);
      if(!ipMap){
        var requestMap = new Map();// to store all requests being belong to the particular IP address
        requestMap.set(msg.requestId,msg);
        w.ips.set(msg.ip,{ip:msg.ip, requestCount: 1,requests: requestMap});
      }else{
        ipMap.requestCount++;
        ipMap.requests.set(msg.requestId,msg);
      }
      //console.log(' w = ',w);
    }else{
      var dataMap = new Map();
      dataMap.set(msg.requestId,msg);
      var requestMap = new Map();// to store all requests being belong to the particular IP address
      requestMap.set(msg.requestId,msg);
      var ipMap = new Map();
      ipMap.set(msg.ip,{ip:msg.ip, requestCount: 1,requests: requestMap});
      workers.set(msg.pid,{lastId:msg.requestId,data:dataMap,ips: ipMap});
    }
  });

  socket.on('requestEnd',function(msg){
    var w = workers.get(msg.proId);
    if(w){
      w.data.delete(msg.requestId);
      logger.info('pid: ' + msg.proId + ' ip: ' + msg.ip + ' id: ' + msg.requestId + ' time: ' + msg.duration + ' url: ' + msg.url + ' userName : ' + msg.userName + ' companyName: ' + msg.companyName);

      w.logToScreen.log('ip: ' + msg.ip + ' id: ' + msg.requestId + ' time: ' + msg.duration + ' url: ' + msg.url);
      screen.render()
    }
    //logAll.log('ip: ' + msg.ip + ' pid: ' + msg.proId + ' id: ' + msg.requestId + ' time: ' + msg.duration + ' url: ' + msg.url);

    //console.log('ip: ',msg.ip,' proId : ',msg.proId,' reqId: ',msg.requestId,' duration: ',msg.duration,' url: ',msg.url,'');
  });

/*
  socket.on('webAskForInitialData',()=>{
      //react connect to the monitor server and ask for the initial data
      //server will emit the whole data to the web
      console.log('Receve message from web.....ss');
      var workersArray = [];
      workers.forEach((worker,key)=>{
        workersArray.push(worker);
      },workers);
      socket.emit('initialDataForWeb',workersArray);
  });
*/
  // Disconnect listener
  socket.on('disconnect', function() {
    //console.log('Client disconnected.');
  });
});
