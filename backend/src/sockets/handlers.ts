import { Socket, Server } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  MatchEndedPayload,
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

// ─── In-memory state ──────────────────────────────────────────────────────────

// Matchmaking queue: socket IDs waiting for an opponent
const matchmakingQueue: string[] = [];

// Match registry: tracks active matches and the two participating socket IDs
// Key: roomId  →  Value: { left: socketId, right: socketId }
const activeMatches = new Map<string, { left: string; right: string }>();

// ─── Match registry helpers ───────────────────────────────────────────────────

function registerMatch(roomId: string, leftId: string, rightId: string): void {
  activeMatches.set(roomId, { left: leftId, right: rightId });
  console.log(`[Match] Registered: ${roomId} | left=${leftId} right=${rightId}`);
}

/**
 * Formally terminate a match.
 * Notifies both players with match_ended and returned_to_lobby,
 * clears socket.data for both, makes them leave the Socket.io room,
 * and removes the entry from the registry.
 */
function terminateMatch(
  io: IoServer,
  roomId: string,
  reason: MatchEndedPayload['reason'],
  winner: MatchEndedPayload['winner'],
): void {
  const match = activeMatches.get(roomId);
  if (!match) return; // already cleaned up

  console.log(`[Match] Terminating ${roomId} | reason=${reason} winner=${winner ?? 'none'}`);

  const payload: MatchEndedPayload = { reason, winner };

  // Notify everyone still in the room
  io.to(roomId).emit('match_ended', payload);
  // Tell them they can re-queue
  io.to(roomId).emit('returned_to_lobby');

  // Clear state on both socket objects (if they are still connected)
  for (const socketId of [match.left, match.right]) {
    const s = io.sockets.sockets.get(socketId);
    if (s) {
      s.leave(roomId);
      s.data.roomId = undefined;
      s.data.side   = undefined;
    }
  }

  // Remove from registry — any future game-loop or timer cleanup goes here
  activeMatches.delete(roomId);
  console.log(`[Match] Removed ${roomId} from registry`);
}

// ─── Matchmaking helpers ──────────────────────────────────────────────────────

function tryMatchmake(io: IoServer, socket: IoSocket): void {
  if (!matchmakingQueue.includes(socket.id)) {
    matchmakingQueue.push(socket.id);
  }

  if (matchmakingQueue.length >= 2) {
    const [idA, idB] = matchmakingQueue.splice(0, 2);
    const socketA = io.sockets.sockets.get(idA);
    const socketB = io.sockets.sockets.get(idB);

    if (!socketA || !socketB) {
      // One disconnected before matching — requeue the surviving one
      if (socketA) matchmakingQueue.unshift(idA);
      if (socketB) matchmakingQueue.unshift(idB);
      return;
    }

    const roomId = `match-${idA.slice(0, 6)}-${idB.slice(0, 6)}`;

    socketA.data.roomId = roomId;
    socketA.data.side   = 'left';
    socketB.data.roomId = roomId;
    socketB.data.side   = 'right';

    socketA.join(roomId);
    socketB.join(roomId);

    registerMatch(roomId, idA, idB);

    socketA.emit('match_found', { roomId, side: 'left',  opponent: idB });
    socketB.emit('match_found', { roomId, side: 'right', opponent: idA });

    console.log(`[Matchmaking] Room created: ${roomId}`);
  } else {
    socket.emit('waiting_for_opponent');
    console.log(`[Matchmaking] ${socket.id} queued. Size: ${matchmakingQueue.length}`);
  }
}

function removeFromQueue(socketId: string): void {
  const idx = matchmakingQueue.indexOf(socketId);
  if (idx !== -1) {
    matchmakingQueue.splice(idx, 1);
    console.log(`[Matchmaking] Removed ${socketId}. Queue size: ${matchmakingQueue.length}`);
  }
}

// ─── Main Socket Handler ──────────────────────────────────────────────────────

export function registerSocketHandlers(io: IoServer): void {
  io.on('connection', (socket: IoSocket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ── Matchmaking ───────────────────────────────────────────────────────────

    socket.on('join_matchmaking', () => {
      // Guard: ignore if already in a match
      if (socket.data.roomId) {
        console.log(`[Socket] ${socket.id} tried to queue but is already in a match`);
        return;
      }
      console.log(`[Socket] ${socket.id} joined matchmaking`);
      tryMatchmake(io, socket);
    });

    socket.on('leave_matchmaking', () => {
      console.log(`[Socket] ${socket.id} left matchmaking`);
      removeFromQueue(socket.id);
      socket.emit('returned_to_lobby');
    });

    // ── In-game events ────────────────────────────────────────────────────────

    // Paddle movement: broadcast ONLY to the opponent in the same room
    socket.on('paddle_move', (payload) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.to(roomId).emit('paddle_moved', payload);
    });

    // Voluntary match exit (e.g. player clicks "Leave Match" in the UI)
    // Distinct from an unexpected disconnect — here we know it was intentional.
    socket.on('leave_match', () => {
      const roomId = socket.data.roomId;
      const side   = socket.data.side;
      if (!roomId || !side) return;

      console.log(`[Match] ${socket.id} voluntarily left match ${roomId}`);

      // The opponent wins by forfeit
      const winner: MatchEndedPayload['winner'] = side === 'left' ? 'right' : 'left';
      terminateMatch(io, roomId, 'forfeit', winner);
    });

    // ── Disconnection (unexpected: network drop, tab close, etc.) ─────────────
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} | reason: ${reason}`);

      // 1. Remove from matchmaking queue if still waiting
      removeFromQueue(socket.id);

      // 2. If in an active match, terminate it and award the win to the opponent
      const roomId = socket.data.roomId;
      const side   = socket.data.side;

      if (roomId) {
        // Notify opponent directly (fast path, before terminateMatch removes them)
        socket.to(roomId).emit('opponent_disconnected');

        const winner: MatchEndedPayload['winner'] = side === 'left' ? 'right' : 'left';
        terminateMatch(io, roomId, 'disconnect', winner);
      }

      // 3. Clear this socket's own state (tidiness — socket is being destroyed)
      socket.data.roomId = undefined;
      socket.data.side   = undefined;
    });
  });
}
