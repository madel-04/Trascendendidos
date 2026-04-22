import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db.js";

type RoomParams = { roomId: string };

const RoomIdParamsSchema = z.object({
  roomId: z.string().trim().min(5).max(128),
});

const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
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

type GameMatchRow = {
  id: string;
  room_id: string;
  player1_id: number;
  player2_id: number;
  winner_id: number | null;
  reason: string;
  player1_score: number;
  player2_score: number;
  created_at: Date;
  ended_at: Date;
  opponent_username: string;
  opponent_id: number;
};

type Achievement = {
  key: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  target: number;
};

function calculateLevel(xp: number) {
  const level = Math.floor(xp / 100) + 1;
  const currentLevelXp = (level - 1) * 100;
  return {
    level,
    xp,
    currentLevelXp,
    nextLevelXp: level * 100,
    progress: xp - currentLevelXp,
  };
}

function buildAchievements(stats: {
  totalPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number;
}): Achievement[] {
  return [
    {
      key: "first_match",
      title: "Primer saque",
      description: "Juega tu primera partida 1v1.",
      unlocked: stats.totalPlayed >= 1,
      progress: Math.min(stats.totalPlayed, 1),
      target: 1,
    },
    {
      key: "first_win",
      title: "Primera victoria",
      description: "Gana una partida oficial.",
      unlocked: stats.wins >= 1,
      progress: Math.min(stats.wins, 1),
      target: 1,
    },
    {
      key: "veteran_10",
      title: "Veterano de arena",
      description: "Completa 10 partidas.",
      unlocked: stats.totalPlayed >= 10,
      progress: Math.min(stats.totalPlayed, 10),
      target: 10,
    },
    {
      key: "streak_3",
      title: "Racha caliente",
      description: "Encadena 3 victorias.",
      unlocked: stats.currentStreak >= 3,
      progress: Math.min(stats.currentStreak, 3),
      target: 3,
    },
    {
      key: "winrate_60",
      title: "Precisión competitiva",
      description: "Alcanza 60% de win rate con 5+ partidas.",
      unlocked: stats.totalPlayed >= 5 && stats.winRate >= 60,
      progress: stats.totalPlayed >= 5 ? Math.min(Math.round(stats.winRate), 60) : stats.totalPlayed,
      target: stats.totalPlayed >= 5 ? 60 : 5,
    },
  ];
}

const statsSelect = `
  WITH user_matches AS (
    SELECT *
    FROM game_matches
    WHERE player1_id = $1 OR player2_id = $1
  ),
  ordered AS (
    SELECT
      winner_id,
      ended_at,
      ROW_NUMBER() OVER (ORDER BY ended_at DESC NULLS LAST, id DESC) AS row_number
    FROM user_matches
  ),
  streak_group AS (
    SELECT COALESCE(MIN(row_number), (SELECT COUNT(*) + 1 FROM ordered)) AS first_non_win
    FROM ordered
    WHERE winner_id IS DISTINCT FROM $1
  )
  SELECT
    COUNT(*)::int AS total_played,
    COUNT(*) FILTER (WHERE winner_id = $1)::int AS wins,
    COUNT(*) FILTER (WHERE winner_id IS NOT NULL AND winner_id <> $1)::int AS losses,
    COUNT(*) FILTER (WHERE winner_id IS NULL)::int AS draws,
    COALESCE(ROUND((COUNT(*) FILTER (WHERE winner_id = $1)::numeric / NULLIF(COUNT(*), 0)) * 100, 2), 0) AS win_rate,
    GREATEST(0, (SELECT first_non_win FROM streak_group) - 1)::int AS current_streak
  FROM user_matches
`;

const leaderboardSelect = `
  WITH per_user AS (
    SELECT
      u.id,
      u.username,
      COUNT(gm.id)::int AS total_played,
      COUNT(gm.id) FILTER (WHERE gm.winner_id = u.id)::int AS wins,
      COUNT(gm.id) FILTER (WHERE gm.winner_id IS NOT NULL AND gm.winner_id <> u.id)::int AS losses,
      COUNT(gm.id) FILTER (WHERE gm.winner_id IS NULL)::int AS draws
    FROM users u
    LEFT JOIN game_matches gm ON gm.player1_id = u.id OR gm.player2_id = u.id
    GROUP BY u.id, u.username
  ),
  scored AS (
    SELECT
      *,
      (1000 + wins * 35 + draws * 5 + total_played * 2 - losses * 20)::int AS rating,
      (wins * 60 + draws * 20 + total_played * 10)::int AS xp,
      COALESCE(ROUND((wins::numeric / NULLIF(total_played, 0)) * 100, 2), 0) AS win_rate
    FROM per_user
  )
  SELECT
    *,
    RANK() OVER (ORDER BY rating DESC, wins DESC, total_played ASC, username ASC)::int AS rank
  FROM scored
`;

export async function gameRoutes(app: FastifyInstance) {
  app.get("/api/game/stats", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;

      const [stats] = await query<{
        total_played: number;
        wins: number;
        losses: number;
        draws: number;
        win_rate: number;
        current_streak: number;
      }>(
        statsSelect,
        [userId]
      );

      const [rankRow] = await query<{
        rank: number;
        rating: number;
        xp: number;
      }>(
        `SELECT rank, rating, xp FROM (${leaderboardSelect}) leaderboard WHERE id = $1`,
        [userId]
      );

      const normalizedStats = {
        totalPlayed: stats?.total_played ?? 0,
        wins: stats?.wins ?? 0,
        losses: stats?.losses ?? 0,
        draws: stats?.draws ?? 0,
        winRate: Number(stats?.win_rate ?? 0),
        currentStreak: stats?.current_streak ?? 0,
      };

      const xp = rankRow?.xp ?? 0;

      return reply.send({
        ...normalizedStats,
        ranking: rankRow?.rank ?? null,
        rating: rankRow?.rating ?? 1000,
        progression: calculateLevel(xp),
        achievements: buildAchievements(normalizedStats),
      });
    } catch (error) {
      request.log.error(error, "Error obteniendo estadísticas de juego");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.get("/api/game/history", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { limit } = HistoryQuerySchema.parse(request.query);

      const rows = await query<GameMatchRow>(
        `SELECT gm.id, gm.room_id, gm.player1_id, gm.player2_id, gm.winner_id, gm.reason,
                gm.player1_score, gm.player2_score, gm.created_at, gm.ended_at,
                CASE
                  WHEN gm.player1_id = $1 THEN u2.username
                  ELSE u1.username
                END AS opponent_username,
                CASE
                  WHEN gm.player1_id = $1 THEN u2.id
                  ELSE u1.id
                END AS opponent_id
         FROM game_matches gm
         JOIN users u1 ON u1.id = gm.player1_id
         JOIN users u2 ON u2.id = gm.player2_id
         WHERE gm.player1_id = $1 OR gm.player2_id = $1
         ORDER BY gm.ended_at DESC
         LIMIT $2`,
        [userId, limit ?? 20]
      );

      return reply.send({
        matches: rows.map((row) => ({
          id: row.id,
          roomId: row.room_id,
          opponentId: row.opponent_id,
          opponentUsername: row.opponent_username,
          reason: row.reason,
          player1Score: row.player1_score,
          player2Score: row.player2_score,
          scoreFor: row.player1_id === userId ? row.player1_score : row.player2_score,
          scoreAgainst: row.player1_id === userId ? row.player2_score : row.player1_score,
          winnerId: row.winner_id,
          result: row.winner_id === null ? "draw" : row.winner_id === userId ? "win" : "loss",
          createdAt: row.created_at,
          endedAt: row.ended_at,
        })),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error obteniendo historial de juego");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.get("/api/game/leaderboard", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { limit } = HistoryQuerySchema.parse(request.query);
      const rows = await query<{
        id: number;
        username: string;
        total_played: number;
        wins: number;
        losses: number;
        draws: number;
        rating: number;
        xp: number;
        win_rate: number;
        rank: number;
      }>(
        `SELECT * FROM (${leaderboardSelect}) leaderboard
         ORDER BY rank ASC
         LIMIT $1`,
        [limit ?? 10]
      );

      return reply.send({
        players: rows.map((row) => ({
          id: row.id,
          username: row.username,
          rank: row.rank,
          rating: row.rating,
          totalPlayed: row.total_played,
          wins: row.wins,
          losses: row.losses,
          draws: row.draws,
          winRate: Number(row.win_rate),
          progression: calculateLevel(row.xp),
        })),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error obteniendo leaderboard");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

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
