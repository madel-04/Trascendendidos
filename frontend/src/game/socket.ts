import { io, Socket } from 'socket.io-client';

// Forzamos protocolo HTTPS ya que el servidor Fastify levanta con certificados SSL locales
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || `https://${window.location.hostname}:3000`;

export const socket: Socket = io(BACKEND_URL, {
  autoConnect: false, // Conectar solo cuando sea necesario
  withCredentials: true,
  transports: ['websocket', 'polling'],
});
