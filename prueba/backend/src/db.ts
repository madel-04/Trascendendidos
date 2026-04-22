// ===== CONEXIÓN A LA BASE DE DATOS =====
import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

// Pool de conexiones a PostgreSQL
// Reutiliza conexiones para mejor rendimiento
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

// ===== INICIALIZACIÓN DE TABLAS =====
// Crea las tablas si no existen
export async function initDatabase() {
  const client = await pool.connect();
  
  try {
    // Tabla de usuarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        two_fa_secret VARCHAR(255),
        two_fa_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Índices para mejorar rendimiento
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);

    console.log("Database tables initialized");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Helper para ejecutar queries de forma segura
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows;
}
