const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const prefixes = ['00:06:67', '00:15:9D', '00:C0:B7']
var upses = [];

fs.readFile('./reports/arp.js', 'utf-8', function(err, data) {
    if(err) {
        console.log(err);
    } else {
        let arp = JSON.parse(data);
        let networks = Object.keys(arp);
        for(let i = 0; i < networks.length; i++) {
            let locationkeys = Object.keys(arp[networks[i]]);
            for(let h = 0; h < locationkeys.length; h++) {
                //console.log(locationkeys);
                let ips = Object.keys(arp[networks[i]][locationkeys[h]]);
                for(let j = 0; j < ips.length; j++) {
                    let prefix = prefixes.indexOf(arp[networks[i]][locationkeys[h]][ips[j]].substring(0, 8))
                    if(prefix >= 0) {
                        //console.log(ips[j]);
                        //console.log(arp[networks[i]][ips[j]]);
                        let ups = {
                            ip: ips[j],
                            mac: arp[networks[i]][locationkeys[h]][ips[j]],
                            link: "http://" + ips[j],
                            vendor: null
                        }
                        switch(prefix) {
                            case 0:
                                ups.vendor = "Tripp Lite"
                                break;
                            case 1:
                                ups.vendor = "Tripp Lite"
                                break;
                            case 2:
                                ups.vendor = "APC"
                                break;
                        }
                        upses.push(ups);
                    }
                }
            }
        }
        console.log(upses.length);
        const upscsvWriter = createCsvWriter({
            path: './reports/upses.csv',
            header: [
                {id: 'ip', title: 'ip'},
                {id: 'mac', title: 'mac'},
                {id: 'vendor', title: 'vendor'},
                {id: 'link', title: 'link'}
            ]
        });
        upscsvWriter.writeRecords(upses)       // returns a promise
            .then(() => {
                console.log('...Done');
        });     
    }
});