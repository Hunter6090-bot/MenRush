import express from 'express';
import { Server as SocketIOServer, Socket } from 'socket.io';
import http from 'http';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import messageRoutes from './routes/messages';
import { errorHandler } from './middleware/auth';
import { authService } from './services/auth.service';
import { userService } from './services/user.service';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Add WebRTC route
import webrtcRoutes from './routes/webrtc';
app.use('/api/webrtc', webrtcRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket.IO
const userSockets: Map<string, string> = new Map();

io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id);

  socket.on('authenticate', (token: string) => {
    try {
      const decoded = authService.verifyToken(token);
      userSockets.set(decoded.userId, socket.id);
      userService.setOnlineStatus(decoded.userId, true);
      socket.join(`user:${decoded.userId}`);
    } catch (error) {
      socket.emit('error', 'Authentication failed');
    }
  });

  // Existing message and typing...
  socket.on('message', (data: { receiver_id: string; message: string }) => {
    const receiverSocketId = userSockets.get(data.receiver_id);
    if (receiverSocketId) {
      io.to(`user:${data.receiver_id}`).emit('message', data);
    }
  });

  socket.on('typing', (data: { receiver_id: string; typing: boolean }) => {
    io.to(`user:${data.receiver_id}`).emit('typing', { typing: data.typing });
  });

  // NEW WebRTC signalling
  socket.on('call:initiate', (data: { to: string; offer: RTCSessionDescriptionInit }) => {
    // Optional: check mutual match here
    const targetSocket = userSockets.get(data.to);
    if (targetSocket) {
      io.to(`user:${data.to}`).emit('call:incoming', {
        from: socket.data.userId || 'unknown',
        fromName: 'Someone', // resolve name if needed
        offer: data.offer
      });
    } else {
      socket.emit('call:error', { error: 'target_offline' });
    }
  });

  socket.on('call:answer', (data: { to: string; answer: RTCSessionDescriptionInit }) => {
    const targetSocket = userSockets.get(data.to);
    if (targetSocket) {
      io.to(`user:${data.to}`).emit('call:answered', { answer: data.answer });
    }
  });

  socket.on('call:ice-candidate', (data: { to: string; candidate: RTCIceCandidateInit }) => {
    const targetSocket = userSockets.get(data.to);
    if (targetSocket) {
      io.to(`user:${data.to}`).emit('call:ice-candidate', { candidate: data.candidate });
    }
  });

  socket.on('call:end', (data: { to: string }) => {
    const targetSocket = userSockets.get(data.to);
    if (targetSocket) {
      io.to(`user:${data.to}`).emit('call:ended');
    }
  });

  socket.on('call:reject', (data: { to: string }) => {
    const targetSocket = userSockets.get(data.to);
    if (targetSocket) {
      io.to(`user:${data.to}`).emit('call:rejected');
    }
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        userService.setOnlineStatus(userId, false);
        break;
      }
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
