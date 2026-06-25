import 'dotenv/config';
import './observability/sentry';
import express from 'express';
import { Server as SocketIOServer, Socket } from 'socket.io';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import messageRoutes from './routes/messages';
import roomRoutes from './routes/rooms';
import pushRoutes from './routes/push';
import pulseRoutes from './routes/pulse';
import verifyRoutes from './routes/verify';
import contactRoutes from './routes/contact';
import albumRoutes from './routes/albums';
import eventRoutes from './routes/events';
import profileMetaRoutes from './routes/profile-meta';
import dripRoutes from './routes/drip';
import adminRoutes from './routes/admin.routes';
import { startPulseExpiryCron } from './services/pulse.service';
import { sendWelcomeEmailNow, subscribeToWaitlist, startDripWorker } from './services/drip.service';
import { errorHandler } from './middleware/auth';
import { authService } from './services/auth.service';
import { userService } from './services/user.service';
import { roomService } from './services/room.service';
import { sendPushToUser } from './services/push.service';
import { accessControl } from './security/access';
import { logResendMailerStatus } from './services/mailer.service';
import { Sentry } from './observability/sentry';
import { corsOrigin } from './security/cors';
import { query } from './db';

logResendMailerStatus();

const app = express();
const server = http.createServer(app);
app.set('trust proxy', 1);

const io: any = new SocketIOServer(server, {
  cors: { origin: corsOrigin, credentials: true },
  maxHttpBufferSize: 1_000_000,
});

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: corsOrigin, credentials: true }));
// Stripe Identity webhook needs the RAW request body for signature verification.
// Mount /api/verify BEFORE express.json() so the inner express.raw() middleware sees the raw bytes.
app.use('/api/verify', verifyRoutes);
app.use(express.json());
app.use(
  '/uploads/profiles',
  express.static(path.join(__dirname, '../uploads/profiles'), {
    dotfiles: 'deny',
    fallthrough: false,
    immutable: true,
    maxAge: '30d',
  }),
);
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/pulse', pulseRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/profile-meta', profileMetaRoutes);
app.use('/api/waitlist', dripRoutes);
app.use('/api/admin', adminRoutes);

// Waitlist signup — POSTs to /api/waitlist land here; the dripRoutes router
// handles the rest (unsubscribe + admin endpoints). New signups get the
// welcome email immediately when possible; the batch worker remains the
// fallback/retry path for anything that fails or later drip steps.
app.post('/api/waitlist', async (req, res) => {
  const { email, source } = req.body ?? {};
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  try {
    const result = await subscribeToWaitlist(email, typeof source === 'string' ? source : 'menrush.com');
    if (!result.alreadySubscribed) {
      try {
        await sendWelcomeEmailNow(result);
      } catch (welcomeErr) {
        console.error('Waitlist welcome send failed:', welcomeErr);
      }
    }
    return res.json({
      success: true,
      already_subscribed: result.alreadySubscribed,
      message: result.alreadySubscribed
        ? "You're already on the list."
        : "You're on the list! Check your inbox shortly.",
    });
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorizeSocketTarget(
  socket: Socket,
  targetId: unknown,
): Promise<{ actorId: string; targetId: string } | null> {
  const actorId = socketToUser.get(socket.id);
  if (!actorId || typeof targetId !== 'string' || !UUID_PATTERN.test(targetId)) return null;
  try {
    await accessControl.assertInteraction(actorId, targetId, { requireMatch: true });
    return { actorId, targetId };
  } catch {
    socket.emit('authorization:error', { error: 'target_not_authorized' });
    return null;
  }
}

io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id);

  socket.on('authenticate', async (token: string) => {
    try {
      const decoded = authService.verifyToken(token);
      await accessControl.requireVerified(decoded.userId);
      const previousUserId = socketToUser.get(socket.id);
      if (previousUserId) userSockets.delete(previousUserId);
      userSockets.set(decoded.userId, socket.id);
      socketToUser.set(socket.id, decoded.userId);
      await userService.setOnlineStatus(decoded.userId, true);
      socket.join(`user:${decoded.userId}`);
    } catch (error) {
      socket.emit('authentication:error', { error: 'authentication_failed' });
    }
  });

  socket.on('typing', async (data: { receiver_id?: unknown; typing?: unknown }) => {
    const authorized = await authorizeSocketTarget(socket, data?.receiver_id);
    if (!authorized || typeof data.typing !== 'boolean') return;
    io.to(`user:${authorized.targetId}`).emit('typing', {
      from: authorized.actorId,
      typing: data.typing,
    });
  });

  // Video call signaling

  socket.on('call:initiate', async (data: { to: string; offer: any }) => {
    const authorized = await authorizeSocketTarget(socket, data?.to);
    if (!authorized || !data.offer) return;
    try {
      const fromName = await userService.getDisplayName(authorized.actorId) ?? '';
      io.to(`user:${authorized.targetId}`).emit('call:incoming', {
        from: authorized.actorId,
        fromName,
        offer: data.offer,
      });
      // Best-effort heads-up when the recipient's app is backgrounded/locked.
      // The service worker suppresses this if a foreground tab is focused, so
      // an in-app session won't double-alert. Web push cannot wake a live
      // WebRTC answer on a locked phone — this only surfaces the missed call.
      void sendPushToUser(authorized.targetId, {
        title: fromName || 'MenRush',
        body: 'Incoming video call',
        url: `/messages/${authorized.actorId}`,
        tag: `call-${authorized.actorId}`,
      }).catch(() => undefined);
    } catch {
      socket.emit('authorization:error', { error: 'target_not_authorized' });
    }
  });

  socket.on('call:answer', async (data: { to: string; answer: any }) => {
    const authorized = await authorizeSocketTarget(socket, data?.to);
    if (!authorized || !data.answer) return;
    io.to(`user:${authorized.targetId}`).emit('call:answered', {
      from: authorized.actorId,
      answer: data.answer,
    });
  });

  socket.on('call:reject', async (data: { to: string }) => {
    const authorized = await authorizeSocketTarget(socket, data?.to);
    if (!authorized) return;
    io.to(`user:${authorized.targetId}`).emit('call:rejected', { from: authorized.actorId });
  });

  socket.on('call:ice-candidate', async (data: { to: string; candidate: any }) => {
    const authorized = await authorizeSocketTarget(socket, data?.to);
    if (!authorized || !data.candidate) return;
    io.to(`user:${authorized.targetId}`).emit('call:ice-candidate', {
      from: authorized.actorId,
      candidate: data.candidate,
    });
  });

  socket.on('call:end', async (data: { to: string }) => {
    const authorized = await authorizeSocketTarget(socket, data?.to);
    if (!authorized) return;
    io.to(`user:${authorized.targetId}`).emit('call:ended', { from: authorized.actorId });
  });

  // Room Socket.IO handlers

  const resolveRoomId = (data: { roomId?: string; room_id?: string }) =>
    data?.roomId || data?.room_id;

  socket.on('room:join', async (data: { roomId?: string; room_id?: string }) => {
    const roomId = resolveRoomId(data);
    const userId = socketToUser.get(socket.id);
    if (!userId || !roomId) return;
    try {
      const member = await roomService.isMember(userId, roomId);
      if (!member) return;

      socket.join(`room:${roomId}`);

      const profile = await query(
        `SELECT name, photo_url FROM users WHERE id = $1`,
        [userId],
      );
      const name = profile.rows[0]?.name ?? 'Member';
      const photo_url = profile.rows[0]?.photo_url ?? null;

      socket.to(`room:${roomId}`).emit('room:presence', {
        room_id: roomId,
        type: 'join',
        user_id: userId,
        name,
        photo_url,
      });

      const peers = await io.in(`room:${roomId}`).fetchSockets();
      const roster = peers
        .map((peer) => {
          const peerUserId = socketToUser.get(peer.id);
          if (!peerUserId) return null;
          return { socket_id: peer.id, user_id: peerUserId };
        })
        .filter(Boolean);

      const rosterDetails = await Promise.all(
        roster.map(async (entry: any) => {
          const r = await query(`SELECT name, photo_url FROM users WHERE id = $1`, [entry.user_id]);
          return {
            user_id: entry.user_id,
            name: r.rows[0]?.name ?? 'Member',
            photo_url: r.rows[0]?.photo_url ?? null,
          };
        }),
      );

      socket.emit('room:presence-sync', { room_id: roomId, participants: rosterDetails });
    } catch {
      // silently ignore invalid rooms
    }
  });

  socket.on('room:leave', async (data: { roomId?: string; room_id?: string }) => {
    const roomId = resolveRoomId(data);
    const userId = socketToUser.get(socket.id);
    if (!roomId) return;
    socket.leave(`room:${roomId}`);
    if (userId) {
      socket.to(`room:${roomId}`).emit('room:presence', {
        room_id: roomId,
        type: 'leave',
        user_id: userId,
      });
    }
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

  socket.on('room:typing', async (data: { roomId?: string; room_id?: string; typing?: boolean }) => {
    const userId = socketToUser.get(socket.id);
    const roomId = resolveRoomId(data);
    if (!userId || !roomId || typeof data.typing !== 'boolean') return;
    const name = (await userService.getDisplayName(userId)) ?? 'Member';
    socket.to(`room:${roomId}`).emit('room:typing', {
      roomId,
      room_id: roomId,
      userId,
      user_id: userId,
      user_name: name,
      typing: data.typing,
    });
  });

  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      userSockets.delete(userId);
      socketToUser.delete(socket.id);
      userService.setOnlineStatus(userId, false);
      // Notify any group rooms this socket was in.
      for (const roomName of socket.rooms) {
        if (roomName.startsWith('room:')) {
          const roomId = roomName.slice('room:'.length);
          socket.to(roomName).emit('room:presence', {
            room_id: roomId,
            type: 'leave',
            user_id: userId,
          });
        }
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

// Error handler
Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startPulseExpiryCron();
  // Optional: in-process drip worker. Prefer an external cron in production
  // (POST /api/waitlist/admin/run); only enable in-process when running a
  // single backend instance without separate scheduling.
  if (process.env.DRIP_WORKER_ENABLED === 'true') {
    const minutes = parseInt(process.env.DRIP_WORKER_INTERVAL_MINUTES || '60', 10);
    startDripWorker(Number.isFinite(minutes) && minutes > 0 ? minutes : 60);
  }
});
