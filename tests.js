const spawn = require('child_process').spawn;
const http = require('http');
const url = require('url');

var dbg = ()=>0;
//var dbg = console.log;


function mockServer(host, port) {
  var path, response, cb;
  var server = http.createServer( (req, res) => {
    dbg('request received '+req.url);
    if (req.url === path) {
      res.writeHead(response.code, {'Content-Type': 'text/plain'});
      res.end(response.body);
    } else {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end();
    }
  });
  return {
    on: function (p, r) {
      path = p;
      response = r;
      return { and: (cb) => { dbg('listening'); server.listen(port, host, cb); return server } }
    },
  };
};
var thenRespond = (c, b) => ({ code: c, body: b });


var stop = function () {
  var args = [].slice.call(arguments, 0);
  return function() {
    dbg('closing');
    spawn('nginx/nginx', ['-c', 'nginx.conf', '-s', 'stop']);
    args.map((server) => server.close());
  };
};
function startNginx () {
  var nginx = spawn('nginx/nginx', ['-c', 'nginx.conf']);
  nginx.stderr.on('data', (d) => console.log(''+d));
  return nginx;
};


function request(reqUrl) {
  dbg('request');
  var req = {};
  var options = url.parse(reqUrl);
  http.get(options, (res) => {
    var body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      dbg('reqdone');
      req.callback(res.statusCode, body, res.headers.location);
    });
  }).on('error', (e) => {
    dbg('reqerr: '+e);
    req.callback(1000, e);
  });
  return req;
};


var assert = (expected, actual, msg) => {
  if (expected !== actual) {
    console.log('TEST FAILED!');
    console.log('  expected '+msg+' to be: '+expected);
    console.log('  but was: '+actual);
  }
};
function expect (req) {
  var expected = {};
  var result = {
    code: (c) => { expected.code = c; return result; },
    body: (b) => { expected.body = b; return result; },
    link: (l) => { expected.link = l; return result; },
    then: (cb, done) => {
      req.callback = (code, body, link) => {
        dbg('checking');
        if (expected.code) { assert(expected.code, code, 'code'); }
        if (expected.body) { assert(expected.body, body, 'body'); }
        if (expected.link) { assert(expected.link, link, 'link'); }
        cb();
        if (done) { done(); }
      };
    },
  };
  return result;
};
var is = (x) => x;


var tests = [];

tests.push({name: 'proxiesGoog', test: function (done) {
  var server = mockServer('127.0.0.2', 80).on("/goog", thenRespond(200, "google")).and(()=>{
    startNginx();
    expect(request("http://127.0.0.1/goog")).code(is(200)).body(is("google")).then(stop(server), done);
  });
}});

tests.push({name: 'nonExistantPageIs404', test: function (done) {
  startNginx();
  expect(request("http://127.0.0.1:80/not-here")).code(is(404)).then(stop(), done);
}});

tests.push({name: 'rewriteFoobarToFace', test: function (done) {
  startNginx();
  expect(request("http://127.0.0.1/foobar")).code(is(301)).link(is("http://127.0.0.1/face")).then(stop(), done);
}});

tests.push({name: 'rewriteFoobarToFacePreservesQuery', test: function (done) {
  startNginx();
  expect(request("http://127.0.0.1/foobar?doo=dah")).code(is(301)).link(is("http://127.0.0.1/face?doo=dah")).then(stop(), done);
}});

tests.push({name: 'proxiesFaceToOtherHost', test: function (done) {
  var server = mockServer('127.0.0.3', 80).on("/face/doodah", thenRespond(200, "facebook")).and(()=>{
    startNginx();
    expect(request("http://127.0.0.1/face/doodah")).code(is(200)).body(is("facebook")).then(stop(server), done);
  });
}});

tests.push({name: 'proxiesFaceToOtherHostsRoundRobin', test: function (done) {
  var server1 = mockServer('127.0.0.3', 80).on("/face/doodah", thenRespond(200, "facebook1")).and(()=>{
    var server2 = mockServer('127.0.0.4', 80).on("/face/doodah", thenRespond(200, "facebook2")).and(()=>{
      startNginx();
      expect(request("http://127.0.0.1/face/doodah")).code(is(200)).body(is("facebook1")).then(() => {
        expect(request("http://127.0.0.1/face/doodah")).code(is(200)).body(is("facebook2")).then(stop(server1, server2), done);
      });
    });
  });
}});

function runTest(idx) {
  if (tests[idx]) {
    console.log('TEST '+tests[idx].name);
    tests[idx].test(() => setTimeout(() => runTest(idx+1), 500) );
  }
};
runTest(0);
