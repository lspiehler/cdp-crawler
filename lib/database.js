const dbwrite = require('./db_conn');
//const cryptoRandomString = require('crypto-random-string');

module.exports = {
	select: function(sql, values, callback) {
		//console.log(sql);
		let poolwrite = dbwrite.getPool();
		poolwrite.getConnection(function(err, connection) {
			if(err) {
				//console.log(callback);
				//console.log(err);
				callback(err, false, false);
				return;
			}
			if(values) {
				let query = connection.query(sql, values, function(err, results, rows) {
				//connection.query(sql, values, function(err, results, rows) {
					//console.log(query.sql);
					connection.release();
					if(err) {
						callback(err, null, null, query.sql);
					} else {
						callback(null, results, rows, query.sql);
					}
				});
			} else {
				let query = connection.query(sql, function(err, results, rows) {
				//connection.query(sql, function(err, results, rows) {
					connection.release();
					if(err) {
						callback(err, null, null, query.sql);
					} else {
						callback(null, results, rows, query.sql);
					}
				});
			}
		});
	},
	insert: function(sql, values, callback) {
		let poolwrite = dbwrite.getPool();
		poolwrite.getConnection(function(err, connection) {
			if(err) {
				callback(err, false, false);
				return;
			}
			if(values) {
				let query = connection.query(sql, values, function(err, results, rows) {
				//connection.query(sql, values, function(err, results, rows) {
					//console.log(query.sql);
					connection.release();
					if(err) {
						callback(err, null, null, query.sql);
					} else {
						callback(null, results, rows, query.sql);
					}
				});
			} else {
				let query = connection.query(sql, function(err, results, rows) {
				//connection.query(sql, function(err, results, rows) {
					connection.release();
					if(err) {
						callback(err, null, null, query.sql);
					} else {
						callback(null, results, rows, query.sql);
					}
				});
			}
		});
	},
	update: function(sql, values, callback) {
		this.insert(sql, values, function(err, results, rows, sql) {
			if(err) {
				callback(err, false, false, sql);
			} else {
				callback(false, results, rows, sql)
			}
		});
	},
	delete: function(sql, values, callback) {
		this.insert(sql, values, function(err, results, rows, sql) {
			if(err) {
				callback(err, false, false, sql);
			} else {
				callback(false, results, rows, sql)
			}
		});
	}
}