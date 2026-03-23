import express from 'express';
import { Server as SocketIOServer, Socket } from 'socket.io';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import messageRoutes from './routes/messages';
import aiRoutes from './routes/ai';
import roomRoutes from './routes/rooms';
import { errorHandler } from './middleware/auth';
import { authService } from './services/auth.service';
import { userService } from './services/user.service';
import { roomService } from './services/room.service';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io: any = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/rooms', roomRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket.IO
const userSockets: Map<string, string> = new Map(); // userId → socketId
const socketToUser: Map<string, string> = new Map(); // socketId → userId

io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id);

  socket.on('authenticate', (token: string) => {
    try {
      const decoded = authService.verifyToken(token);
      userSockets.set(decoded.userId, socket.id);
      socketToUser.set(socket.id, decoded.userId);
      userService.setOnlineStatus(decoded.userId, true);
      socket.join(`user:${decoded.userId}`);
    } catch (error) {
      socket.emit('error', 'Authentication failed');
    }
  });

  socket.on('message', (data: { receiver_id: string; message: string }) => {
    const senderId = socketToUser.get(socket.id);
    if (!senderId) return;
    const receiverSocketId = userSockets.get(data.receiver_id);
    if (receiverSocketId) {
      io.to(`user:${data.receiver_id}`).emit('message', data);
    }
  });

  socket.on('typing', (data: { receiver_id: string; typing: boolean }) => {
    const senderId = socketToUser.get(socket.id);
    if (!senderId) return;
    io.to(`user:${data.receiver_id}`).emit('typing', { typing: data.typing });
  });

  // Video call signaling

  socket.on('call:initiate', async (data: { to: string; offer: any }) => {
    const callerId = socketToUser.get(socket.id);
    if (!callerId) return;
    try {
      const profile = await userService.getUserProfile(callerId, false);
      const fromName: string = profile?.name ?? '';
      io.to(`user:${data.to}`).emit('call:incoming', {
        from: callerId,
        fromName,
        offer: data.offer,
      });
    } catch {
      // caller profile unavailable — relay without name
      io.to(`user:${data.to}`).emit('call:incoming', {
        from: callerId,
        fromName: '',
        offer: data.offer,
      });
    }
  });

  socket.on('call:answer', (data: { to: string; answer: any }) => {
    const callerId = socketToUser.get(socket.id);
    if (!callerId) return;
    io.to(`user:${data.to}`).emit('call:answered', {
      from: callerId,
      answer: data.answer,
    });
  });

  socket.on('call:reject', (data: { to: string }) => {
    const callerId = socketToUser.get(socket.id);
    if (!callerId) return;
    io.to(`user:${data.to}`).emit('call:rejected', { from: callerId });
  });

  socket.on('call:ice-candidate', (data: { to: string; candidate: any }) => {
    const callerId = socketToUser.get(socket.id);
    if (!callerId) return;
    io.to(`user:${data.to}`).emit('call:ice-candidate', {
      from: callerId,
      candidate: data.candidate,
    });
  });

  socket.on('call:end', (data: { to: string }) => {
    const callerId = socketToUser.get(socket.id);
    if (!callerId) return;
    io.to(`user:${data.to}`).emit('call:ended', { from: callerId });
  });

  // Room Socket.IO handlers

  socket.on('room:join', async (data: { roomId: string }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      const member = await roomService.isMember(userId, data.roomId);
      if (member) {
        socket.join(`room:${data.roomId}`);
      }
    } catch {
      // silently ignore invalid rooms
    }
  });

  socket.on('room:leave', (data: { roomId: string }) => {
    socket.leave(`room:${data.roomId}`);
  });

  socket.on('room:message', async (data: { roomId: string; message: string; replyTo?: string }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      const member = await roomService.isMember(userId, data.roomId);
      if (!member) return;
      const saved = await roomService.sendMessage(userId, data.roomId, data.message, data.replyTo);
      io.to(`room:${data.roomId}`).emit('room:message', saved);
    } catch {
      // silently ignore errors
    }
  });

  socket.on('room:typing', (data: { roomId: string; typing: boolean }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    socket.to(`room:${data.roomId}`).emit('room:typing', {
      roomId: data.roomId,
      userId,
      typing: data.typing,
    });
  });

  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      userSockets.delete(userId);
      socketToUser.delete(socket.id);
      userService.setOnlineStatus(userId, false);
    }
    console.log('User disconnected:', socket.id);
  });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
