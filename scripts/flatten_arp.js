const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const flatarp = {};

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
                    //console.log(ips[j]);
                    //console.log(arp[networks[i]][locationkeys[h]][ips[j]]);
                    if(flatarp.hasOwnProperty(ips[j])) {
                        if(flatarp[ips[j]] != arp[networks[i]][locationkeys[h]][ips[j]]) {
                            console.log('duplicate IP');
                        }
                    } else {
                        flatarp[ips[j]] = arp[networks[i]][locationkeys[h]][ips[j]];
                    }
                }
            }
        }
        fs.writeFile('./reports/flatarp.js', JSON.stringify(flatarp, null, 4), function(err) {
            if(err) {
                console.log('failed to write flat arp file');
            } else {

            }
        });
    }
});