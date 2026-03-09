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
  _socket = io(SOCKET_URL, { auth: { token } });
  _socket.on('connect', () => _socket!.emit('authenticate', token));
  return _socket;
}

export function closeSocket() {
  if (_socket) { _socket.close(); _socket = null; _socketToken = null; }
}

export const useSocket = (): Socket | null => {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) closeSocket();
  }, [token]);

  return token ? getSocket(token) : null;
};
