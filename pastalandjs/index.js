
var sqlite3 = require('sqlite3').verbose();
var fs = require('fs');
var db;

var express = require('express')
var app = express()
var path = require('path');

var PORT = 41234;
var HOST = '127.0.0.1';
var dgram = require('dgram');
var server = dgram.createSocket('udp4');

server.on('error', (err) => {
  console.log(`server error:\n${err.stack}`);
  server.close();
});

server.on('listening', () => {
  var address = server.address();
  console.log(`server listening ${address.address}:${address.port}`);
});

server.on('message', (msg, rinfo) => {
 
  var request = JSON.parse(msg);
  switch (request.command) {
    //case
    case "register stats":
      onRegisterStats(request);
      populateRows();
      break;
    case "connected":
      onConnection(request, rinfo);
      break;
    case "get names":
      onGetNames(request, rinfo);
      break;
    case "get rank":
      onGetRank(request, rinfo);
      break;
    default:
      console.log("You did something horribly wrong.");
  }
});

/**
 * Creates the database if it doesn't exist yet or use an existing one
 */
function createDb() {
    console.log("Creating db");
    db = new sqlite3.Database("pastaland.db", createTables);
}

/**
 *  Creates the empty database tables
 */
function createTables() {
    console.log("Creating tables");
    var playersTable = "CREATE TABLE IF NOT EXISTS players(" +
    "id INTEGER PRIMARY KEY, " +
    "name TEXT UNIQUE, " +
    "matches INTEGER, " + 
    "frags INTEGER , " +
    "deaths INTEGER, " +
    "flags INTEGER, " +
    "stolen INTEGER, " +
    "tk INTEGER, " +
    "passes INTEGER, " +
    "shots INTEGER," +
    "damage INTEGER," +
    "lastseen DATETIME);";
    db.run(playersTable)
    
    var connectionsTable = "CREATE TABLE IF NOT EXISTS ips(" +
    "id INTEGER PRIMARY KEY, " +
    "name TEXT, " +
    "ip TEXT, " + 
    "clock DATETIME);"; 
    //"FOREIGN KEY (name) REFERENCES players(name) );" //let's not enforce foreign keys
    db.run(connectionsTable/*, insertRows*/);
}

/**
 * When the server receives a "register stats" command
 */
function onRegisterStats(request) {
    
    var n = request.name;
    console.log("Will register status of " + n);
    
    //Search if player's name is already in the db
    db.all("SELECT * FROM players WHERE name = ? LIMIT 1", n, function(err, rows){
       if (err) {
        console.log("ERROR: " + err);
        return;
      }
      console.log("Did my search, rows.length = " + rows.length);
      if(rows.length == 0){  // not found, add it to the database
        console.log("Name " + n + " not found. Let me add it to the database.");
        db.run("INSERT INTO players VALUES(null, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, datetime('now'))", {
          1: request.name,
          2: 1,
          3: request.frags,
          4: request.deaths,
          5: request.flags,
          6: request.stolen,
          7: request.tk,
          8: request.passes,
          9: request.shots,
          10: request.damage
        }, function(err){
              if (err) { console.log("ERROR: " + err); return; }   
        });
      } else {                // found, update the database entry
        console.log("Name " + n + " found. Let me update it");
        db.run("UPDATE players SET matches=?1, frags=?2, deaths=?3, flags=?4, stolen=?5, tk=?6, passes=?7, shots=?8, damage=?9, lastseen=datetime('now')  WHERE name = ?10", {
          1: rows[0].matches + 1,
          2: rows[0].frags + request.frags,
          3: rows[0].deaths + request.deaths,
          4: rows[0].flags + request.flags,
          5: rows[0].stolen + request.stolen,
          6: rows[0].tk + request.tk,
          7: rows[0].passes + request.passes,
          8: rows[0].shots + request.shots,
          9: rows[0].damage + request.damage,
          10: request.name
        }, function(err){
              if (err) { console.log("ERROR: " + err); return; }   
        });
      }
    });
}

/**
 * When the server receives a "connection" command
 */
function onConnection(request, rinfo) {
    var n = request.name;
    var ip = request.ip;
    
    //Search if player's name is already in the db
    db.all("SELECT * FROM players WHERE name = ? LIMIT 1", n, function(err, rows){
      if (err) {
        console.log("ERROR: " + err);
        return;
      }
      if(rows.length == 0){  // not found, do nothing
        //console.log("Name " + n + " not found.");
      } else { // found, let's return the player's data to Spaghettimod
       
        //console.log("Name " + n + " found, I'll send back some stats")
        var response = rows[0];
        
        //calculate the rank based on the damage 
        db.all("SELECT * FROM players WHERE damage > ?", rows[0].damage, function(err, rankRows){
          if (err) {
            console.log("ERROR: " + err);
            return;
          }
          
          response.command = "user description";
          response.rank = rankRows.length + 1
          var str = JSON.stringify(rows[0])
          var message = new Buffer(str);
          server.send(message, 0, message.length, rinfo.port, rinfo.address, (err)=> {
            if(err) console.log("Error sending message back to spaghettimod");
          });
        });
      }
    });
    
    //Log every connection into the ips table
    db.run("INSERT INTO ips (name, ip, clock) VALUES (?,?,datetime('now'))", n, ip, function(err, rows){
      if (err) {
        console.log("ERROR: " + err);
        return;
      }
    });
}

/**
 * When the server receives a "get names" command
 * request.sender = name of the user doing the request
 * request.ip = ip for which we want the names
 */
function onGetNames(request, rinfo) {
    var sender = request.sender;
    var ip = request.ip;
    
    db.all("SELECT DISTINCT name, ip FROM ips WHERE ip like ? ", ip, function(err, rows){
      if (err) {
        console.log("ERROR: " + err);
        return;
      }
      if(rows.length == 0){  // not found
        console.log("No names found.");
        var response = {};
        response.command = "get names";
        response.sender = request.sender
        response.names = ["no names found."]
        var str = JSON.stringify(response)
        console.log("Response: " + str)
        var message = new Buffer(str);
        server.send(message, 0, message.length, rinfo.port, rinfo.address, (err)=> {
          if(err) console.log("Error sending message back to spaghettimod");
        });
      } else { // found, let's return the data to Spaghettimod
       
        var response = {};
        response.names = []
        for (var i=0; i<rows.length; i++) {
            response.names.push(rows[i].name)
        }
        
        response.command = "get names";
        response.sender = request.sender
        var str = JSON.stringify(response)
        var message = new Buffer(str);
        server.send(message, 0, message.length, rinfo.port, rinfo.address, (err)=> {
          if(err) console.log("Error sending message back to spaghettimod");
        });
      }
    });
}

/**
 * When the server receives a "get rank" command
 * request.sender = cn of the user doing the request
 * request.name = name of the players of which we want the rank
 */
function onGetRank(request, rinfo) {
    var sender = request.sender;
    var name = request.name;
    
    //Search if player's name is already in the db
    db.all("SELECT * FROM players WHERE name = ? LIMIT 1", name, function(err, rows){
      if (err) {
        console.log("ERROR: " + err);
        return;
      }
      if(rows.length == 0){  // not found, do nothing
        console.log("Name " + name + " not found.");
      } else { // found, let's return the player's data to Spaghettimod
        var response = rows[0];
        
        //calculate the rank based on the damage 
        db.all("SELECT * FROM players WHERE damage > ?", rows[0].damage, function(err, rankRows){
          if (err) {
            console.log("ERROR: " + err);
            return;
          }
          
          response.command = "get rank";
          response.rank = rankRows.length + 1;
          response.sender = request.sender;
          var str = JSON.stringify(rows[0])
          var message = new Buffer(str);
          server.send(message, 0, message.length, rinfo.port, rinfo.address, (err)=> {
            if(err) console.log("Error sending message back to spaghettimod");
          });
        });
      }
    });
}

createDb();
server.bind(PORT, HOST);

////////////////
//Express stuff
///////////////

var log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'a'});
var limit = 500
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(express.static(path.join(__dirname, 'public')));

var rankByMatchesRows;
var rankByFragsRows;
var rankByDeathsRows;
var rankByFlagsScoredRows;
var rankByFlagsStolenRows;
var rankByTeamkillsRows;
var rankByPassesRows;
var rankByShotsRows;
var rankByAccRows;
var rankByKpdRows;

//Runs at every server access
var accessLogger = function (req, res, next) {
  var ip = req.headers['x-forwarded-for'] || 
     req.connection.remoteAddress || 
     req.socket.remoteAddress ||
     req.connection.socket.remoteAddress;
  
  var logLine = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + " Connection from " + ip + ", url: " + req.url;
  log_file.write(logLine + '\n');
  console.log(logLine)
  
  if (rankByMatchesRows == null) {
    console.log('Populating rows');
    populateRows();
  }
  next();
};

app.use(accessLogger)

populateRows();

function populateRows() {
  
    db.all("SELECT *, (frags*1.0 /shots) as acc, (frags*1.0 /deaths) as kpd FROM players ORDER BY matches DESC LIMIT ?", limit, function(err, matchesRows){
      rankByMatchesRows = matchesRows;
      db.all("SELECT *, (frags*1.0 /shots) as acc, (frags*1.0 /deaths) as kpd FROM players ORDER BY frags DESC LIMIT ?", limit, function(err, fragsRows){
        rankByFragsRows = fragsRows;
        db.all("SELECT *, (frags*1.0 /shots) as acc, (frags*1.0 /deaths) as kpd FROM players ORDER BY deaths DESC LIMIT ?", limit, function(err, deathsRows){
          rankByDeathsRows = deathsRows;
          db.all("SELECT *, (frags*1.0 /shots) as acc, (frags*1.0 /deaths) as kpd FROM players ORDER BY flags DESC LIMIT ?", limit, function(err, flagsScoredRows){
            rankByFlagsScoredRows = flagsScoredRows;
            db.all("SELECT *, (frags*1.0 /shots) as acc, (frags*1.0 /deaths) as kpd FROM players ORDER BY stolen DESC LIMIT ?", limit, function(err, flagsStolenRows){
              rankByFlagsStolenRows = flagsStolenRows;
              db.all("SELECT *, (frags*1.0 /shots) as acc, (frags*1.0 /deaths) as kpd FROM players ORDER BY tk DESC LIMIT ?", limit, function(err, teamkillRows){
                rankByTeamkillsRows = teamkillRows;
                db.all("SELECT *, (frags*1.0 /shots) as acc, (frags*1.0 /deaths) as kpd FROM players ORDER BY passes DESC LIMIT ?", limit, function(err, passesRows){
                  rankByPassesRows = passesRows;
                  db.all("SELECT *, (frags*1.0 /shots) as acc, (frags*1.0 /deaths) as kpd FROM players ORDER BY shots DESC LIMIT ?", limit, function(err, shotsRows){
                    rankByShotsRows = shotsRows;
                    db.all("SELECT *, (frags*1.0 /shots) as acc, (frags*1.0 /deaths) as kpd FROM players WHERE matches>30 ORDER BY acc DESC LIMIT ?", limit, function(err, accRows){
                      rankByAccRows = accRows;
                      db.all("SELECT *, (frags*1.0 /shots) as acc, (frags*1.0 /deaths) as kpd FROM players WHERE matches>30 ORDER BY kpd DESC LIMIT ?", limit, function(err, kpdRows){
                        rankByKpdRows = kpdRows;
                      })    
                    })
                  })    
                })    
              })
            })
          })    
        })    
      })  
    })
}

app.get('/', function(req, res){
  res.send('Hello World');
})

app.get('/rankbymatches', function(req, res){
  var title = 'Rank by Matches'
  var subtitle = "The rank of who played most matches"
  res.render('index', { title: title, subtitle: subtitle, result:rankByMatchesRows});
})

app.get('/rankbyfrags', function(req, res){
  var title = 'Rank by Frags'
  var subtitle = "The rank of who killed the most opponents"
  res.render('index', { title: title, subtitle: subtitle, result:rankByFragsRows});
})

app.get('/rankbydeaths', function(req, res){
  var title = 'Rank by Deaths'
  var subtitle = "The rank of who died the most"
  res.render('index', { title: title, subtitle: subtitle, result:rankByDeathsRows});
})

app.get('/rankbyflagsscored', function(req, res){
  var title = 'Rank by Flags Scored'
  var subtitle = "The rank of who scored the most flags"
  res.render('index', { title: title, subtitle: subtitle, result:rankByFlagsScoredRows});
})

app.get('/rankbyflagsstolen', function(req, res){
  var title = 'Rank by Flags stolen'
  var subtitle = "The rank of who stole the most flags"
  res.render('index', { title: title, subtitle: subtitle, result:rankByFlagsStolenRows});
})

app.get('/rankbyteamkills', function(req, res){
  var title = 'Rank by TeamKills'
  var subtitle = "The rank of who killed the most teammates"
  res.render('index', { title: title, subtitle: subtitle, result:rankByTeamkillsRows});
})

app.get('/rankbypasses', function(req, res){
  var title = 'Pastaland - Rank by Passes'
  var subtitle = "The rank of who did the most flag passes"
  res.render('index', { title: title, subtitle: subtitle, result:rankByPassesRows});
})

app.get('/rankbyshots', function(req, res){
  var title = 'Pastaland - Rank by Shots'
  var subtitle = "The rank based on how many times a player shoot"
  res.render('index', { title: title, subtitle: subtitle, result:rankByShotsRows});
})

app.get('/rankbyacc', function(req, res){
  var title = 'Pastaland - Rank by Accuracy'
  var subtitle = "The rank of the most accurate players - you must have played at least 30 matches to appear here."
  res.render('index', { title: title, subtitle: subtitle, result:rankByAccRows});
})

app.get('/rankbykpd', function(req, res){
  var title = 'Pastaland - Rank by KpD'
  var subtitle = "The rank based on kills per deaths - you must have played at least 30 matches to appear here."
  res.render('index', { title: title, subtitle: subtitle, result:rankByKpdRows});
})

app.listen(8082, function(){
  console.log("Express Rank http server listening on port 8082");
})
