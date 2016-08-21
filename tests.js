const spawn = require('child_process').spawn;
const http = require('http');

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


function mockDns(host, port) {
  return {
    on: function (domain, host) {
      return { and: (cb) => { cb(); return {close:()=>0}; } }
    },
  };
};
var goto = (host) => host;


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


function request(url) {
  dbg('request');
  var req = {};
  http.get(url, (res) => {
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
        done();
      };
    },
  };
  return result;
};
var is = (x) => x;


var tests = [];

tests.push({name: 'proxiesHomepageToLocalhost', test: function (done) {
  var server = mockServer('127.0.0.1', 8080).on("/", thenRespond(200, "homepage")).and(()=>{
    startNginx();
    expect(request("http://127.0.0.1:80/")).code(is(200)).body(is("homepage")).then(stop(server), done);
  });
}});

tests.push({name: 'rewriteFoobarToThing', test: function (done) {
  startNginx();
  expect(request("http://127.0.0.1:80/foobar")).code(is(301)).link(is("http://127.0.0.1/thing")).then(stop(), done);
}});

tests.push({name: 'rewriteFoobarToThingPreservesQuery', test: function (done) {
  startNginx();
  expect(request("http://127.0.0.1:80/foobar?doo=dah")).code(is(301)).link(is("http://127.0.0.1/thing?doo=dah")).then(stop(), done);
}});

/*
tests.push({name: 'proxiesThingTo', test: function (done) {
  var dns = mockDns('127.0.0.2', 8080).on("beta.other.host", goto("127.0.0.2")).and(()=>{
    var server = mockServer('127.0.0.2', 8080).on("/thing/doodah", thenRespond(200, "thingpage")).and(()=>{
      startNginx();
      expect(request("http://127.0.0.1:80/thing/doodah")).code(is(200)).body(is("thingpage")).then(stop(server, dns), done);
    });
  });
}});
*/

function runTest(idx) {
  if (tests[idx]) {
    console.log('TEST '+tests[idx].name);
    tests[idx].test(() => runTest(idx+1) );
  }
};
runTest(0);
