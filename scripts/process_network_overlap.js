var Netmask = require('netmask').Netmask
let config = require('../config');
const db = require('../lib/database');
const dbpool = require('../lib/db_conn');
const cidrignore = [32, 31];

var processNetworks = function(networks, index, callback) {
    if(!index) {
        index = 0;
    }
    if(index < networks.length) {
        let sqloverlap = null;
        if(cidrignore.indexOf(networks[index].cidr) < 0 && networks[index].network != '127.0.0.0') {
            var overlap = [];
            for(let j = 0; j < networks.length; j++) {
                //if(networks[index].location == networks[j].location || cidrignore.indexOf(networks[j].cidr) >= 0 || networks[j].network == '127.0.0.0') {
                if(index == j || cidrignore.indexOf(networks[j].cidr) >= 0 || networks[j].network == '127.0.0.0') {
                    //ignore network
                } else {
                    let block = new Netmask(networks[index].network + '/' + networks[index].cidr);
                    if(block.contains(networks[j].network)) {
                        overlap.push(networks[j]);
                        //break;
                    }
                }
            }
            
            var overlaparray = [];
            if(overlap.length > 0) {
                for(let i = 0; i < overlap.length; i++) {
                    console.log(networks[index].network + '/' + networks[index].cidr + ' at ' + networks[index].location + ' overlaps with ' + overlap[i].network + '/' + overlap[i].cidr + ' at ' + overlap[i].location);
                    overlaparray.push(overlap[i].network + '/' + overlap[i].cidr + ' at ' + overlap[i].location);
                }
                sqloverlap = overlaparray.join(',');
                if(sqloverlap.length > 500) {
                    sqloverlap = sqloverlap.substring(0, 495) + "...";
                }
            }
        } else {
            sqloverlap = 'ignored';
        }
        let sql = `UPDATE \`crawler_networks\` SET overlap = ? WHERE \`id\` = ?`
        let values = [sqloverlap, networks[index].id];
        db.insert(sql, values, function(err, results, rows, sql) {
            if(err) {
                callback(err);
            } else {
                processNetworks(networks, index + 1, callback);
            }
        });
    } else {
        callback(false);
    }
}

let sql = `SELECT * FROM \`crawler_networks\``
let values = [];
db.select(sql, values, function(err, results, rows, sql) {
    if(err) {

    } else {
        processNetworks(results, null, function(err) {
            dbpool.getPool().end();
            if(err) {
                console.log(err);
            } else {
                console.log('success');
            }
        });
    }
});