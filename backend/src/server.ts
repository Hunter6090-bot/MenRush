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
import roomRoutes from './routes/rooms';
import pushRoutes, { webpush } from './routes/push';
import pulseRoutes from './routes/pulse';
import verifyRoutes from './routes/verify';
import contactRoutes from './routes/contact';
import { startPulseExpiryCron } from './services/pulse.service';
import { errorHandler } from './middleware/auth';
import { authService } from './services/auth.service';
import { userService } from './services/user.service';
import { roomService } from './services/room.service';
import { query } from './db';

dotenv.config();

const app = express();
const server = http.createServer(app);

const allowedOrigins = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
  const explicit = process.env.FRONTEND_URL;
  if (explicit && origin === explicit) return callback(null, true);
  callback(new Error('Not allowed by CORS'));
};

const io: any = new SocketIOServer(server, {
  cors: { origin: allowedOrigins, credentials: true },
});

// Middleware
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
// Stripe Identity webhook needs the RAW request body for signature verification.
// Mount /api/verify BEFORE express.json() so the inner express.raw() middleware sees the raw bytes.
app.use('/api/verify', verifyRoutes);
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/pulse', pulseRoutes);
app.use('/api/contact', contactRoutes);

// Waitlist
app.post('/api/waitlist', async (req, res) => {
  const { email } = req.body ?? {};
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  try {
    await query(
      `INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
      [email.trim().toLowerCase()],
    );
    return res.json({ success: true, message: "You're on the list!" });
  } catch (err) {
    console.error('Waitlist insert error:', err);
    return res.status(500).json({ error: 'Could not save your email. Please try again.' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket.IO
const userSockets: Map<string, string> = new Map(); // userId → socketId
const socketToUser: Map<string, string> = new Map(); // socketId → userId

io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id);

  socket.on('authenticate', async (token: string) => {
    try {
      const decoded = authService.verifyToken(token);
      userSockets.set(decoded.userId, socket.id);
      socketToUser.set(socket.id, decoded.userId);
      await userService.setOnlineStatus(decoded.userId, true);
      socket.join(`user:${decoded.userId}`);

      // ── Push-notify users within 5 km that someone came online ──────────
      try {
        const profileRes = await query(
          `SELECT lat, lng FROM profiles WHERE user_id = $1 AND lat IS NOT NULL AND lng IS NOT NULL`,
          [decoded.userId],
        );
        if (profileRes.rows.length > 0) {
          const { lat, lng } = profileRes.rows[0];
          // Find nearby users (excluding self) who have push subscriptions
          const nearbyRes = await query(
            `SELECT ps.endpoint, ps.p256dh, ps.auth,
                    ST_Distance(p.location::geography,
                                ST_MakePoint($2, $1)::geography) / 1000 AS distance_km
             FROM profiles p
             JOIN push_subscriptions ps ON ps.user_id = p.user_id
             WHERE p.user_id != $3
               AND p.location IS NOT NULL
               AND ST_DWithin(p.location::geography, ST_MakePoint($2, $1)::geography, 5000)`,
            [lat, lng, decoded.userId],
          );

          const nameRes = await query(`SELECT name FROM users WHERE id = $1`, [decoded.userId]);
          const comingUserName: string = nameRes.rows[0]?.name ?? 'Someone';

          for (const row of nearbyRes.rows) {
            const subscription = {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            };
            const dist = parseFloat(row.distance_km).toFixed(1);
            webpush.sendNotification(
              subscription,
              JSON.stringify({
                title: 'Someone is nearby',
                body:  `${comingUserName} is ${dist}km away`,
                icon:  '/logo.png',
              }),
            ).catch(() => {}); // best-effort, silently drop failures
          }
        }
      } catch {
        // push notifications are non-critical
      }
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
  startPulseExpiryCron();
});
