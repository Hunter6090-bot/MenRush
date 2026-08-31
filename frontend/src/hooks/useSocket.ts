import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './store';
import { SOCKET_URL } from '../api/client';

// Module-level singleton — one connection shared across all components
let _socket: Socket | null = null;
let _socketToken: string | null = null;

function getSocket(token: string): Socket {
  if (_socket && _socketToken === token) return _socket;
  if (_socket) { _socket.close(); _socket = null; }
  _socketToken = token;
  _socket = io(SOCKET_URL, {
    auth: { token },
    // iPhone PWAs drop WebSockets after suspend; polling fallback + reconnect
    // recovers without requiring leave/reenter of a chat thread.
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
  });
  _socket.on('connect', () => _socket!.emit('authenticate', token));
  return _socket;
}

/** Wake the shared socket after iOS background suspend. */
export function ensureSocketConnected(): void {
  if (!_socket) return;
  if (!_socket.connected) {
    _socket.connect();
    return;
  }
  // Re-join the user room in case the server lost the mapping mid-session.
  if (_socketToken) _socket.emit('authenticate', _socketToken);
}

export function closeSocket() {
  if (_socket) { _socket.close(); _socket = null; _socketToken = null; }
}

export const useSocket = (): Socket | null => {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) {
      closeSocket();
      return;
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') ensureSocketConnected();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [token]);

  return token ? getSocket(token) : null;
};
