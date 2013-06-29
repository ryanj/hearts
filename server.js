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
var wss = new WebSocketServer({host: "localhost", port: 30000});
var newmysql = require('mysql');
var mysql = newmysql.createConnection({
	host: 'localhost',
	user: 'root',
	password : 'pippo', //'g2JVud96hJ7fl',
});
mysql.connect();
mysql.query("use hearts");
var connections = [];
var players = [];
var atb = new Array();

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
	mysql.query("update users set tavolo = 0 where username = '" + user + "'", function(err,rows,fields) {});
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
					mysql.query("insert into users (username,password,online,table) values ('" + msg.userreg + "','" + msg.passreg + "',0,0)", function(err,rows,fields) {});
					mysql.query("insert into stats (nome,giocate,vinte,perse,perc) values ('" + msg.userreg + "',0,0,0,0)", function(err,rows,fields) {});
				}
			});
		}else if (msg.usrnewpwd != undefined){
			mysql.query("select * from users where username = '" + msg.usrnewpwd + "'", function(err,rows,fields) {
				mysql.query("update users set password = '" + msg.newpwd + "' where username = '" + msg.usrnewpwd + "'", function(err,rows,fields) {});
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
						mysql.query("update users set online = 1 where username = '" + msg.username + "'", function(err,rows,fields) {});
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
				mysql.query("insert into tables (id,pl1,pl2,pl3,pl4) values (" + rows[0].id + ",'" + msg.newtable + "','','','')", function(errr,rowss,fieldss) {});
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
				mysql.query("update tables set pl" + ind + " = '" + msg.entertable + "' where id = " + msg.id, function(err,rows,fields){});
				if (ind == 4){
					mysql.query("select * from tables where id = " + msg.id, function(err,rows,fields) {
						gg = [rows[0].pl1,rows[0].pl2,rows[0].pl3,rows[0].pl4];
						mysql.query("update users set online = 0, tavolo = " + msg.id + " where username = '" + gg[0] + "'", function(errr,rowss,fieldss) {});
						mysql.query("update users set online = 0, tavolo = " + msg.id + " where username = '" + gg[1] + "'", function(errr,rowss,fieldss) {});
						mysql.query("update users set online = 0, tavolo = " + msg.id + " where username = '" + gg[2] + "'", function(errr,rowss,fieldss) {});
						mysql.query("update users set online = 0, tavolo = " + msg.id + " where username = '" + gg[3] + "'", function(errr,rowss,fieldss) {});
					
					/////////// comincia la partita
					
						atb[msg.id] = {connections:[], players:gg, pass:1, passate:[], viewed:0, clear:0, ready:0};
						carte = dai_carte();
						for (i=0;i<4;i++){
							atb[msg.id].connections.push(connections[players.indexOf(gg[i])]);
							atb[msg.id].connections[i].send(JSON.stringify({beginplayers:gg, id:msg.id}));
							atb[msg.id].connections[i].send(JSON.stringify({carte:carte[i], id:msg.id}));
						}
						mysql.query("delete from tables where id = " + msg.id, function(err,rows,fields) {});
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
				mysql.query("update tables set pl" + ind + " = '" + rows[0].pl3 + "', pl3 = '' where id = " + msg.id, function(err,rows,fields) {});
				sendToAll({awayfromtable:msg.awayfromtable, id:msg.id, ind:ind});
			});
		}else if (msg.destroytable != undefined){
			mysql.query("delete from tables where id = " + msg.destroytable, function(err,rows,fields) {});
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
				mysql.query("update stats set giocate = giocate + 1 where nome = '" + atb[msg.id].players[i] + "'", function(err,rows,fields){});
				if (atb[msg.id].players[i] == msg.vinto){
					mysql.query("update stats set vinte = vinte + 1 where nome = '" + msg.vinto + "'", function(err,rows,fields) {});
				}else{
					mysql.query("update stats set perse = perse + 1 where nome = '" + atb[msg.id].players[i] + "'", function(err,rows,fields){});
				}
				mysql.query("update stats set perc = vinte*100/giocate where nome = '" + atb[msg.id].players[i] + "'", function(err,rows,fields){});
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
						mysql.query("delete from tables where id = " + rows[0].id, function(errr,rowss,fieldss) {});
						sendToAll({userlogout:username, table:rows[0].id});
					}else{
						mysql.query("select * from tables where pl2 = '" + username + "'", function(errr,rowss,fieldss) {
							if (rowss.length > 0){
								mysql.query("update tables set pl2 = '" + rowss[0].pl3 + "', pl3 = '' where id = " + rowss[0].id, function(e,r,f) {});
								sendToAll({userlogout:username, table:0, id:rowss[0].id});
							}else{
								mysql.query("select * from tables where pl3 = '" + username + "'", function(errrr,rowsss,fieldsss) {
									if (rowsss.length > 0){
										mysql.query("update tables set pl3 = '' where id = " + rowsss[0].id, function(e,r,f) {});
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
				clean_on_exit(r[0].tavolo,username);
			}
			mysql.query("update users set online = 0 where username = '" + username + "'", function(err,rows,fields) {});
		});
		connection.close();
	});
})
