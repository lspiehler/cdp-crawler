let poller = require('./lib/poll');
let credentials = require('./credentials');
let fs = require('fs');
var credentialcachetimer;
var writefrequency = 60000;

let enableWriteCacheTimer = function() {
    credentialcachetimer = setTimeout(function() {
        writeCache();
    }, writefrequency);
}

let disableWriteCacheTimer = function() {
    clearTimeout(credentialcachetimer);
    credentialcachetimer = null;
}

let writeCache = function(timeronly) {
    console.log("writing cache");
    fs.writeFile('./cache/credentialcache.js', "module.exports = " + JSON.stringify(credentialcache, null, 4), function (err) {
        //console.log(credentialcachetimer);
        if(credentialcachetimer) {
            clearTimeout(credentialcachetimer);
            credentialcachetimer = setTimeout(function() {
                writeCache();
            }, writefrequency);
        }
    });
}

var pollHost = function(host, callback) {
    fs.stat('./cache/credentialcache.js', function (err, data) {
        if (err) {
            //console.log('no cached credentials');
            credentialcache = {};
        } else {
            //credentialcache = JSON.parse(data.toString());
            credentialcache = require('./cache/credentialcache');
            let poll = new poller();
            poll.createSession({host: host, credentials: credentials, credentialcache: credentialcache}, function(err, resp) {
                if(err) {
                    callback(err, false);
                } else {
                    credentialcache[poll.getHostname().toUpperCase()] = resp;
                    credentialcache[host] = resp;
                    poll.getOID("1.3.6.1.2.1.1.6.0", function(err, syslocation) {
                        if(err) {
                            callback(err, false);
                        } else {
                            //console.log('location')
                            //console.log(syslocation.toString())
                            poll.getCDP(function(err, cdp) {
                                if(err) {
                                    callback(err, false);
                                } else {
                                    poll.getNetworks(function(err, networks) {
                                        if(err) {
                                            callback(err, false);
                                        } else {
                                            /*fs.writeFile('./cache/cdpcache.js', JSON.stringify(resp, null, 4), function (err) {
                                                //console.log(credentialcachetimer);
                                            });*/
                                            callback(false, {
                                                name: poll.getHostname().toUpperCase(),
                                                location: syslocation.toString(),
                                                neighbors: cdp,
                                                networks: networks
                                            });
                                        }
                                        poll.closeSession(function() {
                                            //session closed
                                        });
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}

pollHost('192.168.1.1', function(err, resp) {
    console.log(err);
    console.log(resp);
});