// ===== VALIDACIÓN DE VARIABLES DE ENTORNO =====
// Importamos Zod: librería para validar esquemas y obtener tipos TypeScript automáticamente
import { z } from "zod";

// Definimos el esquema de nuestras variables de entorno
// Esto nos da:
// 1. Validación en tiempo de ejecución (si falta algo, error claro)
// 2. Tipos TypeScript automáticos (autocompletado en el IDE)
// 3. Valores por defecto para desarrollo
const EnvSchema = z.object({
  // BACKEND_PORT: Puerto donde escuchará el servidor
  // z.coerce.number() → Convierte string a número automáticamente
  // .default(3000) → Si no existe la variable, usa 3000
  BACKEND_PORT: z.coerce.number().default(3000),
  
  // CORS_ORIGIN: Dominio desde el que se permiten peticiones HTTP
  // Por defecto permite el frontend en desarrollo (localhost:5173)
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  
  // DATABASE_URL: Cadena de conexión a PostgreSQL
  DATABASE_URL: z.string(),
  
  // JWT_SECRET: Clave secreta para firmar tokens JWT
  // IMPORTANTE: Debe ser un string aleatorio largo (mínimo 32 caracteres)
  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  
  // JWT_EXPIRES_IN: Duración de validez del token (ej: "7d", "24h", "30m")
  JWT_EXPIRES_IN: z.string().default("7d")
});

// Validamos las variables de entorno contra el esquema
// Si algo falla, Zod lanza un error descriptivo
// Si todo está bien, obtenemos un objeto tipado con los valores
export const env = EnvSchema.parse(process.env);

// Validación de las variables de entorno, define esquima con tipos y valores por defecto