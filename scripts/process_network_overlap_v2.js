var Netmask = require('netmask').Netmask
let config = require('../config');
const db = require('../lib/database');
const dbpool = require('../lib/db_conn');
const cidrignore = [32, 31];

var processNetworks = function(networks) {
    for(let i = 0; i < networks.length; i++) {
        if(networks[i].hasOwnProperty('overlap_detection') == false) {
            networks[i].overlap_detection = {};
        }
        let excludeoverlap = false;
        if(networks[i].exclude) {
            if(networks[i].exclude.indexOf('overlap') >= 0) {
                excludeoverlap = true;
            }
        }
        if(cidrignore.indexOf(networks[i].cidr) < 0 && networks[i].network != '127.0.0.0' && excludeoverlap === false) {
            //console.log(networks[i]);
            for(let j = 0; j < networks.length; j++) {
                //if(networks[index].location == networks[j].location || cidrignore.indexOf(networks[j].cidr) >= 0 || networks[j].network == '127.0.0.0') {
                if(i == j || cidrignore.indexOf(networks[j].cidr) >= 0 || networks[j].network == '127.0.0.0') {
                    //ignore network
                } else {
                    let block = new Netmask(networks[i].network + '/' + networks[i].cidr);
                    if(block.contains(networks[j].network)) {
                        let overlapindexi = networks[i].network + '/' + networks[i].cidr + ' at ' + networks[i].location
                        let overlapindexj = networks[j].network + '/' + networks[j].cidr + ' at ' + networks[j].location
                        if(networks[i].overlap_detection.hasOwnProperty(overlapindexj) == false) {
                            networks[i].overlap_detection[overlapindexj] = true
                        }
                        if(networks[j].hasOwnProperty('overlap_detection') == false) {
                            networks[j].overlap_detection = {};
                        }
                        if(networks[j].overlap_detection.hasOwnProperty(overlapindexi) == false) {
                            networks[j].overlap_detection[overlapindexi] = true
                        }
                    }
                }
            }
        } else {
            networks[i].overlap_override = 'ignore';
        }
    }

    return networks;
}

var updateOverlap = function(overlap, index, callback) {
    if(!index) {
        index = 0;
    }
    if(index < overlap.length) {
        let sql = `UPDATE \`crawler_networks\` SET overlap = ? WHERE \`id\` = ?`
        let values = [overlap[index].overlap, overlap[index].id];
        db.insert(sql, values, function(err, results, rows, sql) {
            if(err) {
                callback(err);
            } else {
                updateOverlap(overlap, index + 1, callback);
            }
        });
    } else {
        callback(false);
    }
}

/*var processNetworks = function(networks, index, callback) {
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
}*/

let sql = `SELECT * FROM \`crawler_networks\``
let values = [];
db.select(sql, values, function(err, results, rows, sql) {
    if(err) {

    } else {
        let networks = processNetworks(results);
        let alloverlap = [];
        for(let i = 0; i < networks.length; i++) {
            if(networks[i].overlap_override) {
                let overlap = {
                    id: networks[i].id,
                    overlap: networks[i].overlap_override
                }
                alloverlap.push(overlap);
            } else {
                let keys = Object.keys(networks[i].overlap_detection);
                if(keys.length > 0) {
                    let ola = keys.join(', ')
                    let overlap = {
                        id: networks[i].id,
                        overlap: ola
                    }
                    alloverlap.push(overlap);
                } else {
                    let overlap = {
                        id: networks[i].id,
                        overlap: null
                    }
                    alloverlap.push(overlap);
                }
            }
        }
        /*for(let i = 0; i < alloverlap.length; i++) {
            //if(alloverlap[i].overlap != 'ignore') {
                console.log(alloverlap[i]);
            //
        }*/
        updateOverlap(alloverlap, null, function(err) {
            dbpool.getPool().end();
            if(err) {
                console.log(err);
            } else {
                console.log('success');
            }
        });
    }
});