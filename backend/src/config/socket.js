const { Server } = require('socket.io');
const { verifyAccessToken } = require('./jwt');

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Middleware de autenticação no socket
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) throw new Error('Token ausente');

      const decoded = verifyAccessToken(token);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Não autorizado'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, role } = socket.user;

    // Cada usuário entra na sua sala privada
    socket.join(`user:${userId}`);

    // Médicos entram na sala de médicos
    if (role === 'DOCTOR') socket.join('doctors');

    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io não inicializado');
  return io;
};

module.exports = { initSocket, getIO };
