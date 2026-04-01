import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db.js";

type UserRow = {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type ConversationParams = { username: string };

type MessageRow = {
  id: string;
  sender_id: number;
  receiver_id: number;
  content: string;
  created_at: Date;
};

const UsernameParamsSchema = z.object({
  username: z.string().trim().min(3).max(50),
});

const SendMessageSchema = z.object({
  content: z.string().trim().min(1, "El mensaje no puede estar vacio").max(1000),
});

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
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

export async function chatRoutes(app: FastifyInstance) {
  app.get("/api/chat/conversations", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;

      const conversations = await query<{
        id: number;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        last_content: string;
        last_created_at: Date;
      }>(
        `SELECT u.id,
                u.username,
                u.display_name,
                u.avatar_url,
                latest.content AS last_content,
                latest.created_at AS last_created_at
         FROM users u
         JOIN LATERAL (
           SELECT dm.content, dm.created_at
           FROM direct_messages dm
           WHERE (dm.sender_id = $1 AND dm.receiver_id = u.id)
              OR (dm.sender_id = u.id AND dm.receiver_id = $1)
           ORDER BY dm.created_at DESC
           LIMIT 1
         ) AS latest ON TRUE
         WHERE u.id <> $1
           AND EXISTS (
             SELECT 1 FROM friends f
             WHERE f.user_id = $1 AND f.friend_id = u.id
           )
         ORDER BY latest.created_at DESC`,
        [userId]
      );

      return reply.send({
        conversations: conversations.map((c) => ({
          user: {
            id: c.id,
            username: c.username,
            displayName: c.display_name,
            avatarUrl: c.avatar_url,
          },
          lastMessage: c.last_content,
          lastMessageAt: c.last_created_at,
        })),
      });
    } catch (error) {
      request.log.error(error, "Error cargando conversaciones");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.get<{ Params: ConversationParams }>("/api/chat/conversation/:username/messages", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { username } = UsernameParamsSchema.parse(request.params);
      const { limit } = QuerySchema.parse(request.query);
      const targetUser = await findUserByUsername(username);

      if (!targetUser) {
        return reply.code(404).send({ error: "Usuario no encontrado" });
      }
      if (targetUser.id === userId) {
        return reply.code(400).send({ error: "No puedes abrir chat contigo mismo" });
      }

      const friend = await areFriends(userId, targetUser.id);
      if (!friend) {
        return reply.code(403).send({ error: "Solo puedes chatear con usuarios agregados como amigos" });
      }

      const blocked = await hasBlockBetween(userId, targetUser.id);
      if (blocked) {
        return reply.code(403).send({ error: "No puedes chatear por bloqueo activo" });
      }

      const rows = await query<MessageRow>(
        `SELECT id, sender_id, receiver_id, content, created_at
         FROM direct_messages
         WHERE (sender_id = $1 AND receiver_id = $2)
            OR (sender_id = $2 AND receiver_id = $1)
         ORDER BY created_at DESC
         LIMIT $3`,
        [userId, targetUser.id, limit ?? 50]
      );

      rows.reverse();

      return reply.send({
        withUser: {
          id: targetUser.id,
          username: targetUser.username,
          displayName: targetUser.display_name,
          avatarUrl: targetUser.avatar_url,
        },
        messages: rows.map((m) => ({
          id: m.id,
          fromUserId: m.sender_id,
          toUserId: m.receiver_id,
          content: m.content,
          createdAt: m.created_at,
        })),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error cargando mensajes");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post<{ Params: ConversationParams }>("/api/chat/conversation/:username/messages", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId as number;
      const { username } = UsernameParamsSchema.parse(request.params);
      const body = SendMessageSchema.parse(request.body);
      const targetUser = await findUserByUsername(username);

      if (!targetUser) {
        return reply.code(404).send({ error: "Usuario no encontrado" });
      }
      if (targetUser.id === userId) {
        return reply.code(400).send({ error: "No puedes enviarte mensajes a ti mismo" });
      }

      const friend = await areFriends(userId, targetUser.id);
      if (!friend) {
        return reply.code(403).send({ error: "Solo puedes chatear con usuarios agregados como amigos" });
      }

      const blocked = await hasBlockBetween(userId, targetUser.id);
      if (blocked) {
        return reply.code(403).send({ error: "No puedes chatear por bloqueo activo" });
      }

      const [message] = await query<MessageRow>(
        `INSERT INTO direct_messages (sender_id, receiver_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, sender_id, receiver_id, content, created_at`,
        [userId, targetUser.id, body.content]
      );

      app.notifySocialUser(targetUser.id, "chat_message_received", {
        messageId: message.id,
        fromUserId: userId,
        contentPreview: body.content.slice(0, 80),
      });

      return reply.code(201).send({
        message: {
          id: message.id,
          fromUserId: message.sender_id,
          toUserId: message.receiver_id,
          content: message.content,
          createdAt: message.created_at,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error enviando mensaje");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });
}
