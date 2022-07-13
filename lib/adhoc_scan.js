let poller = require('./poll');
let credentials = require('../credentials');
let sshlib = require('./ssh');
let fs = require('fs');
var credentialcache;

var getCredentials = function(callback) {
    if(credentialcache) {
        callback(false, credentialcache);
    } else {
        fs.stat('./cache/credentialcache.js', function (err, data) {
            if (err) {
                //console.log('no cached credentials');
                credentialcache = {};
            } else {
                //credentialcache = JSON.parse(data.toString());
                credentialcache = require('../cache/credentialcache');
            } 
            callback(false, credentialcache);
        });
    }
}

let writeCache = function(timeronly) {
    console.log("writing cache");
    fs.writeFile('../cache/credentialcache.js', "module.exports = " + JSON.stringify(credentialcache, null, 4), function (err) {
        //console.log(credentialcachetimer);
    });
}

module.exports = function() {
    this.scan = function(params, callback) {
        //console.log(params);
        getCredentials(function(err, credcache) {
            let ssh = new sshlib();
            //ssh.connect({host: params.host, port: 22, credentials: credentials, credentialcache: {}}, function(ssherr, ssh) {
            ssh.connect({host: params.host, port: 22, credentials: credentials, credentialcache: credcache}, function(ssherr, ssh) {
                if(ssherr) {
                    //console.log(err);
                } else {
                    credcache[params.host] = {
                        ssh: ssh.credentialindex
                    }
                    //callback(false, credcache);
                    //console.log(resp);
                }
                let poll = new poller();
                poll.createSession({host: params.host, credentials: credentials, credentialcache: credcache}, function(snmperr, snmpresult) {
                    let snmp;
                    if(snmperr) {
                        //callback(err, false);
                        snmp = {
                            error: snmperr
                        }
                    } else {
                        //callback(false, ssh)
                        snmp = {
                            error: false,
                            hostname: poll.getHostname(),
                            version: credentials.snmp[snmpresult].version
                        }
                        credcache[params.host] = {
                            ssh: ssh.credentialindex
                        }
                        poll.closeSession(function() {
                            //session closed
                        });
                    }
                    if(ssherr==false || snmperr==false) {
                        writeCache();
                    }
                    callback(err, {
                        ssh: ssh,
                        snmp: snmp
                    });
                });
            })
        });
    }
}