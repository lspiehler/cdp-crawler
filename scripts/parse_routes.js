const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
var Netmask = require('netmask').Netmask
var ipmapping = {}
var devices = [];
var networks = [];
var enrichedroutes = [];

fs.readFile('./reports/devices.js', 'utf-8', function(err, data) {
    if(err) {
        console.log(err);
    } else {
        devices = JSON.parse(data);
        for(let i = 0; i < devices.length; i++) {
            if(typeof(devices[i].ips) == 'string') {
                devices[i].ips = [devices[i].ips];
            }
            for(let j = 0; j < devices[i].ips.length; j++) {
                if(ipmapping.hasOwnProperty(devices[i].ips[j])) {
                    //console.log('duplicate ip ' + devices[i].ips[j]);
                    ipmapping[devices[i].ips[j]].push(i);
                } else {
                    if(devices[i].ips[j] != "") {
                        ipmapping[devices[i].ips[j]] = [i];
                    }
                }
            }
        }
        fs.readFile('./reports/routes.js', 'utf-8', function(err, data) {
            if(err) {
                console.log(err);
            } else {
                let routes = JSON.parse(data);
                let sites = Object.keys(routes);
                for(let i = 0; i < sites.length; i++) {
                    let devicekeys = Object.keys(routes[sites[i]]);
                    for(let j = 0; j < devicekeys.length; j++) {
                        for(let k = 0; k < routes[sites[i]][devicekeys[j]].routes.length - 1; k++) {
                            let nhkeys = Object.keys(routes[sites[i]][devicekeys[j]].routes[k].nextHop);
                            let mappeddevices = [];
                            let nexthops = [];
                            let nhprotocol = [];
                            let nhmetric = [];
                            let nhtype = [];
                            let nhsites = [];
                            for(let l = 0; l < nhkeys.length; l++) {
                                //if(routes[sites[i]][devicekeys[j]][k].nextHop != '0.0.0.0' && routes[sites[i]][devicekeys[j]][k].subnet != '255.255.255.255') {
                                    nexthops.push(nhkeys[l]);
                                    if(nhprotocol.indexOf(routes[sites[i]][devicekeys[j]].routes[k].nextHop[nhkeys[l]].protocol) < 0) {
                                        nhprotocol.push(routes[sites[i]][devicekeys[j]].routes[k].nextHop[nhkeys[l]].protocol);
                                    }
                                    if(nhmetric.indexOf(routes[sites[i]][devicekeys[j]].routes[k].nextHop[nhkeys[l]].metric) < 0) {
                                        nhmetric.push(routes[sites[i]][devicekeys[j]].routes[k].nextHop[nhkeys[l]].metric);
                                    }
                                    if(nhtype.indexOf(routes[sites[i]][devicekeys[j]].routes[k].nextHop[nhkeys[l]].type) < 0) {
                                        nhtype.push(routes[sites[i]][devicekeys[j]].routes[k].nextHop[nhkeys[l]].type);
                                    }
                                    if(ipmapping.hasOwnProperty(nhkeys[l])) {
                                        //console.log(devices[ipmapping[nhkeys[l]]]);
                                        //console.log(devices[ipmapping[nhkeys[l]]].name);
                                        for(let m = 0; m < ipmapping[nhkeys[l]].length; m++) {
                                            if(nhsites.indexOf(devices[ipmapping[nhkeys[l]][m]].location) < 0) {
                                                nhsites.push(devices[ipmapping[nhkeys[l]][m]].location);
                                            }
                                            mappeddevices.push(devices[ipmapping[nhkeys[l]][m]].name);
                                        }
                                    } else {

                                    }
                                //}
                            }
                            let rcidr = null;
                            let rsize = null;
                            let rfirst_address = null;
                            let rlast_address = null;
                            let rhostmask = null;
                            let rbroadcast = null;
                            try {
                                let block = new Netmask(routes[sites[i]][devicekeys[j]].routes[k].network + '/' + routes[sites[i]][devicekeys[j]].routes[k].mask);
                                rcidr = block.bitmask;
                                rsize = block.size;
                                rfirst_address = block.first;
                                rlast_address = block.last;
                                rhostmask = block.hostmask;
                                rbroadcast = block.broadcast;
                            } catch(e) {
                                //console.log(e);
                            }
                            let route = {
                                rfc: routes[sites[i]][devicekeys[j]].rfc,
                                site: sites[i],
                                device: devicekeys[j],
                                network: routes[sites[i]][devicekeys[j]].routes[k].network,
                                cidr: rcidr,
                                mask: routes[sites[i]][devicekeys[j]].routes[k].mask,
                                size: rsize,
                                first_address: rfirst_address,
                                last_address: rlast_address,
                                hostmask: rhostmask,
                                broadcast: rbroadcast,
                                nextHop: nexthops.join(','),
                                nextHopSites: nhsites.join(','),
                                nextHopDevices: mappeddevices.join(','),
                                protocol: nhprotocol.join(','),
                                metric: nhmetric.join(','),
                                type: nhtype.join(',')
                            }
                            networks.push(route);
                        }
                    }
                }
                //console.log(networks.length);
                //console.log(devices[0]);
                fs.writeFile('./reports/enriched_routes.js', JSON.stringify(networks, null, 4), function(err) {
                    if(err) {
                        console.log('failed to write routes file');
                    } else {
                        let headers = [];
                        let keys = Object.keys(networks[0]);
                        for(let i = 0; i < keys.length; i++) {
                            let header = {
                                id: keys[i],
                                title: keys[i]
                            }
                            headers.push(header);
                        }
                        const csvWriter = createCsvWriter({
                            path: './reports/enriched_routes.csv',
                            header: headers
                        });
                        csvWriter.writeRecords(networks)       // returns a promise
                            .then(() => {
                                console.log('...Done');
                        });
                    }
                });
            }
        });
    }
});