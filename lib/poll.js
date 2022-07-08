var snmp = require("net-snmp");
var fs = require("fs");
var common = require("./common");
var subnet = require("./subnet");
const { SocketAddress } = require("net");

var maxretry = 5;

module.exports = function() {
    var credentials;
    var hostname;
    var session;

    var initSession = function(snmpsession) {
        session = snmpsession;
        session.on('error', function(err) {
            console.log(err);
        });
    }
    
    var walkOID = function(oid, retry, snmpsession, callback) {
        let vbs = [];
        session.subtree(oid, 1, 
            function(varbinds) {
                //let oid = varbinds[0].oid.split('.');
                //let end = [];
                //console.log(varbinds.length);
                //console.log(varbinds);
                for(let i = 0; i < varbinds.length; i++) {
                    if(snmp.isVarbindError (varbinds[i])) {
                        if(retry >= maxretry) {
                            callback(snmp.varbindError (varbinds[i]), false);
                            return;
                        } else {
                            walkOID(oid, retry + 1, snmpsession, callback);
                            return;
                        }
                    } else {
                        //console.log(varbinds[i]);
                        vbs.push(varbinds[i]);
                    }
                    //end.push(oid.pop());
                    //end.push(oid.pop());
                }
            }, function(err) {
                if(err) {
                    callback(err, false);
                } else {
                    callback(false, vbs);
                }
            }
        );
    }
    
    var getOID = function(oid, retry, snmpsession, callback) {
        snmpsession.get([oid], function (err, varbinds) {
            if(err) {
                callback(err, false);
            } else {
                let responses = [];
                for (var i = 0; i < varbinds.length; i++) {
                    if(snmp.isVarbindError (varbinds[i])) {
                        if(retry >= maxretry) {
                            callback(snmp.varbindError (varbinds[i]), false);
                            return;
                        } else {
                            getOID(oid, retry + 1, snmpsession, callback);
                        }
                    } else {
                        responses.push(varbinds[i].value);
                    }
                }
                callback(false, responses);
            }
        });
    }
    
    var createSession = function(params, credindex, cacheenabled, callback) {
        if(!credindex) {
            credindex = 0;
        }
        //console.log(params.credentials[credindex]);
        //session.close()
        if(credindex < params.credentials.length) {
            let tempsession;
            let cached = false;
            if(params.credentialcache.hasOwnProperty(params.host) && cacheenabled) {
                cached = true;
                //console.log('attempting cached credentials');
                //console.log(params.credentials[params.credentialcache[params.host]]);
                if(params.credentials[params.credentialcache[params.host]].version == 2) {
                    tempsession = snmp.createSession(params.host, params.credentials[params.credentialcache[params.host]].community);
                } else if(params.credentials[params.credentialcache[params.host]].version == 3) {
                    tempsession = snmp.createV3Session(params.host, params.credentials[params.credentialcache[params.host]].user, params.credentials[params.credentialcache[params.host]].options);
                } else {
                    createSession(params, credindex, false, callback);
                }
            } else {
                //console.log(params.credentials[credindex]);
                if(params.credentials[credindex].version == 2) {
                    tempsession = snmp.createSession(params.host, params.credentials[credindex].community);
                } else if(params.credentials[credindex].version == 3) {
                    tempsession = snmp.createV3Session(params.host, params.credentials[credindex].user, params.credentials[credindex].options);
                } else {
                    callback('Unrecognized SNMP version (' + params.credentials[credindex].version + ") in credential index " + credindex);
                    return;
                }
            }
            let timeout = setTimeout(function() {
                tempsession.close();
            }, 10000);
            getOID("1.3.6.1.2.1.1.5.0", 0, tempsession, function(err, resp) {
                clearTimeout(timeout);
                if(err) {
                    if(cached) {
                        createSession(params, credindex, false, callback);
                    } else {
                        createSession(params, credindex + 1, false, callback);
                    }
                } else {
                    credentials = params.credentials[credindex];
                    hostname = resp[0].toString();
                    initSession(tempsession);
                    if(cached) {
                        callback(false, params.credentialcache[params.host]);
                    } else {
                        callback(false, credindex);
                    }
                    return;
                }
            });
        } else {
            callback('All SNMP credentials failed', -1);
        }
    }
    
    var getHostname = function() {
        if(session) {
            return hostname;
        } else {
            throw "No SNMP session"
        }
    }
    
    var closeSession = function(callback) {
        if(session) {
            //console.log(session);
            session.on('close', function(err) {
                callback();
            });
            session.close();
        } else {
            callback();
        }
    }

    var getNetworks = function(callback) {
        var oiddefs = {
            '1.3.6.1.2.1.4.20.1.1': 'ipAdEntAddr',
            '1.3.6.1.2.1.4.20.1.2': 'ipAdEntIfIndex',
            '1.3.6.1.2.1.4.20.1.3': 'ipAdEntNetMask',
            '1.3.6.1.2.1.4.20.1.4': 'ipAdEntBcastAddr',
            '1.3.6.1.2.1.4.20.1.5': 'ipAdEntReasmMaxSize'
        }
    
        walkOID('1.3.6.1.2.1.4.20.1', 0, session, function(err, resp) {
            if(err) {
                callback(err, false);
            } else {
                let nethtresp = {};
                for(let i = 0; i < resp.length; i++) {
                    let respoid = resp[i].oid.split(".")
                    let iparr = [];
                    for(let j = 0; j < 4; j++) {
                        iparr.push(respoid.pop())
                    }
                    let  ip = iparr.reverse().join('.');
                    //console.log(ip.join('.'));
    
                    //console.log(resp[i]);
                    let oid = respoid.join(".")
                    //console.log(id);
                    //console.log(index);
                    //console.log(resp[i]);
                    //console.log(oiddefs[oid]);
                    if(nethtresp.hasOwnProperty(ip)) {
                        nethtresp[ip][oiddefs[oid]] = resp[i].value;
                    } else {
                        nethtresp[ip] = {}
                        nethtresp[ip][oiddefs[oid]] = resp[i].value;
                    }
                }
                let netresp = [];
                let keys = Object.keys(nethtresp);
                for(let i = 0; i < keys.length; i++) {
                    netresp.push(subnet(nethtresp[keys[i]]));
                }
                callback(false, netresp);
            }
        });
    }

    var getCDP = function(callback) {
        var oiddefs = {
            '1.3.6.1.4.1.9.9.23.1.2.1.1.3': 'cdpCacheAddressType',
            '1.3.6.1.4.1.9.9.23.1.2.1.1.4': 'cdpCacheAddress',
            '1.3.6.1.4.1.9.9.23.1.2.1.1.5': 'cdpCacheVersion',
            '1.3.6.1.4.1.9.9.23.1.2.1.1.6': 'cdpCacheDeviceId',
            '1.3.6.1.4.1.9.9.23.1.2.1.1.7': 'cdpCacheDevicePort',
            '1.3.6.1.4.1.9.9.23.1.2.1.1.8': 'cdpCachePlatform',
            '1.3.6.1.4.1.9.9.23.1.2.1.1.9': 'cdpCacheCapabilities',
            '1.3.6.1.4.1.9.9.23.1.2.1.1.10': 'cdpCacheVTPMgmtDomain',
            '1.3.6.1.4.1.9.9.23.1.2.1.1.11': 'cdpCacheNativeVLAN',
            '1.3.6.1.4.1.9.9.23.1.2.1.1.12': 'cdpCacheDuplex',
            '1.3.6.1.4.1.9.9.23.1.2.1.1.24': 'cdpCacheLastChange'
        }
    
        walkOID('1.3.6.1.4.1.9.9.23.1.2.1.1', 0, session, function(err, resp) {
            if(err) {
                callback(err, false);
            } else {
        /*        callback(false, resp);
            }
        });
        fs.readFile('./cache/cdpcache.js', 'utf8', function (err,data) {
            if (err) {
                callback(err, false);
            } else {
                let resp = JSON.parse(data.toString());*/
                let cdphtresp = {};
                for(let i = 0; i < resp.length; i++) {
                    let respoid = resp[i].oid.split(".")
                    let index = respoid.pop();
                    let id = respoid.pop();
                    //console.log(resp[i]);
                    let oid = respoid.join(".")
                    //console.log(id);
                    //console.log(index);
                    //console.log(oiddefs[oid]);
                    let value;
                    if(resp[i].type == 4) {
                        if(oiddefs[oid] == 'cdpCacheAddress') {
                            //value = varbinds[0].value.toString('hex');
                            //let hex = resp[i].value.data.toString('hex');
                            /*let ip = [];
                            for(let j = 0 ; j <= resp[i].value.data.length - 1; j++) {
                                ip.push(resp[i].value.data[j]);
                            }
                            value = ip.join('.');*/
                            //console.log(resp[i].value.join("."));
                            value = resp[i].value.join(".");
                        } else if(oiddefs[oid] == 'cdpCacheCapabilities') {
                            value = Buffer.from(resp[i].value).toString('hex');
                        } else if(oiddefs[oid] == 'cdpCacheDeviceId') {
                            value = Buffer.from(resp[i].value).toString();
                            //console.log(index);
                            //console.log(resp[i].oid);
                            //console.log(resp[i].value.toString());
                        } else {
                            value = Buffer.from(resp[i].value).toString();
                        }
                    } else if(resp[i].type == 67) {
                        //value = convertTimeticks(varbinds[0].value);
                        value = resp[i].value
                    } else {
                        value = resp[i].value;
                    }
                    if(cdphtresp.hasOwnProperty(index)) {
                        cdphtresp[index][oiddefs[oid]] = value;
                    } else {
                        cdphtresp[index] = {}
                        cdphtresp[index][oiddefs[oid]] = value;
                    }
                }
                let cdpresp = [];
                let keys = Object.keys(cdphtresp);
                for(let i = 0; i < keys.length; i++) {
                    cdphtresp[keys[i]].name = common.normalizeName(cdphtresp[keys[i]].cdpCacheDeviceId);
                    cdpresp.push(cdphtresp[keys[i]]);
                }
                callback(false, cdpresp);
            }
        });  
    }

    this.createSession = function(params, callback) {
        createSession(params, 0, true, function(err, session) {
            if(err) {
                callback(err, false);
            } else {
                callback(false, session);
            }
        });
    }

    this.walkOID = function(oid, callback) {
        if(session) {
            walkOID(oid, 0, session, function(err, resp) {
                if(err) {
                    callback(err, false);
                } else {
                    callback(false, resp);
                }
            });
        } else {
            callback('No SNMP session', false);
        }
    }

    this.getOID = function(oid, callback) {
        if(session) {
            getOID(oid, 0, session, function(err, resp) {
                if(err) {
                    callback(err, false);
                } else {
                    callback(false, resp);
                }
            });
        } else {
            callback('No SNMP session', false);
        }
    }

    this.getCDP = function(callback) {
        if(session) {
            getCDP( function(err, resp) {
                if(err) {
                    callback(err, false);
                } else {
                    callback(false, resp);
                }
            });
        } else {
            callback('No SNMP session', false);
        }
    }

    this.getNetworks = function(callback) {
        if(session) {
            getNetworks( function(err, resp) {
                if(err) {
                    callback(err, false);
                } else {
                    callback(false, resp);
                }
            });
        } else {
            callback('No SNMP session', false);
        }
    }

    this.getHostname = function() {
        return getHostname();
    }

    this.closeSession = function(callback) {
        closeSession(function() {
            callback();
        });
    }
}