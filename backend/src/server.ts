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
import veriffRoutes from './routes/veriff';
import premiumRoutes from './routes/premium';
import premiumWebhookRoutes from './routes/premium-webhook';
import contactRoutes from './routes/contact';
import albumRoutes from './routes/albums';
import eventRoutes from './routes/events';
import hotSpotsRoutes from './routes/hot-spots';
import profileMetaRoutes from './routes/profile-meta';
import meetRoutes from './routes/meet';
import notificationRoutes from './routes/notifications';
import webrtcRoutes from './routes/webrtc';
import dripRoutes from './routes/drip';
import betaRoutes from './routes/beta';
import adminRoutes from './routes/admin.routes';
import campaignRoutes from './routes/campaigns';
import socialRoutes from './routes/social';
import communityRoutes from './routes/community';
import mediaDisplayRoutes from './routes/media-display';
import { startPulseExpiryCron } from './services/pulse.service';
import { startRoomTempIdentityPurgeCron } from './services/room.service';
import {
  hasWelcomeBeenSent,
  isWaitlistEmailPaused,
  sendWelcomeEmailNow,
  subscribeToWaitlist,
  startDripWorker,
} from './services/drip.service';
import { errorHandler } from './middleware/auth';
import { authService } from './services/auth.service';
import { userService } from './services/user.service';
import { roomService } from './services/room.service';
import { sendPushToUser } from './services/push.service';
import { notificationService } from './services/notification.service';
import { messageService } from './services/message.service';
import { accessControl } from './security/access';
import { logResendMailerStatus } from './services/mailer.service';
import { startVerificationRetentionWorker } from './services/verification/retention.worker';
import { Sentry } from './observability/sentry';
import { corsOrigin } from './security/cors';
import { query } from './db';
import { ensureUploadDirs, getUploadsRoot, probeUploadsWritable } from './lib/uploads-root';
import { logCallMetric } from './services/call-metrics.service';
import { mediaStorageMode } from './services/media-storage.service';

// Transient DB disconnects must not take down login/API.
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException:', err);
  // Let Railway restart if we're truly stuck; don't exit on every log noise.
});

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
app.use('/api/premium/webhook', premiumWebhookRoutes);
// Veriff decision webhook needs the raw body for HMAC (before express.json).
app.use('/api/verify/veriff', veriffRoutes);
app.use(express.json());
app.use('/api/verify', verifyRoutes);
// Profile / message / album media. fallthrough:true so missing files hit a clean 404
// (not 500). Production mounts a Railway volume at /app/uploads (see Dockerfile + UPLOADS_ROOT).
ensureUploadDirs();
const uploadsRoot = getUploadsRoot();
console.log(`[media] uploads root: ${uploadsRoot} mode=${mediaStorageMode()}`);
void probeUploadsWritable().then((probe) => {
  if (probe.ok) console.log('[media] volume writable');
  else console.error('[media] volume NOT writable:', probe.error, probe.root);
});

app.use(
  '/uploads',
  express.static(uploadsRoot, {
    dotfiles: 'deny',
    fallthrough: true,
    // Do not immutable-cache — profile photos are replaced; avoid sticky 404s in CDNs.
    maxAge: '1h',
    setHeaders(res) {
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  }),
);
app.use('/uploads', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(404).json({ error: 'media_not_found' });
});
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/media', mediaDisplayRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/pulse', pulseRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/hot-spots', hotSpotsRoutes);
app.use('/api/profile-meta', profileMetaRoutes);
app.use('/api/meet', meetRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/webrtc', webrtcRoutes);
app.use('/api/waitlist', dripRoutes);
app.use('/api/beta', betaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/community', communityRoutes);

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
    const welcomeAlreadySent = await hasWelcomeBeenSent(result.id);
    if (!welcomeAlreadySent && !isWaitlistEmailPaused()) {
      try {
        await sendWelcomeEmailNow(result);
      } catch (welcomeErr) {
        console.error('Waitlist welcome send failed:', welcomeErr);
      }
    } else if (!welcomeAlreadySent && isWaitlistEmailPaused()) {
      console.log('[drip] PAUSED — welcome held for', result.email);
    }
    const paused = isWaitlistEmailPaused();
    return res.json({
      success: true,
      already_subscribed: result.alreadySubscribed,
      message: result.alreadySubscribed
        ? "You're already on the list. Check your inbox for the beta invite if you haven't used it yet."
        : paused
          ? "You're on the list."
          : "You're on the list! Check your email for a link to join the beta.",
    });
  } catch (err) {
    console.error('Waitlist insert error:', err);
    return res.status(500).json({ error: 'Could not save your email. Please try again.' });
  }
});

// Health checks — `/health` for Railway/Docker; `/api/health` for edge proxies
// that only route `/api/*` to this service (menrush.com → backend).
const healthHandler: express.RequestHandler = async (_req, res) => {
  const media = await probeUploadsWritable();
  res.json({
    status: media.ok ? 'ok' : 'degraded',
    service: 'menrush-backend',
    media: {
      ok: media.ok,
      root: media.root,
      storage: mediaStorageMode(),
      error: media.error ?? null,
    },
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get('/api/healthz', healthHandler);

// Socket.IO — track ALL live sockets per user (phone + tab + reconnect).
// A single socketId map wrongly marked people offline when one tab closed
// while another stayed open — common BOA↔Bigbear "we were both on" failures.
const userSockets: Map<string, Set<string>> = new Map(); // userId → socket ids
const socketToUser: Map<string, string> = new Map(); // socketId → userId

function addUserSocket(userId: string, socketId: string) {
  let set = userSockets.get(userId);
  if (!set) {
    set = new Set();
    userSockets.set(userId, set);
  }
  set.add(socketId);
}

function removeUserSocket(userId: string, socketId: string): boolean {
  const set = userSockets.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    userSockets.delete(userId);
    return true; // fully offline
  }
  return false;
}

function isUserSocketOnline(userId: string): boolean {
  const set = userSockets.get(userId);
  return Boolean(set && set.size > 0);
}

interface PendingCall {
  callerId: string;
  calleeId: string;
  answered: boolean;
  offer?: unknown;
  fromName?: string;
  ice: unknown[];
  deliveredIncoming: boolean;
  timeout?: ReturnType<typeof setTimeout>;
}
const pendingCalls = new Map<string, PendingCall>();
/** How long the callee has to answer after the offer is actually delivered. */
const CALL_RING_WAIT_MS = Number(process.env.CALL_RING_WAIT_MS) || 35_000;
/** How long to hold an undelivered offer while the callee is offline / cold-starting. */
const CALL_OFFER_HOLD_MS = Number(process.env.CALL_OFFER_HOLD_MS) || 35_000;

function expireNoAnswer(pending: PendingCall) {
  const still = pendingCalls.get(pendingCallKey(pending.callerId, pending.calleeId));
  if (!still || still.answered) return;
  clearPendingCall(still.callerId, still.calleeId);
  logCallMetric('call_no_answer', {
    callerId: still.callerId,
    calleeId: still.calleeId,
  });
  io.to(`user:${still.callerId}`).emit('call:error', { error: 'no_answer' });
  void recordMissedCall(still.callerId, still.calleeId);
}

/**
 * Ring / missed-call window starts only when the callee has received the offer.
 * Arming at call:initiate caused false missed calls on cold-start answers.
 */
function armRingTimeout(pending: PendingCall) {
  if (pending.timeout) {
    clearTimeout(pending.timeout);
    pending.timeout = undefined;
  }
  if (pending.answered) return;
  pending.timeout = setTimeout(() => expireNoAnswer(pending), CALL_RING_WAIT_MS);
}

function deliverPendingIncoming(pending: PendingCall) {
  if (pending.deliveredIncoming || pending.answered || !pending.offer) return;
  // Drop any undelivered-offer hold before marking delivered / arming the ring.
  if (pending.timeout) {
    clearTimeout(pending.timeout);
    pending.timeout = undefined;
  }
  pending.deliveredIncoming = true;
  io.to(`user:${pending.calleeId}`).emit('call:incoming', {
    from: pending.callerId,
    fromName: pending.fromName,
    offer: pending.offer,
  });
  for (const candidate of pending.ice) {
    io.to(`user:${pending.calleeId}`).emit('call:ice-candidate', {
      from: pending.callerId,
      candidate,
    });
  }
  logCallMetric('call_incoming_emitted', {
    callerId: pending.callerId,
    calleeId: pending.calleeId,
  });
  armRingTimeout(pending);
}

function pendingCallKey(callerId: string, calleeId: string) {
  return `${callerId}:${calleeId}`;
}

function findPendingCall(actorId: string, targetId: string): PendingCall | undefined {
  return pendingCalls.get(pendingCallKey(actorId, targetId))
    ?? pendingCalls.get(pendingCallKey(targetId, actorId));
}

function clearPendingCall(callerId: string, calleeId: string) {
  const pending = pendingCalls.get(pendingCallKey(callerId, calleeId));
  if (pending?.timeout) clearTimeout(pending.timeout);
  pendingCalls.delete(pendingCallKey(callerId, calleeId));
}

async function recordMissedCall(callerId: string, calleeId: string) {
  try {
    const callerName = (await userService.getDisplayName(callerId)) ?? 'Someone';
    const row = await messageService.recordMissedCall(callerId, calleeId);
    const forCallee = await messageService.forViewer(row, calleeId);
    const forCaller = await messageService.forViewer(row, callerId);
    io.to(`user:${calleeId}`).emit('message', forCallee);
    io.to(`user:${callerId}`).emit('message', forCaller);

    await notificationService.notify(io, {
      userId: calleeId,
      actorId: callerId,
      type: 'missed_call',
      title: 'Missed video call',
      body: `${callerName} tried to reach you`,
      linkPath: `/messages/${callerId}`,
    });

    void sendPushToUser(calleeId, {
      title: callerName || 'MenRush',
      body: 'Missed video call',
      url: `/messages/${callerId}`,
      tag: `missed-call-${callerId}`,
      kind: 'missed_call',
    }).catch(() => undefined);
  } catch (err) {
    console.error('recordMissedCall failed:', err);
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorizeCallTarget(
  socket: Socket,
  targetId: unknown,
): Promise<{ actorId: string; targetId: string } | null> {
  const actorId = socketToUser.get(socket.id);
  if (!actorId || typeof targetId !== 'string' || !UUID_PATTERN.test(targetId)) {
    socket.emit('call:error', { error: 'invalid_target' });
    return null;
  }
  const allowed = await userService.canVideoCall(actorId, targetId);
  if (!allowed) {
    socket.emit('call:error', { error: 'call_not_allowed' });
    return null;
  }
  return { actorId, targetId };
}

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
      if (previousUserId && previousUserId !== decoded.userId) {
        removeUserSocket(previousUserId, socket.id);
      }
      addUserSocket(decoded.userId, socket.id);
      socketToUser.set(socket.id, decoded.userId);
      await userService.setOnlineStatus(decoded.userId, true);
      socket.join(`user:${decoded.userId}`);
      socket.emit('authenticated', { userId: decoded.userId });
      // They opened the app from a missed-ring push — attach any waiting offer.
      for (const pending of pendingCalls.values()) {
        if (pending.calleeId === decoded.userId && !pending.answered) {
          deliverPendingIncoming(pending);
        }
      }
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
    const authorized = await authorizeCallTarget(socket, data?.to);
    if (!authorized || !data.offer) return;
    try {
      logCallMetric('call_initiate', {
        callerId: authorized.actorId,
        calleeId: authorized.targetId,
      });
      // Brief wait — mobile tabs often reconnect a beat after unlock.
      if (!isUserSocketOnline(authorized.targetId)) {
        await new Promise((r) => setTimeout(r, 1500));
      }
      const fromName = await userService.getDisplayName(authorized.actorId) ?? '';
      const online = isUserSocketOnline(authorized.targetId);
      // Replace any prior pending for this pair so an old timer cannot fire late.
      clearPendingCall(authorized.actorId, authorized.targetId);
      const pending: PendingCall = {
        callerId: authorized.actorId,
        calleeId: authorized.targetId,
        answered: false,
        offer: data.offer,
        fromName,
        ice: [],
        deliveredIncoming: false,
      };
      pendingCalls.set(pendingCallKey(authorized.actorId, authorized.targetId), pending);

      // Always push so a locked / closed installed app still rings.
      void sendPushToUser(authorized.targetId, {
        title: fromName || 'MenRush',
        body: 'Incoming video call',
        url: `/messages/${authorized.actorId}`,
        tag: `call-${authorized.actorId}`,
        kind: 'call',
      }).catch(() => undefined);

      if (online) {
        deliverPendingIncoming(pending);
      } else {
        logCallMetric('call_offline_ringing', {
          callerId: authorized.actorId,
          calleeId: authorized.targetId,
        });
        // Hold the offer for a cold-start open — do NOT start the answer/missed
        // ring here. The ring window arms in deliverPendingIncoming when they
        // actually receive the offer (authenticate / socket online).
        pending.timeout = setTimeout(() => {
          const still = pendingCalls.get(pendingCallKey(authorized.actorId, authorized.targetId));
          // If the offer was delivered, the ring timer owns expiry now.
          if (!still || still.answered || still.deliveredIncoming) return;
          expireNoAnswer(still);
        }, CALL_OFFER_HOLD_MS);
      }
    } catch {
      logCallMetric('call_error', { code: 'target_not_authorized' });
      socket.emit('call:error', { error: 'target_not_authorized' });
    }
  });

  socket.on('call:answer', async (data: { to: string; answer: any }) => {
    const authorized = await authorizeCallTarget(socket, data?.to);
    if (!authorized || !data.answer) return;
    const pending = findPendingCall(authorized.actorId, authorized.targetId);
    if (pending) {
      pending.answered = true;
      // Cancel ring timeout immediately so a late timer cannot write a false miss.
      if (pending.timeout) {
        clearTimeout(pending.timeout);
        pending.timeout = undefined;
      }
    }
    logCallMetric('call_answer', {
      calleeId: authorized.actorId,
      callerId: authorized.targetId,
    });
    io.to(`user:${authorized.targetId}`).emit('call:answered', {
      from: authorized.actorId,
      answer: data.answer,
    });
  });

  socket.on('call:reject', async (data: { to: string }) => {
    const authorized = await authorizeCallTarget(socket, data?.to);
    if (!authorized) return;
    const pending = findPendingCall(authorized.actorId, authorized.targetId);
    if (pending) clearPendingCall(pending.callerId, pending.calleeId);
    logCallMetric('call_reject', {
      calleeId: authorized.actorId,
      callerId: authorized.targetId,
    });
    io.to(`user:${authorized.targetId}`).emit('call:rejected', { from: authorized.actorId });
  });

  socket.on('call:ice-candidate', async (data: { to: string; candidate: any }) => {
    const authorized = await authorizeCallTarget(socket, data?.to);
    if (!authorized || !data.candidate) return;
    const pending = findPendingCall(authorized.actorId, authorized.targetId);
    if (pending && !isUserSocketOnline(authorized.targetId)) {
      pending.ice.push(data.candidate);
      return;
    }
    io.to(`user:${authorized.targetId}`).emit('call:ice-candidate', {
      from: authorized.actorId,
      candidate: data.candidate,
    });
  });

  socket.on('call:end', async (data: { to: string }) => {
    const authorized = await authorizeCallTarget(socket, data?.to);
    if (!authorized) return;
    const pending = findPendingCall(authorized.actorId, authorized.targetId);
    const answered = Boolean(pending?.answered);
    if (pending && !pending.answered) {
      clearPendingCall(pending.callerId, pending.calleeId);
      void recordMissedCall(pending.callerId, pending.calleeId);
    } else if (pending) {
      clearPendingCall(pending.callerId, pending.calleeId);
    }
    logCallMetric('call_end', {
      fromUserId: authorized.actorId,
      toUserId: authorized.targetId,
      answered,
    });
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

      const presence = await roomService.resolveRoomPresence(userId, roomId);

      socket.to(`room:${roomId}`).emit('room:presence', {
        room_id: roomId,
        type: 'join',
        user_id: userId,
        name: presence.name,
        photo_url: presence.photo_url,
        is_verified: presence.is_verified,
      });

      const peers = await io.in(`room:${roomId}`).fetchSockets();
      const roster = peers
        .map((peer: { id: string }) => {
          const peerUserId = socketToUser.get(peer.id);
          if (!peerUserId) return null;
          return { socket_id: peer.id, user_id: peerUserId };
        })
        .filter(Boolean);

      const rosterDetails = await Promise.all(
        roster.map(async (entry: any) => {
          const p = await roomService.resolveRoomPresence(entry.user_id, roomId);
          return {
            user_id: entry.user_id,
            name: p.name,
            photo_url: p.photo_url,
            is_verified: p.is_verified,
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
    const presence = await roomService.resolveRoomPresence(userId, roomId);
    socket.to(`room:${roomId}`).emit('room:typing', {
      roomId,
      room_id: roomId,
      userId,
      user_id: userId,
      user_name: presence.name,
      typing: data.typing,
    });
  });

  // Group video mesh signalling (1:1 style offer/answer/ICE, scoped to a room).
  const authorizeRoomSignal = async (
    data: { roomId?: string; room_id?: string; to?: string },
  ): Promise<{ actorId: string; targetId: string; roomId: string } | null> => {
    const actorId = socketToUser.get(socket.id);
    const roomId = resolveRoomId(data);
    const targetId = data?.to;
    if (!actorId || !roomId || typeof targetId !== 'string' || !UUID_PATTERN.test(targetId)) {
      return null;
    }
    if (actorId === targetId) return null;
    try {
      const [actorOk, targetOk] = await Promise.all([
        roomService.isMember(actorId, roomId),
        roomService.isMember(targetId, roomId),
      ]);
      if (!actorOk || !targetOk) return null;
      return { actorId, targetId, roomId };
    } catch {
      return null;
    }
  };

  socket.on(
    'room:webrtc-offer',
    async (data: { roomId?: string; room_id?: string; to?: string; offer?: unknown }) => {
      const authorized = await authorizeRoomSignal(data);
      if (!authorized || !data.offer) return;
      io.to(`user:${authorized.targetId}`).emit('room:webrtc-offer', {
        room_id: authorized.roomId,
        from: authorized.actorId,
        offer: data.offer,
      });
    },
  );

  socket.on(
    'room:webrtc-answer',
    async (data: { roomId?: string; room_id?: string; to?: string; answer?: unknown }) => {
      const authorized = await authorizeRoomSignal(data);
      if (!authorized || !data.answer) return;
      io.to(`user:${authorized.targetId}`).emit('room:webrtc-answer', {
        room_id: authorized.roomId,
        from: authorized.actorId,
        answer: data.answer,
      });
    },
  );

  socket.on(
    'room:webrtc-ice',
    async (data: { roomId?: string; room_id?: string; to?: string; candidate?: unknown }) => {
      const authorized = await authorizeRoomSignal(data);
      if (!authorized || !data.candidate) return;
      io.to(`user:${authorized.targetId}`).emit('room:webrtc-ice', {
        room_id: authorized.roomId,
        from: authorized.actorId,
        candidate: data.candidate,
      });
    },
  );

  socket.on(
    'room:media-state',
    async (data: {
      roomId?: string;
      room_id?: string;
      muted?: boolean;
      cameraOn?: boolean;
      camera_on?: boolean;
    }) => {
      const userId = socketToUser.get(socket.id);
      const roomId = resolveRoomId(data);
      if (!userId || !roomId) return;
      try {
        const member = await roomService.isMember(userId, roomId);
        if (!member) return;
        const cameraOn =
          typeof data.cameraOn === 'boolean'
            ? data.cameraOn
            : typeof data.camera_on === 'boolean'
              ? data.camera_on
              : undefined;
        socket.to(`room:${roomId}`).emit('room:media-state', {
          room_id: roomId,
          user_id: userId,
          muted: typeof data.muted === 'boolean' ? data.muted : undefined,
          camera_on: cameraOn,
        });
      } catch {
        /* ignore */
      }
    },
  );

  // Socket.IO empties socket.rooms on `disconnect`. Emit leave here so dropped
  // connections clear tiles immediately (same event as an explicit room:leave).
  socket.on('disconnecting', () => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    for (const roomName of socket.rooms) {
      if (!roomName.startsWith('room:')) continue;
      const roomId = roomName.slice('room:'.length);
      void io.in(roomName).fetchSockets().then((peers: Array<{ id: string }>) => {
        const stillHere = peers.some(
          (peer) => peer.id !== socket.id && socketToUser.get(peer.id) === userId,
        );
        if (stillHere) return;
        socket.to(roomName).emit('room:presence', {
          room_id: roomId,
          type: 'leave',
          user_id: userId,
        });
      }).catch(() => {
        socket.to(roomName).emit('room:presence', {
          room_id: roomId,
          type: 'leave',
          user_id: userId,
        });
      });
    }
  });

  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      const fullyOffline = removeUserSocket(userId, socket.id);
      socketToUser.delete(socket.id);
      // Only mark offline when no other tab/device remains authenticated.
      if (fullyOffline) {
        userService.setOnlineStatus(userId, false);
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
  startRoomTempIdentityPurgeCron();
  startVerificationRetentionWorker();
  // Optional: in-process drip worker. Prefer an external cron in production
  // (POST /api/waitlist/admin/run); only enable in-process when running a
  // single backend instance without separate scheduling.
  if (process.env.DRIP_WORKER_ENABLED === 'true') {
    const minutes = parseInt(process.env.DRIP_WORKER_INTERVAL_MINUTES || '60', 10);
    startDripWorker(Number.isFinite(minutes) && minutes > 0 ? minutes : 60);
  }
});
