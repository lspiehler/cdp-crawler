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

var pollDevice = function(params, callback) {
    getCredentials(function(err, credcache) {
        let sshl = new sshlib();
        //ssh.connect({host: params.host, port: 22, credentials: credentials, credentialcache: {}}, function(ssherr, ssh) {
        sshl.connect({host: params.host, port: 22, credentials: credentials, credentialcache: credcache}, function(ssherr, ssh) {
            //console.log(ssh);
            if(ssherr) {
                //console.log(err);
                //ssh.error = ssherr;
            } else {
                ssh.error = false;
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
                //console.log(snmpresult);
                let snmp;
                if(snmperr) {
                    //callback(err, false);
                    snmp = {
                        error: snmperr
                    }
                    callback(ssh, snmp);
                } else {
                    snmp = {
                        error: false,
                        hostname: poll.getHostname(),
                        result: snmpresult,
                        version: credentials.snmp[snmpresult].version
                    }
                    if(credcache.hasOwnProperty(params.host)) {
                        credcache[params.host]['snmp'] = snmpresult;
                    } else {
                        credcache[params.host] = {
                            snmp: snmpresult
                        }
                    }
                    poll.getOID("1.3.6.1.2.1.1.6.0", function(err, syslocation) {
                        //console.log(syslocation.toString());
                        if(err) {
                            //callback(err, false);
                            snmp.location = false;
                        } else {
                            //console.log(snmpresult);
                            //callback(false, ssh)
                            snmp.location = syslocation.toString();
                        }
                        poll.closeSession(function() {
                            //session closed
                        });
                        callback(ssh, snmp);
                    });
                }
            });
        });
    });
}

module.exports = function() {
    this.scan = function(params, callback) {
        pollDevice(params, function(ssh, snmp) {
            if(ssh.error==false || snmp.error==false) {
                //console.log(credentialcache[params.host]);
                writeCache();
            }
            //console.log(snmp);
            if(config.DBHOST) {
                let name;
                let status = 'discovered';
                let snmpuser;
                let snmpversion;
                let location;
                if(snmp.error) {
                    name = params.host;
                    status = 'failed'
                    snmpuser = 'N/A'
                    snmpversion = 'N/A'
                } else {
                    name = snmp.hostname;
                    location = snmp.location;
                    snmpversion = credentials.snmp[snmp.result].version.toString();
                    if(credentials.snmp[snmp.result].version == 2) {
                        snmpuser = credentials.snmp[snmp.result].community
                    } else {
                        snmpuser = credentials.snmp[snmp.result].user.name
                    }
                }
                let sshresult;
                let sshusername;
                let sshhandshake;
                //console.log(ssh.error);
                if(ssh.error) {
                    sshresult = ssh.error.err.toString();
                    //sshresult = ssh.error;
                    sshusername = 'N/A';
                    sshhandshake = 'N/A';
                } else {
                    sshresult = 'Successful connection';
                    sshusername = ssh.username;
                    sshhandshake = JSON.stringify(ssh.handshake);
                }
                let select = `SELECT \`id\`, \`name\`, \`location\`, \`snmpauth\`, \`snmpversion\` FROM \`crawler_devices\` WHERE \`ip\` = ?`
                let ipname = [params.host];
                db.select(select, ipname, function(err, results, rows, sqlquery) {
                    if(err) {
                        console.log(err);
                    } else {
                        ids = [];
                        for(let i = 0; i < results.length; i++) {
                            //console.log(results);
                            ids.push(results[i].id);
                            if(location) {

                            } else {
                                location = results[i].location;
                            }
                            if(snmpuser=='N/A') {
                                snmpuser = results[i].snmpauth;
                            }
                            if(snmpversion == 'N/A') {
                                snmpversion = results[i].snmpversion;
                            }
                            if(name == params.host) {
                                name = results[i].name;
                            }
                        }
                        //console.log(sqlquery);
                        //console.log(results);
                        //console.log(rows);
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
                                \`name\` = ?,
                                \`status\` = ?,
                                \`ip\` = ?,
                                \`snmpauth\` = ?,
                                \`snmpversion\` = ?,
                                \`deviceid\` = ?,
                                \`ssh_result\` = ?,
                                \`ssh_username\` = ?,
                                \`ssh_handshake\` = ?,
                                \`location\` = ?,
                                \`last_discovered\` = NOW()
                                WHERE \`id\` IN (?)
                            `
                            let values = [name, status, params.host, snmpuser, snmpversion, snmp.hostname, sshresult, sshusername, sshhandshake, location, ids];
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
            callback(false, {
                ssh: ssh,
                snmp: snmp
            });
        });
    }
}