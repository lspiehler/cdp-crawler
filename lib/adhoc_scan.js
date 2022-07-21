let poller = require('./poll');
let credentials = require('../credentials');
let sshlib = require('./ssh');
let config = require('../config');
const db = require('./database');
let fs = require('fs');
var credentialcache;

var getCredentials = function(callback) {
    if(credentialcache) {
        callback(false, credentialcache);
    } else {
        fs.stat('./cache/credentialcache.js', function (err, data) {
            if (err) {
                //console.log('no cached credentials');
                credentialcache = {};
            } else {
                //credentialcache = JSON.parse(data.toString());
                credentialcache = require('../cache/credentialcache');
            } 
            callback(false, credentialcache);
        });
    }
}

let writeCache = function(timeronly) {
    console.log("writing cache");
    fs.writeFile('./cache/credentialcache.js', "module.exports = " + JSON.stringify(credentialcache, null, 4), function (err) {
        if(err) console.log(err);
        //console.log(credentialcachetimer);
    });
}

module.exports = function() {
    this.scan = function(params, callback) {
        //console.log(params);
        getCredentials(function(err, credcache) {
            let ssh = new sshlib();
            //ssh.connect({host: params.host, port: 22, credentials: credentials, credentialcache: {}}, function(ssherr, ssh) {
            ssh.connect({host: params.host, port: 22, credentials: credentials, credentialcache: credcache}, function(ssherr, ssh) {
                if(ssherr) {
                    //console.log(err);
                } else {
                    if(credcache.hasOwnProperty(params.host)) {
                        credcache[params.host]['ssh'] = ssh.credentialindex;
                    } else {
                        credcache[params.host] = {
                            ssh: ssh.credentialindex
                        }
                    }
                    //callback(false, credcache);
                    //console.log(ssh);
                }
                let poll = new poller();
                poll.createSession({host: params.host, credentials: credentials, credentialcache: credcache}, function(snmperr, snmpresult) {
                    let snmp;
                    if(snmperr) {
                        //callback(err, false);
                        snmp = {
                            error: snmperr
                        }
                    } else {
                        //console.log(snmpresult);
                        //callback(false, ssh)
                        snmp = {
                            error: false,
                            hostname: poll.getHostname(),
                            version: credentials.snmp[snmpresult].version
                        }
                        if(credcache.hasOwnProperty(params.host)) {
                            credcache[params.host]['snmp'] = snmpresult;
                        } else {
                            credcache[params.host] = {
                                snmp: snmpresult
                            }
                        }
                        poll.closeSession(function() {
                            //session closed
                        });
                    }
                    if(ssherr==false || snmperr==false) {
                        //console.log(credentialcache[params.host]);
                        writeCache();
                    }
                    if(config.DBHOST) {
                        let name;
                        let status = 'discovered';
                        let snmpuser;
                        let snmpversion;
                        if(snmp.error) {
                            name = params.host;
                            status = 'failed'
                            snmpuser = 'N/A'
                            snmpversion = 'N/A'
                        } else {
                            name = snmp.hostname;
                            snmpversion = credentials.snmp[snmpresult].version.toString();
                            if(credentials.snmp[snmpresult].version == 2) {
                                snmpuser = credentials.snmp[snmpresult].community
                            } else {
                                snmpuser = credentials.snmp[snmpresult].user.name
                            }
                        }
                        let sshresult;
                        let sshusername;
                        let sshhandshake;
                        //console.log(ssh.error.err.toString());
                        if(ssh.error) {
                            sshresult = ssh.error.err.toString();
                            sshusername = 'N/A';
                            sshhandshake = 'N/A';
                        } else {
                            sshresult = 'Successful connection';
                            sshusername = ssh.username;
                            sshhandshake = JSON.stringify(ssh.handshake);
                        }
                        let select = `SELECT \`id\` FROM \`crawler_devices\` WHERE \`ip\` = ?`
                        let ipname = [params.host];
                        db.select(select, ipname, function(err, results, rows, sqlquery) {
                            if(err) {
                                console.log(err);
                            } else {
                                if(results.length > 0) {
                                    //console.log(rows);
                                    //console.log(results)
                                    //console.log(sqlquery)
                                    /*let sql = `INSERT INTO \`crawler_devices\` (
                                        \`name\`,
                                        \`status\`,
                                        \`ip\`,
                                        \`snmpauth\`,
                                        \`snmpversion\`,
                                        \`deviceid\`,
                                        \`ssh_result\`,
                                        \`ssh_username\`,
                                        \`ssh_handshake\`,
                                        \`first_discovered\`,
                                        \`last_discovered\`)
                                        VALUES
                                        (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                                        ON DUPLICATE KEY UPDATE
                                        \`status\` = VALUES(\`status\`),
                                        \`ip\` = VALUES(\`ip\`),
                                        \`snmpauth\` = VALUES(\`snmpauth\`),
                                        \`snmpversion\` = VALUES(\`snmpversion\`),
                                        \`deviceid\` = VALUES(\`deviceid\`),
                                        \`ssh_result\` = VALUES(\`ssh_result\`),
                                        \`ssh_username\` = VALUES(\`ssh_username\`),
                                        \`ssh_handshake\` = VALUES(\`ssh_handshake\`),
                                        \`last_discovered\` = VALUES(\`last_discovered\`)
                                        `*/
                                    let sql = `UPDATE \`crawler_devices\` SET
                                        \`status\` = ?,
                                        \`ip\` = ?,
                                        \`snmpauth\` = ?,
                                        \`snmpversion\` = ?,
                                        \`deviceid\` = ?,
                                        \`ssh_result\` = ?,
                                        \`ssh_username\` = ?,
                                        \`ssh_handshake\` = ?,
                                        \`last_discovered\` = NOW()
                                        WHERE \`id\` = ?
                                    `
                                    let values = [status, params.host, snmpuser, snmpversion, snmp.hostname, sshresult, sshusername, sshhandshake, results[0].id];
                                    db.insert(sql, values, function(err, results, rows) {
                                        if(err) {
                                            console.log(err);
                                        } else {
                                            //console.log(results)
                                        }
                                    });
                                }
                            }
                        });
                    }
                    callback(err, {
                        ssh: ssh,
                        snmp: snmp
                    });
                });
            })
        });
    }
}