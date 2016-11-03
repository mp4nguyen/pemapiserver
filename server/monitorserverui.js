var pusage = require('pidusage')

var http = require('http')

http.createServer(function(req, res) {
  res.writeHead(200)
  res.end("hello world\n")
}).listen(8020)

var interval = setInterval(function () {
  pusage.stat(21892, function(err, stat) {
    console.log(stat)
  })
}, 1000)

process.on('exit', function() {
    clearInterval(interval)
})
