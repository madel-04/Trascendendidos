import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db.js";

type UserRow = {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type InviteDetailRow = {
  id: string;
  sender_id: number;
  receiver_id: number;
  match_room_id: string | null;
};

type InviteParams = { inviteId: string };

const UsernameBodySchema = z.object({
  username: z.string().trim().min(3).max(50),
});

const InviteIdParamsSchema = z.object({
  inviteId: z.coerce.number().int().positive(),
});

async function findUserByUsername(username: string): Promise<UserRow | undefined> {
  const [user] = await query<UserRow>(
    "SELECT id, username, display_name, avatar_url FROM users WHERE username = $1",
    [username]
  );
  return user;
}

async function areFriends(userId: number, targetId: number): Promise<boolean> {
  const [row] = await query<{ exists: number }>(
    `SELECT 1 AS exists
     FROM friends
     WHERE user_id = $1 AND friend_id = $2
     LIMIT 1`,
    [userId, targetId]
  );
  return !!row;
}

async function hasBlockBetween(userId: number, targetId: number): Promise<boolean> {
  const [row] = await query<{ exists: number }>(
    `SELECT 1 AS exists
     FROM blocks
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [userId, targetId]
  );
  return !!row;
}

export async function matchRoutes(app: FastifyInstance) {
  app.get("/api/match/invites", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;

      const incoming = await query<{
        id: string;
        sender_id: number;
        match_room_id: string | null;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        status: string;
        created_at: Date;
      }>(
        `SELECT mi.id, mi.sender_id, mi.match_room_id, u.username, u.display_name, u.avatar_url, mi.status, mi.created_at
         FROM match_invites mi
         JOIN users u ON u.id = mi.sender_id
         WHERE mi.receiver_id = $1
         ORDER BY mi.created_at DESC
         LIMIT 50`,
        [userId]
      );

      const outgoing = await query<{
        id: string;
        receiver_id: number;
        match_room_id: string | null;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        status: string;
        created_at: Date;
      }>(
        `SELECT mi.id, mi.receiver_id, mi.match_room_id, u.username, u.display_name, u.avatar_url, mi.status, mi.created_at
         FROM match_invites mi
         JOIN users u ON u.id = mi.receiver_id
         WHERE mi.sender_id = $1
         ORDER BY mi.created_at DESC
         LIMIT 50`,
        [userId]
      );

      return reply.send({
        incoming: incoming.map((item) => ({
          id: item.id,
          status: item.status,
          createdAt: item.created_at,
          roomId: item.match_room_id,
          user: {
            id: item.sender_id,
            username: item.username,
            displayName: item.display_name,
            avatarUrl: item.avatar_url,
          },
        })),
        outgoing: outgoing.map((item) => ({
          id: item.id,
          status: item.status,
          createdAt: item.created_at,
          roomId: item.match_room_id,
          user: {
            id: item.receiver_id,
            username: item.username,
            displayName: item.display_name,
            avatarUrl: item.avatar_url,
          },
        })),
      });
    } catch (error) {
      request.log.error(error, "Error listando invitaciones de partida");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post("/api/match/invite", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const body = UsernameBodySchema.parse(request.body);
      const targetUser = await findUserByUsername(body.username);

      if (!targetUser) {
        return reply.code(404).send({ error: "Usuario no encontrado" });
      }
      if (targetUser.id === userId) {
        return reply.code(400).send({ error: "No puedes invitarte a ti mismo" });
      }

      const friend = await areFriends(userId, targetUser.id);
      if (!friend) {
        return reply.code(403).send({ error: "Solo puedes invitar a amigos" });
      }

      const blocked = await hasBlockBetween(userId, targetUser.id);
      if (blocked) {
        return reply.code(403).send({ error: "No puedes invitar por bloqueo activo" });
      }

      const [existingPending] = await query<{ id: string }>(
        `SELECT id
         FROM match_invites
         WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'
         LIMIT 1`,
        [userId, targetUser.id]
      );

      if (existingPending) {
        return reply.code(409).send({ error: "Ya hay una invitacion pendiente para este usuario" });
      }

      const [invite] = await query<{ id: string; created_at: Date }>(
        `INSERT INTO match_invites (sender_id, receiver_id, status)
         VALUES ($1, $2, 'pending')
         RETURNING id, created_at`,
        [userId, targetUser.id]
      );

      app.notifySocialUser(targetUser.id, "match_invite_received", {
        inviteId: invite.id,
        fromUserId: userId,
      });

      app.notifySocialUser(userId, "match_invite_sent", {
        inviteId: invite.id,
        toUserId: targetUser.id,
      });

      return reply.code(201).send({
        message: "Invitacion enviada",
        inviteId: invite.id,
        createdAt: invite.created_at,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error enviando invitacion de partida");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post<{ Params: InviteParams }>("/api/match/invite/:inviteId/accept", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { inviteId } = InviteIdParamsSchema.parse(request.params);
      const roomId = `room-${inviteId}-${Date.now()}`;

      const [invite] = await query<InviteDetailRow>(
        `UPDATE match_invites
         SET status = 'accepted',
             match_room_id = COALESCE(match_room_id, $3),
             updated_at = NOW()
         WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
         RETURNING id, sender_id, receiver_id, match_room_id`,
        [inviteId, userId, roomId]
      );

      if (!invite) {
        return reply.code(404).send({ error: "Invitacion pendiente no encontrada" });
      }

      const users = await query<{ id: number; username: string }>(
        `SELECT id, username
         FROM users
         WHERE id = ANY($1::INT[])`,
        [[invite.sender_id, invite.receiver_id]]
      );

      const senderUsername = users.find((item) => item.id === invite.sender_id)?.username ?? "";
      const receiverUsername = users.find((item) => item.id === invite.receiver_id)?.username ?? "";

      app.notifySocialUser(invite.sender_id, "match_invite_accepted", {
        inviteId: invite.id,
        byUserId: userId,
        byUsername: receiverUsername,
        roomId: invite.match_room_id,
        opponentUsername: receiverUsername,
      });

      app.notifySocialUser(invite.receiver_id, "match_invite_accepted", {
        inviteId: invite.id,
        byUserId: userId,
        byUsername: receiverUsername,
        roomId: invite.match_room_id,
        opponentUsername: senderUsername,
      });

      return reply.send({
        message: "Invitacion aceptada",
        inviteId: invite.id,
        roomId: invite.match_room_id,
        opponentUsername: senderUsername,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: "ID de invitacion invalido" });
      }
      request.log.error(error, "Error aceptando invitacion");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post<{ Params: InviteParams }>("/api/match/invite/:inviteId/reject", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { inviteId } = InviteIdParamsSchema.parse(request.params);

      const [invite] = await query<{ id: string; sender_id: number }>(
        `UPDATE match_invites
         SET status = 'rejected', updated_at = NOW()
         WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
         RETURNING id, sender_id`,
        [inviteId, userId]
      );

      if (!invite) {
        return reply.code(404).send({ error: "Invitacion pendiente no encontrada" });
      }

      app.notifySocialUser(invite.sender_id, "match_invite_rejected", {
        inviteId: invite.id,
        byUserId: userId,
      });

      return reply.send({
        message: "Invitacion rechazada",
        inviteId: invite.id,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: "ID de invitacion invalido" });
      }
      request.log.error(error, "Error rechazando invitacion");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });
}
