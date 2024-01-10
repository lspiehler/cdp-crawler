var Netmask = require('netmask').Netmask
let poller = require('./poll');
const config = require('../config');
let credentials = require('../credentials');
let fs = require('fs');
const db = require('./database');
const poll = require('./poll');
const sshlib = require('./ssh');
const { snmp } = require('../credentials');
var credentialcachetimer;
var writefrequency = 60000;
var credentialcache;
var concurrency = 4;
var devices = [];
var networks = {};
var routes = {};
var arp = {};
var completed = 0;
var updateseeds = {};
var excluded = [];
var getroutetable = [];
var errors = [];
var hostnametoipmappings;
var subnettositemappings;
var ignorenetsfromhosts;
var pollingroutes = {};

var queue = {
    waiting: {},
    running: {},
    completed: {}
}

var exclusions = [];

var parseDescription = function(description) {
    //let description = result.description;
    let response = {
        type: null,
        version: null
    }
    if(description && description != '') {
        //console.log(description);
        //console.log(result.name);
        let version = description.substr(description.indexOf('Version ') + 8).split(' ')[0].replace(',', '');
        //console.log(version);
        if(description.indexOf('IOS-XE') > 0) {
            response.type = 'IOS-XE';
            response.version = version;
        } else if(description.indexOf('NX-OS') > 0) {
            response.type = 'NX-OS';
            response.version = version;
        } else if(description.indexOf('IOS') > 0) {
            response.type = 'IOS';
            response.version = version;
        } else if(description.indexOf('Adaptive Security Appliance') > 0) {
            response.type = 'ASA';
            response.version = version;
        } else {
            response.type = 'unknown'
            response.version = 'unknown'
        }
    } else {
        response.type = 'unknown'
        response.version = 'unknown'
    }
    return response;
}

let addNeighbor = function(item, match) {
    //console.log(item.name);
    //console.log(updateseeds);
    let uppername = item.name.toUpperCase();
    if(updateseeds.hasOwnProperty(uppername)) {
        let update = updateseeds[uppername];
        delete updateseeds[uppername];
        //console.log('this one');
        //console.log(item);
        //console.log(devices[update]);
        devices[update].discoveredBy = item.discoveredBy;
        devices[update].hostname = item.cdp.cdpCacheDeviceId;
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

let addARP = function(snmp) {
    //console.log(resp);
    let swarp = snmp.arp;
    let keys = Object.keys(swarp);
    //console.log(keys);
    for(let i = 0; i < keys.length; i++) {
        let location;
        let netindex = keys[i];
        if(subnettositemappings.hasOwnProperty(netindex)) {
            location = subnettositemappings[netindex];
        } else {
            location = snmp.location;
        }
        if(arp.hasOwnProperty(keys[i])) {
            /*console.log(swarp)
            console.log('handle duplicate arp entries');
            process.exit();*/
            if(arp[keys[i].hasOwnProperty(location)]) {
                try {
                    let entries = Object.keys(swarp[keys[i]][location]);
                    for(let j = 0; j < entries.length; j++) {
                        if(arp[keys[i]][location].hasOwnProperty(entries[j])===false) {
                            //console.log('Adding ' + entries[j] + ": " + swarp[keys[i]][entries[j]] + ' to ' + keys[i]);
                            arp[keys[i]][location][entries[j]] = swarp[keys[i]][location][entries[j]];
                        } else {
                            //console.log('Skipping ' + entries[j] + ": " + swarp[keys[i]][entries[j]] + ' because it already exists in ' + keys[i]);
                        }
                    }
                } catch(e) {
                    console.log(swarp[keys[i]]);
                    console.log(keys[i]);
                    console.log('this is what I\'m debugging');
                    process.exit();
                }
            } else {
                arp[keys[i]][location] = swarp[keys[i]];
            }
        } else {
            arp[keys[i]] = {}
            arp[keys[i]][location] = swarp[keys[i]];
        }
    }
}

let addNetworks = function(snmp) {
    //console.log(snmp);
    for(let i = 0; i < snmp.networks.length; i++) {
        let netindex = snmp.networks[i].network + '/' + snmp.networks[i].bitmask;
        let block = new Netmask(netindex);
        let location;
        if(subnettositemappings.hasOwnProperty(netindex)) {
            location = subnettositemappings[netindex];
        } else {
            location = snmp.location;
        }
        if(networks.hasOwnProperty(netindex)) {
            if(networks[netindex].location.hasOwnProperty(location)) {
                if(networks[netindex].location[location].name.indexOf(snmp.name) < 0) {
                    networks[netindex].location[location].name.push(snmp.name);
                }
                if(networks[netindex].location[location].ip.indexOf(snmp.networks[i].ip) < 0) {
                    networks[netindex].location[location].ip.push(snmp.networks[i].ip);
                }
            } else {
                networks[netindex].location[location] = {
                    name: [snmp.name],
                    ip: [snmp.networks[i].ip],
                    hosts: 0
                }
            }
                /*if(networks[netindex].location.indexOf(snmp.location) < 0) {
                    networks[netindex].location.push(snmp.location);
                }
            }*/
            /*if(networks[netindex].name.indexOf(snmp.name) < 0) {
                networks[netindex].name.push(snmp.name);
            }
            if(subnettositemappings.hasOwnProperty(netindex)) {
                networks[netindex].location = [subnettositemappings[netindex]];
            } else {
                if(networks[netindex].location.indexOf(snmp.location) < 0) {
                    networks[netindex].location.push(snmp.location);
                }
            }
            if(networks[netindex].ip.indexOf(snmp.networks[i].ip) < 0) {
                networks[netindex].ip.push(snmp.networks[i].ip);
            }*/
        } else {
            let network = {
                network: snmp.networks[i].network,
                cidr: snmp.networks[i].bitmask,
                location: {},
                //name: [snmp.name],
                //ip: [snmp.networks[i].ip],
                mask: snmp.networks[i].subnet,
                size: block.size
                //hosts: 0
            }
            network.location[location] = {
                name: [snmp.name],
                ip: [snmp.networks[i].ip],
                hosts: 0
            }
            //console.log(network);
            networks[netindex] = network;
        }
    }
    //console.log(snmp);
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
            let ssh = new sshlib();
            if (process.env.DEBUG == "TRUE") console.log("initiating SSH connection for host " + queue.running[nexthost].host);
            ssh.connect({host: queue.running[nexthost].host, port: 22, credentials: credentials, credentialcache, credentialcache}, function(err, ssh) {
                if(err) {
                    //console.log(err);
                    if (process.env.DEBUG == "TRUE") console.log("SSH connection failed for host " + queue.running[nexthost].host + ": " + err);
                } else {
                    //console.log(resp);
                    if (process.env.DEBUG == "TRUE") console.log("SSH connection succeeded for host " + queue.running[nexthost].host + ": " + JSON.stringify(ssh));
                    if(credentialcache.hasOwnProperty(queue.running[nexthost].host)) {
                        credentialcache[queue.running[nexthost].host]['ssh'] = ssh.credentialindex;
                    } else {
                        credentialcache[queue.running[nexthost].host] = {
                            ssh: ssh.credentialindex
                        }
                    }
                    /*credentialcache[queue.running[nexthost].host] = {
                        ssh: ssh.credentialindex
                    }*/
                }
                //console.log("here");
                //console.log(nexthost);
                //console.log(queue.running[nexthost]);
                pollHost(queue.running[nexthost], function(err, resp) {
                    //console.log(nexthost);
                    //console.log(queue.running[nexthost]);
                    //console.log(nexthost);
                    //console.log(err);
                    //console.log(resp);
                    if(err) {
                        addDevice('failed', {
                            queue: queue.running[nexthost],
                            ssh: ssh
                        });
                        //console.log('Failed to poll ' + nexthost + " (" + queue.running[nexthost].host + "): " + err);
                        //store failed device
                    } else {
                        //console.log('Successfully polled ' + nexthost);
                        //console.log(queue.running[nexthost]);
                        //let excludename = queue.running[nexthost].name
                        let excludename = queue.running[nexthost].host
                        if(queue.running[nexthost].hasOwnProperty('name')) {
                            excludename = queue.running[nexthost].name
                        }
                        if(ignorenetsfromhosts.hasOwnProperty(excludename)===false || ignorenetsfromhosts[excludename]===false) {
                            addNetworks(resp);
                        }
                        addARP(resp);
                        addDevice('discovered', {
                            queue: queue.running[nexthost],
                            snmp: resp,
                            ssh: ssh
                        });
                        //resp.neighbors = [];
                        for(let i = 0; i < resp.neighbors.length; i++) {
                            let pass = true;
                            for(let j = 0; j <= exclusions.length - 1; j++) {
                                //console.log(resp.data.neighbors[i].cdpCachePlatform + ' - ' + resp.data.neighbors[i].cdpCachePlatform.indexOf(exclude[i]));
                                if(resp.neighbors[i].cdpCachePlatform.indexOf(exclusions[j]) >= 0 ) {
                                    pass = false;
                                }
                            }
                            if(pass) {
                                let cdphost = resp.neighbors[i].cdpCacheAddress;
                                if(hostnametoipmappings.hasOwnProperty(resp.neighbors[i].cdpCacheDeviceId)) {
                                    cdphost = hostnametoipmappings[resp.neighbors[i].cdpCacheDeviceId]
                                }
                                //console.log(resp.neighbors[i].cdpCacheDeviceId);
                                queueAdd({
                                    host: cdphost,
                                    name: resp.neighbors[i].cdpCacheDeviceId,
                                    hostname: resp.neighbors[i].cdpCacheDeviceId,
                                    source: 'cdp',
                                    location: resp.location,
                                    description: resp.description,
                                    cdp: resp.neighbors[i],
                                    discoveredBy: resp.discoveredBy,
                                    discoveredNeighbors: resp.discoveredNeighbors
                                });
                            } else {
                                if(config.getexcluded) {
                                    excluded.push(resp.neighbors[i]);
                                }
                            }
                        }
                    }
                    queueComplete(queue.running[nexthost]);
                    processQueue(callback);
                });
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
            if(Object.keys(pollingroutes).length != 0) {
                console.log('Waiting 5 seconds for pending route table queries to complete');
                setTimeout(function() {
                    processQueue(callback);
                }, 5000);
            } else {
                let keys = Object.keys(networks)
                let netarr = [];
                for(let i = 0; i < keys.length; i++) {
                    //networks[keys[i]].key = keys[i];
                    if(arp.hasOwnProperty(keys[i])) {
                        let locationkeys = Object.keys(networks[keys[i]].location);
                        for(let j = 0; j < keys.length; j++) {
                            if(arp[keys[i]].hasOwnProperty(locationkeys[j])) {
                                let arpkeys = Object.keys(arp[keys[i]][locationkeys[j]]);
                                networks[keys[i]].location[locationkeys[j]].hosts = arpkeys.length;
                            }
                        }
                    }
                    netarr.push(networks[keys[i]]);
                }
                let response = {
                    devices: devices,
                    networks: netarr,
                    routes: routes,
                    arp: arp,
                    queue: queue,
                    errors: errors
                }
                if(config.getexcluded) {
                    response.excluded = excluded
                }
                callback(false, response);
            }
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

    let hostname;
    if(result.queue.hasOwnProperty('hostname')) {
        hostname = result.queue.hostname;
    } else {
        hostname = result.queue.host
    }

    let sshresult;
    let sshusername;
    let sshhandshake;
    let snmpuser;

    /*if(typeof result.ssh.error=='object') {
        console.log(result.ssh.error)
    }*/

    if(result.ssh.error) {
        sshresult = result.ssh.error.message
        sshusername = 'N/A';
        sshhandshake = 'N/A';
    } else {
        sshresult = 'Successful connection';
        sshusername = result.ssh.username;
        sshhandshake = JSON.stringify(result.ssh.handshake);
    }

    if(status=='failed') {
        device = {
            ip: result.queue.host,
            ips: [result.queue.host],
            stackmembers: null,
            stackmembercount: null,
            source: result.queue.source,
            name: index,
            hostname: hostname,
            snmpuser: 'N/A',
            snmpversion: 'N/A',
            status: status,
            discoveredBy: result.queue.discoveredBy,
            discoveredNeighbors: result.queue.discoveredNeighbors,
            location: '',
            description: '',
            os: '',
            version: '',
            sshresult: sshresult,
            sshusername: sshusername,
            sshhandshake: sshhandshake
        }
        if(result.queue.source != 'seed') {
            device.platform = result.queue.cdp.cdpCachePlatform;
            device.deviceId = result.queue.cdp.cdpCacheDeviceId;
        } else {
            device.platform = '';
            device.deviceId = '';
        }
    } else {
        let snmpuser;
        if(credentials.snmp[result.snmp.credential].version==2) {
            snmpuser = credentials.snmp[result.snmp.credential].community;
        } else {
            snmpuser = credentials.snmp[result.snmp.credential].user.name;
        }
        //console.log(result);
        index = result.snmp.name;
        hostname = result.snmp.hostname;
        let parsedesc = parseDescription(result.snmp.description);
        device = {
            ip: result.queue.host,
            ips: result.snmp.ips,
            stackmembers: result.snmp.stackmembers,
            stackmembercount: result.snmp.stackmembers.length,
            source: result.queue.source,
            name: index,
            hostname: hostname,
            snmpuser: snmpuser,
            snmpversion: credentials.snmp[result.snmp.credential].version,
            status: status,
            discoveredBy: result.queue.discoveredBy,
            discoveredNeighbors: result.queue.discoveredNeighbors,
            location: result.snmp.location,
            description: result.snmp.description,
            os: parsedesc.type,
            version: parsedesc.version,
            sshresult: sshresult,
            sshusername: sshusername,
            sshhandshake: sshhandshake
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
    if(config.DBHOST) {
        let sql = `INSERT INTO \`crawler_devices\` (
            \`name\`,
            \`status\`,
            \`ip\`,
            \`stack_members\`,
            \`snmpauth\`,
            \`snmpversion\`,
            \`location\`,
            \`description\`,
            \`os\`,
            \`version\`,
            \`platform\`,
            \`deviceid\`,
            \`discoveredby\`,
            \`ssh_result\`,
            \`ssh_username\`,
            \`ssh_handshake\`,
            \`first_discovered\`,
            \`last_discovered\`)
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
            \`name\` = VALUES(\`name\`),
            \`status\` = VALUES(\`status\`),
            \`ip\` = VALUES(\`ip\`),
            \`last_discovered\` = VALUES(\`last_discovered\`)`

        if(status=='failed') {
            //sql = sql + ')'
        } else {
            sql = sql + `,\n\`stack_members\` = VALUES(\`stack_members\`),
            \`snmpauth\` = VALUES(\`snmpauth\`),
            \`snmpversion\` = VALUES(\`snmpversion\`),
            \`location\` = VALUES(\`location\`),
            \`deviceid\` = VALUES(\`deviceid\`),
            \`discoveredby\` = VALUES(\`discoveredby\`),
            \`ssh_result\` = VALUES(\`ssh_result\`),
            \`ssh_username\` = VALUES(\`ssh_username\`),
            \`ssh_handshake\` = VALUES(\`ssh_handshake\`)`

            if(device.platform != null) {
                sql = sql + `\r\n,\`platform\` = VALUES(\`platform\`)`
            }

            if(device.description != null) {
                sql = sql + `\r\n,\`description\` = VALUES(\`description\`),
                \`os\` = VALUES(\`os\`),
                \`version\` = VALUES(\`version\`)`
            }
        }
        let values = [device.hostname, device.status, device.ip, device.stackmembercount, device.snmpuser, device.snmpversion, device.location, device.description, device.os, device.version, device.platform, device.deviceId, device.discoveredBy, device.sshresult, device.sshusername, device.sshhandshake];
        db.insert(sql, values, function(err, results, rows) {
            if(err) {
                errors.push(err);
                console.log(err);
            } else {
                //console.log(results)
            }
        });
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
    if (process.env.DEBUG == "TRUE") console.log("initiating session creation for host " + queue.host);
    poll.createSession({host: queue.host, credentials: credentials, credentialcache: credentialcache}, function(err, resp) {
        if(err) {
            callback(err, false);
        } else {
            //credentialcache[poll.getHostname().toUpperCase()].snmp = resp;
            if(credentialcache.hasOwnProperty(queue.host)) {
                credentialcache[queue.host]['snmp'] = resp;
            } else {
                credentialcache[queue.host] = {
                    snmp: resp
                }
            }
            /*credentialcache[queue.host] = {
                snmp: resp
            }*/
            poll.getOID("1.3.6.1.2.1.1.6.0", function(err, syslocation) {
                if(err) {
                    callback(err, false);
                } else {
                    poll.getOID("1.3.6.1.2.1.1.1.0", function(err, sysdescr) {
                        if(err) {
                            callback(err, false);
                        } else {
                            poll.getStackMembers(function(err, stackmembers) {
                                if(err) {
                                    callback(err, false);
                                } else {
                                    poll.getCDP(function(err, cdp) {
                                        if(err) {
                                            callback(err, false);
                                        } else {
                                            poll.getNetworks(function(err, networks) {
                                                //let device;
                                                if(err) {
                                                    callback(err, false);
                                                } else {
                                                    poll.getNetARPTables(function(err, arp) {
                                                        if(err) {
                                                            callback(err, false);
                                                        } else {
                                                            let ips = [];
                                                            for(let i = 0; i < networks.length; i++) {
                                                                ips.push(networks[i].ip);
                                                            }
                                                            callback(false, {
                                                                name: poll.getHostname().toUpperCase(),
                                                                hostname: poll.getHostname(),
                                                                location: syslocation.toString(),
                                                                description: sysdescr.toString(),
                                                                discoveredNeighbors: [poll.getHostname().toUpperCase()],
                                                                discoveredBy: poll.getHostname().toUpperCase(),
                                                                neighbors: cdp,
                                                                ips: ips,
                                                                stackmembers: stackmembers,
                                                                arp: arp,
                                                                networks: networks,
                                                                credential: resp
                                                            });
                                                        }
                                                        if(getroutetable.indexOf(poll.getHostname().toUpperCase()) >= 0) {
                                                            pollingroutes[poll.getHostname()];
                                                            poll.getRouteTable(function(err, r) {
                                                                if(err) {
                                                                    //callback(err, false);
                                                                    console.log('failed to get routes from ' + poll.getHostname());
                                                                } else {
                                                                    if(routes.hasOwnProperty(syslocation.toString())) {
                                                                        routes[syslocation.toString()][poll.getHostname()] = r;
                                                                    } else {
                                                                        routes[syslocation.toString()] = {}
                                                                        routes[syslocation.toString()][poll.getHostname()] = r;
                                                                    }
                                                                }
                                                                poll.closeSession(function() {
                                                                    //session closed
                                                                });
                                                                //console.log(routes[syslocation.toString()][poll.getHostname()][0]);
                                                                //console.log(routes[syslocation.toString()][poll.getHostname()][1]);
                                                                //console.log(routes[syslocation.toString()][poll.getHostname()][2]);
                                                                //process.exit();
                                                                delete pollingroutes[poll.getHostname()];
                                                                //processQueue();
                                                            });
                                                        } else {
                                                            poll.closeSession(function() {
                                                                //session closed
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
    this.run = function(seeds, exclude, getroutes, callback) {
        fs.readFile('./mappings.js', function(err, data) {
            if(err) {
                //do nothing
            } else {
                let mappings = JSON.parse(data.toString());
                if(mappings.hostnametoip) {
                    hostnametoipmappings = mappings.hostnametoip;
                }
                if(mappings.hostnametoip) {
                    subnettositemappings = mappings.subnettosite;
                }
                if(mappings.ignorenetsfromhosts) {
                    ignorenetsfromhosts = mappings.ignorenetsfromhosts;
                }
                //console.log(hostnametoipmappings);
            }
            exclusions = exclude;
            for(let i = 0; i < getroutes.length; i++) {
                getroutetable.push(getroutes[i].toUpperCase());
            }
            beginDiscovery(seeds, function(err, resp) {
                callback(err, resp);
            })
        });
    }
}