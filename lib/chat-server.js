
  const socketio = require('socket.io');
  let io;
  let guestNumber = 1;
  const nickNames = {};
  const namesUsed = [];
  const currentRoom = {};


  function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
    const name = 'Guest' + guestNumber;
    nickNames[socket.id] = name;
    socket.emit('nameResult', {
      success: true,
      name: name
    });
    namesUsed.push(name);
    return guestNumber + 1;
  }

  function joinRoom(socket, room) {
    const socketRoom = `X-${room}`;
    socket.join(socketRoom);
    currentRoom[socket.id] = socketRoom;
    socket.emit('joinResult', {room: room});
    socket.broadcast.to(socketRoom).emit('message', {
      text: nickNames[socket.id] + ' has joined ' + room + '.'
    });
    const usersInRoom = io.sockets.adapter.rooms[socketRoom];
    if (usersInRoom.length > 1) {
      let usersInRoomSummary = 'Users currently in ' + room + ': ';
      let index = 0;
      for (let userSocketId in usersInRoom.sockets) {
        if (userSocketId != socket.id) {
          if (index > 0) {
            usersInRoomSummary += ', ';
          }
          usersInRoomSummary += nickNames[userSocketId];
          index++;
        }
      }
      usersInRoomSummary += '.';
      socket.emit('message', {text: usersInRoomSummary});
    }
  }


  function handleNameChangeAttempts(socket, nickNames, namesUsed) {
    socket.on('nameAttempt', function (name) {
      if (name.indexOf('Guest') == 0) {
        socket.emit('nameResult', {
          success: false,
          message: 'Names cannot begin with "Guest".'
        });
      } else {
        if (namesUsed.indexOf(name) == -1) {
          const previousName = nickNames[socket.id];
          const previousNameIndex = namesUsed.indexOf(previousName);
          namesUsed.push(name);
          nickNames[socket.id] = name;
          delete namesUsed[previousNameIndex];
          socket.emit('nameResult', {
            success: true,
            name: name
          });
          socket.broadcast.to(currentRoom[socket.id]).emit('message', {
            text: previousName + ' is now known as ' + name + '.'
          });
        } else {
          socket.emit('nameResult', {
            success: false,
            message: 'That name is already in use.'
          });
        }
      }
    });
  }

  function handleMessageBroadcasting(socket) {
    socket.on('message', function (message) {
      socket.broadcast.to(`X-${message.room}`).emit('message', {
        text: nickNames[socket.id] + ': ' + message.text
      });
    });
  }

  function handleRoomJoining(socket) {
    socket.on('join', function (room) {
      socket.leave(currentRoom[socket.id]);
      joinRoom(socket, room.newRoom);
    });
  }

  function handleRoomRequest(socket) {
    socket.on('rooms', function () {
      const rooms = [];
      for(let room in io.sockets.adapter.rooms) {
        if (room.startsWith('X-')) {
          rooms.push(room.substr(2));
        }
      }
      socket.emit('rooms', rooms);
    });
  }

  function handleClientDisconnection(socket) {
    socket.on('disconnect', function () {
      const nameIndex = namesUsed.indexOf(nickNames[socket.id]);
      delete namesUsed[nameIndex];
      delete nickNames[socket.id];
    });
  }

  exports.listen = function (server) {
    io = socketio.listen(server);

    io.sockets.on('connection', function (socket) {
      guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
      joinRoom(socket, 'Lobby');

      handleMessageBroadcasting(socket, nickNames);
      handleNameChangeAttempts(socket, nickNames, namesUsed);
      handleRoomJoining(socket);
      handleRoomRequest(socket);
      handleClientDisconnection(socket, nickNames, namesUsed);
    });
  };
