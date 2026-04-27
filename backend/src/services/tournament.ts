import type { FastifyInstance } from "fastify";
import { query } from "../db.js";

type TournamentMatchRow = {
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

export function getBracketSize(playerCount: number): number {
  let size = 2;
  while (size < playerCount) size *= 2;
  return size;
}

export async function createTournamentGameRoom(
  tournamentId: number,
  round: number,
  matchOrder: number,
  player1Id: number,
  player2Id: number
): Promise<string> {
  const roomId = `tournament-${tournamentId}-r${round}-m${matchOrder}-${player1Id}-${player2Id}`;
  await query(
    `INSERT INTO game_rooms (room_id, player1_id, player2_id, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (room_id) DO NOTHING`,
    [roomId, player1Id, player2Id]
  );
  return roomId;
}

export async function notifyTournamentMatchReady(
  app: FastifyInstance,
  tournamentId: number,
  matchId: number,
  roomId: string,
  playerIds: [number, number]
): Promise<void> {
  const users = await query<{ id: number; username: string }>(
    `SELECT id, username FROM users WHERE id = ANY($1::INT[])`,
    [playerIds]
  );

  const userMap = new Map(users.map((user) => [user.id, user.username]));

  for (const userId of playerIds) {
    const opponentId = playerIds[0] === userId ? playerIds[1] : playerIds[0];
    app.notifySocialUser(userId, "tournament_match_ready", {
      tournamentId,
      matchId,
      roomId,
      opponentId,
      opponentUsername: userMap.get(opponentId) ?? "Opponent",
    });
  }
}

export async function ensureNextRound(app: FastifyInstance, tournamentId: number): Promise<void> {
  const rounds = await query<{ round: number }>(
    `SELECT DISTINCT round FROM tournament_matches WHERE tournament_id = $1 ORDER BY round DESC LIMIT 1`,
    [tournamentId]
  );

  if (rounds.length === 0) return;

  const currentRound = rounds[0].round;
  const currentMatches = await query<TournamentMatchRow>(
    `SELECT id, tournament_id, round, match_order, player1_id, player2_id, game_room_id, winner_id, status, completed_at
     FROM tournament_matches
     WHERE tournament_id = $1 AND round = $2
     ORDER BY match_order ASC`,
    [tournamentId, currentRound]
  );

  if (currentMatches.some((match) => match.status !== "completed" || !match.winner_id)) return;

  const winners = currentMatches.map((match) => match.winner_id!).filter(Boolean);

  if (winners.length === 1) {
    await query(
      `UPDATE tournaments
       SET status = 'completed', champion_id = $2, ended_at = NOW()
       WHERE id = $1`,
      [tournamentId, winners[0]]
    );
    return;
  }

  const nextRound = currentRound + 1;
  const existingNextRound = await query<{ id: string }>(
    `SELECT id FROM tournament_matches WHERE tournament_id = $1 AND round = $2 LIMIT 1`,
    [tournamentId, nextRound]
  );
  if (existingNextRound.length > 0) return;

  for (let i = 0; i < winners.length; i += 2) {
    const player1 = winners[i];
    const player2 = winners[i + 1] ?? null;
    const isBye = player2 === null;
    const matchOrder = Math.floor(i / 2) + 1;
    const roomId = player2 ? await createTournamentGameRoom(tournamentId, nextRound, matchOrder, player1, player2) : null;

    const [createdMatch] = await query<{ id: string }>(
      `INSERT INTO tournament_matches (tournament_id, round, match_order, player1_id, player2_id, game_room_id, winner_id, status, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        tournamentId,
        nextRound,
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
  }
}

export async function finalizeTournamentMatchFromRoom(
  app: FastifyInstance,
  roomId: string,
  winnerId: number | null
): Promise<void> {
  if (!winnerId) return;

  const [match] = await query<{
    id: string;
    tournament_id: string;
    player1_id: number;
    player2_id: number | null;
    status: "pending" | "completed";
  }>(
    `SELECT id, tournament_id, player1_id, player2_id, status
     FROM tournament_matches
     WHERE game_room_id = $1
     LIMIT 1`,
    [roomId]
  );

  if (!match || match.status === "completed") return;
  if (winnerId !== match.player1_id && winnerId !== match.player2_id) return;

  await query(
    `UPDATE tournament_matches
     SET winner_id = $2, status = 'completed', completed_at = NOW()
     WHERE id = $1 AND status = 'pending'`,
    [match.id, winnerId]
  );

  await ensureNextRound(app, Number(match.tournament_id));
}
