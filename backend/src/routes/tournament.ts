import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db.js";
import {
  createTournamentGameRoom,
  ensureNextRound,
  getBracketSize,
  notifyTournamentMatchReady,
} from "../services/tournament.js";

const CreateTournamentSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional().default(""),
  maxPlayers: z.union([z.literal(4), z.literal(8), z.literal(16)]),
});

const UpdateTournamentSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional().default(""),
});

const TournamentParamsSchema = z.object({
  tournamentId: z.coerce.number().int().positive(),
});

const MatchParamsSchema = z.object({
  tournamentId: z.coerce.number().int().positive(),
  matchId: z.coerce.number().int().positive(),
});

const ReportResultSchema = z.object({
  winnerUserId: z.coerce.number().int().positive(),
});

type TournamentRow = {
  id: string;
  name: string;
  description: string;
  creator_id: number;
  status: "open" | "in_progress" | "completed" | "cancelled";
  max_players: number;
  champion_id: number | null;
  created_at: Date;
  started_at: Date | null;
  ended_at: Date | null;
};

type ParticipantRow = {
  id: string;
  tournament_id: string;
  user_id: number;
  seed: number | null;
  joined_at: Date;
  username: string;
};

type MatchRow = {
  id: string;
  tournament_id: string;
  round: number;
  match_order: number;
  player1_id: number;
  player2_id: number | null;
  game_room_id: string | null;
  winner_id: number | null;
  status: "pending" | "completed";
  completed_at: Date | null;
};

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function tournamentRoutes(app: FastifyInstance) {
  app.get("/api/tournament", { onRequest: [app.authenticate] }, async (_request, reply) => {
    const currentUserId = (_request.user as any).userId as number;
    const tournaments = await query<
      TournamentRow & { creator_username: string; champion_username: string | null; participants_count: number }
    >(
      `SELECT t.id, t.name, t.description, t.creator_id, t.status, t.max_players, t.champion_id, t.created_at, t.started_at, t.ended_at,
              cu.username AS creator_username,
              ch.username AS champion_username,
              COUNT(tp.id)::int AS participants_count
       FROM tournaments t
       JOIN users cu ON cu.id = t.creator_id
       LEFT JOIN users ch ON ch.id = t.champion_id
       LEFT JOIN tournament_participants tp ON tp.tournament_id = t.id
       GROUP BY t.id, cu.username, ch.username
       ORDER BY t.created_at DESC
       LIMIT 50`
    );

    return reply.send({
      tournaments: tournaments.map((t) => ({
        id: Number(t.id),
        name: t.name,
        description: t.description,
        status: t.status,
        maxPlayers: t.max_players,
        participantsCount: t.participants_count,
        creator: { id: t.creator_id, username: t.creator_username, role: "host" as const },
        permissions: {
          canManage: t.creator_id === currentUserId,
          canEdit: t.creator_id === currentUserId && t.status === "open",
          canCancel: t.creator_id === currentUserId && (t.status === "open" || t.status === "in_progress"),
          canStart: t.creator_id === currentUserId && t.status === "open",
        },
        championUsername: t.champion_username,
        createdAt: t.created_at,
        startedAt: t.started_at,
        endedAt: t.ended_at,
      })),
    });
  });

  app.post("/api/tournament", { onRequest: [app.authenticate] }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const body = CreateTournamentSchema.parse(request.body);

      const [created] = await query<TournamentRow>(
        `INSERT INTO tournaments (name, description, creator_id, max_players)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, description, creator_id, status, max_players, champion_id, created_at, started_at, ended_at`,
        [body.name, body.description, userId, body.maxPlayers]
      );

      await query(
        `INSERT INTO tournament_participants (tournament_id, user_id)
         VALUES ($1, $2)`,
        [created.id, userId]
      );

      return reply.code(201).send({
        tournament: {
          id: Number(created.id),
          name: created.name,
          description: created.description,
          status: created.status,
          maxPlayers: created.max_players,
          createdAt: created.created_at,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error creando torneo");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.get<{ Params: { tournamentId: string } }>("/api/tournament/:tournamentId", { onRequest: [app.authenticate] }, async (request, reply) => {
    try {
      const { tournamentId } = TournamentParamsSchema.parse(request.params);
      const currentUserId = (request.user as any).userId as number;

      const [tournament] = await query<
        TournamentRow & { creator_username: string; champion_username: string | null }
      >(
        `SELECT t.id, t.name, t.description, t.creator_id, t.status, t.max_players, t.champion_id, t.created_at, t.started_at, t.ended_at,
                cu.username AS creator_username,
                ch.username AS champion_username
         FROM tournaments t
         JOIN users cu ON cu.id = t.creator_id
         LEFT JOIN users ch ON ch.id = t.champion_id
         WHERE t.id = $1
         LIMIT 1`,
        [tournamentId]
      );

      if (!tournament) {
        return reply.code(404).send({ error: "Torneo no encontrado" });
      }

      const participants = await query<ParticipantRow>(
        `SELECT tp.id, tp.tournament_id, tp.user_id, tp.seed, tp.joined_at, u.username
         FROM tournament_participants tp
         JOIN users u ON u.id = tp.user_id
         WHERE tp.tournament_id = $1
         ORDER BY tp.joined_at ASC`,
        [tournamentId]
      );

      const matches = await query<
        MatchRow & { player1_username: string; player2_username: string; winner_username: string | null }
      >(
        `SELECT tm.id, tm.tournament_id, tm.round, tm.match_order, tm.player1_id, tm.player2_id, tm.game_room_id, tm.winner_id, tm.status, tm.completed_at,
                p1.username AS player1_username,
                p2.username AS player2_username,
                w.username AS winner_username
         FROM tournament_matches tm
         JOIN users p1 ON p1.id = tm.player1_id
         LEFT JOIN users p2 ON p2.id = tm.player2_id
         LEFT JOIN users w ON w.id = tm.winner_id
         WHERE tm.tournament_id = $1
         ORDER BY tm.round ASC, tm.match_order ASC`,
        [tournamentId]
      );

      return reply.send({
        tournament: {
          id: Number(tournament.id),
          name: tournament.name,
          description: tournament.description,
          status: tournament.status,
          maxPlayers: tournament.max_players,
          creator: { id: tournament.creator_id, username: tournament.creator_username, role: "host" as const },
          permissions: {
            canManage: tournament.creator_id === currentUserId,
            canEdit: tournament.creator_id === currentUserId && tournament.status === "open",
            canCancel: tournament.creator_id === currentUserId && (tournament.status === "open" || tournament.status === "in_progress"),
            canStart: tournament.creator_id === currentUserId && tournament.status === "open",
          },
          championUsername: tournament.champion_username,
          createdAt: tournament.created_at,
          startedAt: tournament.started_at,
          endedAt: tournament.ended_at,
        },
        participants: participants.map((p) => ({
          id: Number(p.id),
          userId: p.user_id,
          username: p.username,
          seed: p.seed,
          joinedAt: p.joined_at,
        })),
        matches: matches.map((m) => ({
          id: Number(m.id),
          round: m.round,
          order: m.match_order,
          status: m.status,
          gameRoomId: m.game_room_id,
          player1: { id: m.player1_id, username: m.player1_username },
          player2: m.player2_id ? { id: m.player2_id, username: m.player2_username } : null,
          winner: m.winner_id ? { id: m.winner_id, username: m.winner_username } : null,
          completedAt: m.completed_at,
        })),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error obteniendo torneo");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post<{ Params: { tournamentId: string } }>("/api/tournament/:tournamentId/join", { onRequest: [app.authenticate] }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { tournamentId } = TournamentParamsSchema.parse(request.params);

      const [tournament] = await query<TournamentRow>(
        `SELECT id, name, description, creator_id, status, max_players, champion_id, created_at, started_at, ended_at
         FROM tournaments
         WHERE id = $1
         LIMIT 1`,
        [tournamentId]
      );

      if (!tournament) {
        return reply.code(404).send({ error: "Torneo no encontrado" });
      }

      if (tournament.status !== "open") {
        return reply.code(409).send({ error: "El torneo ya no acepta participantes" });
      }

      const [existing] = await query<{ id: string }>(
        `SELECT id FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2 LIMIT 1`,
        [tournamentId, userId]
      );
      if (existing) {
        return reply.code(409).send({ error: "Ya estás registrado en este torneo" });
      }

      const [countRow] = await query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM tournament_participants WHERE tournament_id = $1`,
        [tournamentId]
      );
      if ((countRow?.count ?? 0) >= tournament.max_players) {
        return reply.code(409).send({ error: "El torneo ya está lleno" });
      }

      await query(
        `INSERT INTO tournament_participants (tournament_id, user_id)
         VALUES ($1, $2)`,
        [tournamentId, userId]
      );

      return reply.send({ message: "Te has unido al torneo" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error uniéndose al torneo");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post<{ Params: { tournamentId: string } }>("/api/tournament/:tournamentId/start", { onRequest: [app.authenticate] }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { tournamentId } = TournamentParamsSchema.parse(request.params);

      const [tournament] = await query<TournamentRow>(
        `SELECT id, name, description, creator_id, status, max_players, champion_id, created_at, started_at, ended_at
         FROM tournaments
         WHERE id = $1
         LIMIT 1`,
        [tournamentId]
      );

      if (!tournament) {
        return reply.code(404).send({ error: "Torneo no encontrado" });
      }
      if (tournament.creator_id !== userId) {
        return reply.code(403).send({ error: "Solo el creador puede iniciar el torneo" });
      }
      if (tournament.status !== "open") {
        return reply.code(409).send({ error: "El torneo ya fue iniciado" });
      }

      const participants = await query<{ user_id: number }>(
        `SELECT user_id FROM tournament_participants WHERE tournament_id = $1 ORDER BY joined_at ASC`,
        [tournamentId]
      );

      if (participants.length < 2) {
        return reply.code(409).send({ error: "Se requieren al menos 2 jugadores para iniciar" });
      }

      const shuffled = shuffle(participants.map((p) => p.user_id));
      for (let i = 0; i < shuffled.length; i += 1) {
        await query(
          `UPDATE tournament_participants
           SET seed = $3
           WHERE tournament_id = $1 AND user_id = $2`,
          [tournamentId, shuffled[i], i + 1]
        );
      }

      const bracketSize = getBracketSize(shuffled.length);
      const byes = bracketSize - shuffled.length;
      const byePlayers = shuffled.slice(0, byes);
      const playersToPair = shuffled.slice(byes);

      let matchOrder = 1;

      for (const player1 of byePlayers) {
        await query(
          `INSERT INTO tournament_matches (tournament_id, round, match_order, player1_id, player2_id, game_room_id, winner_id, status, completed_at)
           VALUES ($1, 1, $2, $3, NULL, NULL, $3, 'completed', NOW())`,
          [tournamentId, matchOrder, player1]
        );
        matchOrder += 1;
      }

      for (let i = 0; i < playersToPair.length; i += 2) {
        const player1 = playersToPair[i];
        const player2 = playersToPair[i + 1] ?? null;
        const isBye = player2 === null;
        const roomId = player2 ? await createTournamentGameRoom(tournamentId, 1, matchOrder, player1, player2) : null;

        const [createdMatch] = await query<{ id: string }>(
          `INSERT INTO tournament_matches (tournament_id, round, match_order, player1_id, player2_id, game_room_id, winner_id, status, completed_at)
           VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            tournamentId,
            matchOrder,
            player1,
            player2,
            roomId,
            isBye ? player1 : null,
            isBye ? "completed" : "pending",
            isBye ? new Date() : null,
          ]
        );

        if (roomId && player2 && createdMatch) {
          await notifyTournamentMatchReady(app, tournamentId, Number(createdMatch.id), roomId, [player1, player2]);
        }
        matchOrder += 1;
      }

      await query(
        `UPDATE tournaments
         SET status = 'in_progress', started_at = NOW()
         WHERE id = $1`,
        [tournamentId]
      );

      await ensureNextRound(app, tournamentId);

      return reply.send({ message: "Torneo iniciado" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error iniciando torneo");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post<{ Params: { tournamentId: string; matchId: string } }>("/api/tournament/:tournamentId/matches/:matchId/report", { onRequest: [app.authenticate] }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { tournamentId, matchId } = MatchParamsSchema.parse(request.params);
      const body = ReportResultSchema.parse(request.body);

      const [tournament] = await query<TournamentRow>(
        `SELECT id, name, description, creator_id, status, max_players, champion_id, created_at, started_at, ended_at
         FROM tournaments WHERE id = $1 LIMIT 1`,
        [tournamentId]
      );
      if (!tournament) {
        return reply.code(404).send({ error: "Torneo no encontrado" });
      }
      if (tournament.status !== "in_progress") {
        return reply.code(409).send({ error: "El torneo no está en progreso" });
      }

      const [match] = await query<MatchRow>(
        `SELECT id, tournament_id, round, match_order, player1_id, player2_id, game_room_id, winner_id, status, completed_at
         FROM tournament_matches
         WHERE id = $1 AND tournament_id = $2
         LIMIT 1`,
        [matchId, tournamentId]
      );

      if (!match) {
        return reply.code(404).send({ error: "Partida del torneo no encontrada" });
      }
      if (match.status === "completed") {
        return reply.code(409).send({ error: "Esta partida ya fue reportada" });
      }
      if (body.winnerUserId !== match.player1_id && body.winnerUserId !== match.player2_id) {
        return reply.code(400).send({ error: "El ganador debe ser uno de los jugadores de la partida" });
      }

      // Creator or one of the match players can report
      const canReport = tournament.creator_id === userId || userId === match.player1_id || userId === match.player2_id;
      if (!canReport) {
        return reply.code(403).send({ error: "No tienes permisos para reportar esta partida" });
      }

      await query(
        `UPDATE tournament_matches
         SET winner_id = $3, status = 'completed', completed_at = NOW()
         WHERE id = $1 AND tournament_id = $2`,
        [matchId, tournamentId, body.winnerUserId]
      );

      await ensureNextRound(app, tournamentId);

      return reply.send({ message: "Resultado reportado correctamente" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error reportando resultado del torneo");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.put<{ Params: { tournamentId: string } }>("/api/tournament/:tournamentId", { onRequest: [app.authenticate] }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { tournamentId } = TournamentParamsSchema.parse(request.params);
      const body = UpdateTournamentSchema.parse(request.body);

      const [tournament] = await query<TournamentRow>(
        `SELECT id, name, description, creator_id, status, max_players, champion_id, created_at, started_at, ended_at
         FROM tournaments
         WHERE id = $1
         LIMIT 1`,
        [tournamentId]
      );

      if (!tournament) {
        return reply.code(404).send({ error: "Torneo no encontrado" });
      }
      if (tournament.creator_id !== userId) {
        return reply.code(403).send({ error: "Solo el anfitrion puede editar el torneo" });
      }
      if (tournament.status !== "open") {
        return reply.code(409).send({ error: "Solo puedes editar un torneo abierto" });
      }

      await query(
        `UPDATE tournaments
         SET name = $2, description = $3
         WHERE id = $1`,
        [tournamentId, body.name, body.description]
      );

      return reply.send({ message: "Torneo actualizado correctamente" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error actualizando torneo");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post<{ Params: { tournamentId: string } }>("/api/tournament/:tournamentId/cancel", { onRequest: [app.authenticate] }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { tournamentId } = TournamentParamsSchema.parse(request.params);

      const [tournament] = await query<TournamentRow>(
        `SELECT id, name, description, creator_id, status, max_players, champion_id, created_at, started_at, ended_at
         FROM tournaments
         WHERE id = $1
         LIMIT 1`,
        [tournamentId]
      );

      if (!tournament) {
        return reply.code(404).send({ error: "Torneo no encontrado" });
      }
      if (tournament.creator_id !== userId) {
        return reply.code(403).send({ error: "Solo el anfitrion puede cancelar el torneo" });
      }
      if (tournament.status === "completed") {
        return reply.code(409).send({ error: "No puedes cancelar un torneo completado" });
      }
      if (tournament.status === "cancelled") {
        return reply.code(409).send({ error: "El torneo ya esta cancelado" });
      }

      await query(
        `UPDATE tournaments
         SET status = 'cancelled', ended_at = NOW()
         WHERE id = $1`,
        [tournamentId]
      );

      return reply.send({ message: "Torneo cancelado" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error cancelando torneo");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });
}
