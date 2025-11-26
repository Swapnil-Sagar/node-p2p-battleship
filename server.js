var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var Entities = require('html-entities').AllHtmlEntities;
var entities = new Entities();

var BattleshipGame = require('./app/game.js');
var GameStatus = require('./app/gameStatus.js');

var port = process.env.PORT || 8900;

var users = {};
var gameIdCounter = 1;
var pirateNames = [
  'Calico Kraken',
  'Scarlet Storm',
  'Ironhook Inez',
  'Black Coral Jack',
  'Captain Sable',
  'Rogue Tidemaster',
  'Azure Buccaneer',
  'Barnacle Briggs',
  'Marrowbeard Mae',
  'Sirena Cutlass',
  'Grimwave Gideon',
  'Harpoon Harlow',
  'Corsair Crowe',
  'Tempest Thorne',
  'Riptide Reyes',
  'Moonlit Marauder',
  'Volt Voyager',
  'Ghostwake Grey',
  'Tidal Tamsin',
  'Widow Wraith',
];

app.use(express.static(__dirname + '/public'));

http.listen(port, function () {
  console.log('listening on *:' + port);
});

io.on('connection', function (socket) {
  console.log(new Date().toISOString() + ' ID ' + socket.id + ' connected.');

  // create user object for additional data
  users[socket.id] = {
    inGame: null,
    player: null,
    name: null,
  };

  // join waiting room until there are enough players to start a new game
  socket.join('waiting room');

  /**
   * Handle chat messages
   */
  socket.on('chat', function (msg) {
    if (users[socket.id].inGame !== null && msg) {
      var senderName = users[socket.id].name || 'Unknown Corsair';
      console.log(
        new Date().toISOString() +
          ' Chat message from ' +
          socket.id +
          ' (' +
          senderName +
          '): ' +
          msg
      );

      // Send message to opponent
      socket.broadcast.to('game' + users[socket.id].inGame.id).emit('chat', {
        name: senderName,
        message: entities.encode(msg),
      });

      // Send message to self
      io.to(socket.id).emit('chat', {
        name: senderName + ' (You)',
        message: entities.encode(msg),
      });
    }
  });

  /**
   * Handle shot from client
   */
  socket.on('shot', function (position) {
    var game = users[socket.id].inGame,
      opponent;

    if (game !== null) {
      // Is it this users turn?
      if (game.currentPlayer === users[socket.id].player) {
        opponent = game.currentPlayer === 0 ? 1 : 0;

        if (game.shoot(position)) {
          // Valid shot
          checkGameOver(game);

          // Update game state on both clients.
          io.to(socket.id).emit('update', game.getGameState(users[socket.id].player, opponent));
          io.to(game.getPlayerId(opponent)).emit('update', game.getGameState(opponent, opponent));
        }
      }
    }
  });

  /**
   * Handle leave game request
   */
  socket.on('leave', function () {
    if (users[socket.id].inGame !== null) {
      leaveGame(socket);

      socket.join('waiting room');
      joinWaitingPlayers();
    }
  });

  /**
   * Handle client disconnect
   */
  socket.on('disconnect', function () {
    console.log(new Date().toISOString() + ' ID ' + socket.id + ' disconnected.');

    leaveGame(socket);

    delete users[socket.id];
  });

  joinWaitingPlayers();
});

/**
 * Create games for players in waiting room
 */
function joinWaitingPlayers() {
  var players = getClientsInRoom('waiting room');

  if (players.length >= 2) {
    // 2 player waiting. Create new game!
    var game = new BattleshipGame(gameIdCounter++, players[0].id, players[1].id);
    var callSigns = getPirateCallSigns();

    // create new room for this game
    players[0].leave('waiting room');
    players[1].leave('waiting room');
    players[0].join('game' + game.id);
    players[1].join('game' + game.id);

    users[players[0].id].player = 0;
    users[players[1].id].player = 1;
    users[players[0].id].inGame = game;
    users[players[1].id].inGame = game;
    users[players[0].id].name = callSigns[0];
    users[players[1].id].name = callSigns[1];

    io.to(players[0].id).emit('join', {
      gameId: game.id,
      selfName: callSigns[0],
      opponentName: callSigns[1],
    });
    io.to(players[1].id).emit('join', {
      gameId: game.id,
      selfName: callSigns[1],
      opponentName: callSigns[0],
    });

    // send initial ship placements
    io.to(players[0].id).emit('update', game.getGameState(0, 0));
    io.to(players[1].id).emit('update', game.getGameState(1, 1));

    console.log(
      new Date().toISOString() +
        ' ' +
        players[0].id +
        ' (' +
        callSigns[0] +
        ') and ' +
        players[1].id +
        ' (' +
        callSigns[1] +
        ')' +
        ' have joined game ID ' +
        game.id
    );
  }
}

/**
 * Leave user's game
 * @param {type} socket
 */
function leaveGame(socket) {
  if (users[socket.id].inGame !== null) {
    console.log(
      new Date().toISOString() + ' ID ' + socket.id + ' left game ID ' + users[socket.id].inGame.id
    );

    // Notifty opponent
    socket.broadcast.to('game' + users[socket.id].inGame.id).emit('notification', {
      message: 'Opponent has left the game',
    });

    if (users[socket.id].inGame.gameStatus !== GameStatus.gameOver) {
      // Game is unfinished, abort it.
      users[socket.id].inGame.abortGame(users[socket.id].player);
      checkGameOver(users[socket.id].inGame);
    }

    socket.leave('game' + users[socket.id].inGame.id);

    users[socket.id].inGame = null;
    users[socket.id].player = null;
    users[socket.id].name = null;

    io.to(socket.id).emit('leave');
  }
}

/**
 * Notify players if game over.
 * @param {type} game
 */
function checkGameOver(game) {
  if (game.gameStatus === GameStatus.gameOver) {
    console.log(new Date().toISOString() + ' Game ID ' + game.id + ' ended.');
    io.to(game.getWinnerId()).emit('gameover', true);
    io.to(game.getLoserId()).emit('gameover', false);
  }
}

/**
 * Find all sockets in a room
 * @param {type} room
 * @returns {Array}
 */
function getClientsInRoom(room) {
  var clients = [];
  for (var id in io.sockets.adapter.rooms[room]) {
    clients.push(io.sockets.adapter.nsp.connected[id]);
  }
  return clients;
}

/**
 * Generate two unique pirate-style call signs
 * @returns {Array}
 */
function getPirateCallSigns() {
  var first = pirateNames[Math.floor(Math.random() * pirateNames.length)];
  var second = first;
  var attempts = 0;

  while (second === first && attempts < 10) {
    second = pirateNames[Math.floor(Math.random() * pirateNames.length)];
    attempts++;
  }

  if (second === first) {
    second = first + ' II';
  }

  return [first, second];
}
