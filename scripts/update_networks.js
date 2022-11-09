var Netmask = require('netmask').Netmask
const fs = require('fs');
let config = require('../config');
const db = require('../lib/database');

var processNetworks = function(networks, index, callback) {
    if(!index) {
        index = 0;
    }
    if(index < networks.length) {
        //console.log(networks[index]);
        let block = new Netmask(networks[index].network + '/' + networks[index].cidr);
        //processNetworks(networks, index + 1, callback);
        let sql = `INSERT INTO \`crawler_networks\` (
            \`network\`,
            \`cidr\`,
            \`location\`,
            \`source\`,
            \`first_address\`,
            \`last_address\`,
            \`name\`,
            \`ip\`,
            \`mask\`,
            \`hostmask\`,
            \`broadcast\`,
            \`hosts\`,
            \`size\`,
            \`first_added\`,
            \`last_added\`)
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
            \`hosts\` = VALUES(\`hosts\`),
            \`source\` = VALUES(\`source\`),
            \`first_address\` = VALUES(\`first_address\`),
            \`last_address\` = VALUES(\`last_address\`),
            \`name\` = VALUES(\`name\`),
            \`ip\` = VALUES(\`ip\`),
            \`hostmask\` = VALUES(\`hostmask\`),
            \`broadcast\` = VALUES(\`broadcast\`),
            \`size\` = VALUES(\`size\`),
            \`last_added\` = NOW()
            `
        let keys = Object.keys(networks[index].location);
        for(let i = 0; i < keys.length; i++) {
            if(keys[i] != "") {
                //console.log(networks[index].location[keys[i]].ip);
                //console.log(networks[index].location[i]);
                let values = [networks[index].network, networks[index].cidr, keys[i], 'cdp_crawler', block.first, block.last, networks[index].location[keys[i]].name.join(', '), networks[index].location[keys[i]].ip.join(', '), networks[index].mask, block.hostmask, block.broadcast, networks[index].location[keys[i]].hosts, networks[index].size];
                db.insert(sql, values, function(err, results, rows, sql) {
                    if(err) {
                        callback(err);
                        return;
                    } else {
                        if(i == keys.length - 1) {
                            //console.log('last');
                            processNetworks(networks, index + 1, callback);
                        }
                    }
                });
            } else {
                if(i == keys.length - 1) {
                    //console.log('last');
                    processNetworks(networks, index + 1, callback);
                }
            }
        }
        /*let values = [networks[index].network, device.status, device.ip, device.stackmembercount, device.snmpuser, device.snmpversion, device.location, device.platform, device.deviceId, device.discoveredBy, device.sshresult, device.sshusername, device.sshhandshake];
        db.insert(sql, values, function(err, results, rows) {
            if(err) {*/
        
    } else {
        callback(false);
        return;
    }
}

fs.readFile('./reports/networks.js', 'utf-8', function(err, data) {
    if(err) {
        console.log(err);
    } else {
        let networks = JSON.parse(data);
        processNetworks(networks, null, function(err) {
            if(err) {
                console.log(err);
            } else {
                console.log('success');
                process.exit();
            }
        });
    }
});