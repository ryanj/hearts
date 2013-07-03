#!/bin/env node
//  OpenShift sample Node application
var express = require('express');
var fs      = require('fs');
//    Hearts online - A multiplayer online Hearts card game 
//    Copyright (C) 2013  lellolandi <lellolandi@gmail.com> 

//    This program is free software: you can redistribute it and/or modify 
//    it under the terms of the GNU General Public License as published by 
//    the Free Software Foundation, either version 3 of the License, or 
//    (at your option) any later version. 

//    This program is distributed in the hope that it will be useful, 
//    but WITHOUT ANY WARRANTY; without even the implied warranty of 
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the 
//    GNU General Public License for more details. 

//    You should have received a copy of the GNU General Public License 
//    along with this program.  If not, see <http://www.gnu.org/licenses/>. 


//var host = "localhost";
//var port = 30000;
//var mysqluser = "root";
//var mysqlpasswd = "pippo";

var host = process.env.OPENSHIFT_NODEJS_IP || 'localhost';
var port = process.env.OPENSHIFT_NODEJS_PORT || 8000;
var mysqlhost = process.env.OPENSHIFT_MYSQL_DB_HOST || "localhost";
var mysqlport = process.env.OPENSHIFT_MYSQL_DB_PORT;
var user = process.env.OPENSHIFT_MYSQL_DB_USERNAME;
var password = process.env.OPENSHIFT_MYSQL_DB_PASSWORD;


function shuffle(o){
	for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
	return o;
};

function sortnumber(a,b){
	return a - b;
}

function multisort(mano){
	v = [[],[],[],[]];
	m = [];
	for (i=0;i<mano.length;i++){
		v[mano[i].seme-1].push(mano[i].valore);
	}
	for (i=0;i<4;i++){
		v[i].sort(sortnumber);
	}
	for (i=0;i<4;i++){
		for (j=0;j<v[i].length;j++){
			m.push({seme:i+1, valore:v[i][j]});
		}
	}
	return m;
}

function dai_carte(){
	mazzo = [];
	mani = [];
	for (i=2;i<15;i++){
		for (j=1;j<5;j++){
			mazzo.push({seme:j, valore:i});
		}
	}
	mazzo = shuffle(mazzo);
	for (k=0;k<4;k++){
		mano = [];
		for (z=k*13;z<(k+1)*13;z++){
			mano.push(mazzo[z]);
		}
		mano = multisort(mano);
		mani.push(mano);
	}
	return mani;
};

WebSocketServer = require('ws').Server;
console.log('starting');
var wss = new WebSocketServer({host:host, port:port});
console.log('starting.');
var newmysql = require('mysql');
console.log('starting..');
var mysql = newmysql.createConnection({
	host: mysqlhost,
	port: mysqlport,
	user: user,
	password : password,
});
console.log('starting...');
mysql.connect();
console.log('starting....');
mysql.query("use hearts", function(err,rows,fields){
	if (err != null){
		mysql.query("create database hearts");
		mysql.query("use hearts");
		mysql.query("create table users (id int not null auto_increment primary key, username text, password text, online int default 0, tavolo int default 0, ammonito int default 0) engine = innodb");
		mysql.query("create table tables (id int, pl1 text, pl2 text, pl3 text, pl4 text) engine = innodb");
		mysql.query("create table stats (nome text, giocate int default 0, vinte int default 0, perse int default 0, perc decimal(10,1) default 0) engine = innodb");
	}
});
var connections = [];
var players = [];
var atb = new Array();
console.log('starting.....');

function sendToAll(mess){
	for (i=0;i<connections.length;i++){
		connections[i].send(JSON.stringify(mess));
	}
}

function sendToTable(mess,id){
	for (i=0;i<atb[id].connections.length;i++){
		atb[id].connections[i].send(JSON.stringify(mess));
	}
}

function clean_on_exit(idtavolo,user){
	mysql.query("update users set tavolo = 0 where username = '" + user + "'");
	ind = atb[idtavolo].players.indexOf(user);
	atb[idtavolo].players.splice(ind,1);
	atb[idtavolo].connections.splice(ind,1);
	ind = players.indexOf(user);
	players.splice(ind,1);
	connections.splice(ind,1);
	if (atb[idtavolo].players.length == 0){
		atb.splice(idtavolo,1);
	}else{
		sendToTable({uscito:user},idtavolo);
	}
}

wss.on('connection', function(connection) {
	var username = "";

	connection.on('message', function(message) {
		console.log(message);
		msg = JSON.parse(message);
		if (msg.userreg != undefined){
			mysql.query("select * from users where username = '" + msg.userreg + "'", function(err,rows,fields) {
				if (rows.length > 0){
					connection.send(JSON.stringify({userregerror:1}));
				}else{
					connection.send(JSON.stringify({userregerror:0}));
					mysql.query("insert into users (username,password,online,tavolo,ammonito) values ('" + msg.userreg + "','" + msg.passreg + "',0,0,0)");
					mysql.query("insert into stats (nome,giocate,vinte,perse,perc) values ('" + msg.userreg + "',0,0,0,0)");
				}
			});
		}else if (msg.usrnewpwd != undefined){
			mysql.query("select * from users where username = '" + msg.usrnewpwd + "'", function(err,rows,fields) {
				mysql.query("update users set password = '" + msg.newpwd + "' where username = '" + msg.usrnewpwd + "'");
			});
		}else if (msg.username != undefined){
			mysql.query("select * from users where username = '" + msg.username + "' && password = '" + msg.password + "'", function(err,rows,fields) {
				if (rows.length == 0){
					connection.send(JSON.stringify({userlogerror:1}));
				}else if (rows[0].online == 1){
					connection.send(JSON.stringify({userlogerror:2}));
				}else{
					mysql.query("select * from users where online = 1", function(err,rows,fields) {
						onlines = [];
						for (i=0;i<rows.length;i++){
							onlines.push(rows[i].username);
						}
						mysql.query("update users set online = 1 where username = '" + msg.username + "'");
						username = msg.username;
						sendToAll({userlogin:username});
						players.push(username);
						connections.push(connection);
						mysql.query("select * from tables where 1", function(err,rows,fields) {
							mysql.query("select * from stats order by vinte desc", function(errr,rowss,fieldss) {
								connection.send(JSON.stringify({userlogin:username, pwd:msg.password.length, onlines:onlines, tavoli:rows, stats:rowss}));
							});
						});
					});
				}
			});
		}else if (msg.newtable != undefined){
			mysql.query("select * from users where username = '" + msg.newtable + "'", function(err,rows,fields) {
				mysql.query("insert into tables (id,pl1,pl2,pl3,pl4) values (" + rows[0].id + ",'" + msg.newtable + "','','','')");
				sendToAll({newtable:msg.newtable, id:rows[0].id});
			});
		}else if (msg.entertable != undefined){
			mysql.query("select * from tables where id = " + msg.id, function(err,rows,fields) {
				if (rows[0].pl2 == ""){
					ind = 2;
				}else if (rows[0].pl3 == ""){
					ind = 3;
				}else if (rows[0].pl4 == ""){
					ind = 4;
				}
				mysql.query("update tables set pl" + ind + " = '" + msg.entertable + "' where id = " + msg.id);
				if (ind == 4){
					mysql.query("select * from tables where id = " + msg.id, function(err,rows,fields) {
						gg = [rows[0].pl1,rows[0].pl2,rows[0].pl3,rows[0].pl4];
						mysql.query("update users set online = 0, tavolo = " + msg.id + " where username = '" + gg[0] + "'");
						mysql.query("update users set online = 0, tavolo = " + msg.id + " where username = '" + gg[1] + "'");
						mysql.query("update users set online = 0, tavolo = " + msg.id + " where username = '" + gg[2] + "'");
						mysql.query("update users set online = 0, tavolo = " + msg.id + " where username = '" + gg[3] + "'");
					
					/////////// comincia la partita
					
						atb[msg.id] = {connections:[], players:gg, pass:1, passate:[], viewed:0, clear:0, ready:0};
						carte = dai_carte();
						for (i=0;i<4;i++){
							atb[msg.id].connections.push(connections[players.indexOf(gg[i])]);
							atb[msg.id].connections[i].send(JSON.stringify({beginplayers:gg, id:msg.id}));
							atb[msg.id].connections[i].send(JSON.stringify({carte:carte[i], id:msg.id}));
						}
						mysql.query("delete from tables where id = " + msg.id);
					});
				}
				sendToAll({entertable:msg.entertable, id:msg.id, ind:ind});
			});
		}else if (msg.awayfromtable != undefined){
			mysql.query("select * from tables where id = " + msg.id, function(err,rows,fields) {
				if (rows[0].pl2 == msg.awayfromtable){
					ind = 2;
				}else if (rows[0].pl3 == msg.awayfromtable){
					ind = 3;
				}
				mysql.query("update tables set pl" + ind + " = '" + rows[0].pl3 + "', pl3 = '' where id = " + msg.id);
				sendToAll({awayfromtable:msg.awayfromtable, id:msg.id, ind:ind});
			});
		}else if (msg.destroytable != undefined){
			mysql.query("delete from tables where id = " + msg.destroytable);
			sendToAll({destroytable:msg.destroytable});
		}else if (msg.wantstats != undefined){
			v = ["nome","vinte","perse","giocate","perc"];
			mysql.query("select * from stats order by " + v[msg.wantstats] + " desc", function(err,rows,fields) {
				console.log(rows);
				connection.send(JSON.stringify({wantstats:rows}));
			});
		}
		
		/////// game side ///////
		
		else if (msg.text != undefined){
        	sendToTable(msg,msg.id);
        }else if (msg.passate != undefined){
      		atb[msg.id].passate.push(msg);
			if (atb[msg.id].passate.length == 4){
				for (i=0;i<4;i++){
					ind = atb[msg.id].players.indexOf(atb[msg.id].passate[i].nome);
					if (atb[msg.id].pass % 4 == 1){
						atb[msg.id].connections[(ind+1)%4].send(JSON.stringify({passate:atb[msg.id].passate[i].passate}));
					}else if (atb[msg.id].pass % 4 == 2){
						atb[msg.id].connections[(ind+3)%4].send(JSON.stringify({passate:atb[msg.id].passate[i].passate}));
					}else if (atb[msg.id].pass % 4 == 3){
						atb[msg.id].connections[(ind+2)%4].send(JSON.stringify({passate:atb[msg.id].passate[i].passate}));
					}
				}
				atb[msg.id].passate = [];
			}
		}else if (msg.viste != undefined){	
			atb[msg.id].viewed++;
			if (atb[msg.id].viewed == 4){
				atb[msg.id].viewed = 0;
				sendToTable({viste:1},msg.id);
			}
		}else if (msg.seme != undefined){
	    	sendToTable(msg,msg.id);
		}else if (msg.clear != undefined){
			atb[msg.id].clear++;
			if (atb[msg.id].clear == 4){
				sendToTable({clear:0},msg.id);
				atb[msg.id].clear = 0;
			}
		}else if (msg.ready != undefined){
			atb[msg.id].ready++;
			if (atb[msg.id].ready == 4){
				carte = dai_carte();
				for (i=0;i<4;i++){
					atb[msg.id].connections[i].send(JSON.stringify({carte:carte[i]}));
				}
				atb[msg.id].pass++;
			}
		}else if (msg.vinto != undefined){
			for (i=0;i<4;i++){
				mysql.query("update stats set giocate = giocate + 1 where nome = '" + atb[msg.id].players[i] + "'");
				if (atb[msg.id].players[i] == msg.vinto){
					mysql.query("update stats set vinte = vinte + 1 where nome = '" + msg.vinto + "'");
				}else{
					mysql.query("update stats set perse = perse + 1 where nome = '" + atb[msg.id].players[i] + "'");
				}
				mysql.query("update stats set perc = vinte*100/giocate where nome = '" + atb[msg.id].players[i] + "'");
			}
			sendToTable(msg,msg.id);
		}else if (msg.chiudo != undefined){
			clean_on_exit(msg.id,msg.chiudo);
		}
	});
	
	connection.on('close', function() {
		mysql.query("select * from users where username = '" + username + "' and online = 0", function(e,r,f) {
			if (r.length == 0){
				ind = players.indexOf(username);
				players.splice(ind,1);
				connections.splice(ind,1);
				mysql.query("select * from tables where pl1 = '" + username + "'", function(err,rows,fields) {
					if (rows.length > 0){
						mysql.query("delete from tables where id = " + rows[0].id);
						sendToAll({userlogout:username, table:rows[0].id});
					}else{
						mysql.query("select * from tables where pl2 = '" + username + "'", function(errr,rowss,fieldss) {
							if (rowss.length > 0){
								mysql.query("update tables set pl2 = '" + rowss[0].pl3 + "', pl3 = '' where id = " + rowss[0].id);
								sendToAll({userlogout:username, table:0, id:rowss[0].id});
							}else{
								mysql.query("select * from tables where pl3 = '" + username + "'", function(errrr,rowsss,fieldsss) {
									if (rowsss.length > 0){
										mysql.query("update tables set pl3 = '' where id = " + rowsss[0].id);
										sendToAll({userlogout:username, table:0, id:rowsss[0].id});
									}else{
										sendToAll({userlogout:username, table:0, id:0});
									}
								});
							}
						});
					}
				});
			}else{
				mysql.query("select * from users where username = '" + username + "'", function(err,rows,fields){
					if (rows[0].ammonito == 0){
						mysql.query("update users set ammonito = 1 where username = '" + username + "'");
					}else{
						mysql.query("update users set ammonito = 0 where username = '" + username + "'");
						mysql.query("update stats set vinte = vinte - 1 where nome = '" + username + "'");
						mysql.query("update stats set perc = vinte*100/giocate where nome = '" + username + "'");
					}
				});
				clean_on_exit(r[0].tavolo,username);
			}
			mysql.query("update users set online = 0 where username = '" + username + "'");
		});
		connection.close();
	});
})


/**
 *  Define the sample application.
 */
var SampleApp = function() {

    //  Scope.
    var self = this;


    /*  ================================================================  */
    /*  Helper functions.                                                 */
    /*  ================================================================  */

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function() {
        //  Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_INTERNAL_IP || process.env.OPENSHIFT_NODEJS_IP;
        self.port      = process.env.OPENSHIFT_INTERNAL_PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080;

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        };
    };


    /**
     *  Populate the cache.
     */
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = { 'index.html': '' };
        }

        //  Local cache for static content.
        self.zcache['index.html'] = fs.readFileSync('./index.html');
    };


    /**
     *  Retrieve entry (content) from cache.
     *  @param {string} key  Key identifying content to retrieve from cache.
     */
    self.cache_get = function(key) { return self.zcache[key]; };


    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function(sig){
        if (typeof sig === "string") {
           console.log('%s: Received %s - terminating sample app ...',
                       Date(Date.now()), sig);
           process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()) );
    };


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function(){
        //  Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };


    /*  ================================================================  */
    /*  App server functions (main app logic here).                       */
    /*  ================================================================  */

    /**
     *  Create the routing table entries + handlers for the application.
     */
    self.createRoutes = function() {
        self.routes = { };

        // Routes for /health, /asciimo, /env and /
        self.routes['/health'] = function(req, res) {
            res.send('1');
        };

        self.routes['/asciimo'] = function(req, res) {
            var link = "http://i.imgur.com/kmbjB.png";
            res.send("<html><body><img src='" + link + "'></body></html>");
        };

        self.routes['/env'] = function(req, res) {
            var content = 'Version: ' + process.version + '\n<br/>\n' +
                          'Env: {<br/>\n<pre>';
            //  Add env entries.
            for (var k in process.env) {
               content += '   ' + k + ': ' + process.env[k] + '\n';
            }
            content += '}\n</pre><br/>\n'
            res.send(content);
            res.send('<html>\n' +
                     '  <head><title>Node.js Process Env</title></head>\n' +
                     '  <body>\n<br/>\n' + content + '</body>\n</html>');
        };

        self.routes['/'] = function(req, res) {
            res.set('Content-Type', 'text/html');
            res.send(self.cache_get('index.html') );
        };
        
        self.routes['/'] = function(req, res) {
            res.set('Content-Type', 'text/html');
            res.send(self.cache_get('index.html') );
        };
    };


    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {
        self.createRoutes();
        self.app = express.createServer();

        //  Add handlers for the app (from the routes).
        for (var r in self.routes) {
            self.app.get(r, self.routes[r]);
        }
        self.app.use('/img', express.static(__dirname+'/img'));
        self.app.use('/themes', express.static(__dirname+'/themes'));
        self.app.use('/css', express.static(__dirname+'/css'));
        self.app.use('/js', express.static(__dirname+'/js'));
    };


    /**
     *  Initializes the sample application.
     */
    self.initialize = function() {
        self.setupVariables();
        self.populateCache();
        self.setupTerminationHandlers();

        // Create the express server and routes.
        self.initializeServer();
    };


    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function() {
        //  Start the app on the specific interface (and port).
        self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                        Date(Date.now() ), self.ipaddress, self.port);
        });
    };

};   /*  Sample Application.  */



/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();
zapp.start();
