import { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => {
    return { ok: true, ts: Date.now() };
  });
}
