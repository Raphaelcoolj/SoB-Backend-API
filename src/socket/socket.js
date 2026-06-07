import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // JWT auth middleware for Socket.io handshake
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth.token
        ?? (socket.handshake.headers['authorization']?.startsWith('Bearer ')
          ? socket.handshake.headers['authorization'].split(' ')[1]
          : null)
        ?? socket.handshake.query?.token
        ?? null;

      if (!token) return next(new Error('Authentication failed: Missing access token.'));

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('Authentication failed: User not found.'));

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication failed: Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`WS connected: ${socket.user.username} (${socket.id})`);

    // Join private user notification room
    socket.join(socket.user._id.toString());

    socket.on('join_post', (postId) => {
      if (postId) { socket.join(`post_${postId}`); console.log(`${socket.user.username} joined post room [post_${postId}]`); }
    });

    socket.on('leave_post', (postId) => {
      if (postId) { socket.leave(`post_${postId}`); }
    });

    socket.on('disconnect', () => {
      console.log(`WS disconnected: ${socket.user.username} (${socket.id})`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized. Call initSocket first.');
  return io;
};
