import type { Socket } from 'socket.io';
import { accessControl } from './access';

/** Recheck every protected event, including sockets opened before a revocation. */
export function installAdultSocketGate(socket: Socket, lookupUser: () => string | undefined) {
  socket.use(async ([event], next) => {
    if (event === 'authenticate') return next();
    const userId = lookupUser();
    if (!userId) return next(new Error('authentication_required'));
    try { await accessControl.requireAdult(userId); next(); }
    catch { socket.emit('authorization:error', { error: 'adult_assurance_required' }); socket.disconnect(true); }
  });
}
