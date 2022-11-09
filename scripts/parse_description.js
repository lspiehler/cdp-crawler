let config = require('../config');
const db = require('../lib/database');
const dbpool = require('../lib/db_conn');

var parseDescription = function(result) {
    let description = result.description;
    let response = {
        type: null,
        version: null
    }
    if(description && description != '') {
        //console.log(description);
        //console.log(result.name);
        let version = description.substr(description.indexOf('Version ') + 8).split(' ')[0].replace(',', '');
        //console.log(version);
        if(description.indexOf('IOS-XE')) {
            response.type = 'IOS-XE';
            response.version = version;
        } else if(description.indexOf('NX-OS')) {
            response.type = 'NX-OS';
            response.version = version;
        } else if(description.indexOf('IOS')) {
            response.type = 'IOS';
            response.version = version;
        } else if(description.indexOf('Adaptive Security Appliance')) {
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

//console.log(networks[index]);
let sql = `SELECT * FROM \`crawler_devices\``
let values = []
db.insert(sql, values, function(err, results, rows, sql) {
    /*if(networks[index].network == "192.168.64.0") {
        console.log(networks[index]);
        console.log(sql);
    }*/
    dbpool.getPool().end();
    if(err) {
        console.log(err);
        //return;
    } else {
        for(let i = 0; i < results.length; i++) {
            console.log(parseDescription(results[i]));
        }
    }
});