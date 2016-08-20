const spawn = require('child_process').spawn;
const http = require('http');


function mockServer(host, port) {
  var path, response, cb;
  var server = http.createServer( (req, res) => {
console.log('request received '+req.url);
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
      return { and: (cb) => { console.log('listening'); server.listen(port, host, cb); return server } }
    },
  };
};
var thenRespond = (c, b) => ({ code: c, body: b });

var stop = function () {
  var args = [].slice.call(arguments, 0);
  return function() {
    console.log('closing');
    spawn('nginx/nginx', ['-c', 'nginx.conf', '-s', 'stop']);
    args.map((server) => server.close());
  };
};

function startNginx () {
  return spawn('nginx/nginx', ['-c', 'nginx.conf']);
};
function request(url) {
console.log('request');
  var req = {};
  http.get(url, (res) => {
    var body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
console.log('reqdone');
      req.callback(res.statusCode, body);
    });
  }).on('error', (e) => {
console.log('reqerr: '+e);
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
    then: (cb) => { console.log('then');req.callback = (code, body) => {
console.log('testing');
      assert(expected.code, code, 'code');
      assert(expected.body, body, 'body');
      cb();
    }; },
  };
  return result;
};
var is = (x) => x;


function proxiesHomepageToLocalhost () {
  var server = mockServer('127.0.0.1', 8080).on("/", thenRespond(200, "homepage")).and(()=>{
console.log('in test');
    startNginx("live");
    expect(request("http://localhost:80/")).code(is(200)).body(is("homepage")).then(stop(server));
  });
};

/*
function proxiesClassifiedsToMarketplaceWeb () {
  mockDns().on("beta.marketplace.thehutgroup.local", goto("127.0.0.2"));
  mockServer("127.0.0.2", 8080).on("/classifieds/pets/cats/all/uk", thenRespond(200, "classifieds"));
  startNginx("live");
  expect(nginxRequest("/classifieds/pets/cats/all/uk")).code(is(200)).body(is("classifieds"));
  nginx.kill();
};
*/

proxiesHomepageToLocalhost();
