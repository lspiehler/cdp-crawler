let poller = require('./poll');
let credentials = require('../credentials');
let fs = require('fs');
const poll = require('./poll');
var credentialcachetimer;
var writefrequency = 60000;
var credentialcache;
var concurrency = 8;
var devices = [];
var networks = {};
var completed = 0;
var updateseeds = {};

var queue = {
    waiting: {},
    running: {},
    completed: {}
}

var exclusions = [];

let addNeighbor = function(item, match) {
    //console.log(item.name);
    //console.log(updateseeds);
    let uppername = item.name.toUpperCase();
    if(updateseeds.hasOwnProperty(uppername)) {
        let update = updateseeds[uppername];
        delete updateseeds[uppername];
        //console.log('this one');
        console.log(item);
        //console.log(devices[update]);
        devices[update].discoveredBy = item.discoveredBy;
        devices[update].deviceId = item.cdp.cdpCacheDeviceId;
        devices[update].platform = item.cdp.cdpCachePlatform;
        devices[update].discoveredNeighbors.push(item.discoveredBy);
    }
    for(let i = 0; i < item.discoveredNeighbors.length; i++) {
        if(match.discoveredNeighbors.indexOf(item.discoveredNeighbors[i]) < 0) {
            match.discoveredNeighbors.push(item.discoveredNeighbors[i]);
            //console.log('adding neighbor to existing item');
        } else {
            //console.log('skipping neighbor add');
        }
    }
}

let addNetworks = function(snmp) {
    //console.log(snmp);
    for(let i = 0; i < snmp.networks.length; i++) {
        let netindex = snmp.networks[i].ip + '/' + snmp.networks[i].bitmask
        if(networks.hasOwnProperty(netindex)) {
            networks[netindex].name.push(snmp.name);
            networks[netindex].ip.push(snmp.networks[i].ip);
        } else {
            let network = {
                network: snmp.networks[i].network,
                cidr: snmp.networks[i].bitmask,
                name: [snmp.name],
                ip: [snmp.networks[i].ip],
                mask: snmp.networks[i].subnet
            }
            networks[netindex] = network;
        }
    }
}

let queueAdd = function(item) {
    let index;
    if(item.hasOwnProperty('name')) {
        index = item.name;
    } else {
        index = item.host
    }
    if(queue.waiting.hasOwnProperty(index)) {
        //console.log('not adding duplicate item to queue');
        //console.log(queue.waiting[index]);
        addNeighbor(item, queue.waiting[index]);
    } else if(queue.running.hasOwnProperty(index)) {
        //console.log(queue.running[index]);
        addNeighbor(item, queue.running[index]);
        //console.log('not adding duplicate item to queue');
    } else if(queue.completed.hasOwnProperty(index)) {
        //console.log(queue.completed[index]);
        addNeighbor(item, queue.completed[index]);
        //console.log('not adding duplicate item to queue');
    } else {
        queue.waiting[index] = item;
    }
}

let queueComplete = function(qitem) {
    //console.log('here');
    //console.log(qitem);
    let index;
    if(qitem.hasOwnProperty('name')) {
        index = qitem.name;
    } else {
        index = qitem.host
    }
    queue.completed[index] = qitem;
    delete queue.running[index];
    completed++;
}

let processQueue = function(callback) {
    let status = queueStatus();
    //console.log(status);
    //callback(false, 'done');
    console.log({
        waiting: status.waiting.length,
        running: status.running
    });
    if(status.running.length < concurrency && status.waiting.length > 0) {
        //for testing only
        //if(completed < 5) {
        if(true) {
            let nexthost = status.waiting[0];
            //console.log('here')
            //console.log(nexthost)
            queue.running[nexthost] = queue.waiting[nexthost]
            delete queue.waiting[nexthost]
            //console.log(queue.running[nexthost]);
            //console.log(nexthost);
            pollHost(queue.running[nexthost], function(err, resp) {
                if(err) {
                    addDevice('failed', {
                        queue: queue.running[nexthost]
                    });
                    //console.log('Failed to poll ' + nexthost + " (" + queue.running[nexthost].host + "): " + err);
                    //store failed device
                } else {
                    //console.log('Successfully polled ' + nexthost);
                    addNetworks(resp);
                    addDevice('discovered', {
                        queue: queue.running[nexthost],
                        snmp: resp
                    });
                    for(let i = 0; i < resp.neighbors.length; i++) {
                        let pass = true;
                        for(let j = 0; j <= exclusions.length - 1; j++) {
                            //console.log(resp.data.neighbors[i].cdpCachePlatform + ' - ' + resp.data.neighbors[i].cdpCachePlatform.indexOf(exclude[i]));
                            if(resp.neighbors[i].cdpCachePlatform.indexOf(exclusions[j]) >= 0 ) {
                                pass = false;
                            }
                        }
                        if(pass) {
                            queueAdd({
                                host: resp.neighbors[i].cdpCacheAddress,
                                name: resp.neighbors[i].cdpCacheDeviceId,
                                source: 'cdp',
                                location: resp.location,
                                cdp: resp.neighbors[i],
                                discoveredBy: resp.discoveredBy,
                                discoveredNeighbors: resp.discoveredNeighbors
                            });
                        }
                    }
                }
                queueComplete(queue.running[nexthost]);
                processQueue(callback);
            });
            if(status.waiting.length > 0) {
                setTimeout(function() {
                    processQueue(callback);
                }, 100);
            }
        } else {
            queue.waiting = {};
        }
    } else {

        if(status.waiting.length < 1 && status.running.length < 1) {
            let keys = Object.keys(networks)
            let netarr = [];
            for(let i = 0; i < keys.length; i++) {
                netarr.push(networks[keys[i]]);
            }
            callback(false, {
                devices: devices,
                networks: netarr,
                queue: queue
            });
        }
    }
}

let queueStatus = function() {
    return {
        waiting: Object.keys(queue.waiting),
        running: Object.keys(queue.running)
    }
}

let addDevice = function(status, result) {
    //console.log(status);
    //console.log(result);
    let device;

    let index;
    if(result.queue.hasOwnProperty('name')) {
        index = result.queue.name;
    } else {
        index = result.queue.host
    }

    if(status=='failed') {
        device = {
            ip: result.queue.host,
            source: result.queue.source,
            name: index,
            status: status,
            discoveredBy: result.queue.discoveredBy,
            discoveredNeighbors: result.queue.discoveredNeighbors,
            location: ''
        }
        if(result.queue.source != 'seed') {
            device.platform = result.queue.cdp.cdpCachePlatform;
            device.deviceId = result.queue.cdp.cdpCacheDeviceId;
        } else {
            device.platform = '';
            device.deviceId = '';
        }
    } else {
        //console.log(result);
        index = result.snmp.name;
        device = {
            ip: result.queue.host,
            source: result.queue.source,
            name: index,
            status: status,
            discoveredBy: result.queue.discoveredBy,
            discoveredNeighbors: result.queue.discoveredNeighbors,
            location: result.snmp.location
        }

        if(result.queue.source != 'seed') {
            device.platform = result.queue.cdp.cdpCachePlatform;
            device.deviceId = result.queue.cdp.cdpCacheDeviceId;
        }
    }
    //console.log(device);
    let seedindex = devices.push(device);
    if(result.queue.source == 'seed') {
        updateseeds[index] = seedindex - 1;
    }
}

var pollHost = function(queue, callback) {
    var index;
    if(queue.hasOwnProperty('name')) {
        index = queue.name;
    } else {
        index = queue.host
    }
    let poll = new poller();
    poll.createSession({host: queue.host, credentials: credentials, credentialcache: credentialcache}, function(err, resp) {
        if(err) {
            callback(err, false);
        } else {
            //credentialcache[poll.getHostname().toUpperCase()].snmp = resp;
            credentialcache[queue.host] = {
                snmp: resp
            }
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
                                //let device;
                                if(err) {
                                    callback(err, false);
                                } else {
                                    callback(false, {
                                        name: poll.getHostname().toUpperCase(),
                                        location: syslocation.toString(),
                                        discoveredNeighbors: [poll.getHostname().toUpperCase()],
                                        discoveredBy: poll.getHostname().toUpperCase(),
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

let beginDiscovery = function(seeds, callback) {
    fs.stat('./cache/credentialcache.js', function (err, data) {
        if (err) {
            //console.log('no cached credentials');
            credentialcache = {};
        } else {
            //credentialcache = JSON.parse(data.toString());
            credentialcache = require('../cache/credentialcache');
        }
        for(let i = 0; i < seeds.length; i++) {
            let seed = {}
            seed.host = seeds[i];
            seed.source = 'seed';
            seed.discoveredNeighbors = [];
            seed.location = '';
            seed.discoveredBy = '';
            queueAdd(seed);
        }
        enableWriteCacheTimer();
        processQueue(function(err, resp) {
            disableWriteCacheTimer();
            writeCache();
            //console.log(err);
            callback(err, resp);
        });
    });
}

module.exports = function() {
    this.run = function(seeds, exclude, callback) {
        exclusions = exclude;
        beginDiscovery(seeds, function(err, resp) {
            callback(err, resp);
        })
    }
}