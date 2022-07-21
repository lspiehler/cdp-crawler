const mysql = require('mysql');
const config = require('../config');
var fs = require('fs');

function getMySQLSSL(ca) {
	//console.log(ca);
	let mysqlca = {};
	if(ca) {
		if(ca.indexOf('-----BEGIN') >= 0) {
			mysqlca.ca = ca;
		} else {
			var certpath = './certs/' + ca;
			mysqlca.ca = fs.readFileSync(certpath);
		}
		return mysqlca;
	} else {
		return false;
	}
}

var pool;
module.exports = {
	getPool: function () {
		if (pool) return pool;
		pool = mysql.createPool({
			host     : config.DBHOST,
			user     : config.DBUSER,
			password : config.DBPASS,
			database : config.DBNAME,
			charset : 'utf8mb4',
			port: config.DBPORT
		});
		return pool;
	}
};