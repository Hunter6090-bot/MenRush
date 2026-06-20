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
import { accessControl } from './security/access';
import { logResendMailerStatus } from './services/mailer.service';
import { Sentry } from './observability/sentry';

logResendMailerStatus();

const app = express();
const server = http.createServer(app);

const allowedOrigins = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
  const explicit = process.env.FRONTEND_URL;
  if (explicit && origin === explicit) return callback(null, true);
  callback(new Error('Not allowed by CORS'));
};

const io: any = new SocketIOServer(server, {
  cors: { origin: allowedOrigins, credentials: true },
  maxHttpBufferSize: 1_000_000,
});

// Middleware
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
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
