var fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
var handlerlib = require("./lib/handler");
var config = require('./config');
const dbpool = require('./lib/db_conn');

var handler = new handlerlib();

//let seeds = ['10.254.20.1'];
let seeds = config.seeds
let exclusions = config.exclusions

//console.log(seeds);

handler.run(seeds, exclusions, function(err, resp) {
    if(err) {
        console.log(err);
    } else {
        //console.log(resp);
        fs.writeFile('./reports/devices.js', JSON.stringify(resp.devices, null, 4), function (err) {
            if(err) {
                console.log(err);
            }
        });
        fs.writeFile('./reports/networks.js', JSON.stringify(resp.networks, null, 4), function (err) {
            if(err) {
                console.log(err);
            }
        });
        const csvWriter = createCsvWriter({
            path: './reports/devices.csv',
            header: [
                {id: 'name', title: 'name'},
                {id: 'status', title: 'status'},
                {id: 'ip', title: 'ip'},
                {id: 'snmpuser', title: 'snmpauth'},
                {id: 'snmpversion', title: 'snmpversion'},
                {id: 'location', title: 'location'},
                {id: 'source', title: 'source'},
                {id: 'platform', title: 'platform'},
                {id: 'deviceId', title: 'deviceId'},
                {id: 'sshresult', title: 'ssh_result'},
                {id: 'sshusername', title: 'ssh_username'},
                {id: 'discoveredBy', title: 'discoveredBy'},
                {id: 'discoveredNeighbors', title: 'discoveredNeighbors'},
                {id: 'sshhandshake', title: 'ssh_handshake'}
            ]
        });
        csvWriter.writeRecords(resp.devices)       // returns a promise
            .then(() => {
                console.log('...Done');
        });

        const netcsvWriter = createCsvWriter({
            path: './reports/networks.csv',
            header: [
                {id: 'network', title: 'network'},
                {id: 'cidr', title: 'cidr'},
                {id: 'name', title: 'name'},
                {id: 'ip', title: 'ip'},
                {id: 'mask', title: 'mask'}
            ]
        });
        netcsvWriter.writeRecords(resp.networks)       // returns a promise
            .then(() => {
                console.log('...Done');
        });

        if(config.getexcluded) {
            fs.writeFile('./reports/excluded.js', JSON.stringify(resp.excluded, null, 4), function (err) {
                if(err) {
                    console.log(err);
                }
                dbpool.getPool().end();
                console.log(resp.errors);
            });
        }
    }
});