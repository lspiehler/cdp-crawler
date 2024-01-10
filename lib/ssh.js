const { Console } = require('console');
const { Client } = require('ssh2');
const ssh2s = require("ssh2-streams");
const { setTimeout } = require('timers');

module.exports = function() {

    let finished = false;

    this.connect = function(params, callback) {
        connect(params, 0, true, function(err, resp) {
            if(finished) {
                //console.log(params.host);
                //console.trace();
                //throw "ssh callback called twice"
                return;
                //process.exit();
            } else {
                finished = true;
                callback(err, resp);
            }
        });
    }

    var connect = function(params, credindex, cacheenabled, callback) {
        if (process.env.DEBUG == "TRUE") console.log("Trying credential " + credindex + " on " + params.host);
        let finished = false;
        let success = false;
        let handshake;
        if(!credindex) {
            credindex = 0;
        }
        //console.log(params.credentials.ssh[credindex]);
        //session.close()
        //console.log(credindex);
        //console.log(params.credentials.ssh.length);
        if(credindex < params.credentials.ssh.length) {
            let username;
            let password;
            let cached = false;
            if(params.credentialcache.hasOwnProperty(params.host) && params.credentialcache[params.host].ssh && cacheenabled && params.credentialcache[params.host].ssh <= params.credentials.ssh.length - 1) {
                cached = true;
                //console.log(params.credentials.ssh[params.credentialcache[params.host]]);
                username = params.credentials.ssh[params.credentialcache[params.host].ssh].username;
                password = params.credentials.ssh[params.credentialcache[params.host].ssh].password;
            } else {
                username = params.credentials.ssh[credindex].username;
                password = params.credentials.ssh[credindex].password;
            }
            //console.log(username);
            const conn = new Client();
            /*let timeout = setTimeout(function() {
                //conn.end();
                conn.destroy();
                callback('manual timeout triggered', {
                    error: 'manual timeout triggered'
                });
                timeout = null;
                return;
            }, 20000);*/
            conn.on('ready', () => {
                /*if(timeout) {
                    clearTimeout(timeout);
                }*/
                success = true;
                conn.end();
                /*conn.exec('show version', (err, stream) => {
                    const stdoutbuff = [];
		            const stderrbuff = [];
                    if (err) throw err;
                    stream.on('close', (code, signal) => {
                        console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                        conn.end();
                        callback(false, {
                            error: false,
                            handshake: handshake,
                            credentialindex: credindexresult,
                            stdout: Buffer.concat(stdoutbuff).toString(),
                            stderr: Buffer.concat(stderrbuff).toString()
                        });
                    }).on('data', (data) => {
                        //console.log('STDOUT: ' + data);
                        stdoutbuff.push(data);
                    }).stderr.on('data', (data) => {
                        //console.log('STDERR: ' + data);
                        stderrbuff.push(data);
                    });
                });*/
            })

            conn.on('end', function() {
                if (process.env.DEBUG == "TRUE") console.log("SSH connection using credential " + credindex + " ended on " + params.host);
                if(finished == false) {
                    finished = true;
                    let credindexresult;
                    if(cached) {
                        credindexresult = params.credentialcache[params.host].ssh;
                    } else {
                        credindexresult = credindex;
                    }
                    //console.log(finished);
                    if(success) {
                        callback(false, {
                            error: false,
                            handshake: handshake,
                            credentialindex: credindexresult,
                            username: params.credentials.ssh[credindexresult].username
                        });
                    } else {
                        if(cached) {
                            connect(params, 0, false, callback);
                        } else {
                            connect(params, credindex + 1, cacheenabled, callback);
                        }
                    }
                }
            });
        
            conn.on('error', function(err) {
                /*if(timeout) {
                    clearTimeout(timeout);
                }*/
                //console.log(err);
                if (process.env.DEBUG == "TRUE") console.log("SSH connection error with credential " + credindex + " on " + params.host + ": " + err);
                if(finished==false) {
                    finished = true;
                    if(err.level=='client-authentication') {
                        if(cached) {
                            connect(params, 0, false, callback);
                        } else {
                            connect(params, credindex + 1, cacheenabled, callback);
                        }
                    } else {
                        callback(err, {
                            error: {
                                err: err,
                                message: err.toString()
                            }
                        });
                    }
                }
            })

            //adding key exchanges for crappy hardware
            //let customkex = ssh2s.constants.ALGORITHMS.SUPPORTED_KEX;
            //customkex.push('diffie-hellman-group1-sha1');
        
            let connection = conn.connect({
                host: params.host,
                port: params.port,
                username: username,
                password: password,
                algorithms: {
                    kex: ssh2s.constants.ALGORITHMS.SUPPORTED_KEX,
                    cipher: [
                        'aes128-ctr',
                        'aes192-ctr',
                        'aes256-ctr',
                        'aes128-gcm@openssh.com',
                        'aes256-gcm@openssh.com',
                        'aes256-cbc',
                        'aes192-cbc',
                        'aes128-cbc',
                        'blowfish-cbc',
                        '3des-cbc',
                        'arcfour256',
                        'arcfour128',
                        'cast128-cbc',
                        'arcfour'
                    ],
                    serverHostKey: ssh2s.constants.ALGORITHMS.SERVER_HOST_KEY_BUF, 
                    hmac: ssh2s.constants.ALGORITHMS.SUPPORTED_HMAC,
                    compress: ssh2s.constants.ALGORITHMS.SUPPORTED_COMPRESS
                }
            });

            connection.on('handshake', function(data) {
                //finished = true;
                handshake = data;
            });
        } else {
            //console.log('estamos aqui');
            finished = true;
            callback('All SSH credentials failed', {
                error: {
                    err: 'All SSH credentials failed',
                    message: 'All SSH credentials failed'
                }
            });
        }
    }
}