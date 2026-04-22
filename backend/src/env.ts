import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CERT_PATH: z.string().default('/certs/server.cert'),
  KEY_PATH: z.string().default('/certs/server.key'),
});

export const env = EnvSchema.parse(process.env);
