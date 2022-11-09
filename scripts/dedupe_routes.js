const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

var deduperoutesht = {}
var deduperoutes = []

fs.readFile('./reports/enriched_routes.js', 'utf-8', function(err, data) {
    if(err) {
        console.log(err);
    } else {
        let routes = JSON.parse(data);
        for(let i = 0; i < routes.length; i++) {
            let index = routes[i].network + '/' + routes[i].mask
            if(deduperoutesht.hasOwnProperty(index)) {
                deduperoutesht[index].count++;
                if(deduperoutesht[index].sites.indexOf(routes[i].site) < 0) {
                    deduperoutesht[index].sites.push(routes[i].site);
                }
            } else {
                deduperoutesht[index] = {
                    network: routes[i].network,
                    mask: routes[i].mask,
                    cidr: routes[i].cidr,
                    size: routes[i].size,
                    first_address: routes[i].first_address,
                    last_address: routes[i].last_address,
                    hostmask: routes[i].hostmask,
                    broadcast: routes[i].broadcast,
                    sites: [routes[i].site],
                    count: 1
                }
            }
            //console.log(routes[i]);
            //break;
        }
        fs.writeFile('./reports/deduped_routes.js', JSON.stringify(deduperoutesht, null, 4), function(err) {
            if(err) {
                console.log('failed to write routes file');
            } else {
                let keys = Object.keys(deduperoutesht);
                for(let i = 0; i < keys.length; i++) {
                    deduperoutesht[keys[i]].sites = deduperoutesht[keys[i]].sites.join(',')
                    deduperoutes.push(deduperoutesht[keys[i]]);
                }
                let headers = [];
                let props = Object.keys(deduperoutes[0]);
                for(let i = 0; i < props.length; i++) {
                    let header = {
                        id: props[i],
                        title: props[i]
                    }
                    headers.push(header);
                }
                const csvWriter = createCsvWriter({
                    path: './reports/deduped_routes.csv',
                    header: headers
                });
                csvWriter.writeRecords(deduperoutes)       // returns a promise
                    .then(() => {
                        console.log('...Done');
                });
            }
        })
    }
});