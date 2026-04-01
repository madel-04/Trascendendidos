import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool, query } from "../db.js";

type UserRow = {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type IdParams = { requestId: string };
type UsernameParams = { username: string };

const UsernameBodySchema = z.object({
  username: z.string().trim().min(3).max(50),
});

const RequestIdParamsSchema = z.object({
  requestId: z.coerce.number().int().positive(),
});

const UsernameParamsSchema = z.object({
  username: z.string().trim().min(3).max(50),
});

async function findUserByUsername(username: string): Promise<UserRow | undefined> {
  const [user] = await query<UserRow>(
    "SELECT id, username, display_name, avatar_url FROM users WHERE username = $1",
    [username]
  );
  return user;
}

function toPublicUser(user: UserRow) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
  };
}

export async function socialRoutes(app: FastifyInstance) {
  app.get("/api/social/overview", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;

      const friends = await query<{
        id: number;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        created_at: Date;
      }>(
        `SELECT u.id, u.username, u.display_name, u.avatar_url, f.created_at
         FROM friends f
         JOIN users u ON u.id = f.friend_id
         WHERE f.user_id = $1
         ORDER BY u.username ASC`,
        [userId]
      );

      const incomingRequests = await query<{
        request_id: number;
        id: number;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        created_at: Date;
      }>(
        `SELECT fr.id AS request_id, u.id, u.username, u.display_name, u.avatar_url, fr.created_at
         FROM friend_requests fr
         JOIN users u ON u.id = fr.sender_id
         WHERE fr.receiver_id = $1 AND fr.status = 'pending'
         ORDER BY fr.created_at DESC`,
        [userId]
      );

      const outgoingRequests = await query<{
        request_id: number;
        id: number;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        created_at: Date;
      }>(
        `SELECT fr.id AS request_id, u.id, u.username, u.display_name, u.avatar_url, fr.created_at
         FROM friend_requests fr
         JOIN users u ON u.id = fr.receiver_id
         WHERE fr.sender_id = $1 AND fr.status = 'pending'
         ORDER BY fr.created_at DESC`,
        [userId]
      );

      const blocks = await query<{
        id: number;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        created_at: Date;
      }>(
        `SELECT u.id, u.username, u.display_name, u.avatar_url, b.created_at
         FROM blocks b
         JOIN users u ON u.id = b.blocked_id
         WHERE b.blocker_id = $1
         ORDER BY b.created_at DESC`,
        [userId]
      );

      return reply.send({
        friends: friends.map((f) => ({
          user: toPublicUser(f),
          since: f.created_at,
        })),
        incomingRequests: incomingRequests.map((r) => ({
          requestId: r.request_id,
          user: toPublicUser(r),
          createdAt: r.created_at,
        })),
        outgoingRequests: outgoingRequests.map((r) => ({
          requestId: r.request_id,
          user: toPublicUser(r),
          createdAt: r.created_at,
        })),
        blocks: blocks.map((b) => ({
          user: toPublicUser(b),
          createdAt: b.created_at,
        })),
      });
    } catch (error) {
      request.log.error(error, "Error cargando overview social");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post("/api/social/friend-request", {
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
        return reply.code(400).send({ error: "No puedes enviarte una solicitud a ti mismo" });
      }

      const [blocked] = await query<{ exists: number }>(
        `SELECT 1 AS exists
         FROM blocks
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1`,
        [userId, targetUser.id]
      );
      if (blocked) {
        return reply.code(403).send({ error: "No puedes interactuar con este usuario por bloqueo activo" });
      }

      const [alreadyFriend] = await query<{ exists: number }>(
        `SELECT 1 AS exists
         FROM friends
         WHERE user_id = $1 AND friend_id = $2
         LIMIT 1`,
        [userId, targetUser.id]
      );
      if (alreadyFriend) {
        return reply.code(409).send({ error: "Ya sois amigos" });
      }

      const [incomingPending] = await query<{ id: number }>(
        `SELECT id
         FROM friend_requests
         WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'
         LIMIT 1`,
        [targetUser.id, userId]
      );
      if (incomingPending) {
        return reply.code(409).send({ error: "Ya tienes una solicitud pendiente de este usuario" });
      }

      const [existingOutgoingPending] = await query<{ id: number }>(
        `SELECT id
         FROM friend_requests
         WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'
         LIMIT 1`,
        [userId, targetUser.id]
      );
      if (existingOutgoingPending) {
        return reply.code(409).send({ error: "Ya enviaste una solicitud a este usuario" });
      }

      const [friendRequest] = await query<{ id: number }>(
        `INSERT INTO friend_requests (sender_id, receiver_id, status)
         VALUES ($1, $2, 'pending')
         ON CONFLICT (sender_id, receiver_id)
         DO UPDATE SET status = 'pending', updated_at = NOW()
         RETURNING id`,
        [userId, targetUser.id]
      );

      app.notifySocialUser(targetUser.id, "friend_request_received", {
        fromUserId: userId,
        requestId: friendRequest.id,
      });
      app.notifySocialUser(userId, "friend_request_sent", {
        toUserId: targetUser.id,
        toUsername: targetUser.username,
        requestId: friendRequest.id,
      });

      return reply.code(201).send({
        message: "Solicitud de amistad enviada",
        requestId: friendRequest.id,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error enviando solicitud de amistad");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post<{ Params: IdParams }>("/api/social/friend-request/:requestId/accept", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { requestId } = RequestIdParamsSchema.parse(request.params);

      const client = await pool.connect();
      let acceptedSenderId: number | null = null;
      let acceptedReceiverId: number | null = null;
      try {
        await client.query("BEGIN");

        const requestResult = await client.query<{
          id: number;
          sender_id: number;
          receiver_id: number;
        }>(
          `SELECT id, sender_id, receiver_id
           FROM friend_requests
           WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
           FOR UPDATE`,
          [requestId, userId]
        );

        if (requestResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ error: "Solicitud pendiente no encontrada" });
        }

        const friendRequest = requestResult.rows[0];
        acceptedSenderId = friendRequest.sender_id;
        acceptedReceiverId = friendRequest.receiver_id;

        const blockResult = await client.query(
          `SELECT 1
           FROM blocks
           WHERE (blocker_id = $1 AND blocked_id = $2)
              OR (blocker_id = $2 AND blocked_id = $1)
           LIMIT 1`,
          [friendRequest.sender_id, friendRequest.receiver_id]
        );

        if (blockResult.rows.length > 0) {
          await client.query("ROLLBACK");
          return reply.code(403).send({ error: "No se puede aceptar por bloqueo activo" });
        }

        await client.query(
          `UPDATE friend_requests
           SET status = 'accepted', updated_at = NOW()
           WHERE id = $1`,
          [friendRequest.id]
        );

        await client.query(
          `INSERT INTO friends (user_id, friend_id)
           VALUES ($1, $2), ($2, $1)
           ON CONFLICT DO NOTHING`,
          [friendRequest.sender_id, friendRequest.receiver_id]
        );

        await client.query(
          `UPDATE friend_requests
           SET status = 'cancelled', updated_at = NOW()
           WHERE status = 'pending'
             AND ((sender_id = $1 AND receiver_id = $2)
               OR  (sender_id = $2 AND receiver_id = $1))
             AND id <> $3`,
          [friendRequest.sender_id, friendRequest.receiver_id, friendRequest.id]
        );

        await client.query("COMMIT");
      } catch (transactionError) {
        await client.query("ROLLBACK");
        throw transactionError;
      } finally {
        client.release();
      }

      if (acceptedSenderId && acceptedReceiverId) {
        app.notifySocialUser(acceptedSenderId, "friend_request_accepted", {
          friendUserId: acceptedReceiverId,
        });
        app.notifySocialUser(acceptedReceiverId, "friend_request_accepted", {
          friendUserId: acceptedSenderId,
        });
      }

      return reply.send({ message: "Solicitud aceptada" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: "ID de solicitud invalido" });
      }
      request.log.error(error, "Error aceptando solicitud");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post<{ Params: IdParams }>("/api/social/friend-request/:requestId/reject", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { requestId } = RequestIdParamsSchema.parse(request.params);

      const result = await query<{ id: number; sender_id: number }>(
        `UPDATE friend_requests
         SET status = 'rejected', updated_at = NOW()
         WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
         RETURNING id, sender_id`,
        [requestId, userId]
      );

      if (result.length === 0) {
        return reply.code(404).send({ error: "Solicitud pendiente no encontrada" });
      }

      app.notifySocialUser(result[0].sender_id, "friend_request_rejected", {
        byUserId: userId,
        requestId,
      });

      return reply.send({ message: "Solicitud rechazada" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: "ID de solicitud invalido" });
      }
      request.log.error(error, "Error rechazando solicitud");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post("/api/social/block", {
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
        return reply.code(400).send({ error: "No puedes bloquearte a ti mismo" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const blockInsert = await client.query(
          `INSERT INTO blocks (blocker_id, blocked_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING
           RETURNING blocker_id`,
          [userId, targetUser.id]
        );

        if (blockInsert.rows.length === 0) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ error: "Este usuario ya estaba bloqueado" });
        }

        await client.query(
          `DELETE FROM friends
           WHERE (user_id = $1 AND friend_id = $2)
              OR (user_id = $2 AND friend_id = $1)`,
          [userId, targetUser.id]
        );

        await client.query(
          `UPDATE friend_requests
           SET status = 'cancelled', updated_at = NOW()
           WHERE status = 'pending'
             AND ((sender_id = $1 AND receiver_id = $2)
               OR  (sender_id = $2 AND receiver_id = $1))`,
          [userId, targetUser.id]
        );

        await client.query("COMMIT");
      } catch (transactionError) {
        await client.query("ROLLBACK");
        throw transactionError;
      } finally {
        client.release();
      }

      app.notifySocialUser(targetUser.id, "user_blocked_you", {
        byUserId: userId,
      });
      app.notifySocialUser(userId, "you_blocked_user", {
        targetUserId: targetUser.id,
      });

      return reply.send({ message: "Usuario bloqueado correctamente" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error bloqueando usuario");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.delete<{ Params: UsernameParams }>("/api/social/block/:username", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { username } = UsernameParamsSchema.parse(request.params);
      const targetUser = await findUserByUsername(username);

      if (!targetUser) {
        return reply.code(404).send({ error: "Usuario no encontrado" });
      }

      const result = await query(
        `DELETE FROM blocks
         WHERE blocker_id = $1 AND blocked_id = $2
         RETURNING blocker_id`,
        [userId, targetUser.id]
      );

      if (result.length === 0) {
        return reply.code(404).send({ error: "No existe bloqueo activo para este usuario" });
      }

      app.notifySocialUser(targetUser.id, "user_unblocked_you", {
        byUserId: userId,
      });
      app.notifySocialUser(userId, "you_unblocked_user", {
        targetUserId: targetUser.id,
      });

      return reply.send({ message: "Usuario desbloqueado correctamente" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error desbloqueando usuario");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });
}
