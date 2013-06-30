hearts-websocket
================

A multiplayer online Hearts card game application using 'websocket' nodejs module.<br>
This software is distributed under the General Public Licence.

<h3>Compile dependencies:</h3>

<pre>
$ cd hearts
$ rm -R node_modules
$ npm install
</pre>

<h3>Make a few changes to set ipaddr, port and database:</h3>

Change 'host', 'port' and 'mysqlpasswd' variables in <i>server.js</i><br>
Change websocket address and port in <i>index.html</i>

<h3>Run:</h3>

<pre>
$ node server.js
</pre>
