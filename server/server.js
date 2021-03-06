var loopback = require('loopback');
var boot = require('loopback-boot');


var app = module.exports = loopback();

///// Phuong added this code Begin/////
var moment = require('moment');
var cluster = require('cluster');
var fs = require('fs'); //**fs: Handle file system**
var http = require('http');
var https = require('https');
var HashMap = require('hashmap');
var userHashMap = new HashMap();//to store all user
var companyHashMap = new HashMap();//to store all company of user
var ipHashMap = new HashMap();
app.companyHashMap = companyHashMap;
//==========Start configuring for server===============
var port = 8181,
    num_processes = require('os').cpus().length;
var bodyParser = require('body-parser');
var logger = require("./logger");
app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({limit: '100mb', extended: true}));


// Set up  and config logger using Morgan tolog to files
var FileStreamRotator = require('file-stream-rotator')
var fs = require('fs')
//logger
var morgan = require('morgan')


var logDirectory = __dirname + '/log'
// ensure log directory exists
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory)
// create a rotating write stream
var accessLogStream = FileStreamRotator.getStream({filename: logDirectory + '/access-%DATE%.log', frequency:"daily", verbose: false, date_format: "YYYY-MM-DD"});


// setup the logger
app.use(morgan('combined', {stream: accessLogStream}))

app.use(loopback.context());
app.use(loopback.token());

///////Begin to connect to the monitor server ////////
// Connect to server
var reqId = 0;
var serverName = 'pemapiserver';
var io = require('socket.io-client');
var socket = io.connect('http://localhost:6500', {reconnect: true});
// Add a connect listener
socket.on('connect', function() {
  console.log(process.pid + 'Connected to monitor server !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  socket.emit('clientInfor',{isMaster:cluster.isMaster, pid: process.pid});
});


app.use(function(req,res,next){
  reqId++;
  var companyId,companyName,userId,userName;
  var start = Date.now();

  if (req.accessToken) {
      /// caching user and company object .If in the hash, get in the hash
      var currUser = userHashMap.get(req.accessToken.id);
      if(currUser){
        //console.log('&&&&&&&&&',currUser);
        userId = currUser.id;
        userName = currUser.username;
      }

      var currCompany = companyHashMap.get(req.accessToken.id);
      //console.log(' ->>>>>>>>>>>>>>>>>>>>>>>>>>>currCompany = ',currCompany);
      if(currCompany){
        //console.log('&&&&&&&&&&',currCompany);
        companyId = currCompany.companyId;
        companyName = currCompany.companyName;
      }
  }


  logger.log('info',"********* 1. Send to monitor server url  " + process.pid + "  remoteAddress = " + req.connection.remoteAddress + " url = " + req.url);
  socket.emit('requestStart',{
                                serverName: serverName,
                                proId: process.pid,
                                requestId: reqId,
                                url: req.url,
                                reqBody: JSON.stringify(req.body),
                                startTime: start,
                                ip: req.connection.remoteAddress,
                                userId: userId,
                                userName: userName,
                                companyId: companyId,
                                companyName: companyName
                              });

  res.on('finish',function(){

    var end = Date.now();
    socket.emit('requestEnd',{
                                serverName: serverName,
                                proId: process.pid,
                                requestId: reqId,
                                url: req.url,
                                reqBody: JSON.stringify(req.body),
                                startTime: start,
                                endTime: end,
                                duration: (end - start),
                                ip: req.connection.remoteAddress,
                                userId: userId,
                                userName: userName,
                                companyId: companyId,
                                companyName: companyName
                              });
    logger.log('info',"=====> Req at proId =  " + process.pid + " url = " + req.url + " duration = " + (end - start));
  })
  next();

});
///////End to connect to the monitor server ////////

//app.use(hostAuthorization);
//app.use(logResponseBody);

app.use('/CreatePosition-ViewController-context-root*',function(req,res,next){
    console.log('request with /CreatePosition-ViewController-context-root*....');
    res.redirect('/');
});


app.use(function setCurrentUser(req, res, next) {
    logger.log('info',"********* 2.1. Req at proId =  " + process.pid + " url = " + req.url + "  accessToken = " + req.accessToken);
    if (!req.accessToken) {
        var loopbackContext = loopback.getCurrentContext();
        loopbackContext.set('companyId', -1);
        logger.log('info',"********* 2.2. Req without accessToken at proId =  " + process.pid + " url = " + req.url);
        return next();
    }
    else{
        /// caching user and company object .If in the hash, get in the hash

        var currUser = userHashMap.get(req.accessToken.id);

        if(currUser){
            logger.log('info',"********* 3. Req with accessToken and caching user at proId =  " + process.pid + " url = " + req.url + " currUser = ",currUser);
            //console.log(">>>>>>>Get from hash",currUser.password);
            var loopbackContext = loopback.getCurrentContext();
            loopbackContext.set('accessToken', req.accessToken);
            loopbackContext.set('originalCompanyId', currUser.originalCompanyId);
            loopbackContext.set('currentUser', currUser);
            var currCompany = companyHashMap.get(req.accessToken.id);
            //console.log(' ->>>>>>>>>>>>>>>>>>>>>>>>>>>currCompany = ',currCompany);
            if(currCompany){
                currUser.companyId = currCompany.id;
                loopbackContext.set('companyId', currCompany.id);
                loopbackContext.set('currentUser', currUser);
                loopbackContext.set('company', currCompany);
                //logger.log('info',req.connection.remoteAddress + "> Req at proId =  " + process.pid + " url = " + req.url + " userId = " + req.accessToken.userId + " companyId = " + currUser.companyId + " companyName="+currCompany.companyName);
                logger.log('info',"********* 4. Req with accessToken and caching user and caching company at proId =  " + process.pid + " url = " + req.url + " userId = " + req.accessToken.userId + " companyId = " + currUser.companyId + " companyName="+currCompany.companyName);
                next();
            }else{
                loopbackContext.set('companyId', currUser.companyId);
                app.models.Companies.findById(currUser.companyId,function(err,company){//{include:'subsidiaries'}
                    //console.log(' ->>>>>>>>>>>>>>>>>>>>>>>>>>>company = ',company);
                    if (err) {
                        return next(err);
                    }
                    companyHashMap.set(req.accessToken.id,company);
                    if(company){
                        logger.log('info',"********* 5. Req with accessToken and caching user and query company at proId =  " + process.pid + " url = " + req.url + " userId = " + req.accessToken.userId + " companyId = " + company.id + " companyName="+company.companyName);
                        //logger.log('info',"> Req at proId =  " + process.pid + " url = " + req.url + " userId = " + req.accessToken.userId + " companyId = " + company.id + " companyName="+company.companyName);
                    }else{
                        logger.log('info',"> Req at proId =  " + process.pid + " url = " + req.url + " userId = " + req.accessToken.userId);
                    }
                    loopbackContext.set('company', company);
                    next();
                });
            }

        }else{
            logger.log('info',"********* 6. Req with accessToken and will find userat proId =  " + process.pid + " url = " + req.url + " userId = " + req.accessToken.userId);
            app.models.Accounts.findById(req.accessToken.userId, function(err, user) {
                if (err) {
                    return next(err);
                }
                if (!user) {
                    return next(new Error('No user with this access token was found.'));
                }
                userHashMap.set(req.accessToken.id,user);
                //console.log("companyId = ",user);
                var loopbackContext = loopback.getCurrentContext();
                //console.log(loopbackContext);
                if (loopbackContext) {
                    user.originalCompanyId = user.companyId;
                    loopbackContext.set('originalCompanyId', user.originalCompanyId);
                    loopbackContext.set('companyId', user.companyId);
                    loopbackContext.set('currentUser', user);
                    loopbackContext.set('accessToken', req.accessToken);
                }
                app.models.Companies.findById(user.companyId,function(err,company){//,{include:'subsidiaries'}
                    //console.log(' ->>>>>>>>>>>>>>>>>>>>>>>>>>>company = ',company);
                    if (err) {
                        return next(err);
                    }
                    companyHashMap.set(req.accessToken.id,company);

                    if(company){
                        logger.log('info',"> Req at proId =  " + process.pid + " url = " + req.url + " userId = " + req.accessToken.userId + " companyId = " + company.id + " companyName="+company.companyName);
                    }else{
                        logger.log('info',"> Req at proId =  " + process.pid + " url = " + req.url + " userId = " + req.accessToken.userId);
                    }

                    loopbackContext.set('company', company);

                    next();
                });

            });
        }
    }
});

function hostAuthorization(req, res, next) {
    var hostName = req.headers.referer + " ";

    console.log(">Request comming : ",hostName,req.headers.referer);
    if(hostName.indexOf('medicalbookings.redimed.com.au:8000') >= 0 ||hostName.indexOf('medicalbookings.redimed.com.au:8001') >= 0){
        next();
    }else{
        res.status(401).send("Unauthorization Browser !");
    }
};



function logResponseBody(req, res, next) {
    //only log all api requests
    if(req.originalUrl.indexOf('/api/')>=0){
        var oldWrite = res.write,
            oldEnd = res.end;
        var start = new Date;
        var chunks = [];

        req.setTimeout(15000, function() {
            logger.log('debug',">> id =  " + process.pid + ' ,Method:' + req.method +  ' ,statusCode:' +  res.statusCode  + ' ,duration: timeout' + ' ,originalUrl:' + req.originalUrl + 'body: '+ JSON.stringify(req.body)) ;
            req.abort();
        });

        res.on('error', function(err){
            logger.log('debug',">> id =  " + process.pid + ' ,Method:' + req.method +  ' ,statusCode:' +  res.statusCode  + ' ,duration: Error' + ' ,originalUrl:' + req.originalUrl + 'body: '+ JSON.stringify(req.body)) + ' error = ' + err ;
        });

        res.end = function (chunk) {
            var duration = new Date - start;
            logger.log('debug',">> id =  " + process.pid + ' ,Method:' + req.method +  ' ,statusCode:' +  res.statusCode  + ' ,duration:' +  duration + 'ms' + ' ,originalUrl:' + req.originalUrl + 'body: '+ JSON.stringify(req.body)) ;

            oldEnd.apply(res, arguments);
        };
    }
    next();
}

///// Phuong added this code End/////

app.httpStart = function() {
  // start the web server
  var server = app.listen(function() {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
  ///socket.io
  // Here you might use middleware, attach routes, etc.
  var io = sio(server);

  // Tell Socket.IO to use the redis adapter. By default, the redis
  // server is assumed to be on localhost:6379. You don't have to
  // specify them explicitly unless you want to change them.
  io.adapter(sio_redis({ host: 'localhost', port: 6379 }));

  // Listen to messages sent from the master. Ignore everything else.
  process.on('message', function(message, connection) {
      ipAddress = connection.remoteAddress;
      workerIndex = message.substr(message.indexOf('indexWorker=')+12);
      console.log(' ----> ',message,'ipAddress=',ipAddress,' workerIndex=',workerIndex);
      if (message.indexOf('sticky-session:connection')==-1) {
          return;
      }

      // Emulate a connection event on the server by emitting the
      // event with the connection the master sent us.
      server.emit('connection', connection);
      connection.resume();
  });
  io.on('connection', function(socket) {
      // Use socket to communicate with this particular client only, sending it it's own id
      console.log("User connected to the server socket.id = ",socket.id,' ipAddress =',ipAddress,' workerIndex = ',workerIndex);

      var socketObject = {
        id: 0,
        socketId: socket.id,
        userName: "",
        companyId: null,
        companyName: null,
        pid: process.pid,
        ip: ipAddress,
        worker:  workerIndex,
        onlineAt: moment().format('YYYY-MM-DD HH:mm:ss')
      };

      //console.log("will insert socketId into DB",socketObject);
      app.models.OnlineUsers.create(socketObject,function(err,data){
        //console.log("Inserted the socketId into DB",err,data);
        sendOnlineUserDataToAdmin();
      });

      socket.emit('welcome', { message: 'Welcome!', id: socket.id });
      socket.on('login', function(data) {
          console.log('login',process.pid , data);
          app.models.OnlineUsers.update({socketId: socket.id},{
                                                                userId: data.userId,
                                                                userName: data.userName,
                                                                companyId: data.companyId,
                                                                companyName: data.companyName,
                                                                worker:  workerIndex,
                                                                loginAt: moment().format('YYYY-MM-DD HH:mm:ss')
                                                              },function(err,data){
            //console.log("Inserted the socketId into DB",err,data);
            sendOnlineUserDataToAdmin();
          });
      });

      socket.on('logout', function(){
          console.log('user logout socket.id = ',socket.id );
          app.models.OnlineUsers.update({socketId: socket.id},{logoutAt: moment().format('YYYY-MM-DD HH:mm:ss') },function(err,data){
            console.log("Updated the socketId into DB",err,data);
            sendOnlineUserDataToAdmin();
          });
      });

      socket.on('HoldAppt',function(newValue){
        console.log('---> client occupied the new appt = ',newValue, ' oldValue = ' );
        //app.models.Companies.setHoldings(newValue,oldValue);
        //socket.broadcast.emit('UpdateCalendar',data);
      });

      socket.on('OccupyAppt',function(newValue,oldValue){
        console.log('---> client occupied the appt = ',newValue,' oldValue =',oldValue);
        //socket.broadcast.emit('UpdateCalendar',data);
      });

      socket.on('GetOnlineUsers',function(){
        console.log('GetOnlineUsers request');
        sendOnlineUserDataToAdmin();
      });
      socket.on('disconnect', function(){
          console.log('user disconnected socket.id = ',socket.id );
          app.models.OnlineUsers.update({socketId: socket.id},{offlineAt: moment().format('YYYY-MM-DD HH:mm:ss') },function(err,data){
            console.log("Updated the socketId into DB",err,data);
            sendOnlineUserDataToAdmin();
          });
      });
      var sendOnlineUserDataToAdmin = function(){
          app.models.OnlineUsers.find({order:'onlineAt DESC',limit: 100},function(err,data){
            console.log("List socketId from DB",err);
            io.emit('OnlineUsersData',data);
          });

      };
  });
  return server;
};


var express = require('express'),
    net = require('net'),
    sio = require('socket.io'),
    sio_redis = require('socket.io-redis');
//var ClusterStore = require('strong-cluster-socket.io-store')(sio);

app.httpsStart = function() {
    // start the web server
    var ssl_options = {
        pfx: fs.readFileSync('key/wildcard_redimed_com_au.pfx'),
        passphrase: '1234'
    }; //**SSL file and passphrase use for server
    var ipAddress = "";
    var workerIndex = null;
    var server = https.createServer(ssl_options, app);
    server.listen( 0 , function() {
        var baseUrl = 'https://' + app.get('host') + ':' + app.get('port');
        app.emit('started', baseUrl);
        console.log('LoopBack server listening @ '+baseUrl+'/ processid='+process.pid);

        if (app.get('loopback-component-explorer')) {
            var explorerPath = app.get('loopback-component-explorer').mountPath;

            console.log('Browse your REST API at ' + baseUrl + explorerPath);
        }
    });

    ///socket.io
    // Here you might use middleware, attach routes, etc.
    var io = sio(server);

    // Tell Socket.IO to use the redis adapter. By default, the redis
    // server is assumed to be on localhost:6379. You don't have to
    // specify them explicitly unless you want to change them.
    io.adapter(sio_redis({ host: 'localhost', port: 6379 }));

    // Listen to messages sent from the master. Ignore everything else.
    process.on('message', function(message, connection) {
        ipAddress = connection.remoteAddress;
        workerIndex = message.substr(message.indexOf('indexWorker=')+12);
        console.log(' ----> ',message,'ipAddress=',ipAddress,' workerIndex=',workerIndex);
        if (message.indexOf('sticky-session:connection')==-1) {
            return;
        }

        // Emulate a connection event on the server by emitting the
        // event with the connection the master sent us.
        server.emit('connection', connection);
        connection.resume();
    });

    //clear all holdings when startup the server
    app.models.Companies.clearAllHoldingsWhenStartup();

    io.on('connection', function(socket) {
        // Use socket to communicate with this particular client only, sending it it's own id
        console.log("User connected to the server socket.id = ",socket.id,' ipAddress =',ipAddress,' workerIndex = ',workerIndex);

        var socketObject = {
          id: 0,
          socketId: socket.id,
          userName: "",
          companyId: null,
          companyName: null,
          pid: process.pid,
          ip: ipAddress,
          worker:  workerIndex,
          onlineAt: moment().format('YYYY-MM-DD HH:mm:ss')
        };

        //console.log("will insert socketId into DB",socketObject);
        app.models.OnlineUsers.create(socketObject,function(err,data){
          //console.log("Inserted the socketId into DB",err,data);
          sendOnlineUserDataToAdmin();
        });

        socket.emit('welcome', { message: 'Welcome!', id: socket.id });
        socket.on('login', function(data) {
            console.log('login',process.pid , data);
            app.models.OnlineUsers.update({socketId: socket.id},{
                                                                  userId: data.userId,
                                                                  userName: data.userName,
                                                                  companyId: data.companyId,
                                                                  companyName: data.companyName,
                                                                  worker:  workerIndex,
                                                                  loginAt: moment().format('YYYY-MM-DD HH:mm:ss')
                                                                },function(err,data){
              //console.log("Inserted the socketId into DB",err,data);
              sendOnlineUserDataToAdmin();
            });
        });
        socket.on('logout', function(){
            console.log('user logout socket.id = ',socket.id );
            app.models.OnlineUsers.update({socketId: socket.id},{logoutAt: moment().format('YYYY-MM-DD HH:mm:ss') },function(err,data){
              console.log("Updated the socketId into DB",err,data);
              sendOnlineUserDataToAdmin();
            });
        });

        socket.on('OccupyAppt',function(newValue,oldValue,candidateTempId){
          //console.log('---> client occupied the newValue = ',newValue,'  oldValue = ',oldValue);
          socket.broadcast.emit('UpdateCalendar',newValue,oldValue);
          app.models.Companies.setHoldings(socket.id,newValue,oldValue,()=>{

          },candidateTempId);
        });

        socket.on('GetOnlineUsers',function(){
          console.log('GetOnlineUsers request');
          sendOnlineUserDataToAdmin();
        });
        socket.on('disconnect', function(){
            console.log('user disconnected socket.id = ',socket.id );
            ///clear all holdings of the disconnected clients
            app.models.Companies.clearHoldings(socket.id,()=>{
                socket.broadcast.emit('UpdateCalendar');
            });
            app.models.OnlineUsers.update({socketId: socket.id},{offlineAt: moment().format('YYYY-MM-DD HH:mm:ss') },function(err,data){
              console.log("Updated the socketId into DB",err,data);
              sendOnlineUserDataToAdmin();
            });
        });
        var sendOnlineUserDataToAdmin = function(){
            app.models.OnlineUsers.find({order:'onlineAt DESC',limit: 100},function(err,data){
              console.log("List socketId from DB",err);
              io.emit('OnlineUsersData',data);
            });

        };
    });
    return server;
};


if (cluster.isMaster) {
    // This stores our workers. We need to keep them to be able to reference
    // them based on source IP address. It's also useful for auto-restart,
    // for example.
    var workers = [];
    var currentWorker = 0;
    var pingWorkerIndex = 0;
    // Helper function for spawning worker at index 'i'.
    var spawn = function(i) {
        workers[i] = cluster.fork();

        // Optional: Restart worker on exit
        workers[i].on('exit', function(worker, code, signal) {
            console.log('respawning worker', i);
            spawn(i);
        });
    };

    // Spawn workers.
    for (var i = 0; i < num_processes; i++) {
        spawn(i);
    }

    // Helper function for getting a worker index based on IP address.
    // This is a hot path so it should be really fast. The way it works
    // is by converting the IP address to a number by removing the dots,
    // then compressing it to the number of slots we have.
    //
    // Compared against "real" hashing (from the sticky-session code) and
    // "real" IP number conversion, this function is on par in terms of
    // worker index distribution only much faster.

    var worker_index = function(ip, len) {
        var s = '';
        for (var i = 0, _len = ip.length; i < _len; i++) {
            if (ip[i] !== '.' && ip[i] !== ':' && ip[i] !== 'f') {
                s += ip[i];
            }
        }
        var number = Number(s);
        if(number){
            return Number(s) % len;
        }else{
            return 1;
        }
    };

    // Create the outside facing server listening on our port.
    var server = net.createServer({ pauseOnConnect: true }, function(connection) {
        var ipAddress = connection.remoteAddress;
        // We received a connection and need to pass it to the appropriate
        // worker. Get the worker for this connection's source IP and pass
        // it the connection.
        //var indexW = worker_index(connection.remoteAddress, num_processes);
        //console.log('display hasmap');
        /*for(var i in ipHashMap) {
            if (ipHashMap.hasOwnProperty(i)) {
                console.log('Key is: ',i,'. Value is: ',ipHashMap[i]);
            }
        }*/
        var indexW = ipHashMap.get(ipAddress);
        //console.log('connection.remoteAddress = ',ipAddress,'indexW = ',indexW);
        if(indexW == undefined){
          indexW =  JSON.parse(JSON.stringify(currentWorker));
          //console.log('new ip in hash',ipAddress,'  -  ',indexW);
          ipHashMap.set(ipAddress,indexW);
          currentWorker++;
          //console.log('new ip in hash',ipAddress,'  -  ',indexW);
          if(currentWorker >= num_processes){
            currentWorker = 0;
          }
        }

        console.log("======================> connection coming.....",ipAddress,' worker_index = ',indexW);
        //var worker = workers[indexW];
        //worker.send('sticky-session:connection indexWorker=' + indexW, connection);

        if(ipAddress == '::ffff:192.168.40.11'){
            console.log("******************************************************Yes it is index = ",pingWorkerIndex)
            workers[pingWorkerIndex].send('sticky-session:connection indexWorker=' + indexW, connection);
            if(workers.length - 1 == pingWorkerIndex){
              pingWorkerIndex =0;
            }else{
              pingWorkerIndex++;
            }
        }else{
          var worker = workers[indexW];
          worker.send('sticky-session:connection indexWorker=' + indexW, connection);
        }


    }).listen(port,function(){
        console.log("Master process is running............... at port " + port);
    });
} else {

    boot(app, __dirname, function(err) {
        if (err) throw err;

        // start the server if `$ node server.js`
        if (require.main === module)
            app.httpsStart();
    });

}
