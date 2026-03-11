import { Socket, Server } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './types';

type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type IoSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// In-memory matchmaking queue: list of socket IDs waiting for a match
const matchmakingQueue: string[] = [];

// ─── Matchmaking Logic ────────────────────────────────────────────────────────
function tryMatchmake(io: IoServer, socket: IoSocket): void {
  // Add to queue only if not already waiting
  if (!matchmakingQueue.includes(socket.id)) {
    matchmakingQueue.push(socket.id);
  }

  if (matchmakingQueue.length >= 2) {
    // Pair the first two players in the queue
    const [idA, idB] = matchmakingQueue.splice(0, 2);
    const socketA = io.sockets.sockets.get(idA);
    const socketB = io.sockets.sockets.get(idB);

    if (!socketA || !socketB) {
      // One of the sockets disconnected before match was made — put the other back
      if (socketA) matchmakingQueue.unshift(idA);
      if (socketB) matchmakingQueue.unshift(idB);
      return;
    }

    const roomId = `match-${idA.slice(0, 6)}-${idB.slice(0, 6)}`;

    // Persit room and side on socket data
    socketA.data.roomId = roomId;
    socketA.data.side = 'left';
    socketB.data.roomId = roomId;
    socketB.data.side = 'right';

    // Join both sockets to the same room
    socketA.join(roomId);
    socketB.join(roomId);

    // Notify each player of their role
    socketA.emit('match_found', { roomId, side: 'left', opponent: idB });
    socketB.emit('match_found', { roomId, side: 'right', opponent: idA });

    console.log(`[Matchmaking] Room created: ${roomId} | left=${idA} right=${idB}`);
  } else {
    // Not enough players yet — tell the client to keep waiting
    socket.emit('waiting_for_opponent');
    console.log(`[Matchmaking] ${socket.id} is waiting. Queue size: ${matchmakingQueue.length}`);
  }
}

function removeFromQueue(socketId: string): void {
  const idx = matchmakingQueue.indexOf(socketId);
  if (idx !== -1) {
    matchmakingQueue.splice(idx, 1);
    console.log(`[Matchmaking] Removed ${socketId} from queue. Queue size: ${matchmakingQueue.length}`);
  }
}

// ─── Main Socket Handler ──────────────────────────────────────────────────────
export function registerSocketHandlers(io: IoServer): void {
  io.on('connection', (socket: IoSocket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ── Matchmaking events ────────────────────────────────────────────────────

    socket.on('join_matchmaking', () => {
      console.log(`[Socket] ${socket.id} joined matchmaking`);
      tryMatchmake(io, socket);
    });

    socket.on('leave_matchmaking', () => {
      console.log(`[Socket] ${socket.id} left matchmaking`);
      removeFromQueue(socket.id);
    });

    // ── In-game events ────────────────────────────────────────────────────────

    // Paddle movement: broadcast ONLY to the other player in the same room
    socket.on('paddle_move', (payload) => {
      const roomId = socket.data.roomId;
      if (!roomId) return; // guard: not in a match

      // Broadcast to everyone in the room EXCEPT the sender (efficient)
      socket.to(roomId).emit('paddle_moved', payload);
    });

    // ── Disconnection handling ────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} | reason: ${reason}`);

      // Remove from matchmaking queue if still waiting
      removeFromQueue(socket.id);

      // Notify opponent if they were in an active match
      const roomId = socket.data.roomId;
      if (roomId) {
        socket.to(roomId).emit('opponent_disconnected');
        console.log(`[Socket] Notified room ${roomId} of disconnect`);
      }
    });
  });
}
