import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db.js";

type RoomParams = { roomId: string };

const RoomIdParamsSchema = z.object({
  roomId: z.string().trim().min(5).max(128),
});

type GameRoom = {
  id: number;
  room_id: string;
  player1_id: number;
  player2_id: number;
  player1_ready: boolean;
  player2_ready: boolean;
  game_started: boolean;
  created_at: Date;
  updated_at: Date;
};

type UserRow = {
  id: number;
  username: string;
};

export async function gameRoutes(app: FastifyInstance) {
  // Create or fetch game room when user joins from match invite
  app.post<{ Params: RoomParams }>("/api/game/room/:roomId/join", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { roomId } = RoomIdParamsSchema.parse(request.params);

      // Check if room exists
      const [existingRoom] = await query<GameRoom>(
        `SELECT * FROM game_rooms WHERE room_id = $1 LIMIT 1`,
        [roomId]
      );

      if (existingRoom) {
        // User is joining existing room
        const isPlayer1 = existingRoom.player1_id === userId;
        const isPlayer2 = existingRoom.player2_id === userId;

        if (!isPlayer1 && !isPlayer2) {
          return reply.code(403).send({ error: "No eres parte de esta sala" });
        }

        if (existingRoom.game_started) {
          return reply.code(409).send({ error: "La partida ya ha comenzado" });
        }

        const opponent = isPlayer1 ? existingRoom.player2_id : existingRoom.player1_id;
        const opponentUser = await query<UserRow>(
          `SELECT id, username FROM users WHERE id = $1`,
          [opponent]
        );

        const opponentUsername = opponentUser[0]?.username ?? "Unknown";

        // Notify opponent that player joined
        app.notifySocialUser(opponent, "game_player_joined", {
          roomId: existingRoom.room_id,
          playerId: userId,
          playerUsername: (request.user as any).username,
        });

        return reply.send({
          message: "Sala encontrada",
          roomId: existingRoom.room_id,
          room: {
            id: existingRoom.id,
            roomId: existingRoom.room_id,
            player1Ready: existingRoom.player1_ready,
            player2Ready: existingRoom.player2_ready,
            gameStarted: existingRoom.game_started,
          },
          opponent: opponentUsername,
        });
      }

      // New room - query match_invites to find the other player
      const [invite] = await query<{
        sender_id: number;
        receiver_id: number;
      }>(
        `SELECT sender_id, receiver_id FROM match_invites
         WHERE match_room_id = $1 AND status = 'accepted'
         LIMIT 1`,
        [roomId]
      );

      if (!invite) {
        return reply.code(404).send({ error: "Sala no encontrada" });
      }

      const opponentId = invite.sender_id === userId ? invite.receiver_id : invite.sender_id;

      if (opponentId !== userId && invite.sender_id !== userId && invite.receiver_id !== userId) {
        return reply.code(403).send({ error: "No tienes permiso para acceder a esta sala" });
      }

      // Create new game room
      const [newRoom] = await query<GameRoom>(
        `INSERT INTO game_rooms (room_id, player1_id, player2_id, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING *`,
        [roomId, userId, opponentId]
      );

      const opponentUser = await query<UserRow>(
        `SELECT id, username FROM users WHERE id = $1`,
        [opponentId]
      );

      const opponentUsername = opponentUser[0]?.username ?? "Unknown";

      // Notify opponent that room was created
      app.notifySocialUser(opponentId, "game_room_created", {
        roomId: newRoom.room_id,
        creatorId: userId,
        creatorUsername: (request.user as any).username,
      });

      return reply.code(201).send({
        message: "Sala creada",
        roomId: newRoom.room_id,
        room: {
          id: newRoom.id,
          roomId: newRoom.room_id,
          player1Ready: newRoom.player1_ready,
          player2Ready: newRoom.player2_ready,
          gameStarted: newRoom.game_started,
        },
        opponent: opponentUsername,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: "RoomId inválido" });
      }
      request.log.error(error, "Error creando/accediendo sala de juego");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  // Get game room status
  app.get<{ Params: RoomParams }>("/api/game/room/:roomId/status", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { roomId } = RoomIdParamsSchema.parse(request.params);

      const [room] = await query<GameRoom>(
        `SELECT * FROM game_rooms WHERE room_id = $1 LIMIT 1`,
        [roomId]
      );

      if (!room) {
        return reply.code(404).send({ error: "Sala no encontrada" });
      }

      const isPlayer1 = room.player1_id === userId;
      const isPlayer2 = room.player2_id === userId;

      if (!isPlayer1 && !isPlayer2) {
        return reply.code(403).send({ error: "No eres parte de esta sala" });
      }

      const opponent = isPlayer1 ? room.player2_id : room.player1_id;
      const opponentUser = await query<UserRow>(
        `SELECT id, username FROM users WHERE id = $1`,
        [opponent]
      );

      return reply.send({
        roomId: room.room_id,
        status: room.game_started ? "started" : room.player1_ready && room.player2_ready ? "ready" : "waiting",
        players: {
          you: {
            playerId: userId,
            ready: isPlayer1 ? room.player1_ready : room.player2_ready,
          },
          opponent: {
            playerId: opponent,
            username: opponentUser[0]?.username ?? "Unknown",
            ready: isPlayer1 ? room.player2_ready : room.player1_ready,
          },
        },
        gameStarted: room.game_started,
        createdAt: room.created_at,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: "RoomId inválido" });
      }
      request.log.error(error, "Error obteniendo estado de sala");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  // Mark player as ready
  app.post<{ Params: RoomParams }>("/api/game/room/:roomId/ready", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { roomId } = RoomIdParamsSchema.parse(request.params);

      const [room] = await query<GameRoom>(
        `SELECT * FROM game_rooms WHERE room_id = $1 LIMIT 1`,
        [roomId]
      );

      if (!room) {
        return reply.code(404).send({ error: "Sala no encontrada" });
      }

      const isPlayer1 = room.player1_id === userId;
      const isPlayer2 = room.player2_id === userId;

      if (!isPlayer1 && !isPlayer2) {
        return reply.code(403).send({ error: "No eres parte de esta sala" });
      }

      if (room.game_started) {
        return reply.code(409).send({ error: "La partida ya comenzó" });
      }

      // Update ready status
      const playerColumn = isPlayer1 ? "player1_ready" : "player2_ready";
      const [updatedRoom] = await query<GameRoom>(
        `UPDATE game_rooms
         SET ${playerColumn} = TRUE, updated_at = NOW()
         WHERE room_id = $1
         RETURNING *`,
        [roomId]
      );

      const opponentId = isPlayer1 ? room.player2_id : room.player1_id;

      // Notify opponent
      app.notifySocialUser(opponentId, "game_player_ready", {
        roomId: updatedRoom.room_id,
        playerId: userId,
        bothReady: updatedRoom.player1_ready && updatedRoom.player2_ready,
      });

      const bothReady = updatedRoom.player1_ready && updatedRoom.player2_ready;

      if (bothReady) {
        // Mark game as started
        await query<GameRoom>(
          `UPDATE game_rooms
           SET game_started = TRUE, updated_at = NOW()
           WHERE room_id = $1`,
          [roomId]
        );

        // Notify both players game is starting
        app.notifySocialUser(userId, "game_start", {
          roomId: updatedRoom.room_id,
        });

        app.notifySocialUser(opponentId, "game_start", {
          roomId: updatedRoom.room_id,
        });
      }

      return reply.send({
        message: "Estado actualizado",
        roomId: updatedRoom.room_id,
        playerReady: isPlayer1 ? updatedRoom.player1_ready : updatedRoom.player2_ready,
        opponentReady: isPlayer1 ? updatedRoom.player2_ready : updatedRoom.player1_ready,
        bothReady,
        gameStarted: bothReady,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: "RoomId inválido" });
      }
      request.log.error(error, "Error marcando jugador como listo");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });
}
