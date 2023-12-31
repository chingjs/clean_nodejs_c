const { Server } = require('socket.io');

let io;

const whitelists = [
  'https://app.test.com.my',
  'https://temp1.antlysis.com',
  'http://localhost:3000',
];
const rooms = [];

module.exports = {
  initIo: (server) => {
    io = new Server(server, {
      cors: {
        origin: whitelists,
      },
    });
    return io;
  },
  socketIo: () => {
    if (io) return io;
  },
  rooms,
};
