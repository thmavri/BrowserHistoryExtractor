module.exports = function(app) {
	
	//var mysql = require('mysql');
	//var dbconfig = require('../config/database');
	//var connection = mysql.createConnection(dbconfig.connection);
	//var connection = require('../config/ConnectConstant.js');
	var connection;
	var fs = require('fs');
	var qs = require('qs');
	// show the home page (will also have our login links)
	app.get('/', function(req, res) {
		res.render('index.ejs');
	});
	app.post('/', function(req, res){
	    console.log('POST /');
	    console.dir(req.body);
    	res.writeHead(200, {'Content-Type': 'text/html'});
    	res.end('thanks');
	});
	
}


