import { Socket, Server } from 'socket.io';
import { query } from '../db.js';
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

// Match registry: tracks active matches, socket ids and user ids
// Key: roomId  →  Value: { left: socketId, right: socketId, leftUserId?, rightUserId? }
const activeMatches = new Map<string, {
  left: string;
  right: string;
  rematchLeft: boolean;
  rematchRight: boolean;
  leftUserId?: number;
  rightUserId?: number;
}>();

// ─── Match registry helpers ───────────────────────────────────────────────────

function registerMatch(roomId: string, leftId: string, rightId: string, leftUserId?: number, rightUserId?: number): void {
  activeMatches.set(roomId, { left: leftId, right: rightId, rematchLeft: false, rematchRight: false, leftUserId, rightUserId });
  console.log(`[Match] Registered: ${roomId} | left=${leftId} right=${rightId}`);
}

async function persistMatchResult(roomId: string, reason: MatchEndedPayload['reason'], winner: MatchEndedPayload['winner']): Promise<void> {
  const [room] = await query<{ room_id: string; player1_id: number; player2_id: number }>(
    `SELECT room_id, player1_id, player2_id FROM game_rooms WHERE room_id = $1 LIMIT 1`,
    [roomId]
  );

  if (!room) return;

  const winnerId = winner === 'left'
    ? room.player1_id
    : winner === 'right'
      ? room.player2_id
      : null;

  await query(
    `INSERT INTO game_matches (room_id, player1_id, player2_id, winner_id, reason, player1_score, player2_score, created_at, ended_at)
     VALUES ($1, $2, $3, $4, $5, 0, 0, NOW(), NOW())
     ON CONFLICT (room_id) DO UPDATE SET
       winner_id = EXCLUDED.winner_id,
       reason = EXCLUDED.reason,
       ended_at = EXCLUDED.ended_at`,
    [room.room_id, room.player1_id, room.player2_id, winnerId, reason]
  );
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

  void persistMatchResult(roomId, reason, winner).catch((error) => {
    console.error(`[Match] Failed to persist result for ${roomId}`, error);
  });
}

// ─── Matchmaking helpers ──────────────────────────────────────────────────────

function tryMatchmake(io: IoServer, socket: IoSocket): void {
  if (!socket.data.userId) {
    socket.emit('matchmaking_error', { message: 'Sesion no valida. Vuelve a iniciar sesion.' });
    return;
  }

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
    const leftUserId = socketA.data.userId;
    const rightUserId = socketB.data.userId;

    if (!leftUserId || !rightUserId) {
      console.log(`[Matchmaking] Missing authenticated user ids for ${roomId}`);
      socketA.emit('matchmaking_error', { message: 'Sesion no valida. Vuelve a iniciar sesion.' });
      socketB.emit('matchmaking_error', { message: 'Sesion no valida. Vuelve a iniciar sesion.' });
      return;
    }

    if (leftUserId === rightUserId) {
      socketA.emit('matchmaking_error', { message: 'Abre matchmaking con dos usuarios distintos.' });
      socketB.emit('matchmaking_error', { message: 'Abre matchmaking con dos usuarios distintos.' });
      return;
    }

    socketA.data.roomId = roomId;
    socketA.data.side   = 'left';
    socketB.data.roomId = roomId;
    socketB.data.side   = 'right';

    socketA.join(roomId);
    socketB.join(roomId);

    void query(
      `INSERT INTO game_rooms (room_id, player1_id, player2_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (room_id) DO NOTHING`,
      [roomId, leftUserId, rightUserId]
    ).catch((error) => {
      console.error(`[Matchmaking] Failed creating game room for ${roomId}`, error);
    });

    registerMatch(roomId, idA, idB, leftUserId, rightUserId);

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

    socket.on('ball_state', (payload) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.to(roomId).emit('ball_state', payload);
    });

    socket.on('score_update', (payload) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.to(roomId).emit('score_update', payload);
    });

    socket.on('game_over', (payload: { winner: 'left' | 'right' }) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;

      io.to(roomId).emit('match_ended', { reason: 'completed', winner: payload.winner });
      void persistMatchResult(roomId, 'completed', payload.winner).catch((error) => {
        console.error(`[Match] Failed to persist completed result for ${roomId}`, error);
      });
    });

    socket.on('play_again_request', () => {
      const roomId = socket.data.roomId;
      const side = socket.data.side;
      if (!roomId || !side) return;

      const match = activeMatches.get(roomId);
      if (!match) return;

      if (side === 'left') match.rematchLeft = true;
      if (side === 'right') match.rematchRight = true;

      if (match.rematchLeft && match.rematchRight) {
        match.rematchLeft = false;
        match.rematchRight = false;
        io.to(roomId).emit('restart_match');
        console.log(`[Match] ${roomId} is restarting a rematch.`);
      }
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

     // ── Chat Advanced Features (typing indicators + read receipts) ────────────

     // Broadcast typing indicator to recipient
     socket.on('user_typing', (payload: { toUsername: string; fromUsername: string }) => {
       io.emit('typing_indicator', {
         fromUsername: payload.fromUsername,
         toUsername: payload.toUsername,
       });
       console.log(`[Chat] ${payload.fromUsername} is typing to ${payload.toUsername}`);
     });

     // Broadcast typing stopped
     socket.on('user_stopped_typing', (payload: { toUsername: string; fromUsername: string }) => {
       io.emit('typing_stopped', {
         fromUsername: payload.fromUsername,
         toUsername: payload.toUsername,
       });
     });

     // Mark message as read (client-side notification only; persistence is handled by REST)
     socket.on('mark_message_read', (payload: { messageId: string; messageCreatedAt: Date }) => {
       socket.emit('message_marked_read', {
         messageId: payload.messageId,
         readAt: new Date(),
       });
     });
  });
}
