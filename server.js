/* eslint-disable no-console */
require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const app = express();
const { initIo } = require('./configs/socket');

require('./configs/database');

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: false, limit: '12mb' }));
app.use(cors());
const server = http.createServer(app);
const io = initIo(server);
app.use(fileUpload());

//routes
app.use('/api/auth', require('./routes/api/authApi'));
app.use('/api/customer', require('./routes/api/customerApi'));
app.use('/api/service', require('./routes/api/serviceApi'));
app.use('/api/operator', require('./routes/api/operatorApi'));
app.use('/api/order', require('./routes/api/orderApi'));
app.use('/api/dashboard', require('./routes/api/dashboardApi'));
app.use('/api/fabric', require('./routes/api/fabricApi'));
app.use('/api/admin', require('./routes/api/adminApi'));
app.use('/api/locker', require('./routes/api/lockerApi'));
app.use('/api/misc', require('./routes/api/miscApi'));

app.use('/', express.static(path.join(__dirname, 'client', 'build')));
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
});

const PORT = process.env.PORT || 5000;

io.on('connection', (socket) => {
  if (
    socket &&
    socket.handshake &&
    socket.handshake.auth &&
    socket.handshake.auth.roomId
  ) {
    socket.join(socket.handshake.auth.roomId);
    console.log('A user connect');
    // to listen all rooms
    // socketIo().sockets.adapter.rooms
  }

  socket.on('disconnect', () => {
    console.log('DISCONNECTED socket connection');
  });
});

server.listen(PORT, () => console.log(`Server is running on port: ${PORT}`));
