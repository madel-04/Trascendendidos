import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { pool, query } from "../db.js";

const OrganizationBodySchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(400).optional(),
});

const OrganizationQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  ownerUsername: z.string().trim().max(50).optional(),
  requestStatus: z.enum(["none", "pending", "rejected", "cancelled"]).optional(),
  ownerId: z.coerce.number().int().positive().optional(),
  memberId: z.coerce.number().int().positive().optional(),
  excludeMemberId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(["created_at", "name"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

const OrganizationParamsSchema = z.object({
  organizationId: z.coerce.number().int().positive(),
});

const MemberParamsSchema = OrganizationParamsSchema.extend({
  userId: z.coerce.number().int().positive(),
});

const AddMemberSchema = z.object({
  userId: z.coerce.number().int().positive(),
  role: z.enum(["admin", "member"]).default("member"),
});

const UpdateMemberSchema = z.object({
  role: z.enum(["admin", "member"]),
});

const OrganizationMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const OrganizationMessageBodySchema = z.object({
  content: z.string().trim().min(1, "El mensaje no puede estar vacio").max(1000),
});

type OrganizationRole = "owner" | "admin" | "member";
type JoinRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

type OrganizationRow = {
  id: string;
  name: string;
  description: string | null;
  owner_id: number;
  owner_username: string;
  created_at: Date;
  updated_at: Date;
  total_members: number;
  viewer_role: OrganizationRole | null;
  viewer_request_status: JoinRequestStatus | null;
};

type JoinRequestRow = {
  user_id: number;
  username: string;
  status: JoinRequestStatus;
  created_at: Date;
  updated_at: Date;
};

type OrganizationMessageRow = {
  id: string;
  author_id: number;
  author_username: string;
  author_display_name: string | null;
  author_avatar_url: string | null;
  content: string;
  created_at: Date;
};

function getAuthUserId(request: FastifyRequest): number {
  return Number((request.user as any).userId);
}

async function getMembership(orgId: number, userId: number) {
  const [membership] = await query<{ role: OrganizationRole }>(
    `SELECT role
     FROM organization_members
     WHERE org_id = $1 AND user_id = $2
     LIMIT 1`,
    [orgId, userId]
  );

  return membership ?? null;
}

async function getJoinRequest(orgId: number, userId: number) {
  const [requestRow] = await query<{ status: JoinRequestStatus }>(
    `SELECT status
     FROM organization_join_requests
     WHERE org_id = $1 AND user_id = $2
     LIMIT 1`,
    [orgId, userId]
  );

  return requestRow ?? null;
}

function buildViewerContext(role: OrganizationRole | null, requestStatus: JoinRequestStatus | null) {
  return {
    isMember: !!role,
    role,
    requestStatus,
    canApply: !role && requestStatus !== "pending",
    canManage: role === "owner" || role === "admin",
    canReviewRequests: role === "owner" || role === "admin",
  };
}

async function requireOrganizationRole(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: number,
  allowedRoles: OrganizationRole[]
) {
  const userId = getAuthUserId(request);
  const membership = await getMembership(orgId, userId);

  if (!membership || !allowedRoles.includes(membership.role)) {
    reply.code(403).send({ error: "No tienes permisos sobre esta organizacion" });
    return null;
  }

  return { userId, role: membership.role };
}

async function ensureOrganizationExists(orgId: number) {
  const [organization] = await query<{ id: string }>(
    `SELECT id
     FROM organizations
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [orgId]
  );

  return organization ?? null;
}

export async function organizationRoutes(app: FastifyInstance) {
  app.get("/api/organizations", { onRequest: [app.authenticate] }, async (request, reply) => {
    try {
      const parsed = OrganizationQuerySchema.parse(request.query);
      const userId = getAuthUserId(request);
      const params: unknown[] = [userId];
      const where: string[] = ["o.deleted_at IS NULL"];
      const sortByColumn = parsed.sortBy === "name" ? "o.name" : "o.created_at";

      if (parsed.q) {
        params.push(`%${parsed.q}%`);
        where.push(`(o.name ILIKE $${params.length} OR COALESCE(o.description, '') ILIKE $${params.length} OR owner.username ILIKE $${params.length})`);
      }
      if (parsed.ownerUsername) {
        params.push(`%${parsed.ownerUsername}%`);
        where.push(`owner.username ILIKE $${params.length}`);
      }
      if (parsed.ownerId) {
        params.push(parsed.ownerId);
        where.push(`o.owner_id = $${params.length}`);
      }
      if (parsed.requestStatus === "none") {
        where.push(`viewer_request.status IS NULL`);
      }
      if (parsed.requestStatus && parsed.requestStatus !== "none") {
        params.push(parsed.requestStatus);
        where.push(`viewer_request.status = $${params.length}`);
      }
      if (parsed.memberId) {
        params.push(parsed.memberId);
        where.push(`EXISTS (
          SELECT 1 FROM organization_members om_filter
          WHERE om_filter.org_id = o.id AND om_filter.user_id = $${params.length}
        )`);
      }
      if (parsed.excludeMemberId) {
        params.push(parsed.excludeMemberId);
        where.push(`NOT EXISTS (
          SELECT 1 FROM organization_members om_excluded
          WHERE om_excluded.org_id = o.id AND om_excluded.user_id = $${params.length}
        )`);
      }

      params.push(parsed.limit, parsed.offset);

      const rows = await query<OrganizationRow & { total_count: number }>(
        `SELECT o.id, o.name, o.description, o.owner_id, owner.username AS owner_username, o.created_at, o.updated_at,
                COUNT(om.id)::int AS total_members,
                viewer_member.role AS viewer_role,
                viewer_request.status AS viewer_request_status,
                COUNT(*) OVER()::int AS total_count
         FROM organizations o
         JOIN users owner ON owner.id = o.owner_id
         LEFT JOIN organization_members om ON om.org_id = o.id
         LEFT JOIN organization_members viewer_member
           ON viewer_member.org_id = o.id AND viewer_member.user_id = $1
         LEFT JOIN organization_join_requests viewer_request
           ON viewer_request.org_id = o.id AND viewer_request.user_id = $1
         WHERE ${where.join(" AND ")}
         GROUP BY o.id, owner.username, viewer_member.role, viewer_request.status
         ORDER BY ${sortByColumn} ${parsed.order}, o.id DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return reply.send({
        items: rows.map((row) => ({
          id: Number(row.id),
          name: row.name,
          description: row.description,
          owner: { id: row.owner_id, username: row.owner_username },
          totalMembers: row.total_members,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          viewer: buildViewerContext(row.viewer_role, row.viewer_request_status),
        })),
        total: rows[0]?.total_count ?? 0,
        limit: parsed.limit,
        offset: parsed.offset,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error listando organizaciones");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post("/api/organizations", { onRequest: [app.authenticate] }, async (request, reply) => {
    try {
      const body = OrganizationBodySchema.parse(request.body);
      const userId = getAuthUserId(request);

      const [organization] = await query<{
        id: string;
        name: string;
        description: string | null;
        owner_id: number;
        created_at: Date;
      }>(
        `INSERT INTO organizations (name, description, owner_id)
         VALUES ($1, $2, $3)
         RETURNING id, name, description, owner_id, created_at`,
        [body.name, body.description ?? null, userId]
      );

      await query(
        `INSERT INTO organization_members (org_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [organization.id, userId]
      );

      return reply.code(201).send({
        organization: {
          id: Number(organization.id),
          name: organization.name,
          description: organization.description,
          ownerId: organization.owner_id,
          createdAt: organization.created_at,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      if (error?.code === "23505") {
        return reply.code(409).send({ error: "Ya existe una organizacion con ese nombre" });
      }
      request.log.error(error, "Error creando organizacion");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.get<{ Params: { organizationId: string } }>("/api/organizations/:organizationId", { onRequest: [app.authenticate] }, async (request, reply) => {
    try {
      const { organizationId } = OrganizationParamsSchema.parse(request.params);
      const userId = getAuthUserId(request);

      const [organization] = await query<OrganizationRow>(
        `SELECT o.id, o.name, o.description, o.owner_id, owner.username AS owner_username, o.created_at, o.updated_at,
                COUNT(om.id)::int AS total_members,
                viewer_member.role AS viewer_role,
                viewer_request.status AS viewer_request_status
         FROM organizations o
         JOIN users owner ON owner.id = o.owner_id
         LEFT JOIN organization_members om ON om.org_id = o.id
         LEFT JOIN organization_members viewer_member
           ON viewer_member.org_id = o.id AND viewer_member.user_id = $2
         LEFT JOIN organization_join_requests viewer_request
           ON viewer_request.org_id = o.id AND viewer_request.user_id = $2
         WHERE o.id = $1 AND o.deleted_at IS NULL
         GROUP BY o.id, owner.username, viewer_member.role, viewer_request.status
         LIMIT 1`,
        [organizationId, userId]
      );

      if (!organization) {
        return reply.code(404).send({ error: "Organizacion no encontrada" });
      }

      const viewer = buildViewerContext(organization.viewer_role, organization.viewer_request_status);

      const members = viewer.isMember
        ? await query<{
            user_id: number;
            username: string;
            role: OrganizationRole;
            created_at: Date;
          }>(
            `SELECT om.user_id, u.username, om.role, om.created_at
             FROM organization_members om
             JOIN users u ON u.id = om.user_id
             WHERE om.org_id = $1
             ORDER BY CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.username ASC`,
            [organizationId]
          )
        : [];

      const pendingRequests = viewer.canReviewRequests
        ? await query<JoinRequestRow>(
            `SELECT r.user_id, u.username, r.status, r.created_at, r.updated_at
             FROM organization_join_requests r
             JOIN users u ON u.id = r.user_id
             WHERE r.org_id = $1 AND r.status = 'pending'
             ORDER BY r.created_at ASC`,
            [organizationId]
          )
        : [];

      return reply.send({
        organization: {
          id: Number(organization.id),
          name: organization.name,
          description: organization.description,
          owner: { id: organization.owner_id, username: organization.owner_username },
          totalMembers: organization.total_members,
          createdAt: organization.created_at,
          updatedAt: organization.updated_at,
          viewer,
        },
        members: members.map((member) => ({
          userId: member.user_id,
          username: member.username,
          role: member.role,
          joinedAt: member.created_at,
        })),
        requests: pendingRequests.map((item) => ({
          userId: item.user_id,
          username: item.username,
          status: item.status,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error obteniendo organizacion");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.get<{ Params: { organizationId: string } }>("/api/organizations/:organizationId/messages", { onRequest: [app.authenticate] }, async (request, reply) => {
    try {
      const { organizationId } = OrganizationParamsSchema.parse(request.params);
      const { limit } = OrganizationMessagesQuerySchema.parse(request.query);
      const userId = getAuthUserId(request);

      const organization = await ensureOrganizationExists(organizationId);
      if (!organization) {
        return reply.code(404).send({ error: "Organizacion no encontrada" });
      }

      const membership = await getMembership(organizationId, userId);
      if (!membership) {
        return reply.code(403).send({ error: "Debes formar parte de la organizacion para ver el chat" });
      }

      const rows = await query<OrganizationMessageRow>(
        `SELECT om.id,
                om.author_id,
                u.username AS author_username,
                u.display_name AS author_display_name,
                u.avatar_url AS author_avatar_url,
                om.content,
                om.created_at
         FROM organization_messages om
         JOIN users u ON u.id = om.author_id
         WHERE om.org_id = $1
         ORDER BY om.created_at DESC, om.id DESC
         LIMIT $2`,
        [organizationId, limit]
      );

      rows.reverse();

      return reply.send({
        messages: rows.map((row) => ({
          id: Number(row.id),
          author: {
            id: row.author_id,
            username: row.author_username,
            displayName: row.author_display_name,
            avatarUrl: row.author_avatar_url,
          },
          content: row.content,
          createdAt: row.created_at,
        })),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error obteniendo mensajes de organizacion");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post<{ Params: { organizationId: string } }>("/api/organizations/:organizationId/messages", { onRequest: [app.authenticate] }, async (request, reply) => {
    try {
      const { organizationId } = OrganizationParamsSchema.parse(request.params);
      const body = OrganizationMessageBodySchema.parse(request.body);
      const userId = getAuthUserId(request);

      const organization = await ensureOrganizationExists(organizationId);
      if (!organization) {
        return reply.code(404).send({ error: "Organizacion no encontrada" });
      }

      const membership = await getMembership(organizationId, userId);
      if (!membership) {
        return reply.code(403).send({ error: "Debes formar parte de la organizacion para escribir en el chat" });
      }

      const [author] = await query<{
        username: string;
        display_name: string | null;
        avatar_url: string | null;
      }>(
        `SELECT username, display_name, avatar_url
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [userId]
      );

      if (!author) {
        return reply.code(404).send({ error: "Usuario no encontrado" });
      }

      const [created] = await query<OrganizationMessageRow>(
        `INSERT INTO organization_messages (org_id, author_id, content)
         VALUES ($1, $2, $3)
         RETURNING id,
                   author_id,
                   $4::varchar AS author_username,
                   $5::varchar AS author_display_name,
                   $6::varchar AS author_avatar_url,
                   content,
                   created_at`,
        [
          organizationId,
          userId,
          body.content,
          author.username,
          author.display_name,
          author.avatar_url,
        ]
      );

      return reply.code(201).send({
        message: {
          id: Number(created.id),
          author: {
            id: created.author_id,
            username: created.author_username,
            displayName: created.author_display_name,
            avatarUrl: created.author_avatar_url,
          },
          content: created.content,
          createdAt: created.created_at,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error creando mensaje de organizacion");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post<{ Params: { organizationId: string } }>("/api/organizations/:organizationId/apply", { onRequest: [app.authenticate] }, async (request, reply) => {
    try {
      const { organizationId } = OrganizationParamsSchema.parse(request.params);
      const userId = getAuthUserId(request);

      const organization = await ensureOrganizationExists(organizationId);
      if (!organization) {
        return reply.code(404).send({ error: "Organizacion no encontrada" });
      }

      const membership = await getMembership(organizationId, userId);
      if (membership) {
        return reply.code(409).send({ error: "Ya formas parte de esta organizacion" });
      }

      const joinRequest = await getJoinRequest(organizationId, userId);
      if (joinRequest?.status === "pending") {
        return reply.code(409).send({ error: "Ya tienes una solicitud pendiente" });
      }

      const [requestRow] = await query<{ status: JoinRequestStatus }>(
        `INSERT INTO organization_join_requests (org_id, user_id, status)
         VALUES ($1, $2, 'pending')
         ON CONFLICT (org_id, user_id)
         DO UPDATE SET status = 'pending', updated_at = NOW()
         RETURNING status`,
        [organizationId, userId]
      );

      return reply.code(201).send({
        request: {
          status: requestRow.status,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error solicitando acceso a organizacion");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.delete<{ Params: { organizationId: string } }>("/api/organizations/:organizationId/leave", { onRequest: [app.authenticate] }, async (request, reply) => {
    try {
      const { organizationId } = OrganizationParamsSchema.parse(request.params);
      const userId = getAuthUserId(request);
      const membership = await getMembership(organizationId, userId);

      if (!membership) {
        return reply.code(404).send({ error: "No formas parte de esta organizacion" });
      }

      if (membership.role === "owner") {
        const client = await pool.connect();

        try {
          await client.query("BEGIN");

          const memberCountResult = await client.query<{ total_members: string }>(
            `SELECT COUNT(*)::int AS total_members
             FROM organization_members
             WHERE org_id = $1`,
            [organizationId]
          );

          const totalMembers = Number(memberCountResult.rows[0]?.total_members ?? 0);
          if (totalMembers <= 1) {
            await client.query(
              `UPDATE organizations
               SET deleted_at = NOW(),
                   updated_at = NOW()
               WHERE id = $1 AND deleted_at IS NULL`,
              [organizationId]
            );

            await client.query(
              `DELETE FROM organization_members
               WHERE org_id = $1 AND user_id = $2`,
              [organizationId, userId]
            );

            await client.query(
              `UPDATE organization_join_requests
               SET status = 'cancelled',
                   updated_at = NOW()
               WHERE org_id = $1`,
              [organizationId]
            );

            await client.query("COMMIT");
            return reply.send({
              message: "Has salido de la organizacion y, al no quedar nadie dentro, la organizacion se ha eliminado",
            });
          }

          const adminResult = await client.query<{
            user_id: number;
            role: OrganizationRole;
          }>(
            `SELECT user_id, role
             FROM organization_members
             WHERE org_id = $1 AND user_id <> $2 AND role IN ('admin', 'member')
             ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, created_at ASC, id ASC
             LIMIT 1`,
            [organizationId, userId]
          );

          const nextOwner = adminResult.rows[0];
          if (!nextOwner) {
            await client.query("ROLLBACK");
            return reply.code(400).send({ error: "No se ha encontrado un relevo para transferir la organizacion" });
          }

          await client.query(
            `UPDATE organizations
             SET owner_id = $1,
                 updated_at = NOW()
             WHERE id = $2 AND deleted_at IS NULL`,
            [nextOwner.user_id, organizationId]
          );

          await client.query(
            `UPDATE organization_members
             SET role = 'owner',
                 updated_at = NOW()
             WHERE org_id = $1 AND user_id = $2`,
            [organizationId, nextOwner.user_id]
          );

          await client.query(
            `DELETE FROM organization_members
             WHERE org_id = $1 AND user_id = $2`,
            [organizationId, userId]
          );

          await client.query(
            `UPDATE organization_join_requests
             SET status = 'cancelled',
                 updated_at = NOW()
             WHERE org_id = $1 AND user_id = $2 AND status = 'approved'`,
            [organizationId, userId]
          );

          await client.query("COMMIT");
          return reply.send({
            message: "Has salido de la organizacion y el admin mas antiguo es ahora el nuevo owner",
          });
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      }

      await query(
        `DELETE FROM organization_members
         WHERE org_id = $1 AND user_id = $2`,
        [organizationId, userId]
      );

      await query(
        `UPDATE organization_join_requests
         SET status = 'cancelled',
             updated_at = NOW()
         WHERE org_id = $1 AND user_id = $2 AND status = 'approved'`,
        [organizationId, userId]
      );

      return reply.send({ message: "Has salido de la organizacion" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error saliendo de la organizacion");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.post<{ Params: { organizationId: string; userId: string } }>("/api/organizations/:organizationId/requests/:userId/approve", { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsedParams = MemberParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: parsedParams.error.errors[0].message });
    }

    const permission = await requireOrganizationRole(request, reply, parsedParams.data.organizationId, ["owner", "admin"]);
    if (!permission) return;

    const [requestRow] = await query<{ user_id: number }>(
      `UPDATE organization_join_requests
       SET status = 'approved',
           updated_at = NOW()
       WHERE org_id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING user_id`,
      [parsedParams.data.organizationId, parsedParams.data.userId]
    );

    if (!requestRow) {
      return reply.code(404).send({ error: "Solicitud no encontrada" });
    }

    await query(
      `INSERT INTO organization_members (org_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (org_id, user_id)
       DO NOTHING`,
      [parsedParams.data.organizationId, parsedParams.data.userId]
    );

    return reply.send({ message: "Solicitud aprobada correctamente" });
  });

  app.post<{ Params: { organizationId: string; userId: string } }>("/api/organizations/:organizationId/requests/:userId/reject", { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsedParams = MemberParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: parsedParams.error.errors[0].message });
    }

    const permission = await requireOrganizationRole(request, reply, parsedParams.data.organizationId, ["owner", "admin"]);
    if (!permission) return;

    const [requestRow] = await query<{ user_id: number }>(
      `UPDATE organization_join_requests
       SET status = 'rejected',
           updated_at = NOW()
       WHERE org_id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING user_id`,
      [parsedParams.data.organizationId, parsedParams.data.userId]
    );

    if (!requestRow) {
      return reply.code(404).send({ error: "Solicitud no encontrada" });
    }

    return reply.send({ message: "Solicitud rechazada correctamente" });
  });

  app.put<{ Params: { organizationId: string } }>("/api/organizations/:organizationId", { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsedParams = OrganizationParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: parsedParams.error.errors[0].message });
    }

    const permission = await requireOrganizationRole(request, reply, parsedParams.data.organizationId, ["owner", "admin"]);
    if (!permission) return;

    try {
      const body = OrganizationBodySchema.parse(request.body);
      const [updated] = await query<{
        id: string;
        name: string;
        description: string | null;
        updated_at: Date;
      }>(
        `UPDATE organizations
         SET name = $1,
             description = $2,
             updated_at = NOW()
         WHERE id = $3 AND deleted_at IS NULL
         RETURNING id, name, description, updated_at`,
        [body.name, body.description ?? null, parsedParams.data.organizationId]
      );

      if (!updated) {
        return reply.code(404).send({ error: "Organizacion no encontrada" });
      }

      return reply.send({
        organization: {
          id: Number(updated.id),
          name: updated.name,
          description: updated.description,
          updatedAt: updated.updated_at,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      if (error?.code === "23505") {
        return reply.code(409).send({ error: "Ya existe una organizacion con ese nombre" });
      }
      request.log.error(error, "Error actualizando organizacion");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.delete<{ Params: { organizationId: string } }>("/api/organizations/:organizationId", { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsedParams = OrganizationParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: parsedParams.error.errors[0].message });
    }

    const permission = await requireOrganizationRole(request, reply, parsedParams.data.organizationId, ["owner"]);
    if (!permission) return;

    const [deleted] = await query<{ id: string }>(
      `UPDATE organizations
       SET deleted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [parsedParams.data.organizationId]
    );

    if (!deleted) {
      return reply.code(404).send({ error: "Organizacion no encontrada" });
    }

    return reply.send({ message: "Organizacion archivada correctamente" });
  });

  app.post<{ Params: { organizationId: string } }>("/api/organizations/:organizationId/members", { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsedParams = OrganizationParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: parsedParams.error.errors[0].message });
    }

    const permission = await requireOrganizationRole(request, reply, parsedParams.data.organizationId, ["owner", "admin"]);
    if (!permission) return;

    try {
      const body = AddMemberSchema.parse(request.body);
      const [targetUser] = await query<{ id: number }>(
        `SELECT id
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [body.userId]
      );

      if (!targetUser) {
        return reply.code(404).send({ error: "Usuario no encontrado" });
      }

      const [member] = await query<{
        user_id: number;
        role: OrganizationRole;
      }>(
        `INSERT INTO organization_members (org_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (org_id, user_id)
         DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()
         RETURNING user_id, role`,
        [parsedParams.data.organizationId, body.userId, body.role]
      );

      await query(
        `INSERT INTO organization_join_requests (org_id, user_id, status)
         VALUES ($1, $2, 'approved')
         ON CONFLICT (org_id, user_id)
         DO UPDATE SET status = 'approved', updated_at = NOW()`,
        [parsedParams.data.organizationId, body.userId]
      );

      return reply.code(201).send({
        member: {
          userId: member.user_id,
          role: member.role,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error añadiendo miembro");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.patch<{ Params: { organizationId: string; userId: string } }>("/api/organizations/:organizationId/members/:userId", { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsedParams = MemberParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: parsedParams.error.errors[0].message });
    }

    const permission = await requireOrganizationRole(request, reply, parsedParams.data.organizationId, ["owner"]);
    if (!permission) return;

    try {
      const body = UpdateMemberSchema.parse(request.body);
      const [updated] = await query<{ user_id: number; role: OrganizationRole }>(
        `UPDATE organization_members
         SET role = $1, updated_at = NOW()
         WHERE org_id = $2 AND user_id = $3 AND role <> 'owner'
         RETURNING user_id, role`,
        [body.role, parsedParams.data.organizationId, parsedParams.data.userId]
      );

      if (!updated) {
        return reply.code(404).send({ error: "Miembro no encontrado o no editable" });
      }

      return reply.send({
        member: {
          userId: updated.user_id,
          role: updated.role,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      request.log.error(error, "Error actualizando rol de miembro");
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  app.delete<{ Params: { organizationId: string; userId: string } }>("/api/organizations/:organizationId/members/:userId", { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsedParams = MemberParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: parsedParams.error.errors[0].message });
    }

    const permission = await requireOrganizationRole(request, reply, parsedParams.data.organizationId, ["owner", "admin"]);
    if (!permission) return;

    const [targetMembership] = await query<{ role: OrganizationRole }>(
      `SELECT role
       FROM organization_members
       WHERE org_id = $1 AND user_id = $2
       LIMIT 1`,
      [parsedParams.data.organizationId, parsedParams.data.userId]
    );

    if (!targetMembership) {
      return reply.code(404).send({ error: "Miembro no encontrado" });
    }

    if (targetMembership.role === "owner") {
      return reply.code(400).send({ error: "No puedes eliminar al owner" });
    }

    if (permission.role === "admin" && targetMembership.role === "admin") {
      return reply.code(403).send({ error: "Solo el owner puede eliminar otros admins" });
    }

    await query(
      `DELETE FROM organization_members
       WHERE org_id = $1 AND user_id = $2`,
      [parsedParams.data.organizationId, parsedParams.data.userId]
    );

    return reply.send({ message: "Miembro eliminado de la organizacion" });
  });
}
