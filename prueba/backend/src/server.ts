// ===== IMPORTS =====
// Importamos Fastify: framework web rápido y moderno para Node.js
import Fastify from "fastify";
// Plugin para manejar CORS (Cross-Origin Resource Sharing)
// Permite que el frontend (puerto 5173) haga peticiones al backend (puerto 3000)
import cors from "@fastify/cors";
// Plugin para añadir soporte de WebSockets al servidor
import websocket from "@fastify/websocket";
// Plugin para JWT (JSON Web Tokens) - autenticación sin sesiones
import jwt from "@fastify/jwt";
// Variables de entorno validadas con Zod (puerto, CORS origin, etc.)
import { env } from "./env.js";
// Inicialización de la base de datos
import { initDatabase } from "./db.js";
// Rutas de health check para verificar el estado del servidor
import { healthRoutes } from "./routes/health.js";
// Rutas de autenticación (login, register, 2FA)
import { authRoutes } from "./routes/auth.js";

// ===== CONFIGURACIÓN DEL SERVIDOR =====
// Creamos la instancia principal de Fastify
// logger: true → Activa logs automáticos de todas las peticiones HTTP
const app = Fastify({ logger: true });

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

// Middleware de autenticación JWT
// Lo usamos en rutas protegidas con: { onRequest: [app.authenticate] }
app.decorate("authenticate", async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: "No autenticado" });
  }
});

// Registramos el plugin de WebSocket para comunicación bidireccional en tiempo real
await app.register(websocket);

// ===== INICIALIZAR BASE DE DATOS =====
await initDatabase();

// ===== RUTAS REST =====
// Registramos las rutas de health check (GET /api/health)
await app.register(healthRoutes);
// Registramos las rutas de autenticación (POST /api/auth/*)
await app.register(authRoutes);

// ===== ENDPOINT WEBSOCKET =====
// Configuramos un endpoint WebSocket en /ws para comunicación en tiempo real
// Este es un ejemplo básico que hace eco de los mensajes recibidos
app.get("/ws", { websocket: true }, (connection) => {
  // Cuando un cliente se conecta, le enviamos un mensaje de bienvenida
  // JSON.stringify convierte el objeto a string para enviarlo por WebSocket
  connection.socket.send(JSON.stringify({ type: "hello", ts: Date.now() }));

  // Escuchamos mensajes entrantes del cliente
  connection.socket.on("message", (raw) => {
    // Echo simple: devolvemos el mismo mensaje que recibimos
    // Útil para probar que la conexión WebSocket funciona
    connection.socket.send(raw.toString());
  });
});

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
//Configura endpoint WebSocket (/ws) con echo simple
//Escucha en 0.0.0.0:3000
//Por qué usar 0.0.0.0: Permite conexiones desde fuera del contenedor Docker.