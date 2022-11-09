var snmp = require("net-snmp");
var fs = require("fs");
var common = require("./common");
var subnet = require("./subnet");
const { SocketAddress } = require("net");
var Netmask = require('netmask').Netmask
var protocols = [
    '0',
    'other',
    'local',
    'netmgmt',
    'icmp',
    'egp',
    'ggp',
    'hello',
    'rip',
    'isIs',
    'esIs',
    'ciscoIgrp',
    'bbnSpfIgp',
    'ospf',
    'bgp',
    'idpr',
    'ciscoEigrp'
]
var routetypes = [
    '0',
    'other',
    'reject',
    'local',
    'remote'
]

var maxretry = 5;

module.exports = function() {
    var credentials;
    var hostname;
    var session;
    var cachedinterfaces;

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

    var getNextOID = function(oid, retry, snmpsession, callback) {
        snmpsession.getNext([oid], function (err, varbinds) {
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
        if(credindex < params.credentials.snmp.length) {
            let tempsession;
            let cached = false;
            var options = {
                version: snmp.Version2c
            }
            if(params.credentialcache.hasOwnProperty(params.host) && params.credentialcache[params.host].snmp && cacheenabled && params.credentialcache[params.host].snmp <= params.credentials.snmp.length - 1) {
                cached = true;
                //console.log('attempting cached credentials');
                //console.log(params.credentials[params.credentialcache[params.host]]);
                //console.log(params.credentialcache[params.host].snmp);
                //console.log(params.credentials.snmp.length);
                if(params.credentials.snmp[params.credentialcache[params.host].snmp].version == 2) {
                    tempsession = snmp.createSession(params.host, params.credentials.snmp[params.credentialcache[params.host].snmp].community, options);
                } else if(params.credentials.snmp[params.credentialcache[params.host].snmp].version == 3) {
                    tempsession = snmp.createV3Session(params.host, params.credentials.snmp[params.credentialcache[params.host].snmp].user, params.credentials.snmp[params.credentialcache[params.host].snmp].options);
                } else {
                    createSession(params, credindex, false, callback);
                }
            } else {
                //console.log(params.credentials.snmp[credindex]);
                if(params.credentials.snmp[credindex].version == 2) {
                    tempsession = snmp.createSession(params.host, params.credentials.snmp[credindex].community, options);
                } else if(params.credentials.snmp[credindex].version == 3) {
                    tempsession = snmp.createV3Session(params.host, params.credentials.snmp[credindex].user, params.credentials.snmp[credindex].options);
                } else {
                    callback('Unrecognized SNMP version (' + params.credentials.snmp[credindex].version + ") in credential index " + credindex);
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
                        callback(false, params.credentialcache[params.host].snmp);
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

    var flattenRoutes = function(routes) {
        let routearr = [];
        let keys = Object.keys(routes);
        for(let i = 0; i < keys.length; i++) {
            routearr.push(routes[keys[i]]);
        }
        return routearr;
    }

    var getRouteTable = function(callback) {
        ipCidrRouteTable(function(err, routes) {
            if(err) {
                callback(err, false)
            } else {
                let keys = Object.keys(routes);
                if(keys.length < 1) {
                    //console.log('alt');
                    ipRouteTable(function(err, routes) {
                        if(err) {
                            callback(err, false)
                        } else {
                            callback(false, {
                                routes: flattenRoutes(routes),
                                rfc: 'RFC1213'    
                            });
                        }
                    })
                } else {
                    callback(false, {
                        routes: flattenRoutes(routes),
                        rfc: 'RFC2096'    
                    });
                }
            }
        });
    }

    var ipRouteTable = function(callback) {
        let oid1 = '1.3.6.1.2.1.4.21.1.11';
        walkOID(oid1, 0, session, function(err, resp) {
            if(err) {
                callback(err, false);
            } else {
                let routes = {};
                for(let i = 0; i < resp.length; i++) {
                    let index = resp[i].oid.replace(oid1 + '.', '');
                    routes[index] = {
                        network: index,
                        mask: resp[i].value,
                        nextHop: {}
                    };
                }
                let oid2 = '1.3.6.1.2.1.4.21.1.7';
                walkOID(oid2, 0, session, function(err, resp) {
                    if(err) {
                        callback(err, false);
                    } else {
                        for(let i = 0; i < resp.length; i++) {
                            //console.log(resp[i]);
                            let index = resp[i].oid.replace(oid2 + '.', '');
                            /*if(index=='10.160.0.0') {
                                console.log(resp[i]);
                            }*/
                            //console.log(routes[index]);
                            if(routes.hasOwnProperty(index)) {
                                routes[index]['nextHop'][resp[i].value] = {};
                            }
                        }
                        let oid3 = '1.3.6.1.2.1.4.21.1.8';
                        walkOID(oid3, 0, session, function(err, resp) {
                            if(err) {
                                callback(err, false);
                            } else {
                                for(let i = 0; i < resp.length; i++) {
                                    //console.log(resp[i]);
                                    let index = resp[i].oid.replace(oid3 + '.', '');
                                    //console.log(index);
                                    //console.log(routes[index]);
                                    if(routes.hasOwnProperty(index)) {
                                        routes[index]['nextHop'][Object.keys(routes[index]['nextHop'])[0]]['type'] = routetypes[resp[i].value];
                                    }
                                }
                                let oid4 = '1.3.6.1.2.1.4.21.1.9';
                                walkOID(oid4, 0, session, function(err, resp) {
                                    if(err) {
                                        callback(err, false);
                                    } else {
                                        for(let i = 0; i < resp.length; i++) {
                                            //console.log(resp[i]);
                                            let index = resp[i].oid.replace(oid4 + '.', '');
                                            //console.log(index);
                                            //console.log(routes[index]);
                                            if(routes.hasOwnProperty(index)) {
                                                routes[index]['nextHop'][Object.keys(routes[index]['nextHop'])[0]]['protocol'] = protocols[resp[i].value];
                                            }
                                        }
                                        let oid5 = '1.3.6.1.2.1.4.21.1.3';
                                        walkOID(oid5, 0, session, function(err, resp) {
                                            if(err) {
                                                callback(err, false);
                                            } else {
                                                for(let i = 0; i < resp.length; i++) {
                                                    //console.log(resp[i]);
                                                    let index = resp[i].oid.replace(oid5 + '.', '');
                                                    //console.log(index);
                                                    //console.log(routes[index]);
                                                    if(routes.hasOwnProperty(index)) {
                                                        routes[index]['nextHop'][Object.keys(routes[index]['nextHop'])[0]]['metric'] = resp[i].value;
                                                    }
                                                }
                                                callback(false, routes);
                                            }
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

    var ipCidrRouteTable = function(callback) {
        let oid1 = '1.3.6.1.2.1.4.24.4.1.2';
        walkOID(oid1, 0, session, function(err, resp) {
            if(err) {
                //console.log(err);
                callback(err, false);
            } else {
                let routes = {};
                for(let i = 0; i < resp.length; i++) {
                    let stripoid = resp[i].oid.replace(oid1 + '.', '');
                    //console.log(stripoid);
                    let data = stripoid.split('.');
                    let nexthop = [];
                    for(let i = 0; i < 4; i++) {
                        nexthop.push(data.pop());
                    }
                    data.pop()
                    let index = data.join('.')
                    //console.log(index);
                    let mask = [];
                    for(let i = 0; i < 4; i++) {
                        mask.push(data.pop());
                    }
                    let network = [];
                    for(let i = 0; i < 4; i++) {
                        network.push(data.pop());
                    }
                    let hop = nexthop.reverse().join('.');
                    if(routes.hasOwnProperty(index)) {
                        routes[index]['nextHop'][hop] = {};
                    } else {
                        routes[index] = {
                            mask: mask.reverse().join('.'),
                            network: network.reverse().join('.'),
                            nextHop: {}
                        }
                        routes[index]['nextHop'][hop] = {};
                    }
                    /*if(routes[index]['nextHop'].hasOwnProperty(hop)) {

                    } else {
                        routes[index]['nextHop'][hop] = {};
                    }*/
                }
                console.log(Object.keys(routes).length)
                let oid2 = '1.3.6.1.2.1.4.24.4.1.6';
                walkOID(oid2, 0, session, function(err, resp) {
                    if(err) {
                        callback(err, false);
                    } else {
                        for(let i = 0; i < resp.length; i++) {
                            //console.log(resp[i]);
                            let stripoid = resp[i].oid.replace(oid2 + '.', '');
                            //console.log(stripoid);
                            let data = stripoid.split('.');
                            let nexthop = [];
                            for(let i = 0; i < 4; i++) {
                                nexthop.push(data.pop());
                            }
                            data.pop()
                            let index = data.join('.')
                            //console.log(index);
                            //console.log(routes[index]);
                            /*if(routes.hasOwnProperty(index)) {
                                routes[index]['type'] = routetypes[resp[i].value];
                            }*/
                            let hop = nexthop.reverse().join('.');
                            /*console.log(hop);
                            console.log(routes[index]);
                            console.log(routes[index]['nextHop']);
                            console.log(routes[index]['nextHop'][hop]);*/
                            if(routes.hasOwnProperty(index)) {
                                routes[index]['nextHop'][hop]['type'] = routetypes[resp[i].value]
                            }
                        }
                        let oid3 = '1.3.6.1.2.1.4.24.4.1.11';
                        walkOID(oid3, 0, session, function(err, resp) {
                            if(err) {
                                callback(err, false);
                            } else {
                                for(let i = 0; i < resp.length; i++) {
                                    let stripoid = resp[i].oid.replace(oid3 + '.', '');
                                    //console.log(stripoid);
                                    let data = stripoid.split('.');
                                    let nexthop = [];
                                    for(let i = 0; i < 4; i++) {
                                        nexthop.push(data.pop());
                                    }
                                    data.pop()
                                    let index = data.join('.')
                                    /*if(routes.hasOwnProperty(index)) {
                                        routes[index]['metric'] = resp[i].value;
                                    }*/
                                    let hop = nexthop.reverse().join('.');
                                    if(routes.hasOwnProperty(index)) {
                                        routes[index]['nextHop'][hop].metric = resp[i].value
                                    }
                                }
                                let oid4 = '1.3.6.1.2.1.4.24.4.1.7';
                                walkOID(oid4, 0, session, function(err, resp) {
                                    if(err) {
                                        callback(err, false);
                                    } else {
                                        for(let i = 0; i < resp.length; i++) {
                                            let stripoid = resp[i].oid.replace(oid4 + '.', '');
                                            //console.log(stripoid);
                                            let data = stripoid.split('.');
                                            let nexthop = [];
                                            for(let i = 0; i < 4; i++) {
                                                nexthop.push(data.pop());
                                            }
                                            data.pop()
                                            let index = data.join('.')
                                            /*if(routes.hasOwnProperty(index)) {
                                                routes[index]['protocol'] = protocols[resp[i].value];
                                            }*/
                                            let hop = nexthop.reverse().join('.');
                                            if(routes.hasOwnProperty(index)) {
                                                routes[index]['nextHop'][hop].protocol = protocols[resp[i].value]
                                            }
                                        }
                                        callback(false, routes);
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    }

    var getNetworks = function(callback) {
        var oiddefs = {
            '1.3.6.1.2.1.4.20.1.1': 'ipAdEntAddr',
            '1.3.6.1.2.1.4.20.1.2': 'ipAdEntIfIndex',
            '1.3.6.1.2.1.4.20.1.3': 'ipAdEntNetMask',
            '1.3.6.1.2.1.4.20.1.4': 'ipAdEntBcastAddr',
            '1.3.6.1.2.1.4.20.1.5': 'ipAdEntReasmMaxSize'
        }
        getInterfaces(function(err, interfaces) {
            if(err) {
                callback(err, false);
            } else {
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
                            try {
                                if(interfaces[nethtresp[keys[i]].ipAdEntIfIndex]) {
                                    //console.log(interfaces[nethtresp[keys[i]].ipAdEntIfIndex].operStatus);
                                    if(interfaces[nethtresp[keys[i]].ipAdEntIfIndex].adminStatus != '2' && interfaces[nethtresp[keys[i]].ipAdEntIfIndex].operStatus != '2') {
                                        netresp.push(subnet(nethtresp[keys[i]]));
                                    }
                                } else {
                                    /*console.log('failed to find interface index ' + nethtresp[keys[i]].ipAdEntIfIndex + ' from ' + hostname);
                                    console.log(keys[i]);
                                    console.log(nethtresp[keys[i]]);
                                    console.log(nethtresp[keys[i]].ipAdEntIfIndex);
                                    console.log(interfaces);
                                    console.log(interfaces[nethtresp[keys[i]].ipAdEntIfIndex]);*/
                                    netresp.push(subnet(nethtresp[keys[i]]));
                                    //process.exit();
                                }
                                //console.log(nethtresp[keys[i]].ipAdEntIfIndex);
                            } catch(e) {
                                console.log(e.toString());
                            }
                        }
                        callback(false, netresp);
                    }
                });
            }
        });
    }

    var formatMAC = function(str) {
        var ret = [];
        var i;
        var len;
    
        for(i = 0, len = str.length; i < len; i += 2) {
           ret.push(str.substr(i, 2).toUpperCase())
        }
    
        return ret.join(":");
    };

    var getARPTable = function(callback) {
        var interfaces = {};
        walkOID('1.3.6.1.2.1.3.1.1.2', 0, session, function(err, resp) {
            if(err) {
                callback(err, false);
            } else {
                if(resp.length > 0) {
                    for(let i = 0; i < resp.length; i++) {
                        //console.log(resp[i]);
                        let respoid = resp[i].oid.replace('1.3.6.1.2.1.3.1.1.2.', '').split(".")
                        let ip = [];
                        for(let i = 0; i < 4; i++) {
                            ip.push(respoid.pop());
                        }
                        //respoid.pop();
                        let index = respoid[0]
                        if(interfaces.hasOwnProperty(index)===false) {
                            interfaces[index] = {}
                        }
                        interfaces[index][ip.reverse().join('.')] = formatMAC(resp[i].value.toString('hex'));
                    }
                    callback(false, interfaces);
                } else {
                    walkOID('1.3.6.1.2.1.4.35.1.4', 0, session, function(err, resp) {
                        if(err) {
                            callback(err, false);
                        } else {
                            for(let i = 0; i < resp.length; i++) {
                                //console.log(resp[i]);
                                //break;
                                let respoid = resp[i].oid.replace('1.3.6.1.2.1.4.35.1.4.', '').split(".")
                                let ip = [];
                                for(let i = 0; i < 4; i++) {
                                    ip.push(respoid.pop());
                                }
                                //respoid.pop();
                                //respoid.pop();
                                let index = respoid[0]
                                if(interfaces.hasOwnProperty(index)===false) {
                                    interfaces[index] = {}
                                }
                                interfaces[index][ip.reverse().join('.')] = formatMAC(resp[i].value.toString('hex'));
                            }
                            callback(false, interfaces);
                        }
                    });
                }
            }
        });
    }

    var getInterfaceIPs = function(callback) {
        var interfaces = {};
        walkOID('1.3.6.1.2.1.4.20.1.2', 0, session, function(err, resp) {
            if(err) {
                callback(err, false);
            } else {
                for(let i = 0; i < resp.length; i++) {
                    let respoid = resp[i].oid.split(".")
                    let ip = [];
                    for(let i = 0; i < 4; i++) {
                        ip.push(respoid.pop());
                    }
                    interfaces[ip.reverse().join('.')] = {
                        interfaceIndex: resp[i].value
                    }
                }
                walkOID('1.3.6.1.2.1.4.20.1.3', 0, session, function(err, resp) {
                    if(err) {
                        callback(err, false);
                    } else {
                        for(let i = 0; i < resp.length; i++) {
                            let respoid = resp[i].oid.split(".")
                            let ip = [];
                            for(let i = 0; i < 4; i++) {
                                ip.push(respoid.pop());
                            }
                            interfaces[ip.reverse().join('.')]['netmask'] = resp[i].value
                        }
                        callback(false, interfaces);
                    }
                });
            }
        });
    }

    var getNetARPTables = function(callback) {
        var interfaces = {};
        getInterfaces(function(err, ints) {
            if(err) {
                callback(err, false);
            } else {
                getInterfaceIPs(function(err, ips) {
                    if(err) {
                        callback(err, false);
                    } else {
                        //console.log(ips);
                        let keys = Object.keys(ips);
                        for(let i = 0; i < keys.length; i++) {
                            try {
                                //console.log(ints[ips[keys[i]].interfaceIndex]);
                                if(ints[ips[keys[i]].interfaceIndex]) {
                                    if(ints[ips[keys[i]].interfaceIndex].adminStatus != '2' && ints[ips[keys[i]].interfaceIndex].operStatus != '2') {
                                        var block = new Netmask(keys[i] + '/' + ips[keys[i]].netmask);
                                        interfaces[ips[keys[i]].interfaceIndex] = {};
                                        interfaces[ips[keys[i]].interfaceIndex].ip = keys[i] + '/' + block.bitmask
                                        interfaces[ips[keys[i]].interfaceIndex].network = block.base + '/' + block.bitmask
                                    }
                                } else {
                                    var block = new Netmask(keys[i] + '/' + ips[keys[i]].netmask);
                                    interfaces[ips[keys[i]].interfaceIndex] = {};
                                    interfaces[ips[keys[i]].interfaceIndex].ip = keys[i] + '/' + block.bitmask
                                    interfaces[ips[keys[i]].interfaceIndex].network = block.base + '/' + block.bitmask
                                }
                            } catch(e) {
                                console.log(e.toString());
                            }
                        }
                        getARPTable(function(err, arp) {
                            if(err) {
                                callback(err, false);
                            } else {
                                let keys = Object.keys(arp);
        //                        console.log(interfaces[keys[i]]);
                                try {
                                    for(let i = 0; i < keys.length; i++) {
                                        if(interfaces.hasOwnProperty(keys[i])) {
                                            interfaces[keys[i]].arp = arp[keys[i]];
                                        }
                                    }
                                } catch(e) {
                                    console.log(arp);
                                    console.log(interfaces);
                                    console.log('Error associating arp table with interfaces');
                                    console.log(hostname);
                                    process.exit();
                                }
                                let networks = {};
                                let ikeys = Object.keys(interfaces);
                                for(let i = 0; i < ikeys.length; i++) {
                                    if(networks.hasOwnProperty(interfaces[ikeys[i]]['network'])) {
                                        console.log('found duplicate network on the same switch!?');
                                        let nkeys = Object.keys(networks[interfaces[ikeys[i]]['network']]);
                                        for(let j = 0; j < nkeys.length; j++) {
                                            if(networks[interfaces[ikeys[i]]['network']].hasOwnProperty(nkeys[j])===false) {
                                                networks[nkeys[j]] = interfaces[ikeys[i]]['network'][nkeys[j]];
                                            }
                                        }
                                    } else {
                                        if(interfaces[ikeys[i]]['arp']) {
                                            networks[interfaces[ikeys[i]]['network']] = interfaces[ikeys[i]]['arp'];
                                        } else {
                                            //console.log(interfaces[ikeys[i]]);
                                            //console.log(ikeys[i]);
                                            networks[interfaces[ikeys[i]]['network']] = {};
                                        }
                                    }
                                }
                                callback(false, networks);
                            }
                        });
                    }
                });
            }
        });
    }

    var getStackMembers = function(callback) {
        //get interface types
        //console.log('getting stack members');
        var interfaces = {};
        walkOID('1.3.6.1.4.1.9.9.500.1.2.1.1.7', 0, session, function(err, resp) {
            if(err) {
                callback(err, false);
            } else {
                let members = [];
                for(let i = 0; i < resp.length; i++) {
                    //console.log(resp[i]);
                    //let respoid = resp[i].oid.split(".")
                    //let index = respoid.pop();
                    members.push(formatMAC(resp[i].value.toString('hex')));
                }
                callback(false, members);
            }
        });
    }

    var getInterfaces = function(callback) {
        //get interface types
        //console.log('getting interface types');
        if(cachedinterfaces) {
            callback(false, cachedinterfaces);
        } else {
            var interfaces = {};
            walkOID('1.3.6.1.2.1.2.2.1.3', 0, session, function(err, resp) {
                if(err) {
                    callback(err, false);
                } else {
                    for(let i = 0; i < resp.length; i++) {
                        //console.log(resp[i]);
                        let respoid = resp[i].oid.split(".")
                        let index = respoid.pop();
                        let type = resp[i].value.toString();
                        if(type != '231' && type != '232') {
                            interfaces[index] = {}
                            interfaces[index]['name'] = type;
                        }
                    }
                    //get interface names/descriptions
                    //console.log('getting interface names/descriptions');
                    walkOID('1.3.6.1.2.1.2.2.1.2', 0, session, function(err, resp) {
                        if(err) {
                            callback(err, false);
                        } else {
                            for(let i = 0; i < resp.length; i++) {
                                //console.log(resp[i]);
                                let respoid = resp[i].oid.split(".")
                                let index = respoid.pop();
                                if(interfaces.hasOwnProperty(index)) {
                                    interfaces[index]['type'] = resp[i].value.toString();
                                }
                            }
                            //get interface mac addresses
                            walkOID('1.3.6.1.2.1.2.2.1.6', 0, session, function(err, resp) {
                                if(err) {
                                    callback(err, false);
                                } else {
                                    for(let i = 0; i < resp.length; i++) {
                                        //console.log(resp[i]);
                                        let respoid = resp[i].oid.split(".")
                                        let index = respoid.pop();
                                        if(interfaces.hasOwnProperty(index)) {
                                            interfaces[index]['mac'] = formatMAC(resp[i].value.toString('hex'));
                                        }
                                    }
                                    //get interface admin status
                                    walkOID('1.3.6.1.2.1.2.2.1.7', 0, session, function(err, resp) {
                                        if(err) {
                                            callback(err, false);
                                        } else {
                                            for(let i = 0; i < resp.length; i++) {
                                                //console.log(resp[i]);
                                                let respoid = resp[i].oid.split(".")
                                                let index = respoid.pop();
                                                if(interfaces.hasOwnProperty(index)) {
                                                    interfaces[index]['adminStatus'] = resp[i].value.toString();
                                                }
                                            }
                                            //get interface oper status
                                            walkOID('1.3.6.1.2.1.2.2.1.8', 0, session, function(err, resp) {
                                                if(err) {
                                                    callback(err, false);
                                                } else {
                                                    for(let i = 0; i < resp.length; i++) {
                                                        //console.log(resp[i]);
                                                        let respoid = resp[i].oid.split(".")
                                                        let index = respoid.pop();
                                                        if(interfaces.hasOwnProperty(index)) {
                                                            interfaces[index]['operStatus'] = resp[i].value.toString();
                                                        }
                                                    }
                                                    //get interface last change
                                                    walkOID('1.3.6.1.2.1.2.2.1.9', 0, session, function(err, resp) {
                                                        if(err) {
                                                            callback(err, false);
                                                        } else {
                                                            for(let i = 0; i < resp.length; i++) {
                                                                //console.log(resp[i]);
                                                                let respoid = resp[i].oid.split(".")
                                                                let index = respoid.pop();
                                                                if(interfaces.hasOwnProperty(index)) {
                                                                    interfaces[index]['lastChange'] = resp[i].value.toString();
                                                                }
                                                            }
                                                            cachedinterfaces = interfaces;
                                                            callback(false, interfaces);
                                                            /*getARPTable(function(err, arp) {
                                                                if(err) {
                                                                    callback(err, false);
                                                                } else {
                                                                    let keys = Object.keys(arp);
                                                                    for(let i = 0; i < keys.length; i++) {
                                                                        interfaces[keys[i]].arp = arp[keys[i]];
                                                                    }
                                                                    getInterfaceIPs(function(err, ips) {
                                                                        if(err) {
                                                                            callback(err, false);
                                                                        } else {
                                                                            let keys = Object.keys(ips);
                                                                            for(let i = 0; i < keys.length; i++) {
                                                                                var block = new Netmask(keys[i] + '/' + ips[keys[i]].netmask);
                                                                                interfaces[ips[keys[i]].interfaceIndex].ip = keys[i] + '/' + block.bitmask
                                                                                interfaces[ips[keys[i]].interfaceIndex].network = block.base + '/' + block.bitmask
                                                                            }
                                                                            callback(false, interfaces);
                                                                        }
                                                                    });
                                                                }
                                                            });*/
                                                        }
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
            });
        }
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
                    try {
                        cdphtresp[keys[i]].name = common.normalizeName(cdphtresp[keys[i]].cdpCacheDeviceId);
                    } catch(e) {
                        console.log('Failed to normalize name for object:')
                        console.log(cdphtresp[keys[i]]);
                        process.exit();
                    }
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

    this.getInterfaces = function(callback) {
        if(session) {
            getInterfaces( function(err, resp) {
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
    
    this.getStackMembers = function(callback) {
        if(session) {
            getStackMembers( function(err, resp) {
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

    this.getRouteTable = function(callback) {
        if(session) {
            getRouteTable( function(err, resp) {
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
    
    this.getInterfaceIPs = function(callback) {
        if(session) {
            getInterfaceIPs( function(err, resp) {
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

    this.getNetARPTables = function(callback) {
        if(session) {
            getNetARPTables( function(err, resp) {
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

    this.getARPTable = function(callback) {
        if(session) {
            getARPTable( function(err, resp) {
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

    this.getNextOID = function(oid, callback) {
        if(session) {
            getNextOID(oid, 0, session, function(err, resp) {
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