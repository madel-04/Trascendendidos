// ===== IMPORTS =====
// Importamos Fastify: framework web rápido y moderno para Node.js
import Fastify, { FastifyReply, FastifyRequest } from "fastify";
// Plugin para manejar CORS (Cross-Origin Resource Sharing)
// Permite que el frontend (puerto 5173) haga peticiones al backend (puerto 3000)
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
// Plugin para añadir soporte de WebSockets al servidor
import websocket from "@fastify/websocket";
// Plugin para JWT (JSON Web Tokens) - autenticación sin sesiones
import jwt from "@fastify/jwt";
import { Server as SocketIOServer } from "socket.io";
import path from "path";
import { mkdir } from "fs/promises";
// Variables de entorno validadas con Zod (puerto, CORS origin, etc.)
import { env } from "./env.js";
// Inicialización de la base de datos
import { initDatabase } from "./db.js";
// Rutas de health check para verificar el estado del servidor
import { healthRoutes } from "./routes/health.js";
// Rutas de autenticación (login, register, 2FA)
import { authRoutes } from "./routes/auth.js";
import { socialRoutes } from "./routes/social.js";
import { chatRoutes } from "./routes/chat.js";
import { matchRoutes } from "./routes/match.js";
import { gameRoutes } from "./routes/game.js";
import { tournamentRoutes } from "./routes/tournament.js";
import { registerSocketHandlers } from "./sockets/handlers.js";

import type { SocialRealtimeEvent, SocialRealtimePayload, WsConnection } from "./types.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./sockets/types.js";

// ===== CONFIGURACIÓN DEL SERVIDOR =====
// Creamos la instancia principal de Fastify
// logger: true → Activa logs automáticos de todas las peticiones HTTP
const app = Fastify({ logger: true });
const AVATAR_UPLOADS_ROOT = path.join(process.cwd(), "uploads");


const socialSocketsByUser = new Map<number, Set<WsConnection>>();

// ===== PLUGINS =====
// Registramos el plugin de CORS para permitir peticiones desde el frontend
// origin: Define qué dominios pueden hacer peticiones (por defecto http://localhost:5173)
// credentials: Permite enviar cookies y headers de autenticación
await app.register(cors, { 
  origin: env.CORS_ORIGIN,
  credentials: true 
});

// Registramos el plugin de JWT para autenticación
await app.register(jwt, {
  secret: env.JWT_SECRET,
});

// Soporte para upload de archivos con limites estrictos.
await app.register(multipart, {
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },
  throwFileSizeLimit: true,
});

await mkdir(path.join(AVATAR_UPLOADS_ROOT, "avatars"), { recursive: true });

// Publica avatars guardados localmente bajo /uploads.
await app.register(staticPlugin, {
  root: AVATAR_UPLOADS_ROOT,
  prefix: "/uploads/",
});

// Middleware de autenticación JWT
// Lo usamos en rutas protegidas con: { onRequest: [app.authenticate] }
app.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: "No autenticado" });
  }
});

// Registramos el plugin de WebSocket para comunicación bidireccional en tiempo real
await app.register(websocket);

app.decorate("notifySocialUser", (userId, event, data) => {
  const sockets = socialSocketsByUser.get(userId);
  if (!sockets || sockets.size === 0) return;

  const payload: SocialRealtimePayload = {
    channel: "social",
    event,
    ts: Date.now(),
    data,
  };

  const raw = JSON.stringify(payload);
  for (const socket of sockets) {
    try {
      if (socket.readyState === undefined || socket.readyState === 1) {
        socket.send(raw);
      }
    } catch (_error) {
      // Ignore send failures; dead sockets are cleaned on close.
    }
  }
});

// ===== INICIALIZAR BASE DE DATOS =====
await initDatabase();

// ===== RUTAS REST =====
// Registramos las rutas de health check (GET /api/health)
await app.register(healthRoutes);
// Registramos las rutas de autenticación (POST /api/auth/*)
await app.register(authRoutes);
await app.register(socialRoutes);
await app.register(chatRoutes);
await app.register(matchRoutes);
await app.register(gameRoutes);
await app.register(tournamentRoutes);

// ===== ENDPOINT WEBSOCKET =====
// Configuramos un endpoint WebSocket en /ws para comunicación en tiempo real
// Este es un ejemplo básico que hace eco de los mensajes recibidos
app.get("/ws", { websocket: true }, async (socket, request) => {
  const token = String((request.query as { token?: string } | undefined)?.token ?? "").trim();

  if (!token) {
    socket.send(JSON.stringify({ type: "auth_required", ts: Date.now() }));
    socket.close();
    return;
  }

  let userId: number;
  try {
    const decoded = await app.jwt.verify<{ userId?: number }>(token);
    if (!decoded?.userId || typeof decoded.userId !== "number") {
      socket.send(JSON.stringify({ type: "auth_invalid", ts: Date.now() }));
      socket.close();
      return;
    }
    userId = decoded.userId;
  } catch (_error) {
    socket.send(JSON.stringify({ type: "auth_invalid", ts: Date.now() }));
    socket.close();
    return;
  }

  const ws = socket as unknown as WsConnection;
  const userSockets = socialSocketsByUser.get(userId) ?? new Set<WsConnection>();
  userSockets.add(ws);
  socialSocketsByUser.set(userId, userSockets);

  ws.send(JSON.stringify({ type: "connected", channel: "social", ts: Date.now() }));

  ws.on("message", (raw: unknown) => {
    try {
      const parsed = JSON.parse(typeof raw === "string" ? raw : String(raw));
      if (parsed?.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
      }
    } catch (_error) {
      // Ignore malformed messages from clients.
    }
  });

  ws.on("close", () => {
    const sockets = socialSocketsByUser.get(userId);
    if (!sockets) return;
    sockets.delete(ws);
    if (sockets.size === 0) {
      socialSocketsByUser.delete(userId);
    }
  });
});

await app.ready();

const io = new SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(app.server, {
  cors: {
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

io.use(async (socket, next) => {
  try {
    const token = String(socket.handshake.auth?.token ?? socket.handshake.query?.token ?? "").trim();
    if (!token) {
      return next(new Error("auth_required"));
    }

    const decoded = await app.jwt.verify<{ userId?: number; email?: string }>(token);
    if (!decoded?.userId || typeof decoded.userId !== "number") {
      return next(new Error("auth_invalid"));
    }

    socket.data.userId = decoded.userId;
    socket.data.username = typeof decoded.email === "string" ? decoded.email : undefined;
    return next();
  } catch (_error) {
    return next(new Error("auth_invalid"));
  }
});

registerSocketHandlers(io);
app.log.info("Socket.io attached and ready");

// ===== INICIAR SERVIDOR =====
// Ponemos el servidor a escuchar peticiones
// host: "0.0.0.0" → Acepta conexiones desde cualquier IP (necesario en Docker)
// port: Lee el puerto desde las variables de entorno (por defecto 3000)
await app.listen({ host: "0.0.0.0", port: env.BACKEND_PORT });

// Punto de entrada del servidor backend
// Configuración:
//Crea instancia de Fastify con logger
//Registra plugin CORS (permite frontend)
//Registra plugin WebSocket
//Registra rutas REST (/api/health)
//Configura endpoint WebSocket (/ws) autenticado con JWT para notificaciones sociales
//Escucha en 0.0.0.0:3000
//Por qué usar 0.0.0.0: Permite conexiones desde fuera del contenedor Docker.
