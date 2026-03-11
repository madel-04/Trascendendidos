import fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './sockets/types';
import { registerSocketHandlers } from './sockets/handlers';

// ─── SSL Certificates (from shared Docker volume /certs) ────────────────────
// Certs are generated at startup by scripts/generate-certs.sh via ENTRYPOINT.
const certPath = process.env.CERT_PATH || '/certs/server.cert';
const keyPath  = process.env.KEY_PATH  || '/certs/server.key';

const httpsOptions = fs.existsSync(certPath) && fs.existsSync(keyPath)
  ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
  : undefined;

// ─── Fastify instance ─────────────────────────────────────────────────────────
const appOptions: any = { logger: true };
if (httpsOptions) appOptions.https = httpsOptions;

const app = fastify(appOptions);

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.register(cors, {
  origin: process.env.FRONTEND_URL || 'https://localhost:5173',
  credentials: true,
});

// ─── Static files (test panel) ───────────────────────────────────────────────
app.register(staticPlugin, {
  root: path.join(__dirname, '../public'),
  prefix: '/test/',
});

// ─── REST Routes ──────────────────────────────────────────────────────────────
app.get('/api/health', async (_request, _reply) => {
  return { status: 'ok', https: !!httpsOptions, timestamp: new Date().toISOString() };
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
app.ready((err) => {
  if (err) throw err;

  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    app.server,
    {
      cors: {
        origin: process.env.FRONTEND_URL || 'https://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      // Tune transport: prefer WebSocket, fall back to polling
      transports: ['websocket', 'polling'],
    }
  );

  registerSocketHandlers(io);
  app.log.info('Socket.io attached and ready');
});

// ─── Start ────────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Server started over ${httpsOptions ? 'HTTPS' : 'HTTP'} on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
