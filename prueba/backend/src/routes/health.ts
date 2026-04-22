// ===== RUTAS DE HEALTH CHECK =====
// Importamos el tipo FastifyInstance para tener autocompletado y tipos
import type { FastifyInstance } from "fastify";

// Función asíncrona que registra las rutas de health check
// Recibe la instancia de Fastify como parámetro
export async function healthRoutes(app: FastifyInstance) {
  // Definimos una ruta GET en /api/health
  // Propósito: Verificar que el servidor está funcionando correctamente
  // Usos comunes:
  //   - Monitoreo automático del servidor
  //   - Verificar conectividad desde el frontend
  //   - Health checks en sistemas de orquestación (Kubernetes, Docker)
  app.get("/api/health", async () => {
    // Retornamos un objeto JSON con:
    // - ok: true → Indica que el servidor está operativo
    // - ts: timestamp actual → Útil para verificar que el servidor responde en tiempo real
    return { ok: true, ts: Date.now() };
  });
}

// Verifica que el servidor está funcionando y se puede obtener el timestamp